import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import toast from "react-hot-toast";
import { getTeacherClassrooms } from "../../services/classroomService";
import "./TeacherClassrooms.css";

const FEATURE_CONFIGS = {
  "ia-marks": {
    badge: "DATA INGESTION",
    badgeColor: "green",
    title: "IA Split-Up Marks Ingestion",
    description: "Select a classroom to configure exam sub-question blueprints (1a–4b), download blank Excel sheets, and ingest multi-IA student marks.",
    icon: "📊",
    targetPath: "ia-marks",
    actionLabel: "Open IA Marks Ingestion →",
  },
  analytics: {
    badge: "ANALYTICS & ML RISK",
    badgeColor: "amber",
    title: "Class Performance & AI Risk Watchlist",
    description: "Select a classroom to inspect 4-level topic mastery heatmaps, module drop rates, and SHAP-explained academic risk predictions.",
    icon: "🚨",
    targetPath: "analytics",
    actionLabel: "Open Performance & Risk →",
  },
  "rag-tutor": {
    badge: "ACADEMIC RAG STUDIO",
    badgeColor: "purple",
    title: "Academic Notes & RAG AI Tutor Studio",
    description: "Select a classroom to upload Module 1–5 lecture notes (PDFs) and launch grounded curriculum AI tutoring sessions.",
    icon: "🤖",
    targetPath: "rag-tutor",
    actionLabel: "Open RAG Tutor Studio →",
  },
};

export default function ClassroomFeaturePicker({ featureKey = "ia-marks" }) {
  const navigate = useNavigate();
  const config = FEATURE_CONFIGS[featureKey] || FEATURE_CONFIGS["ia-marks"];

  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchClassrooms = async () => {
      try {
        setLoading(true);
        const data = await getTeacherClassrooms();
        if (!active) return;
        const list = data || [];
        setClassrooms(list);

        // Auto-redirect if only one classroom exists
        if (list.length === 1) {
          navigate(`/teacher/classrooms/${list[0].id}/${config.targetPath}`, { replace: true });
        }
      } catch (err) {
        console.error("Failed to load classrooms for picker", err);
        if (active) toast.error("Failed to load classrooms");
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchClassrooms();
    return () => {
      active = false;
    };
  }, [config.targetPath, navigate]);

  return (
    <div className="teacher-classrooms-page">
      <Navbar />

      <div className="classrooms-main-container">
        {/* HEADER SECTION */}
        <div className="classrooms-header-row">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span className={`status-badge-pill ${config.badgeColor || "purple"}`} style={{ padding: "4px 10px", fontSize: "0.75rem", borderRadius: 6, fontWeight: 700 }}>
                {config.badge}
              </span>
              <button
                type="button"
                className="btn-card-action"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#9ca3af", padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: "0.82rem" }}
                onClick={() => navigate("/teacher/dashboard")}
              >
                ← Back to Dashboard
              </button>
            </div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#f8fafc", margin: "4px 0 8px 0" }}>
              {config.icon} {config.title}
            </h1>
            <p style={{ color: "#94a3b8", fontSize: "0.95rem", margin: 0, maxWidth: 680 }}>
              {config.description}
            </p>
          </div>
        </div>

        {/* CONTENT */}
        {loading ? (
          <div className="classrooms-loading-state" style={{ padding: "60px 0", textAlign: "center" }}>
            <div className="spinner"></div>
            <p style={{ color: "#94a3b8", marginTop: 16 }}>Loading your classrooms...</p>
          </div>
        ) : classrooms.length === 0 ? (
          <div className="classrooms-empty-state" style={{ padding: "40px", textAlign: "center", background: "#111827", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", marginTop: 24 }}>
            <div className="empty-icon-bubble" style={{ fontSize: "2.5rem", marginBottom: 12 }}>📚</div>
            <h3 style={{ color: "#f3f4f6" }}>No Classrooms Found</h3>
            <p style={{ color: "#9ca3af", maxWidth: 440, margin: "8px auto 20px" }}>
              Please create a classroom first to access {config.title.toLowerCase()}.
            </p>
            <button
              className="btn-create-classroom-empty"
              onClick={() => navigate("/teacher/classrooms")}
              style={{ background: "#7c3aed", color: "#fff", padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600 }}
            >
              Go to Classroom Hub
            </button>
          </div>
        ) : (
          <div style={{ marginTop: 24 }}>
            <h3 style={{ color: "#cbd5e1", fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}>
              Select Classroom ({classrooms.length} Available)
            </h3>
            <div className="classrooms-cards-grid">
              {classrooms.map((cls) => (
                <div
                  key={cls.id}
                  className="classroom-card"
                  onClick={() => navigate(`/teacher/classrooms/${cls.id}/${config.targetPath}`)}
                  style={{ cursor: "pointer" }}
                >
                  <div className="card-top-header">
                    <span className="subject-code-pill">{cls.courseCode || cls.subjectCode}</span>
                    <span className={`status-badge status-${cls.status?.toLowerCase()}`}>
                      {cls.status}
                    </span>
                  </div>

                  <h3 className="classroom-name">{cls.name}</h3>
                  <p className="subject-title">{cls.subjectName}</p>

                  <div className="classroom-tags-row">
                    <span className="meta-tag">Sem {cls.semester} - Sec {cls.section}</span>
                    <span className="meta-tag">{cls.department}</span>
                  </div>

                  <div className="card-stats-footer" style={{ marginTop: 18 }}>
                    <div className="stat-pill members-stat">
                      👥 <strong>{cls.activeMemberCount || 0}</strong> Enrolled
                    </div>
                    <div className="card-action-link" style={{ color: "#a78bfa", fontWeight: 600 }}>
                      {config.actionLabel}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
