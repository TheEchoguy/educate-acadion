# Acadion ML & RAG Microservice — Predictive XAI & Vector Search Engine

> **Python FastAPI microservice powering Scikit-Learn risk modeling, SHAP (SHapley Additive exPlanations) attribution, grounded RAG curriculum retrieval, and multimodal vision paper extraction.**

[![Python 3.10+](https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/Framework-FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Scikit-Learn](https://img.shields.io/badge/ML-Scikit--Learn-F7931E?logo=scikitlearn&logoColor=white)](https://scikit-learn.org/)
[![SHAP](https://img.shields.io/badge/XAI-SHAP%20TreeExplainer-FF6F00)](https://shap.readthedocs.io/)
[![Sentence Transformers](https://img.shields.io/badge/Embeddings-all--MiniLM--L6--v2-yellow)](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2)

---

## 🔬 Core Microservice Components

### 1. Scikit-Learn Academic Risk & SHAP XAI Engine (`ml_risk_xai.py`)
- **Ensemble Classifier:** Calibrated Random Forest & Gradient Boosting models trained on academic vectors (CIE scores, assignment frequency, attendance ratios, and concept mastery drop-offs).
- **Game-Theoretic SHAP Attributions:** Employs `shap.TreeExplainer` to calculate local Shapley attributions for individual student predictions.
- **Explainable Output:** Yields quantitative force factors detailing positive drivers vs. specific risk triggers (e.g., Module 2 sub-75% attendance impact).
- **Serialized Artifact:** Persisted as `academic_risk_model.joblib`.

### 2. Grounded Course RAG AI Study Tutor (`rag_tutor.py`)
- **Dense Vector Embeddings:** Uses `sentence-transformers/all-MiniLM-L6-v2` for dense semantic vector search across course syllabi, lecture slides, and reference notes.
- **Zero-Hallucination Retrieval:** Retrieved text chunks are injected as verified curriculum context into Google Gemini (`gemini-2.5-flash`, `gemini-1.5-flash` fallbacks).
- **Provenance & Citation Cards:** Returns exact document names, chapter sections, and chunk citations for student verification.
- **Cross-Module Search Expansion:** Automatically searches adjacent modules if specific sub-topics span multiple curriculum units.

### 3. Multimodal Examination Extractor (`ai_extractor.py`)
- **Vision-Language Paper Parser:** Extracts VTU descriptive examination papers (Part A/B choice structures, Q1–Q4) and objective MCQs from PDF scans.
- **Curriculum Alignment:** Automatically maps sub-questions to Bloom's taxonomy levels, syllabus modules, and maximum marks into structured JSON blueprints.

---

## 🚀 Setup & Local Execution

### Prerequisites
- **Python 3.10** or higher
- **pip** and **virtualenv**

### Virtual Environment & Dependencies
```bash
# Navigate to microservice directory
cd educate/logs

# Create and activate virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install all machine learning, NLP, and OCR dependencies
pip install -r requirements.txt
```

### Environment Configuration
```bash
cp .env.example .env
# Edit .env and supply:
# GEMINI_API_KEY=your_gemini_api_key
# OPENROUTER_API_KEY=your_openrouter_api_key
```

### Running the Server
```bash
python app.py
```
The FastAPI microservice starts on `http://localhost:5000` with interactive OpenAPI documentation available at `http://localhost:5000/docs`.
