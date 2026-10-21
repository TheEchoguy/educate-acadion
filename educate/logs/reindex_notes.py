"""
Re-indexes Modules 1-5 notes into vector store for classroom 6ad5c9592ea967aa02bd2cc8
Uses the upgraded semantic chunker (~900-1200 chars, >=250 chars) and all-MiniLM-L6-v2 embeddings.
"""

import os
import glob
from rag_tutor import index_pdf_notes

CLASSROOM_ID = "6ad5c9592ea967aa02bd2cc8"
PDF_DIR = "D:/Major-Project Acadion/test pdf"

def reindex_all():
    print(f"==================================================")
    print(f" Re-indexing VTU IoT Modules 1-5 for Classroom {CLASSROOM_ID}")
    print(f" Source Directory: {PDF_DIR}")
    print(f"==================================================")

    total_chunks = 0
    all_lens = []

    for m in range(1, 6):
        pdf_path = os.path.join(PDF_DIR, f"iot mod{m}.pdf")
        if not os.path.exists(pdf_path):
            print(f"[ERROR] PDF not found for Module {m}: {pdf_path}")
            continue

        res = index_pdf_notes(
            classroom_id=CLASSROOM_ID,
            module_num=m,
            pdf_source=pdf_path,
            filename=f"iot mod{m}.pdf"
        )
        total_chunks += res["chunksIndexed"]
        print(f"-> Module {m} Indexed: {res['chunksIndexed']} chunks, {res['pageCount']} pages, avg {res.get('avgChunkLength', 0)} chars/chunk")

    print("==================================================")
    print(f" Re-indexing Complete! Total Chunks: {total_chunks}")
    print("==================================================")

if __name__ == "__main__":
    reindex_all()
