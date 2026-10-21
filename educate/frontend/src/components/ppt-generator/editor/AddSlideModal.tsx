import React from 'react';
import { X, Plus, Sparkles, LayoutGrid, Columns, Columns3, GitCommit, BarChart2, FileText, Maximize2, Presentation, Square } from 'lucide-react';
import { getAllLayouts, type RegisteredLayout } from '../utils/themeRegistry.ts';

interface AddSlideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLayout: (layoutId: string) => void;
}

export const AddSlideModal: React.FC<AddSlideModalProps> = ({
  isOpen,
  onClose,
  onSelectLayout,
}) => {
  if (!isOpen) return null;

  const layouts = getAllLayouts();

  const getLayoutIcon = (iconName: string) => {
    switch (iconName) {
      case 'LayoutGrid':
        return <LayoutGrid size={20} />;
      case 'Columns':
        return <Columns size={20} />;
      case 'Columns3':
        return <Columns3 size={20} />;
      case 'GitCommit':
        return <GitCommit size={20} />;
      case 'BarChart2':
        return <BarChart2 size={20} />;
      case 'FileText':
        return <FileText size={20} />;
      case 'Maximize2':
        return <Maximize2 size={20} />;
      case 'Presentation':
        return <Presentation size={20} />;
      case 'Square':
        return <Square size={20} />;
      default:
        return <Sparkles size={20} />;
    }
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
      <div className="modal-card add-slide-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <Plus size={20} />
            </div>
            <div>
              <h2 className="modal-title">Add New Slide</h2>
              <p className="modal-subtitle">
                Choose a structured layout from Acadion's layout registry. Inserts at the end of the presentation.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close layout chooser"
          >
            <X size={18} />
          </button>
        </div>

        {/* Layout Options Grid */}
        <div className="layout-chooser-grid">
          {layouts.map((layout: RegisteredLayout) => (
            <div
              key={layout.id}
              className="layout-card-option"
              onClick={() => {
                onSelectLayout(layout.id);
                onClose();
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onSelectLayout(layout.id);
                  onClose();
                }
              }}
            >
              <div className="layout-preview-box">
                {renderMiniWireframe(layout.id)}
              </div>
              <div className="layout-meta-row">
                <span className="layout-icon-wrap">{getLayoutIcon(layout.iconName)}</span>
                <span className="layout-card-name">{layout.displayName}</span>
                <span className="layout-card-badge">{layout.badge}</span>
              </div>
              <p className="layout-card-desc">{layout.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

