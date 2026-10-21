"""
Native presentation generation provider wrapping PPTGenerator.
100% offline-capable, zero external dependencies, native shape rendering.
"""

from pathlib import Path
from typing import Any, Dict
from app.models import UnifiedPresentationPlan
from app.ppt_generator import PPTGenerator
from app.providers.base import PresentationProviderBase


class NativePresentationProvider(PresentationProviderBase):
    """Generates PowerPoint presentations locally using PPTGenerator."""

    def __init__(self, theme: str = "academic_navy", layout_style: str = "smart_mixed"):
        self.theme = theme
        self.layout_style = layout_style

    @property
    def name(self) -> str:
        return "native"

    @property
    def display_name(self) -> str:
        return "Acadion Native Engine"

    def is_available(self) -> bool:
        return True

    async def generate_pptx(
        self,
        plan: UnifiedPresentationPlan,
        target_path: str,
    ) -> Dict[str, Any]:
        """Convert unified plan to PresentationData and render via PPTGenerator."""
        pres_data = plan.to_presentation_data()
        theme_to_use = self.theme or plan.theme_id or "academic_navy"
        generator = PPTGenerator(theme=theme_to_use, layout_style=self.layout_style)

        resolved_path = generator.generate(pres_data, target_path, layout_style=self.layout_style)
        return {
            "provider": "native",
            "file_path": str(resolved_path),
            "theme": theme_to_use,
            "layout_style": self.layout_style,
            "credits_deducted": 0,
            "is_cloud": False,
        }
