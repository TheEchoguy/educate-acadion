import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import toast from "react-hot-toast";
import { getStudentClassrooms, joinClassroom } from "../../services/classroomService";
import "./StudentClassrooms.css";

function StudentClassrooms() {
  const navigate = useNavigate();
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    getStudentClassrooms()
      .then((data) => {
        if (active) {
          setClassrooms(data || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error(err);
        if (active) {
          toast.error(err.response?.data?.message || "Failed to load enrolled classrooms");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const loadStudentClassrooms = async () => {
    try {
      setLoading(true);
      const data = await getStudentClassrooms();
      setClassrooms(data || []);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to load enrolled classrooms");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinSubmit = async (e) => {
    e.preventDefault();
    const cleanCode = joinCode.trim().toUpperCase();
    if (!cleanCode) {
      toast.error("Please enter a valid classroom join code");
      return;
    }

    try {
      setSubmitting(true);
      const res = await joinClassroom(cleanCode);
      toast.success(res.message || "Join request submitted! Awaiting teacher approval.");
      setShowJoinModal(false);
      setJoinCode("");
      loadStudentClassrooms();
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.message || err.response?.data || "Failed to submit join request";
      toast.error(typeof errMsg === "string" ? errMsg : "Join request failed");
    } finally {
      setSubmitting(false);
    }
  };

  const enrolledClassrooms = classrooms.filter(
    (c) => c.studentMembershipStatus === "ACTIVE"
  );
  const pendingClassrooms = classrooms.filter(
    (c) => c.studentMembershipStatus === "PENDING"
  );

  return (
    <div className="student-classrooms-page">
      <Navbar />

      <div className="student-classrooms-container">
        {/* HEADER ROW */}
        <div className="student-header-row">
          <div>
            <span className="role-tag-blue">🎓 Student Portal</span>
            <h1 className="page-title">My Academic Classrooms</h1>
            <p className="page-subtitle">
              View your enrolled subject classrooms, connect to new classes via teacher join code, and track approval status.
            </p>
          </div>

          <button
            className="btn-open-join-modal"
            onClick={() => setShowJoinModal(true)}
          >
            + Join Classroom with Code
          </button>
        </div>

        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading your enrolled classrooms...</p>
          </div>
        ) : classrooms.length === 0 ? (
          <div className="empty-state-card">
            <div className="empty-icon">🏛️</div>
            <h3>Not Enrolled in Any Classrooms</h3>
            <p>
              Your faculty may enroll you via the institutional roster upload, or provide you with a 6-character Join Code.
            </p>
            <button
              className="btn-join-first"
              onClick={() => setShowJoinModal(true)}
            >
              Enter Classroom Join Code
            </button>
          </div>
        ) : (
          <>
            {/* SECTION 1: ACTIVE ENROLLED CLASSROOMS */}
            <div className="section-header">
              <h2>Enrolled Classrooms ({enrolledClassrooms.length})</h2>
              <span className="section-desc">Active classes where you can attend examinations and review course evaluations</span>
            </div>

            {enrolledClassrooms.length === 0 ? (
              <div className="no-active-notice">
                <p>No active classroom enrollments yet. Check pending requests below or enter a join code.</p>
              </div>
            ) : (
              <div className="classrooms-grid">
                {enrolledClassrooms.map((cls) => (
                  <div key={cls.id} className="student-class-card active-card">
                    <div className="class-card-top">
                      <span className="subject-pill">{cls.subjectCode}</span>
                      <span className="enrolled-badge">✓ ENROLLED</span>
                    </div>

                    <h3 className="card-class-name">{cls.name}</h3>
                    <p className="card-subject-name">{cls.subjectName}</p>

                    <div className="card-meta-list">
                      <div className="meta-line">
                        <span>Faculty:</span>
                        <strong>{cls.teacherName || "Faculty"}</strong>
                      </div>
                      <div className="meta-line">
                        <span>Section & Sem:</span>
                        <strong>Sem {cls.semester} • Sec {cls.section}</strong>
                      </div>
                      <div className="meta-line">
                        <span>Academic Batch:</span>
                        <strong>{cls.academicBatch}</strong>
                      </div>
                    </div>

                    <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
                      <button
                        type="button"
                        style={{
                          width: "100%",
                          background: "linear-gradient(135deg, #0284c7, #0369a1)",
                          color: "#ffffff",
                          border: "none",
                          padding: "8px 14px",
                          borderRadius: 8,
                          fontSize: "0.85rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          transition: "all 0.2s ease",
                        }}
                        onClick={() => navigate(`/student/classrooms/${cls.id}`)}
                      >
                        📖 View Syllabus & Revision
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* SECTION 2: PENDING APPROVALS */}
            {pendingClassrooms.length > 0 && (
              <div className="pending-section">
                <div className="section-header">
                  <h2>Pending Join Requests ({pendingClassrooms.length})</h2>
                  <span className="section-desc">Join requests submitted with a code awaiting faculty confirmation</span>
                </div>

                <div className="classrooms-grid">
                  {pendingClassrooms.map((cls) => (
                    <div key={cls.id} className="student-class-card pending-card">
                      <div className="class-card-top">
                        <span className="subject-pill">{cls.subjectCode}</span>
                        <span className="pending-badge">⏳ PENDING APPROVAL</span>
                      </div>

                      <h3 className="card-class-name">{cls.name}</h3>
                      <p className="card-subject-name">{cls.subjectName}</p>

                      <div className="card-meta-list">
                        <div className="meta-line">
                          <span>Faculty:</span>
                          <strong>{cls.teacherName || "Faculty"}</strong>
                        </div>
                        <div className="meta-line">
                          <span>Status:</span>
                          <strong className="pending-text">Awaiting teacher review</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* JOIN CLASSROOM MODAL */}
      {showJoinModal && (
        <div className="modal-backdrop">
          <div className="modal-content-card">
            <div className="modal-header">
              <h2>Join Academic Classroom</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowJoinModal(false)}
              >
                ✕
              </button>
            </div>

            <p className="modal-instruction">
              Enter the 6-character Join Code provided by your subject faculty. Once submitted, your request will be queued for teacher approval.
            </p>

            <form onSubmit={handleJoinSubmit} className="join-form">
              <div className="code-input-box">
                <input
                  type="text"
                  maxLength="8"
                  placeholder="e.g. AC8K2M"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  autoFocus
                  required
                />
              </div>

              <div className="modal-actions-row">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowJoinModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-submit"
                  disabled={submitting}
                >
                  {submitting ? "Submitting..." : "Submit Join Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudentClassrooms;
