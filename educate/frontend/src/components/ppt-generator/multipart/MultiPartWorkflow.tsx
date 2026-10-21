/**
 * Complete Notes to Multi-Part PowerPoint Workflow (Workstream B).
 * Allows educators to upload entire long lecture notes (PDF, DOCX, TXT) or paste text,
 * automatically discovers topics without an index, builds a source-grounded outline,
 * plans slide allocations targeting requested slides per part, and generates a multi-part PPTX series.
 */

import React, { useState, useRef, useEffect } from 'react';
import type { ThemeOption, LayoutOption } from '../types/editor';
import {
  Layers,
  FileText,
  Upload,
  Download,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Archive,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import './multipart.css';

interface MultiPartWorkflowProps {
  availableThemes: ThemeOption[];
  availableLayouts: LayoutOption[];
  aiConfigured: boolean;
  onOpenVisualEditor: (fileId: string, title: string) => void;
  onBackToSingle: () => void;
}

interface DiscoveredSubtopic {
  subtopic_id: string;
  title: string;
  is_inferred: boolean;
  page_start: number;
  page_end: number;
}

interface DiscoveredTopic {
  topic_id: string;
  title: string;
  is_inferred: boolean;
  page_start: number;
  page_end: number;
  subtopics: DiscoveredSubtopic[];
  key_concepts: string[];
  summary: string;
}

interface PartPlan {
  part_number: number;
  title: string;
  subtitle: string;
  target_slides: number;
  planned_slides: number;
  topic_ids: string[];
  unit_ids: string[];
  is_final_part: boolean;
  continuation_from_part?: number | null;
}

interface MultiPartPlan {
  job_id: string;
  document_name: string;
  total_pages: number;
  slides_per_part: number;
  content_density: string;
  total_parts: number;
  total_slides: number;
  topics: DiscoveredTopic[];
  parts: PartPlan[];
  density_warning?: string | null;
  recommended_adjustment?: string | null;
  extraction_warnings: string[];
}

interface PartResult {
  part_number: number;
  title: string;
  file_id: string;
  filename: string;
  download_url: string;
  slide_count: number;
  status: string;
  preview_urls?: string[];
  file_size_bytes: number;
  requested_max_slides?: number;
  actual_exported_slides?: number;
  hard_limit_passed?: boolean;
  serious_layout_issues_detected?: number;
  issues_automatically_repaired?: number;
  warnings?: string[];
  generation_duration_seconds?: number | null;
  generation_stage?: string | null;
  source_page_start?: number | null;
  source_page_end?: number | null;
  assigned_topics?: string[];
  planned_slides?: number;
}

interface CoverageReport {
  source_pages_extracted: number;
  content_units_discovered: number;
  topics_detected: number;
  topics_covered: number;
  content_units_mapped: number;
  items_requiring_review: number;
  slides_generated: number;
  parts_generated: number;
  quality_score: number;
  status: string;
  warnings: string[];
  hard_limit_enforced?: boolean;
  total_serious_layout_issues?: number;
  total_issues_repaired?: number;
}

interface MultiPartJob {
  job_id: string;
  status: string;
  step_index: number;
  step_name: string;
  message: string;
  progress_percent: number;
  document_name: string;
  slides_per_part: number;
  content_density: string;
  mode: string;
  theme: string;
  layout_style: string;
  plan?: MultiPartPlan | null;
  parts: PartResult[];
  coverage_report?: CoverageReport | null;
  zip_filename?: string | null;
  zip_download_url?: string | null;
  error?: string | null;
}

export const MultiPartWorkflow: React.FC<MultiPartWorkflowProps> = ({
  availableThemes,
  availableLayouts,
  aiConfigured,
  onOpenVisualEditor,
  onBackToSingle,
}) => {
  // Workflow stages: 'input' -> 'outline_review' -> 'generating' -> 'results'
  const [stage, setStage] = useState<'input' | 'outline_review' | 'generating' | 'results'>('input');

  // Input states
  const [activeTab, setActiveTab] = useState<'file' | 'text'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [notesText, setNotesText] = useState('');
  const [seriesTitle, setSeriesTitle] = useState('');
  const [slidesPerPart, setSlidesPerPart] = useState(20);
  const [customSlides, setCustomSlides] = useState('20');
  const [contentDensity, setContentDensity] = useState<'concise' | 'balanced' | 'detailed'>('balanced');
  const [mode, setMode] = useState<'ai' | 'deterministic'>(aiConfigured ? 'ai' : 'deterministic');
  const [selectedTheme, setSelectedTheme] = useState('academic_navy');
  const [selectedLayout, setSelectedLayout] = useState('smart_mixed');

  // Pedagogical toggles
  const [includeExamples, setIncludeExamples] = useState(true);
  const [includeDefinitions, setIncludeDefinitions] = useState(true);
  const [includeEquations, setIncludeEquations] = useState(true);
  const [includeSummaries, setIncludeSummaries] = useState(true);
  const [includeRevisionQuestions, setIncludeRevisionQuestions] = useState(true);
  const [reviewOutlineFirst, setReviewOutlineFirst] = useState(true);

  // Job and Progress states
  const [currentJob, setCurrentJob] = useState<MultiPartJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({});
  const [viewingPart, setViewingPart] = useState<PartResult | null>(null);
  const [activeSlideNum, setActiveSlideNum] = useState<number>(1);

  // On-demand generation states & client timers
  const [partTimers, setPartTimers] = useState<Record<number, number>>({});
  const [partErrors, setPartErrors] = useState<Record<number, string>>({});
  const [generatingAll, setGeneratingAll] = useState(false);
  const partTimerIntervalsRef = useRef<Record<number, any>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<any>(null);

  // Clean up polling and per-part timer intervals
  useEffect(() => {
    const currentIntervals = partTimerIntervalsRef.current;
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      Object.values(currentIntervals).forEach((interval) => {
        if (interval) clearInterval(interval);
      });
    };
  }, []);

  // Keyboard navigation for Slide Viewer
  useEffect(() => {
    if (!viewingPart) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        setActiveSlideNum((prev) => Math.min(viewingPart.slide_count, prev + 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setActiveSlideNum((prev) => Math.max(1, prev - 1));
      } else if (e.key === 'Escape') {
        setViewingPart(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewingPart]);

  // Handle browser back/forward buttons sensibly between stages without losing current job state
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.stage) {
        if (event.state.stage === 'outline_review' && currentJob?.plan) {
          setStage('outline_review');
        } else if (event.state.stage === 'results' && currentJob) {
          setStage('results');
        } else if (event.state.stage === 'input') {
          setStage('input');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentJob]);

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    setError(null);
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    const valid = ['.txt', '.pdf', '.docx'];
    if (!valid.includes(ext)) {
      setError({
        message: `Unsupported file type "${ext}".`,
        hint: 'Please upload a PDF (.pdf), Word document (.docx), or plain text (.txt).',
      });
      return;
    }
    setSelectedFile(file);
  };

  const handleStartAnalysis = async () => {
    setError(null);
    if (activeTab === 'file' && !selectedFile) {
      setError({ message: 'Please select a document file (.pdf, .docx, .txt) to upload.' });
      return;
    }
    if (activeTab === 'text' && !notesText.trim()) {
      setError({ message: 'Please enter or paste your lecture notes text.' });
      return;
    }

    setLoading(true);
    const formData = new FormData();
    if (activeTab === 'file' && selectedFile) {
      formData.append('file', selectedFile);
    } else {
      formData.append('notes_text', notesText);
    }

    if (seriesTitle.trim()) {
      formData.append('title_override', seriesTitle.trim());
    }

    const targetSlides = Number(customSlides) || slidesPerPart;
    formData.append('slides_per_part', String(Math.max(3, Math.min(50, targetSlides))));
    formData.append('content_density', contentDensity);
    formData.append('mode', mode);
    formData.append('theme', selectedTheme);
    formData.append('layout_style', selectedLayout);
    formData.append('include_examples', String(includeExamples));
    formData.append('include_definitions', String(includeDefinitions));
    formData.append('include_equations', String(includeEquations));
    formData.append('include_summaries', String(includeSummaries));
    formData.append('include_revision_questions', String(includeRevisionQuestions));
    formData.append('auto_generate', String(!reviewOutlineFirst));

    try {
      const res = await fetch('/api/multi-part/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || `Upload failed with status ${res.status}`);
      }

      const jobData: MultiPartJob = await res.json();
      setCurrentJob(jobData);
      setLoading(false);

      if (!reviewOutlineFirst || jobData.status === 'completed' || jobData.status === 'generating_parts') {
        setStage('generating');
        startPollingJob(jobData.job_id);
      } else {
        setStage('outline_review');
        if (typeof window !== 'undefined' && window.history && window.history.pushState) {
          window.history.pushState({ stage: 'outline_review', jobId: jobData.job_id }, '');
        }
      }
    } catch (err: any) {
      setLoading(false);
      setError({
        message: err.message || 'Failed to analyze source notes.',
        hint: 'Verify the document is not corrupted or password-protected, then try again.',
      });
    }
  };

  const handleApproveOutline = async () => {
    if (!currentJob) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/multi-part/jobs/${currentJob.job_id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || `Approval failed with status ${res.status}`);
      }

      const updatedJob: MultiPartJob = await res.json();
      setCurrentJob(updatedJob);
      setLoading(false);
      // Immediately navigate to results page so educator can select which parts to create
      setStage('results');
      if (typeof window !== 'undefined' && window.history && window.history.pushState) {
        window.history.pushState({ stage: 'results', jobId: updatedJob.job_id }, '');
      }
    } catch (err: any) {
      setLoading(false);
      setError({
        message: err.message || 'Failed to approve outline.',
      });
      setStage('outline_review');
    }
  };

  const handleGeneratePart = async (partNumber: number, forceRegenerate = false) => {
    if (!currentJob) return;

    // Check if already generating
    const targetPart = currentJob.parts.find((p) => p.part_number === partNumber);
    if (targetPart && targetPart.status === 'generating') {
      return;
    }

    // Clear any previous error for this part
    setPartErrors((prev) => {
      const next = { ...prev };
      delete next[partNumber];
      return next;
    });

    // Start client-side timer
    setPartTimers((prev) => ({ ...prev, [partNumber]: 0 }));
    if (partTimerIntervalsRef.current[partNumber]) {
      clearInterval(partTimerIntervalsRef.current[partNumber]);
    }
    const timerStart = Date.now();
    partTimerIntervalsRef.current[partNumber] = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - timerStart) / 1000);
      setPartTimers((prev) => ({ ...prev, [partNumber]: elapsedSec }));
    }, 1000);

    // Optimistically update part status to 'generating'
    setCurrentJob((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        parts: prev.parts.map((p) =>
          p.part_number === partNumber
            ? { ...p, status: 'generating', generation_stage: 'Generating slides...' }
            : p
        ),
      };
    });

    try {
      const url = `/api/multi-part/jobs/${currentJob.job_id}/parts/${partNumber}/generate${
        forceRegenerate ? '?force_regenerate=true' : ''
      }`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || `Failed to generate Part ${partNumber}`);
      }

      const updatedJob: MultiPartJob = await res.json();
      setCurrentJob(updatedJob);
    } catch (err: any) {
      setPartErrors((prev) => ({
        ...prev,
        [partNumber]: err.message || `Failed to generate Part ${partNumber}`,
      }));
      setCurrentJob((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          parts: prev.parts.map((p) =>
            p.part_number === partNumber
              ? { ...p, status: 'failed', warnings: [err.message || 'Generation failed'] }
              : p
          ),
        };
      });
    } finally {
      if (partTimerIntervalsRef.current[partNumber]) {
        clearInterval(partTimerIntervalsRef.current[partNumber]);
        delete partTimerIntervalsRef.current[partNumber];
      }
    }
  };

  const handleGenerateAllParts = async () => {
    if (!currentJob || generatingAll) return;
    setGeneratingAll(true);

    try {
      const res = await fetch(`/api/multi-part/jobs/${currentJob.job_id}/generate-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Failed to generate all parts.');
      }

      const updatedJob: MultiPartJob = await res.json();
      setCurrentJob(updatedJob);
    } catch (err: any) {
      setError({ message: err.message || 'Failed to generate all remaining parts.' });
    } finally {
      setGeneratingAll(false);
    }
  };

  const startPollingJob = (jobId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/multi-part/jobs/${jobId}`);
        if (!res.ok) return;

        const job: MultiPartJob = await res.json();
        setCurrentJob(job);

        if (job.status === 'completed' || job.status === 'completed_with_warnings') {
          clearInterval(pollIntervalRef.current);
          setStage('results');
        } else if (job.status === 'failed') {
          clearInterval(pollIntervalRef.current);
          setError({ message: job.error || 'Multi-part generation failed.' });
          setStage('outline_review');
        }
      } catch {
        // Continue polling
      }
    }, 1500);
  };

  const toggleTopicExpand = (topicId: string) => {
    setExpandedTopics((prev) => ({ ...prev, [topicId]: !prev[topicId] }));
  };

  const completedParts =
    currentJob?.parts.filter((p) => p.status === 'completed' || p.status === 'completed_with_warnings') || [];
  const pendingParts = currentJob?.parts.filter((p) => p.status === 'pending') || [];
  const generatingParts = currentJob?.parts.filter((p) => p.status === 'generating') || [];
  const anyGenerating = generatingParts.length > 0 || generatingAll;

  return (
    <div className="multipart-wrapper animate-fade-in">
      {/* Header Banner */}
      <div className="multipart-hero">
        <div className="multipart-hero-badge">
          <BookOpen size={14} />
          <span>Curriculum Multi-Deck Generator</span>
        </div>
        <h1 className="multipart-hero-title">Complete Notes → Multiple PPTs</h1>
        <p className="multipart-hero-subtitle">
          Transform comprehensive 100+ page course notes, textbooks, or syllabus documents into structured,
          multi-part PowerPoint presentation series. Acadion automatically discovers topic hierarchies even
          without an index or headings, and allocates content into coherent decks targeting your chosen slide count.
        </p>
      </div>

      {/* Error alert */}
      {error && (
        <div className="alert alert-error animate-fade-in" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>
            <strong>{error.message}</strong>
            {error.hint && <div className="alert-hint">{error.hint}</div>}
          </div>
        </div>
      )}

      {/* =====================================================================
          STAGE 1: INPUT AND CONFIGURATION
          ===================================================================== */}
      {stage === 'input' && (
        <div>
          {/* Card 1: Content Source */}
          <div className="multipart-card">
            <div className="multipart-card-header">
              <span className="multipart-step-num">1</span>
              <div>
                <h2 className="multipart-card-title">Upload Entire Course Notes</h2>
                <p className="multipart-card-desc">
                  Provide your complete notes file (.pdf, .docx, .txt) or paste raw text. The entire document will be analyzed.
                </p>
              </div>
            </div>

            <div className="ppt-tabs-row" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'file'}
                className={`ppt-tab-btn ${activeTab === 'file' ? 'active' : ''}`}
                onClick={() => setActiveTab('file')}
              >
                <Upload size={16} />
                <span>Upload Document (.pdf, .docx, .txt)</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'text'}
                className={`ppt-tab-btn ${activeTab === 'text' ? 'active' : ''}`}
                onClick={() => setActiveTab('text')}
              >
                <FileText size={16} />
                <span>Pasted Lecture Notes</span>
              </button>
            </div>

            {activeTab === 'file' ? (
              <div
                className="ppt-dropzone"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept=".txt,.pdf,.docx"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      validateAndSetFile(e.target.files[0]);
                    }
                  }}
                />
                <Upload size={32} style={{ color: '#0F2C59', marginBottom: '0.5rem' }} />
                {selectedFile ? (
                  <div>
                    <strong style={{ color: '#0F2C59' }}>{selectedFile.name}</strong>
                    <div style={{ fontSize: '0.82rem', color: '#64748B' }}>
                      {(selectedFile.size / 1024).toFixed(1)} KB • Ready for deep analysis
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontWeight: 600, color: '#1E293B' }}>
                      Click or drag and drop your lecture file here
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#64748B' }}>
                      Supports PDF (.pdf), Word (.docx), or Text (.txt)
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <textarea
                className="lecture-textarea ppt-wide-textarea"
                placeholder="Paste your entire lecture notes, syllabus, or course manual here..."
                rows={10}
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
              />
            )}
          </div>

          {/* Card 2: Presentation Series Settings */}
          <div className="multipart-card">
            <div className="multipart-card-header">
              <span className="multipart-step-num">2</span>
              <div>
                <h2 className="multipart-card-title">Multi-Part Deck Configuration</h2>
                <p className="multipart-card-desc">
                  Configure target slides per presentation part, content density, and optional series title.
                </p>
              </div>
            </div>

            {/* Title */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.9rem' }}>
                Course / Series Title (Optional)
              </label>
              <input
                type="text"
                className="ppt-full-input"
                placeholder="e.g. Artificial Intelligence: Complete Course (or auto-detected)"
                value={seriesTitle}
                onChange={(e) => setSeriesTitle(e.target.value)}
              />
            </div>

            {/* Target Slides Per Part */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.9rem' }}>
                Target Slides Per PowerPoint Part
              </label>
              <div className="multipart-pill-group">
                {[10, 15, 20, 25].map((count) => (
                  <button
                    key={count}
                    type="button"
                    className={`multipart-pill ${Number(customSlides) === count ? 'active' : ''}`}
                    onClick={() => {
                      setSlidesPerPart(count);
                      setCustomSlides(String(count));
                    }}
                  >
                    {count} Slides / Part
                  </button>
                ))}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: 600 }}>Custom:</span>
                  <input
                    type="number"
                    min="3"
                    max="50"
                    className="multipart-pill-input"
                    value={customSlides}
                    onChange={(e) => {
                      setCustomSlides(e.target.value);
                      const num = Number(e.target.value);
                      if (num >= 3 && num <= 50) setSlidesPerPart(num);
                    }}
                  />
                  <span style={{ fontSize: '0.8rem', color: '#64748B' }}>slides</span>
                </div>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '0.4rem' }}>
                The slide count is the target per presentation part, not a command to drop important content.
                If final content naturally finishes earlier, a shorter final part is planned.
              </p>
            </div>

            {/* Generation Engine Mode */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.9rem' }}>
                Generation Engine Mode
              </label>
              <div className="multipart-pill-group">
                <button
                  type="button"
                  className={`multipart-pill ${mode === 'ai' ? 'active' : ''}`}
                  onClick={() => setMode('ai')}
                  disabled={!aiConfigured}
                  title={aiConfigured ? 'Use AI conceptual analysis' : 'AI not configured - falling back to Rule-based'}
                >
                  <Sparkles size={14} />
                  <span>AI Semantic Engine {aiConfigured ? '' : '(Not Configured)'}</span>
                </button>
                <button
                  type="button"
                  className={`multipart-pill ${mode === 'deterministic' ? 'active' : ''}`}
                  onClick={() => setMode('deterministic')}
                >
                  <Zap size={14} />
                  <span>Rule-Based Structural Engine</span>
                </button>
              </div>
            </div>

            {/* Content Density */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.9rem' }}>
                Pedagogical Content Density
              </label>
              <div className="multipart-pill-group">
                {[
                  { id: 'concise', label: 'Concise', desc: 'High synthesis & key takeaways' },
                  { id: 'balanced', label: 'Balanced', desc: 'Standard classroom lecture pacing' },
                  { id: 'detailed', label: 'Detailed', desc: 'Exhaustive concept breakdown' },
                ].map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className={`multipart-pill ${contentDensity === d.id ? 'active' : ''}`}
                    onClick={() => setContentDensity(d.id as any)}
                  >
                    <span>{d.label}</span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>({d.desc})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Pedagogical Inclusions */}
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.9rem' }}>
                Pedagogical Elements to Include
              </label>
              <div className="multipart-checkbox-grid">
                <label className="multipart-checkbox-label">
                  <input
                    type="checkbox"
                    checked={includeDefinitions}
                    onChange={(e) => setIncludeDefinitions(e.target.checked)}
                  />
                  <span>Formal Definitions</span>
                </label>
                <label className="multipart-checkbox-label">
                  <input
                    type="checkbox"
                    checked={includeExamples}
                    onChange={(e) => setIncludeExamples(e.target.checked)}
                  />
                  <span>Real-World Examples & Cases</span>
                </label>
                <label className="multipart-checkbox-label">
                  <input
                    type="checkbox"
                    checked={includeEquations}
                    onChange={(e) => setIncludeEquations(e.target.checked)}
                  />
                  <span>Mathematical Equations & Models</span>
                </label>
                <label className="multipart-checkbox-label">
                  <input
                    type="checkbox"
                    checked={includeSummaries}
                    onChange={(e) => setIncludeSummaries(e.target.checked)}
                  />
                  <span>Part Conclusions & Takeaways</span>
                </label>
                <label className="multipart-checkbox-label">
                  <input
                    type="checkbox"
                    checked={includeRevisionQuestions}
                    onChange={(e) => setIncludeRevisionQuestions(e.target.checked)}
                  />
                  <span>Revision Questions & Discussion</span>
                </label>
              </div>
            </div>
          </div>

          {/* Card 3: Theme and Layout Selection */}
          <div className="multipart-card">
            <div className="multipart-card-header">
              <span className="multipart-step-num">3</span>
              <div>
                <h2 className="multipart-card-title">Theme & Layout Family</h2>
                <p className="multipart-card-desc">
                  Select visual styling to apply consistently across all generated PowerPoint parts.
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', fontSize: '0.9rem' }}>
                  Presentation Theme
                </label>
                <select
                  className="ppt-full-input"
                  value={selectedTheme}
                  onChange={(e) => setSelectedTheme(e.target.value)}
                >
                  {availableThemes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.display_name} {t.is_dark ? '(Dark)' : '(Light)'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', fontSize: '0.9rem' }}>
                  Layout Family
                </label>
                <select
                  className="ppt-full-input"
                  value={selectedLayout}
                  onChange={(e) => setSelectedLayout(e.target.value)}
                >
                  {availableLayouts.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} — {l.badge}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
              <input
                type="checkbox"
                checked={reviewOutlineFirst}
                onChange={(e) => setReviewOutlineFirst(e.target.checked)}
              />
              <span style={{ fontWeight: 600, color: '#1E293B' }}>
                Review and approve discovered topic outline before rendering PowerPoint files
              </span>
            </label>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={onBackToSingle}
              >
                Back to Single Presentation
              </button>

              <button
                type="button"
                className="btn-primary"
                onClick={handleStartAnalysis}
                disabled={loading}
                style={{ padding: '0.8rem 1.75rem', fontSize: '1rem', fontWeight: 700 }}
              >
                {loading ? (
                  <>
                    <RefreshCw className="animate-spin" size={18} />
                    <span>Analyzing Entire Document...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    <span>Analyze Notes & Discover Topics</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          STAGE 2: OUTLINE REVIEW & APPROVAL
          ===================================================================== */}
      {stage === 'outline_review' && currentJob?.plan && (
        <div className="animate-fade-in">
          <div className="multipart-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0F2C59' }}>
                  Review Discovered Topic Outline & Part Allocation
                </h2>
                <p style={{ color: '#64748B', fontSize: '0.9rem', marginTop: '0.2rem' }}>
                  Source: <strong>{currentJob.document_name}</strong> • {currentJob.plan.total_pages} Pages Processed • {currentJob.plan.total_parts} Planned Parts ({currentJob.plan.total_slides} total slides)
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setStage('input')}
                >
                  <ArrowLeft size={16} />
                  <span>Revise Settings</span>
                </button>

                {currentJob.parts && currentJob.parts.length > 0 && currentJob.status !== 'awaiting_approval' && (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      setStage('results');
                      if (typeof window !== 'undefined' && window.history && window.history.pushState) {
                        window.history.pushState({ stage: 'results', jobId: currentJob.job_id }, '');
                      }
                    }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, padding: '0.6rem 1.15rem' }}
                  >
                    <span>Return to Presentation Series</span>
                    <ArrowRight size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Density Warning Banner if present */}
            {currentJob.plan.density_warning && (
              <div className="alert alert-warning" style={{ margin: '1rem 0' }}>
                <AlertCircle size={20} />
                <div>
                  <strong>{currentJob.plan.density_warning}</strong>
                  {currentJob.plan.recommended_adjustment && (
                    <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                      {currentJob.plan.recommended_adjustment}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Planned Parts Structure */}
            <div className="multipart-outline-container">
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem', color: '#1E293B' }}>
                Planned PowerPoint Presentations ({currentJob.plan.total_parts} Parts)
              </h3>

              {currentJob.plan.parts.map((p) => {
                const partRes = currentJob.parts?.find((r) => r.part_number === p.part_number);
                const isGenerated = partRes && partRes.status === 'completed';
                return (
                  <div key={p.part_number} className="multipart-part-block">
                    <div className="multipart-part-header">
                      <div className="multipart-part-title">
                        {p.title}
                        {p.continuation_from_part && (
                          <span style={{ fontSize: '0.8rem', color: '#64748B', marginLeft: '0.5rem' }}>
                            (Continues from Part {p.continuation_from_part})
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {isGenerated && (
                          <span className="part-badge-duration" style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem' }}>
                            ✓ Generated ({partRes.slide_count} slides)
                          </span>
                        )}
                        <div className="multipart-part-badge">
                          {p.planned_slides} Slides Planned {p.is_final_part ? '• Final Part' : ''}
                        </div>
                      </div>
                    </div>

                  <div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                      Assigned Topics:
                    </span>
                    <div style={{ marginTop: '0.35rem' }}>
                      {currentJob.plan?.topics
                        .filter((t) => p.topic_ids.includes(t.topic_id))
                        .map((topic) => (
                          <div key={topic.topic_id} className="multipart-topic-item">
                            <CheckCircle2 size={16} style={{ color: '#2563EB', flexShrink: 0, marginTop: '2px' }} />
                            <div>
                              <strong>{topic.title}</strong>
                              {topic.is_inferred && (
                                <span className="multipart-inferred-badge" style={{ marginLeft: '0.5rem' }}>
                                  Inferred Concept
                                </span>
                              )}
                              <span style={{ fontSize: '0.78rem', color: '#64748B', marginLeft: '0.5rem' }}>
                                (Source Pages {topic.page_start}–{topic.page_end})
                              </span>

                              {topic.subtopics.length > 0 && (
                                <div style={{ fontSize: '0.82rem', color: '#64748B', marginTop: '0.2rem' }}>
                                  Subtopics: {topic.subtopics.map((s) => s.title).join(', ')}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              );
            })}
            </div>

            {/* Discovered Topic Tree Accordion */}
            <div style={{ marginTop: '1.5rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.75rem', color: '#1E293B' }}>
                All Discovered Topics ({currentJob.plan.topics.length} Grounded Topics)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {currentJob.plan.topics.map((t) => {
                  const isExpanded = expandedTopics[t.topic_id] ?? false;
                  return (
                    <div
                      key={t.topic_id}
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: '6px',
                        padding: '0.75rem 1rem',
                      }}
                    >
                      <div
                        onClick={() => toggleTopicExpand(t.topic_id)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <strong>{t.title}</strong>
                          {t.is_inferred && (
                            <span className="multipart-inferred-badge">Inferred Concept</span>
                          )}
                          <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
                            (Pages {t.page_start}–{t.page_end})
                          </span>
                        </div>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>

                      {isExpanded && (
                        <div style={{ marginTop: '0.65rem', paddingTop: '0.65rem', borderTop: '1px solid #F1F5F9' }}>
                          <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '0.4rem' }}>
                            {t.summary}
                          </p>
                          {t.subtopics.length > 0 && (
                            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.82rem', color: '#334155' }}>
                              {t.subtopics.map((st) => (
                                <li key={st.subtopic_id}>{st.title}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Approval Action */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '2rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setStage('input')}
              >
                Back to Settings
              </button>

              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  if (currentJob.status !== 'awaiting_approval' && currentJob.parts && currentJob.parts.length > 0) {
                    setStage('results');
                    if (typeof window !== 'undefined' && window.history && window.history.pushState) {
                      window.history.pushState({ stage: 'results', jobId: currentJob.job_id }, '');
                    }
                  } else {
                    handleApproveOutline();
                  }
                }}
                disabled={loading}
                style={{ padding: '0.8rem 2rem', fontSize: '1rem', fontWeight: 700 }}
              >
                {loading ? (
                  <>
                    <RefreshCw className="animate-spin" size={18} />
                    <span>Planning Presentation Parts...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    <span>
                      {currentJob.parts && currentJob.parts.length > 0 && currentJob.status !== 'awaiting_approval'
                        ? 'Return to Presentation Series'
                        : `Approve Outline & Plan ${currentJob.plan.total_parts} Parts`}
                    </span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          STAGE 3: PROGRESS SCREEN
          ===================================================================== */}
      {stage === 'generating' && currentJob && (
        <div className="multipart-card animate-fade-in" style={{ textAlign: 'center', padding: '3.5rem 2rem' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ display: 'inline-flex', padding: '1rem', background: '#EFF6FF', borderRadius: '50%', color: '#2563EB', marginBottom: '1.25rem' }}>
              <Layers size={36} className="animate-pulse" />
            </div>

            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F2C59', marginBottom: '0.5rem' }}>
              {currentJob.step_name}
            </h2>
            <p style={{ color: '#64748B', fontSize: '0.95rem', marginBottom: '1.75rem' }}>
              {currentJob.message}
            </p>

            {/* Progress Bar */}
            <div style={{ width: '100%', height: '10px', background: '#E2E8F0', borderRadius: '5px', overflow: 'hidden', marginBottom: '1rem' }}>
              <div
                style={{
                  width: `${currentJob.progress_percent}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #2563EB 0%, #1E3A8A 100%)',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#64748B' }}>
              <span>Step {currentJob.step_index} of 10</span>
              <span>{currentJob.progress_percent}% complete</span>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          STAGE 4: RESULTS & DOWNLOADS
          ===================================================================== */}
      {stage === 'results' && currentJob && (
        <div className="animate-fade-in">
            {/* Header Action Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0F2C59', margin: 0 }}>
                  {currentJob.document_name} — Presentation Series
                </h2>
                <p style={{ color: '#64748B', fontSize: '0.9rem', margin: '0.2rem 0 0 0' }}>
                  {completedParts.length} of {currentJob.parts.length} parts generated • Target: {currentJob.slides_per_part} slides/part
                  {pendingParts.length > 0 && ` • ${pendingParts.length} parts ready to create on demand`}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-back-to-outline"
                  onClick={() => {
                    setStage('outline_review');
                    if (typeof window !== 'undefined' && window.history && window.history.pushState) {
                      window.history.pushState({ stage: 'outline_review', jobId: currentJob.job_id }, '');
                    }
                  }}
                  title="Return to the discovered topic outline and part allocation"
                >
                  <ArrowLeft size={16} />
                  <span>Back to Outline</span>
                </button>

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setStage('input')}
                >
                  Generate Another Series
                </button>

                {pendingParts.length > 0 && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleGenerateAllParts}
                    disabled={anyGenerating}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
                  >
                    <Sparkles size={16} />
                    <span>{generatingAll ? 'Generating Remaining...' : `Create All Remaining (${pendingParts.length})`}</span>
                  </button>
                )}

                {completedParts.length > 0 ? (
                  <a
                    href={currentJob.zip_download_url || `/api/multi-part/jobs/${currentJob.job_id}/download-zip`}
                    download={currentJob.zip_filename || 'Curriculum_All_Parts.zip'}
                    className="btn-zip-download"
                    title={
                      pendingParts.length > 0
                        ? `Contains ${completedParts.length} generated parts (${pendingParts.map((p) => `Part ${p.part_number}`).join(', ')} not yet generated)`
                        : 'Download full presentation series archive'
                    }
                  >
                    <Archive size={18} />
                    <span>
                      Download ZIP ({completedParts.length}/{currentJob.parts.length})
                    </span>
                  </a>
                ) : (
                  <button
                    type="button"
                    className="btn-zip-download"
                    disabled
                    style={{ opacity: 0.5, cursor: 'not-allowed', background: '#94A3B8' }}
                    title="Generate at least one presentation part to download the series archive"
                  >
                    <Archive size={18} />
                    <span>Download ZIP (0 generated)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Coverage Audit Card */}
            {currentJob.coverage_report && completedParts.length > 0 && (
              <div className="multipart-audit-card">
                <div className="multipart-audit-metric">
                  <span className="multipart-audit-value">{currentJob.coverage_report.quality_score}%</span>
                  <span className="multipart-audit-label">Quality Score</span>
                </div>
                <div className="multipart-audit-metric">
                  <span className="multipart-audit-value">{currentJob.coverage_report.topics_covered} / {currentJob.coverage_report.topics_detected}</span>
                  <span className="multipart-audit-label">Topics Covered</span>
                </div>
                <div className="multipart-audit-metric">
                  <span className="multipart-audit-value">{currentJob.coverage_report.content_units_mapped} / {currentJob.coverage_report.content_units_discovered}</span>
                  <span className="multipart-audit-label">Content Units Mapped</span>
                </div>
                <div className="multipart-audit-metric">
                  <span className="multipart-audit-value">{currentJob.coverage_report.slides_generated}</span>
                  <span className="multipart-audit-label">Slides Generated</span>
                </div>
                <div className="multipart-audit-metric">
                  <span className="multipart-audit-value">≤ {currentJob.slides_per_part}</span>
                  <span className="multipart-audit-label">Hard Limit / Part</span>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#166534', fontWeight: 700, fontSize: '0.88rem' }}>
                    <CheckCircle2 size={16} />
                    <span>Strict Limit & Figure Quality Enforced</span>
                  </div>
                  {(currentJob.coverage_report.total_issues_repaired ?? 0) > 0 && (
                    <span style={{ fontSize: '0.75rem', color: '#047857' }}>
                      {currentJob.coverage_report.total_issues_repaired} layouts reflowed for readability
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Parts Grid */}
            <div className="multipart-results-grid">
              {currentJob.parts.map((p) => {
                const maxAllowed = p.requested_max_slides ?? currentJob.slides_per_part;
                const isCompleted = p.status === 'completed' || p.status === 'completed_with_warnings';
                const isGenerating = p.status === 'generating';
                const isFailed = p.status === 'failed';
                const isPending = p.status === 'pending';
                const actualSlides = p.actual_exported_slides ?? p.slide_count;
                const limitPassed = p.hard_limit_passed ?? (actualSlides <= maxAllowed);
                const elapsed = partTimers[p.part_number] ?? 0;
                const durationSec = p.generation_duration_seconds;

                // Source page range
                const pageRange =
                  p.source_page_start && p.source_page_end
                    ? `Pages ${p.source_page_start}–${p.source_page_end}`
                    : null;

                return (
                  <div
                    key={p.part_number}
                    className="multipart-part-card"
                    style={{
                      border: isGenerating ? '2px solid #3B82F6' : undefined,
                      boxShadow: isGenerating ? '0 4px 14px rgba(59, 130, 246, 0.2)' : undefined,
                    }}
                  >
                    <div>
                      {/* Top Header Row with Badges */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#2563EB' }}>
                          Part {p.part_number}
                        </span>
                        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          {isCompleted && (
                            <>
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  background: limitPassed ? '#EFF6FF' : '#FEE2E2',
                                  color: limitPassed ? '#1D4ED8' : '#B91C1C',
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '4px',
                                  border: `1px solid ${limitPassed ? '#BFDBFE' : '#FECACA'}`,
                                }}
                              >
                                {limitPassed ? `✓ ≤ ${maxAllowed} Limit Passed` : `⚠ Exceeds ${maxAllowed}`}
                              </span>
                              <span className="part-badge-duration">
                                {durationSec != null ? `✓ ${durationSec.toFixed(1)}s` : 'Completed'}
                              </span>
                            </>
                          )}
                          {isGenerating && (
                            <span className="part-badge-generating">
                              <RefreshCw size={12} className="animate-spin" />
                              Generating ({elapsed}s)
                            </span>
                          )}
                          {isPending && (
                            <span className="part-badge-pending">
                              Planned
                            </span>
                          )}
                          {isFailed && (
                            <span className="part-badge-failed">
                              Failed
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Title */}
                      <h3 className="multipart-part-card-title">{p.title}</h3>

                      {/* Source pages and assigned topics */}
                      {(pageRange || (p.assigned_topics && p.assigned_topics.length > 0)) && (
                        <div style={{ fontSize: '0.78rem', color: '#64748B', marginBottom: '0.5rem', lineHeight: 1.4 }}>
                          {pageRange && <strong style={{ color: '#475569' }}>{pageRange}</strong>}
                          {pageRange && p.assigned_topics && p.assigned_topics.length > 0 && ' • '}
                          {p.assigned_topics && p.assigned_topics.length > 0 && (
                            <span>Topics: {p.assigned_topics.slice(0, 3).join(', ')}{p.assigned_topics.length > 3 ? '...' : ''}</span>
                          )}
                        </div>
                      )}

                      {/* Meta Information / Status Details */}
                      <div className="multipart-part-meta">
                        {isCompleted ? (
                          <>
                            <span style={{ fontWeight: 700, color: limitPassed ? '#0F2C59' : '#DC2626' }}>
                              {actualSlides} / {maxAllowed} Slides
                            </span>
                            <span>•</span>
                            <span>{(p.file_size_bytes / 1024).toFixed(0)} KB</span>
                            <span>•</span>
                            <span>16:9 Widescreen</span>
                            {durationSec != null && (
                              <>
                                <span>•</span>
                                <span style={{ color: '#15803D', fontWeight: 600 }}>
                                  {durationSec.toFixed(1)}s
                                </span>
                              </>
                            )}
                          </>
                        ) : isGenerating ? (
                          <span style={{ color: '#2563EB', fontWeight: 600 }}>
                            {p.generation_stage || 'Rendering slides and checking figures...'}
                          </span>
                        ) : isPending ? (
                          <span>
                            Planned: ~{p.planned_slides || maxAllowed} slides (Target max: {maxAllowed})
                          </span>
                        ) : (
                          <span style={{ color: '#DC2626', fontWeight: 600 }}>
                            {partErrors[p.part_number] || p.warnings?.[0] || 'Generation failed'}
                          </span>
                        )}
                      </div>

                      {/* Warnings if any */}
                      {p.warnings && p.warnings.length > 0 && isCompleted && (
                        <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: '#B45309', background: '#FEF3C7', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                          {p.warnings[0]}
                        </div>
                      )}
                    </div>

                    {/* Part Actions */}
                    <div className="multipart-part-actions">
                      {isPending && (
                        <button
                          type="button"
                          className="btn-part-create"
                          onClick={() => handleGeneratePart(p.part_number)}
                          disabled={isGenerating}
                        >
                          <Sparkles size={16} />
                          <span>Create PPT</span>
                        </button>
                      )}

                      {isGenerating && (
                        <button type="button" className="btn-part-generating" disabled>
                          <RefreshCw className="animate-spin" size={16} />
                          <span>Generating... ({elapsed}s)</span>
                        </button>
                      )}

                      {isFailed && (
                        <button
                          type="button"
                          className="btn-part-retry"
                          onClick={() => handleGeneratePart(p.part_number, true)}
                        >
                          <RefreshCw size={16} />
                          <span>Retry Generation</span>
                        </button>
                      )}

                      {isCompleted && (
                        <>
                          <button
                            type="button"
                            className="btn-part-view"
                            onClick={() => {
                              setViewingPart(p);
                              setActiveSlideNum(1);
                            }}
                            title="Open in-app presentation viewer"
                          >
                            <Eye size={14} />
                            <span>View Presentation</span>
                          </button>

                          <button
                            type="button"
                            className="btn-part-editor"
                            onClick={() => onOpenVisualEditor(p.file_id, p.title)}
                            title="Open this specific presentation in the interactive visual editor"
                          >
                            <ExternalLink size={14} />
                            <span>Visual Editor</span>
                          </button>

                          <a
                            href={p.download_url}
                            download={p.filename}
                            className="btn-part-download"
                          >
                            <Download size={14} />
                            <span>Download PPTX</span>
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

          {/* In-App Slide Viewer Modal */}
          {viewingPart && (
            <div className="slide-viewer-overlay" onClick={() => setViewingPart(null)}>
              <div className="slide-viewer-container" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="slide-viewer-header">
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#FFFFFF' }}>
                      {viewingPart.title}
                    </h3>
                    <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                      Slide {activeSlideNum} of {viewingPart.slide_count}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: '#FFFFFF', borderColor: '#475569', background: '#334155', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                      onClick={() => {
                        const p = viewingPart;
                        setViewingPart(null);
                        onOpenVisualEditor(p.file_id, p.title);
                      }}
                    >
                      <ExternalLink size={14} />
                      <span>Visual Editor</span>
                    </button>

                    <a
                      href={viewingPart.download_url}
                      download={viewingPart.filename}
                      className="btn-secondary"
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: '#FFFFFF', borderColor: '#475569', background: '#334155', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <Download size={14} />
                      <span>Download PPTX</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => setViewingPart(null)}
                      style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '0.3rem', display: 'flex', alignItems: 'center' }}
                      title="Close viewer (Esc)"
                    >
                      <X size={22} />
                    </button>
                  </div>
                </div>

                {/* Main Slide Viewer Canvas */}
                <div className="slide-viewer-main">
                  <button
                    type="button"
                    className="slide-viewer-nav-btn slide-viewer-nav-prev"
                    onClick={() => setActiveSlideNum((prev) => Math.max(1, prev - 1))}
                    disabled={activeSlideNum <= 1}
                    title="Previous slide (Left Arrow)"
                  >
                    <ChevronLeft size={28} />
                  </button>

                  <img
                    key={`${viewingPart.file_id}_${activeSlideNum}`}
                    src={`/api/preview/${viewingPart.file_id}/${activeSlideNum}`}
                    alt={`Slide ${activeSlideNum} of ${viewingPart.title}`}
                    className="slide-viewer-canvas"
                    onError={(e) => {
                      (e.target as HTMLImageElement).alt = `Preview for Slide ${activeSlideNum} is loading...`;
                    }}
                  />

                  <button
                    type="button"
                    className="slide-viewer-nav-btn slide-viewer-nav-next"
                    onClick={() => setActiveSlideNum((prev) => Math.min(viewingPart.slide_count, prev + 1))}
                    disabled={activeSlideNum >= viewingPart.slide_count}
                    title="Next slide (Right Arrow / Space)"
                  >
                    <ChevronRight size={28} />
                  </button>
                </div>

                {/* Bottom Thumbnail Strip */}
                <div className="slide-viewer-thumbnails">
                  {Array.from({ length: viewingPart.slide_count }, (_, i) => i + 1).map((sNum) => (
                    <div
                      key={sNum}
                      className={`slide-viewer-thumb ${sNum === activeSlideNum ? 'active' : ''}`}
                      onClick={() => setActiveSlideNum(sNum)}
                      title={`Jump to slide ${sNum}`}
                    >
                      <img
                        src={`/api/preview/${viewingPart.file_id}/${sNum}`}
                        alt={`Thumbnail ${sNum}`}
                        loading="lazy"
                      />
                      <span
                        style={{
                          position: 'absolute',
                          bottom: '2px',
                          right: '3px',
                          background: 'rgba(0,0,0,0.7)',
                          color: '#FFF',
                          fontSize: '0.65rem',
                          padding: '1px 3px',
                          borderRadius: '2px',
                          fontWeight: 700,
                        }}
                      >
                        {sNum}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
