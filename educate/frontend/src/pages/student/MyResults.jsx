import { useEffect, useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { jwtDecode } from "jwt-decode";
import { getStudentResults } from "../../services/responseService";
import { getAllPapers } from "../../services/paperService";
import { getStudentClassrooms, getMyPerformance } from "../../services/classroomService";
import { exportEvaluatedSubmissionPdf } from "../../utils/pdfGenerator";
import "./MyResults.css";

function MyResults() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);

  // Unified Hub Tab: AVAILABLE_EXAMS | PRACTICE_PAPERS | EVALUATED_RESULTS
  const initialHubTab = searchParams.get("tab") ||
    (location.pathname.includes("exams") ? "AVAILABLE_EXAMS" :
     location.pathname.includes("practice") ? "PRACTICE_PAPERS" : "EVALUATED_RESULTS");
  const [hubTab, setHubTab] = useState(initialHubTab);

  // Section in Evaluated Results: ONLINE_TESTS (Section A) | IA_MARKSHEETS (Section B)
  const [resultsSection, setResultsSection] = useState("ONLINE_TESTS");

  const [results, setResults] = useState([]);
  const [papers, setPapers] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [iaPerformanceMap, setIaPerformanceMap] = useState({});
  const [selectedResult, setSelectedResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("ALL"); // ALL, THEORY, MCQ, OFFLINE
  const [searchQuery, setSearchQuery] = useState("");

  const fetchResults = async () => {
    try {
      setLoading(true);
      let usn = "";
      const authToken = sessionStorage.getItem("token") || localStorage.getItem("token");
      if (authToken) {
        try {
          const decoded = jwtDecode(authToken);
          if (decoded.usn && decoded.usn.trim()) usn = decoded.usn.trim();
          else if (decoded.sub && decoded.sub.trim()) usn = decoded.sub.trim();
        } catch (e) {}
      }
      if (!usn) {
        usn = sessionStorage.getItem("usn") || localStorage.getItem("usn");
      }
      if (!usn) {
        toast.error("USN not found. Please log in again.");
        return;
      }

      const [resData, paperData, clsData] = await Promise.allSettled([
        getStudentResults(usn),
        getAllPapers({ role: "STUDENT" }),
        getStudentClassrooms(),
      ]);

      if (resData.status === "fulfilled") {
        setResults(resData.value || []);
      }
      if (paperData.status === "fulfilled") {
        setPapers(paperData.value || []);
      }
      if (clsData.status === "fulfilled" && clsData.value) {
        const clsList = clsData.value || [];
        setClassrooms(clsList);

        // Fetch student IA performance records for each enrolled classroom
        const pMap = {};
        await Promise.allSettled(
          clsList.map(async (cls) => {
            try {
              const perf = await getMyPerformance(cls.id);
              if (perf) pMap[cls.id] = perf;
            } catch (err) {}
          })
        );
        setIaPerformanceMap(pMap);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to load evaluation results");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, []);

  const isMcqResult = (r) => {
    if (!r) return false;
    if (r.paperCategory === "QUIZ" || r.paperFormat === "MCQ") return true;
    if (r.paperId && r.paperId.toUpperCase().includes("MCQ")) return true;
    return false;
  };

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

  const currentPaper = useMemo(() => {
    if (!selectedResult) return null;
    return papers.find(
      (p) =>
        p.paperId?.toLowerCase() === selectedResult.paperId?.toLowerCase() ||
        p.id === selectedResult.paperId
    );
  }, [selectedResult, papers]);

  const detailedQuestions = useMemo(() => {
    if (!selectedResult) return [];
    const paperQuestions = currentPaper?.questions || [];
    const submittedResponses = selectedResult.responses || [];

    if (paperQuestions.length === 0) {
      return submittedResponses.map((ans, idx) => ({
        ...ans,
        questionId: ans.questionId || `Q${idx + 1}`,
        maxMarks: ans.maxMarks || 5,
        attempted: true,
      }));
    }

    return paperQuestions.map((pq, idx) => {
      const match = submittedResponses.find(
        (a) => a.questionId?.toLowerCase() === pq.questionId?.toLowerCase()
      );
      return {
        questionId: pq.questionId || `Q${idx + 1}`,
        questionText: pq.questionText || pq.text || match?.questionText || "",
        topic: pq.topic || match?.topic || "",
        maxMarks: pq.maxMarks || pq.marks || match?.maxMarks || 5,
        marksObtained: match?.marksObtained,
        answer: match?.answer,
        feedback: match?.feedback,
        isEvaluated: match?.isEvaluated,
        isCorrect: match?.isCorrect,
        questionType: pq.questionType || match?.questionType,
        section: pq.section || match?.section,
        parentQuestion: pq.parentQuestion || match?.parentQuestion,
        optionalQuestion: pq.optionalQuestion || match?.optionalQuestion,
        optionalWith: pq.optionalWith || match?.optionalWith,
        groupName: pq.groupName || match?.groupName,
        options: pq.options || [],
        attempted: Boolean(match && (match.answer || match.marksObtained != null)),
      };
    });
  }, [selectedResult, currentPaper]);

  const groupedModules = useMemo(() => {
    const isSelectedMcq = isMcqResult(selectedResult);

    const isOrChoice = (q) => {
      if (isSelectedMcq) return false;
      if (!q) return false;
      return q.optionalQuestion === true || Boolean(q.optionalWith) || q.isOr === true;
    };

    const hasAnyOr = !isSelectedMcq && detailedQuestions.some(isOrChoice);

    const extractParent = (item, idx) => {
      if (!item) return { parent: `Q${idx + 1}`, num: idx + 1 };
      if (item.parentQuestion) {
        const match = item.parentQuestion.match(/\d+/);
        const num = match ? parseInt(match[0], 10) : idx + 1;
        return { parent: `Q${num}`, num };
      }
      const match = (item.questionId || "").match(/(?:Q|Question)?\s*(\d+)/i);
      const num = match ? parseInt(match[1], 10) : null;
      return { parent: num ? `Q${num}` : `Q${idx + 1}`, num: num != null ? num : idx + 1 };
    };

    const moduleMap = new Map();

    if (isSelectedMcq) {
      moduleMap.set("ALL", detailedQuestions.map((q, idx) => ({ ...q, _info: extractParent(q, idx), _idx: idx })));
    } else {
      detailedQuestions.forEach((q, idx) => {
        const info = extractParent(q, idx);
        let modKey = 1;
        if (q.section && q.section.trim()) {
          modKey = q.section.trim();
        } else if (q.moduleNumber || q.module) {
          modKey = q.moduleNumber || q.module;
        } else if (hasAnyOr && info.num != null) {
          modKey = Math.ceil(info.num / 2);
        } else {
          modKey = "ALL";
        }

        if (!moduleMap.has(modKey)) {
          moduleMap.set(modKey, []);
        }
        moduleMap.get(modKey).push({ ...q, _info: info, _idx: idx });
      });
    }

    return Array.from(moduleMap.entries());
  }, [detailedQuestions, selectedResult]);

  const onlineTheoryResults = useMemo(
    () => results.filter((r) => r.submissionMode !== "OFFLINE_MANUAL" && !isMcqResult(r)),
    [results]
  );
  const onlineMcqResults = useMemo(
    () => results.filter((r) => isMcqResult(r)),
    [results]
  );
  const offlineResults = useMemo(
    () => results.filter((r) => r.submissionMode === "OFFLINE_MANUAL"),
    [results]
  );

  const displayedResults = useMemo(() => {
    switch (activeTab) {
      case "THEORY":
        return onlineTheoryResults;
      case "MCQ":
        return onlineMcqResults;
      case "OFFLINE":
        return offlineResults;
      default:
        return results;
    }
  }, [activeTab, onlineTheoryResults, onlineMcqResults, offlineResults, results]);

  const exportCategoryCsv = (categoryKey) => {
    let listToExport = results;
    let filename = "All_Exam_Evaluations.csv";

    if (categoryKey === "THEORY") {
      listToExport = onlineTheoryResults;
      filename = "Theory_Exam_Submissions.csv";
    } else if (categoryKey === "MCQ") {
      listToExport = onlineMcqResults;
      filename = "Objective_MCQ_Quiz_Results.csv";
    } else if (categoryKey === "OFFLINE") {
      listToExport = offlineResults;
      filename = "Offline_Written_Test_Evaluations.csv";
    }

    if (listToExport.length === 0) {
      toast.error("No results available to export for this category");
      return;
    }

    const headers = [
      "Paper ID",
      "Subject",
      "Format / Category",
      "Submission Mode",
      "Total Marks",
      "Max Marks",
      "Percentage (%)",
      "AI Predicted Score (%)",
      "Academic Risk Level",
      "Evaluated By",
      "Submitted Date",
    ];

    const rows = listToExport.map((r) => {
      const isOff = r.submissionMode === "OFFLINE_MANUAL";
      const isMcq = isMcqResult(r);
      const totalM = r.totalMarks != null ? r.totalMarks : 0;
      const maxM = r.maxMarks || 40;
      const pct = maxM > 0 ? `${Math.round((totalM / maxM) * 10000) / 100}%` : "0%";
      const dateStr = r.submittedAt
        ? new Date(r.submittedAt).toLocaleDateString("en-IN")
        : r.evaluatedAt
        ? new Date(r.evaluatedAt).toLocaleDateString("en-IN")
        : "Recorded";

      return [
        `"${r.paperId || ""}"`,
        `"${r.subject || ""}"`,
        `"${isOff ? "Offline Written Test" : isMcq ? "Objective MCQ Quiz" : "Online Theory Exam"}"`,
        `"${r.submissionMode || "ONLINE_PORTAL"}"`,
        totalM,
        maxM,
        `"${pct}"`,
        `"${r.predictedScore != null ? r.predictedScore + "%" : "N/A"}"`,
        `"${r.riskLevel || "LOW"}"`,
        `"${r.evaluatedBy || (isOff ? "Faculty Evaluator" : isMcq ? "AI Auto-Evaluator" : "Faculty")}"`,
        `"${dateStr}"`,
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${filename} successfully!`);
  };

  return (
    <div className="results-container">
      {/* Top Navigation Bar */}
      <div className="results-top-bar">
        <button className="back-to-dash-btn" onClick={() => navigate("/student/dashboard")}>
          ← Back To Dashboard
        </button>
      </div>

      {/* Top Header */}
      <div className="results-header">
        <div>
          <h2>📝 Examinations &amp; Marksheets Hub</h2>
          <p>
            Attend scheduled classroom assessments, take unlimited practice papers, and inspect evaluated results.
          </p>
        </div>
      </div>

      {!selectedResult && (
        <div className="hub-main-tabs-nav">
          <button
            type="button"
            className={`hub-tab-btn ${hubTab === "AVAILABLE_EXAMS" ? "active" : ""}`}
            onClick={() => setHubTab("AVAILABLE_EXAMS")}
          >
            <span>📝 Available Classroom Exams</span>
            <span className="tab-count" style={{ background: "rgba(56, 189, 248, 0.2)", color: "#38bdf8", padding: "2px 8px", borderRadius: "10px", fontSize: "0.78rem" }}>
              {papers.length}
            </span>
          </button>

          <button
            type="button"
            className={`hub-tab-btn ${hubTab === "PRACTICE_PAPERS" ? "active" : ""}`}
            onClick={() => setHubTab("PRACTICE_PAPERS")}
          >
            <span>🎯 Practice Papers &amp; Self-Testing</span>
          </button>

          <button
            type="button"
            className={`hub-tab-btn ${hubTab === "EVALUATED_RESULTS" ? "active" : ""}`}
            onClick={() => setHubTab("EVALUATED_RESULTS")}
          >
            <span>📊 Evaluated Results &amp; Marksheets</span>
            <span className="tab-count" style={{ background: "rgba(16, 185, 129, 0.2)", color: "#34d399", padding: "2px 8px", borderRadius: "10px", fontSize: "0.78rem" }}>
              {results.length + classrooms.length}
            </span>
          </button>
        </div>
      )}

      {/* TAB 1: AVAILABLE CLASSROOM EXAMS */}
      {!selectedResult && hubTab === "AVAILABLE_EXAMS" && (
        <div className="hub-available-exams-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
            <h3 style={{ margin: 0, color: "#f8fafc", fontSize: "1.2rem" }}>Scheduled Classroom Exams ({papers.length})</h3>
            <input
              type="text"
              placeholder="Search paper by subject or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: "#1e293b",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                color: "#f8fafc",
                padding: "8px 14px",
                borderRadius: "8px",
                fontSize: "0.86rem",
                width: "280px",
              }}
            />
          </div>

          {loading ? (
            <div className="loading-state-card"><div className="spinner" /><p>Loading classroom exams...</p></div>
          ) : papers.length === 0 ? (
            <div className="empty-results-card">
              <span className="empty-icon">📝</span>
              <h3>No Classroom Examinations Available</h3>
              <p>Your faculty has not scheduled any examinations for your batch yet.</p>
            </div>
          ) : (
            <div className="results-rows-container">
              {papers
                .filter((p) => {
                  if (!searchQuery.trim()) return true;
                  const q = searchQuery.toLowerCase();
                  return (p.subject || "").toLowerCase().includes(q) || (p.subjectCode || "").toLowerCase().includes(q) || (p.paperId || "").toLowerCase().includes(q);
                })
                .map((paper) => {
                  const isMcq = isMcqResult(paper);
                  const paperMaxMarks = getPaperMaxMarks(paper);
                  const attendedSubmission = results.find(
                    (r) => (r.paperId || "").toLowerCase() === (paper.paperId || paper.id || "").toLowerCase()
                  );
                  const isAttended = Boolean(attendedSubmission);

                  return (
                    <div className={`result-row-card ${isMcq ? "mcq-row" : "theory-row"}`} key={paper.id || paper.paperId}>
                      <div className="row-left-cell">
                        <div className="row-badge-cluster">
                          <span className="exam-code-pill">{paper.subjectCode || paper.paperId}</span>
                          <span className={`exam-mode-badge ${isMcq ? "mcq-mode" : "online-mode"}`}>
                            {isMcq ? "🎯 Objective MCQ Quiz" : "🌐 Timed Theory Exam"}
                          </span>
                          {isAttended ? (
                            <span className="eval-status-pill done">✓ Attended ({attendedSubmission.totalMarks}/{attendedSubmission.maxMarks || paperMaxMarks} M)</span>
                          ) : (
                            <span className="eval-status-pill pending">⚡ Ready to Attend</span>
                          )}
                        </div>
                        <h3 className="paper-code-title">{paper.subject}</h3>
                        <div className="evaluator-subtext">
                          <span>Semester: {paper.semester || "All"}</span>
                          <span> • Total Questions: {paper.questions?.length || 0}</span>
                          <span> • Max Marks: {paperMaxMarks} M</span>
                        </div>
                      </div>

                      <div className="row-right-actions">
                        {isAttended ? (
                          <button
                            type="button"
                            className="view-scorecard-btn"
                            onClick={() => {
                              setSelectedResult(attendedSubmission);
                              setHubTab("EVALUATED_RESULTS");
                              setResultsSection("ONLINE_TESTS");
                            }}
                          >
                            👁 View Evaluated Scorecard
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="view-scorecard-btn"
                            style={{ background: "linear-gradient(135deg, #0284c7, #0369a1)", borderColor: "#38bdf8" }}
                            onClick={() => navigate(`/student/attend/${paper.id || paper.paperId}`)}
                          >
                            📝 Attend Classroom Exam →
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PRACTICE PAPERS & SELF-TESTING */}
      {!selectedResult && hubTab === "PRACTICE_PAPERS" && (
        <div className="hub-practice-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h3 style={{ margin: "0 0 4px 0", color: "#f8fafc", fontSize: "1.2rem" }}>🎯 Practice Papers &amp; Self-Testing</h3>
              <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.88rem" }}>
                Take unlimited practice retakes with instant automated AI scoring and solution keys.
              </p>
            </div>
            <button
              type="button"
              className="btn-primary"
              style={{
                padding: "8px 16px",
                background: "linear-gradient(135deg, #9333ea, #7e22ce)",
                border: "none",
                borderRadius: "8px",
                color: "#ffffff",
                fontWeight: 600,
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
              onClick={() => navigate("/student/practice")}
            >
              Open Full Practice Arena →
            </button>
          </div>

          <div className="results-rows-container">
            {papers.map((paper) => {
              const paperMaxMarks = getPaperMaxMarks(paper);
              const isMcq = isMcqResult(paper);

              return (
                <div className="result-row-card theory-row" key={`practice-${paper.id || paper.paperId}`}>
                  <div className="row-left-cell">
                    <div className="row-badge-cluster">
                      <span className="exam-code-pill">{paper.subjectCode || paper.paperId}</span>
                      <span className="exam-mode-badge online-mode">UNLIMITED RETAKES</span>
                      <span className="eval-status-pill done">🎯 Practice Set</span>
                    </div>
                    <h3 className="paper-code-title">{paper.subject}</h3>
                    <div className="evaluator-subtext">
                      <span>Format: {isMcq ? "Objective MCQ" : "Theory Descriptive"}</span>
                      <span> • Max Marks: {paperMaxMarks} M</span>
                      <span> • Instant AI Evaluation Supported</span>
                    </div>
                  </div>

                  <div className="row-right-actions">
                    <button
                      type="button"
                      className="view-scorecard-btn"
                      style={{ background: "rgba(147, 51, 234, 0.2)", borderColor: "rgba(147, 51, 234, 0.5)", color: "#c084fc" }}
                      onClick={() => navigate(`/student/attend/${paper.id || paper.paperId}?mode=practice`)}
                    >
                      🎯 Start Practice Retake →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: EVALUATED RESULTS & MARKSHEETS */}
      {!selectedResult && hubTab === "EVALUATED_RESULTS" && (
        <>
          {/* SECTION A vs SECTION B SUB-NAV */}
          <div className="hub-sub-sections-bar">
            <button
              type="button"
              className={`hub-sub-btn ${resultsSection === "ONLINE_TESTS" ? "active" : ""}`}
              onClick={() => setResultsSection("ONLINE_TESTS")}
            >
              Section A: 🌐 Online Attended Tests ({results.length})
            </button>
            <button
              type="button"
              className={`hub-sub-btn ${resultsSection === "IA_MARKSHEETS" ? "active" : ""}`}
              onClick={() => setResultsSection("IA_MARKSHEETS")}
            >
              Section B: 📝 Internal Assessment (IA) Split-Up Marksheets ({classrooms.length})
            </button>
          </div>

          {/* SECTION B: INTERNAL ASSESSMENT (IA) SPLIT-UP MARKSHEETS */}
          {resultsSection === "IA_MARKSHEETS" && (
            <div className="ia-marksheets-hub-wrapper">
              {classrooms.length === 0 ? (
                <div className="empty-results-card">
                  <span className="empty-icon">🏫</span>
                  <h3>No Classrooms Enrolled</h3>
                  <p>Join a classroom to view your question-by-question IA offline split-up marks.</p>
                </div>
              ) : (
                classrooms.map((cls) => {
                  const rawName = (cls.name || cls.subjectName || "").toLowerCase();
                  const inferredCode = rawName.includes("energy") ? "BEE755B" : (rawName.includes("internet") || rawName.includes("iot") ? "BCS701" : "COURSE");
                  const displayCode = cls.courseCode || cls.subjectCode || inferredCode;
                  const perf = iaPerformanceMap[cls.id];
                  const hasPublishedTests = perf && perf.iaTests && perf.iaTests.length > 0;

                  return (
                    <div className="ia-marksheet-card" key={cls.id}>
                      <div className="ia-marksheet-header">
                        <div className="ia-card-title-group">
                          <h3>{displayCode}: {cls.name || cls.subjectName}</h3>
                          <span className="ia-card-meta">
                            Faculty: <strong>{cls.teacherName || "Faculty"}</strong> • Sem {cls.semester}-{cls.section} • {cls.academicBatch || "Batch"}
                          </span>
                        </div>
                        {hasPublishedTests ? (
                          <div className="ia-scaled-pill">
                            Scaled CIE Marks: <strong>{perf.scaledCieEarned?.toFixed(1) || 0} / {perf.scaledCieMax || 15.0} M</strong>
                          </div>
                        ) : (
                          <div className="ia-pending-badge">
                            ⏳ Pending faculty publication
                          </div>
                        )}
                      </div>

                      {hasPublishedTests ? (
                        perf.iaTests.map((test) => (
                          <div key={test.iaNumber} style={{ marginBottom: "22px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                              <strong style={{ color: "#38bdf8", fontSize: "0.95rem" }}>
                                📑 Internal Assessment {test.iaNumber} (IA-{test.iaNumber})
                              </strong>
                              <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
                                Total Scored: <strong style={{ color: "#f8fafc" }}>{test.totalMarks} / {test.maxMarks} M</strong> ({test.percentage}%)
                              </span>
                            </div>
                            <div className="ia-table-wrapper">
                              <table className="ia-split-table">
                                <thead>
                                  <tr>
                                    <th>Question</th>
                                    <th>Topic Name</th>
                                    <th>Module / CO</th>
                                    <th>Status</th>
                                    <th>Scored Marks</th>
                                    <th>Max Marks</th>
                                    <th>Mastery %</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {test.questions?.map((q, qidx) => (
                                    <tr key={qidx}>
                                      <td><span className="ia-qcode-badge">{q.code || `Q${q.questionNumber}`}</span></td>
                                      <td>{q.topicName || "Syllabus Question"}</td>
                                      <td>{q.moduleNumber ? `Module ${q.moduleNumber}` : "General"} {q.co ? `• ${q.co}` : ""}</td>
                                      <td>
                                        <span className={`ia-status-tag ${q.status === "ATTEMPTED" ? "attempted" : "skipped"}`}>
                                          {q.status === "ATTEMPTED" ? "✓ Attempted" : "Skipped via Choice"}
                                        </span>
                                      </td>
                                      <td><strong>{q.marksScored?.toFixed(1) || 0}</strong></td>
                                      <td>{q.maxMarks || 0}</td>
                                      <td>{q.percentage?.toFixed(0) || 0}%</td>
                                    </tr>
                                  ))}
                                  <tr className="ia-total-row">
                                    <td colSpan="4">Total Aggregate (IA-{test.iaNumber})</td>
                                    <td>{test.totalMarks?.toFixed(1) || 0}</td>
                                    <td>{test.maxMarks}</td>
                                    <td>{test.percentage?.toFixed(1) || 0}%</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p style={{ color: "#94a3b8", fontSize: "0.88rem", margin: 0, padding: "8px 0" }}>
                          Question-by-question offline IA marks have not yet been published by your course instructor.
                          Once verified and published, your full question split-up marks and scaled CIE marks will appear here.
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* SECTION A: ONLINE ATTENDED TESTS */}
          {resultsSection === "ONLINE_TESTS" && (
            <>
              {/* Filter Categories Bar */}
              <div className="filter-tabs-row">
                <div className="tabs-left">
                  <button
                    className={`category-tab-btn ${activeTab === "ALL" ? "active" : ""}`}
                    onClick={() => setActiveTab("ALL")}
                  >
                    📁 All Evaluations <span className="tab-count">{results.length}</span>
                  </button>
                  <button
                    className={`category-tab-btn ${activeTab === "THEORY" ? "active" : ""}`}
                    onClick={() => setActiveTab("THEORY")}
                  >
                    📄 Theory Exams <span className="tab-count">{onlineTheoryResults.length}</span>
                  </button>
                  <button
                    className={`category-tab-btn ${activeTab === "MCQ" ? "active" : ""}`}
                    onClick={() => setActiveTab("MCQ")}
                  >
                    🎯 Objective MCQ Quizzes <span className="tab-count">{onlineMcqResults.length}</span>
                  </button>
                  <button
                    className={`category-tab-btn ${activeTab === "OFFLINE" ? "active" : ""}`}
                    onClick={() => setActiveTab("OFFLINE")}
                  >
                    📝 Offline Written Tests <span className="tab-count">{offlineResults.length}</span>
                  </button>
                </div>

                <div className="export-dropdown-wrapper">
                  <button
                    className="export-csv-btn"
                    onClick={() => exportCategoryCsv(activeTab)}
                    title="Download CSV table of filtered results"
                  >
                    📊 Export {activeTab === "ALL" ? "All" : activeTab} Results (CSV)
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Main Content Area for Section A Online Results */}
      {resultsSection === "ONLINE_TESTS" && hubTab === "EVALUATED_RESULTS" && (
        loading ? (
        <div className="loading-state-card">
          <div className="spinner"></div>
          <p>Fetching evaluation records and scorecards...</p>
        </div>
      ) : !selectedResult ? (
        displayedResults.length === 0 ? (
          <div className="empty-results-card">
            <span className="empty-icon">📊</span>
            <h3>No Evaluation Records Found</h3>
            <p>
              {activeTab === "THEORY"
                ? "You have not submitted any Online Theory Exams yet."
                : activeTab === "MCQ"
                ? "You have not attended any Objective MCQ Quizzes yet."
                : activeTab === "OFFLINE"
                ? "No Offline Written Test evaluations recorded by faculty yet."
                : "Attend an examination or check back once faculty evaluates your submissions."}
            </p>
          </div>
        ) : (
          /* HORIZONTAL RESULTS ROW LIST (CLEAN, COMPACT, DENSE) */
          <div className="results-rows-container">
            {displayedResults.map((result) => {
              const isOffline = result.submissionMode === "OFFLINE_MANUAL";
              const isMcq = isMcqResult(result);
              const isEvaluated = result.evaluationCompleted !== false;

              const matchedPaper = papers.find(
                (p) =>
                  p.paperId?.toLowerCase() === result.paperId?.toLowerCase() ||
                  p.id === result.paperId
              );
              const displaySubject =
                result.subject && result.subject !== result.paperId
                  ? result.subject
                  : matchedPaper?.subject || result.subject || result.paperId;

              return (
                <div
                  className={`result-row-card ${isOffline ? "offline-row" : isMcq ? "mcq-row" : "theory-row"}`}
                  key={result.id || result.paperId}
                  onClick={() => setSelectedResult(result)}
                >
                  {/* Left Cell: Badges, Title, Evaluator Info */}
                  <div className="row-left-cell">
                    <div className="row-badge-cluster">
                      <span className="exam-code-pill">{result.paperId}</span>
                      <span className={`exam-mode-badge ${isOffline ? "offline-mode" : isMcq ? "mcq-mode" : "online-mode"}`}>
                        {isOffline ? "📝 Offline Written Test" : isMcq ? "🎯 Objective MCQ Quiz" : "🌐 Online Theory Exam"}
                      </span>
                      <span className={`eval-status-pill ${isEvaluated ? "done" : "pending"}`}>
                        {isEvaluated ? "✓ Evaluated" : "⏳ In Progress"}
                      </span>
                    </div>

                    <h3 className="paper-code-title">{displaySubject}</h3>
                    <div className="evaluator-subtext">
                      <span>{isOffline ? "📝 Recorded by: " : isMcq ? "🤖 Evaluated by: " : "👨‍🏫 Evaluated by: "}</span>
                      <strong>{result.evaluatedBy ? result.evaluatedBy : isMcq ? "AI Auto-Evaluator (MCQ)" : "Faculty Evaluator"}</strong>
                      {result.submittedAt && (
                        <span>
                          {" "}• {new Date(result.submittedAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Middle Cell: AI Predicted Score & Risk Chips */}
                  <div className="row-mid-cell">
                    <div className="row-meta-chips">
                      <div className="metric-chip">
                        <small>AI Predicted</small>
                        <strong>{result.predictedScore != null ? `${result.predictedScore}%` : "N/A"}</strong>
                      </div>
                      <div className="metric-chip">
                        <small>Academic Risk</small>
                        <strong className={`risk-text ${result.riskLevel ? result.riskLevel.toLowerCase() : "low"}`}>
                          {result.riskLevel || "LOW"}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Right Cell: Score Box & Action Buttons Group */}
                  <div className="row-right-actions">
                    <div className="row-score-box">
                      <span className="big-marks">
                        {result.totalMarks != null ? result.totalMarks : 0}
                        <small> / {result.maxMarks || getPaperMaxMarks(matchedPaper) || 0} M</small>
                      </span>
                      {(result.maxMarks || getPaperMaxMarks(matchedPaper) || 0) > 0 && (
                        <span className="pct-badge">
                          {Math.round(
                            ((result.totalMarks || 0) /
                              (result.maxMarks || getPaperMaxMarks(matchedPaper) || 1)) *
                              10000
                          ) / 100}
                          %
                        </span>
                      )}
                    </div>

                    <div className="row-btn-group">
                      <button
                        className="row-pdf-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          exportEvaluatedSubmissionPdf(
                            result,
                            {
                              name: localStorage.getItem("name"),
                              usn: localStorage.getItem("usn"),
                              department: localStorage.getItem("department"),
                            },
                            matchedPaper?.questions || []
                          );
                          toast.success(`Evaluated Answer Paper downloaded for ${result.paperId}!`);
                        }}
                        title="Download Evaluated Answer Paper PDF"
                      >
                        📄 Download Answer Paper
                      </button>

                      <button
                        className="view-scorecard-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedResult(result);
                        }}
                      >
                        👁 View Scorecard
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* DETAILED SCORECARD VIEW */
        <div className="detailed-result-card">
          <div className="detailed-top-actions">
            <button className="back-to-list-btn" onClick={() => setSelectedResult(null)}>
              ← Back To All Results
            </button>
            <button className="print-scorecard-btn" onClick={() => window.print()} title="Print via browser">
              🖨️ Print View
            </button>
          </div>

          <div className="detail-header-banner">
            <div className="header-left">
              <div className="scorecard-top-badges">
                <span className="paper-id-pill">Paper: {selectedResult.paperId}</span>
                <span className={`exam-mode-badge ${selectedResult.submissionMode === "OFFLINE_MANUAL" ? "offline-mode" : isMcqResult(selectedResult) ? "mcq-mode" : "online-mode"}`}>
                  {selectedResult.submissionMode === "OFFLINE_MANUAL" ? "📝 Offline Written Test" : isMcqResult(selectedResult) ? "🎯 Objective MCQ Quiz" : "🌐 Online Theory Exam"}
                </span>
              </div>
              <h2>{selectedResult.subject || selectedResult.paperId}</h2>
              <div className="evaluator-highlight-tag">
                <span>{selectedResult.submissionMode === "OFFLINE_MANUAL" ? "📝 Evaluated & Recorded By: " : isMcqResult(selectedResult) ? "🤖 Auto-Evaluated By: " : "👨‍🏫 Evaluated By: "}</span>
                <strong>{selectedResult.evaluatedBy ? selectedResult.evaluatedBy : isMcqResult(selectedResult) ? "AI Auto-Evaluator (MCQ)" : "Faculty Evaluator"}</strong>
                {selectedResult.submittedAt && (
                  <span className="eval-date-text">
                    {" "}• {new Date(selectedResult.submittedAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                )}
              </div>
            </div>

            <div className="header-right-score">
              <span className="big-score">
                {selectedResult.totalMarks != null ? selectedResult.totalMarks : 0}
                <small> / {selectedResult.maxMarks || getPaperMaxMarks(currentPaper) || 0} M</small>
              </span>
              <span className="percentage-tag">
                {(selectedResult.maxMarks || getPaperMaxMarks(currentPaper) || 0) > 0
                  ? `${
                      Math.round(
                        ((selectedResult.totalMarks || 0) /
                          (selectedResult.maxMarks || getPaperMaxMarks(currentPaper) || 1)) *
                          10000
                      ) / 100
                    }%`
                  : "0%"}
              </span>
            </div>
          </div>

          <div className="prediction-metrics-row">
            <div className="metric-box">
              <small>AI Predicted Score</small>
              <strong>{selectedResult.predictedScore != null ? `${selectedResult.predictedScore}%` : "N/A"}</strong>
            </div>

            <div className="metric-box">
              <small>Academic Risk Level</small>
              <strong className={`risk-text ${selectedResult.riskLevel ? selectedResult.riskLevel.toLowerCase() : "low"}`}>
                {selectedResult.riskLevel || "LOW"}
              </strong>
            </div>

            <div className="metric-box">
              <small>Evaluation Status</small>
              <strong className={selectedResult.evaluationCompleted ? "status-done" : "status-pending"}>
                {selectedResult.evaluationCompleted ? "✓ Evaluation Completed" : "⏳ In Progress"}
              </strong>
            </div>
          </div>

          <div className="answers-section">
            <h3 className="section-title">
              {selectedResult.submissionMode === "OFFLINE_MANUAL"
                ? "Question-wise Marks & Faculty Remarks"
                : isMcqResult(selectedResult)
                ? "MCQ Question Breakdown & Answer Analysis"
                : "Question-wise Scores & Teacher Feedback"}
            </h3>

            {groupedModules.length > 0 ? (
              groupedModules.map(([modKey, modQuestions], mIdx) => {
                const isSingleSection = groupedModules.length === 1 && modKey === "ALL";
                const modTitle = isSingleSection
                  ? null
                  : typeof modKey === "number"
                  ? `MODULE — ${modKey}`
                  : isNaN(Number(modKey)) && modKey !== "ALL"
                  ? `MODULE — ${mIdx + 1}`
                  : `MODULE — ${modKey}`;

                let previousParent = null;

                return (
                  <div className="eval-module-block" key={modKey}>
                    {modTitle && (
                      <div className="eval-module-heading">
                        <span>📑 {modTitle}</span>
                      </div>
                    )}

                    {modQuestions.map((answer, i) => {
                      const isMcqQ = answer.questionType === "MCQ" || isMcqResult(selectedResult);
                      const isCorrect = answer.isCorrect === true || (answer.marksObtained != null && answer.marksObtained > 0 && isMcqQ);

                      const currParent = answer._info?.parent;
                      const isNewParent = previousParent !== null && currParent !== previousParent;
                      const isOrDividerNeeded =
                        !isMcqQ &&
                        isNewParent &&
                        (answer.optionalQuestion === true ||
                          Boolean(answer.optionalWith) ||
                          answer.isOr === true);

                      previousParent = currParent;

                      return (
                        <div key={answer.questionId || i}>
                          {isOrDividerNeeded && (
                            <div className="eval-or-divider-banner">
                              <span>— — — — — OR (Choose Either Alternative Question) — — — — —</span>
                            </div>
                          )}

                          <div className={`student-answer-card ${!answer.attempted && selectedResult.submissionMode !== "OFFLINE_MANUAL" ? "not-attempted-card" : ""} ${isMcqQ ? (isCorrect ? "mcq-correct-card" : "mcq-incorrect-card") : ""}`}>
                            <div className="answer-top-row">
                              <div className="q-badge-group">
                                <span className="q-id-badge">{answer.questionId}</span>
                                {isMcqQ && (
                                  <span className={`mcq-status-badge ${isCorrect ? "correct" : "incorrect"}`}>
                                    {isCorrect ? "✓ Correct" : "✗ Incorrect"}
                                  </span>
                                )}
                                {answer.optionalQuestion && (
                                  <span className="optional-tag-badge">Optional Choice</span>
                                )}
                                {answer.topic && <span className="topic-badge">{answer.topic}</span>}
                              </div>
                              <span className="marks-award-pill">
                                Marks: <strong>{answer.marksObtained != null ? answer.marksObtained : 0}</strong> / {answer.maxMarks || 5} M
                              </span>
                            </div>

                            {answer.questionText && (
                              <div className="question-prompt-box">
                                <strong>Question:</strong> {answer.questionText}
                              </div>
                            )}

                            <div className="submitted-answer-box">
                              <label>
                                {selectedResult.submissionMode === "OFFLINE_MANUAL"
                                  ? "Exam Format:"
                                  : "Your Submitted Response:"}
                              </label>
                              <p className={isMcqQ ? "mcq-submitted-answer" : ""}>
                                {selectedResult.submissionMode === "OFFLINE_MANUAL" ? (
                                  "Physical Classroom Written Exam (Evaluated by Faculty)"
                                ) : answer.attempted && answer.answer ? (
                                  answer.answer
                                ) : !answer.attempted ? (
                                  <em className="no-text">Alternative Question — Not Selected / Optional</em>
                                ) : (
                                  <em className="no-text">No answer submitted</em>
                                )}
                              </p>
                            </div>

                            <div className={`feedback-display-box ${isMcqQ ? (isCorrect ? "feedback-correct" : "feedback-incorrect") : ""}`}>
                              <label>{isMcqQ ? "🎯 Evaluation Analysis:" : "👨‍🏫 Teacher Remarks & Feedback:"}</label>
                              <p>
                                {answer.feedback ? (
                                  answer.feedback
                                ) : selectedResult.submissionMode === "OFFLINE_MANUAL" ? (
                                  "Offline Written Exam Evaluation"
                                ) : answer.attempted ? (
                                  <em className="no-feedback-text">Good attempt. No specific remarks added.</em>
                                ) : (
                                  <em className="no-feedback-text">Candidate chose alternative question in this module.</em>
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            ) : (
              <p className="no-questions-msg">No question breakdown available for this paper.</p>
            )}
          </div>
        </div>
      )
    )}
    </div>
  );
}

export default MyResults;