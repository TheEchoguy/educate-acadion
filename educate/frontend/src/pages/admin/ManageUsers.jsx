import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  getStudents,
  getTeachers,
  assignTeacherSubjects,
  rejectUser,
  exportUsersExcel,
} from "../../services/adminService";
import { getAllPapers } from "../../services/paperService";
import "./ManageUsers.css";

const STANDARD_CATALOG_SUBJECTS = [
  { name: "Indian Knowledge System", code: "BIIKS609" },
  { name: "Internet of Things", code: "21CS61" },
  { name: "Technologies of Renewable Energy Sources", code: "INT_RENEWABLE_3_2026" },
  { name: "Artificial Intelligence", code: "AI-INT-601" },
  { name: "Machine Learning", code: "ML-601" },
  { name: "Database Management Systems", code: "21CS53" },
  { name: "Operating Systems", code: "21CS44" },
  { name: "Computer Networks", code: "21CS52" },
  { name: "Cloud Computing", code: "21CS72" },
  { name: "Cyber Security", code: "21CS73" },
];

function ManageUsers() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [uploadedPapers, setUploadedPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [exportingRole, setExportingRole] = useState(null);

  // Subject Edit Modal
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [teacherSubjects, setTeacherSubjects] = useState([]);
  const [customSubjectName, setCustomSubjectName] = useState("");
  const [customSubjectCode, setCustomSubjectCode] = useState("");
  const [savingSubjects, setSavingSubjects] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const [studentData, teacherData, paperData] = await Promise.all([
        getStudents().catch(() => []),
        getTeachers().catch(() => []),
        getAllPapers().catch(() => []),
      ]);
      setStudents(studentData || []);
      setTeachers(teacherData || []);
      setUploadedPapers(paperData || []);
    } catch (error) {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  // Extract all distinct subject & code pairs from catalog + uploaded question papers
  const availableSubjectOptions = useMemo(() => {
    const map = new Map();

    // 1. Add standard catalog
    STANDARD_CATALOG_SUBJECTS.forEach((sub) => {
      const key = `${sub.name.toLowerCase()}__${sub.code.toLowerCase()}`;
      map.set(key, { name: sub.name, code: sub.code, label: `${sub.name} (${sub.code})` });
    });

    // 2. Add from uploaded question papers in DB
    (uploadedPapers || []).forEach((p) => {
      const subName = p.subject?.trim();
      const subCode = p.subjectCode?.trim() || p.paperId?.trim();
      if (subName && subCode) {
        const key = `${subName.toLowerCase()}__${subCode.toLowerCase()}`;
        map.set(key, { name: subName, code: subCode, label: `${subName} (${subCode})` });
      } else if (subName) {
        const key = `${subName.toLowerCase()}__`;
        if (!map.has(key)) {
          map.set(key, { name: subName, code: "", label: subName });
        }
      }
    });

    return Array.from(map.values());
  }, [uploadedPapers]);

  const handleExportExcel = async (role) => {
    try {
      setExportingRole(role);
      const isTeacher = role === "TEACHER";
      const blob = await exportUsersExcel(role, "APPROVED");
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        isTeacher ? "Acadion_Approved_Faculty_List.xlsx" : "Acadion_Approved_Students_List.xlsx"
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${isTeacher ? "Faculty" : "Students"} Excel Report downloaded!`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to export Excel report");
    } finally {
      setExportingRole(null);
    }
  };

  const handleOpenSubjectModal = (teacher) => {
    setSelectedTeacher(teacher);
    setTeacherSubjects(teacher.assignedSubjects ? [...teacher.assignedSubjects] : []);
    setCustomSubjectName("");
    setCustomSubjectCode("");
  };

  const isSubjectSelected = (subOption) => {
    const optLabel = typeof subOption === "string" ? subOption : subOption.label || subOption.name;
    const optCode = typeof subOption === "object" ? subOption.code : "";
    const optName = typeof subOption === "object" ? subOption.name : "";

    return teacherSubjects.some((s) => {
      const sLower = s.toLowerCase();
      if (sLower === optLabel.toLowerCase()) return true;
      if (optCode && sLower.includes(optCode.toLowerCase())) return true;
      if (optName && sLower.includes(optName.toLowerCase())) return true;
      return false;
    });
  };

  const handleToggleSubject = (subOption) => {
    const formattedLabel = typeof subOption === "string"
      ? subOption
      : subOption.code
        ? `${subOption.name} (${subOption.code})`
        : subOption.name;

    if (isSubjectSelected(subOption)) {
      // Remove any matching subject
      const optCode = typeof subOption === "object" ? subOption.code?.toLowerCase() : "";
      const optName = typeof subOption === "object" ? subOption.name?.toLowerCase() : "";
      const optLabelLower = formattedLabel.toLowerCase();

      setTeacherSubjects(
        teacherSubjects.filter((s) => {
          const sLower = s.toLowerCase();
          if (sLower === optLabelLower) return false;
          if (optCode && sLower.includes(optCode)) return false;
          if (optName && sLower === optName) return false;
          return true;
        })
      );
    } else {
      setTeacherSubjects([...teacherSubjects, formattedLabel]);
    }
  };

  const handleAddCustomSubject = (e) => {
    e.preventDefault();
    if (!customSubjectName.trim()) {
      toast.error("Please enter a subject name");
      return;
    }
    const cleanName = customSubjectName.trim();
    const cleanCode = customSubjectCode.trim();
    const fullEntry = cleanCode ? `${cleanName} (${cleanCode})` : cleanName;

    if (!teacherSubjects.some((s) => s.toLowerCase() === fullEntry.toLowerCase())) {
      setTeacherSubjects([...teacherSubjects, fullEntry]);
      toast.success(`Added ${fullEntry}`);
    } else {
      toast.error("Subject is already allocated");
    }
    setCustomSubjectName("");
    setCustomSubjectCode("");
  };

  const handleSaveSubjects = async () => {
    if (!selectedTeacher) return;
    try {
      setSavingSubjects(true);
      await assignTeacherSubjects(selectedTeacher.email, teacherSubjects);
      toast.success(`Allocated ${teacherSubjects.length} subjects to ${selectedTeacher.name}!`);
      setSelectedTeacher(null);
      fetchUsers();
    } catch (err) {
      toast.error("Failed to update teacher subjects");
    } finally {
      setSavingSubjects(false);
    }
  };

  const handleRemoveUser = async (email, name) => {
    if (!window.confirm(`Are you sure you want to revoke access for ${name || email}?`)) return;
    try {
      await rejectUser(email);
      toast.success("User access revoked successfully");
      fetchUsers();
    } catch (error) {
      toast.error("Failed to revoke access");
    }
  };

  const formatApprovedDate = (dateVal) => {
    if (!dateVal) return "Approved";
    const d = new Date(dateVal);
    if (isNaN(d.getTime()) || d.getFullYear() < 2000) return "Approved";
    return d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filteredTeachers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return teachers;
    return teachers.filter(
      (t) =>
        t.name?.toLowerCase().includes(q) ||
        t.email?.toLowerCase().includes(q) ||
        t.employeeId?.toLowerCase().includes(q) ||
        t.teacherDepartment?.toLowerCase().includes(q)
    );
  }, [teachers, searchQuery]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.usn?.toLowerCase().includes(q) ||
        s.studentDepartment?.toLowerCase().includes(q)
    );
  }, [students, searchQuery]);

  return (
    <div className="manage-users-page">
      {/* Top Header */}
      <div className="manage-top-bar">
        <button className="back-btn" onClick={() => navigate("/admin/dashboard")}>
          ← Back To Dashboard
        </button>
      </div>

      <div className="manage-users-header">
        <div className="header-text-block">
          <h1>Manage Faculty & Students</h1>
          <p>
            Allocate teaching subjects to faculty members without limits, manage academic credentials, and supervise platform user access.
          </p>
        </div>

        {/* Global Search Bar */}
        <div className="manage-search-bar">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search by name, email, USN, or Emp ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => setSearchQuery("")}>
              ✕
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading-state-card">Loading registered users...</div>
      ) : (
        <>
          {/* FACULTY & TEACHERS SECTION */}
          <div className="users-section">
            <div className="section-header-row">
              <h2>
                👨‍🏫 Faculty & Teachers <span className="count-badge">{filteredTeachers.length}</span>
              </h2>
              <button
                className="section-export-btn faculty-export"
                disabled={exportingRole === "TEACHER" || teachers.length === 0}
                onClick={() => handleExportExcel("TEACHER")}
              >
                {exportingRole === "TEACHER" ? "Exporting..." : "📥 Export Faculty Excel (.xlsx)"}
              </button>
            </div>

            <div className="table-container">
              <table className="manage-table">
                <thead>
                  <tr>
                    <th>Name & Role</th>
                    <th>Email Address</th>
                    <th>Employee ID</th>
                    <th>Designation & Dept</th>
                    <th>Allocated Teaching Subjects</th>
                    <th>Approved Date</th>
                    <th style={{ textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTeachers.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="empty-table-cell">
                        No faculty members match the search query.
                      </td>
                    </tr>
                  ) : (
                    filteredTeachers.map((teacher) => {
                      const hasSubjects = teacher.assignedSubjects && teacher.assignedSubjects.length > 0;

                      return (
                        <tr key={teacher.email}>
                          <td>
                            <strong className="user-name-title">{teacher.name}</strong>
                            <span className="role-tag teacher">Faculty</span>
                          </td>
                          <td>
                            <code className="email-code">{teacher.email}</code>
                          </td>
                          <td>
                            <span className="id-badge">{teacher.employeeId || "N/A"}</span>
                          </td>
                          <td>
                            <div className="dept-designation-box">
                              <strong>{teacher.designation || "Lecturer"}</strong>
                              <small>{teacher.teacherDepartment || "Department"}</small>
                            </div>
                          </td>
                          <td>
                            <div className="assigned-subjects-cell">
                              {hasSubjects ? (
                                <div className="subjects-cluster-box">
                                  <div className="subjects-chips-list">
                                    {teacher.assignedSubjects.map((s, idx) => (
                                      <span key={idx} className="subject-chip-badge">
                                        <span className="chip-icon">📘</span>
                                        <span className="chip-text">{s}</span>
                                      </span>
                                    ))}
                                  </div>
                                  <button
                                    className="edit-allocations-btn"
                                    onClick={() => handleOpenSubjectModal(teacher)}
                                    title="Add or modify allocated subjects"
                                  >
                                    ✏ Manage / Add Subjects ({teacher.assignedSubjects.length})
                                  </button>
                                </div>
                              ) : (
                                <div className="no-subjects-cluster">
                                  <span className="empty-subs-hint">⚠️ No Subjects Allocated</span>
                                  <button
                                    className="allocate-subs-cta-btn"
                                    onClick={() => handleOpenSubjectModal(teacher)}
                                  >
                                    + Allocate Subjects
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className="date-badge">{formatApprovedDate(teacher.approvedAt)}</span>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <div className="action-btns">
                              <button
                                className="revoke-btn"
                                onClick={() => handleRemoveUser(teacher.email, teacher.name)}
                              >
                                Revoke Access
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* STUDENTS SECTION */}
          <div className="users-section">
            <div className="section-header-row">
              <h2>
                🎓 Students <span className="count-badge">{filteredStudents.length}</span>
              </h2>
              <button
                className="section-export-btn student-export"
                disabled={exportingRole === "STUDENT" || students.length === 0}
                onClick={() => handleExportExcel("STUDENT")}
              >
                {exportingRole === "STUDENT" ? "Exporting..." : "📥 Export Students Excel (.xlsx)"}
              </button>
            </div>

            <div className="table-container">
              <table className="manage-table">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Email Address</th>
                    <th>USN</th>
                    <th>Semester</th>
                    <th>Department</th>
                    <th>Approved Date</th>
                    <th style={{ textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="empty-table-cell">
                        No students match the search query.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student) => (
                      <tr key={student.email}>
                        <td>
                          <strong className="user-name-title">{student.name}</strong>
                          <span className="role-tag student">Student</span>
                        </td>
                        <td>
                          <code className="email-code">{student.email}</code>
                        </td>
                        <td>
                          <strong className="usn-highlight">{student.usn}</strong>
                        </td>
                        <td>
                          <span className="sem-badge">Sem {student.semester || "N/A"}</span>
                        </td>
                        <td>
                          <span className="dept-badge">{student.studentDepartment || "CSE"}</span>
                        </td>
                        <td>
                          <span className="date-badge">{formatApprovedDate(student.approvedAt)}</span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <div className="action-btns">
                            <button
                              className="revoke-btn"
                              onClick={() => handleRemoveUser(student.email, student.name)}
                            >
                              Revoke Access
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ALLOCATE / UPDATE TEACHING SUBJECTS MODAL */}
      {selectedTeacher && (
        <div className="modal-backdrop" onClick={() => setSelectedTeacher(null)}>
          <div className="subject-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-top">
              <div className="modal-title-wrap">
                <span className="modal-icon-badge">📚</span>
                <div>
                  <h2>Allocate Teaching Subjects</h2>
                  <span className="faculty-subtitle">
                    Faculty: <strong>{selectedTeacher.name}</strong> ({selectedTeacher.email})
                  </span>
                </div>
              </div>
              <button className="close-btn" onClick={() => setSelectedTeacher(null)}>
                ✕
              </button>
            </div>

            <p className="modal-desc">
              Select or add any subjects for this faculty member without limits. The teacher will be authorized to evaluate student submissions only for their allocated subjects.
            </p>

            <div className="subject-selection-box">
              {/* Quick Select from Uploaded Papers Dropdown */}
              <label className="section-label">⚡ Quick Select from Uploaded Papers & Subject Codes:</label>
              <div className="dropdown-select-wrap">
                <select
                  className="paper-code-dropdown"
                  defaultValue=""
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) {
                      const match = availableSubjectOptions.find((o) => o.label === val);
                      if (match) {
                        handleToggleSubject(match);
                      } else {
                        handleToggleSubject(val);
                      }
                      e.target.value = "";
                    }
                  }}
                >
                  <option value="" disabled>
                    -- Choose from Uploaded Paper Subjects & Codes ({availableSubjectOptions.length} available) --
                  </option>
                  {availableSubjectOptions.map((opt, i) => (
                    <option key={i} value={opt.label}>
                      {opt.code ? `[${opt.code}] ${opt.name}` : opt.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject & Code Chips Grid */}
              <label className="section-label" style={{ marginTop: "14px" }}>
                Quick-Select Subject & Code Chips:
              </label>
              <div className="subject-chips-grid">
                {availableSubjectOptions.map((opt, i) => {
                  const isSelected = isSubjectSelected(opt);
                  return (
                    <button
                      key={i}
                      type="button"
                      className={`subject-chip ${isSelected ? "selected" : ""}`}
                      onClick={() => handleToggleSubject(opt)}
                    >
                      {isSelected ? "✓ " : "+ "}
                      <strong>{opt.name}</strong>
                      {opt.code && <span className="chip-code-tag">({opt.code})</span>}
                    </button>
                  );
                })}
              </div>

              {/* Add Custom / Other Subject & Code Form */}
              <label className="section-label" style={{ marginTop: "16px" }}>
                Add Other / Custom Subject & Subject Code (No Limits):
              </label>
              <form onSubmit={handleAddCustomSubject} className="add-custom-subject-dual-form">
                <input
                  type="text"
                  placeholder="Subject Name (e.g., Natural Language Processing)..."
                  value={customSubjectName}
                  onChange={(e) => setCustomSubjectName(e.target.value)}
                  className="custom-input-field name-field"
                  required
                />
                <input
                  type="text"
                  placeholder="Subject Code (e.g., 21CS74 / NLP-101)..."
                  value={customSubjectCode}
                  onChange={(e) => setCustomSubjectCode(e.target.value)}
                  className="custom-input-field code-field"
                />
                <button type="submit" className="add-sub-submit-btn">
                  + Add Subject & Code
                </button>
              </form>

              {/* Allocated Summary Box */}
              <div className="allocated-summary-card">
                <div className="summary-header-row">
                  <span>
                    Allocated Subjects (<strong>{teacherSubjects.length}</strong>)
                  </span>
                  {teacherSubjects.length > 0 && (
                    <button
                      type="button"
                      className="clear-all-subs-btn"
                      onClick={() => setTeacherSubjects([])}
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {teacherSubjects.length === 0 ? (
                  <div className="empty-allocated-state">
                    No subjects selected yet. Click any chip above, pick from dropdown, or add custom subject & code.
                  </div>
                ) : (
                  <div className="allocated-tags-row">
                    {teacherSubjects.map((s, idx) => (
                      <span key={idx} className="allocated-tag-pill">
                        {s}
                        <button
                          type="button"
                          className="remove-tag-btn"
                          onClick={() => handleToggleSubject(s)}
                          title="Remove subject"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer Action Buttons with Equal Proportions */}
            <div className="modal-actions-footer">
              <button
                type="button"
                className="modal-cancel-btn"
                onClick={() => setSelectedTeacher(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="modal-save-subs-btn"
                disabled={savingSubjects}
                onClick={handleSaveSubjects}
              >
                {savingSubjects ? "Saving Allocations..." : `✓ Save Subject Allocations (${teacherSubjects.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManageUsers;