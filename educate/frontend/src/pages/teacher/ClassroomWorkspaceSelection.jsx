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

            {/* THREE INDEPENDENT WORKSPACE CARDS */}
            <div className="workspace-selection-header">
              <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#F3F4F6", margin: "0 0 6px 0" }}>
                Select Workspace
              </h2>
              <p style={{ color: "#9CA3AF", fontSize: "0.95rem", margin: 0 }}>
                Choose an independent workspace below to manage classroom members, track curriculum syllabus, or build teaching schedules.
              </p>
            </div>

            <div className="workspace-selection-grid" style={{ marginTop: "20px" }}>
              {/* CARD 1: CLASSROOM MANAGEMENT */}
              <div className="workspace-entry-card" id="card-classroom-management">
                <div className="workspace-entry-icon" style={{ background: "rgba(167, 139, 250, 0.12)" }}>
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/>
                    <path d="M6 6h10"/>
                    <path d="M6 10h10"/>
                    <path d="M6 14h6"/>
                  </svg>
                </div>
                <div className="workspace-entry-badge">Administrative</div>
                <h3 className="workspace-entry-title">Classroom Management</h3>
                <p className="workspace-entry-desc">
                  Manage enrolled students, join requests, roster imports, membership and classroom access.
                </p>
                <div className="workspace-entry-footer">
                  <button
                    type="button"
                    className="workspace-entry-btn"
                    id="btn-open-workspace-management"
                    onClick={() => navigate(`/teacher/classrooms/${id}/management`)}
                  >
                    Open Workspace →
                  </button>
                </div>
              </div>

              {/* CARD 2: SYLLABUS SCHEDULING */}
              <div className="workspace-entry-card" id="card-syllabus-scheduling">
                <div className="workspace-entry-icon" style={{ background: "rgba(167, 139, 250, 0.12)" }}>
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
                    <line x1="16" x2="16" y1="2" y2="6"/>
                    <line x1="8" x2="8" y1="2" y2="6"/>
                    <line x1="3" x2="21" y1="10" y2="10"/>
                  </svg>
                </div>
                <div className="workspace-entry-badge">Operations & Pacing</div>
                <h3 className="workspace-entry-title">Syllabus Scheduling</h3>
                <p className="workspace-entry-desc">
                  Upload planning documents, extract and review information, verify inputs, generate schedules, manage learning resources and record teaching outcomes.
                </p>
                <div className="workspace-entry-footer">
                  <button
                    type="button"
                    className="workspace-entry-btn"
                    id="btn-open-workspace-syllabus-scheduling"
                    onClick={() => navigate(`/teacher/classrooms/${id}/syllabus-scheduling`)}
                  >
                    Open Workspace →
                  </button>
                </div>
              </div>

              {/* CARD 3: SYLLABUS TRACKING */}
              <div className="workspace-entry-card" id="card-syllabus-tracking">
                <div className="workspace-entry-icon" style={{ background: "rgba(167, 139, 250, 0.12)" }}>
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                  </svg>
                </div>
                <div className="workspace-entry-badge">Curriculum & Analytics</div>
                <h3 className="workspace-entry-title">Syllabus Tracking</h3>
                <p className="workspace-entry-desc">
                  Manage syllabus topics, units, versions, publication, student revision progress, assessments, analytics and reports.
                </p>
                <div className="workspace-entry-footer">
                  <button
                    type="button"
                    className="workspace-entry-btn"
                    id="btn-open-workspace-syllabus-tracking"
                    onClick={() => navigate(`/teacher/classrooms/${id}/syllabus-tracking`)}
                  >
                    Open Workspace →
                  </button>
                </div>
              </div>

              {/* CARD 4: EVALUATION SCHEME */}
              <div className="workspace-entry-card" id="card-evaluation-scheme">
                <div className="workspace-entry-icon" style={{ background: "rgba(167, 139, 250, 0.12)" }}>
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                </div>
                <div className="workspace-entry-badge">Evaluation & Scaling</div>
                <h3 className="workspace-entry-title">Evaluation Scheme</h3>
                <p className="workspace-entry-desc">
                  Configure IA weightages, assignment thresholds, lab scaling (IPCC vs Pure Theory), and semester-end exam passing rules.
                </p>
                <div className="workspace-entry-footer">
                  <button
                    type="button"
                    className="workspace-entry-btn"
                    id="btn-open-workspace-evaluation-scheme"
                    onClick={() => navigate(`/teacher/classrooms/${id}/evaluation-scheme`)}
                  >
                    Open Workspace →
                  </button>
                </div>
              </div>

              {/* CARD 5: IA SPLIT-UP MARKS & MODULE MAPPER */}
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
                <div className="workspace-entry-badge" style={{ color: "#38BDF8", borderColor: "rgba(56, 189, 248, 0.3)" }}>Academic Intelligence</div>
                <h3 className="workspace-entry-title">IA Split-Up Marks Ingestion</h3>
                <p className="workspace-entry-desc">
                  Download enrolled student Excel templates, ingest question-wise IA sub-marks (1a, 1b.. 4b), and automatically map scores to module mastery.
                </p>
                <div className="workspace-entry-footer">
                  <button
                    type="button"
                    className="workspace-entry-btn"
                    id="btn-open-workspace-ia-marks"
                    onClick={() => navigate(`/teacher/classrooms/${id}/ia-marks`)}
                  >
                    Open Workspace →
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
