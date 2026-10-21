"""
Readability-First Layout Engine & Post-Serialization PPTX Validator.
Enforces:
1. Strict hard maximum slide count on exported PPTX.
2. Composed slide validation for text wrapping, readable font sizes, shape bounds, and overlaps.
3. 4-stage fallback order for overflowing or dense content:
   - Reflow & resize within chosen layout.
   - Reduce decorative elements / duplicate labels.
   - Switch to suitable alternate layout (e.g. cards -> two-column).
   - Critical emergency fallback to clean default content layout (content_bullets).
4. Post-serialization inspection of the actual PPTX file using python-pptx.
"""

from dataclasses import dataclass, field
import logging
from pathlib import Path
import re
from typing import Any, Dict, List, Optional, Tuple

import pptx
from pptx.util import Inches, Pt
from pptx.enum.shapes import MSO_SHAPE

logger = logging.getLogger("acadion.readability_validator")

# Standard 16:9 widescreen dimensions in EMUs
SLIDE_WIDTH_EMU = 12192000   # 13.333 inches
SLIDE_HEIGHT_EMU = 6858000   # 7.500 inches
SAFE_MARGIN_EMU = 182880     # 0.2 inches safe margin


@dataclass
class SlideLayoutAssessment:
    """Assessment of an individual slide's readability, bounds, and layout health."""
    slide_num: int
    has_serious_issue: bool = False
    issue_type: Optional[str] = None  # "overflow", "overlap", "out_of_bounds", "tiny_font"
    recommended_action: Optional[str] = None  # "reflow", "simplify", "switch_layout", "default_fallback"
    details: str = ""


@dataclass
class PPTXValidationResult:
    """Rigorous post-serialization validation result for an exported presentation."""
    pptx_path: Path
    requested_max_slides: int
    actual_exported_slides: int
    hard_limit_passed: bool
    serious_layout_issues_detected: int = 0
    issues_automatically_repaired: int = 0
    warnings: List[str] = field(default_factory=list)
    slide_assessments: List[SlideLayoutAssessment] = field(default_factory=list)


class ReadabilityValidator:
    """Validates and enforces layout readability, non-overlapping shapes, and slide count limits."""

    # Words-per-container thresholds before layout starts overcrowding
    LAYOUT_WORD_CAPACITIES = {
        "cards_grid_2x2": 160,       # 4 cards x 40 words max
        "cards_grid_3col": 120,      # 3 cards x 40 words max
        "process_chevrons": 100,     # 5 steps x 20 words max
        "multi_column": 150,         # 3 columns x 50 words max
        "two_column": 200,           # 2 columns x 100 words max
        "editorial": 180,            # 1 key takeaway + 3 bullets
        "content_bullets": 240,      # Clean default content layout with expansive container
        "stats_metrics": 80,         # Metric cards
    }

    @classmethod
    def evaluate_content_for_layout(
        cls,
        layout_type: str,
        title: str,
        bullets: List[Any],
        paragraphs: Optional[List[str]] = None,
    ) -> Tuple[str, List[str]]:
        """Determine if requested layout can readably fit content, or select fallback layout.
        
        Fallback Hierarchy:
        1. Keep layout with reflowed spacing (if slight overage).
        2. Switch to two_column or editorial (if medium overage).
        3. Emergency fallback to clean default content layout (content_bullets).
        """
        paragraphs = paragraphs or []
        bullet_texts = [getattr(b, "text", str(b)) for b in bullets]
        total_text = " ".join(bullet_texts + paragraphs)
        total_words = len(total_text.split())
        num_bullets = len(bullets)
        warnings: List[str] = []

        target_layout = layout_type.lower().strip()

        # Check cards_grid
        if target_layout in ("cards_grid", "cards"):
            if num_bullets > 4:
                warnings.append(f"Cards layout limited to 4 items; content has {num_bullets} bullets. Falling back to clean content layout.")
                return "content_bullets", warnings
            # If total words exceed card capacity or any individual card is too dense, fallback
            if total_words > 80:
                warnings.append(f"Cards grid total word count ({total_words}) exceeds readable threshold (80). Falling back to two_column layout.")
                return "two_column", warnings
            for idx, text in enumerate(bullet_texts):
                if len(text.split()) > 25 or len(text) > 150:
                    warnings.append(f"Card {idx+1} exceeds readable character/word limit for grid cards. Falling back to two_column layout.")
                    return "two_column", warnings

        # Check process_chevrons
        elif target_layout in ("process_chevrons", "chevrons"):
            if num_bullets > 5:
                warnings.append(f"Process chevrons limited to 5 steps; content has {num_bullets}. Falling back to clean content layout.")
                return "content_bullets", warnings
            for idx, text in enumerate(bullet_texts):
                if len(text.split()) > 22 or len(text) > 130:
                    warnings.append(f"Step {idx+1} in process chevrons exceeds readable length. Falling back to clean content layout.")
                    return "content_bullets", warnings

        # Check multi_column (3 columns)
        elif target_layout in ("multi_column", "three_column"):
            if num_bullets > 3:
                warnings.append(f"Multi-column layout accommodates 3 columns; content has {num_bullets}. Falling back to clean content layout.")
                return "content_bullets", warnings
            for idx, text in enumerate(bullet_texts):
                if len(text.split()) > 45 or len(text) > 250:
                    warnings.append(f"Column {idx+1} text exceeds 45 words. Falling back to two_column layout.")
                    return "two_column", warnings

        # Check stats_metrics
        elif target_layout in ("stats_metrics", "kpi_metric_trio"):
            if num_bullets > 4 or total_words > 70:
                warnings.append("Content too extensive for KPI metrics cards. Falling back to clean content layout.")
                return "content_bullets", warnings

        # Check case_study
        elif target_layout in ("case_study",):
            if num_bullets < 3 and len(paragraphs) < 2:
                warnings.append("Case study layout requires at least 3 distinct items to avoid card repetition. Falling back to editorial layout.")
                return "editorial", warnings

        # Default clean fallback check
        max_allowed_words = cls.LAYOUT_WORD_CAPACITIES.get(target_layout, 180)
        if total_words > max_allowed_words:
            warnings.append(f"Total word count ({total_words}) exceeds {target_layout} capacity ({max_allowed_words}). Using clean default content layout.")
            return "content_bullets", warnings

        return target_layout, warnings

    @classmethod
    def validate_pptx(
        cls,
        pptx_path: str | Path,
        max_allowed_slides: int,
    ) -> PPTXValidationResult:
        """Inspect the final exported PPTX file using python-pptx to verify strict slide count and readability."""
        path = Path(pptx_path)
        if not path.exists():
            raise FileNotFoundError(f"Exported PPTX file does not exist: {path}")

        prs = pptx.Presentation(str(path))
        actual_slides = len(prs.slides)
        hard_limit_passed = actual_slides <= max_allowed_slides

        warnings: List[str] = []
        if not hard_limit_passed:
            warnings.append(
                f"HARD LIMIT BREACH: Presentation contains {actual_slides} slides, "
                f"which exceeds the user-configured hard limit of {max_allowed_slides} slides."
            )

        serious_issues = 0
        repaired_issues = 0
        assessments: List[SlideLayoutAssessment] = []

        slide_w = prs.slide_width
        slide_h = prs.slide_height

        for s_idx, slide in enumerate(prs.slides, 1):
            assessment = SlideLayoutAssessment(slide_num=s_idx)
            text_shapes = []

            for shape in slide.shapes:
                # 1. Check shape boundaries
                s_left = shape.left
                s_top = shape.top
                s_w = shape.width
                s_h = shape.height

                # Allow small tolerance for edge-to-edge decorative banners
                if (
                    s_left < -SAFE_MARGIN_EMU
                    or s_top < -SAFE_MARGIN_EMU
                    or (s_left + s_w) > (slide_w + SAFE_MARGIN_EMU)
                    or (s_top + s_h) > (slide_h + SAFE_MARGIN_EMU)
                ):
                    # Decorative hero bars extending across canvas are legitimate
                    if not (shape.shape_type == MSO_SHAPE.RECTANGLE and (s_w >= slide_w or s_h >= slide_h)):
                        assessment.has_serious_issue = True
                        assessment.issue_type = "out_of_bounds"
                        assessment.details += f"Shape '{shape.name}' extends beyond slide bounds. "

                if shape.has_text_frame and shape.text_frame.text.strip():
                    text_shapes.append(shape)
                    tf = shape.text_frame
                    # 2. Check font sizes
                    for p in tf.paragraphs:
                        if p.font and p.font.size and p.font.size.pt < 8.5:
                            assessment.has_serious_issue = True
                            assessment.issue_type = "tiny_font"
                            assessment.details += f"Font size {p.font.size.pt:.1f}pt is too small for classroom readability. "

                    # 3. Check character density (characters vs bounding box area)
                    box_sq_in = max(0.5, (s_w / 914400.0) * (s_h / 914400.0))
                    char_count = len(tf.text.strip())
                    chars_per_sq_in = char_count / box_sq_in
                    if chars_per_sq_in > 175:
                        assessment.has_serious_issue = True
                        assessment.issue_type = "overflow"
                        assessment.details += f"Text density ({chars_per_sq_in:.0f} chars/sq.in) risks visual overflow. "

            # 4. Check for unintended text box overlapping (excluding intentional nested containers)
            for i in range(len(text_shapes)):
                for j in range(i + 1, len(text_shapes)):
                    sh1, sh2 = text_shapes[i], text_shapes[j]
                    if not sh1.text_frame.text.strip() or not sh2.text_frame.text.strip():
                        continue
                    if cls._shapes_overlap(sh1, sh2):
                        # Verify this is not a card background containing its label
                        if not cls._is_parent_container(sh1, sh2) and not cls._is_parent_container(sh2, sh1):
                            assessment.has_serious_issue = True
                            assessment.issue_type = "overlap"
                            assessment.details += f"Text shapes '{sh1.name}' and '{sh2.name}' collide. "

            # 5. Check for empty or bullet-marker-only content slides
            if s_idx > 1:
                body_texts = []
                for sh in text_shapes:
                    txt = sh.text_frame.text.strip()
                    # Skip header title / category / footer / slide number (top < 1.5" or top > 6.8")
                    if sh.top < 1371600 or sh.top > 6217920:
                        continue
                    body_texts.append(txt)

                all_body = "\n".join(body_texts).strip()
                if body_texts and not re.search(r"[A-Za-z0-9]{2,}", all_body):
                    assessment.has_serious_issue = True
                    assessment.issue_type = "empty_bullet_slide"
                    assessment.details += "Slide contains only empty bullet markers without substantive educational text. "
                elif not body_texts:
                    # Content slide with no body content shapes
                    assessment.has_serious_issue = True
                    assessment.issue_type = "empty_slide"
                    assessment.details += "Slide contains no body content shapes. "

            if assessment.has_serious_issue:
                serious_issues += 1
                warnings.append(f"Slide {s_idx}: {assessment.details.strip()}")

            assessments.append(assessment)

        return PPTXValidationResult(
            pptx_path=path,
            requested_max_slides=max_allowed_slides,
            actual_exported_slides=actual_slides,
            hard_limit_passed=hard_limit_passed,
            serious_layout_issues_detected=serious_issues,
            issues_automatically_repaired=repaired_issues,
            warnings=warnings,
            slide_assessments=assessments,
        )

    @staticmethod
    def _shapes_overlap(sh1, sh2) -> bool:
        """Check if two shapes have overlapping bounding rectangles."""
        l1, t1, r1, b1 = sh1.left, sh1.top, sh1.left + sh1.width, sh1.top + sh1.height
        l2, t2, r2, b2 = sh2.left, sh2.top, sh2.left + sh2.width, sh2.top + sh2.height

        # Strict non-overlap check
        if l1 >= r2 or l2 >= r1 or t1 >= b2 or t2 >= b1:
            return False

        # Compute intersection area
        x_overlap = max(0, min(r1, r2) - max(l1, l2))
        y_overlap = max(0, min(b1, b2) - max(t1, t2))
        intersection = x_overlap * y_overlap

        # Only flag if overlap is significant (> 10% of smaller shape)
        area1 = max(1, sh1.width * sh1.height)
        area2 = max(1, sh2.width * sh2.height)
        smaller_area = min(area1, area2)

        return (intersection / smaller_area) > 0.10

    @staticmethod
    def _is_parent_container(container, child) -> bool:
        """Check if child shape is geometrically contained inside container shape."""
        c_l, c_t, c_r, c_b = container.left, container.top, container.left + container.width, container.top + container.height
        ch_l, ch_t, ch_r, ch_b = child.left, child.top, child.left + child.width, child.top + child.height

        # Tolerate small coordinate offsets (0.1 inch)
        tol = 91440
        return (c_l - tol <= ch_l) and (c_t - tol <= ch_t) and (ch_r <= c_r + tol) and (ch_b <= c_b + tol)
