"""
FastAPI Backend Application for Acadion AI PPT Generator (Phase 5).
Provides REST endpoints for presentation generation, plan preview,
editing, and secure presentation downloads.
"""

import copy
from datetime import datetime
import hashlib
import os
from pathlib import Path
import re
import tempfile
from typing import Any, Dict, List, Optional
import uuid

import dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from app.content_parser import ContentParser
from app.document_loader import DocumentLoader
from app.gemini_service import GeminiContentPlanner
from app.models import (
    BulletPoint,
    CorruptedDocumentError,
    DocumentIngestionError,
    EmptyContentError,
    EncryptedDocumentError,
    FileSizeLimitExceededError,
    GeminiAuthenticationError,
    GeminiOutputValidationError,
    GeminiQuotaExceededError,
    GeminiServiceError,
    InputFileNotFoundError,
    InvalidContentError,
    MissingAPIKeyError,
    ModelUnavailableError,
    PPTGeneratorError,
    PresentationData,
    PresentationEditorModel,
    PresentationParseError,
    AssetNotFoundError,
    ScannedDocumentError,
    Section,
    SectionType,
    SlideVisual,
    TextLengthLimitExceededError,
    UnsupportedFileTypeError,
    VisualType,
    ExportPresentationRequest,
    ExportPresentationResponse,
    LocalAssetPayload,
    MultiPartJobDTO,
    MultiPartJobStatus,
    MultiPartPlanDTO,
    ApproveMultiPartPlanRequest,
    PartResultDTO,
    CoverageReportDTO,
)
from app.notes_extractor import NotesExtractor
from app.topic_discovery import TopicDiscoveryEngine
from app.multi_part_planner import MultiPartPlanner
from app.multi_part_generator import MultiPartGenerator
from app.multi_part_zip import MultiPartZipPackager
from app.layouts import THEMES, list_layouts, list_themes, get_theme, auto_select_theme
from app.ppt_generator import PPTGenerator
from app.pptx_parser import parse_presentation
from app.pptx_serializer import serialize_presentation, SerializationError, ValidationError
from app.preview_renderer import render_pptx_previews
from app.template_importer import TemplateImporter
from app.providers import (
    NativePresentationProvider,
)
from app.qa_engine import PresentationQAEngine

# Load local environment variables (never exposed to client)
dotenv.load_dotenv()

# Dedicated directory for web-generated presentations
STORAGE_DIR = Path("output/web_generated").resolve()
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

# Dedicated directory for exported edited presentations (Phase 2.5)
EXPORTS_DIR = (STORAGE_DIR / "exports").resolve()
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)

# In-memory registry of generated file metadata
_GENERATED_REGISTRY: Dict[str, Dict[str, Any]] = {}

# In-memory registry of exported file metadata (Phase 2.5)
_EXPORTED_REGISTRY: Dict[str, Dict[str, Any]] = {}

# In-memory Gemini plan cache: sha256(extracted_text) -> PresentationData (avoids duplicate Gemini API calls)
_GEMINI_PLAN_CACHE: Dict[str, PresentationData] = {}

app = FastAPI(
    title="Acadion AI PPT Generator API",
    version="0.5.0",
    description="Local HTTP API for educational presentation generation and editing.",
)

# CORS restricted to local development origins
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# =====================================================================
# Pydantic Request & Response Schemas
# =====================================================================

class HealthResponse(BaseModel):
    status: str = "healthy"
    version: str = "0.5.0"
    modes: List[str] = ["deterministic", "ai"]
    ai_configured: bool
    model: str
    available_providers: List[str] = Field(default_factory=lambda: ["native"])


class SlideBulletDTO(BaseModel):
    prefix: Optional[str] = None
    text: str
    display_text: str = ""


class SlidePreviewDTO(BaseModel):
    slide_number: int
    title: str
    subtitle: Optional[str] = ""
    type: str = "content"
    bullets: List[SlideBulletDTO] = Field(default_factory=list)
    speaker_notes: Optional[str] = ""
    visual_type: str = "none"
    image_url: Optional[str] = None


class PresentationResponse(BaseModel):
    file_id: str
    download_url: str
    filename: str
    title: str
    subtitle: str
    mode: str
    theme: str = "academic_navy"
    layout_style: str = "smart_mixed"
    slide_count: int
    file_size_bytes: int
    slides: List[SlidePreviewDTO]
    source_metadata: Dict[str, Any]
    preview_urls: List[str] = Field(default_factory=list)
    provider: str = "native"
    qa_report: Optional[Dict[str, Any]] = None


class SlideEditDTO(BaseModel):
    title: str
    bullets: List[SlideBulletDTO] = Field(default_factory=list)
    speaker_notes: Optional[str] = ""
    visual_type: Optional[str] = "none"


class RegeneratePlanRequest(BaseModel):
    title: str
    subtitle: Optional[str] = "Educational Curriculum & Lecture Notes"
    theme: Optional[str] = "academic_navy"
    layout_style: Optional[str] = "smart_mixed"
    slides: List[SlideEditDTO]


class RethemeRequest(BaseModel):
    file_id: str
    theme: str
    layout_style: Optional[str] = None



# =====================================================================
# Exception Handlers
# =====================================================================

@app.exception_handler(UnsupportedFileTypeError)
async def unsupported_file_handler(request, exc: UnsupportedFileTypeError):
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"error": "UnsupportedFileType", "detail": str(exc)},
    )


@app.exception_handler(FileSizeLimitExceededError)
async def file_size_limit_handler(request, exc: FileSizeLimitExceededError):
    return JSONResponse(
        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
        content={"error": "FileSizeLimitExceeded", "detail": str(exc)},
    )


@app.exception_handler(TextLengthLimitExceededError)
async def text_length_limit_handler(request, exc: TextLengthLimitExceededError):
    return JSONResponse(
        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
        content={"error": "TextLengthLimitExceeded", "detail": str(exc)},
    )


@app.exception_handler(ScannedDocumentError)
async def scanned_document_handler(request, exc: ScannedDocumentError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "ScannedDocumentError",
            "detail": str(exc),
            "hint": "Scanned or image-only documents require OCR, which is not supported. Please paste text directly.",
        },
    )


@app.exception_handler(CorruptedDocumentError)
async def corrupted_document_handler(request, exc: CorruptedDocumentError):
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"error": "CorruptedDocument", "detail": str(exc)},
    )


@app.exception_handler(EncryptedDocumentError)
async def encrypted_document_handler(request, exc: EncryptedDocumentError):
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"error": "EncryptedDocument", "detail": str(exc)},
    )


@app.exception_handler(EmptyContentError)
async def empty_content_handler(request, exc: EmptyContentError):
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"error": "EmptyContent", "detail": str(exc)},
    )


@app.exception_handler(InvalidContentError)
async def invalid_content_handler(request, exc: InvalidContentError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": "InvalidContent", "detail": str(exc)},
    )


@app.exception_handler(MissingAPIKeyError)
async def missing_api_key_handler(request, exc: MissingAPIKeyError):
    return JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content={
            "error": "MissingAPIKey",
            "detail": "AI presentation planning requires an API key in backend configuration.",
            "hint": "Set API key in backend configuration or choose Rule-Based (Deterministic Mode).",
            "can_fallback_rule_based": True,
        },
    )


@app.exception_handler(GeminiAuthenticationError)
async def gemini_auth_handler(request, exc: GeminiAuthenticationError):
    return JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content={
            "error": "AuthenticationFailed",
            "detail": "AI engine authentication failed. Please check the backend configuration.",
            "hint": "You can switch to Rule-Based mode to generate presentations offline.",
            "can_fallback_rule_based": True,
        },
    )


@app.exception_handler(GeminiQuotaExceededError)
async def gemini_quota_handler(request, exc: GeminiQuotaExceededError):
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={
            "error": "QuotaExceeded",
            "detail": "AI generation rate limit or service quota was reached.",
            "hint": "You can immediately generate this presentation using Rule-Based mode without any wait.",
            "can_fallback_rule_based": True,
        },
    )


@app.exception_handler(ModelUnavailableError)
async def model_unavailable_handler(request, exc: ModelUnavailableError):
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "error": "ModelUnavailable",
            "detail": "The requested AI design model is currently unavailable.",
            "hint": "Please switch to Rule-Based mode for instant offline generation.",
            "can_fallback_rule_based": True,
        },
    )


@app.exception_handler(GeminiOutputValidationError)
async def gemini_validation_handler(request, exc: GeminiOutputValidationError):
    return JSONResponse(
        status_code=status.HTTP_502_BAD_GATEWAY,
        content={
            "error": "PlanValidationFailed",
            "detail": "AI presentation plan validation failed to satisfy educational schema requirements.",
            "hint": "You can generate this presentation directly using Rule-Based mode.",
            "can_fallback_rule_based": True,
        },
    )


@app.exception_handler(GeminiServiceError)
async def gemini_service_handler(request, exc: GeminiServiceError):
    return JSONResponse(
        status_code=status.HTTP_502_BAD_GATEWAY,
        content={
            "error": "AIServiceError",
            "detail": str(exc),
            "hint": "AI engine encountered a temporary error. You can generate using Rule-Based mode.",
            "can_fallback_rule_based": True,
        },
    )


@app.exception_handler(PresentationParseError)
async def presentation_parse_handler(request, exc: PresentationParseError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": "PresentationParseError", "detail": str(exc)},
    )


@app.exception_handler(AssetNotFoundError)
async def asset_not_found_handler(request, exc: AssetNotFoundError):
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"error": "AssetNotFound", "detail": str(exc)},
    )


@app.exception_handler(SerializationError)
async def serialization_error_handler(request, exc: SerializationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": "SerializationError", "detail": str(exc)},
    )


@app.exception_handler(ValidationError)
async def validation_error_handler(request, exc: ValidationError):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": "ValidationError", "detail": str(exc)},
    )


@app.exception_handler(PPTGeneratorError)
async def ppt_generator_handler(request, exc: PPTGeneratorError):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": "PPTGeneratorError", "detail": str(exc)},
    )


# =====================================================================
# Helper Utilities
# =====================================================================

def _sanitize_filename(name: str) -> str:
    """Sanitize title for safe cross-platform file naming."""
    clean = re.sub(r"[^a-zA-Z0-9_\- ]", "", name).strip().replace(" ", "_")
    return clean[:50] or "presentation"


def _build_slide_previews(
    data: PresentationData,
    file_id: Optional[str] = None,
    layout_style: str = "smart_mixed",
) -> List[SlidePreviewDTO]:
    """Convert PresentationData into a structured slide card preview using PPTGenerator's slide planner."""
    generator = PPTGenerator(layout_style=layout_style)
    slide_plans = generator._plan_slides(data, layout_style=layout_style)
    previews: List[SlidePreviewDTO] = []

    for plan in slide_plans:
        stype = plan["type"]
        snum = plan["slide_num"]
        snotes = plan.get("speaker_notes", "")
        vtype = "none"
        bullets_dto: List[SlideBulletDTO] = []
        subtitle = ""

        if stype == "title":
            title = data.title
            subtitle = data.subtitle or "Educational Curriculum & Lecture Notes"
        elif stype == "overview":
            sec = plan.get("section")
            title = sec.title if sec else "Lecture Overview & Curriculum Agenda"
            if sec and sec.bullets:
                bullets_dto = [
                    SlideBulletDTO(prefix=b.prefix, text=b.text, display_text=b.display_text)
                    for b in sec.bullets
                ]
            else:
                bullets_dto = [
                    SlideBulletDTO(prefix=f"Topic {i+1:02d}", text=s.title, display_text=f"Topic {i+1:02d}: {s.title}")
                    for i, s in enumerate(data.content_sections)
                ]
        elif stype == "section_divider":
            title = plan.get("title", "Curriculum Section")
            subtitle = plan.get("subtitle", "")
        elif stype == "summary":
            sec = plan.get("section")
            title = sec.title if sec else "Summary & Key Takeaways"
            if sec and sec.bullets:
                bullets_dto = [
                    SlideBulletDTO(prefix=b.prefix, text=b.text, display_text=b.display_text)
                    for b in sec.bullets
                ]
        elif stype == "visual":
            title = plan.get("title", "Visual Analysis")
            vis = plan.get("visual")
            vtype = vis.visual_type.value if vis else "none"
            raw_bullets = plan.get("bullets", [])
            bullets_dto = [
                SlideBulletDTO(prefix=b.prefix, text=b.text, display_text=b.display_text)
                for b in raw_bullets
            ]
        else:  # editorial, asymmetric, case_study, multi_column, discussion, cards_grid, two_column, stats_metrics, split, content
            title = plan.get("title", "Module Content")
            subtitle = plan.get("key_message") or plan.get("teaching_objective") or ""
            raw_bullets = plan.get("bullets", [])
            bullets_dto = [
                SlideBulletDTO(prefix=b.prefix, text=b.text, display_text=b.display_text)
                for b in raw_bullets
            ]

        img_url = f"/api/preview/{file_id}/{snum}" if file_id else None

        previews.append(
            SlidePreviewDTO(
                slide_number=snum,
                title=title,
                subtitle=subtitle,
                type=stype,
                bullets=bullets_dto,
                speaker_notes=snotes,
                visual_type=vtype,
                image_url=img_url,
            )
        )

    return previews



# =====================================================================
# API Endpoints
# =====================================================================

@app.get("/health", response_model=HealthResponse)
@app.get("/api/health", response_model=HealthResponse)
async def get_health():
    """Health check endpoint reporting API status and configuration."""
    api_key = os.getenv("GEMINI_API_KEY", "").strip()

    return HealthResponse(
        status="healthy",
        version="0.5.0",
        modes=["deterministic", "ai"],
        ai_configured=bool(api_key),
        model=os.getenv("GEMINI_MODEL", GeminiContentPlanner.DEFAULT_MODEL),
        available_providers=["native"],
    )


@app.get("/api/themes")
async def get_themes():
    """Return all available presentation themes and color palettes."""
    return list_themes()


@app.get("/api/layouts")
async def get_layouts():
    """Return all available presentation layout styles."""
    return list_layouts()


@app.post("/api/templates/import")
async def import_template(
    file: UploadFile = File(...),
    template_name: Optional[str] = Form(None),
):
    """Inspect a local PPTX template, extract its color palette and typography, and register custom theme."""
    if not file.filename or not file.filename.lower().endswith(".pptx"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PowerPoint presentation templates (.pptx) can be imported.",
        )
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir) / file.filename
        content = await file.read()
        if len(content) == 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded template file is empty.")
        temp_path.write_bytes(content)

        importer = TemplateImporter()
        report = importer.inspect_and_import(temp_path, custom_name=template_name)
        theme = get_theme(report.theme_id)

        return {
            "status": "success",
            "is_compatible": report.is_compatible,
            "theme_id": report.theme_id,
            "display_name": report.display_name,
            "is_dark": report.is_dark,
            "theme": {
                "id": theme.id,
                "display_name": theme.display_name,
                "description": theme.description,
                "is_dark": theme.is_dark,
                "colors": {
                    "primary": theme.hex_primary,
                    "secondary": theme.hex_secondary,
                    "accent": theme.hex_accent,
                    "bg": theme.hex_bg,
                    "card": theme.hex_card,
                },
            },
            "analysis": {
                "template_name": report.display_name,
                "slide_dimensions": report.slide_dimensions,
                "is_widescreen": report.widescreen_16_9,
                "detected_mode": "Dark Theme" if report.is_dark else "Light Theme",
                "primary_color": report.hex_primary,
                "secondary_color": report.hex_secondary,
                "accent_color": report.hex_accent,
                "background_color": report.hex_bg,
                "font_heading": report.font_heading,
                "font_body": report.font_body,
                "slide_count": report.total_template_slides,
                "has_layouts": True,
                "compatibility_notes": report.notes,
            },
            "colors": report.colors,
            "limitations": report.limitations,
            "notes": report.notes,
            "slide_dimensions": report.slide_dimensions,
            "widescreen_16_9": report.widescreen_16_9,
        }


@app.post("/api/generate", response_model=PresentationResponse)
async def generate_presentation(
    notes_text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    mode: str = Form("ai"),
    theme: Optional[str] = Form("academic_navy"),
    layout_style: Optional[str] = Form("smart_mixed"),
    title_override: Optional[str] = Form(None),
    subtitle_override: Optional[str] = Form(None),
    institution_override: Optional[str] = Form(None),
    model: Optional[str] = Form(None),
    provider: Optional[str] = Form("native"),
):
    """Generate an educational presentation from pasted text or uploaded document.
    
    Accepts:
        - notes_text: Direct pasted educational notes
        - file: Uploaded TXT, PDF, or DOCX document
        - mode: 'deterministic' or 'ai'
        - theme: Selected presentation theme ID (e.g. 'academic_navy', 'clean_light', 'dark_tech') or 'auto'
        - layout_style: Selected slide layout family ID (e.g. 'smart_mixed', 'two_column', 'cards_grid') or 'auto'
        - title_override: Optional custom presentation title
        - subtitle_override: Optional custom subtitle
        - institution_override: Optional institution / branding
        - model: Optional model override
        - provider: Generation engine provider (always 'native')
    """
    mode = mode.lower().strip()

    if mode not in ("deterministic", "ai"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid generation mode '{mode}'. Choose 'deterministic' or 'ai'.",
        )

    has_text = bool(notes_text and notes_text.strip())
    has_file = bool(file and file.filename)

    if not has_text and not has_file:
        raise EmptyContentError("Please provide either pasted lecture notes or upload a document file.")

    loader = DocumentLoader()
    extracted_text = ""
    doc_metadata = None

    # Handle file upload
    if has_file:
        filename = file.filename or "upload"
        ext = Path(filename).suffix.lower()
        if ext not in loader.SUPPORTED_EXTENSIONS:
            supported = ", ".join(sorted(loader.SUPPORTED_EXTENSIONS))
            raise UnsupportedFileTypeError(
                f"File format '{ext}' is not supported. Please upload a {supported} file."
            )

        # Save to safe temporary file and extract
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir) / f"upload_{uuid.uuid4().hex}{ext}"
            file_bytes = await file.read()
            if len(file_bytes) == 0:
                raise EmptyContentError(f"Uploaded file '{filename}' is empty (0 bytes).")

            temp_path.write_bytes(file_bytes)
            # Ingest and validate document
            extracted_text, doc_metadata = loader.load(temp_path)
            doc_metadata.source_description = f"Uploaded {ext.upper().lstrip('.')} ({filename})"

    # Handle direct text
    elif has_text:
        extracted_text, doc_metadata = loader.load_text(notes_text)

    # Presentation Planning with duplicate-call prevention
    data: PresentationData
    if mode == "deterministic":
        parser = ContentParser()
        data = parser.parse_text(extracted_text)
    else:
        text_hash = hashlib.sha256(extracted_text.encode("utf-8")).hexdigest()
        if text_hash in _GEMINI_PLAN_CACHE:
            data = copy.deepcopy(_GEMINI_PLAN_CACHE[text_hash])
        else:
            planner = GeminiContentPlanner(model=model)
            data = planner.plan_from_text(extracted_text)
            _GEMINI_PLAN_CACHE[text_hash] = copy.deepcopy(data)

    # Apply overrides if specified
    if title_override and title_override.strip():
        data.title = title_override.strip()
    if subtitle_override and subtitle_override.strip():
        data.subtitle = subtitle_override.strip()
    if institution_override and institution_override.strip():
        data.institution = institution_override.strip()

    # Theme Resolution: Respect user selected theme; fall back cleanly to academic_navy if not found
    effective_theme = (theme or "").strip().lower()
    if effective_theme in ("auto", "default", "", "none"):
        effective_theme = getattr(data, "recommended_theme", None) or auto_select_theme(data.title, extracted_text)
    if effective_theme not in THEMES:
        effective_theme = "academic_navy"

    # Layout Resolution: Respect user selected layout family; default to smart_mixed
    effective_layout = (layout_style or "").strip().lower()
    if effective_layout in ("auto", "default", "", "none"):
        effective_layout = "smart_mixed"

    # Generate PPTX
    file_id = str(uuid.uuid4())
    safe_title = _sanitize_filename(data.title)
    pptx_filename = f"{safe_title}_{file_id[:8]}.pptx"
    out_file_path = STORAGE_DIR / f"{file_id}.pptx"

    active_provider = "native"
    generator = PPTGenerator(theme=effective_theme, layout_style=effective_layout)
    resolved_path = generator.generate(data, str(out_file_path), layout_style=effective_layout)

    file_size = os.path.getsize(resolved_path)

    # Render high-resolution slide previews
    preview_dir = STORAGE_DIR / f"{file_id}_previews"
    render_pptx_previews(Path(resolved_path), preview_dir)

    # Build slide preview DTOs with image URLs
    slide_previews = _build_slide_previews(data, file_id=file_id, layout_style=effective_layout)
    preview_urls = [s.image_url for s in slide_previews if s.image_url]

    # Run Shared Quality Assurance Check
    qa_engine = PresentationQAEngine()
    qa_rep = qa_engine.evaluate_presentation(resolved_path, plan_or_data=data)
    qa_report_dict = {
        "status": qa_rep.status,
        "overall_score": qa_rep.overall_score,
        "is_acceptable": qa_rep.is_acceptable,
        "cards_grid_ratio": qa_rep.cards_grid_ratio,
        "consecutive_repetition_count": qa_rep.consecutive_repetition_count,
        "total_slides": qa_rep.total_slides,
        "archetypes_used": qa_rep.archetypes_used,
        "recommendations": qa_rep.recommendations,
        "checks": [{"name": c.name, "passed": c.passed, "score": c.score, "detail": c.detail} for c in qa_rep.checks],
    }

    # Save metadata in registry
    source_meta = {
        "file_type": doc_metadata.file_type if doc_metadata else "raw_text",
        "page_count": doc_metadata.page_count if doc_metadata else 1,
        "word_count": doc_metadata.word_count if doc_metadata else len(extracted_text.split()),
        "character_count": doc_metadata.character_count if doc_metadata else len(extracted_text),
        "description": doc_metadata.source_description if doc_metadata else "Lecture Notes",
        "theme_rationale": getattr(data, "theme_rationale", ""),
    }
    _GENERATED_REGISTRY[file_id] = {
        "file_id": file_id,
        "file_path": str(resolved_path),
        "filename": pptx_filename,
        "title": data.title,
        "theme": effective_theme,
        "layout_style": effective_layout,
        "mode": mode,
        "provider": active_provider,
        "slide_count": len(slide_previews),
        "created_at": datetime.now().isoformat(),
        "presentation_data": data,
        "source_metadata": source_meta,
        "qa_report": qa_report_dict,
    }

    return PresentationResponse(
        file_id=file_id,
        download_url=f"/api/download/{file_id}",
        filename=pptx_filename,
        title=data.title,
        subtitle=data.subtitle,
        mode=mode,
        theme=effective_theme,
        layout_style=effective_layout,
        slide_count=len(slide_previews),
        file_size_bytes=file_size,
        slides=slide_previews,
        preview_urls=preview_urls,
        source_metadata=source_meta,
        provider=active_provider,
        qa_report=qa_report_dict,
    )


@app.post("/api/generate-from-plan", response_model=PresentationResponse)
async def generate_from_edited_plan(request: RegeneratePlanRequest):
    """Regenerate PowerPoint file from teacher's edited slide plan.
    
    Allows editing slide titles, bullet texts, and speaker notes directly
    in the preview UI and producing an updated PowerPoint presentation.
    """
    if not request.title or not request.title.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Presentation title cannot be empty.",
        )
    if not request.slides:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one content slide is required.",
        )

    sections: List[Section] = []
    for s_dto in request.slides:
        bullets = [
            BulletPoint(text=b.text, prefix=b.prefix)
            for b in s_dto.bullets
            if b.text.strip()
        ]
        sections.append(
            Section(
                title=s_dto.title.strip(),
                bullets=bullets,
                speaker_notes=s_dto.speaker_notes or "",
                section_type=SectionType.CONTENT,
            )
        )

    presentation_data = PresentationData(
        title=request.title.strip(),
        subtitle=request.subtitle or "Educational Curriculum & Lecture Notes",
        content_sections=sections,
    )

    theme_to_use = request.theme or "academic_navy"
    layout_to_use = request.layout_style or "smart_mixed"
    file_id = str(uuid.uuid4())
    safe_title = _sanitize_filename(presentation_data.title)
    pptx_filename = f"{safe_title}_{file_id[:8]}.pptx"
    out_file_path = STORAGE_DIR / f"{file_id}.pptx"

    generator = PPTGenerator(theme=theme_to_use, layout_style=layout_to_use)
    resolved_path = generator.generate(presentation_data, str(out_file_path), layout_style=layout_to_use)
    file_size = os.path.getsize(resolved_path)

    # Render high-resolution slide previews for regenerated presentation
    preview_dir = STORAGE_DIR / f"{file_id}_previews"
    render_pptx_previews(Path(resolved_path), preview_dir)

    # Build slide preview DTOs with image URLs
    slide_previews = _build_slide_previews(presentation_data, file_id=file_id, layout_style=layout_to_use)
    preview_urls = [s.image_url for s in slide_previews if s.image_url]

    source_meta = {"file_type": "edited_plan", "description": "Teacher Edited Slide Plan"}
    qa_engine = PresentationQAEngine()
    qa_rep = qa_engine.evaluate_presentation(resolved_path, plan_or_data=presentation_data)
    qa_report_dict = {
        "status": qa_rep.status,
        "overall_score": qa_rep.overall_score,
        "is_acceptable": qa_rep.is_acceptable,
        "cards_grid_ratio": qa_rep.cards_grid_ratio,
        "consecutive_repetition_count": qa_rep.consecutive_repetition_count,
        "total_slides": qa_rep.total_slides,
        "archetypes_used": qa_rep.archetypes_used,
        "recommendations": qa_rep.recommendations,
        "checks": [{"name": c.name, "passed": c.passed, "score": c.score, "detail": c.detail} for c in qa_rep.checks],
    }

    _GENERATED_REGISTRY[file_id] = {
        "file_id": file_id,
        "file_path": str(resolved_path),
        "filename": pptx_filename,
        "title": presentation_data.title,
        "theme": theme_to_use,
        "layout_style": layout_to_use,
        "mode": "edited_plan",
        "provider": "native",
        "slide_count": len(slide_previews),
        "created_at": datetime.now().isoformat(),
        "presentation_data": presentation_data,
        "source_metadata": source_meta,
        "qa_report": qa_report_dict,
    }

    return PresentationResponse(
        file_id=file_id,
        download_url=f"/api/download/{file_id}",
        filename=pptx_filename,
        title=presentation_data.title,
        subtitle=presentation_data.subtitle,
        mode="edited_plan",
        theme=theme_to_use,
        layout_style=layout_to_use,
        slide_count=len(slide_previews),
        file_size_bytes=file_size,
        slides=slide_previews,
        preview_urls=preview_urls,
        source_metadata=source_meta,
        provider="native",
        qa_report=qa_report_dict,
    )


@app.post("/api/retheme", response_model=PresentationResponse)
async def retheme_presentation(request: RethemeRequest):
    """Regenerate an existing presentation under a new PowerPoint theme or layout style.
    
    Re-renders all slides with the newly chosen color scheme, cards, typography,
    and native PowerPoint shapes, while preserving all content and speaker notes.
    """
    if not re.match(r"^[0-9a-fA-F\-]{36}$", request.file_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file identifier format.",
        )

    entry = _GENERATED_REGISTRY.get(request.file_id)
    if not entry or "presentation_data" not in entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Original presentation data not found in session registry. Please generate a new presentation.",
        )

    presentation_data: PresentationData = entry["presentation_data"]
    theme_to_use = request.theme or entry.get("theme", "academic_navy")
    layout_to_use = request.layout_style or entry.get("layout_style", "smart_mixed")

    file_id = str(uuid.uuid4())
    safe_title = _sanitize_filename(presentation_data.title)
    pptx_filename = f"{safe_title}_{theme_to_use}_{file_id[:8]}.pptx"
    out_file_path = STORAGE_DIR / f"{file_id}.pptx"

    generator = PPTGenerator(theme=theme_to_use, layout_style=layout_to_use)
    resolved_path = generator.generate(presentation_data, str(out_file_path), layout_style=layout_to_use)
    file_size = os.path.getsize(resolved_path)

    # Render high-resolution slide previews
    preview_dir = STORAGE_DIR / f"{file_id}_previews"
    render_pptx_previews(Path(resolved_path), preview_dir)

    slide_previews = _build_slide_previews(presentation_data, file_id=file_id, layout_style=layout_to_use)
    preview_urls = [s.image_url for s in slide_previews if s.image_url]

    source_meta = entry.get("source_metadata", {"file_type": "rethemed", "description": "Theme/Layout Switched"})
    _GENERATED_REGISTRY[file_id] = {
        "file_id": file_id,
        "file_path": str(resolved_path),
        "filename": pptx_filename,
        "title": presentation_data.title,
        "theme": theme_to_use,
        "layout_style": layout_to_use,
        "mode": entry.get("mode", "deterministic"),
        "slide_count": len(slide_previews),
        "created_at": datetime.now().isoformat(),
        "presentation_data": presentation_data,
        "source_metadata": source_meta,
    }

    return PresentationResponse(
        file_id=file_id,
        download_url=f"/api/download/{file_id}",
        filename=pptx_filename,
        title=presentation_data.title,
        subtitle=presentation_data.subtitle,
        mode=entry.get("mode", "deterministic"),
        theme=theme_to_use,
        layout_style=layout_to_use,
        slide_count=len(slide_previews),
        file_size_bytes=file_size,
        slides=slide_previews,
        preview_urls=preview_urls,
        source_metadata=source_meta,
    )



@app.get("/api/download/{file_id}")
async def download_presentation(file_id: str):
    """Securely download a generated PowerPoint (.pptx) file.
    
    Protects against path traversal by enforcing UUID format validation.
    """
    # Strict UUID validation to prevent path traversal
    if not re.match(r"^[0-9a-fA-F\-]{36}$", file_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file identifier format.",
        )

    file_path = STORAGE_DIR / f"{file_id}.pptx"
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The requested presentation file was not found or has expired.",
        )

    entry = _GENERATED_REGISTRY.get(file_id, {})
    download_filename = entry.get("filename", f"presentation_{file_id[:8]}.pptx")

    return FileResponse(
        path=str(file_path),
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        filename=download_filename,
    )


@app.get("/api/preview/{file_id}/{slide_number}")
async def get_slide_preview(file_id: str, slide_number: int):
    """Serve generated high-fidelity slide preview PNG image.
    
    Enforces strict UUID validation and integer slide index bounds to prevent
    directory traversal attacks.
    """
    if not re.match(r"^[0-9a-fA-F\-]{36}$", file_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file identifier format.",
        )
    if slide_number < 1 or slide_number > 200:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Slide number must be between 1 and 200.",
        )

    image_path = STORAGE_DIR / f"{file_id}_previews" / f"slide_{slide_number}.png"
    if not image_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Preview image for slide {slide_number} not found.",
        )

    return FileResponse(
        path=str(image_path),
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=3600"},
    )


# =====================================================================
# Read-Only Visual Editor Endpoints (Phase 2.1)
# =====================================================================

@app.get("/api/editor/{file_id}", response_model=PresentationEditorModel)
async def get_presentation_for_editor(file_id: str):
    """Retrieve normalized Slide-Object Model (SOM) for PowerPoint canvas visual editing.
    
    Validates file_id against path traversal attacks, resolves the PPTX file,
    and returns slides, objects, coordinates, typography, and embedded assets.
    """
    # Strict UUID validation to prevent path traversal
    if not re.match(r"^[0-9a-fA-F\-]{36}$", file_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file identifier format.",
        )

    file_path = STORAGE_DIR / f"{file_id}.pptx"
    # Secondary path traversal defense: verify file is strictly inside STORAGE_DIR
    try:
        resolved_path = file_path.resolve()
        if not resolved_path.is_relative_to(STORAGE_DIR.resolve()):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file path.",
            )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file path.",
        )

    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The requested presentation file was not found or has expired.",
        )

    # Check for session/registry metadata if available
    registry_meta = _GENERATED_REGISTRY.get(file_id)

    try:
        model = parse_presentation(
            pptx_path=file_path,
            file_id=file_id,
            assets_base_dir=STORAGE_DIR,
            assets_url_prefix="/api/editor/assets",
            registry_metadata=registry_meta,
        )
        return model
    except PresentationParseError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unable to parse presentation file: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error parsing presentation: {str(e)}",
        )


@app.get("/api/editor/assets/{file_id}/{asset_id}")
async def get_editor_asset(file_id: str, asset_id: str):
    """Serve presentation-specific extracted image assets safely.
    
    Enforces strict UUID and asset identifier validation, prevents path traversal,
    and ensures assets strictly belong to the specified presentation.
    """
    if not re.match(r"^[0-9a-fA-F\-]{36}$", file_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file identifier format.",
        )
    if not re.match(r"^[a-zA-Z0-9_\-]{1,64}$", asset_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid asset identifier format.",
        )

    asset_dir = (STORAGE_DIR / f"{file_id}_assets").resolve()
    if not asset_dir.is_relative_to(STORAGE_DIR.resolve()) or not asset_dir.is_dir():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset directory for this presentation not found.",
        )

    # Search for matching asset file
    matching_files = list(asset_dir.glob(f"{asset_id}.*"))
    if not matching_files:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset {asset_id} not found in presentation storage.",
        )

    target_asset = matching_files[0].resolve()
    if not target_asset.is_relative_to(asset_dir) or not target_asset.is_file():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unauthorized asset path access.",
        )

    ext = target_asset.suffix.lower().lstrip(".")
    media_type_map = {
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "gif": "image/gif",
        "webp": "image/webp",
        "svg": "image/svg+xml",
        "bmp": "image/bmp",
    }
    media_type = media_type_map.get(ext, "application/octet-stream")

    return FileResponse(
        path=str(target_asset),
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )


# =====================================================================
# PPTX Serialization and Export Endpoints (Phase 2.5)
# =====================================================================

MAX_EXPORT_ASSET_BYTES = 50 * 1024 * 1024  # 50 MB limit for base64 asset payloads


@app.post("/api/editor/{file_id}/export", response_model=ExportPresentationResponse)
async def export_edited_presentation(
    file_id: str,
    request: ExportPresentationRequest,
):
    """Export the current working in-memory presentation SOM to a distinct PowerPoint (.pptx) file.
    
    Guarantees:
    - Never mutates the original source presentation.
    - Validates source presentation ID against directory traversal.
    - Validates that submitted model corresponds to specified file_id.
    - Enforces maximum payload size for client-provided assets.
    - Performs full OOXML package and structural validation before returning success.
    - Exports to an isolated output file with a unique export identifier.
    """
    # Strict UUID validation to prevent path traversal
    if not re.match(r"^[0-9a-fA-F\-]{36}$", file_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file identifier format.",
        )

    if request.model.file_id != file_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Mismatched presentation ID: request body references '{request.model.file_id}', route specifies '{file_id}'.",
        )

    # Resolve and validate source PPTX path
    file_path = (STORAGE_DIR / f"{file_id}.pptx").resolve()
    try:
        if not file_path.is_relative_to(STORAGE_DIR.resolve()):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid source file path.",
            )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid source file path.",
        )

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The requested source presentation was not found or has expired.",
        )

    # Enforce request asset payload size limit
    total_asset_bytes = sum(len(a.data_base64) for a in request.local_assets)
    if total_asset_bytes > MAX_EXPORT_ASSET_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Total asset payload size ({total_asset_bytes} bytes) exceeds maximum limit of {MAX_EXPORT_ASSET_BYTES} bytes.",
        )

    export_id = str(uuid.uuid4())

    try:
        export_path, download_filename, warnings = serialize_presentation(
            source_pptx_path=file_path,
            model=request.model,
            local_assets=request.local_assets,
            export_id=export_id,
            exports_dir=EXPORTS_DIR,
        )

        _EXPORTED_REGISTRY[export_id] = {
            "export_id": export_id,
            "source_file_id": file_id,
            "filename": download_filename,
            "file_path": str(export_path),
            "created_at": datetime.now().isoformat(),
        }

        return ExportPresentationResponse(
            success=True,
            export_id=export_id,
            download_url=f"/api/editor/export/{export_id}",
            output_filename=download_filename,
            validation_status="valid",
            warnings=warnings,
        )
    except (SerializationError, ValidationError) as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Export failed: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error during presentation export: {str(e)}",
        )


@app.get("/api/editor/export/{export_id}")
async def download_exported_presentation(export_id: str):
    """Download a validated, exported PowerPoint (.pptx) file.
    
    Validates export identifier against directory traversal attacks, ensures
    the file is strictly inside the exports directory, and serves with proper
    PowerPoint MIME type and Content-Disposition.
    """
    if not re.match(r"^[0-9a-fA-F\-]{36}$", export_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid export identifier format.",
        )

    export_path = (EXPORTS_DIR / f"{export_id}.pptx").resolve()
    try:
        if not export_path.is_relative_to(EXPORTS_DIR.resolve()):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unauthorized export file access.",
            )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unauthorized export file access.",
        )

    if not export_path.exists() or not export_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The requested export file was not found or has expired.",
        )

    entry = _EXPORTED_REGISTRY.get(export_id, {})
    download_filename = entry.get("filename", f"presentation_edited_{export_id[:8]}.pptx")

    return FileResponse(
        path=str(export_path),
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        filename=download_filename,
    )


# =====================================================================
# Complete Notes to Multi-Part Presentations Endpoints (Workstream B)
# =====================================================================

_MULTI_PART_JOBS: Dict[str, MultiPartJobDTO] = {}
_MULTI_PART_EXTRACTED_BLOCKS: Dict[str, List[Any]] = {}


@app.post("/api/multi-part/upload", response_model=MultiPartJobDTO)
async def upload_and_plan_multi_part(
    file: Optional[UploadFile] = File(None),
    notes_text: Optional[str] = Form(None),
    title_override: Optional[str] = Form(None),
    slides_per_part: int = Form(20),
    content_density: str = Form("balanced"),
    mode: str = Form("ai"),
    theme: str = Form("academic_navy"),
    layout_style: str = Form("smart_mixed"),
    include_examples: bool = Form(True),
    include_definitions: bool = Form(True),
    include_equations: bool = Form(True),
    include_summaries: bool = Form(True),
    include_revision_questions: bool = Form(True),
    auto_generate: bool = Form(False),
):
    """Upload full lecture notes or paste text to discover topics and plan a multi-part series."""
    if not file and (not notes_text or not notes_text.strip()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either an uploaded lecture file (.pdf, .docx, .txt) or pasted notes_text must be provided.",
        )

    if slides_per_part <= 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="slides_per_part must be a positive integer (minimum 3 slides).",
        )

    validated_slides_per_part = max(3, min(int(slides_per_part), 50))
    job_id = f"mp_{uuid.uuid4().hex[:12]}"
    extractor = NotesExtractor()

    # Step 1: Extraction
    if file:
        filename = file.filename or "notes.txt"
        file_bytes = await file.read()
        if len(file_bytes) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Uploaded file '{filename}' is empty (0 bytes).",
            )
        blocks, manifest = extractor.extract_from_bytes(file_bytes, filename)
    else:
        filename = (title_override or "Lecture_Notes").strip().replace(" ", "_") + ".txt"
        blocks, manifest = extractor.extract_from_text(notes_text or "", title_hint=title_override or "Notes")

    # Step 2: Topic Discovery
    discovery_engine = TopicDiscoveryEngine()
    topics = discovery_engine.discover_topics(
        blocks=blocks,
        manifest=manifest,
        mode=mode,
        title_hint=title_override,
    )

    # Step 3: Global Planning & Content Allocation
    planner = MultiPartPlanner()
    plan = planner.build_plan(
        blocks=blocks,
        topics=topics,
        manifest=manifest,
        slides_per_part=validated_slides_per_part,
        content_density=content_density,
        title_override=title_override,
        job_id=job_id,
        include_examples=include_examples,
        include_definitions=include_definitions,
        include_equations=include_equations,
        include_summaries=include_summaries,
        include_revision_questions=include_revision_questions,
    )

    job = MultiPartJobDTO(
        job_id=job_id,
        status=MultiPartJobStatus.AWAITING_APPROVAL,
        step_index=4,
        step_name="Outline ready for review",
        message=f"Discovered {len(topics)} topics across {manifest.total_pages} pages. Ready to generate {plan.total_parts} parts.",
        progress_percent=35,
        document_name=manifest.filename,
        document_hash=manifest.file_hash,
        slides_per_part=validated_slides_per_part,
        content_density=content_density,
        mode=mode,
        theme=theme,
        layout_style=layout_style,
        include_examples=include_examples,
        include_definitions=include_definitions,
        include_equations=include_equations,
        include_summaries=include_summaries,
        include_revision_questions=include_revision_questions,
        plan=plan,
        parts=[
            PartResultDTO(
                part_number=p_plan.part_number,
                title=p_plan.title,
                file_id="",
                filename=f"{p_plan.title}.pptx",
                download_url="",
                slide_count=0,
                planned_slides=p_plan.planned_slides,
                requested_max_slides=p_plan.target_slides,
                actual_exported_slides=0,
                hard_limit_passed=True,
                status="pending",
                source_page_start=min(([t.page_start for t in topics if t.topic_id in p_plan.topic_ids]), default=1),
                source_page_end=max(([t.page_end for t in topics if t.topic_id in p_plan.topic_ids]), default=1),
                assigned_topics=[t.title for t in topics if t.topic_id in p_plan.topic_ids],
            )
            for p_plan in plan.parts
        ],
    )

    _MULTI_PART_JOBS[job_id] = job
    _MULTI_PART_EXTRACTED_BLOCKS[job_id] = blocks

    if auto_generate:
        # Immediately proceed to generation if explicitly requested
        generator = MultiPartGenerator(output_dir=STORAGE_DIR)
        job = generator.generate_all_parts(job)
        if any(p.status == "completed" for p in job.parts):
            try:
                packager = MultiPartZipPackager(output_dir=STORAGE_DIR)
                _, zip_name = packager.create_zip_archive(job)
                job.zip_filename = zip_name
                job.zip_download_url = f"/api/multi-part/jobs/{job_id}/download-zip"
            except Exception as e:
                logger.warning(f"Failed to create ZIP package for {job_id}: {e}")
        _MULTI_PART_JOBS[job_id] = job

    return job


@app.get("/api/multi-part/jobs/{job_id}", response_model=MultiPartJobDTO)
async def get_multi_part_job(job_id: str):
    """Retrieve multi-part generation job status, discovered outline, and generated presentation parts."""
    if not re.match(r"^[a-zA-Z0-9_\-]{4,64}$", job_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid job identifier format.",
        )
    if job_id not in _MULTI_PART_JOBS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Multi-part job '{job_id}' not found.",
        )
    return _MULTI_PART_JOBS[job_id]


@app.post("/api/multi-part/jobs/{job_id}/approve", response_model=MultiPartJobDTO)
async def approve_and_generate_multi_part(
    job_id: str,
    payload: Optional[ApproveMultiPartPlanRequest] = None,
):
    """Approve or customize the discovered outline without automatically rendering every PPTX."""
    if not re.match(r"^[a-zA-Z0-9_\-]{4,64}$", job_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid job identifier format.",
        )
    if job_id not in _MULTI_PART_JOBS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Multi-part job '{job_id}' not found.",
        )

    job = _MULTI_PART_JOBS[job_id]
    if payload and payload.revised_plan:
        job.plan = payload.revised_plan

    # Populate parts in pending state preserving any already completed parts
    existing_by_num = {p.part_number: p for p in job.parts}
    updated_parts: List[PartResultDTO] = []
    if job.plan and job.plan.parts:
        for p_plan in job.plan.parts:
            if p_plan.part_number in existing_by_num:
                updated_parts.append(existing_by_num[p_plan.part_number])
            else:
                assigned_t_objs = [t for t in job.plan.topics if t.topic_id in p_plan.topic_ids]
                p_start = min((t.page_start for t in assigned_t_objs), default=1)
                p_end = max((t.page_end for t in assigned_t_objs), default=1)
                updated_parts.append(
                    PartResultDTO(
                        part_number=p_plan.part_number,
                        title=p_plan.title,
                        file_id="",
                        filename=f"{p_plan.title}.pptx",
                        download_url="",
                        slide_count=0,
                        planned_slides=p_plan.planned_slides,
                        requested_max_slides=p_plan.target_slides,
                        actual_exported_slides=0,
                        hard_limit_passed=True,
                        status="pending",
                        source_page_start=p_start,
                        source_page_end=p_end,
                        assigned_topics=[t.title for t in assigned_t_objs],
                    )
                )

    job.parts = updated_parts
    job.status = MultiPartJobStatus.PLANNING_ALLOCATION
    job.step_index = 5
    job.step_name = "Outline approved — Ready for on-demand generation"
    job.message = f"Outline approved for {len(job.plan.parts)} parts. Click 'Create PPT' on any part to generate it."
    job.progress_percent = 50
    job.updated_at = datetime.now().isoformat()

    _MULTI_PART_JOBS[job_id] = job
    return job


@app.post("/api/multi-part/jobs/{job_id}/parts/{part_number}/generate", response_model=MultiPartJobDTO)
async def generate_single_multi_part(
    job_id: str,
    part_number: int,
    force_regenerate: bool = False,
):
    """Generate only a specific presentation part on demand with server-side monotonic timing."""
    if not re.match(r"^[a-zA-Z0-9_\-]{4,64}$", job_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid job ID format.")

    if job_id not in _MULTI_PART_JOBS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Job '{job_id}' not found.")

    job = _MULTI_PART_JOBS[job_id]
    if not job.plan or not job.plan.parts:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Job has no approved presentation plan.")

    part_plan = next((p for p in job.plan.parts if p.part_number == part_number), None)
    if not part_plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Part {part_number} is not part of this outline.")

    part_res = next((p for p in job.parts if p.part_number == part_number), None)
    if part_res and part_res.status == "generating":
        # Concurrency safety: double-click prevention
        return job

    if part_res and part_res.status == "completed" and part_res.file_id and not force_regenerate:
        pptx_path = (STORAGE_DIR / f"{part_res.file_id}.pptx").resolve()
        if pptx_path.exists() and pptx_path.stat().st_size > 0:
            return job

    generator = MultiPartGenerator(output_dir=STORAGE_DIR)
    try:
        job = generator.generate_single_part_for_job(job, part_number)
    except Exception as e:
        logger.error(f"Error generating part {part_number} for {job_id}: {e}", exc_info=True)
        _MULTI_PART_JOBS[job_id] = job
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Generation failed for Part {part_number}: {e}")

    _MULTI_PART_JOBS[job_id] = job
    return job


@app.get("/api/multi-part/jobs/{job_id}/parts/{part_number}/progress")
async def get_multi_part_part_progress(job_id: str, part_number: int):
    """Retrieve execution state, timing, and progress for an individual part."""
    if job_id not in _MULTI_PART_JOBS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Job '{job_id}' not found.")

    job = _MULTI_PART_JOBS[job_id]
    part = next((p for p in job.parts if p.part_number == part_number), None)
    if not part:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Part {part_number} not found.")

    return {
        "job_id": job.job_id,
        "part_number": part_number,
        "status": part.status,
        "generation_duration_seconds": part.generation_duration_seconds,
        "generation_stage": part.generation_stage,
        "slide_count": part.slide_count,
        "planned_slides": part.planned_slides,
        "file_id": part.file_id,
        "download_url": part.download_url,
        "error_message": part.error_message,
    }


@app.post("/api/multi-part/jobs/{job_id}/generate-all", response_model=MultiPartJobDTO)
async def generate_all_remaining_parts(job_id: str):
    """Generate all presentation parts sequentially with progress tracking."""
    if job_id not in _MULTI_PART_JOBS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Job '{job_id}' not found.")
    job = _MULTI_PART_JOBS[job_id]
    generator = MultiPartGenerator(output_dir=STORAGE_DIR)
    job = generator.generate_all_parts(job)
    if any(p.status == "completed" for p in job.parts):
        try:
            packager = MultiPartZipPackager(output_dir=STORAGE_DIR)
            _, zip_name = packager.create_zip_archive(job)
            job.zip_filename = zip_name
            job.zip_download_url = f"/api/multi-part/jobs/{job_id}/download-zip"
        except Exception as e:
            logger.warning(f"Failed to create ZIP package: {e}")
    _MULTI_PART_JOBS[job_id] = job
    return job


@app.get("/api/multi-part/jobs/{job_id}/progress")
async def get_multi_part_progress(job_id: str):
    """Poll operational progress state for a running multi-part generation job."""
    if job_id not in _MULTI_PART_JOBS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Multi-part job '{job_id}' not found.",
        )
    job = _MULTI_PART_JOBS[job_id]
    return {
        "job_id": job.job_id,
        "status": job.status,
        "step_index": job.step_index,
        "step_name": job.step_name,
        "message": job.message,
        "progress_percent": job.progress_percent,
        "parts_total": len(job.plan.parts) if job.plan else 0,
        "parts_completed": sum(1 for p in job.parts if p.status == "completed"),
    }


@app.get("/api/multi-part/jobs/{job_id}/parts/{part_number}/download")
async def download_multi_part_presentation(job_id: str, part_number: int):
    """Download a single generated PowerPoint presentation (.pptx) from a multi-part series."""
    if not re.match(r"^[a-zA-Z0-9_\-]{4,64}$", job_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid job ID format.")

    if job_id not in _MULTI_PART_JOBS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Job '{job_id}' not found.")

    job = _MULTI_PART_JOBS[job_id]
    part = next((p for p in job.parts if p.part_number == part_number), None)
    if not part or part.status != "completed" or not part.file_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Part {part_number} for job '{job_id}' was not found or is not completed.",
        )

    pptx_path = (STORAGE_DIR / f"{part.file_id}.pptx").resolve()
    try:
        if not pptx_path.is_relative_to(STORAGE_DIR.resolve()):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unauthorized path.")
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unauthorized path.")

    if not pptx_path.exists() or not pptx_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Presentation file missing on disk.")

    return FileResponse(
        path=str(pptx_path),
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        filename=part.filename,
    )


@app.get("/api/multi-part/jobs/{job_id}/download-zip")
async def download_multi_part_zip(job_id: str):
    """Download all successfully generated PowerPoint presentations in a clean ZIP archive with manifest."""
    if not re.match(r"^[a-zA-Z0-9_\-]{4,64}$", job_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid job ID format.")

    if job_id not in _MULTI_PART_JOBS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Job '{job_id}' not found.")

    job = _MULTI_PART_JOBS[job_id]
    zip_path = (STORAGE_DIR / f"{job.job_id}_all_parts.zip").resolve()

    completed_parts = [p for p in job.parts if p.status == "completed" and p.file_id]
    if not completed_parts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No presentation parts have been generated yet for job '{job_id}'. Please click 'Create PPT' on at least one presentation part before downloading.",
        )

    packager = MultiPartZipPackager(output_dir=STORAGE_DIR)
    zip_path, zip_name = packager.create_zip_archive(job)
    job.zip_filename = zip_name

    try:
        if not zip_path.is_relative_to(STORAGE_DIR.resolve()):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unauthorized path.")
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unauthorized path.")

    return FileResponse(
        path=str(zip_path),
        media_type="application/zip",
        filename=job.zip_filename or f"{job.document_name}_All_Parts.zip",
    )


@app.post("/api/multi-part/jobs/{job_id}/retry", response_model=MultiPartJobDTO)
async def retry_failed_multi_part(job_id: str):
    """Resume or retry failed parts of a multi-part series without duplicating completed outputs."""
    if job_id not in _MULTI_PART_JOBS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Job '{job_id}' not found.")

    job = _MULTI_PART_JOBS[job_id]
    generator = MultiPartGenerator(output_dir=STORAGE_DIR)
    job = generator.generate_all_parts(job)

    if any(p.status == "completed" for p in job.parts):
        try:
            packager = MultiPartZipPackager(output_dir=STORAGE_DIR)
            _, zip_name = packager.create_zip_archive(job)
            job.zip_filename = zip_name
            job.zip_download_url = f"/api/multi-part/jobs/{job_id}/download-zip"
        except Exception as e:
            logger.warning(f"Failed to create ZIP package: {e}")

    _MULTI_PART_JOBS[job_id] = job
    return job



