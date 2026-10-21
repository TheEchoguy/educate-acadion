"""
PowerPoint (.pptx) Serializer and In-Memory Edit Persistence Engine.
Phase 2.5: Reads the original presentation package and the current in-memory
working SOM, updates supported shapes, text, images, crops, and geometry,
and exports to a separate, validated .pptx file.

Core Invariants:
1. Source Immutability: The original PPTX is NEVER modified, overwritten, or mutated.
2. Separate Exports: Every export is written to an isolated, uniquely identified file.
3. Package Integrity: Preserves layouts, masters, notes, themes, and unsupported native parts.
4. Pre-Validation: Full OOXML ZIP and structural round-trip validation before finalization.
5. Atomic Finalization: Saves to a temporary file (.tmp) and renames only upon validation success.
"""

import base64
import hashlib
import io
import logging
import os
from pathlib import Path
import re
import shutil
import tempfile
from typing import Any, Dict, List, Optional, Set, Tuple
import zipfile

from PIL import Image
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt

from app.models import (
    BorderDTO,
    EditorError,
    FillDTO,
    ImageAssetDTO,
    ImageCropDTO,
    LocalAssetPayload,
    PresentationEditorModel,
    SlideDetailDTO,
    SlideObjectDTO,
    TextContentDTO,
    TextParagraphDTO,
    TextRunDTO,
)

logger = logging.getLogger("acadion.pptx_serializer")


class SerializationError(EditorError):
    """Raised when presentation serialization fails."""
    pass


class ValidationError(EditorError):
    """Raised when an exported presentation fails structural validation."""
    pass


def _decode_base64_asset(payload: LocalAssetPayload) -> bytes:
    """Safely decode base64 data string into raw binary bytes."""
    data = payload.data_base64
    if "," in data:
        # Strip Data URL prefix e.g. "data:image/png;base64,..."
        data = data.split(",", 1)[1]
    data = data.strip()
    try:
        raw_bytes = base64.b64decode(data, validate=True)
    except Exception as e:
        raise SerializationError(f"Invalid base64 payload for asset '{payload.asset_id}': {e}")

    # Validate image format using PIL
    try:
        with Image.open(io.BytesIO(raw_bytes)) as img:
            img.verify()
    except Exception as e:
        raise SerializationError(f"Corrupted or invalid image data for asset '{payload.asset_id}': {e}")

    return raw_bytes


def _get_image_dimensions(image_bytes: bytes) -> Tuple[int, int]:
    """Retrieve pixel dimensions from image bytes."""
    with Image.open(io.BytesIO(image_bytes)) as img:
        return img.size  # (width, height)


def _apply_text_frame(tf, text_content: TextContentDTO) -> None:
    """Serialize text paragraphs, runs, fonts, and alignment into a native text frame."""
    if text_content.word_wrap is not None:
        try:
            tf.word_wrap = text_content.word_wrap
        except Exception:
            pass

    if text_content.margin_left is not None:
        try:
            tf.margin_left = Pt(text_content.margin_left)
        except Exception:
            pass
    if text_content.margin_right is not None:
        try:
            tf.margin_right = Pt(text_content.margin_right)
        except Exception:
            pass
    if text_content.margin_top is not None:
        try:
            tf.margin_top = Pt(text_content.margin_top)
        except Exception:
            pass
    if text_content.margin_bottom is not None:
        try:
            tf.margin_bottom = Pt(text_content.margin_bottom)
        except Exception:
            pass

    align_map = {
        "left": PP_ALIGN.LEFT,
        "center": PP_ALIGN.CENTER,
        "right": PP_ALIGN.RIGHT,
        "justify": PP_ALIGN.JUSTIFY,
    }

    paragraphs_dto = text_content.paragraphs
    if not paragraphs_dto:
        tf.text = ""
        return

    # Clear existing paragraphs text
    for i, p_dto in enumerate(paragraphs_dto):
        if i < len(tf.paragraphs):
            p = tf.paragraphs[i]
            p.text = ""
        else:
            p = tf.add_paragraph()

        if p_dto.alignment and p_dto.alignment.lower() in align_map:
            p.alignment = align_map[p_dto.alignment.lower()]

        if p_dto.level is not None and p_dto.level >= 0:
            p.level = min(8, p_dto.level)

        if p_dto.line_spacing is not None:
            try:
                p.line_spacing = Pt(p_dto.line_spacing)
            except Exception:
                pass
        if p_dto.space_before is not None:
            try:
                p.space_before = Pt(p_dto.space_before)
            except Exception:
                pass
        if p_dto.space_after is not None:
            try:
                p.space_after = Pt(p_dto.space_after)
            except Exception:
                pass

        # Populate runs
        for r_dto in p_dto.runs:
            r = p.add_run()
            r.text = r_dto.text
            if r_dto.font_family:
                r.font.name = r_dto.font_family
            if r_dto.font_size and r_dto.font_size > 0:
                r.font.size = Pt(r_dto.font_size)
            if r_dto.bold is not None:
                r.font.bold = r_dto.bold
            if r_dto.italic is not None:
                r.font.italic = r_dto.italic
            if r_dto.underline is not None:
                r.font.underline = r_dto.underline
            if r_dto.font_color:
                hex_str = r_dto.font_color.lstrip("#")
                if len(hex_str) == 6:
                    try:
                        r.font.color.rgb = RGBColor.from_string(hex_str)
                    except Exception:
                        pass


def _apply_shape_styling(shape, fill: Optional[FillDTO], border: Optional[BorderDTO]) -> None:
    """Apply fill color and border styling to a native shape."""
    if fill and hasattr(shape, "fill"):
        try:
            if fill.fill_type == "solid" and fill.color:
                hex_str = fill.color.lstrip("#")
                if len(hex_str) == 6:
                    shape.fill.solid()
                    shape.fill.fore_color.rgb = RGBColor.from_string(hex_str)
            elif fill.fill_type == "none":
                shape.fill.background()
        except Exception as e:
            logger.debug(f"Failed to apply fill styling: {e}")

    if border and hasattr(shape, "line"):
        try:
            if border.color:
                hex_str = border.color.lstrip("#")
                if len(hex_str) == 6:
                    shape.line.color.rgb = RGBColor.from_string(hex_str)
            if border.width and border.width > 0:
                shape.line.width = Pt(border.width)
        except Exception as e:
            logger.debug(f"Failed to apply border styling: {e}")


def _apply_image_crop(
    pic_shape,
    crop: Optional[ImageCropDTO],
    source_w: int,
    source_h: int,
) -> None:
    """Convert source-pixel crop bounds into PowerPoint fractional crop values."""
    if crop is None:
        # Reset crop
        pic_shape.crop_left = 0.0
        pic_shape.crop_top = 0.0
        pic_shape.crop_right = 0.0
        pic_shape.crop_bottom = 0.0
        return

    if source_w <= 0 or source_h <= 0:
        return

    # PowerPoint crop fractions: fraction of original image cropped from each side (0.0 to 1.0)
    crop_left = max(0.0, min(1.0, crop.x / source_w))
    crop_top = max(0.0, min(1.0, crop.y / source_h))
    crop_right = max(0.0, min(1.0, (source_w - (crop.x + crop.width)) / source_w))
    crop_bottom = max(0.0, min(1.0, (source_h - (crop.y + crop.height)) / source_h))

    # Guard against invalid cumulative crop bounds (e.g. left + right >= 1.0)
    if crop_left + crop_right >= 0.999:
        crop_right = max(0.0, 0.999 - crop_left)
    if crop_top + crop_bottom >= 0.999:
        crop_bottom = max(0.0, 0.999 - crop_top)

    pic_shape.crop_left = round(crop_left, 5)
    pic_shape.crop_top = round(crop_top, 5)
    pic_shape.crop_right = round(crop_right, 5)
    pic_shape.crop_bottom = round(crop_bottom, 5)


def validate_exported_presentation(
    export_path: Path,
    expected_model: PresentationEditorModel,
    source_path: Path,
    original_source_stat: os.stat_result,
    original_source_sha256: str,
) -> Tuple[bool, List[str]]:
    """Strictly validate the exported PPTX package and assert source immutability.
    
    Guarantees checked:
    1. Export file exists and is non-empty.
    2. Valid OOXML ZIP container with intact part compression.
    3. Re-loadable via python-pptx without corruption.
    4. Slide count and dimensions match expected model.
    5. Original source file bytes, mtime, size, and SHA256 remain completely unchanged.
    """
    warnings: List[str] = []

    # 1. Existence and size
    if not export_path.exists() or export_path.stat().st_size == 0:
        raise ValidationError(f"Exported presentation file does not exist or is empty: {export_path}")

    # 2. ZIP package integrity
    try:
        with zipfile.ZipFile(export_path, "r") as zf:
            corrupted_part = zf.testzip()
            if corrupted_part is not None:
                raise ValidationError(f"OOXML ZIP corruption in part: {corrupted_part}")
            namelist = zf.namelist()
            if "[Content_Types].xml" not in namelist:
                raise ValidationError("Exported package missing [Content_Types].xml")
            if not any(n.startswith("ppt/slides/slide") for n in namelist):
                raise ValidationError("Exported package missing slide parts")
    except zipfile.BadZipFile as e:
        raise ValidationError(f"Exported file is not a valid ZIP archive: {e}")

    # 3. Structural reload verification
    try:
        prs = Presentation(str(export_path))
    except Exception as e:
        raise ValidationError(f"Failed to reopen exported presentation: {e}")

    # 4. Slide count and dimensions
    if len(prs.slides) != len(expected_model.slides):
        raise ValidationError(
            f"Slide count mismatch: expected {len(expected_model.slides)}, found {len(prs.slides)}"
        )

    if expected_model.slide_width_emu > 0 and expected_model.slide_height_emu > 0:
        if abs(int(prs.slide_width) - expected_model.slide_width_emu) > 5000:
            warnings.append(
                f"Slide width minor difference: {int(prs.slide_width)} vs expected {expected_model.slide_width_emu}"
            )
        if abs(int(prs.slide_height) - expected_model.slide_height_emu) > 5000:
            warnings.append(
                f"Slide height minor difference: {int(prs.slide_height)} vs expected {expected_model.slide_height_emu}"
            )

    # 5. Core Invariant: Source Immutability
    current_source_stat = source_path.stat()
    if (
        current_source_stat.st_size != original_source_stat.st_size
        or current_source_stat.st_mtime != original_source_stat.st_mtime
    ):
        raise ValidationError("FATAL INVARIANT VIOLATION: Source presentation was modified during export!")

    with open(source_path, "rb") as f:
        current_sha256 = hashlib.sha256(f.read()).hexdigest()
    if current_sha256 != original_source_sha256:
        raise ValidationError("FATAL INVARIANT VIOLATION: Source presentation SHA256 checksum changed!")

    return True, warnings


def serialize_presentation(
    source_pptx_path: Path,
    model: PresentationEditorModel,
    local_assets: List[LocalAssetPayload],
    export_id: str,
    exports_dir: Path,
) -> Tuple[Path, str, List[str]]:
    """Export the edited presentation SOM into a separate, validated PowerPoint (.pptx) file.
    
    Args:
        source_pptx_path: Path to the validated original source presentation.
        model: Current working presentation SOM with user edits.
        local_assets: List of base64 payloads for client-uploaded images.
        export_id: Unique export session identifier (UUID).
        exports_dir: Directory where the exported file will be saved.
        
    Returns:
        Tuple of:
        - final_export_path (Path): Path to the completed, validated .pptx file.
        - download_filename (str): Descriptive sanitized filename for Content-Disposition.
        - warnings (List[str]): List of structured warnings for unsupported features.
        
    Raises:
        SerializationError: If serialization encounters an unrecoverable failure.
        ValidationError: If post-export structural validation fails.
    """
    if not source_pptx_path.exists() or not source_pptx_path.is_file():
        raise SerializationError(f"Source presentation does not exist: {source_pptx_path}")

    exports_dir.mkdir(parents=True, exist_ok=True)
    temp_export_path = exports_dir / f"{export_id}.tmp"
    final_export_path = exports_dir / f"{export_id}.pptx"

    # Clean up any leftover temporary files
    if temp_export_path.exists():
        temp_export_path.unlink()

    # Capture source file immutability baseline
    original_stat = source_pptx_path.stat()
    with open(source_pptx_path, "rb") as f:
        original_sha256 = hashlib.sha256(f.read()).hexdigest()

    warnings: List[str] = []

    # Prepare local assets map: asset_id -> bytes
    assets_map: Dict[str, bytes] = {}
    for asset_payload in local_assets:
        try:
            b = _decode_base64_asset(asset_payload)
            assets_map[asset_payload.asset_id] = b
        except Exception as e:
            warnings.append(f"Failed to decode asset '{asset_payload.asset_id}': {e}")

    try:
        # Load source presentation (in-memory OOXML DOM)
        prs = Presentation(str(source_pptx_path))

        # Check slide count compatibility
        if len(prs.slides) != len(model.slides):
            warnings.append(
                f"Presentation model slide count ({len(model.slides)}) differs from source PPTX ({len(prs.slides)})."
            )

        # Scale factors to convert virtual canvas coordinates back into native EMUs
        scale_x = prs.slide_width / model.slide_width if model.slide_width > 0 else 1.0
        scale_y = prs.slide_height / model.slide_height if model.slide_height > 0 else 1.0

        for slide_idx, slide_dto in enumerate(model.slides):
            is_new_slide = False
            if slide_idx >= len(prs.slides):
                # Phase 2.6: Create newly added slide in PowerPoint presentation
                blank_layout = prs.slide_layouts[6]
                slide = prs.slides.add_slide(blank_layout)
                is_new_slide = True
            else:
                slide = prs.slides[slide_idx]

            # Apply slide background color if specified
            canvas_bg = None
            if slide_dto.background_color:
                hex_str = slide_dto.background_color.lstrip("#")
                if len(hex_str) == 6:
                    try:
                        bg_rgb = RGBColor.from_string(hex_str)
                        # Try setting native slide background directly
                        try:
                            slide.background.fill.solid()
                            slide.background.fill.fore_color.rgb = bg_rgb
                        except Exception:
                            pass

                        # Check for existing background shape (CanvasBackground, Background, or full-slide rect)
                        for s in slide.shapes:
                            s_name = getattr(s, "name", "").lower()
                            is_full_canvas = (
                                s.left == 0
                                and s.top == 0
                                and s.width >= int(prs.slide_width * 0.98)
                                and s.height >= int(prs.slide_height * 0.98)
                            )
                            if s_name in ("canvasbackground", "background") or is_full_canvas:
                                canvas_bg = s
                                break

                        if canvas_bg is not None:
                            canvas_bg.fill.solid()
                            canvas_bg.fill.fore_color.rgb = bg_rgb
                            if hasattr(canvas_bg, "line"):
                                try:
                                    canvas_bg.line.fill.background()
                                except Exception:
                                    pass
                        elif is_new_slide:
                            # Add full slide background shape for new slide
                            bg_shape = slide.shapes.add_shape(
                                MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height
                            )
                            bg_shape.name = "CanvasBackground"
                            bg_shape.fill.solid()
                            bg_shape.fill.fore_color.rgb = bg_rgb
                            try:
                                bg_shape.line.fill.background()
                            except Exception:
                                pass
                            canvas_bg = bg_shape
                    except Exception as e:
                        logger.debug(f"Failed to set slide background color: {e}")

            # Index existing native shapes by shape_id
            native_shapes_by_id = {}
            if not is_new_slide:
                for shp in slide.shapes:
                    if hasattr(shp, "shape_id"):
                        native_shapes_by_id[shp.shape_id] = shp

            # Determine which native shapes are still referenced in slide_dto.objects
            referenced_shape_ids = set()
            for obj in slide_dto.objects:
                m = re.search(r"_obj_(\d+)$", obj.object_id)
                if m:
                    referenced_shape_ids.add(int(m.group(1)))

            # If slide layout was restructured or blanked, remove obsolete unreferenced native shapes
            if not is_new_slide:
                if slide_dto.layout_name == "blank":
                    for shp_id, shp in list(native_shapes_by_id.items()):
                        if shp != canvas_bg:
                            try:
                                sp_elem = shp.element
                                parent_elem = sp_elem.getparent()
                                if parent_elem is not None:
                                    parent_elem.remove(sp_elem)
                                    native_shapes_by_id.pop(shp_id, None)
                            except Exception as e:
                                logger.debug(f"Could not remove shape {shp_id} on blank slide: {e}")
                elif len(referenced_shape_ids) > 0:
                    for shp_id, shp in list(native_shapes_by_id.items()):
                        if shp_id not in referenced_shape_ids and shp != canvas_bg:
                            try:
                                sp_elem = shp.element
                                parent_elem = sp_elem.getparent()
                                if parent_elem is not None:
                                    parent_elem.remove(sp_elem)
                                    native_shapes_by_id.pop(shp_id, None)
                            except Exception as e:
                                logger.debug(f"Could not remove obsolete restructured shape {shp_id}: {e}")

            # Process SOM objects
            for obj in slide_dto.objects:
                # Preservation rule: never mutate unsupported objects
                if obj.is_unsupported:
                    continue

                # Match shape_id from object_id (e.g. "{file_id}_slide_1_obj_5" -> 5)
                matched_shape = None
                if not is_new_slide:
                    match = re.search(r"_obj_(\d+)$", obj.object_id)
                    if match:
                        shape_id = int(match.group(1))
                        matched_shape = native_shapes_by_id.get(shape_id)

                if matched_shape is not None:
                    # 1. Update Geometry (Position, Dimensions, Rotation)
                    try:
                        emu_x = int(round(obj.x * scale_x))
                        emu_y = int(round(obj.y * scale_y))
                        emu_w = max(1, int(round(obj.width * scale_x)))
                        emu_h = max(1, int(round(obj.height * scale_y)))

                        matched_shape.left = emu_x
                        matched_shape.top = emu_y
                        matched_shape.width = emu_w
                        matched_shape.height = emu_h
                        matched_shape.rotation = float(obj.rotation % 360.0)
                    except Exception as e:
                        warnings.append(f"Failed to update geometry for object '{obj.name}': {e}")

                    # 2. Update Text content & formatting
                    if obj.object_type in ("text_box", "shape") and matched_shape.has_text_frame and obj.text_content:
                        try:
                            _apply_text_frame(matched_shape.text_frame, obj.text_content)
                        except Exception as e:
                            warnings.append(f"Failed to update text for object '{obj.name}': {e}")

                    # 3. Update Shape & Text Box styling (fills & borders)
                    if obj.object_type in ("shape", "text_box"):
                        if matched_shape == canvas_bg and (slide_dto.background_color or (obj.fill and obj.fill.color)):
                            color_to_use = slide_dto.background_color or (obj.fill.color if obj.fill else None)
                            if color_to_use:
                                hex_str = color_to_use.lstrip("#")
                                if len(hex_str) == 6:
                                    matched_shape.fill.solid()
                                    matched_shape.fill.fore_color.rgb = RGBColor.from_string(hex_str)
                        else:
                            _apply_shape_styling(matched_shape, obj.fill, obj.border)

                    # 4. Update Picture content & cropping
                    if obj.object_type == "picture":
                        # Check for replaced image bytes
                        img_bytes = None
                        if obj.image_asset:
                            if obj.image_asset.asset_id in assets_map:
                                img_bytes = assets_map[obj.image_asset.asset_id]
                            else:
                                # Look in existing presentation asset storage
                                asset_dir = source_pptx_path.parent / f"{model.file_id}_assets"
                                matches = list(asset_dir.glob(f"{obj.image_asset.asset_id}.*"))
                                if matches and matches[0].is_file():
                                    try:
                                        img_bytes = matches[0].read_bytes()
                                    except Exception:
                                        pass

                        if img_bytes is not None:
                            try:
                                # Update native blip relationship in OOXML package
                                img_part, rId = slide.part.get_or_add_image_part(io.BytesIO(img_bytes))
                                matched_shape.element.blipFill.blip.rEmbed = rId
                            except Exception as e:
                                warnings.append(f"Failed to replace image data for '{obj.name}': {e}")

                        # Update crop
                        try:
                            src_w = 0
                            src_h = 0
                            if img_bytes:
                                src_w, src_h = _get_image_dimensions(img_bytes)
                            elif obj.image_asset and obj.image_asset.width_px and obj.image_asset.height_px:
                                src_w = obj.image_asset.width_px
                                src_h = obj.image_asset.height_px
                            elif hasattr(matched_shape, "image") and hasattr(matched_shape.image, "size"):
                                src_w, src_h = matched_shape.image.size

                            if src_w > 0 and src_h > 0:
                                _apply_image_crop(matched_shape, obj.crop, src_w, src_h)
                            elif obj.crop is None:
                                _apply_image_crop(matched_shape, None, 1, 1)
                        except Exception as e:
                            warnings.append(f"Failed to apply crop to '{obj.name}': {e}")

                else:
                    # Newly inserted object (no native shape matched)
                    if obj.object_type == "picture" and obj.image_asset:
                        img_bytes = assets_map.get(obj.image_asset.asset_id)
                        if not img_bytes:
                            # Try looking up in storage
                            asset_dir = source_pptx_path.parent / f"{model.file_id}_assets"
                            matches = list(asset_dir.glob(f"{obj.image_asset.asset_id}.*"))
                            if matches and matches[0].is_file():
                                img_bytes = matches[0].read_bytes()

                        if img_bytes:
                            try:
                                emu_x = int(round(obj.x * scale_x))
                                emu_y = int(round(obj.y * scale_y))
                                emu_w = max(1, int(round(obj.width * scale_x)))
                                emu_h = max(1, int(round(obj.height * scale_y)))

                                new_pic = slide.shapes.add_picture(
                                    io.BytesIO(img_bytes),
                                    emu_x,
                                    emu_y,
                                    emu_w,
                                    emu_h,
                                )
                                new_pic.name = obj.name
                                new_pic.rotation = float(obj.rotation % 360.0)

                                src_w, src_h = _get_image_dimensions(img_bytes)
                                _apply_image_crop(new_pic, obj.crop, src_w, src_h)
                            except Exception as e:
                                warnings.append(f"Failed to insert new picture '{obj.name}': {e}")
                        else:
                            warnings.append(f"Missing image asset payload for new object '{obj.name}'")

                    elif obj.object_type == "shape":
                        try:
                            emu_x = int(round(obj.x * scale_x))
                            emu_y = int(round(obj.y * scale_y))
                            emu_w = max(1, int(round(obj.width * scale_x)))
                            emu_h = max(1, int(round(obj.height * scale_y)))

                            shape_type_attr = getattr(MSO_SHAPE, obj.shape_type or "ROUNDED_RECTANGLE", MSO_SHAPE.ROUNDED_RECTANGLE)
                            new_shp = slide.shapes.add_shape(shape_type_attr, emu_x, emu_y, emu_w, emu_h)
                            new_shp.name = obj.name
                            new_shp.rotation = float(obj.rotation % 360.0)
                            _apply_shape_styling(new_shp, obj.fill, obj.border)
                            if obj.text_content and new_shp.has_text_frame:
                                _apply_text_frame(new_shp.text_frame, obj.text_content)
                        except Exception as e:
                            warnings.append(f"Failed to insert new shape '{obj.name}': {e}")

                    elif obj.object_type == "text_box" and obj.text_content:
                        try:
                            emu_x = int(round(obj.x * scale_x))
                            emu_y = int(round(obj.y * scale_y))
                            emu_w = max(1, int(round(obj.width * scale_x)))
                            emu_h = max(1, int(round(obj.height * scale_y)))

                            new_tb = slide.shapes.add_textbox(emu_x, emu_y, emu_w, emu_h)
                            new_tb.name = obj.name
                            new_tb.rotation = float(obj.rotation % 360.0)
                            _apply_shape_styling(new_tb, obj.fill, obj.border)
                            _apply_text_frame(new_tb.text_frame, obj.text_content)
                        except Exception as e:
                            warnings.append(f"Failed to insert new text box '{obj.name}': {e}")

            # Update speaker notes if modified
            if slide_dto.speaker_notes:
                try:
                    slide.notes_slide.notes_text_frame.text = slide_dto.speaker_notes
                except Exception as e:
                    warnings.append(f"Failed to update speaker notes on slide {slide_idx + 1}: {e}")

        # Save to temporary file first (atomic finalization guarantee)
        prs.save(str(temp_export_path))

        # Validate the temporary export before renaming to final .pptx
        validate_exported_presentation(
            export_path=temp_export_path,
            expected_model=model,
            source_path=source_pptx_path,
            original_source_stat=original_stat,
            original_source_sha256=original_sha256,
        )

        # Atomically finalize to destination
        if final_export_path.exists():
            final_export_path.unlink()
        shutil.move(str(temp_export_path), str(final_export_path))

        # Generate safe descriptive download filename
        safe_title = re.sub(r"[^a-zA-Z0-9_\- ]", "", model.title).strip().replace(" ", "_")[:40] or "presentation"
        download_filename = f"{safe_title}_edited_{export_id[:8]}.pptx"

        logger.info(f"Successfully serialized presentation export to {final_export_path} ({final_export_path.stat().st_size} bytes)")
        return final_export_path, download_filename, warnings

    except Exception as e:
        # Atomic guarantee: clean up temporary file on any error
        if temp_export_path.exists():
            try:
                temp_export_path.unlink()
            except Exception:
                pass
        raise e
