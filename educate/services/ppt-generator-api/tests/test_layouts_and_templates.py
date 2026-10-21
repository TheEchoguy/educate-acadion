"""
Tests for Slide Layout Families, Local PPTX Template Import, and Multi-Layout Planning.
"""

import io
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from pptx import Presentation

from app.api import app
from app.content_parser import ContentParser
from app.layouts import list_layouts, list_themes, get_theme
from app.ppt_generator import PPTGenerator
from app.template_importer import TemplateImporter


@pytest.fixture
def client():
    return TestClient(app)


def test_list_layouts_endpoint(client: TestClient):
    """Verify GET /api/layouts returns all 6 layout families."""
    res = client.get("/api/layouts")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 6
    layout_ids = [l["id"] for l in data]
    for expected in ["smart_mixed", "cards_grid", "two_column", "visual_flow", "stats_metrics", "classic_bullets"]:
        assert expected in layout_ids


def test_generate_with_cards_grid_layout(tmp_path: Path):
    """Verify PPTGenerator with layout_style='cards_grid' assigns cards_grid to content slides."""
    notes_path = Path("sample_data/ai_transforming_modern_world.txt")
    parser = ContentParser()
    data = parser.parse_file(notes_path)

    gen = PPTGenerator(theme="midnight_blue", layout_style="cards_grid")
    out_file = tmp_path / "cards_grid_test.pptx"
    gen.generate(data, out_file, layout_style="cards_grid")

    assert out_file.exists()
    ver = PPTGenerator.verify_presentation(out_file)
    assert ver["slide_count"] >= 10
    assert ver["widescreen_16_9"] is True


def test_generate_with_two_column_layout(tmp_path: Path):
    """Verify PPTGenerator with layout_style='two_column'."""
    notes_path = Path("sample_data/ai_transforming_modern_world.txt")
    parser = ContentParser()
    data = parser.parse_file(notes_path)

    gen = PPTGenerator(theme="cyber_neon", layout_style="two_column")
    out_file = tmp_path / "two_column_test.pptx"
    gen.generate(data, out_file, layout_style="two_column")

    assert out_file.exists()
    ver = PPTGenerator.verify_presentation(out_file)
    assert ver["slide_count"] >= 10


def test_generate_with_stats_metrics_layout(tmp_path: Path):
    """Verify PPTGenerator with layout_style='stats_metrics'."""
    notes_path = Path("sample_data/ai_transforming_modern_world.txt")
    parser = ContentParser()
    data = parser.parse_file(notes_path)

    gen = PPTGenerator(theme="obsidian_gold", layout_style="stats_metrics")
    out_file = tmp_path / "stats_metrics_test.pptx"
    gen.generate(data, out_file, layout_style="stats_metrics")

    assert out_file.exists()
    ver = PPTGenerator.verify_presentation(out_file)
    assert ver["slide_count"] >= 10


def test_template_inspection_and_import(tmp_path: Path):
    """Verify TemplateImporter safely extracts properties from a PPTX file and registers a custom theme."""
    notes_path = Path("sample_data/ai_transforming_modern_world.txt")
    parser = ContentParser()
    data = parser.parse_file(notes_path)

    sample_pptx = tmp_path / "sample_source_template.pptx"
    gen = PPTGenerator(theme="deep_ocean")
    gen.generate(data, sample_pptx)

    # Inspect template
    importer = TemplateImporter()
    report = importer.inspect_and_import(sample_pptx, custom_name="Custom Abyssal Template")

    assert report.is_compatible is True
    assert "Custom Abyssal Template" in report.display_name
    assert report.is_dark is True
    assert report.theme_id.startswith("imported_")
    assert report.colors["primary"]
    assert report.colors["bg"]
    assert len(report.limitations) > 0

    # Verify registered theme can be used for generation
    custom_theme = get_theme(report.theme_id)
    assert custom_theme.id == report.theme_id
    assert custom_theme.display_name == "Custom Abyssal Template"

    out_file = tmp_path / "custom_theme_test.pptx"
    gen_custom = PPTGenerator(theme=custom_theme.id)
    gen_custom.generate(data, out_file)
    assert out_file.exists()


def test_import_template_api_endpoint(client: TestClient, tmp_path: Path):
    """Verify POST /api/templates/import accepts a PPTX file and returns the inspection report."""
    notes_path = Path("sample_data/ai_transforming_modern_world.txt")
    parser = ContentParser()
    data = parser.parse_file(notes_path)

    sample_pptx = tmp_path / "api_template.pptx"
    gen = PPTGenerator(theme="graphite_pro")
    gen.generate(data, sample_pptx)

    with open(sample_pptx, "rb") as f:
        res = client.post(
            "/api/templates/import",
            files={"file": ("api_template.pptx", f, "application/vnd.openxmlformats-officedocument.presentationml.presentation")},
            data={"template_name": "My Corporate Template"},
        )

    assert res.status_code == 200
    report_data = res.json()
    assert report_data["is_compatible"] is True
    assert report_data["display_name"] == "My Corporate Template"
    assert report_data["theme_id"]
    assert "colors" in report_data
    assert "limitations" in report_data
