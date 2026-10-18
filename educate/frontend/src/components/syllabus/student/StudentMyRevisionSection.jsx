import { useState } from "react";

export default function StudentMyRevisionSection({
  topics = [],
  revisions = [],
  summary,
  onUpdateRevision,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [editingNotes, setEditingNotes] = useState({});
  const [savingTopicId, setSavingTopicId] = useState(null);

  const getRevisionForTopic = (topicId) => {
    return revisions.find((r) => r.topicId === topicId);
  };

  const handleRevisionStatusChange = async (topicId, newRevStatus) => {
    const existing = getRevisionForTopic(topicId);
    try {
      setSavingTopicId(topicId);
      await onUpdateRevision(topicId, {
        topicId,
        revisionStatus: newRevStatus,
        understandingStatus: existing?.understandingStatus || "NOT_ASSESSED",
        personalNotes: editingNotes[topicId] !== undefined ? editingNotes[topicId] : (existing?.personalNotes || null),
      });
    } finally {
      setSavingTopicId(null);
    }
  };

  const handleUnderstandingStatusChange = async (topicId, newUnderStatus) => {
    const existing = getRevisionForTopic(topicId);
    try {
      setSavingTopicId(topicId);
      await onUpdateRevision(topicId, {
        topicId,
        revisionStatus: existing?.revisionStatus || "NOT_STARTED",
        understandingStatus: newUnderStatus,
        personalNotes: editingNotes[topicId] !== undefined ? editingNotes[topicId] : (existing?.personalNotes || null),
      });
    } finally {
      setSavingTopicId(null);
    }
  };

  const handleSaveNotes = async (topicId) => {
    const existing = getRevisionForTopic(topicId);
    try {
      setSavingTopicId(topicId);
      await onUpdateRevision(topicId, {
        topicId,
        revisionStatus: existing?.revisionStatus || "NOT_STARTED",
        understandingStatus: existing?.understandingStatus || "NOT_ASSESSED",
        personalNotes: editingNotes[topicId] || null,
      });
    } finally {
      setSavingTopicId(null);
    }
  };

  const filteredTopics = topics.filter((t) => {
    const topicId = t.topicId || t.id;
    const rev = getRevisionForTopic(topicId);
    const currentRevStatus = rev?.revisionStatus || "NOT_STARTED";

    if (statusFilter !== "ALL" && currentRevStatus !== statusFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (t.topic && t.topic.toLowerCase().includes(q)) ||
      (t.unit && t.unit.toLowerCase().includes(q))
    );
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* SUMMARY BANNER */}
      {summary && (
        <div className="ssm-card">
          <div className="ssm-card-header">
            <div>
              <h3 className="ssm-card-title">🎯 My Personal Revision Progress</h3>
              <div className="ssm-card-subtitle">
                Self-reported review checklist and understanding indicators
              </div>
            </div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#34d399" }}>
              {Number(summary.revisionPercentage || 0).toFixed(1)}%
            </div>
          </div>

          <div className="ssm-progress-bar">
            <div
              className="ssm-progress-fill"
              style={{ width: `${Math.min(100, Math.max(0, summary.revisionPercentage || 0))}%` }}
            />
          </div>

          <div className="ssm-summary-grid" style={{ marginTop: 20 }}>
            {/* Revision Counts */}
            <div className="ssm-stat-box">
              <span className="ssm-stat-label">Revision Completion</span>
              <div className="ssm-stat-value" style={{ color: "#34d399" }}>
                {summary.revisedCount || 0} / {summary.totalTopics || 0}
              </div>
              <div className="ssm-stat-desc">
                {summary.inProgressCount || 0} in progress • {summary.notStartedCount || 0} not started
              </div>
            </div>

            {/* Understanding Breakdown */}
            <div className="ssm-stat-box" style={{ gridColumn: "span 2" }}>
              <span className="ssm-stat-label">Self-Assessed Understanding</span>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
                <span className="ssm-badge ssm-badge-confident">
                  🌟 {summary.confidentCount || 0} Confident
                </span>
                <span className="ssm-badge ssm-badge-understood">
                  👍 {summary.understoodCount || 0} Understood
                </span>
                <span className="ssm-badge ssm-badge-needs-revision">
                  ⚠️ {summary.needsRevisionCount || 0} Needs Revision
                </span>
                <span className="ssm-badge ssm-badge-not-started">
                  ⏳ {summary.notAssessedCount || 0} Not Assessed
                </span>
              </div>
              <div className="ssm-stat-desc" style={{ marginTop: 6 }}>
                Private personal benchmark to guide your exam study schedule
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FILTER CONTROLS */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            type="text"
            className="ssm-notes-input"
            style={{ width: 280 }}
            placeholder="Search checklist topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <select
            className="ssm-select-ctrl"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Revision Statuses</option>
            <option value="NOT_STARTED">Not Started</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="REVISED">Revised</option>
          </select>
        </div>

        <span style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
          Showing {filteredTopics.length} of {topics.length} topics
        </span>
      </div>

      {/* CHECKLIST ROWS */}
      {topics.length === 0 ? (
        <div className="ssm-empty-state">
          <p>No published topics found to revise.</p>
        </div>
      ) : filteredTopics.length === 0 ? (
        <div className="ssm-empty-state">
          <p>No topics match your selected status filter.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filteredTopics.map((t) => {
            const topicId = t.topicId || t.id;
            const rev = getRevisionForTopic(topicId);
            const isSaving = savingTopicId === topicId;
            const currentNotes = editingNotes[topicId] !== undefined ? editingNotes[topicId] : (rev?.personalNotes || "");

            return (
              <div key={topicId} className="ssm-topic-card" style={{ gap: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <span style={{ fontSize: "0.74rem", color: "#38bdf8", fontWeight: 700, textTransform: "uppercase" }}>
                      {t.unit || "General"}
                    </span>
                    <h4 style={{ margin: "2px 0 0 0", color: "#f8fafc", fontSize: "1rem" }}>{t.topic}</h4>
                  </div>

                  {rev?.lastRevisedAt && (
                    <span style={{ fontSize: "0.74rem", color: "#64748b" }}>
                      Last revised: {new Date(rev.lastRevisedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {/* INTERACTIVE CONTROLS BAR */}
                <div className="ssm-revision-controls-bar">
                  <div className="ssm-status-selectors-group">
                    {/* Revision Status */}
                    <div className="ssm-field-inline">
                      <label className="ssm-field-label">Revision:</label>
                      <select
                        className="ssm-select-ctrl"
                        value={rev?.revisionStatus || "NOT_STARTED"}
                        disabled={isSaving}
                        onChange={(e) => handleRevisionStatusChange(topicId, e.target.value)}
                      >
                        <option value="NOT_STARTED">⏳ Not Started</option>
                        <option value="IN_PROGRESS">📖 In Progress</option>
                        <option value="REVISED">✅ Revised</option>
                      </select>
                    </div>

                    {/* Understanding Status */}
                    <div className="ssm-field-inline">
                      <label className="ssm-field-label">Understanding:</label>
                      <select
                        className="ssm-select-ctrl"
                        value={rev?.understandingStatus || "NOT_ASSESSED"}
                        disabled={isSaving}
                        onChange={(e) => handleUnderstandingStatusChange(topicId, e.target.value)}
                      >
                        <option value="NOT_ASSESSED">— Not Assessed</option>
                        <option value="NEEDS_REVISION">⚠️ Needs Revision</option>
                        <option value="UNDERSTOOD">👍 Understood</option>
                        <option value="CONFIDENT">🌟 Confident</option>
                      </select>
                    </div>
                  </div>

                  {/* Private Personal Notes */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <input
                      type="text"
                      className="ssm-notes-input"
                      placeholder="Add private note (e.g. re-read theorem 3)..."
                      value={currentNotes}
                      disabled={isSaving}
                      onChange={(e) => setEditingNotes({ ...editingNotes, [topicId]: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSaveNotes(topicId);
                        }
                      }}
                    />
                    {currentNotes !== (rev?.personalNotes || "") && (
                      <button
                        type="button"
                        className="ssm-save-btn"
                        disabled={isSaving}
                        onClick={() => handleSaveNotes(topicId)}
                      >
                        {isSaving ? "..." : "Save Note"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
