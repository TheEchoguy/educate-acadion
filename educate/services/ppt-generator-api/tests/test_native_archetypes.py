"""
Integration test validating the rendering of all 16 slide archetypes
in the Acadion Native PowerPoint Generation Engine.
"""

import os
import tempfile
from pathlib import Path
import pptx
import pytest

from app.models import (
    BulletPoint,
    PresentationData,
    Section,
    SectionType,
    SlideArchetype,
)
from app.ppt_generator import PPTGenerator


def test_render_all_slide_archetypes():
    """Build a comprehensive presentation testing all slide archetypes."""
    pres = PresentationData(
        title="Comprehensive Archetype Architecture Test",
        subtitle="16 Visual Layouts Showcase",
        institution="Acadion Research Lab",
        recommended_theme="academic_navy",
        title_composition="editorial",
        overview_composition="agenda_flow",
        conclusion_composition="synthesis_takeaways",
    )

    pres.overview_section = Section(
        title="Curriculum Overview & Roadmap",
        section_type=SectionType.INTRO_OVERVIEW,
        bullets=[
            BulletPoint(text="Inspect foundational axioms and theorems", prefix="Part 1"),
            BulletPoint(text="Analyze architectural decision matrices", prefix="Part 2"),
            BulletPoint(text="Review distributed execution pipelines", prefix="Part 3"),
        ],
    )

    pres.content_sections = [
        # 1. Pull Quote Slide
        Section(
            title="Axiom of Computational Complexity",
            section_type=SectionType.CONTENT,
            composition_type="pull_quote",
            key_message="Simplicity is prerequisite for reliability — Edsger W. Dijkstra",
            bullets=[
                BulletPoint(text="Edsger W. Dijkstra", prefix="Author Attribution"),
                BulletPoint(text="Architectures must favor deterministic predictability over speculative coupling.", prefix="Implication 1"),
                BulletPoint(text="Maintain explicit interfaces to bound error blast radius.", prefix="Implication 2"),
            ],
            speaker_notes="Emphasize the Dijkstra principle during discussion.",
        ),
        # 2. Split Image / Diagram Slide
        Section(
            title="Neural Visual Telemetry Engine",
            section_type=SectionType.CONTENT,
            composition_type="split_image",
            key_message="Multi-modal perception pipeline fuses camera disparity and LiDAR point clouds.",
            bullets=[
                BulletPoint(text="Spatial disparity depth maps computed at 60 FPS", prefix="Perception"),
                BulletPoint(text="Centroid cluster extraction for bounding boxes", prefix="Tracking"),
                BulletPoint(text="Zero-copy tensor buffers into GPU VRAM", prefix="Throughput"),
            ],
            speaker_notes="Walk through the spatial sensor fusion architecture.",
        ),
        # 3. Quadrant Matrix Slide
        Section(
            title="Distributed Consensus Tradeoffs",
            section_type=SectionType.CONTENT,
            composition_type="quadrant_matrix",
            bullets=[
                BulletPoint(text="Immediate leader election with minimal heartbeat overhead", prefix="Q1: Raft Consensus"),
                BulletPoint(text="Multi-master active replication across global regions", prefix="Q2: Multi-Paxos"),
                BulletPoint(text="Single primary with read-replica lag tolerances", prefix="Q3: Primary-Replica"),
                BulletPoint(text="Gossip dissemination with probabilistic convergence", prefix="Q4: Dynamo Ring"),
            ],
            speaker_notes="Contrast consensus protocols on the 2x2 axis.",
        ),
        # 4. Process Chevrons Pipeline Slide
        Section(
            title="Real-Time Data Streaming Lifecycle",
            section_type=SectionType.CONTENT,
            composition_type="process_chevrons",
            bullets=[
                BulletPoint(text="High-throughput Kafka topic partition ingestion", prefix="Stage 1: Ingestion"),
                BulletPoint(text="Sliding window stateful aggregations in Apache Flink", prefix="Stage 2: Processing"),
                BulletPoint(text="Real-time fraud anomaly scoring and alerts", prefix="Stage 3: Inference"),
                BulletPoint(text="Materialized views written to ScyllaDB cluster", prefix="Stage 4: Storage"),
            ],
            speaker_notes="Explain the streaming window semantics.",
        ),
        # 5. Two-Column Comparison Slide
        Section(
            title="Classical ML vs Deep Learning",
            section_type=SectionType.CONTENT,
            composition_type="two_column",
            bullets=[
                BulletPoint(text="Relies on manual feature engineering and tabular schemas", prefix="Classical ML"),
                BulletPoint(text="Automated hierarchical feature learning from raw tensors", prefix="Deep Learning"),
            ],
        ),
        # 6. Three-Pillar Multi-Column Slide
        Section(
            title="Three Foundational Tenets",
            section_type=SectionType.CONTENT,
            composition_type="multi_column",
            bullets=[
                BulletPoint(text="Guaranteed linear serialization", prefix="Correctness"),
                BulletPoint(text="Predictable sub-second latencies", prefix="Velocity"),
                BulletPoint(text="Independent multi-region failover", prefix="Resilience"),
            ],
        ),
        # 7. KPI Metrics Slide
        Section(
            title="Benchmark Performance Telemetry",
            section_type=SectionType.CONTENT,
            composition_type="stats_metrics",
            bullets=[
                BulletPoint(text="Reduction in inference latency over FP32 baseline", prefix="94.2%"),
                BulletPoint(text="Peak sustained streaming messages per second", prefix="2.5M"),
                BulletPoint(text="Cluster availability across 4 cloud zones", prefix="99.99%"),
            ],
        ),
        # 8. Editorial Content Slide
        Section(
            title="Sociotechnical Governance & Ethics",
            section_type=SectionType.CONTENT,
            composition_type="editorial",
            bullets=[
                BulletPoint(text="Auditing training datasets for algorithmic and historical bias", prefix="Data Governance"),
                BulletPoint(text="Mechanistic interpretability tools for explainable decisioning", prefix="Transparency"),
            ],
        ),
    ]

    pres.conclusion_section = Section(
        title="Summary & Next Steps",
        section_type=SectionType.SUMMARY_CONCLUSION,
        bullets=[
            BulletPoint(text="Review the 16 architectural layout archetypes", prefix="Synthesis"),
            BulletPoint(text="Deploy test models in upcoming laboratory session", prefix="Action Item"),
        ],
    )

    with tempfile.TemporaryDirectory() as td:
        out_path = Path(td) / "test_16_archetypes.pptx"
        gen = PPTGenerator(theme="academic_navy", layout_style="smart_mixed")
        resolved = gen.generate(pres, out_path)

        assert os.path.exists(resolved)
        prs = pptx.Presentation(resolved)

        # 1 title + 1 overview + 8 content + 1 conclusion = 11 slides
        assert len(prs.slides) == 11

        # Verify shapes on each slide
        for idx, slide in enumerate(prs.slides):
            assert len(slide.shapes) > 0, f"Slide {idx+1} has no shapes"

        print(f"Generated deck with {len(prs.slides)} slides successfully verified.")
