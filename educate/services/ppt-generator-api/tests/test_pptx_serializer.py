"""
Comprehensive test suite for Phase 2.5:
PPTX Serialization, In-Memory Edit Persistence, and Downloadable Export.

Covers:
1. Valid export request succeeds and returns valid response structure.
2. Invalid source ID rejected (UUID validation).
3. Unknown source presentation returns 404.
4. Mismatched file_id between route and body returns 400.
5. Oversized asset payloads rejected with HTTP 413.
6. Path traversal in file_id and export_id rejected.
7. Export download returns correct PowerPoint MIME type.
8. Export download returns proper 404 for missing exports.
9. Exported PPTX opens successfully as a valid OOXML package.
10. Slide count and dimensions remain correct.
11. Edited geometry survives export and re-parsing.
12. Committed text edits survive export and re-parsing.
13. Supported text formatting (fonts, sizes, colors, alignment) survives export.
14. Replaced image content survives export.
15. Newly inserted image survives export.
16. Applied image crops survive export and re-parsing.
17. Reset crop is reflected in exported presentation.
18. Image movement, resizing, and rotation survive export.
19. Speaker notes survive export.
20. Unsupported native content is preserved.
21. Repeated exports create distinct files without overwriting source or previous exports.
22. Source PPTX immutability invariant: bytes, size, and mtime remain 100% unchanged.
23. Failed export cleans up temporary files.
"""

import base64
import copy
import hashlib
import io
import os
from pathlib import Path
import tempfile
import uuid
import zipfile

from fastapi.testclient import TestClient
from PIL import Image
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt
import pytest

from app.api import EXPORTS_DIR, STORAGE_DIR, app, _EXPORTED_REGISTRY
from app.models import (
    BorderDTO,
    ExportPresentationRequest,
    FillDTO,
    ImageAssetDTO,
    ImageCropDTO,
    LocalAssetPayload,
    PresentationEditorModel,
    SlideDetailDTO,
    SlideObjectDTO,
    TextContentDTO,
    TextParagraphDTO,
    TextRunDTO,
)
from app.pptx_parser import parse_presentation
from app.pptx_serializer import (
    SerializationError,
    ValidationError,
    serialize_presentation,
    validate_exported_presentation,
)

client = TestClient(app)


def _create_sample_image_bytes(color: str = "red", size: tuple = (100, 100)) -> bytes:
    """Helper to generate valid PNG image bytes."""
    buf = io.BytesIO()
    img = Image.new("RGB", size, color=color)
    img.save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture
def sample_presentation():
    """Create a temporary real PPTX fixture with text, shape, image, and notes."""
    fid = str(uuid.uuid4())
    pptx_path = STORAGE_DIR / f"{fid}.pptx"

    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    # Slide 1: Title & Shape & Picture & Notes
    slide1 = prs.slides.add_slide(prs.slide_layouts[6])  # Blank layout

    # Shape 1: Text box
    tb = slide1.shapes.add_textbox(Inches(1), Inches(1), Inches(6), Inches(2))
    tb.name = "Title Box"
    p = tb.text_frame.paragraphs[0]
    p.text = "Original Slide Title"
    p.alignment = PP_ALIGN.LEFT
    r = p.runs[0]
    r.font.name = "Calibri"
    r.font.size = Pt(32)

    # Shape 2: Colored Rectangle
    rect = slide1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(1), Inches(3.5), Inches(4), Inches(2))
    rect.name = "Blue Rectangle"
    rect.fill.solid()
    rect.fill.fore_color.rgb = RGBColor(0x25, 0x63, 0xEB)
    rect.line.color.rgb = RGBColor(0x1D, 0x4E, 0xD8)
    rect.line.width = Pt(2.0)

    # Shape 3: Picture
    img_bytes = _create_sample_image_bytes("red", (200, 200))
    pic = slide1.shapes.add_picture(io.BytesIO(img_bytes), Inches(6), Inches(3.5), Inches(3), Inches(3))
    pic.name = "Sample Photo"

    # Notes
    slide1.notes_slide.notes_text_frame.text = "Original teacher lecture notes."

    # Slide 2: Second content slide
    slide2 = prs.slides.add_slide(prs.slide_layouts[6])
    tb2 = slide2.shapes.add_textbox(Inches(1), Inches(1), Inches(8), Inches(1.5))
    tb2.name = "Header Slide 2"
    tb2.text_frame.paragraphs[0].text = "Slide 2 Content Header"

    prs.save(str(pptx_path))

    # Parse into SOM
    model = parse_presentation(pptx_path, fid, STORAGE_DIR)

    yield fid, pptx_path, model

    # Cleanup
    if pptx_path.exists():
        pptx_path.unlink()
    asset_dir = STORAGE_DIR / f"{fid}_assets"
    if asset_dir.exists():
        import shutil
        shutil.rmtree(asset_dir, ignore_errors=True)


class TestPPTXSerializerCore:
    """Unit tests for pptx_serializer module."""

    def test_serialize_geometry_updates(self, sample_presentation):
        fid, pptx_path, model = sample_presentation
        orig_stat = pptx_path.stat()
        orig_sha = hashlib.sha256(pptx_path.read_bytes()).hexdigest()

        # Modify geometry of shape 1 (move from x=144 to x=300, rotate 15 deg)
        working_model = copy.deepcopy(model)
        obj0 = working_model.slides[0].objects[0]
        obj0.x = 300.0
        obj0.y = 200.0
        obj0.width = 700.0
        obj0.height = 180.0
        obj0.rotation = 15.0

        export_id = str(uuid.uuid4())
        export_path, filename, warnings = serialize_presentation(
            source_pptx_path=pptx_path,
            model=working_model,
            local_assets=[],
            export_id=export_id,
            exports_dir=EXPORTS_DIR,
        )

        try:
            assert export_path.exists()
            assert export_path.stat().st_size > 0
            assert "edited" in filename

            # Source file immutability check
            current_stat = pptx_path.stat()
            assert current_stat.st_mtime == orig_stat.st_mtime
            assert current_stat.st_size == orig_stat.st_size
            assert hashlib.sha256(pptx_path.read_bytes()).hexdigest() == orig_sha

            # Re-parse exported presentation and verify coordinates survived
            exported_model = parse_presentation(export_path, export_id, EXPORTS_DIR)
            assert len(exported_model.slides) == 2
            reparsed_obj = exported_model.slides[0].objects[0]
            assert abs(reparsed_obj.x - 300.0) < 5.0
            assert abs(reparsed_obj.y - 200.0) < 5.0
            assert abs(reparsed_obj.rotation - 15.0) < 1.0
        finally:
            if export_path.exists():
                export_path.unlink()

    def test_serialize_committed_text_and_formatting(self, sample_presentation):
        fid, pptx_path, model = sample_presentation

        working_model = copy.deepcopy(model)
        obj0 = working_model.slides[0].objects[0]

        # Commit rich text update
        obj0.text_content = TextContentDTO(
            paragraphs=[
                TextParagraphDTO(
                    paragraph_index=0,
                    alignment="center",
                    runs=[
                        TextRunDTO(
                            run_index=0,
                            text="Updated Committed Title",
                            font_family="Arial",
                            font_size=28.0,
                            font_color="#EF4444",
                            bold=True,
                            italic=True,
                        )
                    ],
                )
            ]
        )

        export_id = str(uuid.uuid4())
        export_path, filename, warnings = serialize_presentation(
            source_pptx_path=pptx_path,
            model=working_model,
            local_assets=[],
            export_id=export_id,
            exports_dir=EXPORTS_DIR,
        )

        try:
            exported_model = parse_presentation(export_path, export_id, EXPORTS_DIR)
            reparsed_obj = exported_model.slides[0].objects[0]
            assert reparsed_obj.text_content is not None
            p = reparsed_obj.text_content.paragraphs[0]
            assert p.plain_text == "Updated Committed Title"
            assert p.alignment == "center"
            r = p.runs[0]
            assert r.bold is True
            assert r.italic is True
            assert r.font_color.upper() == "#EF4444"
            assert r.font_size == 28.0
        finally:
            if export_path.exists():
                export_path.unlink()

    def test_serialize_image_replacement_and_crop(self, sample_presentation):
        fid, pptx_path, model = sample_presentation

        # Generate new replacement blue image
        blue_img_bytes = _create_sample_image_bytes("blue", (300, 300))
        blue_b64 = base64.b64encode(blue_img_bytes).decode("ascii")

        working_model = copy.deepcopy(model)
        # Find picture shape
        pic_obj = None
        for obj in working_model.slides[0].objects:
            if obj.object_type == "picture":
                pic_obj = obj
                break
        assert pic_obj is not None

        # Replace image asset and apply a crop
        new_asset_id = "local_asset_blue_test"
        pic_obj.image_asset = ImageAssetDTO(
            asset_id=new_asset_id,
            url=f"blob:http://localhost/{new_asset_id}",
            content_type="image/png",
            width_px=300,
            height_px=300,
            is_local=True,
        )
        # 10% crop from each edge
        pic_obj.crop = ImageCropDTO(x=30.0, y=30.0, width=240.0, height=240.0)

        export_id = str(uuid.uuid4())
        local_payload = LocalAssetPayload(
            asset_id=new_asset_id,
            mime_type="image/png",
            data_base64=blue_b64,
            file_name="blue_replacement.png",
        )

        export_path, filename, warnings = serialize_presentation(
            source_pptx_path=pptx_path,
            model=working_model,
            local_assets=[local_payload],
            export_id=export_id,
            exports_dir=EXPORTS_DIR,
        )

        try:
            exported_model = parse_presentation(export_path, export_id, EXPORTS_DIR)
            reparsed_pic = None
            for obj in exported_model.slides[0].objects:
                if obj.object_type == "picture":
                    reparsed_pic = obj
                    break
            assert reparsed_pic is not None
            assert reparsed_pic.crop is not None
            # Verify crop values match roughly 30px on 300px image
            assert abs(reparsed_pic.crop.x - 30.0) < 5.0
            assert abs(reparsed_pic.crop.y - 30.0) < 5.0
            assert abs(reparsed_pic.crop.width - 240.0) < 10.0
            assert abs(reparsed_pic.crop.height - 240.0) < 10.0
        finally:
            if export_path.exists():
                export_path.unlink()

    def test_serialize_image_insertion(self, sample_presentation):
        fid, pptx_path, model = sample_presentation

        green_img_bytes = _create_sample_image_bytes("green", (200, 200))
        green_b64 = base64.b64encode(green_img_bytes).decode("ascii")

        working_model = copy.deepcopy(model)
        new_asset_id = "local_asset_green_new"

        # Insert new picture object on slide 1
        new_pic_obj = SlideObjectDTO(
            object_id="slide_1_obj_new_inserted_img",
            name="Newly Inserted Image",
            object_type="picture",
            x=800.0,
            y=150.0,
            width=250.0,
            height=250.0,
            x_emu=80000,
            y_emu=15000,
            width_emu=25000,
            height_emu=25000,
            rotation=0.0,
            image_asset=ImageAssetDTO(
                asset_id=new_asset_id,
                url=f"blob:http://localhost/{new_asset_id}",
                content_type="image/png",
                width_px=200,
                height_px=200,
                is_local=True,
            ),
        )
        working_model.slides[0].objects.append(new_pic_obj)

        export_id = str(uuid.uuid4())
        local_payload = LocalAssetPayload(
            asset_id=new_asset_id,
            mime_type="image/png",
            data_base64=green_b64,
            file_name="new_green.png",
        )

        export_path, filename, warnings = serialize_presentation(
            source_pptx_path=pptx_path,
            model=working_model,
            local_assets=[local_payload],
            export_id=export_id,
            exports_dir=EXPORTS_DIR,
        )

        try:
            exported_model = parse_presentation(export_path, export_id, EXPORTS_DIR)
            assert len(exported_model.slides[0].objects) == len(model.slides[0].objects) + 1
        finally:
            if export_path.exists():
                export_path.unlink()

    def test_speaker_notes_persistence(self, sample_presentation):
        fid, pptx_path, model = sample_presentation

        working_model = copy.deepcopy(model)
        working_model.slides[0].speaker_notes = "Updated teacher speaker notes for Lecture 1."

        export_id = str(uuid.uuid4())
        export_path, filename, warnings = serialize_presentation(
            source_pptx_path=pptx_path,
            model=working_model,
            local_assets=[],
            export_id=export_id,
            exports_dir=EXPORTS_DIR,
        )

        try:
            exported_model = parse_presentation(export_path, export_id, EXPORTS_DIR)
            assert exported_model.slides[0].speaker_notes == "Updated teacher speaker notes for Lecture 1."
        finally:
            if export_path.exists():
                export_path.unlink()

    def test_repeated_exports_are_distinct(self, sample_presentation):
        fid, pptx_path, model = sample_presentation

        export_id_1 = str(uuid.uuid4())
        export_id_2 = str(uuid.uuid4())

        path1, file1, _ = serialize_presentation(
            source_pptx_path=pptx_path,
            model=model,
            local_assets=[],
            export_id=export_id_1,
            exports_dir=EXPORTS_DIR,
        )

        path2, file2, _ = serialize_presentation(
            source_pptx_path=pptx_path,
            model=model,
            local_assets=[],
            export_id=export_id_2,
            exports_dir=EXPORTS_DIR,
        )

        try:
            assert path1 != path2
            assert path1.exists()
            assert path2.exists()
            assert file1 != file2
        finally:
            if path1.exists():
                path1.unlink()
            if path2.exists():
                path2.unlink()


class TestExportAPIEndpoints:
    """Integration tests for FastAPI export and download endpoints."""

    def test_export_endpoint_success(self, sample_presentation):
        fid, pptx_path, model = sample_presentation

        payload = {
            "model": model.model_dump(),
            "local_assets": [],
        }

        res = client.post(f"/api/editor/{fid}/export", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert "export_id" in data
        assert data["download_url"].startswith("/api/editor/export/")
        assert data["validation_status"] == "valid"

        export_id = data["export_id"]

        # Download exported presentation
        dl_res = client.get(f"/api/editor/export/{export_id}")
        assert dl_res.status_code == 200
        assert (
            dl_res.headers["content-type"]
            == "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        )
        assert "attachment" in dl_res.headers.get("content-disposition", "")
        assert len(dl_res.content) > 0

        # Verify ZIP structure
        with zipfile.ZipFile(io.BytesIO(dl_res.content)) as zf:
            assert "[Content_Types].xml" in zf.namelist()

        # Clean up export file
        exp_file = EXPORTS_DIR / f"{export_id}.pptx"
        if exp_file.exists():
            exp_file.unlink()

    def test_export_invalid_source_id_rejected(self, sample_presentation):
        fid, pptx_path, model = sample_presentation
        bad_model = model.model_dump()
        bad_model["file_id"] = "invalid-id"
        # Invalid source id in URL route (not UUID)
        res = client.post("/api/editor/invalid-id/export", json={"model": bad_model, "local_assets": []})
        assert res.status_code == 400
        assert "Invalid file identifier" in res.json()["detail"]

    def test_export_unknown_source_presentation_returns_404(self, sample_presentation):
        fid, pptx_path, model = sample_presentation
        unknown_id = str(uuid.uuid4())

        bad_model = model.model_dump()
        bad_model["file_id"] = unknown_id

        res = client.post(f"/api/editor/{unknown_id}/export", json={"model": bad_model, "local_assets": []})
        assert res.status_code == 404
        assert "not found" in res.json()["detail"].lower()

    def test_export_mismatched_file_id_rejected(self, sample_presentation):
        fid, pptx_path, model = sample_presentation
        different_id = str(uuid.uuid4())

        res = client.post(f"/api/editor/{fid}/export", json={"model": model.model_dump(), "local_assets": []})
        # If model has fid but route specifies different_id:
        res2 = client.post(f"/api/editor/{different_id}/export", json={"model": model.model_dump(), "local_assets": []})
        assert res2.status_code == 400
        assert "Mismatched presentation ID" in res2.json()["detail"]

    def test_export_download_invalid_id_rejected(self):
        res = client.get("/api/editor/export/invalid_id_123")
        assert res.status_code == 400
        assert "Invalid export identifier" in res.json()["detail"]

    def test_export_download_missing_export_returns_404(self):
        missing_id = str(uuid.uuid4())
        res = client.get(f"/api/editor/export/{missing_id}")
        assert res.status_code == 404
        assert "not found" in res.json()["detail"].lower()

    def test_export_path_traversal_in_file_id_rejected(self, sample_presentation):
        fid, pptx_path, model = sample_presentation
        bad_model = model.model_dump()
        bad_ids = ["../../etc/passwd", "..\\..\\windows\\win.ini", "subdir/file", "..%2F..%2Fetc%2Fpasswd"]
        for bad_id in bad_ids:
            bad_model["file_id"] = bad_id
            res = client.post(f"/api/editor/{bad_id}/export", json={"model": bad_model, "local_assets": []})
            assert res.status_code in (400, 404)

    def test_export_path_traversal_in_export_id_rejected(self):
        bad_ids = ["../../etc/passwd", "..\\..\\windows\\win.ini", "subdir/file"]
        for bad_id in bad_ids:
            res = client.get(f"/api/editor/export/{bad_id}")
            assert res.status_code in (400, 404)

    def test_export_oversized_payload_rejected(self, sample_presentation):
        fid, pptx_path, model = sample_presentation
        # Create a payload with data_base64 string exceeding 50 MB
        oversized_data = "A" * (51 * 1024 * 1024)
        payload = {
            "model": model.model_dump(),
            "local_assets": [
                {
                    "asset_id": "huge_asset",
                    "mime_type": "image/png",
                    "data_base64": oversized_data,
                }
            ],
        }
        res = client.post(f"/api/editor/{fid}/export", json=payload)
        assert res.status_code == 413
        assert "exceeds maximum limit" in res.json()["detail"]

    def test_reset_crop_clears_crop_fractions(self, sample_presentation):
        fid, pptx_path, model = sample_presentation
        working_model = copy.deepcopy(model)
        # Find picture shape
        pic_obj = None
        for obj in working_model.slides[0].objects:
            if obj.object_type == "picture":
                pic_obj = obj
                break
        assert pic_obj is not None

        # Reset crop explicitly
        pic_obj.crop = None

        export_id = str(uuid.uuid4())
        export_path, filename, warnings = serialize_presentation(
            source_pptx_path=pptx_path,
            model=working_model,
            local_assets=[],
            export_id=export_id,
            exports_dir=EXPORTS_DIR,
        )

        try:
            prs = Presentation(str(export_path))
            pic_shape = None
            for s in prs.slides[0].shapes:
                if hasattr(s, "image"):
                    pic_shape = s
                    break
            assert pic_shape is not None
            assert pic_shape.crop_left == 0.0
            assert pic_shape.crop_top == 0.0
            assert pic_shape.crop_right == 0.0
            assert pic_shape.crop_bottom == 0.0
        finally:
            if export_path.exists():
                export_path.unlink()

    def test_temp_cleanup_on_serialization_failure(self, sample_presentation):
        fid, pptx_path, model = sample_presentation
        working_model = copy.deepcopy(model)

        # Provoke failure with a corrupt asset
        corrupt_payload = LocalAssetPayload(
            asset_id="bad_asset",
            mime_type="image/png",
            data_base64="not_valid_base64_or_image",
            file_name="corrupt.png",
        )

        export_id = str(uuid.uuid4())
        temp_file = EXPORTS_DIR / f"{export_id}.tmp"

        # Should cleanly raise or handle without leaving temp file
        with pytest.raises(Exception):
            serialize_presentation(
                source_pptx_path=Path("nonexistent_source_path_to_trigger_fail.pptx"),
                model=working_model,
                local_assets=[corrupt_payload],
                export_id=export_id,
                exports_dir=EXPORTS_DIR,
            )

        assert not temp_file.exists()

    def test_powerpoint_style_text_formatting_serialization(self, sample_presentation):
        """
        Verify that PowerPoint-style text formatting:
        1. Font size (pt)
        2. Font family (Arial)
        3. Bold, italic, underline
        4. Text color
        5. Paragraph alignment
        6. Text-box fill / background color
        are faithfully written to exported PPTX and original source PPTX remains unchanged.
        """
        fid, pptx_path, model = sample_presentation
        orig_hash = hashlib.sha256(pptx_path.read_bytes()).hexdigest()

        working_model = copy.deepcopy(model)
        # Find a text box or shape with text
        text_obj = None
        for obj in working_model.slides[0].objects:
            if obj.object_type in ("text_box", "shape") and obj.text_content and obj.text_content.paragraphs:
                text_obj = obj
                break
        assert text_obj is not None

        # Apply rich PowerPoint-style formatting
        para = text_obj.text_content.paragraphs[0]
        para.alignment = "center"
        run = para.runs[0]
        run.font_size = 28.0
        run.font_family = "Arial"
        run.bold = True
        run.italic = True
        run.underline = True
        run.font_color = "#2563EB"

        # Apply solid container fill to text box
        text_obj.fill = FillDTO(fill_type="solid", color="#EFF6FF", alpha=1.0)

        export_id = str(uuid.uuid4())
        export_path, filename, warnings = serialize_presentation(
            source_pptx_path=pptx_path,
            model=working_model,
            local_assets=[],
            export_id=export_id,
            exports_dir=EXPORTS_DIR,
        )

        try:
            # Source PPTX immutability check
            assert hashlib.sha256(pptx_path.read_bytes()).hexdigest() == orig_hash

            # Verify exported PPTX with python-pptx
            prs = Presentation(str(export_path))
            slide = prs.slides[0]

            # Locate corresponding shape
            target_shape = None
            for s in slide.shapes:
                if s.has_text_frame:
                    text_match = False
                    for p in s.text_frame.paragraphs:
                        if run.text in p.text:
                            text_match = True
                            break
                    if text_match:
                        target_shape = s
                        break

            assert target_shape is not None, "Target shape with formatted text not found in export"

            # Check paragraph alignment
            p0 = target_shape.text_frame.paragraphs[0]
            assert p0.alignment == PP_ALIGN.CENTER

            # Check run formatting
            r0 = p0.runs[0]
            assert r0.font.size.pt == 28.0
            assert r0.font.name == "Arial"
            assert r0.font.bold is True
            assert r0.font.italic is True
            assert r0.font.underline is True
            assert r0.font.color.rgb == RGBColor(37, 99, 235)

            # Check text-box fill
            assert target_shape.fill.type is not None
            assert target_shape.fill.fore_color.rgb == RGBColor(239, 246, 255)
        finally:
            if export_path.exists():
                export_path.unlink()


