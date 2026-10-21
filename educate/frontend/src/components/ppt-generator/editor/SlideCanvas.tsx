import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Stage, Layer, Rect, Text, Group, Line, Transformer } from 'react-konva';
import type { SlideDetailDTO, SlideObjectDTO, TextRunDTO } from '../types/editor';
import {
  canTransformObject,
  canResizeObject,
  validateDimensions,
  normalizeRotation,
  type ObjectGeometryUpdate,
} from '../utils/editorTransforms';
import { CanvasImage } from './CanvasImage';
import { CanvasTable } from './CanvasTable';
import { CanvasUnsupported } from './CanvasUnsupported';
import { InlineTextEditorOverlay } from './InlineTextEditorOverlay';
import { CropEditorOverlay } from './CropEditorOverlay';
import type { ImageCropDTO } from '../types/editor';

interface SlideCanvasProps {
  slide: SlideDetailDTO;
  slideWidth: number; // Virtual canvas width (e.g. 1920)
  slideHeight: number; // Virtual canvas height (e.g. 1080)
  slideWidthEmu?: number;
  slideHeightEmu?: number;
  selectedObjectId: string | null;
  onSelectObject: (objectId: string | null) => void;
  onUpdateObjectGeometry: (objectId: string, updates: ObjectGeometryUpdate) => void;
  onCommitTextEdit: (objectId: string, newText: string) => void;
  zoom?: number; // 1.0 = 100%, 0.75 = 75%, etc.
  editingObjectId?: string | null;
  onSetEditingObjectId?: (id: string | null) => void;
  croppingObjectId?: string | null;
  onApplyCrop?: (objectId: string, newCrop: ImageCropDTO | null) => void;
  onCancelCrop?: () => void;
}

export const SlideCanvas: React.FC<SlideCanvasProps> = ({
  slide,
  slideWidth,
  slideHeight,
  slideWidthEmu,
  selectedObjectId,
  onSelectObject,
  onUpdateObjectGeometry,
  onCommitTextEdit,
  zoom = 1.0,
  editingObjectId: externalEditingObjectId,
  onSetEditingObjectId,
  croppingObjectId,
  onApplyCrop,
  onCancelCrop,
}) => {
  // Points to virtual canvas pixels ratio:
  // Standard widescreen slide width is 12,192,000 EMU = 960 pt; virtual canvas is 1920 px -> 1920 / 960 = 2.0.
  const ptsToCanvas =
    slideWidthEmu && slideWidthEmu > 0
      ? slideWidth / (slideWidthEmu / 12700)
      : slideWidth > 0
      ? slideWidth / 960
      : 2.0;

  const containerRef = useRef<HTMLDivElement>(null);
  const transformerRef = useRef<any>(null);
  const shapeNodesRef = useRef<Record<string, any>>({});

  // Local editing state fallback if not managed externally
  const [internalEditingId, setInternalEditingId] = useState<string | null>(null);
  const editingObjectId = externalEditingObjectId !== undefined ? externalEditingObjectId : internalEditingId;
  const setEditingObjectId = useCallback(
    (id: string | null) => {
      if (onSetEditingObjectId) {
        onSetEditingObjectId(id);
      } else {
        setInternalEditingId(id);
      }
    },
    [onSetEditingObjectId]
  );

  const [containerDimensions, setContainerDimensions] = useState<{ width: number; height: number }>({
    width: 960,
    height: 540,
  });

  // Responsive viewport measurement
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        if (clientWidth > 0 && clientHeight > 0) {
          setContainerDimensions({ width: clientWidth, height: clientHeight });
        }
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    const observer = new ResizeObserver(updateSize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateSize);
      observer.disconnect();
    };
  }, []);

  // Compute fit-to-viewport scale
  const padding = 48; // Padding around slide
  const availableWidth = Math.max(100, containerDimensions.width - padding);
  const availableHeight = Math.max(100, containerDimensions.height - padding);

  const baseScale = Math.min(availableWidth / slideWidth, availableHeight / slideHeight);
  const scale = baseScale * zoom;

  const stageWidth = slideWidth * scale;
  const stageHeight = slideHeight * scale;

  const selectedObject = slide.objects.find((o) => o.object_id === selectedObjectId) || null;
  const editingObject = slide.objects.find((o) => o.object_id === editingObjectId) || null;
  const croppingObject = slide.objects.find((o) => o.object_id === croppingObjectId) || null;

  // Synchronize Konva Transformer with selected node
  useEffect(() => {
    if (
      selectedObjectId &&
      !editingObjectId &&
      !croppingObjectId &&
      transformerRef.current &&
      selectedObject &&
      canTransformObject(selectedObject)
    ) {
      const targetNode = shapeNodesRef.current[selectedObjectId];
      if (targetNode) {
        transformerRef.current.nodes([targetNode]);
        transformerRef.current.getLayer()?.batchDraw();
        return;
      }
    }

    if (transformerRef.current) {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selectedObjectId, editingObjectId, croppingObjectId, selectedObject]);

  // Global Keyboard listener for canvas shortcuts (Escape to deselect/cancel, Enter to edit text)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing inside an input or textarea
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.key === 'Escape') {
        if (croppingObjectId && onCancelCrop) {
          onCancelCrop();
        } else if (editingObjectId) {
          setEditingObjectId(null);
        } else if (selectedObjectId) {
          onSelectObject(null);
        }
      } else if (e.key === 'Enter' && selectedObject && !editingObjectId && !croppingObjectId) {
        if (selectedObject.text_content || selectedObject.object_type === 'text_box' || selectedObject.object_type === 'shape') {
          e.preventDefault();
          setEditingObjectId(selectedObject.object_id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingObjectId, selectedObjectId, selectedObject, croppingObjectId, onCancelCrop, onSelectObject, setEditingObjectId]);

  const sortedObjects = [...slide.objects].sort((a, b) => a.z_index - b.z_index);

  // Drag End handler: updates virtual coordinates in SOM
  const handleDragEnd = (obj: SlideObjectDTO, e: any) => {
    const node = e.target;
    const newX = Math.round(node.x() * 100) / 100;
    const newY = Math.round(node.y() * 100) / 100;
    onUpdateObjectGeometry(obj.object_id, { x: newX, y: newY });
  };

  // Transform End handler: updates width, height, and rotation in SOM
  const handleTransformEnd = (obj: SlideObjectDTO, e: any) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    // Reset node scale to 1 so width/height take over directly
    node.scaleX(1);
    node.scaleY(1);

    const rawWidth = node.width() * scaleX;
    const rawHeight = node.height() * scaleY;
    const validated = validateDimensions(rawWidth, rawHeight, 20);

    const newX = Math.round(node.x() * 100) / 100;
    const newY = Math.round(node.y() * 100) / 100;
    const newRotation = normalizeRotation(node.rotation());

    onUpdateObjectGeometry(obj.object_id, {
      x: newX,
      y: newY,
      width: validated.width,
      height: validated.height,
      rotation: newRotation,
    });
  };

  return (
    <div className="canvas-viewport-wrapper" ref={containerRef}>
      <div
        className="canvas-stage-shadow-container"
        style={{
          width: stageWidth,
          height: stageHeight,
          position: 'relative',
        }}
      >
        <Stage
          width={stageWidth}
          height={stageHeight}
          scaleX={scale}
          scaleY={scale}
          onMouseDown={(e) => {
            // Deselect when clicking empty stage canvas
            if (e.target === e.target.getStage() || e.target.name() === 'slide-background') {
              if (editingObjectId) {
                setEditingObjectId(null);
              }
              onSelectObject(null);
            }
          }}
        >
          <Layer>
            {/* 1. Slide Canvas Base Background (Locked, non-draggable) */}
            <Rect
              name="slide-background"
              x={0}
              y={0}
              width={slideWidth}
              height={slideHeight}
              fill={slide.background_color || '#FFFFFF'}
              listening={true}
            />

            {/* 2. Slide Objects in Document Order */}
            {sortedObjects.map((obj) => {
              const isSelected = obj.object_id === selectedObjectId;
              const isEditingThis = obj.object_id === editingObjectId;
              const isTransformable = canTransformObject(obj);

              // Unsupported / Native Complex PowerPoint Objects
              if (obj.is_unsupported) {
                return (
                  <CanvasUnsupported
                    key={obj.object_id}
                    x={obj.x}
                    y={obj.y}
                    width={obj.width}
                    height={obj.height}
                    rotation={obj.rotation}
                    name={obj.name}
                    reason={obj.unsupported_reason}
                    isSelected={isSelected}
                    onClick={() => onSelectObject(obj.object_id)}
                  />
                );
              }

              // Pictures
              if (obj.object_type === 'picture' && obj.image_asset) {
                const isCroppingThis = obj.object_id === croppingObjectId;
                return (
                  <Group
                    key={obj.object_id}
                    ref={(node) => {
                      if (node) shapeNodesRef.current[obj.object_id] = node;
                    }}
                    x={obj.x}
                    y={obj.y}
                    width={obj.width}
                    height={obj.height}
                    rotation={obj.rotation}
                    opacity={isCroppingThis ? 0.2 : 1.0}
                    draggable={isTransformable && !isEditingThis && !croppingObjectId}
                    onClick={() => onSelectObject(obj.object_id)}
                    onDragEnd={(e) => handleDragEnd(obj, e)}
                    onTransformEnd={(e) => handleTransformEnd(obj, e)}
                  >
                    <CanvasImage
                      url={obj.image_asset.url}
                      x={0}
                      y={0}
                      width={obj.width}
                      height={obj.height}
                      rotation={0}
                      crop={obj.crop}
                      isSelected={false}
                    />
                  </Group>
                );
              }

              // Tables (Movable, but cell layout resizing is protected)
              if (obj.object_type === 'table' && obj.table_data) {
                return (
                  <Group
                    key={obj.object_id}
                    ref={(node) => {
                      if (node) shapeNodesRef.current[obj.object_id] = node;
                    }}
                    x={obj.x}
                    y={obj.y}
                    width={obj.width}
                    height={obj.height}
                    rotation={obj.rotation}
                    draggable={isTransformable && !isEditingThis}
                    onClick={() => onSelectObject(obj.object_id)}
                    onDragEnd={(e) => handleDragEnd(obj, e)}
                  >
                    <CanvasTable
                      tableData={obj.table_data}
                      x={0}
                      y={0}
                      width={obj.width}
                      height={obj.height}
                      rotation={0}
                    />
                  </Group>
                );
              }

              // Connectors / Lines
              if (obj.object_type === 'connector') {
                return (
                  <Group
                    key={obj.object_id}
                    ref={(node) => {
                      if (node) shapeNodesRef.current[obj.object_id] = node;
                    }}
                    x={obj.x}
                    y={obj.y}
                    width={obj.width}
                    height={obj.height}
                    rotation={obj.rotation}
                    draggable={isTransformable && !isEditingThis}
                    onClick={() => onSelectObject(obj.object_id)}
                    onDragEnd={(e) => handleDragEnd(obj, e)}
                    onTransformEnd={(e) => handleTransformEnd(obj, e)}
                  >
                    <Line
                      x={0}
                      y={0}
                      points={[0, 0, obj.width, obj.height]}
                      stroke={obj.border?.color || '#0F2C59'}
                      strokeWidth={obj.border?.width || 2}
                      dash={obj.border?.style === 'dashed' ? [8, 4] : undefined}
                      rotation={0}
                    />
                  </Group>
                );
              }

              // Regular Shapes (Cards, Badges, Rectangles)
              if (obj.object_type === 'shape') {
                const isRounded =
                  obj.shape_type === 'ROUNDED_RECTANGLE' ||
                  obj.name.toLowerCase().includes('card') ||
                  obj.name.toLowerCase().includes('badge');

                const fillColor = obj.fill?.color || undefined;
                const strokeColor = obj.border?.color || undefined;
                const strokeWidth = obj.border?.width || (strokeColor ? 1 : 0);
                const opacity = obj.fill?.alpha ?? 1.0;

                return (
                  <Group
                    key={obj.object_id}
                    ref={(node) => {
                      if (node) shapeNodesRef.current[obj.object_id] = node;
                    }}
                    x={obj.x}
                    y={obj.y}
                    width={obj.width}
                    height={obj.height}
                    rotation={obj.rotation}
                    draggable={isTransformable && !isEditingThis}
                    onClick={() => onSelectObject(obj.object_id)}
                    onDblClick={() => {
                      if (obj.text_content) {
                        setEditingObjectId(obj.object_id);
                      }
                    }}
                    onDragEnd={(e) => handleDragEnd(obj, e)}
                    onTransformEnd={(e) => handleTransformEnd(obj, e)}
                  >
                    <Rect
                      width={obj.width}
                      height={obj.height}
                      fill={fillColor}
                      opacity={opacity}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      dash={obj.border?.style === 'dashed' ? [6, 4] : undefined}
                      cornerRadius={isRounded ? 10 : 0}
                    />

                    {/* Shape Text Frame (Hidden while inline editing this object) */}
                    {obj.text_content && !isEditingThis && (
                      <ShapeTextRenderer
                        textContent={obj.text_content}
                        width={obj.width}
                        height={obj.height}
                        ptsToCanvas={ptsToCanvas}
                      />
                    )}
                  </Group>
                );
              }

              // Text Boxes
              if (obj.object_type === 'text_box' || obj.text_content) {
                return (
                  <Group
                    key={obj.object_id}
                    ref={(node) => {
                      if (node) shapeNodesRef.current[obj.object_id] = node;
                    }}
                    x={obj.x}
                    y={obj.y}
                    width={obj.width}
                    height={obj.height}
                    rotation={obj.rotation}
                    draggable={isTransformable && !isEditingThis}
                    onClick={() => onSelectObject(obj.object_id)}
                    onDblClick={() => setEditingObjectId(obj.object_id)}
                    onDragEnd={(e) => handleDragEnd(obj, e)}
                    onTransformEnd={(e) => handleTransformEnd(obj, e)}
                  >
                    {/* Bounding box receiver */}
                    <Rect
                      width={obj.width}
                      height={obj.height}
                      fill={obj.fill?.color || 'transparent'}
                      stroke={obj.border?.color || undefined}
                      strokeWidth={obj.border?.width || undefined}
                    />

                    {/* Text content (hidden while inline editing) */}
                    {obj.text_content && !isEditingThis && (
                      <ShapeTextRenderer
                        textContent={obj.text_content}
                        width={obj.width}
                        height={obj.height}
                        ptsToCanvas={ptsToCanvas}
                      />
                    )}
                  </Group>
                );
              }

              return null;
            })}

            {/* 3. Konva Transformer for Interactive Selection, Resizing, and Rotation */}
            {selectedObject && !editingObjectId && canTransformObject(selectedObject) && (
              <Transformer
                ref={transformerRef}
                rotateEnabled={true}
                rotateAnchorOffset={24}
                enabledAnchors={
                  canResizeObject(selectedObject)
                    ? [
                        'top-left',
                        'top-right',
                        'bottom-left',
                        'bottom-right',
                        'middle-left',
                        'middle-right',
                        'top-center',
                        'bottom-center',
                      ]
                    : []
                }
                keepRatio={selectedObject.object_type === 'picture'}
                boundBoxFunc={(oldBox, newBox) => {
                  if (newBox.width < 20 || newBox.height < 20) {
                    return oldBox;
                  }
                  return newBox;
                }}
                borderStroke="#2563EB"
                borderStrokeWidth={2}
                borderDash={[5, 3]}
                anchorStroke="#2563EB"
                anchorFill="#FFFFFF"
                anchorSize={9}
                anchorCornerRadius={2}
              />
            )}
          </Layer>
        </Stage>

        {/* 4. Scale-Aware Inline Text Editor Overlay */}
        {editingObject && (
          <InlineTextEditorOverlay
            object={editingObject}
            scale={scale}
            ptsToCanvas={ptsToCanvas}
            onCommit={(newText) => {
              onCommitTextEdit(editingObject.object_id, newText);
              setEditingObjectId(null);
            }}
            onCancel={() => setEditingObjectId(null)}
          />
        )}

        {/* 5. Scale-Aware Interactive Image Crop Overlay */}
        {croppingObject && onApplyCrop && onCancelCrop && (
          <CropEditorOverlay
            object={croppingObject}
            scale={scale}
            onApplyCrop={(newCrop) => onApplyCrop(croppingObject.object_id, newCrop)}
            onCancelCrop={onCancelCrop}
          />
        )}
      </div>
    </div>
  );
};

let measureCanvasCtx: CanvasRenderingContext2D | null = null;
function getMeasureContext(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!measureCanvasCtx) {
    const canvas = document.createElement('canvas');
    measureCanvasCtx = canvas.getContext('2d');
  }
  return measureCanvasCtx;
}

function measureTextWidth(text: string, font: string, fallbackSize: number): number {
  const ctx = getMeasureContext();
  if (ctx) {
    try {
      ctx.font = font;
      return ctx.measureText(text).width;
    } catch {
      // Fall through to fallback
    }
  }
  return text.length * fallbackSize * 0.55;
}

function estimateWrappedLines(
  text: string,
  fontSize: number,
  fontFamily: string,
  fontStyle: string,
  maxWidth: number
): number {
  if (!text || maxWidth <= 0) return 1;
  const font = `${fontStyle} ${fontSize}px ${fontFamily}`;
  const paragraphs = text.split('\n');
  let totalLines = 0;

  for (const para of paragraphs) {
    if (!para) {
      totalLines += 1;
      continue;
    }
    const words = para.split(' ');
    let currentLine = '';
    let paraLines = 1;

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const w = measureTextWidth(testLine, font, fontSize);
      if (w > maxWidth && currentLine) {
        paraLines += 1;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    totalLines += paraLines;
  }
  return Math.max(1, totalLines);
}

interface ShapeTextRendererProps {
  textContent: NonNullable<SlideObjectDTO['text_content']>;
  width: number;
  height?: number;
  ptsToCanvas?: number;
}

/**
 * Renders structured text content with high-fidelity typography, PowerPoint point-to-canvas
 * scaling, accurate paragraph spacing, line wrapping, and multi-run style preservation.
 */
function ShapeTextRenderer({
  textContent,
  width,
  height,
  ptsToCanvas = 2.0,
}: ShapeTextRendererProps) {
  const pts = ptsToCanvas || 2.0;

  // PowerPoint text frame margins are in points; convert to canvas units via ptsToCanvas
  const padLeft = textContent.margin_left != null ? textContent.margin_left * pts : 7.2 * (pts / 2);
  const padTop = textContent.margin_top != null ? textContent.margin_top * pts : 3.6 * (pts / 2);
  const padRight = textContent.margin_right != null ? textContent.margin_right * pts : 7.2 * (pts / 2);
  const padBottom = textContent.margin_bottom != null ? textContent.margin_bottom * pts : 3.6 * (pts / 2);

  // Clamp padding on compact shapes (e.g. badges, pills) to avoid negative content area
  const safePadLeft = Math.min(padLeft, Math.max(2, width * 0.15));
  const safePadRight = Math.min(padRight, Math.max(2, width * 0.15));
  const contentWidth = Math.max(10, width - safePadLeft - safePadRight);

  // Precompute paragraph layouts and wrapped heights cleanly with useMemo
  const { paragraphLayouts, totalContentHeight } = React.useMemo(() => {
    const results = [];
    let currentY = padTop;

    for (const p of textContent.paragraphs) {
      const defaultRun: TextRunDTO = {
        run_index: 0,
        text: '',
        font_size: 14,
        font_family: 'Calibri',
        font_color: '#0F172A',
        bold: false,
        italic: false,
        underline: false,
      };
      const runs: TextRunDTO[] = p.runs && p.runs.length > 0 ? p.runs : [defaultRun];
      const firstRun = runs[0] || defaultRun;
      const fullText = runs.map((r) => r.text).join('');

      // Font size in points multiplied by ptsToCanvas ratio (36pt -> 72px on 1920x1080 canvas)
      const fontSizePt = firstRun.font_size || 14;
      const fontSize = fontSizePt * pts;
      const spaceBefore = (p.space_before != null ? p.space_before : 0) * pts;
      const spaceAfter = (p.space_after != null ? p.space_after : 2.0) * (pts / 2);

      const fontColor = firstRun.font_color || '#0F172A';
      const fontFamily = firstRun.font_family || 'Calibri, system-ui, sans-serif';

      let fontStyle = 'normal';
      if (firstRun.bold && firstRun.italic) fontStyle = 'bold italic';
      else if (firstRun.bold) fontStyle = 'bold';
      else if (firstRun.italic) fontStyle = 'italic';

      const textDecoration = firstRun.underline ? 'underline' : '';
      const align = p.alignment || 'left';
      const indent = p.level > 0 ? p.level * 24 * (pts / 2) : 0;
      const wrapWidth = Math.max(10, contentWidth - indent);

      // Check whether all runs share the same formatting
      const hasUniformRuns =
        runs.length <= 1 ||
        runs.every(
          (r) =>
            (r.font_size || 14) === fontSizePt &&
            (r.font_family || 'Calibri') === (firstRun.font_family || 'Calibri') &&
            (r.font_color || '#0F172A') === fontColor &&
            !!r.bold === !!firstRun.bold &&
            !!r.italic === !!firstRun.italic &&
            !!r.underline === !!firstRun.underline
        );

      // Wrapped line count measurement ensures paragraphs do not overlap
      const estimatedLines = estimateWrappedLines(fullText, fontSize, fontFamily, fontStyle, wrapWidth);
      const paraHeight = Math.max(fontSize * 1.25, estimatedLines * fontSize * 1.25);

      const paraY = currentY + spaceBefore;
      currentY = paraY + paraHeight + spaceAfter;

      results.push({
        p,
        runs,
        fullText,
        firstRun,
        fontSize,
        fontSizePt,
        fontFamily,
        fontStyle,
        textDecoration,
        fontColor,
        align,
        indent,
        wrapWidth,
        hasUniformRuns,
        paraY,
        paraHeight,
      });
    }

    return {
      paragraphLayouts: results,
      totalContentHeight: currentY - padTop,
    };
  }, [textContent.paragraphs, padTop, pts, contentWidth]);

  // Support PowerPoint vertical alignment (top, middle/center, bottom)
  const verticalAlignment = textContent.vertical_alignment || 'top';
  let verticalShift = 0;
  if ((verticalAlignment === 'middle' || verticalAlignment === 'center') && height && height > totalContentHeight) {
    verticalShift = Math.max(0, (height - totalContentHeight) / 2 - padTop);
  } else if (verticalAlignment === 'bottom' && height && height > totalContentHeight) {
    verticalShift = Math.max(0, height - totalContentHeight - padBottom - padTop);
  }

  return (
    <Group y={verticalShift}>
      {paragraphLayouts.map(
        (
          {
            p,
            runs,
            fullText,
            fontSize,
            fontFamily,
            fontStyle,
            textDecoration,
            fontColor,
            align,
            indent,
            wrapWidth,
            hasUniformRuns,
            paraY,
          },
          pIdx
        ) => {
          if (!fullText && runs.length === 0) return null;

          return (
            <Group key={`p-${pIdx}`} x={safePadLeft + indent} y={paraY}>
              {p.is_bullet && (
                <Text
                  text="•"
                  x={-16}
                  y={0}
                  fontSize={fontSize}
                  fill={fontColor}
                  fontFamily={fontFamily}
                />
              )}

              {/* Uniform run paragraph: Konva native word-wrapped text element */}
              {hasUniformRuns ? (
                <Text
                  text={fullText}
                  width={wrapWidth}
                  fontSize={fontSize}
                  fontFamily={fontFamily}
                  fontStyle={fontStyle}
                  textDecoration={textDecoration}
                  fill={fontColor}
                  align={align}
                  wrap="word"
                  lineHeight={1.25}
                />
              ) : (
                /* Multi-run paragraph with varying styles: render structured runs preserving styles */
                <Group>
                  {(() => {
                    let runX = 0;
                    return runs.map((run, rIdx) => {
                      const runFontSize = (run.font_size || 14) * pts;
                      const runFamily = run.font_family || fontFamily;
                      let runStyle = 'normal';
                      if (run.bold && run.italic) runStyle = 'bold italic';
                      else if (run.bold) runStyle = 'bold';
                      else if (run.italic) runStyle = 'italic';
                      const runDec = run.underline ? 'underline' : '';
                      const runColor = run.font_color || fontColor;

                      const currentRunX = runX;
                      const fontStr = `${runStyle} ${runFontSize}px ${runFamily}`;
                      const runW = measureTextWidth(run.text, fontStr, runFontSize);
                      runX += runW;

                      return (
                        <Text
                          key={`run-${rIdx}`}
                          text={run.text}
                          x={currentRunX}
                          y={0}
                          fontSize={runFontSize}
                          fontFamily={runFamily}
                          fontStyle={runStyle}
                          textDecoration={runDec}
                          fill={runColor}
                          lineHeight={1.25}
                        />
                      );
                    });
                  })()}
                </Group>
              )}
            </Group>
          );
        }
      )}
    </Group>
  );
}


