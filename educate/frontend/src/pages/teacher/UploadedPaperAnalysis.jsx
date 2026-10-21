import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  getAllPapers,
  deletePaper,
  updatePaper,
  togglePaperPractice,
} from "../../services/paperService";
import { exportQuestionPaperPdf } from "../../utils/pdfGenerator";
import "./UploadedPaperAnalysis.css";

function UploadedPaperAnalysis() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategoryTab, setActiveCategoryTab] = useState("ALL"); // ALL, THEORY, MCQ
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [editingPaper, setEditingPaper] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  // Practice Assignment Modal State
  const [practiceModalPaper, setPracticeModalPaper] = useState(null);
  const [practiceSem, setPracticeSem] = useState("5th Sem");
  const [practiceAllowed, setPracticeAllowed] = useState(true);
  const [practiceSaving, setPracticeSaving] = useState(false);

  const [editData, setEditData] = useState({
    subject: "",
    internalNo: "",
    collegeName: "",
    subjectCode: "",
    examName: "",
    semester: "",
    maxMarks: "",
    questions: [],
  });

  const fetchPapers = async () => {
    try {
      setLoading(true);
      const data = await getAllPapers();
      setPapers(data || []);
      if (id) {
        const found = (data || []).find((p) => String(p.id || p.paperId) === String(id));
        if (found) setSelectedPaper(found);
      } else if (selectedPaper) {
        const updatedSelected = (data || []).find((p) => (p.id || p.paperId) === (selectedPaper.id || selectedPaper.paperId));
        if (updatedSelected) setSelectedPaper(updatedSelected);
      }
    } catch {
      toast.error("Failed to load question papers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPapers();
  }, []);

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

  const handleDelete = async (paper) => {
    const identifier = paper.id || paper.paperId;
    if (!window.confirm(`Are you sure you want to delete question paper '${paper.subject || identifier}'?`)) return;
    try {
      setActionLoading(`delete-${identifier}`);
      await deletePaper(identifier);
      toast.success("Paper Deleted Successfully");
      if (selectedPaper && (selectedPaper.id === identifier || selectedPaper.paperId === identifier)) {
        setSelectedPaper(null);
      }
      fetchPapers();
    } catch (error) {
      toast.error(error.response?.data?.message || error.response?.data || "Delete Failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenPaper = (paper) => {
    setSelectedPaper(paper);
  };

  const handleEdit = (paper) => {
    setEditingPaper(paper.paperId);
    const isMcq = isPaperMcq(paper);
    setEditData({
      paperFormat: paper.paperFormat || (isMcq ? "MCQ" : "THEORY"),
      subject: paper.subject || "",
      internalNo: paper.internalNo || "",
      collegeName: paper.collegeName || "",
      subjectCode: paper.subjectCode || "",
      examName: paper.examName || "",
      semester: paper.semester || "",
      maxMarks: paper.maxMarks || paper.totalMarks || "",
      questions: JSON.parse(JSON.stringify(paper.questions || [])),
    });
  };

  const handleUpdate = async () => {
    if (!editingPaper) return;
    try {
      setActionLoading(`save-${editingPaper}`);
      const updatedPaper = {
        paperId: editingPaper,
        paperFormat: editData.paperFormat,
        subject: editData.subject,
        internalNo: Number(editData.internalNo),
        collegeName: editData.collegeName,
        subjectCode: editData.subjectCode,
        examName: editData.examName,
        semester: editData.semester,
        maxMarks: Number(editData.maxMarks) || undefined,
        questions: editData.questions,
      };

      await updatePaper(editingPaper, updatedPaper);
      toast.success("Paper Updated Successfully");
      setEditingPaper(null);
      fetchPapers();
    } catch (error) {
      toast.error(error.response?.data?.message || error.response?.data || "Update Failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenPracticeModal = (paper) => {
    setPracticeModalPaper(paper);
    setPracticeAllowed(paper.allowedForPractice !== false);
    setPracticeSem(paper.assignedSemester || paper.semester || "5th Sem");
  };

  const handleSavePracticeAssignment = async () => {
    if (!practiceModalPaper) return;
    try {
      setPracticeSaving(true);
      await togglePaperPractice(
        practiceModalPaper.paperId,
        practiceAllowed,
        practiceSem
      );
      toast.success(
        practiceAllowed
          ? `Paper assigned for student practice in ${practiceSem}!`
          : "Practice disabled for this paper"
      );
      setPracticeModalPaper(null);
      fetchPapers();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update practice assignment");
    } finally {
      setPracticeSaving(false);
    }
  };

  const handleQuestionChange = (index, field, value) => {
    const updated = [...editData.questions];
    updated[index][field] = value;
    setEditData({ ...editData, questions: updated });
  };

  const handleQuestionImageUpload = (index, file) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image file must be under 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const updated = [...editData.questions];
      updated[index].imageUrl = reader.result;
      setEditData({ ...editData, questions: updated });
      toast.success("Diagram attached to question");
    };
    reader.readAsDataURL(file);
  };

  const removeQuestionImage = (index) => {
    const updated = [...editData.questions];
    updated[index].imageUrl = null;
    setEditData({ ...editData, questions: updated });
  };

  const addQuestion = () => {
    const isMcq = editData.paperFormat === "MCQ";
    setEditData({
      ...editData,
      questions: [
        ...editData.questions,
        {
          questionId: `Q${editData.questions.length + 1}`,
          text: "",
          section: isMcq ? "MCQ-SECTION" : "MODULE-1",
          groupName: isMcq ? null : "GROUP-A",
          optionalQuestion: false,
          optionalWith: null,
          parentQuestion: `Q${editData.questions.length + 1}`,
          maxAttempt: 1,
          questionType: isMcq ? "MCQ" : "THEORY",
          marks: isMcq ? 1 : 8,
          topic: "General",
          imageUrl: null,
          options: isMcq ? ["", "", "", ""] : [],
        },
      ],
    });
  };

  const deleteQuestion = (index) => {
    const updated = editData.questions.filter((_, i) => i !== index);
    setEditData({ ...editData, questions: updated });
  };

  const getEffectiveTotalMarks = (paper) => {
    if (isPaperMcq(paper)) {
      if (paper.maxMarks && Number(paper.maxMarks) > 0) return Number(paper.maxMarks);
      const qs = paper.questions || [];
      return qs.reduce((sum, q) => sum + (Number(q.marks) || 1), 0) || qs.length || 10;
    }

    if (paper.maxMarks && Number(paper.maxMarks) > 0) {
      return Number(paper.maxMarks);
    }
    if (paper.totalMarks && Number(paper.totalMarks) > 0) {
      return Number(paper.totalMarks);
    }
    const questions = paper.questions || [];
    let total = 0;
    const grouped = {};
    questions.forEach((q) => {
      const m = Number(q.marks || 0);
      if (q.optionalQuestion || q.optionalWith) {
        const key = q.optionalWith || q.parentQuestion || q.groupName || "OPT";
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(m);
      } else {
        total += m;
      }
    });
    Object.values(grouped).forEach((mList) => {
      total += Math.max(...mList);
    });
    return total || 40;
  };

  const [selectedSubject, setSelectedSubject] = useState(null);
  const [viewMode, setViewMode] = useState("SUBJECTS"); // "SUBJECTS" or "FLAT"

  const filteredPapers = papers.filter((p) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      (p.subject && p.subject.toLowerCase().includes(query)) ||
      (p.paperId && p.paperId.toLowerCase().includes(query)) ||
      (p.subjectCode && p.subjectCode.toLowerCase().includes(query)) ||
      (p.examName && p.examName.toLowerCase().includes(query))
    );
  });

  // Group papers by Subject Name and Subject Code
  const subjectGroupsMap = {};
  papers.forEach((paper) => {
    const rawSubj = (paper.subject || "General Subject").trim();
    const rawCode = (paper.subjectCode || "").trim();
    // Unique key combines normalized subject name and subject code
    const groupKey = rawCode ? `${rawSubj}__${rawCode}`.toUpperCase() : rawSubj.toUpperCase();

    if (!subjectGroupsMap[groupKey]) {
      subjectGroupsMap[groupKey] = {
        key: groupKey,
        subjectName: rawSubj,
        subjectCode: rawCode || null,
        semester: paper.semester || "",
        papers: [],
        theoryCount: 0,
        mcqCount: 0,
        totalQuestions: 0,
        examNames: new Set(),
      };
    }

    subjectGroupsMap[groupKey].papers.push(paper);
    if (isPaperMcq(paper)) {
      subjectGroupsMap[groupKey].mcqCount += 1;
    } else {
      subjectGroupsMap[groupKey].theoryCount += 1;
    }
    subjectGroupsMap[groupKey].totalQuestions += (paper.questions?.length || 0);
    if (paper.examName) subjectGroupsMap[groupKey].examNames.add(paper.examName);
    if (!subjectGroupsMap[groupKey].subjectCode && rawCode) {
      subjectGroupsMap[groupKey].subjectCode = rawCode;
    }
    if (!subjectGroupsMap[groupKey].semester && paper.semester) {
      subjectGroupsMap[groupKey].semester = paper.semester;
    }
  });

  const subjectGroupsList = Object.values(subjectGroupsMap);

  // Filter subject groups based on search
  const filteredSubjectGroups = subjectGroupsList.filter((grp) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    const matchesSubject =
      grp.subjectName.toLowerCase().includes(query) ||
      (grp.subjectCode && grp.subjectCode.toLowerCase().includes(query));
    const matchesPapers = grp.papers.some(
      (p) =>
        (p.subject && p.subject.toLowerCase().includes(query)) ||
        (p.subjectCode && p.subjectCode.toLowerCase().includes(query)) ||
        (p.paperId && p.paperId.toLowerCase().includes(query)) ||
        (p.examName && p.examName.toLowerCase().includes(query))
    );
    return matchesSubject || matchesPapers;
  });

  // Papers to display when a specific subject is selected
  const activeSubjectPapers = selectedSubject
    ? (subjectGroupsMap[selectedSubject]?.papers || []).filter((p) => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return true;
        return (
          (p.subject && p.subject.toLowerCase().includes(query)) ||
          (p.paperId && p.paperId.toLowerCase().includes(query)) ||
          (p.subjectCode && p.subjectCode.toLowerCase().includes(query)) ||
          (p.examName && p.examName.toLowerCase().includes(query))
        );
      })
    : filteredPapers;

  const currentPoolPapers = selectedSubject ? activeSubjectPapers : filteredPapers;
  const theoryPapers = currentPoolPapers.filter((p) => !isPaperMcq(p));
  const mcqPapers = currentPoolPapers.filter((p) => isPaperMcq(p));

  const displayedPapers =
    activeCategoryTab === "THEORY"
      ? theoryPapers
      : activeCategoryTab === "MCQ"
      ? mcqPapers
      : currentPoolPapers;

  const activeGroup = selectedSubject ? subjectGroupsMap[selectedSubject] : null;

  return (
    <div className="analysis-page">
      {/* Top Navbar */}
      <div className="analysis-top-nav">
        <button
          className="back-btn"
          onClick={() => {
            if (selectedSubject) {
              setSelectedSubject(null);
            } else {
              navigate(-1);
            }
          }}
        >
          {selectedSubject ? "← Back to All Subjects" : "← Back"}
        </button>

        {selectedSubject && (
          <div className="top-nav-breadcrumb">
            <span className="crumb-link" onClick={() => setSelectedSubject(null)}>
              📚 All Subjects ({subjectGroupsList.length})
            </span>
            <span className="crumb-separator">/</span>
            <span className="crumb-current">
              {activeGroup?.subjectName} {activeGroup?.subjectCode ? `(${activeGroup.subjectCode})` : ""}
            </span>
          </div>
        )}
      </div>

      {/* Header Card */}
      <div className="analysis-header-card">
        <div className="header-info-block">
          <h1 className="page-title">
            {selectedSubject ? `${activeGroup?.subjectName || "Subject"} Papers` : "Uploaded Question Papers"}
          </h1>
          <p className="page-subtitle">
            {selectedSubject
              ? `Manage and inspect all ${activeGroup?.papers?.length || 0} examination papers uploaded for ${activeGroup?.subjectName}${activeGroup?.subjectCode ? ` (${activeGroup.subjectCode})` : ""}.`
              : "Search by subject, code, or paper ID. Click any subject to open all its uploaded papers."}
          </p>
        </div>

        <div className="header-actions-group">
          {/* Search Box */}
          <div className="search-box-container">
            <input
              type="text"
              className="paper-search-input"
              placeholder="🔍 Search subject, code, or paper ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="search-clear-btn" onClick={() => setSearchQuery("")}>
                ✕
              </button>
            )}
          </div>

          {/* View Mode Toggle (Folders vs Flat List) */}
          {!selectedSubject && (
            <div className="view-mode-toggle-group">
              <button
                className={`view-toggle-btn ${viewMode === "SUBJECTS" ? "active" : ""}`}
                onClick={() => setViewMode("SUBJECTS")}
                title="Group question papers by Subject"
              >
                📁 By Subject
              </button>
              <button
                className={`view-toggle-btn ${viewMode === "FLAT" ? "active" : ""}`}
                onClick={() => setViewMode("FLAT")}
                title="View all individual papers directly"
              >
                📑 All Papers
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Selected Subject Banner */}
      {selectedSubject && activeGroup && (
        <div className="active-subject-banner">
          <div className="subject-banner-left">
            <div className="subject-banner-icon">📚</div>
            <div>
              <div className="subject-banner-title-row">
                <h2>{activeGroup.subjectName}</h2>
                {activeGroup.subjectCode && (
                  <span className="subject-code-badge">{activeGroup.subjectCode}</span>
                )}
                {activeGroup.semester && (
                  <span className="subject-sem-badge">Semester {activeGroup.semester}</span>
                )}
              </div>
              <p className="subject-banner-sub">
                Total {activeGroup.papers.length} Question Paper(s) · {activeGroup.theoryCount} Theory · {activeGroup.mcqCount} MCQ Quiz
              </p>
            </div>
          </div>
          <button
            className="switch-subject-btn"
            onClick={() => setSelectedSubject(null)}
          >
            ← View All Subjects ({subjectGroupsList.length})
          </button>
        </div>
      )}

      {/* Category Tab Switcher (All / Theory / MCQ) */}
      {(selectedSubject || viewMode === "FLAT") && (
        <div className="paper-category-tabs-bar">
          <button
            className={`category-tab-btn ${activeCategoryTab === "ALL" ? "active" : ""}`}
            onClick={() => setActiveCategoryTab("ALL")}
          >
            <span>📁 All Papers</span>
            <span className="tab-counter-pill">{currentPoolPapers.length}</span>
          </button>
          <button
            className={`category-tab-btn ${activeCategoryTab === "THEORY" ? "active" : ""}`}
            onClick={() => setActiveCategoryTab("THEORY")}
          >
            <span>📑 Theory Question Papers</span>
            <span className="tab-counter-pill">{theoryPapers.length}</span>
          </button>
          <button
            className={`category-tab-btn ${activeCategoryTab === "MCQ" ? "active" : ""}`}
            onClick={() => setActiveCategoryTab("MCQ")}
          >
            <span>🎯 Objective MCQ Papers</span>
            <span className="tab-counter-pill">{mcqPapers.length}</span>
          </button>
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="loading-state">Loading question papers...</div>
      ) : (!selectedSubject && viewMode === "SUBJECTS") ? (
        /* ========================================================================= */
        /* 1. SUBJECT FOLDERS GRID VIEW (Grouped by Subject Name & Subject Code)     */
        /* ========================================================================= */
        filteredSubjectGroups.length === 0 ? (
          <div className="empty-papers-card">
            <div className="empty-icon">🔍</div>
            <h3>No Subjects Found</h3>
            <p>No uploaded question papers match "{searchQuery}".</p>
            {searchQuery && (
              <button className="upload-empty-btn" onClick={() => setSearchQuery("")}>
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <div>
            <div className="section-meta-bar">
              <span className="section-meta-count">
                Showing <strong>{filteredSubjectGroups.length}</strong> Subject Folder(s) · {papers.length} Total Papers
              </span>
            </div>

            <div className="subject-folders-grid">
              {filteredSubjectGroups.map((group) => {
                const paperCount = group.papers.length;
                const examList = Array.from(group.examNames).slice(0, 3);

                return (
                  <div
                    className="subject-folder-card"
                    key={group.key}
                    onClick={() => setSelectedSubject(group.key)}
                  >
                    <div className="subject-card-top">
                      <div className="subject-card-icon-cluster">
                        <div className="subject-folder-icon">📚</div>
                        <span className="subject-paper-counter-tag">
                          {paperCount} {paperCount === 1 ? "Paper" : "Papers"}
                        </span>
                      </div>
                      {group.subjectCode && (
                        <span className="subject-card-code-pill">{group.subjectCode}</span>
                      )}
                    </div>

                    <div className="subject-card-body">
                      <h2 className="subject-card-title">{group.subjectName}</h2>
                      <div className="subject-card-badges-row">
                        {group.semester && (
                          <span className="subject-mini-pill sem-mini-pill">
                            Sem {group.semester}
                          </span>
                        )}
                        {group.theoryCount > 0 && (
                          <span className="subject-mini-pill theory-mini-pill">
                            📑 {group.theoryCount} Theory
                          </span>
                        )}
                        {group.mcqCount > 0 && (
                          <span className="subject-mini-pill mcq-mini-pill">
                            🎯 {group.mcqCount} MCQ
                          </span>
                        )}
                      </div>
                    </div>

                    {examList.length > 0 && (
                      <div className="subject-exams-chip-row">
                        {examList.map((exam, eIdx) => (
                          <span className="subject-exam-chip" key={eIdx}>
                            🏷️ {exam}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="subject-card-footer">
                      <div className="subject-footer-stats">
                        <span>{group.totalQuestions} Total Questions</span>
                      </div>
                      <button
                        className="subject-open-folder-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSubject(group.key);
                        }}
                      >
                        Open Papers ({paperCount}) →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      ) : displayedPapers.length === 0 ? (
        /* ========================================================================= */
        /* 2. EMPTY STATE FOR PAPERS                                                 */
        /* ========================================================================= */
        <div className="empty-papers-card">
          <div className="empty-icon">{activeCategoryTab === "MCQ" ? "🎯" : "📄"}</div>
          <h3>
            No {activeCategoryTab === "MCQ" ? "Objective MCQ" : activeCategoryTab === "THEORY" ? "Theory" : ""}{" "}
            Question Papers Found
          </h3>
          <p>
            {selectedSubject
              ? `No papers found under "${activeGroup?.subjectName}" matching the current filter.`
              : "No question papers matching the current filter."}
          </p>
          {selectedSubject && (
            <button className="upload-empty-btn" onClick={() => setSelectedSubject(null)}>
              ← Back to All Subjects
            </button>
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* 3. INDIVIDUAL PAPER CARDS GRID (Inside Subject OR Flat Mode)             */
        /* ========================================================================= */
        <div>
          {selectedSubject && (
            <div className="section-meta-bar">
              <span className="section-meta-count">
                Showing <strong>{displayedPapers.length}</strong> Paper(s) for <strong>{activeGroup?.subjectName}</strong>
              </span>
            </div>
          )}

          <div className="compact-papers-grid">
            {displayedPapers.map((paper, pIdx) => {
              const isMcq = isPaperMcq(paper);
              const totalMarks = getEffectiveTotalMarks(paper);
              const questionCount = paper.questions?.length || 0;
              const cardKey = paper.id || `${paper.paperId}-${pIdx}`;
              const identifier = paper.id || paper.paperId;

              return (
                <div
                  className={`compact-paper-card ${isMcq ? "mcq-card-border" : "theory-card-border"}`}
                  key={cardKey}
                >
                  <div className="paper-card-header">
                    <div className="paper-badge-row">
                      <span className="paper-id-tag">ID: {paper.paperId}</span>
                      <span className={`format-type-pill ${isMcq ? "mcq-pill" : "theory-pill"}`}>
                        {isMcq ? "🎯 Objective MCQ" : "📑 Theory Assessment"}
                      </span>
                      {paper.sourceMode && (
                        <span className="format-type-pill" style={{ background: "rgba(168, 85, 247, 0.15)", color: "#c084fc", border: "1px solid rgba(168, 85, 247, 0.3)" }}>
                          🤖 {paper.sourceMode === "NOTES" ? "Notes Quiz" : paper.sourceMode === "TOPIC_AND_NOTES" ? "Topic+Notes Quiz" : "Topic Quiz"}
                        </span>
                      )}
                      {paper.publicationStatus === "DRAFT" && (
                        <span className="format-type-pill" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24", border: "1px solid rgba(245, 158, 11, 0.3)" }}>
                          📝 Draft
                        </span>
                      )}
                      {paper.subjectCode && <span className="code-tag">{paper.subjectCode}</span>}
                      <span className="internal-tag">🏷️ {getExamTypeLabel(paper)}</span>
                    </div>
                    <h2 className="paper-subject-title">{paper.subject || "Untitled Paper"}</h2>
                    {paper.examName && <p className="paper-exam-name">{paper.examName}</p>}
                  </div>

                  <div className="paper-stats-row">
                    <div className="stat-pill">
                      <span className="stat-label">Questions</span>
                      <span className="stat-value">{questionCount} Qs</span>
                    </div>
                    <div className="stat-pill">
                      <span className="stat-label">Total Marks</span>
                      <span className="stat-value">{totalMarks} M</span>
                    </div>
                    {paper.semester && (
                      <div className="stat-pill">
                        <span className="stat-label">Semester</span>
                        <span className="stat-value">{paper.semester}</span>
                      </div>
                    )}
                  </div>

                  <div className="paper-card-actions">
                    <button
                      className="action-btn open-btn"
                      onClick={() => handleOpenPaper(paper)}
                    >
                      👁 Open
                    </button>
                    <button
                      className="action-btn pdf-btn"
                      onClick={() => {
                        exportQuestionPaperPdf(paper);
                        toast.success(`Question Paper PDF downloaded for ${paper.subject}!`);
                      }}
                      title="Print / Download Official Question Paper PDF"
                    >
                      📄 Download PDF
                    </button>
                    <button
                      className="action-btn edit-btn"
                      onClick={() => handleEdit(paper)}
                    >
                      ✏ Edit
                    </button>
                    <button
                      className="action-btn delete-btn"
                      disabled={actionLoading === `delete-${identifier}`}
                      onClick={() => handleDelete(paper)}
                    >
                      🗑 Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* OPEN PAPER DETAILS MODAL */}
      {/* ========================================================================= */}
      {selectedPaper && (
        <div className="modal-overlay" onClick={() => setSelectedPaper(null)}>
          <div className="paper-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-block">
                <div className="modal-title-top">
                  <h2>{selectedPaper.subject}</h2>
                  <span className={`modal-format-badge ${isPaperMcq(selectedPaper) ? "mcq-badge" : "theory-badge"}`}>
                    {isPaperMcq(selectedPaper) ? "🎯 Objective MCQ Paper" : "📑 Theory Assessment Paper"}
                  </span>
                </div>
                <div className="modal-meta-row">
                  <span><strong>Paper ID:</strong> {selectedPaper.paperId}</span>
                  {selectedPaper.subjectCode && <span><strong>Code:</strong> {selectedPaper.subjectCode}</span>}
                  <span><strong>Exam Category:</strong> {getExamTypeLabel(selectedPaper)}</span>
                  <span><strong>Questions:</strong> {selectedPaper.questions?.length || 0}</span>
                  <span className="highlight-marks"><strong>Total Marks:</strong> {getEffectiveTotalMarks(selectedPaper)} M</span>
                  {selectedPaper.duration && <span><strong>Duration:</strong> {selectedPaper.duration}</span>}
                </div>
              </div>
              <button className="close-modal-btn" onClick={() => setSelectedPaper(null)}>
                ✕
              </button>
            </div>

            <div className="modal-questions-scroll">
              {(!selectedPaper.questions || selectedPaper.questions.length === 0) ? (
                <p className="no-q-msg">No questions found in this paper.</p>
              ) : isPaperMcq(selectedPaper) ? (
                /* ========================================================================= */
                /* DEDICATED MCQ QUESTION VIEW (NO OR choices, NO module banner, clean cards) */
                /* ========================================================================= */
                <div className="mcq-questions-grid">
                  {selectedPaper.questions.map((q, idx) => {
                    const qMarks = Number(q.marks) || 1;

                    return (
                      <div className="mcq-analysis-card" key={idx}>
                        <div className="mcq-card-topbar">
                          <div className="mcq-id-cluster">
                            <span className="mcq-idx-badge">{q.questionId || `Q${idx + 1}`}</span>
                            <span className="mcq-type-tag">Objective MCQ</span>
                          </div>
                          <span className="mcq-marks-tag">Marks: {qMarks} M</span>
                        </div>

                        <p className="mcq-question-prompt">{q.text}</p>

                        {/* MCQ Options Display */}
                        {q.options && q.options.length > 0 && (
                          <div className="mcq-options-grid-view">
                            {q.options.map((opt, oIdx) => {
                              const optLetter = String.fromCharCode(65 + oIdx);
                              const cleanText = opt.replace(/^[A-Da-d][\)\.]\s*/, "");
                              const isCorrect = q.correctAnswer && (
                                optLetter === q.correctAnswer ||
                                cleanText.trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase() ||
                                opt.trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase()
                              );

                              return (
                                <div
                                  className="mcq-option-tile-view"
                                  key={oIdx}
                                  style={isCorrect ? {
                                    borderColor: "rgba(16, 185, 129, 0.5)",
                                    background: "rgba(16, 185, 129, 0.12)",
                                  } : {}}
                                >
                                  <span
                                    className="mcq-opt-char"
                                    style={isCorrect ? { background: "#10b981", color: "#ffffff" } : {}}
                                  >
                                    {optLetter}
                                  </span>
                                  <span className="mcq-opt-val">{cleanText}</span>
                                  {isCorrect && (
                                    <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "#34d399", fontWeight: 700 }}>
                                      ✓ Correct
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {q.explanation && (
                          <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(59, 130, 246, 0.1)", border: "1px solid rgba(59, 130, 246, 0.25)", borderRadius: 8, fontSize: "0.85rem", color: "#93c5fd" }}>
                            <strong>💡 Explanation:</strong> {q.explanation}
                          </div>
                        )}

                        {q.imageUrl && (
                          <div className="q-attached-image-container">
                            <p className="image-label">Attached Diagram / Figure:</p>
                            <img src={q.imageUrl} alt={`Diagram for ${q.questionId}`} className="q-diagram-img" />
                          </div>
                        )}

                        <div className="sub-q-bottom-row">
                          <span className="sub-q-topic">Topic: {q.topic || "General"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* ========================================================================= */
                /* DEDICATED THEORY VIEW (MODULE-2, MODULE-3, 20M Main Questions, OR choices) */
                /* ========================================================================= */
                (() => {
                  const parentGroupsMap = new Map();

                  (selectedPaper.questions || []).forEach((q) => {
                    const rawP = q.parentQuestion || (q.questionId ? q.questionId.split(/[\.\s\(]/)[0] : "Q1");
                    const mNum = String(rawP).match(/\d+/);
                    const qNum = mNum ? parseInt(mNum[0], 10) : 1;
                    const pId = `Q${qNum}`;

                    if (!parentGroupsMap.has(pId)) {
                      let modName = q.section || "MODULE-1";
                      if (modName === "MODULE-1" || !modName.includes("-")) {
                        if (qNum in [1, 2] || qNum <= 2) modName = "MODULE-2";
                        else if (qNum in [3, 4] || qNum <= 4) modName = "MODULE-3";
                        else if (qNum in [5, 6] || qNum <= 6) modName = "MODULE-4";
                      }

                      parentGroupsMap.set(pId, {
                        parentId: pId,
                        qNum: qNum,
                        section: modName,
                        questions: [],
                      });
                    }
                    parentGroupsMap.get(pId).questions.push(q);
                  });

                  const moduleMap = new Map();
                  parentGroupsMap.forEach((pGroup) => {
                    const sec = pGroup.section;
                    if (!moduleMap.has(sec)) {
                      moduleMap.set(sec, []);
                    }
                    moduleMap.get(sec).push(pGroup);
                  });

                  const renderedModules = [];

                  moduleMap.forEach((parentsList, secName) => {
                    parentsList.sort((a, b) => a.qNum - b.qNum);

                    renderedModules.push(
                      <div className="analysis-module-block" key={secName}>
                        <div className="module-divider-banner">
                          <span className="module-title-badge">📌 {secName}</span>
                          <span className="module-info-text">{parentsList.length} Main Question(s)</span>
                        </div>

                        <div className="module-parents-container">
                          {parentsList.map((pGroup) => {
                            const isOdd = pGroup.qNum % 2 === 1;
                            const isOptional = !isOdd;
                            const optionalPartner = isOptional ? `Q${pGroup.qNum - 1}` : null;

                            const getSubQMarks = (q) => {
                              const raw = Number(q.marks || 0);
                              const qCount = pGroup.questions.length;
                              const rawSum = pGroup.questions.reduce((sum, item) => sum + Number(item.marks || 0), 0);

                              if (rawSum >= 16) return raw;

                              const qId = q.questionId || "";
                              if (qCount === 3) {
                                if (qId.endsWith("(c)") || qId.endsWith(".c)") || qId.endsWith(".3)")) {
                                  return 4;
                                }
                                return 8;
                              } else if (qCount === 2) {
                                return 10;
                              } else if (qCount === 1) {
                                return 20;
                              }
                              return raw || 5;
                            };

                            const totalGroupMarks = pGroup.questions.reduce((sum, q) => sum + getSubQMarks(q), 0);

                            return (
                              <div key={pGroup.parentId} className="parent-group-wrapper">
                                {isOptional && (
                                  <div className="or-choice-divider">
                                    <span className="or-line"></span>
                                    <span className="or-badge">⚡ OR CHOICE ⚡</span>
                                    <span className="or-line"></span>
                                  </div>
                                )}

                                <div className={`main-q-container ${isOptional ? "optional-group" : "primary-group"}`}>
                                  <div className="main-q-header">
                                    <div className="main-q-title-left">
                                      <span className="main-q-badge">{pGroup.parentId}</span>
                                      <span className="main-q-label">Main Question {pGroup.parentId}</span>
                                      {isOptional && (
                                        <span className="q-optional-badge">
                                          🔄 Optional With: {optionalPartner}
                                        </span>
                                      )}
                                    </div>
                                    <div className="main-q-meta-right">
                                      <span className="main-q-stat">{pGroup.questions.length} Sub-Question(s)</span>
                                      <span className="main-q-marks-pill">Total: {totalGroupMarks} M</span>
                                    </div>
                                  </div>

                                  <div className="sub-questions-list">
                                    {pGroup.questions.map((q, qIdx) => {
                                      const subMarks = getSubQMarks(q);

                                      return (
                                        <div className="sub-q-card" key={qIdx}>
                                          <div className="sub-q-topbar">
                                            <div className="sub-q-id-cluster">
                                              <span className="sub-q-badge">{q.questionId || `${pGroup.parentId}(${qIdx + 1})`}</span>
                                              <span className="sub-q-type-pill">Type: {q.questionType || "THEORY"}</span>
                                            </div>
                                            <span className="sub-q-marks-badge">Marks: {subMarks} M</span>
                                          </div>

                                          <p className="sub-q-text">{q.text}</p>

                                          {/* Display MCQ Options if available */}
                                          {q.options && q.options.length > 0 && (
                                            <div className="analysis-mcq-options-list">
                                              {q.options.map((opt, oIdx) => (
                                                <div className="analysis-mcq-opt-item" key={oIdx}>
                                                  {opt}
                                                </div>
                                              ))}
                                            </div>
                                          )}

                                          {/* Display Attached Diagram Image if present */}
                                          {q.imageUrl && (
                                            <div className="q-attached-image-container">
                                              <p className="image-label">Attached Diagram / Figure:</p>
                                              <img src={q.imageUrl} alt={`Diagram for ${q.questionId}`} className="q-diagram-img" />
                                            </div>
                                          )}

                                          <div className="sub-q-bottom-row">
                                            <span className="sub-q-topic">Topic: {q.topic || "General"}</span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });

                  return renderedModules;
                })()
              )}
            </div>

            <div className="modal-footer">
              <button
                className="edit-from-modal-btn"
                onClick={() => {
                  const p = selectedPaper;
                  setSelectedPaper(null);
                  handleEdit(p);
                }}
              >
                ✏ Edit This Paper
              </button>
              <button className="close-btn-footer" onClick={() => setSelectedPaper(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. EDIT PAPER MODAL (Super Clean & Modern Design) */}
      {/* ========================================================================= */}
      {editingPaper && (
        <div className="modal-overlay" onClick={() => setEditingPaper(null)}>
          <div
            className="paper-modal-content edit-modal-size"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title-block">
                <div className="modal-title-top">
                  <h2>Edit Question Paper</h2>
                  <span className="edit-paper-id-badge">{editingPaper}</span>
                </div>
                <p className="modal-subtitle-text">
                  Modify academic metadata, update questions, allocate marks, or attach diagrams.
                </p>
              </div>
              <button
                className="close-modal-btn"
                onClick={() => setEditingPaper(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body-form">
              {/* Paper Metadata Card */}
              <div className="edit-metadata-card">
                <h3 className="section-subtitle">📌 Academic & Paper Metadata</h3>
                <div className="edit-form-grid">
                  <div className="form-group">
                    <label>Subject Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Internet of Things"
                      value={editData.subject}
                      onChange={(e) =>
                        setEditData({ ...editData, subject: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>Subject Code</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 21CS61"
                      value={editData.subjectCode}
                      onChange={(e) =>
                        setEditData({ ...editData, subjectCode: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>Examination Category / Type</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Semester Exam, Mid-Term, Internal 1, Final..."
                      value={editData.examName || ""}
                      onChange={(e) =>
                        setEditData({ ...editData, examName: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>College / University Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Don Bosco Institute of Technology"
                      value={editData.collegeName}
                      onChange={(e) =>
                        setEditData({ ...editData, collegeName: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>Target Semester</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 6"
                      value={editData.semester}
                      onChange={(e) =>
                        setEditData({ ...editData, semester: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>Total / Maximum Marks</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="e.g. 40"
                      value={editData.maxMarks}
                      onChange={(e) =>
                        setEditData({ ...editData, maxMarks: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Questions Section */}
              <div className="edit-questions-section">
                <div className="section-title-row">
                  <div className="section-title-left">
                    <h3>Questions List</h3>
                    <span className="q-count-badge">{editData.questions?.length || 0} Questions</span>
                  </div>
                  <button
                    type="button"
                    className="add-q-btn-gradient"
                    onClick={addQuestion}
                  >
                    + Add New Question
                  </button>
                </div>

                <div className="edit-q-cards-list">
                  {editData.questions?.map((q, idx) => {
                    const isMcqPaper = editData.paperFormat === "MCQ" || q.questionType === "MCQ";

                    return (
                      <div className="edit-q-card" key={idx}>
                        <div className="q-card-header">
                          <div className="q-header-left">
                            <span className="q-index-badge">#{idx + 1}</span>

                            <div className="q-field-group">
                              <label className="q-mini-label">Question ID</label>
                              <input
                                type="text"
                                className="q-id-input"
                                placeholder="e.g. Q1"
                                value={q.questionId}
                                onChange={(e) =>
                                  handleQuestionChange(idx, "questionId", e.target.value)
                                }
                              />
                            </div>

                            <div className="q-field-group">
                              <label className="q-mini-label">Marks</label>
                              <input
                                type="number"
                                className="q-marks-input"
                                placeholder="Marks"
                                value={q.marks}
                                onChange={(e) =>
                                  handleQuestionChange(idx, "marks", e.target.value)
                                }
                              />
                            </div>
                          </div>

                          <button
                            type="button"
                            className="del-q-btn"
                            onClick={() => deleteQuestion(idx)}
                            title="Delete this question"
                          >
                            🗑 Delete
                          </button>
                        </div>

                        <div className="q-prompt-field-group">
                          <label className="q-field-label">Question Prompt / Problem Statement *</label>
                          <textarea
                            rows="3"
                            className="q-text-input"
                            placeholder="Enter the complete question text here..."
                            value={q.text}
                            onChange={(e) =>
                              handleQuestionChange(idx, "text", e.target.value)
                            }
                          />
                        </div>

                        {/* MCQ Choices Editor if Question is MCQ */}
                        {isMcqPaper && (
                          <div className="edit-mcq-options-wrapper">
                            <label className="q-field-label">MCQ Options (A, B, C, D):</label>
                            <div className="edit-mcq-options-grid">
                              {["A", "B", "C", "D"].map((letter, optIdx) => {
                                const currentOptVal = (q.options && q.options[optIdx]) || "";
                                const cleanVal = currentOptVal.replace(/^[A-Da-d][\)\.]\s*/, "");

                                return (
                                  <div className="edit-mcq-opt-item" key={optIdx}>
                                    <span className="edit-opt-circle">{letter}</span>
                                    <input
                                      type="text"
                                      className="edit-opt-input"
                                      placeholder={`Option ${letter} description...`}
                                      value={cleanVal}
                                      onChange={(e) => {
                                        const opts = [...(q.options || ["", "", "", ""])];
                                        opts[optIdx] = `${letter}) ${e.target.value}`;
                                        handleQuestionChange(idx, "options", opts);
                                      }}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="q-meta-grid">
                          <div className="form-group">
                            <label className="q-mini-label">{isMcqPaper ? "Section" : "Module / Section"}</label>
                            <input
                              type="text"
                              className="form-input-sm"
                              value={q.section || ""}
                              placeholder={isMcqPaper ? "e.g. MCQ-SECTION" : "e.g. MODULE-1"}
                              onChange={(e) =>
                                handleQuestionChange(idx, "section", e.target.value)
                              }
                            />
                          </div>
                          <div className="form-group">
                            <label className="q-mini-label">Topic / Concept</label>
                            <input
                              type="text"
                              className="form-input-sm"
                              value={q.topic || ""}
                              placeholder="e.g. IoT Architecture"
                              onChange={(e) =>
                                handleQuestionChange(idx, "topic", e.target.value)
                              }
                            />
                          </div>
                          {!isMcqPaper && (
                            <div className="form-group">
                              <label className="q-mini-label">Optional With (OR Choice)</label>
                              <input
                                type="text"
                                className="form-input-sm"
                                value={q.optionalWith || ""}
                                placeholder="e.g. Q1 (leave empty if primary)"
                                onChange={(e) =>
                                  handleQuestionChange(idx, "optionalWith", e.target.value)
                                }
                              />
                            </div>
                          )}
                        </div>

                        {/* Diagram Attachment in Edit Modal */}
                        <div className="q-diagram-edit-section">
                          <label className="diagram-field-label">
                            Attached Diagram / Reference Figure:
                          </label>
                          {q.imageUrl ? (
                            <div className="diagram-preview-box">
                              <img
                                src={q.imageUrl}
                                alt="Question diagram"
                                className="diagram-thumb"
                              />
                              <button
                                type="button"
                                className="remove-diagram-btn"
                                onClick={() => removeQuestionImage(idx)}
                              >
                                ✕ Remove Attached Diagram
                              </button>
                            </div>
                          ) : (
                            <input
                              type="file"
                              accept="image/*"
                              className="diagram-file-input"
                              onChange={(e) =>
                                handleQuestionImageUpload(idx, e.target.files[0])
                              }
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="cancel-btn"
                onClick={() => setEditingPaper(null)}
              >
                Cancel
              </button>
              <button
                className="save-btn-emerald"
                disabled={actionLoading === `save-${editingPaper}`}
                onClick={handleUpdate}
              >
                {actionLoading === `save-${editingPaper}`
                  ? "Saving Changes..."
                  : "✓ Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ASSIGN PRACTICE PAPER MODAL */}
      {/* ========================================================================= */}
      {practiceModalPaper && (
        <div className="modal-overlay" onClick={() => setPracticeModalPaper(null)}>
          <div className="practice-assign-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>🎯 Assign Paper For Student Practice</h2>
                <p className="modal-subtext">
                  Make this paper accessible to students in their Practice Papers workspace for unlimited self-assessments.
                </p>
              </div>
              <button className="close-btn" onClick={() => setPracticeModalPaper(null)}>✕</button>
            </div>

            <div className="modal-body-section">
              <div className="assign-paper-summary-card">
                <span className="summary-paper-id">{practiceModalPaper.paperId}</span>
                <h3>{practiceModalPaper.subject}</h3>
                <span className="summary-format">{isPaperMcq(practiceModalPaper) ? "🎯 Objective MCQ" : "📑 Theory Assessment"}</span>
              </div>

              <div className="practice-form-group">
                <label className="toggle-label-row">
                  <span>Enable Student Practice Mode</span>
                  <input
                    type="checkbox"
                    checked={practiceAllowed}
                    onChange={(e) => setPracticeAllowed(e.target.checked)}
                    className="toggle-checkbox"
                  />
                </label>
                <small className="field-hint">
                  {practiceAllowed
                    ? "✓ Students will be able to practice this paper unlimited times."
                    : "✕ Students will not see this paper in their practice library."}
                </small>
              </div>

              {practiceAllowed && (
                <div className="practice-form-group">
                  <label>Target Semester for Practice:</label>
                  <select
                    value={practiceSem}
                    onChange={(e) => setPracticeSem(e.target.value)}
                    className="practice-sem-select"
                  >
                    <option value="All Semesters">All Semesters (Universal)</option>
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
              )}
            </div>

            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setPracticeModalPaper(null)}>
                Cancel
              </button>
              <button
                className="save-btn-emerald"
                disabled={practiceSaving}
                onClick={handleSavePracticeAssignment}
              >
                {practiceSaving ? "Saving Assignment..." : "✓ Save Practice Settings"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UploadedPaperAnalysis;