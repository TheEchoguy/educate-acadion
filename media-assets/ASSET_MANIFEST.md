# ACADION — Asset Relocation Manifest

This document tracks all image, video, and decorative binary assets moved out of the source-code tree into the centralized `media-assets/` directory to prepare a lightweight source-only repository for architectural and code review.

## Summary of Media Relocation
- **Total Video Files Moved**: 12 files (~135.09 MB)
  - 6 Active Background Videos moved to `media-assets/videos/backgrounds/`
  - 6 Unreferenced / Duplicate Videos moved to `media-assets/videos/unreferenced/`
- **Total Image Files Moved**: 12 files (~5.41 MB)
  - 12 Topic Card Images moved to `media-assets/images/topics/`
- **Total Binary Assets Moved**: 24 files (~140.50 MB)
- **Source References Updated**: 7 component / page files (`Home.jsx`, `LandingPage.jsx`, `Login.jsx`, `Register.jsx`, `AdminDashboard.jsx`, `TeacherDashboard.jsx`, `StudentDashboard.jsx`, plus `vite.config.js` and `CinematicIntro.jsx`)
- **Total Files Deleted**: 0 files permanently deleted (100% reversible relocation).

---

## Complete Asset Relocation Inventory

| Original Path | New Path | Type | Size | Referenced By | Status |
|---|---|---|---|---|---|
| `educate/frontend/public/videos/home_student_campus.mp4` | `media-assets/videos/backgrounds/home_student_campus.mp4` | VIDEO (Background) | 13.71 MB | `educate/frontend/src/pages/Home.jsx` | VERIFIED |
| `educate/frontend/public/videos/home_faculty_learning.mp4` | `media-assets/videos/backgrounds/home_faculty_learning.mp4` | VIDEO (Background) | 10.71 MB | `educate/frontend/src/pages/Home.jsx` | VERIFIED |
| `educate/frontend/public/videos/home_administration.mp4` | `media-assets/videos/backgrounds/home_administration.mp4` | VIDEO (Background) | 12.25 MB | `educate/frontend/src/pages/Home.jsx` | VERIFIED |
| `educate/frontend/public/videos/Generate_academic_video_sequence_1080p_202608212346.mp4` | `media-assets/videos/backgrounds/Generate_academic_video_sequence_1080p_202608212346.mp4` | VIDEO (Background) | 12.01 MB | `educate/frontend/src/pages/LandingPage.jsx` | VERIFIED |
| `educate/frontend/public/videos/Creating_background_video_for_login_202608220034.mp4` | `media-assets/videos/backgrounds/Creating_background_video_for_login_202608220034.mp4` | VIDEO (Background) | 10.45 MB | `educate/frontend/src/pages/auth/Login.jsx` | VERIFIED |
| `educate/frontend/public/videos/Creating_ACADION_registration_video_1080p_202608220038.mp4` | `media-assets/videos/backgrounds/Creating_ACADION_registration_video_1080p_202608220038.mp4` | VIDEO (Background) | 11.02 MB | `educate/frontend/src/pages/auth/Register.jsx` | VERIFIED |
| `educate/frontend/public/videos/Create_background_video_for_module_202608220944.mp4` | `media-assets/videos/unreferenced/Create_background_video_for_module_202608220944.mp4` | VIDEO (Unused) | 7.12 MB | None (Unreferenced asset) | VERIFIED (Preserved) |
| `educate/frontend/public/videos/Creating_ACADION_registration_vi._1080p_202608220038.mp4` | `media-assets/videos/unreferenced/Creating_ACADION_registration_vi._1080p_202608220038.mp4` | VIDEO (Duplicate) | 11.02 MB | None (Duplicate copy with truncated filename) | VERIFIED (Preserved) |
| `educate/frontend/public/videos/Empty_modern_university_classroo._1080p_202608220113.mp4` | `media-assets/videos/unreferenced/Empty_modern_university_classroo._1080p_202608220113.mp4` | VIDEO (Duplicate) | 10.71 MB | None (Duplicate of `home_faculty_learning.mp4`) | VERIFIED (Preserved) |
| `educate/frontend/public/videos/Modern_university_office_environ._1080p_202608220110.mp4` | `media-assets/videos/unreferenced/Modern_university_office_environ._1080p_202608220110.mp4` | VIDEO (Duplicate) | 12.25 MB | None (Duplicate of `home_administration.mp4`) | VERIFIED (Preserved) |
| `educate/frontend/public/videos/University_administration_office._1080p_202608220943.mp4` | `media-assets/videos/unreferenced/University_administration_office._1080p_202608220943.mp4` | VIDEO (Unused) | 10.11 MB | None (Unreferenced asset) | VERIFIED (Preserved) |
| `educate/frontend/public/videos/University_library_interior_with._1080p_202608220110.mp4` | `media-assets/videos/unreferenced/University_library_interior_with._1080p_202608220110.mp4` | VIDEO (Duplicate) | 13.71 MB | None (Duplicate of `home_student_campus.mp4`) | VERIFIED (Preserved) |
| `educate/frontend/src/assets/topics/admin_department_governance.jpg` | `media-assets/images/topics/admin_department_governance.jpg` | IMAGE (UI Topic) | 0.91 MB | `educate/frontend/src/pages/admin/AdminDashboard.jsx` | VERIFIED |
| `educate/frontend/src/assets/topics/admin_manage_users.jpg` | `media-assets/images/topics/admin_manage_users.jpg` | IMAGE (UI Topic) | 0.98 MB | `educate/frontend/src/pages/admin/AdminDashboard.jsx` | VERIFIED |
| `educate/frontend/src/assets/topics/admin_pending_approvals.jpg` | `media-assets/images/topics/admin_pending_approvals.jpg` | IMAGE (UI Topic) | 0.74 MB | `educate/frontend/src/pages/admin/AdminDashboard.jsx` | VERIFIED |
| `educate/frontend/src/assets/topics/admin_platform_analytics.jpg` | `media-assets/images/topics/admin_platform_analytics.jpg` | IMAGE (UI Topic) | 0.66 MB | `educate/frontend/src/pages/admin/AdminDashboard.jsx` | VERIFIED |
| `educate/frontend/src/assets/topics/teacher_analytics.jpg` | `media-assets/images/topics/teacher_analytics.jpg` | IMAGE (UI Topic) | 0.30 MB | `educate/frontend/src/pages/teacher/TeacherDashboard.jsx` | VERIFIED |
| `educate/frontend/src/assets/topics/teacher_evaluate.jpg` | `media-assets/images/topics/teacher_evaluate.jpg` | IMAGE (UI Topic) | 0.36 MB | `educate/frontend/src/pages/teacher/TeacherDashboard.jsx` | VERIFIED |
| `educate/frontend/src/assets/topics/teacher_manual.jpg` | `media-assets/images/topics/teacher_manual.jpg` | IMAGE (UI Topic) | 0.34 MB | `educate/frontend/src/pages/teacher/TeacherDashboard.jsx` | VERIFIED |
| `educate/frontend/src/assets/topics/teacher_papers.jpg` | `media-assets/images/topics/teacher_papers.jpg` | IMAGE (UI Topic) | 0.64 MB | `educate/frontend/src/pages/teacher/TeacherDashboard.jsx` | VERIFIED |
| `educate/frontend/src/assets/topics/topic_analytics.jpg` | `media-assets/images/topics/topic_analytics.jpg` | IMAGE (UI Topic) | 0.19 MB | `educate/frontend/src/pages/student/StudentDashboard.jsx` | VERIFIED |
| `educate/frontend/src/assets/topics/topic_exams.jpg` | `media-assets/images/topics/topic_exams.jpg` | IMAGE (UI Topic) | 0.07 MB | `educate/frontend/src/pages/student/StudentDashboard.jsx` | VERIFIED |
| `educate/frontend/src/assets/topics/topic_practice.jpg` | `media-assets/images/topics/topic_practice.jpg` | IMAGE (UI Topic) | 0.07 MB | `educate/frontend/src/pages/student/StudentDashboard.jsx` | VERIFIED |
| `educate/frontend/src/assets/topics/topic_results.jpg` | `media-assets/images/topics/topic_results.jpg` | IMAGE (UI Topic) | 0.15 MB | `educate/frontend/src/pages/student/StudentDashboard.jsx` | VERIFIED |

---

## Missing / Legacy References Audited
- `educate/frontend/src/components/CinematicIntro.jsx`: Contained legacy reference `import heroImg from "../assets/auth_heroes/login_slide1.jpg"`. The file `login_slide1.jpg` was already absent from the repository, and `CinematicIntro.jsx` is not referenced or rendered by any route or view. Updated with a safe placeholder `const heroImg = ""` so it does not impede build operations.

## Intentionally Preserved Non-Media Binaries
- `educate/backend/tessdata/eng.traineddata` (3.92 MB) and `educate/backend/src/main/resources/tessdata/eng.traineddata` (3.92 MB): Tesseract OCR language model files required at runtime by `OcrService.java` for extracting exam questions from PDF marksheets. Intentionally retained in the backend source tree to preserve OCR functionality.
