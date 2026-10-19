import { useState } from "react";

export default function StudentPublishedSyllabusSection({
  topics = [],
  revisions = [],
}) {
  const [expandedTopicIds, setExpandedTopicIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const toggleExpand = (topicId) => {
    setExpandedTopicIds((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) next.delete(topicId);
      else next.add(topicId);
      return next;
    });
  };

  // Find student revision record for topic
  const getRevisionForTopic = (topicId) => {
    return revisions.find((r) => r.topicId === topicId);
  };

  const filteredTopics = topics.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (t.topic && t.topic.toLowerCase().includes(q)) ||
      (t.unit && t.unit.toLowerCase().includes(q)) ||
      (t.description && t.description.toLowerCase().includes(q))
    );
  });

  // Group by Unit
  const unitsMap = {};
  filteredTopics.forEach((t) => {
    const u = t.unit || "General Topics";
    if (!unitsMap[u]) unitsMap[u] = [];
    unitsMap[u].push(t);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* SEARCH TOOLBAR */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <input
          type="text"
          className="ssm-notes-input"
          style={{ width: 320 }}
          placeholder="Search published topics or units..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <span style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
          Showing {filteredTopics.length} of {topics.length} published topics
        </span>
      </div>

      {topics.length === 0 ? (
        <div className="ssm-empty-state">
          <div className="ssm-empty-icon">📭</div>
          <h3>No published syllabus available yet</h3>
          <p>Your instructor has not published an official syllabus version for this classroom yet. Please check back later.</p>
        </div>
      ) : Object.keys(unitsMap).length === 0 ? (
        <div className="ssm-empty-state">
          <p>No topics match your search criteria.</p>
        </div>
      ) : (
        Object.keys(unitsMap).map((unitName) => (
          <div key={unitName} className="ssm-unit-group">
            <div className="ssm-unit-header">
              <div className="ssm-unit-title">
                <span>📖</span> {unitName}
              </div>
              <span className="ssm-unit-count">{unitsMap[unitName].length} topics</span>
            </div>

            <div>
              {unitsMap[unitName].map((t) => {
                const isExpanded = expandedTopicIds.has(t.topicId || t.id);
                const topicId = t.topicId || t.id;
                const rev = getRevisionForTopic(topicId);
                const hasDetails = (t.learningObjectives && t.learningObjectives.length > 0) ||
                                   (t.learningResources && t.learningResources.length > 0) ||
                                   t.referenceMaterials;

                return (
                  <div key={topicId} className="ssm-topic-card">
                    <div className="ssm-topic-top-row">
                      <div style={{ flex: 1, minWidth: 240 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                          <span className="ssm-topic-title">{t.topic}</span>

                          {/* Teacher Teaching Status */}
                          <span
                            className={`ssm-badge ssm-badge-${t.status ? t.status.toLowerCase().replace("_", "-") : "not-started"}`}
                            title="Faculty teaching progress"
                          >
                            Faculty: {t.status ? t.status.replace("_", " ") : "NOT STARTED"}
                          </span>
                        </div>

                        {t.description && <div className="ssm-topic-desc">{t.description}</div>}

                        <div className="ssm-meta-tags-row" style={{ marginTop: 8 }}>
                          {t.estimatedHours && (
                            <span className="ssm-meta-pill">⏱️ {t.estimatedHours} hrs</span>
                          )}
                          {t.plannedStartDate && (
                            <span className="ssm-meta-pill">
                              🗓️ {t.plannedStartDate} → {t.plannedCompletionDate || "TBD"}
                            </span>
                          )}
                          {t.learningObjectives?.length > 0 && (
                            <span className="ssm-meta-pill">🎯 {t.learningObjectives.length} objectives</span>
                          )}
                          {t.learningResources?.length > 0 && (
                            <span className="ssm-meta-pill">🔗 {t.learningResources.length} resources</span>
                          )}
                        </div>
                      </div>

                      {/* Student's Personal Status Indicator & Quick Toggle */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>My Revision:</span>
                          <span
                            className={`ssm-badge ssm-badge-${rev?.revisionStatus ? rev.revisionStatus.toLowerCase().replace("_", "-") : "not-started"}`}
                          >
                            {rev?.revisionStatus ? rev.revisionStatus.replace("_", " ") : "NOT STARTED"}
                          </span>
                        </div>

                        {rev?.understandingStatus && rev.understandingStatus !== "NOT_ASSESSED" && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>Understanding:</span>
                            <span
                              className={`ssm-badge ssm-badge-${rev.understandingStatus.toLowerCase().replace("_", "-")}`}
                            >
                              {rev.understandingStatus.replace("_", " ")}
                            </span>
                          </div>
                        )}

                        {hasDetails && (
                          <button
                            type="button"
                            className="ssm-subtab-btn"
                            style={{ padding: "4px 8px", fontSize: "0.75rem", marginTop: 4 }}
                            onClick={() => toggleExpand(topicId)}
                          >
                            {isExpanded ? "Hide Details ▲" : "View Objectives & Links ▼"}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* EXPANDED DETAILS: OBJECTIVES & SAFE EXTERNAL LINKS */}
                    {isExpanded && (
                      <div className="ssm-details-expand">
                        {t.learningObjectives?.length > 0 && (
                          <div>
                            <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#38bdf8", marginBottom: 4 }}>
                              🎯 Key Learning Objectives:
                            </div>
                            <ul className="ssm-objectives-list">
                              {t.learningObjectives.map((obj, i) => (
                                <li key={i}>{obj}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {t.learningResources?.length > 0 && (
                          <div style={{ marginTop: 6 }}>
                            <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#38bdf8", marginBottom: 6 }}>
                              🔗 Learning Resources & Study Links:
                            </div>
                            <div className="ssm-resources-tags">
                              {t.learningResources.map((res, i) => (
                                <a
                                  key={i}
                                  href={res.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ssm-resource-link"
                                  title={res.url}
                                >
                                  <span>↗</span> {res.label || res.url}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {t.referenceMaterials && (
                          <div style={{ fontSize: "0.78rem", color: "#cbd5e1", marginTop: 4 }}>
                            <strong>Reference Materials:</strong> {t.referenceMaterials}
                          </div>
                        )}
                      </div>
                    )}
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
