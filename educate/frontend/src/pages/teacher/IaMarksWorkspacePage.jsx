import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import toast from "react-hot-toast";
import {
  getClassroomDetails,
  getClassroomMembers,
  regenerateJoinCode,
} from "../../services/classroomService";
import ClassroomHeader from "../../components/classroom/ClassroomHeader";
import IaMarksUploadSection from "../../components/classroom/IaMarksUploadSection";
import "./ClassroomWorkspace.css";

export default function IaMarksWorkspacePage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [classroom, setClassroom] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      try {
        setLoading(true);
        const [clsData, membersData] = await Promise.all([
          getClassroomDetails(id),
          getClassroomMembers(id).catch(() => []),
        ]);
        if (active) {
          setClassroom(clsData);
          setMembers(membersData || []);
        }
      } catch (err) {
        console.error("Failed to load classroom:", err);
        if (active) toast.error("Could not load classroom details");
      } finally {
        if (active) setLoading(false);
      }
    };
    loadData();
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

  const activeMembers = members.filter((m) => (m.membershipStatus || m.status) === "ACTIVE");

  return (
    <div className="classroom-workspace-page">
      <Navbar />

      <div className="workspace-main-container">
        {loading ? (
          <div className="workspace-loading-state">
            <div className="spinner-glow"></div>
            <p>Loading IA split-up marks workspace...</p>
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
              workspaceTitle="IA Split-Up Marks Ingestion"
              onRegenerateCode={handleRegenerate}
              regenerating={regenerating}
              showJoinCode={true}
              compact={true}
            />

            <div className="tab-panel-container" style={{ padding: "28px" }}>
              <IaMarksUploadSection
                classroomId={id}
                classroomName={classroom?.name}
                enrolledStudents={activeMembers}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
