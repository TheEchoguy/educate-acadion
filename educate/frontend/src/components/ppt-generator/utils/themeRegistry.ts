/**
 * Theme & Layout Registry for Acadion Visual Editor (Phase 2.6).
 * Contains definitions for all 14 built-in themes and registered slide layouts,
 * providing colors, typography, geometry templates, and preview metadata.
 */

export interface RegisteredTheme {
  id: string;
  displayName: string;
  description: string;
  isDark: boolean;
  fontHeading: string;
  fontBody: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    bg: string;
    card: string;
    cardBorder: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
  };
}

export interface RegisteredLayout {
  id: string;
  name: string;
  displayName: string;
  badge: string;
  description: string;
  category: string;
  iconName: string;
  defaultObjectCount: number;
}

export const REGISTERED_THEMES: Record<string, RegisteredTheme> = {
  academic_navy: {
    id: 'academic_navy',
    displayName: 'Academic Navy',
    description: 'Traditional academic aesthetic with deep navy, royal blue, and gold accents.',
    isDark: false,
    fontHeading: 'Calibri',
    fontBody: 'Calibri',
    colors: {
      primary: '#0F2C59',
      secondary: '#2563EB',
      accent: '#D97706',
      bg: '#F8FAFC',
      card: '#FFFFFF',
      cardBorder: '#E2E8F0',
      textPrimary: '#0F172A',
      textSecondary: '#334155',
      textMuted: '#64748B',
    },
  },
  modern_blue: {
    id: 'modern_blue',
    displayName: 'Modern Blue',
    description: 'Clean contemporary tech style with cobalt blue, electric cyan, and crisp grey.',
    isDark: false,
    fontHeading: 'Calibri',
    fontBody: 'Calibri',
    colors: {
      primary: '#1E40AF',
      secondary: '#3B82F6',
      accent: '#06B6D4',
      bg: '#F1F5F9',
      card: '#FFFFFF',
      cardBorder: '#CBD5E1',
      textPrimary: '#0F172A',
      textSecondary: '#475569',
      textMuted: '#64748B',
    },
  },
  emerald_pro: {
    id: 'emerald_pro',
    displayName: 'Emerald Professional',
    description: 'Sophisticated healthcare and nature palette with deep forest green and mint.',
    isDark: false,
    fontHeading: 'Calibri',
    fontBody: 'Calibri',
    colors: {
      primary: '#064E3B',
      secondary: '#059669',
      accent: '#10B981',
      bg: '#F0FDF4',
      card: '#FFFFFF',
      cardBorder: '#D1FAE5',
      textPrimary: '#064E3B',
      textSecondary: '#166534',
      textMuted: '#4B5563',
    },
  },
  purple_gradient: {
    id: 'purple_gradient',
    displayName: 'Purple Gradient',
    description: 'Creative academic palette featuring deep royal purple, violet, and soft lavender.',
    isDark: false,
    fontHeading: 'Calibri',
    fontBody: 'Calibri',
    colors: {
      primary: '#4C1D95',
      secondary: '#7C3AED',
      accent: '#C084FC',
      bg: '#FAF5FF',
      card: '#FFFFFF',
      cardBorder: '#E9D5FF',
      textPrimary: '#3B0764',
      textSecondary: '#581C87',
      textMuted: '#6B7280',
    },
  },
  corporate_minimal: {
    id: 'corporate_minimal',
    displayName: 'Corporate Minimal',
    description: 'Executive Swiss style with pure white, precision charcoal, and subtle blue lines.',
    isDark: false,
    fontHeading: 'Arial',
    fontBody: 'Arial',
    colors: {
      primary: '#18181B',
      secondary: '#2563EB',
      accent: '#475569',
      bg: '#FAFAFA',
      card: '#FFFFFF',
      cardBorder: '#E4E4E7',
      textPrimary: '#18181B',
      textSecondary: '#3F3F46',
      textMuted: '#71717A',
    },
  },
  dark_tech: {
    id: 'dark_tech',
    displayName: 'Dark Technology',
    description: 'High-contrast dark mode canvas with luminous neon cyan accents and obsidian cards.',
    isDark: true,
    fontHeading: 'Calibri',
    fontBody: 'Calibri',
    colors: {
      primary: '#06B6D4',
      secondary: '#0EA5E9',
      accent: '#38BDF8',
      bg: '#0B132B',
      card: '#1A2639',
      cardBorder: '#334155',
      textPrimary: '#F8FAFC',
      textSecondary: '#CBD5E1',
      textMuted: '#94A3B8',
    },
  },
  warm_creative: {
    id: 'warm_creative',
    displayName: 'Warm Creative',
    description: 'Engaging educational theme with rich terracotta, vibrant tangerine, and warm cream.',
    isDark: false,
    fontHeading: 'Calibri',
    fontBody: 'Calibri',
    colors: {
      primary: '#9A3412',
      secondary: '#EA580C',
      accent: '#F97316',
      bg: '#FFFBEB',
      card: '#FFFFFF',
      cardBorder: '#FDE68A',
      textPrimary: '#431407',
      textSecondary: '#7C2D12',
      textMuted: '#9A3412',
    },
  },
  clean_light: {
    id: 'clean_light',
    displayName: 'Clean Light',
    description: 'Minimalist airy design with soft sky blue, pure white surfaces, and subtle slate.',
    isDark: false,
    fontHeading: 'Calibri',
    fontBody: 'Calibri',
    colors: {
      primary: '#0369A1',
      secondary: '#0EA5E9',
      accent: '#64748B',
      bg: '#F8FAFC',
      card: '#FFFFFF',
      cardBorder: '#E0F2FE',
      textPrimary: '#0F172A',
      textSecondary: '#334155',
      textMuted: '#64748B',
    },
  },
  midnight_blue: {
    id: 'midnight_blue',
    displayName: 'Midnight Blue',
    description: 'Deep midnight navy canvas with electric cobalt cards and luminous cyan accents.',
    isDark: true,
    fontHeading: 'Calibri',
    fontBody: 'Calibri',
    colors: {
      primary: '#00D2D3',
      secondary: '#1E3E62',
      accent: '#38BDF8',
      bg: '#060E18',
      card: '#112236',
      cardBorder: '#1F3A5C',
      textPrimary: '#F1F5F9',
      textSecondary: '#94A3B8',
      textMuted: '#64748B',
    },
  },
  cyber_neon: {
    id: 'cyber_neon',
    displayName: 'Cyber Neon',
    description: 'Synthwave dark obsidian mode with vivid matrix emerald, cyan, and violet accents.',
    isDark: true,
    fontHeading: 'Calibri',
    fontBody: 'Calibri',
    colors: {
      primary: '#00FF66',
      secondary: '#10B981',
      accent: '#8B5CF6',
      bg: '#0D0D11',
      card: '#161622',
      cardBorder: '#272738',
      textPrimary: '#F8FAFC',
      textSecondary: '#CBD5E1',
      textMuted: '#64748B',
    },
  },
  obsidian_gold: {
    id: 'obsidian_gold',
    displayName: 'Obsidian Gold',
    description: 'High-end executive luxury aesthetic with rich champagne gold on velvet charcoal.',
    isDark: true,
    fontHeading: 'Calibri',
    fontBody: 'Calibri',
    colors: {
      primary: '#D4AF37',
      secondary: '#F59E0B',
      accent: '#E2B842',
      bg: '#121214',
      card: '#1E1E24',
      cardBorder: '#33333E',
      textPrimary: '#FDFEFE',
      textSecondary: '#D1D5DB',
      textMuted: '#9CA3AF',
    },
  },
  dark_purple: {
    id: 'dark_purple',
    displayName: 'Dark Purple',
    description: 'Deep cosmic galaxy aesthetic with neon amethyst, electric orchid, and lavender cards.',
    isDark: true,
    fontHeading: 'Calibri',
    fontBody: 'Calibri',
    colors: {
      primary: '#C084FC',
      secondary: '#A855F7',
      accent: '#E879F9',
      bg: '#13091F',
      card: '#201235',
      cardBorder: '#3B2261',
      textPrimary: '#FAF5FF',
      textSecondary: '#D8B4FE',
      textMuted: '#9333EA',
    },
  },
  graphite_pro: {
    id: 'graphite_pro',
    displayName: 'Graphite Pro',
    description: 'Architectural precision monochrome graphite with sleek carbon cards and sky blue line.',
    isDark: true,
    fontHeading: 'Arial',
    fontBody: 'Arial',
    colors: {
      primary: '#38BDF8',
      secondary: '#71717A',
      accent: '#A1A1AA',
      bg: '#18181B',
      card: '#27272A',
      cardBorder: '#3F3F46',
      textPrimary: '#FAFAFA',
      textSecondary: '#D4D4D8',
      textMuted: '#A1A1AA',
    },
  },
  deep_ocean: {
    id: 'deep_ocean',
    displayName: 'Deep Ocean',
    description: 'Abyssal ocean trench palette with bioluminescent teal, electric aqua, and deep sea cards.',
    isDark: true,
    fontHeading: 'Calibri',
    fontBody: 'Calibri',
    colors: {
      primary: '#0EA5E9',
      secondary: '#14B8A6',
      accent: '#2DD4BF',
      bg: '#051622',
      card: '#0A2234',
      cardBorder: '#133E5E',
      textPrimary: '#F0FDFA',
      textSecondary: '#99F6E4',
      textMuted: '#5EEAD4',
    },
  },
};

export const REGISTERED_LAYOUTS: RegisteredLayout[] = [
  {
    id: 'cards_grid',
    name: 'Cards & Grid',
    displayName: 'Cards & Grid Layout',
    badge: 'Structured',
    description: 'Arranges takeaways into structured multi-card modular containers with top accent bars.',
    category: 'Structured',
    iconName: 'LayoutGrid',
    defaultObjectCount: 4,
  },
  {
    id: 'two_column',
    name: 'Two-Column Compare',
    displayName: 'Two-Column Comparison',
    badge: 'Balanced',
    description: 'Dual side-by-side comparison columns with header tags and contrasting accents.',
    category: 'Comparative',
    iconName: 'Columns',
    defaultObjectCount: 2,
  },
  {
    id: 'multi_column',
    name: 'Three Pillars',
    displayName: 'Three-Pillar Columns',
    badge: 'Foundational',
    description: 'Three distinct vertical pillar containers balanced across the widescreen slide.',
    category: 'Foundational',
    iconName: 'Columns3',
    defaultObjectCount: 3,
  },
  {
    id: 'visual_flow',
    name: 'Process Flow',
    displayName: 'Process Flow & Chevrons',
    badge: 'Sequential',
    description: 'Sequential step-by-step pipeline cards with milestone numbering and flow indicators.',
    category: 'Sequential',
    iconName: 'GitCommit',
    defaultObjectCount: 4,
  },
  {
    id: 'stats_metrics',
    name: 'Key Metrics',
    displayName: 'Statistics & Key Metrics',
    badge: 'High Impact',
    description: 'Emphasizes large bold numeric metrics, KPI stat callouts, and highlighted impact points.',
    category: 'Quantitative',
    iconName: 'BarChart2',
    defaultObjectCount: 3,
  },
  {
    id: 'editorial',
    name: 'Editorial Text',
    displayName: 'Editorial Text & Bullets',
    badge: 'Classic',
    description: 'Clean typography with bold term prefixes in an elegant full-width container card.',
    category: 'Narrative',
    iconName: 'FileText',
    defaultObjectCount: 3,
  },
  {
    id: 'asymmetric',
    name: 'Asymmetric Focus',
    displayName: 'Asymmetric Focus & Detail',
    badge: 'Emphasis',
    description: 'Prominent dominant left focal container alongside supporting right-hand detail panels.',
    category: 'Narrative',
    iconName: 'Maximize2',
    defaultObjectCount: 3,
  },
  {
    id: 'title_slide',
    name: 'Title & Hero',
    displayName: 'Title & Hero Container',
    badge: 'Opening',
    description: 'Opening lecture title container with series badge, presentation title, and subtitle.',
    category: 'Introductory',
    iconName: 'Presentation',
    defaultObjectCount: 3,
  },
  {
    id: 'blank',
    name: 'Blank Slide',
    displayName: 'Blank Slide',
    badge: 'Canvas',
    description: 'Clean widescreen slide canvas styled with the active presentation theme background.',
    category: 'Canvas',
    iconName: 'Square',
    defaultObjectCount: 0,
  },
];

export function getRegisteredTheme(themeId?: string | null): RegisteredTheme {
  if (!themeId) return REGISTERED_THEMES.academic_navy;
  const key = themeId.toLowerCase().trim().replace(/[-\s]/g, '_');
  return REGISTERED_THEMES[key] || REGISTERED_THEMES.academic_navy;
}

export function getAllThemes(): RegisteredTheme[] {
  return Object.values(REGISTERED_THEMES);
}

export function getAllLayouts(): RegisteredLayout[] {
  return REGISTERED_LAYOUTS;
}
