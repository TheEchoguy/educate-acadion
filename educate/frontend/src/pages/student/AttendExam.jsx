import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { jwtDecode } from "jwt-decode";
import { getPaperById } from "../../services/paperService";
import { submitResponses } from "../../services/responseService";
import "./AttendExam.css";

function AttendExam() {
  const params = useParams();
  const rawId = params.id || params.paperId || params.examId;
  const paperId = rawId ? decodeURIComponent(rawId).trim() : "";
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [paper, setPaper] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const isPracticeMode =
    searchParams.get("mode") === "practice" ||
    paper?.allowedForPractice === true ||
    paper?.paperCategory === "PRACTICE";

  useEffect(() => {
    fetchPaper();
  }, [paperId]);

  const fetchPaper = async () => {
    if (!paperId) {
      setError("No examination ID was provided in the URL.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getPaperById(paperId);
      if (!data) {
        setError(`Examination "${paperId}" was not found or is currently unavailable.`);
      } else {
        setPaper(data);
      }
    } catch (err) {
      console.error("Failed to load examination paper:", err);
      const errMsg =
        err.response?.data?.message ||
        (typeof err.response?.data === "string" ? err.response?.data : null) ||
        `Examination "${paperId}" was not found or is not currently published.`;
      setError(errMsg);
      toast.error("Failed to load examination paper");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId, value) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleSubmit = async () => {
    try {
      if (!paper || !paper.questions || paper.questions.length === 0) {
        toast.error("No questions available to submit");
        return;
      }

      const answeredCount = Object.values(answers).filter((a) => a && a.trim() !== "").length;
      if (answeredCount === 0) {
        toast.error("Please answer at least one question before submitting");
        return;
      }

      setSubmitting(true);

      let studentUsn = "";
      const authToken = sessionStorage.getItem("token") || localStorage.getItem("token");
      if (authToken) {
        try {
          const decoded = jwtDecode(authToken);
          if (decoded.usn && decoded.usn.trim()) studentUsn = decoded.usn.trim();
          else if (decoded.sub && decoded.sub.trim()) studentUsn = decoded.sub.trim();
        } catch (e) {}
      }
      if (!studentUsn) {
        studentUsn =
          sessionStorage.getItem("usn") ||
          localStorage.getItem("usn") ||
          sessionStorage.getItem("email") ||
          localStorage.getItem("email") ||
          "STUDENT";
      }

      const canonicalPaperId = paper.paperId || paper.id || paperId;

      const payload = {
        usn: studentUsn,
        paperId: canonicalPaperId,
        submissionMode: isPracticeMode ? "PRACTICE" : "ONLINE",
        isPractice: isPracticeMode,
        paperCategory: isPracticeMode ? "PRACTICE" : (paper.paperCategory || "ASSESSMENT"),
        responses: paper.questions.map((q) => ({
          questionId: q.questionId,
          answer: answers[q.questionId] || "",
        })),
      };

      await submitResponses(payload);

      toast.success(
        isPracticeMode
          ? "Practice paper submitted! You can review or retake anytime."
          : "Exam submitted successfully! Answers recorded."
      );

      setTimeout(() => {
        if (isPracticeMode) {
          navigate("/student/practice");
        } else {
          navigate("/student/exams");
        }
      }, 1200);
    } catch (err) {
      console.error("Submission failed:", err);
      toast.error(err.response?.data?.message || err.response?.data || "Submission Failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="attend-loading-wrapper">
        <div className="attend-spinner"></div>
        <p className="attend-loading-text">Loading examination questions...</p>
      </div>
    );
  }

  if (error || !paper) {
    return (
      <div className="attend-error-wrapper">
        <div className="attend-error-card">
          <div className="attend-error-icon">⚠️</div>
          <h2 className="attend-error-title">Examination Not Available</h2>
          <p className="attend-error-message">
            {error || `Examination "${paperId}" could not be loaded.`}
          </p>
          <div className="attend-error-actions">
            <button
              className="attend-back-btn"
              onClick={() => navigate(isPracticeMode ? "/student/practice" : "/student/exams")}
            >
              ← Return to Available Exams
            </button>
            <button className="attend-retry-btn" onClick={fetchPaper}>
              🔄 Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const questions = paper.questions || [];
  if (questions.length === 0) {
    return (
      <div className="attend-error-wrapper">
        <div className="attend-error-card">
          <div className="attend-error-icon">📝</div>
          <h2 className="attend-error-title">No Questions Available</h2>
          <p className="attend-error-message">
            This examination currently has no registered questions.
          </p>
          <button
            className="attend-back-btn"
            onClick={() => navigate(isPracticeMode ? "/student/practice" : "/student/exams")}
          >
            ← Return to Available Exams
          </button>
        </div>
      </div>
    );
  }

  const isPractice =
    paper.paperCategory === "PRACTICE" ||
    paper.paperCategory === "QUIZ" ||
    isPracticeMode;
  const totalQuestions = questions.length;
  const answeredCount = Object.values(answers).filter((a) => a && a.trim() !== "").length;

  return (
    <div className="attend-page">
      {/* Top Bar Header */}
      <div className="attend-nav-bar">
        <button
          className="back-btn"
          onClick={() => navigate(isPractice ? "/student/practice" : "/student/exams")}
        >
          ← Back
        </button>
        <div className="exam-type-pill">
          {isPractice ? "🎯 Practice Self-Study Mode" : "📋 Official Examination Mode"}
        </div>
      </div>

      <div className="attend-header-card">
        <div className="attend-header-left">
          <span className="attend-subj-code">{paper.subjectCode || paper.paperId}</span>
          <h1>{paper.subject || "Examination"}</h1>
          <div className="attend-meta-chips">
            <span>Internal: {paper.internalNo || 1}</span>
            <span>Max Marks: {paper.maxMarks || 40} M</span>
            <span>Semester: {paper.semester || paper.assignedSemester || "All"}</span>
            <span>Total Qs: {totalQuestions}</span>
            {paper.paperId && <span className="attend-paperid-chip">ID: {paper.paperId}</span>}
          </div>
        </div>

        <div className="attend-progress-box">
          <span className="prog-label">Progress</span>
          <strong className="prog-count">
            {answeredCount} / {totalQuestions}
          </strong>
          <small>Answered</small>
        </div>
      </div>

      {/* Question List */}
      <div className="question-list">
        {questions.map((q, idx) => {
          const isMcq =
            q.questionType === "MCQ" || (q.options && q.options.length > 0);
          const currentAnswer = answers[q.questionId] || "";

          return (
            <div
              className={`attend-question-card ${isMcq ? "mcq-card" : "theory-card"}`}
              key={q.questionId || `q-${idx}`}
            >
              <div className="question-card-top">
                <div className="q-badge-cluster">
                  <span className="q-idx-badge">{q.questionId || `Q${idx + 1}`}</span>
                  <span className="q-type-badge">{isMcq ? "MCQ" : "Theory"}</span>
                  <span className="q-topic-badge">{q.topic || "General"}</span>
                </div>
                <span className="q-marks-pill">{q.marks || (isMcq ? 1 : 8)} Marks</span>
              </div>

              <div className="question-prompt-text">{q.text}</div>

              {/* MCQ Options Radio List */}
              {isMcq && q.options && q.options.length > 0 ? (
                <div className="attend-mcq-options">
                  {q.options.map((optionText, optIdx) => {
                    const optLetter = String.fromCharCode(65 + optIdx); // A, B, C, D
                    const isSelected =
                      currentAnswer === optLetter || currentAnswer === optionText;

                    return (
                      <label
                        className={`attend-option-tile ${isSelected ? "selected" : ""}`}
                        key={optIdx}
                      >
                        <input
                          type="radio"
                          name={`answer-${q.questionId}`}
                          value={optLetter}
                          checked={isSelected}
                          onChange={() => handleAnswerChange(q.questionId, optLetter)}
                        />
                        <span className="option-choice-circle">{optLetter}</span>
                        <span className="option-choice-text">{optionText}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                /* Theory Textarea */
                <div className="theory-input-wrapper">
                  <label>Type your detailed answer below:</label>
                  <textarea
                    rows="5"
                    placeholder="Type your explanation, key points, derivations, or formulas..."
                    value={currentAnswer}
                    onChange={(e) => handleAnswerChange(q.questionId, e.target.value)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Bottom Bar */}
      <div className="attend-submit-bar">
        <div className="submit-bar-info">
          <span>
            Total Questions: <strong>{totalQuestions}</strong>
          </span>
          <span>
            Answered: <strong style={{ color: "#34d399" }}>{answeredCount}</strong>
          </span>
        </div>
        <button
          className="submit-exam-action-btn"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting
            ? "Submitting Answers..."
            : `✓ Submit ${isPractice ? "Practice Test" : "Exam"}`}
        </button>
      </div>
    </div>
  );
}

export default AttendExam;