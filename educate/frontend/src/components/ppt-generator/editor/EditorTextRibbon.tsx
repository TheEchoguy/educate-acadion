/**
 * PowerPoint-Style Top Ribbon Formatting Toolbar (Phase 2.3+).
 * Renders a discoverable, accessible horizontal formatting ribbon directly
 * below the application header, matching PowerPoint's Home ribbon.
 * Synchronized with the active slide object model in useEditorHistory.
 */

import React, { useState } from 'react';
import type { SlideObjectDTO } from '../types/editor';
import type { TextFormattingUpdate } from '../utils/editorTransforms';
import {
  Type,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Edit3,
  Info,
  Palette,
} from 'lucide-react';

export const STANDARD_FONTS = [
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

export const PRESET_FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60, 72];

export const STANDARD_TEXT_COLORS = [
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

export const STANDARD_FILL_COLORS = [
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

interface EditorTextRibbonProps {
  selectedObject: SlideObjectDTO | null;
  onUpdateTextFormatting: (objectId: string, updates: TextFormattingUpdate) => void;
  onStartTextEditing?: (objectId: string) => void;
}

export const EditorTextRibbon: React.FC<EditorTextRibbonProps> = ({
  selectedObject,
  onUpdateTextFormatting,
  onStartTextEditing,
}) => {
  // Determine if selected object has editable text capability
  const isTextSelectable =
    !!selectedObject &&
    (selectedObject.object_type === 'text_box' ||
      selectedObject.object_type === 'shape' ||
      !!selectedObject.text_content);

  const firstPara = selectedObject?.text_content?.paragraphs?.[0];
  const firstRun = firstPara?.runs?.[0];

  const currentFontFamily = firstRun?.font_family || 'Calibri';
  const currentFontSize = firstRun?.font_size ? Math.round(firstRun.font_size) : 18;
  const isBold = !!firstRun?.bold;
  const isItalic = !!firstRun?.italic;
  const isUnderline = !!firstRun?.underline;
  const currentColor = firstRun?.font_color || '#0F172A';
  const currentAlignment = firstPara?.alignment || 'left';
  const currentFillColor = selectedObject?.fill?.color || '';
  const isFillNone = selectedObject?.fill?.fill_type === 'none' || !currentFillColor;

  const [fontSizeInput, setFontSizeInput] = useState(String(currentFontSize));
  const [colorInput, setColorInput] = useState(currentColor);
  const [fillColorInput, setFillColorInput] = useState(currentFillColor || '#FFFFFF');
  const [showTextColorPopover, setShowTextColorPopover] = useState(false);
  const [showFillColorPopover, setShowFillColorPopover] = useState(false);

  // Synchronize state when selected object or SOM properties change
  const [prevSync, setPrevSync] = useState({
    id: selectedObject?.object_id,
    size: currentFontSize,
    color: currentColor,
    fill: currentFillColor,
  });

  if (
    prevSync.id !== selectedObject?.object_id ||
    prevSync.size !== currentFontSize ||
    prevSync.color !== currentColor ||
    prevSync.fill !== currentFillColor
  ) {
    setPrevSync({
      id: selectedObject?.object_id,
      size: currentFontSize,
      color: currentColor,
      fill: currentFillColor,
    });
    setFontSizeInput(String(currentFontSize));
    setColorInput(currentColor);
    setFillColorInput(currentFillColor || '#FFFFFF');
    setShowTextColorPopover(false);
    setShowFillColorPopover(false);
  }

  const commitFontSize = () => {
    if (!selectedObject || !isTextSelectable) return;
    const parsed = parseInt(fontSizeInput, 10);
    if (!isNaN(parsed) && parsed >= 6 && parsed <= 144) {
      onUpdateTextFormatting(selectedObject.object_id, { font_size: parsed });
      setFontSizeInput(String(parsed));
    } else {
      setFontSizeInput(String(currentFontSize));
    }
  };

  const handleStepFontSize = (delta: number) => {
    if (!selectedObject || !isTextSelectable) return;
    const next = Math.max(6, Math.min(144, currentFontSize + delta));
    onUpdateTextFormatting(selectedObject.object_id, { font_size: next });
    setFontSizeInput(String(next));
  };

  const handleFontFamilyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!selectedObject || !isTextSelectable) return;
    const newFont = e.target.value;
    onUpdateTextFormatting(selectedObject.object_id, { font_family: newFont });
  };

  const handlePresetFontSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!selectedObject || !isTextSelectable) return;
    const size = parseInt(e.target.value, 10);
    if (!isNaN(size) && size > 0) {
      onUpdateTextFormatting(selectedObject.object_id, { font_size: size });
      setFontSizeInput(String(size));
    }
  };

  const handleToggleBold = () => {
    if (!selectedObject || !isTextSelectable) return;
    onUpdateTextFormatting(selectedObject.object_id, { bold: !isBold });
  };

  const handleToggleItalic = () => {
    if (!selectedObject || !isTextSelectable) return;
    onUpdateTextFormatting(selectedObject.object_id, { italic: !isItalic });
  };

  const handleToggleUnderline = () => {
    if (!selectedObject || !isTextSelectable) return;
    onUpdateTextFormatting(selectedObject.object_id, { underline: !isUnderline });
  };

  const handleAlignment = (alignment: 'left' | 'center' | 'right' | 'justify') => {
    if (!selectedObject || !isTextSelectable) return;
    onUpdateTextFormatting(selectedObject.object_id, { alignment });
  };

  const handleColorChange = (color: string) => {
    if (!selectedObject || !isTextSelectable) return;
    setColorInput(color);
    onUpdateTextFormatting(selectedObject.object_id, { font_color: color });
  };

  const commitColorHex = () => {
    if (!selectedObject || !isTextSelectable) return;
    const hex = colorInput.trim();
    if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex)) {
      onUpdateTextFormatting(selectedObject.object_id, { font_color: hex });
    } else {
      setColorInput(currentColor);
    }
  };

  const handleFillColorChange = (color: string) => {
    if (!selectedObject || !isTextSelectable) return;
    setFillColorInput(color);
    onUpdateTextFormatting(selectedObject.object_id, { fill_color: color });
  };

  const commitFillHex = () => {
    if (!selectedObject || !isTextSelectable) return;
    const hex = fillColorInput.trim();
    if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex)) {
      onUpdateTextFormatting(selectedObject.object_id, { fill_color: hex });
    } else {
      setFillColorInput(currentFillColor || '#FFFFFF');
    }
  };

  const handleClearFill = () => {
    if (!selectedObject || !isTextSelectable) return;
    onUpdateTextFormatting(selectedObject.object_id, { fill_color: null });
  };

  const fontOptions = STANDARD_FONTS.includes(currentFontFamily)
    ? STANDARD_FONTS
    : [currentFontFamily, ...STANDARD_FONTS];

  return (
    <div className="editor-formatting-ribbon" role="toolbar" aria-label="Text Formatting Ribbon">
      <div className="ribbon-inner">
        {/* Ribbon Section: Font Family & Size */}
        <div className="ribbon-group">
          <span className="ribbon-group-label">Font</span>
          <div className="ribbon-controls-row">
            {/* Font Family Dropdown */}
            <select
              className="ribbon-select font-family-select"
              value={currentFontFamily}
              onChange={handleFontFamilyChange}
              disabled={!isTextSelectable}
              title="Font Family"
              aria-label="Font Family"
              style={{ fontFamily: currentFontFamily }}
            >
              {fontOptions.map((font) => (
                <option key={font} value={font} style={{ fontFamily: font }}>
                  {font}
                </option>
              ))}
            </select>

            {/* Font Size Pt Input */}
            <div className="ribbon-font-size-box">
              <input
                type="number"
                min="6"
                max="144"
                className="ribbon-num-input"
                value={fontSizeInput}
                onChange={(e) => setFontSizeInput(e.target.value)}
                onBlur={commitFontSize}
                onKeyDown={(e) => e.key === 'Enter' && commitFontSize()}
                disabled={!isTextSelectable}
                title="Font Size in points (pt)"
                aria-label="Font Size (pt)"
              />
              <span className="ribbon-unit">pt</span>
            </div>

            {/* Font Size Presets Dropdown */}
            <select
              className="ribbon-select font-preset-select"
              value={PRESET_FONT_SIZES.includes(currentFontSize) ? currentFontSize : ''}
              onChange={handlePresetFontSizeChange}
              disabled={!isTextSelectable}
              title="Common Font Sizes"
              aria-label="Common Font Sizes"
            >
              <option value="" disabled>
                Preset
              </option>
              {PRESET_FONT_SIZES.map((sz) => (
                <option key={sz} value={sz}>
                  {sz} pt
                </option>
              ))}
            </select>

            {/* A- / A+ Stepper Buttons */}
            <div className="ribbon-btn-cluster">
              <button
                type="button"
                className="ribbon-step-btn"
                onClick={() => handleStepFontSize(-2)}
                disabled={!isTextSelectable || currentFontSize <= 6}
                title="Decrease font size by 2 pt"
                aria-label="Decrease font size"
              >
                A-
              </button>
              <button
                type="button"
                className="ribbon-step-btn"
                onClick={() => handleStepFontSize(2)}
                disabled={!isTextSelectable || currentFontSize >= 144}
                title="Increase font size by 2 pt"
                aria-label="Increase font size"
              >
                A+
              </button>
            </div>
          </div>
        </div>

        <div className="ribbon-divider" />

        {/* Ribbon Section: Character Formatting */}
        <div className="ribbon-group">
          <span className="ribbon-group-label">Style</span>
          <div className="ribbon-controls-row">
            <div className="ribbon-btn-cluster">
              <button
                type="button"
                className={`ribbon-icon-btn ${isBold ? 'active' : ''}`}
                onClick={handleToggleBold}
                disabled={!isTextSelectable}
                title="Bold (Ctrl+B)"
                aria-pressed={isBold}
                aria-label="Bold"
              >
                <Bold size={15} />
              </button>
              <button
                type="button"
                className={`ribbon-icon-btn ${isItalic ? 'active' : ''}`}
                onClick={handleToggleItalic}
                disabled={!isTextSelectable}
                title="Italic (Ctrl+I)"
                aria-pressed={isItalic}
                aria-label="Italic"
              >
                <Italic size={15} />
              </button>
              <button
                type="button"
                className={`ribbon-icon-btn ${isUnderline ? 'active' : ''}`}
                onClick={handleToggleUnderline}
                disabled={!isTextSelectable}
                title="Underline (Ctrl+U)"
                aria-pressed={isUnderline}
                aria-label="Underline"
              >
                <Underline size={15} />
              </button>
            </div>
          </div>
        </div>

        <div className="ribbon-divider" />

        {/* Ribbon Section: Paragraph Alignment */}
        <div className="ribbon-group">
          <span className="ribbon-group-label">Paragraph</span>
          <div className="ribbon-controls-row">
            <div className="ribbon-btn-cluster">
              <button
                type="button"
                className={`ribbon-icon-btn ${currentAlignment === 'left' ? 'active' : ''}`}
                onClick={() => handleAlignment('left')}
                disabled={!isTextSelectable}
                title="Align Left"
                aria-pressed={currentAlignment === 'left'}
                aria-label="Align Left"
              >
                <AlignLeft size={15} />
              </button>
              <button
                type="button"
                className={`ribbon-icon-btn ${currentAlignment === 'center' ? 'active' : ''}`}
                onClick={() => handleAlignment('center')}
                disabled={!isTextSelectable}
                title="Align Center"
                aria-pressed={currentAlignment === 'center'}
                aria-label="Align Center"
              >
                <AlignCenter size={15} />
              </button>
              <button
                type="button"
                className={`ribbon-icon-btn ${currentAlignment === 'right' ? 'active' : ''}`}
                onClick={() => handleAlignment('right')}
                disabled={!isTextSelectable}
                title="Align Right"
                aria-pressed={currentAlignment === 'right'}
                aria-label="Align Right"
              >
                <AlignRight size={15} />
              </button>
              <button
                type="button"
                className={`ribbon-icon-btn ${currentAlignment === 'justify' ? 'active' : ''}`}
                onClick={() => handleAlignment('justify')}
                disabled={!isTextSelectable}
                title="Justify"
                aria-pressed={currentAlignment === 'justify'}
                aria-label="Justify"
              >
                <AlignJustify size={15} />
              </button>
            </div>
          </div>
        </div>

        <div className="ribbon-divider" />

        {/* Ribbon Section: Text Color */}
        <div className="ribbon-group ribbon-popover-anchor">
          <span className="ribbon-group-label">Text Color</span>
          <div className="ribbon-controls-row">
            <button
              type="button"
              className="ribbon-color-trigger-btn"
              onClick={() => {
                setShowTextColorPopover((prev) => !prev);
                setShowFillColorPopover(false);
              }}
              disabled={!isTextSelectable}
              title={`Text Color: ${currentColor}`}
              aria-label="Change Text Color"
            >
              <Type size={14} />
              <span
                className="ribbon-color-bar"
                style={{ backgroundColor: currentColor }}
              />
            </button>

            {showTextColorPopover && isTextSelectable && (
              <div className="ribbon-color-popover animate-fade-in" onClick={(e) => e.stopPropagation()}>
                <div className="popover-header">
                  <span>Text Color</span>
                  <span className="color-hex-tag">{currentColor}</span>
                </div>
                <div className="popover-swatches-grid">
                  {STANDARD_TEXT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`popover-swatch ${currentColor.toUpperCase() === c.toUpperCase() ? 'active' : ''}`}
                      style={{ backgroundColor: c }}
                      onClick={() => handleColorChange(c)}
                      title={c}
                      aria-label={`Select text color ${c}`}
                    />
                  ))}
                </div>
                <div className="popover-custom-row">
                  <input
                    type="color"
                    className="popover-native-picker"
                    value={currentColor.startsWith('#') && currentColor.length === 7 ? currentColor : '#000000'}
                    onChange={(e) => handleColorChange(e.target.value)}
                    title="Custom color picker"
                  />
                  <input
                    type="text"
                    className="popover-hex-input"
                    value={colorInput}
                    onChange={(e) => setColorInput(e.target.value)}
                    onBlur={commitColorHex}
                    onKeyDown={(e) => e.key === 'Enter' && commitColorHex()}
                    placeholder="#000000"
                    aria-label="Custom text color hex"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="ribbon-divider" />

        {/* Ribbon Section: Text Box Fill */}
        <div className="ribbon-group ribbon-popover-anchor">
          <span className="ribbon-group-label">Box Fill</span>
          <div className="ribbon-controls-row">
            <button
              type="button"
              className="ribbon-color-trigger-btn"
              onClick={() => {
                setShowFillColorPopover((prev) => !prev);
                setShowTextColorPopover(false);
              }}
              disabled={!isTextSelectable}
              title={isFillNone ? 'Box Fill: None' : `Box Fill: ${currentFillColor}`}
              aria-label="Change Text Box Fill"
            >
              <Palette size={14} />
              <span
                className="ribbon-color-bar"
                style={{
                  backgroundColor: isFillNone ? 'transparent' : currentFillColor,
                  backgroundImage: isFillNone
                    ? 'linear-gradient(45deg, #94a3b8 25%, transparent 25%), linear-gradient(-45deg, #94a3b8 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #94a3b8 75%), linear-gradient(-45deg, transparent 75%, #94a3b8 75%)'
                    : undefined,
                  backgroundSize: '4px 4px',
                }}
              />
            </button>

            <button
              type="button"
              className={`ribbon-btn-no-fill ${isFillNone ? 'active' : ''}`}
              onClick={handleClearFill}
              disabled={!isTextSelectable}
              title="Clear text box background (transparent)"
            >
              No Fill
            </button>

            {showFillColorPopover && isTextSelectable && (
              <div className="ribbon-color-popover animate-fade-in" onClick={(e) => e.stopPropagation()}>
                <div className="popover-header">
                  <span>Box Fill / Background</span>
                  <span className="color-hex-tag">{isFillNone ? 'None' : currentFillColor}</span>
                </div>
                <div className="popover-swatches-grid">
                  {STANDARD_FILL_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`popover-swatch ${!isFillNone && currentFillColor.toUpperCase() === c.toUpperCase() ? 'active' : ''}`}
                      style={{ backgroundColor: c }}
                      onClick={() => handleFillColorChange(c)}
                      title={c}
                      aria-label={`Select box fill color ${c}`}
                    />
                  ))}
                </div>
                <div className="popover-custom-row">
                  <input
                    type="color"
                    className="popover-native-picker"
                    value={
                      currentFillColor.startsWith('#') && currentFillColor.length === 7
                        ? currentFillColor
                        : '#FFFFFF'
                    }
                    onChange={(e) => handleFillColorChange(e.target.value)}
                    title="Custom fill color picker"
                  />
                  <input
                    type="text"
                    className="popover-hex-input"
                    value={isFillNone ? 'None' : fillColorInput}
                    onChange={(e) => setFillColorInput(e.target.value)}
                    onBlur={commitFillHex}
                    onKeyDown={(e) => e.key === 'Enter' && commitFillHex()}
                    disabled={isFillNone}
                    placeholder="#FFFFFF"
                    aria-label="Custom fill color hex"
                  />
                </div>
                <button
                  type="button"
                  className="popover-clear-btn"
                  onClick={() => {
                    handleClearFill();
                    setShowFillColorPopover(false);
                  }}
                >
                  Set to No Fill (Transparent)
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Info & Actions */}
        <div className="ribbon-right-cluster">
          {isTextSelectable ? (
            <>
              <div className="ribbon-scope-badge" title="Formatting is applied to all text runs in this object">
                <Info size={11} />
                <span>Scope: Entire Text Box</span>
              </div>
              {onStartTextEditing && (
                <button
                  type="button"
                  className="ribbon-edit-text-btn"
                  onClick={() => onStartTextEditing(selectedObject.object_id)}
                  title="Double-click canvas or click to edit text inline"
                >
                  <Edit3 size={13} />
                  <span>Edit Text</span>
                </button>
              )}
            </>
          ) : (
            <span className="ribbon-placeholder-hint">
              Select a text box or shape to format font, size, style, alignment, and fill.
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

