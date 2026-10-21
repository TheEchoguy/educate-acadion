"""
Layout definitions, color themes, and visual component builders for Acadion AI PPT Generator.
Uses native PowerPoint shapes and text frames for full editability.
Provides 8 distinct professional PowerPoint themes.
"""

from dataclasses import dataclass
from typing import Any, Dict, List, Optional
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.slide import Slide
from pptx.util import Inches, Pt


@dataclass(frozen=True)
class ThemeColors:
    """Palette colors and typographic configurations for PowerPoint Themes."""
    id: str = "academic_navy"
    display_name: str = "Academic Navy"
    description: str = "Deep navy, crisp white, and warm gold accents."
    primary: RGBColor = RGBColor(15, 44, 89)        # #0F2C59 Deep Academic Navy
    secondary: RGBColor = RGBColor(37, 99, 235)     # #2563EB Royal Blue
    accent: RGBColor = RGBColor(217, 119, 6)        # #D97706 Warm Amber / Gold
    bg_light: RGBColor = RGBColor(248, 250, 252)    # #F8FAFC Soft Crisp Slate Canvas
    card_bg: RGBColor = RGBColor(255, 255, 255)     # #FFFFFF Card Surface
    card_tint: RGBColor = RGBColor(239, 246, 255)   # #EFF6FF Tinted Accent Card Surface
    card_border: RGBColor = RGBColor(226, 232, 240) # #E2E8F0 Subtle Card Border
    text_primary: RGBColor = RGBColor(15, 23, 42)   # #0F172A Dark Charcoal / Slate-900
    text_secondary: RGBColor = RGBColor(51, 65, 85) # #334155 Readable Slate-700
    text_muted: RGBColor = RGBColor(100, 116, 139)  # #64748B Slate-500
    text_white: RGBColor = RGBColor(255, 255, 255)  # #FFFFFF Clean White
    is_dark: bool = False
    font_heading: str = "Calibri"
    font_body: str = "Calibri"
    # Hex codes for UI serialization & preview cards
    hex_primary: str = "#0F2C59"
    hex_secondary: str = "#2563EB"
    hex_accent: str = "#D97706"
    hex_bg: str = "#F8FAFC"
    hex_card: str = "#FFFFFF"


# -----------------------------------------------------------------------------
# 8 Professional Presentation Themes
# -----------------------------------------------------------------------------

THEMES: Dict[str, ThemeColors] = {
    "academic_navy": ThemeColors(
        id="academic_navy",
        display_name="Academic Navy",
        description="Traditional academic aesthetic with deep navy, royal blue, and gold accents.",
        primary=RGBColor(15, 44, 89),        # #0F2C59
        secondary=RGBColor(37, 99, 235),     # #2563EB
        accent=RGBColor(217, 119, 6),        # #D97706
        bg_light=RGBColor(248, 250, 252),    # #F8FAFC
        card_bg=RGBColor(255, 255, 255),
        card_tint=RGBColor(239, 246, 255),
        card_border=RGBColor(226, 232, 240),
        text_primary=RGBColor(15, 23, 42),
        text_secondary=RGBColor(51, 65, 85),
        text_muted=RGBColor(100, 116, 139),
        is_dark=False,
        font_heading="Calibri",
        font_body="Calibri",
        hex_primary="#0F2C59",
        hex_secondary="#2563EB",
        hex_accent="#D97706",
        hex_bg="#F8FAFC",
        hex_card="#FFFFFF",
    ),
    "modern_blue": ThemeColors(
        id="modern_blue",
        display_name="Modern Blue",
        description="Clean contemporary tech style with cobalt blue, electric cyan, and crisp grey.",
        primary=RGBColor(30, 64, 175),       # #1E40AF
        secondary=RGBColor(59, 130, 246),    # #3B82F6
        accent=RGBColor(6, 182, 212),        # #06B6D4
        bg_light=RGBColor(241, 245, 249),    # #F1F5F9
        card_bg=RGBColor(255, 255, 255),
        card_tint=RGBColor(239, 246, 255),
        card_border=RGBColor(203, 213, 225), # #CBD5E1
        text_primary=RGBColor(15, 23, 42),
        text_secondary=RGBColor(71, 85, 105),
        text_muted=RGBColor(100, 116, 139),
        is_dark=False,
        font_heading="Calibri",
        font_body="Calibri",
        hex_primary="#1E40AF",
        hex_secondary="#3B82F6",
        hex_accent="#06B6D4",
        hex_bg="#F1F5F9",
        hex_card="#FFFFFF",
    ),
    "emerald_pro": ThemeColors(
        id="emerald_pro",
        display_name="Emerald Professional",
        description="Sophisticated bio, healthcare, and nature palette with deep forest green and mint.",
        primary=RGBColor(6, 78, 59),         # #064E3B
        secondary=RGBColor(5, 150, 105),     # #059669
        accent=RGBColor(16, 185, 129),       # #10B981
        bg_light=RGBColor(240, 253, 244),    # #F0FDF4
        card_bg=RGBColor(255, 255, 255),
        card_tint=RGBColor(220, 252, 231),   # #DCFCE7
        card_border=RGBColor(209, 250, 229), # #D1FAE5
        text_primary=RGBColor(6, 78, 59),
        text_secondary=RGBColor(22, 101, 52),
        text_muted=RGBColor(75, 85, 99),
        is_dark=False,
        font_heading="Calibri",
        font_body="Calibri",
        hex_primary="#064E3B",
        hex_secondary="#059669",
        hex_accent="#10B981",
        hex_bg="#F0FDF4",
        hex_card="#FFFFFF",
    ),
    "purple_gradient": ThemeColors(
        id="purple_gradient",
        display_name="Purple Gradient",
        description="Creative academic palette featuring deep royal purple, violet, and soft lavender.",
        primary=RGBColor(76, 29, 149),       # #4C1D95
        secondary=RGBColor(124, 58, 237),    # #7C3AED
        accent=RGBColor(192, 132, 252),      # #C084FC
        bg_light=RGBColor(250, 245, 255),    # #FAF5FF
        card_bg=RGBColor(255, 255, 255),
        card_tint=RGBColor(243, 232, 255),   # #F3E8FF
        card_border=RGBColor(233, 213, 255), # #E9D5FF
        text_primary=RGBColor(59, 7, 100),
        text_secondary=RGBColor(88, 28, 135),
        text_muted=RGBColor(107, 114, 128),
        is_dark=False,
        font_heading="Calibri",
        font_body="Calibri",
        hex_primary="#4C1D95",
        hex_secondary="#7C3AED",
        hex_accent="#C084FC",
        hex_bg="#FAF5FF",
        hex_card="#FFFFFF",
    ),
    "corporate_minimal": ThemeColors(
        id="corporate_minimal",
        display_name="Corporate Minimal",
        description="Executive Swiss style with pure white, precision charcoal, and subtle blue lines.",
        primary=RGBColor(24, 24, 27),        # #18181B
        secondary=RGBColor(37, 99, 235),     # #2563EB
        accent=RGBColor(71, 85, 105),        # #475569
        bg_light=RGBColor(250, 250, 250),    # #FAFAFA
        card_bg=RGBColor(255, 255, 255),
        card_tint=RGBColor(244, 244, 245),   # #F4F4F5
        card_border=RGBColor(228, 228, 231), # #E4E4E7
        text_primary=RGBColor(24, 24, 27),
        text_secondary=RGBColor(63, 63, 70),
        text_muted=RGBColor(113, 113, 122),
        is_dark=False,
        font_heading="Arial",
        font_body="Arial",
        hex_primary="#18181B",
        hex_secondary="#2563EB",
        hex_accent="#475569",
        hex_bg="#FAFAFA",
        hex_card="#FFFFFF",
    ),
    "dark_tech": ThemeColors(
        id="dark_tech",
        display_name="Dark Technology",
        description="High-contrast dark mode canvas with luminous neon cyan accents and obsidian cards.",
        primary=RGBColor(6, 182, 212),       # #06B6D4 (Vibrant Cyan Heading on Dark)
        secondary=RGBColor(14, 165, 233),    # #0EA5E9 (Sky Blue)
        accent=RGBColor(56, 189, 248),       # #38BDF8 (Luminous Cyan Accent)
        bg_light=RGBColor(11, 19, 43),       # #0B132B (Deep Obsidian Canvas)
        card_bg=RGBColor(26, 38, 57),        # #1A2639 (Obsidian Card Surface)
        card_tint=RGBColor(15, 23, 42),      # #0F172A (Deep Tint)
        card_border=RGBColor(51, 65, 85),    # #334155 (Crisp Tech Border)
        text_primary=RGBColor(248, 250, 252),# #F8FAFC (Pure White Text)
        text_secondary=RGBColor(203, 213, 225), # #CBD5E1 (Light Slate)
        text_muted=RGBColor(148, 163, 184),  # #94A3B8 (Silver Slate)
        is_dark=True,
        font_heading="Calibri",
        font_body="Calibri",
        hex_primary="#06B6D4",
        hex_secondary="#0EA5E9",
        hex_accent="#38BDF8",
        hex_bg="#0B132B",
        hex_card="#1A2639",
    ),
    "warm_creative": ThemeColors(
        id="warm_creative",
        display_name="Warm Creative",
        description="Engaging educational theme with rich terracotta, vibrant tangerine, and warm cream.",
        primary=RGBColor(154, 52, 18),       # #9A3412
        secondary=RGBColor(234, 88, 12),     # #EA580C
        accent=RGBColor(249, 115, 22),       # #F97316
        bg_light=RGBColor(255, 251, 235),    # #FFFBEB
        card_bg=RGBColor(255, 255, 255),
        card_tint=RGBColor(254, 243, 199),   # #FEF3C7
        card_border=RGBColor(253, 230, 138), # #FDE68A
        text_primary=RGBColor(67, 20, 7),
        text_secondary=RGBColor(124, 45, 18),
        text_muted=RGBColor(154, 52, 18),
        is_dark=False,
        font_heading="Calibri",
        font_body="Calibri",
        hex_primary="#9A3412",
        hex_secondary="#EA580C",
        hex_accent="#F97316",
        hex_bg="#FFFBEB",
        hex_card="#FFFFFF",
    ),
    "clean_light": ThemeColors(
        id="clean_light",
        display_name="Clean Light",
        description="Minimalist airy design with soft sky blue, pure white surfaces, and subtle slate.",
        primary=RGBColor(3, 105, 161),       # #0369A1
        secondary=RGBColor(14, 165, 233),    # #0EA5E9
        accent=RGBColor(100, 116, 139),      # #64748B
        bg_light=RGBColor(248, 250, 252),    # #F8FAFC
        card_bg=RGBColor(255, 255, 255),
        card_tint=RGBColor(240, 249, 255),   # #F0F9FF
        card_border=RGBColor(224, 242, 254), # #E0F2FE
        text_primary=RGBColor(15, 23, 42),
        text_secondary=RGBColor(51, 65, 85),
        text_muted=RGBColor(100, 116, 139),
        is_dark=False,
        font_heading="Calibri",
        font_body="Calibri",
        hex_primary="#0369A1",
        hex_secondary="#0EA5E9",
        hex_accent="#64748B",
        hex_bg="#F8FAFC",
        hex_card="#FFFFFF",
    ),
    "midnight_blue": ThemeColors(
        id="midnight_blue",
        display_name="Midnight Blue",
        description="Deep midnight navy canvas with electric cobalt cards and luminous cyan accents.",
        primary=RGBColor(0, 210, 211),       # #00D2D3 (Luminous Cyan Heading)
        secondary=RGBColor(30, 62, 98),      # #1E3E62 (Steel Cobalt)
        accent=RGBColor(56, 189, 248),       # #38BDF8 (Sky Blue Glow)
        bg_light=RGBColor(6, 14, 24),        # #060E18 (Abyss Midnight Canvas)
        card_bg=RGBColor(17, 34, 54),        # #112236 (Midnight Card Surface)
        card_tint=RGBColor(10, 25, 42),      # #0A192A (Deep Navy Tint)
        card_border=RGBColor(31, 58, 92),    # #1F3A5C (Subtle Steel Border)
        text_primary=RGBColor(241, 245, 249),# #F1F5F9 (Crisp White Text)
        text_secondary=RGBColor(148, 163, 184), # #94A3B8 (Silver Slate)
        text_muted=RGBColor(100, 116, 139),  # #64748B (Slate Muted)
        is_dark=True,
        font_heading="Calibri",
        font_body="Calibri",
        hex_primary="#00D2D3",
        hex_secondary="#1E3E62",
        hex_accent="#38BDF8",
        hex_bg="#060E18",
        hex_card="#112236",
    ),
    "cyber_neon": ThemeColors(
        id="cyber_neon",
        display_name="Cyber Neon",
        description="Synthwave dark obsidian mode with vivid matrix emerald, cyan, and violet accents.",
        primary=RGBColor(0, 255, 102),       # #00FF66 (Matrix Neon Green)
        secondary=RGBColor(16, 185, 129),    # #10B981 (Emerald Mint)
        accent=RGBColor(139, 92, 246),       # #8B5CF6 (Cyber Violet)
        bg_light=RGBColor(13, 13, 17),       # #0D0D11 (Deep Obsidian Canvas)
        card_bg=RGBColor(22, 22, 34),        # #161622 (Obsidian Card Surface)
        card_tint=RGBColor(16, 16, 24),      # #101018 (Deep Cyber Tint)
        card_border=RGBColor(39, 39, 56),    # #272738 (Tech Grid Border)
        text_primary=RGBColor(248, 250, 252),# #F8FAFC (Luminous White)
        text_secondary=RGBColor(203, 213, 225), # #CBD5E1 (Light Slate)
        text_muted=RGBColor(100, 116, 139),  # #64748B (Muted)
        is_dark=True,
        font_heading="Calibri",
        font_body="Calibri",
        hex_primary="#00FF66",
        hex_secondary="#10B981",
        hex_accent="#8B5CF6",
        hex_bg="#0D0D11",
        hex_card="#161622",
    ),
    "obsidian_gold": ThemeColors(
        id="obsidian_gold",
        display_name="Obsidian Gold",
        description="High-end executive luxury aesthetic with rich champagne gold on velvet charcoal.",
        primary=RGBColor(212, 175, 55),      # #D4AF37 (Champagne Gold Heading)
        secondary=RGBColor(245, 158, 11),    # #F59E0B (Luminous Amber)
        accent=RGBColor(226, 184, 66),       # #E2B842 (Warm Gold Accent)
        bg_light=RGBColor(18, 18, 20),       # #121214 (Velvet Charcoal Canvas)
        card_bg=RGBColor(30, 30, 36),        # #1E1E24 (Charcoal Card Surface)
        card_tint=RGBColor(23, 23, 28),      # #17171C (Dark Tint)
        card_border=RGBColor(51, 51, 62),    # #33333E (Sleek Border)
        text_primary=RGBColor(253, 254, 254),# #FDFEFE (Pure White Text)
        text_secondary=RGBColor(209, 213, 219), # #D1D5DB (Light Silver)
        text_muted=RGBColor(156, 163, 175),  # #9CA3AF (Muted Silver)
        is_dark=True,
        font_heading="Calibri",
        font_body="Calibri",
        hex_primary="#D4AF37",
        hex_secondary="#F59E0B",
        hex_accent="#E2B842",
        hex_bg="#121214",
        hex_card="#1E1E24",
    ),
    "dark_purple": ThemeColors(
        id="dark_purple",
        display_name="Dark Purple",
        description="Deep cosmic galaxy aesthetic with neon amethyst, electric orchid, and lavender cards.",
        primary=RGBColor(192, 132, 252),     # #C084FC (Neon Lavender Heading)
        secondary=RGBColor(168, 85, 247),    # #A855F7 (Electric Amethyst)
        accent=RGBColor(232, 121, 249),      # #E879F9 (Luminous Orchid)
        bg_light=RGBColor(19, 9, 31),        # #13091F (Cosmic Abyss Canvas)
        card_bg=RGBColor(32, 18, 53),        # #201235 (Galaxy Slate Card)
        card_tint=RGBColor(24, 13, 42),      # #180D2A (Deep Amethyst Tint)
        card_border=RGBColor(59, 34, 97),    # #3B2261 (Violet Edge Border)
        text_primary=RGBColor(250, 245, 255),# #FAF5FF (Soft White Text)
        text_secondary=RGBColor(216, 180, 254), # #D8B4FE (Lavender Tint Text)
        text_muted=RGBColor(147, 51, 234),   # #9333EA (Violet Muted)
        is_dark=True,
        font_heading="Calibri",
        font_body="Calibri",
        hex_primary="#C084FC",
        hex_secondary="#A855F7",
        hex_accent="#E879F9",
        hex_bg="#13091F",
        hex_card="#201235",
    ),
    "graphite_pro": ThemeColors(
        id="graphite_pro",
        display_name="Graphite Pro",
        description="Architectural precision monochrome graphite with sleek carbon cards and sky blue line.",
        primary=RGBColor(56, 189, 248),      # #38BDF8 (Precision Sky Blue)
        secondary=RGBColor(113, 113, 122),   # #71717A (Graphite Silver)
        accent=RGBColor(161, 161, 170),      # #A1A1AA (Cool Platinum)
        bg_light=RGBColor(24, 24, 27),       # #18181B (Deep Carbon Canvas)
        card_bg=RGBColor(39, 39, 42),        # #27272A (Carbon Zinc Card)
        card_tint=RGBColor(32, 32, 35),      # #202023 (Zinc Tint)
        card_border=RGBColor(63, 63, 70),    # #3F3F46 (Precision Border)
        text_primary=RGBColor(250, 250, 250),# #FAFAFA (Crisp Pure White)
        text_secondary=RGBColor(212, 212, 216), # #D4D4D8 (Light Platinum)
        text_muted=RGBColor(161, 161, 170),  # #A1A1AA (Muted Platinum)
        is_dark=True,
        font_heading="Arial",
        font_body="Arial",
        hex_primary="#38BDF8",
        hex_secondary="#71717A",
        hex_accent="#A1A1AA",
        hex_bg="#18181B",
        hex_card="#27272A",
    ),
    "deep_ocean": ThemeColors(
        id="deep_ocean",
        display_name="Deep Ocean",
        description="Abyssal ocean trench palette with bioluminescent teal, electric aqua, and deep sea cards.",
        primary=RGBColor(14, 165, 233),      # #0EA5E9 (Bioluminescent Aqua)
        secondary=RGBColor(20, 184, 166),    # #14B8A6 (Marine Teal)
        accent=RGBColor(45, 212, 191),       # #2DD4BF (Seafoam Cyan)
        bg_light=RGBColor(5, 22, 34),        # #051622 (Oceanic Trench Canvas)
        card_bg=RGBColor(10, 34, 52),        # #0A2234 (Deep Sea Card)
        card_tint=RGBColor(7, 27, 42),       # #071B2A (Trench Tint)
        card_border=RGBColor(19, 62, 94),    # #133E5E (Oceanic Border)
        text_primary=RGBColor(240, 253, 250),# #F0FDFA (Luminous Aquamarine White)
        text_secondary=RGBColor(153, 246, 228), # #99F6E4 (Seafoam Muted)
        text_muted=RGBColor(94, 234, 212),   # #5EEAD4 (Teal Muted)
        is_dark=True,
        font_heading="Calibri",
        font_body="Calibri",
        hex_primary="#0EA5E9",
        hex_secondary="#14B8A6",
        hex_accent="#2DD4BF",
        hex_bg="#051622",
        hex_card="#0A2234",
    ),
}


# -----------------------------------------------------------------------------
# Slide Layout Families (Requirement 3)
# -----------------------------------------------------------------------------

LAYOUT_FAMILIES: Dict[str, Dict[str, Any]] = {
    "smart_mixed": {
        "id": "smart_mixed",
        "name": "Smart Mixed Layouts",
        "display_name": "Smart Mixed Layouts",
        "badge": "Recommended",
        "description": "Intelligently alternates between card grids, two-column comparisons, timelines, flowcharts, and metric callouts based on content semantics.",
        "icon": "sparkles",
    },
    "cards_grid": {
        "id": "cards_grid",
        "name": "Cards & Grid Layout",
        "display_name": "Cards & Grid Layout",
        "badge": "Structured",
        "description": "Arranges takeaways into structured multi-card modular containers with top accent bars.",
        "icon": "grid",
    },
    "two_column": {
        "id": "two_column",
        "name": "Two-Column Comparison & Split",
        "display_name": "Two-Column Comparison & Split",
        "badge": "Balanced",
        "description": "Presents concepts in dual side-by-side columns with header tags and contrasting accents.",
        "icon": "columns",
    },
    "visual_flow": {
        "id": "visual_flow",
        "name": "Process Flow & Timeline Focus",
        "display_name": "Process Flow & Timeline Focus",
        "badge": "Sequential",
        "description": "Maximizes sequential step-by-step flowcharts, milestones, and chronological diagrams.",
        "icon": "git-commit",
    },
    "stats_metrics": {
        "id": "stats_metrics",
        "name": "Statistics & Key Metrics",
        "display_name": "Statistics & Key Metrics",
        "badge": "High Impact",
        "description": "Emphasizes large bold numeric metrics, KPI stat callouts, and highlighted impact points.",
        "icon": "bar-chart-2",
    },
    "classic_bullets": {
        "id": "classic_bullets",
        "name": "Title & Bullet Content",
        "display_name": "Title & Bullet Content",
        "badge": "Classic",
        "description": "Clean presentation with bolded term prefixes in an elegant full-width container card.",
        "icon": "list",
    },
}


def register_custom_theme(theme: ThemeColors) -> None:
    """Safely register an imported or custom theme into runtime catalogue."""
    THEMES[theme.id] = theme


def get_theme(theme_name: Optional[str] = None) -> ThemeColors:
    """Retrieve theme by ID, falling back to 'academic_navy'."""
    if not theme_name or theme_name.lower().strip() in ("auto", "automatic"):
        return THEMES["academic_navy"]
    key = theme_name.lower().strip().replace("-", "_").replace(" ", "_")
    return THEMES.get(key, THEMES["academic_navy"])


def auto_select_theme(title: str = "", text: str = "") -> str:
    """Intelligently determine the most suitable presentation theme based on topic semantics."""
    content = f"{title} {text}".lower()

    # 1. AI, Computer Science, Cyber, Robotics, Tech
    if any(k in content for k in (
        "artificial intelligence", "machine learning", "neural network", "deep learning",
        "transformer", "robotics", "cyber", "quantum", "software", "cloud curriculum",
        "computer vision", "natural language", "llm", "foundation model", "autonomous"
    )):
        if any(k in content for k in ("cyber", "matrix", "autonomous systems")):
            return "dark_tech"
        return "modern_blue"

    # 2. Healthcare, Medicine, Biology, Environmental, Climate, Genetics
    if any(k in content for k in (
        "medicine", "healthcare", "biology", "genomics", "oncology", "molecular",
        "climate", "ecology", "environmental", "pathology", "clinical", "hospital"
    )):
        return "emerald_pro"

    # 3. Creative, Arts, Design, Music, Philosophy, Psychology, Literature
    if any(k in content for k in (
        "creative", "design", "arts", "music", "philosophy", "literature",
        "psychology", "sociology", "ethics", "humanities", "culture"
    )):
        return "purple_gradient"

    # 4. Executive, Business, Economics, Finance, Management, Law
    if any(k in content for k in (
        "business", "finance", "economics", "management", "corporate",
        "accounting", "banking", "governance", "venture", "market", "executive"
    )):
        return "corporate_minimal"

    # 5. History, Classical Studies, Architecture, Engineering
    if any(k in content for k in (
        "history", "historical", "civilization", "archaeology", "monument",
        "heritage", "classical", "tradition"
    )):
        return "warm_creative"

    # Default Academic Foundation
    return "academic_navy"


def list_themes() -> List[Dict[str, Any]]:
    """Return serializable metadata list of all available themes for frontend selection."""
    return [
        {
            "id": t.id,
            "display_name": t.display_name,
            "description": t.description,
            "is_dark": t.is_dark,
            "font_heading": t.font_heading,
            "font_body": t.font_body,
            "colors": {
                "primary": t.hex_primary,
                "secondary": t.hex_secondary,
                "accent": t.hex_accent,
                "bg": t.hex_bg,
                "card": t.hex_card,
            },
        }
        for t in THEMES.values()
    ]


def list_layouts() -> List[Dict[str, Any]]:
    """Return serializable list of all supported layout styles."""
    return list(LAYOUT_FAMILIES.values())


class SlideLayoutEngine:
    """Provides consistent 16:9 widescreen layout components and theme styling."""

    SLIDE_WIDTH = Inches(13.333)
    SLIDE_HEIGHT = Inches(7.5)

    def __init__(self, theme: Optional[ThemeColors | str] = None):
        if isinstance(theme, str):
            self.colors = get_theme(theme)
        elif isinstance(theme, ThemeColors):
            self.colors = theme
        else:
            self.colors = get_theme("academic_navy")

        self.FONT_HEADING = self.colors.font_heading
        self.FONT_BODY = self.colors.font_body

    def set_presentation_dimensions(self, prs: Presentation) -> None:
        """Apply 16:9 widescreen dimensions to the presentation."""
        prs.slide_width = self.SLIDE_WIDTH
        prs.slide_height = self.SLIDE_HEIGHT

    def apply_canvas_background(self, slide: Slide, bg_color: Optional[RGBColor] = None) -> None:
        """Add a full-slide canvas background shape to guarantee color fidelity."""
        color = bg_color or self.colors.bg_light
        bg = slide.shapes.add_shape(
            MSO_SHAPE.RECTANGLE,
            Inches(0), Inches(0),
            self.SLIDE_WIDTH, self.SLIDE_HEIGHT
        )
        bg.name = "Background"
        bg.fill.solid()
        bg.fill.fore_color.rgb = color
        bg.line.fill.background()

    def add_header(
        self,
        slide: Slide,
        title: str,
        category: str = "CURRICULUM LECTURE",
        subtitle: Optional[str] = None
    ) -> None:
        """Add a professional academic header with a category badge, title, and divider rule."""
        # Category Badge text
        badge_box = slide.shapes.add_textbox(
            Inches(0.8), Inches(0.45), Inches(11.7), Inches(0.3)
        )
        tf_badge = badge_box.text_frame
        tf_badge.word_wrap = True
        tf_badge.margin_left = tf_badge.margin_top = tf_badge.margin_right = tf_badge.margin_bottom = 0
        p_badge = tf_badge.paragraphs[0]
        p_badge.text = category.upper()
        p_badge.font.name = self.FONT_HEADING
        p_badge.font.size = Pt(10)
        p_badge.font.bold = True
        p_badge.font.color.rgb = self.colors.accent

        # Title text - Intelligent text fitting and dynamic height
        clean_title = (title or "Curriculum Topic").strip()
        t_len = len(clean_title)
        if t_len <= 52:
            font_size = Pt(25)
            title_h = Inches(0.60)
            rule_top = Inches(1.45)
        elif t_len <= 95:
            font_size = Pt(21)
            title_h = Inches(0.76)
            rule_top = Inches(1.58)
        else:
            font_size = Pt(18)
            title_h = Inches(0.96)
            rule_top = Inches(1.78)

        title_box = slide.shapes.add_textbox(
            Inches(0.8), Inches(0.75), Inches(11.7), title_h
        )
        tf_title = title_box.text_frame
        tf_title.word_wrap = True
        tf_title.margin_left = tf_title.margin_top = tf_title.margin_right = tf_title.margin_bottom = 0
        p_title = tf_title.paragraphs[0]
        p_title.text = clean_title
        p_title.font.name = self.FONT_HEADING
        p_title.font.size = font_size
        p_title.font.bold = True
        # For dark theme, ensure high-contrast heading
        p_title.font.color.rgb = self.colors.primary if not self.colors.is_dark else self.colors.accent

        # Horizontal accent rule - safely positioned below title text
        rule = slide.shapes.add_shape(
            MSO_SHAPE.RECTANGLE,
            Inches(0.8), rule_top, Inches(11.7), Inches(0.02)
        )
        rule.fill.solid()
        rule.fill.fore_color.rgb = self.colors.card_border
        rule.line.fill.background()

        # Small colored marker on the left of the rule
        marker = slide.shapes.add_shape(
            MSO_SHAPE.RECTANGLE,
            Inches(0.8), rule_top - Inches(0.01), Inches(0.8), Inches(0.04)
        )
        marker.fill.solid()
        marker.fill.fore_color.rgb = self.colors.secondary
        marker.line.fill.background()

        return rule_top


    def add_footer(
        self,
        slide: Slide,
        slide_num: int,
        total_slides: int,
        presentation_title: str,
        institution: str = "Acadion Learning"
    ) -> None:
        """Add standardized footer with slide number and course metadata."""
        # Top line for footer
        footer_line = slide.shapes.add_shape(
            MSO_SHAPE.RECTANGLE,
            Inches(0.8), Inches(6.8), Inches(11.7), Inches(0.01)
        )
        footer_line.fill.solid()
        footer_line.fill.fore_color.rgb = self.colors.card_border
        footer_line.line.fill.background()

        # Left label: Institution & Course Title
        left_box = slide.shapes.add_textbox(
            Inches(0.8), Inches(6.88), Inches(8.0), Inches(0.3)
        )
        tf_left = left_box.text_frame
        tf_left.word_wrap = True
        tf_left.margin_left = tf_left.margin_top = tf_left.margin_right = tf_left.margin_bottom = 0
        p_left = tf_left.paragraphs[0]
        p_left.text = f"{institution}  •  {presentation_title}"
        p_left.font.name = self.FONT_BODY
        p_left.font.size = Pt(9.5)
        p_left.font.color.rgb = self.colors.text_muted

        # Right label: Slide number
        right_box = slide.shapes.add_textbox(
            Inches(9.5), Inches(6.88), Inches(3.0), Inches(0.3)
        )
        tf_right = right_box.text_frame
        tf_right.word_wrap = True
        tf_right.margin_left = tf_right.margin_top = tf_right.margin_right = tf_right.margin_bottom = 0
        p_right = tf_right.paragraphs[0]
        p_right.alignment = PP_ALIGN.RIGHT
        p_right.text = f"Slide {slide_num} of {total_slides}"
        p_right.font.name = self.FONT_BODY
        p_right.font.size = Pt(9.5)
        p_right.font.bold = True
        p_right.font.color.rgb = self.colors.text_muted

    def create_card_container(
        self,
        slide: Slide,
        left: Inches,
        top: Inches,
        width: Inches,
        height: Inches,
        accent_color: Optional[RGBColor] = None,
        bg_color: Optional[RGBColor] = None,
    ) -> None:
        """Draw a card container with an accent strip on the left edge."""
        # Card body
        card = slide.shapes.add_shape(
            MSO_SHAPE.ROUNDED_RECTANGLE,
            left, top, width, height
        )
        card.fill.solid()
        card.fill.fore_color.rgb = bg_color or self.colors.card_bg
        card.line.color.rgb = self.colors.card_border
        card.line.width = Pt(1)

        # Left accent strip
        strip = slide.shapes.add_shape(
            MSO_SHAPE.ROUNDED_RECTANGLE,
            left, top, Inches(0.12), height
        )
        strip.fill.solid()
        strip.fill.fore_color.rgb = accent_color or self.colors.secondary
        strip.line.fill.background()
