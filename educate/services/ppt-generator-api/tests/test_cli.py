"""
Tests for CLI entry point and execution workflows (deterministic and AI modes).
"""

from pathlib import Path
from unittest.mock import MagicMock, patch
import pytest

from app.main import run
from app.models import PresentationData, Section, BulletPoint


def test_cli_success(tmp_path: Path):
    """Test running CLI generator with valid input and custom output path."""
    input_file = Path("sample_data/sample_notes.txt")
    output_file = tmp_path / "cli_test_presentation.pptx"

    exit_code = run(str(input_file), str(output_file), verify=True)
    assert exit_code == 0
    assert output_file.exists()
    assert output_file.stat().st_size > 10_000


def test_cli_deterministic_explicit_mode(tmp_path: Path):
    """Test explicitly specifying mode='deterministic'."""
    input_file = Path("sample_data/sample_notes.txt")
    output_file = tmp_path / "deterministic_explicit.pptx"

    exit_code = run(str(input_file), str(output_file), mode="deterministic", verify=True)
    assert exit_code == 0
    assert output_file.exists()


def test_cli_missing_input_file(tmp_path: Path, capsys: pytest.CaptureFixture):
    """Test running CLI with a missing input file returns exit code 1."""
    missing_file = tmp_path / "non_existent.txt"
    output_file = tmp_path / "out.pptx"

    exit_code = run(str(missing_file), str(output_file))
    assert exit_code == 1
    captured = capsys.readouterr()
    assert "Input File Missing" in captured.err


def test_cli_empty_input_file(tmp_path: Path, capsys: pytest.CaptureFixture):
    """Test running CLI with an empty input file returns exit code 1."""
    empty_file = tmp_path / "empty_notes.txt"
    empty_file.write_text("   \n\n  ", encoding="utf-8")
    output_file = tmp_path / "out.pptx"

    exit_code = run(str(empty_file), str(output_file))
    assert exit_code == 1
    captured = capsys.readouterr()
    assert "Empty Content" in captured.err


def test_cli_ai_mode_missing_key(tmp_path: Path, capsys: pytest.CaptureFixture):
    """Test running CLI in AI mode without an API key produces exit code 1 and helpful hint."""
    input_file = Path("sample_data/sample_notes.txt")
    output_file = tmp_path / "out_ai.pptx"

    with patch.dict("os.environ", {}, clear=True):
        exit_code = run(str(input_file), str(output_file), mode="ai")
        assert exit_code == 1
        captured = capsys.readouterr()
        assert "Missing Gemini API Key" in captured.err


def test_cli_ai_mode_mocked_success(tmp_path: Path):
    """Test running CLI in AI mode with mocked Gemini service produces exit code 0."""
    input_file = Path("sample_data/sample_notes.txt")
    output_file = tmp_path / "cli_ai_mocked.pptx"

    mock_data = PresentationData(
        title="AI Planned Lecture",
        content_sections=[
            Section(
                title="Mock AI Section",
                bullets=[BulletPoint(text="Educational concept verified by AI.")],
                speaker_notes="Instructor remarks.",
            )
        ]
    )

    with patch("app.gemini_service.GeminiContentPlanner.plan_from_file", return_value=mock_data):
        exit_code = run(str(input_file), str(output_file), mode="ai", verify=True)
        assert exit_code == 0
        assert output_file.exists()


def test_cli_invalid_mode(tmp_path: Path, capsys: pytest.CaptureFixture):
    """Test running CLI with an unsupported mode returns exit code 1."""
    input_file = Path("sample_data/sample_notes.txt")
    output_file = tmp_path / "out.pptx"

    exit_code = run(str(input_file), str(output_file), mode="unsupported_mode")
    assert exit_code == 1
    captured = capsys.readouterr()
    assert "Unsupported mode" in captured.err
