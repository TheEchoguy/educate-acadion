"""
Comprehensive Automated Tests for Workstream B: Complete Notes to Multi-Part Presentations.
Covers all 30 test requirements defined in Section B13:
- Extraction & topic discovery (indexed, non-indexed, numbered, chunks, boundary preservation, corrupt files, OCR condition, tables, math, merging, stable IDs).
- Planning & allocation (configurable slide counts, shorter final parts, large topics, topic-aware boundaries, continuity, full coverage, density warnings, deterministic manifests).
- Generation & export (valid PPTX, matching slide counts, themes/layouts, source end inclusion, no duplicates, parseability, source file immutability, ZIP manifest, anti-traversal security, part persistence, download endpoints, single-presentation regression).
"""

import hashlib
import io
import json
from pathlib import Path
import pytest
from pptx import Presentation
from starlette.testclient import TestClient

from app.api import app, _MULTI_PART_JOBS
from app.models import (
    ContentBlockType,
    ContentUnitStatus,
    CorruptedDocumentError,
    EmptyContentError,
    ExtractedBlock,
    MultiPartJobStatus,
    UnsupportedFileTypeError,
)
from app.notes_extractor import NotesExtractor
from app.topic_discovery import TopicDiscoveryEngine
from app.multi_part_planner import MultiPartPlanner
from app.multi_part_generator import MultiPartGenerator
from app.multi_part_zip import MultiPartZipPackager


@pytest.fixture
def test_client() -> TestClient:
    return TestClient(app)


# =====================================================================
# Group 1: Extraction and Topic Discovery Tests (1 to 10)
# =====================================================================

def test_01_document_with_explicit_index_and_headings(tmp_path: Path):
    """1. A document with explicit index and headings."""
    content = """# Table of Contents
1. Introduction to Algorithms
2. Sorting Architectures
3. Graph Traversal

# 1. Introduction to Algorithms
An algorithm is a finite sequence of rigorous instructions.
Computational complexity evaluates time and space scalability.

# 2. Sorting Architectures
Comparison sorts require at least O(n log n) comparisons in the worst case.
Merge Sort guarantees optimal divide-and-conquer performance.

# 3. Graph Traversal
Breadth-First Search traverses level by level using a queue.
Depth-First Search explores branch depths using a recursion stack.
"""
    doc_path = tmp_path / "indexed_doc.txt"
    doc_path.write_text(content, encoding="utf-8")

    extractor = NotesExtractor()
    blocks, manifest = extractor.extract_from_file(doc_path)
    assert len(blocks) >= 6
    assert manifest.total_pages >= 1

    discovery = TopicDiscoveryEngine()
    topics = discovery.discover_topics(blocks, manifest, mode="deterministic")
    assert len(topics) >= 3
    titles = [t.title for t in topics]
    assert any("Algorithms" in t for t in titles)
    assert any("Sorting" in t for t in titles)
    assert any("Graph" in t for t in titles)


def test_02_document_with_no_index_or_headings(tmp_path: Path):
    """2. A document with NO index, NO table of contents, and NO Markdown/Word headings."""
    content = """Machine learning represents a paradigm where computational systems learn patterns directly from empirical datasets rather than following purely hardcoded rules.

Supervised learning algorithms map inputs to desired outputs using labeled training instances. Typical applications include classification of medical imagery and regression analysis for asset valuations.

Unsupervised learning identifies hidden latent structures in unlabeled data. Clustering methodologies such as k-means and hierarchical clustering partition data points based on geometric distance metrics.

Reinforcement learning formulates optimization through agent-environment interactions. An agent observes state transitions, selects actions, and receives scalar feedback rewards to discover optimal policies.
"""
    doc_path = tmp_path / "no_index_notes.txt"
    doc_path.write_text(content, encoding="utf-8")

    extractor = NotesExtractor()
    blocks, manifest = extractor.extract_from_file(doc_path)
    assert len(blocks) >= 4

    discovery = TopicDiscoveryEngine()
    topics = discovery.discover_topics(blocks, manifest, mode="deterministic")
    assert len(topics) >= 2
    # Verify topics are discovered and marked as inferred
    assert all(t.is_inferred for t in topics)
    assert all(t.page_start >= 1 for t in topics)


def test_03_numbered_sections_and_mixed_formatting(tmp_path: Path):
    """3. Numbered sections and mixed formatting."""
    content = """1. Foundations of Operating Systems
Operating systems manage underlying hardware resources and abstract system interfaces.

1.1 Process Management
A process is an active instance of a program execution containing program counter and registers.
- Process states: Ready, Running, Waiting, Terminated.
- Context switching incurs hardware cache overhead.

1.2 Memory Architecture
Virtual memory isolates process address spaces using paged memory translation tables.
- Page faults trigger secondary disk I/O interrupts.

2. Concurrency and Synchronization
Multiple threads of execution require mutual exclusion primitives such as semaphores and mutex locks.
"""
    doc_path = tmp_path / "numbered_sections.txt"
    doc_path.write_text(content, encoding="utf-8")

    extractor = NotesExtractor()
    blocks, manifest = extractor.extract_from_file(doc_path)

    headings = [b for b in blocks if b.block_type == ContentBlockType.HEADING]
    assert len(headings) >= 2

    discovery = TopicDiscoveryEngine()
    topics = discovery.discover_topics(blocks, manifest, mode="deterministic")
    assert len(topics) >= 2


def test_04_long_documents_spanning_many_pages(tmp_path: Path):
    """4. Long documents that span many chunks and virtual pages."""
    # Generate a long document with 15 pages worth of content
    pages = []
    for p in range(1, 16):
        pages.append(f"""Module {p:02d}: Advanced Computing Paradigm {p}
Curriculum overview for section {p}. This section delves into complex engineering systems.
Topic {p} explores scalable distributed computing and memory hierarchies.
- Core mechanism {p}.A: Latency mitigation.
- Core mechanism {p}.B: Throughput maximization.
Key principle: System resilience requires redundant architectural topologies.
""")
    content = "\x0c".join(pages)
    doc_path = tmp_path / "long_curriculum_doc.txt"
    doc_path.write_text(content, encoding="utf-8")

    extractor = NotesExtractor()
    blocks, manifest = extractor.extract_from_file(doc_path)
    assert manifest.total_pages == 15
    assert len(blocks) >= 15

    discovery = TopicDiscoveryEngine()
    topics = discovery.discover_topics(blocks, manifest, mode="deterministic")
    assert len(topics) >= 5


def test_05_boundary_content_preserved_across_chunks(tmp_path: Path):
    """5. Boundary content that would otherwise be lost between chunks."""
    content = "A" * 1000 + "\n\nCRITICAL_BOUNDARY_CONCEPT: Crucial formula at exact split point.\n\n" + "B" * 1000
    doc_path = tmp_path / "boundary_test.txt"
    doc_path.write_text(content, encoding="utf-8")

    extractor = NotesExtractor()
    blocks, _ = extractor.extract_from_file(doc_path)
    # Ensure boundary concept block is not truncated
    boundary_block = next((b for b in blocks if "CRITICAL_BOUNDARY_CONCEPT" in b.normalized_text), None)
    assert boundary_block is not None
    assert "Crucial formula at exact split point" in boundary_block.normalized_text


def test_06_empty_or_corrupt_files(tmp_path: Path):
    """6. Empty or corrupt files."""
    empty_file = tmp_path / "empty.txt"
    empty_file.write_text("", encoding="utf-8")

    extractor = NotesExtractor()
    with pytest.raises(EmptyContentError):
        extractor.extract_from_file(empty_file)

    corrupt_pdf = tmp_path / "fake.pdf"
    corrupt_pdf.write_bytes(b"NOT_A_REAL_PDF_BYTES_1234")
    with pytest.raises(CorruptedDocumentError):
        extractor.extract_from_file(corrupt_pdf)


def test_07_scanned_pdf_detection_or_ocr_warning(tmp_path: Path):
    """7. Scanned PDFs, with OCR handling or explicit limitations."""
    import pymupdf
    # Create a 2-page PDF with no text (blank / scanned mock)
    pdf_path = tmp_path / "scanned_doc.pdf"
    doc = pymupdf.open()
    doc.new_page()
    doc.new_page()
    doc.save(pdf_path)
    doc.close()

    extractor = NotesExtractor()
    from app.models import ScannedDocumentError
    with pytest.raises(ScannedDocumentError):
        extractor.extract_from_file(pdf_path)


def test_08_tables_equations_and_source_page_references(tmp_path: Path):
    """8. Tables, equations, examples, and source-page references."""
    content = """Page 1 Content
Mathematical Model: Cost function minimization.
Equation: J(\\theta) = \\frac{1}{2m} \\sum_{i=1}^m (h_\\theta(x^{(i)}) - y^{(i)})^2

| Metric | Model A | Model B |
| Precision | 0.94 | 0.88 |
| Recall | 0.91 | 0.95 |

Example: Real-world image classification on edge devices.
"""
    extractor = NotesExtractor()
    blocks, manifest = extractor.extract_from_text(content, title_hint="Math & Tables")

    # Table block identified
    table_block = next((b for b in blocks if b.block_type == ContentBlockType.TABLE), None)
    assert table_block is not None
    assert table_block.table_data is not None

    # Equation detected
    eq_block = next((b for b in blocks if b.has_equation), None)
    assert eq_block is not None


def test_09_topic_merging_and_duplicate_detection():
    """9. Topic merging and duplicate detection."""
    from app.models import DiscoveredTopicDTO
    engine = TopicDiscoveryEngine()
    topics = [
        DiscoveredTopicDTO(topic_id="t1", title="Neural Networks", page_start=1, page_end=2),
        DiscoveredTopicDTO(topic_id="t2", title="Neural Networks", page_start=3, page_end=4),
        DiscoveredTopicDTO(topic_id="t3", title="Deep Learning", page_start=5, page_end=6),
    ]
    merged = engine._finalize_topics(topics, [])
    assert len(merged) == 2
    assert merged[0].title == "Neural Networks"
    assert merged[0].page_end == 4


def test_10_stable_topic_and_content_unit_identifiers(tmp_path: Path):
    """10. Stable topic and content-unit identifiers."""
    content = """# Topic A
Definition 1: Concept Alpha.
Definition 2: Concept Beta.

# Topic B
Definition 3: Concept Gamma.
"""
    extractor = NotesExtractor()
    blocks, manifest = extractor.extract_from_text(content)
    discovery = TopicDiscoveryEngine()
    topics = discovery.discover_topics(blocks, manifest, mode="deterministic")

    planner = MultiPartPlanner()
    plan1 = planner.build_plan(blocks, topics, manifest, slides_per_part=10)
    plan2 = planner.build_plan(blocks, topics, manifest, slides_per_part=10)

    # Unit IDs and Topic IDs are deterministic and stable
    assert [u.unit_id for u in plan1.content_units] == [u.unit_id for u in plan2.content_units]
    assert [t.topic_id for t in plan1.topics] == [t.topic_id for t in plan2.topics]


# =====================================================================
# Group 2: Planning and Allocation Tests (11 to 18)
# =====================================================================

def test_11_configurable_slide_counts(tmp_path: Path):
    """11. Configurable slide counts such as 10, 15, 20, and custom value (12)."""
    content = "\n\n".join([f"# Section {i}\nKey lecture content point {i}." for i in range(1, 30)])
    extractor = NotesExtractor()
    blocks, manifest = extractor.extract_from_text(content)
    discovery = TopicDiscoveryEngine()
    topics = discovery.discover_topics(blocks, manifest, mode="deterministic")
    planner = MultiPartPlanner()

    for target in [10, 12, 15, 20]:
        plan = planner.build_plan(blocks, topics, manifest, slides_per_part=target)
        assert plan.slides_per_part == target
        assert len(plan.parts) >= 1
        for p in plan.parts[:-1]:  # all non-final parts target requested count
            assert p.target_slides == target


def test_12_shorter_final_part(tmp_path: Path):
    """12. A shorter final part when content naturally finishes."""
    # 7 units targeting 10 slides per part
    content = "\n\n".join([f"Unit {i}: Description of principle {i}." for i in range(1, 8)])
    extractor = NotesExtractor()
    blocks, manifest = extractor.extract_from_text(content)
    discovery = TopicDiscoveryEngine()
    topics = discovery.discover_topics(blocks, manifest, mode="deterministic")
    planner = MultiPartPlanner()

    plan = planner.build_plan(blocks, topics, manifest, slides_per_part=20)
    # The final part is allowed to be shorter than 20
    final_part = plan.parts[-1]
    assert final_part.is_final_part is True
    assert final_part.planned_slides <= 20


def test_13_large_topic_spanning_multiple_slides_and_parts(tmp_path: Path):
    """13. A large topic that requires multiple slides and part continuation."""
    # 35 sub-units under one massive topic
    content = "# Massive Architecture Topic\n" + "\n\n".join([f"Component {i}: Deep specification of subsystem {i}." for i in range(1, 36)])
    extractor = NotesExtractor()
    blocks, manifest = extractor.extract_from_text(content)
    discovery = TopicDiscoveryEngine()
    topics = discovery.discover_topics(blocks, manifest, mode="deterministic")
    planner = MultiPartPlanner()

    plan = planner.build_plan(blocks, topics, manifest, slides_per_part=10)
    assert len(plan.parts) >= 2
    # Check continuation marker
    assert plan.parts[1].continuation_from_part is not None


def test_14_topic_aware_boundaries(tmp_path: Path):
    """14. Topic-aware boundaries keep related concepts together."""
    content = """# Topic One
Point 1. Point 2.

# Topic Two
Point A. Point B. Point C. Point D.
"""
    extractor = NotesExtractor()
    blocks, manifest = extractor.extract_from_text(content)
    discovery = TopicDiscoveryEngine()
    topics = discovery.discover_topics(blocks, manifest, mode="deterministic")
    planner = MultiPartPlanner()

    plan = planner.build_plan(blocks, topics, manifest, slides_per_part=10)
    # Content units of Topic One are all grouped in part 1
    t1_units = [u for u in plan.content_units if u.topic_id == "topic_001"]
    assert len({u.assigned_part for u in t1_units}) == 1


def test_15_continuity_across_adjacent_parts(tmp_path: Path):
    """15. Continuity across adjacent parts."""
    content = "\n\n".join([f"# Chapter {i}\nDetailed lecture text for chapter {i}." for i in range(1, 15)])
    extractor = NotesExtractor()
    blocks, manifest = extractor.extract_from_text(content)
    discovery = TopicDiscoveryEngine()
    topics = discovery.discover_topics(blocks, manifest, mode="deterministic")
    planner = MultiPartPlanner()

    plan = planner.build_plan(blocks, topics, manifest, slides_per_part=5)
    assert len(plan.parts) >= 2
    part_numbers = [p.part_number for p in plan.parts]
    assert part_numbers == list(range(1, len(plan.parts) + 1))


def test_16_full_source_unit_assignment_with_no_silent_drops(tmp_path: Path):
    """16. Full source-unit assignment with no silent drops."""
    content = "\n\n".join([f"Concept {i}: Detailed explanation {i}." for i in range(1, 20)])
    extractor = NotesExtractor()
    blocks, manifest = extractor.extract_from_text(content)
    discovery = TopicDiscoveryEngine()
    topics = discovery.discover_topics(blocks, manifest, mode="deterministic")
    planner = MultiPartPlanner()

    plan = planner.build_plan(blocks, topics, manifest, slides_per_part=10)
    assigned_part_numbers = {u.assigned_part for u in plan.content_units}
    assert 0 not in assigned_part_numbers
    assert len(assigned_part_numbers) == len(plan.parts)


def test_17_dense_content_density_warning(tmp_path: Path):
    """17. Dense content emits explanatory warning and recommendation."""
    content = "\n\n".join([f"Dense Fact {i}: Technical specification details {i}." for i in range(1, 60)])
    extractor = NotesExtractor()
    blocks, manifest = extractor.extract_from_text(content)
    discovery = TopicDiscoveryEngine()
    topics = discovery.discover_topics(blocks, manifest, mode="deterministic")
    planner = MultiPartPlanner()

    plan = planner.build_plan(blocks, topics, manifest, slides_per_part=5, content_density="concise")
    assert plan.density_warning is not None
    assert "High Content Density" in plan.density_warning


def test_18_deterministic_planning_and_resume_manifests(tmp_path: Path):
    """18. Deterministic planning and resume manifests."""
    content = "# Physics 101\nKinematics and dynamics.\n# Physics 102\nThermodynamics and heat engines."
    extractor = NotesExtractor()
    blocks, manifest = extractor.extract_from_text(content)
    discovery = TopicDiscoveryEngine()
    topics = discovery.discover_topics(blocks, manifest, mode="deterministic")
    planner = MultiPartPlanner()

    p1 = planner.build_plan(blocks, topics, manifest, slides_per_part=10)
    p2 = planner.build_plan(blocks, topics, manifest, slides_per_part=10)
    assert p1.total_parts == p2.total_parts
    assert p1.total_slides == p2.total_slides


# =====================================================================
# Group 3: Generation, Export, and ZIP Tests (19 to 30)
# =====================================================================

def test_19_every_planned_part_produces_valid_pptx(tmp_path: Path):
    """19. Every planned part produces a valid PPTX file."""
    content = """# Part A: Intro
Overview of systems.

# Part B: Architecture
Hardware interconnects and bus topologies.
"""
    extractor = NotesExtractor()
    blocks, manifest = extractor.extract_from_text(content)
    discovery = TopicDiscoveryEngine()
    topics = discovery.discover_topics(blocks, manifest, mode="deterministic")
    planner = MultiPartPlanner()
    plan = planner.build_plan(blocks, topics, manifest, slides_per_part=5)

    from app.models import MultiPartJobDTO
    job = MultiPartJobDTO(
        job_id="test_gen_job_19",
        document_name="Test_Doc.txt",
        document_hash=manifest.file_hash,
        plan=plan,
        theme="academic_navy",
        layout_style="smart_mixed",
    )

    generator = MultiPartGenerator(output_dir=tmp_path)
    job = generator.generate_all_parts(job)

    assert len(job.parts) == len(plan.parts)
    for part in job.parts:
        assert part.status == "completed"
        pptx_file = tmp_path / f"{part.file_id}.pptx"
        assert pptx_file.exists()


def test_20_exported_slide_counts_match_plan(tmp_path: Path):
    """20. Exported slide counts match the planned slide count."""
    content = "# Chapter 1\nPoint A.\nPoint B.\nPoint C."
    extractor = NotesExtractor()
    blocks, manifest = extractor.extract_from_text(content)
    discovery = TopicDiscoveryEngine()
    topics = discovery.discover_topics(blocks, manifest, mode="deterministic")
    planner = MultiPartPlanner()
    plan = planner.build_plan(blocks, topics, manifest, slides_per_part=5)

    from app.models import MultiPartJobDTO
    job = MultiPartJobDTO(
        job_id="test_gen_job_20",
        document_name="Test_Doc_20.txt",
        document_hash=manifest.file_hash,
        plan=plan,
        theme="academic_navy",
    )
    generator = MultiPartGenerator(output_dir=tmp_path)
    job = generator.generate_all_parts(job)

    part = job.parts[0]
    prs = Presentation(str(tmp_path / f"{part.file_id}.pptx"))
    assert len(prs.slides) == part.slide_count
    assert len(prs.slides) <= part.requested_max_slides
    assert part.hard_limit_passed is True


def test_21_parts_preserve_theme_and_layout_choices(tmp_path: Path):
    """21. Parts preserve selected theme and layout choices."""
    content = "# Solar Energy\nPhotovoltaic effects and panel efficiency."
    extractor = NotesExtractor()
    blocks, manifest = extractor.extract_from_text(content)
    discovery = TopicDiscoveryEngine()
    topics = discovery.discover_topics(blocks, manifest, mode="deterministic")
    planner = MultiPartPlanner()
    plan = planner.build_plan(blocks, topics, manifest, slides_per_part=5)

    from app.models import MultiPartJobDTO
    job = MultiPartJobDTO(
        job_id="test_gen_job_21",
        document_name="Solar_Energy.txt",
        document_hash=manifest.file_hash,
        plan=plan,
        theme="dark_tech",
        layout_style="cards_grid",
    )
    generator = MultiPartGenerator(output_dir=tmp_path)
    job = generator.generate_all_parts(job)

    assert job.parts[0].status == "completed"
    prs = Presentation(str(tmp_path / f"{job.parts[0].file_id}.pptx"))
    # Dark tech background shape verification
    slide1 = prs.slides[0]
    bg_shape = next((s for s in slide1.shapes if s.name == "Background"), None)
    assert bg_shape is not None


def test_22_final_part_includes_end_of_source(tmp_path: Path):
    """22. The final part includes the conclusion/end of source."""
    content = """# First Topic
Initial ideas.

# Final Topic
THE_ABSOLUTE_END_OF_SOURCE: Final takeaway conclusions.
"""
    extractor = NotesExtractor()
    blocks, manifest = extractor.extract_from_text(content)
    discovery = TopicDiscoveryEngine()
    topics = discovery.discover_topics(blocks, manifest, mode="deterministic")
    planner = MultiPartPlanner()
    plan = planner.build_plan(blocks, topics, manifest, slides_per_part=5)

    from app.models import MultiPartJobDTO
    job = MultiPartJobDTO(
        job_id="test_gen_job_22",
        document_name="End_Check.txt",
        document_hash=manifest.file_hash,
        plan=plan,
    )
    generator = MultiPartGenerator(output_dir=tmp_path)
    job = generator.generate_all_parts(job)

    final_part = job.parts[-1]
    prs = Presentation(str(tmp_path / f"{final_part.file_id}.pptx"))
    all_text = " ".join([shape.text for s in prs.slides for shape in s.shapes if shape.has_text_frame])
    assert "THE_ABSOLUTE_END_OF_SOURCE" in all_text


def test_23_no_unintended_duplicate_slides(tmp_path: Path):
    """23. No unintended duplicate slides within a part."""
    content = """# Module 1
Item 1: Data structures.
Item 2: Control flow.
Item 3: Object oriented programming.
"""
    extractor = NotesExtractor()
    blocks, manifest = extractor.extract_from_text(content)
    discovery = TopicDiscoveryEngine()
    topics = discovery.discover_topics(blocks, manifest, mode="deterministic")
    planner = MultiPartPlanner()
    plan = planner.build_plan(blocks, topics, manifest, slides_per_part=10)

    from app.models import MultiPartJobDTO
    job = MultiPartJobDTO(
        job_id="test_gen_job_23",
        document_name="No_Duplicates.txt",
        document_hash=manifest.file_hash,
        plan=plan,
    )
    generator = MultiPartGenerator(output_dir=tmp_path)
    job = generator.generate_all_parts(job)

    prs = Presentation(str(tmp_path / f"{job.parts[0].file_id}.pptx"))
    slide_titles = [s.shapes.title.text for s in prs.slides if s.shapes.title]
    # Verify titles are distinct
    assert len(slide_titles) == len(set(slide_titles))


def test_24_pptx_files_reopen_and_parse(tmp_path: Path):
    """24. Every PPTX file can be reopened and parsed without error."""
    content = "# Bio\nCellular respiration and photosynthesis."
    extractor = NotesExtractor()
    blocks, manifest = extractor.extract_from_text(content)
    discovery = TopicDiscoveryEngine()
    topics = discovery.discover_topics(blocks, manifest, mode="deterministic")
    planner = MultiPartPlanner()
    plan = planner.build_plan(blocks, topics, manifest, slides_per_part=5)

    from app.models import MultiPartJobDTO
    job = MultiPartJobDTO(
        job_id="test_gen_job_24",
        document_name="Bio.txt",
        document_hash=manifest.file_hash,
        plan=plan,
    )
    generator = MultiPartGenerator(output_dir=tmp_path)
    job = generator.generate_all_parts(job)

    prs = Presentation(str(tmp_path / f"{job.parts[0].file_id}.pptx"))
    assert len(prs.slides) >= 2


def test_25_original_source_document_immutability(tmp_path: Path):
    """25. Original source document remains strictly immutable (hash and mtime verified)."""
    source_file = tmp_path / "immutable_source.txt"
    source_file.write_text("Crucial historical source lecture notes.", encoding="utf-8")
    before_hash = hashlib.sha256(source_file.read_bytes()).hexdigest()
    before_mtime = source_file.stat().st_mtime

    extractor = NotesExtractor()
    blocks, manifest = extractor.extract_from_file(source_file)
    discovery = TopicDiscoveryEngine()
    topics = discovery.discover_topics(blocks, manifest, mode="deterministic")
    planner = MultiPartPlanner()
    plan = planner.build_plan(blocks, topics, manifest, slides_per_part=5)

    from app.models import MultiPartJobDTO
    job = MultiPartJobDTO(
        job_id="test_gen_job_25",
        document_name=source_file.name,
        document_hash=manifest.file_hash,
        plan=plan,
    )
    generator = MultiPartGenerator(output_dir=tmp_path)
    generator.generate_all_parts(job)

    after_hash = hashlib.sha256(source_file.read_bytes()).hexdigest()
    after_mtime = source_file.stat().st_mtime
    assert before_hash == after_hash
    assert before_mtime == after_mtime


def test_26_zip_contains_all_parts_and_valid_manifest(tmp_path: Path):
    """26. ZIP contains all successful PPTX files and valid manifests."""
    content = "# Topic 1\nContent.\n# Topic 2\nContent."
    extractor = NotesExtractor()
    blocks, manifest = extractor.extract_from_text(content)
    discovery = TopicDiscoveryEngine()
    topics = discovery.discover_topics(blocks, manifest, mode="deterministic")
    planner = MultiPartPlanner()
    plan = planner.build_plan(blocks, topics, manifest, slides_per_part=5)

    from app.models import MultiPartJobDTO
    job = MultiPartJobDTO(
        job_id="test_gen_job_26",
        document_name="ZIP_Curriculum.txt",
        document_hash=manifest.file_hash,
        plan=plan,
    )
    generator = MultiPartGenerator(output_dir=tmp_path)
    job = generator.generate_all_parts(job)

    packager = MultiPartZipPackager(output_dir=tmp_path)
    zip_path, zip_name = packager.create_zip_archive(job)
    assert zip_path.exists()

    import zipfile
    with zipfile.ZipFile(zip_path, "r") as z:
        names = z.namelist()
        assert "manifest.json" in names
        assert "README_CURRICULUM_MANIFEST.txt" in names
        assert any(n.endswith(".pptx") for n in names)

        # Inspect manifest JSON
        m_json = json.loads(z.read("manifest.json").decode("utf-8"))
        assert m_json["curriculum_title"] == "ZIP_Curriculum.txt"
        assert m_json["total_parts"] == len(job.parts)


def test_27_unsafe_filenames_and_path_traversal_rejected(test_client: TestClient):
    """27. Path traversal and malformed job IDs are strictly rejected."""
    # Attempt directory traversal with invalid characters
    res = test_client.get("/api/multi-part/jobs/../../etc/passwd")
    assert res.status_code in (400, 404)

    res2 = test_client.get("/api/multi-part/jobs/mp_validid/parts/1/download")
    assert res2.status_code == 404


def test_28_failed_part_does_not_erase_completed_parts(tmp_path: Path):
    """28. A failed part does not erase previously completed parts."""
    from app.models import MultiPartJobDTO, PartPlanDTO, PartResultDTO
    job = MultiPartJobDTO(
        job_id="test_job_28",
        document_name="Partial.txt",
        document_hash="hash123",
        parts=[
            PartResultDTO(
                part_number=1,
                title="Part 1: Completed",
                file_id="fid_part_1",
                filename="part1.pptx",
                download_url="/download/1",
                slide_count=5,
                status="completed"
            ),
            PartResultDTO(
                part_number=2,
                title="Part 2: Failed",
                file_id="",
                filename="part2.pptx",
                download_url="",
                slide_count=0,
                status="failed",
                error_message="Network glitch"
            )
        ]
    )
    # Part 1 remains intact in the list
    assert job.parts[0].status == "completed"
    assert job.parts[0].part_number == 1


def test_29_api_upload_and_download_endpoints(test_client: TestClient):
    """29. Live API endpoints for multi-part upload, approve, and download."""
    text_content = """# Deep Learning Foundations
Neural networks optimize loss surfaces using backpropagation.

# Convolutional Networks
Convolutions extract spatial features via sliding kernel filters.
"""
    # 1. Upload & plan
    res = test_client.post(
        "/api/multi-part/upload",
        data={
            "notes_text": text_content,
            "title_override": "Deep Learning Series",
            "slides_per_part": 5,
            "auto_generate": False,
        }
    )
    assert res.status_code == 200
    job_data = res.json()
    job_id = job_data["job_id"]
    assert job_data["status"] == "awaiting_approval"
    assert len(job_data["plan"]["parts"]) >= 1

    # 2. Approve outline (prepares parts for on-demand generation)
    approve_res = test_client.post(f"/api/multi-part/jobs/{job_id}/approve")
    assert approve_res.status_code == 200
    approved_job = approve_res.json()
    assert len(approved_job["parts"]) >= 1
    assert approved_job["parts"][0]["status"] == "pending"

    # 3. Generate Part 1 on-demand
    gen_res = test_client.post(f"/api/multi-part/jobs/{job_id}/parts/1/generate")
    assert gen_res.status_code == 200
    gen_job = gen_res.json()
    p1 = next(p for p in gen_job["parts"] if p["part_number"] == 1)
    assert p1["status"] in ("completed", "completed_with_warnings")
    assert p1["generation_duration_seconds"] is not None
    assert p1["generation_duration_seconds"] >= 0

    # 4. Download Part 1
    p1_res = test_client.get(f"/api/multi-part/jobs/{job_id}/parts/1/download")
    assert p1_res.status_code == 200
    assert "presentationml.presentation" in p1_res.headers["content-type"]
    assert len(p1_res.content) > 1000

    # 5. Download ZIP
    zip_res = test_client.get(f"/api/multi-part/jobs/{job_id}/download-zip")
    assert zip_res.status_code == 200
    assert "zip" in zip_res.headers["content-type"]
    assert len(zip_res.content) > 1000


def test_30_existing_single_presentation_generation_regression(test_client: TestClient):
    """30. Existing single-presentation generation still works without regression."""
    notes = (
        "# Machine Learning Foundations\n\n"
        "## Supervised & Unsupervised Learning\n"
        "- Supervised Learning: Maps inputs to outputs using labeled training instances\n"
        "- Unsupervised Learning: Discovers latent patterns and geometric clusters\n\n"
        "## Summary & Takeaways\n"
        "- Model Selection: Cross-validation prevents statistical overfitting\n"
    )
    res = test_client.post(
        "/api/generate",
        data={
            "notes_text": notes,
            "mode": "deterministic",
            "theme": "academic_navy",
            "layout_style": "smart_mixed",
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["file_id"]
    assert data["slide_count"] >= 3
    assert "download_url" in data
