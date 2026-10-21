/**
 * Interactive Image Crop Editor Overlay (Phase 2.4).
 * Provides pan-and-zoom crop positioning within a fixed image frame directly over the canvas,
 * with zoom controls, reset to full image, Apply Crop, and Cancel Crop shortcuts.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { ImageCropDTO, SlideObjectDTO } from '../types/editor';
import { calculateCenterFillCrop, validateCropCoordinates } from '../utils/editorTransforms';
import { Check, X, RotateCcw, ZoomIn, ZoomOut, Crop } from 'lucide-react';

interface CropEditorOverlayProps {
  object: SlideObjectDTO;
  scale: number;
  onApplyCrop: (newCrop: ImageCropDTO | null) => void;
  onCancelCrop: () => void;
}

export const CropEditorOverlay: React.FC<CropEditorOverlayProps> = ({
  object,
  scale,
  onApplyCrop,
  onCancelCrop,
}) => {
  const asset = object.image_asset;
  const srcW = asset?.width_px || 1920;
  const srcH = asset?.height_px || 1080;

  // Initialize draft crop from existing crop or center-fill
  const [draftCrop, setDraftCrop] = useState<ImageCropDTO>(() => {
    if (object.crop) {
      return validateCropCoordinates(object.crop, srcW, srcH);
    }
    return calculateCenterFillCrop(srcW, srcH, object.width, object.height);
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ clientX: number; clientY: number; startCropX: number; startCropY: number } | null>(
    null
  );

  // Compute current zoom level relative to base fit crop
  const baseCrop = calculateCenterFillCrop(srcW, srcH, object.width, object.height);
  const currentZoom = Math.max(1, Math.min(3, +(baseCrop.width / draftCrop.width).toFixed(2)));

  // Frame pixel dimensions on screen
  const frameLeftPx = object.x * scale;
  const frameTopPx = object.y * scale;
  const frameWidthPx = Math.max(40, object.width * scale);
  const frameHeightPx = Math.max(40, object.height * scale);

  // Pan interaction
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startCropX: draftCrop.x,
      startCropY: draftCrop.y,
    };
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !dragStartRef.current) return;

      const deltaScreenX = e.clientX - dragStartRef.current.clientX;
      const deltaScreenY = e.clientY - dragStartRef.current.clientY;

      // Convert screen delta to source image pixels
      const scaleX = draftCrop.width / frameWidthPx;
      const scaleY = draftCrop.height / frameHeightPx;

      const deltaSourceX = -deltaScreenX * scaleX;
      const deltaSourceY = -deltaScreenY * scaleY;

      const targetX = dragStartRef.current.startCropX + deltaSourceX;
      const targetY = dragStartRef.current.startCropY + deltaSourceY;

      const updated = validateCropCoordinates(
        {
          x: targetX,
          y: targetY,
          width: draftCrop.width,
          height: draftCrop.height,
        },
        srcW,
        srcH
      );

      setDraftCrop(updated);
    },
    [isDragging, draftCrop.width, draftCrop.height, frameWidthPx, frameHeightPx, srcW, srcH]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Zoom adjustment
  const handleZoomChange = (newZoom: number) => {
    const clampedZoom = Math.max(1, Math.min(3, newZoom));
    const targetWidth = baseCrop.width / clampedZoom;
    const targetHeight = baseCrop.height / clampedZoom;

    // Keep center of current crop
    const currentCenterX = draftCrop.x + draftCrop.width / 2;
    const currentCenterY = draftCrop.y + draftCrop.height / 2;

    const targetX = currentCenterX - targetWidth / 2;
    const targetY = currentCenterY - targetHeight / 2;

    const validated = validateCropCoordinates(
      {
        x: targetX,
        y: targetY,
        width: targetWidth,
        height: targetHeight,
      },
      srcW,
      srcH
    );

    setDraftCrop(validated);
  };

  // Reset to full uncropped source image
  const handleResetCrop = () => {
    setDraftCrop({
      x: 0,
      y: 0,
      width: srcW,
      height: srcH,
    });
  };

  // Keyboard shortcut listener (Enter to commit, Escape to cancel)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        onApplyCrop(draftCrop);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancelCrop();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [draftCrop, onApplyCrop, onCancelCrop]);

  // Scale factor from source pixels to visible frame pixels
  const imgRenderScaleX = frameWidthPx / draftCrop.width;
  const imgRenderScaleY = frameHeightPx / draftCrop.height;
  const imgRenderWidth = srcW * imgRenderScaleX;
  const imgRenderHeight = srcH * imgRenderScaleY;
  const imgOffsetX = -draftCrop.x * imgRenderScaleX;
  const imgOffsetY = -draftCrop.y * imgRenderScaleY;

  return (
    <div
      className="crop-editor-root-container"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
        pointerEvents: 'auto',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Semi-transparent dark backdrop surrounding crop area */}
      <div className="crop-dark-backdrop" />

      {/* Floating Crop Control Toolbar */}
      <div
        className="crop-toolbar-floating animate-fade-in"
        style={{
          position: 'absolute',
          left: `${frameLeftPx}px`,
          top: `${Math.max(12, frameTopPx - 48)}px`,
        }}
      >
        <div className="crop-toolbar-badge">
          <Crop size={14} />
          <span>Crop Mode</span>
        </div>

        <div className="crop-toolbar-divider" />

        {/* Zoom Controls */}
        <div className="crop-zoom-group">
          <button
            type="button"
            className="btn-crop-zoom"
            onClick={() => handleZoomChange(currentZoom - 0.2)}
            disabled={currentZoom <= 1.05}
            title="Zoom out in crop frame"
          >
            <ZoomOut size={13} />
          </button>

          <input
            type="range"
            min="1"
            max="3"
            step="0.05"
            className="crop-zoom-slider"
            value={currentZoom}
            onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
            title={`Zoom: ${Math.round(currentZoom * 100)}%`}
          />

          <button
            type="button"
            className="btn-crop-zoom"
            onClick={() => handleZoomChange(currentZoom + 0.2)}
            disabled={currentZoom >= 2.95}
            title="Zoom in in crop frame"
          >
            <ZoomIn size={13} />
          </button>
        </div>

        <div className="crop-toolbar-divider" />

        <button
          type="button"
          className="btn-crop-action reset"
          onClick={handleResetCrop}
          title="Reset to full source image"
        >
          <RotateCcw size={13} />
          <span>Full Image</span>
        </button>

        <button
          type="button"
          className="btn-crop-action cancel"
          onClick={onCancelCrop}
          title="Cancel crop changes (Esc)"
        >
          <X size={13} />
          <span>Cancel</span>
        </button>

        <button
          type="button"
          className="btn-crop-action apply"
          onClick={() => onApplyCrop(draftCrop)}
          title="Apply crop (Enter)"
        >
          <Check size={13} />
          <span>Apply Crop</span>
        </button>
      </div>

      {/* The Active Crop Viewport Frame */}
      <div
        className="crop-active-frame"
        style={{
          position: 'absolute',
          left: `${frameLeftPx}px`,
          top: `${frameTopPx}px`,
          width: `${frameWidthPx}px`,
          height: `${frameHeightPx}px`,
          transform: object.rotation ? `rotate(${object.rotation}deg)` : undefined,
          transformOrigin: 'top left',
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
        onMouseDown={handleMouseDown}
      >
        {/* Visible cropped image preview */}
        <div
          className="crop-image-clipper"
          style={{
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {asset?.url && (
            <img
              src={asset.url}
              alt={object.name}
              draggable={false}
              style={{
                position: 'absolute',
                left: `${imgOffsetX}px`,
                top: `${imgOffsetY}px`,
                width: `${imgRenderWidth}px`,
                height: `${imgRenderHeight}px`,
                maxWidth: 'none',
                userSelect: 'none',
                pointerEvents: 'none',
              }}
            />
          )}

          {/* Rule-of-Thirds Grid Overlay */}
          <div className="crop-grid-overlay">
            <div className="crop-grid-line vertical line-1" />
            <div className="crop-grid-line vertical line-2" />
            <div className="crop-grid-line horizontal line-1" />
            <div className="crop-grid-line horizontal line-2" />
          </div>
        </div>

        {/* Framing border and corner handles */}
        <div className="crop-frame-border" />
        <span className="crop-corner top-left" />
        <span className="crop-corner top-right" />
        <span className="crop-corner bottom-left" />
        <span className="crop-corner bottom-right" />
      </div>
    </div>
  );
};

