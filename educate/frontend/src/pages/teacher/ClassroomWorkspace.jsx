import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import toast from "react-hot-toast";
import {
  getClassroomDetails,
  getClassroomMembers,
  getJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
  removeMember,
  importRoster,
  uploadRoster,
  addStudent,
  regenerateJoinCode,
} from "../../services/classroomService";
import "./ClassroomWorkspace.css";

function ClassroomWorkspace() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [classroom, setClassroom] = useState(null);
  const [members, setMembers] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("roster"); // "roster" | "requests"

  // Search filter for members
  const [searchQuery, setSearchQuery] = useState("");

  // Quick Add Student State
  const [quickStudent, setQuickStudent] = useState({ usn: "", email: "", name: "" });
  const [addingStudent, setAddingStudent] = useState(false);

  // Roster file upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);

  // Regeneration state
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    loadClassroomData();
  }, [id]);

  const loadClassroomData = async () => {
    try {
      setLoading(true);
      const [clsData, membersData, requestsData] = await Promise.all([
        getClassroomDetails(id),
        getClassroomMembers(id).catch(() => []),
        getJoinRequests(id).catch(() => []),
      ]);

      setClassroom(clsData);
      setMembers(membersData || []);
      setJoinRequests(requestsData || []);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to load classroom details");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (!classroom?.joinCode) return;
    navigator.clipboard.writeText(classroom.joinCode);
    toast.success(`Copied Join Code: ${classroom.joinCode}`);
  };

  const handleRegenerateCode = async () => {
    if (!window.confirm("Are you sure you want to regenerate the join code? The previous code will immediately be invalidated.")) {
      return;
    }

    try {
      setRegenerating(true);
      const res = await regenerateJoinCode(id);
      setClassroom((prev) => ({ ...prev, joinCode: res.joinCode }));
      toast.success("Join code regenerated successfully!");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to regenerate join code");
    } finally {
      setRegenerating(false);
    }
  };

  const handleQuickAddStudent = async (e) => {
    e.preventDefault();
    if (!quickStudent.usn.trim() && !quickStudent.email.trim()) {
      toast.error("Please enter a valid student USN or Email");
      return;
    }

    try {
      setAddingStudent(true);
      const res = await addStudent(id, {
        usn: quickStudent.usn.trim(),
        email: quickStudent.email.trim(),
        name: quickStudent.name.trim(),
      });

      toast.success(res.message || "Student enrolled successfully!");
      setQuickStudent({ usn: "", email: "", name: "" });
      loadClassroomData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to add student to classroom");
    } finally {
      setAddingStudent(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setImportSummary(null);
    }
  };

  const handleRosterSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!selectedFile) {
      toast.error("Please select an Excel (.xlsx/.xls) or CSV file first");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      setImporting(true);
      const summary = await uploadRoster(id, formData);
      setImportSummary(summary);
      toast.success(
        `Roster Uploaded! ${summary.totalProcessed} processed (${summary.existingVerifiedUsersLinked} verified in DB, ${summary.newStudentAccountsCreated} new accounts created)`
      );
      loadClassroomData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Roster upload failed");
    } finally {
      setImporting(false);
    }
  };

  const handleApprove = async (studentId, studentName) => {
    try {
      await approveJoinRequest(id, studentId);
      toast.success(`Approved ${studentName || "student"} successfully!`);
      loadClassroomData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Approval failed");
    }
  };

  const handleReject = async (studentId, studentName) => {
    if (!window.confirm(`Reject join request from ${studentName || "student"}?`)) return;
    try {
      await rejectJoinRequest(id, studentId);
      toast.success(`Rejected ${studentName || "student"} request.`);
      loadClassroomData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Rejection failed");
    }
  };

  const handleRemove = async (studentId, studentName) => {
    if (!window.confirm(`Remove ${studentName || "this student"} from the classroom?`)) return;
    try {
      await removeMember(id, studentId);
      toast.success(`Removed ${studentName || "student"} from classroom.`);
      loadClassroomData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to remove member");
    }
  };

  // Filtered members by search query
  const filteredMembers = members.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (m.studentName && m.studentName.toLowerCase().includes(q)) ||
      (m.usn && m.usn.toLowerCase().includes(q)) ||
      (m.studentEmail && m.studentEmail.toLowerCase().includes(q))
    );
  });

  const activeMembers = filteredMembers.filter((m) => m.membershipStatus === "ACTIVE");

  return (
    <div className="classroom-workspace-page">
      <Navbar />

      <div className="workspace-main-container">
        {/* BACK BUTTON */}
        <button className="workspace-back-btn" onClick={() => navigate("/teacher/classrooms")}>
          ← Back to All Classrooms
        </button>

        {loading ? (
          <div className="workspace-loading">
            <div className="spinner"></div>
            <p>Loading classroom workspace...</p>
          </div>
        ) : !classroom ? (
          <div className="workspace-error">Classroom not found.</div>
        ) : (
          <>
            {/* HERO HEADER */}
            <div className="workspace-hero-card">
              <div className="hero-left-side">
                <div className="hero-tags-row">
                  <span className="hero-code-badge">{classroom.courseCode || classroom.subjectCode || "BCS701"}</span>
                  <span className="hero-meta-pill">Sem {classroom.semester} - Section {classroom.section}</span>
                  <span className="hero-meta-pill">{classroom.department}</span>
                  <span className="hero-meta-pill">{classroom.academicBatch}</span>
                </div>

                <h1 className="hero-classroom-title">{classroom.name}</h1>
                <p className="hero-subject-name">{classroom.subjectName} • Academic Year {classroom.academicYear}</p>
              </div>

              {/* JOIN CODE CLUSTER */}
              <div className="hero-right-side">
                <div className="workspace-code-display">
                  <span className="code-eyebrow">Classroom Join Code</span>
                  <div className="code-main-text">{classroom.joinCode || "CODE-NOT-SET"}</div>
                  <div className="code-actions-group">
                    <button type="button" className="btn-copy-code" onClick={handleCopyCode} title="Copy 6-character code">
                      📋 Copy Code
                    </button>
                    <button
                      type="button"
                      className="btn-regen-code"
                      onClick={handleRegenerateCode}
                      disabled={regenerating}
                      title="Generate new unique 6-character code"
                    >
                      {regenerating ? "..." : "🔄 Regenerate"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* TAB NAVIGATION */}
            <div className="workspace-tabs-row">
              <button
                type="button"
                className={`tab-btn ${activeTab === "roster" ? "active" : ""}`}
                onClick={() => setActiveTab("roster")}
              >
                👥 Manage Student Roster ({activeMembers.length})
              </button>

              <button
                type="button"
                className={`tab-btn ${activeTab === "requests" ? "active" : ""}`}
                onClick={() => setActiveTab("requests")}
              >
                ⏳ Join Requests {joinRequests.length > 0 && <span className="tab-count-pill">{joinRequests.length}</span>}
              </button>
            </div>

            {/* TAB: MANAGE STUDENT ROSTER */}
            {activeTab === "roster" && (
              <div className="tab-panel-container">
                {/* 1. ONBOARDING & ROSTER TOOLS GRID */}
                <div className="roster-management-grid">
                  {/* Tool A: Upload Excel/CSV Roster */}
                  <div className="roster-card upload-roster-box">
                    <div className="roster-card-header">
                      <span className="roster-card-icon">📁</span>
                      <div>
                        <h3>Upload Student Excel / CSV Roster</h3>
                        <p>Upload multi-row sheets like <code>Iot-7A-SplitupMarks.xlsx</code> or CSV with USN & Name</p>
                      </div>
                    </div>

                    <form onSubmit={handleRosterSubmit} className="roster-form-inline">
                      <div className="file-input-wrapper">
                        <input
                          type="file"
                          id="excelRosterInput"
                          accept=".xlsx,.xls,.csv"
                          onChange={handleFileChange}
                        />
                        <label htmlFor="excelRosterInput" className="file-select-btn">
                          {selectedFile ? `Selected: ${selectedFile.name}` : "Choose .xlsx or .csv File"}
                        </label>
                      </div>

                      <button
                        type="submit"
                        className="btn-primary-upload"
                        disabled={!selectedFile || importing}
                      >
                        {importing ? "Uploading & Enrolling..." : "Upload & Sync Roster"}
                      </button>
                    </form>

                    {/* LIVE IMPORT SUMMARY BANNER */}
                    {importSummary && (
                      <div className="live-summary-banner">
                        <div className="summary-badge-group">
                          <span className="summary-pill total">
                            Total Processed: <strong>{importSummary.totalProcessed}</strong>
                          </span>
                          <span className="summary-pill verified">
                            ✓ Verified DB Users: <strong>{importSummary.existingVerifiedUsersLinked}</strong>
                          </span>
                          <span className="summary-pill created">
                            + New Accounts Created: <strong>{importSummary.newStudentAccountsCreated}</strong>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Tool B: Quick Add Student by USN/Email */}
                  <div className="roster-card quick-add-box">
                    <div className="roster-card-header">
                      <span className="roster-card-icon">👤</span>
                      <div>
                        <h3>Quick Add Student</h3>
                        <p>Add student by USN (e.g., <code>1DB23CS007</code>) or Email address</p>
                      </div>
                    </div>

                    <form onSubmit={handleQuickAddStudent} className="quick-add-form">
                      <div className="quick-inputs-row">
                        <input
                          type="text"
                          placeholder="Student USN (e.g. 1DB23CS007)"
                          value={quickStudent.usn}
                          onChange={(e) => setQuickStudent({ ...quickStudent, usn: e.target.value })}
                          className="input-quick"
                        />
                        <input
                          type="text"
                          placeholder="Student Name (optional)"
                          value={quickStudent.name}
                          onChange={(e) => setQuickStudent({ ...quickStudent, name: e.target.value })}
                          className="input-quick"
                        />
                        <input
                          type="email"
                          placeholder="Email (optional)"
                          value={quickStudent.email}
                          onChange={(e) => setQuickStudent({ ...quickStudent, email: e.target.value })}
                          className="input-quick"
                        />
                      </div>
                      <button
                        type="submit"
                        className="btn-quick-add"
                        disabled={addingStudent || (!quickStudent.usn && !quickStudent.email)}
                      >
                        {addingStudent ? "Adding..." : "+ Add to Classroom"}
                      </button>
                    </form>
                  </div>
                </div>

                {/* 2. SEARCH & STATS ROW */}
                <div className="panel-controls-row">
                  <div className="search-box-wrapper">
                    <span className="search-icon">🔍</span>
                    <input
                      type="text"
                      className="search-input"
                      placeholder="Search enrolled students by USN, Name, or Email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="panel-stats-text">
                    Showing <strong>{activeMembers.length}</strong> enrolled students
                  </div>
                </div>

                {/* 3. ENROLLED STUDENTS TABLE */}
                {activeMembers.length === 0 ? (
                  <div className="empty-tab-notice">
                    <div className="empty-icon-lg">👥</div>
                    <h4>No Enrolled Students Yet</h4>
                    <p>Upload a roster sheet (e.g. <code>Iot-7A-SplitupMarks.xlsx</code>) or use Quick Add above to enroll students.</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="workspace-table">
                      <thead>
                        <tr>
                          <th style={{ width: "60px" }}>Sl No</th>
                          <th>USN</th>
                          <th>Student Name</th>
                          <th>Email</th>
                          <th>Verification Status</th>
                          <th>Source</th>
                          <th style={{ textAlign: "right" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeMembers.map((m, idx) => (
                          <tr key={m.membershipId || m.studentId || idx}>
                            <td className="sl-no-cell">{idx + 1}</td>
                            <td>
                              <span className="usn-badge">{m.usn || "N/A"}</span>
                            </td>
                            <td className="student-name-cell">
                              <strong>{m.studentName}</strong>
                            </td>
                            <td className="email-cell">{m.studentEmail}</td>
                            <td>
                              <span className="verified-db-badge">
                                <span className="verified-icon">✓</span> Verified in DB
                              </span>
                            </td>
                            <td>
                              <span className={`source-pill source-${(m.membershipSource || "ROSTER").toLowerCase()}`}>
                                {m.membershipSource || "ROSTER"}
                              </span>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <button
                                type="button"
                                className="btn-remove-student"
                                onClick={() => handleRemove(m.studentId, m.studentName)}
                                title="Remove student from classroom"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB: JOIN REQUESTS */}
            {activeTab === "requests" && (
              <div className="tab-panel-container">
                <div className="panel-intro-text">
                  Students who submitted this classroom's 6-character Join Code.
                </div>

                {joinRequests.length === 0 ? (
                  <div className="empty-tab-notice">
                    <p>No pending join requests at this time.</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="workspace-table">
                      <thead>
                        <tr>
                          <th>Sl No</th>
                          <th>USN</th>
                          <th>Student Name</th>
                          <th>Email</th>
                          <th>Requested At</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {joinRequests.map((req, idx) => (
                          <tr key={req.membershipId || req.studentId || idx}>
                            <td className="sl-no-cell">{idx + 1}</td>
                            <td>
                              <span className="usn-badge">{req.usn}</span>
                            </td>
                            <td className="student-name-cell">{req.studentName}</td>
                            <td className="email-cell">{req.studentEmail}</td>
                            <td>{req.requestedAt ? new Date(req.requestedAt).toLocaleString() : "Recently"}</td>
                            <td>
                              <div className="request-actions-group">
                                <button
                                  type="button"
                                  className="btn-approve"
                                  onClick={() => handleApprove(req.studentId, req.studentName)}
                                >
                                  ✓ Approve
                                </button>
                                <button
                                  type="button"
                                  className="btn-reject"
                                  onClick={() => handleReject(req.studentId, req.studentName)}
                                >
                                  ✕ Reject
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default ClassroomWorkspace;
