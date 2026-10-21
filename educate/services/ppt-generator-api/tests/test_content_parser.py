"""
Unit tests for ContentParser.
"""

import pytest
from pathlib import Path

from app.content_parser import ContentParser
from app.models import (
    EmptyContentError,
    InputFileNotFoundError,
    InvalidContentError,
    SectionType,
)


def test_parse_valid_notes(tmp_path: Path):
    """Test parsing a valid markdown-structured educational notes file."""
    notes_content = """# Deep Learning Foundations
Advanced Curriculum Notes — Acadion AI Series

## Overview & Background
Deep learning has revolutionized artificial intelligence by enabling automated representation learning.
- Neural networks learn hierarchical abstractions.
- Optimization uses gradient descent variants.

## Core Architectures
- CNNs: Specialized for spatial grid data like images.
- Transformers: Self-attention models for sequential data.
- RNNs: Recurrent feedback loops for sequence modeling.

## Summary & Conclusions
- Deep learning continues to advance across multimodal domains.
"""
    test_file = tmp_path / "test_notes.txt"
    test_file.write_text(notes_content, encoding="utf-8")

    parser = ContentParser()
    data = parser.parse_file(test_file)

    assert data.title == "Deep Learning Foundations"
    assert "Acadion AI Series" in data.subtitle
    assert data.overview_section is not None
    assert data.overview_section.title == "Overview & Background"
    assert len(data.overview_section.bullets) == 2
    assert len(data.content_sections) == 1
    assert data.content_sections[0].title == "Core Architectures"
    assert len(data.content_sections[0].bullets) == 3
    assert data.conclusion_section is not None
    assert data.conclusion_section.title == "Summary & Conclusions"


def test_parse_definition_bullets():
    """Test that 'Term: Definition' bullets are split into prefix and body."""
    raw = """# Natural Language Processing

## Key Concepts
- Tokenization: Process of breaking text into discrete tokens.
- Embeddings: Vector representations encoding semantic meaning.
- Self-Attention: Mechanism computing pairwise token relevance.
"""
    parser = ContentParser()
    data = parser.parse_text(raw)

    sec = data.content_sections[0]
    assert len(sec.bullets) == 3
    assert sec.bullets[0].prefix == "Tokenization"
    assert sec.bullets[0].text == "Process of breaking text into discrete tokens."
    assert sec.bullets[1].prefix == "Embeddings"
    assert sec.bullets[2].prefix == "Self-Attention"


def test_parse_empty_content_raises_error():
    """Test that empty string raises EmptyContentError."""
    parser = ContentParser()
    with pytest.raises(EmptyContentError):
        parser.parse_text("")

    with pytest.raises(EmptyContentError):
        parser.parse_text("   \n\n   \t  ")


def test_parse_missing_file_raises_error(tmp_path: Path):
    """Test that missing file raises InputFileNotFoundError."""
    parser = ContentParser()
    non_existent = tmp_path / "does_not_exist_notes.txt"
    with pytest.raises(InputFileNotFoundError):
        parser.parse_file(non_existent)


def test_parse_plain_text_without_markdown():
    """Test parsing plain text notes without explicit markdown headers."""
    raw = """Introduction to Algorithms
Computer Science 101 Lecture Notes

Sorting Techniques
- QuickSort: Divide-and-conquer algorithm with average O(n log n).
- MergeSort: Stable divide-and-conquer with guaranteed O(n log n).
- BubbleSort: Elementary comparison sort with O(n^2) runtime.
"""
    parser = ContentParser()
    data = parser.parse_text(raw)

    assert data.title == "Introduction to Algorithms"
    assert len(data.content_sections) >= 1
