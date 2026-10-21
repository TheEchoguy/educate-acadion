import React, { useState } from 'react';
import type { SlideDetailDTO, SlideObjectDTO } from '../types/editor';
import {
  canTransformObject,
  canResizeObject,
  validateDimensions,
  normalizeRotation,
  type ObjectGeometryUpdate,
  type TextFormattingUpdate,
} from '../utils/editorTransforms';
import {
  Sliders,
  Type,
  Square,
  Image as ImageIcon,
  Table as TableIcon,
  AlertTriangle,
  FileText,
  Layers,
  ChevronLeft,
  ChevronRight,
  Info,
  X,
  Compass,
  Edit3,
  Lock,
  Crop,
  RotateCcw,
  ImagePlus,
  RefreshCw,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
} from 'lucide-react';

interface ObjectGeometryInputsProps {
  selectedObject: SlideObjectDTO;
  isResizable: boolean;
  onUpdateObjectGeometry: (objectId: string, updates: ObjectGeometryUpdate) => void;
}

const ObjectGeometryInputs: React.FC<ObjectGeometryInputsProps> = ({
  selectedObject,
  isResizable,
  onUpdateObjectGeometry,
}) => {
  const [posX, setPosX] = useState(String(Math.round(selectedObject.x)));
  const [posY, setPosY] = useState(String(Math.round(selectedObject.y)));
  const [dimW, setDimW] = useState(String(Math.round(selectedObject.width)));
  const [dimH, setDimH] = useState(String(Math.round(selectedObject.height)));
  const [rot, setRot] = useState(String(Math.round(selectedObject.rotation)));

  // Adjust state during render if object props changed from outside (e.g. canvas drag/transform or undo/redo)
  const [prevProps, setPrevProps] = useState({
    id: selectedObject.object_id,
    x: selectedObject.x,
    y: selectedObject.y,
    w: selectedObject.width,
    h: selectedObject.height,
    r: selectedObject.rotation,
  });

  if (
    prevProps.id !== selectedObject.object_id ||
    prevProps.x !== selectedObject.x ||
    prevProps.y !== selectedObject.y ||
    prevProps.w !== selectedObject.width ||
    prevProps.h !== selectedObject.height ||
    prevProps.r !== selectedObject.rotation
  ) {
    setPrevProps({
      id: selectedObject.object_id,
      x: selectedObject.x,
      y: selectedObject.y,
      w: selectedObject.width,
      h: selectedObject.height,
      r: selectedObject.rotation,
    });
    setPosX(String(Math.round(selectedObject.x)));
    setPosY(String(Math.round(selectedObject.y)));
    setDimW(String(Math.round(selectedObject.width)));
    setDimH(String(Math.round(selectedObject.height)));
    setRot(String(Math.round(selectedObject.rotation)));
  }

  const commitPositionChange = () => {
    const xVal = parseFloat(posX);
    const yVal = parseFloat(posY);
    if (!isNaN(xVal) && !isNaN(yVal)) {
      onUpdateObjectGeometry(selectedObject.object_id, {
        x: Math.round(xVal * 100) / 100,
        y: Math.round(yVal * 100) / 100,
      });
    } else {
      setPosX(String(Math.round(selectedObject.x)));
      setPosY(String(Math.round(selectedObject.y)));
    }
  };

  const commitDimensionChange = () => {
    if (!isResizable) return;
    const wVal = parseFloat(dimW);
    const hVal = parseFloat(dimH);
    if (!isNaN(wVal) && !isNaN(hVal)) {
      const validated = validateDimensions(wVal, hVal, 20);
      onUpdateObjectGeometry(selectedObject.object_id, {
        width: validated.width,
        height: validated.height,
      });
      setDimW(String(validated.width));
      setDimH(String(validated.height));
    } else {
      setDimW(String(Math.round(selectedObject.width)));
      setDimH(String(Math.round(selectedObject.height)));
    }
  };

  const commitRotationChange = () => {
    const rotVal = parseFloat(rot);
    if (!isNaN(rotVal)) {
      const normalized = normalizeRotation(rotVal);
      onUpdateObjectGeometry(selectedObject.object_id, { rotation: normalized });
      setRot(String(normalized));
    } else {
      setRot(String(Math.round(selectedObject.rotation)));
    }
  };

  return (
    <>
      <div className="property-grid-2x2">
        <div className="property-input-field">
          <label className="field-label" htmlFor="prop-input-x">
            X (Canvas)
          </label>
          <div className="input-with-unit">
            <input
              id="prop-input-x"
              type="number"
              className="inspector-num-input"
              value={posX}
              onChange={(e) => setPosX(e.target.value)}
              onBlur={commitPositionChange}
              onKeyDown={(e) => e.key === 'Enter' && commitPositionChange()}
            />
            <span className="unit-label">pt</span>
          </div>
        </div>

        <div className="property-input-field">
          <label className="field-label" htmlFor="prop-input-y">
            Y (Canvas)
          </label>
          <div className="input-with-unit">
            <input
              id="prop-input-y"
              type="number"
              className="inspector-num-input"
              value={posY}
              onChange={(e) => setPosY(e.target.value)}
              onBlur={commitPositionChange}
              onKeyDown={(e) => e.key === 'Enter' && commitPositionChange()}
            />
            <span className="unit-label">pt</span>
          </div>
        </div>

        <div className="property-input-field">
          <label className="field-label" htmlFor="prop-input-w">
            Width
          </label>
          <div className="input-with-unit">
            <input
              id="prop-input-w"
              type="number"
              min="20"
              disabled={!isResizable}
              className="inspector-num-input"
              value={dimW}
              onChange={(e) => setDimW(e.target.value)}
              onBlur={commitDimensionChange}
              onKeyDown={(e) => e.key === 'Enter' && commitDimensionChange()}
            />
            <span className="unit-label">pt</span>
          </div>
        </div>

        <div className="property-input-field">
          <label className="field-label" htmlFor="prop-input-h">
            Height
          </label>
          <div className="input-with-unit">
            <input
              id="prop-input-h"
              type="number"
              min="20"
              disabled={!isResizable}
              className="inspector-num-input"
              value={dimH}
              onChange={(e) => setDimH(e.target.value)}
              onBlur={commitDimensionChange}
              onKeyDown={(e) => e.key === 'Enter' && commitDimensionChange()}
            />
            <span className="unit-label">pt</span>
          </div>
        </div>
      </div>

      <div className="property-input-row" style={{ marginTop: '0.65rem' }}>
        <label className="field-label" htmlFor="prop-input-rot">
          Rotation
        </label>
        <div className="input-with-unit" style={{ width: '90px' }}>
          <input
            id="prop-input-rot"
            type="number"
            min="-360"
            max="360"
            className="inspector-num-input"
            value={rot}
            onChange={(e) => setRot(e.target.value)}
            onBlur={commitRotationChange}
            onKeyDown={(e) => e.key === 'Enter' && commitRotationChange()}
          />
          <span className="unit-label">°</span>
        </div>
      </div>
    </>
  );
};

const STANDARD_FONTS = [
  'Calibri',
  'Arial',
  'Aptos',
  'Times New Roman',
  'Verdana',
  'Segoe UI',
  'Georgia',
  'Trebuchet MS',
  'Courier New',
  'Tahoma',
  'Helvetica',
];

const PRESET_FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60, 72];

const STANDARD_TEXT_COLORS = [
  '#000000',
  '#FFFFFF',
  '#475569',
  '#1E3A8A',
  '#2563EB',
  '#0D9488',
  '#16A34A',
  '#DC2626',
  '#D97706',
  '#9333EA',
];

const STANDARD_FILL_COLORS = [
  '#FFFFFF',
  '#F8FAFC',
  '#F1F5F9',
  '#EFF6FF',
  '#F0FDF4',
  '#FEF2F2',
  '#FEF9C3',
  '#1E293B',
  '#0F172A',
];

interface ObjectTextFormattingControlsProps {
  selectedObject: SlideObjectDTO;
  onUpdateTextFormatting?: (objectId: string, updates: TextFormattingUpdate) => void;
  onStartTextEditing?: (objectId: string) => void;
}

const ObjectTextFormattingControls: React.FC<ObjectTextFormattingControlsProps> = ({
  selectedObject,
  onUpdateTextFormatting,
  onStartTextEditing,
}) => {
  const firstPara = selectedObject.text_content?.paragraphs?.[0];
  const firstRun = firstPara?.runs?.[0];

  const currentFontFamily = firstRun?.font_family || 'Calibri';
  const currentFontSize = firstRun?.font_size ? Math.round(firstRun.font_size) : 18;
  const isBold = !!firstRun?.bold;
  const isItalic = !!firstRun?.italic;
  const isUnderline = !!firstRun?.underline;
  const currentColor = firstRun?.font_color || '#0F172A';
  const currentAlignment = firstPara?.alignment || 'left';
  const currentFillColor = selectedObject.fill?.color || '';
  const isFillNone = selectedObject.fill?.fill_type === 'none' || !currentFillColor;

  const [fontSizeInput, setFontSizeInput] = useState(String(currentFontSize));
  const [colorInput, setColorInput] = useState(currentColor);
  const [fillColorInput, setFillColorInput] = useState(currentFillColor || '#FFFFFF');

  // Sync state if object or properties change externally (e.g. undo/redo)
  const [prevSync, setPrevSync] = useState({
    id: selectedObject.object_id,
    size: currentFontSize,
    color: currentColor,
    fill: currentFillColor,
  });

  if (
    prevSync.id !== selectedObject.object_id ||
    prevSync.size !== currentFontSize ||
    prevSync.color !== currentColor ||
    prevSync.fill !== currentFillColor
  ) {
    setPrevSync({
      id: selectedObject.object_id,
      size: currentFontSize,
      color: currentColor,
      fill: currentFillColor,
    });
    setFontSizeInput(String(currentFontSize));
    setColorInput(currentColor);
    setFillColorInput(currentFillColor || '#FFFFFF');
  }

  const commitFontSize = () => {
    if (!onUpdateTextFormatting) return;
    const parsed = parseInt(fontSizeInput, 10);
    if (!isNaN(parsed) && parsed >= 6 && parsed <= 144) {
      onUpdateTextFormatting(selectedObject.object_id, { font_size: parsed });
      setFontSizeInput(String(parsed));
    } else {
      setFontSizeInput(String(currentFontSize));
    }
  };

  const handleStepFontSize = (delta: number) => {
    if (!onUpdateTextFormatting) return;
    const next = Math.max(6, Math.min(144, currentFontSize + delta));
    onUpdateTextFormatting(selectedObject.object_id, { font_size: next });
    setFontSizeInput(String(next));
  };

  const handleFontFamilyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!onUpdateTextFormatting) return;
    const newFont = e.target.value;
    onUpdateTextFormatting(selectedObject.object_id, { font_family: newFont });
  };

  const handlePresetFontSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!onUpdateTextFormatting) return;
    const size = parseInt(e.target.value, 10);
    if (!isNaN(size) && size > 0) {
      onUpdateTextFormatting(selectedObject.object_id, { font_size: size });
      setFontSizeInput(String(size));
    }
  };

  const handleToggleBold = () => {
    if (!onUpdateTextFormatting) return;
    onUpdateTextFormatting(selectedObject.object_id, { bold: !isBold });
  };

  const handleToggleItalic = () => {
    if (!onUpdateTextFormatting) return;
    onUpdateTextFormatting(selectedObject.object_id, { italic: !isItalic });
  };

  const handleToggleUnderline = () => {
    if (!onUpdateTextFormatting) return;
    onUpdateTextFormatting(selectedObject.object_id, { underline: !isUnderline });
  };

  const handleAlignment = (alignment: 'left' | 'center' | 'right' | 'justify') => {
    if (!onUpdateTextFormatting) return;
    onUpdateTextFormatting(selectedObject.object_id, { alignment });
  };

  const handleColorChange = (color: string) => {
    if (!onUpdateTextFormatting) return;
    setColorInput(color);
    onUpdateTextFormatting(selectedObject.object_id, { font_color: color });
  };

  const commitColorHex = () => {
    if (!onUpdateTextFormatting) return;
    const hex = colorInput.trim();
    if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex)) {
      onUpdateTextFormatting(selectedObject.object_id, { font_color: hex });
    } else {
      setColorInput(currentColor);
    }
  };

  const handleFillColorChange = (color: string) => {
    if (!onUpdateTextFormatting) return;
    setFillColorInput(color);
    onUpdateTextFormatting(selectedObject.object_id, { fill_color: color });
  };

  const commitFillHex = () => {
    if (!onUpdateTextFormatting) return;
    const hex = fillColorInput.trim();
    if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex)) {
      onUpdateTextFormatting(selectedObject.object_id, { fill_color: hex });
    } else {
      setFillColorInput(currentFillColor || '#FFFFFF');
    }
  };

  const handleClearFill = () => {
    if (!onUpdateTextFormatting) return;
    onUpdateTextFormatting(selectedObject.object_id, { fill_color: null });
  };

  const fontOptions = STANDARD_FONTS.includes(currentFontFamily)
    ? STANDARD_FONTS
    : [currentFontFamily, ...STANDARD_FONTS];

  return (
    <div className="inspector-card text-formatting-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h4 className="card-section-title" style={{ margin: 0 }}>
          <Type size={14} /> Text Formatting
        </h4>
        {onStartTextEditing && (
          <button
            type="button"
            className="btn-edit-text-action"
            onClick={() => onStartTextEditing(selectedObject.object_id)}
            title="Double-click on canvas or click to edit text"
          >
            <Edit3 size={13} />
            <span>Edit Text</span>
          </button>
        )}
      </div>

      {/* Formatting Scope Badge */}
      <div className="formatting-scope-chip" title="Formatting is applied across all paragraphs and runs in this text box">
        <Info size={11} />
        <span>Scope: Entire Text Box</span>
      </div>

      {/* Font Family Selector */}
      <div className="formatting-control-group">
        <label className="field-label" htmlFor="prop-font-family">
          Font Family
        </label>
        <select
          id="prop-font-family"
          className="formatting-select"
          value={currentFontFamily}
          onChange={handleFontFamilyChange}
          style={{ fontFamily: currentFontFamily }}
        >
          {fontOptions.map((font) => (
            <option key={font} value={font} style={{ fontFamily: font }}>
              {font}
            </option>
          ))}
        </select>
      </div>

      {/* Font Size & Steppers */}
      <div className="formatting-control-group">
        <label className="field-label" htmlFor="prop-font-size-input">
          <span>Font Size</span>
          <span style={{ fontSize: '0.68rem', color: '#64748B' }}>{currentFontSize} pt</span>
        </label>
        <div className="font-size-stepper-row">
          <div className="input-with-unit" style={{ flex: '1 1 80px' }}>
            <input
              id="prop-font-size-input"
              type="number"
              min="6"
              max="144"
              className="inspector-num-input"
              value={fontSizeInput}
              onChange={(e) => setFontSizeInput(e.target.value)}
              onBlur={commitFontSize}
              onKeyDown={(e) => e.key === 'Enter' && commitFontSize()}
              aria-label="Font size in points"
            />
            <span className="unit-label">pt</span>
          </div>

          <select
            className="formatting-select"
            style={{ width: '64px', flexShrink: 0 }}
            value={PRESET_FONT_SIZES.includes(currentFontSize) ? currentFontSize : ''}
            onChange={handlePresetFontSizeChange}
            aria-label="Common font sizes"
          >
            <option value="" disabled>
              Size
            </option>
            {PRESET_FONT_SIZES.map((sz) => (
              <option key={sz} value={sz}>
                {sz}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="font-size-stepper-btn"
            onClick={() => handleStepFontSize(-2)}
            title="Decrease font size by 2 pt"
            aria-label="Decrease font size"
          >
            A-
          </button>
          <button
            type="button"
            className="font-size-stepper-btn"
            onClick={() => handleStepFontSize(2)}
            title="Increase font size by 2 pt"
            aria-label="Increase font size"
          >
            A+
          </button>
        </div>
      </div>

      {/* Character Formatting & Alignment Toolbar */}
      <div className="formatting-toolbar-row">
        {/* Bold / Italic / Underline */}
        <div className="formatting-btn-group" role="group" aria-label="Character Formatting">
          <button
            type="button"
            className={`formatting-icon-btn ${isBold ? 'active' : ''}`}
            onClick={handleToggleBold}
            title="Bold (Ctrl+B)"
            aria-pressed={isBold}
            aria-label="Bold"
          >
            <Bold size={14} />
          </button>
          <button
            type="button"
            className={`formatting-icon-btn ${isItalic ? 'active' : ''}`}
            onClick={handleToggleItalic}
            title="Italic (Ctrl+I)"
            aria-pressed={isItalic}
            aria-label="Italic"
          >
            <Italic size={14} />
          </button>
          <button
            type="button"
            className={`formatting-icon-btn ${isUnderline ? 'active' : ''}`}
            onClick={handleToggleUnderline}
            title="Underline (Ctrl+U)"
            aria-pressed={isUnderline}
            aria-label="Underline"
          >
            <Underline size={14} />
          </button>
        </div>

        {/* Alignment */}
        <div className="formatting-btn-group" role="group" aria-label="Paragraph Alignment">
          <button
            type="button"
            className={`formatting-icon-btn ${currentAlignment === 'left' ? 'active' : ''}`}
            onClick={() => handleAlignment('left')}
            title="Align Left"
            aria-pressed={currentAlignment === 'left'}
            aria-label="Align Left"
          >
            <AlignLeft size={14} />
          </button>
          <button
            type="button"
            className={`formatting-icon-btn ${currentAlignment === 'center' ? 'active' : ''}`}
            onClick={() => handleAlignment('center')}
            title="Align Center"
            aria-pressed={currentAlignment === 'center'}
            aria-label="Align Center"
          >
            <AlignCenter size={14} />
          </button>
          <button
            type="button"
            className={`formatting-icon-btn ${currentAlignment === 'right' ? 'active' : ''}`}
            onClick={() => handleAlignment('right')}
            title="Align Right"
            aria-pressed={currentAlignment === 'right'}
            aria-label="Align Right"
          >
            <AlignRight size={14} />
          </button>
          <button
            type="button"
            className={`formatting-icon-btn ${currentAlignment === 'justify' ? 'active' : ''}`}
            onClick={() => handleAlignment('justify')}
            title="Justify"
            aria-pressed={currentAlignment === 'justify'}
            aria-label="Justify"
          >
            <AlignJustify size={14} />
          </button>
        </div>
      </div>

      {/* Text Color Control */}
      <div className="formatting-control-group color-picker-control">
        <label className="field-label">
          <span>Text Color</span>
          <span className="color-hex">{currentColor}</span>
        </label>
        <div className="color-input-row">
          <label className="color-swatch-picker-btn" title="Pick custom text color">
            <input
              type="color"
              value={currentColor.startsWith('#') && currentColor.length === 7 ? currentColor : '#000000'}
              onChange={(e) => handleColorChange(e.target.value)}
            />
            <span
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: currentColor,
                display: 'block',
              }}
            />
          </label>
          <input
            type="text"
            className="inspector-num-input"
            style={{ width: '82px', fontSize: '0.75rem', fontFamily: 'monospace' }}
            value={colorInput}
            onChange={(e) => setColorInput(e.target.value)}
            onBlur={commitColorHex}
            onKeyDown={(e) => e.key === 'Enter' && commitColorHex()}
            placeholder="#000000"
            aria-label="Text color hex code"
          />
          <div className="swatches-palette-row">
            {STANDARD_TEXT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`swatch-dot-btn ${currentColor.toUpperCase() === c.toUpperCase() ? 'active' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => handleColorChange(c)}
                title={c}
                aria-label={`Select text color ${c}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Text Box Fill / Background (Distinguished from character highlight) */}
      <div className="formatting-control-group color-picker-control">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label className="field-label" style={{ margin: 0 }}>
            <span>Text Box Fill / Background</span>
          </label>
          <button
            type="button"
            className={`btn-transparent-fill ${isFillNone ? 'active' : ''}`}
            onClick={handleClearFill}
            title="Clear fill (transparent background in PPTX)"
          >
            No Fill
          </button>
        </div>
        <div className="color-input-row">
          <label className="color-swatch-picker-btn" title="Pick text box container background color">
            <input
              type="color"
              value={
                currentFillColor.startsWith('#') && currentFillColor.length === 7
                  ? currentFillColor
                  : '#FFFFFF'
              }
              onChange={(e) => handleFillColorChange(e.target.value)}
            />
            <span
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: isFillNone ? 'transparent' : currentFillColor,
                backgroundImage: isFillNone
                  ? 'linear-gradient(45deg, #cbd5e1 25%, transparent 25%), linear-gradient(-45deg, #cbd5e1 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #cbd5e1 75%), linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)'
                  : undefined,
                backgroundSize: '6px 6px',
                display: 'block',
              }}
            />
          </label>
          <input
            type="text"
            className="inspector-num-input"
            style={{ width: '82px', fontSize: '0.75rem', fontFamily: 'monospace' }}
            value={isFillNone ? 'None' : fillColorInput}
            onChange={(e) => setFillColorInput(e.target.value)}
            onBlur={commitFillHex}
            onKeyDown={(e) => e.key === 'Enter' && commitFillHex()}
            disabled={isFillNone}
            placeholder="#FFFFFF"
            aria-label="Text box fill color hex code"
          />
          <div className="swatches-palette-row">
            {STANDARD_FILL_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`swatch-dot-btn ${!isFillNone && currentFillColor.toUpperCase() === c.toUpperCase() ? 'active' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => handleFillColorChange(c)}
                title={c}
                aria-label={`Select fill color ${c}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Text Content Preview */}
      {selectedObject.text_content && (
        <div className="text-preview-box">
          <span className="text-preview-label">Content:</span>
          <p className="text-preview-content">
            {selectedObject.text_content.paragraphs
              .map((p) => p.runs.map((r) => r.text).join(''))
              .join('\n') || '(Empty text)'}
          </p>
        </div>
      )}
    </div>
  );
};

interface PropertiesInspectorProps {
  activeSlide: SlideDetailDTO;
  totalSlides: number;
  selectedObject: SlideObjectDTO | null;
  onDeselectObject: () => void;
  onSelectObject: (objectId: string) => void;
  onUpdateObjectGeometry: (objectId: string, updates: ObjectGeometryUpdate) => void;
  onUpdateTextFormatting?: (objectId: string, updates: TextFormattingUpdate) => void;
  onStartTextEditing?: (objectId: string) => void;
  onTriggerAddImage?: () => void;
  onTriggerReplaceImage?: () => void;
  onStartCrop?: (objectId: string) => void;
  onResetCrop?: (objectId: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const PropertiesInspector: React.FC<PropertiesInspectorProps> = ({
  activeSlide,
  totalSlides,
  selectedObject,
  onDeselectObject,
  onSelectObject,
  onUpdateObjectGeometry,
  onUpdateTextFormatting,
  onStartTextEditing,
  onTriggerAddImage,
  onTriggerReplaceImage,
  onStartCrop,
  onResetCrop,
  isCollapsed,
  onToggleCollapse,
}) => {
  if (!selectedObject) {
    // Render slide overview when nothing is selected
    return (
      <aside className={`editor-sidebar inspector-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <button
            type="button"
            className="sidebar-toggle-btn"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand Inspector' : 'Collapse Inspector'}
            aria-label={isCollapsed ? 'Expand Inspector' : 'Collapse Inspector'}
          >
            {isCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>

          {!isCollapsed && (
            <div className="sidebar-title-row">
              <Sliders size={16} className="sidebar-icon" />
              <span className="sidebar-title">Slide Overview</span>
            </div>
          )}
        </div>

        {!isCollapsed && (
          <div className="inspector-content-scroll">
            <div className="inspector-panel-inner animate-fade-in">
              {/* Slide Meta Card */}
              <div className="inspector-card">
                <span className="slide-meta-badge">
                  Slide {activeSlide.slide_number} of {totalSlides}
                </span>
                <h3 className="inspector-slide-title">
                  {activeSlide.layout_name || `Slide #${activeSlide.slide_number}`}
                </h3>

                <div className="property-row">
                  <span className="field-label">Dimensions</span>
                  <span className="field-value">
                    {Math.round(activeSlide.width)} × {Math.round(activeSlide.height)} pt (16:9)
                  </span>
                </div>

                <div className="property-row">
                  <span className="field-label">Background</span>
                  <div className="color-preview-row">
                    <span
                      className="color-swatch"
                      style={{ backgroundColor: activeSlide.background_color || '#FFFFFF' }}
                    />
                    <span className="color-hex">{activeSlide.background_color || '#FFFFFF'}</span>
                  </div>
                </div>

                <div className="property-row">
                  <span className="field-label">Total Elements</span>
                  <span className="field-value">{activeSlide.objects.length} objects</span>
                </div>

                {onTriggerAddImage && (
                  <div style={{ marginTop: '0.85rem' }}>
                    <button
                      type="button"
                      className="btn-inspector-action btn-add-image-action"
                      onClick={onTriggerAddImage}
                      title="Upload and insert an image onto this slide"
                    >
                      <ImagePlus size={14} />
                      <span>Add Image to Slide</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Speaker Notes */}
              <div className="inspector-card">
                <h4 className="card-section-title">
                  <FileText size={14} /> Instructor Speaker Notes
                </h4>
                {activeSlide.speaker_notes ? (
                  <div className="speaker-notes-box">
                    <p>{activeSlide.speaker_notes}</p>
                  </div>
                ) : (
                  <div className="empty-notes-hint">
                    No speaker notes attached to this slide.
                  </div>
                )}
              </div>

              {/* Elements Tree List */}
              <div className="inspector-card">
                <h4 className="card-section-title">
                  <Layers size={14} /> Slide Elements ({activeSlide.objects.length})
                </h4>
                <div className="elements-tree-list">
                  {activeSlide.objects.map((obj, i) => (
                    <div
                      key={obj.object_id}
                      className="element-tree-item"
                      onClick={() => onSelectObject(obj.object_id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') onSelectObject(obj.object_id);
                      }}
                    >
                      <span className="element-icon">{getObjectIcon(obj.object_type)}</span>
                      <div className="element-info">
                        <span className="element-name">{obj.name}</span>
                        <span className="element-type-tag">{formatObjectType(obj.object_type)}</span>
                      </div>
                      <span className="element-layer-idx">#{i + 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>
    );
  }

  const isTransformable = canTransformObject(selectedObject);
  const isResizable = canResizeObject(selectedObject);
  const hasText = !!selectedObject.text_content || selectedObject.object_type === 'text_box';

  return (
    <aside className={`editor-sidebar inspector-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <button
          type="button"
          className="sidebar-toggle-btn"
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expand Inspector' : 'Collapse Inspector'}
          aria-label={isCollapsed ? 'Expand Inspector' : 'Collapse Inspector'}
        >
          {isCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>

        {!isCollapsed && (
          <div className="sidebar-title-row">
            <Sliders size={16} className="sidebar-icon" />
            <span className="sidebar-title">Object Properties</span>
          </div>
        )}
      </div>

      {!isCollapsed && (
        <div className="inspector-content-scroll">
          <div className="inspector-panel-inner animate-fade-in">
            {/* Back to Slide Action */}
            <div className="inspector-nav-bar">
              <button
                type="button"
                className="btn-deselect"
                onClick={onDeselectObject}
                title="Deselect object and view slide overview"
              >
                <X size={14} />
                <span>Deselect (View Slide)</span>
              </button>
            </div>

            {/* Object Identity Card */}
            <div className="inspector-card">
              <div className="card-badge-row">
                <span className={`obj-type-badge ${selectedObject.object_type}`}>
                  {getObjectIcon(selectedObject.object_type)}
                  <span>{formatObjectType(selectedObject.object_type)}</span>
                </span>
                {selectedObject.shape_type && (
                  <span className="obj-shape-tag">{selectedObject.shape_type}</span>
                )}
              </div>
              <h3 className="obj-name-title">{selectedObject.name}</h3>
              <span className="obj-id-subtext">{selectedObject.object_id}</span>
            </div>

            {/* Position & Dimensions (Interactive Inputs) */}
            <div className="inspector-card">
              <h4 className="card-section-title">
                <Compass size={14} /> Position & Dimensions
              </h4>

              {isTransformable ? (
                <ObjectGeometryInputs
                  selectedObject={selectedObject}
                  isResizable={isResizable}
                  onUpdateObjectGeometry={onUpdateObjectGeometry}
                />
              ) : (
                <div className="transform-locked-banner">
                  <Lock size={14} />
                  <span>Geometry is locked for native complex PowerPoint elements.</span>
                </div>
              )}

              <div className="property-row" style={{ marginTop: '0.65rem' }}>
                <span className="field-label">Document Z-Order</span>
                <span className="field-value">Layer #{selectedObject.z_index + 1}</span>
              </div>

              {/* Native EMUs */}
              <div className="emu-info-box">
                <span className="emu-label">Native PowerPoint Coordinates (EMU):</span>
                <span className="emu-values">
                  {selectedObject.x_emu.toLocaleString()} × {selectedObject.y_emu.toLocaleString()} EMU
                </span>
              </div>
            </div>

            {/* Phase 2.7: PowerPoint-Style Text Formatting */}
            {hasText && (
              <ObjectTextFormattingControls
                selectedObject={selectedObject}
                onUpdateTextFormatting={onUpdateTextFormatting}
                onStartTextEditing={onStartTextEditing}
              />
            )}

            {/* Fill & Appearance */}
            <div className="inspector-card">
              <h4 className="card-section-title">
                <Square size={14} /> Fill & Appearance
              </h4>

              <div className="property-row">
                <span className="field-label">Fill Type</span>
                <span className="field-value capitalize">{selectedObject.fill?.fill_type || 'None'}</span>
              </div>

              {selectedObject.fill?.color && (
                <div className="property-row">
                  <span className="field-label">Color</span>
                  <div className="color-preview-row">
                    <span
                      className="color-swatch"
                      style={{ backgroundColor: selectedObject.fill.color }}
                    />
                    <span className="color-hex">{selectedObject.fill.color}</span>
                  </div>
                </div>
              )}

              {selectedObject.border?.color && (
                <div className="property-row">
                  <span className="field-label">Border</span>
                  <span className="field-value">
                    {selectedObject.border.width || 1}pt {selectedObject.border.style || 'solid'} (
                    {selectedObject.border.color})
                  </span>
                </div>
              )}
            </div>

            {/* Image Asset Details */}
            {selectedObject.image_asset && (
              <div className="inspector-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                  <h4 className="card-section-title" style={{ margin: 0 }}>
                    <ImageIcon size={14} /> Image Asset
                  </h4>
                  <span className={`asset-origin-badge ${selectedObject.image_asset.is_local ? 'local' : 'pptx'}`}>
                    {selectedObject.image_asset.is_local ? 'Unsaved In-Memory' : 'Original PPTX'}
                  </span>
                </div>

                <div className="property-row">
                  <span className="field-label">Asset Name</span>
                  <span className="field-value truncate" title={selectedObject.name}>
                    {selectedObject.name || 'Image'}
                  </span>
                </div>

                <div className="property-row">
                  <span className="field-label">Format</span>
                  <span className="field-value">
                    {selectedObject.image_asset.content_type.replace('image/', '').toUpperCase()}
                  </span>
                </div>

                {selectedObject.image_asset.width_px && selectedObject.image_asset.height_px && (
                  <div className="property-row">
                    <span className="field-label">Intrinsic Size</span>
                    <span className="field-value">
                      {selectedObject.image_asset.width_px} × {selectedObject.image_asset.height_px} px
                    </span>
                  </div>
                )}

                <div className="property-row">
                  <span className="field-label">Frame Size</span>
                  <span className="field-value">
                    {Math.round(selectedObject.width)} × {Math.round(selectedObject.height)} pt
                  </span>
                </div>

                <div className="property-row">
                  <span className="field-label">Crop Status</span>
                  <span className="field-value">
                    {selectedObject.crop ? (
                      <span className="crop-status-chip cropped">
                        Cropped ({Math.round(selectedObject.crop.width)} × {Math.round(selectedObject.crop.height)} px)
                      </span>
                    ) : (
                      <span className="crop-status-chip uncropped">Full Image (Uncropped)</span>
                    )}
                  </span>
                </div>

                {/* Asset Actions: Replace, Edit Crop, Reset Crop */}
                <div className="asset-actions-container" style={{ marginTop: '0.85rem' }}>
                  {onTriggerReplaceImage && (
                    <button
                      type="button"
                      className="btn-inspector-action"
                      onClick={onTriggerReplaceImage}
                      title="Replace image while preserving frame geometry"
                    >
                      <RefreshCw size={13} />
                      <span>Replace Image</span>
                    </button>
                  )}

                  {onStartCrop && (
                    <button
                      type="button"
                      className="btn-inspector-action"
                      onClick={() => onStartCrop(selectedObject.object_id)}
                      title="Interactively pan, zoom, and crop image within frame"
                    >
                      <Crop size={13} />
                      <span>Edit Crop</span>
                    </button>
                  )}

                  {selectedObject.crop && onResetCrop && (
                    <button
                      type="button"
                      className="btn-inspector-action btn-inspector-reset"
                      onClick={() => onResetCrop(selectedObject.object_id)}
                      title="Reset crop to display the complete image"
                    >
                      <RotateCcw size={13} />
                      <span>Reset Crop</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Table Details */}
            {selectedObject.table_data && (
              <div className="inspector-card">
                <h4 className="card-section-title">
                  <TableIcon size={14} /> Table Structure
                </h4>
                <div className="property-row">
                  <span className="field-label">Grid Size</span>
                  <span className="field-value">
                    {selectedObject.table_data.rows} rows × {selectedObject.table_data.columns} cols
                  </span>
                </div>
              </div>
            )}

            {/* Unsupported Reason */}
            {selectedObject.is_unsupported && (
              <div className="inspector-card alert-card">
                <h4 className="card-section-title warning">
                  <AlertTriangle size={14} /> Native PowerPoint Element
                </h4>
                <p className="alert-card-text">
                  {selectedObject.unsupported_reason ||
                    'This shape is an advanced PowerPoint element that is preserved in read-only mode.'}
                </p>
              </div>
            )}

            {/* Phase Notice */}
            <div className="phase-notice-box">
              <Info size={14} />
              <span>Interactive In-Memory Canvas: Edits are held in local memory. Exporting and PPTX save will be introduced in subsequent phases.</span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

function getObjectIcon(type: SlideObjectDTO['object_type']) {
  switch (type) {
    case 'text_box':
      return <Type size={13} />;
    case 'shape':
      return <Square size={13} />;
    case 'picture':
      return <ImageIcon size={13} />;
    case 'table':
      return <TableIcon size={13} />;
    case 'unsupported':
      return <AlertTriangle size={13} />;
    default:
      return <Square size={13} />;
  }
}

function formatObjectType(type: SlideObjectDTO['object_type']) {
  switch (type) {
    case 'text_box':
      return 'Text Box';
    case 'shape':
      return 'Shape';
    case 'picture':
      return 'Picture';
    case 'table':
      return 'Table';
    case 'connector':
      return 'Connector';
    case 'group':
      return 'Group';
    case 'unsupported':
      return 'Complex Native';
    default:
      return type;
  }
}

