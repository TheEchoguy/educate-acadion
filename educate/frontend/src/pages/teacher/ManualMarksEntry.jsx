import {
  useEffect,
  useState
} from "react";

import toast from "react-hot-toast";

import {
  getStudents,
  getTeacherProfile,
} from "../../services/adminService";

import {
  getAllPapers
} from "../../services/paperService";

import {
  submitResponses
} from "../../services/responseService";

import "./ManualMarksEntry.css";

function ManualMarksEntry() {

  const [students, setStudents] =
    useState([]);

  const [papers, setPapers] =
    useState([]);

  const [teacherAssignedSubjects, setTeacherAssignedSubjects] = useState([]);

  const [selectedStudent,
    setSelectedStudent] =
      useState("");

  const [selectedPaper,
    setSelectedPaper] =
      useState("");

  const [selectedPaperData,
    setSelectedPaperData] =
      useState(null);

  const [responses,
    setResponses] =
      useState([]);

  const [loading,
    setLoading] =
      useState(false);

  useEffect(() => {
    fetchStudents();
    fetchTeacherAndPapers();
  }, []);

  const fetchStudents =
    async () => {

      try {
        const data =
          await getStudents();
        setStudents(data || []);
      } catch (error) {
        toast.error(
          "Failed to load students"
        );
      }
    };

  const fetchTeacherAndPapers = async () => {
    try {
      const email = localStorage.getItem("email") || "";
      let assigned = [];

      if (email) {
        try {
          const profile = await getTeacherProfile(email);
          if (profile && Array.isArray(profile.assignedSubjects)) {
            assigned = profile.assignedSubjects;
            setTeacherAssignedSubjects(assigned);
            localStorage.setItem("assignedSubjects", JSON.stringify(assigned));
          }
        } catch (err) {
          console.warn("Could not load fresh teacher profile", err);
          const cached = localStorage.getItem("assignedSubjects");
          if (cached) {
            try {
              assigned = JSON.parse(cached);
              setTeacherAssignedSubjects(assigned);
            } catch (e) {}
          }
        }
      }

      const paperData = await getAllPapers();
      setPapers(paperData || []);
    } catch (error) {
      toast.error("Failed to load papers");
    }
  };

  const isSubjectMatching = (paper, assignedList, teacherEmail) => {
    if (!paper) return false;
    // 1. Paper created by this teacher
    if (paper.createdBy && teacherEmail && paper.createdBy.toLowerCase() === teacherEmail.toLowerCase()) {
      return true;
    }
    // 2. If no subjects assigned by admin, let teacher access all papers
    if (!assignedList || assignedList.length === 0) {
      return true;
    }

    const pSubj = (paper.subject || "").toLowerCase().trim();
    const pCode = (paper.subjectCode || "").toLowerCase().trim();
    const pId = (paper.paperId || "").toLowerCase().trim();

    return assignedList.some((assignSub) => {
      const clean = (assignSub || "").toLowerCase().trim();
      if (!clean) return false;

      // Direct text / substring match
      if (pSubj.includes(clean) || clean.includes(pSubj)) return true;
      if (pCode.includes(clean) || clean.includes(pCode)) return true;
      if (pId.includes(clean) || clean.includes(pId)) return true;

      // Extract code inside parentheses e.g. "Internet of Things (21cs61)" -> code: "21cs61", name: "internet of things"
      let namePart = clean;
      let codePart = "";
      if (clean.includes("(") && clean.includes(")")) {
        codePart = clean.substring(clean.indexOf("(") + 1, clean.indexOf(")")).trim();
        namePart = clean.substring(0, clean.indexOf("(")).trim();
      }

      if (codePart && (pCode.includes(codePart) || codePart.includes(pCode) || pId.includes(codePart))) {
        return true;
      }
      if (namePart && (pSubj.includes(namePart) || namePart.includes(pSubj))) {
        return true;
      }

      // Acronym and synonym mappings
      const synonyms = {
        iks: ["indian knowledge system", "biiks609", "iks"],
        "indian knowledge system": ["iks", "biiks609"],
        iot: ["internet of things", "21cs61", "iot"],
        "internet of things": ["iot", "21cs61"],
        "renewable energy resources": ["renewable", "technologies of renewable", "int_renewable", "energy"],
        "renewable energy": ["renewable", "energy"],
        "machine learning": ["ml", "ml123", "ml-601"],
        ml: ["machine learning", "ml123"],
        "artificial intelligence": ["ai", "ai1234", "ai-int-601"],
        ai: ["artificial intelligence", "ai1234"],
        "database management systems": ["dbms", "database"],
        dbms: ["database management systems", "database"],
      };

      for (const [key, synList] of Object.entries(synonyms)) {
        if (clean.includes(key) || key.includes(clean)) {
          if (synList.some((s) => pSubj.includes(s) || pCode.includes(s) || pId.includes(s))) {
            return true;
          }
        }
      }

      return false;
    });
  };

  const accessiblePapers = papers.filter((p) =>
    isSubjectMatching(p, teacherAssignedSubjects, localStorage.getItem("email"))
  );

  const [includeInOverall, setIncludeInOverall] = useState(true);
  const [existingSubmissionFound, setExistingSubmissionFound] = useState(false);

  const handleStudentSelect = (usn) => {
    setSelectedStudent(usn);
    if (selectedPaper && usn) {
      checkExistingEvaluation(usn, selectedPaper);
    }
  };

  const handlePaperSelect = (paperId) => {
    setSelectedPaper(paperId);
    const paper = papers.find((p) => p.paperId === paperId);
    setSelectedPaperData(paper);

    if (!paper) {
      setResponses([]);
      return;
    }

    if (selectedStudent && paperId) {
      checkExistingEvaluation(selectedStudent, paperId, paper);
    } else {
      initializeEmptyResponses(paper);
    }
  };

  const getRowDividers = (items, index) => {
    const current = items[index];
    const prev = index > 0 ? items[index - 1] : null;

    const extractParent = (item) => {
      if (!item) return { parent: null, num: null, section: null };
      if (item.parentQuestion) {
        const match = item.parentQuestion.match(/\d+/);
        return { parent: item.parentQuestion, num: match ? parseInt(match[0], 10) : null, section: item.section };
      }
      const match = item.questionId?.match(/(?:Q|Question)?\s*(\d+)/i);
      const num = match ? parseInt(match[1], 10) : null;
      return { parent: num ? `Q${num}` : null, num, section: item.section };
    };

    const currInfo = extractParent(current);
    const prevInfo = extractParent(prev);

    let showModuleHeader = false;
    let moduleTitle = "";
    let showOrDivider = false;
    let orMessage = "";

    // 1. Module / Section Header
    if (index === 0) {
      if (current.section) {
        showModuleHeader = true;
        moduleTitle = current.section.replace(/[-_]/g, " ").toUpperCase();
      }
    } else if (current.section && prev?.section && current.section !== prev.section) {
      showModuleHeader = true;
      moduleTitle = current.section.replace(/[-_]/g, " ").toUpperCase();
    } else if (!current.section && currInfo.num && prevInfo.num) {
      if (currInfo.num % 2 === 1 && currInfo.num !== prevInfo.num && currInfo.num > 1) {
        showModuleHeader = true;
        moduleTitle = `MODULE ${Math.ceil(currInfo.num / 2)}`;
      }
    }

    // 2. OR Divider between paired alternative questions (e.g. Q1 vs Q2, Q3 vs Q4)
    if (prev && currInfo.parent && prevInfo.parent && currInfo.parent !== prevInfo.parent) {
      const isOrChoice =
        current.optionalQuestion === true ||
        Boolean(current.optionalWith) ||
        (current.groupName && current.groupName.toUpperCase().includes("OR")) ||
        (currInfo.num != null && prevInfo.num != null && currInfo.num === prevInfo.num + 1 && prevInfo.num % 2 === 1);

      if (isOrChoice) {
        showOrDivider = true;
        orMessage = `OR (Choose Either ${prevInfo.parent} or ${currInfo.parent})`;
      }
    }

    return { showModuleHeader, moduleTitle, showOrDivider, orMessage };
  };

  const initializeEmptyResponses = (paper) => {
    const formattedResponses = (paper.questions || []).map((question) => ({
      questionId: question.questionId,
      question: question.text,
      topic: question.topic,
      section: question.section,
      groupName: question.groupName,
      parentQuestion: question.parentQuestion,
      optionalQuestion: question.optionalQuestion,
      optionalWith: question.optionalWith,
      maxMarks: question.marks,
      marksObtained: "",
      feedback: "Offline Written Exam Evaluation",
      answer: "Offline Written Exam",
    }));
    setResponses(formattedResponses);
    setExistingSubmissionFound(false);
  };

  const checkExistingEvaluation = async (usn, paperId, paperRef = null) => {
    const targetPaper = paperRef || selectedPaperData || papers.find((p) => p.paperId === paperId);
    if (!targetPaper) return;

    try {
      const studentResults = await getStudentResults(usn);
      const offlineEntry = (studentResults || []).find(
        (r) => r.paperId?.toLowerCase() === paperId?.toLowerCase() && r.submissionMode === "OFFLINE_MANUAL"
      );

      if (offlineEntry && offlineEntry.responses && offlineEntry.responses.length > 0) {
        setExistingSubmissionFound(true);
        const map = new Map(offlineEntry.responses.map((r) => [r.questionId, r]));
        const merged = (targetPaper.questions || []).map((q) => {
          const match = map.get(q.questionId);
          return {
            questionId: q.questionId,
            question: q.text,
            topic: q.topic,
            section: q.section,
            groupName: q.groupName,
            parentQuestion: q.parentQuestion,
            optionalQuestion: q.optionalQuestion,
            optionalWith: q.optionalWith,
            maxMarks: q.marks,
            marksObtained: match ? match.marksObtained : "",
            feedback: match ? match.feedback || "Offline Written Exam Evaluation" : "",
            answer: match ? match.answer || "Offline Written Exam" : "Offline Written Exam",
          };
        });
        setResponses(merged);
        if (offlineEntry.includeInOverallPercentage !== undefined) {
          setIncludeInOverall(Boolean(offlineEntry.includeInOverallPercentage));
        }
        toast("Loaded existing offline evaluation for update.", { icon: "📝" });
      } else {
        initializeEmptyResponses(targetPaper);
      }
    } catch {
      initializeEmptyResponses(targetPaper);
    }
  };

  const handleMarksChange = (index, field, value) => {
    const updated = [...responses];
    updated[index][field] = value;
    setResponses(updated);
  };

  const handleSave = async () => {
    try {
      if (!selectedStudent) {
        toast.error("Please select a student");
        return;
      }

      if (!selectedPaper) {
        toast.error("Please select a question paper");
        return;
      }

      setLoading(true);

      const teacherName = localStorage.getItem("name") || "Faculty Evaluator";
      const teacherEmail = localStorage.getItem("email") || "";
      const formattedTeacherName = teacherName.startsWith("Prof.") || teacherName.startsWith("Dr.")
        ? teacherName
        : `Prof. ${teacherName}`;

      const payload = {
        usn: selectedStudent,
        paperId: selectedPaper,
        submissionMode: "OFFLINE_MANUAL",
        includeInOverallPercentage: includeInOverall,
        evaluatedBy: formattedTeacherName,
        evaluatedByEmail: teacherEmail,
        responses: responses.map((response) => ({
          questionId: response.questionId,
          answer: response.answer || "Offline Written Exam",
          marksObtained: Number(response.marksObtained) || 0,
        })),
      };

      await submitResponses(payload);

      toast.success(
        existingSubmissionFound
          ? `Offline Evaluation for ${selectedStudent} Updated Successfully by ${formattedTeacherName}`
          : `Offline Marks for ${selectedStudent} Recorded Successfully by ${formattedTeacherName}`
      );

      setSelectedStudent("");
      setSelectedPaper("");
      setResponses([]);
      setSelectedPaperData(null);
      setExistingSubmissionFound(false);
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || error.response?.data || "Failed to save marks");
    } finally {
      setLoading(false);
    }
  };

  // Live Statistics
  const totalMarksEntered = responses.reduce(
    (acc, r) => acc + (Number(r.marksObtained) || 0),
    0
  );
  const totalMaxMarks = selectedPaperData?.maxMarks || selectedPaperData?.totalMarks || 40;
  const gradedCount = responses.filter(
    (r) => r.marksObtained !== "" && r.marksObtained !== null && r.marksObtained !== undefined
  ).length;

  return (
    <div className="manual-page">
      <div className="manual-header">
        <h1>Manual Marks Entry</h1>
        <p>Evaluate offline classroom written tests question-wise without locking online exam access.</p>
      </div>

      {/* Evaluator Faculty Identification Banner */}
      <div className="evaluator-banner-card">
        <div className="eval-faculty-info">
          <span className="eval-faculty-icon">👨‍🏫</span>
          <div className="eval-faculty-text-col">
            <span className="eval-sub-text">Authorized Recording Faculty:</span>
            <h3 className="eval-faculty-name">
              Prof. {localStorage.getItem("name") || "Faculty Evaluator"}{" "}
              {localStorage.getItem("email") ? `(${localStorage.getItem("email")})` : ""}
            </h3>
            <div className="eval-assigned-row">
              <span className="eval-assigned-label">🎯 Assigned Teaching Subject(s):</span>
              {teacherAssignedSubjects && teacherAssignedSubjects.length > 0 ? (
                <div className="assigned-subj-pills-wrap">
                  {teacherAssignedSubjects.map((sub, idx) => (
                    <span key={idx} className="assigned-subj-pill">
                      ✓ {sub}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="no-subj-assigned-note">
                  ⚠️ No subjects assigned by Admin yet (Showing all departmental papers)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="offline-mode-info-banner">
        <span className="banner-icon">ℹ️</span>
        <div>
          <strong>Decoupled Offline Evaluation Mode:</strong>
          <p>
            Marks entered here are saved into student offline records and will <strong>NOT</strong> block or lock students from attending the online examination on their portal.
          </p>
        </div>
      </div>

      <div className="manual-container">
        <div className="manual-top">
          <select
            value={selectedStudent}
            onChange={(e) => handleStudentSelect(e.target.value)}
          >
            <option value="">Select Student</option>
            {students.map((student) => (
              <option key={student.usn} value={student.usn}>
                {student.name} - {student.usn}
              </option>
            ))}
          </select>

          <select
            value={selectedPaper}
            onChange={(e) => handlePaperSelect(e.target.value)}
          >
            <option value="">
              {accessiblePapers.length > 0
                ? `Select Paper (${accessiblePapers.length} Available for Your Subject)`
                : "No Papers for Your Assigned Subject"}
            </option>
            {accessiblePapers.length === 0 ? (
              <option value="" disabled>No Question Papers match your assigned subjects</option>
            ) : (
              accessiblePapers.map((paper) => (
                <option key={paper.paperId} value={paper.paperId}>
                  {paper.subject} - {paper.paperId} {paper.subjectCode ? `(${paper.subjectCode})` : ""}
                </option>
              ))
            )}
          </select>
        </div>

        {selectedPaperData && (
          <div className="paper-info">
            <div className="paper-info-header">
              <div>
                <h2>{selectedPaperData.subject}</h2>
                <div className="paper-sub-meta">
                  <span>Paper ID: <strong>{selectedPaperData.paperId}</strong></span>
                  <span>Category: <strong>{selectedPaperData.examName || `Internal ${selectedPaperData.internalNo || 1}`}</strong></span>
                  <span>Questions: <strong>{responses.length} Qs</strong></span>
                </div>
              </div>

              {/* Live Evaluation Score Pill */}
              <div className="evaluation-live-stats">
                <div className="stat-badge">
                  <small>Score Entered</small>
                  <strong className="live-score-text">
                    {totalMarksEntered} <span className="max-score">/ {totalMaxMarks} M</span>
                  </strong>
                </div>
                <div className="stat-badge">
                  <small>Graded Progress</small>
                  <strong>{gradedCount} / {responses.length} Qs</strong>
                </div>
                {existingSubmissionFound && (
                  <span className="existing-eval-pill">📝 Edit Mode</span>
                )}
              </div>
            </div>

            <div className="overall-calc-toggle">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={includeInOverall}
                  onChange={(e) => setIncludeInOverall(e.target.checked)}
                />
                <span>Include offline marks in student's overall GPA & Performance Analytics</span>
              </label>
            </div>
          </div>
        )}

        {/* Compact Horizontal Row Ledger List with authentic OR Dividers */}
        {responses.length > 0 && (
          <div className="compact-questions-ledger">
            <div className="ledger-header-row">
              <div className="col-qid">Question #</div>
              <div className="col-desc">Question Prompt & Topic</div>
              <div className="col-max">Max</div>
              <div className="col-marks">Marks Awarded</div>
              <div className="col-feedback">Remarks / Notes</div>
            </div>

            <div className="ledger-rows-container">
              {responses.map((response, index) => {
                const { showModuleHeader, moduleTitle, showOrDivider, orMessage } = getRowDividers(responses, index);
                const isFilled = response.marksObtained !== "" && response.marksObtained !== null;

                return (
                  <div key={index} className="ledger-item-wrapper">
                    {/* Module / Section Header */}
                    {showModuleHeader && (
                      <div className="ledger-module-header">
                        <span className="module-title-badge">📚 {moduleTitle}</span>
                      </div>
                    )}

                    {/* Prominent OR Divider between Alternative Questions */}
                    {showOrDivider && (
                      <div className="ledger-or-divider-row">
                        <div className="or-line" />
                        <div className="or-badge-capsule">
                          <span className="or-text">⚡ OR</span>
                          <span className="or-subtext">{orMessage}</span>
                        </div>
                        <div className="or-line" />
                      </div>
                    )}

                    {/* Question Row */}
                    <div className={`ledger-row ${isFilled ? "row-filled" : ""}`}>
                      {/* Column 1: QID only */}
                      <div className="col-qid">
                        <strong className="qid-pill">{response.questionId}</strong>
                      </div>

                      {/* Column 2: Question text & topic */}
                      <div className="col-desc">
                        <p className="compact-q-text">{response.question}</p>
                        <div className="compact-q-tags">
                          {response.topic && (
                            <span className="topic-pill">{response.topic}</span>
                          )}
                        </div>
                      </div>

                      {/* Column 3: Max Marks */}
                      <div className="col-max">
                        <span className="max-marks-pill">
                          {response.maxMarks || 5} M
                        </span>
                      </div>

                      {/* Column 4: Marks Input */}
                      <div className="col-marks">
                        <div className="input-with-limit">
                          <input
                            type="number"
                            min="0"
                            max={response.maxMarks || 100}
                            step="0.5"
                            placeholder="0"
                            className={`marks-num-input ${isFilled ? "filled" : ""}`}
                            value={response.marksObtained}
                            onChange={(e) =>
                              handleMarksChange(
                                index,
                                "marksObtained",
                                e.target.value
                              )
                            }
                          />
                          <span className="input-max-hint">/ {response.maxMarks}</span>
                        </div>
                      </div>

                      {/* Column 5: Feedback / Remarks */}
                      <div className="col-feedback">
                        <input
                          type="text"
                          placeholder="Evaluation note..."
                          className="feedback-text-input"
                          value={response.feedback}
                          onChange={(e) =>
                            handleMarksChange(
                              index,
                              "feedback",
                              e.target.value
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions Bar with Live Total and Save Button */}
            <div className="ledger-bottom-bar">
              <div className="ledger-summary-info">
                <span>
                  Total Awarded: <strong>{totalMarksEntered} / {totalMaxMarks} Marks</strong>
                </span>
                <span className="divider">•</span>
                <span>
                  Evaluated: <strong>{gradedCount} of {responses.length} Questions</strong>
                </span>
              </div>

              <button
                className="save-btn"
                onClick={handleSave}
                disabled={loading}
              >
                {loading
                  ? "Saving..."
                  : existingSubmissionFound
                  ? "💾 Update Evaluation"
                  : "💾 Save Evaluation"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ManualMarksEntry;