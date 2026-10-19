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
  uploadRoster,
  addStudent,
  regenerateJoinCode,
  updateClassroom,
  deleteClassroom,
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
  const [regenerating, setRegenerating] = useState(false);

  // Edit & Delete Classroom Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: "",
    subjectName: "",
    subjectCode: "",
    department: "",
    semester: "1",
    section: "A",
    academicBatch: "",
    status: "ACTIVE",
    joinCodeEnabled: true,
  });
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingClassroom, setDeletingClassroom] = useState(false);

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

  // Quick Add Student State
  const [quickStudent, setQuickStudent] = useState({ usn: "", email: "", name: "" });
  const [addingStudent, setAddingStudent] = useState(false);

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

  const handleCopyCode = () => {
    if (!classroom?.joinCode) return;
    navigator.clipboard.writeText(classroom.joinCode);
    toast.success(`Join Code ${classroom.joinCode} copied to clipboard!`);
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

  const handleOpenEditModal = () => {
    if (!classroom) return;
    setEditFormData({
      name: classroom.name || "",
      subjectName: classroom.subjectName || "",
      subjectCode: classroom.subjectCode || "",
      department: classroom.department || "",
      semester: classroom.semester ? String(classroom.semester) : "1",
      section: classroom.section || "A",
      academicBatch: classroom.academicBatch || classroom.academicYear || "",
      status: classroom.status || "ACTIVE",
      joinCodeEnabled: classroom.joinCodeEnabled !== false,
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editFormData.name.trim() || !editFormData.subjectName.trim()) {
      toast.error("Classroom name and subject name are required");
      return;
    }

    try {
      setEditSubmitting(true);
      const updated = await updateClassroom(id, editFormData);
      setClassroom(updated);
      setShowEditModal(false);
      toast.success("Classroom settings updated successfully!");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to update classroom settings");
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteSubmit = async () => {
    try {
      setDeletingClassroom(true);
      await deleteClassroom(id);
      toast.success("Classroom deleted successfully");
      setShowDeleteModal(false);
      navigate("/teacher/classrooms");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to delete classroom");
    } finally {
      setDeletingClassroom(false);
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
    }
  };

  const handleRosterSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error("Please select a valid CSV or XLSX roster file first");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      setImporting(true);
      const summary = await uploadRoster(id, formData);
      setImportSummary(summary);
      toast.success(
        `Roster Uploaded! ${summary.totalProcessed || summary.totalRows} processed (${summary.existingVerifiedUsersLinked || summary.addedCount || 0} verified in DB, ${summary.newStudentAccountsCreated || 0} new accounts created)`
      );
      setSelectedFile(null);
      // Reset file input element
      const fileInput = document.getElementById("excelRosterInput") || document.getElementById("rosterFileInput");
      if (fileInput) fileInput.value = "";
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
      toast.error(err.response?.data?.message || "Failed to approve student");
    }
  };

  const handleReject = async (studentId, studentName) => {
    if (!window.confirm(`Reject join request for ${studentName || "this student"}?`)) {
      return;
    }

    try {
      await rejectJoinRequest(id, studentId);
      toast.success(`Rejected join request for ${studentName || "student"}`);
      loadClassroomData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to reject request");
    }
  };

  const handleRemove = async (studentId, studentName) => {
    if (!window.confirm(`Remove ${studentName || "this student"} from this classroom?`)) {
      return;
    }

    try {
      await removeMember(id, studentId);
      toast.success(`Removed ${studentName || "student"} from classroom`);
      loadClassroomData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to remove member");
    }
  };

  // Filter members list based on search query
  const activeMembers = members.filter((m) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const nameMatch = m.studentName?.toLowerCase().includes(q);
    const emailMatch = m.studentEmail?.toLowerCase().includes(q);
    const usnMatch = m.usn?.toLowerCase().includes(q);
    return nameMatch || emailMatch || usnMatch;
  });

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
            {/* UNIFIED HERO HEADER WITH JOIN CODE DISPLAY */}
            <ClassroomHeader
              classroom={classroom}
              onBack={() => navigate("/teacher/classrooms")}
              onRegenerateCode={handleRegenerateCode}
              regenerating={regenerating}
              showJoinCode={true}
              onEditClassroom={handleOpenEditModal}
              onDeleteClassroom={() => setShowDeleteModal(true)}
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
                                Total Processed: <strong>{importSummary.totalProcessed || importSummary.totalRows || 0}</strong>
                              </span>
                              <span className="summary-pill verified">
                                ✓ Verified DB Users: <strong>{importSummary.existingVerifiedUsersLinked || importSummary.addedCount || 0}</strong>
                              </span>
                              <span className="summary-pill created">
                                + New Accounts Created: <strong>{importSummary.newStudentAccountsCreated || 0}</strong>
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

                {/* SUBTAB 2: JOIN REQUESTS */}
                {managementTab === "requests" && (
                  <div>
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

                {/* SUBTAB 3: IMPORT ROSTER */}
                {managementTab === "import" && (
                  <div>
                    <div className="import-box-card">
                      <h3>Batch Enroll Students via Roster Upload</h3>
                      <p>
                        Upload an institutional Excel (<code>.xlsx</code>) or CSV (<code>.csv</code>) file containing student USNs.
                        Existing student accounts matching the USN will be automatically enrolled, or new verified student accounts will be created.
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
                              Supports standard CSV or multi-row sheets like <code>Iot-7A-SplitupMarks.xlsx</code>
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

                    {/* LIVE IMPORT SUMMARY BANNER */}
                    {importSummary && (
                      <div className="live-summary-banner" style={{ marginTop: "20px" }}>
                        <div className="summary-badge-group">
                          <span className="summary-pill total">
                            Total Processed: <strong>{importSummary.totalProcessed || importSummary.totalRows || 0}</strong>
                          </span>
                          <span className="summary-pill verified">
                            ✓ Verified DB Users: <strong>{importSummary.existingVerifiedUsersLinked || importSummary.addedCount || 0}</strong>
                          </span>
                          <span className="summary-pill created">
                            + New Accounts Created: <strong>{importSummary.newStudentAccountsCreated || 0}</strong>
                          </span>
                        </div>
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

      {/* EDIT CLASSROOM SETTINGS MODAL */}
      {showEditModal && (
        <div className="modal-backdrop" onClick={() => setShowEditModal(false)}>
          <div className="modal-content-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>⚙️ Edit Classroom Settings</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowEditModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="create-classroom-form">
              <div className="form-group">
                <label>Classroom Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 5th Sem CS-A"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Subject Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Database Systems"
                    value={editFormData.subjectName}
                    onChange={(e) => setEditFormData({ ...editFormData, subjectName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Subject Code</label>
                  <input
                    type="text"
                    placeholder="e.g. CS501"
                    value={editFormData.subjectCode}
                    onChange={(e) => setEditFormData({ ...editFormData, subjectCode: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row-3">
                <div className="form-group">
                  <label>Department</label>
                  <input
                    type="text"
                    placeholder="e.g. CSE"
                    value={editFormData.department}
                    onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Semester</label>
                  <select
                    value={editFormData.semester}
                    onChange={(e) => setEditFormData({ ...editFormData, semester: e.target.value })}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={s}>
                        Semester {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Section</label>
                  <input
                    type="text"
                    placeholder="e.g. A"
                    value={editFormData.section}
                    onChange={(e) => setEditFormData({ ...editFormData, section: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Academic Batch / Year</label>
                  <input
                    type="text"
                    placeholder="e.g. 2024-2025"
                    value={editFormData.academicBatch}
                    onChange={(e) => setEditFormData({ ...editFormData, academicBatch: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </div>
              </div>

              <div className="form-group checkbox-form-group">
                <label className="checkbox-label-row">
                  <input
                    type="checkbox"
                    checked={editFormData.joinCodeEnabled}
                    onChange={(e) => setEditFormData({ ...editFormData, joinCodeEnabled: e.target.checked })}
                  />
                  <span>Allow student self-enrollment via Join Code</span>
                </label>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={editSubmitting}
                >
                  {editSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteModal && (
        <div className="modal-backdrop" onClick={() => !deletingClassroom && setShowDeleteModal(false)}>
          <div className="modal-content-card modal-delete-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🗑️ Delete Classroom</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowDeleteModal(false)}
                disabled={deletingClassroom}
              >
                ✕
              </button>
            </div>

            <div className="delete-modal-body">
              <p>Are you sure you want to permanently delete this classroom?</p>
              <div className="delete-classroom-highlight">
                <strong>{classroom?.name}</strong> ({classroom?.subjectCode ? `${classroom.subjectCode} - ` : ""}{classroom?.subjectName})
              </div>
              <p className="delete-warning-text">
                ⚠️ This will permanently remove the classroom along with student memberships and enrollment records. This action cannot be undone.
              </p>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowDeleteModal(false)}
                disabled={deletingClassroom}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger-confirm"
                onClick={handleDeleteSubmit}
                disabled={deletingClassroom}
              >
                {deletingClassroom ? "Deleting..." : "Permanently Delete Classroom"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClassroomWorkspace;
