import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import Navbar from "../../components/Navbar";
import toast from "react-hot-toast";
import { getClassroomDetails } from "../../services/classroomService";
import StudentSyllabusView from "../../components/syllabus/student/StudentSyllabusView";
import EvaluationSchemeConfig from "../../components/classroom/EvaluationSchemeConfig";
import StudentPerformanceView from "./StudentPerformanceView";
import RagStudyTutorSection from "../../components/classroom/RagStudyTutorSection";
import ClassroomAnnouncementsSection from "../../components/classroom/ClassroomAnnouncementsSection";
import "./StudentClassrooms.css";

function StudentClassroomWorkspace({ defaultTab = null }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [classroom, setClassroom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Determine initial tab based on path, prop, or search query
  const getInitialTab = () => {
    if (defaultTab) return defaultTab;
    if (location.pathname.endsWith("/performance")) return "performance";
    const qTab = searchParams.get("tab");
    if (qTab === "tutor" || qTab === "rag") return "tutor";
    if (qTab === "performance") return "performance";
    if (qTab === "scheme") return "scheme";
    if (qTab === "announcements" || qTab === "noticeboard") return "announcements";
    return "announcements"; // Default to noticeboard & announcements feed or syllabus
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);

  useEffect(() => {
    if (location.pathname.endsWith("/performance")) {
      setActiveTab("performance");
    }
  }, [location.pathname]);

  useEffect(() => {
    let active = true;
    if (id) {
      getClassroomDetails(id)
        .then((data) => {
          if (active) {
            setClassroom(data);
            setLoading(false);
          }
        })
        .catch((err) => {
          console.error(err);
          if (active) {
            setError(err.response?.data?.message || "Failed to load classroom details");
            setLoading(false);
            toast.error("Could not load classroom workspace");
          }
        });
    }

    return () => {
      active = false;
    };
  }, [id]);

  return (
    <div className="student-classrooms-page" style={{ background: "#0B0F19", minHeight: "100vh" }}>
      <Navbar />

      <div className="student-classrooms-container">
        {/* BACK BUTTON */}
        <button
          type="button"
          className="ssm-subtab-btn"
          style={{
            background: "#111827",
            border: "1px solid #1F2937",
            marginBottom: 20,
            color: "#9CA3AF",
            borderRadius: 8,
            padding: "8px 16px",
            fontSize: "0.85rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
          onClick={() => navigate("/student/classrooms")}
        >
          ← Back to My Classrooms
        </button>

        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p style={{ color: "#9CA3AF" }}>Loading course workspace...</p>
          </div>
        ) : error || !classroom ? (
          <div
            className="empty-state-card"
            style={{
              background: "#111827",
              border: "1px solid #1F2937",
              borderRadius: 12,
              padding: "40px 24px",
              textAlign: "center",
            }}
          >
            <h3 style={{ color: "#F9FAFB", margin: "0 0 8px 0" }}>Classroom Not Found</h3>
            <p style={{ color: "#9CA3AF", margin: "0 0 20px 0" }}>
              {error || "We could not find the requested classroom. You might not be enrolled yet."}
            </p>
            <button className="btn-join-first" onClick={() => navigate("/student/classrooms")}>
              Back to Enrolled Classrooms
            </button>
          </div>
        ) : (
          <>
            {/* HERO CARD - Clean Midnight Slate Design */}
            <div
              style={{
                background: "#111827",
                border: "1px solid #1F2937",
                borderRadius: 14,
                padding: "24px 28px",
                marginBottom: 24,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 18,
              }}
            >
              <div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                  <span className="subject-pill">{classroom.courseCode || classroom.subjectCode}</span>
                  <span
                    style={{
                      background: "#1F2937",
                      color: "#9CA3AF",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      padding: "3px 10px",
                      borderRadius: 6,
                      border: "1px solid #374151",
                    }}
                  >
                    Sem {classroom.semester} • Sec {classroom.section}
                  </span>
                  <span
                    style={{
                      background: "#1F2937",
                      color: "#9CA3AF",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      padding: "3px 10px",
                      borderRadius: 6,
                      border: "1px solid #374151",
                    }}
                  >
                    {classroom.department}
                  </span>
                  <span
                    style={{
                      background: "rgba(16, 185, 129, 0.12)",
                      color: "#10B981",
                      border: "1px solid rgba(16, 185, 129, 0.3)",
                      fontSize: "0.74rem",
                      fontWeight: 700,
                      padding: "3px 9px",
                      borderRadius: 6,
                    }}
                  >
                    ✓ ENROLLED
                  </span>
                </div>

                <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: "0 0 6px 0", color: "#F9FAFB" }}>
                  {classroom.name}
                </h1>
                <p style={{ margin: 0, color: "#9CA3AF", fontSize: "0.92rem" }}>
                  {classroom.subjectName} • Academic Year {classroom.academicYear} • Faculty: {classroom.teacherName || "Course Instructor"}
                </p>
              </div>
            </div>

            {/* TABS ROW */}
            <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
              <button
                type="button"
                className={`ssm-subtab-btn ${activeTab === "announcements" ? "active" : ""}`}
                onClick={() => setActiveTab("announcements")}
                style={{
                  background: activeTab === "announcements" ? "#2563EB" : "#111827",
                  color: activeTab === "announcements" ? "#FFFFFF" : "#9CA3AF",
                  padding: "9px 18px",
                  borderRadius: 8,
                  border: activeTab === "announcements" ? "1px solid #3B82F6" : "1px solid #1F2937",
                  fontWeight: 600,
                  fontSize: "0.88rem",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                📢 Noticeboard &amp; Resources
              </button>

              <button
                type="button"
                className={`ssm-subtab-btn ${activeTab === "syllabus" ? "active" : ""}`}
                onClick={() => setActiveTab("syllabus")}
                style={{
                  background: activeTab === "syllabus" ? "#2563EB" : "#111827",
                  color: activeTab === "syllabus" ? "#FFFFFF" : "#9CA3AF",
                  padding: "9px 18px",
                  borderRadius: 8,
                  border: activeTab === "syllabus" ? "1px solid #3B82F6" : "1px solid #1F2937",
                  fontWeight: 600,
                  fontSize: "0.88rem",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                📖 Syllabus &amp; Revision
              </button>

              <button
                type="button"
                className={`ssm-subtab-btn ${activeTab === "scheme" ? "active" : ""}`}
                onClick={() => setActiveTab("scheme")}
                style={{
                  background: activeTab === "scheme" ? "#2563EB" : "#111827",
                  color: activeTab === "scheme" ? "#FFFFFF" : "#9CA3AF",
                  padding: "9px 18px",
                  borderRadius: 8,
                  border: activeTab === "scheme" ? "1px solid #3B82F6" : "1px solid #1F2937",
                  fontWeight: 600,
                  fontSize: "0.88rem",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                ⚖️ Evaluation Scheme
              </button>

              <button
                type="button"
                className={`ssm-subtab-btn ${activeTab === "performance" ? "active" : ""}`}
                onClick={() => setActiveTab("performance")}
                style={{
                  background: activeTab === "performance" ? "#2563EB" : "#111827",
                  color: activeTab === "performance" ? "#FFFFFF" : "#9CA3AF",
                  padding: "9px 18px",
                  borderRadius: 8,
                  border: activeTab === "performance" ? "1px solid #3B82F6" : "1px solid #1F2937",
                  fontWeight: 600,
                  fontSize: "0.88rem",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                📊 My Performance &amp; Analytics
              </button>

              <button
                type="button"
                className={`ssm-subtab-btn ${activeTab === "tutor" ? "active" : ""}`}
                onClick={() => setActiveTab("tutor")}
                style={{
                  background: activeTab === "tutor" ? "#0284C7" : "#111827",
                  color: activeTab === "tutor" ? "#FFFFFF" : "#9CA3AF",
                  padding: "9px 18px",
                  borderRadius: 8,
                  border: activeTab === "tutor" ? "1px solid #0EA5E9" : "1px solid #1F2937",
                  fontWeight: 600,
                  fontSize: "0.88rem",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  transition: "all 0.15s ease",
                }}
              >
                🤖 AI Study Tutor (RAG)
              </button>
            </div>

            {/* TAB CONTENTS */}
            {activeTab === "announcements" && (
              <ClassroomAnnouncementsSection classroomId={id} isTeacher={false} />
            )}
            {activeTab === "syllabus" && <StudentSyllabusView classroomId={id} />}
            {activeTab === "scheme" && <EvaluationSchemeConfig classroomId={id} isTeacher={false} />}
            {activeTab === "performance" && <StudentPerformanceView classroomId={id} />}
            {activeTab === "tutor" && (
              <RagStudyTutorSection classroomId={id} classroomName={classroom?.name} isTeacher={false} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default StudentClassroomWorkspace;
