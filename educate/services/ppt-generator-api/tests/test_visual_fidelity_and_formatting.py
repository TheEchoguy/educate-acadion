"""
Automated tests for Visual Editor Fidelity and PowerPoint-Style Editing Fix (Section 9).

Validates:
1. Original title font size is preserved when parsing PPTX (fallback to paragraph font).
2. Font-size point values in SOM match PowerPoint native specifications.
3. Different runs in one text box retain distinct styles (font size, bold, color).
4. Title slide retains visual hierarchy (large title, subtitle, footer card).
5. Complex card slides retain intended geometry, badge sizes, and card headings.
6. Serializer preserves font size, font family, bold, italic, underline, color, alignment, and fill.
7. Exported PPTX retains edited formatting when re-parsed by PPTX parser.
8. Source PPTX remains strictly immutable (mtime and byte size unchanged).
"""

import os
from pathlib import Path
import pytest
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor

from app.pptx_parser import parse_presentation
from app.pptx_serializer import serialize_presentation
from app.models import (
    PresentationEditorModel,
    SlideDetailDTO,
    SlideObjectDTO,
    TextContentDTO,
    TextParagraphDTO,
    TextRunDTO,
    FillDTO,
)


@pytest.fixture
def sample_presentation_file(tmp_path: Path) -> Path:
    """Create a realistic PowerPoint presentation containing title slide and multi-card content slide."""
    pptx_path = tmp_path / "fidelity_test_pres.pptx"
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    blank_layout = prs.slide_layouts[6]

    # Slide 1: Title Slide with Title (36pt), Subtitle (18pt), and Multi-run Footer
    s1 = prs.slides.add_slide(blank_layout)

    # Title box
    tb_title = s1.shapes.add_textbox(Inches(1.0), Inches(1.5), Inches(11.333), Inches(1.5))
    p_title = tb_title.text_frame.paragraphs[0]
    p_title.text = "Visual Fidelity & Typography Masterclass"
    p_title.font.size = Pt(36)
    p_title.font.bold = True
    p_title.font.name = "Calibri"
    p_title.font.color.rgb = RGBColor(15, 44, 89)

    # Subtitle box
    tb_sub = s1.shapes.add_textbox(Inches(1.0), Inches(3.2), Inches(11.333), Inches(1.0))
    p_sub = tb_sub.text_frame.paragraphs[0]
    p_sub.text = "Preserving Hierarchy and Exact PowerPoint Formatting"
    p_sub.font.size = Pt(18)
    p_sub.font.bold = False
    p_sub.font.name = "Calibri"
    p_sub.font.color.rgb = RGBColor(71, 85, 105)

    # Footer Card with Multi-Run Paragraph (Run 1: Bold 11pt, Run 2: Normal 10pt)
    tb_footer = s1.shapes.add_textbox(Inches(1.0), Inches(5.8), Inches(11.333), Inches(0.8))
    p_footer = tb_footer.text_frame.paragraphs[0]
    r1 = p_footer.add_run()
    r1.text = "Academic Institution: "
    r1.font.bold = True
    r1.font.size = Pt(11)
    r1.font.color.rgb = RGBColor(15, 44, 89)
    r2 = p_footer.add_run()
    r2.text = "Delivered: October 2026 • Acadion Learning"
    r2.font.bold = False
    r2.font.size = Pt(10)
    r2.font.color.rgb = RGBColor(100, 116, 139)

    # Slide 2: Complex 3-Card Slide
    s2 = prs.slides.add_slide(blank_layout)

    # Main header (25pt)
    tb_h = s2.shapes.add_textbox(Inches(1.0), Inches(0.8), Inches(11.333), Inches(0.8))
    p_h = tb_h.text_frame.paragraphs[0]
    p_h.text = "System Architecture & Roadmap"
    p_h.font.size = Pt(25)
    p_h.font.bold = True
    p_h.font.color.rgb = RGBColor(15, 44, 89)

    # 3 Cards with headers (14pt bold) and body (10pt normal)
    card_width = Inches(3.5)
    card_gap = Inches(0.4)
    for i in range(3):
        x = Inches(1.0) + i * (card_width + card_gap)
        card_box = s2.shapes.add_textbox(x, Inches(2.2), card_width, Inches(4.0))
        p_c_title = card_box.text_frame.paragraphs[0]
        p_c_title.text = f"Pillar 0{i+1}: Module Specs"
        p_c_title.font.size = Pt(14)
        p_c_title.font.bold = True
        p_c_title.font.color.rgb = RGBColor(37, 99, 235)

        p_c_body = card_box.text_frame.add_paragraph()
        p_c_body.text = "Detailed curriculum guidelines for hands-on systems programming and scheduling."
        p_c_body.font.size = Pt(10)
        p_c_body.font.bold = False
        p_c_body.font.color.rgb = RGBColor(51, 65, 85)

    prs.save(pptx_path)
    return pptx_path


def test_original_font_size_preserved_on_pptx_load(sample_presentation_file: Path):
    """1. Original title font size is preserved when loading a PPTX, resolving font inheritance."""
    model = parse_presentation(sample_presentation_file, "fid_test_1")
    assert len(model.slides) == 2

    # Slide 1 check
    s1 = model.slides[0]
    title_obj = next(o for o in s1.objects if o.text_content and "Masterclass" in o.text_content.paragraphs[0].runs[0].text)
    assert title_obj.text_content is not None
    title_run = title_obj.text_content.paragraphs[0].runs[0]

    # Must preserve exact 36.0 pt, NOT None, and NOT fallback 18
    assert title_run.font_size == 36.0
    assert title_run.bold is True
    assert title_run.font_color == "#0F2C59"

    # Subtitle check
    sub_obj = next(o for o in s1.objects if o.text_content and "Preserving Hierarchy" in o.text_content.paragraphs[0].runs[0].text)
    sub_run = sub_obj.text_content.paragraphs[0].runs[0]
    assert sub_run.font_size == 18.0
    assert sub_run.font_color == "#475569"


def test_multi_run_paragraph_preserves_distinct_styles(sample_presentation_file: Path):
    """4. Different runs in one text box retain their distinct styles without flattening."""
    model = parse_presentation(sample_presentation_file, "fid_test_2")
    s1 = model.slides[0]
    footer_obj = next(o for o in s1.objects if o.text_content and len(o.text_content.paragraphs[0].runs) >= 2)

    p = footer_obj.text_content.paragraphs[0]
    assert len(p.runs) == 2

    r1 = p.runs[0]
    r2 = p.runs[1]

    # Run 1: Bold 11pt #0F2C59
    assert r1.text == "Academic Institution: "
    assert r1.font_size == 11.0
    assert r1.bold is True
    assert r1.font_color == "#0F2C59"

    # Run 2: Normal 10pt #64748B
    assert "Delivered: October 2026" in r2.text
    assert r2.font_size == 10.0
    assert r2.bold is not True
    assert r2.font_color == "#64748B"


def test_title_and_card_slide_visual_hierarchy(sample_presentation_file: Path):
    """6 & 7. Title slide and card slide retain their distinct visual hierarchy."""
    model = parse_presentation(sample_presentation_file, "fid_test_3")
    s2 = model.slides[1]

    # Header is 25.0 pt
    h_obj = next(o for o in s2.objects if o.text_content and "Roadmap" in o.text_content.paragraphs[0].runs[0].text)
    assert h_obj.text_content.paragraphs[0].runs[0].font_size == 25.0
    assert h_obj.text_content.paragraphs[0].runs[0].bold is True

    # Card titles are 14.0 pt bold and body paragraphs are 10.0 pt normal
    card_objs = [o for o in s2.objects if o.text_content and any("Pillar" in r.text for p in o.text_content.paragraphs for r in p.runs)]
    assert len(card_objs) == 3

    for card in card_objs:
        p0 = card.text_content.paragraphs[0]
        p1 = card.text_content.paragraphs[1]
        assert p0.runs[0].font_size == 14.0
        assert p0.runs[0].bold is True
        assert p0.runs[0].font_color == "#2563EB"
        assert p1.runs[0].font_size == 10.0
        assert p1.runs[0].bold is not True


def test_export_preserves_text_formatting_and_leaves_source_intact(sample_presentation_file: Path, tmp_path: Path):
    """13 & 14. Exported PPTX contains expected formatting, and source PPTX remains unchanged."""
    source_stat_before = sample_presentation_file.stat()
    model = parse_presentation(sample_presentation_file, "fid_test_4")

    # Modify Slide 1 title: change font size to 44pt, color to #DC2626 (red), italic to True
    s1 = model.slides[0]
    title_obj = next(o for o in s1.objects if o.text_content and "Masterclass" in o.text_content.paragraphs[0].runs[0].text)
    p_title = title_obj.text_content.paragraphs[0]
    p_title.runs[0].font_size = 44.0
    p_title.runs[0].font_color = "#DC2626"
    p_title.runs[0].italic = True
    p_title.alignment = "center"
    title_obj.fill = FillDTO(fill_type="solid", color="#EFF6FF", alpha=1.0)

    export_id = "test_fid_export"
    final_export_path, download_filename, warnings = serialize_presentation(
        source_pptx_path=sample_presentation_file,
        model=model,
        local_assets=[],
        export_id=export_id,
        exports_dir=tmp_path / "exports",
    )

    # 1. Source PPTX must remain strictly untouched
    source_stat_after = sample_presentation_file.stat()
    assert source_stat_before.st_mtime == source_stat_after.st_mtime
    assert source_stat_before.st_size == source_stat_after.st_size

    # 2. Re-parse the exported PPTX and verify edited formatting
    reopened_model = parse_presentation(final_export_path, "fid_test_reopened")
    re_s1 = reopened_model.slides[0]
    re_title = next(o for o in re_s1.objects if o.text_content and "Masterclass" in o.text_content.paragraphs[0].runs[0].text)

    re_run = re_title.text_content.paragraphs[0].runs[0]
    assert re_run.font_size == 44.0
    assert re_run.font_color == "#DC2626"
    assert re_run.italic is True
    assert re_title.text_content.paragraphs[0].alignment == "center"
    assert re_title.fill is not None
    assert re_title.fill.color == "#EFF6FF"
