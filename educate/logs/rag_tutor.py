"""
Acadion RAG Study Tutor Engine
Production-ready Academic Retrieval-Augmented Generation for VTU IoT Course Notes.
Uses sentence-transformers ('all-MiniLM-L6-v2'), scikit-learn (TF-IDF & Cosine), and Google GenAI / OpenRouter SDKs.
"""

import os
import io
import re
import json
from typing import Dict, List, Any, Optional, Tuple
import numpy as np
import requests
from dotenv import load_dotenv
import pypdf
from sentence_transformers import SentenceTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

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
    - Normalizes bullet points and replacement characters
    - Strips watermarks & footer noise (e.g., 'VtuCircle', 'vtuplanet', 'vtu notes')
    - Strips isolated page numbers ('Page 11' or standalone '11')
    - Strips repetitive course header banners
    """
    if not raw_text:
        return ""

    # Replace unicode replacement character and special bullet codepoints
    text = raw_text.replace("\ufffd", "•").replace("\uf0b7", "•").replace("\u2022", "•")
    lines = text.splitlines()
    cleaned_lines = []

    for line in lines:
        s = line.strip()
        if not s:
            cleaned_lines.append("")
            continue

        # Isolated page numbers: e.g. "Page 11", "11"
        if re.match(r"^(?:page\s*)?\d+\s*$", s, re.IGNORECASE):
            continue

        # Watermarks & footer noise
        if re.search(r"\b(?:vtucircle(?:\.com)?|vtu\s*circle|vtu\s*planet|vtu\s*notes)\b", s, re.IGNORECASE):
            continue

        # Header banner noise: e.g. "Internet of Things [BCS701] MODULE 2"
        if re.match(r"^Internet of Things\s*\[[A-Za-z0-9]+\]\s*MODULE\s*\d+\s*$", s, re.IGNORECASE):
            continue

        cleaned_lines.append(s)

    cleaned = "\n".join(cleaned_lines)
    return re.sub(r"\n{3,}", "\n\n", cleaned).strip()


HEADING_NUMBERED_REGEX = re.compile(r"^\s*([1-9]\d?(?:\.\d+)+)\s*:?\s+([A-Za-z][^\n.!?]{2,80})$")
KNOWN_HEADING_START_REGEX = re.compile(
    r"^\s*((?:Limitations|Differences?|Advantages?|Disadvantages?|Key Characteristics|Comparison)\s+of\b[^\n.!?]{2,80}|"
    r"Differences?\s+between\b[^\n.!?]{2,80}|"
    r"IoT\s+Enabling\s+Technologies\b[^\n.!?]{2,80}|"
    r"SNMP\s+(?:Components|Architecture|Protocol)\b[^\n.!?]{2,80}|"
    r"NETCONF\s+(?:Components|Architecture|Protocol)\b[^\n.!?]{2,80}|"
    r"YANG\s+(?:Architecture|Data Modeling)\b[^\n.!?]{2,80})$",
    re.IGNORECASE
)


def is_section_heading(line: str) -> Optional[str]:
    """
    Detects section headings strictly by numbered patterns (e.g. 2.1 : Introduction, 2.6 Simple Network Management Protocol)
    or targeted known syllabus lines (e.g. Limitations of SNMP, Differences between IoT and M2M).
    """
    line_clean = line.strip()
    if len(line_clean) < 4 or len(line_clean) > 90:
        return None

    m_num = HEADING_NUMBERED_REGEX.match(line_clean)
    if m_num:
        return line_clean

    m_known = KNOWN_HEADING_START_REGEX.match(line_clean)
    if m_known:
        return line_clean

    return None


def split_text_into_semantic_chunks(cleaned_text: str, module_num: int, page_num: int) -> List[Dict[str, Any]]:
    """
    Legacy helper: preserves backward compatibility for single-page calls.
    Packs page text into chunks with section metadata.
    """
    if not cleaned_text:
        return []

    lines = cleaned_text.splitlines()
    detected_heading = f"Module {module_num} Notes"
    for l in lines:
        h = is_section_heading(l)
        if h:
            detected_heading = h
            break

    body = cleaned_text.strip()
    return [{
        "module": module_num,
        "page_start": page_num,
        "page_end": page_num,
        "page": page_num,
        "section": detected_heading,
        "body": body,
        "text": f"Section: {detected_heading}\n[Course: IoT | Module: {module_num} | Page: {page_num} | Section: {detected_heading}]\n\n{body}",
        "chunk_id": f"mod{module_num}_p{page_num}_c0"
    }]


def build_module_chunks_from_pages(pages_data: List[Tuple[int, str]], module_num: int, filename: str) -> List[Dict[str, Any]]:
    """
    Builds module text as a coherent whole:
    - Splits text into sections by numbered headings or recognized syllabus markers
    - Keeps each heading bound to its following paragraph
    - Packs paragraphs into chunks of ~900-1200 characters with ~150 char overlap
    - NEVER emits a chunk shorter than 250 characters (merges into neighbor)
    - Prefixes every chunk with 'Section: <heading>' and stores all required metadata
    """
    items: List[Tuple[str, int]] = []
    for page_num, text in pages_data:
        cleaned = clean_pdf_text(text)
        if not cleaned:
            continue
        for para in cleaned.split("\n\n"):
            p_strip = para.strip()
            if p_strip:
                items.append((p_strip, page_num))

    if not items:
        return []

    # Group into sections
    sections: List[Tuple[str, List[Tuple[str, int]]]] = []
    current_sec = f"Module {module_num} Overview"
    current_paras: List[Tuple[str, int]] = []

    for p_text, page in items:
        lines = p_text.splitlines()
        first_line = lines[0].strip() if lines else ""
        heading = is_section_heading(first_line)

        if heading:
            if current_paras:
                sections.append((current_sec, current_paras))
                current_paras = []
            current_sec = heading
            rest = "\n".join(lines[1:]).strip()
            if rest:
                current_paras.append((rest, page))
        else:
            current_paras.append((p_text, page))

    if current_paras:
        sections.append((current_sec, current_paras))

    raw_chunks: List[Dict[str, Any]] = []

    for sec_title, paras in sections:
        idx = 0
        while idx < len(paras):
            chunk_paras: List[Tuple[str, int]] = []
            chunk_len = 0
            start_p = paras[idx][1]
            end_p = paras[idx][1]

            j = idx
            while j < len(paras):
                p_txt, p_num = paras[j]
                if chunk_len > 0 and (chunk_len + len(p_txt)) > 1200:
                    break
                chunk_paras.append((p_txt, p_num))
                chunk_len += len(p_txt) + 2
                end_p = p_num
                j += 1
                if chunk_len >= 900:
                    break

            body = "\n\n".join(p[0] for p in chunk_paras).strip()

            raw_chunks.append({
                "module": int(module_num),
                "page_start": start_p,
                "page_end": end_p,
                "page": start_p,
                "section": sec_title,
                "body": body,
                "text": f"Section: {sec_title}\n[Course: IoT | Module: {module_num} | Pages: {start_p}-{end_p} | Section: {sec_title}]\n\n{body}",
                "chunk_id": "",
                "filename": filename
            })

            if j >= len(paras):
                break

            # 150 char overlap: step back 1 paragraph if it's modest in length
            if j > idx + 1 and len(paras[j - 1][0]) <= 320:
                idx = j - 1
            else:
                idx = j

    # Enforce minimum chunk length rule: NEVER emit a chunk < 250 characters (merge into neighbour)
    # Merging forward into the next chunk keeps section headings and introductory text together with following subsections
    merged_chunks: List[Dict[str, Any]] = []
    i = 0
    while i < len(raw_chunks):
        c = raw_chunks[i]
        if len(c["body"]) < 250:
            if i + 1 < len(raw_chunks):
                nxt = raw_chunks[i + 1]
                heading_lead = f"{c['section']}:\n" if c["section"] != nxt["section"] else ""
                nxt["body"] = heading_lead + c["body"] + "\n\n" + nxt["body"]
                nxt["page_start"] = min(c["page_start"], nxt["page_start"])
                sec = f"{c['section']} / {nxt['section']}" if c["section"] != nxt["section"] else nxt["section"]
                nxt["section"] = sec
                nxt["text"] = f"Section: {sec}\n[Course: IoT | Module: {module_num} | Pages: {nxt['page_start']}-{nxt['page_end']} | Section: {sec}]\n\n{nxt['body']}"
                i += 1
                continue
            elif merged_chunks:
                prev = merged_chunks[-1]
                heading_lead = f"\n\n{c['section']}:\n" if c["section"] != prev["section"] else "\n\n"
                prev["body"] += heading_lead + c["body"]
                prev["page_end"] = max(prev["page_end"], c["page_end"])
                sec = prev["section"]
                prev["text"] = f"Section: {sec}\n[Course: IoT | Module: {module_num} | Pages: {prev['page_start']}-{prev['page_end']} | Section: {sec}]\n\n{prev['body']}"
                i += 1
                continue
        merged_chunks.append(c)
        i += 1

    # Double check no chunk < 250 remains
    final_chunks: List[Dict[str, Any]] = []
    for c in merged_chunks:
        if len(c["body"]) < 250 and final_chunks:
            prev = final_chunks[-1]
            prev["body"] += "\n\n" + c["body"]
            prev["page_end"] = max(prev["page_end"], c["page_end"])
            sec = prev["section"]
            prev["text"] = f"Section: {sec}\n[Course: IoT | Module: {module_num} | Pages: {prev['page_start']}-{prev['page_end']} | Section: {sec}]\n\n{prev['body']}"
        else:
            final_chunks.append(c)

    # Assign sequential chunk IDs
    for idx, c in enumerate(final_chunks):
        c["chunk_id"] = f"mod{module_num}_c{idx}"

    return final_chunks


def index_pdf_notes(classroom_id: str, module_num: int, pdf_source: Any, filename: Optional[str] = None) -> Dict[str, Any]:
    """
    Ingests a Module PDF notes document using pypdf:
    - Cleans noise and extracts all pages
    - Builds semantic sections and chunks (~900-1200 chars, >=250 chars)
    - Computes vector embeddings using all-MiniLM-L6-v2
    - Persists chunks to vector_store/{classroom_id}/mod_{module_num}.json and .npy
    - Logs chunk count and average length after indexing
    """
    classroom_dir = get_classroom_store_dir(classroom_id)
    safe_name = filename or f"Module_{module_num}_Notes.pdf"

    # Handle bytes, file path, or file stream
    if isinstance(pdf_source, (bytes, bytearray)):
        reader = pypdf.PdfReader(io.BytesIO(pdf_source))
    elif isinstance(pdf_source, str) and os.path.exists(pdf_source):
        reader = pypdf.PdfReader(pdf_source)
    elif hasattr(pdf_source, "read"):
        content = pdf_source.read()
        reader = pypdf.PdfReader(io.BytesIO(content))
    else:
        raise ValueError("Invalid PDF source provided (expected bytes, file path, or stream)")

    num_pages = len(reader.pages)
    pages_data: List[Tuple[int, str]] = []

    for page_idx, page in enumerate(reader.pages):
        raw_text = page.extract_text() or ""
        pages_data.append((page_idx + 1, raw_text))

    all_chunks = build_module_chunks_from_pages(pages_data, module_num=int(module_num), filename=safe_name)

    if not all_chunks:
        raise ValueError(f"No text could be extracted from {safe_name}")

    # Compute dense embeddings
    chunk_texts = [c["text"] for c in all_chunks]
    embeddings = embedder.encode(chunk_texts, show_progress_bar=False, normalize_embeddings=True)
    embeddings = np.array(embeddings, dtype=np.float32)

    # Save chunks JSON and embeddings NPY
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

    # Log chunk count and average length after indexing
    avg_len = sum(len(c["body"]) for c in all_chunks) / len(all_chunks)
    print(f"[RAG Tutor Indexer] Classroom '{classroom_id}' Module {module_num}: Indexed {len(all_chunks)} chunks (avg {avg_len:.1f} chars/chunk, {num_pages} pages)")

    return {
        "status": "SUCCESS",
        "classroomId": classroom_id,
        "moduleNumber": int(module_num),
        "filename": safe_name,
        "chunksIndexed": len(all_chunks),
        "pageCount": num_pages,
        "avgChunkLength": round(avg_len, 1),
        "embeddingDim": int(embeddings.shape[1])
    }


# Backwards compatibility alias
index_module_notes = index_pdf_notes


def _ensure_module_embeddings(classroom_dir: str, mod_num: int) -> Optional[np.ndarray]:
    """Helper to load or compute embeddings on the fly if .npy is missing"""
    json_path = os.path.join(classroom_dir, f"mod_{mod_num}.json")
    npy_path = os.path.join(classroom_dir, f"mod_{mod_num}.npy")

    if not os.path.exists(json_path):
        return None

    if os.path.exists(npy_path):
        try:
            return np.load(npy_path)
        except Exception:
            pass

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


def decompose_query(query: str) -> List[str]:
    """
    Decomposes compound questions into sub-queries without an LLM:
    - Splits on ' and ', ' with ', ',', ';', ' vs ', ' versus '
    - Extracts key concept nouns
    - Retains original query and meaningful sub-queries
    """
    sub_queries = [query.strip()]

    # Split on conjunctions and punctuation
    parts = re.split(r"\b(?:and|with|versus|vs)\b|[,;?]", query, flags=re.IGNORECASE)
    stop_words = {
        "explain", "describe", "differentiate", "difference", "between",
        "compare", "contrast", "what", "is", "are", "the", "in", "with",
        "a", "an", "its", "of", "for", "neat", "diagram", "components",
        "main", "format", "tabular", "briefly", "discuss", "details", "5", "6"
    }

    for p in parts:
        cleaned_part = re.sub(r"[^\w\s-]", " ", p).strip()
        words = [w for w in cleaned_part.split() if len(w) > 2]
        meaningful_words = [w for w in words if w.lower() not in stop_words]

        if len(meaningful_words) >= 2:
            sub_queries.append(" ".join(meaningful_words))
        elif len(words) >= 2:
            sub_queries.append(" ".join(words))

    # Add keyword-only noun query
    all_words = re.sub(r"[^\w\s-]", " ", query).split()
    keyword_nouns = [w for w in all_words if len(w) > 2 and w.lower() not in stop_words]
    if keyword_nouns:
        sub_queries.append(" ".join(keyword_nouns))

    # Deduplicate while preserving order
    seen = set()
    unique_sub_queries = []
    for sq in sub_queries:
        sq_clean = sq.strip()
        if sq_clean and sq_clean.lower() not in seen:
            seen.add(sq_clean.lower())
            unique_sub_queries.append(sq_clean)

    return unique_sub_queries


def search_relevant_chunks(
    classroom_id: str,
    query: str,
    focus_module: Optional[int] = None,
    top_k: int = 8
) -> List[Dict[str, Any]]:
    """
    Hybrid Search + Query Decomposition + Reciprocal Rank Fusion + Neighbour Expansion:
    1. Decomposes compound questions into sub-queries
    2. Dense Cosine similarity + Sparse TF-IDF per sub-query, merged via RRF
    3. Fetches top candidates, dedupes, expands neighbours for top 3 chunks
    4. Evaluates relevance threshold to prevent hallucinations
    """
    classroom_dir = get_classroom_store_dir(classroom_id)
    target_modules = [focus_module] if focus_module else [1, 2, 3, 4, 5]

    all_candidate_chunks: List[Dict[str, Any]] = []
    all_candidate_embs: List[np.ndarray] = []
    module_chunk_map: Dict[int, List[Dict[str, Any]]] = {}

    for m in target_modules:
        json_path = os.path.join(classroom_dir, f"mod_{m}.json")
        if not os.path.exists(json_path):
            continue
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                chunks = json.load(f)
            embs = _ensure_module_embeddings(classroom_dir, m)
            if embs is not None and len(chunks) == len(embs):
                # Annotate module internal index
                for idx, c in enumerate(chunks):
                    c["_mod_idx"] = idx
                module_chunk_map[m] = chunks
                all_candidate_chunks.extend(chunks)
                all_candidate_embs.append(embs)
        except Exception as e:
            print(f"[RAG Tutor Warning] Error reading module {m}: {e}")

    if not all_candidate_chunks or not all_candidate_embs:
        return []

    combined_embs = np.vstack(all_candidate_embs)
    num_chunks = len(all_candidate_chunks)

    # Prepare TF-IDF vectorizer over candidate chunks
    chunk_corpus = [c.get("text") or c.get("body", "") for c in all_candidate_chunks]
    try:
        tfidf_vec = TfidfVectorizer(ngram_range=(1, 2), stop_words="english")
        tfidf_matrix = tfidf_vec.fit_transform(chunk_corpus)
    except Exception as tfidf_err:
        tfidf_vec = None
        tfidf_matrix = None

    sub_queries = decompose_query(query)
    rrf_scores = np.zeros(num_chunks, dtype=np.float32)
    max_dense_scores = np.zeros(num_chunks, dtype=np.float32)
    max_tfidf_scores = np.zeros(num_chunks, dtype=np.float32)

    for sq in sub_queries:
        # 1. Dense Cosine
        sq_emb = embedder.encode([sq], normalize_embeddings=True)[0]
        dense_sims = np.dot(combined_embs, sq_emb)
        max_dense_scores = np.maximum(max_dense_scores, dense_sims)
        dense_ranking = np.argsort(dense_sims)[::-1]

        # 2. Sparse TF-IDF
        if tfidf_vec is not None and tfidf_matrix is not None:
            sq_tfidf = tfidf_vec.transform([sq])
            tfidf_sims = cosine_similarity(sq_tfidf, tfidf_matrix).flatten()
            max_tfidf_scores = np.maximum(max_tfidf_scores, tfidf_sims)
            tfidf_ranking = np.argsort(tfidf_sims)[::-1]
        else:
            tfidf_ranking = dense_ranking

        # Rank maps (rank = 0 is best)
        dense_rank_map = {idx: rank for rank, idx in enumerate(dense_ranking)}
        tfidf_rank_map = {idx: rank for rank, idx in enumerate(tfidf_ranking)}

        # 3. Reciprocal Rank Fusion
        for i in range(num_chunks):
            rrf_scores[i] += (1.0 / (60.0 + dense_rank_map[i])) + (1.0 / (60.0 + tfidf_rank_map[i]))

    # Relevance Threshold Check: if top similarity is extremely low, query has zero grounding
    overall_best_dense = float(np.max(max_dense_scores))
    overall_best_tfidf = float(np.max(max_tfidf_scores))
    if overall_best_dense < 0.22 and overall_best_tfidf < 0.05:
        print(f"[RAG Tutor] Query '{query}' rejected by relevance gate (best_dense={overall_best_dense:.3f}, best_tfidf={overall_best_tfidf:.3f})")
        return []

    # Select top candidate chunks by RRF score
    top_candidate_indices = np.argsort(rrf_scores)[::-1][:12]
    top_candidates = [all_candidate_chunks[idx] for idx in top_candidate_indices]

    # Deduplicate top 8 overall
    seen_ids = set()
    initial_top = []
    for c in top_candidates:
        cid = c["chunk_id"]
        if cid not in seen_ids:
            seen_ids.add(cid)
            initial_top.append(c)
        if len(initial_top) >= top_k:
            break

    # Neighbour Expansion for the top 3 chunks (same module, idx-1 and idx+1)
    expanded_chunks: List[Dict[str, Any]] = list(initial_top)
    for c in initial_top[:3]:
        m = c.get("module")
        mod_idx = c.get("_mod_idx")
        if m in module_chunk_map and mod_idx is not None:
            m_list = module_chunk_map[m]
            if mod_idx > 0:
                prev_c = m_list[mod_idx - 1]
                if prev_c["chunk_id"] not in seen_ids:
                    seen_ids.add(prev_c["chunk_id"])
                    expanded_chunks.append(prev_c)
            if mod_idx + 1 < len(m_list):
                next_c = m_list[mod_idx + 1]
                if next_c["chunk_id"] not in seen_ids:
                    seen_ids.add(next_c["chunk_id"])
                    expanded_chunks.append(next_c)

    # Attach computed similarities and clean fields
    results = []
    for c in expanded_chunks:
        c_copy = dict(c)
        # Find index in all_candidate_chunks
        orig_idx = next((i for i, oc in enumerate(all_candidate_chunks) if oc["chunk_id"] == c["chunk_id"]), None)
        sim = float(max_dense_scores[orig_idx]) if orig_idx is not None else 0.5
        c_copy["similarity"] = round(sim, 3)
        results.append(c_copy)

    # Order final context by module, then page_start, then chunk_id
    results.sort(key=lambda x: (x.get("module", 0), x.get("page_start", 0), x.get("chunk_id", "")))

    return results


def generate_answer(query: str, retrieved_chunks: List[Dict[str, Any]], api_key: Optional[str] = None) -> Tuple[str, str]:
    """
    Generates an authoritative, structured academic response using:
    1. Google GenAI SDK (Gemini) if GEMINI_API_KEY is available (temperature=0.2)
    2. OpenRouter API if OPENROUTER_API_KEY is available (temperature=0.2, timeout=40s)
    3. Extractive Contextual Synthesis fallback if all LLMs are unreachable

    Returns:
    (answer_text, generation_mode) where generation_mode is 'LLM' or 'EXTRACTIVE_FALLBACK'
    """
    if not retrieved_chunks:
        return (
            "This topic is not covered in your uploaded course notes.",
            "EXTRACTIVE_FALLBACK"
        )

    formatted_context_sections = []
    for c in retrieved_chunks:
        mod = c.get("module", "?")
        p_start = c.get("page_start", c.get("page", 1))
        p_end = c.get("page_end", p_start)
        page_str = f"p.{p_start}" if p_start == p_end else f"pp.{p_start}-{p_end}"
        sec = c.get("section") or "Course Notes"
        formatted_context_sections.append(
            f"### Section: {sec} [Module {mod}, {page_str}]\n{c.get('body', '')}"
        )

    context_str = "\n\n---\n\n".join(formatted_context_sections)

    prompt = f"""You are the Acadion Academic Tutor for the Internet of Things course.
Answer the student's question strictly and authoritatively using ONLY the provided course notes context below.

STRICT INSTRUCTIONS:
1. Answer ONLY from the provided context. Do NOT use outside knowledge. Synthesize comparisons, differences, and explanations directly from the relevant sections (for example, comparing conventional networks and SDN/NFV using the provided details on control plane and data plane separation, hardware complexity, and centralization). If a specific aspect is genuinely absent from the context, explicitly state: "This is not covered in your uploaded notes" for that specific part.
2. Adapt your output format to the student's question:
   - If asked for a "tabular format", "table", or "compare/differentiate": Return a comprehensive GitHub-flavored Markdown table covering key technical parameters from the notes (such as control plane and data plane separation, centralization, hardware complexity, and protocols).
   - If asked to "explain", "describe", or for an overview: Provide a well-structured explanation with clear headings and technical bullet points.
   - If asked for "N points", "limitations", "advantages", or "characteristics": Provide a numbered list using the exact points from the notes (e.g. if the student asks for 5 and the notes list 6, state the 5 main ones and mention that the notes detail 6 in total).
3. Figures and diagrams in the notes are visual images not directly in the extracted text. If a diagram is requested, construct a clean text/ASCII architectural block diagram using ONLY components explicitly named in the notes and label it "(reconstructed from the notes' text)".
4. Cite inline like [Module 2, p.11] after each claim, component, or limitation.
5. Do NOT add a generic "Exam Tip" unless the notes contain specific marks or examination guidance. Keep the answer length directly proportional to the question asked.

COURSE NOTES CONTEXT:
{context_str}

STUDENT QUESTION: {query}"""

    # 1. Try Google Gemini API
    gemini_key = api_key or os.getenv("GEMINI_API_KEY", "") or os.getenv("GOOGLE_API_KEY", "")
    if gemini_key:
        clean_key = gemini_key.strip()
        GEMINI_MODELS = [
            os.getenv("GEMINI_MODEL", "gemini-3.8-flash"),
            "gemini-3.8-flash",
            "gemini-2.5-flash",
            "gemini-2.0-flash"
        ]
        candidate_models = list(dict.fromkeys(GEMINI_MODELS))

        try:
            from google import genai
            from google.genai import types
            client = genai.Client(api_key=clean_key)
            config = types.GenerateContentConfig(temperature=0.2)

            for model_name in candidate_models:
                try:
                    response = client.models.generate_content(
                        model=model_name,
                        contents=prompt,
                        config=config
                    )
                    if response and response.text:
                        return response.text.strip(), "LLM"
                except Exception as m_err:
                    print(f"[RAG Tutor GenAI SDK Exception ({model_name})]: {m_err}")
                    continue
        except Exception as e:
            print(f"[RAG Tutor GenAI SDK Initialization Exception]: {e}")

    # 2. Try OpenRouter API
    openrouter_key = os.getenv("OPENROUTER_API_KEY", "")
    if openrouter_key:
        try:
            openrouter_model = os.getenv("AI_OPENROUTER_MODEL", "google/gemini-3.8-flash")
            resp = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {openrouter_key.strip()}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://acadion.edu",
                    "X-Title": "Acadion RAG Study Tutor"
                },
                json={
                    "model": openrouter_model,
                    "messages": [
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.2,
                    "max_tokens": 2048
                },
                timeout=40
            )
            if resp.status_code == 200:
                data = resp.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                if content:
                    return content.strip(), "LLM"
            else:
                print(f"[RAG Tutor OpenRouter Error {resp.status_code}]: {resp.text}")
        except Exception as e:
            print(f"[RAG Tutor OpenRouter Exception]: {e}")

    # 3. Transparent Extractive Fallback (No hallucination, never pretend to be an LLM)
    fallback_text = synthesize_academic_fallback(query, retrieved_chunks)
    return fallback_text, "EXTRACTIVE_FALLBACK"


def synthesize_academic_fallback(query: str, retrieved_chunks: List[Dict[str, Any]]) -> str:
    """
    Returns the retrieved passages grouped cleanly by section with a clear note:
    'AI answer generation is unavailable, showing note excerpts'.
    """
    if not retrieved_chunks:
        return "This topic is not covered in your uploaded course notes."

    sections_grouped: Dict[str, List[str]] = {}
    for c in retrieved_chunks:
        sec = c.get("section") or "Course Notes"
        mod = c.get("module", "?")
        p_start = c.get("page_start", c.get("page", 1))
        p_end = c.get("page_end", p_start)
        page_str = f"p.{p_start}" if p_start == p_end else f"pp.{p_start}-{p_end}"
        header = f"{sec} [Module {mod}, {page_str}]"

        if header not in sections_grouped:
            sections_grouped[header] = []
        body = c.get("body", "").strip()
        if body and body not in sections_grouped[header]:
            sections_grouped[header].append(body)

    out = ["⚠️ *AI answer generation is unavailable, showing note excerpts:*\n"]
    for header, bodies in sections_grouped.items():
        out.append(f"### {header}\n" + "\n\n".join(bodies))

    return "\n\n".join(out)


def ask_study_tutor(
    classroom_id: str,
    student_query: str,
    focus_topic: Optional[str] = None,
    focus_module: Optional[int] = None
) -> Dict[str, Any]:
    """
    Main entry point for student queries:
    1. Hybrid search (dense cosine + sparse TF-IDF) with sub-query decomposition
    2. Neighbour expansion for multi-part syllabus lists
    3. LLM generation with strict prompt, inline citations [Module X, p.Y], and temperature 0.2
    4. Clean structured sources with module, page, section, source, excerpt, content
    5. Returns generationMode ("LLM" | "EXTRACTIVE_FALLBACK") and sourceMode
    """
    if not student_query or not student_query.strip():
        return {
            "answer": "Please ask a question regarding your IoT syllabus or course notes.",
            "generationMode": "EXTRACTIVE_FALLBACK",
            "sourceMode": "not_found",
            "groundedModule": None,
            "groundedSection": None,
            "sources": []
        }

    # Retrieve relevant chunks
    chunks = search_relevant_chunks(
        classroom_id=classroom_id,
        query=student_query,
        focus_module=focus_module,
        top_k=8
    )

    if not chunks:
        return {
            "answer": "This topic is not covered in your uploaded course notes.",
            "generationMode": "EXTRACTIVE_FALLBACK",
            "sourceMode": "not_found",
            "groundedModule": None,
            "groundedSection": None,
            "sources": []
        }

    # Generate answer
    answer_text, gen_mode = generate_answer(query=student_query, retrieved_chunks=chunks)

    # Format sources
    sources = []
    grounded_mod = f"Module {chunks[0].get('module', 1)}"
    grounded_sec = chunks[0].get("section", f"Page {chunks[0].get('page', 1)}")

    for c in chunks:
        body = c.get("body") or c.get("text", "")
        excerpt = body[:300] + ("..." if len(body) > 300 else "")
        sources.append({
            "module": c.get("module", 1),
            "page": c.get("page_start", c.get("page", 1)),
            "page_start": c.get("page_start", c.get("page", 1)),
            "page_end": c.get("page_end", c.get("page_start", 1)),
            "section": c.get("section", ""),
            "source": c.get("filename", f"Module_{c.get('module', 1)}_Notes.pdf"),
            "excerpt": excerpt,
            "content": body,
            "chunk_id": c.get("chunk_id", ""),
            "similarity": c.get("similarity", 0.0)
        })

    source_mode = "grounded_rag" if gen_mode == "LLM" else "extractive_fallback"

    return {
        "answer": answer_text,
        "generationMode": gen_mode,
        "sourceMode": source_mode,
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
