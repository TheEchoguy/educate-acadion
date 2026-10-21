"""
CLI Test Script to Parse Any Question Paper Directly
Usage: python test_cli.py <path_to_pdf_or_text_file>
"""

import sys
import os
import json
from ai_extractor import extract_questions_with_ai
from pdf_reader import extract_text_from_pdf_file

def main():
    if len(sys.argv) < 2:
        print("Usage: python test_cli.py <path_to_pdf_or_text_file>")
        print("Example: python test_cli.py C:/Users/renki/Downloads/58927.pdf")
        return

    path = sys.argv[1]
    if not os.path.exists(path):
        print(f"Error: File not found at {path}")
        return

    print(f"Reading file: {path}...")
    if path.lower().endswith(".pdf"):
        text = extract_text_from_pdf_file(path)
    else:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            text = f.read()

    print(f"Extracted {len(text)} characters. Sending to AI model...")
    result = extract_questions_with_ai(text)
    
    print("\n" + "="*50)
    print("AI PARSED RESULT:")
    print("="*50)
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
