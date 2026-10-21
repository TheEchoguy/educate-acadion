import React from 'react';
import type { SlideDetailDTO } from '../types/editor';
import { ChevronLeft, ChevronRight, Layers, Plus } from 'lucide-react';

interface SlideThumbnailsSidebarProps {
  slides: SlideDetailDTO[];
  activeSlideIndex: number;
  onSelectSlide: (index: number) => void;
  fileId: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onTriggerAddSlide?: () => void;
}

export const SlideThumbnailsSidebar: React.FC<SlideThumbnailsSidebarProps> = ({
  slides,
  activeSlideIndex,
  onSelectSlide,
  fileId,
  isCollapsed,
  onToggleCollapse,
  onTriggerAddSlide,
}) => {
  return (
    <aside className={`editor-sidebar thumbnails-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Sidebar Header */}
      <div className="sidebar-header">
        {!isCollapsed && (
          <div className="sidebar-title-row">
            <Layers size={16} className="sidebar-icon" />
            <span className="sidebar-title">Slides</span>
            <span className="sidebar-badge">{slides.length}</span>
          </div>
        )}
        <button
          type="button"
          className="sidebar-toggle-btn"
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expand Thumbnails' : 'Collapse Thumbnails'}
          aria-label={isCollapsed ? 'Expand Thumbnails' : 'Collapse Thumbnails'}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Add Slide Button */}
      {!isCollapsed && onTriggerAddSlide && (
        <div className="sidebar-add-slide-container">
          <button
            type="button"
            className="btn-sidebar-add-slide"
            onClick={onTriggerAddSlide}
            title="Add a new slide at the end of the presentation"
            aria-label="Add New Slide"
          >
            <Plus size={15} />
            <span>Add Slide</span>
          </button>
        </div>
      )}

      {/* Thumbnails Scroll List */}
      <div className="thumbnails-scroll-container">
        {slides.map((slide, idx) => {
          const isSelected = idx === activeSlideIndex;
          const previewImgUrl = `/api/preview/${fileId}/${slide.slide_number}`;

          return (
            <div
              key={slide.slide_id}
              className={`thumbnail-item ${isSelected ? 'active' : ''}`}
              onClick={() => onSelectSlide(idx)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onSelectSlide(idx);
              }}
              title={`Slide ${slide.slide_number}: ${slide.objects.length} objects`}
            >
              <span className="thumb-number">{slide.slide_number}</span>

              {!isCollapsed && (
                <div className="thumb-preview-box">
                  <img
                    src={previewImgUrl}
                    alt={`Slide ${slide.slide_number}`}
                    className="thumb-image"
                    onError={(e) => {
                      // Fallback to SVG representation if preview PNG is unavailable
                      const target = e.currentTarget;
                      target.style.display = 'none';
                      const fallback = target.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                  <div
                    className="thumb-fallback"
                    style={{
                      display: 'none',
                      backgroundColor: slide.background_color || '#F8FAFC',
                    }}
                  >
                    <div className="thumb-fallback-content">
                      <span className="thumb-fallback-tag">{slide.layout_name || 'Slide'}</span>
                      <span className="thumb-fallback-count">{slide.objects.length} items</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};

