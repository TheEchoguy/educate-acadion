import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { getPaperById } from "../../services/paperService";
import { submitResponses } from "../../services/responseService";
import "./AttendExam.css";

function AttendExam() {
  const { paperId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [paper, setPaper] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const isPracticeMode = searchParams.get("mode") === "practice" || paper?.allowedForPractice === true || paper?.paperCategory === "PRACTICE";

  useEffect(() => {
    fetchPaper();
  }, [paperId]);

  const fetchPaper = async () => {
    try {
      const data = await getPaperById(paperId);
      setPaper(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load examination paper");
    }
  };

  const handleAnswerChange = (questionId, value) => {
    setAnswers({
      ...answers,
      [questionId]: value,
    });
  };

  const handleSubmit = async () => {
    try {
      const answeredCount = Object.values(answers).filter((a) => a && a.trim() !== "").length;
      if (answeredCount === 0) {
        toast.error("Please answer at least one question before submitting");
        return;
      }

      setSubmitting(true);

      const payload = {
        usn: localStorage.getItem("usn"),
        paperId,
        submissionMode: isPracticeMode ? "PRACTICE" : "ONLINE",
        isPractice: isPracticeMode,
        paperCategory: isPracticeMode ? "PRACTICE" : (paper.paperCategory || "ASSESSMENT"),
        responses: paper.questions.map((q) => ({
          questionId: q.questionId,
          answer: answers[q.questionId] || "",
        })),
      };

      await submitResponses(payload);

      toast.success(isPracticeMode ? "Practice paper submitted! You can review or retake anytime." : "Exam submitted successfully!");

      setTimeout(() => {
        if (isPracticeMode) {
          navigate("/student/practice");
        } else {
          navigate("/student/exams");
        }
      }, 1200);
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || error.response?.data || "Submission Failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!paper) {
    return <div className="attend-loading">Loading examination questions...</div>;
  }

  const isPractice = paper.paperCategory === "PRACTICE" || paper.paperCategory === "QUIZ";
  const totalQuestions = paper.questions?.length || 0;
  const answeredCount = Object.values(answers).filter((a) => a && a.trim() !== "").length;

  return (
    <div className="attend-page">
      {/* Top Bar Header */}
      <div className="attend-nav-bar">
        <button className="back-btn" onClick={() => navigate(isPractice ? "/student/practice" : "/student/exams")}>
          ← Back
        </button>
        <div className="exam-type-pill">
          {isPractice ? "🎯 Practice Self-Study Mode" : "📋 Official Examination Mode"}
        </div>
      </div>

      <div className="attend-header-card">
        <div className="attend-header-left">
          <span className="attend-subj-code">{paper.subjectCode || paper.paperId}</span>
          <h1>{paper.subject}</h1>
          <div className="attend-meta-chips">
            <span>Internal: {paper.internalNo || 1}</span>
            <span>Max Marks: {paper.maxMarks || 40} M</span>
            <span>Semester: {paper.semester || "All"}</span>
            <span>Total Qs: {totalQuestions}</span>
          </div>
        </div>

        <div className="attend-progress-box">
          <span className="prog-label">Progress</span>
          <strong className="prog-count">{answeredCount} / {totalQuestions}</strong>
          <small>Answered</small>
        </div>
      </div>

      {/* Question List */}
      <div className="question-list">
        {paper.questions?.map((q, idx) => {
          const isMcq = q.questionType === "MCQ";
          const currentAnswer = answers[q.questionId] || "";

          return (
            <div className={`attend-question-card ${isMcq ? "mcq-card" : "theory-card"}`} key={q.questionId || idx}>
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
                    const isSelected = currentAnswer === optLetter || currentAnswer === optionText;

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
          <span>Total Questions: <strong>{totalQuestions}</strong></span>
          <span>Answered: <strong style={{ color: "#34d399" }}>{answeredCount}</strong></span>
        </div>
        <button
          className="submit-exam-action-btn"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? "Submitting Answers..." : `✓ Submit ${isPractice ? "Practice Test" : "Exam"}`}
        </button>
      </div>
    </div>
  );
}

export default AttendExam;