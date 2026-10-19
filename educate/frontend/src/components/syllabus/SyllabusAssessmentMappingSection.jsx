import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import {
  getAssessmentMappings,
  getMappingSuggestions,
  confirmSuggestedMapping,
  createAssessmentMapping,
  deleteAssessmentMapping,
} from "../../services/syllabusService";
import { getAllPapers } from "../../services/paperService";

export default function SyllabusAssessmentMappingSection({ classroomId, items = [] }) {
  const [mappings, setMappings] = useState([]);
  const [loadingMappings, setLoadingMappings] = useState(true);

  // Suggestions state
  const [userSelectedTopicId, setUserSelectedTopicId] = useState("");
  const activeTopicId = userSelectedTopicId || (items.length > 0 ? items[0].id : "");

  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Manual mapping state
  const [papers, setPapers] = useState([]);
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

  const loadSuggestionsForTopic = async (topicId) => {
    if (!topicId) {
      setSuggestions([]);
      return;
    }
    try {
      setLoadingSuggestions(true);
      const data = await getMappingSuggestions(classroomId, topicId);
      setSuggestions(data || []);
    } catch (err) {
      console.error(err);
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
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
        setPapers(papersRes.value || []);
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

  useEffect(() => {
    let active = true;
    if (!classroomId || !activeTopicId) {
      return () => {
        active = false;
      };
    }

    getMappingSuggestions(classroomId, activeTopicId)
      .then((data) => {
        if (active) {
          setSuggestions(data || []);
          setLoadingSuggestions(false);
        }
      })
      .catch(() => {
        if (active) {
          setSuggestions([]);
          setLoadingSuggestions(false);
        }
      });

    return () => {
      active = false;
    };
  }, [classroomId, activeTopicId]);

  const handleConfirmSuggestion = async (sugg) => {
    try {
      await confirmSuggestedMapping(classroomId, {
        syllabusTopicId: activeTopicId,
        paperId: sugg.paperId,
        questionId: sugg.questionId || null,
        matchedTopicLabel: sugg.matchedTopicLabel || null,
      });
      toast.success("Assessment mapping confirmed!");
      loadAllMappings();
      loadSuggestionsForTopic(activeTopicId);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to confirm suggestion");
    }
  };

  const handleDeleteMapping = async (mappingId) => {
    if (!window.confirm("Remove this assessment mapping?")) return;
    try {
      await deleteAssessmentMapping(classroomId, mappingId);
      toast.success("Mapping removed.");
      loadAllMappings();
      if (activeTopicId) loadSuggestionsForTopic(activeTopicId);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to remove mapping");
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualForm.syllabusTopicId) {
      toast.error("Please select a syllabus topic");
      return;
    }
    if (!manualForm.paperId) {
      toast.error("Please select an assessment paper");
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
      toast.success("Manual assessment mapping created!");
      setManualForm({
        syllabusTopicId: "",
        paperId: "",
        questionId: "",
        matchedTopicLabel: "",
      });
      loadAllMappings();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to create mapping");
    } finally {
      setSubmittingManual(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* INTRO EXPLANATION */}
      <div
        style={{
          background: "rgba(30, 27, 46, 0.6)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 14,
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span style={{ fontSize: "1.8rem" }}>🎯</span>
        <div>
          <div style={{ fontWeight: 700, color: "#f8fafc", fontSize: "0.95rem" }}>
            Curriculum Assessment Alignment
          </div>
          <div style={{ fontSize: "0.82rem", color: "#94a3b8", marginTop: 2 }}>
            Link examination question papers and specific question numbers directly to syllabus topics.
            Automated suggestions analyze topic keywords, and only confirmed mappings are used for performance analytics.
          </div>
        </div>
      </div>

      <div className="tsm-mappings-layout">
        {/* LEFT COLUMN: CONFIRMED MAPPINGS LIST */}
        <div className="tsm-card">
          <div className="tsm-card-header">
            <div>
              <h3 className="tsm-card-title">🔗 Confirmed Mappings ({mappings.length})</h3>
              <div className="tsm-card-subtitle">
                Active connections between syllabus topics and exams
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
              <p>No assessment mappings established yet.</p>
              <span style={{ fontSize: "0.78rem" }}>
                Use suggestions on the right or the manual form below to map exam papers.
              </span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 600, color: "#f8fafc", fontSize: "0.9rem" }}>
                          {topicName}
                        </span>
                        <span className="tsm-badge tsm-badge-completed">Confirmed</span>
                        <span className="tsm-badge tsm-badge-unscheduled">
                          {m.mappingSource || "MANUAL"}
                        </span>
                      </div>

                      <div style={{ fontSize: "0.8rem", color: "#38bdf8" }}>
                        📄 {m.assessmentTitle || `Paper #${m.paperId}`}
                        {m.questionId && (
                          <span style={{ color: "#d8b4fe", marginLeft: 8 }}>
                            (Question {m.questionId})
                          </span>
                        )}
                      </div>

                      {m.matchedTopicLabel && (
                        <div style={{ fontSize: "0.74rem", color: "#94a3b8" }}>
                          Matched concept: &ldquo;{m.matchedTopicLabel}&rdquo;
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

        {/* RIGHT COLUMN: AI / KEYWORD SUGGESTIONS */}
        <div className="tsm-card">
          <div className="tsm-card-header">
            <div>
              <h3 className="tsm-card-title">💡 Topic Mapping Suggestions</h3>
              <div className="tsm-card-subtitle">
                Automated recommendations based on topic title and keyword matching
              </div>
            </div>
          </div>

          {/* Topic Selector for suggestions */}
          <div className="tsm-form-group" style={{ marginBottom: 16 }}>
            <label className="tsm-form-label">Inspect Suggestions for Topic:</label>
            <select
              className="tsm-form-select"
              value={activeTopicId}
              onChange={(e) => setUserSelectedTopicId(e.target.value)}
              disabled={items.length === 0}
            >
              {items.length === 0 && <option value="">No topics available</option>}
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.unit ? `[${it.unit}] ` : ""}{it.topic}
                </option>
              ))}
            </select>
          </div>

          {loadingSuggestions ? (
            <div className="tsm-loading-container" style={{ padding: "30px 0" }}>
              <div className="tsm-spinner"></div>
              <p>Checking assessment papers for topic matches...</p>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="tsm-empty-state" style={{ padding: "30px 0" }}>
              <p>No automatic suggestions found for this topic.</p>
              <span style={{ fontSize: "0.78rem" }}>
                You can create a manual mapping below using available examination papers.
              </span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {suggestions.map((sugg, idx) => (
                <div key={idx} className="tsm-suggestion-card">
                  <div className="tsm-suggestion-header">
                    <span style={{ fontWeight: 600, color: "#f8fafc", fontSize: "0.88rem" }}>
                      📄 {sugg.assessmentTitle || `Paper #${sugg.paperId}`}
                    </span>
                    {sugg.confirmed ? (
                      <span className="tsm-badge tsm-badge-completed">Already Mapped</span>
                    ) : (
                      <button
                        type="button"
                        className="tsm-btn-primary"
                        style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                        onClick={() => handleConfirmSuggestion(sugg)}
                      >
                        ✓ Confirm Mapping
                      </button>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 10, fontSize: "0.76rem", color: "#94a3b8" }}>
                    {sugg.subjectCode && <span>Code: {sugg.subjectCode}</span>}
                    {sugg.questionId && <span>Question: {sugg.questionId}</span>}
                    {sugg.matchedTopicLabel && <span>Tag: {sugg.matchedTopicLabel}</span>}
                  </div>

                  {sugg.confidenceReason && (
                    <div className="tsm-suggestion-reason">
                      <strong>Rationale:</strong> {sugg.confidenceReason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MANUAL MAPPING CREATOR PANEL */}
      <div className="tsm-card">
        <h3 className="tsm-card-title" style={{ marginBottom: 14 }}>
          ➕ Create Manual Assessment Mapping
        </h3>
        <form onSubmit={handleManualSubmit}>
          <div className="tsm-form-row">
            <div className="tsm-form-group">
              <label className="tsm-form-label">Syllabus Topic *</label>
              <select
                className="tsm-form-select"
                value={manualForm.syllabusTopicId}
                onChange={(e) => setManualForm({ ...manualForm, syllabusTopicId: e.target.value })}
              >
                <option value="">-- Choose Syllabus Topic --</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.unit ? `[${it.unit}] ` : ""}{it.topic}
                  </option>
                ))}
              </select>
            </div>

            <div className="tsm-form-group">
              <label className="tsm-form-label">Assessment Paper *</label>
              <select
                className="tsm-form-select"
                value={manualForm.paperId}
                onChange={(e) => setManualForm({ ...manualForm, paperId: e.target.value })}
              >
                <option value="">-- Choose Examination Paper --</option>
                {papers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title || p.name || p.subject || `Paper #${p.id}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="tsm-form-row" style={{ marginTop: 12 }}>
            <div className="tsm-form-group">
              <label className="tsm-form-label">Question Identifier / Number (Optional)</label>
              <input
                type="text"
                className="tsm-form-input"
                placeholder="e.g. Q3b or Module 2 Question 1"
                value={manualForm.questionId}
                onChange={(e) => setManualForm({ ...manualForm, questionId: e.target.value })}
              />
            </div>

            <div className="tsm-form-group">
              <label className="tsm-form-label">Matched Topic / Concept Tag (Optional)</label>
              <input
                type="text"
                className="tsm-form-input"
                placeholder="e.g. AVL Rotation Algorithms"
                value={manualForm.matchedTopicLabel}
                onChange={(e) => setManualForm({ ...manualForm, matchedTopicLabel: e.target.value })}
              />
            </div>
          </div>

          <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              className="tsm-btn-primary"
              disabled={submittingManual || !manualForm.syllabusTopicId || !manualForm.paperId}
            >
              {submittingManual ? "Saving Mapping..." : "Save Manual Mapping"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
