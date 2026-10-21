"""
Data models and exceptions for Acadion AI PPT Generator.
Supports deterministic generation (Phase 1), Gemini AI planning (Phase 2),
and Visual Intelligence diagrams/images (Phase 3).
"""

from dataclasses import dataclass, field
from enum import Enum
import re
from typing import List, Optional, Dict, Any, Union, Tuple
import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class SectionType(Enum):
    """Semantic type of presentation section."""
    INTRO_OVERVIEW = "intro_overview"
    CONTENT = "content"
    SUMMARY_CONCLUSION = "summary_conclusion"


class VisualType(Enum):
    """Supported visual intelligence diagram and image types (Phase 3)."""
    NONE = "none"
    PROCESS_FLOW = "process_flow"
    TIMELINE = "timeline"
    COMPARISON = "comparison"
    CONCEPT_MAP = "concept_map"
    LOCAL_IMAGE = "local_image"


# =====================================================================
# Visual Intelligence Data Models (Phase 3)
# =====================================================================

@dataclass
class ProcessStep:
    """An individual step in a process flowchart."""
    step_number: int
    title: str
    description: str = ""


@dataclass
class ProcessFlowData:
    """Data for rendering a native horizontal process flowchart."""
    steps: List[ProcessStep] = field(default_factory=list)


@dataclass
class TimelineMilestone:
    """An individual milestone or chronological marker."""
    date_or_period: str
    title: str
    description: str = ""


@dataclass
class TimelineData:
    """Data for rendering a native chronological timeline."""
    milestones: List[TimelineMilestone] = field(default_factory=list)


@dataclass
class ComparisonColumn:
    """An entity column in a two-column comparison."""
    name: str
    tag: str = ""
    points: List[str] = field(default_factory=list)


@dataclass
class ComparisonData:
    """Data for rendering a native two-column comparison diagram."""
    left_column: ComparisonColumn
    right_column: ComparisonColumn
    takeaway: str = ""


@dataclass
class ConceptMapNode:
    """A branch node in a concept map."""
    title: str
    description: str = ""


@dataclass
class ConceptMapData:
    """Data for rendering a central concept map diagram."""
    center_concept: str
    branches: List[ConceptMapNode] = field(default_factory=list)


@dataclass
class ImageData:
    """Data for placing a validated local illustrative image."""
    file_path: str
    caption: str = ""
    alt_text: str = ""


@dataclass
class SlideVisual:
    """Encapsulates visual diagram or image specification for a slide."""
    visual_type: VisualType = VisualType.NONE
    process_flow: Optional[ProcessFlowData] = None
    timeline: Optional[TimelineData] = None
    comparison: Optional[ComparisonData] = None
    concept_map: Optional[ConceptMapData] = None
    image: Optional[ImageData] = None


# =====================================================================
# Core Presentation Models
# =====================================================================

@dataclass
class BulletPoint:
    """Represents a bullet point, optionally supporting a highlighted bold prefix."""
    text: str
    prefix: Optional[str] = None
    level: int = 0

    @property
    def display_text(self) -> str:
        if self.prefix:
            return f"{self.prefix}: {self.text}"
        return self.text


@dataclass
class Section:
    """Represents a thematic section parsed from educational notes or planned by AI."""
    title: str
    subtitle: str = ""
    section_type: SectionType = SectionType.CONTENT
    bullets: List[BulletPoint] = field(default_factory=list)
    paragraphs: List[str] = field(default_factory=list)
    speaker_notes: str = ""
    visual: Optional[SlideVisual] = None
    teaching_objective: str = ""
    key_message: str = ""
    composition_type: str = ""


@dataclass
class PresentationData:
    """Encapsulates all structured data required to generate the presentation."""
    title: str
    subtitle: str = "Educational Lecture & Curriculum Overview"
    institution: str = "Acadion Learning"
    date_str: str = ""
    overview_section: Optional[Section] = None
    content_sections: List[Section] = field(default_factory=list)
    conclusion_section: Optional[Section] = None
    recommended_slide_count: Optional[int] = None
    recommended_theme: Optional[str] = None
    theme_rationale: Optional[str] = None
    title_composition: str = "editorial"
    overview_composition: str = "agenda_flow"
    conclusion_composition: str = "synthesis_takeaways"
    is_part_of_series: bool = False

    @property
    def all_sections(self) -> List[Section]:
        sections: List[Section] = []
        if self.overview_section:
            sections.append(self.overview_section)
        sections.extend(self.content_sections)
        if self.conclusion_section:
            sections.append(self.conclusion_section)
        return sections

    def to_unified_plan(self, provider_preference: str = "native") -> "UnifiedPresentationPlan":
        """Convert this presentation data into a shared UnifiedPresentationPlan."""
        return UnifiedPresentationPlan.from_presentation_data(self, provider_preference=provider_preference)


# =====================================================================
# Unified Presentation Plan Models (Shared Architecture)
# =====================================================================

class SlideArchetype(str, Enum):
    """16 Visual Slide Archetypes supported in Acadion Native engine."""
    # Opening & Structural
    EDITORIAL_TITLE = "editorial_title"
    CINEMATIC_TITLE = "cinematic_title"
    SPLIT_HERO_TITLE = "split_hero_title"
    AGENDA_ROADMAP = "agenda_roadmap"
    SECTION_DIVIDER = "section_divider"

    # Narrative & Editorial
    EDITORIAL_TEXT = "editorial_text"
    PULL_QUOTE = "pull_quote"
    SPLIT_IMAGE_INSIGHT = "split_image_insight"
    CASE_STUDY = "case_study"

    # Structural & Comparative
    TWO_COLUMN_COMPARE = "two_column_compare"
    THREE_PILLAR_COLUMNS = "three_pillar_columns"
    QUADRANT_MATRIX = "quadrant_matrix"

    # Sequential & Data-Driven
    PROCESS_CHEVRONS = "process_chevrons"
    CHRONOLOGICAL_TIMELINE = "chronological_timeline"
    KPI_METRIC_TRIO = "kpi_metric_trio"

    # Closing & Interactive
    SOCRATIC_DISCUSSION = "socratic_discussion"
    SYNTHESIS_ROADMAP = "synthesis_roadmap"

    # Compatibility Aliases with earlier prototypes
    EDITORIAL = "editorial"
    ASYMMETRIC = "asymmetric"
    MULTI_COLUMN = "multi_column"
    CARDS_GRID = "cards_grid"
    TWO_COLUMN = "two_column"
    KPI_METRICS = "kpi_metrics"
    DISCUSSION = "discussion"
    TIMELINE = "timeline"
    PROCESS_FLOW = "process_flow"
    CONCEPT_MAP = "concept_map"


@dataclass
class MetricCallout:
    """An individual KPI or statistical metric callout."""
    value: str
    label: str
    subtext: str = ""


@dataclass
class ImageDirective:
    """Visual image placement or asset search specification."""
    category: str = "technology"
    query_keywords: str = ""
    alt_text: str = ""
    suggested_crop: str = "fill_left"
    local_fallback_asset: Optional[str] = None


@dataclass
class UnifiedSlidePlan:
    """A single structured slide specification in the shared content planning layer."""
    slide_index: int
    archetype: SlideArchetype
    title: str
    kicker: Optional[str] = None
    subtitle: Optional[str] = None
    key_message: str = ""
    bullets: List[BulletPoint] = field(default_factory=list)
    metrics: Optional[List[MetricCallout]] = None
    visual_diagram_data: Optional[Dict[str, Any]] = None
    image_directive: Optional[ImageDirective] = None
    speaker_notes: str = ""
    teaching_objective: str = ""
    section_type: SectionType = SectionType.CONTENT

    def to_section(self) -> Section:
        """Convert UnifiedSlidePlan to a native Section instance."""
        return Section(
            title=self.title,
            subtitle=self.subtitle or "",
            section_type=self.section_type,
            bullets=list(self.bullets),
            speaker_notes=self.speaker_notes,
            teaching_objective=self.teaching_objective,
            key_message=self.key_message,
            composition_type=self.archetype.value if isinstance(self.archetype, SlideArchetype) else str(self.archetype),
        )

    @classmethod
    def from_section(cls, section: Section, index: int = 0) -> "UnifiedSlidePlan":
        """Convert a native Section to a UnifiedSlidePlan."""
        raw_comp = getattr(section, "composition_type", "").lower()
        archetype = SlideArchetype.EDITORIAL_TEXT
        if section.section_type == SectionType.INTRO_OVERVIEW:
            archetype = SlideArchetype.AGENDA_ROADMAP
        elif section.section_type == SectionType.SUMMARY_CONCLUSION:
            archetype = SlideArchetype.SYNTHESIS_ROADMAP
        elif raw_comp:
            for arch in SlideArchetype:
                if arch.value == raw_comp:
                    archetype = arch
                    break

        return cls(
            slide_index=index,
            archetype=archetype,
            title=section.title,
            subtitle=section.subtitle if section.subtitle else None,
            key_message=getattr(section, "key_message", ""),
            bullets=list(section.bullets),
            speaker_notes=section.speaker_notes,
            teaching_objective=getattr(section, "teaching_objective", ""),
            section_type=section.section_type,
        )


@dataclass
class UnifiedPresentationPlan:
    """The authoritative presentation plan shared across all generation providers."""
    plan_id: str
    title: str
    subtitle: str = "Educational Lecture & Curriculum Overview"
    institution: str = "Acadion Learning"
    target_audience: str = "Undergraduate & Graduate Students"
    pedagogical_goals: List[str] = field(default_factory=list)
    theme_id: str = "academic_navy"
    aspect_ratio: str = "16:9"
    total_slides: int = 0
    slides: List[UnifiedSlidePlan] = field(default_factory=list)
    source_metadata: Dict[str, Any] = field(default_factory=dict)
    provider_preference: str = "native"
    created_at: str = ""

    def to_presentation_data(self) -> PresentationData:
        """Convert UnifiedPresentationPlan to core PresentationData."""
        data = PresentationData(
            title=self.title,
            subtitle=self.subtitle,
            institution=self.institution,
            recommended_theme=self.theme_id,
        )

        content_sections: List[Section] = []
        for s in self.slides:
            sec = s.to_section()
            if s.section_type == SectionType.INTRO_OVERVIEW and not data.overview_section:
                data.overview_section = sec
            elif s.section_type == SectionType.SUMMARY_CONCLUSION and not data.conclusion_section:
                data.conclusion_section = sec
            else:
                content_sections.append(sec)

        data.content_sections = content_sections
        data.recommended_slide_count = len(self.slides)
        return data

    @classmethod
    def from_presentation_data(
        cls,
        data: PresentationData,
        plan_id: Optional[str] = None,
        provider_preference: str = "native",
        source_metadata: Optional[Dict[str, Any]] = None,
    ) -> "UnifiedPresentationPlan":
        """Build UnifiedPresentationPlan from core PresentationData."""
        pid = plan_id or str(uuid.uuid4())
        slides: List[UnifiedSlidePlan] = []
        idx = 1

        if data.overview_section:
            slides.append(UnifiedSlidePlan.from_section(data.overview_section, index=idx))
            idx += 1

        for s in data.content_sections:
            slides.append(UnifiedSlidePlan.from_section(s, index=idx))
            idx += 1

        if data.conclusion_section:
            slides.append(UnifiedSlidePlan.from_section(data.conclusion_section, index=idx))
            idx += 1

        return cls(
            plan_id=pid,
            title=data.title,
            subtitle=data.subtitle,
            institution=data.institution,
            theme_id=getattr(data, "recommended_theme", "academic_navy") or "academic_navy",
            total_slides=len(slides),
            slides=slides,
            source_metadata=source_metadata or {},
            provider_preference=provider_preference,
            created_at=datetime.now().isoformat(),
        )


# =====================================================================
# Custom Exceptions
# =====================================================================

class PPTGeneratorError(Exception):
    """Base exception for all PPT generator errors."""
    pass


class InputFileNotFoundError(PPTGeneratorError):
    """Raised when the specified input file cannot be found."""
    pass


class EmptyContentError(PPTGeneratorError):
    """Raised when the input notes file or text is empty."""
    pass


class InvalidContentError(PPTGeneratorError):
    """Raised when the input notes cannot be parsed into a valid structure."""
    pass


# =====================================================================
# Gemini Service Exceptions (Phase 2)
# =====================================================================

class GeminiServiceError(PPTGeneratorError):
    """Base exception for Gemini AI service errors."""
    pass


class MissingAPIKeyError(GeminiServiceError):
    """Raised when GEMINI_API_KEY is not configured."""
    pass


class ModelUnavailableError(GeminiServiceError):
    """Raised when the configured Gemini model is unavailable or not found."""
    pass


class GeminiAuthenticationError(GeminiServiceError):
    """Raised when Gemini API authentication or permission check fails."""
    pass


class GeminiQuotaExceededError(GeminiServiceError):
    """Raised when Gemini API rate limits or quota are exhausted."""
    pass


class GeminiOutputValidationError(GeminiServiceError):
    """Raised when Gemini output is malformed, empty, or fails schema validation."""
    pass


# =====================================================================
# Visual Intelligence Exceptions (Phase 3)
# =====================================================================

class VisualRenderError(PPTGeneratorError):
    """Raised when a visual diagram or image cannot be rendered."""
    pass


class InvalidVisualDataError(VisualRenderError):
    """Raised when visual intelligence parameters violate layout constraints."""
    pass


# =====================================================================
# Document Ingestion Models & Exceptions (Phase 4)
# =====================================================================

@dataclass
class DocumentMetadata:
    """Metadata describing an ingested document or text input."""
    file_path: Optional[str] = None
    file_type: str = "text"  # "txt", "pdf", "docx", "raw_text"
    page_count: Optional[int] = None
    word_count: int = 0
    character_count: int = 0
    source_description: str = ""


class DocumentIngestionError(PPTGeneratorError):
    """Base exception for all document ingestion and extraction failures."""
    pass


class UnsupportedFileTypeError(DocumentIngestionError):
    """Raised when the input file format/extension is not supported."""
    pass


class FileSizeLimitExceededError(DocumentIngestionError):
    """Raised when an input file exceeds maximum configured file size limit."""
    pass


class TextLengthLimitExceededError(DocumentIngestionError):
    """Raised when extracted document text exceeds maximum configured character limit."""
    pass


class CorruptedDocumentError(DocumentIngestionError):
    """Raised when a file cannot be parsed or has invalid internal structure/magic bytes."""
    pass


class EncryptedDocumentError(DocumentIngestionError):
    """Raised when a document is password-protected or encrypted."""
    pass


class ScannedDocumentError(DocumentIngestionError):
    """Raised when a document contains no extractable text (e.g. scanned image PDF)."""
    pass


# =====================================================================
# Visual Editor Exceptions (Phase 2.1)
# =====================================================================

class EditorError(PPTGeneratorError):
    """Base exception for presentation editor and parsing failures."""
    pass


class PresentationParseError(EditorError):
    """Raised when an existing presentation cannot be parsed or is corrupted."""
    pass


class AssetNotFoundError(EditorError):
    """Raised when an image asset for a presentation is missing or unauthorized."""
    pass


# =====================================================================
# Normalized Slide-Object Model (SOM) for Visual Editor (Phase 2.1)
# =====================================================================

class TextRunDTO(BaseModel):
    """Normalized text run with character-level styling."""
    run_index: int = 0
    text: str = ""
    font_family: Optional[str] = None
    font_size: Optional[float] = None  # in points (pt)
    font_color: Optional[str] = None  # hex "#RRGGBB" or None
    bold: Optional[bool] = None
    italic: Optional[bool] = None
    underline: Optional[bool] = None
    strikethrough: Optional[bool] = None
    hyperlink: Optional[str] = None


class TextParagraphDTO(BaseModel):
    """Normalized text paragraph containing formatted runs and paragraph styling."""
    paragraph_index: int = 0
    runs: List[TextRunDTO] = Field(default_factory=list)
    alignment: Optional[str] = None  # "left", "center", "right", "justify"
    line_spacing: Optional[float] = None
    space_before: Optional[float] = None
    space_after: Optional[float] = None
    level: int = 0
    bullet_char: Optional[str] = None
    is_bullet: bool = False

    @property
    def plain_text(self) -> str:
        return "".join(r.text for r in self.runs)


class TextContentDTO(BaseModel):
    """Encapsulates all paragraphs and frame-level text settings for a shape."""
    paragraphs: List[TextParagraphDTO] = Field(default_factory=list)
    vertical_alignment: Optional[str] = None  # "top", "middle", "bottom"
    word_wrap: Optional[bool] = True
    margin_left: Optional[float] = None  # in points
    margin_right: Optional[float] = None
    margin_top: Optional[float] = None
    margin_bottom: Optional[float] = None

    @property
    def full_text(self) -> str:
        return "\n".join(p.plain_text for p in self.paragraphs)


class FillDTO(BaseModel):
    """Normalized fill properties for a shape or table cell."""
    fill_type: str = "none"  # "solid", "gradient", "pattern", "texture", "background", "none", "theme", "unsupported"
    color: Optional[str] = None  # hex "#RRGGBB"
    alpha: Optional[float] = None  # 0.0 (transparent) to 1.0 (opaque)


class BorderDTO(BaseModel):
    """Normalized line/border properties for an object."""
    color: Optional[str] = None  # hex "#RRGGBB"
    width: Optional[float] = None  # in virtual canvas points
    width_emu: Optional[int] = None
    style: Optional[str] = "solid"  # "solid", "dashed", "none"


class ImageCropDTO(BaseModel):
    """Source-pixel crop coordinates for an image."""
    x: float = Field(..., ge=0.0, description="Source pixel X offset")
    y: float = Field(..., ge=0.0, description="Source pixel Y offset")
    width: float = Field(..., gt=0.0, description="Source pixel crop width")
    height: float = Field(..., gt=0.0, description="Source pixel crop height")


class ImageAssetDTO(BaseModel):
    """Extracted image asset metadata."""
    asset_id: str
    url: str  # Application-accessible asset URL e.g. /api/editor/assets/{file_id}/{asset_id}
    content_type: str = "image/png"
    original_filename: Optional[str] = None
    width_px: Optional[int] = None
    height_px: Optional[int] = None
    is_local: Optional[bool] = False


class TableCellDTO(BaseModel):
    """Individual table cell with positioning, text, and fill."""
    row_index: int
    col_index: int
    text: str = ""
    text_content: Optional[TextContentDTO] = None
    fill: Optional[FillDTO] = None


class TableDataDTO(BaseModel):
    """Normalized table representation."""
    rows: int
    columns: int
    cells: List[TableCellDTO] = Field(default_factory=list)


class SlideObjectDTO(BaseModel):
    """Normalized presentation object (shape, text box, image, table, etc.)."""
    object_id: str
    name: str
    object_type: str  # "text_box", "shape", "picture", "table", "group", "connector", "unsupported"
    shape_type: Optional[str] = None  # e.g. "RECTANGLE", "ROUNDED_RECTANGLE", "OVAL"
    x: float  # Virtual canvas coordinate (derived from slide dimensions, e.g. 1920x1080)
    y: float
    width: float
    height: float
    x_emu: int  # Native PowerPoint EMUs
    y_emu: int
    width_emu: int
    height_emu: int
    rotation: float = 0.0  # degrees
    z_index: int = 0  # Document order
    fill: Optional[FillDTO] = None
    border: Optional[BorderDTO] = None
    text_content: Optional[TextContentDTO] = None
    image_asset: Optional[ImageAssetDTO] = None
    crop: Optional[ImageCropDTO] = None
    table_data: Optional[TableDataDTO] = None
    is_unsupported: bool = False
    unsupported_reason: Optional[str] = None

    @field_validator("object_type")
    @classmethod
    def validate_object_type(cls, v: str) -> str:
        valid = {"text_box", "shape", "picture", "table", "group", "connector", "unsupported"}
        if v not in valid:
            raise ValueError(f"Invalid object_type '{v}'. Must be one of {valid}")
        return v

    @field_validator("object_id")
    @classmethod
    def validate_object_id(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("object_id cannot be empty")
        return v


class SlideDetailDTO(BaseModel):
    """Detailed normalized slide data with background, speaker notes, and ordered objects."""
    slide_id: str
    slide_number: int  # 1-indexed
    width: float
    height: float
    background_color: Optional[str] = None  # hex "#RRGGBB" or None if unknown/theme
    background_type: str = "solid"  # "solid", "gradient", "image", "default", "none"
    speaker_notes: str = ""
    layout_name: Optional[str] = None
    theme: Optional[str] = None
    objects: List[SlideObjectDTO] = Field(default_factory=list)

    @field_validator("slide_number")
    @classmethod
    def validate_slide_number(cls, v: int) -> int:
        if v < 1:
            raise ValueError("slide_number must be at least 1")
        return v

    @field_validator("slide_id")
    @classmethod
    def validate_slide_id(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("slide_id cannot be empty")
        return v


class PresentationEditorModel(BaseModel):
    """Full normalized Slide-Object Model (SOM) for visual editor consumption."""
    file_id: str
    title: str = "Untitled Presentation"
    slide_width: float = 1920.0
    slide_height: float = 1080.0
    slide_width_emu: int
    slide_height_emu: int
    scale_x: float = 1.0
    scale_y: float = 1.0
    slide_count: int = 0
    theme: Optional[str] = None
    layout_style: Optional[str] = None
    slides: List[SlideDetailDTO] = Field(default_factory=list)
    source_metadata: Dict[str, Any] = Field(default_factory=dict)

    @field_validator("file_id")
    @classmethod
    def validate_file_id(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("file_id cannot be empty")
        return v

    @field_validator("slide_width", "slide_height")
    @classmethod
    def validate_dimensions(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("slide dimension must be greater than 0")
        return v


# =====================================================================
# PPTX Serialization and Export Models (Phase 2.5)
# =====================================================================

class LocalAssetPayload(BaseModel):
    """Base64-encoded client image asset for presentation export."""
    asset_id: str
    mime_type: str = "image/png"
    data_base64: str  # Base64 string (with or without data URL prefix)
    file_name: Optional[str] = None

    @field_validator("asset_id")
    @classmethod
    def validate_asset_id(cls, v: str) -> str:
        if not v or not re.match(r"^[a-zA-Z0-9_\-]{1,128}$", v.strip()):
            raise ValueError(f"Invalid asset_id format: {v}")
        return v.strip()


class ExportPresentationRequest(BaseModel):
    """Request payload for exporting edited presentation to PPTX."""
    model: PresentationEditorModel
    local_assets: List[LocalAssetPayload] = Field(default_factory=list)


class ExportPresentationResponse(BaseModel):
    """Response payload for exported presentation."""
    success: bool = True
    export_id: str
    download_url: str
    output_filename: str
    validation_status: str  # "valid", "warning", "failed"
    warnings: List[str] = Field(default_factory=list)


# =====================================================================
# Complete Notes to Multi-Part Presentation Models (Workstream B)
# =====================================================================

class ContentBlockType(str, Enum):
    """Type of extracted structural content block."""
    HEADING = "heading"
    PARAGRAPH = "paragraph"
    TABLE = "table"
    DEFINITION = "definition"
    PROCESS_STEP = "process_step"
    EXAMPLE = "example"
    EQUATION = "equation"
    LIST_ITEM = "list_item"
    CODE = "code"
    IMAGE = "image"
    CAPTION = "caption"


@dataclass
class ExtractedBlock:
    """A granular block of content extracted from source notes with traceability."""
    block_id: str
    page_number: int  # 1-based source page number
    block_type: ContentBlockType
    raw_text: str
    normalized_text: str
    heading_level: Optional[int] = None
    table_data: Optional[List[List[str]]] = None
    has_equation: bool = False
    is_ocr: bool = False
    confidence: float = 1.0
    image_path: Optional[str] = None
    caption: Optional[str] = None
    bbox: Optional[Tuple[float, float, float, float]] = None
    reading_order: int = 0
    figure_reference: Optional[str] = None


@dataclass
class DocumentExtractionManifest:
    """Manifest tracking source document identity, page count, and extraction warnings."""
    file_path: Optional[str]
    filename: str
    file_hash: str  # SHA-256 of original file
    total_pages: int
    word_count: int
    character_count: int
    is_scanned: bool = False
    extraction_status: str = "complete"  # complete, partial, failed
    warnings: List[str] = field(default_factory=list)
    page_char_counts: Dict[int, int] = field(default_factory=dict)


class DiscoveredSubtopicDTO(BaseModel):
    """A subtopic or thematic subdivision discovered from notes."""
    subtopic_id: str
    title: str
    is_inferred: bool = False
    page_start: int = 1
    page_end: int = 1
    key_concepts: List[str] = Field(default_factory=list)
    summary: str = ""


class DiscoveredTopicDTO(BaseModel):
    """A high-level topic discovered from lecture notes without requiring a table of contents."""
    topic_id: str
    title: str
    is_inferred: bool = False
    page_start: int = 1
    page_end: int = 1
    subtopics: List[DiscoveredSubtopicDTO] = Field(default_factory=list)
    key_concepts: List[str] = Field(default_factory=list)
    confidence: float = 1.0
    summary: str = ""


class ContentUnitStatus(str, Enum):
    """Lifecycle status of an atomic content unit."""
    PLANNED = "planned"
    GENERATED = "generated"
    VALIDATED = "validated"
    OMITTED = "omitted"
    REQUIRES_REVIEW = "requires_review"


class ContentUnitDTO(BaseModel):
    """Atomic content unit for strict end-to-end curriculum coverage tracking."""
    unit_id: str
    topic_id: str
    subtopic_id: Optional[str] = None
    title: str
    unit_type: str = "explanation"  # definition, process, comparison, explanation, example, formula, table, summary, diagram
    source_pages: List[int] = Field(default_factory=list)
    key_points: List[str] = Field(default_factory=list)
    assigned_part: int = 1
    assigned_slide_num: Optional[int] = None
    assigned_slide_range: Optional[str] = None
    status: ContentUnitStatus = ContentUnitStatus.PLANNED
    omission_reason: Optional[str] = None
    confidence: float = 1.0
    warnings: List[str] = Field(default_factory=list)
    image_path: Optional[str] = None
    caption: Optional[str] = None
    figure_reference: Optional[str] = None


class PartPlanDTO(BaseModel):
    """Specification for one planned PowerPoint presentation in the multi-part deck."""
    part_number: int
    title: str
    subtitle: str = "Lecture & Curriculum Notes"
    theme_focus: str = ""
    target_slides: int = 20
    planned_slides: int = 20
    topic_ids: List[str] = Field(default_factory=list)
    unit_ids: List[str] = Field(default_factory=list)
    is_final_part: bool = False
    continuation_from_part: Optional[int] = None


class MultiPartPlanDTO(BaseModel):
    """Global structured outline and multi-part allocation plan for the entire document."""
    job_id: str
    document_name: str
    document_hash: str
    total_pages: int
    slides_per_part: int = 20
    content_density: str = "balanced"  # concise, balanced, detailed
    total_parts: int = 1
    total_slides: int = 20
    topics: List[DiscoveredTopicDTO] = Field(default_factory=list)
    content_units: List[ContentUnitDTO] = Field(default_factory=list)
    parts: List[PartPlanDTO] = Field(default_factory=list)
    density_warning: Optional[str] = None
    recommended_adjustment: Optional[str] = None
    extraction_warnings: List[str] = Field(default_factory=list)


class PartResultDTO(BaseModel):
    """Metadata and download links for a planned or generated PowerPoint part."""
    part_number: int
    title: str
    file_id: str = ""
    filename: str = ""
    download_url: str = ""
    slide_count: int = 0
    planned_slides: int = 0
    requested_max_slides: int = 20
    actual_exported_slides: int = 0
    hard_limit_passed: bool = True
    serious_layout_issues_detected: int = 0
    issues_automatically_repaired: int = 0
    warnings: List[str] = Field(default_factory=list)
    status: str = "completed"  # pending, generating, completed, failed
    error_message: Optional[str] = None
    preview_urls: List[str] = Field(default_factory=list)
    file_size_bytes: int = 0
    generation_duration_seconds: Optional[float] = None
    generation_stage: Optional[str] = None
    source_page_start: Optional[int] = None
    source_page_end: Optional[int] = None
    assigned_topics: List[str] = Field(default_factory=list)


class CoverageReportDTO(BaseModel):
    """Detailed audit report verifying content preservation and quality across all parts."""
    source_pages_extracted: int = 0
    content_units_discovered: int = 0
    topics_detected: int = 0
    topics_covered: int = 0
    content_units_mapped: int = 0
    items_requiring_review: int = 0
    slides_generated: int = 0
    parts_generated: int = 0
    hard_limit_enforced: bool = True
    total_serious_layout_issues: int = 0
    total_issues_repaired: int = 0
    quality_score: int = 100
    status: str = "complete"  # complete, validated_with_warnings, incomplete
    warnings: List[str] = Field(default_factory=list)
    figure_audit: List[Dict[str, Any]] = Field(default_factory=list)


class MultiPartJobStatus(str, Enum):
    """Operational execution states for multi-part processing jobs."""
    UPLOADING = "uploading"
    EXTRACTING = "extracting"
    DISCOVERING_TOPICS = "discovering_topics"
    BUILDING_OUTLINE = "building_outline"
    PLANNING_ALLOCATION = "planning_allocation"
    AWAITING_APPROVAL = "awaiting_approval"
    GENERATING_PARTS = "generating_parts"
    VALIDATING = "validating"
    PACKAGING_ZIP = "packaging_zip"
    COMPLETED = "completed"
    COMPLETED_WITH_WARNINGS = "completed_with_warnings"
    FAILED = "failed"


class MultiPartJobDTO(BaseModel):
    """Persistent job state tracking multi-part lecture note conversion."""
    job_id: str
    status: MultiPartJobStatus = MultiPartJobStatus.EXTRACTING
    step_index: int = 1
    step_name: str = "Extracting document content"
    message: str = "Analyzing document structure..."
    progress_percent: int = 10
    document_name: str
    document_hash: str
    slides_per_part: int = 20
    content_density: str = "balanced"
    mode: str = "ai"
    theme: str = "academic_navy"
    layout_style: str = "smart_mixed"
    include_examples: bool = True
    include_definitions: bool = True
    include_equations: bool = True
    include_summaries: bool = True
    include_revision_questions: bool = True
    plan: Optional[MultiPartPlanDTO] = None
    parts: List[PartResultDTO] = Field(default_factory=list)
    coverage_report: Optional[CoverageReportDTO] = None
    zip_filename: Optional[str] = None
    zip_download_url: Optional[str] = None
    error: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class ApproveMultiPartPlanRequest(BaseModel):
    """Request payload to approve or customize outline before multi-part generation."""
    revised_plan: Optional[MultiPartPlanDTO] = None



