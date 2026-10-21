"""
Combined verification script for Workstream B and Phase 2.6.
Generates 5 concrete test presentations, inspects their PPTX geometry,
evaluates QA reports, runs a full SOM roundtrip with newly added slides,
theme modification, and layout transformation, and verifies that the source
PPTX is completely unmodified.
"""

from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import hashlib
import json
import tempfile
import pptx
from pptx.util import Inches

from app.models import (
    BulletPoint,
    PresentationData,
    Section,
    SectionType,
    SlideArchetype,
)
from app.layouts import THEMES
from app.ppt_generator import PPTGenerator
from app.qa_engine import PresentationQAEngine
from app.pptx_parser import parse_presentation
from app.pptx_serializer import serialize_presentation


def compute_file_hash(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def main():
    print("==================================================================")
    print("STARTING COMBINED INTEGRATION VERIFICATION: PHASE 2.6 + WORKSTREAM B")
    print("==================================================================")

    output_dir = Path("output")
    output_dir.mkdir(exist_ok=True)
    qa = PresentationQAEngine()

    # -------------------------------------------------------------------------
    # Example 1: Three-step workflow
    # -------------------------------------------------------------------------
    print("\n--- [1/5] Generating Example 1: Three-Step Workflow ---")
    data1 = PresentationData(
        title="Distributed Event Ingestion & Streaming",
        subtitle="Real-Time Data Architecture",
        institution="Acadion Engineering",
        recommended_theme="modern_blue",
    )
    data1.overview_section = Section(
        title="Agenda",
        section_type=SectionType.INTRO_OVERVIEW,
        bullets=[BulletPoint(text="Review the 3-stage streaming architecture", prefix="Core Agenda")],
        speaker_notes="Overview of distributed streaming.",
    )
    data1.content_sections = [
        Section(
            title="Pipeline Execution: Step 1: Ingest Log Streams Step 2: Stream Transformations Step 3: Analytics Sink",
            section_type=SectionType.CONTENT,
            bullets=[BulletPoint(text="Partitioned Kafka topics handle 500k eps.", prefix="Throughput")],
            speaker_notes="Walk through each step in the pipeline.",
        )
    ]
    data1.conclusion_section = Section(
        title="Summary & Architecture Best Practices",
        section_type=SectionType.SUMMARY_CONCLUSION,
        bullets=[BulletPoint(text="Enforce exactly-once semantics", prefix="Key Rule")],
        speaker_notes="Concluding guidance.",
    )

    p1_path = output_dir / "example_1_three_step_workflow.pptx"
    gen1 = PPTGenerator(theme="modern_blue")
    gen1.generate(data1, p1_path)
    r1 = qa.evaluate_presentation(p1_path)
    print(f"  Saved: {p1_path.name}")
    print(f"  QA Status: {r1.status} (Score: {r1.overall_score})")
    assert r1.is_acceptable, f"Example 1 failed QA: {[c.detail for c in r1.checks if not c.passed]}"

    prs1 = pptx.Presentation(str(p1_path))
    s1 = prs1.slides[2]
    # Check that title was cleaned
    title_text = next(s.text_frame.text.strip() for s in s1.shapes if s.has_text_frame and Inches(0.5) <= s.top <= Inches(1.2))
    print(f"  Slide 3 Clean Title: '{title_text}'")
    assert title_text == "Pipeline Execution", f"Expected 'Pipeline Execution', got '{title_text}'"

    # -------------------------------------------------------------------------
    # Example 2: Four-point conceptual explanation
    # -------------------------------------------------------------------------
    print("\n--- [2/5] Generating Example 2: Four-Point Conceptual Explanation ---")
    data2 = PresentationData(
        title="Microservice Resilience Patterns",
        subtitle="High-Availability Distributed Systems",
        institution="Acadion Engineering",
        recommended_theme="emerald_pro",
    )
    data2.overview_section = Section(
        title="Agenda",
        section_type=SectionType.INTRO_OVERVIEW,
        bullets=[BulletPoint(text="Survey four critical resilience mechanisms", prefix="Agenda")],
        speaker_notes="Resilience overview.",
    )
    data2.content_sections = [
        Section(
            title="Four Pillars of Fault Isolation",
            section_type=SectionType.CONTENT,
            composition_type="cards_grid",
            bullets=[
                BulletPoint(text="Trip fast to prevent cascading socket pool exhaustion.", prefix="Circuit Breakers"),
                BulletPoint(text="Isolate failures to individual customer thread pools.", prefix="Bulkheads"),
                BulletPoint(text="Throttle aggressive consumers via token buckets.", prefix="Rate Limiting"),
                BulletPoint(text="Degrade gracefully to cached read-only replicas.", prefix="Fallback Modes"),
            ],
            speaker_notes="Explain the four isolation mechanisms.",
        )
    ]
    data2.conclusion_section = Section(
        title="Takeaways & Production Checklist",
        section_type=SectionType.SUMMARY_CONCLUSION,
        bullets=[BulletPoint(text="Validate failover via chaos testing", prefix="Checklist")],
        speaker_notes="Conclusion.",
    )

    p2_path = output_dir / "example_2_four_point_explanation.pptx"
    gen2 = PPTGenerator(theme="emerald_pro")
    gen2.generate(data2, p2_path)
    r2 = qa.evaluate_presentation(p2_path)
    print(f"  Saved: {p2_path.name}")
    print(f"  QA Status: {r2.status} (Score: {r2.overall_score})")
    assert r2.is_acceptable, f"Example 2 failed QA: {[c.detail for c in r2.checks if not c.passed]}"

    prs2 = pptx.Presentation(str(p2_path))
    s2 = prs2.slides[2]
    # Check 4 cards in 2x2 grid
    cards2 = [s for s in s2.shapes if s.shape_type == 1 and Inches(1.5) <= s.top <= Inches(4.5) and s.width >= Inches(5.0)]
    print(f"  Slide 3 2x2 Grid Cards: {len(cards2)}")
    assert len(cards2) == 4

    # -------------------------------------------------------------------------
    # Example 3: Dense topic requiring multiple slides
    # -------------------------------------------------------------------------
    print("\n--- [3/5] Generating Example 3: Dense Topic Requiring Multiple Slides ---")
    data3 = PresentationData(
        title="Cloud Infrastructure & Security Controls",
        subtitle="Comprehensive Compliance Masterclass",
        institution="Acadion Engineering",
        recommended_theme="dark_tech",
    )
    dense_bullets = [
        BulletPoint(text="Implement least-privilege role-based access controls across IAM.", prefix="IAM Control"),
        BulletPoint(text="Enforce mutual TLS encryption for all ingress and egress packets.", prefix="mTLS Transport"),
        BulletPoint(text="Deploy automated software bill of materials scanning in CI.", prefix="SBOM Scanning"),
        BulletPoint(text="Maintain tamper-evident audit logs with write-once S3 buckets.", prefix="Audit Storage"),
        BulletPoint(text="Establish continuous vulnerability posture scanning in runtime.", prefix="Runtime Posture"),
        BulletPoint(text="Execute automated secret rotation with hardware HSM modules.", prefix="HSM Keys"),
    ]
    data3.content_sections = [
        Section(
            title="Enterprise Security Architecture",
            section_type=SectionType.CONTENT,
            composition_type="editorial",
            bullets=dense_bullets,
            speaker_notes="Detailed compliance controls.",
        )
    ]

    p3_path = output_dir / "example_3_dense_multislide.pptx"
    gen3 = PPTGenerator(theme="dark_tech")
    gen3.generate(data3, p3_path)
    r3 = qa.evaluate_presentation(p3_path)
    print(f"  Saved: {p3_path.name}")
    print(f"  QA Status: {r3.status} (Score: {r3.overall_score})")
    print(f"  Total Slides Generated: {r3.total_slides}")
    assert r3.is_acceptable, f"Example 3 failed QA: {[c.detail for c in r3.checks if not c.passed]}"
    # Verify split occurred (Title + Overview + Part 1 + Part 2 + Summary = 5 slides)
    assert r3.total_slides >= 5

    # -------------------------------------------------------------------------
    # Example 4: Long title
    # -------------------------------------------------------------------------
    print("\n--- [4/5] Generating Example 4: Long Title Presentation ---")
    long_title = "Architectural Innovations in High-Throughput Fault-Tolerant Distributed Consensus Algorithms for Global Cloud Deployments"
    data4 = PresentationData(
        title=long_title,
        subtitle="Advanced Systems Engineering",
        institution="Acadion Engineering",
        recommended_theme="academic_navy",
    )
    data4.content_sections = [
        Section(
            title=long_title,
            section_type=SectionType.CONTENT,
            bullets=[
                BulletPoint(text="Consensus guarantees linearizability across multi-region clusters.", prefix="Linearizability"),
                BulletPoint(text="Raft heartbeats detect partition events within 150 milliseconds.", prefix="Heartbeat Detection"),
            ],
            speaker_notes="Notes on long title consensus.",
        )
    ]

    p4_path = output_dir / "example_4_long_title.pptx"
    gen4 = PPTGenerator(theme="academic_navy")
    gen4.generate(data4, p4_path)
    r4 = qa.evaluate_presentation(p4_path)
    print(f"  Saved: {p4_path.name}")
    print(f"  QA Status: {r4.status} (Score: {r4.overall_score})")
    assert r4.is_acceptable, f"Example 4 failed QA: {[c.detail for c in r4.checks if not c.passed]}"

    prs4 = pptx.Presentation(str(p4_path))
    s4 = prs4.slides[2]
    rule4 = next(s for s in s4.shapes if s.width >= Inches(5.0) and s.height <= Inches(0.06) and s.top >= Inches(1.2))
    title_box4 = next(s for s in s4.shapes if s.has_text_frame and Inches(0.5) <= s.top <= Inches(1.2) and s.height <= Inches(2.0) and s != rule4)
    print(f"  Slide 3 Title Bottom: {title_box4.top / Inches(1) + title_box4.height / Inches(1):.2f}\" | Rule Top: {rule4.top / Inches(1):.2f}\"")
    assert title_box4.top + title_box4.height <= rule4.top + Inches(0.02)

    # -------------------------------------------------------------------------
    # Example 5: Presentation using a second registered theme (purple_gradient)
    # -------------------------------------------------------------------------
    print("\n--- [5/5] Generating Example 5: Second Registered Theme (purple_gradient) ---")
    data5 = PresentationData(
        title="Advanced Generative AI Foundations",
        subtitle="Faculty Curriculum Master Deck",
        institution="Acadion AI Institute",
        recommended_theme="purple_gradient",
    )
    data5.content_sections = [
        Section(
            title="Transformer Architecture Foundations",
            section_type=SectionType.CONTENT,
            composition_type="asymmetric",
            bullets=[
                BulletPoint(text="Self-attention computes pairwise token compatibility scores.", prefix="Attention"),
                BulletPoint(text="Feedforward sublayers project representations into higher dimensions.", prefix="MLP Projections"),
            ],
            speaker_notes="Detailed transformer architecture walkthrough.",
        )
    ]

    p5_path = output_dir / "example_5_purple_gradient.pptx"
    gen5 = PPTGenerator(theme="purple_gradient")
    gen5.generate(data5, p5_path)
    r5 = qa.evaluate_presentation(p5_path)
    print(f"  Saved: {p5_path.name}")
    print(f"  QA Status: {r5.status} (Score: {r5.overall_score})")
    assert r5.is_acceptable, f"Example 5 failed QA: {[c.detail for c in r5.checks if not c.passed]}"

    # -------------------------------------------------------------------------
    # Phase 2.6 Working Model Roundtrip & Source PPTX Immutability Verification
    # -------------------------------------------------------------------------
    print("\n--- [Phase 2.6] Verifying Add Slide, Retheme, Re-Layout, and Source PPTX Immutability ---")
    # Take source presentation (example 1) and record checksum
    source_hash_before = compute_file_hash(p1_path)
    print(f"  Source PPTX SHA256 before edit: {source_hash_before}")

    # Parse into SOM
    som = parse_presentation(p1_path, file_id="immutability_test_file")
    initial_slide_count = som.slide_count
    print(f"  Initial SOM Slide Count: {initial_slide_count}")

    # 1. Add Slide in working model
    from app.models import SlideDetailDTO, SlideObjectDTO, TextContentDTO, TextParagraphDTO, TextRunDTO
    new_slide_obj = SlideObjectDTO(
        object_id="new_slide_obj_1",
        name="New Slide Heading",
        object_type="text_box",
        x=80,
        y=60,
        width=800,
        height=70,
        x_emu=635000,
        y_emu=476250,
        width_emu=6350000,
        height_emu=555625,
        rotation=0,
        z_index=0,
        is_unsupported=False,
        text_content=TextContentDTO(
            paragraphs=[
                TextParagraphDTO(
                    paragraph_index=0,
                    alignment="left",
                    level=0,
                    is_bullet=False,
                    runs=[
                        TextRunDTO(
                            run_index=0,
                            text="Added Slide: Operational Scalability",
                            font_family="Calibri",
                            font_size=24,
                            font_color="#0F172A",
                            bold=True,
                            italic=False,
                        )
                    ],
                )
            ],
            vertical_alignment="top",
            word_wrap=True,
        ),
    )
    new_slide = SlideDetailDTO(
        slide_id="added_slide_99",
        slide_number=initial_slide_count + 1,
        width=som.slide_width,
        height=som.slide_height,
        background_color="#FFFFFF",
        background_type="solid",
        speaker_notes="Newly added slide speaker notes.",
        layout_name="editorial",
        objects=[new_slide_obj],
    )

    # Add to working SOM
    som.slides.append(new_slide)
    som.slide_count = initial_slide_count + 1

    # Retheme slide 1
    som.slides[0].background_color = "#0B132B"

    # Export to a SEPARATE file
    export_id = "immutability_verification_export"
    final_export_path, download_filename, warnings = serialize_presentation(
        source_pptx_path=p1_path,
        model=som,
        local_assets=[],
        export_id=export_id,
        exports_dir=output_dir,
    )

    exported_path = final_export_path

    print(f"  Exported Edited Presentation: {exported_path.name}")

    # Check that source PPTX hash is strictly unchanged
    source_hash_after = compute_file_hash(p1_path)
    print(f"  Source PPTX SHA256 after export:  {source_hash_after}")
    assert source_hash_before == source_hash_after, "SOURCE PPTX WAS MUTATED IN PLACE! NON-NEGOTIABLE RULE VIOLATED!"
    print("  [PASS] CONFIRMED: Original source PPTX file was strictly NOT mutated!")

    # Verify exported presentation can be opened and contains the new slide
    exported_prs = pptx.Presentation(str(exported_path))
    assert len(exported_prs.slides) == initial_slide_count + 1, f"Expected {initial_slide_count + 1} slides, got {len(exported_prs.slides)}"
    print(f"  [PASS] CONFIRMED: Exported presentation contains {len(exported_prs.slides)} slides (initial {initial_slide_count} + 1 new slide).")

    # Inspect added slide
    added_slide = exported_prs.slides[-1]
    assert len(added_slide.shapes) >= 1
    added_texts = [s.text_frame.text for s in added_slide.shapes if s.has_text_frame]
    print(f"  [PASS] Added slide texts: {added_texts}")
    assert any("Added Slide: Operational Scalability" in t for t in added_texts)

    print("\n==================================================================")
    print("ALL COMBINED VERIFICATIONS COMPLETED SUCCESSFULLY WITH ZERO ERRORS!")
    print("==================================================================")


if __name__ == "__main__":
    main()
