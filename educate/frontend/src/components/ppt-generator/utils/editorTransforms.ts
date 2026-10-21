/**
 * Pure transformation and geometry utilities for Acadion Visual Editor (Phase 2.3).
 * Provides immutable updates for object movements, resizing, rotation, text updates,
 * and coordinate/EMU synchronization.
 */

import type {
  ImageAssetDTO,
  ImageCropDTO,
  PresentationEditorModel,
  SlideDetailDTO,
  SlideObjectDTO,
  TextContentDTO,
  TextParagraphDTO,
  TextRunDTO,
} from '../types/editor';

export interface ObjectGeometryUpdate {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
}

/**
 * Validates and clamps object dimensions to prevent zero, negative, or degenerate geometry.
 */
export function validateDimensions(
  width: number,
  height: number,
  minSize = 20
): { width: number; height: number } {
  const safeWidth = Number.isFinite(width) ? Math.max(minSize, Math.round(width * 100) / 100) : minSize;
  const safeHeight = Number.isFinite(height) ? Math.max(minSize, Math.round(height * 100) / 100) : minSize;
  return { width: safeWidth, height: safeHeight };
}

/**
 * Normalizes rotation angle into the range [0, 360).
 */
export function normalizeRotation(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  let normalized = Math.round(deg) % 360;
  if (normalized < 0) {
    normalized += 360;
  }
  return normalized;
}

/**
 * Converts virtual canvas coordinate to native PowerPoint EMUs.
 */
export function virtualToEmu(normVal: number, slideEmu: number, virtualDim: number): number {
  if (virtualDim <= 0 || slideEmu <= 0 || !Number.isFinite(normVal)) {
    return Math.round(normVal);
  }
  return Math.round((normVal / virtualDim) * slideEmu);
}

/**
 * Converts native PowerPoint EMUs to virtual canvas coordinate.
 */
export function emuToVirtual(emuVal: number, slideEmu: number, virtualDim: number): number {
  if (slideEmu <= 0 || !Number.isFinite(emuVal)) {
    return emuVal;
  }
  return Math.round(((emuVal / slideEmu) * virtualDim) * 100) / 100;
}

/**
 * Determines whether a slide object can be safely transformed (moved, resized, rotated).
 */
export function canTransformObject(obj: SlideObjectDTO): boolean {
  if (obj.is_unsupported || obj.object_type === 'unsupported') {
    return false;
  }
  return true;
}

/**
 * Determines whether an object supports resizing via Transformer handles.
 * Tables and complex structures cannot be freely resized in this phase.
 */
export function canResizeObject(obj: SlideObjectDTO): boolean {
  if (!canTransformObject(obj)) return false;
  if (obj.object_type === 'table') return false; // Table layout resizing requires cell layout model
  return true;
}

/**
 * Immutably updates the geometry (x, y, width, height, rotation) of a specific object on a slide.
 */
export function updateObjectGeometry(
  slide: SlideDetailDTO,
  objectId: string,
  updates: ObjectGeometryUpdate,
  slideWidth = 1920,
  slideHeight = 1080,
  slideWidthEmu = 12192000,
  slideHeightEmu = 6858000
): SlideDetailDTO {
  const targetIndex = slide.objects.findIndex((o) => o.object_id === objectId);
  if (targetIndex === -1) return slide;

  const currentObj = slide.objects[targetIndex];
  if (!canTransformObject(currentObj)) return slide;

  // Apply and validate dimensions
  let newWidth = currentObj.width;
  let newHeight = currentObj.height;
  if (updates.width !== undefined || updates.height !== undefined) {
    const validated = validateDimensions(
      updates.width !== undefined ? updates.width : currentObj.width,
      updates.height !== undefined ? updates.height : currentObj.height
    );
    newWidth = validated.width;
    newHeight = validated.height;
  }

  const newX = updates.x !== undefined && Number.isFinite(updates.x)
    ? Math.round(updates.x * 100) / 100
    : currentObj.x;

  const newY = updates.y !== undefined && Number.isFinite(updates.y)
    ? Math.round(updates.y * 100) / 100
    : currentObj.y;

  const newRotation = updates.rotation !== undefined
    ? normalizeRotation(updates.rotation)
    : currentObj.rotation;

  // Check if anything actually changed
  if (
    newX === currentObj.x &&
    newY === currentObj.y &&
    newWidth === currentObj.width &&
    newHeight === currentObj.height &&
    newRotation === currentObj.rotation
  ) {
    return slide;
  }

  // Synchronize native PowerPoint EMUs
  const newXEmu = virtualToEmu(newX, slideWidthEmu, slideWidth);
  const newYEmu = virtualToEmu(newY, slideHeightEmu, slideHeight);
  const newWidthEmu = virtualToEmu(newWidth, slideWidthEmu, slideWidth);
  const newHeightEmu = virtualToEmu(newHeight, slideHeightEmu, slideHeight);

  const updatedObj: SlideObjectDTO = {
    ...currentObj,
    x: newX,
    y: newY,
    width: newWidth,
    height: newHeight,
    x_emu: newXEmu,
    y_emu: newYEmu,
    width_emu: newWidthEmu,
    height_emu: newHeightEmu,
    rotation: newRotation,
  };

  const newObjects = [...slide.objects];
  newObjects[targetIndex] = updatedObj;

  return {
    ...slide,
    objects: newObjects,
  };
}

/**
 * Immutably updates the text content of a slide object, preserving existing formatting,
 * typography (fonts, sizes, colors, styles), and bullet structure where applicable.
 */
export function updateObjectText(
  slide: SlideDetailDTO,
  objectId: string,
  newRawText: string
): SlideDetailDTO {
  const targetIndex = slide.objects.findIndex((o) => o.object_id === objectId);
  if (targetIndex === -1) return slide;

  const currentObj = slide.objects[targetIndex];
  if (!currentObj.text_content && currentObj.object_type !== 'text_box') {
    return slide;
  }

  const existingTextContent = currentObj.text_content || {
    paragraphs: [],
    vertical_alignment: 'top',
    word_wrap: true,
  };

  const existingParagraphs = existingTextContent.paragraphs || [];

  // Split new text into logical lines (paragraphs)
  const lines = newRawText.split('\n');

  // Baseline styling from the first existing run or safe defaults
  const firstExistingRun = existingParagraphs[0]?.runs?.[0];
  const defaultRunStyle: Partial<TextRunDTO> = {
    font_family: firstExistingRun?.font_family || 'Calibri, system-ui, sans-serif',
    font_size: firstExistingRun?.font_size || 18,
    font_color: firstExistingRun?.font_color || '#0F172A',
    bold: firstExistingRun?.bold ?? false,
    italic: firstExistingRun?.italic ?? false,
    underline: firstExistingRun?.underline ?? false,
    strikethrough: firstExistingRun?.strikethrough ?? false,
  };

  const updatedParagraphs: TextParagraphDTO[] = lines.map((line, pIdx) => {
    const existingPara = existingParagraphs[pIdx];

    if (existingPara && existingPara.runs.length > 0) {
      // Preserve first run's formatting and apply new line text
      const primaryRun = existingPara.runs[0];
      const updatedRun: TextRunDTO = {
        ...primaryRun,
        run_index: 0,
        text: line,
      };

      return {
        ...existingPara,
        paragraph_index: pIdx,
        runs: [updatedRun],
      };
    }

    // New paragraph: inherit previous paragraph's settings or default
    const prevPara = existingParagraphs[Math.min(pIdx, existingParagraphs.length - 1)];
    const isBullet = prevPara?.is_bullet ?? false;
    const bulletChar = prevPara?.bullet_char ?? (isBullet ? '•' : null);
    const alignment = prevPara?.alignment || 'left';
    const level = prevPara?.level ?? 0;

    const newRun: TextRunDTO = {
      run_index: 0,
      text: line,
      ...defaultRunStyle,
    };

    return {
      paragraph_index: pIdx,
      runs: [newRun],
      alignment,
      level,
      is_bullet: isBullet,
      bullet_char: bulletChar,
      line_spacing: prevPara?.line_spacing || 1.15,
      space_before: prevPara?.space_before || 0,
      space_after: prevPara?.space_after || 4,
    };
  });

  const updatedObj: SlideObjectDTO = {
    ...currentObj,
    text_content: {
      ...existingTextContent,
      paragraphs: updatedParagraphs,
    },
  };

  const newObjects = [...slide.objects];
  newObjects[targetIndex] = updatedObj;

  return {
    ...slide,
    objects: newObjects,
  };
}

export interface TextFormattingUpdate {
  font_family?: string;
  font_size?: number; // points (pt)
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  font_color?: string; // hex #RRGGBB
  alignment?: 'left' | 'center' | 'right' | 'justify';
  fill_color?: string | null; // hex #RRGGBB or null for transparent/none
}

/**
 * Updates text formatting properties (font family, font size, bold, italic, underline,
 * font color, alignment, and container fill) for a selected text object immutably.
 * Applies across all runs within the text object while preserving text content and structure.
 */
export function updateObjectTextFormatting(
  slide: SlideDetailDTO,
  objectId: string,
  formatting: TextFormattingUpdate
): SlideDetailDTO {
  const targetIndex = slide.objects.findIndex((obj) => obj.object_id === objectId);
  if (targetIndex === -1) {
    return slide;
  }

  const currentObj = slide.objects[targetIndex];
  let textContent = currentObj.text_content;

  // If object does not have text_content yet, initialize a single paragraph
  if (!textContent || textContent.paragraphs.length === 0) {
    textContent = {
      paragraphs: [
        {
          paragraph_index: 0,
          runs: [
            {
              run_index: 0,
              text: currentObj.name || '',
              font_family: formatting.font_family || 'Calibri',
              font_size: formatting.font_size || 18,
              font_color: formatting.font_color || '#0F172A',
              bold: formatting.bold ?? false,
              italic: formatting.italic ?? false,
              underline: formatting.underline ?? false,
            },
          ],
          alignment: formatting.alignment || 'left',
          level: 0,
          is_bullet: false,
        },
      ],
      vertical_alignment: 'top',
      word_wrap: true,
    };
  } else {
    // Update existing paragraphs and runs immutably
    const updatedParagraphs = textContent.paragraphs.map((para) => {
      const updatedPara = { ...para };
      if (formatting.alignment !== undefined) {
        updatedPara.alignment = formatting.alignment;
      }

      updatedPara.runs = para.runs.map((run) => {
        const updatedRun = { ...run };
        if (formatting.font_family !== undefined) {
          updatedRun.font_family = formatting.font_family;
        }
        if (formatting.font_size !== undefined && formatting.font_size > 0) {
          updatedRun.font_size = formatting.font_size;
        }
        if (formatting.bold !== undefined) {
          updatedRun.bold = formatting.bold;
        }
        if (formatting.italic !== undefined) {
          updatedRun.italic = formatting.italic;
        }
        if (formatting.underline !== undefined) {
          updatedRun.underline = formatting.underline;
        }
        if (formatting.font_color !== undefined) {
          updatedRun.font_color = formatting.font_color;
        }
        return updatedRun;
      });

      return updatedPara;
    });

    textContent = {
      ...textContent,
      paragraphs: updatedParagraphs,
    };
  }

  // Handle container fill update if specified
  let updatedFill = currentObj.fill ? { ...currentObj.fill } : undefined;
  if (formatting.fill_color !== undefined) {
    if (formatting.fill_color === null || formatting.fill_color === '' || formatting.fill_color === 'transparent') {
      updatedFill = { fill_type: 'none', color: null, alpha: 0.0 };
    } else {
      updatedFill = { fill_type: 'solid', color: formatting.fill_color, alpha: 1.0 };
    }
  }

  const updatedObj: SlideObjectDTO = {
    ...currentObj,
    text_content: textContent,
    fill: updatedFill,
  };

  const newObjects = [...slide.objects];
  newObjects[targetIndex] = updatedObj;

  return {
    ...slide,
    objects: newObjects,
  };
}

/**
 * Replaces a slide in the presentation model with an updated version immutably.
 */
export function updateSlideInModel(
  model: PresentationEditorModel,
  updatedSlide: SlideDetailDTO
): PresentationEditorModel {
  const slideIndex = model.slides.findIndex((s) => s.slide_id === updatedSlide.slide_id);
  if (slideIndex === -1) return model;

  const newSlides = [...model.slides];
  newSlides[slideIndex] = updatedSlide;

  return {
    ...model,
    slides: newSlides,
  };
}

/**
 * Calculates a center-fill crop rectangle for a source image to match a target frame aspect ratio
 * without distortion or stretching.
 */
export function calculateCenterFillCrop(
  srcWidth: number,
  srcHeight: number,
  frameWidth: number,
  frameHeight: number
): ImageCropDTO {
  const safeSrcW = Math.max(1, srcWidth);
  const safeSrcH = Math.max(1, srcHeight);
  const frameAr = Math.max(0.01, frameWidth) / Math.max(0.01, frameHeight);
  const srcAr = safeSrcW / safeSrcH;

  // If aspect ratios are almost identical (< 0.5% diff), no crop is needed
  if (Math.abs(srcAr - frameAr) < 0.005) {
    return { x: 0, y: 0, width: safeSrcW, height: safeSrcH };
  }

  if (srcAr > frameAr) {
    // Source image is wider than target frame: crop sides
    const cropH = safeSrcH;
    const cropW = Math.round(cropH * frameAr);
    const cropX = Math.max(0, Math.round((safeSrcW - cropW) / 2));
    return {
      x: cropX,
      y: 0,
      width: Math.min(cropW, safeSrcW - cropX),
      height: cropH,
    };
  } else {
    // Source image is taller than target frame: crop top/bottom
    const cropW = safeSrcW;
    const cropH = Math.round(cropW / frameAr);
    const cropY = Math.max(0, Math.round((safeSrcH - cropH) / 2));
    return {
      x: 0,
      y: cropY,
      width: cropW,
      height: Math.min(cropH, safeSrcH - cropY),
    };
  }
}

/**
 * Validates and clamps crop coordinates to ensure they remain inside the source image boundaries.
 */
export function validateCropCoordinates(
  crop: ImageCropDTO,
  srcWidth: number,
  srcHeight: number
): ImageCropDTO {
  const safeSrcW = Math.max(1, srcWidth);
  const safeSrcH = Math.max(1, srcHeight);

  const safeX = Math.max(0, Math.min(safeSrcW - 10, Number.isFinite(crop.x) ? crop.x : 0));
  const safeY = Math.max(0, Math.min(safeSrcH - 10, Number.isFinite(crop.y) ? crop.y : 0));
  const safeW = Math.max(10, Math.min(safeSrcW - safeX, Number.isFinite(crop.width) ? crop.width : safeSrcW));
  const safeH = Math.max(10, Math.min(safeSrcH - safeY, Number.isFinite(crop.height) ? crop.height : safeSrcH));

  return {
    x: Math.round(safeX),
    y: Math.round(safeY),
    width: Math.round(safeW),
    height: Math.round(safeH),
  };
}

/**
 * Inserts a new image object onto a slide at a sensible centered position,
 * preserving intrinsic aspect ratio and staying within slide boundaries.
 */
export function insertImageObject(
  slide: SlideDetailDTO,
  imageAsset: ImageAssetDTO,
  slideWidth = 1920,
  slideHeight = 1080,
  slideWidthEmu = 12192000,
  slideHeightEmu = 6858000
): { updatedSlide: SlideDetailDTO; newObjectId: string } {
  const srcW = imageAsset.width_px || 800;
  const srcH = imageAsset.height_px || 600;
  const ar = srcW / srcH;

  // Maximum initial placement dimensions (fits nicely on slide)
  const maxInitialW = Math.min(slideWidth * 0.45, 680);
  const maxInitialH = Math.min(slideHeight * 0.5, 480);

  let initialW = maxInitialW;
  let initialH = initialW / ar;
  if (initialH > maxInitialH) {
    initialH = maxInitialH;
    initialW = initialH * ar;
  }

  initialW = Math.round(initialW);
  initialH = Math.round(initialH);

  const initialX = Math.max(40, Math.round((slideWidth - initialW) / 2));
  const initialY = Math.max(40, Math.round((slideHeight - initialH) / 2));

  const objectId = `obj_img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const maxZIndex = slide.objects.reduce((max, obj) => Math.max(max, obj.z_index), -1);

  const newXEmu = virtualToEmu(initialX, slideWidthEmu, slideWidth);
  const newYEmu = virtualToEmu(initialY, slideHeightEmu, slideHeight);
  const newWidthEmu = virtualToEmu(initialW, slideWidthEmu, slideWidth);
  const newHeightEmu = virtualToEmu(initialH, slideHeightEmu, slideHeight);

  const newImageObject: SlideObjectDTO = {
    object_id: objectId,
    name: imageAsset.original_filename || 'Inserted Picture',
    object_type: 'picture',
    x: initialX,
    y: initialY,
    width: initialW,
    height: initialH,
    x_emu: newXEmu,
    y_emu: newYEmu,
    width_emu: newWidthEmu,
    height_emu: newHeightEmu,
    rotation: 0,
    z_index: maxZIndex + 1,
    image_asset: imageAsset,
    crop: null,
    is_unsupported: false,
  };

  return {
    updatedSlide: {
      ...slide,
      objects: [...slide.objects, newImageObject],
    },
    newObjectId: objectId,
  };
}

/**
 * Replaces the image asset of an existing picture object, preserving its frame position,
 * dimensions, and rotation, and calculating a center-fill crop if aspect ratios differ.
 */
export function replaceImageObject(
  slide: SlideDetailDTO,
  objectId: string,
  newAsset: ImageAssetDTO
): SlideDetailDTO {
  const targetIndex = slide.objects.findIndex((o) => o.object_id === objectId);
  if (targetIndex === -1) return slide;

  const currentObj = slide.objects[targetIndex];
  if (currentObj.object_type !== 'picture') return slide;

  // Calculate crop to match existing frame aspect ratio without stretching
  let newCrop: ImageCropDTO | null = null;
  if (newAsset.width_px && newAsset.height_px) {
    const centerCrop = calculateCenterFillCrop(
      newAsset.width_px,
      newAsset.height_px,
      currentObj.width,
      currentObj.height
    );

    // If crop covers the whole image, keep crop null
    if (
      centerCrop.x !== 0 ||
      centerCrop.y !== 0 ||
      centerCrop.width !== newAsset.width_px ||
      centerCrop.height !== newAsset.height_px
    ) {
      newCrop = centerCrop;
    }
  }

  const updatedObj: SlideObjectDTO = {
    ...currentObj,
    name: newAsset.original_filename || currentObj.name,
    image_asset: newAsset,
    crop: newCrop,
  };

  const newObjects = [...slide.objects];
  newObjects[targetIndex] = updatedObj;

  return {
    ...slide,
    objects: newObjects,
  };
}

/**
 * Updates the crop parameters of a picture object.
 */
export function updateObjectCrop(
  slide: SlideDetailDTO,
  objectId: string,
  newCrop: ImageCropDTO | null
): SlideDetailDTO {
  const targetIndex = slide.objects.findIndex((o) => o.object_id === objectId);
  if (targetIndex === -1) return slide;

  const currentObj = slide.objects[targetIndex];
  if (currentObj.object_type !== 'picture' || !currentObj.image_asset) return slide;

  // Validate crop against source dimensions if provided
  let validatedCrop: ImageCropDTO | null = null;
  if (newCrop) {
    const srcW = currentObj.image_asset.width_px || 1920;
    const srcH = currentObj.image_asset.height_px || 1080;
    validatedCrop = validateCropCoordinates(newCrop, srcW, srcH);
  }

  // Check if crop changed
  const oldCrop = currentObj.crop;
  const isIdentical =
    (!oldCrop && !validatedCrop) ||
    (oldCrop &&
      validatedCrop &&
      oldCrop.x === validatedCrop.x &&
      oldCrop.y === validatedCrop.y &&
      oldCrop.width === validatedCrop.width &&
      oldCrop.height === validatedCrop.height);

  if (isIdentical) return slide;

  const updatedObj: SlideObjectDTO = {
    ...currentObj,
    crop: validatedCrop,
  };

  const newObjects = [...slide.objects];
  newObjects[targetIndex] = updatedObj;

  return {
    ...slide,
    objects: newObjects,
  };
}

/**
 * Resets an image object's crop back to displaying the full source image.
 */
export function resetObjectCrop(slide: SlideDetailDTO, objectId: string): SlideDetailDTO {
  return updateObjectCrop(slide, objectId, null);
}

// ============================================================================
// Phase 2.6: Add Slide, Themes Gallery & Layouts Gallery Transformations
// ============================================================================

import { getRegisteredTheme } from './themeRegistry.ts';

/**
 * Creates a normalized text run helper.
 */
function createRun(
  text: string,
  fontSizePt: number,
  colorHex: string,
  bold = false,
  fontFamily = 'Calibri'
): TextRunDTO {
  return {
    run_index: 0,
    text,
    font_family: fontFamily,
    font_size: fontSizePt,
    font_color: colorHex,
    bold,
    italic: false,
    underline: false,
    strikethrough: false,
  };
}

/**
 * Creates a normalized single-paragraph text content helper.
 */
function createSingleParaContent(
  text: string,
  fontSizePt: number,
  colorHex: string,
  bold = false,
  fontFamily = 'Calibri',
  alignment: 'left' | 'center' | 'right' = 'left'
): TextContentDTO {
  return {
    paragraphs: [
      {
        paragraph_index: 0,
        runs: [createRun(text, fontSizePt, colorHex, bold, fontFamily)],
        alignment,
        level: 0,
        is_bullet: false,
      },
    ],
    word_wrap: true,
  };
}

/**
 * Adds a new slide at the end of the presentation with placeholders matching the selected layout.
 * Guarantees unique, stable IDs and full synchronization of virtual coordinates and native EMUs.
 */
export function addNewSlide(
  model: PresentationEditorModel,
  layoutId = 'cards_grid',
  customThemeId?: string
): { updatedModel: PresentationEditorModel; newSlideId: string; newSlideIndex: number } {
  const slideWidth = model.slide_width || 1920;
  const slideHeight = model.slide_height || 1080;
  const slideWidthEmu = model.slide_width_emu || 12192000;
  const slideHeightEmu = model.slide_height_emu || 6858000;

  const newSlideNumber = model.slides.length + 1;
  const themeId = customThemeId || model.theme || 'academic_navy';
  const theme = getRegisteredTheme(themeId);

  const timestamp = Date.now();
  const newSlideId = `${model.file_id}_slide_${newSlideNumber}_${timestamp}`;
  const objects: SlideObjectDTO[] = [];

  let objCounter = 1;
  const nextObjId = () => `${model.file_id}_slide_${newSlideNumber}_obj_${objCounter++}`;

  // Helper to build object with synchronized EMUs
  const createObj = (
    name: string,
    type: 'text_box' | 'shape',
    shapeType: string | null,
    x: number,
    y: number,
    width: number,
    height: number,
    fill: { fill_type: string; color?: string | null } | null = null,
    border: { color?: string | null; width?: number | null } | null = null,
    textContent: TextContentDTO | null = null
  ): SlideObjectDTO => {
    return {
      object_id: nextObjId(),
      name,
      object_type: type,
      shape_type: shapeType,
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
      width: Math.round(width * 100) / 100,
      height: Math.round(height * 100) / 100,
      x_emu: virtualToEmu(x, slideWidthEmu, slideWidth),
      y_emu: virtualToEmu(y, slideHeightEmu, slideHeight),
      width_emu: virtualToEmu(width, slideWidthEmu, slideWidth),
      height_emu: virtualToEmu(height, slideHeightEmu, slideHeight),
      rotation: 0,
      z_index: objects.length,
      fill: fill ? { fill_type: fill.fill_type, color: fill.color || null } : null,
      border: border ? { color: border.color || null, width: border.width || 1, style: 'solid' } : null,
      text_content: textContent,
      is_unsupported: false,
    };
  };

  if (layoutId === 'blank') {
    // Blank slide has no initial objects
  } else if (layoutId === 'title_slide') {
    // Title Hero Layout
    const cardW = 1680;
    const cardH = 760;
    const cardX = (slideWidth - cardW) / 2;
    const cardY = (slideHeight - cardH) / 2;

    objects.push(
      createObj(
        'HeroContainer',
        'shape',
        'ROUNDED_RECTANGLE',
        cardX,
        cardY,
        cardW,
        cardH,
        { fill_type: 'solid', color: theme.colors.card },
        { color: theme.colors.cardBorder, width: 1.5 }
      )
    );

    objects.push(
      createObj(
        'CategoryBadge',
        'text_box',
        null,
        cardX + 80,
        cardY + 80,
        cardW - 160,
        45,
        null,
        null,
        createSingleParaContent(
          'ACADION CURRICULUM SERIES',
          14,
          theme.colors.accent,
          true,
          theme.fontHeading
        )
      )
    );

    objects.push(
      createObj(
        'PresentationTitle',
        'text_box',
        null,
        cardX + 80,
        cardY + 140,
        cardW - 160,
        140,
        null,
        null,
        createSingleParaContent(
          `Module ${newSlideNumber}: Core Curriculum Concepts`,
          40,
          theme.colors.primary,
          true,
          theme.fontHeading
        )
      )
    );

    objects.push(
      createObj(
        'PresentationSubtitle',
        'text_box',
        null,
        cardX + 80,
        cardY + 300,
        cardW - 160,
        90,
        null,
        null,
        createSingleParaContent(
          'Foundational Principles, Architectural Paradigms & Practical Methodologies',
          20,
          theme.colors.textSecondary,
          false,
          theme.fontBody
        )
      )
    );
  } else {
    // Standard header elements for all other layouts
    const headerLeft = 115;
    const headerWidth = 1690;

    objects.push(
      createObj(
        'CategoryBadge',
        'text_box',
        null,
        headerLeft,
        65,
        headerWidth,
        35,
        null,
        null,
        createSingleParaContent(
          'CURRICULUM LECTURE',
          13,
          theme.colors.accent,
          true,
          theme.fontHeading
        )
      )
    );

    objects.push(
      createObj(
        'SlideTitle',
        'text_box',
        null,
        headerLeft,
        105,
        headerWidth,
        75,
        null,
        null,
        createSingleParaContent(
          `Topic ${newSlideNumber}: Key Analysis & Frameworks`,
          32,
          theme.colors.primary,
          true,
          theme.fontHeading
        )
      )
    );

    objects.push(
      createObj(
        'HeaderDivider',
        'shape',
        'RECTANGLE',
        headerLeft,
        195,
        headerWidth,
        3,
        { fill_type: 'solid', color: theme.colors.cardBorder }
      )
    );

    const contentTop = 230;
    const contentHeight = 720;

    if (layoutId === 'two_column') {
      const colW = 815;
      const gap = 60;
      for (let i = 0; i < 2; i++) {
        const colX = headerLeft + i * (colW + gap);
        objects.push(
          createObj(
            `ColumnCard_${i + 1}`,
            'shape',
            'ROUNDED_RECTANGLE',
            colX,
            contentTop,
            colW,
            contentHeight,
            { fill_type: 'solid', color: theme.colors.card },
            { color: theme.colors.cardBorder, width: 1 }
          )
        );

        objects.push(
          createObj(
            `ColumnTitle_${i + 1}`,
            'text_box',
            null,
            colX + 35,
            contentTop + 35,
            colW - 70,
            50,
            null,
            null,
            createSingleParaContent(
              i === 0 ? 'Primary Concept / Pillar A' : 'Comparative Concept / Pillar B',
              20,
              theme.colors.primary,
              true,
              theme.fontHeading
            )
          )
        );

        objects.push(
          createObj(
            `ColumnBody_${i + 1}`,
            'text_box',
            null,
            colX + 35,
            contentTop + 100,
            colW - 70,
            contentHeight - 140,
            null,
            null,
            createSingleParaContent(
              i === 0
                ? '• Foundational mechanisms and theoretical principles.\n• Systematic framework modeling.\n• Empirical validation metrics.'
                : '• Contrasting perspectives and complementary advantages.\n• Operational trade-offs and complexity bounds.\n• Deployment scenarios.',
              16,
              theme.colors.textSecondary,
              false,
              theme.fontBody
            )
          )
        );
      }
    } else if (layoutId === 'multi_column') {
      const colW = 525;
      const gap = 57;
      for (let i = 0; i < 3; i++) {
        const colX = headerLeft + i * (colW + gap);
        objects.push(
          createObj(
            `PillarCard_${i + 1}`,
            'shape',
            'ROUNDED_RECTANGLE',
            colX,
            contentTop,
            colW,
            contentHeight,
            { fill_type: 'solid', color: theme.colors.card },
            { color: theme.colors.cardBorder, width: 1 }
          )
        );

        objects.push(
          createObj(
            `PillarTitle_${i + 1}`,
            'text_box',
            null,
            colX + 25,
            contentTop + 30,
            colW - 50,
            45,
            null,
            null,
            createSingleParaContent(
              `Pillar 0${i + 1}`,
              19,
              theme.colors.primary,
              true,
              theme.fontHeading
            )
          )
        );

        objects.push(
          createObj(
            `PillarBody_${i + 1}`,
            'text_box',
            null,
            colX + 25,
            contentTop + 90,
            colW - 50,
            contentHeight - 120,
            null,
            null,
            createSingleParaContent(
              `Core principles for pillar ${i + 1}.\n\n• High-reliability design.\n• Modular integration.\n• Continuous assessment.`,
              15,
              theme.colors.textSecondary,
              false,
              theme.fontBody
            )
          )
        );
      }
    } else if (layoutId === 'visual_flow') {
      const stepW = 390;
      const gap = 43;
      for (let i = 0; i < 4; i++) {
        const stepX = headerLeft + i * (stepW + gap);
        objects.push(
          createObj(
            `FlowStepCard_${i + 1}`,
            'shape',
            'ROUNDED_RECTANGLE',
            stepX,
            contentTop,
            stepW,
            contentHeight,
            { fill_type: 'solid', color: theme.colors.card },
            { color: theme.colors.cardBorder, width: 1 }
          )
        );

        objects.push(
          createObj(
            `FlowBadge_${i + 1}`,
            'text_box',
            null,
            stepX + 25,
            contentTop + 25,
            stepW - 50,
            45,
            null,
            null,
            createSingleParaContent(
              `PHASE 0${i + 1}`,
              16,
              theme.colors.accent,
              true,
              theme.fontHeading
            )
          )
        );

        objects.push(
          createObj(
            `FlowTitle_${i + 1}`,
            'text_box',
            null,
            stepX + 25,
            contentTop + 80,
            stepW - 50,
            45,
            null,
            null,
            createSingleParaContent(
              ['Initiation', 'Formulation', 'Execution', 'Verification'][i],
              18,
              theme.colors.primary,
              true,
              theme.fontHeading
            )
          )
        );

        objects.push(
          createObj(
            `FlowBody_${i + 1}`,
            'text_box',
            null,
            stepX + 25,
            contentTop + 140,
            stepW - 50,
            contentHeight - 170,
            null,
            null,
            createSingleParaContent(
              `Key actions in phase ${i + 1}:\n\n• Process definition\n• Resource validation\n• Milestone checkpoint`,
              14,
              theme.colors.textSecondary,
              false,
              theme.fontBody
            )
          )
        );
      }
    } else if (layoutId === 'stats_metrics') {
      const cardW = 525;
      const gap = 57;
      const metricValues = ['99.4%', '10x', '24/7'];
      const metricLabels = ['Accuracy Benchmark', 'Performance Scale', 'Continuous Uptime'];

      for (let i = 0; i < 3; i++) {
        const cardX = headerLeft + i * (cardW + gap);
        objects.push(
          createObj(
            `MetricCard_${i + 1}`,
            'shape',
            'ROUNDED_RECTANGLE',
            cardX,
            contentTop,
            cardW,
            contentHeight,
            { fill_type: 'solid', color: theme.colors.card },
            { color: theme.colors.cardBorder, width: 1 }
          )
        );

        objects.push(
          createObj(
            `MetricValue_${i + 1}`,
            'text_box',
            null,
            cardX + 30,
            contentTop + 60,
            cardW - 60,
            90,
            null,
            null,
            createSingleParaContent(
              metricValues[i],
              46,
              theme.colors.primary,
              true,
              theme.fontHeading,
              'center'
            )
          )
        );

        objects.push(
          createObj(
            `MetricLabel_${i + 1}`,
            'text_box',
            null,
            cardX + 30,
            contentTop + 170,
            cardW - 60,
            45,
            null,
            null,
            createSingleParaContent(
              metricLabels[i],
              18,
              theme.colors.accent,
              true,
              theme.fontHeading,
              'center'
            )
          )
        );

        objects.push(
          createObj(
            `MetricBody_${i + 1}`,
            'text_box',
            null,
            cardX + 30,
            contentTop + 240,
            cardW - 60,
            contentHeight - 270,
            null,
            null,
            createSingleParaContent(
              'Verified through empirical benchmark testing across diverse representative baseline suites.',
              15,
              theme.colors.textSecondary,
              false,
              theme.fontBody,
              'center'
            )
          )
        );
      }
    } else if (layoutId === 'asymmetric') {
      const leftW = 980;
      const rightW = 660;
      const gap = 50;
      const leftX = headerLeft;
      const rightX = leftX + leftW + gap;

      // Dominant left card
      objects.push(
        createObj(
          'FocusCard',
          'shape',
          'ROUNDED_RECTANGLE',
          leftX,
          contentTop,
          leftW,
          contentHeight,
          { fill_type: 'solid', color: theme.colors.card },
          { color: theme.colors.cardBorder, width: 1 }
        )
      );

      objects.push(
        createObj(
          'FocusTitle',
          'text_box',
          null,
          leftX + 40,
          contentTop + 40,
          leftW - 80,
          55,
          null,
          null,
          createSingleParaContent(
            'Core Theoretical Formulation',
            24,
            theme.colors.primary,
            true,
            theme.fontHeading
          )
        )
      );

      objects.push(
        createObj(
          'FocusBody',
          'text_box',
          null,
          leftX + 40,
          contentTop + 115,
          leftW - 80,
          contentHeight - 160,
          null,
          null,
          createSingleParaContent(
            'The central mathematical formulation demonstrates how representations preserve semantic relationships across latent topological spaces.\n\nKey theorem:\n• Monotonic convergence under stochastic updates\n• Bounded curvature in high-dimensional manifolds\n• Invariance under affine coordinate transformations',
            17,
            theme.colors.textSecondary,
            false,
            theme.fontBody
          )
        )
      );

      // Two right stacked cards
      const stackH = (contentHeight - 30) / 2;
      for (let i = 0; i < 2; i++) {
        const stackY = contentTop + i * (stackH + 30);
        objects.push(
          createObj(
            `DetailCard_${i + 1}`,
            'shape',
            'ROUNDED_RECTANGLE',
            rightX,
            stackY,
            rightW,
            stackH,
            { fill_type: 'solid', color: theme.colors.card },
            { color: theme.colors.cardBorder, width: 1 }
          )
        );

        objects.push(
          createObj(
            `DetailTitle_${i + 1}`,
            'text_box',
            null,
            rightX + 30,
            stackY + 25,
            rightW - 60,
            40,
            null,
            null,
            createSingleParaContent(
              i === 0 ? 'Empirical Observation' : 'Practical Consideration',
              18,
              theme.colors.primary,
              true,
              theme.fontHeading
            )
          )
        );

        objects.push(
          createObj(
            `DetailBody_${i + 1}`,
            'text_box',
            null,
            rightX + 30,
            stackY + 70,
            rightW - 60,
            stackH - 95,
            null,
            null,
            createSingleParaContent(
              i === 0
                ? 'Empirical evaluations confirm 35% reduction in sample complexity on benchmark sets.'
                : 'Hardware memory scaling requirements must be balanced against latency targets.',
              15,
              theme.colors.textSecondary,
              false,
              theme.fontBody
            )
          )
        );
      }
    } else {
      // Default: cards_grid (3 cards across full safe width)
      const colW = 525;
      const gap = 57;

      for (let i = 0; i < 3; i++) {
        const cardX = headerLeft + i * (colW + gap);
        objects.push(
          createObj(
            `Card_${i + 1}`,
            'shape',
            'ROUNDED_RECTANGLE',
            cardX,
            contentTop,
            colW,
            contentHeight,
            { fill_type: 'solid', color: theme.colors.card },
            { color: theme.colors.cardBorder, width: 1 }
          )
        );

        // Top accent strip
        objects.push(
          createObj(
            `AccentStrip_${i + 1}`,
            'shape',
            'ROUNDED_RECTANGLE',
            cardX,
            contentTop,
            colW,
            16,
            { fill_type: 'solid', color: i === 0 ? theme.colors.accent : theme.colors.secondary }
          )
        );

        objects.push(
          createObj(
            `CardHeader_${i + 1}`,
            'text_box',
            null,
            cardX + 30,
            contentTop + 40,
            colW - 60,
            50,
            null,
            null,
            createSingleParaContent(
              `Concept 0${i + 1}`,
              20,
              theme.colors.primary,
              true,
              theme.fontHeading
            )
          )
        );

        objects.push(
          createObj(
            `CardBody_${i + 1}`,
            'text_box',
            null,
            cardX + 30,
            contentTop + 105,
            colW - 60,
            contentHeight - 135,
            null,
            null,
            createSingleParaContent(
              `Explanation of core concept 0${i + 1}.\n\n• Point A: Theoretical derivation\n• Point B: Experimental results\n• Point C: Critical takeaways`,
              16,
              theme.colors.textSecondary,
              false,
              theme.fontBody
            )
          )
        );
      }
    }

    // Add footer
    const footerY = 980;
    objects.push(
      createObj(
        'FooterDivider',
        'shape',
        'RECTANGLE',
        headerLeft,
        footerY,
        headerWidth,
        2,
        { fill_type: 'solid', color: theme.colors.cardBorder }
      )
    );

    objects.push(
      createObj(
        'FooterText',
        'text_box',
        null,
        headerLeft,
        footerY + 12,
        headerWidth / 2,
        35,
        null,
        null,
        createSingleParaContent(
          'Acadion Learning  •  Curriculum Presentation',
          13,
          theme.colors.textMuted,
          false,
          theme.fontBody
        )
      )
    );
  }

  const newSlide: SlideDetailDTO = {
    slide_id: newSlideId,
    slide_number: newSlideNumber,
    width: slideWidth,
    height: slideHeight,
    background_color: theme.colors.bg,
    background_type: 'solid',
    speaker_notes: `Instructional talking points and lecture review for Slide ${newSlideNumber}.`,
    layout_name: layoutId,
    objects,
  };

  const updatedModel: PresentationEditorModel = {
    ...model,
    slide_count: newSlideNumber,
    slides: [...model.slides, newSlide],
  };

  return {
    updatedModel,
    newSlideId,
    newSlideIndex: newSlideNumber - 1,
  };
}

/**
 * Applies a theme's visual styling to a single slide.
 * Updates background color, card surfaces, borders, headers, and text colors/fonts.
 */
export function applyThemeToSlide(
  slide: SlideDetailDTO,
  themeId: string
): SlideDetailDTO {
  const theme = getRegisteredTheme(themeId);

  const updatedObjects = slide.objects.map((obj) => {
    // Unsupported objects remain protected
    if (obj.is_unsupported) return obj;

    let updatedFill = obj.fill ? { ...obj.fill } : undefined;
    let updatedBorder = obj.border ? { ...obj.border } : undefined;
    let updatedText = obj.text_content ? { ...obj.text_content } : undefined;

    const nameLower = obj.name.toLowerCase();

    // 1. Full slide canvas background shape
    const isFullCanvasBackground =
      nameLower === 'background' ||
      nameLower === 'canvasbackground' ||
      (obj.x === 0 && obj.y === 0 && obj.width >= 1800 && obj.height >= 1000);

    if (isFullCanvasBackground) {
      updatedFill = {
        fill_type: 'solid',
        color: theme.colors.bg,
      };
      if (updatedBorder) {
        updatedBorder = {
          ...updatedBorder,
          color: theme.colors.bg,
          width: 0,
        };
      }
    }

    // 2. Divider rules / horizontal lines
    const isDivider =
      !isFullCanvasBackground &&
      ((obj.height <= 8 && obj.width >= 150) ||
        nameLower.includes('divider') ||
        nameLower.includes('rule') ||
        nameLower.includes('line'));

    if (isDivider) {
      if (updatedFill) {
        updatedFill.color = theme.colors.cardBorder;
      }
      if (updatedBorder) {
        updatedBorder.color = theme.colors.cardBorder;
      }
    }

    // 3. Card containers and pillar shapes
    const isCard =
      !isFullCanvasBackground &&
      !isDivider &&
      ((obj.object_type === 'shape' &&
        (obj.shape_type === 'ROUNDED_RECTANGLE' ||
          obj.shape_type === 'RECTANGLE' ||
          !obj.shape_type) &&
        obj.width >= 200 &&
        obj.height >= 90) ||
        nameLower.includes('card') ||
        nameLower.includes('container') ||
        nameLower.includes('pillar') ||
        nameLower.includes('box') ||
        nameLower.includes('frame'));

    if (isCard) {
      if (updatedFill && updatedFill.fill_type === 'solid') {
        updatedFill.color = theme.colors.card;
      }
      if (updatedBorder) {
        updatedBorder.color = theme.colors.cardBorder;
      }
    }

    // 4. Accent shapes, badges, number circles, top strips, chevrons
    const isAccentShape =
      !isFullCanvasBackground &&
      !isDivider &&
      !isCard &&
      (obj.shape_type === 'OVAL' ||
        obj.shape_type === 'CHEVRON' ||
        (obj.width < 200 && obj.height < 100 && obj.height > 8) ||
        nameLower.includes('accent') ||
        nameLower.includes('badge') ||
        nameLower.includes('pill') ||
        nameLower.includes('strip') ||
        nameLower.includes('circle') ||
        nameLower.includes('oval') ||
        nameLower.includes('chevron'));

    if (isAccentShape) {
      if (updatedFill && updatedFill.fill_type === 'solid') {
        updatedFill.color = theme.colors.accent;
      }
      if (updatedBorder) {
        updatedBorder.color = theme.colors.secondary || theme.colors.accent;
      }
    }

    // 5. Text typography & colors
    if (updatedText && updatedText.paragraphs) {
      let maxFontSize = 14;
      let hasBold = false;
      for (const p of updatedText.paragraphs) {
        for (const r of p.runs) {
          if (r.font_size && r.font_size > maxFontSize) {
            maxFontSize = r.font_size;
          }
          if (r.bold) {
            hasBold = true;
          }
        }
      }

      const isFooter =
        obj.y >= 920 ||
        nameLower.includes('footer') ||
        nameLower.includes('page');
      const isCategory =
        !isFooter &&
        obj.y < 120 &&
        (maxFontSize <= 16 ||
          nameLower.includes('badge') ||
          nameLower.includes('category'));
      const isTitle =
        !isFooter &&
        !isCategory &&
        obj.y < 260 &&
        (maxFontSize >= 20 ||
          nameLower.includes('title') ||
          nameLower.includes('header') ||
          nameLower.includes('headline'));
      const isCardHeader =
        !isFooter &&
        !isCategory &&
        !isTitle &&
        hasBold &&
        (maxFontSize >= 17 ||
          nameLower.includes('head') ||
          nameLower.includes('title'));
      const isBadgeNumber =
        obj.shape_type === 'OVAL' || (obj.width < 100 && obj.height < 100);

      const updatedParas = updatedText.paragraphs.map((para) => {
        const updatedRuns = para.runs.map((run) => {
          let newColor = run.font_color;
          let newFamily = run.font_family;

          if (isFooter) {
            newColor = theme.colors.textMuted;
            newFamily = theme.fontBody;
          } else if (isCategory) {
            newColor = theme.colors.accent;
            newFamily = theme.fontHeading;
          } else if (isTitle) {
            newColor = theme.colors.primary;
            newFamily = theme.fontHeading;
          } else if (isBadgeNumber) {
            newColor = '#FFFFFF';
            newFamily = theme.fontHeading;
          } else if (isCardHeader) {
            newColor = theme.isDark ? theme.colors.textPrimary : theme.colors.primary;
            newFamily = theme.fontHeading;
          } else {
            // Body text
            newColor = theme.colors.textSecondary;
            newFamily = theme.fontBody;
          }

          return {
            ...run,
            font_color: newColor,
            font_family: newFamily,
          };
        });

        return {
          ...para,
          runs: updatedRuns,
        };
      });

      updatedText = {
        ...updatedText,
        paragraphs: updatedParas,
      };
    }

    return {
      ...obj,
      fill: updatedFill,
      border: updatedBorder,
      text_content: updatedText,
    };
  });

  return {
    ...slide,
    background_color: theme.colors.bg,
    theme: themeId,
    objects: updatedObjects,
  };
}

/**
 * Applies a theme across all slides in a presentation and updates model theme metadata.
 */
export function applyThemeToPresentation(
  model: PresentationEditorModel,
  themeId: string
): PresentationEditorModel {
  const updatedSlides = model.slides.map((s) => applyThemeToSlide(s, themeId));
  return {
    ...model,
    theme: themeId,
    slides: updatedSlides,
  };
}

/**
 * Restructures an existing slide's objects to match a new layout while preserving
 * current text titles, bullet points, and pictures.
 */
export function applyLayoutToSlide(
  slide: SlideDetailDTO,
  layoutId: string,
  slideWidth = 1920,
  slideHeight = 1080,
  slideWidthEmu = 12192000,
  slideHeightEmu = 6858000,
  fileId = 'presentation'
): { updatedSlide: SlideDetailDTO; requiresRestructureWarning: boolean } {
  // If blank layout requested, preserve only background and speaker notes
  if (layoutId === 'blank') {
    const bgObj = slide.objects.find(
      (o) =>
        o.name.toLowerCase() === 'background' ||
        o.name.toLowerCase() === 'canvasbackground' ||
        (o.x === 0 && o.y === 0 && o.width >= 1800 && o.height >= 1000)
    );
    return {
      updatedSlide: {
        ...slide,
        layout_name: 'blank',
        objects: bgObj ? [bgObj] : [],
      },
      requiresRestructureWarning: slide.objects.length > 1,
    };
  }

  // 1. Extract existing semantic content from any slide
  const existingPictures: SlideObjectDTO[] = [];
  const existingContentShapes: SlideObjectDTO[] = [];
  let existingBgObj: SlideObjectDTO | null = null;
  let existingDividerObj: SlideObjectDTO | null = null;
  const topTextObjects: Array<{ obj: SlideObjectDTO; text: string }> = [];
  const bodyTextObjects: Array<{ obj: SlideObjectDTO; text: string }> = [];

  for (const obj of slide.objects) {
    if (obj.is_unsupported) continue;

    const nameLower = obj.name.toLowerCase();
    const isBg =
      nameLower === 'background' ||
      nameLower === 'canvasbackground' ||
      (obj.x === 0 && obj.y === 0 && obj.width >= 1800 && obj.height >= 1000);

    if (isBg) {
      existingBgObj = obj;
      continue;
    }

    if (obj.object_type === 'picture') {
      existingPictures.push(obj);
      continue;
    }

    const isDivider =
      (obj.height <= 8 && obj.width >= 150) ||
      nameLower.includes('divider') ||
      nameLower.includes('rule');
    if (isDivider) {
      existingDividerObj = obj;
      continue;
    }

    // Check for text content
    const fullText = obj.text_content?.paragraphs
      ? obj.text_content.paragraphs
          .map((p) => p.runs.map((r) => r.text).join(''))
          .join('\n')
          .trim()
      : '';

    if (fullText) {
      const isFooter =
        obj.y >= 920 ||
        nameLower.includes('footer') ||
        nameLower.includes('page');
      if (isFooter) {
        continue;
      }

      if (obj.y < 250) {
        topTextObjects.push({ obj, text: fullText });
      } else {
        bodyTextObjects.push({ obj, text: fullText });
      }
    } else if (obj.object_type === 'shape') {
      existingContentShapes.push(obj);
    }
  }

  // Determine Title and Category from top texts
  topTextObjects.sort((a, b) => a.obj.y - b.obj.y);
  let currentTitle = 'Slide Presentation';
  let currentCategory = 'CURRICULUM LECTURE';
  let existingTitleObjId: string | null = null;
  let existingCategoryObjId: string | null = null;

  if (topTextObjects.length >= 2) {
    currentCategory = topTextObjects[0].text;
    existingCategoryObjId = topTextObjects[0].obj.object_id;
    currentTitle = topTextObjects[1].text;
    existingTitleObjId = topTextObjects[1].obj.object_id;
  } else if (topTextObjects.length === 1) {
    currentTitle = topTextObjects[0].text;
    existingTitleObjId = topTextObjects[0].obj.object_id;
  }

  // Extract Content Points
  bodyTextObjects.sort((a, b) =>
    Math.abs(a.obj.x - b.obj.x) > 50
      ? a.obj.x - b.obj.x
      : a.obj.y - b.obj.y
  );

  const extractedPoints: Array<{ title: string; text: string }> = [];
  for (let i = 0; i < bodyTextObjects.length; i++) {
    const item = bodyTextObjects[i];
    const text = item.text;

    // Check if item is a step badge like '01' or 'STAGE 01' or 'Step 1' followed by title
    if (
      (/^\d+$/.test(text) ||
        /^STAGE\s+\d+$/i.test(text) ||
        /^Step\s+\d+$/i.test(text)) &&
      i + 1 < bodyTextObjects.length
    ) {
      const next = bodyTextObjects[i + 1];
      const nextLines = next.text.split('\n').filter(Boolean);
      extractedPoints.push({
        title: `${text}: ${nextLines[0]}`,
        text: nextLines.slice(1).join('\n') || nextLines[0],
      });
      i++;
      continue;
    }

    const lines = text.split('\n').filter(Boolean);
    if (lines.length > 1) {
      extractedPoints.push({
        title: lines[0],
        text: lines.slice(1).join('\n'),
      });
    } else {
      extractedPoints.push({
        title: `Key Point 0${extractedPoints.length + 1}`,
        text,
      });
    }
  }

  // Fallback defaults if slide had no body text
  if (extractedPoints.length === 0) {
    extractedPoints.push(
      {
        title: 'Core Principle 01',
        text: 'Theoretical foundation and methodology.',
      },
      {
        title: 'Core Principle 02',
        text: 'Empirical experimentation and evaluation.',
      },
      {
        title: 'Core Principle 03',
        text: 'Practical implications and next steps.',
      }
    );
  }

  // Determine warning condition if target layout accommodates fewer items than existing
  let targetSlots = 3;
  if (layoutId === 'two_column') targetSlots = 2;
  else if (layoutId === 'multi_column' || layoutId === 'stats_metrics')
    targetSlots = 3;
  else if (layoutId === 'cards_grid' || layoutId === 'visual_flow')
    targetSlots = 4;
  else if (layoutId === 'editorial' || layoutId === 'title_slide')
    targetSlots = 1;

  const requiresRestructureWarning = extractedPoints.length > targetSlots;

  // 2. Generate target layout template in the slide's active theme
  const activeThemeId = slide.theme || 'academic_navy';
  const dummyModel: PresentationEditorModel = {
    file_id: fileId,
    title: 'temp',
    slide_width: slideWidth,
    slide_height: slideHeight,
    slide_width_emu: slideWidthEmu,
    slide_height_emu: slideHeightEmu,
    scale_x: 1,
    scale_y: 1,
    slide_count: 1,
    slides: [],
    theme: activeThemeId,
    source_metadata: {},
  };

  const { updatedModel: templateModel } = addNewSlide(
    dummyModel,
    layoutId,
    activeThemeId
  );
  const templateSlide = templateModel.slides[0];

  // Pool of existing native content shape IDs for stable remapping
  const existingIdPool: string[] = [
    ...bodyTextObjects.map((b) => b.obj.object_id),
    ...existingContentShapes.map((s) => s.object_id),
  ];
  let idPoolIdx = 0;
  const getNextExistingId = () => {
    if (idPoolIdx < existingIdPool.length) {
      return existingIdPool[idPoolIdx++];
    }
    return null;
  };

  // Map extracted content and IDs into template objects
  let pointIndex = 0;
  const remappedObjects = templateSlide.objects.map((obj) => {
    const nameLower = obj.name.toLowerCase();

    // Remap Background
    if (
      existingBgObj &&
      (nameLower === 'background' || nameLower === 'canvasbackground')
    ) {
      return {
        ...obj,
        object_id: existingBgObj.object_id,
      };
    }

    // Remap Category Badge
    if (nameLower.includes('badge') && !nameLower.includes('flowbadge')) {
      const stableId = existingCategoryObjId || getNextExistingId() || obj.object_id;
      if (
        obj.text_content &&
        obj.text_content.paragraphs[0] &&
        obj.text_content.paragraphs[0].runs[0]
      ) {
        const run = obj.text_content.paragraphs[0].runs[0];
        return {
          ...obj,
          object_id: stableId,
          text_content: {
            ...obj.text_content,
            paragraphs: [
              {
                ...obj.text_content.paragraphs[0],
                runs: [{ ...run, text: currentCategory }],
              },
            ],
          },
        };
      }
      return { ...obj, object_id: stableId };
    }

    // Remap Title
    if (nameLower.includes('slidetitle') || nameLower === 'title') {
      const stableId = existingTitleObjId || getNextExistingId() || obj.object_id;
      if (
        obj.text_content &&
        obj.text_content.paragraphs[0] &&
        obj.text_content.paragraphs[0].runs[0]
      ) {
        const run = obj.text_content.paragraphs[0].runs[0];
        return {
          ...obj,
          object_id: stableId,
          text_content: {
            ...obj.text_content,
            paragraphs: [
              {
                ...obj.text_content.paragraphs[0],
                runs: [{ ...run, text: currentTitle }],
              },
            ],
          },
        };
      }
      return { ...obj, object_id: stableId };
    }

    // Remap Divider
    if (nameLower.includes('divider') || nameLower.includes('rule')) {
      const stableId =
        (existingDividerObj ? existingDividerObj.object_id : null) ||
        getNextExistingId() ||
        obj.object_id;
      return { ...obj, object_id: stableId };
    }

    // Remap Slot Titles / Headers
    if (
      nameLower.includes('title_') ||
      nameLower.includes('columntitle') ||
      nameLower.includes('pillartitle') ||
      nameLower.includes('flowtitle') ||
      nameLower.includes('focustitle') ||
      nameLower.includes('detailtitle')
    ) {
      const pt = extractedPoints[pointIndex % extractedPoints.length];
      const stableId = getNextExistingId() || obj.object_id;
      if (
        pt &&
        obj.text_content &&
        obj.text_content.paragraphs[0] &&
        obj.text_content.paragraphs[0].runs[0]
      ) {
        const run = obj.text_content.paragraphs[0].runs[0];
        return {
          ...obj,
          object_id: stableId,
          text_content: {
            ...obj.text_content,
            paragraphs: [
              {
                ...obj.text_content.paragraphs[0],
                runs: [{ ...run, text: pt.title }],
              },
            ],
          },
        };
      }
      return { ...obj, object_id: stableId };
    }

    // Remap Slot Body text
    if (
      nameLower.includes('body_') ||
      nameLower.includes('columnbody') ||
      nameLower.includes('pillarbody') ||
      nameLower.includes('flowbody') ||
      nameLower.includes('focusbody') ||
      nameLower.includes('detailbody') ||
      nameLower.includes('metricbody')
    ) {
      const pt = extractedPoints[pointIndex % extractedPoints.length];
      pointIndex++;
      const stableId = getNextExistingId() || obj.object_id;
      if (
        pt &&
        obj.text_content &&
        obj.text_content.paragraphs[0] &&
        obj.text_content.paragraphs[0].runs[0]
      ) {
        const run = obj.text_content.paragraphs[0].runs[0];
        return {
          ...obj,
          object_id: stableId,
          text_content: {
            ...obj.text_content,
            paragraphs: [
              {
                ...obj.text_content.paragraphs[0],
                runs: [{ ...run, text: pt.text }],
              },
            ],
          },
        };
      }
      return { ...obj, object_id: stableId };
    }

    // Shapes: card backgrounds, accent shapes, etc.
    if (obj.object_type === 'shape') {
      const stableId = getNextExistingId() || obj.object_id;
      return { ...obj, object_id: stableId };
    }

    return obj;
  });

  // Preserve existing picture if there was one
  if (existingPictures.length > 0) {
    const pic = existingPictures[0];
    remappedObjects.push({
      ...pic,
      z_index: remappedObjects.length,
    });
  }

  return {
    updatedSlide: {
      ...slide,
      layout_name: layoutId,
      theme: activeThemeId,
      objects: remappedObjects,
    },
    requiresRestructureWarning,
  };
}


