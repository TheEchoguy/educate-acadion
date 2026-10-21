import React, { useState } from 'react';
import { X, LayoutGrid, Check, AlertTriangle } from 'lucide-react';
import { getAllLayouts, type RegisteredLayout } from '../utils/themeRegistry.ts';

interface LayoutsGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLayoutId?: string | null;
  onSelectLayout: (layoutId: string) => void;
  activeSlideNumber: number;
}

export const LayoutsGalleryModal: React.FC<LayoutsGalleryModalProps> = ({
  isOpen,
  onClose,
  currentLayoutId,
  onSelectLayout,
  activeSlideNumber,
}) => {
  const [pendingLayoutId, setPendingLayoutId] = useState<string | null>(null);
  const [showConfirmWarning, setShowConfirmWarning] = useState(false);

  if (!isOpen) return null;

  const layouts = getAllLayouts();

  const handleLayoutClick = (layoutId: string) => {
    // If switching to blank or a layout with fewer containers, prompt confirmation
    if (layoutId === 'blank') {
      setPendingLayoutId(layoutId);
      setShowConfirmWarning(true);
      return;
    }

    onSelectLayout(layoutId);
    onClose();
  };

  const handleConfirmSwitch = () => {
    if (pendingLayoutId) {
      onSelectLayout(pendingLayoutId);
    }
    setShowConfirmWarning(false);
    setPendingLayoutId(null);
    onClose();
  };

  const renderMiniWireframe = (layoutId: string) => {
    switch (layoutId) {
      case 'title_slide':
        return (
          <div className="mini-wireframe title-layout">
            <div className="wf-hero-box">
              <div className="wf-badge" />
              <div className="wf-title-lg" />
              <div className="wf-subtitle" />
            </div>
          </div>
        );
      case 'two_column':
        return (
          <div className="mini-wireframe two-col-layout">
            <div className="wf-header-row">
              <div className="wf-title-bar" />
              <div className="wf-divider" />
            </div>
            <div className="wf-columns-row">
              <div className="wf-col" />
              <div className="wf-col" />
            </div>
          </div>
        );
      case 'multi_column':
        return (
          <div className="mini-wireframe three-col-layout">
            <div className="wf-header-row">
              <div className="wf-title-bar" />
              <div className="wf-divider" />
            </div>
            <div className="wf-columns-row">
              <div className="wf-col" />
              <div className="wf-col" />
              <div className="wf-col" />
            </div>
          </div>
        );
      case 'visual_flow':
        return (
          <div className="mini-wireframe flow-layout">
            <div className="wf-header-row">
              <div className="wf-title-bar" />
              <div className="wf-divider" />
            </div>
            <div className="wf-flow-row">
              <div className="wf-step" />
              <div className="wf-step" />
              <div className="wf-step" />
              <div className="wf-step" />
            </div>
          </div>
        );
      case 'stats_metrics':
        return (
          <div className="mini-wireframe metrics-layout">
            <div className="wf-header-row">
              <div className="wf-title-bar" />
              <div className="wf-divider" />
            </div>
            <div className="wf-metrics-row">
              <div className="wf-metric-card"><div className="wf-number" /></div>
              <div className="wf-metric-card"><div className="wf-number" /></div>
              <div className="wf-metric-card"><div className="wf-number" /></div>
            </div>
          </div>
        );
      case 'editorial':
        return (
          <div className="mini-wireframe editorial-layout">
            <div className="wf-header-row">
              <div className="wf-title-bar" />
              <div className="wf-divider" />
            </div>
            <div className="wf-editorial-body">
              <div className="wf-bullet-line" />
              <div className="wf-bullet-line" />
              <div className="wf-bullet-line" />
            </div>
          </div>
        );
      case 'asymmetric':
        return (
          <div className="mini-wireframe asymmetric-layout">
            <div className="wf-header-row">
              <div className="wf-title-bar" />
              <div className="wf-divider" />
            </div>
            <div className="wf-asymm-row">
              <div className="wf-asymm-left" />
              <div className="wf-asymm-right">
                <div className="wf-asymm-sub" />
                <div className="wf-asymm-sub" />
              </div>
            </div>
          </div>
        );
      case 'blank':
        return (
          <div className="mini-wireframe blank-layout">
            <div className="wf-blank-canvas" />
          </div>
        );
      case 'cards_grid':
      default:
        return (
          <div className="mini-wireframe cards-layout">
            <div className="wf-header-row">
              <div className="wf-title-bar" />
              <div className="wf-divider" />
            </div>
            <div className="wf-cards-row">
              <div className="wf-card" />
              <div className="wf-card" />
              <div className="wf-card" />
            </div>
          </div>
        );
    }
  };

  return (
    <div className="modal-backdrop animate-fade-in" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card layouts-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <LayoutGrid size={20} />
            </div>
            <div>
              <h2 className="modal-title">Slide Layouts Gallery</h2>
              <p className="modal-subtitle">
                Restructure <strong>Slide {activeSlideNumber}</strong>. Existing titles, bullet points, and pictures are safely mapped into the target layout geometry.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close layouts gallery"
          >
            <X size={18} />
          </button>
        </div>

        {/* Confirmation Warning if requested */}
        {showConfirmWarning && (
          <div className="layout-restructure-warning animate-fade-in" role="alert">
            <AlertTriangle size={20} className="warning-icon" />
            <div className="warning-content">
              <h4>Restructure Slide Content?</h4>
              <p>
                Switching to a blank or minimal layout may clear or significantly reorganize the current slide objects. Your action can still be undone with Ctrl+Z.
              </p>
              <div className="warning-buttons">
                <button
                  type="button"
                  className="btn-warning-confirm"
                  onClick={handleConfirmSwitch}
                >
                  Yes, Apply Layout
                </button>
                <button
                  type="button"
                  className="btn-warning-cancel"
                  onClick={() => setShowConfirmWarning(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Layout Cards Grid */}
        <div className="layout-chooser-grid">
          {layouts.map((layout: RegisteredLayout) => {
            const isCurrent = currentLayoutId === layout.id;

            return (
              <div
                key={layout.id}
                className={`layout-card-option ${isCurrent ? 'current-active-layout' : ''}`}
                onClick={() => handleLayoutClick(layout.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleLayoutClick(layout.id);
                  }
                }}
              >
                <div className="layout-preview-box">
                  {renderMiniWireframe(layout.id)}
                </div>
                <div className="layout-meta-row">
                  <span className="layout-card-name">{layout.displayName}</span>
                  {isCurrent ? (
                    <span className="current-theme-chip">
                      <Check size={12} />
                      <span>Current</span>
                    </span>
                  ) : (
                    <span className="layout-card-badge">{layout.badge}</span>
                  )}
                </div>
                <p className="layout-card-desc">{layout.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

