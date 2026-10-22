import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../../components/Navbar";
import toast from "react-hot-toast";
import {
  getClassroomDetails,
  regenerateJoinCode,
} from "../../services/classroomService";
import ClassroomHeader from "../../components/classroom/ClassroomHeader";
import TeacherClassAnalyticsView from "../../components/classroom/TeacherClassAnalyticsView";
import TeacherRiskWatchlistView from "../../components/classroom/TeacherRiskWatchlistView";
import "./ClassroomWorkspace.css";

export default function ClassPerformanceWorkspacePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [classroom, setClassroom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  // Tab: "analytics" (Step 3: 4-Level Analytics) | "risk" (Step 4: AI Risk Watchlist & XAI)
  const urlTab = searchParams.get("tab") || "analytics";
  const [activeTab, setActiveTab] = useState(
    ["analytics", "risk"].includes(urlTab) ? urlTab : "analytics"
  );

  useEffect(() => {
    if (urlTab && ["analytics", "risk"].includes(urlTab)) {
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
            <p>Loading performance &amp; risk analytics...</p>
          </div>
        ) : !classroom ? (
          <div className="workspace-error-card">
            <h3>Classroom Not Found</h3>
            <p>The requested classroom could not be found or you do not have permission.</p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => navigate(`/teacher/classrooms/${id}`)}
            >
              Return to Workspace
            </button>
          </div>
        ) : (
          <>
            {/* COMPACT STICKY CLASSROOM HEADER */}
            <ClassroomHeader
              classroom={classroom}
              backLabel="← Back to Workspace"
              onBack={() => navigate(`/teacher/classrooms/${id}`)}
              secondaryBackLabel="Classrooms"
              onSecondaryBack={() => navigate("/teacher/classrooms")}
              workspaceTitle="Class Performance & AI Risk (XAI)"
              onRegenerateCode={handleRegenerate}
              regenerating={regenerating}
              showJoinCode={true}
              compact={true}
            />

            {/* TAB SELECTOR: STEP 3 vs STEP 4 */}
            <div className="tab-panel-container" style={{ padding: "28px" }}>
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
                  className={`subtab-btn ${activeTab === "analytics" ? "active" : ""}`}
                  onClick={() => handleTabChange("analytics")}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "10px",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    cursor: "pointer",
                  }}
                >
                  🎯 Step 3: 4-Level Performance Analytics
                </button>
                <button
                  type="button"
                  className={`subtab-btn ${activeTab === "risk" ? "active" : ""}`}
                  onClick={() => handleTabChange("risk")}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "10px",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    cursor: "pointer",
                  }}
                >
                  🚨 Step 4: AI Risk Watchlist &amp; XAI
                </button>
              </div>

              {/* STEP 3: 4-LEVEL PERFORMANCE ANALYTICS */}
              {activeTab === "analytics" && (
                <TeacherClassAnalyticsView
                  classroomId={id}
                  classroomName={classroom?.name}
                />
              )}

              {/* STEP 4: AI RISK WATCHLIST & EXPLAINABLE AI */}
              {activeTab === "risk" && (
                <TeacherRiskWatchlistView
                  classroomId={id}
                  classroomName={classroom?.name}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
