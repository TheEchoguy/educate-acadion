import { useEffect, useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
  const location = useLocation();

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

  // Open Assessment Evaluation: Direct access without password/PIN verification
  const [isVerified, setIsVerified] = useState(true);

  // Teacher Profile & Authorized Subjects from Backend
  const [teacherProfile, setTeacherProfile] = useState(null);
  const [authorizedSubjects, setAuthorizedSubjects] = useState([]);
  const [profileLoading, setProfileLoading] = useState(true);

  // Main Data States
  const [papers, setPapers] = useState([]);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL, PENDING, EVALUATED
  const [selectedSemester, setSelectedSemester] = useState(location.state?.semester || "ALL");
  const [selectedSubject, setSelectedSubject] = useState(location.state?.subject || "ALL");

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
    fetchEnrichedResponses();
  }, [teacherEmail, selectedSemester, selectedSubject]);

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
      if (subs.length > 0 && selectedSubject === "ALL") {
        // Keep ALL or preset
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

  // Helper: Auto-evaluate MCQ correctness
  const checkIsMcqCorrect = (question, studentAns) => {
    if (!question || !studentAns) return false;
    const correct = (question.correctAnswer || "").trim().toUpperCase();
    const student = (studentAns || "").trim().toUpperCase();
    if (!correct || !student) return false;

    // Exact direct match
    if (student === correct) return true;

    // Letter prefix match: e.g. "A" vs "A) ..." or "Option A"
    if (correct.length === 1) {
      if (
        student.startsWith(correct + ")") ||
        student.startsWith(correct + ".") ||
        student.startsWith(correct + " ") ||
        student === correct ||
        student.includes(`OPTION ${correct}`) ||
        student.startsWith(`(${correct})`)
      ) {
        return true;
      }
    }

    if (
      student.length === 1 &&
      (correct.startsWith(student + ")") ||
        correct.startsWith(student + ".") ||
        correct.startsWith(student + " ") ||
        correct.includes(`OPTION ${student}`) ||
        correct.startsWith(`(${student})`))
    ) {
      return true;
    }

    // Check options array matching
    if (question.options && question.options.length > 0) {
      const letters = ["A", "B", "C", "D", "E"];
      const correctIdx = letters.indexOf(correct);
      if (correctIdx >= 0 && question.options[correctIdx]) {
        const optionText = question.options[correctIdx].trim().toUpperCase();
        if (student === optionText || student.includes(optionText) || optionText.includes(student)) {
          return true;
        }
      }
    }

    return false;
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

      // Auto-evaluate MCQ questions
      if (resp.responses && paperData?.questions) {
        resp.responses.forEach((ans) => {
          const matchingQ = paperData.questions.find(
            (q) => q.questionId?.toLowerCase() === ans.questionId?.toLowerCase()
          );
          const isMcq =
            (ans.questionType || matchingQ?.type || matchingQ?.questionType || "").toUpperCase() === "MCQ" ||
            (matchingQ?.options && matchingQ.options.length > 0);

          if (isMcq && matchingQ) {
            const maxM = ans.maxMarks || matchingQ.marks || 1;
            const isCorrect = checkIsMcqCorrect(matchingQ, ans.answer);
            marksObj[ans.questionId] = isCorrect ? maxM : 0;
            if (!feedbackObj[ans.questionId] || feedbackObj[ans.questionId].includes("Auto-Evaluated")) {
              feedbackObj[ans.questionId] = isCorrect
                ? "✓ Auto-Evaluated: Correct Option"
                : `✗ Auto-Evaluated: Incorrect. Correct: ${matchingQ.correctAnswer || "Option Key"}`;
            }
          }
        });
      }
    } catch (err) {
      setActivePaperDetails(null);
    }
    setModalMarks(marksObj);
    setModalFeedbacks(feedbackObj);
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

  // Evaluation Dashboard Workspace
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

                  const qType = (ans.questionType || matchingQ?.type || matchingQ?.questionType || "").toUpperCase();
                  const isMcq = qType === "MCQ" || (matchingQ?.options && matchingQ.options.length > 0);
                  const qMaxMarks = ans.maxMarks || matchingQ?.marks || (isMcq ? 1 : 5);
                  const isCorrect = isMcq ? checkIsMcqCorrect(matchingQ, ans.answer) : null;
                  const rubricText = matchingQ?.rubric || matchingQ?.modelAnswer || matchingQ?.markingScheme || matchingQ?.explanation;

                  return (
                    <div className="question-eval-card" key={idx}>
                      <div className="q-eval-head">
                        <div className="q-head-tags">
                          <span className="q-tag-id">{ans.questionId}</span>
                          <span className={`q-type-badge ${isMcq ? "badge-mcq" : "badge-theory"}`} style={{
                            fontSize: "0.74rem",
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 6,
                            background: isMcq ? "rgba(56, 189, 248, 0.15)" : "rgba(168, 85, 247, 0.15)",
                            color: isMcq ? "#38bdf8" : "#c084fc",
                            border: `1px solid ${isMcq ? "rgba(56, 189, 248, 0.3)" : "rgba(168, 85, 247, 0.3)"}`
                          }}>
                            {isMcq ? "MCQ (AUTO)" : "THEORY / DESCRIPTIVE"}
                          </span>
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
                          Max: {qMaxMarks} Marks
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

                      {/* MCQ Auto-Evaluation Block */}
                      {isMcq && (
                        <div className="mcq-auto-eval-panel" style={{
                          background: isCorrect ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.08)",
                          border: `1px solid ${isCorrect ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                          borderRadius: 10,
                          padding: "12px 16px",
                          margin: "10px 0"
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                            <span style={{ fontWeight: 800, color: isCorrect ? "#34d399" : "#f87171", fontSize: "0.9rem" }}>
                              {isCorrect ? `✓ Auto-Evaluated: Full Marks Awarded (${qMaxMarks}/${qMaxMarks} M)` : `✗ Auto-Evaluated: Incorrect Answer (0/${qMaxMarks} M)`}
                            </span>
                            <span style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
                              Stored Correct Answer: <strong style={{ color: "#34d399" }}>{matchingQ?.correctAnswer || "Key Not Set"}</strong>
                            </span>
                          </div>

                          {/* MCQ Options Display */}
                          {matchingQ?.options && matchingQ.options.length > 0 && (
                            <div style={{ display: "grid", gap: 4, marginTop: 8 }}>
                              {matchingQ.options.map((opt, oIdx) => {
                                const optLetter = String.fromCharCode(65 + oIdx);
                                const isKey = matchingQ.correctAnswer?.toUpperCase().includes(optLetter);
                                const isSelected = (ans.answer || "").toUpperCase().includes(optLetter);

                                return (
                                  <div
                                    key={oIdx}
                                    style={{
                                      padding: "6px 10px",
                                      borderRadius: 6,
                                      fontSize: "0.84rem",
                                      background: isKey ? "rgba(16, 185, 129, 0.15)" : isSelected ? "rgba(239, 68, 68, 0.15)" : "rgba(255, 255, 255, 0.03)",
                                      border: isKey ? "1px solid rgba(16, 185, 129, 0.35)" : isSelected ? "1px solid rgba(239, 68, 68, 0.35)" : "1px solid rgba(255, 255, 255, 0.06)",
                                      color: isKey ? "#34d399" : isSelected ? "#fca5a5" : "#cbd5e1",
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center"
                                    }}
                                  >
                                    <span><strong>{optLetter}.</strong> {opt}</span>
                                    {isKey && <span style={{ fontWeight: 700, fontSize: "0.76rem" }}>✓ Correct Key</span>}
                                    {isSelected && !isKey && <span style={{ fontWeight: 700, fontSize: "0.76rem" }}>✗ Student Selection</span>}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Student Submitted Answer */}
                      <div className="student-answer-display">
                        <label>Student's Submitted Answer:</label>
                        <div className="answer-text-content">
                          {ans.answer ? ans.answer : <em className="no-answer-text">No answer submitted</em>}
                        </div>
                      </div>

                      {/* Theory Rubric Display */}
                      {!isMcq && (
                        <div className="theory-rubric-card" style={{
                          background: "rgba(99, 102, 241, 0.08)",
                          border: "1px solid rgba(99, 102, 241, 0.25)",
                          borderRadius: 10,
                          padding: "10px 14px",
                          margin: "10px 0"
                        }}>
                          <strong style={{ display: "block", color: "#818cf8", fontSize: "0.82rem", marginBottom: 4 }}>
                            📋 Model Answer / Evaluation Rubric:
                          </strong>
                          <p style={{ margin: 0, color: "#e0e7ff", fontSize: "0.88rem", lineHeight: 1.5 }}>
                            {rubricText || "Evaluate answer based on key technical principles, architecture correctness, clarity, and conceptual depth."}
                          </p>
                        </div>
                      )}

                      {/* Marks Input & Feedback */}
                      <div className="scoring-controls-grid">
                        <div className="score-input-field">
                          <label>Marks Awarded *</label>
                          <input
                            type="number"
                            min="0"
                            max={qMaxMarks}
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
                            placeholder={isMcq ? "MCQ auto-evaluation note..." : "e.g. Good derivation, clear architecture, needs more details on step 3..."}
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
                          {savingKey === `${activeModalResponse.id}-${ans.questionId}` ? "Saving..." : "Save Grade"}
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