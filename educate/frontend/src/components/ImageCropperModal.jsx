import { useState, useRef, useEffect } from "react";
import "./ImageCropperModal.css";

function ImageCropperModal({ imageSrc, cropType = "avatar", onCropComplete, onClose }) {
  const isCover = cropType === "cover";

  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Viewfinder dimensions: Avatar is 280x280; Cover matches exact 9.4:1 banner aspect ratio (520x55)
  const viewfinderW = isCover ? 520 : 280;
  const viewfinderH = isCover ? 55 : 280;

  const [baseImgSize, setBaseImgSize] = useState({ width: viewfinderW, height: viewfinderH });

  const containerRef = useRef(null);
  const imgRef = useRef(null);

  // Reset controls when image changes
  useEffect(() => {
    setOffset({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  }, [imageSrc]);

  const handleImageLoad = (e) => {
    const naturalWidth = e.target.naturalWidth || viewfinderW;
    const naturalHeight = e.target.naturalHeight || viewfinderH;

    // Scale image so its smallest dimension fills the viewfinder frame
    const fillScale = Math.max(viewfinderW / naturalWidth, viewfinderH / naturalHeight);
    const baseW = naturalWidth * fillScale;
    const baseH = naturalHeight * fillScale;

    setBaseImgSize({ width: baseW, height: baseH });
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - offset.x,
      y: e.clientY - offset.y,
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({
        x: touch.clientX - offset.x,
        y: touch.clientY - offset.y,
      });
    }
  };

  const handleTouchMove = (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setOffset({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(0.1, Math.round((prev - 0.1) * 100) / 100));
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(4.0, Math.round((prev + 0.1) * 100) / 100));
  };

  const handleApplyCrop = () => {
    if (!imgRef.current) return;

    const canvas = document.createElement("canvas");
    // Output resolution: 400x400 for Avatar; 1600x170 Ultra-HD Widescreen for Cover (9.4:1 ratio)
    const outputW = isCover ? 1600 : 400;
    const outputH = isCover ? 170 : 400;

    canvas.width = outputW;
    canvas.height = outputH;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    if (!isCover) {
      // Circular clip path for avatar
      ctx.beginPath();
      ctx.arc(outputW / 2, outputH / 2, outputW / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
    }

    // Background slate fill
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, outputW, outputH);

    ctx.save();

    // Center canvas context
    ctx.translate(outputW / 2, outputH / 2);
    ctx.rotate((rotation * Math.PI) / 180);

    const img = imgRef.current;
    const scaleFactorX = outputW / viewfinderW;
    const scaleFactorY = outputH / viewfinderH;

    const finalDrawW = baseImgSize.width * scaleFactorX * zoom;
    const finalDrawH = baseImgSize.height * scaleFactorY * zoom;

    const drawX = offset.x * scaleFactorX;
    const drawY = offset.y * scaleFactorY;

    ctx.drawImage(
      img,
      -finalDrawW / 2 + drawX,
      -finalDrawH / 2 + drawY,
      finalDrawW,
      finalDrawH
    );

    ctx.restore();

    const croppedBase64 = canvas.toDataURL("image/jpeg", 0.92);
    onCropComplete(croppedBase64);
  };

  return (
    <div className="crop-modal-overlay" onClick={onClose}>
      <div className={`crop-modal-card ${isCover ? "cover-modal-card" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="crop-modal-header">
          <h3>
            {isCover ? "🖼️ Crop & Adjust Cover Banner" : "✂️ Crop & Adjust Profile Photo"}
          </h3>
          <button className="crop-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="crop-modal-body">
          <p className="crop-instructions">
            Drag image to position • Use ➕ Maximise or ➖ Minimise to zoom in &amp; out
          </p>

          <div
            className={`crop-viewfinder-container ${isCover ? "cover-viewfinder" : ""}`}
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ width: `${viewfinderW}px`, height: `${viewfinderH}px` }}
          >
            <div className={isCover ? "crop-banner-mask" : "crop-circle-mask"} />
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Crop preview"
              className="crop-target-image"
              onLoad={handleImageLoad}
              draggable={false}
              style={{
                width: `${baseImgSize.width}px`,
                height: `${baseImgSize.height}px`,
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                cursor: isDragging ? "grabbing" : "grab",
              }}
            />
          </div>

          <div className="crop-controls-panel">
            <div className="crop-zoom-header-row">
              <span className="control-label">🔍 Scale: {Math.round(zoom * 100)}%</span>
              <div className="zoom-quick-buttons">
                <button type="button" className="zoom-step-btn" onClick={handleZoomOut} title="Minimise (Zoom Out)">
                  ➖ Minimise
                </button>
                <button type="button" className="zoom-step-btn" onClick={handleZoomIn} title="Maximise (Zoom In)">
                  ➕ Maximise
                </button>
              </div>
            </div>

            <div className="crop-control-group">
              <input
                type="range"
                min="0.1"
                max="4.0"
                step="0.01"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="crop-zoom-slider"
              />
            </div>

            <div className="crop-action-buttons-row">
              <button type="button" className="crop-rotate-btn" onClick={handleRotate}>
                🔄 Rotate 90°
              </button>
              <button
                type="button"
                className="crop-reset-btn"
                onClick={() => {
                  setZoom(1);
                  setRotation(0);
                  setOffset({ x: 0, y: 0 });
                }}
              >
                ↩ Reset
              </button>
            </div>
          </div>
        </div>

        <div className="crop-modal-footer">
          <button type="button" className="crop-cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="crop-apply-btn" onClick={handleApplyCrop}>
            ✓ {isCover ? "Apply & Save Cover Banner" : "Apply & Crop Photo"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ImageCropperModal;
