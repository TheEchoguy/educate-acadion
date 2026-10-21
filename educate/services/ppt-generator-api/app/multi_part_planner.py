"""
Global Multi-Part Planner and Content Allocation Engine (Workstream B).
Builds a comprehensive curriculum coverage plan, decomposes source notes into atomic
content units, performs topic-aware segmentation targeting requested slides per part,
handles shorter final parts, continuation slides, and content density warnings.
"""

import math
import re
from typing import Any, Dict, List, Optional, Tuple
import uuid

from app.models import (
    ContentBlockType,
    ContentUnitDTO,
    ContentUnitStatus,
    DiscoveredTopicDTO,
    DocumentExtractionManifest,
    ExtractedBlock,
    MultiPartPlanDTO,
    PartPlanDTO,
)


class MultiPartPlanner:
    """Plans global curriculum coverage and segments content into multi-part presentations."""

    MIN_SLIDES_PER_PART = 3
    MAX_SLIDES_PER_PART = 50
    DEFAULT_SLIDES_PER_PART = 20

    # Content density units per slide targets
    DENSITY_RATIOS = {
        "concise": 2.2,   # 1 slide represents ~2.2 content units (high synthesis)
        "balanced": 1.5,  # 1 slide represents ~1.5 content units
        "detailed": 1.0,  # 1 slide per content unit (exhaustive exposition)
    }

    def build_plan(
        self,
        blocks: List[ExtractedBlock],
        topics: List[DiscoveredTopicDTO],
        manifest: DocumentExtractionManifest,
        slides_per_part: int = 20,
        content_density: str = "balanced",
        title_override: Optional[str] = None,
        job_id: Optional[str] = None,
        include_examples: bool = True,
        include_definitions: bool = True,
        include_equations: bool = True,
        include_summaries: bool = True,
        include_revision_questions: bool = True,
    ) -> MultiPartPlanDTO:
        """Construct the global coverage plan and part allocations."""
        job_id = job_id or f"job_{uuid.uuid4().hex[:12]}"
        validated_slides_per_part = max(
            self.MIN_SLIDES_PER_PART,
            min(int(slides_per_part or self.DEFAULT_SLIDES_PER_PART), self.MAX_SLIDES_PER_PART)
        )
        density_key = content_density.lower().strip() if content_density else "balanced"
        if density_key not in self.DENSITY_RATIOS:
            density_key = "balanced"

        # 1. Decompose document blocks into atomic ContentUnitDTOs
        content_units = self._extract_content_units(
            blocks=blocks,
            topics=topics,
            manifest=manifest,
            include_examples=include_examples,
            include_definitions=include_definitions,
            include_equations=include_equations,
        )

        # 2. Perform topic-aware segmentation into parts
        parts, density_warning, recommended_adj = self._allocate_topics_to_parts(
            topics=topics,
            content_units=content_units,
            slides_per_part=validated_slides_per_part,
            density=density_key,
            document_title=title_override or manifest.filename,
        )

        total_slides = sum(p.planned_slides for p in parts)

        return MultiPartPlanDTO(
            job_id=job_id,
            document_name=manifest.filename,
            document_hash=manifest.file_hash,
            total_pages=manifest.total_pages,
            slides_per_part=validated_slides_per_part,
            content_density=density_key,
            total_parts=len(parts),
            total_slides=total_slides,
            topics=topics,
            content_units=content_units,
            parts=parts,
            density_warning=density_warning,
            recommended_adjustment=recommended_adj,
            extraction_warnings=manifest.warnings,
        )

    def _extract_content_units(
        self,
        blocks: List[ExtractedBlock],
        topics: List[DiscoveredTopicDTO],
        manifest: DocumentExtractionManifest,
        include_examples: bool,
        include_definitions: bool,
        include_equations: bool,
    ) -> List[ContentUnitDTO]:
        """Convert extracted blocks into traceable, fine-grained ContentUnits."""
        units: List[ContentUnitDTO] = []
        unit_counter = 1

        # Sequential document-order topic mapping anchored to topic boundaries
        current_t_idx = 0
        block_to_topic: Dict[str, DiscoveredTopicDTO] = {}
        for b in blocks:
            # Advance to next topic if block reaches or exceeds next topic start
            if current_t_idx + 1 < len(topics):
                next_t = topics[current_t_idx + 1]
                if b.page_number >= next_t.page_start:
                    b_norm = re.sub(r"^\d+(\.\d+)*[:\.\-]?\s*", "", b.normalized_text.splitlines()[0]).strip().lower()
                    next_norm = next_t.title.lower()
                    if (b_norm and (b_norm in next_norm or next_norm in b_norm)) or (b.page_number > topics[current_t_idx].page_end):
                        current_t_idx += 1
            block_to_topic[b.block_id] = topics[current_t_idx] if topics else DiscoveredTopicDTO(
                topic_id="topic_001", title="Curriculum Overview", is_inferred=True
            )

        pending_heading: Optional[str] = None
        pending_pages: List[int] = []

        # 1. Build document-wide catalog of all genuine extracted image/diagram blocks
        figures_by_ref: Dict[str, ExtractedBlock] = {}
        figures_by_page: Dict[int, List[ExtractedBlock]] = {}
        for b in blocks:
            if b.block_type == ContentBlockType.IMAGE or b.image_path:
                if b.figure_reference:
                    ref_clean = re.sub(r"\s+", " ", b.figure_reference).strip().lower()
                    figures_by_ref[ref_clean] = b
                    m_num = re.search(r"(\d+(?:[\.\-_]\d+)*)", b.figure_reference)
                    if m_num:
                        figures_by_ref[f"figure {m_num.group(1)}"] = b
                        figures_by_ref[f"fig {m_num.group(1)}"] = b
                        figures_by_ref[f"fig. {m_num.group(1)}"] = b
                figures_by_page.setdefault(b.page_number, []).append(b)

        claimed_image_block_ids: set = set()

        for b in blocks:
            # Skip empty or trivial blocks
            text = b.normalized_text.strip()
            if not text or len(text) < 10 or not any(c.isalnum() for c in text):
                continue

            lines = text.splitlines()
            first_line = lines[0].strip() if lines else ""

            topic = block_to_topic.get(b.block_id, topics[0] if topics else DiscoveredTopicDTO(
                topic_id="topic_001", title="Curriculum Overview", is_inferred=True
            ))

            # If block is a bare heading, save as pending title context for subsequent content
            if b.block_type == ContentBlockType.HEADING:
                pending_heading = text
                pending_pages = [b.page_number]
                continue

            # If block is a caption, save as pending title/caption for the upcoming image block
            if b.block_type == ContentBlockType.CAPTION:
                pending_heading = text
                pending_pages = [b.page_number]
                continue

            # Handle Image/Diagram blocks
            if b.block_type == ContentBlockType.IMAGE or b.image_path:
                # If this image was already claimed by an in-text figure reference, avoid duplicate slide
                if b.block_id in claimed_image_block_ids:
                    continue

                img_cap = (b.caption or b.normalized_text or pending_heading or "").strip()
                # Clean caption for title (e.g. "Figure 5.3 shows the domain model..." -> "Domain Model...")
                img_title = re.sub(r"^(?:Figure|Fig\.|Listing|Table)\s+\d+(?:\.\d+)*[:\.\-]?\s*", "", img_cap, flags=re.I).strip()
                for lead_v in ("shows ", "illustrates ", "depicts ", "is an example of ", "of "):
                    if img_title.lower().startswith(lead_v):
                        img_title = img_title[len(lead_v):].strip()
                        break

                if not img_title or len(img_title) < 5 or re.match(r"^Diagram\s*\(", img_title, re.I):
                    img_title = f"{topic.title}: Visual Model"
                else:
                    img_title = img_title.splitlines()[0][:60].strip()
                    img_title = img_title[0].upper() + img_title[1:] if img_title else img_title

                if b.figure_reference and b.figure_reference not in img_title:
                    img_title = f"{img_title} ({b.figure_reference})"

                source_pages = sorted(list(set(pending_pages + [b.page_number])))
                pending_pages = []
                pending_heading = None
                unit_id = f"unit_{unit_counter:04d}"
                units.append(
                    ContentUnitDTO(
                        unit_id=unit_id,
                        topic_id=topic.topic_id,
                        title=img_title,
                        unit_type="diagram",
                        source_pages=source_pages,
                        key_points=[img_cap[:160]] if img_cap else [f"Diagram schematic illustrating {topic.title}."],
                        status=ContentUnitStatus.PLANNED,
                        confidence=b.confidence,
                        image_path=b.image_path,
                        caption=b.caption or b.figure_reference,
                        figure_reference=b.figure_reference,
                    )
                )
                unit_counter += 1
                continue

            unit_type = "explanation"

            # Check for in-text figure references (e.g., "Figure 5.3 shows the domain model...")
            matched_fig_block: Optional[ExtractedBlock] = None
            fig_ref_label: Optional[str] = None
            unit_warnings: List[str] = []

            m_fig = re.search(r"\b(?:Figure|Fig\.)\s*(\d+(?:[\.\-_]\d+)*)\b", text, re.I)
            if m_fig or b.figure_reference:
                fig_num = m_fig.group(1) if m_fig else re.search(r"(\d+(?:[\.\-_]\d+)*)", b.figure_reference or "").group(1)
                fig_ref_label = f"Figure {fig_num}"
                key_fig = f"figure {fig_num}".lower()
                if key_fig in figures_by_ref and figures_by_ref[key_fig].block_id not in claimed_image_block_ids:
                    matched_fig_block = figures_by_ref[key_fig]
                else:
                    # Check current page and adjacent pages for unclaimed image
                    for p_cand in (b.page_number, b.page_number + 1, b.page_number - 1):
                        for p_img in figures_by_page.get(p_cand, []):
                            if p_img.block_id not in claimed_image_block_ids:
                                cand_ref = p_img.figure_reference or ""
                                if fig_num in cand_ref or not cand_ref:
                                    matched_fig_block = p_img
                                    break
                        if matched_fig_block:
                            break

                if matched_fig_block:
                    claimed_image_block_ids.add(matched_fig_block.block_id)
                    unit_type = "diagram"
                else:
                    unit_warnings.append(f"{fig_ref_label} referenced on page {b.page_number} is absent from extracted assets.")

            if "question bank" in topic.title.lower() or "review questions" in topic.title.lower():
                unit_type = "review_question"
            elif unit_type == "diagram":
                pass  # Keep diagram unit type for matched figure
            elif b.block_type == ContentBlockType.DEFINITION:
                if not include_definitions:
                    continue
                unit_type = "definition"
            elif b.block_type == ContentBlockType.PROCESS_STEP:
                unit_type = "process"
            elif b.block_type == ContentBlockType.EXAMPLE:
                if not include_examples:
                    continue
                unit_type = "example"
            elif b.block_type == ContentBlockType.TABLE or b.table_data:
                unit_type = "table"
            elif b.has_equation:
                if not include_equations:
                    continue
                unit_type = "formula"
            elif b.block_type == ContentBlockType.LIST_ITEM:
                unit_type = "key_points"

            # Extract bullet points from text
            key_points: List[str] = []
            for line in lines:
                l_str = line.strip()
                if l_str.startswith(("-", "*", "•", "+", "➤", "➢", "■", "▪", "\u27a2", "\u2022")):
                    key_points.append(re.sub(r"^[-*+•➤➢■▪\u27a2\u2022]\s*", "", l_str).strip())
                elif re.match(r"^o\s+", l_str):
                    key_points.append(re.sub(r"^o\s+", "", l_str).strip())
                elif re.match(r"^\d+[\.\)]\s+", l_str):
                    key_points.append(re.sub(r"^\d+[\.\)]\s*", "", l_str).strip())
            if not key_points:
                # Clean sentence splitting avoiding decimal splits (3.2) and abbreviations (e.g., Dr.)
                raw_sentences = re.split(r'(?<=[.!?])\s+(?=[A-Z0-9])', text)
                sentences = [s.strip() for s in raw_sentences if len(s.strip()) > 15]
                key_points = sentences[:4] if sentences else [text[:140]]

            # Clean and normalize bullet points (turn multi-line "Term\nDefinition" into "Term: Definition")
            normalized_pts: List[str] = []
            for pt in key_points:
                p_lines = [pl.strip() for pl in pt.splitlines() if pl.strip()]
                clean_pt = ' '.join(p_lines)
                clean_pt = re.sub(r"^(?:[-*+•➤➢■▪o\u27a2\u2022\uf0b7]\s*)+", "", clean_pt).strip()
                if len(p_lines) >= 2 and len(p_lines[0]) <= 40 and not p_lines[0].endswith((".", ";", ":")):
                    clean_first = re.sub(r"^(?:[-*+•➤➢■▪o\u27a2\u2022\uf0b7]\s*)+", "", p_lines[0]).strip()
                    normalized_pts.append(f"{clean_first}: {' '.join(p_lines[1:])}")
                elif clean_pt:
                    normalized_pts.append(clean_pt)

            # Filter out empty or whitespace bullets
            key_points = [p for p in normalized_pts if p and len(p.strip()) > 2]
            if not key_points:
                continue

            # Derive unit title from pending heading or first line
            if pending_heading:
                unit_title = pending_heading[:65].strip()
                pending_heading = None
            else:
                first_sentence = re.split(r'[.:?!]\s+', first_line)[0].strip()
                if 5 <= len(first_sentence) <= 60:
                    unit_title = first_sentence
                elif len(first_line) <= 65:
                    unit_title = first_line
                else:
                    words = first_line[:65].rsplit(" ", 1)
                    unit_title = words[0].strip() if len(words) > 1 else first_line[:60].strip()

            if unit_type == "review_question":
                if re.match(r"^\d+[\.\)]\s+", first_line):
                    clean_q = re.sub(r"^\d+[\.\)]\s*", "", first_line)[:55]
                    unit_title = f"Question: {clean_q}"
                else:
                    unit_title = f"Review: {first_line[:55]}"
            elif unit_type == "definition":
                unit_title = f"Definition: {first_line.split(':')[0].strip()}"
            elif unit_type == "formula":
                unit_title = f"Mathematical Model: {first_line[:40]}"

            # Clean and sanitize unit title: strip bullet/arrow/number symbols
            unit_title = re.sub(r"^[o\-*+•➤➢■▪\u27a2\u2022\uf0b7\d\.\)\s]+", "", unit_title).strip()

            # Clean in-text figure reference preamble in titles
            if re.match(r"^(?:Figure|Fig\.)\s*\d+", unit_title, re.I):
                unit_title = re.sub(r"^(?:Figure|Fig\.)\s*\d+(?:\.\d+)*[:\.\-]?\s*", "", unit_title, flags=re.I).strip()
                for lead_v in ("shows ", "illustrates ", "depicts ", "is an example of ", "of ", "the "):
                    if unit_title.lower().startswith(lead_v):
                        unit_title = unit_title[len(lead_v):].strip()
                        break
                unit_title = unit_title[0].upper() + unit_title[1:] if unit_title else topic.title

            # If unit_title is a course/module label or empty, fallback to topic title
            if re.match(r"^(Internet of Things|BCS\d+|VTU|Dept of|Dr\s+|Module\s+[0-9IVX]+)", unit_title, re.I) or len(unit_title) < 5:
                unit_title = topic.title
            # If unit_title is a broken sentence fragment (starts with lowercase or preposition)
            if unit_title and (unit_title[0].islower() or unit_title.startswith(("and ", "that ", "is ", "in ", "of ", "to ", "with "))):
                unit_title = f"{topic.title}: Key Details"
            if len(unit_title) < 8 and b.block_type == ContentBlockType.LIST_ITEM:
                unit_title = f"{topic.title}: Core Elements"

            # Add figure reference indicator to title if figure is associated
            if fig_ref_label and fig_ref_label not in unit_title and unit_type == "diagram":
                unit_title = f"{unit_title} ({fig_ref_label})"

            # Eliminate trivial self-repeating unit where the only bullet repeats the title
            if len(key_points) == 1 and key_points[0].strip().lower() == unit_title.strip().lower():
                continue

            page_set = set(pending_pages + [b.page_number])
            if matched_fig_block:
                page_set.add(matched_fig_block.page_number)
            source_pages = sorted(list(page_set))
            pending_pages = []

            unit_id = f"unit_{unit_counter:04d}"
            units.append(
                ContentUnitDTO(
                    unit_id=unit_id,
                    topic_id=topic.topic_id,
                    title=unit_title,
                    unit_type=unit_type,
                    source_pages=source_pages,
                    key_points=key_points,
                    status=ContentUnitStatus.PLANNED,
                    confidence=b.confidence,
                    image_path=matched_fig_block.image_path if matched_fig_block else b.image_path,
                    caption=(matched_fig_block.caption if matched_fig_block else b.caption) or fig_ref_label,
                    figure_reference=fig_ref_label or b.figure_reference,
                    warnings=unit_warnings,
                )
            )
            unit_counter += 1

        return units

    def _allocate_topics_to_parts(
        self,
        topics: List[DiscoveredTopicDTO],
        content_units: List[ContentUnitDTO],
        slides_per_part: int,
        density: str,
        document_title: str,
    ) -> Tuple[List[PartPlanDTO], Optional[str], Optional[str]]:
        """Segment topics and content units into coherent presentations."""
        ratio = self.DENSITY_RATIOS[density]
        units_by_topic: Dict[str, List[ContentUnitDTO]] = {}
        for u in content_units:
            units_by_topic.setdefault(u.topic_id, []).append(u)

        # Overhead: Title slide (always 1) + Overview slide (if slides_per_part >= 6)
        overhead = 2 if slides_per_part >= 6 else 1
        max_content_slides = max(1, slides_per_part - overhead)

        # Content units capacity per part
        units_per_slide = 1.0 if density != "concise" else 1.5
        max_units_in_part = max(1, int(max_content_slides * units_per_slide))

        parts: List[PartPlanDTO] = []
        current_part_num = 1
        current_part_topic_ids: List[str] = []
        current_part_unit_ids: List[str] = []
        current_part_units_count = 0

        density_warning: Optional[str] = None
        recommended_adjustment: Optional[str] = None

        # Check overall document density feasibility
        estimated_total_slides = math.ceil(len(content_units) / units_per_slide) + len(topics) * 0.2
        if len(content_units) > max_units_in_part * 3 and slides_per_part <= 10:
            density_warning = (
                f"High Content Density Warning: The document contains {len(content_units)} content units. "
                f"With {slides_per_part} slides per part at '{density}' density, material will be heavily condensed."
            )
            recommended_adjustment = (
                f"Consider increasing slides per part to 20 or 25, or choosing 'Detailed' density for thorough coverage."
            )

        for topic in topics:
            t_units = units_by_topic.get(topic.topic_id, [])
            t_unit_count = len(t_units)
            if t_unit_count == 0:
                continue

            # If adding this topic exceeds part capacity and we already have topics in current part, start new part
            if current_part_units_count > 0 and (current_part_units_count + t_unit_count > max_units_in_part):
                # Close current part
                part_title = self._create_part_title(document_title, current_part_num, current_part_topic_ids, topics)
                planned_slides = min(slides_per_part, max(2, math.ceil(current_part_units_count / units_per_slide) + overhead))
                parts.append(
                    PartPlanDTO(
                        part_number=current_part_num,
                        title=part_title,
                        subtitle="Curriculum Lecture Notes",
                        target_slides=slides_per_part,
                        planned_slides=planned_slides,
                        topic_ids=list(current_part_topic_ids),
                        unit_ids=list(current_part_unit_ids),
                        is_final_part=False,
                    )
                )

                current_part_num += 1
                current_part_topic_ids = []
                current_part_unit_ids = []
                current_part_units_count = 0

            # If a single topic is massive (exceeds an entire part's capacity)
            if t_unit_count > max_units_in_part:
                # Split topic across consecutive parts
                chunks = self._chunk_list(t_units, max_units_in_part)
                for chunk_idx, chunk in enumerate(chunks):
                    if current_part_units_count > 0:
                        part_title = self._create_part_title(document_title, current_part_num, current_part_topic_ids, topics)
                        planned_slides = min(slides_per_part, max(2, math.ceil(current_part_units_count / units_per_slide) + overhead))
                        parts.append(
                            PartPlanDTO(
                                part_number=current_part_num,
                                title=part_title,
                                subtitle="Curriculum Lecture Notes",
                                target_slides=slides_per_part,
                                planned_slides=planned_slides,
                                topic_ids=list(current_part_topic_ids),
                                unit_ids=list(current_part_unit_ids),
                                is_final_part=False,
                            )
                        )
                        current_part_num += 1
                        current_part_topic_ids = []
                        current_part_unit_ids = []
                        current_part_units_count = 0

                    chunk_unit_ids = [u.unit_id for u in chunk]
                    cont_label = " (Cont.)" if chunk_idx > 0 else ""
                    part_title = f"{document_title} — Part {current_part_num}: {topic.title}{cont_label}"
                    planned_slides = min(slides_per_part, max(2, math.ceil(len(chunk) / units_per_slide) + overhead))
                    parts.append(
                        PartPlanDTO(
                            part_number=current_part_num,
                            title=part_title,
                            subtitle="Curriculum Lecture Notes",
                            target_slides=slides_per_part,
                            planned_slides=planned_slides,
                            topic_ids=[topic.topic_id],
                            unit_ids=chunk_unit_ids,
                            is_final_part=False,
                            continuation_from_part=(current_part_num - 1) if chunk_idx > 0 else None,
                        )
                    )
                    current_part_num += 1
            else:
                current_part_topic_ids.append(topic.topic_id)
                current_part_unit_ids.extend(u.unit_id for u in t_units)
                current_part_units_count += t_unit_count

        # Close final part
        if current_part_unit_ids or not parts:
            part_title = self._create_part_title(document_title, current_part_num, current_part_topic_ids, topics)
            # Allow shorter final part if remaining content concludes naturally
            planned_slides = min(slides_per_part, max(2, math.ceil(current_part_units_count / units_per_slide) + overhead)) if current_part_units_count > 0 else slides_per_part
            parts.append(
                PartPlanDTO(
                    part_number=current_part_num,
                    title=part_title,
                    subtitle="Curriculum Lecture Notes",
                    target_slides=slides_per_part,
                    planned_slides=planned_slides,
                    topic_ids=list(current_part_topic_ids),
                    unit_ids=list(current_part_unit_ids),
                    is_final_part=True,
                )
            )

        # Mark last part as final
        if parts:
            parts[-1].is_final_part = True

        # Assign part numbers to content units
        part_by_unit_id: Dict[str, int] = {}
        for p in parts:
            for u_id in p.unit_ids:
                part_by_unit_id[u_id] = p.part_number

        for u in content_units:
            u.assigned_part = part_by_unit_id.get(u.unit_id, 1)

        return parts, density_warning, recommended_adjustment

    def _create_part_title(
        self,
        doc_title: str,
        part_num: int,
        topic_ids: List[str],
        all_topics: List[DiscoveredTopicDTO]
    ) -> str:
        """Create informative presentation title with clear part numbers and topics."""
        # Clean title
        base_title = doc_title.replace(".pdf", "").replace(".docx", "").replace(".txt", "").strip()
        base_title = re.sub(r"^[0-9_\-]+", "", base_title).strip()
        base_title = base_title.replace("_", " ").title() or "Lecture Presentation"

        if not topic_ids:
            return f"{base_title} — Part {part_num}"

        matched_topics = [t for t in all_topics if t.topic_id in topic_ids]
        if matched_topics:
            focus_title = matched_topics[0].title
            return f"{base_title} — Part {part_num}: {focus_title}"

        return f"{base_title} — Part {part_num}"

    @staticmethod
    def _chunk_list(lst: List[Any], n: int) -> List[List[Any]]:
        """Yield successive n-sized chunks from lst."""
        if not lst:
            return []
        chunks = []
        for i in range(0, len(lst), n):
            chunks.append(lst[i:i + n])
        return chunks
