import { Routes, Route } from "react-router-dom";

import LandingPage from "../pages/LandingPage";
import Home from "../pages/Home";

import Register from "../pages/auth/Register";
import Login from "../pages/auth/Login";
import VerifyOtp from "../pages/auth/VerifyOtp";

import AdminDashboard from "../pages/admin/AdminDashboard";
import StudentDashboard from "../pages/student/StudentDashboard";
import TeacherDashboard from "../pages/teacher/TeacherDashboard";
import PendingUsers from "../pages/admin/PendingUsers";

import ManageUsers from "../pages/admin/ManageUsers";
import UploadPaper from "../pages/teacher/UploadPaper";
import ManagePapers from "../pages/teacher/ManagePapers";
import EvaluateResponses from "../pages/teacher/EvaluateResponses";
import TeacherAnalytics from "../pages/teacher/TeacherAnalytics";

import AvailableExams from "../pages/student/AvailableExams";
import AttendExam from "../pages/student/AttendExam";
import MyResults from "../pages/student/MyResults";
import StudentPerformance from "../pages/student/StudentPerformance";
import PracticePapers from "../pages/student/PracticePapers";
import EditPaper from "../pages/teacher/EditPaper";
import CreateQuestionPaper from "../pages/teacher/CreateQuestionPaper";
import ManualMarksEntry from "../pages/teacher/ManualMarksEntry";
import UploadedPaperAnalysis from "../pages/teacher/UploadedPaperAnalysis";
import PracticePaperPermission from "../pages/teacher/PracticePaperPermission";
import StudentProfile from "../pages/student/StudentProfile";
import TeacherProfile from "../pages/teacher/TeacherProfile";
import TeacherClassrooms from "../pages/teacher/TeacherClassrooms";
import ClassroomWorkspaceSelection from "../pages/teacher/ClassroomWorkspaceSelection";
import ClassroomManagementWorkspacePage from "../pages/teacher/ClassroomManagementWorkspacePage";
import SyllabusTrackingWorkspacePage from "../pages/teacher/SyllabusTrackingWorkspacePage";
import SyllabusSchedulingWorkspacePage from "../pages/teacher/SyllabusSchedulingWorkspacePage";
import EvaluationSchemeWorkspacePage from "../pages/teacher/EvaluationSchemeWorkspacePage";
import IaMarksWorkspacePage from "../pages/teacher/IaMarksWorkspacePage";
import ClassroomCurriculumWorkspacePage from "../pages/teacher/ClassroomCurriculumWorkspacePage";
import ClassPerformanceWorkspacePage from "../pages/teacher/ClassPerformanceWorkspacePage";
import RagTutorWorkspacePage from "../pages/teacher/RagTutorWorkspacePage";
import ClassroomFeaturePicker from "../pages/teacher/ClassroomFeaturePicker";
import TeacherPptGenerator from "../pages/teacher/TeacherPptGenerator";
import StudentClassrooms from "../pages/student/StudentClassrooms";
import StudentClassroomWorkspace from "../pages/student/StudentClassroomWorkspace";
import ChatTutorPage from "../pages/student/ChatTutorPage";
import ErrorBoundary from "../components/common/ErrorBoundary";

function AppRoutes() {
  return (
    <Routes>
      {/* SEPARATE NEW CINEMATIC LANDING PAGE ON "/" */}
      <Route path="/" element={<LandingPage />} />

      {/* EXISTING UNTOUCHED HOME PAGE ON "/home" */}
      <Route path="/home" element={<Home />} />

      <Route path="/student/profile" element={<StudentProfile />} />
      <Route path="/teacher/profile" element={<TeacherProfile />} />

      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-otp" element={<VerifyOtp />} />

      <Route path="/admin/dashboard" element={<AdminDashboard />} />
      <Route path="/admin/pending-users" element={<PendingUsers />} />
      <Route path="/admin/manage-users" element={<ManageUsers />} />

      <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
      <Route path="/teacher/upload-paper" element={<UploadPaper />} />
      <Route path="/teacher/manage-papers" element={<ManagePapers />} />
      <Route path="/teacher/papers" element={<ManagePapers />} />
      <Route path="/teacher/papers/create" element={<CreateQuestionPaper />} />
      <Route path="/teacher/create-paper" element={<CreateQuestionPaper />} />
      <Route path="/teacher/edit-paper/:id" element={<EditPaper />} />
      <Route path="/teacher/evaluate" element={<EvaluateResponses />} />
      <Route path="/teacher/analytics" element={<ClassroomFeaturePicker featureKey="analytics" />} />
      <Route path="/teacher/ia-marks" element={<ClassroomFeaturePicker featureKey="ia-marks" />} />
      <Route path="/teacher/rag-tutor" element={<ClassroomFeaturePicker featureKey="rag-tutor" />} />
      <Route path="/teacher/manual-marks" element={<ManualMarksEntry />} />
      <Route path="/teacher/paper-analysis" element={<UploadedPaperAnalysis />} />
      <Route path="/teacher/paper-analysis/:id" element={<UploadedPaperAnalysis />} />
      <Route path="/teacher/practice-permissions" element={<PracticePaperPermission />} />
      <Route path="/teacher/classrooms" element={<TeacherClassrooms />} />
      <Route path="/teacher/classrooms/:id" element={<ClassroomWorkspaceSelection />} />
      <Route path="/teacher/classrooms/:id/workspaces" element={<ClassroomWorkspaceSelection />} />
      <Route path="/teacher/classrooms/:id/management" element={<ClassroomManagementWorkspacePage />} />
      <Route path="/teacher/classrooms/:id/curriculum" element={<ClassroomCurriculumWorkspacePage />} />
      <Route path="/teacher/classrooms/:id/syllabus-tracking" element={<ClassroomCurriculumWorkspacePage />} />
      <Route path="/teacher/classrooms/:id/syllabus-scheduling" element={<ClassroomCurriculumWorkspacePage />} />
      <Route path="/teacher/classrooms/:id/evaluation-scheme" element={<EvaluationSchemeWorkspacePage />} />
      <Route path="/teacher/classrooms/:id/ia-marks" element={<IaMarksWorkspacePage />} />
      <Route path="/teacher/classrooms/:id/intelligence" element={<IaMarksWorkspacePage />} />
      <Route path="/teacher/classrooms/:id/analytics" element={<ClassPerformanceWorkspacePage />} />
      <Route path="/teacher/classrooms/:id/rag-tutor" element={<RagTutorWorkspacePage />} />
      <Route path="/teacher/ppt-generator" element={<TeacherPptGenerator />} />

      <Route path="/student/dashboard" element={<StudentDashboard />} />
      <Route path="/student/classrooms" element={<StudentClassrooms />} />
      <Route path="/student/classrooms/:id" element={<StudentClassroomWorkspace />} />
      <Route path="/student/classrooms/:id/syllabus" element={<StudentClassroomWorkspace />} />
      <Route path="/student/exams" element={<AvailableExams />} />
      <Route path="/student/attend-exam/:id" element={<AttendExam />} />
      <Route path="/student/results" element={<MyResults />} />
      <Route path="/student/performance" element={<StudentPerformance />} />
      <Route path="/student/practice" element={<PracticePapers />} />
      <Route
        path="/student/tutor"
        element={
          <ErrorBoundary>
            <ChatTutorPage />
          </ErrorBoundary>
        }
      />
      <Route
        path="/teacher/tutor"
        element={
          <ErrorBoundary>
            <ChatTutorPage />
          </ErrorBoundary>
        }
      />
      <Route
        path="/tutor"
        element={
          <ErrorBoundary>
            <ChatTutorPage />
          </ErrorBoundary>
        }
      />
    </Routes>
  );
}

export default AppRoutes;