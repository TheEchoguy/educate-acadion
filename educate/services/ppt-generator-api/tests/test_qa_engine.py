"""
Unit tests for the Shared Quality Assurance (QA) Engine.
"""

import tempfile
from pathlib import Path
import pytest
import pptx

from app.models import (
    BulletPoint,
    PresentationData,
    Section,
    SectionType,
    SlideArchetype,
    UnifiedPresentationPlan,
    UnifiedSlidePlan,
)
from app.ppt_generator import PPTGenerator
from app.qa_engine import PresentationQAEngine, QAReport


def test_qa_engine_on_valid_deck():
    """Verify QA engine awards a high passing score to a clean, diverse presentation."""
    pres = PresentationData(
        title="Distributed Systems QA Benchmark",
        subtitle="Verification Lecture",
        institution="Acadion Testing",
        recommended_theme="academic_navy",
    )

    pres.overview_section = Section(
        title="Agenda",
        section_type=SectionType.INTRO_OVERVIEW,
        bullets=[BulletPoint(text="Inspect streaming engines", prefix="Part 1")],
        speaker_notes="Welcome students to the testing session.",
    )

    pres.content_sections = [
        Section(
            title="Consensus Axioms",
            section_type=SectionType.CONTENT,
            composition_type="pull_quote",
            key_message="Correctness without performance is theoretical; performance without correctness is disastrous.",
            bullets=[
                BulletPoint(text="Edsger Dijkstra", prefix="Author"),
                BulletPoint(text="Always prioritize safety properties over liveness shortcuts.", prefix="Rule 1"),
            ],
            speaker_notes="Discuss the importance of safety properties.",
        ),
        Section(
            title="Monolith vs Microservices",
            section_type=SectionType.CONTENT,
            composition_type="two_column",
            bullets=[
                BulletPoint(text="Simpler transactions and shared memory", prefix="Monolith"),
                BulletPoint(text="Independent scaling and isolated failure domains", prefix="Microservices"),
            ],
            speaker_notes="Contrast operational complexity against development velocity.",
        ),
    ]

    pres.conclusion_section = Section(
        title="Conclusion",
        section_type=SectionType.SUMMARY_CONCLUSION,
        bullets=[BulletPoint(text="Review the lab notes", prefix="Next Steps")],
        speaker_notes="Conclude with assignment details.",
    )

    qa = PresentationQAEngine()

    with tempfile.TemporaryDirectory() as td:
        out_path = Path(td) / "clean_deck.pptx"
        gen = PPTGenerator(theme="academic_navy")
        resolved = gen.generate(pres, out_path)

        plan = pres.to_unified_plan()
        report = qa.evaluate_presentation(resolved, plan_or_data=plan)

        assert isinstance(report, QAReport)
        assert report.status == "pass"
        assert report.overall_score >= 80
        assert report.is_acceptable is True
        assert report.total_slides == 5
        assert report.cards_grid_ratio <= 0.25
        assert len(report.checks) >= 5


def test_qa_engine_on_missing_file():
    """Verify QA engine fails safely when file does not exist."""
    qa = PresentationQAEngine()
    report = qa.evaluate_presentation("non_existent_presentation.pptx")
    assert report.status == "fail"
    assert report.overall_score == 0
    assert report.is_acceptable is False
