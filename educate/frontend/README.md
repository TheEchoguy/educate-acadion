# Acadion Frontend — Reactive Academic Intelligence Dashboard

> **Production single-page application built on React 18 & Vite, featuring interactive 4-level diagnostic hierarchies, SHAP force attributions, and a grounded RAG study tutor modal.**

[![React 18](https://img.shields.io/badge/Frontend-React%2018-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite 8](https://img.shields.io/badge/Build%20Tool-Vite%208-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind%20%2B%20CSS%20Tokens-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Chart.js & Recharts](https://img.shields.io/badge/Data%20Viz-Chart.js%20%26%20Recharts-FF6384?logo=chartdotjs&logoColor=white)](https://www.chartjs.org/)

---

## 🎨 UI Architecture & Experience Design

The frontend is architected as an enterprise portal providing dedicated, contextual workspaces for three primary institutional personas:

```
src/
├── components/
│   ├── classroom/      # Evaluation Scheme Config, Roster Ingestion, IA Uploads
│   ├── common/         # Navbar, Sidebar, Error Boundary, Modal Dialogs
│   ├── intelligence/   # 4-Level Diagnostic Rollup Cards & Mastery Meters
│   └── tutor/          # Grounded RAG AI Study Tutor with Provenance Cards
├── pages/
│   ├── student/        # Classroom Workspaces, Diagnostic Rollup, Semester Portfolio
│   ├── teacher/        # Blueprint Studio, Matrix Marksheets, Course Management
│   ├── admin/          # Institutional Governance, Verification, User Management
│   └── auth/           # Login, OTP Verification, Registration Gate
├── services/           # Authenticated Axios API Clients & JWT Interceptors
└── routes/             # Protected, Role-Enforced Application Routing (AppRoutes.jsx)
```

---

## 🌟 Key Visual Innovations

### 1. 4-Level Diagnostic Hierarchy Visualizer
- **Level 1 (Concept Mastery):** Micro-concept chips color-coded by mastery (Green $\ge 70\%$, Amber $50–69\%$, Red $<50\%$). Red items feature 1-click launch to the AI tutor.
- **Level 2 (Module Drop-off Chart):** Recharts bar and line progression tracking retention across Modules 1 through 5.
- **Level 3 (VTU Scaled CIE Matrix):** Real-time interactive breakdown calculating Theory CIE ($40\text{M} \rightarrow 15\text{M}$), Lab ($25\text{M}$), and passing margin deltas.
- **Level 4 (Semester Standings):** Cross-course portfolio cards showing credit velocity and current academic standing.

### 2. SHAP Explainable AI (XAI) Attribution Graphs
- Visualizes game-theoretic Shapley values calculated by the scikit-learn ensemble backend.
- Displays bilateral force bars highlighting positive drivers (e.g. *Strong Module 1 Mastery +12%*) versus risk penalties (e.g. *Low Attendance in Module 2 -14%*).

### 3. Grounded RAG Study Tutor Modal
- Modal dialog with multi-module filtering and cross-module fallback search.
- Renders streaming remedial explanations alongside **provenance citation cards** citing official university textbook and lecture note sources.

### 4. Examination Blueprint Studio & Excel Generator
- Visual paper authoring tool for VTU descriptive papers (Part A/B choices Q1–Q4) and objective MCQs.
- 1-click download of dynamically formatted mark-entry Excel templates.

---

## 🚀 Local Development & Build

### Prerequisites
- **Node.js 18.x** or **20.x LTS**
- **npm 9+**

### Setup
```bash
# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Start Vite hot-module replacement dev server (Port 5173)
npm run dev
```

### Production Build
```bash
# Build optimized production bundle to /dist
npm run build

# Preview the production bundle locally
npm run preview
```
Production assets are minified, tree-shaken, and bundled cleanly into [`dist/`](file:///c:/Users/Santhoshkumar/educate-acadion/educate/frontend/dist).
