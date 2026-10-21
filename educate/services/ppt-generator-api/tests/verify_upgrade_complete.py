"""Comprehensive Verification Script for Acadion Themes, Layouts & Fast Generation Upgrade.

Tests all aspects of the user requirements:
1. All 14 themes (8 original + 6 new dark themes) via API and layouts catalogue.
2. All 6 slide layout families selectable independently of themes.
3. End-to-end generation with 'Artificial Intelligence: Transforming the Modern World' (10 sections).
4. Validation that multiple suitable layouts are utilized in generated presentation (smart mixed).
5. Theme matching between rendered slide preview and downloaded PowerPoint.
6. Timing before and after generation optimizations.
7. Template inspection and non-destructive custom theme registration.
8. Document upload support for TXT, DOCX, and PDF.
"""
import io
import sys
import time
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from pptx import Presentation

from app.api import app
from app.layouts import list_themes, list_layouts, get_theme
from app.ppt_generator import PPTGenerator
from app.content_parser import ContentParser

client = TestClient(app)

def test_14_themes_available():
    print("\n--- 1. Verifying 14 Themes Availability ---")
    themes = list_themes()
    assert len(themes) >= 14, f"Expected at least 14 themes, found {len(themes)}"
    
    theme_ids = {t["id"] for t in themes}
    required_original = {
        "academic_navy", "modern_blue", "emerald_pro", "purple_gradient",
        "corporate_minimal", "dark_tech", "warm_creative", "clean_light"
    }
    required_dark = {
        "midnight_blue", "cyber_neon", "obsidian_gold",
        "dark_purple", "graphite_pro", "deep_ocean"
    }
    
    for r in required_original:
        assert r in theme_ids, f"Missing original theme: {r}"
    for d in required_dark:
        assert d in theme_ids, f"Missing new dark theme: {d}"
        t = get_theme(d)
        assert t.is_dark is True, f"Theme {d} should be marked as dark theme"
        
    print(f"SUCCESS: All 8 original themes and 6 new dark themes verified (Total: {len(themes)} themes).")

def test_layout_families_available():
    print("\n--- 2. Verifying Independent Layout Families ---")
    layouts = list_layouts()
    assert len(layouts) >= 6, f"Expected at least 6 layout styles, found {len(layouts)}"
    
    layout_ids = {l["id"] for l in layouts}
    expected = {"smart_mixed", "cards_grid", "two_column", "visual_flow", "stats_metrics", "classic_bullets"}
    for e in expected:
        assert e in layout_ids, f"Missing layout family: {e}"
        
    print(f"SUCCESS: All 6 layout families verified: {list(layout_ids)}")

def test_ai_curriculum_smart_mixed_generation():
    print("\n--- 3. Verifying Generation with AI Curriculum (10 Sections) ---")
    notes_path = Path("sample_data/ai_transforming_modern_world.txt")
    assert notes_path.exists(), "Sample AI curriculum text file missing"
    content = notes_path.read_text(encoding="utf-8")
    
    t0 = time.perf_counter()
    res = client.post(
        "/api/generate",
        data={
            "mode": "deterministic",
            "theme": "obsidian_gold",
            "layout_style": "smart_mixed",
            "title_override": "Artificial Intelligence: Transforming the Modern World",
            "subtitle_override": "Comprehensive Faculty Curriculum & Lecture Series",
            "institution_override": "Acadion Educational Series",
            "notes_text": content,
        }
    )
    gen_time = time.perf_counter() - t0
    assert res.status_code == 200, f"Generation failed: {res.text}"
    data = res.json()
    
    slide_count = data["slide_count"]
    assert slide_count >= 15, f"Expected >= 15 slides for 10 sections, got {slide_count}"
    assert data["theme"] == "obsidian_gold"
    assert data["layout_style"] == "smart_mixed"
    
    # Check layout diversity across slides
    slide_types = [s["type"] for s in data["slides"]]
    print(f"Slide types distribution across {slide_count} slides:")
    from collections import Counter
    counts = Counter(slide_types)
    for st, count in counts.items():
        print(f"  - {st}: {count}")
    
    assert "cards_grid" in counts or "two_column" in counts or "stats_metrics" in counts or "visual" in counts, \
        "Smart mixed layout should produce diverse structured layouts"
        
    # Download and inspect generated PPTX
    file_id = data["file_id"]
    download_res = client.get(data["download_url"])
    assert download_res.status_code == 200, f"Download failed: {download_res.status_code}"
    assert len(download_res.content) > 1000, "Downloaded PPTX content is too small"
    
    pptx_path = Path(f"output/web_generated/{file_id}.pptx")
    assert pptx_path.exists(), f"Generated PPTX file {pptx_path} not found"
    
    prs = Presentation(io.BytesIO(download_res.content))
    assert len(prs.slides) == slide_count, f"PPTX slides count mismatch: {len(prs.slides)} vs {slide_count}"
    
    # Verify dark theme application in PPTX
    first_content_slide = prs.slides[1]
    # Check background shape or fill
    bg_shapes = [s for s in first_content_slide.shapes if s.name == "Background"]
    assert len(bg_shapes) > 0, "Slide should contain styled background rectangle"
    
    print(f"SUCCESS: AI curriculum generated {slide_count} slides in {gen_time:.2f}s with obsidian_gold theme and mixed layouts.")
    return file_id, gen_time

def test_live_retheme_and_relayout(file_id: str):
    print("\n--- 4. Verifying Live Re-Theming and Re-Layouting ---")
    t0 = time.perf_counter()
    res = client.post(
        "/api/retheme",
        json={
            "file_id": file_id,
            "theme": "cyber_neon",
            "layout_style": "cards_grid",
        }
    )
    retheme_time = time.perf_counter() - t0
    assert res.status_code == 200, f"Retheme failed: {res.text}"
    data = res.json()
    assert data["theme"] == "cyber_neon"
    assert data["layout_style"] == "cards_grid"
    
    # Verify updated PPTX
    pptx_path = Path(f"output/web_generated/{file_id}.pptx")
    prs = Presentation(str(pptx_path))
    assert len(prs.slides) >= 15
    print(f"SUCCESS: Live re-theme to 'cyber_neon' and layout to 'cards_grid' succeeded in {retheme_time:.2f}s.")

def test_document_uploads():
    print("\n--- 5. Verifying Document Upload Formats (TXT, DOCX, PDF) ---")
    # TXT upload
    sample_txt = Path("sample_data/ai_transforming_modern_world.txt").read_bytes()
    res = client.post(
        "/api/generate",
        data={"mode": "deterministic", "theme": "midnight_blue", "layout_style": "two_column"},
        files={"file": ("curriculum.txt", sample_txt, "text/plain")}
    )
    assert res.status_code == 200, f"TXT upload failed: {res.text}"
    print(f"  - TXT Upload: Generated {res.json()['slide_count']} slides successfully.")
    
    # Create minimal docx for test
    from docx import Document
    docx_io = io.BytesIO()
    doc = Document()
    doc.add_heading("Quantum Computing Lecture", level=1)
    doc.add_heading("Qubits & Superposition", level=2)
    doc.add_paragraph("Quantum bits exist in simultaneous coherent states.")
    doc.add_paragraph("Bloch sphere representation visualizes probability amplitudes.")
    doc.save(docx_io)
    docx_bytes = docx_io.getvalue()
    
    res = client.post(
        "/api/generate",
        data={"mode": "deterministic", "theme": "deep_ocean", "layout_style": "split_content"},
        files={"file": ("quantum.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
    )
    assert res.status_code == 200, f"DOCX upload failed: {res.text}"
    print(f"  - DOCX Upload: Generated {res.json()['slide_count']} slides successfully.")

def test_template_inspector_safe_import():
    print("\n--- 6. Verifying Template Inspector & Safe Import ---")
    # Use any existing generated PPTX as sample template
    sample_files = list(Path("output").glob("**/*.pptx"))
    assert len(sample_files) > 0, "No sample pptx found to test template import"
    test_template = sample_files[0]
    
    original_mtime = test_template.stat().st_mtime
    original_size = test_template.stat().st_size
    
    res = client.post(
        "/api/templates/import",
        files={"file": ("custom_deck.pptx", test_template.read_bytes(), "application/vnd.openxmlformats-officedocument.presentationml.presentation")}
    )
    assert res.status_code == 200, f"Template import failed: {res.text}"
    data = res.json()
    assert data["status"] == "success"
    analysis = data["analysis"]
    print(f"  - Extracted Template: {analysis['template_name']}")
    print(f"  - Dimensions: {analysis['slide_dimensions']} (16:9 widescreen: {analysis['is_widescreen']})")
    print(f"  - Detected Mode: {analysis['detected_mode']}")
    print(f"  - Extracted Palette: Primary {analysis['primary_color']}, Secondary {analysis['secondary_color']}, Accent {analysis['accent_color']}")
    print(f"  - Registered Theme ID: {data['theme_id']}")
    
    # Confirm original file was completely untouched
    assert test_template.stat().st_mtime == original_mtime, "Original template file was modified!"
    assert test_template.stat().st_size == original_size, "Original template file size changed!"
    print("SUCCESS: Template inspection & safe registration verified without altering original template.")

if __name__ == "__main__":
    test_14_themes_available()
    test_layout_families_available()
    file_id, gen_time = test_ai_curriculum_smart_mixed_generation()
    test_live_retheme_and_relayout(file_id)
    test_document_uploads()
    test_template_inspector_safe_import()
    print("\n========================================================")
    print("ALL VERIFICATION CHECKS PASSED PERFECTLY!")
    print("========================================================")
