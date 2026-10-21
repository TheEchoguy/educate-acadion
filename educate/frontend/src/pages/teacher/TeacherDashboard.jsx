import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import { getTeacherOverview } from "../../services/syllabusService";
import {
  getTeacherClassrooms,
  createClassroom,
  updateClassroom,
  deleteClassroom,
  regenerateJoinCode,
} from "../../services/classroomService";
import toast from "react-hot-toast";
import FloatingChatbotWidget from "../../components/classroom/FloatingChatbotWidget";
import "./TeacherDashboard.css";

import imgPapers from "@media/images/topics/teacher_papers.jpg";

function TeacherDashboard() {
  const navigate = useNavigate();
  const [syllabusOverview, setSyllabusOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  // Classrooms State
  const [classrooms, setClassrooms] = useState([]);
  const [loadingClassrooms, setLoadingClassrooms] = useState(true);
  const [openSettingsId, setOpenSettingsId] = useState(null);

  // Create Classroom Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingClassroom, setCreatingClassroom] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    name: "",
    courseCode: "BCS701",
    subjectName: "",
    subjectCode: "BCS701",
    department: "",
    semester: 7,
    section: "A",
    academicBatch: "2022-2026",
    academicYear: "2025-2026",
  });

  // Edit Classroom Modal
  const [editClassroom, setEditClassroom] = useState(null);
  const [updatingClassroom, setUpdatingClassroom] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: "",
    courseCode: "",
    subjectName: "",
    subjectCode: "",
    semester: 7,
    section: "A",
  });

  // Delete Classroom Modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingClassroom, setDeletingClassroom] = useState(false);

  const teacherName = sessionStorage.getItem("name") || localStorage.getItem("name") || "Faculty";
  const teacherDept = sessionStorage.getItem("department") || localStorage.getItem("department") || "Academic Department";

  useEffect(() => {
    loadClassrooms();
  }, []);

  const loadClassrooms = async () => {
    try {
      setLoadingClassrooms(true);
      const data = await getTeacherClassrooms();
      setClassrooms(data || []);
    } catch (err) {
      console.error("Failed to load teacher classrooms:", err);
      toast.error(err.response?.data?.message || "Failed to load classrooms");
    } finally {
      setLoadingClassrooms(false);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createFormData.name.trim() || !createFormData.subjectName.trim() || !createFormData.subjectCode.trim()) {
      toast.error("Please fill in course name, subject name, and subject code");
      return;
    }

    try {
      setCreatingClassroom(true);
      const payload = {
        ...createFormData,
        courseCode: createFormData.courseCode || createFormData.subjectCode,
        department: teacherDept,
      };
      const res = await createClassroom(payload);
      toast.success(
        res.joinCode
          ? `Classroom '${res.name}' created! Join Code: ${res.joinCode}`
          : `Classroom '${res.name}' created successfully!`
      );
      setShowCreateModal(false);
      setCreateFormData({
        name: "",
        courseCode: "BCS701",
        subjectName: "",
        subjectCode: "BCS701",
        department: teacherDept,
        semester: 7,
        section: "A",
        academicBatch: "2022-2026",
        academicYear: "2025-2026",
      });
      loadClassrooms();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to create classroom");
    } finally {
      setCreatingClassroom(false);
    }
  };

  const handleOpenEdit = (cls, e) => {
    e.stopPropagation();
    setOpenSettingsId(null);
    setEditClassroom(cls);
    setEditFormData({
      name: cls.name || "",
      courseCode: cls.courseCode || cls.subjectCode || "BCS701",
      subjectName: cls.subjectName || cls.name || "",
      subjectCode: cls.subjectCode || cls.courseCode || "BCS701",
      semester: cls.semester || 7,
      section: cls.section || "A",
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editClassroom) return;

    try {
      setUpdatingClassroom(true);
      const payload = {
        ...editFormData,
        courseCode: editFormData.courseCode || editFormData.subjectCode,
        subjectCode: editFormData.subjectCode || editFormData.courseCode,
      };
      const updated = await updateClassroom(editClassroom.id, payload);
      toast.success(`Classroom '${updated.name}' updated successfully!`);
      setEditClassroom(null);
      loadClassrooms();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to update classroom details");
    } finally {
      setUpdatingClassroom(false);
    }
  };

  const handleRegenerateCode = async (cls, e) => {
    e.stopPropagation();
    setOpenSettingsId(null);
    if (!window.confirm(`Regenerate join code for '${cls.name}'? Existing join code will be invalidated.`)) {
      return;
    }
    try {
      const res = await regenerateJoinCode(cls.id);
      toast.success(`New Join Code generated: ${res.joinCode || "Updated"}`);
      loadClassrooms();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to regenerate join code");
    }
  };

  const handleOpenDelete = (cls, e) => {
    e.stopPropagation();
    setOpenSettingsId(null);
    setDeleteTarget(cls);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeletingClassroom(true);
      await deleteClassroom(deleteTarget.id);
      toast.success(`Classroom '${deleteTarget.name}' deleted successfully`);
      setDeleteTarget(null);
      loadClassrooms();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to delete classroom");
    } finally {
      setDeletingClassroom(false);
    }
  };

  const toggleSettingsDropdown = (id, e) => {
    e.stopPropagation();
    setOpenSettingsId((prev) => (prev === id ? null : id));
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = () => setOpenSettingsId(null);
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  // Load cross-classroom syllabus overview
  useEffect(() => {
    let active = true;
    getTeacherOverview()
      .then((data) => {
        if (active) {
          setSyllabusOverview(data || null);
          setOverviewLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load cross-classroom syllabus overview", err);
        if (active) {
          setSyllabusOverview(null);
          setOverviewLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="teacher-dashboard-page">
      <Navbar />

      <div className="dashboard-container">
        {/* TOP WELCOME HEADER */}
        <div className="clean-welcome-header">
          <div className="welcome-text-side">
            <span className="role-pill-purple">👨‍🏫 Faculty &amp; Teaching Portal</span>
            <h1>
              Welcome back, <span className="highlight-text">{teacherName}</span> 👋
            </h1>
            <p className="subtext">
              Manage your assigned course classrooms, configure exam blueprints &amp; evaluation schemes, and launch cross-course AI tools.
            </p>
          </div>
          <div className="user-chips-side">
            <span className="clean-meta-chip">Department: {teacherDept}</span>
          </div>
        </div>

        {/* SECTION 1: MY ACTIVE CLASSROOMS GRID */}
        <div className="dashboard-section-header">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span className="section-pill-tag">ACADEMIC SECTIONS</span>
              <span className="section-count-tag">{classrooms.length} Active</span>
            </div>
            <h2>🏫 My Active Classrooms</h2>
            <p>Select any classroom workspace to manage enrolled students, track syllabus progress, ingest IA sub-marks, or view AI risk watchlists.</p>
          </div>

          <button
            type="button"
            className="create-classroom-btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <span>+</span> Create New Classroom
          </button>
        </div>

        {loadingClassrooms ? (
          <div className="classrooms-loading-state">
            <div className="spinner-glow" />
            <p>Loading your active teaching classrooms...</p>
          </div>
        ) : classrooms.length === 0 ? (
          <div className="no-classrooms-card">
            <div className="empty-icon">🏛️</div>
            <h3>No Active Classrooms Found</h3>
            <p>You haven't created any classroom workspaces yet. Click "+ Create New Classroom" to get started with your teaching section.</p>
            <button
              type="button"
              className="create-classroom-btn-primary"
              style={{ marginTop: 16 }}
              onClick={() => setShowCreateModal(true)}
            >
              + Create Your First Classroom
            </button>
          </div>
        ) : (
          <div className="classrooms-cards-grid">
            {classrooms.map((cls) => {
              const enrolledCount = cls.activeMemberCount || (cls.enrolledStudents ? cls.enrolledStudents.length : 0);
              const courseCode = cls.courseCode || cls.subjectCode || "COURSE";
              const semSec = `Sem ${cls.semester || "—"} - Sec ${cls.section || "A"}`;

              return (
                <div
                  key={cls.id}
                  className="dashboard-classroom-card"
                  onClick={() => navigate(`/teacher/classrooms/${cls.id}`)}
                >
                  {/* Top Bar with Code Pill, Status, & Settings Dropdown */}
                  <div className="card-top-row">
                    <span className="course-code-pill">{courseCode}</span>

                    <div className="card-top-actions" onClick={(e) => e.stopPropagation()}>
                      <span className={`status-badge-inline status-${cls.status?.toLowerCase() || "active"}`}>
                        {cls.status || "ACTIVE"}
                      </span>

                      <div className="settings-menu-container">
                        <button
                          type="button"
                          className="settings-gear-btn"
                          title="Classroom Actions & Settings"
                          onClick={(e) => toggleSettingsDropdown(cls.id, e)}
                        >
                          ⚙️
                        </button>

                        {openSettingsId === cls.id && (
                          <div className="settings-dropdown-menu">
                            <button
                              type="button"
                              className="dropdown-item"
                              onClick={(e) => handleOpenEdit(cls, e)}
                            >
                              ✏️ Edit Details
                            </button>
                            <button
                              type="button"
                              className="dropdown-item"
                              onClick={(e) => handleRegenerateCode(cls, e)}
                            >
                              🔄 Regenerate Join Code
                            </button>
                            <button
                              type="button"
                              className="dropdown-item delete-item"
                              onClick={(e) => handleOpenDelete(cls, e)}
                            >
                              🗑️ Delete Classroom
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Course Name & Title */}
                  <h3 className="classroom-course-name">{cls.name || cls.subjectName}</h3>
                  {cls.subjectName && cls.subjectName !== cls.name && (
                    <p className="classroom-subject-sub">{cls.subjectName}</p>
                  )}

                  {/* Sem & Section + Dept Meta */}
                  <div className="classroom-meta-pills">
                    <span className="meta-pill-dark">{semSec}</span>
                    <span className="meta-pill-dark">{cls.department || teacherDept}</span>
                    {cls.academicBatch && (
                      <span className="meta-pill-dark">{cls.academicBatch}</span>
                    )}
                  </div>

                  {/* Join Code Box */}
                  {cls.joinCode && (
                    <div
                      className="dashboard-join-code-row"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(cls.joinCode);
                        toast.success(`Copied Join Code: ${cls.joinCode}`);
                      }}
                      title="Click to copy join code"
                    >
                      <span className="join-code-label">Join Code:</span>
                      <strong className="join-code-val">{cls.joinCode}</strong>
                      <span className="copy-icon">📋</span>
                    </div>
                  )}

                  {/* Footer with Enrolled Count & Open Workspace CTA */}
                  <div className="dashboard-card-footer">
                    <div className="enrolled-stat">
                      👥 <strong>{enrolledCount}</strong> Enrolled
                    </div>
                    <span className="open-workspace-cta">Open Workspace →</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* SECTION 2: STANDALONE CROSS-COURSE TOOLS */}
        <div className="dashboard-section-header" style={{ marginTop: 48 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span className="section-pill-tag purple">CROSS-COURSE TOOLS</span>
            </div>
            <h2>🛠️ Standalone Teaching Tools</h2>
            <p>Access global, cross-course faculty engines for question paper parsing, evaluation, and AI slide generation.</p>
          </div>
        </div>

        <div className="standalone-tools-grid">
          {/* Tool Card 1: Question Papers & Evaluation Studio */}
          <div
            className="standalone-tool-card border-purple"
            onClick={() => navigate("/teacher/papers")}
          >
            <div className="tool-card-head">
              <span className="tool-badge purple">PAPERS &amp; EVALUATION</span>
              <span className="tool-arrow">→</span>
            </div>
            <h3>📝 Question Papers &amp; Evaluation Studio</h3>
            <p>
              Upload and parse examination papers, manage question banks, configure practice paper permissions, and evaluate student test submissions.
            </p>
            <div className="tool-meta-row">
              <span>• PDF/Image Parsing</span>
              <span>• Practice Permissions</span>
              <span>• Answer Evaluation</span>
            </div>
          </div>

          {/* Tool Card 2: AI PPT Generator & Studio */}
          <div
            className="standalone-tool-card border-cyan"
            onClick={() => navigate("/teacher/ppt-generator")}
          >
            <div className="tool-card-head">
              <span className="tool-badge cyan">AI PPT STUDIO</span>
              <span className="tool-arrow">→</span>
            </div>
            <h3>✨ AI PPT Generator &amp; Studio</h3>
            <p>
              Generate structured, syllabus-grounded slide decks from course notes with interactive visual editing and PPTX export.
            </p>
            <div className="tool-meta-row">
              <span>• Syllabus-Grounded Slide Generation</span>
              <span>• Visual Slide Canvas Editor</span>
              <span>• Direct Widescreen PPTX Export</span>
            </div>
          </div>

          {/* Tool Card 3: AI MCQ Quiz Generator */}
          <div
            className="standalone-tool-card border-purple"
            onClick={() => navigate("/teacher/quiz-generator")}
          >
            <div className="tool-card-head">
              <span className="tool-badge purple">MCQ QUIZ GENERATOR</span>
              <span className="tool-arrow">→</span>
            </div>
            <h3>🎯 AI MCQ Quiz Generator</h3>
            <p>
              Generate academic quizzes from topics or notes with OpenRouter AI, review &amp; publish for student practice.
            </p>
            <div className="tool-meta-row">
              <span>• Topic &amp; Notes AI</span>
              <span>• Live Review &amp; Publish</span>
            </div>
          </div>
        </div>

        {/* CREATE CLASSROOM MODAL */}
        {showCreateModal && (
          <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
            <div className="dashboard-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>+ Create New Classroom</h2>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setShowCreateModal(false)}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="dashboard-form">
                <div className="form-group">
                  <label>Course / Classroom Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Internet of Things"
                    value={createFormData.name}
                    onChange={(e) =>
                      setCreateFormData({
                        ...createFormData,
                        name: e.target.value,
                        subjectName: createFormData.subjectName || e.target.value,
                      })
                    }
                    required
                  />
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>Course / Subject Code *</label>
                    <input
                      type="text"
                      placeholder="e.g. BCS701"
                      value={createFormData.subjectCode}
                      onChange={(e) =>
                        setCreateFormData({
                          ...createFormData,
                          subjectCode: e.target.value,
                          courseCode: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Subject Full Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Internet of Things"
                      value={createFormData.subjectName}
                      onChange={(e) =>
                        setCreateFormData({ ...createFormData, subjectName: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>Semester (1–8) *</label>
                    <select
                      value={createFormData.semester}
                      onChange={(e) =>
                        setCreateFormData({
                          ...createFormData,
                          semester: parseInt(e.target.value) || 1,
                        })
                      }
                      required
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                        <option key={s} value={s}>
                          Semester {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Section *</label>
                    <input
                      type="text"
                      placeholder="e.g. A, B, or C"
                      value={createFormData.section}
                      onChange={(e) =>
                        setCreateFormData({ ...createFormData, section: e.target.value.toUpperCase() })
                      }
                      required
                    />
                  </div>
                </div>

                <div className="modal-actions-row">
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-submit-primary"
                    disabled={creatingClassroom}
                  >
                    {creatingClassroom ? "Creating Classroom..." : "Create Classroom"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* EDIT CLASSROOM MODAL */}
        {editClassroom && (
          <div className="modal-backdrop" onClick={() => setEditClassroom(null)}>
            <div className="dashboard-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>✏️ Edit Classroom Details</h2>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setEditClassroom(null)}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="dashboard-form">
                <div className="form-group">
                  <label>Course / Classroom Name *</label>
                  <input
                    type="text"
                    value={editFormData.name}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, name: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>Course Code *</label>
                    <input
                      type="text"
                      value={editFormData.courseCode}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          courseCode: e.target.value,
                          subjectCode: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Subject Name *</label>
                    <input
                      type="text"
                      value={editFormData.subjectName}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, subjectName: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>Semester *</label>
                    <select
                      value={editFormData.semester}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          semester: parseInt(e.target.value) || 1,
                        })
                      }
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                        <option key={s} value={s}>
                          Semester {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Section *</label>
                    <input
                      type="text"
                      value={editFormData.section}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, section: e.target.value.toUpperCase() })
                      }
                      required
                    />
                  </div>
                </div>

                <div className="modal-actions-row">
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={() => setEditClassroom(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-submit-primary"
                    disabled={updatingClassroom}
                  >
                    {updatingClassroom ? "Saving Changes..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* DELETE CONFIRMATION MODAL */}
        {deleteTarget && (
          <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
            <div className="dashboard-modal-card delete-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>🗑️ Delete Classroom</h2>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setDeleteTarget(null)}
                >
                  ✕
                </button>
              </div>

              <div style={{ padding: "16px 0", color: "#E2E8F0", lineHeight: 1.6 }}>
                <p>
                  Are you sure you want to delete classroom{" "}
                  <strong style={{ color: "#F87171" }}>'{deleteTarget.name}'</strong> (
                  {deleteTarget.courseCode || deleteTarget.subjectCode})?
                </p>
                <p style={{ fontSize: "0.88rem", color: "#94A3B8" }}>
                  This will remove the classroom workspace, member records, and associated configurations. This action cannot be undone.
                </p>
              </div>

              <div className="modal-actions-row">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setDeleteTarget(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-submit-delete"
                  disabled={deletingClassroom}
                  onClick={handleConfirmDelete}
                >
                  {deletingClassroom ? "Deleting..." : "Yes, Delete Classroom"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CROSS-CLASSROOM SYLLABUS OVERVIEW */}
        <div className="syllabus-cross-overview-section" style={{ marginTop: 48 }}>
          <div className="grid-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span className="card-badge purple">ACADEMIC DELIVERY</span>
                <span style={{ fontSize: "0.78rem", color: "#94a3b8", fontWeight: 600 }}>SYLLABUS TRACKING</span>
              </div>
              <h2>Classroom Syllabus &amp; Curriculum Delivery</h2>
              <p>Cross-classroom curriculum coverage, topic delivery progress, and student revision participation across your active courses.</p>
            </div>

            {syllabusOverview && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <div className="clean-meta-chip">
                  Managed: <strong>{syllabusOverview.totalManagedClassrooms ?? 0} Classrooms</strong>
                </div>
                <div className="clean-meta-chip">
                  Topics: <strong>{syllabusOverview.totalSyllabusTopics ?? 0} Total</strong>
                </div>
                <div className="clean-meta-chip" style={{ color: "#38bdf8", borderColor: "rgba(56, 189, 248, 0.3)" }}>
                  Avg Coverage: <strong>{Number(syllabusOverview.overallAverageCoverage || 0).toFixed(1)}%</strong>
                </div>
              </div>
            )}
          </div>

          {overviewLoading ? (
            <div style={{ padding: "32px", textAlign: "center", color: "#64748b", background: "rgba(15, 23, 42, 0.4)", borderRadius: 16, border: "1px solid rgba(255, 255, 255, 0.06)" }}>
              Loading syllabus monitoring metrics...
            </div>
          ) : !syllabusOverview || !syllabusOverview.classrooms || syllabusOverview.classrooms.length === 0 ? (
            <div
              style={{
                background: "rgba(15, 23, 42, 0.6)",
                border: "1px dashed rgba(255, 255, 255, 0.12)",
                borderRadius: 18,
                padding: "36px 24px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "2rem", marginBottom: 8 }}>📖</div>
              <h4 style={{ margin: "0 0 6px 0", color: "#f8fafc", fontSize: "1.1rem" }}>No Classroom Syllabus Data Available</h4>
              <p style={{ margin: "0 0 16px 0", color: "#64748b", fontSize: "0.88rem" }}>
                Classrooms you create in the Classroom Hub will display live curriculum coverage, topic schedules, and student revision metrics here.
              </p>
              <button
                type="button"
                className="launch-btn purple"
                style={{ display: "inline-flex", padding: "8px 20px" }}
                onClick={() => navigate("/teacher/classrooms")}
              >
                <span>Go to Classroom Hub</span>
                <span className="arrow">→</span>
              </button>
            </div>
          ) : (
            <div className="clean-modules-grid">
              {syllabusOverview.classrooms.map((cls) => (
                <div
                  key={cls.classroomId}
                  className="clean-grid-card border-purple"
                  onClick={() => navigate(`/teacher/classrooms/${cls.classroomId}?tab=syllabus`, { state: { tab: "syllabus" } })}
                  style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 14 }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div className="card-top-bar">
                      <span className="card-badge purple">
                        {cls.subjectCode ? cls.subjectCode : "CLASSROOM"}
                      </span>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 8,
                          background: cls.currentVersionNumber ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                          color: cls.currentVersionNumber ? "#34d399" : "#fbbf24",
                          border: `1px solid ${cls.currentVersionNumber ? "rgba(16, 185, 129, 0.3)" : "rgba(245, 158, 11, 0.3)"}`,
                        }}
                      >
                        {cls.currentVersionNumber ? `v${cls.currentVersionNumber} Published` : "Draft"}
                      </span>
                    </div>

                    <h3 style={{ fontSize: "1.1rem", margin: "4px 0 0 0" }}>{cls.classroomName}</h3>
                    {cls.subjectName && (
                      <p style={{ fontSize: "0.82rem", color: "#94a3b8" }}>{cls.subjectName}</p>
                    )}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "6px 0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "#cbd5e1" }}>
                      <span>Teaching Coverage</span>
                      <strong style={{ color: "#38bdf8" }}>{Number(cls.coveragePercentage || 0).toFixed(1)}%</strong>
                    </div>
                    <div
                      style={{
                        width: "100%",
                        height: 6,
                        background: "rgba(255, 255, 255, 0.08)",
                        borderRadius: 3,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(100, Math.max(0, cls.coveragePercentage || 0))}%`,
                          height: "100%",
                          background: "linear-gradient(90deg, #a855f7, #38bdf8)",
                          borderRadius: 3,
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", fontSize: "0.74rem" }}>
                    <span style={{ background: "rgba(255,255,255,0.05)", padding: "3px 8px", borderRadius: 6, color: "#94a3b8" }}>
                      {cls.completedTopics || 0}/{cls.topicCount || 0} Topics
                    </span>
                    {cls.overdueTopicsCount > 0 && (
                      <span style={{ background: "rgba(239, 68, 68, 0.15)", color: "#f87171", padding: "3px 8px", borderRadius: 6 }}>
                        ⚠️ {cls.overdueTopicsCount} Overdue
                      </span>
                    )}
                    {cls.upcomingTopicsCount > 0 && (
                      <span style={{ background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", padding: "3px 8px", borderRadius: 6 }}>
                        📅 {cls.upcomingTopicsCount} Upcoming
                      </span>
                    )}
                  </div>

                  <div className="card-footer-meta" style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <span>
                      {cls.enrolledStudentsCount > 0
                        ? `${cls.participatingStudentsCount || 0}/${cls.enrolledStudentsCount} revising (${cls.averageRevisionPercentage != null ? cls.averageRevisionPercentage.toFixed(0) + '%' : '0%'})`
                        : "No students enrolled"}
                    </span>
                    <span style={{ color: "#c084fc", fontWeight: 600 }}>Syllabus →</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Floating Chatbot Launch Widget */}
      <FloatingChatbotWidget targetPath="/teacher/tutor" />
    </div>
  );
}

export default TeacherDashboard;
