import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  getPendingUsers,
  approveUser,
  approveTeacherWithSubjects,
  rejectUser,
  exportUsersExcel,
} from "../../services/adminService";
import { getAllPapers } from "../../services/paperService";
import "./PendingUsers.css";

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

function PendingUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [uploadedPapers, setUploadedPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [exportingRole, setExportingRole] = useState(null);

  // Modal for Teacher Subject Assignment upon Approval
  const [teacherModalUser, setTeacherModalUser] = useState(null);
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [customSubjectName, setCustomSubjectName] = useState("");
  const [customSubjectCode, setCustomSubjectCode] = useState("");

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const [data, paperData] = await Promise.all([
        getPendingUsers().catch(() => []),
        getAllPapers().catch(() => []),
      ]);
      setUsers(data || []);
      setUploadedPapers(paperData || []);
    } catch (error) {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const availableSubjectOptions = useMemo(() => {
    const map = new Map();

    STANDARD_CATALOG_SUBJECTS.forEach((sub) => {
      const key = `${sub.name.toLowerCase()}__${sub.code.toLowerCase()}`;
      map.set(key, { name: sub.name, code: sub.code, label: `${sub.name} (${sub.code})` });
    });

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
      const blob = await exportUsersExcel(role, "PENDING");
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        isTeacher ? "Acadion_Pending_Faculty_List.xlsx" : "Acadion_Pending_Students_List.xlsx"
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${isTeacher ? "Pending Faculty" : "Pending Students"} Excel Report downloaded!`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to export Excel report");
    } finally {
      setExportingRole(null);
    }
  };

  const handleStartApproval = (user) => {
    if (user.role === "TEACHER") {
      setTeacherModalUser(user);
      setSelectedSubjects(["Indian Knowledge System (BIIKS609)"]); // Default initial selection
      setCustomSubjectName("");
      setCustomSubjectCode("");
    } else {
      handleApproveStudent(user.email);
    }
  };

  const handleApproveStudent = async (email) => {
    try {
      setActionLoading(`approve-${email}`);
      const response = await approveUser(email);
      toast.success(response || "Student Approved Successfully");
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || error.response?.data || "Approval Failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmTeacherApproval = async () => {
    if (!teacherModalUser) return;
    if (selectedSubjects.length === 0) {
      toast.error("Please allocate at least one teaching subject for this faculty member");
      return;
    }

    const email = teacherModalUser.email;
    try {
      setActionLoading(`approve-${email}`);
      const response = await approveTeacherWithSubjects(email, selectedSubjects);
      toast.success(response || "Teacher Approved & Subjects Allocated Successfully");
      setTeacherModalUser(null);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || error.response?.data || "Approval Failed");
    } finally {
      setActionLoading(null);
    }
  };

  const isSubjectSelected = (subOption) => {
    const optLabel = typeof subOption === "string" ? subOption : subOption.label || subOption.name;
    const optCode = typeof subOption === "object" ? subOption.code : "";
    const optName = typeof subOption === "object" ? subOption.name : "";

    return selectedSubjects.some((s) => {
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
      const optCode = typeof subOption === "object" ? subOption.code?.toLowerCase() : "";
      const optName = typeof subOption === "object" ? subOption.name?.toLowerCase() : "";
      const optLabelLower = formattedLabel.toLowerCase();

      setSelectedSubjects(
        selectedSubjects.filter((s) => {
          const sLower = s.toLowerCase();
          if (sLower === optLabelLower) return false;
          if (optCode && sLower.includes(optCode)) return false;
          if (optName && sLower === optName) return false;
          return true;
        })
      );
    } else {
      setSelectedSubjects([...selectedSubjects, formattedLabel]);
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

    if (!selectedSubjects.some((s) => s.toLowerCase() === fullEntry.toLowerCase())) {
      setSelectedSubjects([...selectedSubjects, fullEntry]);
      toast.success(`Added ${fullEntry}`);
    } else {
      toast.error("Subject is already allocated");
    }
    setCustomSubjectName("");
    setCustomSubjectCode("");
  };

  const handleReject = async (email) => {
    try {
      setActionLoading(`reject-${email}`);
      const response = await rejectUser(email);
      toast.success(response || "User Rejected Successfully");
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || error.response?.data || "Reject Failed");
    } finally {
      setActionLoading(null);
    }
  };

  const pendingTeachersCount = users.filter((u) => u.role === "TEACHER").length;
  const pendingStudentsCount = users.filter((u) => u.role === "STUDENT").length;

  if (loading) {
    return <div className="pending-loading">Loading Users...</div>;
  }

  return (
    <div className="pending-users-page">
      <div className="pending-top-bar">
        <button className="back-btn" onClick={() => navigate("/admin/dashboard")}>
          ← Back To Dashboard
        </button>
      </div>

      <div className="pending-header-card">
        <div className="header-left">
          <h1>Pending User Approvals</h1>
          <p>
            Approve or reject newly registered faculty and students. Assign teaching subjects to faculty members upon approval.
          </p>
        </div>

        {/* Separate Export Excel Buttons */}
        <div className="pending-header-actions">
          <button
            className="excel-download-btn faculty"
            disabled={exportingRole === "TEACHER" || pendingTeachersCount === 0}
            onClick={() => handleExportExcel("TEACHER")}
            title="Download Pending Faculty in Excel format"
          >
            {exportingRole === "TEACHER" ? "Exporting..." : `📥 Export Faculty Excel (${pendingTeachersCount})`}
          </button>
          <button
            className="excel-download-btn student"
            disabled={exportingRole === "STUDENT" || pendingStudentsCount === 0}
            onClick={() => handleExportExcel("STUDENT")}
            title="Download Pending Students in Excel format"
          >
            {exportingRole === "STUDENT" ? "Exporting..." : `📥 Export Students Excel (${pendingStudentsCount})`}
          </button>
        </div>
      </div>

      {users.length === 0 ? (
        <div className="empty-pending-card">
          <div className="empty-icon">✅</div>
          <h3>No Pending Users</h3>
          <p>All registered users are currently verified and approved.</p>
        </div>
      ) : (
        <div className="pending-table-container">
          <table className="pending-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Department</th>
                <th>Academic / Employee Info</th>
                <th>Registered At</th>
                <th style={{ textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.email}>
                  <td><strong>{user.name}</strong></td>
                  <td><code>{user.email}</code></td>
                  <td>
                    <span className={`role-pill ${user.role?.toLowerCase()}`}>
                      {user.role}
                    </span>
                  </td>
                  <td>
                    {user.role === "STUDENT" ? user.studentDepartment : user.teacherDepartment}
                  </td>
                  <td>
                    {user.role === "STUDENT" ? (
                      <>
                        USN: <strong>{user.usn}</strong> | Sem: {user.semester}
                      </>
                    ) : (
                      <>
                        Emp ID: <strong>{user.employeeId}</strong> | {user.designation}
                      </>
                    )}
                  </td>
                  <td>
                    {new Date(user.createdAt).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                    })}
                  </td>
                  <td>
                    <div className="pending-btns">
                      <button
                        className="approve-btn"
                        disabled={
                          actionLoading === `approve-${user.email}` ||
                          actionLoading === `reject-${user.email}`
                        }
                        onClick={() => handleStartApproval(user)}
                      >
                        {actionLoading === `approve-${user.email}` ? "Approving..." : "Approve"}
                      </button>
                      <button
                        className="reject-btn"
                        disabled={
                          actionLoading === `approve-${user.email}` ||
                          actionLoading === `reject-${user.email}`
                        }
                        onClick={() => handleReject(user.email)}
                      >
                        {actionLoading === `reject-${user.email}` ? "Rejecting..." : "Reject"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TEACHER SUBJECT ASSIGNMENT MODAL */}
      {teacherModalUser && (
        <div className="modal-backdrop" onClick={() => setTeacherModalUser(null)}>
          <div className="subject-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-top">
              <h2>Assign Teaching Subject(s)</h2>
              <button className="close-btn" onClick={() => setTeacherModalUser(null)}>✕</button>
            </div>

            <p className="modal-desc">
              Allocate authorized teaching subjects to faculty member <strong>{teacherModalUser.name}</strong> (<code>{teacherModalUser.email}</code>) before granting approval.
            </p>

            <div className="subject-selection-box">
              {/* Quick Select from Uploaded Papers Dropdown */}
              <label style={{ color: "#e2e8f0", fontWeight: 600, fontSize: "0.88rem", display: "block", marginBottom: "6px" }}>
                ⚡ Quick Select from Uploaded Papers & Subject Codes:
              </label>
              <div style={{ marginBottom: "14px" }}>
                <select
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    background: "#0f172a",
                    border: "1px solid rgba(59, 130, 246, 0.3)",
                    borderRadius: "10px",
                    color: "#f8fafc",
                    fontSize: "0.9rem",
                    outline: "none",
                  }}
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

              {/* Chips Grid */}
              <label style={{ color: "#e2e8f0", fontWeight: 600, fontSize: "0.88rem", display: "block", marginBottom: "8px" }}>
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
                      {opt.code && <span style={{ opacity: 0.8, marginLeft: "4px", fontSize: "0.76rem" }}>({opt.code})</span>}
                    </button>
                  );
                })}
              </div>

              {/* Add Custom Subject & Code */}
              <label style={{ color: "#e2e8f0", fontWeight: 600, fontSize: "0.88rem", display: "block", marginTop: "14px", marginBottom: "6px" }}>
                Add Other / Custom Subject & Subject Code (No Limits):
              </label>
              <form onSubmit={handleAddCustomSubject} style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
                <input
                  type="text"
                  placeholder="Subject Name (e.g., Natural Language Processing)..."
                  value={customSubjectName}
                  onChange={(e) => setCustomSubjectName(e.target.value)}
                  style={{ flex: "2", minWidth: "180px", padding: "10px 14px", background: "#0f172a", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", color: "#fff" }}
                  required
                />
                <input
                  type="text"
                  placeholder="Subject Code (e.g., 21CS74 / NLP-101)..."
                  value={customSubjectCode}
                  onChange={(e) => setCustomSubjectCode(e.target.value)}
                  style={{ flex: "1", minWidth: "120px", padding: "10px 14px", background: "#0f172a", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", color: "#fff" }}
                />
                <button type="submit" style={{ padding: "10px 18px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}>
                  + Add Subject & Code
                </button>
              </form>

              {/* Allocated Preview */}
              <div className="allocated-summary">
                <span>Selected Allocated Subjects ({selectedSubjects.length}):</span>
                <div className="allocated-tags-row">
                  {selectedSubjects.map((s, idx) => (
                    <span key={idx} className="allocated-tag">
                      {s}
                      <button type="button" onClick={() => handleToggleSubject(s)}>✕</button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-actions-footer">
              <button
                type="button"
                className="cancel-btn"
                onClick={() => setTeacherModalUser(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="confirm-approve-btn"
                disabled={selectedSubjects.length === 0}
                onClick={handleConfirmTeacherApproval}
              >
                ✓ Confirm & Approve Faculty
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PendingUsers;