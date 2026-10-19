"""
Module 1-5 Notes RAG Study Tutor Engine
Part of Acadion Academic Intelligence
"""

import os
import json
import re
from typing import Dict, List, Any, Optional
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from openai import OpenAI

# PDF Extraction
try:
    import pymupdf as fitz
except ImportError:
    try:
        import fitz
    except ImportError:
        fitz = None

try:
    import pypdf
except ImportError:
    pypdf = None

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
VECTOR_STORE_DIR = os.path.join(BASE_DIR, "vector_store")
os.makedirs(VECTOR_STORE_DIR, exist_ok=True)

OPENROUTER_KEY = os.getenv("OPENROUTER_API_KEY", "")
MODEL_NAME = os.getenv("AI_MODEL_NAME", "openrouter/free")

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=OPENROUTER_KEY if OPENROUTER_KEY else "dummy-openrouter-key",
)


def get_classroom_store_dir(classroom_id: str) -> str:
    clean_id = re.sub(r"[^a-zA-Z0-9_\-]", "_", classroom_id or "default")
    path = os.path.join(VECTOR_STORE_DIR, clean_id)
    os.makedirs(path, exist_ok=True)
    return path


def extract_pages_from_pdf_bytes(pdf_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Extracts text page by page from raw PDF bytes using PyMuPDF (fitz) or pypdf.
    """
    pages = []
    if fitz is not None:
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            for page_num in range(len(doc)):
                text = doc[page_num].get_text("text")
                if text and text.strip():
                    pages.append({"pageNumber": page_num + 1, "text": text.strip()})
            if pages:
                return pages
        except Exception as e:
            print(f"[Warning]: PyMuPDF extraction error: {e}")

    if pypdf is not None:
        try:
            import io
            reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
            for page_num, page in enumerate(reader.pages):
                text = page.extract_text()
                if text and text.strip():
                    pages.append({"pageNumber": page_num + 1, "text": text.strip()})
            if pages:
                return pages
        except Exception as e:
            print(f"[Warning]: pypdf extraction error: {e}")

    return pages


def chunk_text(text: str, chunk_size_words: int = 350, overlap_words: int = 40) -> List[str]:
    """
    Splits text into chunks of specified word length with overlap.
    """
    words = text.split()
    if len(words) <= chunk_size_words:
        return [text]

    chunks = []
    start = 0
    while start < len(words):
        end = min(start + chunk_size_words, len(words))
        chunk = " ".join(words[start:end])
        chunks.append(chunk)
        if end == len(words):
            break
        start += chunk_size_words - overlap_words
    return chunks


def index_module_notes(
    classroom_id: str,
    module_number: int,
    pdf_bytes: bytes,
    filename: str = "notes.pdf"
) -> Dict[str, Any]:
    """
    Extracts, chunks, and persists vector index for a syllabus module note.
    """
    store_dir = get_classroom_store_dir(classroom_id)
    index_file = os.path.join(store_dir, "modules_index.json")

    # Load existing chunks
    existing_chunks = []
    if os.path.exists(index_file):
        try:
            with open(index_file, "r", encoding="utf-8") as f:
                existing_chunks = json.load(f)
        except Exception:
            existing_chunks = []

    # Filter out previous chunks for this specific module
    remaining_chunks = [c for c in existing_chunks if c.get("moduleNumber") != module_number]

    # Extract pages
    pages = extract_pages_from_pdf_bytes(pdf_bytes)
    if not pages:
        # Fallback if text layer empty (e.g. scanned)
        pages = [{"pageNumber": 1, "text": f"Course Lecture Notes for Module {module_number}: {filename}."}]

    new_chunks = []
    for p in pages:
        p_num = p["pageNumber"]
        p_text = p["text"]
        text_chunks = chunk_text(p_text)

        for c_idx, ch in enumerate(text_chunks):
            new_chunks.append({
                "chunkId": f"mod{module_number}_p{p_num}_c{c_idx}",
                "moduleNumber": int(module_number),
                "pageNumber": p_num,
                "source": filename,
                "text": ch
            })

    total_chunks = remaining_chunks + new_chunks
    with open(index_file, "w", encoding="utf-8") as f:
        json.dump(total_chunks, f, ensure_ascii=False, indent=2)

    print(f"[RAG Indexer]: Successfully indexed {len(new_chunks)} chunks for Module {module_number} in classroom '{classroom_id}'")

    return {
        "success": True,
        "classroomId": classroom_id,
        "moduleNumber": module_number,
        "filename": filename,
        "pagesCount": len(pages),
        "chunksCount": len(new_chunks),
        "totalClassroomChunks": len(total_chunks)
    }


def get_indexed_modules(classroom_id: str) -> Dict[str, Any]:
    """
    Returns index status for Modules 1 through 5.
    """
    store_dir = get_classroom_store_dir(classroom_id)
    index_file = os.path.join(store_dir, "modules_index.json")

    status = {
        str(m): {
            "moduleNumber": m,
            "indexed": False,
            "filename": None,
            "chunksCount": 0
        } for m in range(1, 6)
    }

    if os.path.exists(index_file):
        try:
            with open(index_file, "r", encoding="utf-8") as f:
                chunks = json.load(f)
            for c in chunks:
                m = str(c.get("moduleNumber"))
                if m in status:
                    status[m]["indexed"] = True
                    status[m]["filename"] = c.get("source") or f"Module {m} Notes"
                    status[m]["chunksCount"] += 1
        except Exception as e:
            print(f"[Warning]: Error reading index file: {e}")

    return {
        "classroomId": classroom_id,
        "modules": status
    }


def retrieve_relevant_chunks(
    classroom_id: str,
    query: str,
    focus_topic: Optional[str] = None,
    focus_module: Optional[int] = None,
    top_k: int = 3
) -> List[Dict[str, Any]]:
    """
    Performs grounded semantic retrieval against indexed notes.
    """
    store_dir = get_classroom_store_dir(classroom_id)
    index_file = os.path.join(store_dir, "modules_index.json")

    if not os.path.exists(index_file):
        return []

    try:
        with open(index_file, "r", encoding="utf-8") as f:
            all_chunks = json.load(f)
    except Exception:
        return []

    if not all_chunks:
        return []

    # Priority module filtering if focus_module is given
    candidate_chunks = all_chunks
    if focus_module and 1 <= focus_module <= 5:
        mod_filtered = [c for c in all_chunks if c.get("moduleNumber") == focus_module]
        if mod_filtered:
            candidate_chunks = mod_filtered

    if not candidate_chunks:
        candidate_chunks = all_chunks

    # Build search query combining topic + user prompt
    combined_query = f"{focus_topic or ''} {query}".strip()
    corpus = [c["text"] for c in candidate_chunks]

    try:
        vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2))
        tfidf_matrix = vectorizer.fit_transform(corpus)
        query_vec = vectorizer.transform([combined_query])
        similarities = cosine_similarity(query_vec, tfidf_matrix)[0]

        top_indices = np.argsort(similarities)[::-1][:top_k]

        results = []
        for idx in top_indices:
            score = float(similarities[idx])
            chunk = candidate_chunks[idx]
            results.append({
                "moduleNumber": chunk["moduleNumber"],
                "pageNumber": chunk["pageNumber"],
                "source": chunk["source"],
                "excerpt": chunk["text"][:320] + ("..." if len(chunk["text"]) > 320 else ""),
                "fullText": chunk["text"],
                "similarityScore": round(score, 3)
            })
        return results
    except Exception as ex:
        print(f"[Warning]: Retrieval error ({ex}), returning first {top_k} chunks")
        return [
            {
                "moduleNumber": c["moduleNumber"],
                "pageNumber": c["pageNumber"],
                "source": c["source"],
                "excerpt": c["text"][:320] + "...",
                "fullText": c["text"],
                "similarityScore": 0.5
            } for c in candidate_chunks[:top_k]
        ]


def ask_study_tutor(
    classroom_id: str,
    student_query: str,
    focus_topic: Optional[str] = None,
    focus_module: Optional[int] = None
) -> Dict[str, Any]:
    """
    RAG Study Tutor Query Engine:
    Retrieves grounded course note chunks and synthesizes an academic explanation with citations.
    """
    # 1. Retrieve top matching chunks
    chunks = retrieve_relevant_chunks(
        classroom_id=classroom_id,
        query=student_query,
        focus_topic=focus_topic,
        focus_module=focus_module,
        top_k=3
    )

    # Clean citations
    sources = []
    context_blocks = []
    for c in chunks:
        sources.append({
            "module": c["moduleNumber"],
            "page": c["pageNumber"],
            "source": c["source"],
            "excerpt": c["excerpt"]
        })
        context_blocks.append(
            f"--- Course Note Excerpt [Module {c['moduleNumber']}, Page {c['pageNumber']}, File: {c['source']}] ---\n{c['fullText']}"
        )

    context_str = "\n\n".join(context_blocks)

    # 2. Try LLM synthesis with OpenRouter / OpenAI
    answer = None
    tip = f"Review Module {focus_module or (sources[0]['module'] if sources else 1)} notes thoroughly. Practice drawing system block diagrams and definitions."

    if context_str and OPENROUTER_KEY:
        try:
            system_prompt = (
                "You are the Acadion AI Academic Study Tutor for university engineering courses. "
                "Answer the student's question clearly, thoroughly, and accurately using the provided course notes. "
                "Cite the specific Module number and Page numbers in your explanation. "
                "Structure your answer with: "
                "1. Direct Concept Explanation\n"
                "2. Key Technical Points / Architecture (bullet points)\n"
                "3. Typical Exam Question / Quick Self-Check Challenge.\n"
                "Keep formatting clean in standard Markdown."
            )

            user_prompt = f"Student Question: {student_query}\n"
            if focus_topic:
                user_prompt += f"Context / Focus Weak Topic: {focus_topic}\n"
            user_prompt += f"\nUploaded Course Notes Context:\n{context_str}\n\nPlease explain this concept step-by-step."

            response = client.chat.completions.create(
                model=MODEL_NAME,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3,
                max_tokens=850
            )

            if response and response.choices:
                answer = response.choices[0].message.content
        except Exception as llm_err:
            print(f"[Warning]: LLM generation failed ({llm_err}), activating grounded heuristic fallback.")

    # 3. Grounded Heuristic Synthesis Fallback (if LLM is offline or unkeyed)
    if not answer:
        topic_title = focus_topic or "Course Topic"
        if sources:
            primary_src = sources[0]
            answer = (
                f"### 📘 Academic Tutor Explanation: {topic_title}\n\n"
                f"Based on your course notes in **{primary_src['source']} (Module {primary_src['module']}, Page {primary_src['page']})**:\n\n"
                f"{primary_src['excerpt']}\n\n"
                f"#### 🔑 Key Concepts to Master:\n"
                f"- **Core Definition**: Review the fundamental terminology and architectural diagrams outlined in Module {primary_src['module']}.\n"
                f"- **Exam Focus**: In Internal Assessments and VTU Semester End Exams, questions on *{topic_title}* frequently ask for working principles, neat block diagrams, and comparative limitations.\n"
                f"- **Step-by-Step Problem Solving**: Practice drawing and labeling all standard message sequence diagrams or flowcharts.\n\n"
                f"#### ❓ Quick Self-Check Verification:\n"
                f"*Explain the principal function of {topic_title} and state two primary differences compared to alternative implementations.*"
            )
        else:
            answer = (
                f"### 📘 Academic Tutor Guidance: {topic_title}\n\n"
                f"I am ready to help you study **{topic_title}**! To unlock full page-by-page citations, please ask your instructor to upload the Module notes PDF in the Course Workspace.\n\n"
                f"#### 📌 Recommended Revision Strategy:\n"
                f"1. **Core Terminology**: Review key definitions and formulas in your textbook.\n"
                f"2. **Previous IA Questions**: Practice writing out the 10-mark sub-questions from your recent internal tests.\n"
                f"3. **Peer Discussion**: Clarify doubts on this topic before the upcoming semester examination."
            )

    return {
        "answer": answer,
        "sources": sources,
        "recommendedRevisionTip": tip,
        "focusModule": focus_module,
        "focusTopic": focus_topic,
        "classroomId": classroom_id
    }


if __name__ == "__main__":
    test_cls = "test_class_101"
    sample_text = (
        "Module 2: IoT System Management with NETCONF and SNMP. "
        "SNMP (Simple Network Management Protocol) consists of SNMP Manager, Managed Device, and SNMP Agent. "
        "The Management Information Base (MIB) defines structure of management data using OIDs. "
        "Limitations of SNMP include lack of transaction management and poor security in SNMPv1."
    )
    import io
    # Test index with dummy bytes
    idx_res = index_module_notes(test_cls, 2, sample_text.encode("utf-8"), "iot mod2.pdf")
    print("Indexed:", idx_res)

    chat_res = ask_study_tutor(test_cls, "What are the components of SNMP?", focus_topic="SNMP Architecture", focus_module=2)
    print("\nChat Response:\n", json.dumps(chat_res, indent=2))
