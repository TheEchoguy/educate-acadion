import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import toast from "react-hot-toast";
import {
  getTeacherClassrooms,
  createClassroom,
  updateClassroom,
  deleteClassroom,
} from "../../services/classroomService";
import "./TeacherClassrooms.css";

function TeacherClassrooms() {
  const navigate = useNavigate();
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  // Edit modal states
  const [editClassroom, setEditClassroom] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: "",
    courseCode: "",
    subjectName: "",
    subjectCode: "",
    department: "",
    semester: 7,
    section: "A",
    academicBatch: "",
    academicYear: "",
    status: "ACTIVE",
    joinCodeEnabled: true,
  });

  // Delete modal states
  const [deleteModalClassroom, setDeleteModalClassroom] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const teacherDept = sessionStorage.getItem("department") || localStorage.getItem("department") || "Computer Science & Engineering";

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

  const handleEditInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : name === "semester" ? parseInt(value) || 1 : value,
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
      setCreating(false);
    }
  };

  const handleEditOpen = (cls, e) => {
    e.stopPropagation();
    setEditClassroom(cls);
    setEditFormData({
      name: cls.name || "",
      courseCode: cls.courseCode || cls.subjectCode || "BCS701",
      subjectName: cls.subjectName || cls.name || "",
      subjectCode: cls.subjectCode || cls.courseCode || "BCS701",
      department: cls.department || teacherDept,
      semester: cls.semester || 7,
      section: cls.section || "A",
      academicBatch: cls.academicBatch || "2022-2026",
      academicYear: cls.academicYear || "2025-2026",
      status: cls.status || "ACTIVE",
      joinCodeEnabled: cls.joinCodeEnabled !== false,
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editClassroom) return;

    try {
      setUpdating(true);
      const updated = await updateClassroom(editClassroom.id, editFormData);
      toast.success(`Classroom '${updated.name}' settings updated successfully!`);
      setEditClassroom(null);
      loadClassrooms();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to update classroom settings");
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteOpen = (cls, e) => {
    e.stopPropagation();
    setDeleteModalClassroom(cls);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModalClassroom) return;

    try {
      setDeleting(true);
      await deleteClassroom(deleteModalClassroom.id);
      toast.success(`Classroom '${deleteModalClassroom.name}' deleted successfully`);
      setDeleteModalClassroom(null);
      loadClassrooms();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to delete classroom");
    } finally {
      setDeleting(false);
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
              Manage your teaching sections, import student rosters, verify join-code requests, and configure classroom settings.
            </p>
          </div>

          <button
            type="button"
            className="btn-create-classroom"
            onClick={() => setShowCreateModal(true)}
          >
            + Create New Classroom
          </button>
        </div>

        {/* CONTENT */}
        {loading ? (
          <div className="classrooms-loading-state">
            <div className="spinner"></div>
            <p>Loading your classrooms...</p>
          </div>
        ) : classrooms.length === 0 ? (
          <div className="classrooms-empty-state">
            <div className="empty-icon-bubble">📚</div>
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
                onClick={() => navigate(`/teacher/classrooms/${cls.id}/workspaces`)}
              >
                <div className="card-top-header">
                  <span className="subject-code-pill">{cls.courseCode || cls.subjectCode}</span>
                  <div className="card-top-right-group">
                    <span className={`status-badge status-${cls.status?.toLowerCase()}`}>
                      {cls.status}
                    </span>
                  </div>
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

                {/* CARD ACTION BUTTONS */}
                <div className="card-controls-cluster">
                  <button
                    type="button"
                    className="btn-card-action btn-card-edit"
                    onClick={(e) => handleEditOpen(cls, e)}
                    title="Edit Classroom Settings"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    type="button"
                    className="btn-card-action btn-card-delete"
                    onClick={(e) => handleDeleteOpen(cls, e)}
                    title="Delete Classroom"
                  >
                    🗑️ Delete
                  </button>
                </div>

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
                  placeholder="e.g. Internet of Things"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Course / Subject Code *</label>
                  <input
                    type="text"
                    name="subjectCode"
                    placeholder="e.g. BCS701"
                    value={formData.subjectCode}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Subject Full Name *</label>
                  <input
                    type="text"
                    name="subjectName"
                    placeholder="e.g. Internet of Things"
                    value={formData.subjectName}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <div className="form-row-3">
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
                    placeholder="A"
                    value={formData.section}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Department</label>
                  <input
                    type="text"
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Academic Batch</label>
                  <input
                    type="text"
                    name="academicBatch"
                    placeholder="2021-2025"
                    value={formData.academicBatch}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="form-group">
                  <label>Academic Year</label>
                  <input
                    type="text"
                    name="academicYear"
                    placeholder="2024-2025"
                    value={formData.academicYear}
                    onChange={handleInputChange}
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

      {/* EDIT CLASSROOM MODAL */}
      {editClassroom && (
        <div className="modal-backdrop">
          <div className="modal-content-card">
            <div className="modal-header">
              <h2>Edit Classroom Settings</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setEditClassroom(null)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="create-classroom-form">
              <div className="form-group">
                <label>Classroom Name *</label>
                <input
                  type="text"
                  name="name"
                  value={editFormData.name}
                  onChange={handleEditInputChange}
                  required
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Course / Subject Code *</label>
                  <input
                    type="text"
                    name="courseCode"
                    value={editFormData.courseCode}
                    onChange={handleEditInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Subject Full Name *</label>
                  <input
                    type="text"
                    name="subjectName"
                    value={editFormData.subjectName}
                    onChange={handleEditInputChange}
                    required
                  />
                </div>
              </div>

              <div className="form-row-3">
                <div className="form-group">
                  <label>Semester *</label>
                  <select
                    name="semester"
                    value={editFormData.semester}
                    onChange={handleEditInputChange}
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
                    value={editFormData.section}
                    onChange={handleEditInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select
                    name="status"
                    value={editFormData.status}
                    onChange={handleEditInputChange}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Academic Batch</label>
                  <input
                    type="text"
                    name="academicBatch"
                    value={editFormData.academicBatch}
                    onChange={handleEditInputChange}
                  />
                </div>
                <div className="form-group">
                  <label>Academic Year</label>
                  <input
                    type="text"
                    name="academicYear"
                    value={editFormData.academicYear}
                    onChange={handleEditInputChange}
                  />
                </div>
              </div>

              <div className="form-group checkbox-form-group">
                <label className="checkbox-label-row">
                  <input
                    type="checkbox"
                    name="joinCodeEnabled"
                    checked={editFormData.joinCodeEnabled}
                    onChange={handleEditInputChange}
                  />
                  <span>Allow students to join using the 6-character Join Code</span>
                </label>
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
                  className="btn-submit"
                  disabled={updating}
                >
                  {updating ? "Saving Changes..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteModalClassroom && (
        <div className="modal-backdrop">
          <div className="modal-content-card modal-delete-confirm">
            <div className="modal-header">
              <h2>⚠️ Delete Classroom</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setDeleteModalClassroom(null)}
              >
                ✕
              </button>
            </div>

            <div className="delete-modal-body">
              <p>
                Are you sure you want to permanently delete the classroom:
              </p>
              <div className="delete-classroom-highlight">
                <strong>{deleteModalClassroom.name}</strong> ({deleteModalClassroom.courseCode || deleteModalClassroom.subjectCode})
              </div>
              <p className="delete-warning-text">
                This will delete the classroom and all associated student enrollments and records. This action cannot be undone.
              </p>
            </div>

            <div className="modal-actions-row">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setDeleteModalClassroom(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger-confirm"
                onClick={handleDeleteConfirm}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Yes, Delete Classroom"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeacherClassrooms;
