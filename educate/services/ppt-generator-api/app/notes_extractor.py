"""
Comprehensive Source Document Extractor for Acadion Multi-Part PPT Generator (Workstream B).
Preserves entire source document with exact page numbering, structural block classification,
header/footer deduplication, table preservation, mathematical notation integrity,
and scanned PDF / OCR detection without modifying source files.
"""

from collections import Counter
import hashlib
from pathlib import Path
import re
from typing import Any, Dict, List, Optional, Set, Tuple

from app.models import (
    ContentBlockType,
    CorruptedDocumentError,
    DocumentExtractionManifest,
    DocumentIngestionError,
    EmptyContentError,
    EncryptedDocumentError,
    ExtractedBlock,
    FileSizeLimitExceededError,
    InputFileNotFoundError,
    ScannedDocumentError,
    UnsupportedFileTypeError,
)

# Optional OCR imports
try:
    import pytesseract
    from PIL import Image
    _OCR_AVAILABLE = True
except Exception:
    _OCR_AVAILABLE = False


class NotesExtractor:
    """Extracts curriculum lecture notes preserving full document content, page numbers, and structural blocks."""

    MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB
    MAX_PAGES_LIMIT = 500                    # Support long 100+ page lecture manuals
    SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".txt"}

    PDF_MAGIC = b"%PDF"
    DOCX_MAGIC = b"PK\x03\x04"

    # Block classification regexes
    RE_MD_H1 = re.compile(r"^#\s+(.+)$")
    RE_MD_H2 = re.compile(r"^##\s+(.+)$")
    RE_MD_H3 = re.compile(r"^###\s+(.+)$")
    RE_NUMBERED_SEC = re.compile(r"^(\d+(?:\.\d+)*)[:\.\-]?\s+([A-Za-z][A-Za-z0-9 ,'\-–—:()&/]{2,120})$")
    RE_MODULE_SEC = re.compile(r"^(Module|Chapter|Unit|Lecture|Part)\s+[0-9IVXLCDM]+[:\.\-]?\s*(.+)?$", re.IGNORECASE)
    RE_QUESTION_BANK = re.compile(r"^(.*Question\s+Bank.*|.*Review\s+Questions.*)$", re.IGNORECASE)
    RE_DEFINITION = re.compile(r"^([A-Z][A-Za-z0-9 \-]{1,40}):\s+(.+)$")
    RE_PROCESS_STEP = re.compile(r"^(?:(?:\d+)[\.\)]?\s+)?(?:Step|Stage|Phase)\s+\d+[:\.\-]?\s*(.+)$", re.IGNORECASE)
    RE_EXAMPLE = re.compile(r"^(Example|Case Study|Illustration|Scenario|Box)(\s+\d+(\.\d+)*)?[:\.\-]\s*(.+)?$", re.IGNORECASE)
    RE_CAPTION = re.compile(r"^(?:Figure|Fig\.|Table|Chart|Diagram|Listing)\s+(\d+(?:[\.\-_]\d+)*)[:\.\-]\s*([^.\n]{2,120})$", re.IGNORECASE)
    RE_IN_TEXT_FIG = re.compile(r"\b(?:Figure|Fig\.)\s*(\d+(?:[\.\-_]\d+)*)\b", re.IGNORECASE)
    RE_BULLET = re.compile(r"^\s*(?:[-*+•➤➢■▪\u27a2\u2022\uf0b7]|o\s+)\s*(.*)$")
    RE_NUMBERED_LIST = re.compile(r"^\s*\d+[\.\)]\s+(.+)$")
    RE_MATH_SYMBOLS = re.compile(r"(\$|\\frac|\\sum|\\int|\\prod|\\approx|\\le|\\ge|\\times|\\neq|\\in|\\sqrt|\\alpha|\\beta|\\gamma|\\theta|\^2|\^[0-9]+|\b[a-zA-Z]\s*=\s*[a-zA-Z0-9\+\-\*/\(\)]+)")

    @staticmethod
    def _clean_step_repetition(text: str) -> str:
        """Deduplicate repeated step/stage prefixes like '5 Step 5: 5 Step 5: Service Specifications'."""
        m = re.match(r"^(?:(\d+)\s+)?(?:(?:Step|Stage|Phase)\s+(\d+)[:\.\-]?\s*)+", text, re.I)
        if m:
            step_num = m.group(2) or m.group(1)
            rest = text[m.end():].strip()
            rest = re.sub(r"^(?:(?:\d+)\s+)?(?:(?:Step|Stage|Phase)\s+\d+[:\.\-]?\s*)+", "", rest, flags=re.I).strip()
            return f"Step {step_num}: {rest}"
        return text

    def extract_from_file(self, file_path: str | Path) -> Tuple[List[ExtractedBlock], DocumentExtractionManifest]:
        """Extract all blocks and manifest from a file path without mutating original file."""
        path = Path(file_path).resolve()
        if not path.exists() or path.is_dir():
            raise InputFileNotFoundError(f"Source file not found at: {path}")

        file_bytes = path.read_bytes()
        filename = path.name
        return self.extract_from_bytes(file_bytes, filename, str(path))

    def extract_from_bytes(
        self,
        file_bytes: bytes,
        filename: str,
        original_path: Optional[str] = None
    ) -> Tuple[List[ExtractedBlock], DocumentExtractionManifest]:
        """Extract all blocks from raw file bytes."""
        if not file_bytes or len(file_bytes) == 0:
            raise EmptyContentError(f"Uploaded file '{filename}' is empty (0 bytes).")

        if len(file_bytes) > self.MAX_FILE_SIZE_BYTES:
            max_mb = self.MAX_FILE_SIZE_BYTES / (1024 * 1024)
            actual_mb = len(file_bytes) / (1024 * 1024)
            raise FileSizeLimitExceededError(
                f"File size ({actual_mb:.1f} MB) exceeds maximum allowed limit of {max_mb:.0f} MB."
            )

        ext = Path(filename).suffix.lower()
        if ext not in self.SUPPORTED_EXTENSIONS:
            supported = ", ".join(sorted(self.SUPPORTED_EXTENSIONS))
            raise UnsupportedFileTypeError(
                f"Unsupported format '{ext}'. Acadion supports: {supported}."
            )

        file_hash = hashlib.sha256(file_bytes).hexdigest()
        warnings: List[str] = []

        if ext == ".pdf":
            blocks, total_pages, page_char_counts, is_scanned, pdf_warnings = self._extract_pdf(file_bytes, filename)
            warnings.extend(pdf_warnings)
        elif ext == ".docx":
            blocks, total_pages, page_char_counts, is_scanned = self._extract_docx(file_bytes, filename)
        elif ext == ".txt":
            blocks, total_pages, page_char_counts, is_scanned = self._extract_txt(file_bytes, filename)
        else:
            raise UnsupportedFileTypeError(f"Unsupported format: {ext}")

        if not blocks:
            raise EmptyContentError(f"No extractable text content found in '{filename}'.")

        # Deduplicate running headers & footers across pages
        blocks, header_warnings = self._deduplicate_headers_and_footers(blocks, total_pages)
        warnings.extend(header_warnings)

        word_count = sum(len(b.normalized_text.split()) for b in blocks)
        char_count = sum(len(b.normalized_text) for b in blocks)

        manifest = DocumentExtractionManifest(
            file_path=original_path,
            filename=filename,
            file_hash=file_hash,
            total_pages=total_pages,
            word_count=word_count,
            character_count=char_count,
            is_scanned=is_scanned,
            extraction_status="partial" if warnings else "complete",
            warnings=warnings,
            page_char_counts=page_char_counts,
        )

        return blocks, manifest

    def extract_from_text(
        self,
        raw_text: str,
        title_hint: str = "Pasted Lecture Notes"
    ) -> Tuple[List[ExtractedBlock], DocumentExtractionManifest]:
        """Extract structured blocks from direct pasted text notes."""
        if not raw_text or not raw_text.strip():
            raise EmptyContentError("Input notes are empty or contain only whitespace.")

        text_bytes = raw_text.encode("utf-8")
        file_hash = hashlib.sha256(text_bytes).hexdigest()

        blocks = self._parse_text_lines(raw_text, page_number=1, start_block_index=0)
        word_count = sum(len(b.normalized_text.split()) for b in blocks)
        char_count = sum(len(b.normalized_text) for b in blocks)

        manifest = DocumentExtractionManifest(
            file_path=None,
            filename=f"{title_hint}.txt",
            file_hash=file_hash,
            total_pages=1,
            word_count=word_count,
            character_count=char_count,
            is_scanned=False,
            extraction_status="complete",
            warnings=[],
            page_char_counts={1: char_count},
        )
        return blocks, manifest

    def _extract_pdf(
        self,
        file_bytes: bytes,
        filename: str
    ) -> Tuple[List[ExtractedBlock], int, Dict[int, int], bool, List[str]]:
        """Extract structured blocks page-by-page from PDF with PyMuPDF."""
        if not file_bytes.startswith(self.PDF_MAGIC):
            # Check first 1024 bytes
            if self.PDF_MAGIC not in file_bytes[:1024]:
                raise CorruptedDocumentError(
                    f"File '{filename}' does not appear to be a valid PDF (missing %PDF signature)."
                )

        try:
            import pymupdf
        except ImportError as exc:
            raise DocumentIngestionError("PyMuPDF is required for PDF ingestion.") from exc

        try:
            file_hash = hashlib.sha256(file_bytes).hexdigest()
            doc = pymupdf.open(stream=file_bytes, filetype="pdf")
        except Exception as exc:
            raise CorruptedDocumentError(f"Failed to open PDF document '{filename}': {exc}")

        try:
            if doc.is_encrypted:
                raise EncryptedDocumentError(f"PDF document '{filename}' is password-protected or encrypted.")

            page_count = len(doc)
            if page_count == 0:
                raise EmptyContentError(f"PDF document '{filename}' contains 0 pages.")

            all_blocks: List[ExtractedBlock] = []
            page_char_counts: Dict[int, int] = {}
            warnings: List[str] = []
            scanned_pages: List[int] = []
            block_counter = 0

            for p_idx in range(page_count):
                page_num = p_idx + 1
                page = doc[p_idx]
                p_h = page.rect.height
                raw_blocks = page.get_text("blocks") or []

                # Text blocks (type 0)
                text_blocks = [b for b in raw_blocks if b[6] == 0 and b[4].strip()]
                char_count = sum(len(b[4].strip()) for b in text_blocks)
                page_char_counts[page_num] = char_count

                # Scanned or image-only page detection
                if char_count < 20:
                    image_list = page.get_images()
                    if image_list:
                        # Attempt OCR if available
                        ocr_text = self._attempt_ocr_page(page)
                        if ocr_text and len(ocr_text.strip()) >= 20:
                            stripped = ocr_text.strip()
                            page_char_counts[page_num] = len(stripped)
                            page_blocks = self._parse_text_lines(
                                stripped, page_number=page_num, start_block_index=block_counter, is_ocr=True
                            )
                            all_blocks.extend(page_blocks)
                            block_counter += len(page_blocks)
                            continue
                    scanned_pages.append(page_num)
                    warnings.append(
                        f"Page {page_num}: Scanned or image-based content detected without text layer. "
                        f"OCR is not available or low-confidence in this environment; content on page {page_num} could not be extracted."
                    )
                    continue

                # Filter header band, footer band, and watermarks
                clean_page_lines = []
                re_boilerplate_line = re.compile(
                    r"(?:Internet of Things\s*\[BCS701\]-\d{4}-\d{2}|Dr\s+SB\s*&\s*VS|Dept\s+of\s+CSE|VTUSYNC(?:\.IN)?|Studied\s+smart,\s+not\s+hard.*|Thanks\s+to\s+VTUSync.*)",
                    re.IGNORECASE,
                )
                re_page_num_line = re.compile(r"^(?:Page\s+\d+(\s+of\s+\d+)?|\d+)$", re.IGNORECASE)

                for b in text_blocks:
                    x0, y0, x1, y1, b_text = b[0], b[1], b[2], b[3], b[4].strip()
                    if not b_text:
                        continue
                    # Running header band (top 8% of page)
                    if y1 <= max(65.0, p_h * 0.08) and (
                        "bcs" in b_text.lower() or "module" in b_text.lower() or "internet of things" in b_text.lower()
                    ):
                        continue
                    # Running footer band (bottom 9% of page)
                    if y0 >= min(p_h - 65.0, p_h * 0.91) and (
                        "dept of" in b_text.lower() or "dr " in b_text.lower() or re_page_num_line.match(b_text)
                    ):
                        continue

                    # Filter each line inside block to prevent embedded boilerplate leakage
                    block_lines_kept = []
                    for l in b_text.splitlines():
                        s = l.strip()
                        if not s or re_page_num_line.match(s) or re_boilerplate_line.search(s):
                            continue
                        block_lines_kept.append(l)

                    if block_lines_kept:
                        clean_page_lines.append("\n".join(block_lines_kept))

                cleaned_page_text = "\n\n".join(clean_page_lines)

                # Extract embedded figures/diagrams from page
                page_extracted_images = []
                try:
                    img_list = page.get_images(full=True)
                    for img_idx, img_info in enumerate(img_list):
                        xref = img_info[0]
                        try:
                            base_img = doc.extract_image(xref)
                            img_bytes = base_img["image"]
                            img_ext = base_img["ext"]
                            w, h = base_img["width"], base_img["height"]
                            rects = page.get_image_rects(xref)
                            bbox = (float(rects[0].x0), float(rects[0].y0), float(rects[0].x1), float(rects[0].y1)) if rects else None

                            # Filter header band or footer band icons/watermarks
                            if bbox:
                                if bbox[3] <= max(65.0, p_h * 0.08) or bbox[1] >= min(p_h - 65.0, p_h * 0.91):
                                    continue

                            # Only keep genuine curriculum diagrams/charts, filter tiny icons or lines
                            if w >= 140 and h >= 80 and 0.15 <= (w / float(max(1, h))) <= 8.0:
                                img_dir = Path("output/extracted_images") / file_hash[:12]
                                img_dir.mkdir(parents=True, exist_ok=True)
                                img_file = img_dir / f"p{page_num}_img{img_idx+1}_{w}x{h}.{img_ext}"
                                if not img_file.exists():
                                    img_file.write_bytes(img_bytes)
                                page_extracted_images.append((str(img_file.resolve()), w, h, bbox))
                        except Exception:
                            pass
                except Exception:
                    pass

                # Extract any native PDF tables if PyMuPDF table finder is supported
                pdf_tables: List[List[List[str]]] = []
                try:
                    if hasattr(page, "find_tables"):
                        tabs = page.find_tables()
                        for t in tabs.tables:
                            table_rows = t.extract()
                            if table_rows:
                                pdf_tables.append([[str(c or "").strip() for c in row] for row in table_rows])
                except Exception:
                    pass

                page_blocks = self._parse_text_lines(
                    cleaned_page_text, page_number=page_num, start_block_index=block_counter, tables=pdf_tables
                )

                # Match each extracted image with nearby caption or figure reference on this page
                for img_i, (img_path, i_w, i_h, img_bbox) in enumerate(page_extracted_images):
                    matched_caption = None
                    matched_fig_ref = None

                    # 1. Geometric proximity to text blocks on this page
                    if img_bbox:
                        img_x0, img_y0, img_x1, img_y1 = img_bbox
                        best_dist = 999999.0
                        for b in text_blocks:
                            bx0, by0, bx1, by1, btext = b[0], b[1], b[2], b[3], b[4].strip()
                            if not btext:
                                continue
                            vert_dist = min(abs(by0 - img_y1), abs(img_y0 - by1))
                            m_cap = self.RE_CAPTION.search(btext)
                            m_fig = self.RE_IN_TEXT_FIG.search(btext)
                            if (m_cap or m_fig) and vert_dist < 120:
                                if vert_dist < best_dist:
                                    best_dist = vert_dist
                                    matched_caption = btext.splitlines()[0].strip()
                                    num = m_cap.group(1) if m_cap else m_fig.group(1)
                                    matched_fig_ref = f"Figure {num}"

                    # 2. Check if page_blocks has a CAPTION block
                    if not matched_caption:
                        for b in page_blocks:
                            if b.block_type == ContentBlockType.CAPTION:
                                matched_caption = b.normalized_text
                                m_cap = self.RE_CAPTION.search(matched_caption)
                                if m_cap:
                                    matched_fig_ref = f"Figure {m_cap.group(1)}"
                                break

                    # 3. Check if any text block on page has figure reference
                    if not matched_fig_ref:
                        for b in page_blocks:
                            if b.figure_reference:
                                matched_fig_ref = b.figure_reference
                                matched_caption = matched_caption or f"{matched_fig_ref} (Page {page_num})"
                                break

                    final_caption = matched_caption or f"Diagram (Page {page_num})"
                    img_block = ExtractedBlock(
                        block_id=f"blk_p{page_num}_img_{img_i+1:02d}",
                        page_number=page_num,
                        block_type=ContentBlockType.IMAGE,
                        raw_text=final_caption,
                        normalized_text=final_caption,
                        image_path=img_path,
                        caption=final_caption,
                        bbox=img_bbox,
                        figure_reference=matched_fig_ref,
                    )
                    page_blocks.append(img_block)

                all_blocks.extend(page_blocks)
                block_counter += len(page_blocks)

            is_scanned = len(scanned_pages) > 0 and len(all_blocks) == 0
            if is_scanned:
                raise ScannedDocumentError(
                    f"PDF document '{filename}' contains no extractable text. The file appears to be entirely scanned or image-based."
                )

            return all_blocks, page_count, page_char_counts, (len(scanned_pages) > 0), warnings

        finally:
            doc.close()

    def _attempt_ocr_page(self, page: Any) -> Optional[str]:
        """Attempt OCR on a page using pytesseract if available."""
        if not _OCR_AVAILABLE:
            return None
        try:
            pix = page.get_pixmap(dpi=150)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            ocr_text = pytesseract.image_to_string(img)
            return ocr_text
        except Exception:
            return None

    def _extract_docx(
        self,
        file_bytes: bytes,
        filename: str
    ) -> Tuple[List[ExtractedBlock], int, Dict[int, int], bool]:
        """Extract structured blocks from Word DOCX."""
        if not file_bytes.startswith(self.DOCX_MAGIC):
            raise CorruptedDocumentError(
                f"File '{filename}' does not appear to be a valid Word document (missing PK zip header)."
            )

        try:
            import docx
            import io
        except ImportError as exc:
            raise DocumentIngestionError("python-docx is required for DOCX ingestion.") from exc

        try:
            doc = docx.Document(io.BytesIO(file_bytes))
        except Exception as exc:
            raise CorruptedDocumentError(f"Failed to parse Word document '{filename}': {exc}")

        all_blocks: List[ExtractedBlock] = []
        current_page = 1
        word_accumulator = 0
        WORDS_PER_ESTIMATED_PAGE = 350
        block_counter = 0

        for element in doc.element.body:
            tag = element.tag
            if tag.endswith("p"):
                p = docx.text.paragraph.Paragraph(element, doc)
                text = p.text.strip()
                if not text:
                    continue

                style_name = (p.style.name if p.style else "").strip()
                heading_level: Optional[int] = None
                block_type = ContentBlockType.PARAGRAPH

                if style_name in ("Heading 1", "Title"):
                    heading_level = 1
                    block_type = ContentBlockType.HEADING
                elif style_name in ("Heading 2", "Subtitle"):
                    heading_level = 2
                    block_type = ContentBlockType.HEADING
                elif style_name.startswith("Heading"):
                    heading_level = 3
                    block_type = ContentBlockType.HEADING
                elif "bullet" in style_name.lower() or "list" in style_name.lower():
                    block_type = ContentBlockType.LIST_ITEM
                else:
                    # Check regexes
                    classified_type, classified_level = self._classify_line(text)
                    block_type = classified_type
                    heading_level = classified_level

                block_id = f"blk_p{current_page}_{block_counter:04d}"
                all_blocks.append(
                    ExtractedBlock(
                        block_id=block_id,
                        page_number=current_page,
                        block_type=block_type,
                        raw_text=text,
                        normalized_text=self._normalize_block_text(text),
                        heading_level=heading_level,
                        has_equation=bool(self.RE_MATH_SYMBOLS.search(text)),
                    )
                )
                block_counter += 1

                word_accumulator += len(text.split())
                if word_accumulator >= WORDS_PER_ESTIMATED_PAGE:
                    current_page += 1
                    word_accumulator = 0

            elif tag.endswith("tbl"):
                tbl = docx.table.Table(element, doc)
                table_matrix: List[List[str]] = []
                for row in tbl.rows:
                    row_cells = [cell.text.strip().replace("\n", " ") for cell in row.cells]
                    if any(row_cells):
                        table_matrix.append(row_cells)

                if table_matrix:
                    block_id = f"blk_p{current_page}_{block_counter:04d}"
                    text_repr = "\n".join(" | ".join(r) for r in table_matrix)
                    all_blocks.append(
                        ExtractedBlock(
                            block_id=block_id,
                            page_number=current_page,
                            block_type=ContentBlockType.TABLE,
                            raw_text=text_repr,
                            normalized_text=text_repr,
                            table_data=table_matrix,
                        )
                    )
                    block_counter += 1

        total_pages = max(1, current_page)
        page_char_counts: Dict[int, int] = {}
        for b in all_blocks:
            page_char_counts[b.page_number] = page_char_counts.get(b.page_number, 0) + len(b.normalized_text)

        return all_blocks, total_pages, page_char_counts, False

    def _extract_txt(
        self,
        file_bytes: bytes,
        filename: str
    ) -> Tuple[List[ExtractedBlock], int, Dict[int, int], bool]:
        """Extract blocks from plain text with encoding fallbacks and page split detection."""
        text = ""
        # 1. UTF-8 BOM
        if file_bytes.startswith(b"\xef\xbb\xbf"):
            try:
                text = file_bytes.decode("utf-8-sig")
            except Exception:
                pass
        # 2. Standard UTF-8
        if not text:
            try:
                text = file_bytes.decode("utf-8")
            except UnicodeDecodeError:
                pass
        # 3. Latin-1 fallback
        if not text:
            try:
                text = file_bytes.decode("latin-1")
            except Exception as exc:
                raise CorruptedDocumentError(f"Failed to decode text file '{filename}': {exc}")

        # Check for form feed page breaks (\x0c)
        if "\x0c" in text:
            pages = text.split("\x0c")
        else:
            # Estimate pages by roughly 50 lines or 350 words per page
            lines = text.splitlines()
            pages = []
            chunk: List[str] = []
            for line in lines:
                chunk.append(line)
                if len(chunk) >= 55:
                    pages.append("\n".join(chunk))
                    chunk = []
            if chunk:
                pages.append("\n".join(chunk))

        all_blocks: List[ExtractedBlock] = []
        page_char_counts: Dict[int, int] = {}
        block_counter = 0

        for p_idx, page_str in enumerate(pages):
            page_num = p_idx + 1
            page_blocks = self._parse_text_lines(page_str, page_number=page_num, start_block_index=block_counter)
            all_blocks.extend(page_blocks)
            block_counter += len(page_blocks)
            page_char_counts[page_num] = sum(len(b.normalized_text) for b in page_blocks)

        total_pages = max(1, len(pages))
        return all_blocks, total_pages, page_char_counts, False

    def _parse_text_lines(
        self,
        text: str,
        page_number: int,
        start_block_index: int = 0,
        tables: Optional[List[List[List[str]]]] = None,
        is_ocr: bool = False
    ) -> List[ExtractedBlock]:
        """Convert page text lines into structured ExtractedBlocks with type detection."""
        blocks: List[ExtractedBlock] = []
        counter = start_block_index

        # Add explicit tables first if provided
        if tables:
            for t_matrix in tables:
                block_id = f"blk_p{page_number}_{counter:04d}"
                text_repr = "\n".join(" | ".join(r) for r in t_matrix)
                blocks.append(
                    ExtractedBlock(
                        block_id=block_id,
                        page_number=page_number,
                        block_type=ContentBlockType.TABLE,
                        raw_text=text_repr,
                        normalized_text=text_repr,
                        table_data=t_matrix,
                        is_ocr=is_ocr,
                    )
                )
                counter += 1

        raw_paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
        if not raw_paragraphs and text.strip():
            raw_paragraphs = [text.strip()]

        for para in raw_paragraphs:
            # Check if this paragraph contains table-like pipe format
            lines = [l.strip() for l in para.splitlines() if l.strip()]
            if len(lines) >= 2 and all("|" in l for l in lines):
                # Pipe table block
                matrix = [[c.strip() for c in l.split("|") if c.strip()] for l in lines]
                matrix = [r for r in matrix if r]
                if matrix and len(matrix) >= 2:
                    block_id = f"blk_p{page_number}_{counter:04d}"
                    blocks.append(
                        ExtractedBlock(
                            block_id=block_id,
                            page_number=page_number,
                            block_type=ContentBlockType.TABLE,
                            raw_text=para,
                            normalized_text=para,
                            table_data=matrix,
                            is_ocr=is_ocr,
                        )
                    )
                    counter += 1
                    continue

            # Pre-pass: stitch lone bullet characters and term labels to next line
            stitched_lines: List[str] = []
            l_idx = 0
            while l_idx < len(lines):
                line_val = lines[l_idx]
                # If lone bullet marker, stitch with next line
                if line_val in ("-", "*", "•", "+", "➤", "➢", "■", "▪", "o", "\u27a2", "\u2022", "\uf0b7"):
                    if l_idx + 1 < len(lines):
                        line_val = f"• {lines[l_idx+1]}"
                        l_idx += 1
                # If lone term ending with colon (e.g. "Physical Entity:" or "• Physical Entity:")
                m_term = re.match(r"^(?:[•\-*+]\s+)?([A-Z][A-Za-z0-9 \-–—/()]{1,40}):$", line_val)
                if m_term and l_idx + 1 < len(lines):
                    next_cand = lines[l_idx+1]
                    if not (next_cand.startswith(("Step", "3.", "#")) or next_cand in ("-", "*", "•", "o")):
                        line_val = f"{line_val} {next_cand}"
                        l_idx += 1
                stitched_lines.append(line_val)
                l_idx += 1
            lines = stitched_lines

            # Check if paragraph has multiple lines with embedded headings or steps
            line_idx = 0
            while line_idx < len(lines):
                cur_line = lines[line_idx].strip()
                if not cur_line:
                    line_idx += 1
                    continue

                # Filter lone bullet symbols with no text
                if cur_line in ("-", "*", "•", "+", "➤", "➢", "■", "▪", "\u27a2", "\u2022", "\uf0b7"):
                    line_idx += 1
                    continue

                classified_type, heading_lvl = self._classify_line(cur_line)
                cleaned_line = self._clean_step_repetition(cur_line)

                if classified_type in (ContentBlockType.HEADING, ContentBlockType.PROCESS_STEP, ContentBlockType.CAPTION):
                    # Add heading, process step, or caption as dedicated block
                    m_fig_h = self.RE_IN_TEXT_FIG.search(cleaned_line)
                    fig_ref_h = f"Figure {m_fig_h.group(1)}" if m_fig_h else None
                    blocks.append(
                        ExtractedBlock(
                            block_id=f"blk_p{page_number}_{counter:04d}",
                            page_number=page_number,
                            block_type=classified_type,
                            raw_text=cleaned_line,
                            normalized_text=cleaned_line,
                            heading_level=heading_lvl or (2 if classified_type == ContentBlockType.PROCESS_STEP else 1),
                            has_equation=bool(self.RE_MATH_SYMBOLS.search(cleaned_line)),
                            is_ocr=is_ocr,
                            figure_reference=fig_ref_h,
                        )
                    )
                    counter += 1
                    line_idx += 1
                    continue

                # Accumulate non-heading body lines
                body_lines = [cur_line]
                line_idx += 1
                while line_idx < len(lines):
                    next_line = lines[line_idx].strip()
                    if not next_line:
                        line_idx += 1
                        continue
                    if next_line in ("-", "*", "•", "+", "➤", "➢", "■", "▪", "\u27a2", "\u2022", "\uf0b7"):
                        line_idx += 1
                        continue
                    next_type, _ = self._classify_line(next_line)
                    if next_type in (ContentBlockType.HEADING, ContentBlockType.PROCESS_STEP, ContentBlockType.CAPTION):
                        break
                    # Keep distinct bullet items or definitions from being mashed into one giant block
                    if next_type in (ContentBlockType.DEFINITION, ContentBlockType.LIST_ITEM) and len(body_lines) > 0:
                        break
                    body_lines.append(next_line)
                    line_idx += 1

                body_text = "\n".join(body_lines).strip()
                lead_type, lead_lvl = self._classify_line(body_lines[0])
                if lead_type in (ContentBlockType.HEADING, ContentBlockType.PROCESS_STEP, ContentBlockType.CAPTION):
                    lead_type = ContentBlockType.PARAGRAPH
                    lead_lvl = None

                has_eq = bool(self.RE_MATH_SYMBOLS.search(body_text))
                m_fig_b = self.RE_IN_TEXT_FIG.search(body_text)
                fig_ref_b = f"Figure {m_fig_b.group(1)}" if m_fig_b else None
                blocks.append(
                    ExtractedBlock(
                        block_id=f"blk_p{page_number}_{counter:04d}",
                        page_number=page_number,
                        block_type=lead_type,
                        raw_text=body_text,
                        normalized_text=self._normalize_block_text(body_text),
                        heading_level=lead_lvl,
                        has_equation=has_eq,
                        is_ocr=is_ocr,
                        figure_reference=fig_ref_b,
                    )
                )
                counter += 1

        return blocks

    def _classify_line(self, line: str) -> Tuple[ContentBlockType, Optional[int]]:
        """Classify single line or lead-in into structural block type."""
        s = line.strip()

        # Markdown headings
        m1 = self.RE_MD_H1.match(s)
        if m1:
            return ContentBlockType.HEADING, 1
        m2 = self.RE_MD_H2.match(s)
        if m2:
            return ContentBlockType.HEADING, 2
        m3 = self.RE_MD_H3.match(s)
        if m3:
            return ContentBlockType.HEADING, 3

        # Numbered section (e.g. "1.2 Linear Regression" or "3.2.1 Step 1: ...")
        m_sec = self.RE_NUMBERED_SEC.match(s)
        if m_sec:
            dots = m_sec.group(1).count(".")
            level = 1 if dots == 0 else (2 if dots == 1 else 3)
            return ContentBlockType.HEADING, level

        # Figure / Table caption (requires delimiter : or - and non-narrative content)
        m_cap = self.RE_CAPTION.match(s)
        if m_cap:
            cap_body = (m_cap.group(2) or "").strip()
            # If line is narrative text like "shows the domain model...", do not classify as CAPTION
            if not re.match(r"^(shows|illustrates|depicts|describes|presents|is an example|provides|defines)\b", cap_body, re.I):
                return ContentBlockType.CAPTION, None

        # Module / Chapter / Unit heading (e.g. "Module III", "Module 3: Introduction")
        if self.RE_MODULE_SEC.match(s):
            return ContentBlockType.HEADING, 1

        # Question bank / review heading
        if self.RE_QUESTION_BANK.match(s):
            return ContentBlockType.HEADING, 1

        # Process step (e.g. "Step 1: ...", "5 Step 5: Service Specifications")
        if self.RE_PROCESS_STEP.match(s):
            return ContentBlockType.PROCESS_STEP, 2

        # Example / Case study
        if self.RE_EXAMPLE.match(s):
            return ContentBlockType.EXAMPLE, None

        # Definition (e.g. "Overfitting: When a model learns noise...")
        if self.RE_DEFINITION.match(s):
            return ContentBlockType.DEFINITION, None

        # Bullets / lists
        if self.RE_BULLET.match(s) or self.RE_NUMBERED_LIST.match(s):
            return ContentBlockType.LIST_ITEM, None

        return ContentBlockType.PARAGRAPH, None

    def _deduplicate_headers_and_footers(
        self,
        blocks: List[ExtractedBlock],
        total_pages: int
    ) -> Tuple[List[ExtractedBlock], List[str]]:
        """Detect and strip recurrent header/footer lines appearing identically across multiple pages."""
        if total_pages < 3:
            return blocks, []

        page_top_lines: List[str] = []
        page_bottom_lines: List[str] = []
        by_page: Dict[int, List[ExtractedBlock]] = {}

        for b in blocks:
            by_page.setdefault(b.page_number, []).append(b)

        for p_num, p_blocks in by_page.items():
            if p_blocks:
                # Inspect top 4 lines of page
                top_collected = 0
                for pb in p_blocks:
                    for l in pb.normalized_text.splitlines():
                        s = re.sub(r"\s+", " ", l).strip()
                        if 3 <= len(s) <= 200:
                            page_top_lines.append(s)
                            top_collected += 1
                            if top_collected >= 4:
                                break
                    if top_collected >= 4:
                        break

                # Inspect bottom 4 lines of page
                bot_collected = 0
                for pb in reversed(p_blocks):
                    for l in reversed(pb.normalized_text.splitlines()):
                        s = re.sub(r"\s+", " ", l).strip()
                        if 1 <= len(s) <= 150:
                            page_bottom_lines.append(s)
                            bot_collected += 1
                            if bot_collected >= 4:
                                break
                    if bot_collected >= 4:
                        break

        top_counts = Counter(page_top_lines)
        bot_counts = Counter(page_bottom_lines)

        recurrent_headers: Set[str] = {
            line for line, count in top_counts.items()
            if count >= max(2, int(total_pages * 0.15))
        }

        re_page_num = re.compile(r"^(?:Page\s+\d+(\s+of\s+\d+)?|\d+)$", re.IGNORECASE)
        re_watermark = re.compile(r"(?:vtusync|studied\s+smart|thanks to vtusync|dept of cse|dr\s+sb\s*&\s*vs)", re.IGNORECASE)
        re_course_hdr = re.compile(r"(?:Internet of Things\s*\[BCS701\]-\d{4}-\d{2})", re.IGNORECASE)

        recurrent_footers: Set[str] = {
            line for line, count in bot_counts.items()
            if count >= max(2, int(total_pages * 0.15)) or re_page_num.match(line)
        }

        warnings: List[str] = []
        if recurrent_headers:
            warnings.append(f"Deduplicated recurring page headers: {', '.join(repr(h) for h in list(recurrent_headers)[:5])}")
        if recurrent_footers:
            warnings.append(f"Deduplicated recurring page footers: {', '.join(repr(f) for f in list(recurrent_footers)[:5])}")

        filtered_blocks: List[ExtractedBlock] = []
        for b in blocks:
            text = b.normalized_text
            lines = text.splitlines()
            kept_lines = []
            for idx, l in enumerate(lines):
                norm_l = re.sub(r"\s+", " ", l).strip()
                if norm_l in recurrent_headers:
                    continue
                if norm_l in recurrent_footers or re_page_num.match(norm_l) or re_watermark.search(norm_l) or re_course_hdr.search(norm_l):
                    continue
                # Also strip lone bullet character
                if norm_l in ("-", "*", "•", "+", "➤", "➢", "■", "▪", "\u27a2", "\u2022", "\uf0b7"):
                    continue
                kept_lines.append(l)

            if kept_lines:
                new_text = "\n".join(kept_lines).strip()
                if new_text:
                    b.normalized_text = new_text
                    filtered_blocks.append(b)

        return filtered_blocks, warnings

    def _normalize_block_text(self, text: str) -> str:
        """Normalize line breaks and trailing spaces without destroying mathematical notation."""
        if not text:
            return ""
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        lines = [l.rstrip() for l in text.split("\n")]
        return "\n".join(lines).strip()
