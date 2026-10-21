"""
Base interface for presentation generation providers.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict
from app.models import UnifiedPresentationPlan


class PresentationProviderBase(ABC):
    """Abstract base class for presentation generation providers."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Machine identifier (e.g. 'native')."""
        pass

    @property
    @abstractmethod
    def display_name(self) -> str:
        """Human-readable display name (e.g. 'Acadion Native Engine')."""
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """Returns True if this provider is configured and available for generation."""
        pass

    @abstractmethod
    async def generate_pptx(
        self,
        plan: UnifiedPresentationPlan,
        target_path: str,
    ) -> Dict[str, Any]:
        """Generate a PowerPoint presentation from a unified plan and save to target_path."""
        pass
