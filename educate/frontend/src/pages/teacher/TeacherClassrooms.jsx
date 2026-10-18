import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import toast from "react-hot-toast";
import { getTeacherClassrooms, createClassroom } from "../../services/classroomService";
import "./TeacherClassrooms.css";

function TeacherClassrooms() {
  const navigate = useNavigate();
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const teacherDept = sessionStorage.getItem("department") || localStorage.getItem("department") || "Computer Science";

  const [formData, setFormData] = useState({
    name: "Internet of Things",
    courseCode: "BCS701",
    subjectName: "Internet of Things",
    subjectCode: "BCS701",
    department: teacherDept,
    semester: 7,
    section: "A",
    academicBatch: "2021-2025",
    academicYear: "2024-2025",
  });

  useEffect(() => {
    loadClassrooms();
  }, []);

  const loadClassrooms = async () => {
    try {
      setLoading(true);
      const data = await getTeacherClassrooms();
      setClassrooms(data || []);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to load classrooms");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "semester" ? parseInt(value) || 1 : value,
    }));
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.subjectName.trim() || !formData.subjectCode.trim()) {
      toast.error("Please fill in all mandatory fields");
      return;
    }

    try {
      setCreating(true);
      const res = await createClassroom(formData);
      toast.success(
        res.joinCode
          ? `Classroom '${res.name}' created! Join Code: ${res.joinCode}`
          : `Classroom '${res.name}' created successfully!`
      );
      setShowCreateModal(false);
      setFormData({
        name: "",
        subjectName: "",
        subjectCode: "",
        department: teacherDept,
        semester: 6,
        section: "A",
        academicBatch: "2022-2026",
        academicYear: "2025-2026",
      });
      loadClassrooms();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to create classroom");
    } finally {
      setCreating(false);
    }
  };

  const copyJoinCode = (e, code) => {
    e.stopPropagation();
    if (!code) return;
    navigator.clipboard.writeText(code);
    toast.success(`Copied Join Code: ${code}`);
  };

  return (
    <div className="teacher-classrooms-page">
      <Navbar />

      <div className="classrooms-main-container">
        {/* TOP BAR */}
        <div className="classrooms-header-row">
          <div>
            <span className="role-tag-purple">🏛️ Academic Management</span>
            <h1 className="page-main-title">Classroom Connection Hub</h1>
            <p className="page-sub-desc">
              Manage your teaching sections, import student rosters, verify join-code requests, and maintain student enrollments.
            </p>
          </div>

          <div className="header-actions-group">
            <button
              className="btn-create-classroom"
              onClick={() => setShowCreateModal(true)}
            >
              + Create Classroom
            </button>
          </div>
        </div>

        {/* CONTENT GRID */}
        {loading ? (
          <div className="classrooms-loading-state">
            <div className="spinner"></div>
            <p>Loading your academic classrooms...</p>
          </div>
        ) : classrooms.length === 0 ? (
          <div className="empty-classrooms-card">
            <div className="empty-icon">🏛️</div>
            <h3>No Classrooms Created Yet</h3>
            <p>Create your first classroom to begin enrolling students via CSV roster or student join codes.</p>
            <button
              className="btn-create-classroom-empty"
              onClick={() => setShowCreateModal(true)}
            >
              Create First Classroom
            </button>
          </div>
        ) : (
          <div className="classrooms-cards-grid">
            {classrooms.map((cls) => (
              <div
                key={cls.id}
                className="classroom-card"
                onClick={() => navigate(`/teacher/classrooms/${cls.id}`)}
              >
                <div className="card-top-header">
                  <span className="subject-code-pill">{cls.subjectCode}</span>
                  <span className={`status-badge status-${cls.status?.toLowerCase()}`}>
                    {cls.status}
                  </span>
                </div>

                <h3 className="classroom-name">{cls.name}</h3>
                <p className="subject-title">{cls.subjectName}</p>

                <div className="classroom-tags-row">
                  <span className="meta-tag">Sem {cls.semester} - Sec {cls.section}</span>
                  <span className="meta-tag">{cls.department}</span>
                  <span className="meta-tag">{cls.academicBatch}</span>
                </div>

                {/* JOIN CODE CLUSTER */}
                {cls.joinCode && (
                  <div className="join-code-box" onClick={(e) => copyJoinCode(e, cls.joinCode)}>
                    <div className="code-label">Join Code:</div>
                    <div className="code-value">{cls.joinCode}</div>
                    <button type="button" className="copy-icon-btn" title="Copy join code">📋</button>
                  </div>
                )}

                {/* STATS FOOTER */}
                <div className="card-stats-footer">
                  <div className="stat-pill members-stat">
                    👥 <strong>{cls.activeMemberCount || 0}</strong> Enrolled
                  </div>

                  {cls.pendingRequestCount > 0 && (
                    <div className="stat-pill pending-stat">
                      ⏳ <strong>{cls.pendingRequestCount}</strong> Pending
                    </div>
                  )}

                  <div className="card-action-link">
                    Open Workspace →
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CREATE CLASSROOM MODAL */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-content-card">
            <div className="modal-header">
              <h2>Create New Classroom</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowCreateModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="create-classroom-form">
              <div className="form-group">
                <label>Classroom Name *</label>
                <input
                  type="text"
                  name="name"
                  placeholder="e.g. AI & ML 6th Sem Section A"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Subject Name *</label>
                  <input
                    type="text"
                    name="subjectName"
                    placeholder="e.g. Artificial Intelligence"
                    value={formData.subjectName}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Subject Code *</label>
                  <input
                    type="text"
                    name="subjectCode"
                    placeholder="e.g. 21CS62"
                    value={formData.subjectCode}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <div className="form-row-3">
                <div className="form-group">
                  <label>Department *</label>
                  <input
                    type="text"
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Semester *</label>
                  <select
                    name="semester"
                    value={formData.semester}
                    onChange={handleInputChange}
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
                    name="section"
                    placeholder="e.g. A"
                    value={formData.section}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Academic Batch *</label>
                  <input
                    type="text"
                    name="academicBatch"
                    placeholder="e.g. 2022-2026"
                    value={formData.academicBatch}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Academic Year *</label>
                  <input
                    type="text"
                    name="academicYear"
                    placeholder="e.g. 2025-2026"
                    value={formData.academicYear}
                    onChange={handleInputChange}
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
                  className="btn-submit"
                  disabled={creating}
                >
                  {creating ? "Creating..." : "Create Classroom"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeacherClassrooms;
