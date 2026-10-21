import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Navbar from "../../components/Navbar";
import {
  getAllPapers,
  uploadPaper,
  deletePaper,
  updatePaper,
  togglePaperPractice,
} from "../../services/paperService";
import "./ManagePapers.css";

function ManagePapers() {
  const navigate = useNavigate();

  // Papers and Library State
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL"); // ALL, IA-1, IA-2, IA-3, SEMESTER

  // Two-Pane View Toggle (Left Upload Pane)
  const [showUploadPane, setShowUploadPane] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Upload Form State
  const [file, setFile] = useState(null);
  const [subject, setSubject] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [examCategory, setExamCategory] = useState("IA-1"); // IA-1, IA-2, IA-3, SEM_EXAM
  const [semester, setSemester] = useState("6");
  const [maxMarks, setMaxMarks] = useState("50");

  // Ingestion Extraction Result & Validation Modal/Drawer
  const [activeBlueprintPaper, setActiveBlueprintPaper] = useState(null);
  const [expandedQuestions, setExpandedQuestions] = useState({});
  const [blueprintEditing, setBlueprintEditing] = useState(false);
  const [editedQuestions, setEditedQuestions] = useState([]);
  const [savingBlueprint, setSavingBlueprint] = useState(false);

  // Practice Toggle updating tracker
  const [updatingPracticeId, setUpdatingPracticeId] = useState(null);

  // Load Papers on Mount
  useEffect(() => {
    fetchPapers();
  }, []);

  const fetchPapers = async () => {
    try {
      setLoading(true);
      const data = await getAllPapers();
      setPapers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load question paper library");
    } finally {
      setLoading(false);
    }
  };

  // Drag and Drop handlers
  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      setFile(droppedFile);
      // Auto-suggest subject from file name if empty
      if (!subject) {
        const cleanName = droppedFile.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        setSubject(cleanName);
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      if (!subject) {
        const cleanName = selectedFile.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        setSubject(cleanName);
      }
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  // Upload Submission Handler
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error("Please select a question paper file (PDF/DOCX) to upload");
      return;
    }

    try {
      setUploading(true);
      let internalNo = 1;
      let examName = "Internal Assessment Test-I";

      if (examCategory === "IA-1") {
        internalNo = 1;
        examName = "Internal Assessment Test-I";
      } else if (examCategory === "IA-2") {
        internalNo = 2;
        examName = "Internal Assessment Test-II";
      } else if (examCategory === "IA-3") {
        internalNo = 3;
        examName = "Internal Assessment Test-III";
      } else if (examCategory === "SEM_EXAM") {
        internalNo = 4;
        examName = "Semester End Examination (SEE)";
      }

      const generatedId = `${courseCode ? courseCode.trim().toLowerCase() : "sub"}-${Date.now().toString().slice(-6)}`;
      const formData = new FormData();
      formData.append("file", file);
      formData.append("paperId", generatedId);
      formData.append("subject", subject.trim() || file.name.replace(/\.[^/.]+$/, ""));
      formData.append("internalNo", String(internalNo));
      formData.append("examName", examName);

      const parsedPaper = await uploadPaper(formData);

      toast.success("Question Paper Uploaded & Synthesized Successfully!");

      // Open the blueprint validation modal immediately for review
      if (parsedPaper && parsedPaper.questions && parsedPaper.questions.length > 0) {
        openBlueprintModal(parsedPaper);
      }

      // Reset upload inputs
      setFile(null);
      setSubject("");
      setCourseCode("");
      setShowUploadPane(false);

      // Refresh paper list
      fetchPapers();
    } catch (err) {
      console.error(err);
      const msg =
        (typeof err.response?.data === "string" && err.response.data) ||
        err.response?.data?.message ||
        "Failed to upload and parse question paper";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  // Delete Paper Handler
  const handleDeletePaper = async (paper, e) => {
    e.stopPropagation();
    const identifier = paper.paperId || paper.id;
    if (!window.confirm(`Are you sure you want to delete question paper "${paper.subject || identifier}"?`)) {
      return;
    }

    try {
      await deletePaper(identifier);
      toast.success("Question paper deleted successfully");
      setPapers((prev) => prev.filter((p) => (p.paperId || p.id) !== identifier));
      if (activeBlueprintPaper && (activeBlueprintPaper.paperId || activeBlueprintPaper.id) === identifier) {
        setActiveBlueprintPaper(null);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete paper");
    }
  };

  // Practice Permission Switch Toggle
  const handleTogglePractice = async (paper, e) => {
    if (e) e.stopPropagation();
    const identifier = paper.paperId || paper.id;
    const currentStatus = paper.allowedForPractice === true || paper.paperCategory === "PRACTICE";
    const nextStatus = !currentStatus;
    const assignedSem = paper.assignedSemester || paper.semester || "6";

    try {
      setUpdatingPracticeId(identifier);
      await togglePaperPractice(identifier, nextStatus, assignedSem);

      setPapers((prev) =>
        prev.map((p) =>
          (p.paperId || p.id) === identifier
            ? { ...p, allowedForPractice: nextStatus, assignedSemester: assignedSem }
            : p
        )
      );

      if (activeBlueprintPaper && (activeBlueprintPaper.paperId || activeBlueprintPaper.id) === identifier) {
        setActiveBlueprintPaper((prev) => ({
          ...prev,
          allowedForPractice: nextStatus,
          assignedSemester: assignedSem,
        }));
      }

      if (nextStatus) {
        toast.success(`🎯 Practice enabled for "${paper.subject}" (Sem ${assignedSem})`);
      } else {
        toast.success(`Practice disabled for "${paper.subject}"`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to update practice permission");
    } finally {
      setUpdatingPracticeId(null);
    }
  };

  // Open Blueprint Modal & Prepare Questions State
  const openBlueprintModal = (paper) => {
    setActiveBlueprintPaper(paper);
    const qs = Array.isArray(paper.questions) ? paper.questions : [];
    // Deep clone questions for editing
    setEditedQuestions(JSON.parse(JSON.stringify(qs)));
    // Expand first 2 questions by default
    const expanded = {};
    qs.forEach((_, idx) => {
      if (idx < 3) expanded[idx] = true;
    });
    setExpandedQuestions(expanded);
    setBlueprintEditing(false);
  };

  const toggleQuestionAccordion = (idx) => {
    setExpandedQuestions((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  // Save Blueprint Changes
  const handleSaveBlueprint = async () => {
    if (!activeBlueprintPaper) return;
    const identifier = activeBlueprintPaper.paperId || activeBlueprintPaper.id;

    try {
      setSavingBlueprint(true);
      const updatedData = {
        ...activeBlueprintPaper,
        questions: editedQuestions,
      };

      await updatePaper(identifier, updatedData);
      toast.success("Blueprint updated and saved successfully!");

      setActiveBlueprintPaper(updatedData);
      setBlueprintEditing(false);

      // Update in main list
      setPapers((prev) =>
        prev.map((p) => ((p.paperId || p.id) === identifier ? updatedData : p))
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to save blueprint changes");
    } finally {
      setSavingBlueprint(false);
    }
  };

  // Helper to determine Question Part & Choice Group display
  const getQuestionMeta = (q, idx) => {
    const rawId = (q.questionId || `Q${idx + 1}`).trim();
    // Match code like 1a, 1b, 2a, 2b, 3a, 4b
    const match = rawId.match(/([1-4])([a-d])?/i);
    const qNum = match ? match[1] : String(idx + 1);
    const subLetter = match && match[2] ? match[2].toLowerCase() : "";
    const cleanCode = subLetter ? `${qNum}${subLetter}` : rawId;

    // Part A (Q1/Q2) vs Part B (Q3/Q4)
    let part = q.section || "";
    if (!part) {
      part = qNum === "1" || qNum === "2" ? "PART A" : "PART B";
    }

    // Choice Group: Q1 OR Q2, Q3 OR Q4
    let choiceGroup = q.groupName || q.optionalWith || "";
    if (!choiceGroup || choiceGroup.toLowerCase().includes("group")) {
      if (qNum === "1" || qNum === "2") {
        choiceGroup = "Q1 OR Q2";
      } else {
        choiceGroup = "Q3 OR Q4";
      }
    }

    const marksVal = q.marks != null ? `${q.marks}M` : "10M";
    const topicVal = q.topic || `Module ${qNum} Core Concepts`;

    return { cleanCode, part, choiceGroup, marksVal, topicVal };
  };

  // Filtered Subject Paper Library
  const filteredPapers = papers.filter((paper) => {
    const s = searchQuery.toLowerCase();
    const pSubj = (paper.subject || "").toLowerCase();
    const pCode = (paper.subjectCode || "").toLowerCase();
    const pExam = (paper.examName || "").toLowerCase();

    const matchesSearch = !s || pSubj.includes(s) || pCode.includes(s) || pExam.includes(s);

    if (!matchesSearch) return false;

    if (categoryFilter === "ALL") return true;
    if (categoryFilter === "IA-1") return paper.internalNo === 1 || pExam.includes("i") || pExam.includes("1");
    if (categoryFilter === "IA-2") return paper.internalNo === 2 || pExam.includes("ii") || pExam.includes("2");
    if (categoryFilter === "IA-3") return paper.internalNo === 3 || pExam.includes("iii") || pExam.includes("3");
    if (categoryFilter === "SEMESTER") return paper.internalNo === 4 || pExam.includes("see") || pExam.includes("semester");

    return true;
  });

  return (
    <div className="manage-papers-studio-page">
      <Navbar />

      <div className="studio-container">
        {/* TOP COMMAND BAR */}
        <div className="studio-top-bar">
          <div className="top-bar-left">
            <button
              className="breadcrumb-back-btn"
              onClick={() => navigate("/teacher/dashboard")}
            >
              ← Back to Dashboard
            </button>
            <div className="title-with-badge">
              <h1>Question Papers &amp; Evaluation Studio</h1>
              <span className="studio-tag">VTU / Autonomous Standard</span>
            </div>
            <p className="studio-subtitle">
              Upload and extract question papers, configure IA blueprints, evaluate student answer submissions, and manage practice permissions.
            </p>
          </div>

          <div className="top-bar-actions">
            <button
              className={`upload-toggle-btn ${showUploadPane ? "active" : ""}`}
              onClick={() => setShowUploadPane((prev) => !prev)}
            >
              {showUploadPane ? "✕ Close Upload Pane" : "+ Upload New Paper"}
            </button>
          </div>
        </div>

        {/* TWO-PANE COMMAND LAYOUT */}
        <div className={`studio-layout-grid ${showUploadPane ? "two-pane-open" : "single-pane"}`}>
          {/* LEFT PANE: COLLAPSIBLE UPLOAD CARD */}
          {showUploadPane && (
            <aside className="studio-left-pane">
              <div className="upload-command-card">
                <div className="pane-header">
                  <div className="pane-title-wrap">
                    <span className="pane-icon">📄</span>
                    <div>
                      <h3>Ingest Question Paper</h3>
                      <p>Upload PDF/DOCX to extract sub-questions &amp; topics</p>
                    </div>
                  </div>
                  <button
                    className="pane-close-btn"
                    onClick={() => setShowUploadPane(false)}
                    title="Close Upload Pane"
                  >
                    ×
                  </button>
                </div>

                <form onSubmit={handleUploadSubmit} className="upload-form">
                  {/* DRAG AND DROP ZONE */}
                  <div
                    className={`drop-zone ${dragOver ? "drag-active" : ""} ${file ? "has-file" : ""}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleFileDrop}
                  >
                    <input
                      type="file"
                      id="paperFileInput"
                      accept=".pdf,.docx,.doc,.txt"
                      onChange={handleFileChange}
                      style={{ display: "none" }}
                    />

                    {!file ? (
                      <label htmlFor="paperFileInput" className="drop-zone-label">
                        <div className="upload-cloud-icon">☁️</div>
                        <p className="drop-prompt">
                          Drag &amp; drop question paper PDF, or <span>Browse</span>
                        </p>
                        <span className="drop-formats">Supports VTU / Autonomous Exam formats</span>
                      </label>
                    ) : (
                      <div className="file-info-badge">
                        <div className="file-meta">
                          <span className="file-icon">📑</span>
                          <div className="file-text">
                            <strong>{file.name}</strong>
                            <span>{formatFileSize(file.size)}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="file-remove-btn"
                          onClick={() => setFile(null)}
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>

                  {/* FORM INPUTS */}
                  <div className="form-group">
                    <label>Course / Subject Title *</label>
                    <input
                      type="text"
                      placeholder="e.g. Internet of Things"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Course Code</label>
                      <input
                        type="text"
                        placeholder="e.g. 21CS62"
                        value={courseCode}
                        onChange={(e) => setCourseCode(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label>Semester</label>
                      <select
                        value={semester}
                        onChange={(e) => setSemester(e.target.value)}
                      >
                        <option value="1">1st Sem</option>
                        <option value="2">2nd Sem</option>
                        <option value="3">3rd Sem</option>
                        <option value="4">4th Sem</option>
                        <option value="5">5th Sem</option>
                        <option value="6">6th Sem</option>
                        <option value="7">7th Sem</option>
                        <option value="8">8th Sem</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Exam Category</label>
                      <select
                        value={examCategory}
                        onChange={(e) => setExamCategory(e.target.value)}
                      >
                        <option value="IA-1">Internal Assessment 1 (IA-1)</option>
                        <option value="IA-2">Internal Assessment 2 (IA-2)</option>
                        <option value="IA-3">Internal Assessment 3 (IA-3)</option>
                        <option value="SEM_EXAM">Semester End Exam (SEE)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Max Marks</label>
                      <input
                        type="number"
                        value={maxMarks}
                        onChange={(e) => setMaxMarks(e.target.value)}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="submit-ingest-btn"
                    disabled={uploading || !file}
                  >
                    {uploading ? (
                      <span className="spinner-text">
                        <span className="mini-spinner" /> Synthesizing Paper Blueprint...
                      </span>
                    ) : (
                      "🚀 Upload & Synthesize Blueprint"
                    )}
                  </button>
                </form>
              </div>
            </aside>
          )}

          {/* RIGHT PANE: SUBJECT PAPER LIBRARY */}
          <main className="studio-right-pane">
            {/* SEARCH & FILTER CONTROLS */}
            <div className="library-toolbar">
              <div className="toolbar-search">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Search by subject, course code (e.g. 21CS62) or exam..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    className="clear-search-btn"
                    onClick={() => setSearchQuery("")}
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="category-pills">
                {[
                  { key: "ALL", label: "All Papers" },
                  { key: "IA-1", label: "IA-1" },
                  { key: "IA-2", label: "IA-2" },
                  { key: "IA-3", label: "IA-3" },
                  { key: "SEMESTER", label: "Semester SEE" },
                ].map((pill) => (
                  <button
                    key={pill.key}
                    className={`cat-pill ${categoryFilter === pill.key ? "active" : ""}`}
                    onClick={() => setCategoryFilter(pill.key)}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>

            {/* PAPERS GRID */}
            {loading ? (
              <div className="studio-loading-state">
                <div className="loading-orbit" />
                <p>Loading Question Paper Library...</p>
              </div>
            ) : filteredPapers.length === 0 ? (
              <div className="studio-empty-state">
                <div className="empty-icon">📑</div>
                <h3>No Question Papers Found</h3>
                <p>
                  {searchQuery
                    ? "No question papers matched your search query."
                    : "No question papers have been ingested yet. Click '+ Upload New Paper' to upload your first VTU/Autonomous exam paper."}
                </p>
                <button
                  className="empty-cta-btn"
                  onClick={() => setShowUploadPane(true)}
                >
                  + Upload Question Paper Now
                </button>
              </div>
            ) : (
              <div className="papers-studio-grid">
                {filteredPapers.map((paper) => {
                  const identifier = paper.paperId || paper.id;
                  const isPracticeEnabled =
                    paper.allowedForPractice === true || paper.paperCategory === "PRACTICE";
                  const qCount = paper.questions ? paper.questions.length : 0;
                  const intNo = Number(paper.internalNo) || 1;
                  const semDisplay = paper.assignedSemester || paper.semester || "6";

                  let categoryBadge = "IA-1";
                  if (intNo === 2) categoryBadge = "IA-2";
                  else if (intNo === 3) categoryBadge = "IA-3";
                  else if (intNo === 4 || (paper.examName && paper.examName.toLowerCase().includes("see"))) {
                    categoryBadge = "Semester Exam";
                  }

                  return (
                    <div key={identifier} className="subject-paper-card">
                      {/* CARD TOP */}
                      <div className="card-header-row">
                        <div className="category-tag-badge">{categoryBadge}</div>
                        <button
                          className="card-delete-icon-btn"
                          title="Delete Paper"
                          onClick={(e) => handleDeletePaper(paper, e)}
                        >
                          🗑️
                        </button>
                      </div>

                      {/* SUBJECT TITLE */}
                      <h3 className="paper-subject-title">{paper.subject || "Untitled Examination Paper"}</h3>

                      {/* BADGES ROW */}
                      <div className="paper-badges-row">
                        <span className="meta-badge code-badge">
                          📌 {paper.subjectCode || "21CS62"}
                        </span>
                        <span className="meta-badge sem-badge">
                          🎓 Sem {semDisplay}
                        </span>
                        <span className="meta-badge count-badge">
                          📝 {qCount} Questions
                        </span>
                        <span className="meta-badge marks-badge">
                          🎯 {paper.maxMarks || 50} Marks
                        </span>
                      </div>

                      {/* PRACTICE PERMISSION SWITCH BAR */}
                      <div className="practice-permission-row">
                        <div className="practice-info">
                          <span className="practice-label">🎯 Student Practice &amp; Self-Test</span>
                          <span
                            className={`practice-status-chip ${isPracticeEnabled ? "enabled" : "disabled"}`}
                          >
                            {isPracticeEnabled ? `Active (Sem ${semDisplay})` : "Disabled"}
                          </span>
                        </div>

                        {/* TOGGLE SWITCH */}
                        <label className="toggle-switch-container">
                          <input
                            type="checkbox"
                            checked={isPracticeEnabled}
                            disabled={updatingPracticeId === identifier}
                            onChange={(e) => handleTogglePractice(paper, e)}
                          />
                          <span className="toggle-switch-slider" />
                        </label>
                      </div>

                      {/* ACTION BUTTONS */}
                      <div className="card-actions-grid">
                        <button
                          type="button"
                          className="action-btn blueprint-btn"
                          onClick={() => openBlueprintModal(paper)}
                        >
                          👁️ View &amp; Edit Blueprint
                        </button>

                        <button
                          type="button"
                          className="action-btn evaluate-btn"
                          onClick={() =>
                            navigate("/teacher/evaluate", {
                              state: {
                                paperId: paper.paperId,
                                subject: paper.subject,
                                semester: paper.semester || semDisplay,
                              },
                            })
                          }
                        >
                          ✍️ Evaluate Submissions
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* BLUEPRINT & QUESTION VALIDATION MODAL / DRAWER                       */}
      {/* ==================================================================== */}
      {activeBlueprintPaper && (
        <div className="blueprint-modal-backdrop" onClick={() => setActiveBlueprintPaper(null)}>
          <div
            className="blueprint-modal-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            {/* MODAL HEADER */}
            <div className="blueprint-modal-header">
              <div className="modal-title-wrap">
                <span className="blueprint-pill">EXAM BLUEPRINT SPECIFICATION</span>
                <h2>{activeBlueprintPaper.subject}</h2>
                <div className="blueprint-meta-chips">
                  <span>Course Code: <strong>{activeBlueprintPaper.subjectCode || "21CS62"}</strong></span>
                  <span>Exam: <strong>{activeBlueprintPaper.examName || "Internal Assessment"}</strong></span>
                  <span>Semester: <strong>{activeBlueprintPaper.semester || "6th Sem"}</strong></span>
                  <span>Total Questions: <strong>{editedQuestions.length}</strong></span>
                  <span>Max Marks: <strong>{activeBlueprintPaper.maxMarks || 50}M</strong></span>
                </div>
              </div>

              <div className="modal-top-actions">
                {blueprintEditing ? (
                  <button
                    className="save-blueprint-btn"
                    onClick={handleSaveBlueprint}
                    disabled={savingBlueprint}
                  >
                    {savingBlueprint ? "Saving Changes..." : "💾 Save Blueprint"}
                  </button>
                ) : (
                  <button
                    className="edit-blueprint-btn"
                    onClick={() => setBlueprintEditing(true)}
                  >
                    ✏️ Edit Blueprint
                  </button>
                )}
                <button
                  className="close-modal-x"
                  onClick={() => setActiveBlueprintPaper(null)}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* STRUCTURED BLUEPRINT TABLE / ACCORDION */}
            <div className="blueprint-modal-body">
              <div className="blueprint-table-header">
                <span className="col-code">Code</span>
                <span className="col-part">Part</span>
                <span className="col-choice">Choice Group</span>
                <span className="col-marks">Max Marks</span>
                <span className="col-topic">Synthesized Topic Name</span>
                <span className="col-actions">Actions</span>
              </div>

              {editedQuestions.length === 0 ? (
                <div className="no-questions-placeholder">
                  No questions found in this paper blueprint.
                </div>
              ) : (
                <div className="blueprint-questions-list">
                  {editedQuestions.map((q, idx) => {
                    const { cleanCode, part, choiceGroup, marksVal, topicVal } = getQuestionMeta(q, idx);
                    const isExpanded = expandedQuestions[idx];

                    return (
                      <div key={idx} className="blueprint-question-item">
                        {/* ACCORDION BAR */}
                        <div
                          className="question-summary-row"
                          onClick={() => toggleQuestionAccordion(idx)}
                        >
                          <span className="col-code">
                            <span className="code-tag">{cleanCode}</span>
                          </span>

                          <span className="col-part">
                            <span className="part-tag">{part}</span>
                          </span>

                          <span className="col-choice">
                            <span className="choice-tag">{choiceGroup}</span>
                          </span>

                          <span className="col-marks">
                            {blueprintEditing ? (
                              <input
                                type="number"
                                className="inline-marks-input"
                                value={q.marks || 10}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setEditedQuestions((prev) => {
                                    const next = [...prev];
                                    next[idx].marks = val;
                                    return next;
                                  });
                                }}
                              />
                            ) : (
                              <span className="marks-tag">{marksVal}</span>
                            )}
                          </span>

                          <span className="col-topic">
                            {blueprintEditing ? (
                              <input
                                type="text"
                                className="inline-topic-input"
                                value={q.topic || ""}
                                placeholder="Enter topic name..."
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setEditedQuestions((prev) => {
                                    const next = [...prev];
                                    next[idx].topic = val;
                                    return next;
                                  });
                                }}
                              />
                            ) : (
                              <span className="topic-text">{topicVal}</span>
                            )}
                          </span>

                          <span className="col-actions">
                            <button
                              type="button"
                              className="expand-arrow-btn"
                              title={isExpanded ? "Collapse Question Prompt" : "Expand Question Prompt"}
                            >
                              {isExpanded ? "▲" : "▼"}
                            </button>
                          </span>
                        </div>

                        {/* ACCORDION EXPANDED BODY (FULL QUESTION TEXT) */}
                        {isExpanded && (
                          <div className="question-detail-expanded">
                            <div className="detail-meta-row">
                              <span className="label">Question Prompt:</span>
                              {q.bloomLevel && <span className="bloom-tag">Level: {q.bloomLevel}</span>}
                              {q.courseOutcome && <span className="co-tag">Outcome: {q.courseOutcome}</span>}
                            </div>

                            {blueprintEditing ? (
                              <textarea
                                className="prompt-editor-textarea"
                                rows={3}
                                value={q.text || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setEditedQuestions((prev) => {
                                    const next = [...prev];
                                    next[idx].text = val;
                                    return next;
                                  });
                                }}
                              />
                            ) : (
                              <p className="prompt-display-text">{q.text || "(No question text recorded)"}</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* MODAL FOOTER */}
            <div className="blueprint-modal-footer">
              <div className="footer-left">
                <span>Verified VTU Question Specification • 4 Primary Sections (1a..4d @ 10M)</span>
              </div>
              <div className="footer-right">
                <button
                  type="button"
                  className="close-drawer-btn"
                  onClick={() => setActiveBlueprintPaper(null)}
                >
                  Close Specification
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManagePapers;