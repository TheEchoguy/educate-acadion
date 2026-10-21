"""
Diagram and Visual Rendering Engine for Acadion AI PPT Generator (Phase 3).
Renders 100% native, fully editable PowerPoint shapes, connectors, and validated local images.
"""

from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Tuple
from PIL import Image
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.slide import Slide
from pptx.util import Inches, Pt

from app.layouts import SlideLayoutEngine, ThemeColors
from app.models import (
    ComparisonColumn,
    ComparisonData,
    ConceptMapData,
    ImageData,
    InvalidVisualDataError,
    ProcessFlowData,
    TimelineData,
    VisualRenderError,
)


@dataclass
class RectBounds:
    """Bounding box for diagram positioning on 16:9 canvas."""
    left: Inches
    top: Inches
    width: Inches
    height: Inches

    @property
    def right(self) -> Inches:
        return self.left + self.width

    @property
    def bottom(self) -> Inches:
        return self.top + self.height


class DiagramRenderer:
    """Renders native editable PowerPoint diagrams and validated images."""

    ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
    MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024  # 15 MB

    def __init__(self, layout_engine: Optional[SlideLayoutEngine] = None):
        self.layout = layout_engine or SlideLayoutEngine()
        self.colors = self.layout.colors

    # =========================================================================
    # 1. Process Flowchart
    # =========================================================================

    def render_process_flow(
        self,
        slide: Slide,
        data: ProcessFlowData,
        bounds: RectBounds,
    ) -> bool:
        """Render a horizontal process flowchart with sequential cards and directional arrows."""
        steps = data.steps
        if not steps or len(steps) < 2:
            raise InvalidVisualDataError("Process flow requires at least 2 steps.")

        # Cap at 5 steps to ensure readability on 16:9 widescreen
        active_steps = steps[:5]
        count = len(active_steps)

        arrow_w = Inches(0.35)
        arrow_h = Inches(0.4)
        margin_x = Inches(0.15)

        total_arrow_space = (count - 1) * (arrow_w + (margin_x * 2))
        available_card_space = bounds.width - total_arrow_space
        card_w = available_card_space / count
        card_h = min(bounds.height, Inches(3.6))

        curr_x = bounds.left
        card_top = bounds.top + (bounds.height - card_h) / 2

        for idx, step in enumerate(active_steps):
            # Step card container
            card = slide.shapes.add_shape(
                MSO_SHAPE.ROUNDED_RECTANGLE,
                curr_x, card_top, card_w, card_h
            )
            card.fill.solid()
            card.fill.fore_color.rgb = self.colors.card_bg
            card.line.color.rgb = self.colors.card_border
            card.line.width = Pt(1)

            # Top accent bar
            bar = slide.shapes.add_shape(
                MSO_SHAPE.ROUNDED_RECTANGLE,
                curr_x, card_top, card_w, Inches(0.08)
            )
            bar.fill.solid()
            bar.fill.fore_color.rgb = self.colors.secondary
            bar.line.fill.background()

            # Step number badge
            badge_w = Inches(0.9)
            badge_h = Inches(0.35)
            badge = slide.shapes.add_shape(
                MSO_SHAPE.ROUNDED_RECTANGLE,
                curr_x + (card_w - badge_w) / 2, card_top + Inches(0.25),
                badge_w, badge_h
            )
            badge.fill.solid()
            badge.fill.fore_color.rgb = self.colors.card_tint
            badge.line.color.rgb = self.colors.secondary
            badge.line.width = Pt(1)

            tf_badge = badge.text_frame
            tf_badge.word_wrap = True
            p_badge = tf_badge.paragraphs[0]
            p_badge.text = f"STEP {step.step_number or idx + 1:02d}"
            p_badge.font.name = self.layout.FONT_HEADING
            p_badge.font.size = Pt(9.5)
            p_badge.font.bold = True
            p_badge.font.color.rgb = self.colors.secondary
            p_badge.alignment = PP_ALIGN.CENTER

            # Title text box
            title_box = slide.shapes.add_textbox(
                curr_x + Inches(0.15), card_top + Inches(0.75),
                card_w - Inches(0.3), Inches(0.8)
            )
            tf_title = title_box.text_frame
            tf_title.word_wrap = True
            p_title = tf_title.paragraphs[0]
            p_title.text = self._truncate(step.title, 60)
            p_title.font.name = self.layout.FONT_HEADING
            p_title.font.size = Pt(13)
            p_title.font.bold = True
            p_title.font.color.rgb = self.colors.primary
            p_title.alignment = PP_ALIGN.CENTER

            # Description text box
            if step.description:
                desc_box = slide.shapes.add_textbox(
                    curr_x + Inches(0.18), card_top + Inches(1.6),
                    card_w - Inches(0.36), card_h - Inches(1.75)
                )
                tf_desc = desc_box.text_frame
                tf_desc.word_wrap = True
                p_desc = tf_desc.paragraphs[0]
                p_desc.text = self._truncate(step.description, 140)
                p_desc.font.name = self.layout.FONT_BODY
                p_desc.font.size = Pt(11)
                p_desc.font.color.rgb = self.colors.text_secondary
                p_desc.line_spacing = 1.2

            curr_x += card_w

            # Draw directional arrow connector between steps
            if idx < count - 1:
                arrow_x = curr_x + margin_x
                arrow_y = card_top + (card_h - arrow_h) / 2
                arrow = slide.shapes.add_shape(
                    MSO_SHAPE.RIGHT_ARROW,
                    arrow_x, arrow_y, arrow_w, arrow_h
                )
                arrow.fill.solid()
                arrow.fill.fore_color.rgb = self.colors.accent
                arrow.line.fill.background()
                curr_x += arrow_w + (margin_x * 2)

        return True

    # =========================================================================
    # 2. Timeline
    # =========================================================================

    def render_timeline(
        self,
        slide: Slide,
        data: TimelineData,
        bounds: RectBounds,
    ) -> bool:
        """Render a horizontal timeline with chronological milestone cards and axis line."""
        milestones = data.milestones
        if not milestones or len(milestones) < 2:
            raise InvalidVisualDataError("Timeline requires at least 2 milestones.")

        active_milestones = milestones[:5]
        count = len(active_milestones)

        axis_y = bounds.top + Inches(0.7)
        card_top = axis_y + Inches(0.4)
        card_h = bounds.height - (card_top - bounds.top)

        # Draw main horizontal axis line
        axis_line = slide.shapes.add_shape(
            MSO_SHAPE.RECTANGLE,
            bounds.left, axis_y, bounds.width, Inches(0.04)
        )
        axis_line.fill.solid()
        axis_line.fill.fore_color.rgb = self.colors.secondary
        axis_line.line.fill.background()

        gap = Inches(0.25)
        card_w = (bounds.width - (gap * (count - 1))) / count

        for idx, m in enumerate(active_milestones):
            card_x = bounds.left + idx * (card_w + gap)
            center_x = card_x + (card_w / 2)

            # Circular marker on the axis
            marker_size = Inches(0.28)
            marker = slide.shapes.add_shape(
                MSO_SHAPE.OVAL,
                center_x - (marker_size / 2),
                axis_y - (marker_size / 2) + Inches(0.02),
                marker_size, marker_size
            )
            marker.fill.solid()
            marker.fill.fore_color.rgb = self.colors.accent
            marker.line.color.rgb = self.colors.card_bg
            marker.line.width = Pt(2)

            # Date / Period pill badge above the marker
            badge_w = min(card_w - Inches(0.2), Inches(1.8))
            badge_h = Inches(0.35)
            badge = slide.shapes.add_shape(
                MSO_SHAPE.ROUNDED_RECTANGLE,
                center_x - (badge_w / 2),
                axis_y - Inches(0.55),
                badge_w, badge_h
            )
            badge.fill.solid()
            badge.fill.fore_color.rgb = self.colors.primary
            badge.line.fill.background()

            tf_badge = badge.text_frame
            tf_badge.word_wrap = True
            p_badge = tf_badge.paragraphs[0]
            p_badge.text = self._truncate(m.date_or_period, 20)
            p_badge.font.name = self.layout.FONT_HEADING
            p_badge.font.size = Pt(10)
            p_badge.font.bold = True
            p_badge.font.color.rgb = self.colors.text_white
            p_badge.alignment = PP_ALIGN.CENTER

            # Milestone description card below the axis
            card = slide.shapes.add_shape(
                MSO_SHAPE.ROUNDED_RECTANGLE,
                card_x, card_top, card_w, card_h
            )
            card.fill.solid()
            card.fill.fore_color.rgb = self.colors.card_bg
            card.line.color.rgb = self.colors.card_border
            card.line.width = Pt(1)

            # Milestone title
            title_box = slide.shapes.add_textbox(
                card_x + Inches(0.12), card_top + Inches(0.15),
                card_w - Inches(0.24), Inches(0.9)
            )
            tf_title = title_box.text_frame
            tf_title.word_wrap = True
            p_title = tf_title.paragraphs[0]
            p_title.text = self._truncate(m.title, 55)
            p_title.font.name = self.layout.FONT_HEADING
            p_title.font.size = Pt(12.5)
            p_title.font.bold = True
            p_title.font.color.rgb = self.colors.primary

            # Milestone description
            if m.description:
                desc_box = slide.shapes.add_textbox(
                    card_x + Inches(0.12), card_top + Inches(1.05),
                    card_w - Inches(0.24), card_h - Inches(1.15)
                )
                tf_desc = desc_box.text_frame
                tf_desc.word_wrap = True
                p_desc = tf_desc.paragraphs[0]
                p_desc.text = self._truncate(m.description, 160)
                p_desc.font.name = self.layout.FONT_BODY
                p_desc.font.size = Pt(11)
                p_desc.font.color.rgb = self.colors.text_secondary
                p_desc.line_spacing = 1.2

        return True

    # =========================================================================
    # 3. Two-Column Comparison Diagram
    # =========================================================================

    def render_comparison(
        self,
        slide: Slide,
        data: ComparisonData,
        bounds: RectBounds,
    ) -> bool:
        """Render a native two-column comparison diagram with header blocks and VS badge."""
        left_col = data.left_column
        right_col = data.right_column
        if not left_col or not right_col:
            raise InvalidVisualDataError("Comparison diagram requires both left and right columns.")

        takeaway_h = Inches(0.85) if data.takeaway else Inches(0)
        card_h = bounds.height - takeaway_h - (Inches(0.2) if data.takeaway else Inches(0))

        gap = Inches(0.7)
        card_w = (bounds.width - gap) / 2

        left_x = bounds.left
        right_x = bounds.left + card_w + gap

        # Render Left Column Card
        self._render_comparison_card(
            slide, left_col, left_x, bounds.top, card_w, card_h,
            header_color=self.colors.primary,
            tag_color=self.colors.accent,
        )

        # Render Right Column Card
        self._render_comparison_card(
            slide, right_col, right_x, bounds.top, card_w, card_h,
            header_color=self.colors.secondary,
            tag_color=self.colors.primary,
        )

        # Center "VS" Circular Badge
        vs_size = Inches(0.75)
        vs_x = bounds.left + card_w + (gap - vs_size) / 2
        vs_y = bounds.top + Inches(0.4)
        vs_circle = slide.shapes.add_shape(
            MSO_SHAPE.OVAL, vs_x, vs_y, vs_size, vs_size
        )
        vs_circle.fill.solid()
        vs_circle.fill.fore_color.rgb = self.colors.accent
        vs_circle.line.color.rgb = self.colors.card_bg
        vs_circle.line.width = Pt(2)

        tf_vs = vs_circle.text_frame
        p_vs = tf_vs.paragraphs[0]
        p_vs.text = "VS"
        p_vs.font.name = self.layout.FONT_HEADING
        p_vs.font.size = Pt(13)
        p_vs.font.bold = True
        p_vs.font.color.rgb = self.colors.text_white
        p_vs.alignment = PP_ALIGN.CENTER

        # Bottom Takeaway Card (if present)
        if data.takeaway:
            takeaway_top = bounds.top + card_h + Inches(0.2)
            takeaway_card = slide.shapes.add_shape(
                MSO_SHAPE.ROUNDED_RECTANGLE,
                bounds.left, takeaway_top, bounds.width, takeaway_h
            )
            takeaway_card.fill.solid()
            takeaway_card.fill.fore_color.rgb = self.colors.card_tint
            takeaway_card.line.color.rgb = self.colors.secondary
            takeaway_card.line.width = Pt(1)

            tb = slide.shapes.add_textbox(
                bounds.left + Inches(0.2), takeaway_top + Inches(0.12),
                bounds.width - Inches(0.4), takeaway_h - Inches(0.2)
            )
            tf_t = tb.text_frame
            tf_t.word_wrap = True
            p_t1 = tf_t.paragraphs[0]
            p_t1.text = "KEY DISTINCTION & TAKEAWAY: "
            p_t1.font.name = self.layout.FONT_HEADING
            p_t1.font.size = Pt(11)
            p_t1.font.bold = True
            p_t1.font.color.rgb = self.colors.primary

            run_text = p_t1.add_run()
            run_text.text = self._truncate(data.takeaway, 180)
            run_text.font.name = self.layout.FONT_BODY
            run_text.font.size = Pt(11)
            run_text.font.bold = False
            run_text.font.color.rgb = self.colors.text_secondary

        return True

    def _render_comparison_card(
        self,
        slide: Slide,
        col: ComparisonColumn,
        x: Inches,
        y: Inches,
        w: Inches,
        h: Inches,
        header_color: RGBColor,
        tag_color: RGBColor,
    ) -> None:
        """Render an individual comparison entity card."""
        # Main Card Body
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, w, h)
        card.fill.solid()
        card.fill.fore_color.rgb = self.colors.card_bg
        card.line.color.rgb = self.colors.card_border
        card.line.width = Pt(1)

        # Top Header Banner
        header_h = Inches(0.9)
        banner = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, w, header_h)
        banner.fill.solid()
        banner.fill.fore_color.rgb = header_color
        banner.line.fill.background()

        # Banner Title
        tb_title = slide.shapes.add_textbox(
            x + Inches(0.2), y + Inches(0.12), w - Inches(0.4), Inches(0.45)
        )
        tf_title = tb_title.text_frame
        tf_title.word_wrap = True
        p_title = tf_title.paragraphs[0]
        p_title.text = self._truncate(col.name, 45)
        p_title.font.name = self.layout.FONT_HEADING
        p_title.font.size = Pt(14)
        p_title.font.bold = True
        p_title.font.color.rgb = self.colors.text_white

        # Tag label if present
        if col.tag:
            p_tag = tf_title.add_paragraph()
            p_tag.text = col.tag.upper()
            p_tag.font.name = self.layout.FONT_HEADING
            p_tag.font.size = Pt(9)
            p_tag.font.bold = True
            p_tag.font.color.rgb = tag_color

        # Comparison bullet points
        points_box = slide.shapes.add_textbox(
            x + Inches(0.25), y + header_h + Inches(0.2),
            w - Inches(0.5), h - header_h - Inches(0.35)
        )
        tf_points = points_box.text_frame
        tf_points.word_wrap = True

        for i, pt in enumerate(col.points[:4]):
            p = tf_points.paragraphs[0] if i == 0 else tf_points.add_paragraph()
            p.space_after = Pt(10)
            p.line_spacing = 1.2

            bullet_sym = p.add_run()
            bullet_sym.text = "▪  "
            bullet_sym.font.bold = True
            bullet_sym.font.color.rgb = header_color

            body_run = p.add_run()
            body_run.text = self._truncate(pt, 120)
            body_run.font.name = self.layout.FONT_BODY
            body_run.font.size = Pt(11.5)
            body_run.font.color.rgb = self.colors.text_secondary

    # =========================================================================
    # 4. Concept Map
    # =========================================================================

    def render_concept_map(
        self,
        slide: Slide,
        data: ConceptMapData,
        bounds: RectBounds,
    ) -> bool:
        """Render a concept map diagram with a central hub node and branching cards."""
        branches = data.branches
        if not branches or len(branches) < 2:
            raise InvalidVisualDataError("Concept map requires at least 2 branches.")

        active_branches = branches[:4]
        hub_w = Inches(3.2)
        hub_h = Inches(1.4)
        hub_x = bounds.left + (bounds.width - hub_w) / 2
        hub_y = bounds.top + (bounds.height - hub_h) / 2

        # Central Concept Hub
        hub = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, hub_x, hub_y, hub_w, hub_h)
        hub.fill.solid()
        hub.fill.fore_color.rgb = self.colors.primary
        hub.line.color.rgb = self.colors.accent
        hub.line.width = Pt(2)

        tf_hub = hub.text_frame
        tf_hub.word_wrap = True
        p_hub = tf_hub.paragraphs[0]
        p_hub.text = self._truncate(data.center_concept, 45)
        p_hub.font.name = self.layout.FONT_HEADING
        p_hub.font.size = Pt(14)
        p_hub.font.bold = True
        p_hub.font.color.rgb = self.colors.text_white
        p_hub.alignment = PP_ALIGN.CENTER

        # Left and Right branch columns
        branch_w = Inches(3.6)
        branch_h = Inches(1.8)

        left_x = bounds.left
        right_x = bounds.right - branch_w

        top_y = bounds.top + Inches(0.2)
        bottom_y = bounds.bottom - branch_h - Inches(0.2)

        slot_coords = [
            (left_x, top_y),        # Top Left
            (right_x, top_y),       # Top Right
            (left_x, bottom_y),     # Bottom Left
            (right_x, bottom_y),    # Bottom Right
        ]

        for idx, branch in enumerate(active_branches):
            bx, by = slot_coords[idx]

            # Branch Card
            b_card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, bx, by, branch_w, branch_h)
            b_card.fill.solid()
            b_card.fill.fore_color.rgb = self.colors.card_bg
            b_card.line.color.rgb = self.colors.card_border
            b_card.line.width = Pt(1)

            # Left accent strip
            strip = slide.shapes.add_shape(
                MSO_SHAPE.ROUNDED_RECTANGLE, bx, by, Inches(0.1), branch_h
            )
            strip.fill.solid()
            strip.fill.fore_color.rgb = self.colors.secondary
            strip.line.fill.background()

            # Branch text box
            tb = slide.shapes.add_textbox(bx + Inches(0.18), by + Inches(0.12), branch_w - Inches(0.28), branch_h - Inches(0.24))
            tf = tb.text_frame
            tf.word_wrap = True

            p1 = tf.paragraphs[0]
            p1.text = self._truncate(branch.title, 40)
            p1.font.name = self.layout.FONT_HEADING
            p1.font.size = Pt(12.5)
            p1.font.bold = True
            p1.font.color.rgb = self.colors.primary

            if branch.description:
                p2 = tf.add_paragraph()
                p2.text = self._truncate(branch.description, 110)
                p2.font.name = self.layout.FONT_BODY
                p2.font.size = Pt(10.5)
                p2.font.color.rgb = self.colors.text_secondary
                p2.space_before = Pt(4)

            # Connector line between Hub and Branch
            conn_x1 = hub_x if bx < hub_x else (hub_x + hub_w)
            conn_y1 = hub_y + (hub_h / 2)
            conn_x2 = (bx + branch_w) if bx < hub_x else bx
            conn_y2 = by + (branch_h / 2)

            connector = slide.shapes.add_shape(
                MSO_SHAPE.RECTANGLE,
                min(conn_x1, conn_x2),
                conn_y1 - Inches(0.01),
                abs(conn_x1 - conn_x2),
                Inches(0.02)
            )
            connector.fill.solid()
            connector.fill.fore_color.rgb = self.colors.card_border
            connector.line.fill.background()

        return True

    # =========================================================================
    # 5. Local Image Placement
    # =========================================================================

    def render_image(
        self,
        slide: Slide,
        data: ImageData,
        bounds: RectBounds,
    ) -> bool:
        """Place a validated local image, preserving aspect ratio and adding alt text/caption."""
        img_path = Path(data.file_path)
        if not img_path.exists():
            raise VisualRenderError(f"Image file not found: {img_path.resolve()}")

        if img_path.suffix.lower() not in self.ALLOWED_IMAGE_EXTENSIONS:
            raise InvalidVisualDataError(
                f"Unsupported image file extension '{img_path.suffix}'. "
                f"Allowed formats: {sorted(self.ALLOWED_IMAGE_EXTENSIONS)}"
            )

        file_size = img_path.stat().st_size
        if file_size > self.MAX_IMAGE_SIZE_BYTES:
            raise InvalidVisualDataError(
                f"Image file size ({file_size / (1024*1024):.1f} MB) exceeds maximum allowed 15 MB."
            )

        try:
            with Image.open(str(img_path)) as pil_img:
                orig_w, orig_h = pil_img.size
        except Exception as exc:
            raise VisualRenderError(f"Failed to decode image file '{img_path.name}': {exc}")

        if orig_w <= 0 or orig_h <= 0:
            raise InvalidVisualDataError("Image dimensions are invalid (0 pixels).")

        caption_h = Inches(0.5) if data.caption else Inches(0)
        max_img_h = bounds.height - caption_h
        max_img_w = bounds.width

        # Calculate exact aspect ratio scaling
        aspect = orig_w / orig_h
        if max_img_w / max_img_h > aspect:
            final_h = max_img_h
            final_w = final_h * aspect
        else:
            final_w = max_img_w
            final_h = final_w / aspect

        # Center inside target bounds
        final_left = bounds.left + (bounds.width - final_w) / 2
        final_top = bounds.top + (max_img_h - final_h) / 2

        # Insert picture
        pic = slide.shapes.add_picture(
            str(img_path.resolve()),
            final_left, final_top,
            width=final_w, height=final_h
        )

        # Set accessible alt text if provided
        alt = data.alt_text or data.caption or img_path.stem
        try:
            pic._element._nvXxPr.cNvPr.attrib["descr"] = alt
        except Exception:
            pass

        # Add caption if provided
        if data.caption:
            caption_top = final_top + final_h + Inches(0.1)
            c_box = slide.shapes.add_textbox(
                bounds.left, caption_top, bounds.width, caption_h
            )
            tf_c = c_box.text_frame
            tf_c.word_wrap = True
            p_c = tf_c.paragraphs[0]
            p_c.text = self._truncate(data.caption, 140)
            p_c.font.name = self.layout.FONT_BODY
            p_c.font.size = Pt(10.5)
            p_c.font.italic = True
            p_c.font.color.rgb = self.colors.text_muted
            p_c.alignment = PP_ALIGN.CENTER

        return True

    # =========================================================================
    # Helper Utilities
    # =========================================================================

    @staticmethod
    def _truncate(text: str, max_chars: int) -> str:
        """Truncate text gracefully to prevent overflow in diagrams."""
        if not text:
            return ""
        stripped = text.strip()
        if len(stripped) <= max_chars:
            return stripped
        return stripped[:max_chars - 3].rstrip() + "..."
