# ACADION
**AI-Based Academic Risk Prediction, Performance Analytics and Personalized Learning Support System**

---

## 1. Repository Architecture & Directory Structure

To support lightweight source-code reviews, version control efficiency, and rapid CI builds, all large binary media files (videos, high-resolution background assets, and topic cards) are decoupled from the core source tree and stored in a centralized `media-assets/` directory.

```
Acadion/
│
├── educate/                                # Core Application Source Code
│   ├── backend/                            # Spring Boot 3.5.x (Java 21, Spring Data MongoDB)
│   │   ├── src/main/java/com/acadion/backend/
│   │   │   ├── controller/                 # REST Controllers (Auth, Classroom, Exam, Admin, etc.)
│   │   │   ├── service/                    # Business Logic Services
│   │   │   ├── repository/                 # Spring Data MongoDB Repositories
│   │   │   ├── entity/                     # MongoDB Domain Entities
│   │   │   └── security/                   # JWT Filter and Security Configuration
│   │   ├── src/main/resources/
│   │   │   └── application.properties.example # Redacted Configuration Template
│   │   └── pom.xml
│   │
│   ├── frontend/                           # React 19 + Vite 8 Single Page Application
│   │   ├── src/
│   │   │   ├── pages/                      # Views (Landing, Auth, Teacher, Student, Admin)
│   │   │   ├── components/                 # Reusable UI Components
│   │   │   ├── services/                   # Axios API Clients
│   │   │   └── routes/                     # App Routing (AppRoutes.jsx)
│   │   ├── vite.config.js                  # Configured with @media alias & media streaming middleware
│   │   └── package.json
│   │
│   └── logs/                               # Operational log outputs
│
├── media-assets/                           # Decoupled Media Assets (140.50 MB)
│   ├── videos/
│   │   ├── backgrounds/                    # 6 Active Background Videos (Home, Landing, Login, Register)
│   │   └── unreferenced/                   # 6 Unreferenced / Duplicate Videos (Preserved)
│   ├── images/
│   │   └── topics/                         # 12 Dashboard Topic Card Images
│   ├── other/
│   └── ASSET_MANIFEST.md                   # Comprehensive Asset Audit & Relocation Manifest
│
└── README.md                               # Project & Architecture Documentation
```

---

## 2. Media Asset Resolution Strategy

- **Images (`@media/images/topics/...`)**:
  - The Vite configuration (`educate/frontend/vite.config.js`) defines the `@media` alias mapped to `../../media-assets`.
  - Frontend components import topic images using the portable alias:
    ```javascript
    import imgPending from "@media/images/topics/admin_pending_approvals.jpg";
    ```
  - During `npm run build`, Vite bundles these images into the build output cleanly without machine-specific absolute paths.

- **Background Videos (`/media-assets/videos/backgrounds/...`)**:
  - Background videos are streamed dynamically via HTML5 `<video>` tags:
    ```javascript
    const VIDEO_STUDENT_CAMPUS = "/media-assets/videos/backgrounds/home_student_campus.mp4";
    ```
  - The custom `mediaAssetsPlugin` in `vite.config.js` serves these files directly from `media-assets/` in both development and preview modes.
  - Full HTTP 206 Partial Content (range requests) is implemented to ensure smooth seeking, instant playback, and loop transitions across all browsers.
  - Backwards-compatible route fallback (`/videos/...`) is supported automatically.

---

## 3. Getting Started & Running Locally

### Prerequisites
- **Java 21** JDK
- **Node.js** v18+ (tested on v22.x)
- **MongoDB** instance (local or Atlas)

### Backend Setup
```bash
cd educate/backend
# To run unit and integration tests:
./mvnw.cmd test -Dtest=Classroom*Test

# To start the Spring Boot application:
./mvnw.cmd spring-boot:run
```

### Frontend Setup
```bash
cd educate/frontend

# Install dependencies:
npm install

# Start development server with live media streaming:
npm run dev

# Build production bundle:
npm run build
```

---

## 4. Source-Only Review Preparation & Credentials

- **Source-Only Archive**: When creating a lightweight archive of Acadion for architectural or code review, the `media-assets/` directory and build output folders (`node_modules/`, `dist/`, `target/`) can be safely excluded. The core source code under `educate/` remains 100% portable and self-contained.
- **Credential Redaction**: A sanitized configuration template is provided at `educate/backend/src/main/resources/application.properties.example` with redacted MongoDB, JWT, and SMTP credentials for reference.
