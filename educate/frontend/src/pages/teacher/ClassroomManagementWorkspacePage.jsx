import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../../components/Navbar";
import toast from "react-hot-toast";
import {
  getClassroomDetails,
  getClassroomMembers,
  removeMember,
  removeAllMembers,
  parseRoster,
  enrollBatch,
  addStudent,
  regenerateJoinCode,
} from "../../services/classroomService";
import ClassroomHeader from "../../components/classroom/ClassroomHeader";
import EvaluationSchemeConfig from "../../components/classroom/EvaluationSchemeConfig";
import ClassroomAnnouncementsSection from "../../components/classroom/ClassroomAnnouncementsSection";
import "./ClassroomWorkspace.css";

export default function ClassroomManagementWorkspacePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [classroom, setClassroom] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Subtab: "members" | "import" | "scheme" | "announcements"
  const urlSubtab = searchParams.get("subtab") || searchParams.get("tab");
  const [managementTab, setManagementTab] = useState(
    urlSubtab && ["members", "import", "scheme", "announcements"].includes(urlSubtab) ? urlSubtab : "members"
  );

  useEffect(() => {
    if (urlSubtab && ["members", "import", "scheme", "announcements"].includes(urlSubtab)) {
      setManagementTab(urlSubtab);
    }
  }, [urlSubtab]);

  const handleSubTabChange = (tabKey) => {
    setManagementTab(tabKey);
    setSearchParams({ subtab: tabKey });
  };

  // Search filter for members
  const [searchQuery, setSearchQuery] = useState("");

  // Classroom Import (Excel/CSV parse preview & batch enrollment) state
  const [selectedFile, setSelectedFile] = useState(null);
  const [parsingRoster, setParsingRoster] = useState(false);
  const [parsedRoster, setParsedRoster] = useState(null);
  const [enrollingBatch, setEnrollingBatch] = useState(false);
  const [addingMemberId, setAddingMemberId] = useState(null);

  // Remove All Students Modal State (For testing)
  const [showRemoveAllModal, setShowRemoveAllModal] = useState(false);
  const [removingAll, setRemovingAll] = useState(false);

  // Regeneration state
  const [regenerating, setRegenerating] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const [clsData, membersData] = await Promise.all([
        getClassroomDetails(id),
        getClassroomMembers(id).catch(() => []),
      ]);
      setClassroom(clsData);
      setMembers(membersData || []);
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

  const handleRemoveAllMembers = async () => {
    try {
      setRemovingAll(true);
      await removeAllMembers(id);
      toast.success("All students removed from classroom");
      setShowRemoveAllModal(false);
      setMembers([]);
      await loadData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to remove students");
    } finally {
      setRemovingAll(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setParsedRoster(null);
    }
  };

  const handleParseRoster = async (e) => {
    if (e) e.preventDefault();
    if (!selectedFile) {
      toast.error("Please select a CSV or XLSX file first");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      setParsingRoster(true);
      const result = await parseRoster(id, formData);
      setParsedRoster(result);
      toast.success(`Parsed ${result.totalRows} student(s) from ${result.filename}!`);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to parse roster file");
    } finally {
      setParsingRoster(false);
    }
  };

  const handleAddIndividualStudent = async (student, index) => {
    try {
      setAddingMemberId(student.usn || student.email || index);
      await addStudent(id, {
        usn: student.usn,
        email: student.email,
        name: student.name,
      });
      toast.success(`Enrolled ${student.name || student.usn || "student"} successfully!`);
      setParsedRoster((prev) => {
        if (!prev) return prev;
        const updatedList = [...prev.students];
        updatedList[index] = {
          ...updatedList[index],
          alreadyEnrolled: true,
          statusMessage: "Already Enrolled",
        };
        return {
          ...prev,
          alreadyEnrolledCount: prev.alreadyEnrolledCount + 1,
          students: updatedList,
        };
      });
      await loadData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to enroll student");
    } finally {
      setAddingMemberId(null);
    }
  };

  const handleAddAllStudents = async () => {
    if (!parsedRoster || !parsedRoster.students || parsedRoster.students.length === 0) return;
    const toAdd = parsedRoster.students
      .filter((s) => !s.alreadyEnrolled)
      .map((s) => ({ usn: s.usn, email: s.email, name: s.name }));

    if (toAdd.length === 0) {
      toast.info("All students in this file are already enrolled!");
      return;
    }

    try {
      setEnrollingBatch(true);
      const res = await enrollBatch(id, toAdd);
      toast.success(`Successfully enrolled ${res.addedCount || toAdd.length} student(s)!`);
      setParsedRoster((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          alreadyEnrolledCount: prev.students.length,
          students: prev.students.map((s) => ({
            ...s,
            alreadyEnrolled: true,
            statusMessage: "Already Enrolled",
          })),
        };
      });
      await loadData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to batch enroll students");
    } finally {
      setEnrollingBatch(false);
    }
  };

  const handleResetImport = () => {
    setSelectedFile(null);
    setParsedRoster(null);
    const fileInput = document.getElementById("rosterFileInput");
    if (fileInput) fileInput.value = "";
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
              workspaceTitle="Classroom Hub"
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
                  onClick={() => handleSubTabChange("members")}
                >
                  👥 Enrolled Students ({activeMembers.length})
                </button>
                <button
                  type="button"
                  className={`subtab-btn ${managementTab === "import" ? "active" : ""}`}
                  onClick={() => handleSubTabChange("import")}
                >
                  📥 Classroom Import
                </button>
                <button
                  type="button"
                  className={`subtab-btn ${managementTab === "scheme" ? "active" : ""}`}
                  onClick={() => handleSubTabChange("scheme")}
                >
                  ⚖️ Evaluation Scheme Configuration
                </button>
                <button
                  type="button"
                  className={`subtab-btn ${managementTab === "announcements" ? "active" : ""}`}
                  onClick={() => handleSubTabChange("announcements")}
                >
                  📢 Noticeboard &amp; Resources
                </button>
              </div>

              {/* SUBTAB 1: ENROLLED STUDENTS */}
              {managementTab === "members" && (
                <div>
                  <div className="members-controls-bar" style={{ display: "flex", alignItems: "center", gap: "14px" }}>
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

                    {activeMembers.length > 0 && (
                      <button
                        type="button"
                        className="btn-remove-all-members"
                        onClick={() => setShowRemoveAllModal(true)}
                        title="Remove all enrolled students from this classroom"
                      >
                        🗑️ Remove All Students
                      </button>
                    )}
                  </div>

                  {filteredMembers.length === 0 ? (
                    <div className="empty-subtab-state">
                      <p>
                        {activeMembers.length === 0
                          ? "No students have joined this classroom yet. Share the join code or use Classroom Import."
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
                            <th style={{ textAlign: "right" }}>Actions</th>
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
                              <td style={{ textAlign: "right" }}>
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

              {/* SUBTAB 2: CLASSROOM IMPORT */}
              {managementTab === "import" && (
                <div className="classroom-import-view">
                  {!parsedRoster ? (
                    <div className="import-box-card">
                      <div className="import-box-header">
                        <span className="import-header-icon">📥</span>
                        <div>
                          <h3>Classroom Import — Student Spreadsheet</h3>
                          <p>
                            Upload an Excel (<code>.xlsx</code> / <code>.xls</code>) or CSV (<code>.csv</code>) file with <strong>USN</strong> and <strong>Gmail / Email</strong> columns.
                            The system will parse the file, verify each student against existing records in the database, and display a preview list so you can add them individually or all at once.
                          </p>
                        </div>
                      </div>

                      <form onSubmit={handleParseRoster} className="roster-upload-form">
                        <div className="file-dropzone">
                          <input
                            type="file"
                            id="rosterFileInput"
                            accept=".csv,.xlsx,.xls"
                            onChange={handleFileChange}
                          />
                          <label htmlFor="rosterFileInput" className="dropzone-label">
                            <span className="dropzone-icon">📄</span>
                            <span className="dropzone-text">
                              {selectedFile ? `Selected: ${selectedFile.name}` : "Click or drop an Excel (.xlsx / .xls) or CSV file"}
                            </span>
                            <span className="dropzone-hint">
                              Supports standard columns: <code>USN</code> and <code>Gmail</code> (e.g. <code>1DB23CS192</code> | <code>skus0426@gmail.com</code>)
                            </span>
                          </label>
                        </div>

                        <div className="dropzone-actions-bar">
                          <button
                            type="submit"
                            className="btn-parse-roster"
                            disabled={!selectedFile || parsingRoster}
                          >
                            {parsingRoster ? "⏳ Parsing & Inspecting Database..." : "🔍 Parse & Check Students"}
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    <div className="parsed-roster-section">
                      {/* PARSED SUMMARY BANNER */}
                      <div className="parsed-summary-card">
                        <div className="parsed-summary-top">
                          <div className="file-info-col">
                            <span className="file-icon">📊</span>
                            <div>
                              <h4>{parsedRoster.filename}</h4>
                              <p className="file-parsed-meta">Parsed {parsedRoster.totalRows} student record(s) from spreadsheet</p>
                            </div>
                          </div>

                          <div className="parsed-actions-col">
                            <button
                              type="button"
                              className="btn-upload-new-file"
                              onClick={handleResetImport}
                            >
                              🔄 Upload Different File
                            </button>
                            <button
                              type="button"
                              className="btn-add-all-students"
                              onClick={handleAddAllStudents}
                              disabled={enrollingBatch || parsedRoster.students.filter((s) => !s.alreadyEnrolled).length === 0}
                            >
                              {enrollingBatch
                                ? "Enrolling All..."
                                : `➕ Add All Available Students (${parsedRoster.students.filter((s) => !s.alreadyEnrolled).length})`}
                            </button>
                          </div>
                        </div>

                        {/* STAT METRIC PILLS */}
                        <div className="parsed-metrics-grid">
                          <div className="metric-badge metric-total">
                            <span className="metric-label">Total in File</span>
                            <span className="metric-val">{parsedRoster.totalRows}</span>
                          </div>
                          <div className="metric-badge metric-matched">
                            <span className="metric-label">✓ In Database</span>
                            <span className="metric-val">{parsedRoster.matchedInDbCount}</span>
                          </div>
                          <div className="metric-badge metric-not-in-db">
                            <span className="metric-label">⚠️ Not In Database</span>
                            <span className="metric-val">{parsedRoster.notInDbCount}</span>
                          </div>
                          <div className="metric-badge metric-enrolled">
                            <span className="metric-label">👥 Already Enrolled</span>
                            <span className="metric-val">{parsedRoster.alreadyEnrolledCount}</span>
                          </div>
                        </div>
                      </div>

                      {/* PREVIEW STUDENT TABLE */}
                      <div className="table-responsive" style={{ marginTop: "24px" }}>
                        <table className="workspace-table roster-preview-table">
                          <thead>
                            <tr>
                              <th style={{ width: "50px" }}>#</th>
                              <th>USN</th>
                              <th>Student Name</th>
                              <th>Email / Gmail</th>
                              <th>Database Status</th>
                              <th style={{ textAlign: "right" }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {parsedRoster.students.map((s, idx) => (
                              <tr key={s.usn || s.email || idx}>
                                <td className="sl-no-cell"># {s.rowNumber || idx + 1}</td>
                                <td>
                                  <span className="usn-badge">{s.usn || "N/A"}</span>
                                </td>
                                <td className="student-name-cell">
                                  <strong>{s.name || (s.existsInDb ? "Registered Student" : "New Student")}</strong>
                                </td>
                                <td className="email-cell">{s.email || "N/A"}</td>
                                <td>
                                  {s.alreadyEnrolled ? (
                                    <span className="badge-already-enrolled">✓ Already Enrolled</span>
                                  ) : s.existsInDb ? (
                                    <span className="badge-in-db">✅ Registered in DB</span>
                                  ) : (
                                    <span className="badge-not-in-db">⚠️ New Account</span>
                                  )}
                                </td>
                                <td style={{ textAlign: "right" }}>
                                  {s.alreadyEnrolled ? (
                                    <span className="btn-enrolled-disabled">✓ Enrolled</span>
                                  ) : (
                                    <button
                                      type="button"
                                      className="btn-add-individual"
                                      onClick={() => handleAddIndividualStudent(s, idx)}
                                      disabled={addingMemberId === (s.usn || s.email || idx)}
                                    >
                                      {addingMemberId === (s.usn || s.email || idx) ? "Adding..." : "+ Add Member"}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SUBTAB 3: EVALUATION SCHEME CONFIGURATION */}
              {managementTab === "scheme" && (
                <div style={{ padding: "8px 0" }}>
                  <EvaluationSchemeConfig classroomId={id} isTeacher={true} />
                </div>
              )}

              {/* SUBTAB 4: CLASSROOM NOTICEBOARD & RESOURCE BROADCAST */}
              {managementTab === "announcements" && (
                <div style={{ padding: "8px 0" }}>
                  <ClassroomAnnouncementsSection classroomId={id} isTeacher={true} />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* REMOVE ALL STUDENTS CONFIRMATION MODAL */}
      {showRemoveAllModal && (
        <div className="modal-backdrop" onClick={() => !removingAll && setShowRemoveAllModal(false)}>
          <div className="modal-content-card modal-delete-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🗑️ Remove All Students</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowRemoveAllModal(false)}
                disabled={removingAll}
              >
                ✕
              </button>
            </div>

            <div className="delete-modal-body">
              <p>Are you sure you want to remove all students from this classroom?</p>
              <div className="delete-classroom-highlight">
                <strong>{classroom?.name}</strong> — {activeMembers.length} enrolled student(s)
              </div>
              <p className="delete-warning-text">
                ⚠️ This will unenroll all currently enrolled students from this classroom. You can re-enroll them anytime using Classroom Import or Quick Add.
              </p>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowRemoveAllModal(false)}
                disabled={removingAll}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger-confirm"
                onClick={handleRemoveAllMembers}
                disabled={removingAll}
              >
                {removingAll ? "Removing All..." : "Yes, Remove All Students"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
