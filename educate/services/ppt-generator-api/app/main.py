"""
CLI entry point for Acadion AI PPT Generator (Phase 2).
Supports both deterministic rule-based generation (Phase 1)
and Gemini-powered curriculum content planning (Phase 2).
"""

import argparse
from pathlib import Path
import sys
from typing import Optional

from app.content_parser import ContentParser
from app.document_loader import DocumentLoader
from app.gemini_service import GeminiContentPlanner
from app.layouts import SlideLayoutEngine
from app.models import (
    CorruptedDocumentError,
    DocumentIngestionError,
    EmptyContentError,
    EncryptedDocumentError,
    FileSizeLimitExceededError,
    GeminiAuthenticationError,
    GeminiOutputValidationError,
    GeminiQuotaExceededError,
    GeminiServiceError,
    InputFileNotFoundError,
    InvalidContentError,
    MissingAPIKeyError,
    ModelUnavailableError,
    PPTGeneratorError,
    PresentationData,
    ScannedDocumentError,
    TextLengthLimitExceededError,
    UnsupportedFileTypeError,
)
from app.ppt_generator import PPTGenerator
from app.api import app

# Expose FastAPI application instance for ASGI servers (e.g. uvicorn app.main:app)
from app.api import app

def create_arg_parser() -> argparse.ArgumentParser:
    """Construct CLI argument parser with document ingestion options."""
    parser = argparse.ArgumentParser(
        description="Acadion AI PPT Generator — Phase 4: Teacher Input and Document Ingestion",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "-i", "--input",
        type=str,
        default="sample_data/sample_notes.txt",
        help="Path to input educational notes document (.txt, .pdf, .docx)",
    )
    parser.add_argument(
        "-t", "--text",
        type=str,
        default=None,
        help="Direct pasted educational lecture notes text (overrides --input if specified)",
    )
    parser.add_argument(
        "-o", "--output",
        type=str,
        default="output/sample_presentation.pptx",
        help="Path for the generated PowerPoint presentation",
    )
    parser.add_argument(
        "-m", "--mode",
        type=str,
        choices=["deterministic", "ai"],
        default="deterministic",
        help="Generation mode: 'deterministic' (Phase 1 rules) or 'ai' (Gemini AI planning)",
    )
    parser.add_argument(
        "--model",
        type=str,
        default=None,
        help="Gemini model override for AI mode (defaults to GEMINI_MODEL env var or gemini-flash-latest)",
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        default=True,
        help="Programmatically verify the generated presentation after creation",
    )
    return parser


def run(
    input_path: Optional[str] = "sample_data/sample_notes.txt",
    output_path: str = "output/sample_presentation.pptx",
    mode: str = "deterministic",
    model: Optional[str] = None,
    verify: bool = True,
    text_input: Optional[str] = None,
) -> int:
    """Execute the PPT generation pipeline in either deterministic or AI mode."""
    print("=" * 68)
    print(" Acadion AI PPT Generator — Phase 4: Teacher Input & Ingestion")
    print("=" * 68)
    print(f"[*] Mode        : {mode.upper()}")
    print(f"[*] Output path : {output_path}")

    # 1. Document Ingestion
    loader = DocumentLoader()
    text_content = ""
    try:
        if text_input is not None:
            print(f"[*] Input source: Pasted text notes ({len(text_input):,} characters)")
            text_content, metadata = loader.load_text(text_input)
        elif input_path:
            print(f"[*] Input file  : {input_path}")
            text_content, metadata = loader.load(input_path)
            print(f"[+] Ingested    : {metadata.source_description} ({metadata.character_count:,} chars, {metadata.word_count:,} words)")
        else:
            print("[ERROR] Please provide an input document path (-i/--input) or pasted text (-t/--text).", file=sys.stderr)
            return 1
    except InputFileNotFoundError as exc:
        print(f"\n[ERROR] Input File Missing:\n  -> {exc}", file=sys.stderr)
        return 1
    except UnsupportedFileTypeError as exc:
        print(f"\n[ERROR] Unsupported File Format:\n  -> {exc}", file=sys.stderr)
        return 1
    except FileSizeLimitExceededError as exc:
        print(f"\n[ERROR] File Size Exceeded:\n  -> {exc}", file=sys.stderr)
        return 1
    except TextLengthLimitExceededError as exc:
        print(f"\n[ERROR] Text Length Limit Exceeded:\n  -> {exc}", file=sys.stderr)
        return 1
    except CorruptedDocumentError as exc:
        print(f"\n[ERROR] Corrupted Document:\n  -> {exc}", file=sys.stderr)
        return 1
    except EncryptedDocumentError as exc:
        print(f"\n[ERROR] Encrypted Document:\n  -> {exc}", file=sys.stderr)
        return 1
    except ScannedDocumentError as exc:
        print(f"\n[ERROR] Scanned Document / OCR Required:\n  -> {exc}", file=sys.stderr)
        return 1
    except EmptyContentError as exc:
        print(f"\n[ERROR] Empty Content:\n  -> {exc}", file=sys.stderr)
        return 1
    except DocumentIngestionError as exc:
        print(f"\n[ERROR] Document Ingestion Error:\n  -> {exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"\n[ERROR] Failed to load input document: {exc}", file=sys.stderr)
        return 1

    # 2. Content Planning / Parsing
    data: Optional[PresentationData] = None

    if mode == "deterministic":
        print("[*] Running deterministic rule-based content parser...")
        parser = ContentParser()
        try:
            if text_input is not None:
                data = parser.parse_text(text_content)
            else:
                data = parser.parse_file(input_path)
        except EmptyContentError as exc:
            print(f"\n[ERROR] Empty Content:\n  -> {exc}", file=sys.stderr)
            return 1
        except InvalidContentError as exc:
            print(f"\n[ERROR] Invalid Notes Format:\n  -> {exc}", file=sys.stderr)
            return 1
        except Exception as exc:
            print(f"\n[ERROR] Unexpected parsing failure: {exc}", file=sys.stderr)
            return 1

    elif mode == "ai":
        planner = GeminiContentPlanner(model=model)
        active_model = planner.model
        print(f"[*] Requesting structured curriculum presentation plan from Gemini ({active_model})...")

        try:
            if text_input is not None:
                data = planner.plan_from_text(text_content)
            else:
                data = planner.plan_from_file(input_path)
        except EmptyContentError as exc:
            print(f"\n[ERROR] Empty Content:\n  -> {exc}", file=sys.stderr)
            return 1
        except MissingAPIKeyError as exc:
            print(f"\n[ERROR] Missing Gemini API Key:\n  -> {exc}", file=sys.stderr)
            print("  [HINT] Set GEMINI_API_KEY in your .env file or run with '--mode deterministic'.", file=sys.stderr)
            return 1
        except GeminiAuthenticationError as exc:
            print(f"\n[ERROR] Gemini Authentication Failed:\n  -> {exc}", file=sys.stderr)
            return 1
        except GeminiQuotaExceededError as exc:
            print(f"\n[ERROR] Gemini Quota Exceeded:\n  -> {exc}", file=sys.stderr)
            return 1
        except ModelUnavailableError as exc:
            print(f"\n[ERROR] Gemini Model Unavailable:\n  -> {exc}", file=sys.stderr)
            return 1
        except GeminiOutputValidationError as exc:
            print(f"\n[ERROR] Gemini Output Schema Validation Failed:\n  -> {exc}", file=sys.stderr)
            return 1
        except GeminiServiceError as exc:
            print(f"\n[ERROR] Gemini Service Error:\n  -> {exc}", file=sys.stderr)
            return 1
        except Exception as exc:
            print(f"\n[ERROR] Unexpected AI planning error: {exc}", file=sys.stderr)
            return 1

    else:
        print(f"[ERROR] Unsupported mode '{mode}'. Choose 'deterministic' or 'ai'.", file=sys.stderr)
        return 1

    # 2. Presentation Data Summary
    print(f"[+] Structured Presentation Title : \"{data.title}\"")
    print(f"[+] Total Content Sections        : {len(data.content_sections)}")
    if data.overview_section:
        print(f"[+] Overview Section              : \"{data.overview_section.title}\"")
    if data.conclusion_section:
        print(f"[+] Conclusion Section            : \"{data.conclusion_section.title}\"")
    if data.recommended_slide_count:
        print(f"[+] AI Recommended Slide Count    : {data.recommended_slide_count}")

    # 3. PowerPoint Generation
    generator = PPTGenerator()
    try:
        resolved_path = generator.generate(data, output_path)
    except Exception as exc:
        print(f"\n[ERROR] Presentation generation failed:\n  -> {exc}", file=sys.stderr)
        return 1

    print("\n" + "-" * 68)
    print(" [SUCCESS] PowerPoint presentation generated successfully!")
    print(f" [Path]    : {resolved_path}")
    print("-" * 68)

    # 4. Programmatic Verification
    if verify:
        try:
            ver = PPTGenerator.verify_presentation(resolved_path)
            print("[+] Verification Check Passed:")
            print(f"    - Slide count       : {ver['slide_count']}")
            print(f"    - File size         : {ver['file_size_bytes']:,} bytes")
            print(f"    - 16:9 Widescreen   : {'Yes' if ver['widescreen_16_9'] else 'No'}")
            print(f"    - Total shapes/boxes: {ver['total_shapes']}")
            print("    - Slide outline:")
            for idx, stitle in enumerate(ver["slide_titles"], 1):
                print(f"        {idx:02d}. {stitle}")
        except Exception as exc:
            print(f"[WARNING] Verification encountered an error: {exc}", file=sys.stderr)
            return 1

    print("=" * 68)
    return 0


def main() -> None:
    """CLI entry point."""
    parser = create_arg_parser()
    args = parser.parse_args()
    code = run(
        input_path=args.input,
        output_path=args.output,
        mode=args.mode,
        model=args.model,
        verify=args.verify,
        text_input=args.text,
    )
    sys.exit(code)


if __name__ == "__main__":
    main()
