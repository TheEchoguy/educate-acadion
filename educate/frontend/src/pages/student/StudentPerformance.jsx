import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { getStudentClassrooms } from "../../services/classroomService";
import StudentPerformanceView from "./StudentPerformanceView";
import "./StudentPerformance.css";

function StudentPerformance() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [classrooms, setClassrooms] = useState([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState(searchParams.get("classroomId") || "");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClassrooms();
  }, []);

  const loadClassrooms = async () => {
    try {
      setLoading(true);
      const data = await getStudentClassrooms();
      const list = data || [];
      setClassrooms(list);

      const requestedId = searchParams.get("classroomId");
      if (requestedId && list.some((c) => c.id === requestedId)) {
        setSelectedClassroomId(requestedId);
      } else if (list.length > 0) {
        setSelectedClassroomId(list[0].id);
      }
    } catch (err) {
      console.error("Failed to load student enrolled classrooms:", err);
      toast.error("Could not load your enrolled classrooms");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectClassroom = (id) => {
    setSelectedClassroomId(id);
    setSearchParams({ classroomId: id });
  };

  return (
    <div className="performance-page">
      {/* TOP BAR */}
      <div className="performance-top-bar">
        <button
          type="button"
          className="back-btn"
          onClick={() => navigate("/student/dashboard")}
        >
          ← Back To Dashboard
        </button>

        {classrooms.length > 1 && (
          <div className="performance-course-picker" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span className="picker-label" style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Select Course:</span>
            <select
              className="course-select-input"
              style={{
                background: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "8px",
                color: "#f8fafc",
                padding: "6px 12px",
                fontSize: "0.85rem",
                outline: "none",
                cursor: "pointer",
              }}
              value={selectedClassroomId}
              onChange={(e) => handleSelectClassroom(e.target.value)}
            >
              {classrooms.map((cls) => {
                const rawName = (cls.name || cls.subjectName || "").toLowerCase();
                const inferredCode = rawName.includes("energy") ? "BEE755B" : (rawName.includes("internet") || rawName.includes("iot") ? "BCS701" : "COURSE");
                const code = cls.courseCode || cls.subjectCode || inferredCode;
                return (
                  <option key={cls.id} value={cls.id}>
                    {code}: {cls.name || cls.subjectName} (Sem {cls.semester}-{cls.section})
                  </option>
                );
              })}
            </select>
          </div>
        )}
      </div>

      {/* HEADER */}
      <div className="performance-header" style={{ marginBottom: "24px" }}>
        <div
          className="badge-academic-intel"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "4px 12px",
            background: "rgba(56, 189, 248, 0.15)",
            border: "1px solid rgba(56, 189, 248, 0.35)",
            borderRadius: "9999px",
            fontSize: "0.78rem",
            fontWeight: 700,
            color: "#38bdf8",
            marginBottom: "12px",
          }}
        >
          🤖 4-LEVEL ACADEMIC INTELLIGENCE &amp; EXPLAINABLE AI (XAI)
        </div>
        <h1>Continuous Assessment &amp; Risk Diagnostics</h1>
        <p>
          Continuous Internal Evaluation (CIE) progress tracking, question-by-question topic mastery,
          Module 1 to 5 syllabus heatmaps, and SHAP-explained grade risk attribution.
        </p>

        {/* COURSE TABS ROW */}
        {classrooms.length > 0 && (
          <div
            className="performance-course-tabs"
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              marginTop: "18px",
            }}
          >
            {classrooms.map((cls) => {
              const rawName = (cls.name || cls.subjectName || "").toLowerCase();
              const inferredCode = rawName.includes("energy") ? "BEE755B" : (rawName.includes("internet") || rawName.includes("iot") ? "BCS701" : "COURSE");
              const code = cls.courseCode || cls.subjectCode || inferredCode;
              const isSelected = cls.id === selectedClassroomId;

              return (
                <button
                  key={cls.id}
                  type="button"
                  className={`course-tab-pill ${isSelected ? "active" : ""}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 16px",
                    borderRadius: "10px",
                    border: isSelected ? "1px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.1)",
                    background: isSelected ? "rgba(56, 189, 248, 0.18)" : "rgba(255, 255, 255, 0.04)",
                    color: isSelected ? "#ffffff" : "#94a3b8",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    transition: "all 0.2s ease",
                  }}
                  onClick={() => handleSelectClassroom(cls.id)}
                >
                  <span style={{ color: isSelected ? "#38bdf8" : "#cbd5e1" }}>{code}</span>
                  <span>{cls.name || cls.subjectName}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {loading ? (
        <div className="loading-msg" style={{ textAlign: "center", padding: "60px 20px" }}>
          <div className="spinner" style={{ margin: "0 auto 16px" }} />
          Loading your enrolled courses &amp; academic intelligence suite...
        </div>
      ) : classrooms.length === 0 ? (
        <div className="sp-empty-card" style={{ maxWidth: "600px", margin: "40px auto", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "16px" }}>🏫</div>
          <h3>No Classrooms Enrolled Yet</h3>
          <p style={{ color: "#94a3b8", lineHeight: "1.6", marginBottom: "24px" }}>
            To view your Scaled CIE Progress, Topic Mastery, Module Heatmaps, and Explainable AI risk
            analysis, please join a classroom using the join code provided by your faculty.
          </p>
          <button
            type="button"
            className="btn-primary"
            style={{
              padding: "10px 20px",
              background: "linear-gradient(135deg, #0284c7, #0369a1)",
              border: "none",
              borderRadius: "8px",
              color: "#ffffff",
              fontWeight: "600",
              cursor: "pointer",
            }}
            onClick={() => navigate("/student/dashboard")}
          >
            ← Go to Dashboard &amp; Enter Join Code
          </button>
        </div>
      ) : (
        <div className="performance-view-wrapper" style={{ marginTop: "16px" }}>
          {selectedClassroomId && (
            <StudentPerformanceView
              key={selectedClassroomId}
              classroomId={selectedClassroomId}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default StudentPerformance;