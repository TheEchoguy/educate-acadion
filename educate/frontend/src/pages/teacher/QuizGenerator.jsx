import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  generateQuiz,
  extractNotesText,
  regenerateQuestion,
  saveQuizDraft,
  getTeacherDrafts,
  publishQuiz,
} from "../../services/quizService";
import "./QuizGenerator.css";

function QuizGenerator() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const teacherEmail = localStorage.getItem("email") || "";
  const teacherRole = localStorage.getItem("role") || "";

  // Check role authorization
  useEffect(() => {
    if (teacherRole && teacherRole !== "TEACHER" && teacherRole !== "ADMIN") {
      toast.error("Unauthorized: Only faculty and administrators can access the Quiz Generator.");
      navigate("/login");
    }
  }, [teacherRole, navigate]);

  // Form State
  const [mode, setMode] = useState("TOPIC"); // TOPIC or NOTES
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [notesText, setNotesText] = useState("");
  const [uploadedFile, setUploadedFile] = useState(null);
  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState("MEDIUM");
  const [semester, setSemester] = useState("5th Sem");
  const [marksPerQuestion, setMarksPerQuestion] = useState(1.0);
  const [mockMode, setMockMode] = useState(false);

  // Status State
  const [generating, setGenerating] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Output / Review State
  const [questions, setQuestions] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [activePaperId, setActivePaperId] = useState(null);
  const [reviewMode, setReviewMode] = useState(false);

  // Modals
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [draftsModalOpen, setDraftsModalOpen] = useState(false);
  const [savedDrafts, setSavedDrafts] = useState([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);

  // Published confirmation
  const [publishedPaper, setPublishedPaper] = useState(null);

  // Handle file upload
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toast.error("File size exceeds 15MB. Please choose a smaller document.");
      return;
    }

    setUploadedFile(file);
    try {
      setExtracting(true);
      toast.loading("Extracting text from document...", { id: "extract" });
      const res = await extractNotesText(file);
      if (res?.text) {
        setNotesText(res.text);
        toast.success(`Extracted ${res.charCount || res.text.length} characters from ${file.name}`, { id: "extract" });
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to extract text from document", { id: "extract" });
    } finally {
      setExtracting(false);
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Generate Quiz
  const handleGenerate = async (e) => {
    if (e) e.preventDefault();

    if (!subject.trim()) {
      toast.error("Please enter a subject or course name.");
      return;
    }

    if (mode === "TOPIC" && !topic.trim()) {
      toast.error("Please enter a topic to focus the quiz on.");
      return;
    }

    if (mode === "NOTES" && !notesText.trim() && !uploadedFile) {
      toast.error("Please upload notes or paste study material for notes-based generation.");
      return;
    }

    try {
      setGenerating(true);
      setPublishedPaper(null);

      const payload = {
        subject: subject.trim(),
        topic: topic.trim() || subject.trim(),
        mode,
        notesText: notesText.trim(),
        questionCount: Number(questionCount) || 10,
        difficulty,
        semester,
        marksPerQuestion: Number(marksPerQuestion) || 1.0,
        includeExplanations: true,
        createdBy: teacherEmail,
        mock: mockMode,
      };

      const res = await generateQuiz(payload, uploadedFile);

      if (res?.success) {
        setQuestions(res.questions || []);
        setWarnings(res.warnings || []);
        setReviewMode(true);
        toast.success(res.message || `Generated ${res.questions?.length} MCQs successfully!`);
      } else {
        toast.error(res?.error || "Quiz generation failed.");
        if (res?.errorCode === "OPENROUTER_KEY_NOT_CONFIGURED") {
          toast((t) => (
            <div>
              <span>You can enable <strong>Mock Test Mode</strong> to preview quiz generation offline.</span>
              <button
                style={{ marginLeft: 8, padding: "2px 8px", background: "#ec4899", color: "#fff", border: "none", borderRadius: 4 }}
                onClick={() => {
                  setMockMode(true);
                  toast.dismiss(t.id);
                }}
              >
                Enable Mock Mode
              </button>
            </div>
          ), { duration: 6000 });
        }
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || err.message || "Failed to generate quiz.");
    } finally {
      setGenerating(false);
    }
  };

  // Edit Question Handlers
  const handleQuestionTextChange = (idx, text) => {
    setQuestions((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], text };
      return copy;
    });
  };

  const handleOptionChange = (qIdx, optIdx, val) => {
    setQuestions((prev) => {
      const copy = [...prev];
      const opts = [...(copy[qIdx].options || [])];
      opts[optIdx] = val;
      copy[qIdx] = { ...copy[qIdx], options: opts };
      return copy;
    });
  };

  const handleCorrectAnswerChange = (qIdx, letter) => {
    setQuestions((prev) => {
      const copy = [...prev];
      copy[qIdx] = { ...copy[qIdx], correctAnswer: letter };
      return copy;
    });
  };

  const handleExplanationChange = (idx, explanation) => {
    setQuestions((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], explanation };
      return copy;
    });
  };

  const handleDeleteQuestion = (idx) => {
    if (questions.length <= 1) {
      toast.error("A quiz must have at least one question.");
      return;
    }
    setQuestions((prev) => {
      const filtered = prev.filter((_, i) => i !== idx);
      return filtered.map((q, i) => ({ ...q, questionId: `Q${i + 1}` }));
    });
    toast.success("Question removed.");
  };

  const handleAddQuestion = () => {
    const nextIdx = questions.length + 1;
    const newQ = {
      questionId: `Q${nextIdx}`,
      text: "New custom question prompt...",
      options: ["Option A text", "Option B text", "Option C text", "Option D text"],
      correctAnswer: "A",
      explanation: "Explanation of the correct answer.",
      marks: Number(marksPerQuestion) || 1.0,
      topic: topic || subject,
      questionType: "MCQ",
    };
    setQuestions((prev) => [...prev, newQ]);
    toast.success(`Added question Q${nextIdx}`);
  };

  const handleRegenerateQuestion = async (qIdx) => {
    const targetQ = questions[qIdx];
    try {
      setRegeneratingId(targetQ.questionId);
      const res = await regenerateQuestion({
        subject,
        topic: targetQ.topic || topic || subject,
        difficulty,
        notesContext: notesText,
        existingQuestionId: targetQ.questionId,
        existingQuestionText: targetQ.text,
        mock: mockMode,
      });

      if (res?.question) {
        setQuestions((prev) => {
          const copy = [...prev];
          copy[qIdx] = { ...res.question, questionId: targetQ.questionId };
          return copy;
        });
        toast.success(`Regenerated question ${targetQ.questionId}`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to regenerate question.");
    } finally {
      setRegeneratingId(null);
    }
  };

  // Save Draft
  const handleSaveDraft = async () => {
    try {
      setSavingDraft(true);
      const payload = {
        paperId: activePaperId,
        subject: subject.trim(),
        subjectCode: subject.trim().substring(0, 6).toUpperCase(),
        examName: `${subject} MCQ Quiz (Draft)`,
        semester,
        topic: topic.trim(),
        difficulty,
        sourceMode: mode,
        paperCategory: "QUIZ",
        paperFormat: "MCQ",
        publicationStatus: "DRAFT",
        maxMarks: questions.reduce((acc, q) => acc + (Number(q.marks) || 1), 0),
        questions: questions.map((q, idx) => ({
          questionId: `Q${idx + 1}`,
          text: q.text,
          marks: Number(q.marks) || 1,
          questionType: "MCQ",
          section: "PART-A",
          topic: q.topic || topic || subject,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
        })),
        createdBy: teacherEmail,
      };

      const res = await saveQuizDraft(payload, teacherEmail);
      if (res?.success) {
        setActivePaperId(res.paper?.paperId || res.paper?.id);
        toast.success("Quiz draft saved successfully! You can resume it anytime.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to save quiz draft.");
    } finally {
      setSavingDraft(false);
    }
  };

  // Open Drafts Modal
  const handleOpenDrafts = async () => {
    try {
      setLoadingDrafts(true);
      setDraftsModalOpen(true);
      const drafts = await getTeacherDrafts(teacherEmail);
      setSavedDrafts(drafts || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load drafts.");
    } finally {
      setLoadingDrafts(false);
    }
  };

  // Load an existing draft
  const handleLoadDraft = (draft) => {
    setSubject(draft.subject || "");
    setTopic(draft.topic || "");
    setSemester(draft.semester || draft.assignedSemester || "5th Sem");
    setDifficulty(draft.difficulty || "MEDIUM");
    setMode(draft.sourceMode || "TOPIC");
    setActivePaperId(draft.paperId || draft.id);

    if (draft.questions && draft.questions.length > 0) {
      setQuestions(
        draft.questions.map((q, i) => ({
          questionId: q.questionId || `Q${i + 1}`,
          text: q.text,
          options: q.options || ["Option A", "Option B", "Option C", "Option D"],
          correctAnswer: q.correctAnswer || "A",
          explanation: q.explanation || "",
          marks: q.marks || 1,
          topic: q.topic || draft.subject,
          questionType: "MCQ",
        }))
      );
      setReviewMode(true);
    }

    setDraftsModalOpen(false);
    toast.success(`Loaded draft "${draft.subject}"`);
  };

  // Publish approved quiz
  const handleConfirmPublish = async () => {
    // Validate all questions have non-empty prompt and options
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) {
        toast.error(`Question ${q.questionId} has an empty prompt.`);
        return;
      }
      if (!q.options || q.options.length < 4 || q.options.some((o) => !o.trim())) {
        toast.error(`Question ${q.questionId} must have all 4 non-empty options.`);
        return;
      }
    }

    try {
      setPublishing(true);
      const payload = {
        paperId: activePaperId || null,
        subject: subject.trim(),
        subjectCode: subject.trim().substring(0, 6).toUpperCase(),
        examName: `${subject} MCQ Quiz`,
        semester,
        assignedSemester: semester,
        topic: topic.trim(),
        difficulty,
        sourceMode: mode,
        paperCategory: "QUIZ",
        paperFormat: "MCQ",
        allowedForPractice: true,
        publicationStatus: "PUBLISHED",
        maxMarks: questions.reduce((acc, q) => acc + (Number(q.marks) || 1), 0),
        questions: questions.map((q, idx) => ({
          questionId: `Q${idx + 1}`,
          text: q.text,
          marks: Number(q.marks) || 1,
          questionType: "MCQ",
          section: "PART-A",
          topic: q.topic || topic || subject,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
        })),
        createdBy: teacherEmail,
      };

      const res = await publishQuiz(payload, teacherEmail);
      if (res?.success) {
        setPublishedPaper(res.paper);
        setActivePaperId(res.paper?.paperId || res.paper?.id);
        setPublishModalOpen(false);
        toast.success("🚀 Quiz published successfully! It is now live for students and accessible in Uploaded Papers Analysis.");
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to publish quiz.");
    } finally {
      setPublishing(false);
    }
  };

  const totalCalculatedMarks = questions.reduce((acc, q) => acc + (Number(q.marks) || 1), 0);

  return (
    <div className="quiz-gen-page">
      <div className="quiz-gen-container">
        {/* Navigation Bar */}
        <div className="quiz-gen-nav">
          <button className="quiz-back-btn" onClick={() => navigate("/teacher/dashboard")}>
            ← Back to Teacher Dashboard
          </button>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="drafts-btn" onClick={handleOpenDrafts}>
              📁 View Saved Drafts
            </button>
          </div>
        </div>

        {/* Hero Banner */}
        <div className="quiz-hero-banner">
          <span className="quiz-badge">✨ AI Assessment Studio</span>
          <h1>MCQ Quiz Generator</h1>
          <p>
            Generate curriculum-grounded multiple-choice quizzes from any subject topic or lecture notes.
            Review and edit questions, test answers, save drafts, and publish directly to Acadion's exam and practice portal.
          </p>
        </div>

        {/* Published Success Banner */}
        {publishedPaper && (
          <div
            style={{
              background: "linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.2) 100%)",
              border: "1px solid #10b981",
              borderRadius: 16,
              padding: "24px 28px",
              marginBottom: 30,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: "1.4rem" }}>🎉</span>
                <h3 style={{ margin: 0, color: "#34d399", fontSize: "1.2rem" }}>Quiz Published Successfully!</h3>
              </div>
              <p style={{ margin: 0, color: "#cbd5e1", fontSize: "0.9rem" }}>
                Paper ID: <strong>{publishedPaper.paperId}</strong> • {publishedPaper.questions?.length} MCQs • Total Marks: {publishedPaper.maxMarks} M.
                It is now visible in Uploaded Papers Analysis and accessible to students.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="action-btn-outline"
                style={{ background: "rgba(16, 185, 129, 0.2)", borderColor: "#10b981", color: "#fff" }}
                onClick={() => navigate(`/teacher/paper-analysis/${publishedPaper.paperId || publishedPaper.id}`)}
              >
                Inspect in Paper Analysis →
              </button>
              <button
                className="action-btn-outline"
                onClick={() => {
                  setPublishedPaper(null);
                  setReviewMode(false);
                  setQuestions([]);
                }}
              >
                Create Another Quiz
              </button>
            </div>
          </div>
        )}

        {/* Mode Selector - Exactly 2 Modes */}
        <div className="modes-selector-grid">
          <div
            className={`mode-card-btn ${mode === "TOPIC" ? "active" : ""}`}
            onClick={() => setMode("TOPIC")}
          >
            <div className="mode-icon-title">
              <span className="mode-icon">💡</span>
              <span className="mode-title">Topic-Based</span>
            </div>
            <p className="mode-desc">
              Generate questions based on academic topics like Python, DBMS, Operating Systems, or Machine Learning.
            </p>
          </div>

          <div
            className={`mode-card-btn ${mode === "NOTES" ? "active" : ""}`}
            onClick={() => setMode("NOTES")}
          >
            <div className="mode-icon-title">
              <span className="mode-icon">📄</span>
              <span className="mode-title">Notes-Based</span>
            </div>
            <p className="mode-desc">
              Upload PDF / Word documents or paste lecture notes. Questions are strictly grounded in your study material.
            </p>
          </div>
        </div>

        {/* Configuration Card */}
        <div className="quiz-config-card">
          <form onSubmit={handleGenerate}>
            <div className={mode === "TOPIC" ? "config-grid-2" : "config-single"}>
              <div className="form-group">
                <label>📚 Course / Subject Title *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Database Management Systems, Python Programming"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                />
              </div>

              {mode === "TOPIC" && (
                <div className="form-group">
                  <label>🎯 Focus Topic / Syllabus Unit *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. SQL Normalization, Process Synchronization, Binary Trees"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    required={mode === "TOPIC"}
                  />
                </div>
              )}
            </div>

            {/* Notes upload and text area */}
            {mode === "NOTES" && (
              <div style={{ marginBottom: 20 }}>
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label>📎 Upload Lecture Document (PDF, DOCX, TXT)</label>
                  <div
                    className={`file-drop-zone ${uploadedFile ? "has-file" : ""}`}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      style={{ display: "none" }}
                      accept=".pdf,.docx,.doc,.txt"
                      onChange={handleFileChange}
                    />
                    {uploadedFile ? (
                      <div className="file-preview-pill">
                        <span>📄 {uploadedFile.name} ({(uploadedFile.size / 1024).toFixed(1)} KB)</span>
                        <button
                          type="button"
                          className="remove-file-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFile();
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="drop-icon">📤</span>
                        <span className="drop-prompt">Click to browse or drag & drop lecture notes</span>
                        <span className="drop-subtext">Supports PDF, Word (.docx), and plain text documents (max 15MB)</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label>📝 Or Paste Study Material / Syllabus Excerpt</label>
                  <textarea
                    rows={6}
                    className="form-textarea"
                    placeholder="Paste textbook definitions, lecture notes, key formulas, or code snippets here..."
                    value={notesText}
                    onChange={(e) => setNotesText(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Parameters Row */}
            <div className="config-grid-3">
              <div className="form-group">
                <label>🔢 Number of Questions</label>
                <select
                  className="form-select"
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                >
                  <option value={5}>5 Questions (Quick Quiz)</option>
                  <option value={10}>10 Questions (Standard Quiz)</option>
                  <option value={15}>15 Questions (Module Test)</option>
                  <option value={20}>20 Questions (Comprehensive)</option>
                  <option value={25}>25 Questions (Assessment)</option>
                </select>
              </div>

              <div className="form-group">
                <label>⚖️ Difficulty Level</label>
                <select
                  className="form-select"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                >
                  <option value="EASY">Easy (Definitions & Basic Concepts)</option>
                  <option value="MEDIUM">Medium (Application & Problem Solving)</option>
                  <option value="HARD">Hard (Analysis, Derivations & Edge Cases)</option>
                </select>
              </div>

              <div className="form-group">
                <label>🏛️ Target Semester</label>
                <select
                  className="form-select"
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                >
                  <option value="ALL">All Semesters</option>
                  <option value="1st Sem">1st Semester</option>
                  <option value="2nd Sem">2nd Semester</option>
                  <option value="3rd Sem">3rd Semester</option>
                  <option value="4th Sem">4th Semester</option>
                  <option value="5th Sem">5th Semester</option>
                  <option value="6th Sem">6th Semester</option>
                  <option value="7th Sem">7th Semester</option>
                  <option value="8th Sem">8th Semester</option>
                </select>
              </div>
            </div>

            {/* Bottom Options Bar */}
            <div className="extra-options-bar">
              <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                <label className="toggle-label" title="Enable mock mode for instant offline verification">
                  <input
                    type="checkbox"
                    checked={mockMode}
                    onChange={(e) => setMockMode(e.target.checked)}
                  />
                  <span>Mock Mode (Offline Academic Generator)</span>
                </label>
                <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                  Marks per Question: <strong>{marksPerQuestion} M</strong>
                </span>
              </div>

              <button
                type="submit"
                className="generate-cta-btn"
                disabled={generating || extracting}
              >
                {generating ? (
                  <>
                    <div className="spinner-inline" />
                    <span>Synthesizing Academic MCQs...</span>
                  </>
                ) : (
                  <>
                    <span>✨ Generate Quiz with AI</span>
                    <span style={{ fontSize: "1.1rem" }}>→</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Warnings */}
        {warnings && warnings.length > 0 && (
          <div className="warnings-alert">
            <strong>Validation Notices:</strong>
            <ul style={{ margin: "4px 0 0 0", paddingLeft: 20 }}>
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Review & Editing Canvas */}
        {reviewMode && questions.length > 0 && (
          <div>
            {/* Review Header Bar */}
            <div className="review-header-bar">
              <div className="review-summary-stats">
                <div className="stat-item">
                  <span className="stat-label">Subject</span>
                  <span className="stat-value">{subject}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Total Questions</span>
                  <span className="stat-value" style={{ color: "#ec4899" }}>{questions.length} MCQs</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Total Marks</span>
                  <span className="stat-value" style={{ color: "#34d399" }}>{totalCalculatedMarks} M</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Difficulty</span>
                  <span className="stat-value" style={{ color: "#38bdf8" }}>{difficulty}</span>
                </div>
              </div>

              <div className="review-actions-group">
                <button
                  type="button"
                  className="action-btn-outline"
                  onClick={handleAddQuestion}
                >
                  + Add Question
                </button>
                <button
                  type="button"
                  className="action-btn-draft"
                  disabled={savingDraft}
                  onClick={handleSaveDraft}
                >
                  {savingDraft ? "Saving..." : "💾 Save Draft"}
                </button>
                <button
                  type="button"
                  className="action-btn-publish"
                  onClick={() => setPublishModalOpen(true)}
                >
                  🚀 Publish to Acadion
                </button>
              </div>
            </div>

            {/* Questions List */}
            <div className="questions-list-wrapper">
              {questions.map((q, qIdx) => (
                <div className="question-edit-card" key={q.questionId || qIdx}>
                  <div className="q-top-row">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className="q-badge-num">{q.questionId || `Q${qIdx + 1}`}</span>
                      <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                        Topic: <strong>{q.topic || topic || subject}</strong> • 1 Mark
                      </span>
                    </div>

                    <div className="q-card-actions">
                      <button
                        type="button"
                        className="btn-icon-q"
                        disabled={regeneratingId === q.questionId}
                        onClick={() => handleRegenerateQuestion(qIdx)}
                        title="Regenerate this question with AI"
                      >
                        {regeneratingId === q.questionId ? "..." : "🔄 Regenerate"}
                      </button>
                      <button
                        type="button"
                        className="btn-icon-q btn-delete-q"
                        onClick={() => handleDeleteQuestion(qIdx)}
                        title="Delete question"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>

                  {/* Question Prompt Text */}
                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <textarea
                      rows={2}
                      className="form-textarea"
                      style={{ fontSize: "0.98rem", fontWeight: 600 }}
                      value={q.text}
                      onChange={(e) => handleQuestionTextChange(qIdx, e.target.value)}
                    />
                  </div>

                  {/* Options 2x2 Grid */}
                  <div className="options-edit-grid">
                    {q.options && q.options.map((optText, optIdx) => {
                      const letter = String.fromCharCode(65 + optIdx); // A, B, C, D
                      const isCorrect = q.correctAnswer === letter;

                      return (
                        <div
                          className={`option-edit-row ${isCorrect ? "is-correct" : ""}`}
                          key={optIdx}
                        >
                          <span className="opt-letter-badge">{letter}</span>
                          <input
                            type="text"
                            className="opt-input"
                            value={optText}
                            onChange={(e) => handleOptionChange(qIdx, optIdx, e.target.value)}
                          />
                          <label className="opt-radio-label">
                            <input
                              type="radio"
                              name={`correct-ans-${qIdx}`}
                              value={letter}
                              checked={isCorrect}
                              onChange={() => handleCorrectAnswerChange(qIdx, letter)}
                            />
                            <span>Correct</span>
                          </label>
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation Field */}
                  <div className="explanation-edit-box">
                    <div className="explanation-label">
                      <span>💡 Educational Explanation &amp; Rationale:</span>
                    </div>
                    <textarea
                      rows={2}
                      className="form-textarea"
                      style={{ background: "rgba(0,0,0,0.25)", fontSize: "0.85rem", color: "#cbd5e1" }}
                      value={q.explanation || ""}
                      onChange={(e) => handleExplanationChange(qIdx, e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Publish Confirmation Modal */}
        {publishModalOpen && (
          <div className="modal-overlay-custom" onClick={() => setPublishModalOpen(false)}>
            <div className="modal-content-custom" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header-custom">
                <h3>🚀 Confirm Quiz Publication</h3>
                <button className="modal-close-btn" onClick={() => setPublishModalOpen(false)}>✕</button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <p style={{ color: "#cbd5e1", fontSize: "0.92rem", margin: 0 }}>
                  Publishing will make this quiz available for examination and practice in Acadion:
                </p>

                <div style={{ background: "rgba(255,255,255,0.04)", padding: 14, borderRadius: 10, fontSize: "0.88rem" }}>
                  <div>📚 <strong>Subject:</strong> {subject}</div>
                  <div>🎯 <strong>Topic:</strong> {topic || subject}</div>
                  <div>🔢 <strong>Questions:</strong> {questions.length} MCQs ({totalCalculatedMarks} Marks)</div>
                  <div>🏛️ <strong>Assigned Semester:</strong> {semester}</div>
                  <div>🎯 <strong>Practice Mode:</strong> Enabled for authorized students</div>
                </div>

                <div className="form-group">
                  <label>Assign to Semester Batch</label>
                  <select
                    className="form-select"
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                  >
                    <option value="ALL">All Semesters</option>
                    <option value="1st Sem">1st Semester</option>
                    <option value="2nd Sem">2nd Semester</option>
                    <option value="3rd Sem">3rd Semester</option>
                    <option value="4th Sem">4th Semester</option>
                    <option value="5th Sem">5th Semester</option>
                    <option value="6th Sem">6th Semester</option>
                    <option value="7th Sem">7th Semester</option>
                    <option value="8th Sem">8th Semester</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer-custom">
                <button
                  type="button"
                  className="action-btn-outline"
                  onClick={() => setPublishModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="action-btn-publish"
                  disabled={publishing}
                  onClick={handleConfirmPublish}
                >
                  {publishing ? "Publishing Quiz..." : "✓ Confirm & Publish Live"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Drafts Drawer Modal */}
        {draftsModalOpen && (
          <div className="modal-overlay-custom" onClick={() => setDraftsModalOpen(false)}>
            <div className="modal-content-custom" style={{ maxWidth: 650 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header-custom">
                <h3>📁 Saved Quiz Drafts</h3>
                <button className="modal-close-btn" onClick={() => setDraftsModalOpen(false)}>✕</button>
              </div>

              {loadingDrafts ? (
                <div style={{ textAlign: "center", padding: 30, color: "#94a3b8" }}>Loading drafts...</div>
              ) : savedDrafts.length === 0 ? (
                <div style={{ textAlign: "center", padding: 30, color: "#94a3b8" }}>
                  No saved drafts found for your account.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 380, overflowY: "auto" }}>
                  {savedDrafts.map((d) => (
                    <div
                      key={d.id || d.paperId}
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 10,
                        padding: "12px 16px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: "#f1f5f9" }}>{d.subject}</div>
                        <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                          {d.paperId} • {d.questions?.length || 0} Questions • Sem: {d.semester || "All"}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="action-btn-outline"
                        style={{ fontSize: "0.8rem", padding: "6px 14px" }}
                        onClick={() => handleLoadDraft(d)}
                      >
                        Resume Draft →
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default QuizGenerator;
