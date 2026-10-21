import React, { useState } from 'react';
import { X, Palette, Check, Sun, Moon } from 'lucide-react';
import { getAllThemes, type RegisteredTheme } from '../utils/themeRegistry.ts';

interface ThemesGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentThemeId: string;
  onApplyThemeToSlide: (themeId: string) => void;
  onApplyThemeToAll: (themeId: string) => void;
  activeSlideNumber: number;
}

export const ThemesGalleryModal: React.FC<ThemesGalleryModalProps> = ({
  isOpen,
  onClose,
  currentThemeId,
  onApplyThemeToSlide,
  onApplyThemeToAll,
  activeSlideNumber,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'light' | 'dark'>('all');

  if (!isOpen) return null;

  const themes = getAllThemes();
  const filteredThemes = themes.filter((t) => {
    if (filterMode === 'light') return !t.isDark;
    if (filterMode === 'dark') return t.isDark;
    return true;
  });

  return (
    <div className="modal-backdrop animate-fade-in" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card themes-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <Palette size={20} />
            </div>
            <div>
              <h2 className="modal-title">Presentation Themes Gallery</h2>
              <p className="modal-subtitle">
                14 registered presentation palettes. Apply to the current slide (Slide {activeSlideNumber}) or update all slides.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close themes gallery"
          >
            <X size={18} />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="themes-filter-tabs">
          <button
            type="button"
            className={`filter-tab-btn ${filterMode === 'all' ? 'active' : ''}`}
            onClick={() => setFilterMode('all')}
          >
            All Themes ({themes.length})
          </button>
          <button
            type="button"
            className={`filter-tab-btn ${filterMode === 'light' ? 'active' : ''}`}
            onClick={() => setFilterMode('light')}
          >
            <Sun size={14} />
            <span>Light Modes ({themes.filter((t) => !t.isDark).length})</span>
          </button>
          <button
            type="button"
            className={`filter-tab-btn ${filterMode === 'dark' ? 'active' : ''}`}
            onClick={() => setFilterMode('dark')}
          >
            <Moon size={14} />
            <span>Dark Obsidian ({themes.filter((t) => t.isDark).length})</span>
          </button>
        </div>

        {/* Theme Cards Grid */}
        <div className="themes-gallery-grid">
          {filteredThemes.map((theme: RegisteredTheme) => {
            const isCurrent = (currentThemeId || 'academic_navy').toLowerCase().replace(/[-\s]/g, '_') === theme.id;

            return (
              <div
                key={theme.id}
                className={`theme-gallery-card ${isCurrent ? 'current-active-theme' : ''}`}
                style={{ backgroundColor: theme.colors.bg }}
              >
                {/* Theme Card Top Preview Bar */}
                <div
                  className="theme-card-surface-preview"
                  style={{
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.cardBorder,
                  }}
                >
                  <div className="theme-preview-header">
                    <span
                      className="theme-preview-pill"
                      style={{ backgroundColor: theme.colors.accent, color: '#FFFFFF' }}
                    >
                      {theme.isDark ? 'DARK MODE' : 'LIGHT MODE'}
                    </span>
                    {isCurrent && (
                      <span className="current-theme-chip">
                        <Check size={12} />
                        <span>Active Theme</span>
                      </span>
                    )}
                  </div>
                  <h3 className="theme-preview-title" style={{ color: theme.colors.primary }}>
                    {theme.displayName}
                  </h3>
                  <p className="theme-preview-desc" style={{ color: theme.colors.textSecondary }}>
                    {theme.description}
                  </p>
                </div>

                {/* Color Swatches Palette */}
                <div className="theme-swatches-row">
                  <div
                    className="theme-swatch-circle"
                    style={{ backgroundColor: theme.colors.primary }}
                    title={`Primary: ${theme.colors.primary}`}
                  />
                  <div
                    className="theme-swatch-circle"
                    style={{ backgroundColor: theme.colors.secondary }}
                    title={`Secondary: ${theme.colors.secondary}`}
                  />
                  <div
                    className="theme-swatch-circle"
                    style={{ backgroundColor: theme.colors.accent }}
                    title={`Accent: ${theme.colors.accent}`}
                  />
                  <div
                    className="theme-swatch-circle bordered"
                    style={{ backgroundColor: theme.colors.bg }}
                    title={`Canvas BG: ${theme.colors.bg}`}
                  />
                  <div
                    className="theme-swatch-circle bordered"
                    style={{ backgroundColor: theme.colors.card }}
                    title={`Card Surface: ${theme.colors.card}`}
                  />
                  <span className="theme-typography-tag">
                    {theme.fontHeading} / {theme.fontBody}
                  </span>
                </div>

                {/* Apply Actions */}
                <div className="theme-actions-row">
                  <button
                    type="button"
                    className="btn-apply-theme btn-apply-slide"
                    onClick={() => {
                      onApplyThemeToSlide(theme.id);
                      onClose();
                    }}
                    title={`Apply ${theme.displayName} visual properties to Slide ${activeSlideNumber} only`}
                  >
                    <span>Apply to This Slide</span>
                  </button>
                  <button
                    type="button"
                    className="btn-apply-theme btn-apply-deck"
                    onClick={() => {
                      onApplyThemeToAll(theme.id);
                      onClose();
                    }}
                    title={`Apply ${theme.displayName} visual properties to all slides across presentation`}
                  >
                    <span>Apply to All Slides</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

