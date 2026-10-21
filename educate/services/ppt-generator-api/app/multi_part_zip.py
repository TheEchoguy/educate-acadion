"""
Secure ZIP Packager and Curriculum Manifest Generator (Workstream B).
Packages all generated PowerPoint parts into a clean ZIP archive with a comprehensive
machine-readable and human-readable curriculum manifest, strictly preventing path traversal
and never leaking server secrets or environmental variables.
"""

from datetime import datetime
import json
import logging
from pathlib import Path
import re
from typing import List, Optional, Tuple
import zipfile

from app.models import MultiPartJobDTO, PartResultDTO

logger = logging.getLogger("acadion.multi_part_zip")


class MultiPartZipPackager:
    """Packages multi-part presentation artifacts and coverage manifests into secure ZIP archives."""

    def __init__(self, output_dir: Optional[Path] = None):
        self.output_dir = Path(output_dir or "output/web_generated").resolve()
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def create_zip_archive(self, job: MultiPartJobDTO) -> Tuple[Path, str]:
        """Create a ZIP archive containing all completed PPTX parts and curriculum manifests.
        
        Args:
            job: MultiPartJobDTO containing generated parts and coverage reports.
            
        Returns:
            Tuple of (zip_file_path, zip_download_filename)
        """
        if not job.parts:
            raise ValueError("No presentation parts exist to package into ZIP.")

        successful_parts = [p for p in job.parts if p.status == "completed" and p.file_id]
        if not successful_parts:
            raise ValueError("None of the presentation parts completed successfully.")

        # Sanitize base name for safe archive naming
        clean_doc_name = re.sub(r"[^a-zA-Z0-9_\-]", "", job.document_name.replace(" ", "_")).strip()
        clean_doc_name = clean_doc_name[:40] or "Curriculum_Presentation"
        zip_filename = f"{clean_doc_name}_All_Parts.zip"
        zip_path = self.output_dir / f"{job.job_id}_all_parts.zip"

        with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zip_file:
            # 1. Add each completed presentation part with safe filename
            for part in successful_parts:
                pptx_src = self.output_dir / f"{part.file_id}.pptx"
                if not pptx_src.exists():
                    logger.warning(f"PPTX file not found on disk for part {part.part_number}: {pptx_src}")
                    continue

                safe_part_title = re.sub(r"[^a-zA-Z0-9_\- ]", "", part.title).strip().replace(" ", "_")
                safe_arcname = f"Part_{part.part_number:02d}_{safe_part_title}.pptx"
                # Strict anti-traversal safety
                safe_arcname = Path(safe_arcname).name

                zip_file.write(pptx_src, arcname=safe_arcname)

            # 2. Add machine-readable manifest.json
            manifest_dict = self._build_json_manifest(job, successful_parts)
            manifest_json_str = json.dumps(manifest_dict, indent=2)
            zip_file.writestr("manifest.json", manifest_json_str)

            # 3. Add human-readable README_MANIFEST.txt
            manifest_text = self._build_text_manifest(job, successful_parts)
            zip_file.writestr("README_CURRICULUM_MANIFEST.txt", manifest_text)

        return zip_path, zip_filename

    def _build_json_manifest(self, job: MultiPartJobDTO, parts: List[PartResultDTO]) -> dict:
        """Create structured JSON manifest."""
        plan = job.plan
        return {
            "schema_version": "1.0",
            "curriculum_title": job.document_name,
            "job_id": job.job_id,
            "created_at": datetime.now().isoformat(),
            "generator": "Acadion AI PPT Generator",
            "total_parts": len(parts),
            "total_slides": sum(p.slide_count for p in parts),
            "requested_slides_per_part": job.slides_per_part,
            "content_density": job.content_density,
            "theme": job.theme,
            "layout_style": job.layout_style,
            "parts": [
                {
                    "part_number": p.part_number,
                    "title": p.title,
                    "filename": f"Part_{p.part_number:02d}_{re.sub(r'[^a-zA-Z0-9_]', '', p.title.replace(' ', '_'))}.pptx",
                    "slide_count": p.slide_count,
                    "file_size_bytes": p.file_size_bytes,
                }
                for p in parts
            ],
            "ungenerated_parts": [
                {
                    "part_number": p.part_number,
                    "title": p.title,
                    "status": p.status,
                }
                for p in job.parts if p.status != "completed"
            ],
            "coverage_audit": job.coverage_report.model_dump() if job.coverage_report else None,
            "topic_outline": [t.model_dump() for t in plan.topics] if plan else [],
        }

    def _build_text_manifest(self, job: MultiPartJobDTO, parts: List[PartResultDTO]) -> str:
        """Create clean human-readable curriculum summary manifest."""
        plan = job.plan
        lines = [
            "================================================================================",
            f" ACADION CURRICULUM PRESENTATION SERIES: {job.document_name}",
            "================================================================================",
            f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"Total Completed Parts: {len(parts)}",
            f"Total Slides: {sum(p.slide_count for p in parts)}",
            f"Target Slides Per Part: {job.slides_per_part}",
            f"Theme: {job.theme} | Layout Family: {job.layout_style}",
            "",
            "--- INCLUDED PRESENTATION PARTS ---",
        ]

        for p in parts:
            lines.append(f"• Part {p.part_number:02d}: {p.title} ({p.slide_count} slides)")

        ungenerated = [p for p in job.parts if p.status != "completed"]
        if ungenerated:
            lines.extend([
                "",
                "--- UNGENERATED PARTS (Available for On-Demand Creation) ---",
            ])
            for u_part in ungenerated:
                lines.append(f"• Part {u_part.part_number:02d}: {u_part.title} (Planned: {u_part.planned_slides} slides)")

        if plan and plan.topics:
            lines.extend([
                "",
                "--- CURRICULUM TOPIC HIERARCHY ---",
            ])
            for t in plan.topics:
                inferred_badge = " [Inferred Concept]" if t.is_inferred else ""
                lines.append(f"  [{t.topic_id}] {t.title}{inferred_badge} (Source Pages: {t.page_start}–{t.page_end})")
                for s in t.subtopics:
                    lines.append(f"      - {s.title}")

        if job.coverage_report:
            cov = job.coverage_report
            lines.extend([
                "",
                "--- COVERAGE & QUALITY AUDIT ---",
                f"Validation Status: {cov.status.upper()}",
                f"Instructional Quality Score: {cov.quality_score} / 100",
                f"Source Pages Processed: {cov.source_pages_extracted}",
                f"Content Units Discovered: {cov.content_units_discovered}",
                f"Content Units Mapped to Slides: {cov.content_units_mapped}",
                f"Topics Covered: {cov.topics_covered} / {cov.topics_detected}",
            ])
            if cov.warnings:
                lines.append("Warnings & Recommendations:")
                for w in cov.warnings:
                    lines.append(f"  ! {w}")

        lines.extend([
            "",
            "================================================================================",
            " Instructions for Teachers:",
            " - All PPTX files are fully editable native Microsoft PowerPoint presentations.",
            " - Consistent typography and color palette are maintained across all parts.",
            " - To present, open each part in PowerPoint or upload to Google Slides.",
            "================================================================================",
        ])

        return "\n".join(lines)
