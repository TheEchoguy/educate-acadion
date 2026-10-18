import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
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
} from "../../services/classroomService";
import "./ClassroomWorkspace.css";
import TeacherSyllabusManagement from "../../components/syllabus/TeacherSyllabusManagement";
import TeacherSyllabusSchedulingSection from "../../components/syllabus/TeacherSyllabusSchedulingSection";
import ClassroomHeader from "../../components/classroom/ClassroomHeader";

function ClassroomWorkspace() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  const [classroom, setClassroom] = useState(null);
  const [members, setMembers] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Section 1: "management" | Section 2: "syllabus" | Section 3: "scheduling"
  const sParam = searchParams.get("section");
  const tParam = searchParams.get("tab") || location.state?.tab;
  const subParam = searchParams.get("subtab");

  let activeSection = "syllabus";
  if (sParam === "management" || (tParam && ["members", "requests", "import"].includes(tParam))) {
    activeSection = "management";
  } else if (sParam === "scheduling" || tParam === "scheduling") {
    activeSection = "scheduling";
  } else if (sParam === "syllabus" || tParam === "syllabus") {
    activeSection = "syllabus";
  }

  // Management SubTab: "members" | "requests" | "import"
  let managementTab = "members";
  if (subParam && ["members", "requests", "import"].includes(subParam)) {
    managementTab = subParam;
  } else if (tParam && ["members", "requests", "import"].includes(tParam)) {
    managementTab = tParam;
  }

  const handleSectionChange = (section) => {
    if (section === "management") {
      setSearchParams({ section: "management", subtab: managementTab });
    } else {
      setSearchParams({ section });
    }
  };

  const handleManagementTabChange = (subtab) => {
    setSearchParams({ section: "management", subtab });
  };

  // Search filter for members
  const [searchQuery, setSearchQuery] = useState("");

  // Roster file upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);

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

  useEffect(() => {
    let active = true;
    Promise.all([
      getClassroomDetails(id),
      getClassroomMembers(id).catch(() => []),
      getJoinRequests(id).catch(() => []),
    ])
      .then(([clsData, membersData, requestsData]) => {
        if (active) {
          setClassroom(clsData);
          setMembers(membersData || []);
          setJoinRequests(requestsData || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error(err);
        if (active) {
          toast.error(err.response?.data?.message || "Failed to load classroom details");
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [id]);

  const handleApprove = async (studentId, studentName) => {
    try {
      await approveJoinRequest(id, studentId);
      toast.success(`Approved ${studentName || "student"} successfully!`);
      await loadClassroomData();
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
        {loading ? (
          <div className="workspace-loading">
            <div className="spinner"></div>
            <p>Loading classroom workspace...</p>
          </div>
        ) : !classroom ? (
          <div className="workspace-error">Classroom not found.</div>
        ) : (
          <>
            <ClassroomHeader
              classroom={classroom}
              onBack={() => navigate("/teacher/classrooms")}
              onCodeRegenerated={(newCode) => setClassroom((prev) => ({ ...prev, joinCode: newCode }))}
            />

            {/* THREE CLEARLY SEPARATED TOP-LEVEL WORKSPACE SECTIONS */}
            <div className="workspace-top-sections-row">
              <button
                type="button"
                className={`top-section-btn ${activeSection === "management" ? "active" : ""}`}
                onClick={() => handleSectionChange("management")}
              >
                <span className="section-icon">🏫</span>
                <span className="section-label">Classroom Management</span>
                {joinRequests.length > 0 && (
                  <span className="tab-count-pill" title={`${joinRequests.length} pending join requests`}>
                    {joinRequests.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                className={`top-section-btn ${activeSection === "syllabus" ? "active" : ""}`}
                onClick={() => handleSectionChange("syllabus")}
              >
                <span className="section-icon">📖</span>
                <span className="section-label">Syllabus Tracking</span>
              </button>

              <button
                type="button"
                className={`top-section-btn ${activeSection === "scheduling" ? "active" : ""}`}
                onClick={() => handleSectionChange("scheduling")}
              >
                <span className="section-icon">🗓️</span>
                <span className="section-label">Syllabus Scheduling</span>
                <span className="section-stage-badge">New</span>
              </button>
            </div>

            {/* SECTION 1: CLASSROOM MANAGEMENT */}
            {activeSection === "management" && (
              <div className="tab-panel-container">
                {/* SUBTABS: ENROLLED STUDENTS | JOIN REQUESTS | IMPORT ROSTER */}
                <div className="workspace-subtabs-row">
                  <button
                    type="button"
                    className={`subtab-btn ${managementTab === "members" ? "active" : ""}`}
                    onClick={() => handleManagementTabChange("members")}
                  >
                    👥 Enrolled Students ({activeMembers.length})
                  </button>

                  <button
                    type="button"
                    className={`subtab-btn ${managementTab === "requests" ? "active" : ""}`}
                    onClick={() => handleManagementTabChange("requests")}
                  >
                    ⏳ Join Requests {joinRequests.length > 0 && <span className="tab-count-pill">{joinRequests.length}</span>}
                  </button>

                  <button
                    type="button"
                    className={`subtab-btn ${managementTab === "import" ? "active" : ""}`}
                    onClick={() => handleManagementTabChange("import")}
                  >
                    📥 Import Roster (CSV/XLSX)
                  </button>
                </div>

                {/* SUBTAB 1: MEMBERS */}
                {managementTab === "members" && (
                  <div>
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
                    <button className="btn-tab-action" onClick={() => handleManagementTabChange("import")}>
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
                          <th>Role / Status</th>
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
                              <div className="member-role-status-cell">
                                <span className="member-role-badge">{m.role || "STUDENT"}</span>
                                <span className="status-pill-green">{(m.membershipStatus || m.status || "ACTIVE").toUpperCase()}</span>
                              </div>
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

            {/* SUBTAB 2: JOIN REQUESTS */}
            {managementTab === "requests" && (
              <div>
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
              </div>
            )}

            {/* SECTION 2: SYLLABUS TRACKING */}
            {activeSection === "syllabus" && (
              <div className="tab-panel-container" style={{ padding: "28px" }}>
                <TeacherSyllabusManagement
                  classroomId={id}
                  classroom={classroom}
                  onNavigateToScheduling={() => handleSectionChange("scheduling")}
                />
              </div>
            )}

            {/* SECTION 3: SYLLABUS SCHEDULING */}
            {activeSection === "scheduling" && (
              <div className="tab-panel-container" style={{ padding: "28px" }}>
                <TeacherSyllabusSchedulingSection
                  classroom={classroom}
                  onNavigateToSyllabus={() => handleSectionChange("syllabus")}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default ClassroomWorkspace;
