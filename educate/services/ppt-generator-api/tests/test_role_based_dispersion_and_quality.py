"""
Unit and integration tests for Workstream B: Role-Based Content Dispersion,
Geometry Overlap Detection, Intelligent Text Fitting, and Slide Quality QA.
"""

from pathlib import Path
import tempfile
import pytest
import pptx
from pptx.util import Inches, Pt
from pptx.enum.shapes import MSO_SHAPE

from app.models import (
    BulletPoint,
    PresentationData,
    Section,
    SectionType,
    SlideArchetype,
)
from app.layouts import THEMES, auto_select_theme, get_theme
from app.content_parser import ContentParser
from app.ppt_generator import PPTGenerator
from app.qa_engine import PresentationQAEngine, QAReport


def test_three_step_workflow_selects_process_layout():
    """Verify that a 3-step sequential workflow selects process_chevrons layout."""
    parser = ContentParser()
    raw = """# Distributed Transaction Management
Academic Lecture Notes

## 1. Prepare Phase 2. Commit Decision 3. Release Locks
- Primary coordinator sends vote requests to participants.
"""
    data = parser.parse_text(raw)
    sec = data.content_sections[0]

    # Content parser should disperse the 3 steps
    assert len(sec.bullets) >= 3
    assert any("prepare" in b.prefix.lower() or "prepare" in b.text.lower() for b in sec.bullets)

    gen = PPTGenerator(theme="academic_navy")
    plans = gen._plan_slides(data)
    content_plan = plans[2]  # Slide 1: title, Slide 2: overview, Slide 3: content

    # Accept process_chevrons or native visual process flow
    assert content_plan["type"] in ("process_chevrons", "visual")
    if content_plan["type"] == "visual":
        from app.models import VisualType
        assert content_plan["visual"].visual_type == VisualType.PROCESS_FLOW
    assert "Execution Pipeline" in content_plan["title"] or "Workflow" in content_plan["title"] or "Transaction" in content_plan["title"]


def test_several_steps_do_not_become_one_oversized_heading():
    """Verify multi-step titles are cleaned and steps are dispersed into individual units."""
    parser = ContentParser()
    raw = """# Machine Learning Operations
Curriculum Module

## Data Pipeline: 1. Ingestion 2. Preprocessing 3. Model Training 4. Evaluation
- Automated CI/CD pipeline triggers on new data drift alerts.
"""
    data = parser.parse_text(raw)
    sec = data.content_sections[0]

    # Heading must be cleaned to the overarching topic, not an oversized heading of 4 steps
    assert sec.title == "Data Pipeline"
    # All 4 steps must be extracted as individual bullet points
    assert len(sec.bullets) >= 4
    step_prefixes = [b.prefix.lower() for b in sec.bullets if b.prefix]
    assert any("step 1" in p for p in step_prefixes)
    assert any("step 2" in p for p in step_prefixes)
    assert any("step 3" in p for p in step_prefixes)
    assert any("step 4" in p for p in step_prefixes)


def test_heading_and_body_content_semantically_consistent():
    """Verify heading concisely reflects slide topic while body holds the dispersed details."""
    gen = PPTGenerator(theme="purple_gradient")
    data = PresentationData(
        title="Microservice Observability",
        subtitle="SRE Fundamentals",
        institution="Acadion University",
        recommended_theme="purple_gradient",
    )
    # Section with concatenated steps in heading
    data.content_sections = [
        Section(
            title="Telemetry Lifecycle: Step 1: Metrics Collection Step 2: Log Aggregation Step 3: Trace Correlation",
            section_type=SectionType.CONTENT,
            bullets=[
                BulletPoint(text="Correlate distributed trace spans across services", prefix="Correlation")
            ],
        )
    ]

    plans = gen._plan_slides(data)
    plan = plans[2]

    # Heading is cleaned to Telemetry Lifecycle
    assert plan["title"] == "Telemetry Lifecycle"
    assert plan["type"] == "process_chevrons"
    # Body has the 3 discrete steps
    assert len(plan["bullets"]) >= 3


def test_long_titles_do_not_overlap_dividers(tmp_path: Path):
    """Verify that extra-long titles wrap cleanly and divider rule is placed below text box."""
    long_title = "Architectural Innovations in High-Throughput Fault-Tolerant Distributed Consensus Algorithms for Global Cloud Deployments"
    data = PresentationData(
        title=long_title,
        subtitle="Advanced Systems Engineering",
        institution="Acadion University",
        recommended_theme="modern_blue",
    )
    data.content_sections = [
        Section(
            title=long_title,
            section_type=SectionType.CONTENT,
            bullets=[
                BulletPoint(text="Asynchronous consensus requires quorum intersection.", prefix="Quorum"),
                BulletPoint(text="Leader election terminates in bounded round intervals.", prefix="Liveness"),
            ],
        )
    ]

    gen = PPTGenerator(theme="modern_blue")
    out_pptx = tmp_path / "long_title_deck.pptx"
    gen.generate(data, out_pptx)

    prs = pptx.Presentation(str(out_pptx))
    slide = prs.slides[2]  # Content slide

    # Find divider rule and title box
    rule = next(s for s in slide.shapes if s.width >= Inches(5.0) and s.height <= Inches(0.06) and s.top >= Inches(1.2))
    title_box = next(s for s in slide.shapes if s.has_text_frame and Inches(0.5) <= s.top <= Inches(1.2) and s.height <= Inches(2.0) and s != rule)

    # Title bottom must strictly be <= rule top
    title_bottom = title_box.top + title_box.height
    assert title_bottom <= rule.top + Inches(0.02), f"Title bottom ({title_bottom.inches:.2f}\") overlaps rule top ({rule.top.inches:.2f}\")"

    # QA engine check
    qa = PresentationQAEngine()
    report = qa.evaluate_presentation(out_pptx)
    divider_check = next(c for c in report.checks if c.name == "Header Divider Clearance")
    assert divider_check.passed is True
    assert divider_check.score == 100


def test_three_point_and_four_point_layouts_distribute_evenly(tmp_path: Path):
    """Verify 3-card and 4-card grids span the canvas symmetrically without excessive whitespace."""
    data = PresentationData(
        title="Grid Symmetry Verification",
        subtitle="Layout Quality Tests",
        institution="Acadion University",
        recommended_theme="corporate_minimal",
    )
    # 3-bullet cards grid
    data.content_sections = [
        Section(
            title="Three Foundational Pillars",
            section_type=SectionType.CONTENT,
            composition_type="cards_grid",
            bullets=[
                BulletPoint(text="Data consistency guarantees", prefix="Consistency"),
                BulletPoint(text="High network availability", prefix="Availability"),
                BulletPoint(text="Network partition tolerance", prefix="Partition Tolerance"),
            ],
        ),
        # 4-bullet cards grid
        Section(
            title="Four Security Quadrants",
            section_type=SectionType.CONTENT,
            composition_type="cards_grid",
            bullets=[
                BulletPoint(text="Identity and access management", prefix="Identity"),
                BulletPoint(text="Perimeter firewall protection", prefix="Perimeter"),
                BulletPoint(text="Data at rest and in transit encryption", prefix="Encryption"),
                BulletPoint(text="Continuous audit logging", prefix="Audit"),
            ],
        ),
    ]

    gen = PPTGenerator(theme="corporate_minimal")
    out_pptx = tmp_path / "grid_symmetry_deck.pptx"
    gen.generate(data, out_pptx)

    prs = pptx.Presentation(str(out_pptx))

    # Slide 3 (3-card grid)
    slide_3 = prs.slides[2]
    cards_3 = [s for s in slide_3.shapes if Inches(1.5) <= s.top <= Inches(2.5) and s.height >= Inches(3.5)]
    assert len(cards_3) == 3
    # Left of first card is ~0.8", right of third card is ~12.5"
    assert abs(cards_3[0].left.inches - 0.8) < 0.1
    rightmost_3 = (cards_3[2].left + cards_3[2].width) / Inches(1)
    assert abs(rightmost_3 - 12.5) < 0.4

    # Slide 4 (4-card grid)
    slide_4 = prs.slides[3]
    cards_4 = [s for s in slide_4.shapes if s.shape_type == 1 and Inches(1.5) <= s.top <= Inches(4.5) and s.width >= Inches(5.0)]
    assert len(cards_4) == 4
    # 2 rows of 2 cards
    col0_cards = [c for c in cards_4 if abs(c.left.inches - 0.8) < 0.1]
    col1_cards = [c for c in cards_4 if c.left.inches > 5.0]
    assert len(col0_cards) == 2
    assert len(col1_cards) == 2


def test_single_concept_cards_grid_avoids_excessive_whitespace(tmp_path: Path):
    """Verify that a 1-bullet cards_grid expands across the width instead of leaving a 9-inch void."""
    data = PresentationData(
        title="Single Concept Test",
        subtitle="Whitespace QA",
        institution="Acadion University",
        recommended_theme="emerald_pro",
    )
    data.content_sections = [
        Section(
            title="Unified Architecture Principle",
            section_type=SectionType.CONTENT,
            composition_type="cards_grid",
            bullets=[
                BulletPoint(
                    text="All microservice communications must flow through authenticated API gateways with zero trust verification.",
                    prefix="Core Mandate"
                )
            ],
        )
    ]

    gen = PPTGenerator(theme="emerald_pro")
    out_pptx = tmp_path / "single_concept_deck.pptx"
    gen.generate(data, out_pptx)

    prs = pptx.Presentation(str(out_pptx))
    slide = prs.slides[2]

    # Find the main card shape
    card = next(s for s in slide.shapes if Inches(1.5) <= s.top <= Inches(2.5) and s.height >= Inches(3.0))
    # Must be expansive (>= 11 inches wide), NOT 3.64 inches
    assert card.width.inches >= 11.0, f"Single card width ({card.width.inches:.2f}\") failed to expand across canvas"

    qa = PresentationQAEngine()
    report = qa.evaluate_presentation(out_pptx)
    ws_check = next(c for c in report.checks if c.name == "Canvas Whitespace & Layout Balance")
    assert ws_check.passed is True
    assert ws_check.score == 100


def test_dense_content_splits_without_losing_units():
    """Verify dense content (> 4 bullets) is split cleanly into parts without truncation."""
    data = PresentationData(
        title="High Density Curriculum",
        subtitle="Pagination Test",
        institution="Acadion University",
        recommended_theme="dark_tech",
    )
    six_bullets = [
        BulletPoint(text=f"Detailed analysis of system module component {i}", prefix=f"Module {i:02d}")
        for i in range(1, 7)
    ]
    data.content_sections = [
        Section(
            title="Core System Modules",
            section_type=SectionType.CONTENT,
            composition_type="editorial",
            bullets=six_bullets,
        )
    ]

    gen = PPTGenerator(theme="dark_tech")
    plans = gen._plan_slides(data)

    # Content section should be split into 2 parts (Part 1/2 and Part 2/2)
    part1 = plans[2]
    part2 = plans[3]

    assert "Part 1/2" in part1["title"]
    assert "Part 2/2" in part2["title"]
    assert len(part1["bullets"]) + len(part2["bullets"]) == 6
    # Verify no unit was lost
    all_prefixes = [b.prefix for b in part1["bullets"]] + [b.prefix for b in part2["bullets"]]
    assert all(f"Module {i:02d}" in all_prefixes for i in range(1, 7))


def test_genuine_overlaps_detected_and_containment_preserved(tmp_path: Path):
    """Verify intentional containment is not flagged as collision, while genuine overlap is detected."""
    # 1. Clean deck with intentional containment (cards with text boxes and accent strips)
    data = PresentationData(
        title="Containment Verification",
        subtitle="Safety Test",
        institution="Acadion University",
        recommended_theme="warm_creative",
    )
    data.content_sections = [
        Section(
            title="Pedagogical Axioms",
            section_type=SectionType.CONTENT,
            composition_type="two_column",
            bullets=[
                BulletPoint(text="Form follows instructional intent", prefix="Axiom 1"),
                BulletPoint(text="Clarity precedes decorative complexity", prefix="Axiom 2"),
            ],
        )
    ]

    gen = PPTGenerator(theme="warm_creative")
    clean_pptx = tmp_path / "clean_containment.pptx"
    gen.generate(data, clean_pptx)

    qa = PresentationQAEngine()
    clean_report = qa.evaluate_presentation(clean_pptx)
    collision_check = next(c for c in clean_report.checks if c.name == "Shape Collision & Containment Guard")
    assert collision_check.passed is True
    assert collision_check.score == 100

    # 2. Corrupt presentation with genuine overlapping sibling cards
    prs = pptx.Presentation(str(clean_pptx))
    slide = prs.slides[2]
    # Add two sibling boxes that partially collide (not contained in each other)
    s1 = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(2.0), Inches(2.0), Inches(4.0), Inches(3.0))
    s2 = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(4.0), Inches(3.0), Inches(4.0), Inches(3.0))
    corrupt_pptx = tmp_path / "corrupt_overlap.pptx"
    prs.save(str(corrupt_pptx))

    corrupt_report = qa.evaluate_presentation(corrupt_pptx)
    corrupt_check = next(c for c in corrupt_report.checks if c.name == "Shape Collision & Containment Guard")
    assert corrupt_check.passed is False
    assert corrupt_check.score < 100


def test_all_14_registered_themes_compatible_with_quality_fixes(tmp_path: Path):
    """Verify that decks generated in all 14 registered themes pass QA checks cleanly."""
    qa = PresentationQAEngine()

    theme_keys = [k for k in THEMES.keys() if not k.startswith("imported_")]
    assert len(theme_keys) == 14

    for theme_id in theme_keys:
        pres = PresentationData(
            title=f"Theme Quality Verification: {theme_id}",
            subtitle="Acadion Multi-Theme Automated Test",
            institution="Acadion Testing",
            recommended_theme=theme_id,
        )
        pres.overview_section = Section(
            title="Agenda",
            section_type=SectionType.INTRO_OVERVIEW,
            bullets=[BulletPoint(text="Examine multi-theme rendering", prefix="Phase 1")],
            speaker_notes="Theme test agenda notes.",
        )
        pres.content_sections = [
            Section(
                title=f"Execution Pipeline for {theme_id}: 1. Ingest 2. Analyze 3. Render",
                section_type=SectionType.CONTENT,
                bullets=[BulletPoint(text="Pipeline execution verification.", prefix="Detail")],
                speaker_notes="Detailed topic explanation.",
            ),
            Section(
                title="Comparative Architecture",
                section_type=SectionType.CONTENT,
                composition_type="two_column",
                bullets=[
                    BulletPoint(text="Left paradigm properties", prefix="Paradigm A"),
                    BulletPoint(text="Right paradigm properties", prefix="Paradigm B"),
                ],
                speaker_notes="Comparison discussion notes.",
            ),
        ]
        pres.conclusion_section = Section(
            title="Summary & Conclusion",
            section_type=SectionType.SUMMARY_CONCLUSION,
            bullets=[BulletPoint(text="Final takeaways for theme", prefix="Conclusion")],
            speaker_notes="Closing remarks.",
        )

        out_file = tmp_path / f"deck_{theme_id}.pptx"
        gen = PPTGenerator(theme=theme_id)
        gen.generate(pres, out_file)

        report = qa.evaluate_presentation(out_file)
        assert report.is_acceptable is True, f"Theme '{theme_id}' failed QA with score {report.overall_score}: {[c.detail for c in report.checks if not c.passed]}"
        assert report.overall_score >= 80, f"Theme '{theme_id}' score {report.overall_score} below threshold 80"
