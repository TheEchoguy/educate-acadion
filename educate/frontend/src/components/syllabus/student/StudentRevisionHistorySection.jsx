import { useState, useEffect } from "react";
import { getMyTopicRevisionHistory } from "../../../services/syllabusService";

export default function StudentRevisionHistorySection({
  classroomId,
  topics = [],
  versions = [],
}) {
  const [selectedTopicId, setSelectedTopicId] = useState(topics.length > 0 ? (topics[0].topicId || topics[0].id) : "");
  const [historyEntries, setHistoryEntries] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    let active = true;
    if (!classroomId || !selectedTopicId) {
      return () => {
        active = false;
      };
    }

    getMyTopicRevisionHistory(classroomId, selectedTopicId)
      .then((data) => {
        if (active) {
          setHistoryEntries(data || []);
          setLoadingHistory(false);
        }
      })
      .catch((err) => {
        console.error(err);
        if (active) {
          setHistoryEntries([]);
          setLoadingHistory(false);
        }
      });

    return () => {
      active = false;
    };
  }, [classroomId, selectedTopicId]);

  const selectedTopicObj = topics.find((t) => (t.topicId || t.id) === selectedTopicId);

  // Map version ID to version metadata
  const getVersionInfo = (versionId) => {
    const v = versions.find((ver) => ver.id === versionId);
    if (v) return `Version ${v.versionNumber}: ${v.versionTitle || "Snapshot"}`;
    return `Version Snapshot (${versionId.slice(0, 8)}...)`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* EXPLANATORY HEADER CARD */}
      <div className="ssm-card">
        <div className="ssm-card-header">
          <div>
            <h3 className="ssm-card-title">📜 Longitudinal Personal Revision History</h3>
            <div className="ssm-card-subtitle">
              Inspect how your personal study notes and understanding evolved across published syllabus snapshots
            </div>
          </div>
        </div>

        {/* TOPIC SELECTOR */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <label style={{ fontSize: "0.85rem", color: "#cbd5e1", fontWeight: 600 }}>Select Topic:</label>
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
              return (
                <option key={tid} value={tid}>
                  {t.unit ? `[${t.unit}] ` : ""}{t.topic}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* TIMELINE LIST */}
      {loadingHistory ? (
        <div className="ssm-loading-container">
          <div className="ssm-spinner"></div>
          <p>Loading your revision timeline for this topic...</p>
        </div>
      ) : !selectedTopicId ? (
        <div className="ssm-empty-state">
          <p>Please select a topic to view its longitudinal revision history.</p>
        </div>
      ) : historyEntries.length === 0 ? (
        <div className="ssm-empty-state">
          <div className="ssm-empty-icon">📝</div>
          <h4>No revision entries recorded for &ldquo;{selectedTopicObj?.topic || "this topic"}&rdquo;</h4>
          <p>Update your revision checklist in <em>My Revision</em> to start logging your personal revision history.</p>
        </div>
      ) : (
        <div className="ssm-history-timeline">
          {historyEntries.map((entry, idx) => (
            <div key={entry.id || idx} className="ssm-history-row">
              <div className="ssm-history-left">
                <span className="ssm-version-tag">
                  {getVersionInfo(entry.publishedVersionId)}
                </span>

                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span
                      className={`ssm-badge ssm-badge-${entry.revisionStatus ? entry.revisionStatus.toLowerCase().replace("_", "-") : "not-started"}`}
                    >
                      {entry.revisionStatus ? entry.revisionStatus.replace("_", " ") : "NOT STARTED"}
                    </span>

                    {entry.understandingStatus && (
                      <span
                        className={`ssm-badge ssm-badge-${entry.understandingStatus.toLowerCase().replace("_", "-")}`}
                      >
                        {entry.understandingStatus.replace("_", " ")}
                      </span>
                    )}
                  </div>

                  {entry.personalNotes && (
                    <div style={{ fontSize: "0.82rem", color: "#cbd5e1", marginTop: 4 }}>
                      &ldquo;{entry.personalNotes}&rdquo;
                    </div>
                  )}
                </div>
              </div>

              <div style={{ fontSize: "0.76rem", color: "#64748b" }}>
                {entry.lastRevisedAt
                  ? `Revised on ${new Date(entry.lastRevisedAt).toLocaleString()}`
                  : entry.updatedAt
                  ? `Logged on ${new Date(entry.updatedAt).toLocaleDateString()}`
                  : "Recorded"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
