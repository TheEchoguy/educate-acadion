/**
 * Inline Text Editor Overlay (Phase 2.3).
 * Renders an accessible, scale-aware HTML textarea overlay positioned directly
 * over the active canvas text element for in-place text editing.
 */

import React, { useState, useEffect, useRef } from 'react';
import type { SlideObjectDTO } from '../types/editor';
import { Check, X } from 'lucide-react';

interface InlineTextEditorOverlayProps {
  object: SlideObjectDTO;
  scale: number;
  ptsToCanvas?: number;
  onCommit: (newText: string) => void;
  onCancel: () => void;
}

export const InlineTextEditorOverlay: React.FC<InlineTextEditorOverlayProps> = ({
  object,
  scale,
  ptsToCanvas = 2.0,
  onCommit,
  onCancel,
}) => {
  // Extract initial text from object paragraphs or fallback
  const initialText = React.useMemo(() => {
    if (!object.text_content || object.text_content.paragraphs.length === 0) {
      return '';
    }
    return object.text_content.paragraphs
      .map((p) => p.runs.map((r) => r.text).join(''))
      .join('\n');
  }, [object]);

  const [text, setText] = useState(initialText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus and move cursor to end of text on mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      const length = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(length, length);
    }
  }, []);

  // Determine typography styling from first paragraph run
  const firstParagraph = object.text_content?.paragraphs[0];
  const firstRun = firstParagraph?.runs[0];
  const fontSizePt = firstRun?.font_size || 14;
  const pts = ptsToCanvas || 2.0;
  const fontSizePx = Math.max(12, Math.round(fontSizePt * pts * scale));
  const fontFamily = firstRun?.font_family || 'Calibri, system-ui, sans-serif';
  const fontColor = firstRun?.font_color || '#0F172A';
  const isBold = firstRun?.bold ?? false;
  const isItalic = firstRun?.italic ?? false;
  const alignment = firstParagraph?.alignment || 'left';

  // Compute text frame padding in scaled pixels
  const padLeft = (object.text_content?.margin_left != null ? object.text_content.margin_left * pts : 7.2 * (pts / 2)) * scale;
  const padTop = (object.text_content?.margin_top != null ? object.text_content.margin_top * pts : 3.6 * (pts / 2)) * scale;
  const padRight = (object.text_content?.margin_right != null ? object.text_content.margin_right * pts : 7.2 * (pts / 2)) * scale;
  const padBottom = (object.text_content?.margin_bottom != null ? object.text_content.margin_bottom * pts : 3.6 * (pts / 2)) * scale;

  // Compute responsive pixel geometry
  const leftPx = object.x * scale;
  const topPx = object.y * scale;
  const widthPx = Math.max(120, object.width * scale);
  const minHeightPx = Math.max(48, object.height * scale);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Cmd+Enter to commit
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      onCommit(text);
      return;
    }

    // Escape to cancel
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
      return;
    }

    // Stop propagation so canvas/global shortcuts don't fire while typing
    e.stopPropagation();
  };

  return (
    <div
      className="inline-text-editor-container animate-fade-in"
      style={{
        position: 'absolute',
        left: `${leftPx}px`,
        top: `${topPx}px`,
        width: `${widthPx}px`,
        minHeight: `${minHeightPx}px`,
        transform: object.rotation ? `rotate(${object.rotation}deg)` : undefined,
        transformOrigin: 'top left',
        zIndex: 50,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <textarea
        ref={textareaRef}
        className="inline-text-editor-textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: '100%',
          minHeight: `${minHeightPx}px`,
          padding: `${Math.round(padTop)}px ${Math.round(padRight)}px ${Math.round(padBottom)}px ${Math.round(padLeft)}px`,
          fontSize: `${fontSizePx}px`,
          fontFamily: fontFamily,
          color: fontColor,
          fontWeight: isBold ? 'bold' : 'normal',
          fontStyle: isItalic ? 'italic' : 'normal',
          textDecoration: firstRun?.underline ? 'underline' : 'none',
          textAlign: (alignment as any) || 'left',
          lineHeight: 1.25,
          boxSizing: 'border-box',
        }}
        placeholder="Type slide text here..."
      />

      {/* Floating Action Controls */}
      <div className="inline-text-editor-toolbar">
        <span className="text-editor-hint">
          <strong>Ctrl+Enter</strong> to save • <strong>Esc</strong> to cancel
        </span>
        <div className="text-editor-actions">
          <button
            type="button"
            className="btn-editor-cancel"
            onClick={onCancel}
            title="Cancel text edits (Esc)"
          >
            <X size={13} />
            <span>Cancel</span>
          </button>
          <button
            type="button"
            className="btn-editor-commit"
            onClick={() => onCommit(text)}
            title="Apply text changes (Ctrl+Enter)"
          >
            <Check size={13} />
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
};

