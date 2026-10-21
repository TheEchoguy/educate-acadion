import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../../components/Navbar";
import toast from "react-hot-toast";
import {
  getClassroomDetails,
  regenerateJoinCode,
} from "../../services/classroomService";
import ClassroomHeader from "../../components/classroom/ClassroomHeader";
import TeacherSyllabusManagement from "../../components/syllabus/TeacherSyllabusManagement";
import TeacherSyllabusSchedulingSection from "../../components/syllabus/TeacherSyllabusSchedulingSection";
import "./ClassroomWorkspace.css";

export default function ClassroomCurriculumWorkspacePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [classroom, setClassroom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  // Tab: "tracking" | "scheduling"
  const urlTab = searchParams.get("tab") || "tracking";
  const [activeTab, setActiveTab] = useState(
    ["tracking", "scheduling"].includes(urlTab) ? urlTab : "tracking"
  );

  useEffect(() => {
    if (urlTab && ["tracking", "scheduling"].includes(urlTab)) {
      setActiveTab(urlTab);
    }
  }, [urlTab]);

  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    setSearchParams({ tab: tabKey });
  };

  useEffect(() => {
    let active = true;
    const loadClassroom = async () => {
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
    loadClassroom();
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
            <p>Loading curriculum and delivery workspace...</p>
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
              backLabel="← Back to Workspace Selection"
              onBack={() => navigate(`/teacher/classrooms/${id}/workspaces`)}
              workspaceTitle="Classroom Syllabus & Curriculum Delivery"
              onRegenerateCode={handleRegenerate}
              regenerating={regenerating}
              showJoinCode={true}
            />

            <div className="tab-panel-container" style={{ padding: "28px" }}>
              {/* SUBTABS NAV */}
              <div
                className="management-subtabs-nav"
                style={{
                  display: "flex",
                  gap: "12px",
                  marginBottom: "24px",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                  paddingBottom: "14px",
                }}
              >
                <button
                  type="button"
                  className={`subtab-btn ${activeTab === "tracking" ? "active" : ""}`}
                  onClick={() => handleTabChange("tracking")}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "10px",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    cursor: "pointer",
                  }}
                >
                  📑 Syllabus Units &amp; Tracking
                </button>
                <button
                  type="button"
                  className={`subtab-btn ${activeTab === "scheduling" ? "active" : ""}`}
                  onClick={() => handleTabChange("scheduling")}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "10px",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    cursor: "pointer",
                  }}
                >
                  📅 Teaching Schedule &amp; Pacing
                </button>
              </div>

              {/* TAB 1: SYLLABUS MANAGEMENT */}
              {activeTab === "tracking" && (
                <TeacherSyllabusManagement
                  classroomId={id}
                  classroom={classroom}
                  onNavigateToScheduling={() => handleTabChange("scheduling")}
                />
              )}

              {/* TAB 2: TEACHING SCHEDULE */}
              {activeTab === "scheduling" && (
                <TeacherSyllabusSchedulingSection
                  classroom={classroom}
                  onNavigateToSyllabus={() => handleTabChange("tracking")}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
