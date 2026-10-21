"""
Document Ingestion Layer for Acadion AI PPT Generator (Phase 4).
Extracts educational lecture content from TXT, PDF, DOCX, and pasted text
with strict resource limits, encoding fallbacks, and scanned document detection.
"""

from pathlib import Path
import re
from typing import Optional, Set, Tuple

from app.models import (
    CorruptedDocumentError,
    DocumentIngestionError,
    DocumentMetadata,
    EmptyContentError,
    EncryptedDocumentError,
    FileSizeLimitExceededError,
    InputFileNotFoundError,
    ScannedDocumentError,
    TextLengthLimitExceededError,
    UnsupportedFileTypeError,
)


class DocumentLoader:
    """Loads, validates, and normalizes educational documents for presentation generation."""

    # Configurable limits
    DEFAULT_MAX_FILE_SIZE_BYTES: int = 20 * 1024 * 1024  # 20 MB
    DEFAULT_MAX_TEXT_LENGTH: int = 100_000               # 100,000 characters
    SUPPORTED_EXTENSIONS: Set[str] = {".txt", ".pdf", ".docx"}

    # Magic byte signatures
    PDF_MAGIC = b"%PDF"
    DOCX_MAGIC = b"PK\x03\x04"

    def __init__(
        self,
        max_file_size_bytes: Optional[int] = None,
        max_text_length: Optional[int] = None,
    ):
        """Initialize DocumentLoader with optional resource limit overrides."""
        self.max_file_size_bytes = (
            max_file_size_bytes
            if max_file_size_bytes is not None
            else self.DEFAULT_MAX_FILE_SIZE_BYTES
        )
        self.max_text_length = (
            max_text_length
            if max_text_length is not None
            else self.DEFAULT_MAX_TEXT_LENGTH
        )

    def load(self, source: str | Path) -> Tuple[str, DocumentMetadata]:
        """Ingest a document from a local file path.
        
        Args:
            source: Path to the .txt, .pdf, or .docx file.
            
        Returns:
            Tuple of (normalized_text, DocumentMetadata)
            
        Raises:
            InputFileNotFoundError: If the file does not exist or is a directory.
            UnsupportedFileTypeError: If file extension is unsupported.
            FileSizeLimitExceededError: If file exceeds maximum size limit.
            TextLengthLimitExceededError: If extracted text exceeds maximum character limit.
            EmptyContentError: If file or extracted text is empty or whitespace-only.
            CorruptedDocumentError: If file format signature or internal structure is corrupted.
            EncryptedDocumentError: If PDF is encrypted/password-protected.
            ScannedDocumentError: If PDF contains no extractable text (requires OCR).
        """
        path = Path(source)
        if not path.exists() or path.is_dir():
            raise InputFileNotFoundError(f"Input file not found at: {path.resolve()}")

        # 1. Validate file size
        file_size = path.stat().st_size
        if file_size == 0:
            raise EmptyContentError(f"Input file '{path.name}' is empty (0 bytes).")

        if file_size > self.max_file_size_bytes:
            max_mb = self.max_file_size_bytes / (1024 * 1024)
            actual_mb = file_size / (1024 * 1024)
            raise FileSizeLimitExceededError(
                f"File size ({actual_mb:.2f} MB) exceeds maximum allowed limit of {max_mb:.1f} MB. "
                "Please split your curriculum materials into smaller modular files."
            )

        # 2. Validate file extension
        ext = path.suffix.lower()
        if ext not in self.SUPPORTED_EXTENSIONS:
            supported_str = ", ".join(sorted(self.SUPPORTED_EXTENSIONS))
            raise UnsupportedFileTypeError(
                f"Unsupported file format '{ext}'. Acadion supports: {supported_str}."
            )

        # 3. Validate file header / magic bytes
        self._validate_magic_bytes(path, ext)

        # 4. Extract text per format
        if ext == ".txt":
            raw_text, page_count = self._load_txt(path)
            file_type = "txt"
        elif ext == ".pdf":
            raw_text, page_count = self._load_pdf(path)
            file_type = "pdf"
        elif ext == ".docx":
            raw_text, page_count = self._load_docx(path)
            file_type = "docx"
        else:
            raise UnsupportedFileTypeError(f"Unsupported format: {ext}")

        # 5. Normalize text
        normalized_text = self._normalize_text(raw_text)
        if not normalized_text or not normalized_text.strip():
            raise EmptyContentError(
                f"Extracted content from '{path.name}' is empty or contains only whitespace."
            )

        # 6. Check extracted text length limit
        if len(normalized_text) > self.max_text_length:
            raise TextLengthLimitExceededError(
                f"Extracted document text length ({len(normalized_text):,} characters) exceeds "
                f"the maximum allowed limit of {self.max_text_length:,} characters. "
                "To maintain pedagogical quality and avoid truncation, please split your lecture notes "
                "into smaller topic modules."
            )

        metadata = DocumentMetadata(
            file_path=str(path.resolve()),
            file_type=file_type,
            page_count=page_count,
            word_count=len(normalized_text.split()),
            character_count=len(normalized_text),
            source_description=f"{file_type.upper()} Document"
            + (f" ({page_count} pages)" if page_count else ""),
        )

        return normalized_text, metadata

    def load_text(
        self,
        raw_text: str,
        source_description: str = "Pasted Lecture Notes"
    ) -> Tuple[str, DocumentMetadata]:
        """Ingest direct raw or pasted educational notes.
        
        Args:
            raw_text: Plain text content.
            source_description: Label for this source input.
            
        Returns:
            Tuple of (normalized_text, DocumentMetadata)
            
        Raises:
            EmptyContentError: If text is empty or whitespace-only.
            TextLengthLimitExceededError: If text exceeds character limit.
        """
        if not raw_text or not raw_text.strip():
            raise EmptyContentError("Input lecture notes are empty or contain only whitespace.")

        normalized_text = self._normalize_text(raw_text)
        if not normalized_text:
            raise EmptyContentError("Input lecture notes contain no readable text.")

        if len(normalized_text) > self.max_text_length:
            raise TextLengthLimitExceededError(
                f"Input text length ({len(normalized_text):,} characters) exceeds maximum "
                f"allowed limit of {self.max_text_length:,} characters. Please split your notes."
            )

        metadata = DocumentMetadata(
            file_path=None,
            file_type="raw_text",
            page_count=1,
            word_count=len(normalized_text.split()),
            character_count=len(normalized_text),
            source_description=source_description,
        )

        return normalized_text, metadata

    def _validate_magic_bytes(self, path: Path, ext: str) -> None:
        """Inspect initial byte stream to verify file signature matches declared extension."""
        try:
            with open(path, "rb") as f:
                header = f.read(1024)
        except Exception as exc:
            raise CorruptedDocumentError(f"Cannot read file header for '{path.name}': {exc}")

        if ext == ".pdf":
            # PDF header %PDF must appear in the first 1024 bytes
            if self.PDF_MAGIC not in header:
                raise CorruptedDocumentError(
                    f"File '{path.name}' does not appear to be a valid PDF document "
                    "(missing standard %PDF header signature)."
                )
        elif ext == ".docx":
            # Word DOCX is an OpenXML ZIP archive starting with PK\x03\x04
            if not header.startswith(self.DOCX_MAGIC):
                raise CorruptedDocumentError(
                    f"File '{path.name}' does not appear to be a valid Word document "
                    "(missing standard OpenXML ZIP archive signature)."
                )

    def _load_txt(self, path: Path) -> Tuple[str, Optional[int]]:
        """Load text file handling UTF-8, UTF-8 BOM, and fallback encodings."""
        try:
            raw_bytes = path.read_bytes()
        except Exception as exc:
            raise CorruptedDocumentError(f"Failed to read TXT file '{path.name}': {exc}")

        # Check for UTF-8 BOM
        if raw_bytes.startswith(b"\xef\xbb\xbf"):
            try:
                return raw_bytes.decode("utf-8-sig"), 1
            except UnicodeDecodeError:
                pass

        # Try standard UTF-8
        try:
            return raw_bytes.decode("utf-8"), 1
        except UnicodeDecodeError:
            pass

        # Fallback to latin-1 (covers Windows-1252 superset and arbitrary byte streams)
        try:
            return raw_bytes.decode("latin-1"), 1
        except UnicodeDecodeError as exc:
            raise CorruptedDocumentError(
                f"Failed to decode TXT file '{path.name}' using UTF-8 or Latin-1: {exc}"
            )

    def _load_pdf(self, path: Path) -> Tuple[str, int]:
        """Extract text from PDF page-by-page using PyMuPDF and detect scanned documents."""
        try:
            import pymupdf
        except ImportError as exc:
            raise DocumentIngestionError(
                "PyMuPDF is required for PDF ingestion. Install with 'pip install PyMuPDF'."
            ) from exc

        try:
            doc = pymupdf.open(path)
        except Exception as exc:
            raise CorruptedDocumentError(f"Failed to open PDF document '{path.name}': {exc}")

        try:
            if doc.is_encrypted:
                raise EncryptedDocumentError(
                    f"PDF document '{path.name}' is password-protected or encrypted. "
                    "Please provide an unencrypted document."
                )

            page_count = len(doc)
            if page_count == 0:
                raise EmptyContentError(f"PDF document '{path.name}' contains 0 pages.")

            extracted_pages = []
            total_extracted_chars = 0

            re_header_footer = re.compile(
                r"(?:Internet of Things\s*\[BCS701\]-\d{4}-\d{2}|Dr\s+SB\s*&\s*VS|Dept\s+of\s+CSE|VTUSYNC(?:\.IN)?|Studied\s+smart,\s+not\s+hard.*|Thanks\s+to\s+VTUSync.*)",
                re.IGNORECASE,
            )
            re_page_num = re.compile(r"^(?:Page\s+\d+(\s+of\s+\d+)?|\d+)$", re.IGNORECASE)

            for page_num in range(page_count):
                page = doc[page_num]
                p_h = page.rect.height
                raw_blocks = page.get_text("blocks") or []
                text_blocks = [b for b in raw_blocks if b[6] == 0 and b[4].strip()]

                clean_lines = []
                for b in text_blocks:
                    x0, y0, x1, y1, b_text = b[0], b[1], b[2], b[3], b[4].strip()
                    # Skip top header band
                    if y1 <= max(65.0, p_h * 0.08) and (
                        "bcs" in b_text.lower() or "module" in b_text.lower() or "internet of things" in b_text.lower()
                    ):
                        continue
                    # Skip bottom footer band
                    if y0 >= min(p_h - 65.0, p_h * 0.91) and (
                        "dept of" in b_text.lower() or "dr " in b_text.lower() or re_page_num.match(b_text)
                    ):
                        continue
                    # Clean line by line
                    for line in b_text.splitlines():
                        s = line.strip()
                        if not s or re_page_num.match(s) or re_header_footer.search(s):
                            continue
                        clean_lines.append(s)

                cleaned_page_text = "\n".join(clean_lines).strip()
                if cleaned_page_text:
                    total_extracted_chars += len(cleaned_page_text)
                    extracted_pages.append(cleaned_page_text)

            # Scanned / Image-only PDF Detection
            # If the entire document yielded 0 characters, or an extremely low character count (< 20 across multiple pages),
            # the PDF is scanned or image-based.
            if total_extracted_chars == 0 or (page_count > 0 and total_extracted_chars < 20):
                raise ScannedDocumentError(
                    f"PDF document '{path.name}' contains no extractable text. The file appears to be "
                    "a scanned document or image-only PDF. Processing scanned documents requires "
                    "Optical Character Recognition (OCR), which is not currently supported. "
                    "Please provide a text-based PDF or copy and paste the text directly."
                )

            combined_text = "\n\n".join(extracted_pages)
            return combined_text, page_count

        finally:
            doc.close()

    def _load_docx(self, path: Path) -> Tuple[str, Optional[int]]:
        """Extract text from DOCX preserving headings, bullets, and paragraph order."""
        try:
            import docx
            from docx.opc.exceptions import PackageNotFoundError
        except ImportError as exc:
            raise DocumentIngestionError(
                "python-docx is required for DOCX ingestion. Install with 'pip install python-docx'."
            ) from exc

        try:
            doc = docx.Document(path)
        except PackageNotFoundError as exc:
            raise CorruptedDocumentError(
                f"Word document package not found or corrupted in '{path.name}': {exc}"
            )
        except Exception as exc:
            raise CorruptedDocumentError(
                f"Failed to parse Word document '{path.name}': {exc}"
            )

        lines = []

        # Iterate through elements in body to preserve sequential document flow
        for element in doc.element.body:
            # Paragraph element
            if element.tag.endswith("p"):
                p = docx.text.paragraph.Paragraph(element, doc)
                text = p.text.strip()
                if not text:
                    continue

                style_name = (p.style.name if p.style else "").strip()

                # Preserve hierarchical heading structure as Markdown headers
                if style_name == "Heading 1" or style_name == "Title":
                    lines.append(f"# {text}")
                elif style_name == "Heading 2" or style_name == "Subtitle":
                    lines.append(f"## {text}")
                elif style_name == "Heading 3":
                    lines.append(f"### {text}")
                elif style_name.startswith("Heading"):
                    lines.append(f"### {text}")
                # Preserve bullet lists
                elif "bullet" in style_name.lower() or "list" in style_name.lower():
                    if not text.startswith(("-", "*", "•", "+")):
                        lines.append(f"- {text}")
                    else:
                        lines.append(text)
                else:
                    lines.append(text)

            # Table element
            elif element.tag.endswith("tbl"):
                tbl = docx.table.Table(element, doc)
                for row in tbl.rows:
                    row_cells = [
                        cell.text.strip().replace("\n", " ")
                        for cell in row.cells
                        if cell.text.strip()
                    ]
                    if row_cells:
                        lines.append(" - " + " | ".join(row_cells))

        if not lines:
            raise EmptyContentError(
                f"Word document '{path.name}' contains no readable text or paragraphs."
            )

        combined_text = "\n\n".join(lines)
        return combined_text, None

    def _normalize_text(self, text: str) -> str:
        """Normalize line endings, trim line padding, and collapse redundant blank lines."""
        if not text:
            return ""

        # Normalize line breaks
        text = text.replace("\r\n", "\n").replace("\r", "\n")

        # Strip trailing whitespace on each line
        lines = [line.rstrip() for line in text.split("\n")]

        # Collapse more than 2 consecutive empty lines to 2
        normalized_lines = []
        consecutive_empty = 0
        for line in lines:
            if not line:
                consecutive_empty += 1
                if consecutive_empty <= 2:
                    normalized_lines.append("")
            else:
                consecutive_empty = 0
                normalized_lines.append(line)

        return "\n".join(normalized_lines).strip()
