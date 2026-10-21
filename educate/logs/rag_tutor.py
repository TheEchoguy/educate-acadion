"""
Acadion RAG Study Tutor Engine
Production-ready Academic Retrieval-Augmented Generation for IoT Course Notes
Uses sentence-transformers ('all-MiniLM-L6-v2'), pypdf, and Google GenAI SDK (Gemini).
"""

import os
import io
import re
import json
from typing import Dict, List, Any, Optional
import numpy as np
import requests
from dotenv import load_dotenv
import pypdf
from sentence_transformers import SentenceTransformer

# Load environment variables from .env
load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
VECTOR_STORE_DIR = os.path.join(BASE_DIR, "vector_store")
os.makedirs(VECTOR_STORE_DIR, exist_ok=True)

# Initialize lightweight local embedding model
print("[RAG Tutor] Initializing local embedding model 'all-MiniLM-L6-v2'...")
embedder = SentenceTransformer("all-MiniLM-L6-v2")
print("[RAG Tutor] Embedding model ready.")


def get_classroom_store_dir(classroom_id: str) -> str:
    clean_id = re.sub(r"[^a-zA-Z0-9_\-]", "_", str(classroom_id or "default"))
    path = os.path.join(VECTOR_STORE_DIR, clean_id)
    os.makedirs(path, exist_ok=True)
    return path


def clean_pdf_text(raw_text: str) -> str:
    """
    Cleans repetitive PDF extraction noise:
    - Strips watermarks & footer noise (e.g., 'VtuCircle', 'vtuplanet', 'vtu notes')
    - Strips isolated page numbers ('Page 11' or standalone '11')
    - Strips repetitive course header banners
    """
    if not raw_text:
        return ""
    lines = raw_text.splitlines()
    cleaned_lines = []
    for line in lines:
        s = line.strip()
        if not s:
            cleaned_lines.append("")
            continue
        # Isolated page numbers
        if re.match(r"^(?:page\s*)?\d+\s*$", s, re.IGNORECASE):
            continue
        # Watermarks & footer noise
        if re.search(r"\b(?:vtucircle(?:\.com)?|vtu\s*circle|vtu\s*planet|vtu\s*notes)\b", s, re.IGNORECASE):
            continue
        # Header banner noise
        if re.match(r"^Internet of Things\s*\[[A-Z0-9]+\]\s*$", s, re.IGNORECASE):
            continue
        cleaned_lines.append(s)

    cleaned = "\n".join(cleaned_lines)
    return re.sub(r"\n{3,}", "\n\n", cleaned).strip()


def split_text_into_semantic_chunks(cleaned_text: str, module_num: int, page_num: int) -> List[Dict[str, Any]]:
    """
    Splits page text into high-precision technical chunks (400-500 chars with ~100 char overlap).
    Preserves heading and section context so queries like 'explain application layer'
    precisely match the application layer text rather than transport layer text.
    """
    if not cleaned_text:
        return []

    # Section heading markers to split on
    heading_pattern = re.compile(
        r"(?:^|\n)(?=(?:[0-9]+\.[0-9]+(?:\.[0-9]+)?|[A-Z][a-zA-Z0-9\s/–-]{3,35}:|Application\s+[Ll]ayer|Transport\s+[Ll]ayer|Network\s+[Ll]ayer|Link\s+[Ll]ayer|Physical\s+Design|Logical\s+Design|IoT\s+Enabling|IoT\s+Levels|SNMP|NETCONF|YANG|CoAP|MQTT|XMPP|AMQP|DDS))",
        re.MULTILINE
    )

    raw_sections = heading_pattern.split(cleaned_text)
    paragraphs = []
    for sec in raw_sections:
        s = sec.strip()
        if not s:
            continue
        # Further split long paragraphs if needed
        if len(s) > 650:
            sub_parts = re.split(r"\n{2,}|\.\s+", s)
            current_accum = ""
            for p in sub_parts:
                p_clean = p.strip()
                if not p_clean:
                    continue
                if len(current_accum) + len(p_clean) < 500:
                    current_accum += (" " if current_accum else "") + p_clean
                else:
                    if current_accum:
                        paragraphs.append(current_accum)
                    current_accum = p_clean
            if current_accum:
                paragraphs.append(current_accum)
        else:
            paragraphs.append(s)

    chunks = []
    chunk_size = 480
    overlap = 100

    for para in paragraphs:
        if len(para) <= chunk_size:
            breadcrumb = f"[Course: IoT | Module: {module_num} | Page: {page_num}]"
            full_text = f"{breadcrumb}: {para}"
            chunks.append({
                "breadcrumb": breadcrumb,
                "module": module_num,
                "page": page_num,
                "body": para,
                "text": full_text
            })
        else:
            start = 0
            while start < len(para):
                end = min(start + chunk_size, len(para))
                # Avoid cutting off words mid-sentence
                if end < len(para):
                    last_space = para.rfind(" ", start + 300, end)
                    if last_space != -1:
                        end = last_space

                chunk_body = para[start:end].strip()
                if chunk_body:
                    breadcrumb = f"[Course: IoT | Module: {module_num} | Page: {page_num}]"
                    full_text = f"{breadcrumb}: {chunk_body}"
                    chunks.append({
                        "breadcrumb": breadcrumb,
                        "module": module_num,
                        "page": page_num,
                        "body": chunk_body,
                        "text": full_text
                    })

                if end >= len(para):
                    break
                start = max(end - overlap, start + 1)

    return chunks


def index_pdf_notes(classroom_id: str, module_num: int, pdf_source: Any, filename: Optional[str] = None) -> Dict[str, Any]:
    """
    Ingests a Module PDF notes document using pypdf:
    - Cleans noise and splits into 400-500 char chunks with breadcrumbs
    - Computes vector embeddings using all-MiniLM-L6-v2
    - Persists chunks to vector_store/{classroom_id}/mod_{module_num}.json and .npy
    """
    classroom_dir = get_classroom_store_dir(classroom_id)
    safe_name = filename or f"Module_{module_num}_Notes.pdf"

    # Handle bytes or file path
    if isinstance(pdf_source, (bytes, bytearray)):
        reader = pypdf.PdfReader(io.BytesIO(pdf_source))
    elif isinstance(pdf_source, str) and os.path.exists(pdf_source):
        reader = pypdf.PdfReader(pdf_source)
    elif hasattr(pdf_source, "read"):
        content = pdf_source.read()
        reader = pypdf.PdfReader(io.BytesIO(content))
    else:
        raise ValueError("Invalid PDF source provided (expected bytes, file path, or stream)")

    all_chunks = []
    num_pages = len(reader.pages)

    for page_idx, page in enumerate(reader.pages):
        raw_text = page.extract_text() or ""
        cleaned = clean_pdf_text(raw_text)
        if not cleaned:
            continue
        page_chunks = split_text_into_semantic_chunks(cleaned, module_num=int(module_num), page_num=page_idx + 1)
        for c in page_chunks:
            c["filename"] = safe_name
            c["chunk_id"] = f"mod{module_num}_p{c['page']}_c{len(all_chunks)}"
            all_chunks.append(c)

    if not all_chunks:
        raise ValueError(f"No text could be extracted from {safe_name}")

    # Compute embeddings
    chunk_texts = [c["text"] for c in all_chunks]
    embeddings = embedder.encode(chunk_texts, show_progress_bar=False, normalize_embeddings=True)
    embeddings = np.array(embeddings, dtype=np.float32)

    # Save to disk
    json_path = os.path.join(classroom_dir, f"mod_{module_num}.json")
    npy_path = os.path.join(classroom_dir, f"mod_{module_num}.npy")

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(all_chunks, f, ensure_ascii=False, indent=2)

    np.save(npy_path, embeddings)

    # Update manifest
    manifest_path = os.path.join(classroom_dir, "manifest.json")
    manifest = {}
    if os.path.exists(manifest_path):
        try:
            with open(manifest_path, "r", encoding="utf-8") as f:
                manifest = json.load(f)
        except Exception:
            manifest = {}

    manifest[str(module_num)] = {
        "moduleNumber": int(module_num),
        "filename": safe_name,
        "pageCount": num_pages,
        "chunkCount": len(all_chunks),
        "status": "READY"
    }

    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    return {
        "status": "SUCCESS",
        "classroomId": classroom_id,
        "moduleNumber": int(module_num),
        "filename": safe_name,
        "chunksIndexed": len(all_chunks),
        "pageCount": num_pages,
        "embeddingDim": int(embeddings.shape[1])
    }


# Backwards compatibility alias
index_module_notes = index_pdf_notes


def _ensure_module_embeddings(classroom_dir: str, mod_num: int) -> Optional[np.ndarray]:
    """Helper to load or compute embeddings for a module on the fly if .npy is missing"""
    json_path = os.path.join(classroom_dir, f"mod_{mod_num}.json")
    npy_path = os.path.join(classroom_dir, f"mod_{mod_num}.npy")

    if not os.path.exists(json_path):
        return None

    if os.path.exists(npy_path):
        try:
            return np.load(npy_path)
        except Exception:
            pass

    # Re-compute embeddings from json
    try:
        with open(json_path, "r", encoding="utf-8") as f:
            chunks = json.load(f)
        texts = [c.get("text", c.get("body", "")) for c in chunks]
        embs = embedder.encode(texts, show_progress_bar=False, normalize_embeddings=True)
        embs = np.array(embs, dtype=np.float32)
        np.save(npy_path, embs)
        return embs
    except Exception as e:
        print(f"[RAG Tutor Error] Failed to generate embeddings for mod_{mod_num}: {e}")
        return None


def search_relevant_chunks(classroom_id: str, query: str, focus_module: Optional[int] = None, top_k: int = 3) -> List[Dict[str, Any]]:
    """
    Performs cosine similarity vector search using SentenceTransformer embeddings.
    Retrieves the top k most relevant chunks.
    """
    classroom_dir = get_classroom_store_dir(classroom_id)
    query_emb = embedder.encode([query], normalize_embeddings=True)
    query_emb = np.array(query_emb, dtype=np.float32).flatten()

    all_candidate_chunks = []
    all_candidate_embs = []

    # Determine modules to search
    target_modules = [focus_module] if focus_module else [1, 2, 3, 4, 5]

    for m in target_modules:
        json_path = os.path.join(classroom_dir, f"mod_{m}.json")
        if not os.path.exists(json_path):
            continue
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                chunks = json.load(f)
            embs = _ensure_module_embeddings(classroom_dir, m)
            if embs is not None and len(chunks) == len(embs):
                all_candidate_chunks.extend(chunks)
                all_candidate_embs.append(embs)
        except Exception as e:
            print(f"[RAG Tutor Warning] Error reading module {m}: {e}")

    # Fallback to legacy modules_index.json if mod_*.json not yet separated
    if not all_candidate_chunks:
        legacy_path = os.path.join(classroom_dir, "modules_index.json")
        if os.path.exists(legacy_path):
            try:
                with open(legacy_path, "r", encoding="utf-8") as f:
                    legacy_chunks = json.load(f)
                if focus_module:
                    legacy_chunks = [c for c in legacy_chunks if c.get("moduleNumber") == focus_module or c.get("module") == focus_module]
                if legacy_chunks:
                    texts = [c.get("text", c.get("body", "")) for c in legacy_chunks]
                    embs = embedder.encode(texts, show_progress_bar=False, normalize_embeddings=True)
                    embs = np.array(embs, dtype=np.float32)
                    all_candidate_chunks.extend(legacy_chunks)
                    all_candidate_embs.append(embs)
            except Exception as e:
                print(f"[RAG Tutor Warning] Legacy index fallback error: {e}")

    if not all_candidate_chunks or not all_candidate_embs:
        return []

    combined_embs = np.vstack(all_candidate_embs)
    similarities = np.dot(combined_embs, query_emb)

    # Sort descending
    top_indices = np.argsort(similarities)[::-1][:top_k]

    results = []
    for idx in top_indices:
        chunk = dict(all_candidate_chunks[idx])
        chunk["similarity"] = float(similarities[idx])
        results.append(chunk)

    return results


def generate_answer(query: str, retrieved_chunks: List[Dict[str, Any]], api_key: Optional[str] = None) -> str:
    """
    Generates an authoritative, structured academic response using:
    1. Google GenAI SDK (Gemini) if GEMINI_API_KEY is available
    2. OpenRouter API if OPENROUTER_API_KEY is available
    3. High-quality direct contextual synthesis fallback
    """
    concatenated_chunks = "\n\n---\n\n".join([
        c.get("text") or f"[Module {c.get('module', '?')} | Page {c.get('page', '?')}]: {c.get('body', '')}"
        for c in retrieved_chunks
    ])

    prompt = f"""You are the Acadion Academic Tutor for the Internet of Things course.
Answer the student's question clearly, thoroughly, and professionally using the retrieved course notes context.

Structure your response:
1. 🎯 Core Concept Summary (2-3 concise sentences)
2. 🔑 Detailed Technical Breakdown (explain the protocols/concepts mentioned in the notes with clean bullet points)
3. 💡 Exam Tip (how this is asked in university exams)

Context from Course Notes:
{concatenated_chunks}

Question: {query}"""

    # 1. Check GEMINI_API_KEY
    gemini_key = api_key or os.getenv("GEMINI_API_KEY", "") or os.getenv("GOOGLE_API_KEY", "")
    if gemini_key:
        clean_key = gemini_key.replace("rag-", "").strip() if gemini_key.startswith("rag-") else gemini_key.strip()
        try:
            from google import genai
            client = genai.Client(api_key=clean_key)
            # Try recommended gemini-3.8-flash, fallback to gemini-2.5-flash
            for m in ["gemini-3.8-flash", "gemini-2.5-flash"]:
                try:
                    response = client.models.generate_content(
                        model=m,
                        contents=prompt
                    )
                    if response and response.text:
                        return response.text.strip()
                except Exception as m_err:
                    if "404" in str(m_err) or "not found" in str(m_err).lower():
                        continue
                    raise m_err
        except Exception as e:
            print(f"[RAG Tutor GenAI SDK Exception]: {e}")

    # 2. Check OPENROUTER_API_KEY
    openrouter_key = os.getenv("OPENROUTER_API_KEY", "")
    if openrouter_key:
        try:
            resp = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {openrouter_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://acadion.edu",
                    "X-Title": "Acadion RAG Study Tutor"
                },
                json={
                    "model": "google/gemini-2.5-flash",
                    "messages": [
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.3
                },
                timeout=25
            )
            if resp.status_code == 200:
                data = resp.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                if content:
                    return content.strip()
        except Exception as e:
            print(f"[RAG Tutor OpenRouter Exception]: {e}")

    # 3. Direct Academic Contextual Synthesis (Zero-hallucination deterministic fallback)
    return synthesize_academic_fallback(query, retrieved_chunks)


def synthesize_academic_fallback(query: str, retrieved_chunks: List[Dict[str, Any]]) -> str:
    """
    Deterministic academic response synthesizer strictly adhering to the 3-part layout
    when external cloud APIs are unreachable.
    """
    if not retrieved_chunks:
        return (
            "### 🎯 Core Concept Summary\n"
            "No direct passage matching this query was found in the indexed course notes for this module.\n\n"
            "### 🔑 Detailed Technical Breakdown\n"
            "• Please ensure course notes for this module have been uploaded and indexed.\n"
            "• Verify your query keywords align with the VTU Internet of Things syllabus.\n\n"
            "### 💡 Exam Tip\n"
            "Review Module 1 through 5 syllabus headings to locate relevant topics."
        )

    # Extract distinct facts and breadcrumbs
    facts = []
    seen = set()
    for c in retrieved_chunks:
        body = c.get("body") or c.get("text", "")
        # Remove breadcrumb from body if present
        body = re.sub(r"^\[.*?\]:\s*", "", body).strip()
        sentences = re.split(r"(?<=[.!?])\s+", body)
        for s in sentences:
            s_clean = s.strip()
            if len(s_clean) > 30 and s_clean not in seen:
                seen.add(s_clean)
                facts.append(s_clean)

    summary_sentences = facts[:2] if len(facts) >= 2 else facts
    summary_text = " ".join(summary_sentences) if summary_sentences else f"The course notes define key architectural principles and operational protocols for {query}."

    bullet_points = []
    for f in facts[2:8]:
        bullet_points.append(f"• **Key Concept:** {f}")

    if not bullet_points:
        for f in facts:
            bullet_points.append(f"• {f}")

    first_mod = retrieved_chunks[0].get("module", "1")
    exam_tip = (
        f"In university examinations, questions regarding this concept typically appear in Module {first_mod} "
        f"as an 8 to 10 mark descriptive question requiring an architectural block diagram and technical protocol comparisons."
    )

    return (
        f"### 🎯 Core Concept Summary\n"
        f"{summary_text}\n\n"
        f"### 🔑 Detailed Technical Breakdown\n"
        + "\n".join(bullet_points) + "\n\n"
        f"### 💡 Exam Tip\n"
        f"{exam_tip}"
    )


def ask_study_tutor(classroom_id: str, student_query: str, focus_topic: Optional[str] = None, focus_module: Optional[int] = None) -> Dict[str, Any]:
    """
    Main entry point for student queries:
    1. Vector similarity search across scoped module chunks
    2. Context generation and LLM answer generation
    3. Clean source tracking
    """
    if not student_query or not student_query.strip():
        return {
            "answer": "Please ask a question regarding your IoT syllabus or course notes.",
            "groundedModule": None,
            "groundedSection": None,
            "sources": []
        }

    # Retrieve top 3 relevant chunks
    chunks = search_relevant_chunks(
        classroom_id=classroom_id,
        query=student_query,
        focus_module=focus_module,
        top_k=3
    )

    # Generate answer
    answer_text = generate_answer(query=student_query, retrieved_chunks=chunks)

    # Format sources
    sources = []
    grounded_mod = None
    grounded_sec = None

    if chunks:
        grounded_mod = f"Module {chunks[0].get('module', 1)}"
        grounded_sec = f"Page {chunks[0].get('page', 1)}"
        for c in chunks:
            sources.append({
                "module": c.get("module", 1),
                "page": c.get("page", 1),
                "chunk_id": c.get("chunk_id", ""),
                "similarity": round(c.get("similarity", 0.0), 3),
                "breadcrumb": c.get("breadcrumb", ""),
                "content": c.get("body") or c.get("text", "")
            })

    return {
        "answer": answer_text,
        "groundedModule": grounded_mod,
        "groundedSection": grounded_sec,
        "sources": sources
    }


def get_indexed_modules(classroom_id: str) -> Dict[str, Any]:
    """
    Returns the indexed module status for Modules 1 to 5.
    """
    classroom_dir = get_classroom_store_dir(classroom_id)
    manifest_path = os.path.join(classroom_dir, "manifest.json")
    manifest = {}
    if os.path.exists(manifest_path):
        try:
            with open(manifest_path, "r", encoding="utf-8") as f:
                manifest = json.load(f)
        except Exception:
            manifest = {}

    module_details = []
    total_chunks = 0

    for m in range(1, 6):
        m_str = str(m)
        json_path = os.path.join(classroom_dir, f"mod_{m}.json")
        chunks_count = 0
        status = "NOT_INDEXED"
        filename = f"IoT_Module{m}_Notes.pdf"

        if os.path.exists(json_path):
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    chunks_count = len(data)
                    status = "READY" if chunks_count > 0 else "NOT_INDEXED"
            except Exception:
                status = "ERROR"

        if m_str in manifest:
            filename = manifest[m_str].get("filename", filename)
            if status != "READY":
                status = manifest[m_str].get("status", status)

        total_chunks += chunks_count
        module_details.append({
            "moduleNumber": m,
            "name": f"Module {m}",
            "filename": filename,
            "chunks": chunks_count,
            "status": status
        })

    return {
        "status": "ready" if total_chunks > 0 else "empty",
        "classroomId": classroom_id,
        "totalChunks": total_chunks,
        "modules": module_details
    }
