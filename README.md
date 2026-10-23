# Acadion — Hierarchical Academic Intelligence & Explainable AI (XAI) Assessment Ecosystem

> **An enterprise full-stack institutional analytics and examination platform integrating multi-tier VTU syllabus tracking, multimodal question paper parsing, and SHAP-driven Explainable AI risk modeling.**

[![Spring Boot 3](https://img.shields.io/badge/Backend-Spring%20Boot%203.4.1-brightgreen.svg?logo=springboot)](https://spring.io/projects/spring-boot)
[![React 18 & Vite](https://img.shields.io/badge/Frontend-React%2018%20%7C%20Vite-61DAFB.svg?logo=react)](https://react.dev/)
[![Python 3.10+](https://img.shields.io/badge/ML%20Microservice-FastAPI%20%7C%20Python%203.10+-3776AB.svg?logo=python)](https://fastapi.tiangolo.com/)
[![XAI SHAP](https://img.shields.io/badge/Explainable%20AI-SHAP%20TreeExplainer-FF6F00.svg)](https://shap.readthedocs.io/)
[![MongoDB Atlas](https://img.shields.io/badge/Database-MongoDB%20Atlas-47A248.svg?logo=mongodb)](https://www.mongodb.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 🌟 Key Architectural Innovations & Objectives

### 1. Multi-Classroom Isolation & Role-Based Workspaces
* **Zero Cross-Classroom Leakage:** Strict tenant-style boundary scoping faculty and student operations by course, section, and academic batch.
* **Cryptographic Join-Codes:** Rotatable, hash-verified joining tokens (`joinCodeHash`) preventing unauthorized enrollment and course collision.
* **Institutional Roster Ingestion:** Robust Excel/CSV engine supporting complex registrar formats, multi-header skips, and automated idempotent student provisioning.
* **Dynamic Syllabus & Evaluation Tracking:** Custom grading schemes per classroom (VTU Integrated IPCC, PCC, Lab split-ups) published in real-time.

### 2. Feature 1 — Multimodal Examination Extractor & Blueprint Studio
* **Vision-Language Paper Parser:** Universal question paper ingestion converting scans/PDFs of VTU descriptive tests (Part A/B choices Q1–Q4) and objective MCQs into structured JSON blueprints.
* **Semantic Curriculum Mapping:** Automatically binds each sub-question ($Q1a, Q1b, \dots$) to specific syllabus modules, Bloom's taxonomy levels (L1–L4), course outcomes (CO1–CO5), and maximum marks.
* **Blueprint Studio Verification:** Interactive teacher studio for split-up review, manual adjustments, and 1-click blueprint publishing.

### 3. Feature 2 — Unified Split-Up Excel Ingestion Engine
* **Dynamic Spreadsheet Generation:** Generates bespoke Excel mark-entry templates derived on-the-fly from active examination blueprints.
* **Matrix Validation & Parsing:** Reads cell-by-cell marks with rigorous validation against maximum question weights, handling optional questions, absences, and non-linear grading matrices.
* **Automated Aggregate Computation:** Dispatches question scores directly into student performance ledgers without manual tallying.

### 4. Feature 3 — 4-Level Diagnostic Rollup Hierarchy
Acadion eliminates monolithic letter grades with an atomic, four-tier diagnostic breakdown:
* **Level 1 — Atomic Concept & Topic Mastery:** Micro-level mastery scoring for individual curriculum concepts with automated alerts for topics falling below the $50\%$ risk threshold.
* **Level 2 — Module 1–5 Syllabus Coverage & Drop-Offs:** Macro-level unit progression tracking highlighting specific module attrition and cognitive gaps across the semester.
* **Level 3 — Subject Scaled CIE Tracker:** Tailored evaluation matrix modeling university requirements (e.g., VTU IPCC 40M CIE $\rightarrow$ 15M scale, Lab 25M, SEE 50M passing targets) with real-time pass/fail margins.
* **Level 4 — Multi-Course Semester Academic Standing:** Cross-subject institutional portfolio visualizing credit-weighted GPA velocity and systemic academic standing.

### 5. Feature 4 — Scikit-Learn Predictive Classifier & SHAP Explainable AI (XAI)
* **Dual-Ensemble Risk Modeling:** Calibrated Random Forest and Gradient Boosting classifiers trained on institutional academic vectors (CIE scores, test velocity, assignment completion, attendance metrics).
* **Game-Theoretic Feature Attribution (SHAP):** Deploys `shap.TreeExplainer` to compute exact Shapley values for each individual student prediction.
* **Actionable Faculty & Student Insights:** Translates complex mathematical attributions into human-readable positive/negative force meters (e.g., *"-14.2% Risk penalty due to sub-75% attendance in Module 2"*).

### 6. Feature 5 — Grounded Course RAG AI Study Tutor
* **Zero-Hallucination Retrieval Augmented Generation:** Pre-indexes official VTU course lecture notes, textbooks, and syllabus PDFs using local dense embeddings (`sentence-transformers/all-MiniLM-L6-v2`).
* **Provable Citation Cards:** Every generated remedy, breakdown, or study plan cites exact source documents, chapters, and page chunks.
* **Weak-Spot Driven Prompting:** Synchronized with Level 1 diagnostics; students click any red-flagged concept to launch an instant remedial tutoring session tailored to their performance gap.

### 7. Objective 2 — AI Lecture Presentation Studio
* **Automated Slide Deck Synthesis:** Generates complete, beautifully styled syllabus-aligned HTML/Reveal.js slide presentations directly from course module blueprints.
* **Pedagogical Structuring:** Builds concept overviews, code snippets, architectural diagrams, and discussion checkpoints for faculty lectures.

---

## 🛠️ Technology Stack

| Layer | Technologies | Key Libraries & Capabilities |
| :--- | :--- | :--- |
| **Frontend** | React 18, Vite 8, Vanilla CSS & Modern Tokens | React Router 7, Lucide Icons, Headless UI, Chart.js, Recharts, Canvas-Confetti |
| **Backend** | Java 17+, Spring Boot 3.4.1 | Spring Security 6, JJWT (HMAC-SHA256), Spring Data MongoDB, Apache POI 5.2 |
| **Database** | MongoDB Atlas Cloud | Multi-collection document isolation, indexing, aggregation pipelines |
| **ML & XAI Engine** | Python 3.10+, FastAPI, Uvicorn | Scikit-Learn, SHAP, NumPy, Pandas, Joblib |
| **Vector Search & LLM**| Sentence-Transformers, Google Gemini 2.5/Flash | PyPDF, PyMuPDF, Dense Cosine Similarity Retrieval, OpenRouter Vision API |
| **Tooling & Build** | Maven 3.9+, Node.js 18+, Python venv | Role-based JWT filters, Multi-part file streaming, Sandbox-safe builds |

---

## 📂 Project Structure

```
educate-acadion/
├── README.md                                   # Root Ecosystem & Architecture Overview
├── .gitignore                                  # Comprehensive sanitized ignore rules
│
├── educate/
│   ├── backend/                                # Spring Boot 3 Java Microservice
│   │   ├── pom.xml                             # Maven Dependencies (Spring Data Mongo, Apache POI, JJWT)
│   │   └── src/
│   │       ├── main/
│   │       │   ├── java/com/acadion/backend/
│   │       │   │   ├── controller/             # REST Endpoints (Auth, Classroom, Intelligence, Admin)
│   │       │   │   ├── service/                # Core Business Logic & Hierarchical Analytics Rollup
│   │       │   │   ├── repository/             # Spring Data MongoDB Repositories
│   │       │   │   ├── entity/                 # Document Entities (Classroom, Marks, Blueprints, Users)
│   │       │   │   ├── dto/                    # Structured Data Transfer Objects
│   │       │   │   └── security/               # JWT Authentication Filter & Spring Security Chain
│   │       │   └── resources/
│   │       │       ├── application.properties  # Parameterized Environment Configuration
│   │       │       └── application-local.properties.example
│   │       └── test/                           # Unit & Service Mockito Test Suites
│   │
│   ├── frontend/                               # React 18 + Vite Production Web Application
│   │   ├── package.json                        # Dependencies (Lucide, Axios, Chart.js)
│   │   ├── vite.config.js                      # Vite Asset Pipeline & Media Stream Aliases
│   │   └── src/
│   │       ├── pages/                          # Student, Teacher, and Governance Workspaces
│   │       ├── components/                     # 4-Level Rollup Cards, SHAP Bar Graphs, RAG Modal
│   │       ├── services/                       # Authenticated Axios Gateway & Error Interceptors
│   │       └── routes/                         # Protected Role-Based Route Definitions
│   │
│   └── logs/                                   # Python Machine Learning & RAG Microservice
│       ├── app.py                              # FastAPI Gateway Server (Port 5000)
│       ├── ml_risk_xai.py                      # Scikit-Learn Risk Classifier & SHAP TreeExplainer
│       ├── rag_tutor.py                        # Vector Retrieval Engine (all-MiniLM-L6-v2 + Gemini)
│       ├── ai_extractor.py                     # Multimodal Vision Question Paper Blueprint Parser
│       ├── academic_risk_model.joblib          # Calibrated Academic Risk Weight Matrix
│       ├── requirements.txt                    # Python Dependency Specification
│       └── .env.example                        # AI API Keys Template
│
└── media-assets/                               # Decoupled Institutional Media & Background Videos
    ├── videos/                                 # High-definition visual assets
    ├── images/                                 # Topic and department UI assets
    └── ASSET_MANIFEST.md                       # Media Asset Audit & Provenance Manifest
```

---

## 🚀 Getting Started & Local Setup

### 1. Prerequisites
* **Java Development Kit (JDK):** Version 17 or higher
* **Node.js:** Version 18.x or 20.x LTS with npm
* **Python:** Version 3.10 or higher with pip
* **Database:** MongoDB Atlas cluster or local MongoDB instance

---

### 2. Backend Setup (`educate/backend`)
```bash
cd educate/backend

# Copy the local environment configuration template
cp src/main/resources/application-local.properties.example src/main/resources/application-local.properties

# Set your database URI and JWT secret in application-local.properties, then run:
./mvnw clean test-compile
./mvnw spring-boot:run
```
* The backend API server initializes at `http://localhost:8080`.

---

### 3. Frontend Setup (`educate/frontend`)
```bash
cd educate/frontend

# Copy the frontend environment template
cp .env.example .env

# Install dependencies and launch the Vite development server
npm install
npm run dev
```
* Access the interactive UI at `http://localhost:5173`.
* For production bundles: `npm run build` (outputs optimized assets to `dist/`).

---

### 4. Python ML & RAG Microservice Setup (`educate/logs`)
```bash
cd educate/logs

# Create and activate Python virtual environment
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install required machine learning and vector search dependencies
pip install -r requirements.txt

# Configure your AI keys in .env
cp .env.example .env
# Edit .env and supply GEMINI_API_KEY and OPENROUTER_API_KEY

# Start the microservice
python app.py
```
* The FastAPI ML microservice initializes at `http://localhost:5000`.

---

## 📊 System Workflow & Evaluation Pipeline

```
  ┌─────────────────────────────────────────────────────────────┐
  │         Multimodal Question Paper Scan / PDF Upload         │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ Feature 1: Vision-Language Model Blueprint Extraction        │
  │ • Identifies Q1-Q4 Part A/B Choice Structure                │
  │ • Maps Sub-questions to Bloom's Levels & Syllabus Modules   │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ Feature 2: Split-Up Ingestion & Matrix Marks Parsing        │
  │ • Dynamic Excel Template Generation                         │
  │ • Sub-question mark validation & student ledger updates     │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ Feature 3: 4-Level Diagnostic Rollup Hierarchy              │
  │ [Level 1] Concept Mastery (<50% Risk Flags)                 │
  │ [Level 2] Module 1-5 Coverage & Cognitive Drop-offs         │
  │ [Level 3] Subject Scaled CIE (VTU 40M → 15M + Lab 25M)      │
  │ [Level 4] Semester Standing & Credit Velocity               │
  └──────────────┬──────────────────────────────┬───────────────┘
                 │                              │
                 ▼                              ▼
  ┌──────────────────────────────┐ ┌────────────────────────────┐
  │ Feature 4: Explainable AI    │ │ Feature 5: Grounded RAG    │
  │ • Dual-Ensemble Risk Model   │ │ • all-MiniLM-L6-v2 Index   │
  │ • SHAP TreeExplainer Impact  │ │ • Verified Lecture Chunks  │
  │ • Individual Attributions    │ │ • Zero-Hallucination Tutor │
  └──────────────────────────────┘ └────────────────────────────┘
```

1. **Multimodal Extraction:** Faculty uploads an examination paper. The multimodal parser extracts question hierarchies, internal choices (e.g. *Answer Question 1 OR Question 2*), module associations, and maximum marks.
2. **Dynamic Entry & Ingestion:** The engine dynamically formats an Excel entry template mapped to extracted sub-questions. Faculty uploads completed student scores, which are checked against maximum allowable limits.
3. **Four-Tier Rollup:** Student scores are computed through the 4-Level diagnostic pipeline, mapping raw question marks to micro-concepts, module retention, scaled CIE standing, and semester GPA.
4. **SHAP TreeExplainer Attribution:** Academic vectors are scored by the predictive risk classifier. SHAP calculates exact Shapley values to pinpoint whether drop-offs are driven by specific module weaknesses, assignment defaults, or attendance drops.
5. **Grounded RAG Remediation:** For identified weak spots, the student accesses the integrated RAG tutor, which queries verified course lecture notes and delivers zero-hallucination remedial guidance with clickable citation cards.

---

## 🔒 Security, Compliance & Repo Hygiene
* **Zero Hardcoded Secrets:** All credentials (MongoDB URI, JWT secret, Brevo SMTP tokens, Gemini API keys) are injected exclusively through external environment variables.
* **Sanitized Version Control:** Pre-configured `.gitignore` prevents leaks of `.env` files, build directories (`dist/`, `target/`), dependency caches (`node_modules/`, `venv/`), and temporary OCR files.
* **Role-Based Access Control (RBAC):** Every endpoint enforces strict role validation (`STUDENT`, `TEACHER`, `ADMIN`) with stateless JWT authentication.

---

## 👥 Contributors & Acknowledgements
* Developed as an advanced institutional academic intelligence and diagnostic platform.
* Designed in alignment with **Visvesvaraya Technological University (VTU)** curriculum frameworks and outcome-based education (OBE) guidelines.
