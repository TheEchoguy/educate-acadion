import React, { useState, useEffect, useRef } from 'react';
import {
  Presentation,
  FileText,
  Upload,
  Sparkles,
  Download,
  AlertCircle,
  Edit3,
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp,
  FileCheck,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Eye,
  ListOrdered,
  Palette,
  CheckCircle2,
  ExternalLink,
  LayoutGrid,
  Info,
  Clock,
  FolderPlus,
  ArrowRight,
  Check,
  Zap,
  Plus,
  Layers
} from 'lucide-react';
import '../../components/ppt-generator/PptGenerator.css';
import Navbar from '../../components/Navbar';
import { useNavigate } from 'react-router-dom';
import { VisualEditor } from '../../components/ppt-generator/editor/VisualEditor';
import { MultiPartWorkflow } from '../../components/ppt-generator/multipart/MultiPartWorkflow';

interface SlideBullet {
  prefix?: string;
  text: string;
  display_text?: string;
}

interface SlidePreview {
  slide_number: number;
  title: string;
  subtitle?: string;
  type: string;
  bullets: SlideBullet[];
  speaker_notes?: string;
  visual_type?: string;
  image_url?: string;
}

interface PresentationResult {
  file_id: string;
  download_url: string;
  filename: string;
  title: string;
  subtitle: string;
  mode: string;
  theme?: string;
  layout_style?: string;
  slide_count: number;
  file_size_bytes: number;
  slides: SlidePreview[];
  preview_urls?: string[];
  provider?: string;
  qa_report?: {
    passed: boolean;
    score: number;
    metrics: Record<string, any>;
    warnings: string[];
    critical_errors: string[];
  };
  source_metadata: {
    file_type?: string;
    page_count?: number;
    word_count?: number;
    character_count?: number;
    description?: string;
  };
}

interface HealthStatus {
  status: string;
  ai_configured: boolean;
  model: string;
  available_providers?: string[];
}

export interface ThemeOption {
  id: string;
  display_name: string;
  description: string;
  is_dark: boolean;
  is_custom?: boolean;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    bg: string;
    card: string;
  };
}

export interface LayoutOption {
  id: string;
  name: string;
  display_name?: string;
  badge: string;
  description: string;
  icon: string;
}

export interface TemplateAnalysis {
  template_name: string;
  slide_dimensions: string;
  is_widescreen: boolean;
  detected_mode: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  font_heading: string;
  font_body: string;
  slide_count: number;
  has_layouts: boolean;
  compatibility_notes: string[];
}

// 14 Built-in Themes (8 Original + 6 New Dark Themes)
export const THEME_OPTIONS: ThemeOption[] = [
  // 8 Original Themes
  {
    id: 'academic_navy',
    display_name: 'Academic Navy',
    description: 'Navy, slate, and amber gold accents',
    is_dark: false,
    colors: { primary: '#0F2C59', secondary: '#1E3A8A', accent: '#D97706', bg: '#F8FAFC', card: '#FFFFFF' },
  },
  {
    id: 'modern_blue',
    display_name: 'Modern Blue',
    description: 'Blue, white, and light grey',
    is_dark: false,
    colors: { primary: '#1E40AF', secondary: '#2563EB', accent: '#06B6D4', bg: '#F1F5F9', card: '#FFFFFF' },
  },
  {
    id: 'emerald_pro',
    display_name: 'Emerald Professional',
    description: 'Deep forest green and emerald',
    is_dark: false,
    colors: { primary: '#064E3B', secondary: '#059669', accent: '#10B981', bg: '#F0FDF4', card: '#FFFFFF' },
  },
  {
    id: 'purple_gradient',
    display_name: 'Purple Gradient',
    description: 'Purple and lavender highlights',
    is_dark: false,
    colors: { primary: '#4C1D95', secondary: '#7C3AED', accent: '#C084FC', bg: '#FAF5FF', card: '#FFFFFF' },
  },
  {
    id: 'corporate_minimal',
    display_name: 'Corporate Minimal',
    description: 'Executive monochrome and blue',
    is_dark: false,
    colors: { primary: '#18181B', secondary: '#2563EB', accent: '#475569', bg: '#FAFAFA', card: '#FFFFFF' },
  },
  {
    id: 'dark_tech',
    display_name: 'Dark Technology',
    description: 'Dark slate with vibrant cyan accents',
    is_dark: true,
    colors: { primary: '#06B6D4', secondary: '#0EA5E9', accent: '#38BDF8', bg: '#0A0F1D', card: '#162036' },
  },
  {
    id: 'warm_creative',
    display_name: 'Warm Creative',
    description: 'Terracotta, tangerine, and amber',
    is_dark: false,
    colors: { primary: '#9A3412', secondary: '#EA580C', accent: '#D97706', bg: '#FFFBEB', card: '#FFFFFF' },
  },
  {
    id: 'clean_light',
    display_name: 'Clean Light',
    description: 'Crisp white, sky blue, and slate',
    is_dark: false,
    colors: { primary: '#0369A1', secondary: '#0284C7', accent: '#64748B', bg: '#F8FAFC', card: '#FFFFFF' },
  },
  // 6 New Dark Themes
  {
    id: 'midnight_blue',
    display_name: 'Midnight Blue',
    description: 'Deep midnight navy with electric blue',
    is_dark: true,
    colors: { primary: '#38BDF8', secondary: '#60A5FA', accent: '#93C5FD', bg: '#0B1120', card: '#1E293B' },
  },
  {
    id: 'cyber_neon',
    display_name: 'Cyber Neon',
    description: 'OLED pitch black with neon green',
    is_dark: true,
    colors: { primary: '#22C55E', secondary: '#4ADE80', accent: '#86EFAC', bg: '#09090B', card: '#18181B' },
  },
  {
    id: 'obsidian_gold',
    display_name: 'Obsidian Gold',
    description: 'Luxury obsidian with radiant metallic gold',
    is_dark: true,
    colors: { primary: '#D4AF37', secondary: '#F59E0B', accent: '#E2B842', bg: '#121214', card: '#1E1E24' },
  },
  {
    id: 'dark_purple',
    display_name: 'Dark Purple',
    description: 'Deep cosmic galaxy with neon amethyst',
    is_dark: true,
    colors: { primary: '#C084FC', secondary: '#A855F7', accent: '#E879F9', bg: '#13091F', card: '#201235' },
  },
  {
    id: 'graphite_pro',
    display_name: 'Graphite Pro',
    description: 'Monochrome carbon graphite with sky blue',
    is_dark: true,
    colors: { primary: '#38BDF8', secondary: '#71717A', accent: '#A1A1AA', bg: '#18181B', card: '#27272A' },
  },
  {
    id: 'deep_ocean',
    display_name: 'Deep Ocean',
    description: 'Abyssal oceanic teal with bioluminescent cyan',
    is_dark: true,
    colors: { primary: '#2DD4BF', secondary: '#38BDF8', accent: '#5EEAD4', bg: '#041B2D', card: '#0A2234' },
  },
];

export const LAYOUT_OPTIONS: LayoutOption[] = [
  {
    id: 'smart_mixed',
    name: 'Smart Adaptive Mix',
    display_name: 'Smart Mixed Layouts',
    badge: 'Recommended',
    description: 'Intelligently alternates cards, dual columns, metrics, and diagrams across slides.',
    icon: 'sparkles',
  },
  {
    id: 'cards_grid',
    name: 'Cards & Grid Layout',
    display_name: 'Cards & Grid Layout',
    badge: 'Structured',
    description: 'Arranges takeaways into structured multi-card modular containers with top accent bars.',
    icon: 'grid',
  },
  {
    id: 'two_column',
    name: 'Two-Column Comparison',
    display_name: 'Two-Column Comparison',
    badge: 'Balanced',
    description: 'Presents concepts in dual side-by-side columns with header tags and contrasting accents.',
    icon: 'columns',
  },
  {
    id: 'visual_flow',
    name: 'Process Flow & Timeline',
    display_name: 'Process Flow & Timeline',
    badge: 'Sequential',
    description: 'Maximizes sequential step-by-step flowcharts, milestones, and chronological diagrams.',
    icon: 'git-commit',
  },
  {
    id: 'stats_metrics',
    name: 'Statistics & Key Metrics',
    display_name: 'Statistics & Key Metrics',
    badge: 'High Impact',
    description: 'Emphasizes large bold numeric metrics, KPI stat callouts, and highlighted impact points.',
    icon: 'bar-chart-2',
  },
  {
    id: 'classic_bullets',
    name: 'Title & Bullet Content',
    display_name: 'Title & Bullet Content',
    badge: 'Classic',
    description: 'Clean presentation with bolded term prefixes in an elegant full-width container card.',
    icon: 'list',
  },
];

const SAMPLE_LECTURE_NOTES = `# Artificial Intelligence: Transforming the Modern World
Comprehensive Curriculum & Faculty Lecture Notes — Acadion Educational Series

## Section 1: Introduction to Artificial Intelligence & Modern Intelligence Systems
- Definition: Computational systems engineered to perform cognitive tasks traditionally requiring human intelligence
- Core Capabilities: Adaptive learning from experience, structured reasoning, contextual comprehension, and self-correction
- Perception & Sensing: Ingesting high-dimensional multimodal telemetry including text, video, speech, and sensor streams
- The Augmentation Imperative: Enhancing human decision-making, productivity, and analytical velocity rather than replacement
- System Classification: Narrow AI (specialized task automation) versus hypothetical Artificial General Intelligence (AGI)
[Speaker Notes]: Welcome students to Section 1. Emphasize that modern AI is fundamentally an empirical discipline driven by data, compute, and statistical optimization. Clarify the boundary between narrow task-oriented AI and theoretical AGI, stressing that all production models today operate in bounded problem domains.

## Section 2: Historical Evolution & Foundational Milestones
- 1950: Alan Turing formulates the Imitation Game (Turing Test) establishing operational criteria for machine cognition
- 1956: John McCarthy, Marvin Minsky, and Claude Shannon convene the Dartmouth Summer Research Project on Artificial Intelligence
- 1965-1974: The First Golden Era and subsequent First AI Winter following the ALPAC report and Lighthill critique
- 1997: IBM Deep Blue defeats world chess champion Garry Kasparov using heuristic alpha-beta tree search
- 2012: AlexNet achieves landslide victory in ImageNet Large Scale Visual Recognition Challenge using GPU-accelerated CNNs
- 2017: Vaswani et al. introduce Transformer self-attention architecture, revolutionizing sequence modeling across domains
- 2020-Present: Scaling of Foundation Models, generative diffusion networks, and multimodal reasoning systems
[Speaker Notes]: Trace the cyclical history of AI through breakthroughs and winters. Note how the convergence of three independent vectors in 2012—massive labeled datasets (ImageNet), GPU acceleration, and deep architectures—ended decades of stagnation and launched modern deep learning.

## Section 3: Core Paradigms: Classical Machine Learning vs Deep Learning
- Classical ML: Relies on manual domain feature engineering, structured tabular data, and explicit heuristic pipelines
- Classical Algorithms: Linear/logistic regression, support vector machines, decision trees, random forests, and gradient boosting
- Deep Learning: Multi-layered artificial neural networks performing automated hierarchical representation learning from raw data
- Data Scalability: Classical ML performance asymptotically plateaus; Deep Learning performance continues scaling with compute and volume
- Computational Footprint: Classical ML trains in minutes on CPUs; Deep Learning demands distributed GPU clusters and tensor processing units
- Interpretability Tradeoff: Classical models offer transparent parameter weights; deep networks present complex high-dimensional representations
[Speaker Notes]: Contrast the paradigm shift on the chalkboard. In classical engineering: Input + Handcrafted Features -> Algorithm -> Output. In deep learning: Raw Input -> Hierarchical Hidden Layers (Edges -> Shapes -> Semantic Concepts) -> Output. Discuss the interpretability cost of this shift.

## Section 4: Deep Neural Architectures & Transformer Mechanics
- Feedforward Neural Networks: Multi-Layer Perceptrons (MLPs) with non-linear activation functions (ReLU, GELU, SwiGLU)
- Convolutional Neural Networks (CNNs): Spatial weight sharing and translation invariance for grid-like data and computer vision
- Recurrent Architectures (RNN/LSTM): Sequential state persistence, historically constrained by vanishing and exploding gradients
- Transformer Self-Attention: Pairwise token relevance computation via Query, Key, and Value projection dot products
- Multi-Head Attention: Enabling simultaneous attend-and-extract operations across diverse representational subspaces
- Positional Encoding: Injecting sequential spatial/temporal order into parallelized token matrices without recurrent bottlenecks
[Speaker Notes]: Deep dive into the Transformer equation: Attention(Q, K, V) = softmax(QK^T / sqrt(d_k)) * V. Explain why parallelizability during GPU matrix multiplication made recurrent architectures obsolete for modern foundation models.

## Section 5: Natural Language Processing & Large Language Models
- Text Tokenization: Subword decomposition algorithms including Byte-Pair Encoding (BPE), WordPiece, and SentencePiece
- Pretraining Paradigm: Unsupervised self-supervised learning predicting masked tokens or next-token continuation across web-scale corpora
- Alignment & Tuning: Supervised Fine-Tuning (SFT) combined with Reinforcement Learning from Human Feedback (RLHF/DPO)
- Emergent Capabilities: In-context few-shot learning, chain-of-thought mathematical reasoning, and zero-shot task generalization
- Retrieval-Augmented Generation (RAG): Grounding parametric model knowledge with external vector databases and dynamic search indices
- Agentic Workflows: Multi-step planning, tool utilization, API execution, and iterative reflection in software environments
[Speaker Notes]: Explain that LLMs are not static encyclopedias; they are probabilistic sequence predictors. Highlight how RAG bridges the gap between static model weights and fresh, private enterprise knowledge while dramatically curbing hallucinations.

## Section 6: Computer Vision, Spatial Perception & Autonomous Systems
- Object Detection & Localization: Identifying semantic bounding boxes and class probabilities via YOLO and Faster R-CNN
- Semantic & Instance Segmentation: Pixel-level classification distinguishing individual overlapping objects in real-time
- Generative Vision: Latent diffusion models and neural radiance fields (NeRFs) synthesizing 3D geometry from 2D photographs
- Perception Pipelines: Sensor fusion fusing LiDAR point clouds, radar Doppler signatures, and multi-camera stereo disparity
- Autonomous Navigation: Simultaneous Localization and Mapping (SLAM) paired with Model Predictive Control (MPC) trajectory planning
- Edge Deployment: Model quantization (INT8/FP4), pruning, and neural compilation for low-power automotive silicon
[Speaker Notes]: Discuss the stringent latency and safety requirements in autonomous vehicles. Emphasize that while a 99% accuracy rate is acceptable in web search, it is catastrophic in high-speed vehicular obstacle avoidance, necessitating multi-sensor redundancy.

## Section 7: Transformative Applications in Healthcare, Science & Education
- Molecular Biology: AlphaFold predicting 3D protein structures from amino acid sequences, solving a 50-year grand challenge
- Medical Imaging Diagnostics: AI assistance detecting early oncological anomalies in CT scans, MRIs, and histopathology slides
- Genomic Sequencing: Identifying disease-associated gene variants and personalizing oncology immunotherapies
- Climate Modeling: Physics-informed neural networks simulating severe storm patterns and long-term climate dynamics at fraction of HPC cost
- Adaptive Learning Systems: Personalized educational pacing, dynamic difficulty adjustments, and individualized pedagogical tutoring
- Automated Formative Feedback: Providing instantaneous contextual hints on programming assignments and technical essays
[Speaker Notes]: Highlight AlphaFold as the premier example of AI driving fundamental scientific discovery. In education, discuss how AI tutors can democratize 1-on-1 tutoring at global scale while empowering teachers to focus on mentorship and critical discussions.

## Section 8: Sociotechnical Challenges: Ethics, Bias, Transparency & Governance
- Algorithmic Bias: Models encoding and amplifying historical societal prejudices embedded within uncurated training data
- Explainability & Interpretability: Developing mechanistic interpretability tools to inspect inner activations of frontier models
- Intellectual Property & Attribution: Navigating copyright boundaries surrounding training on human creative works
- Environmental Sustainability: Managing gigawatt energy consumption, carbon footprints, and water cooling of hyperscale data centers
- Disinformation & Deepfakes: Safeguarding civic information integrity against synthetic media generation and automated influence campaigns
- Regulatory Frameworks: The EU AI Act, US Executive Orders, and emerging international safety consensus standards
[Speaker Notes]: Guide students through the ethical dilemma of training data curation. Discuss how bias in clinical predictive algorithms can lead to disparate health outcomes, and why multidisciplinary oversight involving sociologists and ethicists is non-negotiable.

## Section 9: The Future Landscape: Human-AI Teaming & Next-Gen Intelligence
- Human-in-the-Loop Teaming: Centaur models where domain specialists orchestrate, verify, and steer AI-generated draft artifacts
- Multimodal Foundation Systems: Seamless cross-modal reasoning binding vision, natural language, spatial audio, and robotic telemetry
- Neurosymbolic Integration: Fusing statistical pattern recognition with formal symbolic logic for rigorous mathematical proofs
- Efficient On-Device AI: Small Language Models (SLMs) running locally with privacy-first zero-cloud data leakage
- Autonomous Scientific Discovery: Closed-loop self-driving wet laboratories where AI designs, executes, and analyzes biochemical experiments
- Long-Horizon Agent Alignment: Ensuring increasingly autonomous agentic systems remain reliably tethered to human intent and safety protocols
[Speaker Notes]: Paint a balanced, rigorous vision of the future. The most effective professionals will not be replaced by AI, but rather by professionals who master collaborative Human-AI symbiosis. Highlight neurosymbolic architectures as the next major research frontier.

## Section 10: Discussion Questions & Curriculum Review Exercises
- Core Architecture: How does the self-attention mechanism overcome the sequential computational bottleneck of traditional RNNs?
- Engineering Tradeoffs: Under what specific clinical or financial conditions should engineers choose classical ML over deep neural networks?
- Epistemological Limits: Can synthetic data alone train future foundation models without succumbing to model collapse?
- Societal Governance: How can international regulatory frameworks balance technical innovation against catastrophic safety risks?
- Practical Exercise: Design a high-level system architecture for an AI-assisted diagnostic assistant with strict privacy and RAG verification
[Speaker Notes]: Open the floor to student debate. Divide the class into two cohorts to debate the synthetic data dilemma and model collapse. Use the practical design exercise as the basis for the upcoming capstone presentation project.`;

/**
 * Renders a crisp 16:9 local sample slide thumbnail for a theme.
 * Runs 100% locally with zero external API calls.
 */
export function ThemeSlideThumbnail({ theme, isSelected }: { theme: ThemeOption; isSelected: boolean }) {
  const isDark = theme.is_dark;
  const cardBorder = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)';
  const bodyTextColor = isDark ? '#E2E8F0' : '#475569';
  const mutedTextColor = isDark ? '#94A3B8' : '#64748B';

  return (
    <div className={`theme-thumb-frame ${isSelected ? 'selected' : ''}`}>
      <svg
        viewBox="0 0 320 180"
        className="theme-sample-svg"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Slide 16:9 Canvas */}
        <rect width="320" height="180" rx="8" fill={theme.colors.bg} />

        {/* Top Accent Line */}
        <rect x="0" y="0" width="320" height="4" fill={theme.colors.accent} />

        {/* Slide Category Header Tag */}
        <rect
          x="20"
          y="18"
          width="64"
          height="10"
          rx="3"
          fill={theme.colors.primary}
          fillOpacity={isDark ? 0.35 : 0.15}
        />
        <rect x="25" y="21" width="40" height="4" rx="2" fill={theme.colors.primary} />

        {/* Slide Title */}
        <text
          x="20"
          y="44"
          fill={theme.colors.primary}
          fontSize="13"
          fontWeight="700"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          Transforming Modern AI
        </text>

        {/* Title Accent Bar */}
        <rect x="20" y="50" width="36" height="2.5" rx="1.25" fill={theme.colors.accent} />

        {/* Content Card 1 (Structured Takeaways) */}
        <rect
          x="20"
          y="62"
          width="134"
          height="88"
          rx="6"
          fill={theme.colors.card}
          stroke={cardBorder}
          strokeWidth="1"
        />
        <rect x="20" y="62" width="134" height="3.5" rx="2" fill={theme.colors.secondary} />
        <rect x="30" y="73" width="70" height="6" rx="2" fill={theme.colors.primary} />

        {/* Bullets */}
        <circle cx="34" cy="91" r="2.5" fill={theme.colors.accent} />
        <rect x="41" y="88.5" width="98" height="5" rx="1.5" fill={bodyTextColor} />

        <circle cx="34" cy="106" r="2.5" fill={theme.colors.accent} />
        <rect x="41" y="103.5" width="82" height="5" rx="1.5" fill={mutedTextColor} />

        <circle cx="34" cy="121" r="2.5" fill={theme.colors.accent} />
        <rect x="41" y="118.5" width="90" height="5" rx="1.5" fill={mutedTextColor} />

        {/* Content Card 2 (Metrics & Key Insight) */}
        <rect
          x="166"
          y="62"
          width="134"
          height="88"
          rx="6"
          fill={theme.colors.card}
          stroke={cardBorder}
          strokeWidth="1"
        />
        <rect x="166" y="62" width="134" height="3.5" rx="2" fill={theme.colors.accent} />
        <rect x="176" y="73" width="60" height="6" rx="2" fill={theme.colors.primary} />

        <text
          x="176"
          y="103"
          fill={theme.colors.secondary}
          fontSize="20"
          fontWeight="800"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          98.4%
        </text>
        <rect x="176" y="113" width="92" height="4.5" rx="1.5" fill={mutedTextColor} />
        <rect
          x="176"
          y="125"
          width="114"
          height="5"
          rx="2.5"
          fill={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
        />
        <rect x="176" y="125" width="88" height="5" rx="2.5" fill={theme.colors.secondary} />

        {/* Footer Area */}
        <text
          x="20"
          y="166"
          fill={mutedTextColor}
          fontSize="7"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          Acadion Widescreen Series
        </text>
        <rect
          x="272"
          y="157"
          width="28"
          height="11"
          rx="3"
          fill={theme.colors.primary}
          fillOpacity={isDark ? 0.35 : 0.12}
        />
        <text
          x="286"
          y="165"
          fill={theme.colors.primary}
          fontSize="7"
          fontWeight="700"
          textAnchor="middle"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          16:9
        </text>
      </svg>
      {isSelected && (
        <div className="theme-selected-badge">
          <CheckCircle2 size={16} />
        </div>
      )}
    </div>
  );
}

/**
 * Renders an architectural 16:9 layout diagram wireframe.
 */
export function LayoutMiniDiagram({ layoutId, isSelected }: { layoutId: string; isSelected: boolean }) {
  const accent = isSelected ? 'var(--royal-blue)' : '#64748B';
  const cardFill = isSelected ? '#EFF6FF' : '#F8FAFC';
  const cardStroke = isSelected ? '#BFDBFE' : '#CBD5E1';

  return (
    <div className={`layout-thumb-frame ${isSelected ? 'selected' : ''}`}>
      <svg
        viewBox="0 0 160 90"
        className="layout-sample-svg"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect width="160" height="90" rx="5" fill="#FFFFFF" stroke={cardStroke} strokeWidth="1" />
        <rect x="10" y="8" width="55" height="6" rx="2" fill={accent} />
        <rect x="10" y="16" width="20" height="2" rx="1" fill="#94A3B8" />

        {layoutId === 'smart_mixed' && (
          <g>
            <rect x="10" y="24" width="65" height="28" rx="3" fill={cardFill} stroke={cardStroke} strokeWidth="0.8" />
            <rect x="10" y="24" width="65" height="2" rx="1" fill={accent} />
            <rect x="15" y="30" width="30" height="3" rx="1" fill="#475569" />
            <rect x="15" y="37" width="50" height="2" rx="1" fill="#94A3B8" />
            <rect x="15" y="43" width="40" height="2" rx="1" fill="#94A3B8" />

            <rect x="10" y="56" width="65" height="26" rx="3" fill={cardFill} stroke={cardStroke} strokeWidth="0.8" />
            <rect x="10" y="56" width="65" height="2" rx="1" fill={accent} />
            <rect x="15" y="62" width="25" height="3" rx="1" fill="#475569" />
            <rect x="15" y="69" width="45" height="2" rx="1" fill="#94A3B8" />

            <rect x="83" y="24" width="67" height="58" rx="3" fill={cardFill} stroke={cardStroke} strokeWidth="0.8" />
            <rect x="83" y="24" width="67" height="2" rx="1" fill={accent} />
            <text x="91" y="44" fill={accent} fontSize="14" fontWeight="bold">92%</text>
            <rect x="91" y="50" width="50" height="2.5" rx="1" fill="#64748B" />
            <rect x="91" y="57" width="40" height="2" rx="1" fill="#94A3B8" />
            <circle cx="95" cy="69" r="3" fill={accent} />
            <rect x="103" y="67" width="35" height="3" rx="1" fill="#475569" />
          </g>
        )}

        {layoutId === 'cards_grid' && (
          <g>
            <rect x="10" y="24" width="66" height="28" rx="3" fill={cardFill} stroke={cardStroke} strokeWidth="0.8" />
            <rect x="10" y="24" width="66" height="2" rx="1" fill={accent} />
            <rect x="14" y="30" width="25" height="3" rx="1" fill="#475569" />
            <rect x="14" y="37" width="52" height="2" rx="1" fill="#94A3B8" />
            <rect x="14" y="43" width="42" height="2" rx="1" fill="#94A3B8" />

            <rect x="84" y="24" width="66" height="28" rx="3" fill={cardFill} stroke={cardStroke} strokeWidth="0.8" />
            <rect x="84" y="24" width="66" height="2" rx="1" fill={accent} />
            <rect x="88" y="30" width="25" height="3" rx="1" fill="#475569" />
            <rect x="88" y="37" width="52" height="2" rx="1" fill="#94A3B8" />
            <rect x="88" y="43" width="42" height="2" rx="1" fill="#94A3B8" />

            <rect x="10" y="56" width="66" height="26" rx="3" fill={cardFill} stroke={cardStroke} strokeWidth="0.8" />
            <rect x="10" y="56" width="66" height="2" rx="1" fill={accent} />
            <rect x="14" y="62" width="25" height="3" rx="1" fill="#475569" />
            <rect x="14" y="69" width="48" height="2" rx="1" fill="#94A3B8" />

            <rect x="84" y="56" width="66" height="26" rx="3" fill={cardFill} stroke={cardStroke} strokeWidth="0.8" />
            <rect x="84" y="56" width="66" height="2" rx="1" fill={accent} />
            <rect x="88" y="62" width="25" height="3" rx="1" fill="#475569" />
            <rect x="88" y="69" width="48" height="2" rx="1" fill="#94A3B8" />
          </g>
        )}

        {layoutId === 'two_column' && (
          <g>
            <rect x="10" y="24" width="66" height="58" rx="3" fill={cardFill} stroke={cardStroke} strokeWidth="0.8" />
            <rect x="10" y="24" width="66" height="2.5" rx="1" fill={accent} />
            <rect x="16" y="31" width="30" height="3.5" rx="1" fill={accent} />
            <rect x="16" y="40" width="50" height="2.5" rx="1" fill="#475569" />
            <rect x="16" y="48" width="54" height="2.5" rx="1" fill="#94A3B8" />
            <rect x="16" y="56" width="44" height="2.5" rx="1" fill="#94A3B8" />
            <rect x="16" y="64" width="48" height="2.5" rx="1" fill="#94A3B8" />

            <rect x="84" y="24" width="66" height="58" rx="3" fill={cardFill} stroke={cardStroke} strokeWidth="0.8" />
            <rect x="84" y="24" width="66" height="2.5" rx="1" fill={accent} />
            <rect x="90" y="31" width="30" height="3.5" rx="1" fill={accent} />
            <rect x="90" y="40" width="50" height="2.5" rx="1" fill="#475569" />
            <rect x="90" y="48" width="54" height="2.5" rx="1" fill="#94A3B8" />
            <rect x="90" y="56" width="44" height="2.5" rx="1" fill="#94A3B8" />
            <rect x="90" y="64" width="48" height="2.5" rx="1" fill="#94A3B8" />
          </g>
        )}

        {layoutId === 'visual_flow' && (
          <g>
            <circle cx="28" cy="46" r="12" fill={cardFill} stroke={accent} strokeWidth="1.5" />
            <text x="28" y="50" fill={accent} fontSize="10" fontWeight="bold" textAnchor="middle">1</text>
            <rect x="16" y="64" width="24" height="3" rx="1" fill="#475569" />
            <rect x="14" y="70" width="28" height="2" rx="1" fill="#94A3B8" />

            <line x1="44" y1="46" x2="64" y2="46" stroke={accent} strokeWidth="1.5" strokeDasharray="2 2" />

            <circle cx="80" cy="46" r="12" fill={cardFill} stroke={accent} strokeWidth="1.5" />
            <text x="80" y="50" fill={accent} fontSize="10" fontWeight="bold" textAnchor="middle">2</text>
            <rect x="68" y="64" width="24" height="3" rx="1" fill="#475569" />
            <rect x="66" y="70" width="28" height="2" rx="1" fill="#94A3B8" />

            <line x1="96" y1="46" x2="116" y2="46" stroke={accent} strokeWidth="1.5" strokeDasharray="2 2" />

            <circle cx="132" cy="46" r="12" fill={cardFill} stroke={accent} strokeWidth="1.5" />
            <text x="132" y="50" fill={accent} fontSize="10" fontWeight="bold" textAnchor="middle">3</text>
            <rect x="120" y="64" width="24" height="3" rx="1" fill="#475569" />
            <rect x="118" y="70" width="28" height="2" rx="1" fill="#94A3B8" />
          </g>
        )}

        {layoutId === 'stats_metrics' && (
          <g>
            <rect x="10" y="24" width="42" height="58" rx="3" fill={cardFill} stroke={cardStroke} strokeWidth="0.8" />
            <text x="31" y="46" fill={accent} fontSize="13" fontWeight="bold" textAnchor="middle">10x</text>
            <rect x="16" y="54" width="30" height="2.5" rx="1" fill="#475569" />
            <rect x="15" y="60" width="32" height="2" rx="1" fill="#94A3B8" />

            <rect x="59" y="24" width="42" height="58" rx="3" fill={cardFill} stroke={cardStroke} strokeWidth="0.8" />
            <text x="80" y="46" fill={accent} fontSize="13" fontWeight="bold" textAnchor="middle">98%</text>
            <rect x="65" y="54" width="30" height="2.5" rx="1" fill="#475569" />
            <rect x="64" y="60" width="32" height="2" rx="1" fill="#94A3B8" />

            <rect x="108" y="24" width="42" height="58" rx="3" fill={cardFill} stroke={cardStroke} strokeWidth="0.8" />
            <text x="129" y="46" fill={accent} fontSize="13" fontWeight="bold" textAnchor="middle">0.2s</text>
            <rect x="114" y="54" width="30" height="2.5" rx="1" fill="#475569" />
            <rect x="113" y="60" width="32" height="2" rx="1" fill="#94A3B8" />
          </g>
        )}

        {layoutId === 'classic_bullets' && (
          <g>
            <rect x="10" y="24" width="140" height="58" rx="3" fill={cardFill} stroke={cardStroke} strokeWidth="0.8" />
            <circle cx="20" cy="36" r="2.5" fill={accent} />
            <rect x="27" y="34" width="26" height="3.5" rx="1" fill={accent} />
            <rect x="56" y="34.5" width="86" height="2.5" rx="1" fill="#475569" />

            <circle cx="20" cy="48" r="2.5" fill={accent} />
            <rect x="27" y="46" width="32" height="3.5" rx="1" fill={accent} />
            <rect x="62" y="46.5" width="80" height="2.5" rx="1" fill="#475569" />

            <circle cx="20" cy="60" r="2.5" fill={accent} />
            <rect x="27" y="58" width="22" height="3.5" rx="1" fill={accent} />
            <rect x="52" y="58.5" width="90" height="2.5" rx="1" fill="#475569" />

            <circle cx="20" cy="72" r="2.5" fill={accent} />
            <rect x="27" y="70" width="36" height="3.5" rx="1" fill={accent} />
            <rect x="66" y="70.5" width="76" height="2.5" rx="1" fill="#475569" />
          </g>
        )}
      </svg>
      {isSelected && (
        <div className="layout-selected-badge">
          <Check size={14} />
        </div>
      )}
    </div>
  );
}

export default function TeacherPptGenerator() {
  const navigate = useNavigate();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [activeTab, setActiveTab] = useState<'text' | 'file'>('text');
  const [notesText, setNotesText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'deterministic' | 'ai'>('ai');
  const [selectedTheme, setSelectedTheme] = useState<string>('academic_navy');
  const [selectedLayout, setSelectedLayout] = useState<string>('smart_mixed');
  const [themeFilter, setThemeFilter] = useState<'all' | 'dark' | 'light' | 'custom'>('all');
  const [canFallbackRuleBased, setCanFallbackRuleBased] = useState(false);
  const [showQADetails, setShowQADetails] = useState(false);
  const [titleOverride, setTitleOverride] = useState('');
  const [subtitleOverride, setSubtitleOverride] = useState('');
  const [institutionOverride, setInstitutionOverride] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // External templates & Local PPTX import state
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateModalTab, setTemplateModalTab] = useState<'external' | 'import'>('external');
  const [importingTemplate, setImportingTemplate] = useState(false);
  const [templateInspectionReport, setTemplateInspectionReport] = useState<TemplateAnalysis | null>(null);
  const [importedThemeId, setImportedThemeId] = useState<string | null>(null);
  const [availableThemes, setAvailableThemes] = useState<ThemeOption[]>(THEME_OPTIONS);

  // Generation status and timing
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [generationDuration, setGenerationDuration] = useState<number | null>(null);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);
  const [result, setResult] = useState<PresentationResult | null>(null);

  // Slide viewing and editing state
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'visual' | 'plan'>('visual');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedSlides, setEditedSlides] = useState<SlidePreview[]>([]);
  const [expandedNotes, setExpandedNotes] = useState<Record<number, boolean>>({});
  const [imageError, setImageError] = useState<Record<number, boolean>>({});
  const [isVisualEditorOpen, setIsVisualEditorOpen] = useState(false);
  const [activeEditorFileId, setActiveEditorFileId] = useState<string | null>(null);
  const [appWorkflowMode, setAppWorkflowMode] = useState<'single' | 'multipart'>('single');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const templateFileInputRef = useRef<HTMLInputElement>(null);
  const filmstripRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<any>(null);
  const themeGalleryRef = useRef<HTMLDivElement>(null);
  const layoutGalleryRef = useRef<HTMLDivElement>(null);

  const filteredThemes = availableThemes.filter((t) => {
    if (themeFilter === 'dark') return t.is_dark;
    if (themeFilter === 'light') return !t.is_dark && !t.is_custom;
    if (themeFilter === 'custom') return t.is_custom;
    return true;
  });

  const handleSelectMode = (newMode: 'deterministic' | 'ai') => {
    setMode(newMode);
    if (newMode === 'deterministic') {
      if (!selectedTheme || selectedTheme === 'auto') {
        setSelectedTheme('academic_navy');
      }
      if (!selectedLayout || selectedLayout === 'auto') {
        setSelectedLayout('smart_mixed');
      }
    }
  };

  // Check backend health and fetch dynamic themes on mount
  useEffect(() => {
    // Check if a fileId or editorFileId is passed in the URL to open VisualEditor directly
    const params = new URLSearchParams(window.location.search);
    const fileIdParam = params.get('fileId') || params.get('editorFileId');
    if (fileIdParam) {
      setResult({
        file_id: fileIdParam,
        download_url: `/api/download/${fileIdParam}`,
        slide_count: 1,
        generation_time_ms: 0,
        mode: 'deterministic',
        theme: 'academic_navy',
        layout_style: 'smart_mixed',
        title: 'Loaded Presentation',
        slides: [],
        raw_llm_response: null,
      } as any);
      setIsVisualEditorOpen(true);
    }

    fetch('/health')
      .then((res) => res.json())
      .then((data: HealthStatus) => {
        setHealth(data);
        if (data.ai_configured) {
          setMode('ai');
        } else {
          setMode('deterministic');
        }
      })
      .catch(() => {
        setHealth(null);
      });

    // Fetch theme registry from backend to pick up imported custom themes
    fetch('/api/themes')
      .then((res) => res.json())
      .then((data: any[]) => {
        if (Array.isArray(data) && data.length > 0) {
          const mapped: ThemeOption[] = data.map((t) => ({
            id: t.id,
            display_name: t.display_name,
            description: t.description,
            is_dark: Boolean(t.is_dark),
            is_custom: t.id.startsWith('custom_') || t.id.startsWith('imported_'),
            colors: {
              primary: t.colors.primary,
              secondary: t.colors.secondary,
              accent: t.colors.accent,
              bg: t.colors.bg,
              card: t.colors.card,
            },
          }));
          setAvailableThemes(mapped);
        }
      })
      .catch(() => {
        // Fall back to THEME_OPTIONS default
      });
  }, []);

  // Keyboard navigation for visual slide viewer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (!result || !result.slides || result.slides.length === 0) return;

      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        setCurrentSlideIndex((prev) => (prev < result.slides.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        setCurrentSlideIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [result]);

  // Scroll active thumbnail into view
  useEffect(() => {
    if (filmstripRef.current) {
      const activeThumb = filmstripRef.current.children[currentSlideIndex] as HTMLElement;
      if (activeThumb) {
        activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [currentSlideIndex]);

  // Timer ticker during generation
  useEffect(() => {
    if (loading) {
      setElapsedSeconds(0);
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Number(((Date.now() - startTime) / 1000).toFixed(1)));
      }, 100);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading]);

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    setError(null);
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    const validExtensions = ['.txt', '.pdf', '.docx'];

    if (!validExtensions.includes(ext)) {
      setError({
        message: `Unsupported file type "${ext}".`,
        hint: 'Acadion supports .txt, .pdf, and .docx documents.',
      });
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setError({
        message: `File size exceeds the 20 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
        hint: 'Please split your lecture notes into smaller files.',
      });
      return;
    }

    setSelectedFile(file);
  };

  const handleGenerate = async (
    overrideMode?: 'deterministic' | 'ai'
  ) => {
    const activeMode = overrideMode || mode;
    setError(null);
    setCanFallbackRuleBased(false);
    setLoading(true);
    setLoadingStage('Ingesting curriculum notes & validating content...');
    const startTime = Date.now();

    const themeToSend = selectedTheme || 'academic_navy';
    const layoutToSend = selectedLayout || 'smart_mixed';

    const formData = new FormData();
    formData.append('mode', activeMode);
    formData.append('theme', themeToSend);
    formData.append('layout_style', layoutToSend);
    formData.append('provider', 'native');
    if (titleOverride.trim()) {
      formData.append('title_override', titleOverride.trim());
    }
    if (subtitleOverride.trim()) {
      formData.append('subtitle_override', subtitleOverride.trim());
    }
    if (institutionOverride.trim()) {
      formData.append('institution_override', institutionOverride.trim());
    }

    if (activeTab === 'file') {
      if (!selectedFile) {
        setError({ message: 'Please select a document file (.txt, .pdf, .docx) to upload.' });
        setLoading(false);
        return;
      }
      formData.append('file', selectedFile);
    } else {
      if (!notesText.trim()) {
        setError({ message: 'Please enter or paste educational notes to generate slides.' });
        setLoading(false);
        return;
      }
      formData.append('notes_text', notesText.trim());
    }

    try {
      setTimeout(() => setLoadingStage('Analyzing pedagogical objectives & composing slides...'), 600);
      setTimeout(() => setLoadingStage('Generating native widescreen shapes, diagrams & speaker notes...'), 1400);
      setTimeout(() => setLoadingStage('Evaluating presentation quality assurance (QA) metrics...'), 2400);

      const response = await fetch('/api/generate', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.can_fallback_rule_based || activeMode === 'ai') {
          setCanFallbackRuleBased(true);
        }
        throw new Error(data.detail || data.error || 'Failed to generate presentation');
      }

      const totalTime = Number(((Date.now() - startTime) / 1000).toFixed(2));
      setGenerationDuration(totalTime);
      setResult(data);
      if (data.theme) {
        setSelectedTheme(data.theme);
      }
      if (data.layout_style) {
        setSelectedLayout(data.layout_style);
      }
      setEditedSlides(JSON.parse(JSON.stringify(data.slides)));
      setCurrentSlideIndex(0);
      setViewMode('visual');
      setIsEditing(false);
      setImageError({});
    } catch (err: any) {
      setError({
        message: err.message || 'An unexpected error occurred during generation.',
        hint: err.hint,
      });
      if (activeMode === 'ai') {
        setCanFallbackRuleBased(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchTheme = async (newThemeId: string) => {
    setSelectedTheme(newThemeId);
    if (!result) return;

    setLoading(true);
    const themeObj = availableThemes.find((t) => t.id === newThemeId);
    setLoadingStage(`Applying "${themeObj?.display_name || newThemeId}" theme and re-rendering slides...`);
    setError(null);

    try {
      const res = await fetch('/api/retheme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: result.file_id,
          theme: newThemeId,
          layout_style: result.layout_style || selectedLayout,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to switch presentation theme.');
      }

      setResult(data);
      setEditedSlides(JSON.parse(JSON.stringify(data.slides)));
      setImageError({});
    } catch (err: any) {
      setError({ message: err.message || 'Failed to apply theme to presentation.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchLayout = async (newLayoutId: string) => {
    setSelectedLayout(newLayoutId);
    if (!result) return;

    setLoading(true);
    const layoutObj = LAYOUT_OPTIONS.find((l) => l.id === newLayoutId);
    setLoadingStage(`Re-architecting presentation with "${layoutObj?.name || newLayoutId}" layouts...`);
    setError(null);

    try {
      const res = await fetch('/api/retheme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: result.file_id,
          theme: result.theme || selectedTheme,
          layout_style: newLayoutId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to re-layout presentation.');
      }

      setResult(data);
      setEditedSlides(JSON.parse(JSON.stringify(data.slides)));
      setImageError({});
    } catch (err: any) {
      setError({ message: err.message || 'Failed to apply new layout to presentation.' });
    } finally {
      setLoading(false);
    }
  };

  const handleImportTemplate = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pptx')) {
      setError({ message: 'Template file must be a Microsoft PowerPoint (.pptx) file.' });
      return;
    }

    setImportingTemplate(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/templates/import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to inspect and import PowerPoint template.');
      }

      setTemplateInspectionReport(data.analysis);
      setImportedThemeId(data.theme_id);

      // Add new imported theme to availableThemes if not already present
      const importedTheme: ThemeOption = {
        id: data.theme.id,
        display_name: data.theme.display_name,
        description: data.theme.description,
        is_dark: data.theme.is_dark,
        is_custom: true,
        colors: {
          primary: data.theme.colors.primary,
          secondary: data.theme.colors.secondary,
          accent: data.theme.colors.accent,
          bg: data.theme.colors.bg,
          card: data.theme.colors.card,
        },
      };

      setAvailableThemes((prev) => {
        const filtered = prev.filter((t) => t.id !== importedTheme.id);
        return [importedTheme, ...filtered];
      });

      setSelectedTheme(data.theme_id);

      if (result) {
        handleSwitchTheme(data.theme_id);
      }
    } catch (err: any) {
      setError({ message: err.message || 'Failed to import PowerPoint template.' });
    } finally {
      setImportingTemplate(false);
    }
  };

  const handleSaveEditsAndRegenerate = async () => {
    if (!result) return;
    setError(null);
    setLoading(true);
    setLoadingStage('Regenerating PowerPoint and rendering updated visual slides...');

    try {
      const payload = {
        title: result.title,
        subtitle: result.subtitle,
        theme: result.theme || selectedTheme,
        layout_style: result.layout_style || selectedLayout,
        slides: editedSlides.slice(1).map((s) => ({
          title: s.title,
          bullets: s.bullets.map((b) => ({ prefix: b.prefix, text: b.text })),
          speaker_notes: s.speaker_notes || '',
        })),
      };

      const res = await fetch('/api/generate-from-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to regenerate presentation from edited plan.');
      }

      setResult(data);
      if (data.theme) {
        setSelectedTheme(data.theme);
      }
      setEditedSlides(JSON.parse(JSON.stringify(data.slides)));
      setIsEditing(false);
      setViewMode('visual');
      setCurrentSlideIndex((prev) => Math.min(prev, data.slides.length - 1));
      setImageError({});
    } catch (err: any) {
      setError({ message: err.message || 'Failed to save slide edits.' });
    } finally {
      setLoading(false);
    }
  };

  const toggleSpeakerNotes = (idx: number) => {
    setExpandedNotes((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getVisualBadge = (vtype?: string) => {
    if (!vtype || vtype === 'none') return null;
    const labels: Record<string, string> = {
      timeline: 'Timeline Diagram',
      comparison: 'Comparison Diagram',
      process_flow: 'Process Flowchart',
      concept_map: 'Concept Map',
      local_image: 'Illustrative Image',
    };
    return (
      <span className="slide-type-badge badge-diagram">
        {labels[vtype] || vtype.toUpperCase()}
      </span>
    );
  };


  const activeSlide: SlidePreview | null = result?.slides?.[currentSlideIndex] || null;
  const currentImageUrl = activeSlide?.image_url
    ? `${activeSlide.image_url}?t=${result?.file_id}`
    : result?.preview_urls?.[currentSlideIndex]
    ? `${result.preview_urls[currentSlideIndex]}?t=${result?.file_id}`
    : null;

  const currentThemeObj = availableThemes.find((t) => t.id === (result?.theme || selectedTheme)) || availableThemes[0];
  const currentLayoutObj = LAYOUT_OPTIONS.find((l) => l.id === (result?.layout_style || selectedLayout)) || LAYOUT_OPTIONS[0];

  return (
    <div className="teacher-ppt-wrapper">
      <Navbar />
      <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="brand-section">
            <div className="brand-icon">
              <Presentation size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.45rem' }}>
                <span className="brand-title">Acadion AI PPT Generator</span>
                <span className="brand-badge">Widescreen 16:9 Edition</span>
              </div>
              <div className="brand-subtitle">
                Professional PowerPoint Curriculum & Educational Deck Engine
              </div>
            </div>
          </div>

          <div className="header-actions">
            {/* Workflow Mode Tabs */}
            <div className="workflow-mode-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={appWorkflowMode === 'single'}
                className={`workflow-mode-tab ${appWorkflowMode === 'single' ? 'active' : ''}`}
                onClick={() => {
                  if (isVisualEditorOpen) setIsVisualEditorOpen(false);
                  setAppWorkflowMode('single');
                }}
              >
                <Presentation size={15} />
                <span>Single Presentation</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={appWorkflowMode === 'multipart'}
                className={`workflow-mode-tab ${appWorkflowMode === 'multipart' ? 'active' : ''}`}
                onClick={() => {
                  if (isVisualEditorOpen) setIsVisualEditorOpen(false);
                  setAppWorkflowMode('multipart');
                }}
              >
                <Layers size={15} />
                <span>Complete Notes → Multi-Part PPTs</span>
                <span className="workflow-tab-badge">Full Notes</span>
              </button>
            </div>

            <button
              type="button"
              className="templates-hub-btn"
              onClick={() => {
                setTemplateModalTab('external');
                setShowTemplateModal(true);
              }}
              title="Explore external templates and import custom PowerPoint decks"
            >
              <Palette size={15} />
              <span>Get More Themes & Templates</span>
              {importedThemeId && <span className="imported-indicator-dot" />}
            </button>

            <div className="status-chip">
              <div className={`status-dot ${health?.ai_configured ? '' : 'warning'}`} />
              <span>
                {health?.ai_configured
                  ? 'Automatic Engine Ready'
                  : 'Rule-based Engine Ready'}
              </span>
            </div>

          </div>
        </div>
      </header>

      {/* Main Container - Full Desktop Shell */}
      <main className="app-main">
        {isVisualEditorOpen && (activeEditorFileId || result?.file_id) ? (
          <VisualEditor
            fileId={(activeEditorFileId || result?.file_id)!}
            initialSlideIndex={currentSlideIndex}
            onBack={() => {
              setIsVisualEditorOpen(false);
              setActiveEditorFileId(null);
            }}
          />
        ) : appWorkflowMode === 'multipart' ? (
          <MultiPartWorkflow
            availableThemes={availableThemes}
            availableLayouts={LAYOUT_OPTIONS}
            aiConfigured={health?.ai_configured ?? false}
            onOpenVisualEditor={(fileId) => {
              setActiveEditorFileId(fileId);
              setIsVisualEditorOpen(true);
            }}
            onBackToSingle={() => setAppWorkflowMode('single')}
          />
        ) : !result ? (
          /* =====================================================================
             MICROSOFT POWERPOINT HOME -> NEW SCREEN (Full-Width Vertically Stacked)
             ===================================================================== */
          <div className="ppt-new-experience animate-fade-in">
            {/* PowerPoint Home Header Banner */}
            <div className="ppt-new-hero">
              <div className="ppt-hero-text">
                <h1 className="ppt-hero-title">New Presentation</h1>
                <p className="ppt-hero-subtitle">
                  Configure your curriculum presentation deck, select from 14 professional themes and architectural slide layout families, and generate 16:9 widescreen PowerPoint decks.
                </p>
              </div>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="alert alert-error animate-fade-in" role="alert">
                <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ flex: 1 }}>
                  <strong>{error.message}</strong>
                  {error.hint && <div className="alert-hint">{error.hint}</div>}
                  {canFallbackRuleBased && (
                    <div style={{ marginTop: '0.65rem' }}>
                      <button
                        type="button"
                        className="btn-fallback-rule-based"
                        onClick={() => {
                          setMode('deterministic');
                          handleGenerate('deterministic');
                        }}
                      >
                        <Zap size={15} />
                        <span>Generate with Rule-Based Engine Instead</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 1: Generation Engine & Mode (Top of Form) */}
            <section className="ppt-section-card">
              <div className="ppt-section-header">
                <div className="ppt-section-badge-row">
                  <span className="ppt-step-badge">1</span>
                  <div>
                    <h2 className="ppt-section-heading">Generation Engine & Mode</h2>
                    <p className="ppt-section-subheading">
                      Select your operational generation mode (Fully AI-Generated or Rule-Based).
                    </p>
                  </div>
                </div>
              </div>

              <div className="ppt-engine-grid">
                <div
                  className={`ppt-engine-card ${mode === 'ai' ? 'active' : ''} ${!health?.ai_configured ? 'disabled' : ''}`}
                  onClick={() => {
                    if (health?.ai_configured) handleSelectMode('ai');
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      if (health?.ai_configured) handleSelectMode('ai');
                    }
                  }}
                  title={health?.ai_configured ? 'AI automatically plans content, design, and speaker notes' : 'AI engine unavailable'}
                >
                  <div className="ppt-engine-card-header">
                    <div className="ppt-engine-icon-badge ai">
                      <Sparkles size={22} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="ppt-engine-title-row">
                        <span className="ppt-engine-name">Fully AI-Generated</span>
                        <span className="ppt-engine-badge recommended">Recommended</span>
                      </div>
                      <p className="ppt-engine-desc">
                        AI automatically plans teaching objectives, assigns varied visual compositions, applies your chosen theme and layout, and creates instructor speaker notes.
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  className={`ppt-engine-card ${mode === 'deterministic' ? 'active' : ''}`}
                  onClick={() => handleSelectMode('deterministic')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') handleSelectMode('deterministic');
                  }}
                >
                  <div className="ppt-engine-card-header">
                    <div className="ppt-engine-icon-badge deterministic">
                      <Zap size={22} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="ppt-engine-title-row">
                        <span className="ppt-engine-name">Rule-Based</span>
                        <span className="ppt-engine-badge offline">Fast & Offline</span>
                      </div>
                      <p className="ppt-engine-desc">
                        Instant deterministic structural formatting with manual choice of 14 presentation themes and 6 architectural slide layout families.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* STEP 2: Presentation Title */}
            <section className="ppt-section-card">
              <div className="ppt-section-header">
                <div className="ppt-section-badge-row">
                  <span className="ppt-step-badge">2</span>
                  <label htmlFor="title-override-input" className="ppt-section-heading">
                    Presentation Title
                  </label>
                </div>
                <span className="ppt-section-hint">Optional • Automatically detected from curriculum notes if left blank</span>
              </div>
              <div className="ppt-input-wrapper">
                <input
                  id="title-override-input"
                  type="text"
                  className="ppt-full-input"
                  placeholder="e.g. Artificial Intelligence: Transforming the Modern World"
                  value={titleOverride}
                  onChange={(e) => setTitleOverride(e.target.value)}
                  maxLength={100}
                />
              </div>
            </section>

            {/* STEP 3: Content Source */}
            <section className="ppt-section-card">
              <div className="ppt-section-header">
                <div className="ppt-section-badge-row">
                  <span className="ppt-step-badge">3</span>
                  <div>
                    <h2 className="ppt-section-heading">Content Source</h2>
                    <p className="ppt-section-subheading">
                      Paste your curriculum notes or upload a lecture document (.pdf, .docx, .txt).
                    </p>
                  </div>
                </div>
              </div>

              {/* Mode Tabs */}
              <div className="ppt-tabs-row" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'text'}
                  className={`ppt-tab-btn ${activeTab === 'text' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('text'); setError(null); }}
                >
                  <FileText size={16} />
                  <span>Pasted Curriculum Notes</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'file'}
                  className={`ppt-tab-btn ${activeTab === 'file' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('file'); setError(null); }}
                >
                  <Upload size={16} />
                  <span>Upload Document (.pdf, .docx, .txt)</span>
                </button>
              </div>

              {/* Tab 1: Pasted Textarea */}
              {activeTab === 'text' && (
                <div className="ppt-source-content">
                  <div className="textarea-wrapper">
                    <textarea
                      id="lecture-notes-input"
                      aria-label="Educational lecture notes"
                      className="lecture-textarea ppt-wide-textarea"
                      placeholder="Paste your curriculum lecture notes, Markdown headers (#, ##), and bullet points here..."
                      value={notesText}
                      onChange={(e) => setNotesText(e.target.value)}
                      maxLength={100000}
                    />
                    <div className="textarea-footer">
                      <span className="char-count">
                        {notesText.length.toLocaleString()} / 100,000 characters
                      </span>
                      <button
                        type="button"
                        className="sample-load-btn"
                        onClick={() => {
                          setNotesText(SAMPLE_LECTURE_NOTES);
                          setTitleOverride('Artificial Intelligence: Transforming the Modern World');
                        }}
                      >
                        Load AI Curriculum (10 Sections)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: File Upload Dropzone */}
              {activeTab === 'file' && (
                <div className="ppt-source-content">
                  <div
                    className="upload-dropzone ppt-wide-dropzone"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current?.click()}
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

                    {selectedFile ? (
                      <div>
                        <FileCheck size={42} color="#059669" style={{ margin: '0 auto 0.5rem' }} />
                        <div className="dropzone-title">{selectedFile.name}</div>
                        <div className="dropzone-hint">
                          {(selectedFile.size / 1024).toFixed(1)} KB • Click or drag to replace document
                        </div>
                      </div>
                    ) : (
                      <div>
                        <Upload size={38} className="dropzone-icon" />
                        <div className="dropzone-title">Upload Curriculum Document</div>
                        <div className="dropzone-hint">
                          Drag and drop your <strong>.pdf</strong>, <strong>.docx</strong>, or <strong>.txt</strong> file here, or click to browse
                        </div>
                        <div className="dropzone-limit">Up to 20 MB file size limit</div>
                      </div>
                    )}
                  </div>

                  {selectedFile && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                      <button
                        type="button"
                        className="sample-load-btn"
                        onClick={() => setSelectedFile(null)}
                      >
                        Clear File
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* STEP 4: Presentation Theme Gallery */}
            <section className="ppt-section-card animate-fade-in">
              <div className="ppt-section-header">
                <div className="ppt-section-badge-row">
                  <span className="ppt-step-badge">4</span>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <h2 className="ppt-section-heading">Presentation Theme</h2>
                          <span className="theme-count-badge">{availableThemes.length} Themes</span>
                        </div>
                        <p className="ppt-section-subheading">
                          Select from 14 professional educational themes with curated typography, high-contrast palettes, and 16:9 styling.
                        </p>
                      </div>
                    </div>

                    <div className="ppt-header-right-actions">
                      <div className="gallery-nav-buttons">
                        <button
                          type="button"
                          className="gallery-arrow-btn"
                          onClick={() => themeGalleryRef.current?.scrollBy({ left: -320, behavior: 'smooth' })}
                          title="Scroll left"
                          aria-label="Scroll themes left"
                        >
                          <ChevronLeft size={18} />
                        </button>
                        <button
                          type="button"
                          className="gallery-arrow-btn"
                          onClick={() => themeGalleryRef.current?.scrollBy({ left: 320, behavior: 'smooth' })}
                          title="Scroll right"
                          aria-label="Scroll themes right"
                        >
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Theme Filter Bar */}
                  <div className="ppt-filter-bar">
                    <button
                      type="button"
                      className={`ppt-filter-pill ${themeFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setThemeFilter('all')}
                    >
                      All Themes ({availableThemes.length})
                    </button>
                    <button
                      type="button"
                      className={`ppt-filter-pill ${themeFilter === 'dark' ? 'active' : ''}`}
                      onClick={() => setThemeFilter('dark')}
                    >
                      Dark Themes ({availableThemes.filter((t) => t.is_dark).length})
                    </button>
                    <button
                      type="button"
                      className={`ppt-filter-pill ${themeFilter === 'light' ? 'active' : ''}`}
                      onClick={() => setThemeFilter('light')}
                    >
                      Light & Academic ({availableThemes.filter((t) => !t.is_dark && !t.is_custom).length})
                    </button>
                    {availableThemes.some((t) => t.is_custom) && (
                      <button
                        type="button"
                        className={`ppt-filter-pill ${themeFilter === 'custom' ? 'active' : ''}`}
                        onClick={() => setThemeFilter('custom')}
                      >
                        Imported ({availableThemes.filter((t) => t.is_custom).length})
                      </button>
                    )}
                  </div>

                  {/* Horizontal Scrollable Themes Gallery */}
                  <div className="ppt-horizontal-gallery" ref={themeGalleryRef}>
                    {filteredThemes.map((t) => {
                      const isSelected = selectedTheme === t.id;
                      return (
                        <div
                          key={t.id}
                          className={`ppt-gallery-card ${isSelected ? 'active' : ''}`}
                          onClick={() => setSelectedTheme(t.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') setSelectedTheme(t.id);
                          }}
                        >
                          <div className="ppt-card-thumb-frame">
                            <ThemeSlideThumbnail theme={t} isSelected={isSelected} />
                          </div>
                          <div className="ppt-card-meta">
                            <div className="ppt-card-title-row">
                              <span className="ppt-card-name">{t.display_name}</span>
                              <span className={`ppt-tag-pill ${t.is_custom ? 'custom' : t.is_dark ? 'dark' : 'light'}`}>
                                {t.is_custom ? 'Imported' : t.is_dark ? 'Dark' : 'Light'}
                              </span>
                            </div>
                            <p className="ppt-card-summary">{t.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* STEP 5: Slide Layout Family Gallery */}
                <section className="ppt-section-card animate-fade-in">
                  <div className="ppt-section-header">
                    <div className="ppt-section-badge-row">
                      <span className="ppt-step-badge">5</span>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <h2 className="ppt-section-heading">Slide Layout Family</h2>
                          <span className="theme-count-badge">6 Layout Styles</span>
                        </div>
                        <p className="ppt-section-subheading">
                          Choose an architectural layout strategy for formatting your curriculum sections into PowerPoint.
                        </p>
                      </div>
                    </div>

                    <div className="ppt-header-right-actions">
                      <div className="gallery-nav-buttons">
                        <button
                          type="button"
                          className="gallery-arrow-btn"
                          onClick={() => layoutGalleryRef.current?.scrollBy({ left: -300, behavior: 'smooth' })}
                          title="Scroll left"
                          aria-label="Scroll layouts left"
                        >
                          <ChevronLeft size={18} />
                        </button>
                        <button
                          type="button"
                          className="gallery-arrow-btn"
                          onClick={() => layoutGalleryRef.current?.scrollBy({ left: 300, behavior: 'smooth' })}
                          title="Scroll right"
                          aria-label="Scroll layouts right"
                        >
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Horizontal Scrollable Layouts Gallery */}
                  <div className="ppt-horizontal-gallery" ref={layoutGalleryRef}>
                    {LAYOUT_OPTIONS.map((l) => {
                      const isSelected = selectedLayout === l.id;
                      return (
                        <div
                          key={l.id}
                          className={`ppt-gallery-card layout-gallery-card ${isSelected ? 'active' : ''}`}
                          onClick={() => setSelectedLayout(l.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') setSelectedLayout(l.id);
                          }}
                        >
                          <div className="ppt-card-thumb-frame">
                            <LayoutMiniDiagram layoutId={l.id} isSelected={isSelected} />
                          </div>
                          <div className="ppt-card-meta">
                            <div className="ppt-card-title-row">
                              <span className="ppt-card-name">{l.name}</span>
                              <span className="ppt-layout-badge">{l.badge}</span>
                            </div>
                            <p className="ppt-card-summary">{l.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

            {/* STEP 6: Optional Institution & Branding */}
            <section className="ppt-section-card">
              <button
                type="button"
                className="ppt-accordion-btn"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <div className="ppt-section-badge-row">
                  <span className="ppt-step-badge">6</span>
                  <div>
                    <h2 className="ppt-section-heading">Optional Institution & Branding</h2>
                    <p className="ppt-section-subheading">
                      Customize course series subtitle and institutional branding.
                    </p>
                  </div>
                </div>
                {showAdvanced ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>

              {showAdvanced && (
                <div className="ppt-customization-fields animate-fade-in">
                  <div className="ppt-field-col">
                    <label htmlFor="subtitle-override-input" className="ppt-field-label">
                      Subtitle / Course Series
                    </label>
                    <input
                      id="subtitle-override-input"
                      type="text"
                      className="ppt-full-input"
                      placeholder="e.g. Comprehensive Curriculum & Faculty Lecture Notes"
                      value={subtitleOverride}
                      onChange={(e) => setSubtitleOverride(e.target.value)}
                      maxLength={120}
                    />
                  </div>

                  <div className="ppt-field-col">
                    <label htmlFor="institution-override-input" className="ppt-field-label">
                      Institution / Series Branding
                    </label>
                    <input
                      id="institution-override-input"
                      type="text"
                      className="ppt-full-input"
                      placeholder="e.g. Acadion Educational Series"
                      value={institutionOverride}
                      onChange={(e) => setInstitutionOverride(e.target.value)}
                      maxLength={80}
                    />
                  </div>
                </div>
              )}
            </section>

            {/* GENERATE BUTTON (Step 5 for AI, Step 7 for Rule-Based) */}
            <section className="ppt-generate-section">
              {loading && (
                <div className="ppt-generating-banner animate-fade-in">
                  <RefreshCw size={28} className="spinner" color="var(--royal-blue)" />
                  <div className="ppt-generating-info">
                    <div className="ppt-generating-title">Generating PowerPoint Presentation...</div>
                    <div className="ppt-generating-stage">{loadingStage}</div>
                  </div>
                  <div className="loading-timer-badge">
                    <Clock size={14} />
                    <span>{elapsedSeconds}s</span>
                  </div>
                </div>
              )}

              <button
                type="button"
                className="ppt-generate-hero-btn"
                disabled={loading || (activeTab === 'text' && !notesText.trim()) || (activeTab === 'file' && !selectedFile)}
                onClick={() => handleGenerate()}
              >
                {loading ? (
                  <>
                    <RefreshCw size={22} className="spinner" />
                    <span>Building Presentation... ({elapsedSeconds}s)</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={22} />
                    <span>
                      {mode === 'deterministic'
                        ? 'Generate Rule-Based Presentation'
                        : 'Generate PowerPoint Presentation'}
                    </span>
                  </>
                )}
              </button>
            </section>
          </div>
        ) : (
          /* =====================================================================
             PRESENTATION PREVIEW & OUTPUT (Rendered after generation)
             ===================================================================== */
          <div className="panel-card output-panel ppt-output-experience animate-fade-in">
            <div className="panel-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <button
                  type="button"
                  className="ppt-back-new-btn"
                  onClick={() => setResult(null)}
                  title="Create another presentation"
                >
                  <Plus size={16} />
                  <span>New Presentation</span>
                </button>
                <h2 className="panel-title" style={{ margin: 0 }}>
                  <Presentation size={18} color="var(--royal-blue)" />
                  Presentation Preview & Output
                </h2>
              </div>

                  {/* View Switcher Tabs (Visual vs Plan) */}
                  <div className="view-mode-tabs">
                    <button
                      type="button"
                      className={`view-tab-btn ${viewMode === 'visual' ? 'active' : ''}`}
                      onClick={() => { setViewMode('visual'); setIsEditing(false); }}
                    >
                      <Eye size={14} />
                      Visual Preview
                    </button>
                    <button
                      type="button"
                      className={`view-tab-btn ${viewMode === 'plan' ? 'active' : ''}`}
                      onClick={() => setViewMode('plan')}
                    >
                      <ListOrdered size={14} />
                      Slide Plan
                    </button>
                    <button
                      type="button"
                      className="view-tab-btn"
                      style={{ background: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE', fontWeight: 600 }}
                      onClick={() => setIsVisualEditorOpen(true)}
                      title="Open full interactive visual canvas editor"
                    >
                      <Maximize2 size={14} />
                      Visual Editor
                    </button>
                  </div>
                </div>

                {/* Presentation Meta & Download Bar */}
                <div className="presentation-bar">
                  <div className="presentation-meta">
                    <span className="presentation-title">{result.title}</span>
                    <div className="presentation-stats">
                      <span><strong>{result.slide_count}</strong> Widescreen Slides</span>
                      <span>•</span>
                      <span>{formatFileSize(result.file_size_bytes)}</span>
                      <span>•</span>
                      <span style={{ textTransform: 'capitalize' }}>
                        {result.mode === 'ai' ? 'Automatic' : 'Rule-based'} Mode
                      </span>
                      <span>•</span>
                      <span className="active-theme-tag" title="Switch Presentation Theme" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Palette size={12} />
                        <select
                          value={result.theme || selectedTheme}
                          onChange={(e) => handleSwitchTheme(e.target.value)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'inherit',
                            fontWeight: 'inherit',
                            fontSize: 'inherit',
                            cursor: 'pointer',
                            outline: 'none',
                            padding: 0,
                          }}
                          aria-label="Switch Theme"
                        >
                          {availableThemes.map((t) => (
                            <option key={t.id} value={t.id} style={{ color: '#0F172A', background: '#FFFFFF' }}>
                              {t.display_name} {t.is_dark ? '(Dark)' : '(Light)'}
                            </option>
                          ))}
                        </select>
                      </span>
                      <span>•</span>
                      <span className="active-layout-tag" title="Switch Slide Layout Family" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <LayoutGrid size={12} />
                        <select
                          value={result.layout_style || selectedLayout}
                          onChange={(e) => handleSwitchLayout(e.target.value)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'inherit',
                            fontWeight: 'inherit',
                            fontSize: 'inherit',
                            cursor: 'pointer',
                            outline: 'none',
                            padding: 0,
                          }}
                          aria-label="Switch Layout"
                        >
                          {LAYOUT_OPTIONS.map((l) => (
                            <option key={l.id} value={l.id} style={{ color: '#0F172A', background: '#FFFFFF' }}>
                              {l.name}
                            </option>
                          ))}
                        </select>
                      </span>
                      <span>•</span>
                      <span
                        className="active-theme-tag"
                        style={{
                          background: '#EFF6FF',
                          color: '#1D4ED8',
                          borderColor: '#BFDBFE',
                          fontWeight: 600,
                        }}
                      >
                        <Sparkles size={12} />{' '}
                        {result.mode === 'ai' ? 'AI Planned Deck' : 'Rule-Based Engine'}
                      </span>
                      {result.qa_report && (
                        <>
                          <span>•</span>
                          <span
                            className="active-theme-tag"
                            style={{
                              background: result.qa_report.passed ? '#ECFDF5' : '#FFFBEB',
                              color: result.qa_report.passed ? '#047857' : '#B45309',
                              borderColor: result.qa_report.passed ? '#A7F3D0' : '#FDE68A',
                              cursor: 'pointer',
                              fontWeight: 600,
                            }}
                            onClick={() => setShowQADetails(!showQADetails)}
                            title="Click to inspect automated Quality Assurance metrics"
                          >
                            <CheckCircle2 size={12} /> QA Score: {result.qa_report.score}/100 {showQADetails ? '▲' : '▼'}
                          </span>
                        </>
                      )}
                      {generationDuration !== null && (
                        <>
                          <span>•</span>
                          <span className="timing-badge">
                            <Clock size={11} /> Generated in {generationDuration}s
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="presentation-actions">
                    {viewMode === 'plan' ? (
                      <>
                        <button
                          type="button"
                          className="edit-toggle-btn"
                          onClick={() => setIsEditing(!isEditing)}
                        >
                          <Edit3 size={15} />
                          {isEditing ? 'Cancel Edit' : 'Edit Slide Plan'}
                        </button>

                        {isEditing ? (
                          <button
                            type="button"
                            className="save-plan-btn"
                            onClick={handleSaveEditsAndRegenerate}
                          >
                            <RefreshCw size={15} />
                            Save & Regenerate PPT
                          </button>
                        ) : (
                          <a
                            href={result.download_url}
                            className="download-btn"
                            download={result.filename}
                          >
                            <Download size={16} />
                            Download PPTX
                          </a>
                        )}
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="edit-toggle-btn"
                          onClick={() => {
                            setViewMode('plan');
                            setIsEditing(true);
                          }}
                        >
                          <Edit3 size={15} />
                          Edit Plan
                        </button>

                        <button
                          type="button"
                          className="btn-open-visual-editor"
                          onClick={() => setIsVisualEditorOpen(true)}
                          title="Open presentation in interactive visual canvas editor"
                        >
                          <Maximize2 size={15} />
                          <span>Open in Visual Editor</span>
                        </button>

                        <a
                          href={result.download_url}
                          className="download-btn"
                          download={result.filename}
                        >
                          <Download size={16} />
                          Download PowerPoint (.pptx)
                        </a>
                      </>
                    )}
                  </div>
                </div>

                {/* Expandable Automated QA Report Dropdown */}
                {showQADetails && result.qa_report && (
                  <div
                    className="qa-details-dropdown animate-fade-in"
                    style={{
                      margin: '0.75rem 0 1.25rem 0',
                      padding: '1rem 1.25rem',
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      fontSize: '0.825rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.65rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <strong style={{ color: '#0F172A', fontSize: '0.9rem' }}>
                          Automated Quality Assurance (QA) Evaluation
                        </strong>
                        <span style={{ color: '#64748B', fontSize: '0.78rem' }}>
                          (Tested against 7 visual & layout criteria)
                        </span>
                      </div>
                      <span
                        style={{
                          padding: '0.2rem 0.6rem',
                          borderRadius: '9999px',
                          background: result.qa_report.passed ? '#DCFCE7' : '#FEF3C7',
                          color: result.qa_report.passed ? '#15803D' : '#B45309',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                        }}
                      >
                        {result.qa_report.passed ? 'PASSED ARCHITECTURE QA' : 'COMPLIANCE WARNINGS'}
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                        gap: '0.65rem',
                        marginBottom: '0.65rem',
                      }}
                    >
                      <div style={{ background: '#FFFFFF', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                        <span style={{ color: '#64748B', display: 'block', fontSize: '0.72rem' }}>Aspect Ratio</span>
                        <strong>{result.qa_report.metrics?.aspect_ratio || '16:9'} Widescreen</strong>
                      </div>
                      <div style={{ background: '#FFFFFF', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                        <span style={{ color: '#64748B', display: 'block', fontSize: '0.72rem' }}>Cards Grid Ratio</span>
                        <strong>{((result.qa_report.metrics?.cards_grid_ratio || 0) * 100).toFixed(0)}% (Cap: 25%)</strong>
                      </div>
                      <div style={{ background: '#FFFFFF', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                        <span style={{ color: '#64748B', display: 'block', fontSize: '0.72rem' }}>Avg Word Density</span>
                        <strong>{result.qa_report.metrics?.avg_density || 0} words/slide</strong>
                      </div>
                      <div style={{ background: '#FFFFFF', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                        <span style={{ color: '#64748B', display: 'block', fontSize: '0.72rem' }}>Speaker Notes</span>
                        <strong>{((result.qa_report.metrics?.speaker_notes_coverage || 0) * 100).toFixed(0)}% Coverage</strong>
                      </div>
                    </div>

                    {result.qa_report.warnings && result.qa_report.warnings.length > 0 && (
                      <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '6px', padding: '0.5rem 0.75rem', color: '#B45309', fontSize: '0.78rem' }}>
                        <strong>Quality Observations:</strong>
                        <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0 }}>
                          {result.qa_report.warnings.map((w: string, idx: number) => (
                            <li key={idx}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* VIEW MODE 1: VISUAL SLIDE VIEWER */}
                {viewMode === 'visual' && activeSlide && (
                  <div className="visual-viewer-container">
                    {/* Slide Top Navigation & Meta */}
                    <div className="viewer-top-bar">
                      <div className="viewer-slide-info">
                        <span className="slide-index-pill">
                          Slide {currentSlideIndex + 1} of {result.slide_count}
                        </span>
                        <span className="viewer-slide-title" title={activeSlide.title}>
                          {activeSlide.title}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        {getVisualBadge(activeSlide.visual_type)}
                        <span className={`slide-type-badge ${
                          activeSlide.type === 'title' ? 'badge-title' :
                          activeSlide.type === 'overview' ? 'badge-overview' :
                          activeSlide.type === 'summary' ? 'badge-summary' : 'badge-content'
                        }`}>
                          {activeSlide.type}
                        </span>

                        <button
                          type="button"
                          className="viewer-action-icon-btn"
                          title="Fullscreen View"
                          onClick={() => setIsFullscreen(true)}
                        >
                          <Maximize2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Main 16:9 Widescreen Slide Display Area */}
                    <div className="widescreen-slide-stage">
                      <button
                        type="button"
                        className="slide-nav-arrow arrow-prev"
                        disabled={currentSlideIndex === 0}
                        onClick={() => setCurrentSlideIndex((prev) => Math.max(0, prev - 1))}
                        title="Previous Slide (Left Arrow)"
                      >
                        <ChevronLeft size={24} />
                      </button>

                      <div
                        className="slide-image-frame"
                        onClick={() => setIsFullscreen(true)}
                        title="Click to view full screen"
                      >
                        {currentImageUrl && !imageError[currentSlideIndex] ? (
                          <img
                            src={currentImageUrl}
                            alt={`PowerPoint Slide ${activeSlide.slide_number}: ${activeSlide.title}`}
                            className="slide-rendered-img"
                            onError={() => {
                              setImageError((prev) => ({ ...prev, [currentSlideIndex]: true }));
                            }}
                          />
                        ) : (
                          <div className="slide-fallback-card" style={{ background: currentThemeObj.colors.bg }}>
                            <div className="fallback-header">
                              <span className="fallback-tag">Slide {activeSlide.slide_number}</span>
                              <span className="fallback-type">{activeSlide.type}</span>
                            </div>
                            <div className="fallback-title" style={{ color: currentThemeObj.colors.primary }}>
                              {activeSlide.title}
                            </div>
                            {activeSlide.subtitle && (
                              <div className="fallback-subtitle">{activeSlide.subtitle}</div>
                            )}
                            <ul className="fallback-bullets">
                              {activeSlide.bullets.map((b, i) => (
                                <li key={i}>
                                  {b.prefix && <strong>{b.prefix}: </strong>}
                                  {b.text}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <span className="slide-format-tag">
                          16:9 Widescreen PPTX • {currentThemeObj.display_name} • {currentLayoutObj.name}
                        </span>
                      </div>

                      <button
                        type="button"
                        className="slide-nav-arrow arrow-next"
                        disabled={currentSlideIndex === result.slide_count - 1}
                        onClick={() => setCurrentSlideIndex((prev) => Math.min(result.slide_count - 1, prev + 1))}
                        title="Next Slide (Right Arrow)"
                      >
                        <ChevronRight size={24} />
                      </button>
                    </div>

                    {/* Slide Filmstrip / Thumbnail Navigation Strip */}
                    <div className="filmstrip-wrapper">
                      <div className="filmstrip-label">
                        <span>All Slides ({result.slide_count})</span>
                        <span className="filmstrip-hint">Use ← → arrow keys to navigate</span>
                      </div>
                      <div className="filmstrip-carousel" ref={filmstripRef}>
                        {result.slides.map((s, idx) => {
                          const thumbUrl = s.image_url
                            ? `${s.image_url}?t=${result.file_id}`
                            : result.preview_urls?.[idx]
                            ? `${result.preview_urls[idx]}?t=${result.file_id}`
                            : null;

                          return (
                            <button
                              key={idx}
                              type="button"
                              className={`filmstrip-thumb ${currentSlideIndex === idx ? 'active' : ''}`}
                              onClick={() => setCurrentSlideIndex(idx)}
                              title={`Slide ${idx + 1}: ${s.title}`}
                            >
                              <div className="thumb-image-box">
                                {thumbUrl && !imageError[idx] ? (
                                  <img
                                    src={thumbUrl}
                                    alt={`Thumb ${idx + 1}`}
                                    className="thumb-img"
                                  />
                                ) : (
                                  <div className="thumb-placeholder">{idx + 1}</div>
                                )}
                                <span className="thumb-number-badge">{idx + 1}</span>
                              </div>
                              <span className="thumb-title-caption">{s.title}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Current Slide Details & Instructor Speaker Notes */}
                    <div className="slide-meta-drawer">
                      {activeSlide.speaker_notes ? (
                        <div className="speaker-notes-banner">
                          <div className="speaker-notes-header">
                            <span className="speaker-notes-tag">Instructor Talking Points</span>
                            <button
                              type="button"
                              className="sample-load-btn"
                              onClick={() => toggleSpeakerNotes(currentSlideIndex)}
                            >
                              {expandedNotes[currentSlideIndex] === false ? 'Expand Notes' : 'Collapse Notes'}
                            </button>
                          </div>
                          {expandedNotes[currentSlideIndex] !== false && (
                            <div className="speaker-notes-content">
                              {activeSlide.speaker_notes}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="speaker-notes-banner empty-notes">
                          <span className="speaker-notes-tag">Instructor Talking Points</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            No speaker notes generated for this slide.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* VIEW MODE 2: SLIDE PLAN & OUTLINE EDITOR */}
                {viewMode === 'plan' && (
                  <div className="slides-container">
                    {editedSlides.map((slide, sIdx) => {
                      const isTitleSlide = slide.type === 'title';
                      const isOverviewSlide = slide.type === 'overview';
                      const isSummarySlide = slide.type === 'summary';

                      return (
                        <div key={sIdx} className="slide-card">
                          <div className="slide-card-header">
                            <span className="slide-index-badge">
                              Slide {slide.slide_number} of {result.slide_count}
                            </span>
                            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                              {getVisualBadge(slide.visual_type)}
                              <span className={`slide-type-badge ${
                                isTitleSlide ? 'badge-title' :
                                isOverviewSlide ? 'badge-overview' :
                                isSummarySlide ? 'badge-summary' : 'badge-content'
                              }`}>
                                {slide.type}
                              </span>
                              <button
                                type="button"
                                className="sample-load-btn"
                                style={{ marginLeft: '0.4rem' }}
                                onClick={() => {
                                  setCurrentSlideIndex(sIdx);
                                  setViewMode('visual');
                                }}
                              >
                                View Visual
                              </button>
                            </div>
                          </div>

                          {/* Title Display or Edit */}
                          {isEditing && !isTitleSlide ? (
                            <input
                              type="text"
                              className="edit-title-input"
                              value={slide.title}
                              onChange={(e) => {
                                const updated = [...editedSlides];
                                updated[sIdx].title = e.target.value;
                                setEditedSlides(updated);
                              }}
                            />
                          ) : (
                            <div className="slide-title-view">{slide.title}</div>
                          )}

                          {slide.subtitle && (
                            <div className="slide-subtitle-view">{slide.subtitle}</div>
                          )}

                          {/* Bullets List */}
                          {slide.bullets && slide.bullets.length > 0 && (
                            <ul className="slide-bullets-list">
                              {slide.bullets.map((bullet, bIdx) => (
                                <li key={bIdx} className="slide-bullet-item">
                                  <span className="bullet-dot">•</span>
                                  {isEditing ? (
                                    <div className="edit-bullet-row" style={{ width: '100%' }}>
                                      <input
                                        type="text"
                                        className="edit-prefix-input"
                                        placeholder="Bold term"
                                        value={bullet.prefix || ''}
                                        onChange={(e) => {
                                          const updated = [...editedSlides];
                                          updated[sIdx].bullets[bIdx].prefix = e.target.value;
                                          setEditedSlides(updated);
                                        }}
                                      />
                                      <input
                                        type="text"
                                        className="edit-text-input"
                                        placeholder="Explanation / Takeaway"
                                        value={bullet.text}
                                        onChange={(e) => {
                                          const updated = [...editedSlides];
                                          updated[sIdx].bullets[bIdx].text = e.target.value;
                                          setEditedSlides(updated);
                                        }}
                                      />
                                    </div>
                                  ) : (
                                    <div>
                                      {bullet.prefix && (
                                        <span className="bullet-prefix">{bullet.prefix}: </span>
                                      )}
                                      <span>{bullet.text}</span>
                                    </div>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}

                          {/* Instructor Speaker Notes Box */}
                          {slide.speaker_notes && (
                            <div>
                              <button
                                type="button"
                                className="sample-load-btn"
                                style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', marginBottom: '0.2rem' }}
                                onClick={() => toggleSpeakerNotes(sIdx)}
                              >
                                <span>{expandedNotes[sIdx] ? 'Hide' : 'View'} Instructor Speaker Notes</span>
                                {expandedNotes[sIdx] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>
                              {expandedNotes[sIdx] && (
                                <div className="speaker-notes-box animate-fade-in">
                                  <div className="speaker-notes-title">Talking Points</div>
                                  {isEditing ? (
                                    <textarea
                                      className="edit-text-input"
                                      style={{ width: '100%', minHeight: '60px' }}
                                      value={slide.speaker_notes}
                                      onChange={(e) => {
                                        const updated = [...editedSlides];
                                        updated[sIdx].speaker_notes = e.target.value;
                                        setEditedSlides(updated);
                                      }}
                                    />
                                  ) : (
                                    <div>{slide.speaker_notes}</div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </main>

      {/* Fullscreen Slide Modal */}
      {isFullscreen && activeSlide && (
        <div className="fullscreen-modal-overlay" onClick={() => setIsFullscreen(false)}>
          <div className="fullscreen-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="fullscreen-header">
              <span className="fullscreen-slide-title">
                Slide {currentSlideIndex + 1} of {result?.slide_count}: {activeSlide.title}
              </span>
              <button
                type="button"
                className="fullscreen-close-btn"
                onClick={() => setIsFullscreen(false)}
                title="Close Fullscreen (Esc)"
              >
                <X size={20} />
              </button>
            </div>

            <div className="fullscreen-body">
              <button
                type="button"
                className="fullscreen-nav-btn left"
                disabled={currentSlideIndex === 0}
                onClick={() => setCurrentSlideIndex((prev) => Math.max(0, prev - 1))}
              >
                <ChevronLeft size={32} />
              </button>

              <div className="fullscreen-image-wrapper">
                {currentImageUrl && (
                  <img
                    src={currentImageUrl}
                    alt={`Slide ${activeSlide.slide_number}`}
                    className="fullscreen-img"
                  />
                )}
              </div>

              <button
                type="button"
                className="fullscreen-nav-btn right"
                disabled={!result || currentSlideIndex === result.slide_count - 1}
                onClick={() => setCurrentSlideIndex((prev) => Math.min((result?.slide_count || 1) - 1, prev + 1))}
              >
                <ChevronRight size={32} />
              </button>
            </div>

            <div className="fullscreen-footer">
              <span>Press Left/Right arrow keys to navigate • Esc to exit • {currentThemeObj.display_name} Theme</span>
            </div>
          </div>
        </div>
      )}

      {/* External Themes & Local PPTX Template Modal */}
      {showTemplateModal && (
        <div className="modal-overlay" onClick={() => setShowTemplateModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Palette size={20} color="var(--royal-blue)" />
                <h3 className="modal-title">Get More Themes & PPTX Templates</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowTemplateModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="modal-tabs">
              <button
                type="button"
                className={`modal-tab ${templateModalTab === 'external' ? 'active' : ''}`}
                onClick={() => setTemplateModalTab('external')}
              >
                <ExternalLink size={15} />
                Verified External Template Sources
              </button>
              <button
                type="button"
                className={`modal-tab ${templateModalTab === 'import' ? 'active' : ''}`}
                onClick={() => setTemplateModalTab('import')}
              >
                <FolderPlus size={15} />
                Import & Inspect Local PPTX
              </button>
            </div>

            <div className="modal-body">
              {templateModalTab === 'external' ? (
                <div>
                  <div className="external-disclaimer-card">
                    <Info size={18} color="var(--royal-blue)" style={{ flexShrink: 0 }} />
                    <p>
                      <strong>External Sources Notice:</strong> Templates from these external websites can be downloaded directly from their creators. Once downloaded, you can inspect their styling and import them into Acadion using the <strong>Import & Inspect Local PPTX</strong> tab.
                    </p>
                  </div>

                  <div className="external-sources-grid">
                    <div className="external-source-card">
                      <div className="source-header">
                        <h4>Microsoft PowerPoint Templates</h4>
                        <span className="source-badge">Official</span>
                      </div>
                      <p className="source-desc">
                        Official, clean Microsoft PowerPoint presentation themes and educational deck designs.
                      </p>
                      <a
                        href="https://create.microsoft.com/en-us/powerpoint-templates"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="external-link-btn"
                      >
                        Visit Microsoft Templates <ExternalLink size={14} />
                      </a>
                    </div>

                    <div className="external-source-card">
                      <div className="source-header">
                        <h4>Slidesgo</h4>
                        <span className="source-badge">Popular</span>
                      </div>
                      <p className="source-desc">
                        Vast library of free curriculum and PowerPoint templates for teachers, academia, and business.
                      </p>
                      <a
                        href="https://slidesgo.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="external-link-btn"
                      >
                        Visit Slidesgo <ExternalLink size={14} />
                      </a>
                    </div>

                    <div className="external-source-card">
                      <div className="source-header">
                        <h4>SlidesCarnival</h4>
                        <span className="source-badge">Free</span>
                      </div>
                      <p className="source-desc">
                        Free presentation templates and themes with artistic, academic, and creative slides.
                      </p>
                      <a
                        href="https://www.slidescarnival.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="external-link-btn"
                      >
                        Visit SlidesCarnival <ExternalLink size={14} />
                      </a>
                    </div>

                    <div className="external-source-card">
                      <div className="source-header">
                        <h4>Canva Presentation Templates</h4>
                        <span className="source-badge">Modern</span>
                      </div>
                      <p className="source-desc">
                        Designer presentation templates easily exportable to Microsoft PowerPoint (.pptx).
                      </p>
                      <a
                        href="https://www.canva.com/presentations/templates/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="external-link-btn"
                      >
                        Visit Canva <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="import-dropzone-section">
                    <div
                      className="upload-dropzone template-dropzone"
                      onClick={() => templateFileInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                          handleImportTemplate(e.dataTransfer.files[0]);
                        }
                      }}
                    >
                      <input
                        type="file"
                        ref={templateFileInputRef}
                        style={{ display: 'none' }}
                        accept=".pptx"
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            handleImportTemplate(e.target.files[0]);
                          }
                        }}
                      />
                      <FolderPlus size={36} color="var(--royal-blue)" />
                      <div className="dropzone-title">Upload Local PowerPoint (.pptx) Template</div>
                      <div className="dropzone-hint">
                        Drop any local PowerPoint presentation here to extract its color palette and typography
                      </div>
                      <div className="dropzone-limit">100% Non-destructive: Your file is never modified or overwritten</div>
                    </div>
                  </div>

                  {importingTemplate && (
                    <div className="importing-spinner-row animate-fade-in">
                      <RefreshCw size={20} className="spinner" color="var(--royal-blue)" />
                      <span>Inspecting presentation dimensions, color palette, and font styles...</span>
                    </div>
                  )}

                  {templateInspectionReport && (
                    <div className="inspection-results-card animate-fade-in">
                      <div className="inspection-header">
                        <CheckCircle2 size={18} color="#059669" />
                        <h4>Template Compatibility Inspection Report</h4>
                      </div>

                      <div className="inspection-details-grid">
                        <div className="detail-item">
                          <span className="detail-label">Template Name</span>
                          <span className="detail-val">{templateInspectionReport.template_name}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Slide Ratio</span>
                          <span className="detail-val">{templateInspectionReport.slide_dimensions}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Detected Mode</span>
                          <span className="detail-val">{templateInspectionReport.detected_mode}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Extracted Fonts</span>
                          <span className="detail-val">
                            {templateInspectionReport.font_heading} / {templateInspectionReport.font_body}
                          </span>
                        </div>
                      </div>

                      <div className="palette-swatches-row">
                        <span className="palette-label">Extracted Palette:</span>
                        <div className="swatch-capsule">
                          <span className="swatch-circle" style={{ background: templateInspectionReport.primary_color }} title="Primary" />
                          <span className="swatch-circle" style={{ background: templateInspectionReport.secondary_color }} title="Secondary" />
                          <span className="swatch-circle" style={{ background: templateInspectionReport.accent_color }} title="Accent" />
                          <span className="swatch-circle" style={{ background: templateInspectionReport.background_color }} title="Background" />
                        </div>
                      </div>

                      <ul className="compatibility-notes-list">
                        {templateInspectionReport.compatibility_notes.map((note, idx) => (
                          <li key={idx}>
                            <Check size={14} color="#059669" />
                            <span>{note}</span>
                          </li>
                        ))}
                      </ul>

                      <div className="modal-action-row">
                        <button
                          type="button"
                          className="apply-imported-btn"
                          onClick={() => setShowTemplateModal(false)}
                        >
                          Use Extracted Theme in Presentation <ArrowRight size={15} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

