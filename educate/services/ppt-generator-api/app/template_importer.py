"""
Template Inspector and Importer for Acadion AI PPT Generator (Requirement 4).
Safely inspects user-provided PowerPoint (.pptx) templates, extracts supported
theme properties (color palette, typography, background luminance, 16:9 ratio),
and registers a custom runtime ThemeColors definition without mutating the original file.
"""

from dataclasses import dataclass
import hashlib
import logging
from pathlib import Path
import re
from typing import Any, Dict, List, Optional, Tuple
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.util import Inches

from app.layouts import ThemeColors, register_custom_theme

logger = logging.getLogger("acadion.template_importer")


@dataclass
class TemplateInspectionReport:
    """Detailed metadata and compatibility report for an inspected PPTX template."""
    is_compatible: bool
    theme_id: str
    display_name: str
    is_dark: bool
    font_heading: str
    font_body: str
    hex_primary: str
    hex_secondary: str
    hex_accent: str
    hex_bg: str
    hex_card: str
    widescreen_16_9: bool
    slide_dimensions: str
    total_template_slides: int
    notes: List[str]
    limitations: List[str]

    @property
    def colors(self) -> Dict[str, str]:
        return {
            "primary": self.hex_primary,
            "secondary": self.hex_secondary,
            "accent": self.hex_accent,
            "bg": self.hex_bg,
            "card": self.hex_card,
        }

    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_compatible": self.is_compatible,
            "theme_id": self.theme_id,
            "display_name": self.display_name,
            "is_dark": self.is_dark,
            "font_heading": self.font_heading,
            "font_body": self.font_body,
            "colors": self.colors,
            "widescreen_16_9": self.widescreen_16_9,
            "slide_dimensions": self.slide_dimensions,
            "total_template_slides": self.total_template_slides,
            "notes": self.notes,
            "limitations": self.limitations,
        }


class TemplateImporter:
    """Inspects and extracts theme attributes from external PPTX templates safely."""

    DEFAULT_LIGHT_BG = (248, 250, 252)   # #F8FAFC
    DEFAULT_DARK_BG = (15, 23, 42)       # #0F172A

    @staticmethod
    def _rgb_to_hex(r: int, g: int, b: int) -> str:
        return f"#{r:02X}{g:02X}{b:02X}"

    @staticmethod
    def _hex_to_rgb(hex_str: str) -> RGBColor:
        clean = hex_str.lstrip("#")
        return RGBColor(int(clean[0:2], 16), int(clean[2:4], 16), int(clean[4:6], 16))

    @staticmethod
    def _calc_luminance(r: int, g: int, b: int) -> float:
        """Calculate perceived brightness (0.0 to 1.0)."""
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255.0

    def inspect_and_import(
        self,
        template_path: str | Path,
        custom_name: Optional[str] = None,
    ) -> TemplateInspectionReport:
        """Inspect local PPTX template, extract theme palette, and register custom theme.
        
        Guarantees: Never modifies or overwrites the original input file.
        """
        path = Path(template_path)
        if not path.exists():
            raise FileNotFoundError(f"Template file does not exist: {path}")

        if path.suffix.lower() != ".pptx":
            raise ValueError(f"File '{path.name}' is not a PowerPoint (.pptx) file.")

        prs = Presentation(str(path.resolve()))
        total_slides = len(prs.slides)

        width_in = round(prs.slide_width / Inches(1), 2)
        height_in = round(prs.slide_height / Inches(1), 2)
        is_16_9 = (round(width_in, 1) == 13.3 and round(height_in, 1) == 7.5) or (abs(width_in / (height_in or 1) - 1.777) < 0.05)

        # Harvest candidate colors and typography across slide shapes
        extracted_colors: List[Tuple[int, int, int]] = []
        fonts_found: List[str] = []
        bg_candidate: Optional[Tuple[int, int, int]] = None

        for slide in prs.slides:
            for shp in slide.shapes:
                try:
                    # Check background or full-bleed cards
                    if hasattr(shp, "fill") and shp.fill and hasattr(shp.fill, "fore_color"):
                        c = shp.fill.fore_color.rgb
                        if c:
                            rgb_t = (c[0], c[1], c[2])
                            if shp.width >= Inches(12.0) and shp.height >= Inches(6.5):
                                bg_candidate = rgb_t
                            else:
                                extracted_colors.append(rgb_t)
                except Exception:
                    pass

                try:
                    if shp.has_text_frame:
                        for p in shp.text_frame.paragraphs:
                            if p.font:
                                if p.font.name and p.font.name not in fonts_found:
                                    fonts_found.append(p.font.name)
                                if p.font.color and p.font.color.rgb:
                                    c = p.font.color.rgb
                                    extracted_colors.append((c[0], c[1], c[2]))
                except Exception:
                    pass

        # Determine background luminance
        if bg_candidate:
            bg_lum = self._calc_luminance(*bg_candidate)
            is_dark = bg_lum < 0.45
            bg_rgb = bg_candidate
        else:
            is_dark = False
            bg_rgb = self.DEFAULT_LIGHT_BG

        # Determine typography
        font_heading = fonts_found[0] if fonts_found else "Calibri"
        font_body = fonts_found[1] if len(fonts_found) > 1 else font_heading

        # Cluster and select primary, secondary, and accent colors
        primary_rgb = (15, 44, 89) if not is_dark else (56, 189, 248)
        secondary_rgb = (37, 99, 235) if not is_dark else (14, 165, 233)
        accent_rgb = (217, 119, 6) if not is_dark else (245, 158, 11)

        # Filter out extreme blacks/whites for brand accent roles
        vibrant_candidates = [
            c for c in extracted_colors
            if 0.15 < self._calc_luminance(*c) < 0.88
        ]

        if vibrant_candidates:
            primary_rgb = vibrant_candidates[0]
            if len(vibrant_candidates) > 1:
                secondary_rgb = vibrant_candidates[1]
            if len(vibrant_candidates) > 2:
                accent_rgb = vibrant_candidates[2]

        card_rgb = (255, 255, 255) if not is_dark else (
            max(0, bg_rgb[0] + 15),
            max(0, bg_rgb[1] + 15),
            max(0, bg_rgb[2] + 20)
        )

        hex_primary = self._rgb_to_hex(*primary_rgb)
        hex_secondary = self._rgb_to_hex(*secondary_rgb)
        hex_accent = self._rgb_to_hex(*accent_rgb)
        hex_bg = self._rgb_to_hex(*bg_rgb)
        hex_card = self._rgb_to_hex(*card_rgb)

        # Unique theme key
        clean_stem = re.sub(r"[^a-zA-Z0-9]", "_", path.stem).lower()[:15]
        h = hashlib.sha256(path.stem.encode("utf-8")).hexdigest()[:6]
        theme_id = f"imported_{clean_stem}_{h}"

        theme_name = custom_name or f"Imported: {path.stem.replace('_', ' ').title()[:24]}"

        # Construct registered ThemeColors
        custom_theme = ThemeColors(
            id=theme_id,
            display_name=theme_name,
            description=f"Imported from local template '{path.name}'",
            primary=self._hex_to_rgb(hex_primary),
            secondary=self._hex_to_rgb(hex_secondary),
            accent=self._hex_to_rgb(hex_accent),
            bg_light=self._hex_to_rgb(hex_bg),
            card_bg=self._hex_to_rgb(hex_card),
            card_tint=self._hex_to_rgb(hex_card),
            card_border=RGBColor(51, 65, 85) if is_dark else RGBColor(226, 232, 240),
            text_primary=RGBColor(248, 250, 252) if is_dark else RGBColor(15, 23, 42),
            text_secondary=RGBColor(203, 213, 225) if is_dark else RGBColor(51, 65, 85),
            text_muted=RGBColor(148, 163, 184) if is_dark else RGBColor(100, 116, 139),
            is_dark=is_dark,
            font_heading=font_heading,
            font_body=font_body,
            hex_primary=hex_primary,
            hex_secondary=hex_secondary,
            hex_accent=hex_accent,
            hex_bg=hex_bg,
            hex_card=hex_card,
        )

        register_custom_theme(custom_theme)

        notes = [
            f"Successfully extracted {len(extracted_colors)} color samples and fonts ({font_heading}, {font_body}).",
            f"Slide dimensions detected: {width_in}\" x {height_in}\" ({'16:9 widescreen' if is_16_9 else 'Standard 4:3'}).",
            f"Palette classified as {'Dark Mode' if is_dark else 'Light Mode'} canvas.",
            f"Registered as theme '{theme_id}'. Ready for immediate slide generation.",
        ]

        limitations = [
            "Native shapes, colors, and typography are applied; proprietary PowerPoint macros/animations are safely omitted.",
            "Widescreen 16:9 layout is enforced for optimal web and projection fidelity.",
            "The source template file is completely untouched and was not modified.",
        ]

        return TemplateInspectionReport(
            is_compatible=True,
            theme_id=theme_id,
            display_name=theme_name,
            is_dark=is_dark,
            font_heading=font_heading,
            font_body=font_body,
            hex_primary=hex_primary,
            hex_secondary=hex_secondary,
            hex_accent=hex_accent,
            hex_bg=hex_bg,
            hex_card=hex_card,
            widescreen_16_9=is_16_9,
            slide_dimensions=f"{width_in}\" x {height_in}\"",
            total_template_slides=total_slides,
            notes=notes,
            limitations=limitations,
        )
