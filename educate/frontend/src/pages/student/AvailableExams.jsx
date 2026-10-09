import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { getAllPapers } from "../../services/paperService";
import { getStudentResults, exportSubmissionExcel } from "../../services/responseService";
import { exportQuestionPaperPdf, exportEvaluatedSubmissionPdf } from "../../utils/pdfGenerator";
import "./AvailableExams.css";

function AvailableExams() {
  const navigate = useNavigate();
  const [papers, setPapers] = useState([]);
  const [studentResults, setStudentResults] = useState([]);
  const [loading, setLoading] = useState(true);

  // In-Page Submission View Modal State
  const [activeSubmission, setActiveSubmission] = useState(null);
  const [activePaper, setActivePaper] = useState(null);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [activeExamTab, setActiveExamTab] = useState("ALL"); // ALL, THEORY, MCQ
  const [searchQuery, setSearchQuery] = useState("");

  const getPaperMaxMarks = (paper) => {
    if (!paper) return 0;
    if (paper.maxMarks != null && Number(paper.maxMarks) > 0) return Number(paper.maxMarks);
    if (paper.totalMarks != null && Number(paper.totalMarks) > 0) return Number(paper.totalMarks);

    const questions = paper.questions || [];
    if (questions.length === 0) return 0;

    const isMcq =
      paper.paperFormat === "MCQ" ||
      paper.paperCategory === "QUIZ" ||
      (paper.paperId && paper.paperId.toUpperCase().includes("MCQ")) ||
      questions.every((q) => q.options && q.options.length > 0);

    const hasOptional =
      !isMcq &&
      questions.some((q) => q.optionalQuestion === true || Boolean(q.optionalWith) || q.isOr === true);

    if (!hasOptional) {
      const sum = questions.reduce((acc, q) => acc + (Number(q.maxMarks || q.marks) || 0), 0);
      if (sum > 0) return sum;
    } else {
      const nonOptionalSum = questions
        .filter((q) => q.optionalQuestion !== true && !q.optionalWith && q.isOr !== true)
        .reduce((acc, q) => acc + (Number(q.maxMarks || q.marks) || 0), 0);
      if (nonOptionalSum > 0) return nonOptionalSum;
    }

    return 0;
  };

  const getPaperDuration = (paper) => {
    if (!paper) return "90 Mins";
    if (paper.durationMinutes && Number(paper.durationMinutes) > 0) {
      return `${paper.durationMinutes} Mins`;
    }
    if (paper.duration && paper.duration.trim()) {
      const dur = paper.duration.trim();
      if (dur.toLowerCase().includes("min") || dur.toLowerCase().includes("hr") || dur.toLowerCase().includes("hour")) {
        return dur;
      }
      const num = parseInt(dur, 10);
      if (!isNaN(num)) return `${num} Mins`;
      return dur;
    }
    const isMcq = isPaperMcq(paper);
    return isMcq ? "30 Mins" : "90 Mins";
  };

  const isPaperMcq = (paper) => {
    if (!paper) return false;
    if (paper.paperFormat === "MCQ" || paper.paperCategory === "QUIZ") return true;
    const qs = paper.questions || [];
    if (qs.length > 0 && qs.every((q) => q.questionType === "MCQ" || (q.options && q.options.length >= 2))) {
      return true;
    }
    return false;
  };

  const getExamTypeLabel = (paper) => {
    if (!paper) return "Examination";
    if (paper.examName && paper.examName.trim()) {
      const name = paper.examName.trim();
      if (name.toLowerCase().includes("see") || name.toLowerCase().includes("semester end")) return "Semester End Exam (SEE)";
      if (name.toLowerCase().includes("final")) return "Final University Exam";
      if (name.toLowerCase().includes("mid-term") || name.toLowerCase().includes("mid term")) return "Mid-Term Exam";
      if (name.toLowerCase().includes("model") || name.toLowerCase().includes("practice")) return "Model / Practice Exam";
      if (name.toLowerCase().includes("quiz")) return "MCQ Quiz";
      return name;
    }
    const intNo = Number(paper.internalNo);
    if (intNo === 1) return "Internal Test 1";
    if (intNo === 2) return "Internal Test 2";
    if (intNo === 3) return "Internal Test 3";
    if (intNo === 4) return "Model / Practice Exam";
    if (intNo === 5) return "Semester Exam";
    if (intNo === 6) return "Final Exam";
    if (intNo > 0) return `Internal ${intNo}`;
    return "Assessment";
  };

  useEffect(() => {
    fetchExamsData();
  }, []);

  const fetchExamsData = async () => {
    try {
      setLoading(true);
      const papersData = await getAllPapers();
      setPapers(papersData || []);

      const usn = localStorage.getItem("usn");
      if (usn) {
        const resultsData = await getStudentResults(usn);
        setStudentResults(resultsData || []);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to load available exams");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSubmissionModal = (submission, paper) => {
    setActiveSubmission(submission);
    setActivePaper(paper);
  };

  const handleDownloadSubmissionExcel = async (submissionId) => {
    try {
      setDownloadingExcel(true);
      const blob = await exportSubmissionExcel(submissionId);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Exam_Submission_${activePaper?.subject || "Paper"}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Submission Excel report downloaded successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export submission Excel");
    } finally {
      setDownloadingExcel(false);
    }
  };

  // Search and Category Filtering
  const filteredPapers = (papers || []).filter((p) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    const subj = (p.subject || "").toLowerCase();
    const code = (p.subjectCode || "").toLowerCase();
    const pid = (p.paperId || "").toLowerCase();
    const examName = (p.examName || "").toLowerCase();
    return subj.includes(query) || code.includes(query) || pid.includes(query) || examName.includes(query);
  });

  const theoryExams = filteredPapers.filter((p) => !isPaperMcq(p));
  const mcqExams = filteredPapers.filter((p) => isPaperMcq(p));
  const displayedExams =
    activeExamTab === "THEORY"
      ? theoryExams
      : activeExamTab === "MCQ"
      ? mcqExams
      : filteredPapers;

  return (
    <div className="exam-page">
      <div className="exam-top-bar">
        <button className="back-btn" onClick={() => navigate("/student/dashboard")}>
          ← Back To Dashboard
        </button>
      </div>

      <div className="exam-header-card">
        <div className="header-text">
          <h1>Available Examination Papers</h1>
          <p>
            Select an exam to attend, review your written answers, download submission reports, or retake an exam if authorized for a re-exam by faculty.
          </p>
        </div>
      </div>

      {/* Interactive Controls Bar: Search & Category Filter Tabs */}
      <div className="exam-controls-container">
        {/* Search Bar */}
        <div className="exam-search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search papers by subject name, subject code, or paper ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="exam-search-input"
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => setSearchQuery("")} title="Clear search">
              ✕
            </button>
          )}
        </div>

        {/* Category Tab Switcher */}
        <div className="exam-category-tabs-bar">
          <button
            className={`exam-tab-btn ${activeExamTab === "ALL" ? "active" : ""}`}
            onClick={() => setActiveExamTab("ALL")}
          >
            <span>📁 All Examinations</span>
            <span className="tab-badge-pill">{filteredPapers.length}</span>
          </button>
          <button
            className={`exam-tab-btn ${activeExamTab === "THEORY" ? "active" : ""}`}
            onClick={() => setActiveExamTab("THEORY")}
          >
            <span>📑 Theory Exams</span>
            <span className="tab-badge-pill">{theoryExams.length}</span>
          </button>
          <button
            className={`exam-tab-btn ${activeExamTab === "MCQ" ? "active" : ""}`}
            onClick={() => setActiveExamTab("MCQ")}
          >
            <span>🎯 Objective MCQ Quizzes</span>
            <span className="tab-badge-pill">{mcqExams.length}</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-state-card">Loading examination schedules...</div>
      ) : displayedExams.length === 0 ? (
        <div className="empty-exam-card">
          <div className="empty-icon">{searchQuery ? "🔍" : activeExamTab === "MCQ" ? "🎯" : "📝"}</div>
          <h3>
            {searchQuery
              ? `No papers found matching "${searchQuery}"`
              : activeExamTab === "MCQ"
              ? "No Objective MCQ Quizzes"
              : activeExamTab === "THEORY"
              ? "No Theory Exams"
              : "No Active Exams"}
          </h3>
          <p>
            {searchQuery
              ? "Try searching with a different keyword or clear the search filter."
              : "There are currently no examination papers under this category for your semester."}
          </p>
        </div>
      ) : (
        <div className="exam-rows-container">
          {displayedExams.map((paper) => {
            const isMcq = isPaperMcq(paper);
            const paperMaxMarks = getPaperMaxMarks(paper);
            // Online submission only (digital portal test)
            const onlineSubmission = studentResults.find(
              (r) => r.paperId?.toLowerCase() === paper.paperId?.toLowerCase() && r.submissionMode !== "OFFLINE_MANUAL"
            );
            // Offline manual entry by teacher (classroom written exam)
            const offlineSubmission = studentResults.find(
              (r) => r.paperId?.toLowerCase() === paper.paperId?.toLowerCase() && r.submissionMode === "OFFLINE_MANUAL"
            );

            const isAttended = Boolean(onlineSubmission);
            const isReExamAllowed = onlineSubmission?.reExamGranted === true;
            const attemptNum = onlineSubmission?.attemptCount || 1;
            const isEvaluated = onlineSubmission?.evaluationCompleted;

            return (
              <div className={`exam-row-card ${isMcq ? "exam-row-mcq" : "exam-row-theory"}`} key={paper.paperId}>
                {/* Left Cell: Badges, Title, Subcode */}
                <div className="row-left-cell">
                  <div className="row-badge-cluster">
                    <span className="exam-code-pill">{paper.subjectCode || paper.paperId}</span>
                    <span className={`exam-format-badge ${isMcq ? "mcq-badge" : "theory-badge"}`}>
                      {isMcq ? "🎯 Objective MCQ" : "📑 Theory Exam"}
                    </span>
                    {isAttended ? (
                      <span className="attempt-badge">✓ Attempt #{attemptNum}</span>
                    ) : offlineSubmission ? (
                      <span className="attempt-badge offline-badge" title="Classroom Offline Test Marks Recorded by Faculty">
                        📝 Offline: {offlineSubmission.totalMarks}/{offlineSubmission.maxMarks || paperMaxMarks} M
                      </span>
                    ) : (
                      <span className="available-status-tag">Ready</span>
                    )}
                  </div>

                  <h3 className="exam-subject-title">{paper.subject}</h3>
                  <div className="exam-subtext-meta">
                    <span>{getExamTypeLabel(paper)}</span>
                    <span> • Sem {paper.semester || paper.assignedSemester || "All"}</span>
                    {paper.paperId && paper.subjectCode && paper.paperId !== paper.subjectCode && (
                      <span className="paper-subcode-text"> • Paper ID: {paper.paperId}</span>
                    )}
                  </div>
                </div>

                {/* Middle Cell: Meta Chips & Status */}
                <div className="row-mid-cell">
                  <div className="row-meta-chips">
                    <span className="meta-chip">📊 {paperMaxMarks} Marks</span>
                    <span className="meta-chip">❓ {paper.questions?.length || 0} Qs</span>
                  </div>

                  {isReExamAllowed ? (
                    <div className="row-status-pill reexam">
                      <span>🔁 Re-Exam Granted ({onlineSubmission.reExamNote || `Attempt #${attemptNum + 1}`})</span>
                    </div>
                  ) : isAttended ? (
                    <div className="row-status-pill attended">
                      <span>✓ {isEvaluated ? `Evaluated: ${onlineSubmission.totalMarks}/${onlineSubmission.maxMarks || paperMaxMarks} M` : "Submitted (Awaiting Evaluation)"}</span>
                    </div>
                  ) : offlineSubmission ? (
                    <div className="row-status-pill offline">
                      <span>📝 Offline Recorded: {offlineSubmission.totalMarks}/{offlineSubmission.maxMarks || paperMaxMarks} M</span>
                    </div>
                  ) : null}
                </div>

                {/* Right Cell: Action Buttons */}
                <div className="row-right-actions">
                  <button
                    className="export-paper-pdf-btn"
                    onClick={() => {
                      exportQuestionPaperPdf(paper);
                      toast.success(`Question Paper PDF downloaded for ${paper.subject || paper.paperId}!`);
                    }}
                    title="Download / Print Standard Academic Question Paper PDF"
                  >
                    📄 Paper PDF
                  </button>

                  {isReExamAllowed ? (
                    <button
                      className="attend-reexam-btn"
                      onClick={() => navigate(`/student/attend/${paper.paperId}`)}
                      title="Retake this examination"
                    >
                      🔁 Re-Take Exam
                    </button>
                  ) : isAttended ? (
                    <button
                      className="view-result-btn"
                      onClick={() => handleOpenSubmissionModal(onlineSubmission, paper)}
                      title="View your submitted examination paper and score"
                    >
                      👁 View Paper
                    </button>
                  ) : (
                    <button
                      className="attend-exam-btn"
                      onClick={() => navigate(`/student/attend/${paper.paperId}`)}
                      title="Start and attend this examination now"
                    >
                      ✍️ Attend Exam
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* IN-PAGE SUBMISSION DETAILS MODAL */}
      {activeSubmission && (
        <div className="modal-backdrop" onClick={() => setActiveSubmission(null)}>
          <div className="submission-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="submission-modal-header">
              <div>
                <div className="submission-badge-row">
                  <span className="sub-badge paper">{activePaper?.subject || activeSubmission.paperId}</span>
                  <span className="sub-badge attempt">Attempt #{activeSubmission.attemptCount || 1}</span>
                  <span className={`sub-badge status ${activeSubmission.evaluationCompleted ? "evaluated" : "pending"}`}>
                    {activeSubmission.evaluationCompleted ? "🟢 Evaluated" : "🟡 Under Evaluation"}
                  </span>
                </div>
                <h2>My Written Examination Submission</h2>
                <p className="submission-subtext">
                  Paper ID: <code>{activeSubmission.paperId}</code> | Submitted on:{" "}
                  <strong>{activeSubmission.submittedAt ? new Date(activeSubmission.submittedAt).toLocaleString() : "Recently"}</strong>
                </p>
              </div>

              <div className="header-action-cluster">
                <button
                  className="modal-pdf-btn"
                  onClick={() => {
                    exportEvaluatedSubmissionPdf(activeSubmission);
                    toast.success("Official Evaluated Scorecard PDF downloaded!");
                  }}
                  title="Download Official Certified Evaluated Script in PDF"
                >
                  📄 Export Evaluated PDF
                </button>
                <button
                  className="modal-excel-btn"
                  disabled={downloadingExcel}
                  onClick={() => handleDownloadSubmissionExcel(activeSubmission.id)}
                >
                  {downloadingExcel ? "Exporting..." : "📥 Excel (.xlsx)"}
                </button>
                <button className="close-modal-btn" onClick={() => setActiveSubmission(null)}>
                  ✕
                </button>
              </div>
            </div>

            {/* Note Regarding Re-Exam Retakes */}
            <div className="reexam-info-alert">
              <span className="alert-icon">💡</span>
              <div className="alert-text">
                <strong>Re-Attempt Policy:</strong> If your teacher/faculty accepts and grants a re-exam, you will be able to re-attempt this exam directly from your Available Exams page.
              </div>
            </div>

            {/* Summary Score Bar */}
            <div className="submission-score-summary">
              <div className="score-sum-tile">
                <small>Total Marks Scored</small>
                <strong>{activeSubmission.totalMarks != null ? activeSubmission.totalMarks : 0} / {activeSubmission.maxMarks || activePaper?.maxMarks || 40} M</strong>
              </div>
              <div className="score-sum-tile">
                <small>Evaluated By</small>
                <strong>{activeSubmission.evaluatedBy || "Pending Review"}</strong>
              </div>
              <div className="score-sum-tile">
                <small>AI Risk Level</small>
                <strong className={`risk-tag ${activeSubmission.riskLevel ? activeSubmission.riskLevel.toLowerCase() : "low"}`}>
                  {activeSubmission.riskLevel || "LOW"}
                </strong>
              </div>
            </div>

            {/* Question-By-Question Written Answers */}
            <div className="submission-answers-list">
              <h3 className="answers-section-title">Question-by-Question Written Answers</h3>
              {activeSubmission.responses && activeSubmission.responses.length > 0 ? (
                activeSubmission.responses.map((ans, idx) => {
                  const qDetails = activePaper?.questions?.find(
                    (q) => q.questionId?.toLowerCase() === ans.questionId?.toLowerCase()
                  );

                  return (
                    <div className="submission-answer-card" key={idx}>
                      <div className="answer-card-header">
                        <span className="ans-qid-badge">{ans.questionId || `Q${idx + 1}`}</span>
                        <span className="ans-topic-badge">{ans.topic || qDetails?.topic || "General"}</span>
                        <div className="ans-score-pill">
                          Marks: <strong>{ans.marksObtained != null ? ans.marksObtained : 0}</strong> / {ans.maxMarks || qDetails?.marks || 5} M
                        </div>
                      </div>

                      <div className="ans-question-prompt">
                        <strong>Question: </strong>
                        {ans.questionText || qDetails?.text || "Question prompt text"}
                      </div>

                      <div className="student-written-box">
                        <label>Your Written Response:</label>
                        <div className="written-content">
                          {ans.answer ? ans.answer : <span className="no-ans-text">(No answer provided)</span>}
                        </div>
                      </div>

                      {ans.feedback && (
                        <div className="evaluator-feedback-box">
                          <label>Faculty / Evaluator Feedback:</label>
                          <p>{ans.feedback}</p>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="no-answers-hint">No question responses recorded for this submission.</div>
              )}
            </div>

            <div className="submission-modal-footer">
              <button className="modal-close-action-btn" onClick={() => setActiveSubmission(null)}>
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AvailableExams;