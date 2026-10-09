# ACADION: Comprehensive Forensic Implementation Audit & Architectural Assessment

**Project:** Acadion – AI-Powered Smart Academic Management and Performance Analytics Platform for Modern Education Systems  
**Audit Type:** Full-Stack Forensic Codebase Audit, Architecture Reconstruction & Roadmap  
**Auditor Roles:** Lead Software Architect, Senior Full-Stack Developer, AI/ML Engineer, QA Engineer, DevOps Engineer  
**Date of Audit:** September 1, 2026  
**Repository Path:** `c:\Users\Santhoshkumar\educate-acadion`

---

## 1. Executive Summary

A comprehensive, forensic, code-level audit was conducted across every layer of the Acadion repository (`educate-acadion`), spanning backend services (`educate/backend`), frontend client (`educate/frontend`), microservices (`educate/logs`), database schemas, security configurations, and tests.

### Key Audit Findings:
1. **Core Working Architecture**: The repository contains a functional 3-tier web application consisting of a **React 19 + Vite 8** frontend, a **Spring Boot 3.5.14 (Java 21)** backend, and **MongoDB** persistence. A supplementary **Python FastAPI microservice** located in `educate/logs` handles document text extraction and LLM parsing via OpenRouter and Tesseract OCR.
2. **AI/ML Reality vs. Documentation Claims**:
   - **PyTorch/ML Claim is NOT Substantiated by the Repository**: There are zero PyTorch neural networks, zero scikit-learn models, zero training pipelines, and zero `.pkl` / `.pt` / `.onnx` model weights. The risk score prediction in `PredictionService.java` is a static 4-variable weighted linear formula (`45% topic + 30% previous average + 15% attendance + 10% study hours`).
   - **AI Question Paper Decomposition**: Works via OpenRouter (`openrouter/free`) and Gemini 1.5 Flash API with local regex-based heuristic parsing fallbacks.
   - **AI Quiz/Assignment Generation from Syllabus**: NOT implemented. The platform only parses uploaded examination papers or allows manual paper creation.
   - **AI PowerPoint (.pptx) Generation**: Completely ABSENT. There is no `python-pptx` dependency, no slide template engine, and no presentation generation code.
   - **Academic Planning & Syllabus Scheduling Automation**: Completely ABSENT (0% implementation). There is no syllabus module parser, teaching hours calculator, timetable conflict engine, or dynamic rescheduling logic.
3. **Authentication & Security**:
   - Registration with 6-digit OTP email delivery (via Brevo SMTP) and Admin Approval Gate works.
   - **Critical Security Flaw**: `SecurityConfig.java` has configured `.permitAll()` on ALL `/api/**` endpoints (including `/api/admin/**`, `/api/papers/**`, `/api/responses/**`). Role enforcement is completely absent at the Spring Security filter layer.
   - **Critical Secret Exposure**: Live Brevo SMTP credentials, MongoDB Atlas connection strings with plaintext credentials, and OpenRouter API keys are hardcoded in source control files (`application.properties`, `AiModelParserService.java`, `ai_extractor.py`).
4. **Local Deployability**:
   - The application can run locally with Java 21, Node.js 18+, Python 3.10+, and MongoDB (Atlas or local), provided Python missing dependencies (`PyMuPDF`, `pytesseract`, `pillow`) are installed.

---

## 2. Actual Architecture Map

```
                                  +---------------------------------------------------+
                                  |                 USER BROWSER                      |
                                  |    (Student / Teacher / Administrator Roles)      |
                                  +-------------------------+-------------------------+
                                                            |
                                                   HTTP / React Router
                                                            |
                                  +-------------------------v-------------------------+
                                  |             REACT 19 FRONTEND (Vite 8)            |
                                  |  - AuthContext (JWT & Role State)                 |
                                  |  - Role-based Protected Routes                     |
                                  |  - Services (Axios Interceptors with Bearer JWT)  |
                                  |  - Teacher, Student, Admin Dashboard Pages        |
                                  +------------+------------------------+-------------+
                                               |                        |
                         Direct File Upload    |                        | REST APIs (Port 8080)
                         (Port 5000)           |                        |
                                               |                        v
                                               |          +-----------------------------+
                                               |          |   SPRING BOOT 3.5.14 (Java 21)|
                                               |          | - Spring Security & JwtFilter|
                                               |          | - Controllers (8 Endpoints) |
                                               |          | - Services & Business Logic |
                                               |          +----+---------+------------+-+
                                               |               |         |            |
                                               |               |         |            |
                      +------------------------v---------+     |         |            |
                      |   PYTHON FASTAPI MICROSERVICE    |     |         |            |
                      |          (educate/logs)          |<----+         |            |
                      |  - Port 5000                     | HTTP REST     |            |
                      |  - PyMuPDF / pytesseract OCR     | (Fallback)    |            |
                      |  - OpenRouter API (openai SDK)   |               |            |
                      +----------------------------------+               |            |
                                                                         |            |
                       +-------------------------------------------------+            |
                       |                                                              |
                       v                                                              v
      +---------------------------------+                            +---------------------------------+
      |        MONGODB DATABASE         |                            |       EXTERNAL SERVICES         |
      | - `users` Collection            |                            | - Brevo SMTP (Port 587)         |
      | - `question_papers` Collection  |                            | - OpenRouter Cloud LLM API      |
      | - `student_responses` Collection|                            | - Google Gemini 1.5 Flash API   |
      +---------------------------------+                            +---------------------------------+
```

### Actual Data Flow:
1. **Authentication Flow**: User registers in React `Register.jsx` → `AuthController.java` generates 6-digit OTP → `EmailSenderService.java` sends email via Brevo SMTP → User enters OTP in `VerifyOtp.jsx` → Account is verified (`verified=true`, `approved=false`) → Admin approves account in `PendingUsers.jsx` (`approved=true`) → User logs in via `Login.jsx` → Receives HS256 JWT Token stored in `localStorage`.
2. **Question Paper Ingestion Flow**: Teacher uploads PDF/DOCX/Image in `UploadPaper.jsx` → Sent to Python microservice `http://127.0.0.1:5000/api/ai/upload-paper` (or Spring Boot `/api/papers/upload`) → Text extracted via Apache PDFBox / Apache POI / PyMuPDF / Tesseract OCR → Questions & metadata structured via OpenRouter LLM or `AiQuestionParserService.java` → Saved as `QuestionPaper` document in MongoDB.
3. **Student Examination & Grading Flow**: Student selects exam in `AvailableExams.jsx` → Answers questions in `AttendExam.jsx` → Submits responses to `/api/responses` → MCQs auto-graded via `isMcqAnswerCorrect`; descriptive questions given word-count heuristic marks or marked pending → Teacher grades descriptive answers in `EvaluateResponses.jsx` or records offline test marks in `ManualMarksEntry.jsx` → Graded scorecard emailed to student via Brevo SMTP.
4. **Analytics Flow**: Teacher queries `/api/analytics/paper/{id}` → `AnalyticsService.java` computes question-wise and topic-wise average percentage and classification (WEAK <50%, MODERATE 50-70%, STRONG >70%) → Student queries `/api/analytics/student/{usn}` to view aggregate scores and risk classification.

---

## 3. Repository Structure

```
educate-acadion/
├── educate/
│   ├── .github/
│   ├── .gitignore
│   ├── backend/                           # Spring Boot 3.5.14 Java 21 Application
│   │   ├── pom.xml                        # Maven dependencies
│   │   ├── tessdata/                      # Tesseract OCR Language Data (eng.traineddata)
│   │   └── src/
│   │       ├── main/java/com/acadion/backend/
│   │       │   ├── BackendApplication.java
│   │       │   ├── config/                # CorsConfig, DataInitializer
│   │       │   ├── controller/            # 8 REST Controllers
│   │       │   ├── dto/                   # 14 DTO definitions
│   │       │   ├── entity/                # 4 MongoDB Entities (User, QuestionPaper, StudentResponse, Role)
│   │       │   ├── mail/                  # EmailSenderService (Brevo SMTP)
│   │       │   ├── repository/            # 3 MongoRepositories
│   │       │   ├── security/              # SecurityConfig, JwtFilter, JwtUtil
│   │       │   ├── service/               # Core business services & PredictionService
│   │       │   │   └── parser/            # TextExtraction, OCR, AiModelParser, GeminiParser
│   │       │   └── util/                  # OtpUtil
│   │       ├── main/resources/
│   │       │   ├── application.properties # App configuration & credentials
│   │       │   └── tessdata/eng.traineddata
│   │       └── test/java/com/acadion/backend/
│   │           ├── BackendApplicationTests.java
│   │           └── service/parser/AiQuestionParserServiceTest.java
│   ├── frontend/                          # React 19 + Vite 8 SPA Client
│   │   ├── package.json                   # Dependencies (React 19, Vite 8, TailwindCSS 4, jsPDF)
│   │   ├── vite.config.js
│   │   ├── public/videos/                 # Background cinematic video assets
│   │   └── src/
│   │       ├── api/axiosConfig.js         # Axios client with JWT interceptor
│   │       ├── components/                # Navbar, ProtectedRoute, Modals, Intros
│   │       ├── context/AuthContext.jsx    # Authentication & Role Context
│   │       ├── pages/
│   │       │   ├── admin/                 # AdminDashboard, ManageUsers, PendingUsers
│   │       │   ├── auth/                  # Login, Register, VerifyOtp
│   │       │   ├── student/               # StudentDashboard, AvailableExams, AttendExam, MyResults, StudentPerformance, PracticePapers, StudentProfile
│   │       │   └── teacher/               # TeacherDashboard, UploadPaper, CreateQuestionPaper, EditPaper, ManagePapers, EvaluateResponses, ManualMarksEntry, UploadedPaperAnalysis, PracticePaperPermission, TeacherAnalytics, TeacherProfile
│   │       ├── routes/AppRoutes.jsx       # 24 client routes
│   │       ├── services/                  # 9 Axios API service modules
│   │       └── utils/                     # pdfGenerator, roleUtils, tokenUtils
│   └── logs/                              # Misnamed directory housing Python AI Microservice
│       ├── app.py                         # FastAPI Server on port 5000
│       ├── ai_extractor.py                # OpenRouter API integration & heuristic question parser
│       ├── pdf_reader.py                  # PyMuPDF & pytesseract document extractor
│       ├── requirements.txt               # Incomplete python requirements
│       └── test_*.py                      # Unit test scripts for parsing
```

---

## 4. Technology Verification Matrix

| Technology | Claimed / Documented | Actually Used in Code | Version in Code | Exact Source Location |
| :--- | :--- | :--- | :--- | :--- |
| **Java** | Java 17 / 21 | Yes | 21 | `educate/backend/pom.xml` (`<java.version>21</java.version>`) |
| **Spring Boot** | Spring Boot 3.x | Yes | 3.5.14 | `educate/backend/pom.xml` |
| **React** | React 18 / 19 | Yes | 19.2.5 | `educate/frontend/package.json` |
| **Vite** | Vite Bundler | Yes | 8.0.10 | `educate/frontend/package.json` |
| **TailwindCSS** | TailwindCSS | Yes | 4.2.4 | `educate/frontend/package.json` |
| **Database** | MongoDB Atlas / Local | Yes | Driver 5.5.2 | `application.properties` |
| **JWT** | JJWT | Yes | 0.11.5 | `educate/backend/pom.xml` |
| **PDF Extraction (Java)** | Apache PDFBox | Yes | 3.0.5 | `educate/backend/pom.xml`, `TextExtractionService.java` |
| **Word Extraction (Java)** | Apache POI | Yes | 5.4.1 | `educate/backend/pom.xml`, `TextExtractionService.java` |
| **OCR (Java)** | Tess4J / Tesseract | Yes | 5.11.0 | `educate/backend/pom.xml`, `OcrService.java` |
| **Python Microservice** | FastAPI / Uvicorn | Yes | 0.110.0 | `educate/logs/app.py` |
| **PDF Extraction (Python)**| PyMuPDF (fitz) | Yes | fitz import | `educate/logs/pdf_reader.py` |
| **OCR (Python)** | pytesseract | Yes | pytesseract import | `educate/logs/pdf_reader.py` |
| **Cloud LLM (OpenRouter)**| OpenRouter API | Yes | openai SDK | `educate/logs/ai_extractor.py`, `AiModelParserService.java` |
| **Cloud LLM (Gemini)** | Gemini 1.5 Flash | Yes | REST v1beta | `GeminiParserService.java` |
| **PyTorch** | PyTorch Deep Learning | **NO** | None | **Zero occurrences in code** |
| **Scikit-Learn** | ML Regression Models | **NO** | None | **Zero occurrences in code** |
| **PowerPoint (.pptx)** | python-pptx | **NO** | None | **Zero occurrences in code** |
| **Syllabus Scheduling Engine**| Automated Scheduler | **NO** | None | **Zero occurrences in code** |

---

## 5. Objective 1 Audit: Student Performance Analytics

### Forensic Breakdown

```
OBJECTIVE:
Student Performance Analytics & Risk Prediction

DOCUMENTED REQUIREMENT:
The system must parse Excel marksheets, calculate question-wise and topic-wise metrics, identify weak topics and failing students, track longitudinal historical performance trends, and deploy trained machine learning models (PyTorch/scikit-learn) to predict student performance scores and classify risk levels (ON_TRACK, NEEDS_ATTENTION, HIGH_RISK).

ACTUAL IMPLEMENTATION:
1. Marksheet & Assessment Ingestion:
   - Question-wise and topic-wise scores are calculated when students submit online tests or when teachers enter offline marks manually via `ManualMarksEntry.jsx`.
   - Excel export of class evaluations is fully implemented using Apache POI (`StudentResponseService.generateExcelReport`), but direct Excel marksheet *upload* into the analytics database is not implemented (only single-student manual entry or online exam submissions exist).
2. Analytics & Aggregation:
   - `AnalyticsService.java` calculates class averages, question-wise averages, and topic-wise performance breakdowns. Topics with average < 50% are flagged as "WEAK", 50–70% as "MODERATE", >70% as "STRONG".
   - `AnalyticsService.studentTrend` tracks chronological percentages across submissions and labels trends as "IMPROVING", "DECLINING", or "STABLE" based on a ±5% delta between first and last exam.
3. Machine Learning Prediction:
   - The prediction system in `PredictionService.java` is purely HEURISTIC.
   - Formula used in `PredictionService.java` (lines 49-62):
     predictedScore = (topicAverage * 0.45) + (previousAverage * 0.30) + (attendance * 0.15) + (Math.min(studyHours, 10.0) * 10.0 * 0.10)
   - Risk classification rules:
     - score < 40.0: "HIGH_RISK"
     - score < 60.0: "NEEDS_ATTENTION"
     - score >= 60.0: "ON_TRACK"
   - In `predictFromResponses` (used when student submits an exam), it simply sets predictedScore = current exam score percentage!

IMPLEMENTATION STATUS:
PARTIAL (Analytics & reporting implemented; Machine Learning is MOCKED / HEURISTIC)

EVIDENCE:
- Backend:
  - `AnalyticsController.java` (`/api/analytics/paper/{paperId}`, `/api/analytics/student/{studentId}`)
  - `AnalyticsService.java`
  - `PredictionController.java` (`/api/predictions/score`)
  - `PredictionService.java` (lines 81-87 explicitly states: `model: "RuleBased-Regressor-ReadyForMLService"`, `message: "Replace this service with FastAPI/scikit-learn when a trained .pkl model is available."`)
  - `StudentResponseService.java` (Excel report generation via Apache POI)
- Frontend:
  - `TeacherAnalytics.jsx` & `TeacherAnalytics.css`
  - `StudentPerformance.jsx` & `StudentPerformance.css`
  - `ManualMarksEntry.jsx` (offline test scoring ledger)

USER FLOW:
1. Teacher navigates to `/teacher/analytics` and enters a Paper ID.
2. System displays class average percentage, response count, topic performance breakdown (with WEAK / MODERATE / STRONG badges), and question difficulty analysis.
3. Student navigates to `/student/performance` and views overall aggregate score, trend direction (IMPROVING/DECLINING/STABLE), historical exam cards, and risk level badges.

BACKEND FLOW:
1. `AnalyticsController` receives GET request → delegates to `AnalyticsService.paperAnalytics(paperId)`.
2. Fetches `QuestionPaper` and all `StudentResponse` records from MongoDB.
3. Groups responses question-wise and topic-wise, calculates percentages, and generates status classifications.

DATABASE FLOW:
- Reads from `question_papers` and `student_responses` collections in MongoDB database `acadiondb`.
- Updates `predictedScore` and `riskLevel` fields in `StudentResponse` document upon submission.

AI/ML FLOW:
- **Zero AI/ML execution**. Deterministic linear formula computation inside Spring Boot JVM.

FRONTEND FLOW:
- `TeacherAnalytics.jsx` renders summary cards and topic list with colored status pills.
- `StudentPerformance.jsx` displays breakdown by assessment mode (Theory, MCQ, Offline) and historical score cards.

PROBLEMS IDENTIFIED:
1. PyTorch / ML claim in project documentation is completely ungrounded.
2. Direct bulk Excel marksheet upload by teachers is missing (teachers must input scores per student in `ManualMarksEntry.jsx`).
3. `StudentPerformance.jsx` has an unhandled null check bug on line 150: `{analytics.trend?.map(...)}` will throw a runtime TypeError if `analytics` is null.

REQUIRED WORK:
1. Replace or supplement heuristic regressor with a real trained scikit-learn / PyTorch regression model served via the Python FastAPI microservice.
2. Add bulk Excel marksheet upload endpoint (`.xlsx` parser) using Apache POI in backend and a file dropzone in frontend.
3. Fix the frontend null-pointer bug in `StudentPerformance.jsx`.

ACCEPTANCE TEST:
Upload a multi-student CSV/Excel marksheet, run regression prediction on test data, and verify that topic weaknesses, risk tiers (HIGH_RISK, NEEDS_ATTENTION, ON_TRACK), and student performance trends update dynamically across both teacher and student dashboards.
```

---

## 6. Objective 2 Audit: AI-Based Content Generation

### Forensic Breakdown

```
OBJECTIVE:
AI-Based Content Generation & Document Ingestion

DOCUMENTED REQUIREMENT:
The system must ingest academic documents (PDF, DOCX, DOC, scanned images), perform OCR/text extraction, and use LLMs (Groq, Gemini, OpenRouter) to automatically generate MCQs, descriptive questions, assignments, topic-specific question banks, answer keys, explanations, and PowerPoint (.pptx) lecture presentations.

ACTUAL IMPLEMENTATION:
1. Document Ingestion & Text Extraction:
   - Java Layer: Apache PDFBox 3.0.5 (`PDDocument`, `PDFTextStripper`), Apache POI 5.4.1 (`XWPFDocument`, `HWPFDocument`), Tess4J 5.11.0 (`Tesseract.doOCR`).
   - Python Layer: PyMuPDF (`fitz`), `pytesseract` (Tesseract 300/150 DPI).
2. Question Paper Decomposition:
   - Successfully extracts questions, subquestions (e.g. Q1(a), Q1(b)), module sections, marks (from table M/L/C columns or bracketed text), and OR-choice pairings from uploaded question papers.
   - LLM Engines: OpenRouter API (model `openrouter/free`) in `ai_extractor.py` and `AiModelParserService.java`; Gemini 1.5 Flash in `GeminiParserService.java`.
   - Fallback Engine: High-performance 1000-line regex rule-based state machine in `AiQuestionParserService.java`.
3. AI Generation from Prompt / Syllabus:
   - Generation of new MCQs / quizzes / assignments from a topic prompt or syllabus module is NOT IMPLEMENTED. The UI only allows manual question paper authoring in `CreateQuestionPaper.jsx` or parsing pre-existing uploaded papers in `UploadPaper.jsx`.
4. PowerPoint (.pptx) Generation:
   - NOT IMPLEMENTED (0% in code). There is no presentation generator or download workflow.

IMPLEMENTATION STATUS:
PARTIAL (Document Parsing & OCR are COMPLETE; AI Question Generation from Prompt is NOT IMPLEMENTED; PPT Generation is NOT IMPLEMENTED)

EVIDENCE:
- Backend:
  - `TextExtractionService.java`, `OcrService.java`
  - `AiModelParserService.java`, `GeminiParserService.java`
  - `AiQuestionParserService.java` (1079 lines of robust document understanding logic)
  - `QuestionPaperController.java` (`/api/papers/upload`, `/api/papers/create`, `/api/papers/{paperId}`)
- Python Microservice:
  - `educate/logs/app.py` (`/api/ai/upload-paper`, `/api/ai/parse-text`)
  - `educate/logs/ai_extractor.py`
  - `educate/logs/pdf_reader.py`
- Frontend:
  - `UploadPaper.jsx`, `CreateQuestionPaper.jsx`, `ManagePapers.jsx`, `UploadedPaperAnalysis.jsx`

USER FLOW:
1. Teacher navigates to `/teacher/upload-paper` and uploads a semester examination PDF or scanned image.
2. Microservice/Backend extracts text layer or renders pages for OCR.
3. LLM/Parser structures the questions and auto-assigns marks and modules.
4. Teacher reviews, edits, and publishes the paper in `UploadedPaperAnalysis.jsx` or `ManagePapers.jsx`.

PROBLEMS IDENTIFIED:
1. AI generation of quizzes/assignments *from scratch* (by topic/syllabus input) is missing.
2. PowerPoint presentation generation is completely absent despite documentation claims.
3. Python `requirements.txt` is missing `PyMuPDF`, `pytesseract`, `pillow`, preventing clean out-of-the-box microservice startup.

REQUIRED WORK:
1. Build an AI Quiz / Assignment Generator endpoint (`/api/ai/generate-quiz`) that prompts the LLM with a topic, difficulty, question count, and Bloom's taxonomy level to produce ready-to-use quizzes.
2. Build a PowerPoint Generator service using `python-pptx` to generate structured `.pptx` lecture decks from syllabus modules.
3. Update `requirements.txt` with all required Python packages.

ACCEPTANCE TEST:
1. Upload a scanned multi-page VTU examination paper and verify accurate question, subquestion, and marks extraction.
2. Input a topic (e.g., "Convolutional Neural Networks") with difficulty "Medium" and generate a 10-question MCQ quiz with answer keys and explanations.
3. Input a topic and download a valid 6-slide PowerPoint `.pptx` presentation.
```

---

## 7. Objective 3 Audit: Academic Planning & Syllabus Automation

### Forensic Breakdown

```
OBJECTIVE:
Academic Planning and Syllabus Automation

DOCUMENTED REQUIREMENT:
The system must accept syllabus documents, extract modules and subtopics, determine required teaching hours, ingest academic calendars and timetables, generate an automated lecture plan and topic schedule, track syllabus completion progress against calendar dates, identify delayed topics, and dynamically reschedule pending lectures based on real-time teacher feedback.

ACTUAL IMPLEMENTATION:
- Syllabus Upload / Module Extraction: NOT IMPLEMENTED.
- Teaching Hours Calculation: NOT IMPLEMENTED.
- Timetable & Academic Calendar Scheduling Engine: NOT IMPLEMENTED.
- Dynamic Rescheduling / Topic Delay Tracking: NOT IMPLEMENTED.
- Teacher Planner UI: NOT IMPLEMENTED.

IMPLEMENTATION STATUS:
NOT IMPLEMENTED (0% code evidence across backend, frontend, Python, and database)

EVIDENCE:
- Grep search for `syllabus`, `planner`, `timetable`, `calendar`, `reschedule`, `lecture` across the entire codebase yielded zero hits in business logic, routes, or entities.

USER FLOW:
- None exists.

BACKEND FLOW:
- None exists.

DATABASE FLOW:
- None exists. (No collections or schema fields for syllabus modules, timetable slots, or planned lectures).

AI/ML FLOW:
- None exists.

FRONTEND FLOW:
- None exists. (No routes or navigation tabs for academic planning).

PROBLEMS IDENTIFIED:
- The entire Objective 3 exists solely as a conceptual requirement in documentation and has not been coded into the repository.

REQUIRED WORK:
1. Database Schema: Create `Syllabus`, `AcademicPlan`, and `LectureSchedule` MongoDB entities.
2. Backend Services:
   - `SyllabusParserService`: Extract modules, subtopics, and allocated teaching hours from uploaded syllabus documents via LLM.
   - `AcademicPlanningService`: Compute timetable slots, map topics to dates, track completed vs. pending topics, and dynamically recalculate dates when lectures are marked delayed.
3. Frontend:
   - Create `AcademicPlanner.jsx` for teachers with interactive Gantt/calendar views, topic completion checkboxes, delay alerts, and automatic rescheduling triggers.

ACCEPTANCE TEST:
Upload an engineering course syllabus PDF (e.g., "Database Management Systems - 45 Hours"), input semester start/end dates and weekly class slots, verify that a day-by-day lecture plan is generated, mark a lecture as "Delayed", and confirm that subsequent lectures are automatically rescheduled without manual editing.
```

---

## 8. Documentation vs. Code Reality Discrepancy Matrix

| Feature / Claim | Major Project Report Claim | IEEE Paper Claim | Repository Reality | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Machine Learning Engine** | Deep Learning / PyTorch predictive model trained on student academic parameters | PyTorch neural regressor for early academic intervention | Rule-based static weighted linear formula in `PredictionService.java` | **UNSUPPORTED / MOCKED** |
| **AI Question Paper Parsing** | Multimodal OCR and NLP question extraction | Cloud LLM question decomposition | OpenRouter + Gemini 1.5 Flash + Regex heuristic parser in Java & Python | **IMPLEMENTED** |
| **AI Quiz / Assignment Generation** | Generates tailored questions and assignments based on topics | Topic-adaptive question generation using LLMs | Only parses existing uploaded question papers or manual form creation | **MISSING** |
| **PowerPoint (.pptx) Generator** | Automated slide deck generation for lecture modules | Automated curriculum presentation synthesis | No `python-pptx`, no slide generation code in repo | **MISSING** |
| **Syllabus Automation & Planner**| Automated syllabus scheduling, calendar mapping, and dynamic rescheduling | Intelligent academic syllabus planner and tracker | Zero code, zero entities, zero routes in codebase | **NOT IMPLEMENTED** |
| **Document Formats Supported** | PDF, DOCX, DOC, Scanned Images | PDF, Scanned Images | PDF (PDFBox/PyMuPDF), DOCX (POI), DOC (POI), Images (Tesseract) | **IMPLEMENTED** |
| **Student Self & Peer Review** | Not prominently highlighted | Collaborative student review | Fully implemented in `StudentResponseService.java` | **IMPLEMENTED** (Undocumented Bonus) |
| **Decoupled Offline Test Grading**| Not prominently highlighted | Offline grading ledger | Fully implemented in `ManualMarksEntry.jsx` | **IMPLEMENTED** (Undocumented Bonus) |
| **Teacher Subject Allocation Gate**| Not mentioned | Role-based subject restriction | Admin approves teacher with allocated subjects; teachers restricted to their subjects | **IMPLEMENTED** (Undocumented Bonus) |

---

## 9. Complete Feature Matrix

| Domain | Feature | Status | Evidence (Files / Components) |
| :--- | :--- | :--- | :--- |
| **Auth** | User Registration | COMPLETE | `Register.jsx`, `AuthController.java`, `AuthService.java` |
| **Auth** | Email OTP Verification | COMPLETE | `VerifyOtp.jsx`, `OtpService.java`, `EmailSenderService.java` |
| **Auth** | User Login & JWT Generation | COMPLETE | `Login.jsx`, `JwtUtil.java`, `AuthService.java` |
| **Auth** | Role-Based Access Gate | COMPLETE | `ProtectedRoute.jsx`, `AuthContext.jsx` |
| **Admin** | Pending Users Approval / Rejection | COMPLETE | `PendingUsers.jsx`, `AdminController.java`, `AdminService.java` |
| **Admin** | Faculty Subject Allocation | COMPLETE | `PendingUsers.jsx`, `AdminService.approveUserWithSubjects` |
| **Admin** | User Management (Students & Faculty) | COMPLETE | `ManageUsers.jsx`, `AdminController.java` |
| **Admin** | Export User Rosters to Excel | COMPLETE | `AdminService.exportUsersToExcel`, `AdminController.java` |
| **Teacher** | Dashboard & Profile | COMPLETE | `TeacherDashboard.jsx`, `TeacherProfile.jsx`, `ProfileController.java` |
| **Teacher** | Upload & Deconstruct Question Papers | COMPLETE | `UploadPaper.jsx`, `QuestionPaperService.java`, `app.py` |
| **Teacher** | Manual Question Paper Authoring | COMPLETE | `CreateQuestionPaper.jsx`, `QuestionPaperService.createPaper` |
| **Teacher** | Manage & Edit Question Papers | COMPLETE | `ManagePapers.jsx`, `EditPaper.jsx`, `QuestionPaperService.java` |
| **Teacher** | Practice Paper Permission Assignment | COMPLETE | `PracticePaperPermission.jsx`, `QuestionPaperService.togglePracticeStatus`|
| **Teacher** | Evaluate Student Responses | COMPLETE | `EvaluateResponses.jsx`, `StudentResponseService.evaluateResponse` |
| **Teacher** | Send Scorecard Email to Student | COMPLETE | `StudentResponseService.sendEvaluationEmailToStudent` |
| **Teacher** | Export Class Evaluation to Excel (.xlsx)| COMPLETE | `StudentResponseService.generateExcelReport` |
| **Teacher** | Offline Classroom Marks Entry Ledger | COMPLETE | `ManualMarksEntry.jsx`, `StudentResponseService.submit(OFFLINE_MANUAL)`|
| **Teacher** | Paper Analytics & Topic Weaknesses | COMPLETE | `TeacherAnalytics.jsx`, `AnalyticsService.paperAnalytics` |
| **Teacher** | AI Quiz / Assignment Generation | **MISSING** | No prompt-based generation endpoint or UI |
| **Teacher** | PowerPoint (.pptx) Presentation Generator | **MISSING** | No `python-pptx` implementation |
| **Teacher** | Academic Planner & Syllabus Automation | **MISSING** | No scheduling logic or syllabus planner UI |
| **Student** | Dashboard & Profile | COMPLETE | `StudentDashboard.jsx`, `StudentProfile.jsx`, `ProfileController.java` |
| **Student** | Available Examinations Roster | COMPLETE | `AvailableExams.jsx`, `QuestionPaperService.getAllPapers` |
| **Student** | Attend Digital Exam (Theory & MCQ) | COMPLETE | `AttendExam.jsx`, `StudentResponseController.submitResponse` |
| **Student** | MCQ Auto-Grading Engine | COMPLETE | `StudentResponseService.isMcqAnswerCorrect` |
| **Student** | Student Self-Evaluation for Practice | COMPLETE | `PracticePapers.jsx`, `StudentResponseService.selfEvaluateResponse` |
| **Student** | Peer / Friend Review Assignment | COMPLETE | `PracticePapers.jsx`, `StudentResponseService.peerEvaluateResponse` |
| **Student** | Examination Results & Scorecard PDF | COMPLETE | `MyResults.jsx`, `pdfGenerator.js` |
| **Student** | Student Performance & Trend Analytics | COMPLETE (Heuristic)| `StudentPerformance.jsx`, `AnalyticsService.studentTrend` |
| **Student** | Re-Exam Attempt Request / Flow | COMPLETE | `StudentResponseService.grantReExam`, `AttendExam.jsx` |
| **AI / ML** | Document OCR & Text Extraction | COMPLETE | `TextExtractionService.java`, `OcrService.java`, `pdf_reader.py` |
| **AI / ML** | LLM Question Paper Decomposition | COMPLETE | `AiModelParserService.java`, `ai_extractor.py`, `GeminiParserService.java`|
| **AI / ML** | Performance Score & Risk Prediction | **MOCKED** | `PredictionService.java` (Static weighted formula, no ML model) |

---

## 10. Frontend Deep-Dive Audit

### Technology & Libraries:
- **Core**: React 19.2.5, Vite 8.0.10, React Router DOM 7.15.0
- **Styling**: TailwindCSS 4.2.4 + Custom Component CSS files
- **HTTP Client**: Axios 1.16.0 with `Authorization: Bearer <token>` interceptor in `axiosConfig.js`
- **PDF Generation**: `jspdf` 4.2.1 and `jspdf-autotable` 5.0.8 for client-side downloadable PDF scorecards and question papers.
- **Toasts**: `react-hot-toast` 2.6.0

### Quality & Bug Assessment:
1. **Route Coverage**: 24 routes properly defined in `AppRoutes.jsx`.
2. **State Management**: Clean `AuthContext.jsx` handling `token` and `role` with persistence in `localStorage`.
3. **Identified Frontend Bugs**:
   - `StudentPerformance.jsx` line 150: Unsafe dereference `{analytics.trend?.map(...)}` when `analytics` is null. Throws runtime error on network failure.
   - `teacherService.js` line 9: Hardcoded URL `http://127.0.0.1:5000/api/ai/upload-paper`. If Python service is down, it catches and falls back to backend `/papers/upload`, but causes console errors and network delay.

---

## 11. Backend & REST API Audit

### Controllers & Endpoints Inventory:

| HTTP Method | Endpoint | Controller | Purpose | Auth Security Filter | Frontend Uses It? | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | `AuthController` | Register student/teacher | Permitted | Yes (`authService.js`) | WORKING |
| `POST` | `/api/auth/verify-otp` | `AuthController` | Verify 6-digit OTP | Permitted | Yes (`authService.js`) | WORKING |
| `POST` | `/api/auth/login` | `AuthController` | Authenticate & get JWT | Permitted | Yes (`authService.js`) | WORKING |
| `GET` | `/api/admin/pending-users` | `AdminController` | Get pending registrations | Permitted | Yes (`adminService.js`) | WORKING |
| `POST` | `/api/admin/approve` | `AdminController` | Approve pending user | Permitted | Yes (`adminService.js`) | WORKING |
| `POST` | `/api/admin/approve-teacher` | `AdminController` | Approve teacher with subjects | Permitted | Yes (`adminService.js`) | WORKING |
| `POST` | `/api/admin/teacher/assign-subjects` | `AdminController` | Update teacher subjects | Permitted | Yes (`adminService.js`) | WORKING |
| `DELETE` | `/api/admin/reject` | `AdminController` | Reject and delete user | Permitted | Yes (`adminService.js`) | WORKING |
| `GET` | `/api/admin/students` | `AdminController` | List approved students | Permitted | Yes (`adminService.js`) | WORKING |
| `GET` | `/api/admin/teachers` | `AdminController` | List approved teachers | Permitted | Yes (`adminService.js`) | WORKING |
| `GET` | `/api/admin/teacher-profile` | `AdminController` | Fetch teacher details | Permitted | Yes (`adminService.js`) | WORKING |
| `GET` | `/api/admin/export-users` | `AdminController` | Export users to Excel (.xlsx)| Permitted | Yes (`adminService.js`) | WORKING |
| `POST` | `/api/papers/upload` | `QuestionPaperController`| Upload PDF/DOCX paper | Permitted | Yes (`paperService.js`) | WORKING |
| `GET` | `/api/papers` | `QuestionPaperController`| Get all question papers | Permitted | Yes (`paperService.js`) | WORKING |
| `GET` | `/api/papers/{paperId}` | `QuestionPaperController`| Get single question paper | Permitted | Yes (`paperService.js`) | WORKING |
| `POST` | `/api/papers/create` | `QuestionPaperController`| Create paper manually | Permitted | Yes (`paperService.js`) | WORKING |
| `PUT` | `/api/papers/{paperId}` | `QuestionPaperController`| Update question paper | Permitted | Yes (`paperService.js`) | WORKING |
| `DELETE` | `/api/papers/{paperId}` | `QuestionPaperController`| Delete question paper | Permitted | Yes (`paperService.js`) | WORKING |
| `PUT` | `/api/papers/{paperId}/practice-toggle`| `QuestionPaperController`| Toggle practice availability| Permitted | Yes (`paperService.js`) | WORKING |
| `POST` | `/api/responses` | `StudentResponseController`| Submit exam responses | Permitted | Yes (`responseService.js`) | WORKING |
| `GET` | `/api/responses` | `StudentResponseController`| Get all student responses | Permitted | Yes (`evaluationService.js`)| WORKING |
| `GET` | `/api/responses/paper/{paperId}` | `StudentResponseController`| Get responses for paper | Permitted | Yes (`responseService.js`) | WORKING |
| `GET` | `/api/responses/student/{studentId}`| `StudentResponseController`| Get responses for student | Permitted | Yes (`responseService.js`) | WORKING |
| `PUT` | `/api/responses/evaluate` | `StudentResponseController`| Grade individual response | Permitted | Yes (`evaluationService.js`)| WORKING |
| `POST` | `/api/responses/{id}/grant-re-exam`| `StudentResponseController`| Grant re-exam attempt | Permitted | Yes (`evaluationService.js`)| WORKING |
| `GET` | `/api/responses/teacher/my-subjects`| `StudentResponseController`| Get teacher's assigned subjects | Permitted | Yes (`evaluationService.js`)| WORKING |
| `POST` | `/api/responses/teacher/verify-access`| `StudentResponseController`| Verify teacher security password | Permitted | Yes (`evaluationService.js`)| WORKING |
| `GET` | `/api/responses/enriched` | `StudentResponseController`| Get filtered enriched roster | Permitted | Yes (`evaluationService.js`)| WORKING |
| `POST` | `/api/responses/{id}/send-email`| `StudentResponseController`| Send scorecard email | Permitted | Yes (`evaluationService.js`)| WORKING |
| `GET` | `/api/responses/export-excel`| `StudentResponseController`| Export evaluations to Excel | Permitted | Yes (`evaluationService.js`)| WORKING |
| `GET` | `/api/responses/summary` | `StudentResponseController`| Overall evaluation stats | Permitted | Yes (`evaluationService.js`)| WORKING |
| `GET` | `/api/responses/my-submission-excel/{id}`| `StudentResponseController`| Export single submission | Permitted | Yes (`responseService.js`) | WORKING |
| `POST` | `/api/responses/{id}/self-evaluate`| `StudentResponseController`| Self-grade practice test | Permitted | Yes (`responseService.js`) | WORKING |
| `POST` | `/api/responses/{id}/peer-evaluate`| `StudentResponseController`| Peer-grade practice test | Permitted | Yes (`responseService.js`) | WORKING |
| `POST` | `/api/responses/{id}/assign-peer`| `StudentResponseController`| Assign friend for peer review| Permitted | Yes (`responseService.js`) | WORKING |
| `GET` | `/api/analytics/paper/{paperId}`| `AnalyticsController` | Paper topic & question metrics| Permitted | Yes (`analyticsService.js`)| WORKING |
| `GET` | `/api/analytics/student/{studentId}`| `AnalyticsController`| Student historical trends | Permitted | Yes (`analyticsService.js`)| WORKING |
| `POST` | `/api/predictions/score` | `PredictionController` | Predict score from parameters| Permitted | Unused in frontend | WORKING (Heuristic) |
| `GET` | `/api/students/classmates` | `ClassmateController` | Get list of peers for review | Permitted | Yes (`responseService.js`) | WORKING |
| `GET` | `/api/profile/me` | `ProfileController` | Get user profile details | Permitted | Yes (`profileService.js`) | WORKING |
| `PUT` | `/api/profile/update` | `ProfileController` | Update user profile | Permitted | Yes (`profileService.js`) | WORKING |

---

## 12. Database Audit (MongoDB)

### Collections and Schemas:

#### 1. `users` Collection (`User.java`)
- **Primary Key**: `id` (String / ObjectId)
- **Fields**: `name`, `email` (unique identifier), `password` (BCrypt hash), `role` (`STUDENT`, `TEACHER`, `ADMIN`), `verified` (boolean), `approved` (boolean), `banned` (boolean), `otp`, `otpExpiry`, `usn`, `semester`, `studentDepartment`, `employeeId`, `designation`, `teacherDepartment`, `assignedSubjects` (List of Strings), profile details (`profilePicture`, `phone`, `bio`, `collegeName`, `qualification`, `experienceYears`, `cabinRoom`, `academicBatch`), timestamps (`createdAt`, `approvedAt`, `rejectedAt`), rejection details.
- **Default Seed Data**: Default administrator `admin@acadion.com` initialized automatically by `DataInitializer.java` on application startup.

#### 2. `question_papers` Collection (`QuestionPaper.java`)
- **Primary Key**: `id` (String / ObjectId)
- **Fields**: `paperId` (Indexed business key, e.g. `2026-INT2-AI`), `subject`, `internalNo`, `originalFileName`, `contentType`, `uploadedAt`, `collegeName`, `subjectCode`, `examName`, `semester`, `date`, `duration`, `durationMinutes`, `maxMarks`, `totalMarks`, `rawMarks`, `paperCategory` (`ASSESSMENT`, `PRACTICE`, `QUIZ`), `paperFormat` (`THEORY`, `MCQ`), `allowedForPractice`, `assignedSemester`, `createdBy`.
- **Embedded List (`questions`)**: `questionId`, `text`, `section`, `groupName`, `optionalQuestion`, `optionalWith`, `parentQuestion`, `maxAttempt`, `questionType`, `marks`, `topic`, `imageUrl`, `options` (List of MCQ options), `correctAnswer`, `explanation`.

#### 3. `student_responses` Collection (`StudentResponse.java`)
- **Primary Key**: `id` (String / ObjectId)
- **Fields**: `usn`, `paperId`, `submittedAt`, `totalMarks`, `maxMarks`, `predictedScore`, `riskLevel`, `evaluationCompleted`, `evaluatedBy`, `evaluatedByEmail`, `evaluatedAt`, `attemptCount`, `reExamGranted`, `reExamNote`, `reExamGrantedAt`, `submissionMode` (`ONLINE`, `OFFLINE_MANUAL`, `PRACTICE`), `includeInOverallPercentage`, `paperCategory`, `isPractice`, `evaluationMode` (`FACULTY`, `SELF`, `PEER`), `assignedPeerUsn`, `assignedPeerName`, `peerEvaluatorUsn`, `peerEvaluatorName`, `peerEvaluatedAt`, `peerFeedback`.
- **Embedded List (`responses`)**: `questionId`, `questionText`, `questionType`, `answer`, `isCorrect`, `marksObtained`, `maxMarks`, `topic`, `feedback`, `evaluated`.

### Database Portability:
- Works with MongoDB Atlas cloud URI as well as local MongoDB instance (`mongodb://localhost:27017/acadiondb`).

---

## 13. Security & Vulnerability Audit

> [!CAUTION]
> Critical Security Vulnerabilities Discovered in Source Code

1. **Spring Security Authorization Bypassed**:
   In `SecurityConfig.java`, all endpoints matching `/api/**` are set to `.permitAll()`. While `JwtFilter.java` populates `SecurityContextHolder` with the authenticated user's role, the security rules do not restrict `/api/admin/**` to `ADMIN` or `/api/papers/upload` to `TEACHER`. Role enforcement is handled only inside individual service methods or client-side UI routes.
2. **Hardcoded Secrets in Source Code**:
   - `application.properties`: Plaintext Brevo SMTP username and API master password, MongoDB Atlas credentials.
   - `AiModelParserService.java` & `ai_extractor.py`: Plaintext OpenRouter API keys.
3. **Unauthenticated Public Profile Queries**:
   - `/api/profile/me` accepts `email` or `usn` as open query parameters without validating if the caller is the owner of the requested profile.
4. **File Upload Validation**:
   - `uploadPaper` allows uploading files without strict MIME-type sanitization or file size limitation checking at the controller level.

---

## 14. Local Execution & Environment Audit

### Requirements to Run the Entire Project:

| Component | Required Software / Version | Port | Command to Run |
| :--- | :--- | :--- | :--- |
| **Backend** | Java 21 LTS, Maven 3.9+ | `8080` | `cd educate/backend && ./mvnw spring-boot:run` |
| **Frontend** | Node.js 18+, npm 9+ | `5173` | `cd educate/frontend && npm run dev` |
| **Python Microservice** | Python 3.10+, pip | `5000` | `cd educate/logs && python app.py` |
| **Database** | MongoDB 6.0+ or MongoDB Atlas | `27017` | Standard MongoDB Daemon or Atlas connection |
| **OCR Engine** | Tesseract OCR Binary installed | N/A | Windows: `C:\Program Files\Tesseract-OCR\tesseract.exe` |

### Python Environment Issue:
`educate/logs/requirements.txt` currently lists:
```
fastapi>=0.110.0
uvicorn>=0.28.0
openai>=1.14.0
pypdf>=4.1.0
requests>=2.31.0
```
Missing from `requirements.txt`: `PyMuPDF` (for `import fitz`), `pytesseract`, `pillow`, `httpx`. Running `pip install -r requirements.txt` will result in `ModuleNotFoundError: No module named 'fitz'` upon calling `app.py`.

---

## 15. Testing & Verification Audit

### Current Test Inventory:
1. **Backend Tests**:
   - `BackendApplicationTests.java`: Context load test.
   - `AiQuestionParserServiceTest.java`: 15 comprehensive unit tests verifying regex question extraction, subquestions, OR choices, marks parsing, MCQ detection, multiline question gluing, and noise filtration.
2. **Python Tests**:
   - `test_ai_paper.py`, `test_cli.py`, `test_mcq.py`, `test_ocr.py`: Manual CLI test scripts.
3. **Frontend Tests**:
   - 0 unit or integration tests (no Vitest / Jest configured).

---

## 16. Project Completion Scorecard

```
+-----------------------------------------------------------------------+
|                       ACADION AUDIT SCORECARD                         |
+------------------------------------+----------------------------------+
| Dimension                          | Score (0 - 100)                  |
+------------------------------------+----------------------------------+
| Core Architecture                  | 85 / 100                         |
| Authentication & Role Management   | 90 / 100                         |
| Administrator Management Module    | 90 / 100                         |
| Teacher Management & Upload Module | 85 / 100                         |
| Student Examination & Results      | 90 / 100                         |
| Digital Evaluation & Grading       | 90 / 100                         |
| Document Extraction & OCR          | 85 / 100                         |
| Question Paper AI Decomposition    | 90 / 100                         |
| Performance Analytics (Objective 1)| 70 / 100 (Heuristic, no ML model)|
| AI Quiz Generation (Objective 2)   | 20 / 100 (Deconstruction only)   |
| AI PPT Generation (Objective 2)    |  0 / 100 (Not Implemented)       |
| Academic Planning (Objective 3)    |  0 / 100 (Not Implemented)       |
| Syllabus Automation (Objective 3)  |  0 / 100 (Not Implemented)       |
| Database Design & Persistence      | 90 / 100                         |
| Frontend UI/UX Design              | 90 / 100                         |
| Backend REST Services              | 85 / 100                         |
| Security & Role Enforcement        | 45 / 100 (PermitAll flaw, secrets)|
| Automated Testing                  | 50 / 100 (Parser tested only)    |
| Documentation Accuracy             | 40 / 100 (PyTorch & PPT claims)  |
| Local Deployability                | 75 / 100 (Python deps missing)   |
+------------------------------------+----------------------------------+
| OVERALL PROJECT COMPLETION         | 62%                              |
+------------------------------------+----------------------------------+
```

---

## 17. Critical Blockers & Action Items

### P0 — Blockers (Preventing local startup / execution)
1. **Python Dependencies Missing**: Update `educate/logs/requirements.txt` to include `PyMuPDF`, `pytesseract`, `pillow`, `httpx` so `app.py` runs without missing module errors.
2. **Frontend Runtime Bug in `StudentPerformance.jsx`**: Fix line 150 `analytics.trend?.map(...)` to safely guard against null `analytics`.

### P1 — Core Functionality (Mandatory for Project Objectives)
1. **Real Machine Learning Regressor Model (Objective 1)**: Train a genuine scikit-learn / PyTorch regression model on student feature vectors (`topic_avg`, `prev_internals`, `attendance`, `study_hours`, `past_failures`) and deploy inference via Python FastAPI microservice.
2. **AI Quiz & Assignment Generator (Objective 2)**: Implement `/api/ai/generate-quiz` to create MCQs and descriptive questions from topic prompts using LLMs.
3. **PowerPoint (.pptx) Lecture Generator (Objective 2)**: Implement a slide generation module using `python-pptx` to generate and download slide decks from course topics.
4. **Academic Planning & Syllabus Automation Engine (Objective 3)**: Implement syllabus module extraction, teaching hours scheduling, timetable mapping, topic completion tracking, and dynamic rescheduling.
5. **Bulk Marksheet Upload**: Add Excel file (`.xlsx`) upload parsing using Apache POI in backend and a file upload modal in `ManualMarksEntry.jsx`.

### P2 — Quality & Security Hardening
1. **Spring Security Enforcement**: Restrict `/api/admin/**` to `hasRole('ADMIN')` and `/api/papers/upload` to `hasRole('TEACHER')`.
2. **Environment Variable Externalization**: Move Brevo SMTP passwords, MongoDB Atlas URIs, and OpenRouter API keys into `.env` / environment variables.
3. **Directory Renaming**: Rename `educate/logs` to `educate/ai-service` or `educate/python-service`.

---

## 18. Recommended Final Architecture

```
                                +---------------------------+
                                |  React 19 Frontend (SPA)  |
                                +-------------+-------------+
                                              |
                                     REST / Bearer JWT
                                              |
                                +-------------v-------------+
                                |  Spring Boot 3.5 Backend  |
                                |  - Security & Auth Gate   |
                                |  - Exam & Marking Engine  |
                                |  - MongoDB CRUD & POI     |
                                +-------+-------------+-----+
                                        |             |
                         Internal REST  |             |  MongoDB Native Driver
                                        |             |
        +-------------------------------v--+   +------v--------------------+
        |   Python AI/ML Microservice      |   |     MongoDB Database      |
        |   - FastAPI (Port 5000)          |   |  - users                  |
        |   - PyTorch / Scikit-Learn Model |   |  - question_papers        |
        |   - PyMuPDF / Tesseract OCR      |   |  - student_responses      |
        |   - OpenRouter / Gemini LLM      |   |  - syllabi (New)          |
        |   - python-pptx Generator        |   |  - academic_plans (New)   |
        +----------------------------------+   +---------------------------+
```

---

## 19. Acceptance Tests to Validate 100% Objective Fulfillment

1. **Objective 1 Test**: Upload an Excel marksheet with 30 students, trigger inference through the trained ML regressor, verify that predicted final exam scores and risk badges (`HIGH_RISK`, `NEEDS_ATTENTION`, `ON_TRACK`) populate accurately on both Teacher and Student dashboards.
2. **Objective 2 Test**: 
   - Parse a scanned VTU question paper and verify question and marks extraction.
   - Generate a 10-question MCQ quiz on "Support Vector Machines" with answer keys and publish it directly to student portals.
   - Generate and download a 6-slide `.pptx` presentation on "Convolutional Neural Networks".
3. **Objective 3 Test**: Ingest a syllabus PDF, verify extraction of 5 modules with hourly allocations, generate a calendar schedule based on weekly class slots, mark 2 lectures as "Delayed", and verify automatic rescheduling across the calendar.

---

## 20. Exact Next Steps

1. Wait for user review and explicit approval of this implementation audit report.
2. Upon approval, execute the prioritized roadmap in order:
   - **Step 1 (P0)**: Fix Python dependencies and frontend null-pointer bug.
   - **Step 2 (P1 - Objective 1)**: Implement bulk Excel marksheet upload and real trained ML regression service.
   - **Step 3 (P1 - Objective 2)**: Implement AI Quiz Generation and PowerPoint (.pptx) generator.
   - **Step 4 (P1 - Objective 3)**: Implement Syllabus Parser, Academic Calendar Scheduler, and Teacher Planner UI.
   - **Step 5 (P2)**: Harden Spring Security role filters and externalize secrets.
   - **Step 6 (Verification)**: Run full end-to-end integration and acceptance tests.