"""
Unit tests for the Shared Content-Planning Layer (UnifiedPresentationPlan).
Verifies model conversion, archetype mapping, and plan serializability.
"""

import pytest
from app.models import (
    BulletPoint,
    Section,
    SectionType,
    PresentationData,
    SlideArchetype,
    MetricCallout,
    ImageDirective,
    UnifiedSlidePlan,
    UnifiedPresentationPlan,
)


def test_slide_archetypes_count():
    """Verify all 16 slide archetypes plus legacy aliases are defined."""
    archetypes = [
        SlideArchetype.EDITORIAL_TITLE,
        SlideArchetype.CINEMATIC_TITLE,
        SlideArchetype.SPLIT_HERO_TITLE,
        SlideArchetype.AGENDA_ROADMAP,
        SlideArchetype.SECTION_DIVIDER,
        SlideArchetype.EDITORIAL_TEXT,
        SlideArchetype.PULL_QUOTE,
        SlideArchetype.SPLIT_IMAGE_INSIGHT,
        SlideArchetype.CASE_STUDY,
        SlideArchetype.TWO_COLUMN_COMPARE,
        SlideArchetype.THREE_PILLAR_COLUMNS,
        SlideArchetype.QUADRANT_MATRIX,
        SlideArchetype.PROCESS_CHEVRONS,
        SlideArchetype.CHRONOLOGICAL_TIMELINE,
        SlideArchetype.KPI_METRIC_TRIO,
        SlideArchetype.SOCRATIC_DISCUSSION,
        SlideArchetype.SYNTHESIS_ROADMAP,
    ]
    assert len(archetypes) >= 16


def test_metric_and_image_directives():
    """Verify MetricCallout and ImageDirective dataclass behavior."""
    metric = MetricCallout(value="99.9%", label="Uptime SLA", subtext="Cloud Distributed Systems")
    assert metric.value == "99.9%"
    assert metric.label == "Uptime SLA"

    image = ImageDirective(
        category="technology",
        query_keywords="quantum computer qubit register",
        alt_text="Quantum Qubit Architecture",
        suggested_crop="fill_left",
    )
    assert image.category == "technology"
    assert image.suggested_crop == "fill_left"


def test_bidirectional_conversion():
    """Verify seamless bidirectional conversion between PresentationData and UnifiedPresentationPlan."""
    # 1. Create native presentation data
    pres_data = PresentationData(
        title="Microservices and Event-Driven Architecture",
        subtitle="Distributed Cloud Curriculum",
        institution="Acadion Engineering",
        recommended_theme="dark_tech",
    )

    pres_data.overview_section = Section(
        title="Lecture Curriculum Roadmap",
        section_type=SectionType.INTRO_OVERVIEW,
        bullets=[
            BulletPoint(text="Architectural boundaries and monolith breakdown", prefix="Monoliths"),
            BulletPoint(text="Event streaming with Apache Kafka and Flink", prefix="Streaming"),
        ],
        speaker_notes="Welcome students to the distributed systems module.",
    )

    pres_data.content_sections = [
        Section(
            title="Monolith vs Microservices Tradeoffs",
            section_type=SectionType.CONTENT,
            composition_type="two_column",
            bullets=[
                BulletPoint(text="Single deployment artifact, simpler local testing", prefix="Monolith"),
                BulletPoint(text="Independent deployability and granular scaling", prefix="Microservice"),
            ],
            teaching_objective="Contrast operational overhead against organizational velocity",
            key_message="Microservices trade network latency for team autonomy",
            speaker_notes="Draw the boundary on the board.",
        ),
        Section(
            title="Key Latency and Throughput Benchmarks",
            section_type=SectionType.CONTENT,
            composition_type="kpi_metrics",
            bullets=[
                BulletPoint(text="Sub-5ms P99 message ingestion latency", prefix="Latency"),
                BulletPoint(text="2.5M events/sec per cluster node", prefix="Throughput"),
            ],
            teaching_objective="Evaluate streaming pipeline capacity",
        ),
    ]

    pres_data.conclusion_section = Section(
        title="Synthesis and Next Steps",
        section_type=SectionType.SUMMARY_CONCLUSION,
        bullets=[
            BulletPoint(text="Implement transactional outbox pattern in Lab 2", prefix="Action Item"),
        ],
    )

    # 2. Convert to UnifiedPresentationPlan
    plan = pres_data.to_unified_plan(provider_preference="native")
    assert isinstance(plan, UnifiedPresentationPlan)
    assert plan.title == "Microservices and Event-Driven Architecture"
    assert plan.theme_id == "dark_tech"
    assert plan.total_slides == 4  # 1 overview + 2 content + 1 conclusion
    assert len(plan.slides) == 4

    # Verify slide mapping
    assert plan.slides[0].archetype == SlideArchetype.AGENDA_ROADMAP
    assert plan.slides[1].archetype == SlideArchetype.TWO_COLUMN
    assert plan.slides[1].teaching_objective == "Contrast operational overhead against organizational velocity"
    assert plan.slides[2].archetype == SlideArchetype.KPI_METRICS
    assert plan.slides[3].archetype == SlideArchetype.SYNTHESIS_ROADMAP

    # 3. Convert back to PresentationData
    restored = plan.to_presentation_data()
    assert isinstance(restored, PresentationData)
    assert restored.title == pres_data.title
    assert restored.recommended_theme == "dark_tech"
    assert restored.overview_section is not None
    assert restored.overview_section.title == "Lecture Curriculum Roadmap"
    assert len(restored.content_sections) == 2
    assert restored.conclusion_section is not None
    assert restored.conclusion_section.title == "Synthesis and Next Steps"
    assert len(restored.all_sections) == 4
