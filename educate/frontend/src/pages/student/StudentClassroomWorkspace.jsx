import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import toast from "react-hot-toast";
import { getClassroomDetails } from "../../services/classroomService";
import StudentSyllabusView from "../../components/syllabus/student/StudentSyllabusView";
import "./StudentClassrooms.css";

function StudentClassroomWorkspace() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [classroom, setClassroom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    <div className="student-classrooms-page">
      <Navbar />

      <div className="student-classrooms-container">
        {/* BACK BUTTON */}
        <button
          type="button"
          className="ssm-subtab-btn"
          style={{
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            marginBottom: 20,
            color: "#94a3b8",
          }}
          onClick={() => navigate("/student/classrooms")}
        >
          ← Back to My Classrooms
        </button>

        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading course workspace...</p>
          </div>
        ) : error || !classroom ? (
          <div className="empty-state-card">
            <h3>Classroom Not Found</h3>
            <p>{error || "We could not find the requested classroom. You might not be enrolled yet."}</p>
            <button className="btn-join-first" onClick={() => navigate("/student/classrooms")}>
              Back to Enrolled Classrooms
            </button>
          </div>
        ) : (
          <>
            {/* HERO CARD */}
            <div
              style={{
                background: "rgba(26, 32, 58, 0.75)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: 20,
                padding: "28px 32px",
                marginBottom: 28,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 20,
                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.35)",
              }}
            >
              <div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                  <span className="subject-pill">{classroom.subjectCode}</span>
                  <span
                    style={{
                      background: "rgba(255, 255, 255, 0.06)",
                      color: "#cbd5e1",
                      fontSize: "0.78rem",
                      padding: "3px 10px",
                      borderRadius: 6,
                    }}
                  >
                    Sem {classroom.semester} • Sec {classroom.section}
                  </span>
                  <span
                    style={{
                      background: "rgba(255, 255, 255, 0.06)",
                      color: "#cbd5e1",
                      fontSize: "0.78rem",
                      padding: "3px 10px",
                      borderRadius: 6,
                    }}
                  >
                    {classroom.department}
                  </span>
                  <span className="enrolled-badge">✓ ENROLLED</span>
                </div>

                <h1 style={{ fontSize: "1.85rem", fontWeight: 800, margin: "0 0 4px 0", color: "#ffffff" }}>
                  {classroom.name}
                </h1>
                <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.95rem" }}>
                  {classroom.subjectName} • Academic Year {classroom.academicYear} • Faculty: {classroom.teacherName || "Instructor"}
                </p>
              </div>
            </div>

            {/* STUDENT SYLLABUS & REVISION WORKSPACE */}
            <StudentSyllabusView classroomId={id} />
          </>
        )}
      </div>
    </div>
  );
}

export default StudentClassroomWorkspace;
