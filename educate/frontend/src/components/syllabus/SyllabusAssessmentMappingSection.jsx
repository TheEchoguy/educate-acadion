import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import {
  getAssessmentMappings,
  confirmSuggestedMapping,
  createAssessmentMapping,
  deleteAssessmentMapping,
  analyzeTopicAssessment,
} from "../../services/syllabusService";
import { getAllPapers } from "../../services/paperService";

export default function SyllabusAssessmentMappingSection({ classroomId, items = [] }) {
  const [mappings, setMappings] = useState([]);
  const [loadingMappings, setLoadingMappings] = useState(true);

  // Target selection
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const activeTopicId = selectedTopicId || (items.length > 0 ? items[0].id : "");

  // Analysis mode: "paper" | "manual"
  const [analysisMode, setAnalysisMode] = useState("paper");
  const [papers, setPapers] = useState([]);
  const [selectedPaperId, setSelectedPaperId] = useState("");
  const [selectedQuestionId, setSelectedQuestionId] = useState("");
  const [manualText, setManualText] = useState("");

  // Analysis engine state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [activeAnalysisTab, setActiveAnalysisTab] = useState("both"); // "both" | "missingInPaper" | "outsideTopic"

  // Manual fast-map state
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState({
    syllabusTopicId: "",
    paperId: "",
    questionId: "",
    matchedTopicLabel: "",
  });
  const [submittingManual, setSubmittingManual] = useState(false);

  const loadAllMappings = async () => {
    try {
      setLoadingMappings(true);
      const data = await getAssessmentMappings(classroomId);
      setMappings(data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load assessment mappings");
    } finally {
      setLoadingMappings(false);
    }
  };

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      getAssessmentMappings(classroomId),
      getAllPapers(),
    ]).then(([mappingsRes, papersRes]) => {
      if (!active) return;
      if (mappingsRes.status === "fulfilled") {
        setMappings(mappingsRes.value || []);
      }
      if (papersRes.status === "fulfilled") {
        const pList = papersRes.value || [];
        setPapers(pList);
        if (pList.length > 0 && !selectedPaperId) {
          setSelectedPaperId(pList[0].paperId || pList[0].id);
        }
      }
      setLoadingMappings(false);
    }).catch((err) => {
      console.error(err);
      if (active) setLoadingMappings(false);
    });

    return () => {
      active = false;
    };
  }, [classroomId]);

  // Run Semantic Topic-Question Analysis
  const handleRunAnalysis = async () => {
    if (!activeTopicId) {
      toast.error("Please select a syllabus topic to evaluate");
      return;
    }
    if (analysisMode === "paper" && !selectedPaperId) {
      toast.error("Please choose an assessment paper to compare");
      return;
    }
    if (analysisMode === "manual" && !manualText.trim()) {
      toast.error("Please enter question or assessment content to analyze");
      return;
    }

    try {
      setIsAnalyzing(true);
      setAnalysisResult(null);

      const payload = {
        topicId: activeTopicId,
        paperId: analysisMode === "paper" ? selectedPaperId : undefined,
        questionId: analysisMode === "paper" && selectedQuestionId ? selectedQuestionId : undefined,
        manualText: analysisMode === "manual" ? manualText.trim() : undefined,
      };

      const result = await analyzeTopicAssessment(classroomId, payload);
      setAnalysisResult(result);
      toast.success("Semantic alignment analysis complete!");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || "Failed to analyze topic alignment");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirmConceptMatch = async (match) => {
    try {
      await confirmSuggestedMapping(classroomId, {
        syllabusTopicId: activeTopicId,
        paperId: analysisResult?.paperId || selectedPaperId || "MANUAL_INPUT",
        questionId: match.questionIdentifier || match.questionId || null,
        matchedTopicLabel: match.conceptName || match.concept,
      });
      toast.success(`Confirmed mapping for "${match.conceptName || match.concept}"!`);
      loadAllMappings();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to confirm mapping");
    }
  };

  const handleDeleteMapping = async (mappingId) => {
    if (!window.confirm("Remove this assessment mapping?")) return;
    try {
      await deleteAssessmentMapping(classroomId, mappingId);
      toast.success("Mapping removed.");
      loadAllMappings();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to remove mapping");
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualForm.syllabusTopicId || !manualForm.paperId) {
      toast.error("Please select a topic and an examination paper");
      return;
    }
    try {
      setSubmittingManual(true);
      await createAssessmentMapping(classroomId, {
        syllabusTopicId: manualForm.syllabusTopicId,
        paperId: manualForm.paperId,
        questionId: manualForm.questionId.trim() || null,
        matchedTopicLabel: manualForm.matchedTopicLabel.trim() || null,
      });
      toast.success("Manual mapping established!");
      setShowManualForm(false);
      setManualForm({ syllabusTopicId: "", paperId: "", questionId: "", matchedTopicLabel: "" });
      loadAllMappings();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to create mapping");
    } finally {
      setSubmittingManual(false);
    }
  };

  const activeTopicObj = items.find((it) => it.id === activeTopicId);
  const activePaperObj = papers.find((p) => (p.paperId || p.id) === selectedPaperId);
  const availableQuestions = activePaperObj?.questions || [];

  const matchedList = analysisResult?.coveredConcepts || analysisResult?.matchedConcepts || [];
  const missingInPaperList = analysisResult?.missingSyllabusConcepts || [];
  const outsideTopicList = analysisResult?.unmatchedQuestionConcepts || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* HEADER CARD */}
      <div className="tsm-card">
        <div className="tsm-card-header">
          <div>
            <h3 className="tsm-card-title">🎯 Explainable Assessment Mapping Engine</h3>
            <div className="tsm-card-subtitle">
              Deep semantic evaluation comparing verified syllabus topics against question papers or custom test items
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              className="tsm-btn-secondary"
              onClick={() => setShowManualForm(!showManualForm)}
            >
              {showManualForm ? "Hide Quick Map" : "➕ Manual Direct Map"}
            </button>
          </div>
        </div>

        {/* WORKBENCH CONTROLS */}
        <div style={{ background: "rgba(15, 23, 42, 0.6)", borderRadius: 12, padding: "18px", marginTop: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: "0.82rem", color: "#cbd5e1", marginBottom: 6, fontWeight: 600 }}>
                1. Select Syllabus Topic / Unit:
              </label>
              <select
                className="tsm-form-select"
                style={{ width: "100%" }}
                value={activeTopicId}
                onChange={(e) => {
                  setSelectedTopicId(e.target.value);
                  setAnalysisResult(null);
                }}
                disabled={items.length === 0}
              >
                {items.length === 0 && <option value="">No syllabus topics available</option>}
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.unit ? `[${it.unit}] ` : ""}{it.topic}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.82rem", color: "#cbd5e1", marginBottom: 6, fontWeight: 600 }}>
                2. Evaluation Source:
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className={`tsm-subtab-btn ${analysisMode === "paper" ? "active" : ""}`}
                  style={{ flex: 1, padding: "8px 12px", fontSize: "0.82rem" }}
                  onClick={() => setAnalysisMode("paper")}
                >
                  📄 Existing Question Paper
                </button>
                <button
                  type="button"
                  className={`tsm-subtab-btn ${analysisMode === "manual" ? "active" : ""}`}
                  style={{ flex: 1, padding: "8px 12px", fontSize: "0.82rem" }}
                  onClick={() => setAnalysisMode("manual")}
                >
                  ✍️ Manual Text / Sample
                </button>
              </div>
            </div>
          </div>

          {analysisMode === "paper" ? (
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, marginBottom: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.78rem", color: "#94a3b8", marginBottom: 4 }}>
                  Select Assessment Paper:
                </label>
                <select
                  className="tsm-form-select"
                  style={{ width: "100%" }}
                  value={selectedPaperId}
                  onChange={(e) => {
                    setSelectedPaperId(e.target.value);
                    setSelectedQuestionId("");
                    setAnalysisResult(null);
                  }}
                >
                  {papers.map((p) => (
                    <option key={p.id} value={p.paperId || p.id}>
                      {p.examName || p.title || p.subject || `Paper #${p.paperId || p.id}`} ({p.questions?.length || 0} questions)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", color: "#94a3b8", marginBottom: 4 }}>
                  Specific Question (Optional):
                </label>
                <select
                  className="tsm-form-select"
                  style={{ width: "100%" }}
                  value={selectedQuestionId}
                  onChange={(e) => setSelectedQuestionId(e.target.value)}
                >
                  <option value="">Evaluate Entire Paper</option>
                  {availableQuestions.map((q) => (
                    <option key={q.questionId} value={q.questionId}>
                      Question {q.questionId} {q.topic ? `(${q.topic})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: "0.78rem", color: "#94a3b8", marginBottom: 4 }}>
                Paste Question or Assessment Text to Analyze Against Syllabus:
              </label>
              <textarea
                className="search-input"
                style={{ width: "100%", height: 80, resize: "vertical" }}
                placeholder="e.g. Q1. Explain the architectural building blocks of IoT. Discuss sensing, actuation, and cloud protocol interfaces."
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
              />
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
              💡 All mappings remain unconfirmed suggestions until you explicitly approve them.
            </span>
            <button
              type="button"
              className="tsm-btn-primary"
              disabled={isAnalyzing || !activeTopicId}
              onClick={handleRunAnalysis}
            >
              {isAnalyzing ? "Analyzing Semantic Alignment..." : "⚡ Analyze Topic Alignment"}
            </button>
          </div>
        </div>

        {/* QUICK MANUAL DIRECT MAP DRAWER */}
        {showManualForm && (
          <div style={{ marginTop: 16, background: "rgba(30, 27, 46, 0.9)", border: "1px solid rgba(168, 85, 247, 0.3)", borderRadius: 12, padding: "16px" }}>
            <h4 style={{ margin: "0 0 12px 0", color: "#d8b4fe", fontSize: "0.95rem" }}>Direct Manual Topic–Assessment Connection</h4>
            <form onSubmit={handleManualSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label className="tsm-form-label">Syllabus Topic *</label>
                  <select
                    className="tsm-form-select"
                    value={manualForm.syllabusTopicId}
                    onChange={(e) => setManualForm({ ...manualForm, syllabusTopicId: e.target.value })}
                  >
                    <option value="">-- Choose Topic --</option>
                    {items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.unit ? `[${it.unit}] ` : ""}{it.topic}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="tsm-form-label">Question Paper *</label>
                  <select
                    className="tsm-form-select"
                    value={manualForm.paperId}
                    onChange={(e) => setManualForm({ ...manualForm, paperId: e.target.value })}
                  >
                    <option value="">-- Choose Paper --</option>
                    {papers.map((p) => (
                      <option key={p.id} value={p.paperId || p.id}>
                        {p.examName || p.subject || `Paper #${p.paperId || p.id}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="tsm-form-label">Question Number (Optional)</label>
                  <input
                    type="text"
                    className="tsm-form-input"
                    placeholder="e.g. Q1(a)"
                    value={manualForm.questionId}
                    onChange={(e) => setManualForm({ ...manualForm, questionId: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="submit" className="tsm-btn-primary" disabled={submittingManual}>
                  {submittingManual ? "Saving..." : "Save Direct Mapping"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* ANALYSIS RESULTS SECTION */}
      {analysisResult && (
        <div className="tsm-card" style={{ border: "1px solid rgba(168, 85, 247, 0.4)" }}>
          {/* ANALYSIS SUMMARY BAR */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
            <div>
              <span className="tsm-badge tsm-badge-in-progress" style={{ marginBottom: 4, display: "inline-block" }}>
                Semantic Assessment Report
              </span>
              <h4 style={{ margin: "2px 0", color: "#ffffff", fontSize: "1.1rem" }}>
                {analysisResult.analysisScope || `Topic Evaluation: ${activeTopicObj?.topic}`}
              </h4>
              <p style={{ margin: 0, fontSize: "0.78rem", color: "#94a3b8" }}>
                Evaluated {analysisResult.totalSyllabusConceptsEvaluated || 0} syllabus concept(s) across {analysisResult.totalQuestionConceptsEvaluated || 0} assessment question(s).
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>Curriculum Alignment</div>
                <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#34d399" }}>
                  {analysisResult.alignmentPercentage != null ? `${analysisResult.alignmentPercentage}%` : "N/A"}
                </div>
              </div>
            </div>
          </div>

          {/* THREE-WAY BREAKDOWN NAVIGATION TABS */}
          <div style={{ display: "flex", gap: 10, borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: 12, marginBottom: 16 }}>
            <button
              type="button"
              className={`tsm-subtab-btn ${activeAnalysisTab === "both" ? "active" : ""}`}
              style={{
                borderColor: activeAnalysisTab === "both" ? "#34d399" : undefined,
                color: activeAnalysisTab === "both" ? "#34d399" : undefined,
              }}
              onClick={() => setActiveAnalysisTab("both")}
            >
              ✅ Concepts Found in Both ({matchedList.length})
            </button>
            <button
              type="button"
              className={`tsm-subtab-btn ${activeAnalysisTab === "missingInPaper" ? "active" : ""}`}
              style={{
                borderColor: activeAnalysisTab === "missingInPaper" ? "#fbbf24" : undefined,
                color: activeAnalysisTab === "missingInPaper" ? "#fbbf24" : undefined,
              }}
              onClick={() => setActiveAnalysisTab("missingInPaper")}
            >
              ⚠️ Syllabus Concepts Missing in Paper ({missingInPaperList.length})
            </button>
            <button
              type="button"
              className={`tsm-subtab-btn ${activeAnalysisTab === "outsideTopic" ? "active" : ""}`}
              style={{
                borderColor: activeAnalysisTab === "outsideTopic" ? "#f87171" : undefined,
                color: activeAnalysisTab === "outsideTopic" ? "#f87171" : undefined,
              }}
              onClick={() => setActiveAnalysisTab("outsideTopic")}
            >
              🔍 Question Content Outside Selected Topic ({outsideTopicList.length})
            </button>
          </div>

          {/* TAB CONTENT A: CONCEPTS FOUND IN BOTH */}
          {activeAnalysisTab === "both" && (
            <div>
              {matchedList.length === 0 ? (
                <div className="tsm-empty-state" style={{ padding: "24px 0" }}>
                  <p>No direct concept overlap detected between this topic and the chosen assessment material.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {matchedList.map((m, mIdx) => (
                    <div
                      key={mIdx}
                      style={{
                        background: "rgba(16, 185, 129, 0.08)",
                        border: "1px solid rgba(16, 185, 129, 0.25)",
                        borderRadius: 12,
                        padding: "14px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 16,
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, color: "#ffffff", fontSize: "0.92rem" }}>
                            {m.conceptName || m.concept}
                          </span>
                          <span
                            style={{
                              fontSize: "0.72rem",
                              padding: "2px 8px",
                              borderRadius: 4,
                              fontWeight: 700,
                              background: m.matchType === "STRONG" ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)",
                              color: m.matchType === "STRONG" ? "#34d399" : "#fbbf24",
                            }}
                          >
                            {m.matchType || "MATCHED"} ({Math.round((m.confidenceScore || 0.85) * 100)}% Confidence)
                          </span>
                          {m.questionIdentifier && (
                            <span style={{ fontSize: "0.75rem", color: "#38bdf8" }}>
                              Question: {m.questionIdentifier}
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: "0.8rem", color: "#cbd5e1", marginTop: 4 }}>
                          <strong style={{ color: "#94a3b8" }}>Syllabus Excerpt:</strong> {m.syllabusExcerpt || m.syllabusSnippet}
                        </div>

                        {m.questionExcerpt && (
                          <div style={{ fontSize: "0.8rem", color: "#cbd5e1" }}>
                            <strong style={{ color: "#94a3b8" }}>Question Excerpt:</strong> &ldquo;{m.questionExcerpt}&rdquo;
                          </div>
                        )}

                        <div style={{ fontSize: "0.76rem", color: "#86efac", marginTop: 2 }}>
                          {m.explanation}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="tsm-btn-primary"
                        style={{ padding: "6px 12px", fontSize: "0.78rem", whiteSpace: "nowrap" }}
                        onClick={() => handleConfirmConceptMatch(m)}
                      >
                        ✓ Confirm Mapping
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB CONTENT B: SYLLABUS CONCEPTS MISSING IN PAPER */}
          {activeAnalysisTab === "missingInPaper" && (
            <div>
              <div
                style={{
                  background: "rgba(245, 158, 11, 0.1)",
                  border: "1px solid rgba(245, 158, 11, 0.25)",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontSize: "0.78rem",
                  color: "#fbbf24",
                  marginBottom: 14,
                }}
              >
                ℹ️ <strong>Pedagogical Context:</strong> Content not found in this specific paper is not evidence of absence from other tests or the broader curriculum. Use this list to design future quizzes or internal review tests.
              </div>

              {missingInPaperList.length === 0 ? (
                <div className="tsm-empty-state" style={{ padding: "20px 0" }}>
                  <p>All identified syllabus concepts for this topic appear to be covered by the assessment material!</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {missingInPaperList.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: "rgba(255, 255, 255, 0.03)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: 10,
                        padding: "12px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, color: "#f87171", fontSize: "0.88rem" }}>
                          {item.conceptName || item.concept}
                        </span>
                        <span style={{ fontSize: "0.7rem", color: "#94a3b8", background: "rgba(255,255,255,0.06)", padding: "1px 6px", borderRadius: 4 }}>
                          {item.confidenceBand || item.confidenceLevel || "HIGH"} CONFIDENCE ABSENCE
                        </span>
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "#cbd5e1", marginBottom: 4 }}>
                        {item.syllabusExcerpt}
                      </div>
                      <div style={{ fontSize: "0.74rem", color: "#fbbf24" }}>
                        💡 Suggested Action: {item.suggestedAction || item.suggestedFollowUp || "Consider formulating an assessment question for this concept."}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB CONTENT C: QUESTION CONTENT OUTSIDE SELECTED TOPIC */}
          {activeAnalysisTab === "outsideTopic" && (
            <div>
              <div
                style={{
                  background: "rgba(59, 130, 246, 0.1)",
                  border: "1px solid rgba(59, 130, 246, 0.25)",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontSize: "0.78rem",
                  color: "#93c5fd",
                  marginBottom: 14,
                }}
              >
                ℹ️ <strong>Scope Note:</strong> Questions outside this specific topic often belong to other syllabus modules or units within the curriculum.
              </div>

              {outsideTopicList.length === 0 ? (
                <div className="tsm-empty-state" style={{ padding: "20px 0" }}>
                  <p>All questions evaluated in this material correspond directly to the selected topic.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {outsideTopicList.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: "rgba(255, 255, 255, 0.03)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: 10,
                        padding: "12px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, color: "#38bdf8", fontSize: "0.85rem" }}>
                          Question {item.questionIdentifier || item.questionId}
                        </span>
                        <span style={{ fontSize: "0.72rem", color: "#c084fc", background: "rgba(192, 132, 252, 0.15)", padding: "1px 6px", borderRadius: 4 }}>
                          Concept: {item.detectedConcept}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "#cbd5e1", marginBottom: 6 }}>
                        &ldquo;{item.questionText}&rdquo;
                      </div>
                      <div style={{ fontSize: "0.76rem", color: "#a78bfa" }}>
                        🔄 Possible Syllabus Mapping: <strong>{item.possibleAlternativeTopic || item.potentialModuleMapping || "Other Module"}</strong>
                      </div>
                      <div style={{ fontSize: "0.74rem", color: "#94a3b8", marginTop: 2 }}>
                        Action: {item.teacherReviewAction || "Review whether this question belongs to another module."}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* CONFIRMED MAPPINGS SECTION */}
      <div className="tsm-card">
        <div className="tsm-card-header">
          <div>
            <h3 className="tsm-card-title">🔗 Confirmed Assessment Mappings ({mappings.length})</h3>
            <div className="tsm-card-subtitle">
              Verified teacher-confirmed connections linking exam questions to syllabus curriculum units
            </div>
          </div>
        </div>

        {loadingMappings ? (
          <div className="tsm-loading-container">
            <div className="tsm-spinner"></div>
            <p>Loading confirmed mappings...</p>
          </div>
        ) : mappings.length === 0 ? (
          <div className="tsm-empty-state">
            <div className="tsm-empty-icon">📭</div>
            <p>No assessment mappings confirmed yet.</p>
            <span style={{ fontSize: "0.78rem" }}>
              Run the semantic analysis above and click &quot;Confirm Mapping&quot; on matching concepts.
            </span>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
            {mappings.map((m) => {
              const topicObj = items.find((it) => it.id === m.syllabusTopicId);
              const topicName = topicObj ? topicObj.topic : `Topic ${m.syllabusTopicId}`;

              return (
                <div
                  key={m.id}
                  style={{
                    background: "rgba(15, 23, 42, 0.65)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: 12,
                    padding: "14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600, color: "#f8fafc", fontSize: "0.88rem" }}>
                        {topicName}
                      </span>
                      <span className="tsm-badge tsm-badge-completed">Confirmed</span>
                    </div>

                    <div style={{ fontSize: "0.78rem", color: "#38bdf8" }}>
                      📄 {m.assessmentTitle || `Paper #${m.paperId}`}
                      {m.questionId && (
                        <span style={{ color: "#d8b4fe", marginLeft: 6 }}>
                          (Q: {m.questionId})
                        </span>
                      )}
                    </div>

                    {m.matchedTopicLabel && (
                      <div style={{ fontSize: "0.74rem", color: "#94a3b8" }}>
                        Concept: &ldquo;{m.matchedTopicLabel}&rdquo;
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    className="tsm-action-icon-btn delete"
                    title="Remove Mapping"
                    onClick={() => handleDeleteMapping(m.id)}
                  >
                    🗑️
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
