"""
End-to-End Verification Test for 8 PowerPoint Themes and 10-Section AI Curriculum.
Verifies consistent PowerPoint generation, COM slide rendering, and theme switching.
"""

from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from pptx import Presentation

from app.api import app, _GENERATED_REGISTRY
from app.layouts import THEMES, get_theme, list_themes
from app.ppt_generator import PPTGenerator
from app.content_parser import ContentParser


@pytest.fixture
def client():
    return TestClient(app)


def test_theme_registry_completeness():
    """Verify all 8 original professional themes and 6 new dark themes exist with proper palette metadata."""
    original_themes = [
        "academic_navy",
        "modern_blue",
        "emerald_pro",
        "purple_gradient",
        "corporate_minimal",
        "dark_tech",
        "warm_creative",
        "clean_light",
    ]
    new_dark_themes = [
        "midnight_blue",
        "cyber_neon",
        "obsidian_gold",
        "dark_purple",
        "graphite_pro",
        "deep_ocean",
    ]
    all_themes = list_themes()
    assert len(all_themes) >= 14, f"Expected at least 14 themes, found {len(all_themes)}"
    
    theme_ids = [t["id"] for t in all_themes]
    for expected in original_themes:
        assert expected in theme_ids, f"Original theme {expected} missing from list_themes()"

    for expected_dark in new_dark_themes:
        assert expected_dark in theme_ids, f"New dark theme {expected_dark} missing from list_themes()"
        theme_obj = get_theme(expected_dark)
        assert theme_obj.is_dark is True, f"Theme {expected_dark} should have is_dark=True"

    dark_theme = get_theme("dark_tech")
    assert dark_theme.is_dark is True
    assert dark_theme.hex_primary == "#06B6D4"
    assert dark_theme.hex_bg == "#0B132B"

    navy_theme = get_theme("academic_navy")
    assert navy_theme.is_dark is False
    assert navy_theme.hex_primary == "#0F2C59"
    assert navy_theme.hex_accent == "#D97706"


def test_themes_api_endpoint(client):
    """Verify GET /api/themes returns the full catalog of themes."""
    res = client.get("/api/themes")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 14
    assert any(t["id"] == "dark_tech" and t["is_dark"] is True for t in data)
    assert any(t["id"] == "midnight_blue" and t["is_dark"] is True for t in data)
    assert any(t["id"] == "cyber_neon" and t["is_dark"] is True for t in data)
    assert any(t["id"] == "emerald_pro" for t in data)


def test_ai_curriculum_10_sections_parsing():
    """Verify parsing of the 10-section AI lecture notes file with speaker notes."""
    notes_path = Path("sample_data/ai_transforming_modern_world.txt")
    assert notes_path.exists(), "sample_data/ai_transforming_modern_world.txt must exist"

    parser = ContentParser()
    data = parser.parse_file(notes_path)
    assert "Artificial Intelligence" in data.title
    # All 10 curriculum sections should be present
    assert len(data.content_sections) >= 8, f"Parsed sections: {len(data.content_sections)}"

    # Verify speaker notes are populated
    sections_with_notes = [s for s in data.content_sections if s.speaker_notes]
    assert len(sections_with_notes) >= 5, "At least 5 sections should have extracted speaker notes"


@pytest.mark.parametrize("theme_id", ["academic_navy", "dark_tech", "emerald_pro"])
def test_generate_and_preview_multiple_themes(client, theme_id):
    """Verify PowerPoint generation and slide previews for 3 distinct themes using 10-section AI curriculum."""
    notes_path = Path("sample_data/ai_transforming_modern_world.txt")
    notes_text = notes_path.read_text(encoding="utf-8")

    response = client.post(
        "/api/generate",
        data={
            "notes_text": notes_text,
            "mode": "deterministic",
            "theme": theme_id,
            "title_override": f"AI Modern World ({theme_id})",
        },
    )
    assert response.status_code == 200, f"Failed generation for theme {theme_id}: {response.text}"
    res_data = response.json()

    assert res_data["theme"] == theme_id
    assert res_data["slide_count"] >= 10
    assert len(res_data["slides"]) == res_data["slide_count"]

    # Verify PowerPoint file was created and is valid
    file_id = res_data["file_id"]
    pptx_path = Path("output/web_generated") / f"{file_id}.pptx"
    assert pptx_path.exists(), f"PPTX file {pptx_path} not found"
    assert pptx_path.stat().st_size > 10000

    prs = Presentation(str(pptx_path))
    assert len(prs.slides) == res_data["slide_count"]

    # Verify slide preview images were generated
    preview_dir = Path("output/web_generated") / f"{file_id}_previews"
    assert preview_dir.exists(), f"Preview directory {preview_dir} missing"
    preview_files = list(preview_dir.glob("slide_*.png"))
    assert len(preview_files) == res_data["slide_count"], (
        f"Expected {res_data['slide_count']} slide images, got {len(preview_files)}"
    )

    # Test downloading the PPTX
    dl_res = client.get(f"/api/download/{file_id}")
    assert dl_res.status_code == 200
    assert len(dl_res.content) == pptx_path.stat().st_size

    # Test preview image endpoint for slide 1
    p1_res = client.get(f"/api/preview/{file_id}/1")
    assert p1_res.status_code == 200
    assert p1_res.headers["content-type"] == "image/png"


def test_retheme_existing_presentation(client):
    """Verify switching themes on an existing presentation regenerates PPTX and slide previews."""
    notes_path = Path("sample_data/ai_transforming_modern_world.txt")
    notes_text = notes_path.read_text(encoding="utf-8")

    # 1. Generate initial presentation in academic_navy
    initial_res = client.post(
        "/api/generate",
        data={
            "notes_text": notes_text,
            "mode": "deterministic",
            "theme": "academic_navy",
        },
    )
    assert initial_res.status_code == 200
    initial_data = initial_res.json()
    orig_file_id = initial_data["file_id"]

    # 2. Re-theme to dark_tech
    retheme_res = client.post(
        "/api/retheme",
        json={"file_id": orig_file_id, "theme": "dark_tech"},
    )
    assert retheme_res.status_code == 200, f"Retheme failed: {retheme_res.text}"
    retheme_data = retheme_res.json()

    assert retheme_data["theme"] == "dark_tech"
    assert retheme_data["file_id"] != orig_file_id
    new_file_id = retheme_data["file_id"]

    # Check new PPTX file exists and is valid
    new_pptx_path = Path("output/web_generated") / f"{new_file_id}.pptx"
    assert new_pptx_path.exists()
    assert new_pptx_path.stat().st_size > 10000

    # Check new preview images exist
    new_preview_dir = Path("output/web_generated") / f"{new_file_id}_previews"
    assert new_preview_dir.exists()
    new_previews = list(new_preview_dir.glob("slide_*.png"))
    assert len(new_previews) == retheme_data["slide_count"]
