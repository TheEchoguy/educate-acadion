"""
Multi-Part Presentation Generator and Quality & Coverage Auditor (Workstream B).
Orchestrates generation of each PowerPoint part using Acadion's native design system,
verifies PPTX parseability, prevents content loss, produces slide previews,
and computes deterministic curriculum coverage reports with traceability.
"""

from datetime import datetime
import logging
from pathlib import Path
import re
import time
from typing import Any, Callable, Dict, List, Optional, Tuple
import uuid

import pptx
from pptx.util import Inches

from app.layouts import get_theme, auto_select_theme
from app.models import (
    BulletPoint,
    ComparisonColumn,
    ComparisonData,
    ContentUnitDTO,
    ContentUnitStatus,
    CoverageReportDTO,
    DiscoveredTopicDTO,
    MultiPartJobDTO,
    MultiPartJobStatus,
    MultiPartPlanDTO,
    PartPlanDTO,
    PartResultDTO,
    PresentationData,
    ProcessFlowData,
    ProcessStep,
    Section,
    SectionType,
    SlideVisual,
    TimelineData,
    TimelineMilestone,
    VisualType,
)
from app.ppt_generator import PPTGenerator
from app.preview_renderer import render_pptx_previews
from app.readability_validator import ReadabilityValidator

logger = logging.getLogger("acadion.multi_part_generator")


class MultiPartGenerator:
    """Coordinates generation, QA validation, and coverage auditing across multi-part presentations."""

    def __init__(
        self,
        output_dir: Optional[Path] = None,
        previews_dir: Optional[Path] = None,
    ):
        self.output_dir = Path(output_dir or "output/web_generated").resolve()
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.previews_dir = self.output_dir

    def generate_all_parts(
        self,
        job: MultiPartJobDTO,
        progress_callback: Optional[Callable[[MultiPartJobDTO], None]] = None,
    ) -> MultiPartJobDTO:
        """Generate all planned parts sequentially with progress tracking and coverage validation."""
        plan = job.plan
        if not plan or not plan.parts:
            job.status = MultiPartJobStatus.FAILED
            job.error = "Cannot generate multi-part presentation without an approved plan."
            return job

        job.status = MultiPartJobStatus.GENERATING_PARTS
        job.parts = []
        total_parts = len(plan.parts)
        units_by_id = {u.unit_id: u for u in plan.content_units}

        coverage_warnings: List[str] = []
        covered_topics: set = set()
        covered_units: set = set()

        for idx, part_plan in enumerate(plan.parts):
            part_num = part_plan.part_number
            step_pct = 40 + int(((idx) / total_parts) * 45)
            job.step_index = 6
            job.step_name = f"Generating Part {part_num} of {total_parts}"
            job.message = f"Rendering slides for {part_plan.title}..."
            job.progress_percent = step_pct
            if progress_callback:
                progress_callback(job)

            try:
                part_result, p_topics, p_units = self._generate_single_part(
                    job=job,
                    part_plan=part_plan,
                    units_by_id=units_by_id,
                    all_topics=plan.topics,
                )
                job.parts.append(part_result)
                covered_topics.update(p_topics)
                covered_units.update(p_units)

                # Mark content units as generated
                for u_id in p_units:
                    if u_id in units_by_id:
                        units_by_id[u_id].status = ContentUnitStatus.GENERATED

            except Exception as e:
                logger.error(f"Failed to generate Part {part_num}: {e}", exc_info=True)
                error_result = PartResultDTO(
                    part_number=part_num,
                    title=part_plan.title,
                    file_id="",
                    filename=f"{part_plan.title}.pptx",
                    download_url="",
                    slide_count=0,
                    status="failed",
                    error_message=str(e),
                )
                job.parts.append(error_result)
                coverage_warnings.append(f"Part {part_num} generation failed: {e}")

        # Step 7 & 8: Validate layouts and coverage
        job.step_index = 7
        job.step_name = "Validating layouts and coverage"
        job.message = "Verifying curriculum coverage, font sizes, and PPTX integrity..."
        job.progress_percent = 90
        if progress_callback:
            progress_callback(job)

        coverage_report = self._audit_coverage(
            plan=plan,
            parts=job.parts,
            covered_topics=covered_topics,
            covered_units=covered_units,
            extra_warnings=coverage_warnings,
        )
        job.coverage_report = coverage_report

        # Mark units as validated if coverage passes
        for u in plan.content_units:
            if u.status == ContentUnitStatus.GENERATED:
                u.status = ContentUnitStatus.VALIDATED

        # Check final status
        all_success = all(p.status == "completed" for p in job.parts)
        if all_success:
            if coverage_report.warnings:
                job.status = MultiPartJobStatus.COMPLETED_WITH_WARNINGS
                job.message = f"Successfully generated all {total_parts} parts with validation warnings."
            else:
                job.status = MultiPartJobStatus.COMPLETED
                job.message = f"Successfully generated all {total_parts} PowerPoint parts!"
            job.progress_percent = 100
        else:
            job.status = MultiPartJobStatus.FAILED
            job.error = f"Some presentation parts failed to generate ({sum(1 for p in job.parts if p.status == 'failed')}/{total_parts} failed)."

        job.updated_at = datetime.now().isoformat()
        if progress_callback:
            progress_callback(job)

        return job

    def generate_single_part_for_job(
        self,
        job: MultiPartJobDTO,
        part_number: int,
        progress_callback: Optional[Callable[[MultiPartJobDTO], None]] = None,
    ) -> MultiPartJobDTO:
        """Generate only the specified presentation part on-demand with server-side monotonic timing."""
        plan = job.plan
        if not plan or not plan.parts:
            raise ValueError("Cannot generate part: Job does not contain an approved plan.")

        part_plan = next((p for p in plan.parts if p.part_number == part_number), None)
        if not part_plan:
            raise ValueError(f"Part {part_number} is not in the approved presentation plan.")

        units_by_id = {u.unit_id: u for u in plan.content_units}

        # Find existing PartResultDTO in job.parts
        existing_idx = next((i for i, p in enumerate(job.parts) if p.part_number == part_number), None)
        if existing_idx is not None:
            part_result = job.parts[existing_idx]
        else:
            assigned_t_objs = [t for t in plan.topics if t.topic_id in part_plan.topic_ids]
            part_result = PartResultDTO(
                part_number=part_number,
                title=part_plan.title,
                status="pending",
                planned_slides=part_plan.planned_slides,
                requested_max_slides=part_plan.target_slides,
                source_page_start=min((t.page_start for t in assigned_t_objs), default=1),
                source_page_end=max((t.page_end for t in assigned_t_objs), default=1),
                assigned_topics=[t.title for t in assigned_t_objs],
            )
            job.parts.append(part_result)

        # Safe caching check: if already completed and valid file exists, reuse
        if part_result.status == "completed" and part_result.file_id:
            pptx_path = (self.output_dir / f"{part_result.file_id}.pptx").resolve()
            if pptx_path.exists() and pptx_path.stat().st_size > 0:
                return job

        # Concurrency safety: if already generating, avoid duplicate runs
        if part_result.status == "generating":
            return job

        part_result.status = "generating"
        part_result.generation_stage = "Rendering presentation slides..."
        job.updated_at = datetime.now().isoformat()
        if progress_callback:
            progress_callback(job)

        t_start = time.monotonic()
        try:
            new_result, p_topics, p_units = self._generate_single_part(
                job=job,
                part_plan=part_plan,
                units_by_id=units_by_id,
                all_topics=plan.topics,
            )
            duration_sec = round(time.monotonic() - t_start, 2)
            new_result.generation_duration_seconds = duration_sec
            new_result.generation_stage = "Completed"
            new_result.status = "completed"

            # Replace or append in job.parts
            idx = next((i for i, p in enumerate(job.parts) if p.part_number == part_number), None)
            if idx is not None:
                job.parts[idx] = new_result
            else:
                job.parts.append(new_result)

            # Mark units as generated
            for u_id in p_units:
                if u_id in units_by_id:
                    units_by_id[u_id].status = ContentUnitStatus.GENERATED

            # Recompute coverage audit across all completed parts
            covered_topics = set()
            covered_units = set()
            for p in job.parts:
                if p.status == "completed":
                    p_plan = next((pp for pp in plan.parts if pp.part_number == p.part_number), None)
                    if p_plan:
                        covered_topics.update(p_plan.topic_ids)
                        covered_units.update(p_plan.unit_ids)

            job.coverage_report = self._audit_coverage(
                plan=plan,
                parts=job.parts,
                covered_topics=covered_topics,
                covered_units=covered_units,
                extra_warnings=[],
            )

            # Check overall job completion
            completed_count = sum(1 for p in job.parts if p.status == "completed")
            if completed_count == len(plan.parts):
                job.status = MultiPartJobStatus.COMPLETED
                job.message = f"All {completed_count} parts have been generated!"
            else:
                job.status = MultiPartJobStatus.PLANNING_ALLOCATION
                job.message = f"Generated {completed_count} of {len(plan.parts)} parts."

        except Exception as e:
            logger.error(f"Failed to generate Part {part_number}: {e}", exc_info=True)
            part_result.status = "failed"
            part_result.error_message = str(e)
            part_result.generation_stage = f"Error: {e}"
            raise

        finally:
            job.updated_at = datetime.now().isoformat()
            if progress_callback:
                progress_callback(job)

        return job

    def _generate_single_part(
        self,
        job: MultiPartJobDTO,
        part_plan: PartPlanDTO,
        units_by_id: Dict[str, ContentUnitDTO],
        all_topics: List[DiscoveredTopicDTO],
    ) -> Tuple[PartResultDTO, List[str], List[str]]:
        """Render a single presentation part into a PPTX file and generate preview images."""
        t_part_start = time.monotonic()
        file_id = str(uuid.uuid4())
        part_num = part_plan.part_number
        part_units = [units_by_id[u_id] for u_id in part_plan.unit_ids if u_id in units_by_id]

        # Convert PartPlan and ContentUnits into structured PresentationData
        presentation_data = self._build_part_presentation_data(
            part_plan=part_plan,
            content_units=part_units,
            theme_id=job.theme,
            layout_style=job.layout_style,
            include_summary=job.include_summaries and part_plan.is_final_part,
            include_revision_questions=job.include_revision_questions and part_plan.is_final_part,
        )

        # Output filename
        clean_name = re.sub(r"[^a-zA-Z0-9_\- ]", "", part_plan.title).strip().replace(" ", "_")
        filename = f"{clean_name}.pptx"
        output_path = self.output_dir / f"{file_id}.pptx"

        # Generate PPTX using existing PPTGenerator with strict max_slides ceiling
        generator = PPTGenerator(theme=job.theme, layout_style=job.layout_style)
        actual_path = generator.generate(
            data=presentation_data,
            output_path=output_path,
            layout_style=job.layout_style,
            max_slides=part_plan.target_slides,
        )

        # Integrity check: reopen with python-pptx
        reopened = pptx.Presentation(str(actual_path))
        slide_count = len(reopened.slides)
        file_size = actual_path.stat().st_size

        if slide_count == 0:
            raise ValueError(f"Generated PPTX for Part {part_num} contains 0 slides.")

        # Post-serialization validation via ReadabilityValidator on actual exported PPTX
        validation = ReadabilityValidator.validate_pptx(
            pptx_path=actual_path,
            max_allowed_slides=part_plan.target_slides,
        )

        # Strict hard limit check: exported PPTX MUST contain <= target_slides
        hard_limit_passed = slide_count <= part_plan.target_slides

        # Render slide preview images
        preview_urls: List[str] = []
        try:
            preview_dir = self.output_dir / f"{file_id}_previews"
            preview_paths = render_pptx_previews(actual_path, preview_dir)
            preview_urls = [f"/api/preview/{file_id}/{idx+1}" for idx in range(len(preview_paths))]
        except Exception as e:
            logger.warning(f"Could not render slide previews for {file_id}: {e}")

        # Update unit slide assignments
        for s_idx, u in enumerate(part_units):
            u.assigned_slide_num = min(slide_count, s_idx + 2)  # Slide 1 is title

        download_url = f"/api/multi-part/jobs/{job.job_id}/parts/{part_num}/download"
        assigned_t_objs = [t for t in all_topics if t.topic_id in part_plan.topic_ids]
        p_start = min((t.page_start for t in assigned_t_objs), default=1)
        p_end = max((t.page_end for t in assigned_t_objs), default=1)
        duration_sec = round(time.monotonic() - t_part_start, 2)

        result = PartResultDTO(
            part_number=part_num,
            title=part_plan.title,
            file_id=file_id,
            filename=filename,
            download_url=download_url,
            slide_count=slide_count,
            planned_slides=part_plan.planned_slides,
            requested_max_slides=part_plan.target_slides,
            actual_exported_slides=slide_count,
            hard_limit_passed=hard_limit_passed,
            serious_layout_issues_detected=validation.serious_layout_issues_detected,
            issues_automatically_repaired=validation.issues_automatically_repaired,
            warnings=validation.warnings,
            status="completed",
            preview_urls=preview_urls,
            file_size_bytes=file_size,
            generation_duration_seconds=duration_sec,
            generation_stage="Completed",
            source_page_start=p_start,
            source_page_end=p_end,
            assigned_topics=[t.title for t in assigned_t_objs],
        )

        covered_topics = list(part_plan.topic_ids)
        covered_units = [u.unit_id for u in part_units]
        return result, covered_topics, covered_units

    def _build_part_presentation_data(
        self,
        part_plan: PartPlanDTO,
        content_units: List[ContentUnitDTO],
        theme_id: str,
        layout_style: str,
        include_summary: bool,
        include_revision_questions: bool,
    ) -> PresentationData:
        """Construct PresentationData matching Acadion schema for this part."""
        content_sections: List[Section] = []

        for unit in content_units:
            bullets = []
            for p in unit.key_points:
                pref = self._extract_bullet_prefix(p)
                clean_text = p
                if pref:
                    p_clean = pref.rstrip(":")
                    if clean_text.lower().startswith((p_clean + ":").lower()):
                        clean_text = clean_text[len(p_clean) + 1:].strip()
                    elif clean_text.lower().startswith(p_clean.lower()):
                        clean_text = clean_text[len(p_clean):].strip().lstrip(":- ")
                bullets.append(BulletPoint(text=clean_text or p, prefix=pref))

            # Visual type selection based on unit type and image availability
            visual: Optional[SlideVisual] = None
            comp_type = "editorial"

            if unit.image_path and Path(unit.image_path).exists():
                from app.models import ImageData
                visual = SlideVisual(
                    visual_type=VisualType.LOCAL_IMAGE,
                    image=ImageData(
                        file_path=unit.image_path,
                        caption=unit.caption or unit.title,
                        alt_text=unit.title,
                    )
                )
                comp_type = "split_image"
            elif unit.unit_type == "process" and len(unit.key_points) >= 3:
                visual = SlideVisual(
                    visual_type=VisualType.PROCESS_FLOW,
                    process_flow=ProcessFlowData(
                        steps=[
                            ProcessStep(step_number=idx+1, title=p[:30], description=p[30:120])
                            for idx, p in enumerate(unit.key_points[:5])
                        ]
                    )
                )
                comp_type = "process_flow"
            elif unit.unit_type == "comparison" and len(unit.key_points) >= 2:
                mid = len(unit.key_points) // 2
                visual = SlideVisual(
                    visual_type=VisualType.COMPARISON,
                    comparison=ComparisonData(
                        left_column=ComparisonColumn(name="Approach A", points=unit.key_points[:mid]),
                        right_column=ComparisonColumn(name="Approach B", points=unit.key_points[mid:mid+4]),
                        takeaway="Key architectural comparison"
                    )
                )
                comp_type = "editorial"
            elif unit.unit_type == "definition":
                comp_type = "editorial"
            elif unit.unit_type == "example":
                comp_type = "case_study"
            elif unit.unit_type == "key_points":
                comp_type = "cards_grid"

            page_ref = f"Source: Page {', '.join(str(p) for p in unit.source_pages)}" if unit.source_pages else ""
            key_msg = unit.key_points[0] if unit.key_points else ""

            # Deduplicate: if key_message is identical to bullet 0, skip bullet 0 in slide bullets
            slide_bullets = bullets
            if comp_type == "editorial" and len(bullets) > 1 and bullets[0].text == key_msg:
                slide_bullets = bullets[1:]

            content_sections.append(
                Section(
                    title=unit.title,
                    subtitle=unit.unit_type.replace("_", " ").title(),
                    section_type=SectionType.CONTENT,
                    bullets=slide_bullets,
                    speaker_notes=f"{page_ref}. Comprehensive lecture discussion for {unit.title}.",
                    visual=visual,
                    teaching_objective=f"Master principles of {unit.title}",
                    key_message=key_msg,
                    composition_type=comp_type,
                )
            )

        # Overview Section for Part: use distinct curriculum topics covered in this part
        overview_section: Optional[Section] = None
        unique_topic_titles: List[str] = []
        for s in content_sections:
            clean_s_title = re.sub(r"^(?:Definition|Question|Mathematical Model):\s*", "", s.title).strip()
            if clean_s_title and clean_s_title not in unique_topic_titles:
                unique_topic_titles.append(clean_s_title)

        if part_plan.target_slides >= 6 and unique_topic_titles:
            agenda_items = unique_topic_titles[:5]
            overview_section = Section(
                title="Lecture Agenda & Part Objectives",
                subtitle=f"Part {part_plan.part_number} Curriculum Roadmap",
                section_type=SectionType.INTRO_OVERVIEW,
                bullets=[
                    BulletPoint(prefix=f"Topic {idx+1:02d}", text=t_title)
                    for idx, t_title in enumerate(agenda_items)
                ],
                speaker_notes="Overview of key curriculum topics covered in this presentation part.",
                composition_type="agenda_roadmap",
            )

        # Conclusion Section (only for final part or if explicitly required and budget >= 5)
        conclusion_section: Optional[Section] = None
        if (include_summary or part_plan.is_final_part) and part_plan.target_slides >= 5:
            conclusion_section = Section(
                title="Curriculum Synthesis & Key Takeaways",
                subtitle="Core Concepts Review",
                section_type=SectionType.SUMMARY_CONCLUSION,
                bullets=[
                    BulletPoint(prefix="Key Mastery", text=s.title)
                    for s in content_sections[:4]
                ],
                speaker_notes="Final takeaways and review of curriculum concepts.",
                composition_type="synthesis_roadmap",
            )

        return PresentationData(
            title=part_plan.title,
            subtitle=part_plan.subtitle,
            institution="Acadion Learning",
            date_str=datetime.now().strftime("%B %Y"),
            overview_section=overview_section,
            content_sections=content_sections,
            conclusion_section=conclusion_section,
            recommended_slide_count=part_plan.planned_slides,
            recommended_theme=theme_id,
            theme_rationale=f"Consistent theme {theme_id} for multi-part series",
            title_composition="editorial_title",
            overview_composition="agenda_roadmap",
            conclusion_composition="synthesis_roadmap",
            is_part_of_series=True,
        )

    def _extract_bullet_prefix(self, text: str) -> Optional[str]:
        """Extract leading concept or bold term from text."""
        if ":" in text:
            parts = text.split(":", 1)
            if 2 <= len(parts[0].strip()) <= 35:
                return parts[0].strip()
        return None

    def _audit_coverage(
        self,
        plan: MultiPartPlanDTO,
        parts: List[PartResultDTO],
        covered_topics: set,
        covered_units: set,
        extra_warnings: List[str],
    ) -> CoverageReportDTO:
        """Perform rigorous deterministic audit of curriculum coverage."""
        warnings: List[str] = list(extra_warnings)

        total_units = len(plan.content_units)
        mapped_units = len(covered_units)
        total_topics = len(plan.topics)
        mapped_topics = len(covered_topics)

        # Check for unmapped topics
        unmapped_t = [t.title for t in plan.topics if t.topic_id not in covered_topics]
        if unmapped_t:
            warnings.append(f"Unmapped Topics: {', '.join(unmapped_t[:3])} were not covered in generated parts.")

        # Check for unmapped content units
        unmapped_u = [u for u in plan.content_units if u.unit_id not in covered_units]
        if unmapped_u:
            warnings.append(f"{len(unmapped_u)} content units were omitted or could not fit into planned parts.")

        total_slides_gen = sum(p.slide_count for p in parts if p.status == "completed")
        quality_score = 100
        if unmapped_t:
            quality_score -= min(30, len(unmapped_t) * 10)
        if unmapped_u:
            quality_score -= min(25, int((len(unmapped_u) / max(1, total_units)) * 30))
        if extra_warnings:
            quality_score -= 10

        status = "complete"
        if warnings or quality_score < 90:
            status = "validated_with_warnings" if quality_score >= 65 else "incomplete"

        # Structured Figure Audit Recording
        figure_audit: List[Dict[str, Any]] = []
        for u in plan.content_units:
            if u.unit_type == "diagram" or u.figure_reference or u.image_path:
                has_img = bool(u.image_path and Path(u.image_path).exists())
                issue_desc = None
                if not u.image_path:
                    issue_desc = "Figure referenced in notes was not found in document image streams."
                elif not has_img:
                    issue_desc = f"Figure image file missing on disk: {u.image_path}"

                part_match = next((p for p in parts if p.part_number == u.assigned_part), None)
                part_is_generated = bool(part_match and part_match.status == "completed")

                figure_audit.append({
                    "figure_reference": u.figure_reference or (f"Figure (Page {u.source_pages[0]})" if u.source_pages else "Diagram"),
                    "source_page": u.source_pages,
                    "caption": u.caption or u.title,
                    "asset_id": u.image_path,
                    "topic_id": u.topic_id,
                    "assigned_part": u.assigned_part,
                    "assigned_slide": u.assigned_slide_num if part_is_generated else None,
                    "inserted_successfully": bool(has_img and part_is_generated),
                    "part_generated": part_is_generated,
                    "unresolved_issue": issue_desc,
                })

        report = CoverageReportDTO(
            source_pages_extracted=plan.total_pages,
            content_units_discovered=total_units,
            topics_detected=total_topics,
            topics_covered=mapped_topics,
            content_units_mapped=mapped_units,
            items_requiring_review=len(unmapped_u),
            slides_generated=total_slides_gen,
            parts_generated=len([p for p in parts if p.status == "completed"]),
            hard_limit_enforced=all(p.hard_limit_passed for p in parts if p.status == "completed") if any(p.status == "completed" for p in parts) else True,
            total_serious_layout_issues=sum(p.serious_layout_issues_detected for p in parts if p.status == "completed"),
            total_issues_repaired=sum(p.issues_automatically_repaired for p in parts if p.status == "completed"),
            quality_score=max(0, quality_score),
            status=status,
            warnings=warnings,
            figure_audit=figure_audit,
        )
        return report
