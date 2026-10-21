import { useState } from "react";

export default function SyllabusTopicsSection({
  items = [],
  onAddTopic,
  onEditTopic,
  onDeleteTopic,
  onStatusChange,
  onReorder,
  onNavigateToScheduling,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [reordering, setReordering] = useState(false);

  // Filter items
  const filteredItems = items.filter((item) => {
    if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (item.topic && item.topic.toLowerCase().includes(q)) ||
      (item.unit && item.unit.toLowerCase().includes(q)) ||
      (item.description && item.description.toLowerCase().includes(q))
    );
  });

  // Group by Unit
  const unitsMap = {};
  filteredItems.forEach((item) => {
    const unitName = item.unit || "General Topics";
    if (!unitsMap[unitName]) unitsMap[unitName] = [];
    unitsMap[unitName].push(item);
  });

  const handleMove = async (currentIndex, direction) => {
    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    try {
      setReordering(true);
      const newItems = [...items];
      const temp = newItems[currentIndex];
      newItems[currentIndex] = newItems[targetIndex];
      newItems[targetIndex] = temp;

      const orderedIds = newItems.map((it) => it.id);
      await onReorder(orderedIds);
    } catch (err) {
      console.error(err);
    } finally {
      setReordering(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* TOOLBAR */}
      <div className="tsm-toolbar">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text"
            className="tsm-search-input"
            placeholder="Search topics, units, or keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <select
            className="tsm-form-select"
            style={{ padding: "8px 12px", fontSize: "0.82rem" }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Teaching Statuses</option>
            <option value="NOT_STARTED">Not Started</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="PARTIALLY_COMPLETED">Partially Completed</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
            Showing {filteredItems.length} of {items.length} topics
          </span>
          <button type="button" className="tsm-btn-primary" onClick={onAddTopic}>
            + Add Topic
          </button>
        </div>
      </div>

      {/* DRAFT INTEGRITY NOTICE */}
      <div
        style={{
          background: "rgba(30, 27, 46, 0.4)",
          border: "1px solid rgba(255, 255, 255, 0.06)",
          borderRadius: 10,
          padding: "10px 14px",
          fontSize: "0.78rem",
          color: "#94a3b8",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span>💡</span>
        <span>
          <strong>Draft Syllabus Editor:</strong> Adding, updating or reordering topics changes your current editable syllabus. Previously published versions remain permanently preserved in <em>Versions & Publishing</em>.
        </span>
      </div>

      {/* TOPICS GROUPED BY UNIT */}
      {items.length === 0 ? (
        <div className="tsm-empty-state" style={{ padding: "48px 24px", textAlign: "center" }}>
          <div className="tsm-empty-icon" style={{ fontSize: "2.5rem", marginBottom: 12 }}>📖</div>
          <h3 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#ffffff", marginBottom: 8 }}>
            No Syllabus Topics Configured Yet
          </h3>
          <p style={{ maxWidth: 540, margin: "0 auto 20px auto", color: "#94a3b8", lineHeight: 1.6, fontSize: "0.9rem" }}>
            This classroom has not yet established its curriculum topics or syllabus units. You can add topics manually or use the Syllabus Scheduling document intake to extract your official syllabus automatically.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button type="button" className="tsm-btn-primary" onClick={onAddTopic}>
              + Add Topics Manually
            </button>
            {onNavigateToScheduling && (
              <button
                type="button"
                className="tsm-btn-secondary"
                style={{ borderColor: "rgba(56, 189, 248, 0.4)", color: "#38bdf8" }}
                onClick={onNavigateToScheduling}
              >
                📁 Open Document Intake &amp; Scheduling
              </button>
            )}
          </div>
        </div>
      ) : Object.keys(unitsMap).length === 0 ? (
        <div className="tsm-empty-state">
          <p>No topics match your current search/filter criteria.</p>
        </div>
      ) : (
        Object.keys(unitsMap).map((unitName) => (
          <div key={unitName} className="tsm-unit-group">
            <div className="tsm-unit-header">
              <div className="tsm-unit-title">
                <span>📖</span> {unitName}
              </div>
              <span className="tsm-unit-count">{unitsMap[unitName].length} topics</span>
            </div>

            <div className="tsm-topics-list">
              {unitsMap[unitName].map((topicItem) => {
                const globalIndex = items.findIndex((it) => it.id === topicItem.id);
                const isFirst = globalIndex === 0;
                const isLast = globalIndex === items.length - 1;

                return (
                  <div key={topicItem.id} className="tsm-topic-row">
                    {/* Accessible Reorder Controls */}
                    <div className="tsm-topic-reorder-ctrls">
                      <button
                        type="button"
                        className="tsm-reorder-btn"
                        title="Move Up"
                        disabled={isFirst || reordering}
                        onClick={() => handleMove(globalIndex, -1)}
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        className="tsm-reorder-btn"
                        title="Move Down"
                        disabled={isLast || reordering}
                        onClick={() => handleMove(globalIndex, 1)}
                      >
                        ▼
                      </button>
                    </div>

                    {/* Topic Main Content */}
                    <div className="tsm-topic-main">
                      <div className="tsm-topic-title-row">
                        <span className="tsm-topic-title">{topicItem.topic}</span>
                        <span
                          className={`tsm-badge tsm-badge-${topicItem.status ? topicItem.status.toLowerCase().replace(/_/g, "-") : "not-started"}`}
                        >
                          {topicItem.status ? topicItem.status.replace(/_/g, " ") : "NOT STARTED"}
                        </span>
                      </div>

                      {topicItem.description && (
                        <div className="tsm-topic-desc">{topicItem.description}</div>
                      )}

                      {/* Extracted subtopics list */}
                      {topicItem.subtopics && topicItem.subtopics.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                          {topicItem.subtopics.map((sub, sIdx) => (
                            <span
                              key={sIdx}
                              style={{
                                fontSize: "0.74rem",
                                padding: "2px 8px",
                                borderRadius: 6,
                                background: "rgba(168, 85, 247, 0.12)",
                                color: "#d8b4fe",
                                border: "1px solid rgba(168, 85, 247, 0.25)",
                              }}
                            >
                              ↳ {sub}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="tsm-topic-meta-row">
                        {topicItem.estimatedHours != null && (
                          <span className="tsm-topic-meta-item">
                            ⏱️ Est: {topicItem.estimatedHours} hrs
                          </span>
                        )}
                        {topicItem.actualTeachingHours != null && (
                          <span className="tsm-topic-meta-item" style={{ color: "#34d399" }}>
                            ⏱️ Actual: {topicItem.actualTeachingHours} hrs
                          </span>
                        )}
                        {(topicItem.plannedStartDate || topicItem.plannedTeachingDate) && (
                          <span className="tsm-topic-meta-item">
                            🗓️ {topicItem.plannedStartDate || topicItem.plannedTeachingDate} {topicItem.plannedCompletionDate ? `→ ${topicItem.plannedCompletionDate}` : ""}
                          </span>
                        )}
                        {topicItem.actualCompletionDate && (
                          <span className="tsm-topic-meta-item" style={{ color: "#34d399" }}>
                            ✅ Completed: {topicItem.actualCompletionDate}
                          </span>
                        )}
                        {topicItem.linkedSessionIds?.length > 0 && (
                          <span className="tsm-topic-meta-item" style={{ color: "#38bdf8" }}>
                            📅 {topicItem.linkedSessionIds.length} scheduled session(s)
                          </span>
                        )}
                        {topicItem.learningObjectives?.length > 0 && (
                          <span className="tsm-topic-meta-item">
                            🎯 {topicItem.learningObjectives.length} objectives
                          </span>
                        )}
                        {topicItem.learningResources?.length > 0 && (
                          <span className="tsm-topic-meta-item">
                            🔗 {topicItem.learningResources.length} resources
                          </span>
                        )}
                        {topicItem.teachingNotes && (
                          <span className="tsm-topic-meta-item" title="Has teacher notes">
                            📝 Notes
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Topic Actions */}
                    <div className="tsm-topic-actions">
                      <select
                        className="tsm-status-select"
                        value={topicItem.status || "NOT_STARTED"}
                        onChange={(e) => onStatusChange(topicItem.id, e.target.value)}
                        title="Update teaching status"
                      >
                        <option value="NOT_STARTED">Not Started</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="PARTIALLY_COMPLETED">Partially Completed</option>
                        <option value="COMPLETED">Completed</option>
                      </select>

                      <button
                        type="button"
                        className="tsm-action-icon-btn"
                        title="Edit Topic"
                        onClick={() => onEditTopic(topicItem)}
                      >
                        ✏️
                      </button>

                      <button
                        type="button"
                        className="tsm-action-icon-btn delete"
                        title="Delete Topic"
                        onClick={() => onDeleteTopic(topicItem.id, topicItem.topic)}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
