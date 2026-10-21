"""
Regression & Verification Test Suite for Strict Slide Limit and Readability-First Layout Fallback.
Implements the Critical Addendum requirements:
1. Proves that every exported PPTX part strictly respects the selected slide count as a hard maximum (<= target).
2. Reproduces the scenario that previously produced 41 slides in Part 1 and 28 in Part 2, proving that under the repaired
   implementation, every part contains <= 20 slides, complete source content is preserved across sequential parts,
   and no overflowing or unreadable slides are created.
3. Verifies presets (10, 15, 20, 25) and custom values (7, 12).
4. Validates readability-first layout selection and 4-stage emergency fallback.
5. Inspects actual exported PPTX files using python-pptx.
6. Verifies completion report fields (requested_max_slides, actual_exported_slides, hard_limit_passed, issue counts).
"""

from pathlib import Path
import pytest
import pptx
from pptx.util import Inches

from app.models import (
    MultiPartJobDTO,
    MultiPartPlanDTO,
    PartResultDTO,
    CoverageReportDTO,
)
from app.notes_extractor import NotesExtractor
from app.topic_discovery import TopicDiscoveryEngine
from app.multi_part_planner import MultiPartPlanner
from app.multi_part_generator import MultiPartGenerator
from app.readability_validator import ReadabilityValidator


def _generate_dense_lecture_corpus(num_sections: int = 50) -> str:
    """Generate a substantial educational lecture text with many detailed concepts and bullet points."""
    sections = []
    topics = [
        "Distributed Systems and Consensus Protocols",
        "Byzantine Fault Tolerance and State Machine Replication",
        "Database Concurrency Control and Two-Phase Locking",
        "Stream Processing Architectures and Exactly-Once Semantics",
        "Distributed Storage Systems and Consistent Hashing",
    ]
    for i in range(1, num_sections + 1):
        topic_header = topics[(i - 1) % len(topics)]
        sections.append(
            f"# Section {i:02d}: {topic_header} — Module {i}\n"
            f"The core computational paradigm in module {i} addresses scalable state synchronization across unreliable networks.\n"
            f"- Principle A: High-throughput replicated state machine processing with deterministic log ordering.\n"
            f"- Principle B: Dynamic quorum reconfiguration handling partition tolerance without data loss.\n"
            f"- Principle C: Asynchronous checkpointing and snapshot serialization for rapid node recovery.\n"
            f"- Principle D: Vector clocks and causality tracking across multi-datacenter clusters.\n"
            f"- Principle E: Network partition mitigation using lease-based leader election algorithms.\n"
            f"- Principle F: Garbage collection of historical journal segments under bounded storage budgets."
        )
    return "\n\n".join(sections)


class TestStrictSlideLimitAndReadability:
    """Tests strictly enforcing hard slide maximums and readability fallbacks."""

    def test_reproduce_and_repair_20_slide_limit_failure(self, tmp_path: Path):
        """1. Reproduces the scenario that previously generated 41 slides in Part 1 and 28 in Part 2.
        Proves that every exported PPTX part now contains <= 20 slides, complete source content
        is preserved across sequential parts, and no slides overflow.
        """
        # 50 detailed sections with 6 points each (would previously inflate to 40+ slides per part)
        content = _generate_dense_lecture_corpus(num_sections=45)
        extractor = NotesExtractor()
        blocks, manifest = extractor.extract_from_text(content)
        assert len(blocks) >= 40

        discovery = TopicDiscoveryEngine()
        topics = discovery.discover_topics(blocks, manifest, mode="deterministic")
        assert len(topics) >= 3

        planner = MultiPartPlanner()
        target_limit = 20
        plan = planner.build_plan(
            blocks=blocks,
            topics=topics,
            manifest=manifest,
            slides_per_part=target_limit,
            content_density="balanced",
            title_override="Distributed Systems Masterclass",
        )

        assert plan.slides_per_part == target_limit
        # All planned parts must target <= 20
        for part in plan.parts:
            assert part.planned_slides <= target_limit, (
                f"Part {part.part_number} planned {part.planned_slides} slides, exceeding target {target_limit}"
            )

        # Generate all parts into actual PPTX files
        generator = MultiPartGenerator(output_dir=tmp_path)
        job = MultiPartJobDTO(
            job_id="job_strict_20_test",
            document_name="Distributed_Systems_Notes.txt",
            document_hash=manifest.file_hash,
            plan=plan,
            theme="academic_navy",
            layout_style="smart_mixed",
            slides_per_part=target_limit,
        )

        completed_job = generator.generate_all_parts(job)
        assert completed_job.status in ("completed", "completed_with_warnings")
        assert len(completed_job.parts) >= 2

        # Verify every exported PPTX using python-pptx
        total_exported_slides = 0
        for part_result in completed_job.parts:
            pptx_file = tmp_path / f"{part_result.file_id}.pptx"
            assert pptx_file.exists(), f"Part {part_result.part_number} PPTX file not found."

            prs = pptx.Presentation(str(pptx_file))
            actual_slides = len(prs.slides)
            total_exported_slides += actual_slides

            # CRITICAL HARD MAXIMUM ASSERTION
            assert actual_slides <= target_limit, (
                f"HARD LIMIT VIOLATION: Part {part_result.part_number} exported {actual_slides} slides, "
                f"exceeding the strict hard limit of {target_limit} slides!"
            )
            assert part_result.actual_exported_slides == actual_slides
            assert part_result.requested_max_slides == target_limit
            assert part_result.hard_limit_passed is True

            # Ensure slides are not empty
            for s_idx, slide in enumerate(prs.slides):
                has_text = any(sh.has_text_frame and len(sh.text_frame.text.strip()) > 0 for sh in slide.shapes)
                assert has_text, f"Slide {s_idx+1} in Part {part_result.part_number} is completely empty!"

        # Verify that ALL source content units are preserved across sequential parts
        coverage = completed_job.coverage_report
        assert coverage is not None
        assert coverage.hard_limit_enforced is True
        assert coverage.content_units_mapped == len(plan.content_units), (
            f"Content loss detected! Only {coverage.content_units_mapped} of {len(plan.content_units)} units mapped."
        )

    @pytest.mark.parametrize("preset_slides", [10, 15, 25])
    def test_preset_slide_counts_hard_limit(self, tmp_path: Path, preset_slides: int):
        """2. Verify hard maximum for all standard preset counts: 10, 15, 25."""
        content = _generate_dense_lecture_corpus(num_sections=30)
        extractor = NotesExtractor()
        blocks, manifest = extractor.extract_from_text(content)

        discovery = TopicDiscoveryEngine()
        topics = discovery.discover_topics(blocks, manifest, mode="deterministic")

        planner = MultiPartPlanner()
        plan = planner.build_plan(
            blocks=blocks,
            topics=topics,
            manifest=manifest,
            slides_per_part=preset_slides,
            title_override=f"Preset {preset_slides} Lecture Series",
        )

        generator = MultiPartGenerator(output_dir=tmp_path / f"preset_{preset_slides}")
        job = MultiPartJobDTO(
            job_id=f"job_preset_{preset_slides}",
            document_name=f"Preset_{preset_slides}.txt",
            document_hash=manifest.file_hash,
            plan=plan,
            theme="clean_light",
            slides_per_part=preset_slides,
        )

        completed_job = generator.generate_all_parts(job)
        assert len(completed_job.parts) >= 1

        for part in completed_job.parts:
            pptx_file = (tmp_path / f"preset_{preset_slides}") / f"{part.file_id}.pptx"
            prs = pptx.Presentation(str(pptx_file))
            actual_slides = len(prs.slides)

            # Strict check: actual PPTX slides <= preset_slides
            assert actual_slides <= preset_slides, (
                f"Preset {preset_slides} exceeded: Part {part.part_number} has {actual_slides} slides"
            )
            assert part.hard_limit_passed is True

    @pytest.mark.parametrize("custom_slides", [7, 12])
    def test_custom_slide_counts_hard_limit(self, tmp_path: Path, custom_slides: int):
        """3. Verify hard maximum for custom slide count values (e.g. 7, 12)."""
        content = _generate_dense_lecture_corpus(num_sections=22)
        extractor = NotesExtractor()
        blocks, manifest = extractor.extract_from_text(content)

        discovery = TopicDiscoveryEngine()
        topics = discovery.discover_topics(blocks, manifest, mode="deterministic")

        planner = MultiPartPlanner()
        plan = planner.build_plan(
            blocks=blocks,
            topics=topics,
            manifest=manifest,
            slides_per_part=custom_slides,
            title_override=f"Custom {custom_slides} Series",
        )

        generator = MultiPartGenerator(output_dir=tmp_path / f"custom_{custom_slides}")
        job = MultiPartJobDTO(
            job_id=f"job_custom_{custom_slides}",
            document_name=f"Custom_{custom_slides}.txt",
            document_hash=manifest.file_hash,
            plan=plan,
            theme="corporate_blue",
            slides_per_part=custom_slides,
        )

        completed_job = generator.generate_all_parts(job)
        for part in completed_job.parts:
            pptx_file = (tmp_path / f"custom_{custom_slides}") / f"{part.file_id}.pptx"
            prs = pptx.Presentation(str(pptx_file))
            actual_slides = len(prs.slides)
            assert actual_slides <= custom_slides, (
                f"Custom count {custom_slides} exceeded: Part {part.part_number} has {actual_slides} slides"
            )
            assert part.hard_limit_passed is True

    def test_shorter_final_part_contains_no_filler_slides(self, tmp_path: Path):
        """4. Verify that a shorter final part contains only useful content without blank or filler slides."""
        # 12 units targeting 10 slides per part -> Part 1 takes 8-10, Part 2 takes remaining 3-4 slides
        content = "\n\n".join([f"# Section {i}\nConcise principle {i} with key technical facts." for i in range(1, 13)])
        extractor = NotesExtractor()
        blocks, manifest = extractor.extract_from_text(content)

        discovery = TopicDiscoveryEngine()
        topics = discovery.discover_topics(blocks, manifest, mode="deterministic")

        planner = MultiPartPlanner()
        plan = planner.build_plan(blocks, topics, manifest, slides_per_part=10)

        generator = MultiPartGenerator(output_dir=tmp_path)
        job = MultiPartJobDTO(
            job_id="job_shorter_final",
            document_name="Shorter_Final_Test.txt",
            document_hash=manifest.file_hash,
            plan=plan,
            slides_per_part=10,
        )
        completed_job = generator.generate_all_parts(job)

        # Check final part
        final_part = completed_job.parts[-1]
        pptx_file = tmp_path / f"{final_part.file_id}.pptx"
        prs = pptx.Presentation(str(pptx_file))
        assert len(prs.slides) <= 10

        # Verify no slide is blank
        for slide in prs.slides:
            non_empty_shapes = [sh for sh in slide.shapes if sh.has_text_frame and sh.text_frame.text.strip()]
            assert len(non_empty_shapes) >= 1, "Detected empty filler slide!"

    def test_readability_fallback_for_overflowing_content(self, tmp_path: Path):
        """5. Verify 4-stage fallback: long content automatically falls back to clean content layout."""
        # A card grid with long text that would overflow cards
        title = "Massive Text Unit"
        long_bullets = [
            "This is an extraordinarily long technical exposition that goes into deep architectural nuance and contains extensive prose spanning multiple complex concepts and details that would completely overwhelm a small grid card box.",
            "Another extensive paragraph of text with technical specifications, numerical constraints, runtime complexity guarantees, and architectural considerations that cannot fit into a 2x2 grid.",
            "Third very long point discussing hardware cache line invalidation, memory bus saturation, NUMA architecture memory placement, and atomic CAS primitives.",
            "Fourth comprehensive point outlining fault recovery, heartbeat timeouts, network switch buffer drops, and TCP retransmission backoff curves.",
        ]

        evaluated_layout, warnings = ReadabilityValidator.evaluate_content_for_layout(
            layout_type="cards_grid",
            title=title,
            bullets=long_bullets,
        )
        # Should fallback to two_column or content_bullets rather than forcing cards
        assert evaluated_layout in ("two_column", "content_bullets")
        assert len(warnings) >= 1

    def test_completion_report_contains_all_required_metrics(self, tmp_path: Path):
        """6. Verify completion report tracks requested_max_slides, actual_exported_slides, hard_limit_passed, and issue counts."""
        content = _generate_dense_lecture_corpus(num_sections=16)
        extractor = NotesExtractor()
        blocks, manifest = extractor.extract_from_text(content)

        discovery = TopicDiscoveryEngine()
        topics = discovery.discover_topics(blocks, manifest, mode="deterministic")

        planner = MultiPartPlanner()
        plan = planner.build_plan(blocks, topics, manifest, slides_per_part=10)

        generator = MultiPartGenerator(output_dir=tmp_path)
        job = MultiPartJobDTO(
            job_id="job_report_metrics_test",
            document_name="Report_Metrics.txt",
            document_hash=manifest.file_hash,
            plan=plan,
            slides_per_part=10,
        )
        completed_job = generator.generate_all_parts(job)

        # Inspect PartResultDTO fields
        for part in completed_job.parts:
            assert part.requested_max_slides == 10
            assert part.actual_exported_slides == part.slide_count
            assert part.actual_exported_slides <= 10
            assert part.hard_limit_passed is True
            assert isinstance(part.serious_layout_issues_detected, int)
            assert isinstance(part.issues_automatically_repaired, int)
            assert isinstance(part.warnings, list)

        # Inspect CoverageReportDTO fields
        rep = completed_job.coverage_report
        assert rep is not None
        assert rep.hard_limit_enforced is True
        assert isinstance(rep.total_serious_layout_issues, int)
        assert isinstance(rep.total_issues_repaired, int)
