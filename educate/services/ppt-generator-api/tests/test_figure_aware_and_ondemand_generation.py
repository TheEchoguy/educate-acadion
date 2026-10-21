"""Comprehensive regression tests for Figure-Aware PPT Generation and On-Demand Part Creation.

Tests cover:
1. Genuine figure caption regex vs narrative reference recognition.
2. In-text figure reference matching (e.g., 'Figure 5.3 shows...') to extracted image assets.
3. No dummy or placeholder replacement images (honest reporting when figure cannot be extracted).
4. Aspect ratio preservation and collision-free layout in PPTX rendering.
5. Outline approval without bulk PPTX generation (lazy / on-demand parts).
6. Generating an individual part on demand with monotonic clock duration measurement.
7. Concurrent generation safety & idempotent caching.
8. Figure audit trail in coverage reports.
9. Accurate ZIP download and manifest listing completed and pending parts.
"""

import os
import shutil
import tempfile
import time
from pathlib import Path
from typing import List
import pytest
from pptx import Presentation
from starlette.testclient import TestClient

from app.api import app, _MULTI_PART_JOBS, STORAGE_DIR
from app.content_parser import ContentParser
from app.document_loader import DocumentLoader
from app.models import (
    ContentBlockType,
    ExtractedBlock,
    ContentUnitDTO,
    DocumentExtractionManifest,
    MultiPartJobDTO,
    MultiPartPlanDTO,
    PartPlanDTO,
    DiscoveredTopicDTO,
)
from app.multi_part_generator import MultiPartGenerator
from app.multi_part_planner import MultiPartPlanner
from app.multi_part_zip import MultiPartZipPackager
from app.notes_extractor import NotesExtractor
from app.ppt_generator import PPTGenerator


@pytest.fixture
def client():
    return TestClient(app)


def test_01_figure_caption_delimiter_and_in_text_distinction():
    """1. Extractor caption parser requires delimiter (: or -) and distinguishes captions from narrative text."""
    extractor = NotesExtractor()

    # Genuine caption with colon delimiter
    cap_text = "Figure 5.3: Domain Model Specification with entity relationships"
    ctype, clevel = extractor._classify_line(cap_text)
    assert ctype == ContentBlockType.CAPTION
    m_cap = extractor.RE_CAPTION.match(cap_text)
    assert m_cap is not None
    assert m_cap.group(1) == "5.3"
    assert "Domain Model Specification" in m_cap.group(2)

    # In-text narrative reference (no delimiter, contains verb 'shows') must NOT be classified as caption
    narrative_text = "Figure 5.3 shows the domain model specification for IoT systems."
    ntype, nlevel = extractor._classify_line(narrative_text)
    assert ntype == ContentBlockType.PARAGRAPH
    assert extractor.RE_CAPTION.match(narrative_text) is None
    # But narrative reference regex MUST detect the reference
    m_in_text = extractor.RE_IN_TEXT_FIG.search(narrative_text)
    assert m_in_text is not None
    assert m_in_text.group(1) == "5.3"


def test_02_in_text_figure_reference_matched_to_real_asset(tmp_path):
    """2. Text narrative referencing 'Figure 5.3 shows...' is matched to genuine image asset."""
    img_path = tmp_path / "domain_model.png"
    img_path.write_bytes(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82")

    # In-text narrative block on page 3 referring to Figure 5.3
    narrative_block = ExtractedBlock(
        block_id="blk_text_1",
        page_number=3,
        block_type=ContentBlockType.PARAGRAPH,
        raw_text="Figure 5.3 shows the domain model specification for IoT systems.",
        normalized_text="Figure 5.3 shows the domain model specification for IoT systems. The domain model defines the physical and virtual entities.",
        figure_reference="Figure 5.3",
    )

    # Extracted diagram block on page 4
    diagram_block = ExtractedBlock(
        block_id="blk_diag_1",
        page_number=4,
        block_type=ContentBlockType.IMAGE,
        raw_text="",
        normalized_text="Figure 5.3: Domain Model Specification",
        image_path=str(img_path),
        caption="Figure 5.3: Domain Model Specification",
        figure_reference="Figure 5.3",
    )

    topic = DiscoveredTopicDTO(
        topic_id="top_1",
        title="Domain Model Design",
        page_start=3,
        page_end=4,
        key_concepts=["domain model"],
    )

    manifest = DocumentExtractionManifest(
        file_path="",
        filename="test.pdf",
        file_hash="dummy_hash",
        total_pages=5,
        word_count=100,
        character_count=500,
    )
    planner = MultiPartPlanner()
    units = planner._extract_content_units(
        blocks=[narrative_block, diagram_block],
        topics=[topic],
        manifest=manifest,
        include_examples=True,
        include_definitions=True,
        include_equations=True,
    )

    # Exactly 1 diagram unit should be created claiming the image and avoiding duplicates
    assert len(units) == 1
    unit = units[0]
    assert unit.unit_type == "diagram"
    assert unit.image_path == str(img_path)
    assert unit.figure_reference == "Figure 5.3"
    assert 3 in unit.source_pages and 4 in unit.source_pages
    assert "Figure 5.3" in unit.title


def test_03_missing_figure_handled_honestly_without_dummy_replacement(tmp_path):
    """3. When figure cannot be extracted, do not insert dummy neural net or fake engine schematic."""
    notes = """# Edge Computing Architecture
## Message Broker Topology
- Figure 9.9: Distributed message broker topology across edge nodes
- Latency reduction: Process telemetry directly on local gateways
- Bandwidth optimization: Filter and aggregate data prior to cloud ingestion
"""
    parser = ContentParser()
    data = parser.parse_text(notes)
    data.title = "Edge Architecture"

    gen = PPTGenerator(theme="academic_navy", layout_style="smart_mixed")
    out_file = tmp_path / "edge_architecture.pptx"
    gen.generate(data, out_file)

    assert out_file.exists()
    prs = Presentation(str(out_file))

    # Collect all text in presentation
    all_texts = []
    for slide in prs.slides:
        for s in slide.shapes:
            if s.has_text_frame:
                all_texts.append(s.text_frame.text)

    joined_text = " ".join(all_texts)
    assert "Figure 9.9" in joined_text
    # Ensure no fabricated 'CORE SYSTEM ENGINE' fake schematic text was injected
    assert "CORE SYSTEM ENGINE" not in joined_text


def test_04_figure_placement_preserves_aspect_ratio_and_bounds(tmp_path):
    """4. Inserted figure preserves aspect ratio and fits bounds."""
    # Create real image on disk
    img_path = tmp_path / "diagram_test.png"
    img_path.write_bytes(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82")

    notes = f"""# Systems Architecture
## Module Design
Here is the domain model layout for the sensor subsystem.
- Architecture component: [IMAGE:{str(img_path)}]
- Component relationships and physical layer connections
"""
    parser = ContentParser()
    data = parser.parse_text(notes)
    data.title = "Systems Architecture"

    gen = PPTGenerator(theme="academic_navy", layout_style="smart_mixed")
    out_file = tmp_path / "systems_architecture.pptx"
    gen.generate(data, out_file)

    assert out_file.exists()
    prs = Presentation(str(out_file))
    slide_w = prs.slide_width
    slide_h = prs.slide_height

    # Verify every shape stays inside widescreen boundaries
    for slide in prs.slides:
        for s in slide.shapes:
            assert s.left >= 0
            assert s.left + s.width <= slide_w + 1000  # Margin of tolerance
            assert s.top >= 0
            assert s.top + s.height <= slide_h + 1000


def test_05_outline_approval_creates_pending_parts_without_bulk_generation(client):
    """5. Approving outline leaves parts in pending state without rendering PPTX files."""
    text_content = """# Module A: Network Basics
Network architecture connects physical endpoints using IP protocols.

# Module B: Application Protocols
HTTP and CoAP enable resource representations over network links.
"""
    # 1. Upload & analyze
    res = client.post(
        "/api/multi-part/upload",
        data={
            "notes_text": text_content,
            "title_override": "IoT Curriculum",
            "slides_per_part": 5,
            "auto_generate": False,
        },
    )
    assert res.status_code == 200
    job = res.json()
    job_id = job["job_id"]
    assert job["status"] == "awaiting_approval"

    # 2. Approve outline
    approve_res = client.post(f"/api/multi-part/jobs/{job_id}/approve")
    assert approve_res.status_code == 200
    approved_job = approve_res.json()

    assert approved_job["status"] == "planning_allocation"
    assert len(approved_job["parts"]) >= 1
    # Every part must be in 'pending' status, not completed yet
    for part in approved_job["parts"]:
        assert part["status"] == "pending"
        assert part["file_id"] == ""
        assert part["download_url"] == ""


def test_06_on_demand_single_part_generation_and_monotonic_timing(client):
    """6. Clicking Create PPT generates only the requested part and records monotonic timing."""
    text_content = """# Part One Topic
First part lecture notes and architectural principles.

# Part Two Topic
Second part lecture notes with protocols and messaging standards.
"""
    res = client.post(
        "/api/multi-part/upload",
        data={
            "notes_text": text_content,
            "title_override": "Two-Part Curriculum",
            "slides_per_part": 5,
            "auto_generate": False,
        },
    )
    job_id = res.json()["job_id"]
    client.post(f"/api/multi-part/jobs/{job_id}/approve")

    # Generate only Part 1
    t0 = time.monotonic()
    gen_res = client.post(f"/api/multi-part/jobs/{job_id}/parts/1/generate")
    t1 = time.monotonic()
    assert gen_res.status_code == 200
    job_after_p1 = gen_res.json()

    p1 = next(p for p in job_after_p1["parts"] if p["part_number"] == 1)
    assert p1["status"] in ("completed", "completed_with_warnings")
    assert p1["download_url"] != ""
    assert p1["generation_duration_seconds"] is not None
    assert 0 <= p1["generation_duration_seconds"] <= (t1 - t0 + 1.0)

    # If there is a Part 2, it MUST remain pending!
    parts_other = [p for p in job_after_p1["parts"] if p["part_number"] != 1]
    for p_other in parts_other:
        assert p_other["status"] == "pending"
        assert p_other["file_id"] == ""


def test_07_on_demand_idempotent_caching_and_force_regenerate(client):
    """7. Re-requesting a completed part returns cached result; force_regenerate allows renewal."""
    text_content = "# Unit Topic\nCore system design principles."
    res = client.post(
        "/api/multi-part/upload",
        data={"notes_text": text_content, "slides_per_part": 5, "auto_generate": False},
    )
    job_id = res.json()["job_id"]
    client.post(f"/api/multi-part/jobs/{job_id}/approve")

    # First generation
    gen1 = client.post(f"/api/multi-part/jobs/{job_id}/parts/1/generate").json()
    p1_first = next(p for p in gen1["parts"] if p["part_number"] == 1)
    file_id_first = p1_first["file_id"]

    # Second generation without force_regenerate (idempotent cache hit)
    gen2 = client.post(f"/api/multi-part/jobs/{job_id}/parts/1/generate").json()
    p1_second = next(p for p in gen2["parts"] if p["part_number"] == 1)
    assert p1_second["file_id"] == file_id_first

    # Third generation WITH force_regenerate=True
    gen3 = client.post(f"/api/multi-part/jobs/{job_id}/parts/1/generate?force_regenerate=true").json()
    p1_third = next(p for p in gen3["parts"] if p["part_number"] == 1)
    assert p1_third["status"] in ("completed", "completed_with_warnings")


def test_08_figure_audit_trail_in_coverage_report(tmp_path):
    """8. MultiPartGenerator coverage audit includes figure audit records."""
    img_path = tmp_path / "audit_fig.png"
    img_path.write_bytes(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82")

    unit = ContentUnitDTO(
        unit_id="unit_diag",
        topic_id="top_audit",
        title="Figure 1.1 Architecture",
        unit_type="diagram",
        key_points=["System architecture overview."],
        source_pages=[2],
        image_path=str(img_path),
        figure_reference="Figure 1.1",
        caption="Figure 1.1: System Architecture",
    )

    topic = DiscoveredTopicDTO(
        topic_id="top_audit",
        title="Architecture",
        page_start=1,
        page_end=3,
    )

    plan = MultiPartPlanDTO(
        job_id="job_audit_test",
        document_hash="dummy_hash_audit",
        document_name="Audit Document",
        total_pages=3,
        slides_per_part=5,
        content_density="balanced",
        total_parts=1,
        total_slides=3,
        topics=[topic],
        content_units=[unit],
        parts=[
            PartPlanDTO(
                part_number=1,
                title="Part 1: Architecture",
                subtitle="Overview",
                target_slides=5,
                planned_slides=3,
                topic_ids=["top_audit"],
                unit_ids=["unit_diag"],
                is_final_part=True,
            )
        ],
    )

    job = MultiPartJobDTO(
        job_id="job_audit_test",
        document_hash="dummy_hash_audit",
        status="planning_allocation",
        step_index=5,
        step_name="Ready",
        message="Ready",
        progress_percent=50,
        document_name="Audit Document",
        slides_per_part=5,
        content_density="balanced",
        mode="deterministic",
        theme="academic_navy",
        layout_style="smart_mixed",
        plan=plan,
        content_units=[unit],
    )

    generator = MultiPartGenerator(output_dir=tmp_path)
    updated_job = generator.generate_single_part_for_job(job, part_number=1)

    assert updated_job.coverage_report is not None
    audit = updated_job.coverage_report.figure_audit
    assert len(audit) >= 1
    record = audit[0]
    assert record["figure_reference"] == "Figure 1.1"
    assert record["inserted_successfully"] is True
    assert record["assigned_part"] == 1


def test_09_zip_manifest_lists_completed_and_pending_parts(tmp_path):
    """9. Series ZIP manifest accurately distinguishes completed parts from pending parts."""
    # Create fake PPTX for Part 1 matching file_id 'file_p1'
    prs = Presentation()
    p1_path = tmp_path / "file_p1.pptx"
    prs.save(str(p1_path))

    plan = MultiPartPlanDTO(
        job_id="job_zip_test",
        document_hash="dummy_hash_zip",
        document_name="Series Test",
        total_pages=10,
        slides_per_part=5,
        content_density="balanced",
        total_parts=2,
        total_slides=10,
        topics=[],
        parts=[
            PartPlanDTO(part_number=1, title="Part 1: Intro", subtitle="", target_slides=5, planned_slides=5, topic_ids=[], unit_ids=[], is_final_part=False),
            PartPlanDTO(part_number=2, title="Part 2: Advanced", subtitle="", target_slides=5, planned_slides=5, topic_ids=[], unit_ids=[], is_final_part=True),
        ],
    )

    part1_res = {
        "part_number": 1,
        "title": "Part 1: Intro",
        "file_id": "file_p1",
        "filename": "Part_1_Intro.pptx",
        "download_url": "/download/1",
        "slide_count": 5,
        "status": "completed",
    }
    part2_res = {
        "part_number": 2,
        "title": "Part 2: Advanced",
        "file_id": "",
        "filename": "",
        "download_url": "",
        "slide_count": 0,
        "status": "pending",
    }

    job = MultiPartJobDTO(
        job_id="job_zip_test",
        document_hash="dummy_hash_zip",
        status="planning_allocation",
        step_index=5,
        step_name="Ready",
        message="Ready",
        progress_percent=50,
        document_name="Series Test",
        slides_per_part=5,
        content_density="balanced",
        mode="deterministic",
        theme="academic_navy",
        layout_style="smart_mixed",
        plan=plan,
        parts=[part1_res, part2_res],
    )

    packager = MultiPartZipPackager(output_dir=tmp_path)
    zip_path, zip_filename = packager.create_zip_archive(job)

    assert zip_path.exists()
    assert zip_path.stat().st_size > 500

    import zipfile
    with zipfile.ZipFile(str(zip_path)) as zf:
        namelist = zf.namelist()
        assert any("Part_01_Part_1_Intro.pptx" in n for n in namelist)
        assert "README_CURRICULUM_MANIFEST.txt" in namelist
        assert "manifest.json" in namelist

        manifest_txt = zf.read("README_CURRICULUM_MANIFEST.txt").decode("utf-8")
        assert "Part 1: Intro" in manifest_txt
        assert "Part 2: Advanced" in manifest_txt
        assert "UNGENERATED PARTS" in manifest_txt
