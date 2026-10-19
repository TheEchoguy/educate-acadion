import { useState, useEffect } from "react";
import { getAssessmentMappings, getTopicAssessmentInsights } from "../../../services/syllabusService";

export default function StudentAssessmentInsightsSection({ classroomId, topics = [] }) {
  const [mappings, setMappings] = useState([]);
  const [loadingMappings, setLoadingMappings] = useState(true);

  const [selectedTopicId, setSelectedTopicId] = useState(topics.length > 0 ? (topics[0].topicId || topics[0].id) : "");
  const [topicInsight, setTopicInsight] = useState(null);
  const [loadingInsight, setLoadingInsight] = useState(false);

  useEffect(() => {
    let active = true;
    if (classroomId) {
      getAssessmentMappings(classroomId)
        .then((data) => {
          if (active) {
            // Students only see confirmed mappings
            const confirmedOnly = (data || []).filter((m) => m.confirmed !== false);
            setMappings(confirmedOnly);
            setLoadingMappings(false);
          }
        })
        .catch((err) => {
          console.error(err);
          if (active) {
            setMappings([]);
            setLoadingMappings(false);
          }
        });
    }
    return () => {
      active = false;
    };
  }, [classroomId]);

  useEffect(() => {
    let active = true;
    if (!classroomId || !selectedTopicId) {
      return () => {
        active = false;
      };
    }

    getTopicAssessmentInsights(classroomId, selectedTopicId)
      .then((data) => {
        if (active) {
          setTopicInsight(data || null);
          setLoadingInsight(false);
        }
      })
      .catch((err) => {
        console.error(err);
        if (active) {
          setTopicInsight(null);
          setLoadingInsight(false);
        }
      });

    return () => {
      active = false;
    };
  }, [classroomId, selectedTopicId]);

  const selectedTopicObj = topics.find((t) => (t.topicId || t.id) === selectedTopicId);
  const relevantMappings = mappings.filter((m) => m.syllabusTopicId === selectedTopicId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* HEADER EXPLANATION */}
      <div className="ssm-card">
        <div className="ssm-card-header">
          <div>
            <h3 className="ssm-card-title">🎯 Curriculum Assessment Connections</h3>
            <div className="ssm-card-subtitle">
              Verified examination papers and questions mapped by your faculty to syllabus topics
            </div>
          </div>
        </div>

        {/* TOPIC SELECTOR */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <label style={{ fontSize: "0.85rem", color: "#cbd5e1", fontWeight: 600 }}>Inspect Topic:</label>
          <select
            className="ssm-select-ctrl"
            style={{ minWidth: 280 }}
            value={selectedTopicId}
            onChange={(e) => setSelectedTopicId(e.target.value)}
            disabled={topics.length === 0}
          >
            {topics.length === 0 && <option value="">No topics available</option>}
            {topics.map((t) => {
              const tid = t.topicId || t.id;
              const hasMap = mappings.some((m) => m.syllabusTopicId === tid);
              return (
                <option key={tid} value={tid}>
                  {hasMap ? "✓ " : ""}{t.unit ? `[${t.unit}] ` : ""}{t.topic}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {loadingMappings || loadingInsight ? (
        <div className="ssm-loading-container">
          <div className="ssm-spinner"></div>
          <p>Loading assessment evidence for this topic...</p>
        </div>
      ) : !selectedTopicId ? (
        <div className="ssm-empty-state">
          <p>Select a topic to check its confirmed assessment evidence.</p>
        </div>
      ) : relevantMappings.length === 0 && (!topicInsight || !topicInsight.hasEvidence) ? (
        <div className="ssm-empty-state">
          <div className="ssm-empty-icon">📑</div>
          <h4>No confirmed assessment evidence yet for &ldquo;{selectedTopicObj?.topic || "this topic"}&rdquo;</h4>
          <p>
            Your instructor has not yet mapped examination papers or specific questions to this topic. Check back once tests and question papers are uploaded.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* MAPPED EXAM PAPERS & QUESTIONS CARD */}
          <div className="ssm-evidence-card">
            <div className="ssm-evidence-header">
              <span className="ssm-evidence-title">
                📚 Linked Examination References ({relevantMappings.length})
              </span>
              <span className="ssm-evidence-badge">Faculty Confirmed</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
              {relevantMappings.map((m) => (
                <div
                  key={m.id}
                  style={{
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    borderRadius: 10,
                    padding: "12px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: "#f8fafc", fontSize: "0.92rem" }}>
                      📄 {m.assessmentTitle || `Paper #${m.paperId}`}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "#38bdf8", marginTop: 2 }}>
                      {m.questionId ? `Target Question: ${m.questionId}` : "Full Paper Mapping"}
                      {m.subjectCode && ` • Code: ${m.subjectCode}`}
                    </div>
                  </div>

                  {m.matchedTopicLabel && (
                    <span
                      style={{
                        background: "rgba(56, 189, 248, 0.12)",
                        color: "#38bdf8",
                        border: "1px solid rgba(56, 189, 248, 0.25)",
                        padding: "3px 8px",
                        borderRadius: 6,
                        fontSize: "0.74rem",
                      }}
                    >
                      Tagged: &ldquo;{m.matchedTopicLabel}&rdquo;
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* COHORT SAMPLE RELIABILITY DISCLOSURE */}
            {topicInsight?.sampleSizeReliability && (
              <div className="ssm-evidence-disclaimer" style={{ marginTop: 8 }}>
                <strong>Evidence Disclosure:</strong> {topicInsight.evidenceSummary || "Assessment mappings verified by instructor."}
                <div style={{ marginTop: 4, color: "#64748b" }}>
                  Data reliability: {topicInsight.sampleSizeReliability}
                  {topicInsight.totalResponsesEvaluated > 0 && ` (${topicInsight.totalResponsesEvaluated} student evaluations sampled)`}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
