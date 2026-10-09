import { useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { createQuestionPaper } from "../../services/paperService";
import "./CreateQuestionPaper.css";

function CreateQuestionPaper() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    paperId: "",
    subject: "",
    subjectCode: "",
    examName: "",
    semester: "6",
    maxMarks: "40",
    durationMinutes: "90",
    internalNo: "1",
    paperCategory: "ASSESSMENT", // ASSESSMENT, PRACTICE, QUIZ
    examType: "1",
    customExamName: "",
    questions: [
      {
        questionId: "Q1",
        parentQuestion: "Q1",
        subQuestion: "",
        text: "",
        section: "MODULE-1",
        groupName: "GROUP-A",
        optionalQuestion: false,
        optionalWith: "",
        maxAttempt: 1,
        questionType: "THEORY",
        marks: 10,
        topic: "General",
        imageUrl: null,
        options: ["", "", "", ""],
        correctAnswer: "A",
        explanation: "",
      },
    ],
  });

  const isMcqMode = formData.paperCategory === "QUIZ";

  const handleCategoryChange = (newCategory) => {
    const isMcq = newCategory === "QUIZ";
    const updatedQuestions = formData.questions.map((q, idx) => ({
      ...q,
      questionType: isMcq ? "MCQ" : "THEORY",
      marks: isMcq ? 1 : (q.marks > 2 ? q.marks : 10),
      options: isMcq ? (q.options?.length ? q.options : ["", "", "", ""]) : [],
    }));

    setFormData({
      ...formData,
      paperCategory: newCategory,
      durationMinutes: isMcq ? "30" : "90",
      examType: isMcq ? "QUIZ" : formData.examType === "QUIZ" ? "1" : formData.examType,
      questions: updatedQuestions,
    });
  };

  const handleExamTypeChange = (typeVal) => {
    let intNo = 1;
    let defExamName = "Internal Assessment Test-I";

    if (typeVal === "1") {
      intNo = 1;
      defExamName = "Internal Assessment Test-I";
    } else if (typeVal === "2") {
      intNo = 2;
      defExamName = "Internal Assessment Test-II";
    } else if (typeVal === "3") {
      intNo = 3;
      defExamName = "Internal Assessment Test-III";
    } else if (typeVal === "MID_TERM") {
      intNo = 1;
      defExamName = "Mid-Term Examination";
    } else if (typeVal === "SEM_EXAM") {
      intNo = 1;
      defExamName = "Semester End Examination (SEE)";
    } else if (typeVal === "FINAL_EXAM") {
      intNo = 1;
      defExamName = "Final University Examination";
    } else if (typeVal === "MODEL_PRACTICE") {
      intNo = 1;
      defExamName = "Model / Practice Examination";
    } else if (typeVal === "QUIZ") {
      intNo = 1;
      defExamName = "Objective MCQ Quiz";
    } else if (typeVal === "CUSTOM") {
      intNo = 1;
      defExamName = formData.customExamName || "Special Examination";
    }

    setFormData({
      ...formData,
      examType: typeVal,
      internalNo: intNo,
      examName: defExamName,
    });
  };

  const handleHeaderChange = (field, value) => {
    if (field === "customExamName" && formData.examType === "CUSTOM") {
      setFormData({ ...formData, customExamName: value, examName: value });
    } else {
      setFormData({ ...formData, [field]: value });
    }
  };

  const handleQuestionChange = (index, field, value) => {
    const updatedQuestions = [...formData.questions];
    updatedQuestions[index][field] = value;

    // Recalculate full questionId if parentQuestion or subQuestion changed
    if (field === "parentQuestion" || field === "subQuestion") {
      const parent = (field === "parentQuestion" ? value : updatedQuestions[index].parentQuestion || `Q${index + 1}`).trim();
      const sub = (field === "subQuestion" ? value : updatedQuestions[index].subQuestion || "").trim();

      if (!sub) {
        updatedQuestions[index].questionId = parent;
      } else {
        const cleanSub = sub.replace(/^[.\s(]+|[)\s]+$/g, "");
        updatedQuestions[index].questionId = `${parent}.${cleanSub})`;
      }
    }

    setFormData({
      ...formData,
      questions: updatedQuestions,
    });
  };

  const handleOptionChange = (qIndex, optIndex, value) => {
    const updatedQuestions = [...formData.questions];
    const opts = [...(updatedQuestions[qIndex].options || ["", "", "", ""])];
    opts[optIndex] = value;
    updatedQuestions[qIndex].options = opts;
    setFormData({
      ...formData,
      questions: updatedQuestions,
    });
  };

  const handleQuestionImageUpload = (index, file) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image file must be less than 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const updatedQuestions = [...formData.questions];
      updatedQuestions[index].imageUrl = reader.result;
      setFormData({
        ...formData,
        questions: updatedQuestions,
      });
      toast.success("Diagram attached to question");
    };
    reader.readAsDataURL(file);
  };

  const removeQuestionImage = (index) => {
    const updatedQuestions = [...formData.questions];
    updatedQuestions[index].imageUrl = null;
    setFormData({
      ...formData,
      questions: updatedQuestions,
    });
  };

  const addQuestion = () => {
    const nextIdx = formData.questions.length + 1;
    const parentQ = `Q${nextIdx}`;
    const modNum = Math.ceil(nextIdx / 2);

    setFormData({
      ...formData,
      questions: [
        ...formData.questions,
        {
          questionId: parentQ,
          parentQuestion: parentQ,
          subQuestion: "",
          text: "",
          section: `MODULE-${modNum}`,
          groupName: nextIdx % 2 === 1 ? "GROUP-A" : "GROUP-B",
          optionalQuestion: false,
          optionalWith: "",
          maxAttempt: 1,
          questionType: isMcqMode ? "MCQ" : "THEORY",
          marks: isMcqMode ? 1 : 10,
          topic: "General",
          imageUrl: null,
          options: ["", "", "", ""],
          correctAnswer: "A",
          explanation: "",
        },
      ],
    });
  };

  const deleteQuestion = (index) => {
    if (formData.questions.length <= 1) {
      toast.error("Paper must have at least one question");
      return;
    }
    const updatedQuestions = formData.questions.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      questions: updatedQuestions,
    });
  };

  const calculateTotalMarks = () => {
    if (formData.maxMarks && Number(formData.maxMarks) > 0) {
      return Number(formData.maxMarks);
    }
    return formData.questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.paperId.trim()) {
      toast.error("Paper ID / Unique Code is required");
      return;
    }
    if (!formData.subject.trim()) {
      toast.error("Subject name is required");
      return;
    }

    for (let i = 0; i < formData.questions.length; i++) {
      const q = formData.questions[i];
      if (!q.text.trim()) {
        toast.error(`Question #${i + 1} text cannot be empty`);
        return;
      }
      if (isMcqMode) {
        const filledOptions = (q.options || []).filter((opt) => opt.trim().length > 0);
        if (filledOptions.length < 2) {
          toast.error(`Question #${i + 1} (MCQ) must have at least 2 options`);
          return;
        }
      }
    }

    try {
      setLoading(true);

      const payload = {
        paperId: formData.paperId.trim(),
        subject: formData.subject.trim(),
        subjectCode: formData.subjectCode.trim() || formData.paperId.trim(),
        examName: formData.examName.trim() || (isMcqMode ? "MCQ Objective Quiz" : formData.paperCategory === "PRACTICE" ? "Self Practice Paper" : "Internal Assessment"),
        semester: String(formData.semester),
        assignedSemester: String(formData.semester),
        createdBy: localStorage.getItem("email") || localStorage.getItem("name") || "Teacher",
        internalNo: Number(formData.internalNo) || 1,
        durationMinutes: Number(formData.durationMinutes) || (isMcqMode ? 30 : 90),
        duration: `${Number(formData.durationMinutes) || (isMcqMode ? 30 : 90)} Mins`,
        maxMarks: Number(formData.maxMarks) || 40,
        totalMarks: calculateTotalMarks(),
        paperCategory: formData.paperCategory,
        allowedForPractice: formData.paperCategory === "PRACTICE",
        paperFormat: isMcqMode ? "MCQ" : "THEORY",
        questions: formData.questions.map((q, idx) => ({
          questionId: q.questionId?.trim() || `Q${idx + 1}`,
          parentQuestion: q.parentQuestion?.trim() || q.questionId || `Q${idx + 1}`,
          text: q.text.trim(),
          section: q.section?.trim() || `MODULE-1`,
          groupName: isMcqMode ? null : (q.groupName?.trim() || (q.optionalWith ? "GROUP-B" : "GROUP-A")),
          optionalQuestion: isMcqMode ? false : Boolean(q.optionalQuestion),
          optionalWith: isMcqMode ? null : (q.optionalWith ? q.optionalWith.trim() : null),
          maxAttempt: 1,
          questionType: isMcqMode ? "MCQ" : "THEORY",
          marks: Number(q.marks) || (isMcqMode ? 1 : 10),
          topic: q.topic?.trim() || "General",
          imageUrl: q.imageUrl || null,
          options: isMcqMode ? q.options.filter(Boolean) : [],
          correctAnswer: isMcqMode ? q.correctAnswer : null,
          explanation: q.explanation || null,
        })),
      };

      await createQuestionPaper(payload);
      toast.success(`${isMcqMode ? "MCQ Quiz" : formData.paperCategory === "PRACTICE" ? "Practice Paper" : "Examination Paper"} created successfully!`);
      navigate("/teacher/dashboard");
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || error.response?.data || "Failed to create question paper");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-paper-page">
      <div className="create-header-bar">
        <button className="back-btn" onClick={() => navigate("/teacher/dashboard")}>
          ← Back To Dashboard
        </button>
        <div className="header-info">
          <h1>Create Question Paper & Quiz</h1>
          <p>Design official examination papers, practice self-study sets, or objective MCQ quizzes.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="paper-form">
        {/* Paper Category & Purpose Card */}
        <div className="form-card category-card">
          <h2>1. Select Paper Format & Examination Type</h2>
          <div className="category-select-grid">
            <label className={`category-tile ${formData.paperCategory === "ASSESSMENT" ? "active" : ""}`}>
              <input
                type="radio"
                name="paperCategory"
                value="ASSESSMENT"
                checked={formData.paperCategory === "ASSESSMENT"}
                onChange={() => handleCategoryChange("ASSESSMENT")}
              />
              <span className="cat-icon">📋</span>
              <div className="cat-text">
                <strong>Theory Official Assessment</strong>
                <small>Internal Exams with module OR choices</small>
              </div>
            </label>

            <label className={`category-tile ${formData.paperCategory === "PRACTICE" ? "active" : ""}`}>
              <input
                type="radio"
                name="paperCategory"
                value="PRACTICE"
                checked={formData.paperCategory === "PRACTICE"}
                onChange={() => handleCategoryChange("PRACTICE")}
              />
              <span className="cat-icon">🎯</span>
              <div className="cat-text">
                <strong>Theory Practice Paper</strong>
                <small>Unlimited Retakes & Peer Review</small>
              </div>
            </label>

            <label className={`category-tile ${formData.paperCategory === "QUIZ" ? "active" : ""}`}>
              <input
                type="radio"
                name="paperCategory"
                value="QUIZ"
                checked={formData.paperCategory === "QUIZ"}
                onChange={() => handleCategoryChange("QUIZ")}
              />
              <span className="cat-icon">🔘</span>
              <div className="cat-text">
                <strong>Objective MCQ Quiz</strong>
                <small>Interactive Multiple Choice Questions</small>
              </div>
            </label>
          </div>
        </div>

        {/* Header Metadata Card */}
        <div className="form-card">
          <h2>2. Paper Details & Academic Metadata</h2>
          <div className="form-grid">
            <div className="form-group">
              <label>Paper ID / Unique Code *</label>
              <input
                type="text"
                placeholder="e.g. CSE-IOT-101"
                value={formData.paperId}
                onChange={(e) => handleHeaderChange("paperId", e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Subject Name *</label>
              <input
                type="text"
                placeholder="e.g. Internet of Things"
                value={formData.subject}
                onChange={(e) => handleHeaderChange("subject", e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Subject Code</label>
              <input
                type="text"
                placeholder="e.g. 21CS61"
                value={formData.subjectCode}
                onChange={(e) => handleHeaderChange("subjectCode", e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Target Semester *</label>
              <select
                value={formData.semester}
                onChange={(e) => handleHeaderChange("semester", e.target.value)}
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

            <div className="form-group">
              <label>Examination Type / Category *</label>
              <select
                value={formData.examType || "1"}
                onChange={(e) => handleExamTypeChange(e.target.value)}
              >
                <option value="1">Internal Assessment Test 1 (IA-1)</option>
                <option value="2">Internal Assessment Test 2 (IA-2)</option>
                <option value="3">Internal Assessment Test 3 (IA-3)</option>
                <option value="MID_TERM">Mid-Term Examination</option>
                <option value="SEM_EXAM">Semester End Examination (SEE)</option>
                <option value="FINAL_EXAM">Final / University Examination</option>
                <option value="MODEL_PRACTICE">Model / Practice Examination</option>
                <option value="QUIZ">Objective MCQ Quiz / Test</option>
                <option value="CUSTOM">Custom / Other Examination...</option>
              </select>
            </div>

            {formData.examType === "CUSTOM" && (
              <div className="form-group">
                <label>Custom Examination Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Unit Test 1, Lab Exam, Surprise Test..."
                  value={formData.customExamName || ""}
                  onChange={(e) => handleHeaderChange("customExamName", e.target.value)}
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label>Total Time / Duration (Minutes) *</label>
              <input
                type="number"
                placeholder={isMcqMode ? "30" : "90"}
                value={formData.durationMinutes}
                onChange={(e) => handleHeaderChange("durationMinutes", e.target.value)}
                min="5"
                max="360"
                required
              />
            </div>

            <div className="form-group">
              <label>Maximum Marks *</label>
              <input
                type="number"
                placeholder={isMcqMode ? "10" : "40"}
                value={formData.maxMarks}
                onChange={(e) => handleHeaderChange("maxMarks", e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        {/* Question Builder */}
        <div className="questions-container">
          <div className="questions-header-row">
            <h2>3. Questions & Details ({formData.questions.length} {formData.questions.length === 1 ? "Question" : "Questions"})</h2>
          </div>

          {formData.questions.map((q, index) => (
            <div className={`question-block ${isMcqMode ? "mcq-block" : "theory-block"}`} key={index}>
              <div className="question-block-header">
                <div className="q-title-left">
                  <span className="q-number-badge">#{index + 1}</span>

                  {/* Main Question (e.g. Q1, Q2) */}
                  <div className="q-id-cluster">
                    <label className="id-sublabel">Main Q:</label>
                    <input
                      type="text"
                      className="q-id-input"
                      value={q.parentQuestion !== undefined ? q.parentQuestion : `Q${index + 1}`}
                      onChange={(e) => handleQuestionChange(index, "parentQuestion", e.target.value)}
                      placeholder="Q1"
                    />
                  </div>

                  {/* Sub-Question Manual Input (e.g. (a), (b), (i), 1, 2, etc.) */}
                  {!isMcqMode && (
                    <div className="q-id-cluster">
                      <label className="id-sublabel">Sub-Q:</label>
                      <input
                        type="text"
                        className="q-sub-id-input"
                        value={q.subQuestion || ""}
                        onChange={(e) => handleQuestionChange(index, "subQuestion", e.target.value)}
                        placeholder="e.g. (a), 1"
                      />
                    </div>
                  )}

                  {/* Full Effective Question ID */}
                  <div className="q-id-cluster final-id">
                    <label className="id-sublabel">Full ID:</label>
                    <input
                      type="text"
                      className="q-full-id-input"
                      value={q.questionId !== undefined ? q.questionId : `Q${index + 1}`}
                      onChange={(e) => handleQuestionChange(index, "questionId", e.target.value)}
                      placeholder="Q1 / Q1(a)"
                    />
                  </div>

                  <span className="q-mode-label">
                    {isMcqMode ? "🔘 MCQ" : "📝 Theory"}
                  </span>
                </div>

                <div className="q-header-right">
                  <div className="marks-input-box">
                    <label>Marks:</label>
                    <input
                      type="number"
                      step="0.5"
                      value={q.marks}
                      onChange={(e) => handleQuestionChange(index, "marks", e.target.value)}
                      required
                    />
                  </div>
                  <button
                    type="button"
                    className="delete-q-btn"
                    onClick={() => deleteQuestion(index)}
                    title="Delete Question"
                  >
                    🗑
                  </button>
                </div>
              </div>

              {/* Question Prompt */}
              <div className="form-group" style={{ marginBottom: "14px" }}>
                <label>Question Prompt / Text *</label>
                <textarea
                  rows={isMcqMode ? 2 : 3}
                  placeholder={isMcqMode ? "Enter the MCQ question prompt here..." : "Explain the architecture of IoT with neat diagram..."}
                  value={q.text}
                  onChange={(e) => handleQuestionChange(index, "text", e.target.value)}
                  required
                />
              </div>

              {/* MCQ Options Block */}
              {isMcqMode ? (
                <div className="mcq-options-wrapper">
                  <label className="options-title-label">Options & Correct Answer Selection:</label>
                  <div className="mcq-options-grid">
                    {["A", "B", "C", "D"].map((optLetter, optIdx) => (
                      <div className="mcq-option-row" key={optIdx}>
                        <label className={`option-radio-label ${q.correctAnswer === optLetter ? "checked" : ""}`}>
                          <input
                            type="radio"
                            name={`correct-ans-${index}`}
                            value={optLetter}
                            checked={q.correctAnswer === optLetter}
                            onChange={(e) => handleQuestionChange(index, "correctAnswer", e.target.value)}
                          />
                          <span className="opt-letter">{optLetter}</span>
                        </label>
                        <input
                          type="text"
                          placeholder={`Option ${optLetter} text...`}
                          value={q.options ? q.options[optIdx] || "" : ""}
                          onChange={(e) => handleOptionChange(index, optIdx, e.target.value)}
                          required
                        />
                      </div>
                    ))}
                  </div>

                  <div className="form-group" style={{ marginTop: "12px" }}>
                    <label>Solution Explanation / Reference Hint (Optional):</label>
                    <input
                      type="text"
                      placeholder="e.g. Network Layer handles logical IP routing and forwarding."
                      value={q.explanation || ""}
                      onChange={(e) => handleQuestionChange(index, "explanation", e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                /* Theory Module, Topic & Choice Configuration */
                <div className="theory-full-builder">
                  <div className="theory-meta-grid">
                    <div className="form-group">
                      <label>Module / Section</label>
                      <input
                        type="text"
                        placeholder="e.g. MODULE-1"
                        value={q.section}
                        onChange={(e) => handleQuestionChange(index, "section", e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>Topic / Concept</label>
                      <input
                        type="text"
                        placeholder="e.g. Internet of Things"
                        value={q.topic}
                        onChange={(e) => handleQuestionChange(index, "topic", e.target.value)}
                      />
                    </div>
                  </div>

                    {/* Optional / OR Choice Checkbox */}
                  <div className="optional-choice-row">
                    <label className="choice-checkbox-label">
                      <input
                        type="checkbox"
                        checked={Boolean(q.optionalQuestion)}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          const updated = [...formData.questions];
                          updated[index].optionalQuestion = isChecked;
                          if (isChecked && !updated[index].optionalWith) {
                            const m = String(updated[index].parentQuestion || "").match(/\d+/);
                            const num = m ? parseInt(m[0], 10) : index + 1;
                            updated[index].optionalWith = num % 2 === 1 ? `Q${num + 1}` : `Q${num - 1}`;
                          }
                          setFormData({ ...formData, questions: updated });
                        }}
                      />
                      <span>Is Optional / OR Choice Question?</span>
                    </label>

                    {q.optionalQuestion && (
                      <div className="choice-extra-fields">
                        <div className="choice-input-group">
                          <label className="choice-sub-label">OR / Alternative Question ID:</label>
                          <input
                            type="text"
                            placeholder="e.g. Q2"
                            value={q.optionalWith || ""}
                            onChange={(e) => handleQuestionChange(index, "optionalWith", e.target.value)}
                          />
                        </div>
                        <small className="choice-hint-text">
                          💡 (For <strong>{q.parentQuestion || "Q1"} OR {q.optionalWith || "Q2"}</strong> choice, enter <strong>{q.optionalWith || "Q2"}</strong>)
                        </small>
                      </div>
                    )}
                  </div>

                  {/* Diagram / Image Upload */}
                  <div className="diagram-upload-box">
                    <label className="diagram-label">Attach Diagram / Reference Image (Optional):</label>
                    {q.imageUrl ? (
                      <div className="attached-img-preview">
                        <img src={q.imageUrl} alt="Attached diagram" />
                        <button type="button" className="remove-img-btn" onClick={() => removeQuestionImage(index)}>
                          Remove Image ✕
                        </button>
                      </div>
                    ) : (
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleQuestionImageUpload(index, e.target.files[0])}
                        className="diagram-file-input"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Dedicated Add Question Action Box Below Questions */}
          <div className="add-question-box">
            <button
              type="button"
              className="add-question-cta-btn"
              onClick={addQuestion}
            >
              <span className="add-plus-icon">+</span>
              <span className="add-btn-text">
                Add Next {isMcqMode ? "MCQ Question" : "Theory Question"} <strong>(Q{formData.questions.length + 1})</strong>
              </span>
            </button>
          </div>
        </div>

        {/* Submit Actions Bar */}
        <div className="paper-form-footer">
          <div className="footer-meta">
            <span>Total Questions: <strong>{formData.questions.length}</strong></span>
            <span>Effective Marks: <strong>{formData.maxMarks} M</strong></span>
          </div>

          <div className="footer-actions">
            <button
              type="button"
              className="cancel-btn"
              onClick={() => navigate("/teacher/dashboard")}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="submit-paper-btn"
              disabled={loading}
            >
              {loading ? "Publishing Paper..." : "✓ Publish Paper / Quiz"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default CreateQuestionPaper;