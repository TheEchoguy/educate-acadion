import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { jwtDecode } from "jwt-decode";
import {
  getEnrichedResponses,
  evaluateResponse,
  verifyTeacherAccess,
  getMySubjects,
  sendEvaluationEmail,
  exportEvaluationExcel,
  getEvaluationSummary,
  grantReExam,
} from "../../services/evaluationService";
import { getAllPapers, getPaperById } from "../../services/paperService";
import { exportEvaluatedSubmissionPdf } from "../../utils/pdfGenerator";
import "./EvaluateResponses.css";

function EvaluateResponses() {
  const navigate = useNavigate();

  // Extract Teacher Email from sessionStorage, localStorage or Token
  const token = sessionStorage.getItem("token") || localStorage.getItem("token") || "";
  let decodedEmail = "";
  let decodedName = "";
  let decodedRole = "";
  if (token) {
    try {
      const decoded = jwtDecode(token);
      decodedEmail = decoded.sub || "";
      decodedName = decoded.name || "";
      decodedRole = decoded.role || "";
    } catch (e) {}
  }

  const teacherEmail = sessionStorage.getItem("email") || localStorage.getItem("email") || decodedEmail;
  const teacherName = sessionStorage.getItem("name") || localStorage.getItem("name") || decodedName || "Faculty Member";

  const [isVerified, setIsVerified] = useState(() => {
    const persisted = localStorage.getItem(`teacher_verified_${teacherEmail}`) || sessionStorage.getItem(`teacher_verified_${teacherEmail}`);
    const sessionVal = sessionStorage.getItem("teacher_verified_subject");
    return persisted === "true" || Boolean(sessionVal);
  });

  // Teacher Profile & Authorized Subjects from Backend
  const [teacherProfile, setTeacherProfile] = useState(null);
  const [authorizedSubjects, setAuthorizedSubjects] = useState([]);
  const [profileLoading, setProfileLoading] = useState(true);

  // Verification Form State
  const [verifyPassword, setVerifyPassword] = useState("");
  const [verifySubject, setVerifySubject] = useState(
    sessionStorage.getItem("teacher_verified_subject") || ""
  );
  const [verifySemester, setVerifySemester] = useState(
    sessionStorage.getItem("teacher_verified_semester") || "ALL"
  );
  const [verifyLoading, setVerifyLoading] = useState(false);

  // Main Data States
  const [papers, setPapers] = useState([]);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL, PENDING, EVALUATED
  const [selectedSemester, setSelectedSemester] = useState("ALL");
  const [selectedSubject, setSelectedSubject] = useState(verifySubject || "ALL");

  // Active Evaluation Modal State
  const [activeModalResponse, setActiveModalResponse] = useState(null);
  const [activePaperDetails, setActivePaperDetails] = useState(null);
  const [modalMarks, setModalMarks] = useState({});
  const [modalFeedbacks, setModalFeedbacks] = useState({});
  const [savingKey, setSavingKey] = useState(null);
  const [sendingEmailId, setSendingEmailId] = useState(null);
  const [exportingExcel, setExportingExcel] = useState(false);

  // Overall Summary Modal State
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Re-Exam Grant Modal State
  const [reExamTarget, setReExamTarget] = useState(null);
  const [reExamReason, setReExamReason] = useState("");
  const [grantingReExam, setGrantingReExam] = useState(false);

  // Load Teacher's Authorized Subjects from Backend
  useEffect(() => {
    fetchTeacherSubjects();
    fetchPapers();
  }, [teacherEmail]);

  // Fetch responses when verified
  useEffect(() => {
    if (isVerified) {
      fetchEnrichedResponses();
    }
  }, [isVerified, selectedSemester, selectedSubject]);

  const fetchTeacherSubjects = async () => {
    if (!teacherEmail) {
      setProfileLoading(false);
      return;
    }
    try {
      setProfileLoading(true);
      const data = await getMySubjects(teacherEmail);
      setTeacherProfile(data);
      const subs = data.assignedSubjects || [];
      setAuthorizedSubjects(subs);
      if (subs.length > 0 && !verifySubject) {
        setVerifySubject(subs[0]);
      }
    } catch (err) {
      console.error("Failed to load teacher subjects:", err);
    } finally {
      setProfileLoading(false);
    }
  };

  const fetchPapers = async () => {
    try {
      const data = await getAllPapers();
      setPapers(data || []);
    } catch (err) {
      console.error("Failed to load question papers:", err);
    }
  };

  const fetchEnrichedResponses = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedSemester && selectedSemester !== "ALL") {
        params.semester = Number(selectedSemester);
      }
      if (selectedSubject && selectedSubject !== "ALL") {
        params.subject = selectedSubject;
      }

      const data = await getEnrichedResponses(params);
      const cleanData = (data || []).filter(
        (r) =>
          !r.usn?.toUpperCase().includes("ADMIN") &&
          !r.paperId?.toUpperCase().includes("SMOKE") &&
          !r.subject?.toUpperCase().includes("SMOKE") &&
          !r.studentName?.toUpperCase().includes("ADMIN")
      );
      setResponses(cleanData);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load student responses");
    } finally {
      setLoading(false);
    }
  };

  // Handle Teacher Identity & Subject Verification
  const handleTeacherVerify = async (e) => {
    e.preventDefault();
    if (!verifyPassword) {
      toast.error("Please enter your teacher account password");
      return;
    }

    if (!verifySubject) {
      toast.error("Please select the authorized subject you are evaluating");
      return;
    }

    try {
      setVerifyLoading(true);
      const payload = {
        email: teacherEmail,
        password: verifyPassword,
        subject: verifySubject,
        semester: Number(verifySemester) || null,
      };

      const res = await verifyTeacherAccess(payload);
      toast.success(res.message || "Teacher verified successfully!");

      sessionStorage.setItem("teacher_verified_subject", verifySubject);
      sessionStorage.setItem("teacher_verified_semester", verifySemester);
      localStorage.setItem(`teacher_verified_${teacherEmail}`, "true");
      setSelectedSubject(verifySubject);
      setSelectedSemester(verifySemester);
      setIsVerified(true);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Verification Failed";
      toast.error(msg);
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleResetVerification = () => {
    sessionStorage.removeItem("teacher_verified_subject");
    sessionStorage.removeItem("teacher_verified_semester");
    setIsVerified(false);
    setVerifyPassword("");
  };

  // Open Question Evaluation Modal for a student
  const handleOpenEvaluationModal = async (resp) => {
    setActiveModalResponse(resp);

    const marksObj = {};
    const feedbackObj = {};
    if (resp.responses) {
      resp.responses.forEach((ans) => {
        marksObj[ans.questionId] = ans.marksObtained != null ? ans.marksObtained : 0;
        feedbackObj[ans.questionId] = ans.feedback || "";
      });
    }
    setModalMarks(marksObj);
    setModalFeedbacks(feedbackObj);

    try {
      const paperData = await getPaperById(resp.paperId);
      setActivePaperDetails(paperData);
    } catch (err) {
      setActivePaperDetails(null);
    }
  };

  const handleSaveQuestionScore = async (questionId) => {
    if (!activeModalResponse) return;
    const key = `${activeModalResponse.id}-${questionId}`;
    try {
      setSavingKey(key);
      const payload = {
        responseId: activeModalResponse.id,
        questionId: questionId,
        marksObtained: Number(modalMarks[questionId] || 0),
        feedback: modalFeedbacks[questionId] || "",
        evaluatedBy: teacherName,
      };

      const updated = await evaluateResponse(payload);
      toast.success(`Score for ${questionId} saved!`);

      setActiveModalResponse((prev) => ({
        ...prev,
        totalMarks: updated.totalMarks,
        evaluationCompleted: updated.evaluationCompleted,
        responses: updated.responses,
      }));

      fetchEnrichedResponses();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save score");
    } finally {
      setSavingKey(null);
    }
  };

  const handleSaveAllScoresAndNotify = async (sendEmail = false) => {
    if (!activeModalResponse || !activeModalResponse.responses) return;

    try {
      setSavingKey("all");
      for (const ans of activeModalResponse.responses) {
        const payload = {
          responseId: activeModalResponse.id,
          questionId: ans.questionId,
          marksObtained: Number(modalMarks[ans.questionId] || 0),
          feedback: modalFeedbacks[ans.questionId] || "",
          evaluatedBy: teacherName,
        };
        await evaluateResponse(payload);
      }

      toast.success("All question scores saved successfully!");

      if (sendEmail) {
        try {
          await sendEvaluationEmail(activeModalResponse.id);
          toast.success(`Scorecard emailed to ${activeModalResponse.studentName}!`);
        } catch (emailErr) {
          toast.error("Scores saved, but email notification failed to deliver.");
        }
      }

      setActiveModalResponse(null);
      fetchEnrichedResponses();
    } catch (err) {
      toast.error("Failed to complete evaluation");
    } finally {
      setSavingKey(null);
    }
  };

  const handleSendEmailNotification = async (responseId, studentName) => {
    try {
      setSendingEmailId(responseId);
      const res = await sendEvaluationEmail(responseId);
      toast.success(res.message || `Scorecard sent to ${studentName}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send email");
    } finally {
      setSendingEmailId(null);
    }
  };

  const handleDownloadEvaluatedPdf = (resp) => {
    try {
      const studentInfo = {
        name: resp.studentName || resp.usn,
        usn: resp.usn,
        department: resp.department || "Computer Science",
      };
      const matchedPaper = papers.find(
        (p) => p.paperId?.toLowerCase() === resp.paperId?.toLowerCase() || p.id === resp.paperId
      );
      exportEvaluatedSubmissionPdf(
        resp,
        studentInfo,
        matchedPaper?.questions || resp.responses || []
      );
      toast.success(`Evaluated Answer Paper PDF downloaded for ${resp.usn}!`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast.error("Failed to generate evaluated PDF");
    }
  };

  const handleExportExcel = async () => {
    try {
      setExportingExcel(true);
      const params = {};
      if (selectedSemester && selectedSemester !== "ALL") params.semester = Number(selectedSemester);
      if (selectedSubject && selectedSubject !== "ALL") params.subject = selectedSubject;

      const blobData = await exportEvaluationExcel(params);
      const url = window.URL.createObjectURL(new Blob([blobData]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `Evaluation_Report_${selectedSubject || "Class"}_Sem${selectedSemester || "All"}.xlsx`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Evaluation Excel Report downloaded successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export Excel report");
    } finally {
      setExportingExcel(false);
    }
  };

  const handleConfirmGrantReExam = async () => {
    if (!reExamTarget) return;
    try {
      setGrantingReExam(true);
      const res = await grantReExam(reExamTarget.id, reExamReason);
      toast.success(res.message || `Re-exam attempt granted for ${reExamTarget.studentName}!`);
      setReExamTarget(null);
      setReExamReason("");
      fetchEnrichedResponses();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to grant re-exam");
    } finally {
      setGrantingReExam(false);
    }
  };

  const handleOpenSummary = async () => {
    setShowSummaryModal(true);
    try {
      setSummaryLoading(true);
      const params = {};
      if (selectedSemester && selectedSemester !== "ALL") params.semester = Number(selectedSemester);
      if (selectedSubject && selectedSubject !== "ALL") params.subject = selectedSubject;

      const data = await getEvaluationSummary(params);
      setSummaryData(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load evaluation summary");
    } finally {
      setSummaryLoading(false);
    }
  };

  const filteredList = useMemo(() => {
    return responses.filter((r) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        r.usn?.toLowerCase().includes(q) ||
        r.studentName?.toLowerCase().includes(q) ||
        r.paperId?.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (statusFilter === "PENDING") return !r.evaluationCompleted;
      if (statusFilter === "EVALUATED") return r.evaluationCompleted;
      return true;
    });
  }, [responses, searchQuery, statusFilter]);

  // If not yet verified, render Teacher Security Gate
  if (!isVerified) {
    const isTeacher = teacherProfile?.role === "TEACHER" || decodedRole === "TEACHER";
    const hasSubjects = authorizedSubjects.length > 0;

    return (
      <div className="eval-page">
        <div className="eval-top-bar">
          <button className="back-btn" onClick={() => navigate("/teacher/dashboard")}>
            ← Back To Dashboard
          </button>
        </div>

        <div className="eval-verify-container">
          <div className="eval-verify-card">
            <div className="verify-icon-box">🔒</div>
            <h1>Teacher Security & Subject Verification</h1>
            <p>
              Please confirm your faculty identity and select your authorized teaching subject to unlock student response evaluation.
            </p>

            <div className="teacher-info-banner">
              <div className="teacher-info-row">
                <span className="teacher-label">Faculty Member</span>
                <strong>{teacherProfile?.name || teacherName}</strong>
              </div>
              <div className="teacher-info-row">
                <span className="teacher-label">Account Email</span>
                <code className="teacher-email-tag">{teacherProfile?.email || teacherEmail || "Faculty Account"}</code>
              </div>
              {teacherProfile?.employeeId && (
                <div className="teacher-info-row">
                  <span className="teacher-label">Employee ID</span>
                  <span className="emp-tag">{teacherProfile.employeeId}</span>
                </div>
              )}
            </div>

            {profileLoading ? (
              <div className="loading-profile-msg">Checking faculty subject allocations...</div>
            ) : isTeacher && !hasSubjects ? (
              <div className="no-allocated-subjects-box">
                <div className="warning-icon">⚠️</div>
                <h3>No Teaching Subjects Allocated</h3>
                <p>
                  You have not been assigned any teaching subjects by the administrator yet.
                  Please contact the college administrator to allocate your subjects.
                </p>
                <button
                  type="button"
                  className="recheck-btn"
                  onClick={fetchTeacherSubjects}
                >
                  ↻ Recheck Allocation
                </button>
              </div>
            ) : (
              <form onSubmit={handleTeacherVerify} className="verify-form">
                <div className="verify-input-group">
                  <label>
                    Authorized Teaching Subject *{" "}
                    <span className="auth-note">
                      ({authorizedSubjects.length} Allocated by Admin)
                    </span>
                  </label>
                  <select
                    value={verifySubject}
                    onChange={(e) => setVerifySubject(e.target.value)}
                    required
                  >
                    <option value="">-- Select Your Teaching Subject --</option>
                    {authorizedSubjects.map((sub, idx) => (
                      <option key={idx} value={sub}>
                        {sub}
                      </option>
                    ))}
                    {!isTeacher && (
                      <>
                        <option value="Indian Knowledge System">Indian Knowledge System</option>
                        <option value="Internet of Things">Internet of Things</option>
                        <option value="Renewable Energy Resources">Renewable Energy Resources</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="verify-input-group">
                  <label>Student Semester *</label>
                  <select
                    value={verifySemester}
                    onChange={(e) => setVerifySemester(e.target.value)}
                    required
                  >
                    <option value="1">Semester 1 (1st Year)</option>
                    <option value="2">Semester 2 (1st Year)</option>
                    <option value="3">Semester 3 (2nd Year)</option>
                    <option value="4">Semester 4 (2nd Year)</option>
                    <option value="5">Semester 5 (3rd Year)</option>
                    <option value="6">Semester 6 (3rd Year)</option>
                    <option value="7">Semester 7 (4th Year)</option>
                    <option value="8">Semester 8 (4th Year)</option>
                  </select>
                </div>

                <div className="verify-input-group">
                  <label>Security Password Confirmation *</label>
                  <input
                    type="password"
                    placeholder="Enter your account password"
                    required
                    value={verifyPassword}
                    onChange={(e) => setVerifyPassword(e.target.value)}
                  />
                </div>

                <button type="submit" className="verify-submit-btn" disabled={verifyLoading}>
                  {verifyLoading ? "Verifying Credentials..." : "✓ Verify & Unlock Evaluations"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Verified Evaluation Dashboard Workspace
  return (
    <div className="eval-page">
      {/* Top Bar Navigation */}
      <div className="eval-top-bar">
        <button className="back-btn" onClick={() => navigate("/teacher/dashboard")}>
          ← Back To Dashboard
        </button>

        <div className="faculty-badge-pill">
          <span className="faculty-dot"></span>
          <span>
            Faculty: <strong>{teacherName}</strong> | Subject: <strong>{selectedSubject || "All"}</strong> | Sem:{" "}
            <strong>{selectedSemester || "All"}</strong>
          </span>
          <button className="reverify-link-btn" onClick={handleResetVerification}>
            Change Subject
          </button>
        </div>
      </div>

      {/* Main Header Card with Batch Action Buttons */}
      <div className="eval-header-card">
        <div className="eval-title-area">
          <h1>Evaluate Student Responses</h1>
          <p>
            Filter submissions by semester and subject, grade questions, write qualitative feedback, and notify students via email.
          </p>
        </div>

        <div className="eval-batch-actions">
          <button
            className="action-pill-btn summary-btn"
            onClick={handleOpenSummary}
          >
            📊 Overall Evaluation Summary
          </button>
          <button
            className="action-pill-btn excel-btn"
            onClick={handleExportExcel}
            disabled={exportingExcel || filteredList.length === 0}
          >
            {exportingExcel ? "Exporting..." : "📥 Export Class Excel (.xlsx)"}
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="eval-filters-card">
        <div className="filters-left">
          {/* Semester Selector */}
          <div className="filter-dropdown-box">
            <label>Semester</label>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
            >
              <option value="ALL">All Semesters</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                <option key={s} value={s}>
                  Semester {s}
                </option>
              ))}
            </select>
          </div>

          {/* Subject Selector (Restricted to Authorized Subjects) */}
          <div className="filter-dropdown-box">
            <label>Subject</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
            >
              <option value="ALL">All Authorized Subjects</option>
              {authorizedSubjects.map((sub, i) => (
                <option key={i} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="filter-search-box">
            <label>Search Student</label>
            <input
              type="text"
              placeholder="Search by USN or Name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Status Tabs */}
        <div className="status-tabs-row">
          <button
            className={`status-tab ${statusFilter === "ALL" ? "active" : ""}`}
            onClick={() => setStatusFilter("ALL")}
          >
            All ({responses.length})
          </button>
          <button
            className={`status-tab ${statusFilter === "PENDING" ? "active" : ""}`}
            onClick={() => setStatusFilter("PENDING")}
          >
            Pending ({responses.filter((r) => !r.evaluationCompleted).length})
          </button>
          <button
            className={`status-tab ${statusFilter === "EVALUATED" ? "active" : ""}`}
            onClick={() => setStatusFilter("EVALUATED")}
          >
            Evaluated ({responses.filter((r) => r.evaluationCompleted).length})
          </button>
        </div>
      </div>

      {/* Student Responses Roster Table */}
      {loading ? (
        <div className="loading-state-card">Loading student response records...</div>
      ) : filteredList.length === 0 ? (
        <div className="empty-roster-card">
          <div className="empty-icon">📋</div>
          <h3>No Student Responses Found</h3>
          <p>No student submissions match the selected semester ({selectedSemester}) and subject ({selectedSubject}).</p>
        </div>
      ) : (
        <div className="eval-table-container">
          <table className="eval-table">
            <thead>
              <tr>
                <th>Student (USN & Name)</th>
                <th>Sem / Dept</th>
                <th>Subject & Paper ID</th>
                <th>Submitted Date</th>
                <th>Score / Max</th>
                <th>Status</th>
                <th>Risk Level</th>
                <th style={{ textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map((resp) => {
                const totalM = resp.totalMarks || 0;
                const maxM = resp.maxMarks || 40;
                const isEvaluated = resp.evaluationCompleted;

                return (
                  <tr key={resp.id} className={isEvaluated ? "row-evaluated" : "row-pending"}>
                    <td>
                      <div className="student-cell">
                        <strong className="usn-text">{resp.usn}</strong>
                        <span className="name-text">{resp.studentName}</span>
                        <div className="attempt-indicator-row">
                          <span className="attempt-pill">Attempt #{resp.attemptCount || 1}</span>
                          {resp.reExamGranted && (
                            <span className="reexam-granted-pill">🔁 Re-Exam Granted</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="sem-tag">Sem {resp.semester || "N/A"}</span>
                      <span className="dept-text">{resp.department || "CSE"}</span>
                    </td>
                    <td>
                      <strong className="subj-title">{resp.subject}</strong>
                      <span className="paper-id-text">ID: {resp.paperId}</span>
                      <div className="eval-mode-tag-row">
                        <span className={`eval-mode-tag ${resp.submissionMode === "OFFLINE_MANUAL" ? "offline" : "online"}`}>
                          {resp.submissionMode === "OFFLINE_MANUAL" ? "📝 Offline Marks" : "🌐 Online Exam"}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="date-text">
                        {resp.submittedAt ? new Date(resp.submittedAt).toLocaleString() : "Recently"}
                      </span>
                    </td>
                    <td>
                      <div className="score-cell">
                        <span className="score-badge">
                          {totalM} / {maxM} M
                        </span>
                        <span className="pct-text">({resp.percentage || 0}%)</span>
                      </div>
                    </td>
                    <td>
                      {isEvaluated ? (
                        <span className="status-badge evaluated">🟢 Evaluated</span>
                      ) : (
                        <span className="status-badge pending">🟡 Pending</span>
                      )}
                    </td>
                    <td>
                      <span className={`risk-badge ${resp.riskLevel ? resp.riskLevel.toLowerCase() : "low"}`}>
                        {resp.riskLevel || "LOW"}
                      </span>
                    </td>
                    <td>
                      <div className="table-row-actions">
                        <button
                          className={`table-btn ${isEvaluated ? "re-eval-btn" : "eval-btn"}`}
                          onClick={() => handleOpenEvaluationModal(resp)}
                          title={isEvaluated ? "Re-evaluate paper and update marks/feedback" : "Evaluate student paper"}
                        >
                          {isEvaluated ? "✏ Re-Eval" : "📝 Evaluate"}
                        </button>
                        <button
                          className={`table-btn print-pdf-btn ${!isEvaluated ? "btn-disabled" : ""}`}
                          disabled={!isEvaluated}
                          onClick={() => isEvaluated && handleDownloadEvaluatedPdf(resp)}
                          title={isEvaluated ? "Print / Download Evaluated Answer Paper PDF" : "Available after evaluation"}
                        >
                          📄 PDF
                        </button>
                        <button
                          className="table-btn email-btn"
                          disabled={sendingEmailId === resp.id}
                          onClick={() => handleSendEmailNotification(resp.id, resp.studentName)}
                          title="Send evaluation scorecard via email"
                        >
                          ✉️ {sendingEmailId === resp.id ? "Sending..." : "Email"}
                        </button>
                        <button
                          className={`table-btn reexam-grant-btn ${resp.reExamGranted ? "reexam-active" : ""}`}
                          disabled={resp.reExamGranted}
                          onClick={() => {
                            setReExamTarget(resp);
                            setReExamReason("Low score in previous attempt. Re-exam granted for score improvement.");
                          }}
                          title="Grant re-exam attempt to student"
                        >
                          {resp.reExamGranted ? "✓ Active" : "🔁 Re-Exam"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* QUESTION-BY-QUESTION EVALUATION MODAL */}
      {activeModalResponse && (
        <div className="modal-backdrop" onClick={() => setActiveModalResponse(null)}>
          <div className="eval-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-badge-row">
                  <span className="modal-usn-badge">USN: {activeModalResponse.usn}</span>
                  <span className="modal-subj-badge">{activeModalResponse.subject}</span>
                  {activeModalResponse.evaluationCompleted && (
                    <span className="modal-status-badge reeval-badge">✏️ Re-Evaluation Mode</span>
                  )}
                </div>
                <h2>
                  {activeModalResponse.evaluationCompleted
                    ? `✏ Re-Evaluating Paper: ${activeModalResponse.studentName}`
                    : `📝 Evaluating Paper: ${activeModalResponse.studentName}`}
                </h2>
              </div>
              <button className="close-modal-btn" onClick={() => setActiveModalResponse(null)}>
                ✕
              </button>
            </div>

            {activeModalResponse.evaluationCompleted && (
              <div className="reeval-banner-alert">
                <span>💡 <strong>Re-Evaluation Mode:</strong> You can edit marks and feedback for any question below. Saving will update the student's evaluated answer paper and predicted scores.</span>
              </div>
            )}

            <div className="modal-body-scroll">
              <div className="modal-score-summary">
                <div className="sum-stat">
                  <span>Total Questions</span>
                  <strong>{activeModalResponse.responses?.length || 0}</strong>
                </div>
                <div className="sum-stat highlight">
                  <span>Total Evaluated Marks</span>
                  <strong>
                    {activeModalResponse.totalMarks || 0} / {activeModalResponse.maxMarks || 40} Marks
                  </strong>
                </div>
                <div className="sum-stat">
                  <span>Current Prediction Score</span>
                  <strong>{activeModalResponse.predictedScore || 0}%</strong>
                </div>
              </div>

              {/* List of Student Question Responses */}
              <div className="modal-questions-stack">
                {activeModalResponse.responses?.map((ans, idx) => {
                  const matchingQ = activePaperDetails?.questions?.find(
                    (q) => q.questionId?.toLowerCase() === ans.questionId?.toLowerCase()
                  );

                  return (
                    <div className="question-eval-card" key={idx}>
                      <div className="q-eval-head">
                        <div className="q-head-tags">
                          <span className="q-tag-id">{ans.questionId}</span>
                          {matchingQ?.section && (
                            <span className="q-section-tag">{matchingQ.section}</span>
                          )}
                          {matchingQ?.optionalWith && (
                            <span className="q-choice-tag">
                              Optional With: {matchingQ.optionalWith}
                            </span>
                          )}
                        </div>
                        <span className="q-max-marks">
                          Max: {ans.maxMarks || matchingQ?.marks || 5} Marks
                        </span>
                      </div>

                      {/* Question prompt if available from question paper */}
                      {matchingQ?.text && (
                        <div className="question-prompt-preview">
                          <strong>Question Prompt:</strong>
                          <p>{matchingQ.text}</p>
                        </div>
                      )}

                      {/* Diagram Image if present */}
                      {matchingQ?.imageUrl && (
                        <div className="question-diagram-box">
                          <label>Attached Question Figure:</label>
                          <img src={matchingQ.imageUrl} alt="Question Diagram" className="diagram-img" />
                        </div>
                      )}

                      {/* Student Submitted Answer */}
                      <div className="student-answer-display">
                        <label>Student's Submitted Answer:</label>
                        <div className="answer-text-content">
                          {ans.answer ? ans.answer : <em className="no-answer-text">No answer submitted</em>}
                        </div>
                      </div>

                      {/* Marks Input & Feedback */}
                      <div className="scoring-controls-grid">
                        <div className="score-input-field">
                          <label>Marks Awarded *</label>
                          <input
                            type="number"
                            min="0"
                            max={ans.maxMarks || matchingQ?.marks || 10}
                            step="0.5"
                            value={modalMarks[ans.questionId] ?? ans.marksObtained ?? 0}
                            onChange={(e) =>
                              setModalMarks({
                                ...modalMarks,
                                [ans.questionId]: e.target.value,
                              })
                            }
                          />
                        </div>

                        <div className="feedback-input-field">
                          <label>Teacher Qualitative Feedback</label>
                          <input
                            type="text"
                            placeholder="e.g. Good explanation, neat architecture diagram, or needs more detail..."
                            value={modalFeedbacks[ans.questionId] ?? ans.feedback ?? ""}
                            onChange={(e) =>
                              setModalFeedbacks({
                                ...modalFeedbacks,
                                [ans.questionId]: e.target.value,
                              })
                            }
                          />
                        </div>

                        <button
                          type="button"
                          className="save-single-score-btn"
                          disabled={savingKey === `${activeModalResponse.id}-${ans.questionId}`}
                          onClick={() => handleSaveQuestionScore(ans.questionId)}
                        >
                          {savingKey === `${activeModalResponse.id}-${ans.questionId}` ? "Saving..." : "Save Q Score"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="modal-footer">
              {activeModalResponse.evaluationCompleted && (
                <button
                  type="button"
                  className="modal-pdf-btn"
                  onClick={() => handleDownloadEvaluatedPdf(activeModalResponse)}
                  title="Print / Download Evaluated Answer Paper PDF"
                >
                  📄 Download Evaluated PDF
                </button>
              )}
              <button
                type="button"
                className="modal-cancel-btn"
                onClick={() => setActiveModalResponse(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="modal-save-btn"
                disabled={savingKey === "all"}
                onClick={() => handleSaveAllScoresAndNotify(false)}
              >
                {savingKey === "all"
                  ? "Saving..."
                  : activeModalResponse.evaluationCompleted
                  ? "✓ Update Re-Evaluation"
                  : "✓ Save All Scores"}
              </button>
              <button
                type="button"
                className="modal-save-email-btn"
                disabled={savingKey === "all"}
                onClick={() => handleSaveAllScoresAndNotify(true)}
              >
                ✉️ Save & Email to Student
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OVERALL EVALUATION SUMMARY MODAL */}
      {showSummaryModal && (
        <div className="modal-backdrop" onClick={() => setShowSummaryModal(false)}>
          <div className="summary-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📊 Overall Class Evaluation Summary</h2>
              <button className="close-modal-btn" onClick={() => setShowSummaryModal(false)}>
                ✕
              </button>
            </div>

            {summaryLoading || !summaryData ? (
              <div className="loading-summary">Calculating class performance metrics...</div>
            ) : (
              <div className="summary-content">
                <div className="summary-stat-grid">
                  <div className="summary-kpi-card">
                    <span className="kpi-label">Total Submissions</span>
                    <strong className="kpi-value">{summaryData.totalStudents}</strong>
                  </div>
                  <div className="summary-kpi-card">
                    <span className="kpi-label">Evaluated / Pending</span>
                    <strong className="kpi-value">
                      {summaryData.evaluatedCount} / {summaryData.pendingCount}
                    </strong>
                  </div>
                  <div className="summary-kpi-card highlight">
                    <span className="kpi-label">Class Average Score</span>
                    <strong className="kpi-value">{summaryData.averageScore} M</strong>
                  </div>
                  <div className="summary-kpi-card">
                    <span className="kpi-label">Highest Score</span>
                    <strong className="kpi-value" style={{ color: "#34d399" }}>
                      {summaryData.highestScore} M
                    </strong>
                  </div>
                  <div className="summary-kpi-card">
                    <span className="kpi-label">Lowest Score</span>
                    <strong className="kpi-value" style={{ color: "#f87171" }}>
                      {summaryData.lowestScore} M
                    </strong>
                  </div>
                  <div className="summary-kpi-card">
                    <span className="kpi-label">Class Pass Percentage</span>
                    <strong className="kpi-value">{summaryData.passPercentage}%</strong>
                  </div>
                </div>

                {/* Risk Distribution Breakdown */}
                <h3 className="sub-title">Risk Distribution Analysis</h3>
                <div className="risk-bars-row">
                  <div className="risk-pill low">
                    <span>Low Risk (Safe):</span>
                    <strong>{summaryData.lowRiskCount} Students</strong>
                  </div>
                  <div className="risk-pill medium">
                    <span>Medium Risk (Attention):</span>
                    <strong>{summaryData.mediumRiskCount} Students</strong>
                  </div>
                  <div className="risk-pill high">
                    <span>High Risk (Intervention Needed):</span>
                    <strong>{summaryData.highRiskCount} Students</strong>
                  </div>
                </div>

                {/* Topic Accuracy Breakdown */}
                {summaryData.topicAverageScores && Object.keys(summaryData.topicAverageScores).length > 0 && (
                  <>
                    <h3 className="sub-title">Topic-wise Class Accuracy Average</h3>
                    <div className="topic-summary-grid">
                      {Object.entries(summaryData.topicAverageScores).map(([topic, avg], i) => (
                        <div className="topic-summary-pill" key={i}>
                          <span className="topic-name">{topic}</span>
                          <strong className="topic-avg">{avg} Marks</strong>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* RE-EXAM GRANT CONFIRMATION MODAL */}
      {reExamTarget && (
        <div className="modal-backdrop" onClick={() => setReExamTarget(null)}>
          <div className="reexam-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-badge-row">
                <span className="modal-usn-badge">USN: {reExamTarget.usn}</span>
                <span className="modal-subj-badge">{reExamTarget.subject}</span>
              </div>
              <h2>🔁 Grant Re-Exam to Student</h2>
            </div>

            <p className="reexam-modal-desc">
              Granting a re-exam will allow student <strong>{reExamTarget.studentName}</strong> to retake this exam paper for <strong>Attempt #{(reExamTarget.attemptCount || 1) + 1}</strong>.
            </p>

            <div className="reexam-form-group">
              <label>Teacher Instructions / Re-Exam Reason:</label>
              <textarea
                rows="3"
                placeholder="e.g. Low score in previous attempt. Re-exam granted for score improvement."
                value={reExamReason}
                onChange={(e) => setReExamReason(e.target.value)}
              ></textarea>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="modal-cancel-btn"
                onClick={() => setReExamTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="confirm-reexam-btn"
                disabled={grantingReExam}
                onClick={handleConfirmGrantReExam}
              >
                {grantingReExam ? "Granting..." : `✓ Authorize Re-Exam (Attempt #${(reExamTarget.attemptCount || 1) + 1})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EvaluateResponses;