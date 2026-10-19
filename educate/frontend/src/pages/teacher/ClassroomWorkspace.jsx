import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import Navbar from "../../components/Navbar";
import toast from "react-hot-toast";
import {
  getClassroomDetails,
  getClassroomMembers,
  removeMember,
  removeAllMembers,
  addStudent,
  parseRoster,
  enrollBatch,
  regenerateJoinCode,
  updateClassroom,
  deleteClassroom,
} from "../../services/classroomService";
import "./ClassroomWorkspace.css";
import TeacherSyllabusManagement from "../../components/syllabus/TeacherSyllabusManagement";
import TeacherSyllabusSchedulingSection from "../../components/syllabus/TeacherSyllabusSchedulingSection";
import EvaluationSchemeConfig from "../../components/classroom/EvaluationSchemeConfig";
import IaMarksUploadSection from "../../components/classroom/IaMarksUploadSection";
import ClassroomHeader from "../../components/classroom/ClassroomHeader";

function ClassroomWorkspace() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  const [classroom, setClassroom] = useState(null);
  const [members, setMembers] = useState([]);
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

  // Remove All Students Modal State
  const [showRemoveAllModal, setShowRemoveAllModal] = useState(false);
  const [removingAll, setRemovingAll] = useState(false);

  // Section 1: "management" | Section 2: "syllabus" | Section 3: "scheduling"
  const sParam = searchParams.get("section");
  const tParam = searchParams.get("tab") || location.state?.tab;
  const subParam = searchParams.get("subtab");

  let activeSection = "syllabus";
  if (sParam === "management" || (tParam && ["members", "import", "iamarks"].includes(tParam))) {
    activeSection = "management";
  } else if (sParam === "scheduling" || tParam === "scheduling") {
    activeSection = "scheduling";
  } else if (sParam === "scheme" || tParam === "scheme") {
    activeSection = "scheme";
  } else if (sParam === "iamarks" || sParam === "intelligence" || tParam === "iamarks") {
    activeSection = "management";
  } else if (sParam === "syllabus" || tParam === "syllabus") {
    activeSection = "syllabus";
  }

  // Management SubTab: "members" | "import" | "iamarks"
  let managementTab = "members";
  if (subParam && ["members", "import", "iamarks"].includes(subParam)) {
    managementTab = subParam;
  } else if (tParam && ["members", "import", "iamarks"].includes(tParam)) {
    managementTab = tParam;
  } else if (sParam === "iamarks" || sParam === "intelligence") {
    managementTab = "iamarks";
  }

  const handleSectionChange = (section) => {
    if (section === "management") {
      setSearchParams({ section: "management", subtab: managementTab });
    } else if (section === "iamarks") {
      setSearchParams({ section: "management", subtab: "iamarks" });
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

  // Classroom Import (Excel/CSV parse preview & batch enrollment) state
  const [selectedFile, setSelectedFile] = useState(null);
  const [parsingRoster, setParsingRoster] = useState(false);
  const [parsedRoster, setParsedRoster] = useState(null);
  const [enrollingBatch, setEnrollingBatch] = useState(false);
  const [addingMemberId, setAddingMemberId] = useState(null);

  const loadClassroomData = async () => {
    try {
      setLoading(true);
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
  };

  useEffect(() => {
    let active = true;
    Promise.all([
      getClassroomDetails(id),
      getClassroomMembers(id).catch(() => []),
    ])
      .then(([clsData, membersData]) => {
        if (active) {
          setClassroom(clsData);
          setMembers(membersData || []);
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
      setParsedRoster(null);
    }
  };

  const handleParseRoster = async (e) => {
    if (e) e.preventDefault();
    if (!selectedFile) {
      toast.error("Please select a valid CSV or XLSX roster file first");
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
      loadClassroomData();
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
      loadClassroomData();
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
    const fileInput = document.getElementById("excelRosterInput") || document.getElementById("rosterFileInput");
    if (fileInput) fileInput.value = "";
  };

  const handleRemoveAllMembers = async () => {
    try {
      setRemovingAll(true);
      await removeAllMembers(id);
      toast.success("All students removed from classroom");
      setShowRemoveAllModal(false);
      setMembers([]);
      loadClassroomData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to remove students");
    } finally {
      setRemovingAll(false);
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

              <button
                type="button"
                className={`top-section-btn ${activeSection === "scheme" ? "active" : ""}`}
                onClick={() => handleSectionChange("scheme")}
              >
                <span className="section-icon">⚖️</span>
                <span className="section-label">Evaluation Scheme</span>
              </button>

              <button
                type="button"
                className={`top-section-btn ${activeSection === "iamarks" || (activeSection === "management" && managementTab === "iamarks") ? "active" : ""}`}
                onClick={() => handleSectionChange("iamarks")}
              >
                <span className="section-icon">📊</span>
                <span className="section-label">IA Split-Up Marks</span>
                <span className="section-stage-badge">Feature 2</span>
              </button>
            </div>

            {/* SECTION 1: CLASSROOM MANAGEMENT */}
            {activeSection === "management" && (
              <div className="tab-panel-container">
                {/* SUBTABS: ENROLLED STUDENTS | CLASSROOM IMPORT | IA SPLIT-UP MARKS */}
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
                    className={`subtab-btn ${managementTab === "import" ? "active" : ""}`}
                    onClick={() => handleManagementTabChange("import")}
                  >
                    📥 Classroom Import
                  </button>

                  <button
                    type="button"
                    className={`subtab-btn ${managementTab === "iamarks" ? "active" : ""}`}
                    onClick={() => handleManagementTabChange("iamarks")}
                  >
                    📊 IA Split-Up Marks
                  </button>
                </div>

                {/* SUBTAB 1: ENROLLED STUDENTS */}
                {managementTab === "members" && (
                  <div>
                    {/* QUICK ADD SINGLE STUDENT BOX */}
                    <div className="roster-card quick-add-box" style={{ marginBottom: "20px" }}>
                      <div className="roster-card-header">
                        <span className="roster-card-icon">👤</span>
                        <div>
                          <h3>Quick Add Single Student</h3>
                          <p>Enroll student directly by USN (e.g. <code>1DB23CS007</code>) or Email address</p>
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

                    {/* SEARCH & CONTROLS ROW */}
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

                    {/* ENROLLED STUDENTS TABLE */}
                    {activeMembers.length === 0 ? (
                      <div className="empty-tab-notice">
                        <div className="empty-icon-lg">👥</div>
                        <h4>No Enrolled Students Yet</h4>
                        <p>Use the <strong>Classroom Import</strong> tab to upload an Excel file or use Quick Add above.</p>
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
                                  <td className="sl-no-cell">{s.rowNumber || idx + 1}</td>
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

                {/* SUBTAB 3: IA SPLIT-UP MARKS & MODULE MAPPER */}
                {managementTab === "iamarks" && (
                  <IaMarksUploadSection
                    classroomId={id}
                    classroomName={classroom?.name}
                    enrolledStudents={activeMembers}
                  />
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

            {/* SECTION 4: EVALUATION SCHEME */}
            {activeSection === "scheme" && (
              <div className="tab-panel-container" style={{ padding: "28px" }}>
                <EvaluationSchemeConfig classroomId={id} isTeacher={true} />
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

export default ClassroomWorkspace;
