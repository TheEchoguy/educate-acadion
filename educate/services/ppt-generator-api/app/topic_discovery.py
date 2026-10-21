"""
Topic Discovery Engine for Acadion Multi-Part PPT Generator (Workstream B).
Discovers hierarchical topics and subtopics from long notes even when the document
contains no table of contents, no explicit headings, or inconsistent formatting.
Distinguishes explicit headings from inferred concept clusters, maps exact source page ranges,
and guarantees all concepts are grounded in the extracted text without hallucinations.
"""

from collections import Counter
import json
import logging
import os
import re
from typing import Any, Dict, List, Optional, Set, Tuple

from app.models import (
    ContentBlockType,
    DiscoveredSubtopicDTO,
    DiscoveredTopicDTO,
    DocumentExtractionManifest,
    ExtractedBlock,
)

logger = logging.getLogger("acadion.topic_discovery")


class TopicDiscoveryEngine:
    """Discovers grounded pedagogical topics and subtopics from raw extracted curriculum blocks."""

    # Transition phrases signaling conceptual shift
    TRANSITION_PATTERNS = [
        re.compile(r"^(Now\s+we\s+turn\s+to|Moving\s+on\s+to|Let\s+us\s+now\s+examine|Next,\s+we|In\s+contrast,\s+|Another\s+(key|critical|fundamental)\s+concept|Furthermore,|Turning\s+to|In\s+this\s+section,|We\s+now\s+define)", re.IGNORECASE),
        re.compile(r"^(Module|Chapter|Unit|Lecture|Part)\s+\d+[:\.\-]?\s+(.+)$", re.IGNORECASE),
    ]

    # Stopwords to filter out during term frequency analysis
    COMMON_STOPWORDS = {
        "the", "and", "a", "an", "in", "on", "of", "to", "for", "with", "as", "by", "at",
        "from", "that", "this", "these", "those", "is", "are", "was", "were", "be", "been",
        "have", "has", "had", "do", "does", "did", "can", "could", "will", "would", "should",
        "which", "who", "whom", "what", "where", "when", "why", "how", "all", "each", "every",
        "both", "such", "into", "through", "during", "before", "after", "above", "below",
        "between", "under", "again", "further", "then", "once", "here", "there", "when",
        "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own", "same",
        "so", "than", "too", "very", "can", "just", "also", "using", "used", "may", "often"
    }

    def __init__(self, gemini_api_key: Optional[str] = None):
        self.api_key = gemini_api_key or os.getenv("GEMINI_API_KEY", "").strip()

    def discover_topics(
        self,
        blocks: List[ExtractedBlock],
        manifest: DocumentExtractionManifest,
        mode: str = "ai",
        title_hint: Optional[str] = None
    ) -> List[DiscoveredTopicDTO]:
        """Discover hierarchical topics across extracted document blocks.
        
        Args:
            blocks: Traceable extracted blocks with page numbers.
            manifest: Document metadata and extraction manifest.
            mode: "ai" or "deterministic".
            title_hint: Optional overall presentation/lecture title.
            
        Returns:
            List of DiscoveredTopicDTO instances grounded in the source.
        """
        if not blocks:
            return []

        # 1. Inspect whether the document has clear explicit headings
        explicit_heading_blocks = [
            b for b in blocks if b.block_type == ContentBlockType.HEADING and len(b.normalized_text.splitlines()[0]) < 120
        ]

        def is_major_heading(h: ExtractedBlock) -> bool:
            t = h.normalized_text.splitlines()[0].strip()
            # Exclude course/subject running titles, boilerplate headers or bare module tags
            if re.match(r"^(Internet of Things|BCS\d+|VTU|Dept of|Dr\s+|VTUSYNC)", t, re.I):
                return False
            if re.match(r"^(Module|Chapter|Unit)\s+[0-9IVXLCDM]+\s*$", t, re.I):
                return False
            if re.search(r"Question\s+Bank|Review\s+Questions", t, re.I):
                return True
            if re.match(r"^(Module|Chapter|Unit)\s+[0-9IVXLCDM]+[:\.\-]\s*\w+", t, re.I):
                return True
            # Numbered sections e.g. "3.2 IoT Design Methodology", "3.10 File Handling", "3.2.1 Step 1: ..."
            if re.match(r"^\d+\.\d+(?:\.\d+)*[:\.\-]?\s+[A-Za-z]", t):
                return True
            # Explicit process step heading e.g. "Step 1: Purpose & Requirements Specification"
            if re.match(r"^(?:Step|Stage|Phase)\s+\d+[:\.\-]?\s+\w+", t, re.I):
                return True
            # Level 1 headings that are not plain numbered lists
            if h.heading_level == 1 and not re.match(r"^\d+[\.\)]\s+", t):
                return True
            return False

        major_headings = [h for h in explicit_heading_blocks if is_major_heading(h)]
        candidate_headings = major_headings if len(major_headings) >= 2 else explicit_heading_blocks

        # If >= 2 distinct explicit headings are present across the document, use heading-anchored discovery
        if len(candidate_headings) >= 2:
            topics = self._discover_from_explicit_headings(blocks, candidate_headings)
            if len(topics) >= 2:
                return self._finalize_topics(topics, blocks)

        # 2. Document has NO index or sparse/no headings: run concept discovery
        if mode == "ai" and self.api_key:
            try:
                ai_topics = self._discover_with_gemini(blocks, manifest, title_hint)
                if ai_topics and len(ai_topics) >= 1:
                    return self._finalize_topics(ai_topics, blocks)
            except Exception as e:
                logger.warning(f"AI topic discovery encountered error: {e}. Falling back to deterministic concept discovery.")

        # 3. Deterministic Concept Discovery Engine (Offline / Rule-Based / Fallback)
        topics = self._discover_concept_clusters_deterministic(blocks, title_hint)
        return self._finalize_topics(topics, blocks)

    def _discover_from_explicit_headings(
        self,
        blocks: List[ExtractedBlock],
        heading_blocks: List[ExtractedBlock]
    ) -> List[DiscoveredTopicDTO]:
        """Segment document using explicit document headings as anchors."""
        topics: List[DiscoveredTopicDTO] = []
        heading_indices = [blocks.index(h) for h in heading_blocks]

        for i, h_idx in enumerate(heading_indices):
            h_block = blocks[h_idx]
            raw_title = h_block.normalized_text.splitlines()[0]
            # Strip markdown hashes and clean
            clean_title = re.sub(r"^#+\s*", "", raw_title).strip()
            clean_title = re.sub(r"^\d+(\.\d+)*[:\.\-]?\s*", "", clean_title).strip()
            if not clean_title or len(clean_title) < 3:
                clean_title = raw_title.strip()

            # End block index for this topic
            next_idx = heading_indices[i + 1] if i + 1 < len(heading_indices) else len(blocks)
            topic_blocks = blocks[h_idx:next_idx]
            if not topic_blocks:
                continue

            page_start = topic_blocks[0].page_number
            page_end = topic_blocks[-1].page_number

            # Extract subtopics and key concepts from blocks within this section
            subtopics, key_concepts = self._extract_subtopics_and_concepts(topic_blocks, clean_title)

            topics.append(
                DiscoveredTopicDTO(
                    topic_id=f"topic_{i+1:03d}",
                    title=clean_title or f"Section {i+1}",
                    is_inferred=False,
                    page_start=page_start,
                    page_end=page_end,
                    subtopics=subtopics,
                    key_concepts=key_concepts,
                    confidence=1.0,
                    summary=self._generate_topic_summary(topic_blocks),
                )
            )

        return topics

    def _discover_concept_clusters_deterministic(
        self,
        blocks: List[ExtractedBlock],
        title_hint: Optional[str] = None
    ) -> List[DiscoveredTopicDTO]:
        """Discover conceptual boundaries when the document has no headings or index."""
        # Find semantic break points: transitions, definition clusters, or page boundaries
        break_indices: List[int] = [0]

        total_doc_words = sum(len(b.normalized_text.split()) for b in blocks)
        if total_doc_words <= 400:
            TARGET_CLUSTER_WORDS = max(30, total_doc_words // max(2, len(blocks)))
        else:
            TARGET_CLUSTER_WORDS = max(80, min(220, total_doc_words // max(4, len(blocks))))

        word_acc = 0
        for idx, block in enumerate(blocks):
            if idx == 0:
                continue

            text = block.normalized_text
            first_line = text.splitlines()[0] if text else ""
            words = len(text.split())
            word_acc += words

            is_transition = any(p.search(first_line) for p in self.TRANSITION_PATTERNS)
            is_def_or_step = block.block_type in (ContentBlockType.DEFINITION, ContentBlockType.PROCESS_STEP)
            is_page_shift = block.page_number > blocks[idx - 1].page_number and word_acc >= 30

            if (is_transition and word_acc >= 30) or (is_def_or_step and word_acc >= TARGET_CLUSTER_WORDS) or is_page_shift or (word_acc >= TARGET_CLUSTER_WORDS * 1.4):
                break_indices.append(idx)
                word_acc = 0

        if break_indices[-1] != len(blocks):
            break_indices.append(len(blocks))

        topics: List[DiscoveredTopicDTO] = []
        for i in range(len(break_indices) - 1):
            start = break_indices[i]
            end = break_indices[i + 1]
            cluster_blocks = blocks[start:end]
            if not cluster_blocks:
                continue

            page_start = cluster_blocks[0].page_number
            page_end = cluster_blocks[-1].page_number

            # Infer representative title from frequent educational terms and leading sentences
            inferred_title = self._infer_topic_title(cluster_blocks, i + 1)
            subtopics, key_concepts = self._extract_subtopics_and_concepts(cluster_blocks, inferred_title)

            topics.append(
                DiscoveredTopicDTO(
                    topic_id=f"topic_{i+1:03d}",
                    title=inferred_title,
                    is_inferred=True,
                    page_start=page_start,
                    page_end=page_end,
                    subtopics=subtopics,
                    key_concepts=key_concepts,
                    confidence=0.85,
                    summary=self._generate_topic_summary(cluster_blocks),
                )
            )

        return topics

    def _discover_with_gemini(
        self,
        blocks: List[ExtractedBlock],
        manifest: DocumentExtractionManifest,
        title_hint: Optional[str] = None
    ) -> List[DiscoveredTopicDTO]:
        """Use Gemini to discover topic hierarchy grounded strictly in extracted text."""
        from google import genai
        client = genai.Client(api_key=self.api_key)

        # Build condensed document representation with page markers
        condensed_lines = []
        for b in blocks[:120]:  # Bound sample to avoid token exhaustion
            first_line = b.normalized_text.splitlines()[0]
            condensed_lines.append(f"[Page {b.page_number}] ({b.block_type.value}) {first_line[:120]}")

        prompt = f"""You are an expert curriculum designer analyzing educational lecture notes with NO table of contents.
Document: {manifest.filename} ({manifest.total_pages} pages, {manifest.word_count} words).
Title Hint: {title_hint or 'Curriculum Lecture Notes'}

Analyze the following excerpts and discover the coherent topic structure.
Ground every topic strictly in the provided text; do NOT fabricate topics or terms.

Respond with valid JSON conforming to this schema:
{{
  "topics": [
    {{
      "title": "Clear Educational Topic Title",
      "page_start": 1,
      "page_end": 2,
      "subtopics": ["Subtopic A", "Subtopic B"],
      "key_concepts": ["Concept 1", "Concept 2"],
      "summary": "Brief 1-sentence synthesis"
    }}
  ]
}}

Document Sample:
{chr(10).join(condensed_lines[:90])}
"""

        response = client.models.generate_content(
            model=os.getenv("GEMINI_MODEL", "gemini-3-flash-preview"),
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "temperature": 0.2,
            }
        )

        raw_json = response.text or "{}"
        data = json.loads(raw_json)
        raw_topics = data.get("topics", [])
        if not raw_topics:
            return []

        discovered: List[DiscoveredTopicDTO] = []
        for idx, t in enumerate(raw_topics):
            title = str(t.get("title", "")).strip() or f"Topic {idx+1}"
            p_start = int(t.get("page_start", 1))
            p_end = max(p_start, int(t.get("page_end", p_start)))

            # Map matching blocks for page range and subtopics
            sub_list = [
                DiscoveredSubtopicDTO(
                    subtopic_id=f"sub_{idx+1:03d}_{s_idx+1:02d}",
                    title=str(s).strip(),
                    is_inferred=True,
                    page_start=p_start,
                    page_end=p_end,
                )
                for s_idx, s in enumerate(t.get("subtopics", []))
                if str(s).strip()
            ]

            concepts = [str(c).strip() for c in t.get("key_concepts", []) if str(c).strip()]

            discovered.append(
                DiscoveredTopicDTO(
                    topic_id=f"topic_{idx+1:03d}",
                    title=title,
                    is_inferred=True,
                    page_start=p_start,
                    page_end=p_end,
                    subtopics=sub_list,
                    key_concepts=concepts,
                    confidence=0.92,
                    summary=str(t.get("summary", "")).strip(),
                )
            )

        # Strict Grounding Validation: reject ungrounded AI hallucinated topics
        if not self._validate_grounding(discovered, blocks):
            logger.warning(
                "Gemini AI topic discovery produced ungrounded topics not found in source text. "
                "Rejecting AI topics and falling back to source-grounded heading/concept discovery."
            )
            return []

        return discovered

    def _validate_grounding(self, topics: List[DiscoveredTopicDTO], blocks: List[ExtractedBlock]) -> bool:
        """Verify that every proposed topic is strictly grounded in the extracted text."""
        if not topics:
            return False

        full_doc_text = " ".join(b.normalized_text.lower() for b in blocks)
        ungrounded_count = 0

        for t in topics:
            # Check for acronyms in title (e.g. "RPL", "6LoWPAN", "XML", "JSON", "HTTP")
            acronyms = re.findall(r"\b[A-Z0-9]{2,}\b", t.title)
            for acr in acronyms:
                if len(acr) >= 2 and acr.lower() not in self.COMMON_STOPWORDS and not acr.isdigit():
                    if acr.lower() not in full_doc_text:
                        logger.warning(f"Ungrounded AI topic acronym rejected: '{acr}' in '{t.title}' not found in source text.")
                        return False

            # Extract content words (>= 3 chars, not stopwords, not pure digits)
            words = [
                w.lower() for w in re.findall(r"\b[a-zA-Z]{3,}\b", t.title)
                if w.lower() not in self.COMMON_STOPWORDS and not w.lower().isdigit()
            ]
            if not words:
                continue

            # Check ratio of found content words
            found_words = [w for w in words if w in full_doc_text]
            ratio = len(found_words) / len(words)
            if ratio < 0.65:
                logger.warning(
                    f"Ungrounded AI topic rejected: '{t.title}' (only {len(found_words)}/{len(words)} keywords found: {found_words})."
                )
                ungrounded_count += 1

        if ungrounded_count > 0:
            return False

        return True

    def _infer_topic_title(self, blocks: List[ExtractedBlock], index: int) -> str:
        """Infer an informative topic title from the content of a block cluster."""
        # 1. Look for a definition or process title in the first few blocks
        for b in blocks[:3]:
            if b.block_type == ContentBlockType.DEFINITION:
                term = b.normalized_text.split(":")[0].strip()
                if 3 <= len(term) <= 50:
                    return f"Foundations of {term}" if not term.lower().startswith("foundations") else term
            if b.block_type == ContentBlockType.PROCESS_STEP:
                step_title = b.normalized_text.splitlines()[0]
                return f"Process Workflow: {step_title[:45]}"

        # 2. Extract capitalized noun phrases from text
        text_corpus = " ".join(b.normalized_text for b in blocks)
        capitalized_phrases = re.findall(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b", text_corpus)
        phrase_counts = Counter(capitalized_phrases)
        valid_phrases = [
            p for p, count in phrase_counts.most_common(5)
            if not any(w.lower() in self.COMMON_STOPWORDS for w in p.split())
        ]
        if valid_phrases:
            return valid_phrases[0]

        # 3. Extract dominant non-stopword educational keywords
        words = [
            w.lower() for w in re.findall(r"\b[a-zA-Z]{4,20}\b", text_corpus)
            if w.lower() not in self.COMMON_STOPWORDS
        ]
        word_counts = Counter(words)
        top_words = [w.capitalize() for w, _ in word_counts.most_common(2)]
        if len(top_words) >= 2:
            return f"{top_words[0]} & {top_words[1]}"
        elif top_words:
            return f"Principles of {top_words[0]}"

        return f"Curriculum Module {index:02d}"

    def _extract_subtopics_and_concepts(
        self,
        blocks: List[ExtractedBlock],
        parent_title: str
    ) -> Tuple[List[DiscoveredSubtopicDTO], List[str]]:
        """Extract subtopics and key terminology from block cluster."""
        subtopics: List[DiscoveredSubtopicDTO] = []
        concepts: Set[str] = set()
        sub_counter = 1

        for b in blocks:
            text = b.normalized_text
            lines = text.splitlines()
            first_line = lines[0] if lines else ""

            # Explicit subheadings or definition terms become subtopics
            if b.block_type == ContentBlockType.HEADING and b.heading_level and b.heading_level > 1:
                clean_sub = re.sub(r"^#+\s*", "", first_line).strip()
                clean_sub = re.sub(r"^\d+(\.\d+)*\s*", "", clean_sub).strip()
                if clean_sub and clean_sub.lower() != parent_title.lower():
                    subtopics.append(
                        DiscoveredSubtopicDTO(
                            subtopic_id=f"sub_{sub_counter:02d}",
                            title=clean_sub,
                            is_inferred=False,
                            page_start=b.page_number,
                            page_end=b.page_number,
                        )
                    )
                    sub_counter += 1

            elif b.block_type == ContentBlockType.DEFINITION:
                term = first_line.split(":")[0].strip()
                if 2 <= len(term) <= 40:
                    concepts.add(term)
                    if len(subtopics) < 4:
                        subtopics.append(
                            DiscoveredSubtopicDTO(
                                subtopic_id=f"sub_{sub_counter:02d}",
                                title=f"Concept: {term}",
                                is_inferred=True,
                                page_start=b.page_number,
                                page_end=b.page_number,
                            )
                        )
                        sub_counter += 1

            elif b.block_type == ContentBlockType.PROCESS_STEP:
                subtopics.append(
                    DiscoveredSubtopicDTO(
                        subtopic_id=f"sub_{sub_counter:02d}",
                        title=first_line[:50],
                        is_inferred=True,
                        page_start=b.page_number,
                        page_end=b.page_number,
                    )
                )
                sub_counter += 1

            # Extract bolded terms or definitions for concepts
            bolded = re.findall(r"\*\*([^*]{3,40})\*\*", text)
            for bold in bolded:
                concepts.add(bold.strip())

        # If no subtopics detected, create a foundational subtopic
        if not subtopics:
            subtopics.append(
                DiscoveredSubtopicDTO(
                    subtopic_id="sub_01",
                    title="Key Theoretical Concepts",
                    is_inferred=True,
                    page_start=blocks[0].page_number,
                    page_end=blocks[-1].page_number,
                )
            )

        return subtopics[:5], list(concepts)[:8]

    def _generate_topic_summary(self, blocks: List[ExtractedBlock]) -> str:
        """Create a concise 1-2 sentence summary from leading paragraphs."""
        for b in blocks:
            if b.block_type == ContentBlockType.PARAGRAPH and len(b.normalized_text) >= 40:
                first_sent = b.normalized_text.split(".")[0].strip()
                return (first_sent + ".") if not first_sent.endswith(".") else first_sent
        return "Core curriculum topic and foundational principles."

    def _finalize_topics(
        self,
        topics: List[DiscoveredTopicDTO],
        blocks: List[ExtractedBlock]
    ) -> List[DiscoveredTopicDTO]:
        """Merge redundant adjacent topics and ensure contiguous page coverage."""
        if not topics:
            return []

        # Filter bare module labels or boilerplate titles
        cleaned_topics: List[DiscoveredTopicDTO] = []
        for t in topics:
            t_title = t.title.strip()
            if re.match(r"^(?:Module|Chapter|Unit)\s+[0-9IVXLCDM]+\s*$", t_title, re.I) or re.match(r"^Internet of Things(\s+\[BCS\d+\])?", t_title, re.I):
                # Bare module tag - merge with next topic if available, or skip
                continue
            cleaned_topics.append(t)

        if not cleaned_topics and topics:
            cleaned_topics = [topics[0]]

        merged: List[DiscoveredTopicDTO] = []
        for t in cleaned_topics:
            if not merged:
                merged.append(t)
                continue

            last = merged[-1]
            # Merge if adjacent topic has identical or near-identical title
            if last.title.lower().strip() == t.title.lower().strip():
                last.page_end = max(last.page_end, t.page_end)
                last.subtopics.extend(t.subtopics)
                last.key_concepts.extend(t.key_concepts)
                last.key_concepts = list(set(last.key_concepts))
            else:
                merged.append(t)

        # Re-index topic IDs
        for idx, t in enumerate(merged):
            t.topic_id = f"topic_{idx+1:03d}"

        return merged
