"""
PowerPoint (.pptx) Parser and Slide-Object Model (SOM) Extractor.
Phase 2.1: Reads an existing generated PPTX and produces a normalized,
hierarchical presentation model suitable for canvas visual editing.

Guarantees:
- Read-only: Does not modify the source PPTX.
- Idempotent: Repeated parsing produces consistent models.
- Lossless coordinates: Native EMUs preserved alongside normalized coordinates.
- Preserves paragraph formatting, text runs, styling, image assets, tables, notes.
- Classifies unsupported PowerPoint shapes explicitly without loss or corruption.
"""

import hashlib
import logging
from pathlib import Path
import re
from typing import Any, Dict, List, Optional, Tuple, Union

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.dml import MSO_COLOR_TYPE, MSO_FILL
from pptx.enum.shapes import MSO_SHAPE, MSO_SHAPE_TYPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN

from app.models import (
    BorderDTO,
    EditorError,
    FillDTO,
    ImageAssetDTO,
    ImageCropDTO,
    InputFileNotFoundError,
    PresentationEditorModel,
    PresentationParseError,
    SlideDetailDTO,
    SlideObjectDTO,
    TableCellDTO,
    TableDataDTO,
    TextContentDTO,
    TextParagraphDTO,
    TextRunDTO,
)

logger = logging.getLogger("acadion.pptx_parser")

# Standard 16:9 widescreen canvas resolution
DEFAULT_VIRTUAL_WIDTH = 1920.0
DEFAULT_VIRTUAL_HEIGHT = 1080.0
EMU_PER_INCH = 914400
EMU_PER_PT = 12700


# =====================================================================
# Coordinate Conversion Utilities
# =====================================================================

def emu_to_normalized(emu_val: int, slide_emu: int, virtual_dim: float) -> float:
    """Convert PowerPoint native EMUs to normalized virtual canvas coordinates.
    
    Args:
        emu_val: Coordinate or dimension in native PowerPoint EMUs.
        slide_emu: Total slide dimension in native PowerPoint EMUs.
        virtual_dim: Target virtual canvas dimension (e.g. 1920 or 1080).
        
    Returns:
        float: Precise canvas coordinate rounded to 2 decimal places.
    """
    if slide_emu <= 0:
        return float(emu_val)
    return round((emu_val / slide_emu) * virtual_dim, 2)


def normalized_to_emu(norm_val: float, slide_emu: int, virtual_dim: float) -> int:
    """Convert normalized virtual canvas coordinate back to native PowerPoint EMUs.
    
    Args:
        norm_val: Virtual canvas coordinate (e.g. 1920x1080 scale).
        slide_emu: Total slide dimension in native PowerPoint EMUs.
        virtual_dim: Target virtual canvas dimension.
        
    Returns:
        int: Native PowerPoint EMUs rounded to the nearest integer.
    """
    if virtual_dim <= 0:
        return int(norm_val)
    return round((norm_val / virtual_dim) * slide_emu)


# =====================================================================
# Style & Color Extraction Helpers
# =====================================================================

def extract_color_hex(color_format) -> Optional[str]:
    """Safely extract hex color '#RRGGBB' from a python-pptx ColorFormat.
    
    Does NOT substitute arbitrary black or white when a color cannot be
    resolved (such as theme-based colors without explicit RGB values).
    Returns None if color is theme-based, unresolvable, or none.
    """
    if color_format is None:
        return None
    try:
        color_type = getattr(color_format, "type", None)
        if color_type == MSO_COLOR_TYPE.RGB:
            rgb = color_format.rgb
            return f"#{rgb[0]:02X}{rgb[1]:02X}{rgb[2]:02X}"
    except Exception:
        pass
    return None


def extract_fill(fill) -> Optional[FillDTO]:
    """Safely extract shape or cell fill properties without throwing on theme fills."""
    if fill is None:
        return None
    try:
        fill_type = fill.type
        if fill_type == MSO_FILL.SOLID:
            color = extract_color_hex(getattr(fill, "fore_color", None))
            alpha = None
            try:
                if hasattr(fill, "transparency"):
                    alpha = round(1.0 - float(fill.transparency), 2)
            except Exception:
                pass
            return FillDTO(fill_type="solid", color=color, alpha=alpha)
        elif fill_type == MSO_FILL.BACKGROUND:
            return FillDTO(fill_type="background", color=None)
        elif fill_type == MSO_FILL.GRADIENT:
            return FillDTO(fill_type="gradient", color=None)
        elif fill_type == MSO_FILL.PATTERNED:
            return FillDTO(fill_type="pattern", color=None)
        elif fill_type == MSO_FILL.PICTURE:
            return FillDTO(fill_type="texture", color=None)
        else:
            return FillDTO(fill_type="none", color=None)
    except Exception:
        return None


def extract_border(line, scale_x: float = 1.0) -> Optional[BorderDTO]:
    """Safely extract border/stroke properties from a shape line."""
    if line is None:
        return None
    try:
        # Check if line fill is background / no stroke
        if hasattr(line, "fill") and hasattr(line.fill, "type"):
            if line.fill.type == MSO_FILL.BACKGROUND:
                return None

        color = None
        try:
            if hasattr(line, "color") and line.color:
                color = extract_color_hex(line.color)
        except Exception:
            pass

        width_emu = None
        width_pt = None
        try:
            if hasattr(line, "width") and line.width:
                width_emu = int(line.width)
                width_pt = round(width_emu * scale_x, 2)
        except Exception:
            pass

        dash_style = "solid"
        try:
            if hasattr(line, "dash_style") and line.dash_style:
                dash_style = line.dash_style.name.lower()
        except Exception:
            pass

        if color is None and width_emu is None:
            return None

        return BorderDTO(
            color=color,
            width=width_pt,
            width_emu=width_emu,
            style=dash_style,
        )
    except Exception:
        return None


# =====================================================================
# Text and Run Extraction Helpers
# =====================================================================

def parse_text_frame(tf) -> Optional[TextContentDTO]:
    """Parse text frame preserving paragraphs, runs, fonts, colors, and margins."""
    if tf is None:
        return None
    try:
        paragraphs: List[TextParagraphDTO] = []
        for p_idx, p in enumerate(tf.paragraphs):
            runs: List[TextRunDTO] = []
            p_font = getattr(p, "font", None)

            for r_idx, r in enumerate(p.runs):
                font_family = None
                font_size = None
                font_color = None
                bold = None
                italic = None
                underline = None
                hyperlink = None

                try:
                    if r.font:
                        font_family = r.font.name
                        if r.font.size:
                            font_size = round(r.font.size.pt, 1)
                        if r.font.color:
                            font_color = extract_color_hex(r.font.color)
                        bold = r.font.bold
                        italic = r.font.italic
                        underline = r.font.underline

                    # Inherit from paragraph font if not explicitly set on run
                    if p_font:
                        if not font_family and p_font.name:
                            font_family = p_font.name
                        if font_size is None and p_font.size:
                            font_size = round(p_font.size.pt, 1)
                        if not font_color and p_font.color:
                            font_color = extract_color_hex(p_font.color)
                        if bold is None and p_font.bold is not None:
                            bold = p_font.bold
                        if italic is None and p_font.italic is not None:
                            italic = p_font.italic
                        if underline is None and p_font.underline is not None:
                            underline = p_font.underline
                except Exception:
                    pass

                try:
                    if hasattr(r, "hyperlink") and r.hyperlink and r.hyperlink.address:
                        hyperlink = r.hyperlink.address
                except Exception:
                    pass

                runs.append(
                    TextRunDTO(
                        run_index=r_idx,
                        text=r.text,
                        font_family=font_family,
                        font_size=font_size,
                        font_color=font_color,
                        bold=bold,
                        italic=italic,
                        underline=underline,
                        hyperlink=hyperlink,
                    )
                )

            # Fallback for paragraphs with direct text but no child runs
            if len(runs) == 0 and p.text and p.text.strip():
                font_family = p_font.name if p_font else None
                font_size = round(p_font.size.pt, 1) if p_font and p_font.size else None
                font_color = extract_color_hex(p_font.color) if p_font and p_font.color else None
                bold = p_font.bold if p_font else None
                italic = p_font.italic if p_font else None
                underline = p_font.underline if p_font else None
                runs.append(
                    TextRunDTO(
                        run_index=0,
                        text=p.text,
                        font_family=font_family,
                        font_size=font_size,
                        font_color=font_color,
                        bold=bold,
                        italic=italic,
                        underline=underline,
                    )
                )

            # Alignment
            alignment = None
            try:
                if p.alignment:
                    alignment = p.alignment.name.lower()
            except Exception:
                pass

            # Spacing
            line_spacing = None
            space_before = None
            space_after = None
            try:
                if p.line_spacing:
                    line_spacing = round(
                        p.line_spacing.pt if hasattr(p.line_spacing, "pt") else float(p.line_spacing), 2
                    )
            except Exception:
                pass
            try:
                if p.space_before:
                    space_before = round(p.space_before.pt, 1)
            except Exception:
                pass
            try:
                if p.space_after:
                    space_after = round(p.space_after.pt, 1)
            except Exception:
                pass

            # Level and Bullet detection
            level = int(getattr(p, "level", 0) or 0)
            raw_text = "".join(r.text for r in runs).strip()
            is_bullet = level > 0 or raw_text.startswith(("•", "–", "—", "- ", "* "))

            paragraphs.append(
                TextParagraphDTO(
                    paragraph_index=p_idx,
                    runs=runs,
                    alignment=alignment,
                    line_spacing=line_spacing,
                    space_before=space_before,
                    space_after=space_after,
                    level=level,
                    is_bullet=is_bullet,
                )
            )

        # Vertical alignment
        vertical_alignment = None
        try:
            if hasattr(tf, "vertical_anchor") and tf.vertical_anchor:
                vertical_alignment = tf.vertical_anchor.name.lower()
        except Exception:
            pass

        word_wrap = getattr(tf, "word_wrap", True)
        margin_left = None
        margin_right = None
        margin_top = None
        margin_bottom = None
        try:
            if tf.margin_left:
                margin_left = round(tf.margin_left.pt, 1)
            if tf.margin_right:
                margin_right = round(tf.margin_right.pt, 1)
            if tf.margin_top:
                margin_top = round(tf.margin_top.pt, 1)
            if tf.margin_bottom:
                margin_bottom = round(tf.margin_bottom.pt, 1)
        except Exception:
            pass

        return TextContentDTO(
            paragraphs=paragraphs,
            vertical_alignment=vertical_alignment,
            word_wrap=word_wrap,
            margin_left=margin_left,
            margin_right=margin_right,
            margin_top=margin_top,
            margin_bottom=margin_bottom,
        )
    except Exception as e:
        logger.debug(f"Failed to parse text frame: {e}")
        return None


# =====================================================================
# Image and Table Extraction Helpers
# =====================================================================

def extract_image_asset(
    shape,
    file_id: str,
    asset_dir: Path,
    assets_url_prefix: str = "/api/editor/assets",
) -> Optional[ImageAssetDTO]:
    """Extract embedded image from picture shape into presentation asset directory."""
    try:
        if not hasattr(shape, "image"):
            return None
        image = shape.image
        blob = image.blob
        ext = getattr(image, "ext", "png") or "png"
        content_type = getattr(image, "content_type", f"image/{ext}")

        # Stable content-addressed asset identifier prevents duplicate storage
        content_hash = hashlib.sha256(blob).hexdigest()[:16]
        asset_id = f"img_{content_hash}"
        filename = f"{asset_id}.{ext}"

        asset_dir.mkdir(parents=True, exist_ok=True)
        asset_path = asset_dir / filename
        if not asset_path.exists():
            with open(asset_path, "wb") as f:
                f.write(blob)

        width_px = None
        height_px = None
        try:
            if hasattr(image, "size"):
                width_px, height_px = image.size
        except Exception:
            pass

        return ImageAssetDTO(
            asset_id=asset_id,
            url=f"{assets_url_prefix}/{file_id}/{asset_id}",
            content_type=content_type,
            original_filename=getattr(image, "filename", filename),
            width_px=width_px,
            height_px=height_px,
        )
    except Exception as e:
        logger.warning(f"Failed to extract image asset for shape {getattr(shape, 'name', '')}: {e}")
        return None


def parse_table(shape) -> Optional[TableDataDTO]:
    """Parse table structure, cell content, and formatting."""
    try:
        if not getattr(shape, "has_table", False):
            return None
        tbl = shape.table
        rows = len(tbl.rows)
        cols = len(tbl.columns)
        cells: List[TableCellDTO] = []

        for r_idx in range(rows):
            for c_idx in range(cols):
                cell = tbl.cell(r_idx, c_idx)
                cell_text = cell.text
                cell_tc = parse_text_frame(cell.text_frame)
                cell_fill = extract_fill(cell.fill)

                cells.append(
                    TableCellDTO(
                        row_index=r_idx,
                        col_index=c_idx,
                        text=cell_text,
                        text_content=cell_tc,
                        fill=cell_fill,
                    )
                )

        return TableDataDTO(rows=rows, columns=cols, cells=cells)
    except Exception as e:
        logger.warning(f"Failed to parse table shape: {e}")
        return None


# =====================================================================
# Main Parser Function
# =====================================================================

def parse_presentation(
    pptx_path: str | Path,
    file_id: str,
    assets_base_dir: Optional[Path] = None,
    assets_url_prefix: str = "/api/editor/assets",
    registry_metadata: Optional[Dict[str, Any]] = None,
) -> PresentationEditorModel:
    """Parse an existing PowerPoint (.pptx) file into a normalized Slide-Object Model (SOM).
    
    Guarantees:
    - Purely read-only: does not modify or re-save the PPTX.
    - Deterministic: repeated runs produce identical models.
    - Normalized 1920x1080 canvas coordinates with native EMUs preserved.
    - Unsupported elements classified explicitly.
    - Images safely exported to presentation asset storage.
    
    Args:
        pptx_path: Absolute or relative path to the PPTX presentation.
        file_id: Validated unique session or presentation identifier.
        assets_base_dir: Directory where presentation assets are stored.
        assets_url_prefix: URL prefix for serving extracted image assets.
        registry_metadata: Optional dictionary with session/theme metadata.
        
    Returns:
        PresentationEditorModel: Normalized presentation data structure.
        
    Raises:
        InputFileNotFoundError: If the PPTX file does not exist.
        PresentationParseError: If the PPTX is corrupted or unreadable.
    """
    path = Path(pptx_path)
    if not path.exists() or not path.is_file():
        raise InputFileNotFoundError(f"Presentation file not found at: {pptx_path}")

    # Read-only load using python-pptx
    try:
        prs = Presentation(str(path))
    except Exception as e:
        raise PresentationParseError(f"Failed to parse PowerPoint presentation: {str(e)}") from e

    # Derive dimensions and coordinate scales
    slide_width_emu = int(prs.slide_width)
    slide_height_emu = int(prs.slide_height)

    aspect_ratio = (slide_width_emu / slide_height_emu) if slide_height_emu > 0 else (16.0 / 9.0)
    if abs(aspect_ratio - (16.0 / 9.0)) < 0.05:
        virtual_width = DEFAULT_VIRTUAL_WIDTH
        virtual_height = DEFAULT_VIRTUAL_HEIGHT
    else:
        # Non-16:9 slides: keep 1080 as base height and derive width
        virtual_height = DEFAULT_VIRTUAL_HEIGHT
        virtual_width = round(DEFAULT_VIRTUAL_HEIGHT * aspect_ratio, 2)

    scale_x = virtual_width / slide_width_emu if slide_width_emu > 0 else 1.0
    scale_y = virtual_height / slide_height_emu if slide_height_emu > 0 else 1.0

    # Resolve presentation title
    title = ""
    try:
        if prs.core_properties and prs.core_properties.title:
            title = prs.core_properties.title.strip()
    except Exception:
        pass

    if not title and registry_metadata and registry_metadata.get("title"):
        title = str(registry_metadata["title"]).strip()

    # Look for first slide title if metadata title is empty
    if not title and len(prs.slides) > 0:
        first_slide = prs.slides[0]
        try:
            if first_slide.shapes.title and first_slide.shapes.title.text.strip():
                title = first_slide.shapes.title.text.strip()
        except Exception:
            pass

    if not title:
        title = path.stem.replace("_", " ").title()

    # Theme and layout metadata
    theme = None
    layout_style = None
    if registry_metadata:
        theme = registry_metadata.get("theme")
        layout_style = registry_metadata.get("layout_style")

    # Presentation asset directory
    if assets_base_dir is None:
        from app.api import STORAGE_DIR
        assets_base_dir = STORAGE_DIR
    asset_dir = Path(assets_base_dir) / f"{file_id}_assets"

    slides_dto: List[SlideDetailDTO] = []

    for slide_idx, slide in enumerate(prs.slides, start=1):
        slide_id = f"{file_id}_slide_{slide_idx}"
        layout_name = None
        try:
            if hasattr(slide, "slide_layout") and slide.slide_layout:
                layout_name = slide.slide_layout.name
        except Exception:
            pass

        # Speaker notes
        speaker_notes = ""
        try:
            if slide.has_notes_slide and slide.notes_slide.notes_text_frame:
                speaker_notes = slide.notes_slide.notes_text_frame.text.strip()
        except Exception:
            pass

        # Background color detection
        background_color = None
        background_type = "solid"

        # Check native slide background
        try:
            if hasattr(slide, "background") and slide.background:
                bg_fill = extract_fill(slide.background.fill)
                if bg_fill and bg_fill.color:
                    background_color = bg_fill.color
                    background_type = bg_fill.fill_type
        except Exception:
            pass

        # Check if first shape is an Acadion canvas background rectangle
        if not background_color and len(slide.shapes) > 0:
            first_shape = slide.shapes[0]
            shp_name = getattr(first_shape, "name", "").lower()
            left_emu = int(getattr(first_shape, "left", 0) or 0)
            top_emu = int(getattr(first_shape, "top", 0) or 0)
            w_emu = int(getattr(first_shape, "width", 0) or 0)
            h_emu = int(getattr(first_shape, "height", 0) or 0)

            is_full_canvas = (
                left_emu == 0
                and top_emu == 0
                and abs(w_emu - slide_width_emu) < 1000
                and abs(h_emu - slide_height_emu) < 1000
            )

            if "background" in shp_name or is_full_canvas:
                try:
                    first_fill = extract_fill(first_shape.fill)
                    if first_fill and first_fill.color:
                        background_color = first_fill.color
                        background_type = first_fill.fill_type
                except Exception:
                    pass

        # Parse slide objects in document z-order
        objects_dto: List[SlideObjectDTO] = []

        for obj_idx, shape in enumerate(slide.shapes):
            shape_id = getattr(shape, "shape_id", obj_idx)
            object_id = f"{slide_id}_obj_{shape_id}"
            name = getattr(shape, "name", f"Shape {obj_idx}")

            x_emu = int(getattr(shape, "left", 0) or 0)
            y_emu = int(getattr(shape, "top", 0) or 0)
            width_emu = int(getattr(shape, "width", 0) or 0)
            height_emu = int(getattr(shape, "height", 0) or 0)

            x = emu_to_normalized(x_emu, slide_width_emu, virtual_width)
            y = emu_to_normalized(y_emu, slide_height_emu, virtual_height)
            width = emu_to_normalized(width_emu, slide_width_emu, virtual_width)
            height = emu_to_normalized(height_emu, slide_height_emu, virtual_height)

            rotation = float(getattr(shape, "rotation", 0.0) or 0.0)

            fill_dto = None
            try:
                if hasattr(shape, "fill"):
                    fill_dto = extract_fill(shape.fill)
            except Exception:
                pass

            border_dto = None
            try:
                if hasattr(shape, "line"):
                    border_dto = extract_border(shape.line, scale_x)
            except Exception:
                pass

            text_content_dto = None
            try:
                if getattr(shape, "has_text_frame", False):
                    text_content_dto = parse_text_frame(shape.text_frame)
            except Exception:
                pass

            image_asset_dto = None
            table_data_dto = None
            object_type = "shape"
            shape_type_name = None
            is_unsupported = False
            unsupported_reason = None

            # 1. Table
            if getattr(shape, "has_table", False):
                object_type = "table"
                table_data_dto = parse_table(shape)

            # 2. Chart (Unsupported for direct canvas manipulation)
            elif getattr(shape, "has_chart", False):
                object_type = "unsupported"
                is_unsupported = True
                unsupported_reason = "Embedded PowerPoint chart (read-only in visual editor)"

            # 3. Picture
            elif hasattr(shape, "image") or getattr(shape, "shape_type", None) == MSO_SHAPE_TYPE.PICTURE:
                object_type = "picture"
                image_asset_dto = extract_image_asset(shape, file_id, asset_dir, assets_url_prefix)

            # 4. Group Shape
            elif getattr(shape, "shape_type", None) == MSO_SHAPE_TYPE.GROUP:
                object_type = "group"

            # 5. Connector / Line
            elif getattr(shape, "shape_type", None) == MSO_SHAPE_TYPE.LINE:
                object_type = "connector"

            # 6. Text Box
            elif getattr(shape, "shape_type", None) == MSO_SHAPE_TYPE.TEXT_BOX:
                object_type = "text_box"

            # 7. Auto Shape
            elif getattr(shape, "shape_type", None) == MSO_SHAPE_TYPE.AUTO_SHAPE:
                object_type = "shape"
                try:
                    if hasattr(shape, "auto_shape_type") and shape.auto_shape_type:
                        shape_type_name = shape.auto_shape_type.name
                except Exception:
                    pass

            # 8. Check for SmartArt or other GraphicFrame types
            else:
                tag_name = getattr(getattr(shape, "_element", None), "tag", "")
                if "graphicFrame" in tag_name:
                    object_type = "unsupported"
                    is_unsupported = True
                    unsupported_reason = "SmartArt or complex graphic frame (read-only)"
                elif getattr(shape, "has_text_frame", False):
                    object_type = "shape"
                else:
                    object_type = "unsupported"
                    is_unsupported = True
                    unsupported_reason = f"Unsupported shape type: {getattr(shape, 'shape_type', 'unknown')}"

            # Extract native image crop if applicable
            image_crop_dto = None
            if object_type == "picture" and image_asset_dto and image_asset_dto.width_px and image_asset_dto.height_px:
                try:
                    c_left = float(getattr(shape, "crop_left", 0.0) or 0.0)
                    c_top = float(getattr(shape, "crop_top", 0.0) or 0.0)
                    c_right = float(getattr(shape, "crop_right", 0.0) or 0.0)
                    c_bottom = float(getattr(shape, "crop_bottom", 0.0) or 0.0)
                    if abs(c_left) > 0.0001 or abs(c_top) > 0.0001 or abs(c_right) > 0.0001 or abs(c_bottom) > 0.0001:
                        w_px = float(image_asset_dto.width_px)
                        h_px = float(image_asset_dto.height_px)
                        crop_x = round(c_left * w_px, 2)
                        crop_y = round(c_top * h_px, 2)
                        crop_w = round(max(1.0, w_px * (1.0 - c_left - c_right)), 2)
                        crop_h = round(max(1.0, h_px * (1.0 - c_top - c_bottom)), 2)
                        image_crop_dto = ImageCropDTO(x=crop_x, y=crop_y, width=crop_w, height=crop_h)
                except Exception:
                    pass

            objects_dto.append(
                SlideObjectDTO(
                    object_id=object_id,
                    name=name,
                    object_type=object_type,
                    shape_type=shape_type_name,
                    x=x,
                    y=y,
                    width=width,
                    height=height,
                    x_emu=x_emu,
                    y_emu=y_emu,
                    width_emu=width_emu,
                    height_emu=height_emu,
                    rotation=rotation,
                    z_index=obj_idx,
                    fill=fill_dto,
                    border=border_dto,
                    text_content=text_content_dto,
                    image_asset=image_asset_dto,
                    crop=image_crop_dto,
                    table_data=table_data_dto,
                    is_unsupported=is_unsupported,
                    unsupported_reason=unsupported_reason,
                )
            )

        slides_dto.append(
            SlideDetailDTO(
                slide_id=slide_id,
                slide_number=slide_idx,
                width=virtual_width,
                height=virtual_height,
                background_color=background_color,
                background_type=background_type,
                speaker_notes=speaker_notes,
                layout_name=layout_name,
                objects=objects_dto,
            )
        )

    return PresentationEditorModel(
        file_id=file_id,
        title=title,
        slide_width=virtual_width,
        slide_height=virtual_height,
        slide_width_emu=slide_width_emu,
        slide_height_emu=slide_height_emu,
        scale_x=scale_x,
        scale_y=scale_y,
        slide_count=len(slides_dto),
        theme=theme,
        layout_style=layout_style,
        slides=slides_dto,
        source_metadata=registry_metadata or {},
    )
