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
  const [activeTab, setActiveTab] = useState("members"); // "members" | "requests" | "import"

  // Search filter for members
  const [searchQuery, setSearchQuery] = useState("");

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
    if (!window.confirm("Are you sure you want to regenerate the join code? The previous join code will immediately be invalidated.")) {
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

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setImportSummary(null);
    }
  };

  const handleRosterSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error("Please select a CSV or XLSX file first");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      setImporting(true);
      const summary = await importRoster(id, formData);
      setImportSummary(summary);
      toast.success(`Import complete: ${summary.addedCount} students enrolled!`);
      // Refresh member lists
      const [membersData, requestsData] = await Promise.all([
        getClassroomMembers(id).catch(() => []),
        getJoinRequests(id).catch(() => []),
      ]);
      setMembers(membersData || []);
      setJoinRequests(requestsData || []);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Roster upload failed");
    } finally {
      setImporting(false);
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
                  <span className="hero-code-badge">{classroom.subjectCode}</span>
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
                    <button type="button" className="btn-copy-code" onClick={handleCopyCode}>
                      📋 Copy Code
                    </button>
                    <button
                      type="button"
                      className="btn-regen-code"
                      onClick={handleRegenerateCode}
                      disabled={regenerating}
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
                className={`tab-btn ${activeTab === "members" ? "active" : ""}`}
                onClick={() => setActiveTab("members")}
              >
                👥 Enrolled Students ({activeMembers.length})
              </button>

              <button
                type="button"
                className={`tab-btn ${activeTab === "requests" ? "active" : ""}`}
                onClick={() => setActiveTab("requests")}
              >
                ⏳ Join Requests {joinRequests.length > 0 && <span className="tab-count-pill">{joinRequests.length}</span>}
              </button>

              <button
                type="button"
                className={`tab-btn ${activeTab === "import" ? "active" : ""}`}
                onClick={() => setActiveTab("import")}
              >
                📥 Import Roster (CSV/XLSX)
              </button>
            </div>

            {/* TAB 1: MEMBERS */}
            {activeTab === "members" && (
              <div className="tab-panel-container">
                <div className="panel-controls-row">
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search by student name, USN, or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <div className="panel-stats-text">
                    Showing {activeMembers.length} enrolled students
                  </div>
                </div>

                {activeMembers.length === 0 ? (
                  <div className="empty-tab-notice">
                    <p>No enrolled students found.</p>
                    <button className="btn-tab-action" onClick={() => setActiveTab("import")}>
                      Upload Student Roster
                    </button>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="workspace-table">
                      <thead>
                        <tr>
                          <th>USN</th>
                          <th>Student Name</th>
                          <th>Email</th>
                          <th>Source</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeMembers.map((m) => (
                          <tr key={m.membershipId || m.studentId}>
                            <td>
                              <span className="usn-badge">{m.usn}</span>
                            </td>
                            <td className="student-name-cell">{m.studentName}</td>
                            <td className="email-cell">{m.studentEmail}</td>
                            <td>
                              <span className={`source-pill source-${m.membershipSource?.toLowerCase()}`}>
                                {m.membershipSource}
                              </span>
                            </td>
                            <td>
                              <span className="status-pill-green">ACTIVE</span>
                            </td>
                            <td>
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

            {/* TAB 2: JOIN REQUESTS */}
            {activeTab === "requests" && (
              <div className="tab-panel-container">
                <div className="panel-intro-text">
                  Students who submit this classroom's join code appear here. Verify their identity and grant access.
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
                          <th>USN</th>
                          <th>Student Name</th>
                          <th>Email</th>
                          <th>Requested At</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {joinRequests.map((req) => (
                          <tr key={req.membershipId || req.studentId}>
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

            {/* TAB 3: IMPORT ROSTER */}
            {activeTab === "import" && (
              <div className="tab-panel-container">
                <div className="import-box-card">
                  <h3>Batch Enroll Students via Roster Upload</h3>
                  <p>
                    Upload an institutional Excel (<code>.xlsx</code>) or CSV (<code>.csv</code>) file containing student USNs.
                    Existing student accounts matching the USN will be automatically enrolled as <strong>ACTIVE</strong> members.
                  </p>

                  <form onSubmit={handleRosterSubmit} className="roster-upload-form">
                    <div className="file-dropzone">
                      <input
                        type="file"
                        id="rosterFileInput"
                        accept=".csv,.xlsx,.xls"
                        onChange={handleFileChange}
                      />
                      <label htmlFor="rosterFileInput" className="dropzone-label">
                        <span className="dropzone-icon">📁</span>
                        <span className="dropzone-text">
                          {selectedFile ? selectedFile.name : "Click to select CSV or XLSX file"}
                        </span>
                        <span className="dropzone-hint">
                          Requires column named <strong>USN</strong>
                        </span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      className="btn-upload-roster"
                      disabled={!selectedFile || importing}
                    >
                      {importing ? "Processing Roster..." : "Upload and Match Roster"}
                    </button>
                  </form>
                </div>

                {/* IMPORT SUMMARY REPORT */}
                {importSummary && (
                  <div className="import-summary-card">
                    <h4>Roster Import Summary</h4>
                    <div className="summary-stats-grid">
                      <div className="summary-stat-box">
                        <span className="stat-num">{importSummary.totalRows}</span>
                        <span className="stat-label">Total Rows</span>
                      </div>
                      <div className="summary-stat-box">
                        <span className="stat-num stat-green">{importSummary.addedCount}</span>
                        <span className="stat-label">Added & Enrolled</span>
                      </div>
                      <div className="summary-stat-box">
                        <span className="stat-num stat-blue">{importSummary.alreadyMembersCount}</span>
                        <span className="stat-label">Already Members</span>
                      </div>
                      <div className="summary-stat-box">
                        <span className="stat-num stat-amber">{importSummary.duplicatesInFile}</span>
                        <span className="stat-label">Duplicate Rows</span>
                      </div>
                      <div className="summary-stat-box">
                        <span className="stat-num stat-red">{importSummary.unmatchedCount}</span>
                        <span className="stat-label">Unmatched USNs</span>
                      </div>
                    </div>

                    {/* UNMATCHED STUDENTS SECTION */}
                    {importSummary.unmatchedStudents?.length > 0 && (
                      <div className="unmatched-list-section">
                        <h5>⚠️ Unmatched Student Records ({importSummary.unmatchedStudents.length})</h5>
                        <p className="unmatched-desc">
                          The following USNs could not be matched with registered student accounts in Acadion.
                          No fake accounts were created. Please ensure students register first.
                        </p>
                        <div className="unmatched-tags-cloud">
                          {importSummary.unmatchedStudents.map((item, idx) => (
                            <div key={idx} className="unmatched-item-pill">
                              <strong>{item.usn}</strong>: {item.reason}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
