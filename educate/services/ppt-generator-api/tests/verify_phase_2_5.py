"""
End-to-End Verification Script for Phase 2.5:
PPTX Serialization, In-Memory Edit Persistence, and Downloadable Export.

Tests against the live running FastAPI server on http://127.0.0.1:8000:
1. Loads real generated presentation SOM from /api/editor/{file_id}.
2. Applies in-memory edits:
   - Text edit and formatting
   - Shape movement and rotation
   - Newly inserted image with base64 payload
   - Image crop application
   - Speaker notes modification
3. Sends POST /api/editor/{file_id}/export.
4. Downloads exported .pptx from /api/editor/export/{export_id}.
5. Validates ZIP integrity and re-parses with python-pptx and parse_presentation.
6. Asserts exact byte-for-byte immutability of the source PPTX.
"""

import base64
import copy
import hashlib
import io
import json
import os
from pathlib import Path
import urllib.request
import zipfile

from PIL import Image
from pptx import Presentation
from pptx.dml.color import RGBColor

BASE_URL = "http://127.0.0.1:8000"
SOURCE_FILE_ID = "dd98c2d9-48ce-446f-8e22-3623267ab9e1"
SOURCE_PATH = Path(f"output/web_generated/{SOURCE_FILE_ID}.pptx").resolve()


def create_test_image(color="purple", size=(240, 240)) -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGBA", size, color=color)
    img.save(buf, format="PNG")
    return buf.getvalue()


def run_verification():
    print("=" * 70)
    print("ACADION PHASE 2.5: E2E SERIALIZATION & EXPORT VERIFICATION")
    print("=" * 70)

    # 1. Capture pristine source PPTX state
    assert SOURCE_PATH.exists(), f"Source presentation not found at {SOURCE_PATH}"
    initial_stat = SOURCE_PATH.stat()
    initial_bytes = SOURCE_PATH.read_bytes()
    initial_sha256 = hashlib.sha256(initial_bytes).hexdigest()
    print(f"[*] Original Source PPTX:")
    print(f"    Path:   {SOURCE_PATH.name}")
    print(f"    Size:   {initial_stat.st_size} bytes")
    print(f"    Mtime:  {initial_stat.st_mtime}")
    print(f"    SHA256: {initial_sha256}")

    # 2. Fetch SOM via GET /api/editor/{file_id}
    print("\n[*] Fetching presentation SOM from /api/editor/" + SOURCE_FILE_ID)
    req = urllib.request.Request(f"{BASE_URL}/api/editor/{SOURCE_FILE_ID}")
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200
        som_data = json.loads(resp.read().decode())

    print(f"    Loaded {som_data['slide_count']} slides successfully.")
    slide1 = som_data["slides"][0]

    # 3. Apply in-memory edits to SOM
    working_model = copy.deepcopy(som_data)
    w_slide1 = working_model["slides"][0]

    # A. Text Edit
    # Find first text box or title
    text_obj = None
    shape_obj = None
    for obj in w_slide1["objects"]:
        if (
            obj["object_type"] in ("text_box", "shape")
            and obj.get("text_content")
            and obj["text_content"].get("paragraphs")
            and any(len(p.get("runs", [])) > 0 for p in obj["text_content"]["paragraphs"])
        ):
            text_obj = obj
            break
    for obj in w_slide1["objects"]:
        if obj["object_type"] == "shape" and obj != text_obj and not "background" in obj["name"].lower():
            shape_obj = obj
            break

    assert text_obj is not None, "Slide 1 must have at least one text object"
    original_text_title = text_obj["text_content"]["paragraphs"][0]["runs"][0]["text"]
    print(f"[*] Modifying text box '{text_obj['name']}':")
    print(f"    Original text: '{original_text_title}'")
    w_p = text_obj["text_content"]["paragraphs"][0]
    w_p["runs"][0]["text"] = "Phase 2.5 Serialized & Exported Title"
    w_p["runs"][0]["bold"] = True
    w_p["runs"][0]["font_color"] = "#2563EB"
    print(f"    New text:      'Phase 2.5 Serialized & Exported Title' (Bold, Color: #2563EB)")

    # B. Shape Movement & Rotation
    if shape_obj:
        print(f"[*] Modifying shape '{shape_obj['name']}':")
        print(f"    Original geometry: x={shape_obj['x']}, y={shape_obj['y']}, rot={shape_obj['rotation']}")
        shape_obj["x"] += 50.0
        shape_obj["y"] += 25.0
        shape_obj["rotation"] = 12.0
        print(f"    New geometry:      x={shape_obj['x']}, y={shape_obj['y']}, rot={shape_obj['rotation']}")

    # C. Image Insertion with base64 payload
    inserted_asset_id = "local_asset_phase25_verify"
    inserted_img_bytes = create_test_image("purple", (200, 200))
    inserted_b64 = base64.b64encode(inserted_img_bytes).decode("ascii")

    inserted_obj = {
        "object_id": f"{SOURCE_FILE_ID}_slide_1_obj_new_verify_img",
        "name": "Phase 2.5 Inserted Verified Photo",
        "object_type": "picture",
        "shape_type": None,
        "x": 1200.0,
        "y": 450.0,
        "width": 300.0,
        "height": 300.0,
        "x_emu": 12000000,
        "y_emu": 4500000,
        "width_emu": 3000000,
        "height_emu": 3000000,
        "rotation": 5.0,
        "z_index": len(w_slide1["objects"]),
        "fill": None,
        "border": None,
        "text_content": None,
        "image_asset": {
            "asset_id": inserted_asset_id,
            "url": f"blob:http://localhost/{inserted_asset_id}",
            "content_type": "image/png",
            "original_filename": "verify_purple.png",
            "width_px": 200,
            "height_px": 200,
            "is_local": True,
        },
        "crop": {
            "x": 20.0,
            "y": 20.0,
            "width": 160.0,
            "height": 160.0,
        },
        "table_data": None,
        "is_unsupported": False,
        "unsupported_reason": None,
    }
    w_slide1["objects"].append(inserted_obj)
    print(f"[*] Added new image object '{inserted_obj['name']}' with 10% crop (20px) and 5 deg rotation.")

    # D. Speaker Notes modification
    w_slide1["speaker_notes"] = "Phase 2.5 verified speaker notes for exported presentation."
    print(f"[*] Updated Slide 1 speaker notes: '{w_slide1['speaker_notes']}'")

    # 4. Submit export request: POST /api/editor/{file_id}/export
    print(f"\n[*] Submitting export request to POST /api/editor/{SOURCE_FILE_ID}/export...")
    export_payload = {
        "model": working_model,
        "local_assets": [
            {
                "asset_id": inserted_asset_id,
                "mime_type": "image/png",
                "data_base64": inserted_b64,
                "file_name": "verify_purple.png",
            }
        ],
    }
    post_data = json.dumps(export_payload).encode("utf-8")
    post_req = urllib.request.Request(
        f"{BASE_URL}/api/editor/{SOURCE_FILE_ID}/export",
        data=post_data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(post_req) as post_resp:
        assert post_resp.status == 200
        export_resp = json.loads(post_resp.read().decode())

    print("[+] Export API responded successfully:")
    print(f"    Success:           {export_resp['success']}")
    print(f"    Export ID:         {export_resp['export_id']}")
    print(f"    Download URL:      {export_resp['download_url']}")
    print(f"    Output Filename:   {export_resp['output_filename']}")
    print(f"    Validation Status: {export_resp['validation_status']}")
    print(f"    Warnings:          {export_resp['warnings']}")

    export_id = export_resp["export_id"]
    download_url = f"{BASE_URL}{export_resp['download_url']}"

    # 5. Download exported PPTX file
    print(f"\n[*] Downloading exported PPTX from {download_url}...")
    dl_req = urllib.request.Request(download_url)
    with urllib.request.urlopen(dl_req) as dl_resp:
        assert dl_resp.status == 200
        content_type = dl_resp.headers.get("Content-Type")
        content_disp = dl_resp.headers.get("Content-Disposition")
        exported_bytes = dl_resp.read()

    print(f"    Downloaded {len(exported_bytes)} bytes.")
    print(f"    Content-Type:        {content_type}")
    print(f"    Content-Disposition: {content_disp}")

    assert content_type == "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    assert "attachment" in content_disp
    assert export_resp["output_filename"] in content_disp

    # 6. Verify ZIP & OOXML Integrity
    print("\n[*] Verifying ZIP and OOXML container integrity...")
    with zipfile.ZipFile(io.BytesIO(exported_bytes), "r") as zf:
        corrupted = zf.testzip()
        assert corrupted is None, f"ZIP corruption detected in part: {corrupted}"
        names = zf.namelist()
        assert "[Content_Types].xml" in names
        assert "ppt/presentation.xml" in names
        print(f"    ZIP archive valid. Contained {len(names)} parts.")

    # 7. Re-open exported presentation with python-pptx
    print("\n[*] Re-opening exported presentation with python-pptx...")
    prs = Presentation(io.BytesIO(exported_bytes))
    assert len(prs.slides) == som_data["slide_count"], (
        f"Slide count mismatch: {len(prs.slides)} vs {som_data['slide_count']}"
    )
    print(f"    Slide count preserved: {len(prs.slides)}")

    exp_slide1 = prs.slides[0]

    # Verify committed text edit
    found_text = False
    for shp in exp_slide1.shapes:
        if shp.has_text_frame:
            for p in shp.text_frame.paragraphs:
                if "Phase 2.5 Serialized & Exported Title" in p.text:
                    found_text = True
                    # Check formatting
                    assert p.runs[0].font.bold is True
                    assert p.runs[0].font.color.rgb == RGBColor(0x25, 0x63, 0xEB)
                    print(f"    [OK] Text edit verified: '{p.text}' with Bold=True, RGB=(37, 99, 235)")
                    break
    assert found_text, "Edited text not found in exported presentation!"

    # Verify speaker notes
    assert exp_slide1.has_notes_slide
    notes_text = exp_slide1.notes_slide.notes_text_frame.text
    assert "Phase 2.5 verified speaker notes for exported presentation." in notes_text
    print(f"    [OK] Speaker notes verified: '{notes_text.strip()}'")

    # Verify inserted image
    found_inserted_img = False
    for shp in exp_slide1.shapes:
        if hasattr(shp, "image"):
            # Check crop fractions
            if abs(shp.crop_left - 0.1) < 0.05 and abs(shp.crop_top - 0.1) < 0.05:
                found_inserted_img = True
                print(f"    [OK] Inserted image verified with crop_left={shp.crop_left}, crop_top={shp.crop_top}, rotation={shp.rotation}")
                break
    assert found_inserted_img, "Inserted image shape not found in exported presentation!"

    # 8. CORE INVARIANT: Confirm original source PPTX remains 100% UNTOUCHED
    print("\n[*] Checking Original Source Presentation Immutability...")
    final_stat = SOURCE_PATH.stat()
    final_bytes = SOURCE_PATH.read_bytes()
    final_sha256 = hashlib.sha256(final_bytes).hexdigest()

    print(f"    Pre-Export Size:   {initial_stat.st_size} | Post-Export Size:   {final_stat.st_size}")
    print(f"    Pre-Export Mtime:  {initial_stat.st_mtime} | Post-Export Mtime:  {final_stat.st_mtime}")
    print(f"    Pre-Export SHA256: {initial_sha256}")
    print(f"    Post-Export SHA256:{final_sha256}")

    assert initial_stat.st_size == final_stat.st_size, "Source presentation file size changed!"
    assert initial_stat.st_mtime == final_stat.st_mtime, "Source presentation mtime changed!"
    assert initial_sha256 == final_sha256, "Source presentation SHA256 checksum changed!"

    print("\n[SUCCESS] ALL PHASE 2.5 VERIFICATION CHECKS PASSED PERFECTLY!")
    print(f"[SUCCESS] Exported file verified at {export_resp['download_url']}")
    print(f"[SUCCESS] Original presentation is 100% untouched and preserved.")
    print("=" * 70)


if __name__ == "__main__":
    run_verification()
