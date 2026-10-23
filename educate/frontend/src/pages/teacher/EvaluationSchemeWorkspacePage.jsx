import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import toast from "react-hot-toast";
import {
  getClassroomDetails,
  regenerateJoinCode,
} from "../../services/classroomService";
import ClassroomHeader from "../../components/classroom/ClassroomHeader";
import EvaluationSchemeConfig from "../../components/classroom/EvaluationSchemeConfig";
import "./ClassroomWorkspace.css";

export default function EvaluationSchemeWorkspacePage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [classroom, setClassroom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

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
            <p>Loading evaluation scheme workspace...</p>
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
              workspaceTitle="Evaluation Scheme"
              onRegenerateCode={handleRegenerate}
              regenerating={regenerating}
              showJoinCode={true}
            />

            <div className="tab-panel-container" style={{ padding: "28px" }}>
              <EvaluationSchemeConfig classroomId={id} isTeacher={true} classroom={classroom} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
