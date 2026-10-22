import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import toast from "react-hot-toast";
import {
  getClassroomDetails,
  regenerateJoinCode,
} from "../../services/classroomService";
import ClassroomHeader from "../../components/classroom/ClassroomHeader";
import "./ClassroomWorkspace.css";

export default function ClassroomWorkspaceSelection() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [classroom, setClassroom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchClassroom = async () => {
      try {
        setLoading(true);
        const data = await getClassroomDetails(id);
        if (active) setClassroom(data);
      } catch (err) {
        console.error("Failed to load classroom:", err);
        if (active) toast.error("Could not load classroom details");
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchClassroom();
    return () => {
      active = false;
    };
  }, [id]);

  const handleRegenerate = async (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!window.confirm("Regenerate join code? The old code will expire immediately.")) return;
    try {
      setRegenerating(true);
      const updated = await regenerateJoinCode(id);
      setClassroom(updated);
      toast.success("Join code regenerated successfully!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to regenerate join code");
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="classroom-workspace-page">
      <Navbar />

      <div className="workspace-main-container">
        {loading ? (
          <div className="workspace-loading-state">
            <div className="spinner-glow"></div>
            <p>Loading classroom workspaces...</p>
          </div>
        ) : !classroom ? (
          <div className="workspace-error-card">
            <h3>Classroom Not Found</h3>
            <p>The requested classroom could not be found or you do not have permission.</p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => navigate("/teacher/classrooms")}
            >
              Return to Classrooms
            </button>
          </div>
        ) : (
          <>
            {/* SHARED RESPONSIVE CLASSROOM HEADER */}
            <ClassroomHeader
              classroom={classroom}
              backLabel="← Back to All Classrooms"
              onBack={() => navigate("/teacher/classrooms")}
              onRegenerateCode={handleRegenerate}
              regenerating={regenerating}
              showJoinCode={true}
            />

            {/* 5 CONSOLIDATED WORKSPACE CARDS */}
            <div className="workspace-selection-header">
              <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#F3F4F6", margin: "0 0 6px 0" }}>
                Select Workspace
              </h2>
              <p style={{ color: "#9CA3AF", fontSize: "0.95rem", margin: 0 }}>
                Choose an independent workspace below to manage students, curriculum delivery, IA marks, performance analytics, or RAG notes.
              </p>
            </div>

            <div className="workspace-selection-grid" style={{ marginTop: "20px" }}>
              {/* CARD A: CLASSROOM HUB & EVALUATION SCHEME */}
              <div className="workspace-entry-card" id="card-classroom-hub">
                <div className="workspace-entry-icon" style={{ background: "rgba(167, 139, 250, 0.12)" }}>
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/>
                    <path d="M6 6h10"/>
                    <path d="M6 10h10"/>
                    <path d="M6 14h6"/>
                  </svg>
                </div>
                <div className="workspace-entry-badge">Administrative & Scheme</div>
                <h3 className="workspace-entry-title">Classroom Hub</h3>
                <p className="workspace-entry-desc">
                  Manage enrolled student rosters, join codes, account verification, and configure CIE/SEE marks scaling rules.
                </p>
                <div className="workspace-entry-footer">
                  <button
                    type="button"
                    className="workspace-entry-btn"
                    id="btn-open-workspace-hub"
                    onClick={() => navigate(`/teacher/classrooms/${id}/management`)}
                  >
                    Open Hub →
                  </button>
                </div>
              </div>

              {/* CARD B: CLASSROOM SYLLABUS & CURRICULUM DELIVERY */}
              <div className="workspace-entry-card" id="card-classroom-curriculum">
                <div className="workspace-entry-icon" style={{ background: "rgba(59, 130, 246, 0.12)" }}>
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                  </svg>
                </div>
                <div className="workspace-entry-badge" style={{ color: "#3B82F6", borderColor: "rgba(59, 130, 246, 0.3)" }}>Curriculum & Pacing</div>
                <h3 className="workspace-entry-title">Classroom Syllabus & Curriculum Delivery</h3>
                <p className="workspace-entry-desc">
                  Merge syllabus tracking, unit progression, lecture scheduling, resource management, and teaching outcome logs.
                </p>
                <div className="workspace-entry-footer">
                  <button
                    type="button"
                    className="workspace-entry-btn"
                    id="btn-open-workspace-curriculum"
                    onClick={() => navigate(`/teacher/classrooms/${id}/curriculum`)}
                  >
                    Open Curriculum →
                  </button>
                </div>
              </div>

              {/* CARD C: IA SPLIT-UP MARKS INGESTION */}
              <div className="workspace-entry-card" id="card-ia-marks-ingestion">
                <div className="workspace-entry-icon" style={{ background: "rgba(56, 189, 248, 0.12)" }}>
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                  </svg>
                </div>
                <div className="workspace-entry-badge" style={{ color: "#38BDF8", borderColor: "rgba(56, 189, 248, 0.3)" }}>Data Ingestion</div>
                <h3 className="workspace-entry-title">IA Split-Up Marks Ingestion</h3>
                <p className="workspace-entry-desc">
                  Set exam sub-question blueprints (1a–4b), download dynamic blank marks sheets, and ingest multi-IA Excel scores.
                </p>
                <div className="workspace-entry-footer">
                  <button
                    type="button"
                    className="workspace-entry-btn"
                    id="btn-open-workspace-ia-marks"
                    onClick={() => navigate(`/teacher/classrooms/${id}/ia-marks`)}
                  >
                    Open Ingestion →
                  </button>
                </div>
              </div>

              {/* CARD D: CLASS PERFORMANCE & AI RISK WATCHLIST */}
              <div className="workspace-entry-card" id="card-class-performance">
                <div className="workspace-entry-icon" style={{ background: "rgba(239, 68, 68, 0.12)" }}>
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                  </svg>
                </div>
                <div className="workspace-entry-badge" style={{ color: "#EF4444", borderColor: "rgba(239, 68, 68, 0.3)" }}>Analytics & Risk (XAI)</div>
                <h3 className="workspace-entry-title">Class Performance & AI Risk Watchlist</h3>
                <p className="workspace-entry-desc">
                  4-Level topic-to-module mastery heatmaps, student trajectory analytics, and SHAP-explained academic risk predictions.
                </p>
                <div className="workspace-entry-footer">
                  <button
                    type="button"
                    className="workspace-entry-btn"
                    id="btn-open-workspace-performance"
                    onClick={() => navigate(`/teacher/classrooms/${id}/analytics`)}
                  >
                    Open Analytics →
                  </button>
                </div>
              </div>

              {/* CARD E: ACADEMIC NOTES & RAG AI STUDIO */}
              <div className="workspace-entry-card" id="card-academic-rag">
                <div className="workspace-entry-icon" style={{ background: "rgba(16, 185, 129, 0.12)" }}>
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 16v-4"/>
                    <path d="M12 8h.01"/>
                  </svg>
                </div>
                <div className="workspace-entry-badge" style={{ color: "#10B981", borderColor: "rgba(16, 185, 129, 0.3)" }}>Academic RAG Studio</div>
                <h3 className="workspace-entry-title">Academic Notes & RAG AI Studio</h3>
                <p className="workspace-entry-desc">
                  Upload and index Module 1–5 course lecture notes (PDFs) and launch grounded curriculum AI tutoring sessions.
                </p>
                <div className="workspace-entry-footer">
                  <button
                    type="button"
                    className="workspace-entry-btn"
                    id="btn-open-workspace-rag"
                    onClick={() => navigate(`/teacher/classrooms/${id}/rag-tutor`)}
                  >
                    Open RAG Studio →
                  </button>
                </div>
              </div>

              {/* CARD F: CLASSROOM NOTICEBOARD & RESOURCE BROADCAST */}
              <div className="workspace-entry-card" id="card-classroom-announcements">
                <div className="workspace-entry-icon" style={{ background: "rgba(59, 130, 246, 0.12)" }}>
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                  </svg>
                </div>
                <div className="workspace-entry-badge" style={{ color: "#38BDF8", borderColor: "rgba(56, 189, 248, 0.3)" }}>Broadcast & Sharing</div>
                <h3 className="workspace-entry-title">Noticeboard &amp; Resource Broadcast</h3>
                <p className="workspace-entry-desc">
                  Publish pinned course notices, exam alerts, and 1-click downloadable slide decks, notes, or assignment guidelines.
                </p>
                <div className="workspace-entry-footer">
                  <button
                    type="button"
                    className="workspace-entry-btn"
                    id="btn-open-workspace-announcements"
                    onClick={() => navigate(`/teacher/classrooms/${id}/management?subtab=announcements`)}
                  >
                    Broadcast Notice →
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
