import { useState, useEffect, useCallback } from "react";
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
import ClassroomHeader from "../../components/classroom/ClassroomHeader";
import "./ClassroomWorkspace.css";

export default function ClassroomManagementWorkspacePage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [classroom, setClassroom] = useState(null);
  const [members, setMembers] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Subtab: "members" | "requests" | "import"
  const [managementTab, setManagementTab] = useState("members");

  // Search filter for members
  const [searchQuery, setSearchQuery] = useState("");

  // Roster file upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);

  // Regeneration state
  const [regenerating, setRegenerating] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
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
  }, [id]);

  useEffect(() => {
    let mounted = true;
    const fetchInit = async () => {
      setLoading(true);
      await loadData();
      if (!mounted) return;
    };
    fetchInit();
    return () => {
      mounted = false;
    };
  }, [loadData]);

  const handleRegenerate = async (e) => {
    e.stopPropagation();
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

  const handleApprove = async (studentId, studentName) => {
    try {
      await approveJoinRequest(id, studentId);
      toast.success(`Approved ${studentName}`);
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Approval failed");
    }
  };

  const handleReject = async (studentId, studentName) => {
    if (!window.confirm(`Reject join request for ${studentName}?`)) return;
    try {
      await rejectJoinRequest(id, studentId);
      toast.success(`Rejected request for ${studentName}`);
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Rejection failed");
    }
  };

  const handleRemoveMember = async (memberId, memberName) => {
    if (!window.confirm(`Remove ${memberName} from this classroom?`)) return;
    try {
      await removeMember(id, memberId);
      toast.success(`Removed ${memberName}`);
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to remove member");
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setImportSummary(null);
    }
  };

  const handleRosterSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error("Please select a CSV or XLSX file first");
      return;
    }

    try {
      setImporting(true);
      const res = await importRoster(id, selectedFile);
      setImportSummary(res);
      toast.success(res.message || "Roster import processed successfully!");
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Roster upload failed");
    } finally {
      setImporting(false);
    }
  };

  const activeMembers = members.filter((m) => (m.membershipStatus || m.status) === "ACTIVE");

  const filteredMembers = activeMembers.filter((m) => {
    const query = searchQuery.toLowerCase();
    const nameMatch = m.studentName?.toLowerCase().includes(query);
    const usnMatch = m.usn?.toLowerCase().includes(query);
    const emailMatch = m.studentEmail?.toLowerCase().includes(query);
    return nameMatch || usnMatch || emailMatch;
  });

  return (
    <div className="classroom-workspace-page">
      <Navbar />
      <div className="workspace-main-container">
        {loading ? (
          <div className="workspace-loading-state">
            <div className="spinner-glow"></div>
            <p>Loading classroom management workspace...</p>
          </div>
        ) : !classroom ? (
          <div className="workspace-error-card">
            <h3>Classroom Not Found</h3>
            <p>The requested classroom could not be found or you do not have permission.</p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => navigate("/teacher/classrooms")}
            >
              Return to Classrooms
            </button>
          </div>
        ) : (
          <>
            {/* SHARED RESPONSIVE CLASSROOM HEADER */}
            <ClassroomHeader
              classroom={classroom}
              backLabel="← Back to Workspace Selection"
              onBack={() => navigate(`/teacher/classrooms/${id}/workspaces`)}
              workspaceTitle="Classroom Management"
              onRegenerateCode={handleRegenerate}
              regenerating={regenerating}
              showJoinCode={true}
            />

            {/* MANAGEMENT WORKSPACE PANEL */}
            <div className="tab-panel-container">
              <div className="management-subtabs-nav">
                <button
                  type="button"
                  className={`subtab-btn ${managementTab === "members" ? "active" : ""}`}
                  onClick={() => setManagementTab("members")}
                >
                  👥 Enrolled Students ({activeMembers.length})
                </button>
                <button
                  type="button"
                  className={`subtab-btn ${managementTab === "requests" ? "active" : ""}`}
                  onClick={() => setManagementTab("requests")}
                >
                  ⏳ Pending Requests ({joinRequests.length})
                </button>
                <button
                  type="button"
                  className={`subtab-btn ${managementTab === "import" ? "active" : ""}`}
                  onClick={() => setManagementTab("import")}
                >
                  📥 Roster Batch Import
                </button>
              </div>

              {/* SUBTAB 1: ENROLLED STUDENTS */}
              {managementTab === "members" && (
                <div>
                  <div className="members-controls-bar">
                    <input
                      type="text"
                      className="search-input"
                      placeholder="Search students by name, USN, or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <span className="members-count-badge">
                      Showing {filteredMembers.length} of {activeMembers.length}
                    </span>
                  </div>

                  {filteredMembers.length === 0 ? (
                    <div className="empty-subtab-state">
                      <p>
                        {activeMembers.length === 0
                          ? "No students have joined this classroom yet. Share the join code or import a roster."
                          : "No students match your search filter."}
                      </p>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="members-table">
                        <thead>
                          <tr>
                            <th>USN</th>
                            <th>Student Name</th>
                            <th>Email</th>
                            <th>Role / Status</th>
                            <th>Enrolled Date</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredMembers.map((m) => (
                            <tr key={m.membershipId || m.studentId || m.id}>
                              <td>
                                <span className="usn-badge">{m.usn || "N/A"}</span>
                              </td>
                              <td className="student-name-cell">{m.studentName}</td>
                              <td className="email-cell">{m.studentEmail}</td>
                              <td>
                                <div className="member-role-status-cell">
                                  <span className="member-role-badge">{m.role || "STUDENT"}</span>
                                  <span className={`member-status-pill status-${(m.membershipStatus || m.status || "active").toLowerCase()}`}>
                                    {(m.membershipStatus || m.status || "ACTIVE").toUpperCase()}
                                  </span>
                                </div>
                              </td>
                              <td>{m.joinedAt || m.approvedAt || m.createdAt ? new Date(m.joinedAt || m.approvedAt || m.createdAt).toLocaleDateString() : "Active"}</td>
                              <td>
                                <button
                                  type="button"
                                  className="btn-remove-member"
                                  onClick={() => handleRemoveMember(m.studentId || m.membershipId || m.id, m.studentName)}
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

              {/* SUBTAB 2: PENDING REQUESTS */}
              {managementTab === "requests" && (
                <div>
                  {joinRequests.length === 0 ? (
                    <div className="empty-subtab-state">
                      <p>No pending join requests at this moment.</p>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="members-table">
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
                            <tr key={req.id}>
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

              {/* SUBTAB 3: IMPORT ROSTER */}
              {managementTab === "import" && (
                <div>
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
            </div>
          </>
        )}
      </div>
    </div>
  );
}
