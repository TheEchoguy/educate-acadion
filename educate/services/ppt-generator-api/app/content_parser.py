"""
Deterministic educational notes parser for Acadion AI PPT Generator.
Converts raw text notes into structured PresentationData.
"""

from datetime import datetime
from pathlib import Path
import re
from typing import List, Optional, Tuple

from app.layouts import auto_select_theme
from app.models import (
    BulletPoint,
    ComparisonColumn,
    ComparisonData,
    ConceptMapData,
    ConceptMapNode,
    EmptyContentError,
    InputFileNotFoundError,
    InvalidContentError,
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


class ContentParser:
    """Parses educational text notes into structured presentation data using deterministic rules."""

    # Patterns for Markdown headings and numbered/styled headers
    RE_H1 = re.compile(r"^#\s+(.+)$")
    RE_H2 = re.compile(r"^##\s+(.+)$")
    RE_H3 = re.compile(r"^###\s+(.+)$")
    RE_BULLET = re.compile(r"^\s*[-*+•]\s+(.+)$")
    RE_NUMBERED_BULLET = re.compile(r"^\s*\d+[\.\)]\s+(.+)$")
    RE_DEFINITION = re.compile(r"^([^:\n]{2,45}):\s+(.+)$")

    INTRO_KEYWORDS = {"overview", "introduction", "intro", "background", "agenda"}
    SUMMARY_KEYWORDS = {"summary", "conclusion", "conclusions", "outlook", "future outlook", "takeaways", "wrap-up"}

    def parse_file(self, file_path: str | Path) -> PresentationData:
        """Parse notes from a local document file path (.txt, .pdf, or .docx).
        
        Raises:
            InputFileNotFoundError: If the file does not exist.
            EmptyContentError: If the file or extracted text is empty.
            InvalidContentError: If content cannot be parsed into valid structure.
            DocumentIngestionError: If file ingestion fails or limits are exceeded.
        """
        from app.document_loader import DocumentLoader
        loader = DocumentLoader()
        text, _ = loader.load(file_path)
        return self.parse_text(text)

    def parse_text(self, text: str) -> PresentationData:
        """Parse raw text notes into structured PresentationData."""
        if not text or not text.strip():
            raise EmptyContentError("Input notes are empty or contain only whitespace.")

        lines = [line.strip() for line in text.strip().splitlines()]
        # Remove trailing/leading empty lines
        while lines and not lines[0]:
            lines.pop(0)
        while lines and not lines[-1]:
            lines.pop()

        if not lines:
            raise EmptyContentError("Input notes contain no readable text.")

        title, subtitle, remaining_lines = self._extract_title_and_subtitle(lines)
        if not title:
            raise InvalidContentError("Could not determine a valid presentation title from input.")

        raw_sections = self._split_into_sections(remaining_lines)
        if not raw_sections:
            # Fallback: treat remaining lines as a single section under the title
            raw_sections = [("Key Points", remaining_lines)]

        parsed_sections: List[Section] = []
        for sec_title, sec_lines in raw_sections:
            section = self._parse_section(sec_title, sec_lines)
            if section.bullets or section.paragraphs:
                parsed_sections.append(section)

        if not parsed_sections:
            raise InvalidContentError("No content sections or bullet points could be extracted from notes.")

        # Classify sections semantically into overview, content, and conclusion
        overview_sec, content_secs, conclusion_sec = self._classify_sections(parsed_sections)

        today_str = datetime.now().strftime("%B %Y")
        theme = auto_select_theme(title, text)
        return PresentationData(
            title=title,
            subtitle=subtitle or "Educational Curriculum & Lecture Notes",
            institution="Acadion Learning",
            date_str=today_str,
            overview_section=overview_sec,
            content_sections=content_secs,
            conclusion_section=conclusion_sec,
            recommended_theme=theme,
            theme_rationale=f"Auto-selected based on curriculum topic: '{theme}'.",
            title_composition="editorial",
            overview_composition="agenda_flow",
            conclusion_composition="synthesis_takeaways",
        )

    def _extract_title_and_subtitle(self, lines: List[str]) -> Tuple[str, str, List[str]]:
        """Extract title and optional subtitle from the beginning of the text."""
        title = ""
        subtitle = ""
        idx = 0

        # Check if first non-empty line is H1 markdown
        first_line = lines[0]
        h1_match = self.RE_H1.match(first_line)
        if h1_match:
            title = h1_match.group(1).strip()
            idx = 1
        else:
            # First line without markdown prefix as title
            title = first_line.lstrip("#").strip()
            idx = 1

        # Check if next line is subtitle or metadata line
        if idx < len(lines):
            cand = lines[idx]
            # If candidate line is not empty and not an H2 section header or bullet
            if cand and not self.RE_H2.match(cand) and not self.RE_BULLET.match(cand) and not cand.startswith("##"):
                if cand.startswith("###"):
                    subtitle = cand.lstrip("#").strip()
                    idx += 1
                elif "—" in cand or "-" in cand or "Lecture" in cand or "Series" in cand or len(cand) < 90:
                    subtitle = cand.strip()
                    idx += 1

        return title, subtitle, lines[idx:]

    def _split_into_sections(self, lines: List[str]) -> List[Tuple[str, List[str]]]:
        """Split remaining lines into sections based on headers or block boundaries."""
        sections: List[Tuple[str, List[str]]] = []
        current_title: Optional[str] = None
        current_lines: List[str] = []

        for line in lines:
            if not line:
                continue

            h2_match = self.RE_H2.match(line)
            h3_match = self.RE_H3.match(line)

            # Check if line is a section header:
            # 1. Matches ## or ###
            # 2. Or is a standalone numbered heading like "1. Introduction" or "Section 1: ..."
            is_standalone_header = False
            numbered_header_match = re.match(r"^(?:Section\s+\d+[:\.]?|\d+[\.\)])\s+([A-Za-z].+)$", line)
            
            if h2_match:
                new_title = h2_match.group(1).strip()
            elif h3_match and current_title is None:
                new_title = h3_match.group(1).strip()
            elif numbered_header_match and not self.RE_BULLET.match(line):
                new_title = numbered_header_match.group(1).strip()
                is_standalone_header = True
            else:
                new_title = None

            if new_title:
                clean_title, step_lines = self._extract_multi_step_heading(new_title)
                if current_title is not None and current_lines:
                    sections.append((current_title, current_lines))
                current_title = clean_title
                current_lines = list(step_lines)
            else:
                if current_title is None:
                    # Content before the first explicit section header
                    current_title = "Introduction & Overview"
                current_lines.append(line)

        if current_title is not None and current_lines:
            sections.append((current_title, current_lines))

        return sections

    def _parse_section(self, title: str, lines: List[str]) -> Section:
        """Parse raw lines of a section into bullets, definitions, and paragraphs."""
        bullets: List[BulletPoint] = []
        paragraphs: List[str] = []
        speaker_notes_list: List[str] = []

        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue

            # Check for explicit teacher speaker notes
            sn_match = re.match(r"^(?:\[\s*Speaker\s+Notes\s*\]|Speaker\s+Notes:?|Notes:)\s*(.+)$", stripped, re.IGNORECASE)
            if sn_match:
                speaker_notes_list.append(sn_match.group(1).strip())
                continue

            # Check for bullet marker (- or * or •)
            b_match = self.RE_BULLET.match(stripped)
            n_match = self.RE_NUMBERED_BULLET.match(stripped)

            raw_bullet_text = None
            if b_match:
                raw_bullet_text = b_match.group(1).strip()
            elif n_match:
                raw_bullet_text = n_match.group(1).strip()

            if raw_bullet_text:
                # Check for definition or key:value split (e.g. "Term: Definition")
                def_match = self.RE_DEFINITION.match(raw_bullet_text)
                if def_match:
                    prefix = def_match.group(1).strip()
                    body = def_match.group(2).strip()
                    bullets.append(BulletPoint(text=body, prefix=prefix))
                else:
                    bullets.append(BulletPoint(text=raw_bullet_text))
            else:
                # Plain paragraph or note line
                # Check if this plain line is a key:value definition
                def_match = self.RE_DEFINITION.match(stripped)
                if def_match and len(stripped) < 200:
                    prefix = def_match.group(1).strip()
                    body = def_match.group(2).strip()
                    bullets.append(BulletPoint(text=body, prefix=prefix))
                else:
                    paragraphs.append(stripped)

        visual = self._detect_visual(title, bullets, paragraphs)
        composition = self._detect_composition(title, bullets, visual)
        speaker_notes = "\n".join(speaker_notes_list) if speaker_notes_list else ""
        obj = f"Analyze core concepts and operational mechanics of {title}."
        key_msg = bullets[0].display_text if bullets else title
        return Section(
            title=title,
            bullets=bullets,
            paragraphs=paragraphs,
            speaker_notes=speaker_notes,
            visual=visual,
            teaching_objective=obj,
            key_message=key_msg,
            composition_type=composition,
        )

    def _extract_multi_step_heading(self, raw_title: str) -> Tuple[str, List[str]]:
        """
        Detects if a heading contains multiple concatenated steps (e.g. '1. Ingestion 2. Analysis 3. Storage'
        or 'Pipeline Workflow: Step 1: Ingestion. Step 2: Processing. Step 3: Analysis').
        Returns (clean_title, extracted_step_lines).
        """
        step_pattern = re.compile(
            r"(?:^|(?<=\s))(?:(?:Step|Phase|Stage)\s*(\d+)[:\.]?|(\d+)[\.\)])\s*([^0-9\n]+?)(?=(?:\s+(?:(?:Step|Phase|Stage)\s*\d+[:\.]?|\d+[\.\)]))|\Z)",
            re.IGNORECASE
        )
        matches = list(step_pattern.finditer(raw_title))
        if len(matches) >= 2:
            first_match_start = matches[0].start()
            prefix_text = raw_title[:first_match_start].strip().rstrip(":-|–—")

            step_lines = []
            for m in matches:
                num = m.group(1) or m.group(2)
                desc = m.group(3).strip().rstrip(".,;")
                if ":" in desc:
                    step_prefix, step_body = desc.split(":", 1)
                    step_lines.append(f"- Step {num}: {step_prefix.strip()}: {step_body.strip()}")
                else:
                    step_lines.append(f"- Step {num}: {desc}")

            if prefix_text and len(prefix_text) >= 4:
                clean_title = prefix_text
            else:
                first_step_text = matches[0].group(3).split(":")[0].strip()
                last_step_text = matches[-1].group(3).split(":")[0].strip()
                clean_title = f"{first_step_text} to {last_step_text} Execution Pipeline"
                if len(clean_title) > 60:
                    clean_title = "System Execution & Process Workflow"

            return clean_title, step_lines

        return raw_title, []

    def _detect_composition(
        self,
        title: str,
        bullets: List[BulletPoint],
        visual: Optional[SlideVisual],
    ) -> str:
        """Deterministically determine the most pedagogical slide composition."""
        if visual and visual.visual_type != VisualType.NONE:
            return "visual"

        t_lower = title.lower()
        if any(w in t_lower for w in ("discussion", "question", "review", "exercise", "debate", "socratic")):
            return "discussion"
        if any(w in t_lower for w in ("case study", "application", "breakthrough", "empirical", "example", "real-world")):
            return "case_study"
        if any(w in t_lower for w in (" vs ", " versus ", "comparison", "contrasting")):
            return "two_column"
        if any(w in t_lower for w in ("pillar", "triad", "three-pillar", "3-pillar")):
            return "multi_column"
        if any(w in t_lower for w in ("architecture", "mechanic", "deep neural", "equation", "formula", "principle")):
            return "asymmetric"
        if any(w in t_lower for w in ("pipeline", "workflow", "stages", "step-by-step", "lifecycle", "chevrons", "process", "procedure")):
            return "process_chevrons"
        if len(bullets) >= 2 and all((b.prefix and any(b.prefix.lower().startswith(p) for p in ("step", "stage", "phase", "01", "02", "03", "1.", "2."))) for b in bullets):
            return "process_chevrons"

        # Check for stats / metrics
        stat_count = 0
        for b in bullets:
            if re.search(r"(\d+[%xXkKMmB]?|\d{4}|\b\d+[\-–]\w+)", b.prefix or b.text):
                stat_count += 1
        if stat_count >= 1 and any(w in t_lower for w in ("metric", "stat", "benchmark", "kpi", "scaling", "impact", "milestone")):
            return "kpi_metrics"
        if stat_count >= 2 and len(bullets) in (2, 3, 4):
            return "kpi_metrics"

        if len(bullets) == 2:
            return "two_column"
        if len(bullets) == 3:
            return "multi_column"
        if len(bullets) == 4:
            return "cards_grid"

        return "editorial"

    def _detect_visual(
        self,
        title: str,
        bullets: List[BulletPoint],
        paragraphs: List[str]
    ) -> Optional[SlideVisual]:
        """Deterministically infer if a section is well-suited for a native diagram."""
        lower_title = title.lower()

        # 1. Timeline Detection (e.g. Milestones, History, Evolution)
        if any(k in lower_title for k in ("milestone", "history", "timeline", "chronolog", "evolution")):
            milestones: List[TimelineMilestone] = []
            for b in bullets:
                # Check for year or date prefix like 1950, 2012, or Phase 1
                date_str = b.prefix if b.prefix else ""
                match = re.search(r"\b(19\d{2}|20\d{2}|Phase\s*\d+|Step\s*\d+)\b", date_str or b.text)
                if match:
                    d_val = match.group(1)
                    title_part = b.text.split(":")[0] if ":" in b.text else b.text[:35]
                    milestones.append(TimelineMilestone(
                        date_or_period=d_val,
                        title=title_part,
                        description=b.text,
                    ))
            if len(milestones) >= 2:
                return SlideVisual(
                    visual_type=VisualType.TIMELINE,
                    timeline=TimelineData(milestones=milestones[:5]),
                )

        # 2. Comparison Detection (e.g. X vs Y, Comparison)
        if " vs " in lower_title or " versus " in lower_title or "comparison" in lower_title:
            parts = re.split(r"\s+vs\.?\s+|\s+versus\s+", title, flags=re.IGNORECASE)
            left_name = parts[0].split(":")[-1].strip() if parts else "Entity A"
            right_name = parts[1].strip() if len(parts) > 1 else "Entity B"

            left_points: List[str] = []
            right_points: List[str] = []

            for b in bullets:
                text_lower = b.display_text.lower()
                if any(w in text_lower for w in left_name.lower().split()):
                    left_points.append(b.display_text)
                elif any(w in text_lower for w in right_name.lower().split()):
                    right_points.append(b.display_text)
                else:
                    if len(left_points) <= len(right_points):
                        left_points.append(b.display_text)
                    else:
                        right_points.append(b.display_text)

            if left_points and right_points:
                return SlideVisual(
                    visual_type=VisualType.COMPARISON,
                    comparison=ComparisonData(
                        left_column=ComparisonColumn(name=left_name, points=left_points[:4]),
                        right_column=ComparisonColumn(name=right_name, points=right_points[:4]),
                        takeaway=paragraphs[0] if paragraphs else "Compare both paradigms in architectural design.",
                    ),
                )

        # 3. Process Flowchart Detection (e.g. Process, Pipeline, Workflow, Lifecycle)
        if any(k in lower_title for k in ("process", "pipeline", "workflow", "lifecycle", "stages")):
            if len(bullets) >= 2:
                steps = [
                    ProcessStep(
                        step_number=i + 1,
                        title=b.prefix or f"Step {i + 1}",
                        description=b.text,
                    )
                    for i, b in enumerate(bullets[:5])
                ]
                return SlideVisual(
                    visual_type=VisualType.PROCESS_FLOW,
                    process_flow=ProcessFlowData(steps=steps),
                )

        # 4. Concept Map Detection (e.g. Subfields, Branches, Core Components)
        if any(k in lower_title for k in ("subfield", "branche", "component", "pillar", "ecosystem")):
            if len(bullets) >= 2:
                center = title.split(":")[-1].strip()
                branches = [
                    ConceptMapNode(
                        title=b.prefix or b.text[:30],
                        description=b.text,
                    )
                    for b in bullets[:4]
                ]
                return SlideVisual(
                    visual_type=VisualType.CONCEPT_MAP,
                    concept_map=ConceptMapData(center_concept=center, branches=branches),
                )

        return None

    def _classify_sections(
        self, sections: List[Section]
    ) -> Tuple[Optional[Section], List[Section], Optional[Section]]:
        """Classify sections into Overview, Content sections, and Conclusion."""
        overview_sec: Optional[Section] = None
        conclusion_sec: Optional[Section] = None
        content_secs: List[Section] = []

        for idx, sec in enumerate(sections):
            lower_title = sec.title.lower()

            # Check if this section is an introduction/overview (typically first section)
            if idx == 0 and any(kw in lower_title for kw in self.INTRO_KEYWORDS):
                sec.section_type = SectionType.INTRO_OVERVIEW
                overview_sec = sec
            # Check if this section is a conclusion/summary (typically last section)
            elif idx == len(sections) - 1 and any(kw in lower_title for kw in self.SUMMARY_KEYWORDS):
                sec.section_type = SectionType.SUMMARY_CONCLUSION
                conclusion_sec = sec
            else:
                sec.section_type = SectionType.CONTENT
                content_secs.append(sec)

        # If there's only 1 or 2 sections, ensure content_secs is not completely empty
        if not content_secs:
            if overview_sec and not conclusion_sec:
                content_secs.append(overview_sec)
                overview_sec = None
            elif conclusion_sec and not overview_sec:
                content_secs.append(conclusion_sec)
                conclusion_sec = None

        return overview_sec, content_secs, conclusion_sec
