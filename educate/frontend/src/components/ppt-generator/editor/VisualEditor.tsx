import React, { useState, useEffect, useRef } from 'react';
import type { PresentationEditorModel, ImageCropDTO } from '../types/editor';
import { useEditorHistory } from '../hooks/useEditorHistory';
import {
  updateObjectGeometry,
  updateObjectText,
  updateObjectTextFormatting,
  updateSlideInModel,
  insertImageObject,
  replaceImageObject,
  updateObjectCrop,
  resetObjectCrop,
  addNewSlide,
  applyThemeToSlide,
  applyThemeToPresentation,
  applyLayoutToSlide,
  type ObjectGeometryUpdate,
  type TextFormattingUpdate,
} from '../utils/editorTransforms';
import { decodeImageFile } from '../utils/imageValidation';
import { assetRegistry } from '../utils/assetRegistry';
import { SlideThumbnailsSidebar } from './SlideThumbnailsSidebar';
import { SlideCanvas } from './SlideCanvas';
import { PropertiesInspector } from './PropertiesInspector';
import { EditorTextRibbon } from './EditorTextRibbon';
import { AddSlideModal } from './AddSlideModal';
import { ThemesGalleryModal } from './ThemesGalleryModal';
import { LayoutsGalleryModal } from './LayoutsGalleryModal';
import {
  ArrowLeft,
  Presentation,
  ZoomIn,
  ZoomOut,
  Maximize2,
  AlertCircle,
  RefreshCw,
  Undo2,
  Redo2,
  FileEdit,
  CheckCircle2,
  ImagePlus,
  AlertTriangle,
  X,
  Download,
  Loader2,
  Plus,
} from 'lucide-react';
import './editor.css';

interface VisualEditorProps {
  fileId: string;
  onBack: () => void;
  initialSlideIndex?: number;
}

export const VisualEditor: React.FC<VisualEditorProps> = ({
  fileId,
  onBack,
  initialSlideIndex = 0,
}) => {
  const {
    workingModel: model,
    initModel,
    applyChange,
    undo,
    redo,
    canUndo,
    canRedo,
    hasUnsavedChanges,
    past,
    future,
  } = useEditorHistory();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState(initialSlideIndex);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [editingObjectId, setEditingObjectId] = useState<string | null>(null);
  const [croppingObjectId, setCroppingObjectId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1.0);
  const [isThumbnailsCollapsed, setIsThumbnailsCollapsed] = useState(false);
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);

  // Phase 2.6 Modal visibility states
  const [isAddSlideOpen, setIsAddSlideOpen] = useState(false);
  const [isThemesOpen, setIsThemesOpen] = useState(false);
  const [isLayoutsOpen, setIsLayoutsOpen] = useState(false);

  // Asset management states and refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const filePickerModeRef = useRef<'insert' | 'replace' | null>(null);
  const [filePickerMode, setFilePickerMode] = useState<'insert' | 'replace' | null>(null);
  const [assetError, setAssetError] = useState<string | null>(null);

  // Phase 2.5 PPTX Export states
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccessInfo, setExportSuccessInfo] = useState<{
    download_url: string;
    output_filename: string;
    warnings: string[];
  } | null>(null);
  const [lastExportedSnapshot, setLastExportedSnapshot] = useState<string | null>(null);

  const isUpToDateWithExport =
    lastExportedSnapshot !== null && model !== null && JSON.stringify(model) === lastExportedSnapshot;
  const hasEditsSinceExport =
    lastExportedSnapshot !== null && model !== null && JSON.stringify(model) !== lastExportedSnapshot;

  const handleExportPPTX = async () => {
    if (!model || isExporting) return;

    setIsExporting(true);
    setExportError(null);

    try {
      // 1. Gather only local image assets actively referenced by current presentation
      const localAssets = await assetRegistry.getReferencedLocalAssetPayloads(model);

      // 2. Submit export request with latest working SOM and asset payloads
      const res = await fetch(`/api/editor/${fileId}/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          local_assets: localAssets,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || errData.error || `Export failed (HTTP ${res.status})`);
      }

      const result = await res.json();

      // 3. Mark export snapshot
      setLastExportedSnapshot(JSON.stringify(model));
      setExportSuccessInfo({
        download_url: result.download_url,
        output_filename: result.output_filename,
        warnings: result.warnings || [],
      });

      // 4. Trigger direct browser download
      const downloadLink = document.createElement('a');
      downloadLink.href = result.download_url;
      downloadLink.download = result.output_filename;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to export presentation';
      setExportError(msg);
    } finally {
      setIsExporting(false);
    }
  };

  // Safely garbage collect unused in-memory image assets whenever model or history updates
  useEffect(() => {
    if (model) {
      assetRegistry.gcUnusedAssets(model, [...past, ...future]);
    }
  }, [model, past, future]);

  // Clean up all allocated object URLs when VisualEditor unmounts
  useEffect(() => {
    return () => {
      assetRegistry.clearAll();
    };
  }, []);

  // Fetch presentation model on fileId or initialSlideIndex change
  useEffect(() => {
    let isCancelled = false;

    async function fetchData() {
      try {
        const res = await fetch(`/api/editor/${fileId}`);
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(
            errorData.detail || errorData.error || `Failed to load presentation (HTTP ${res.status})`
          );
        }
        const data: PresentationEditorModel = await res.json();
        if (!isCancelled) {
          initModel(data);
          setError(null);
          setSelectedObjectId(null);
          setEditingObjectId(null);
          if (initialSlideIndex >= 0 && initialSlideIndex < data.slides.length) {
            setActiveSlideIndex(initialSlideIndex);
          } else {
            setActiveSlideIndex(0);
          }
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const message =
            err instanceof Error ? err.message : 'An error occurred while loading presentation for editor';
          setError(message);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    if (fileId) {
      void fetchData();
    }

    return () => {
      isCancelled = true;
    };
  }, [fileId, initialSlideIndex, initModel]);

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    setSelectedObjectId(null);
    setEditingObjectId(null);
    fetch(`/api/editor/${fileId}`)
      .then(async (res) => {
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(
            errorData.detail || errorData.error || `Failed to load presentation (HTTP ${res.status})`
          );
        }
        return res.json();
      })
      .then((data: PresentationEditorModel) => {
        initModel(data);
        if (initialSlideIndex >= 0 && initialSlideIndex < data.slides.length) {
          setActiveSlideIndex(initialSlideIndex);
        } else {
          setActiveSlideIndex(0);
        }
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : 'An error occurred while loading presentation for editor';
        setError(message);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  // Keyboard shortcuts for Undo and Redo
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      // Do not intercept native undo/redo when typing inside inputs or textareas
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [undo, redo]);

  // When changing slides, preserve in-memory model and deselect active object
  const handleSelectSlide = (idx: number) => {
    setActiveSlideIndex(idx);
    setSelectedObjectId(null);
    setEditingObjectId(null);
    setCroppingObjectId(null);
  };

  // Asset action triggers for file picker
  const handleTriggerAddImage = () => {
    setAssetError(null);
    filePickerModeRef.current = 'insert';
    setFilePickerMode('insert');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleTriggerReplaceImage = () => {
    setAssetError(null);
    filePickerModeRef.current = 'replace';
    setFilePickerMode('replace');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // Process chosen image file from native file picker
  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const mode = filePickerModeRef.current || filePickerMode;
    filePickerModeRef.current = null;
    setFilePickerMode(null);

    // If cancelled or empty, leave model and history unchanged
    if (!file || !model || !mode) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      // Validate MIME type, extension, file size, and decode bitmap
      const decoded = await decodeImageFile(file);
      if (!decoded.isValid || !decoded.width_px || !decoded.height_px) {
        throw new Error(decoded.error || 'Failed to decode image file.');
      }

      // Register with central in-memory asset registry
      const imageAsset = assetRegistry.registerLocalAsset(
        file,
        file.name,
        decoded.width_px,
        decoded.height_px,
        file.type
      );

      const activeSlide = model.slides[activeSlideIndex];
      if (!activeSlide) return;

      if (mode === 'insert') {
        const { updatedSlide, newObjectId } = insertImageObject(
          activeSlide,
          imageAsset,
          model.slide_width,
          model.slide_height,
          model.slide_width_emu,
          model.slide_height_emu
        );
        const updatedModel = updateSlideInModel(model, updatedSlide);
        applyChange(updatedModel);
        setSelectedObjectId(newObjectId);
        setEditingObjectId(null);
        setCroppingObjectId(null);
      } else if (mode === 'replace') {
        if (!selectedObjectId) return;
        const updatedSlide = replaceImageObject(
          activeSlide,
          selectedObjectId,
          imageAsset
        );
        if (updatedSlide !== activeSlide) {
          const updatedModel = updateSlideInModel(model, updatedSlide);
          applyChange(updatedModel);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to process image file';
      setAssetError(msg);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Crop interaction handlers
  const handleStartCrop = (objectId: string) => {
    setSelectedObjectId(objectId);
    setEditingObjectId(null);
    setCroppingObjectId(objectId);
  };

  const handleApplyCrop = (objectId: string, newCrop: ImageCropDTO | null) => {
    if (!model) return;
    const activeSlide = model.slides[activeSlideIndex];
    if (!activeSlide) return;

    const currentObj = activeSlide.objects.find((o) => o.object_id === objectId);
    const currentCrop = currentObj?.crop || null;

    // Guard against redundant history entry if crop is unchanged
    const isUnchanged =
      (currentCrop === null && newCrop === null) ||
      (currentCrop !== null &&
        newCrop !== null &&
        Math.abs(currentCrop.x - newCrop.x) < 0.01 &&
        Math.abs(currentCrop.y - newCrop.y) < 0.01 &&
        Math.abs(currentCrop.width - newCrop.width) < 0.01 &&
        Math.abs(currentCrop.height - newCrop.height) < 0.01);

    if (!isUnchanged) {
      const updatedSlide = updateObjectCrop(activeSlide, objectId, newCrop);
      if (updatedSlide !== activeSlide) {
        const updatedModel = updateSlideInModel(model, updatedSlide);
        applyChange(updatedModel);
      }
    }

    setCroppingObjectId(null);
  };

  const handleCancelCrop = () => {
    // Restores original crop with no history change
    setCroppingObjectId(null);
  };

  const handleResetCrop = (objectId: string) => {
    if (!model) return;
    const activeSlide = model.slides[activeSlideIndex];
    if (!activeSlide) return;

    const updatedSlide = resetObjectCrop(activeSlide, objectId);
    if (updatedSlide !== activeSlide) {
      const updatedModel = updateSlideInModel(model, updatedSlide);
      applyChange(updatedModel);
    }
  };

  // Handle object geometry transforms (move, resize, rotate)
  const handleUpdateObjectGeometry = (objectId: string, updates: ObjectGeometryUpdate) => {
    if (!model) return;
    const activeSlide = model.slides[activeSlideIndex];
    if (!activeSlide) return;

    const updatedSlide = updateObjectGeometry(
      activeSlide,
      objectId,
      updates,
      model.slide_width,
      model.slide_height,
      model.slide_width_emu,
      model.slide_height_emu
    );

    if (updatedSlide !== activeSlide) {
      const updatedModel = updateSlideInModel(model, updatedSlide);
      applyChange(updatedModel);
    }
  };

  // Handle text edit commits
  const handleCommitTextEdit = (objectId: string, newText: string) => {
    if (!model) return;
    const activeSlide = model.slides[activeSlideIndex];
    if (!activeSlide) return;

    const updatedSlide = updateObjectText(activeSlide, objectId, newText);
    if (updatedSlide !== activeSlide) {
      const updatedModel = updateSlideInModel(model, updatedSlide);
      applyChange(updatedModel);
    }
    setEditingObjectId(null);
  };

  // PowerPoint-Style Text Formatting handler
  const handleUpdateTextFormatting = (objectId: string, updates: TextFormattingUpdate) => {
    if (!model) return;
    const activeSlide = model.slides[activeSlideIndex];
    if (!activeSlide) return;

    const updatedSlide = updateObjectTextFormatting(activeSlide, objectId, updates);
    if (updatedSlide !== activeSlide) {
      const updatedModel = updateSlideInModel(model, updatedSlide);
      applyChange(updatedModel);
    }
  };

  // Phase 2.6: Add Slide handler
  const handleSelectAddLayout = (layoutId: string) => {
    if (!model) return;
    const { updatedModel, newSlideIndex } = addNewSlide(model, layoutId);
    applyChange(updatedModel);
    setActiveSlideIndex(newSlideIndex);
    setSelectedObjectId(null);
    setEditingObjectId(null);
    setCroppingObjectId(null);
  };

  // Phase 2.6: Themes Gallery handlers
  const handleApplyThemeToSlide = (themeId: string) => {
    if (!model) return;
    const activeSlide = model.slides[activeSlideIndex];
    if (!activeSlide) return;
    const updatedSlide = applyThemeToSlide(activeSlide, themeId);
    const updatedModel = updateSlideInModel(model, updatedSlide);
    applyChange(updatedModel);
    setSelectedObjectId(null);
    setEditingObjectId(null);
  };

  const handleApplyThemeToAll = (themeId: string) => {
    if (!model) return;
    const updatedModel = applyThemeToPresentation(model, themeId);
    applyChange(updatedModel);
    setSelectedObjectId(null);
    setEditingObjectId(null);
  };

  // Phase 2.6: Layouts Gallery handler
  const handleApplyLayoutToSlide = (layoutId: string) => {
    if (!model) return;
    const activeSlide = model.slides[activeSlideIndex];
    if (!activeSlide) return;
    const { updatedSlide } = applyLayoutToSlide(
      activeSlide,
      layoutId,
      model.slide_width,
      model.slide_height,
      model.slide_width_emu,
      model.slide_height_emu,
      model.file_id
    );
    const updatedModel = updateSlideInModel(model, updatedSlide);
    applyChange(updatedModel);
    setSelectedObjectId(null);
    setEditingObjectId(null);
  };

  // Zoom controls
  const handleZoomIn = () => setZoom((prev) => Math.min(2.0, +(prev + 0.15).toFixed(2)));
  const handleZoomOut = () => setZoom((prev) => Math.max(0.4, +(prev - 0.15).toFixed(2)));
  const handleZoomReset = () => setZoom(1.0);

  // Loading State
  if (loading) {
    return (
      <div className="editor-loading-overlay animate-fade-in">
        <div className="editor-loading-card">
          <div className="editor-spinner" />
          <h2 className="editor-loading-title">Opening Presentation in Visual Editor</h2>
          <p className="editor-loading-subtext">
            Parsing slide objects, coordinates, typography, and embedded assets...
          </p>
        </div>
      </div>
    );
  }

  // Error State
  if (error || !model || model.slides.length === 0) {
    return (
      <div className="editor-error-container animate-fade-in">
        <div className="editor-error-card">
          <AlertCircle size={36} className="error-icon" />
          <h2 className="editor-error-title">Unable to Open Visual Editor</h2>
          <p className="editor-error-message">{error || 'Presentation contains no slides to display.'}</p>
          <div className="editor-error-actions">
            <button type="button" className="btn-secondary" onClick={onBack}>
              <ArrowLeft size={16} />
              <span>Back to Overview</span>
            </button>
            <button type="button" className="btn-primary" onClick={handleRetry}>
              <RefreshCw size={16} />
              <span>Retry Loading</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const activeSlide = model.slides[activeSlideIndex] || model.slides[0];
  const selectedObject =
    activeSlide.objects.find((obj) => obj.object_id === selectedObjectId) || null;

  return (
    <div className="visual-editor-workspace animate-fade-in">
      {/* Hidden Native File Input for Add/Replace Image */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
        style={{ display: 'none' }}
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* Top Application Toolbar */}
      <header className="editor-top-toolbar">
        <div className="toolbar-left">
          <button
            type="button"
            className="btn-toolbar-back"
            onClick={onBack}
            title="Return to Presentation Preview & Downloads"
          >
            <ArrowLeft size={16} />
            <span>Back to Presentation</span>
          </button>
          <div className="toolbar-divider" />
          <div className="toolbar-title-box">
            <Presentation size={18} className="toolbar-logo-icon" />
            <h1 className="toolbar-presentation-title" title={model.title}>
              {model.title}
            </h1>
          </div>
        </div>

        <div className="toolbar-center">
          <span className="slide-counter-chip">
            Slide {activeSlideIndex + 1} of {model.slide_count}
          </span>

          {/* In-Memory Status Indicator */}
          {isExporting ? (
            <span className="mode-indicator-chip exporting" title="Exporting presentation...">
              <Loader2 size={13} className="spin-icon" />
              <span>Exporting PPTX...</span>
            </span>
          ) : isUpToDateWithExport ? (
            <span
              className="mode-indicator-chip exported"
              title="Presentation export is up to date with all current edits. Source PPTX remains untouched."
            >
              <CheckCircle2 size={13} />
              <span>Exported Snapshot (Up to Date)</span>
            </span>
          ) : hasEditsSinceExport ? (
            <span
              className="mode-indicator-chip draft"
              title="Edits made since the last export are unsaved. Click 'Export Edited PPTX' to create an updated PPTX."
            >
              <FileEdit size={13} />
              <span>In-Memory Draft (Edited Since Export)</span>
            </span>
          ) : hasUnsavedChanges ? (
            <span
              className="mode-indicator-chip draft"
              title="Changes are held in client-side memory for this session. Click 'Export Edited PPTX' to save."
            >
              <FileEdit size={13} />
              <span>In-Memory Draft (Unsaved)</span>
            </span>
          ) : (
            <span
              className="mode-indicator-chip"
              title="Original PowerPoint Presentation. Make edits on canvas and export anytime."
            >
              <CheckCircle2 size={13} />
              <span>Original Presentation</span>
            </span>
          )}
        </div>

        <div className="toolbar-right">
          {/* Phase 2.5: Export Edited PPTX Action */}
          <button
            type="button"
            className="btn-toolbar-action btn-export-pptx"
            onClick={handleExportPPTX}
            disabled={isExporting}
            title="Export current in-memory edits to a downloadable PowerPoint (.pptx) file"
            aria-label="Export Edited PPTX"
          >
            {isExporting ? <Loader2 size={15} className="spin-icon" /> : <Download size={15} />}
            <span>{isExporting ? 'Exporting...' : 'Export Edited PPTX'}</span>
          </button>

          <div className="toolbar-divider" />

          {/* Phase 2.6: Add Slide Action */}
          <button
            type="button"
            className="btn-toolbar-action btn-add-slide-toolbar"
            onClick={() => setIsAddSlideOpen(true)}
            title="Add a new slide at the end of the presentation"
            aria-label="Add Slide"
          >
            <Plus size={15} />
            <span>Add Slide</span>
          </button>

          {/* Add Image Action */}
          <button
            type="button"
            className="btn-toolbar-action btn-add-image-toolbar"
            onClick={handleTriggerAddImage}
            title="Upload and insert an image onto the active slide"
            aria-label="Add Image"
          >
            <ImagePlus size={15} />
            <span>Add Image</span>
          </button>

          <div className="toolbar-divider" />

          {/* History Controls: Undo and Redo */}
          <div className="history-controls-group">
            <button
              type="button"
              className="btn-toolbar-action"
              onClick={undo}
              disabled={!canUndo}
              title="Undo last action (Ctrl+Z)"
              aria-label="Undo"
            >
              <Undo2 size={15} />
              <span>Undo</span>
            </button>
            <button
              type="button"
              className="btn-toolbar-action"
              onClick={redo}
              disabled={!canRedo}
              title="Redo next action (Ctrl+Y)"
              aria-label="Redo"
            >
              <Redo2 size={15} />
              <span>Redo</span>
            </button>
          </div>

          <div className="toolbar-divider" />

          {/* Zoom Controls */}
          <div className="zoom-controls-group">
            <button
              type="button"
              className="btn-zoom"
              onClick={handleZoomOut}
              title="Zoom Out (Down to 40%)"
              disabled={zoom <= 0.45}
            >
              <ZoomOut size={14} />
            </button>
            <button
              type="button"
              className="btn-zoom-value"
              onClick={handleZoomReset}
              title="Reset Zoom to Fit (100%)"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              className="btn-zoom"
              onClick={handleZoomIn}
              title="Zoom In (Up to 200%)"
              disabled={zoom >= 1.95}
            >
              <ZoomIn size={14} />
            </button>
            <button
              type="button"
              className="btn-zoom"
              onClick={handleZoomReset}
              title="Fit Slide to Screen"
            >
              <Maximize2 size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Dismissible Export Success Banner */}
      {exportSuccessInfo && (
        <div className="editor-export-success-banner animate-fade-in" role="status">
          <CheckCircle2 size={15} className="success-banner-icon" />
          <span className="success-banner-text">
            Presentation successfully exported and validated as <strong>{exportSuccessInfo.output_filename}</strong>.
            Source file remains untouched.
          </span>
          <a
            href={exportSuccessInfo.download_url}
            download={exportSuccessInfo.output_filename}
            className="btn-export-download-link"
          >
            <Download size={13} />
            <span>Download .pptx</span>
          </a>
          <button
            type="button"
            className="btn-dismiss-banner"
            onClick={() => setExportSuccessInfo(null)}
            title="Dismiss notification"
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Dismissible Export Error Banner */}
      {exportError && (
        <div className="editor-asset-error-banner animate-fade-in" role="alert">
          <AlertTriangle size={15} className="error-banner-icon" />
          <span className="error-banner-text">{exportError}</span>
          <button
            type="button"
            className="btn-dismiss-error"
            onClick={() => setExportError(null)}
            title="Dismiss error message"
            aria-label="Dismiss error"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Dismissible Asset Validation Error Banner */}
      {assetError && (
        <div className="editor-asset-error-banner animate-fade-in" role="alert">
          <AlertTriangle size={15} className="error-banner-icon" />
          <span className="error-banner-text">{assetError}</span>
          <button
            type="button"
            className="btn-dismiss-error"
            onClick={() => setAssetError(null)}
            title="Dismiss error message"
            aria-label="Dismiss error"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* PowerPoint-Style Top Ribbon Formatting Toolbar */}
      <EditorTextRibbon
        selectedObject={selectedObject}
        onUpdateTextFormatting={handleUpdateTextFormatting}
        onStartTextEditing={(objId) => {
          setSelectedObjectId(objId);
          setEditingObjectId(objId);
          setCroppingObjectId(null);
        }}
      />

      {/* Three-Panel Body Shell */}
      <div className="editor-panels-container">
        {/* Left: Slide Thumbnails */}
        <SlideThumbnailsSidebar
          slides={model.slides}
          activeSlideIndex={activeSlideIndex}
          onSelectSlide={handleSelectSlide}
          fileId={model.file_id}
          isCollapsed={isThumbnailsCollapsed}
          onToggleCollapse={() => setIsThumbnailsCollapsed((prev) => !prev)}
          onTriggerAddSlide={() => setIsAddSlideOpen(true)}
        />

        {/* Center: Interactive Slide Canvas */}
        <main className="editor-center-canvas-area">
          <SlideCanvas
            slide={activeSlide}
            slideWidth={model.slide_width}
            slideHeight={model.slide_height}
            slideWidthEmu={model.slide_width_emu}
            slideHeightEmu={model.slide_height_emu}
            selectedObjectId={selectedObjectId}
            onSelectObject={(id) => {
              setSelectedObjectId(id);
              if (croppingObjectId && id !== croppingObjectId) {
                setCroppingObjectId(null);
              }
            }}
            onUpdateObjectGeometry={handleUpdateObjectGeometry}
            onCommitTextEdit={handleCommitTextEdit}
            editingObjectId={editingObjectId}
            onSetEditingObjectId={setEditingObjectId}
            croppingObjectId={croppingObjectId}
            onApplyCrop={handleApplyCrop}
            onCancelCrop={handleCancelCrop}
            zoom={zoom}
          />
        </main>

        {/* Right: Properties Inspector */}
        <PropertiesInspector
          activeSlide={activeSlide}
          totalSlides={model.slide_count}
          selectedObject={selectedObject}
          onDeselectObject={() => {
            setSelectedObjectId(null);
            setEditingObjectId(null);
            setCroppingObjectId(null);
          }}
          onSelectObject={(objId) => {
            setSelectedObjectId(objId);
            setEditingObjectId(null);
            setCroppingObjectId(null);
          }}
          onUpdateObjectGeometry={handleUpdateObjectGeometry}
          onUpdateTextFormatting={handleUpdateTextFormatting}
          onStartTextEditing={(objId) => {
            setSelectedObjectId(objId);
            setEditingObjectId(objId);
            setCroppingObjectId(null);
          }}
          onTriggerAddImage={handleTriggerAddImage}
          onTriggerReplaceImage={handleTriggerReplaceImage}
          onStartCrop={handleStartCrop}
          onResetCrop={handleResetCrop}
          isCollapsed={isInspectorCollapsed}
          onToggleCollapse={() => setIsInspectorCollapsed((prev) => !prev)}
        />
      </div>

      {/* Phase 2.6 Modals */}
      <AddSlideModal
        isOpen={isAddSlideOpen}
        onClose={() => setIsAddSlideOpen(false)}
        onSelectLayout={handleSelectAddLayout}
      />

      <ThemesGalleryModal
        isOpen={isThemesOpen}
        onClose={() => setIsThemesOpen(false)}
        currentThemeId={model.theme || 'academic_navy'}
        onApplyThemeToSlide={handleApplyThemeToSlide}
        onApplyThemeToAll={handleApplyThemeToAll}
        activeSlideNumber={activeSlideIndex + 1}
      />

      <LayoutsGalleryModal
        isOpen={isLayoutsOpen}
        onClose={() => setIsLayoutsOpen(false)}
        currentLayoutId={activeSlide.layout_name}
        onSelectLayout={handleApplyLayoutToSlide}
        activeSlideNumber={activeSlideIndex + 1}
      />
    </div>
  );
};

