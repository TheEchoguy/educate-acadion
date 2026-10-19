import { useState } from "react";
import { getScheduleSummary, getLocalTodayStr } from "./syllabusScheduleUtils";

export default function SyllabusScheduleSection({
  items = [],
  onEditTopic,
  initialFilter = "ALL",
}) {
  const [filterMode, setFilterMode] = useState(initialFilter);
  const [prevInitialFilter, setPrevInitialFilter] = useState(initialFilter);

  if (prevInitialFilter !== initialFilter) {
    setPrevInitialFilter(initialFilter);
    setFilterMode(initialFilter);
  }

  const todayStr = getLocalTodayStr();
  const summary = getScheduleSummary(items, todayStr);

  const {
    classified,
    overdueCount,
    inProgressCount,
    upcomingCount,
    unscheduledCount,
    completedCount,
  } = summary;

  const filteredItems = classified.filter((item) => {
    if (filterMode === "ALL") return true;
    return item.scheduleClassification === filterMode;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* FILTER SUMMARY PILLS */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          className={`tsm-subtab-btn ${filterMode === "ALL" ? "active" : ""}`}
          onClick={() => setFilterMode("ALL")}
        >
          All Topics ({items.length})
        </button>

        <button
          type="button"
          className={`tsm-subtab-btn ${filterMode === "IN_PROGRESS" ? "active" : ""}`}
          onClick={() => setFilterMode("IN_PROGRESS")}
          style={{ borderColor: filterMode === "IN_PROGRESS" ? "#f59e0b" : undefined }}
        >
          ⚡ In Progress ({inProgressCount})
        </button>

        <button
          type="button"
          className={`tsm-subtab-btn ${filterMode === "OVERDUE" ? "active" : ""}`}
          onClick={() => setFilterMode("OVERDUE")}
          style={{ borderColor: filterMode === "OVERDUE" ? "#ef4444" : undefined }}
        >
          ⚠️ Overdue ({overdueCount})
        </button>

        <button
          type="button"
          className={`tsm-subtab-btn ${filterMode === "UPCOMING" ? "active" : ""}`}
          onClick={() => setFilterMode("UPCOMING")}
          style={{ borderColor: filterMode === "UPCOMING" ? "#38bdf8" : undefined }}
        >
          🗓️ Upcoming ({upcomingCount})
        </button>

        <button
          type="button"
          className={`tsm-subtab-btn ${filterMode === "UNSCHEDULED" ? "active" : ""}`}
          onClick={() => setFilterMode("UNSCHEDULED")}
        >
          ⏳ Unscheduled ({unscheduledCount})
        </button>

        <button
          type="button"
          className={`tsm-subtab-btn ${filterMode === "COMPLETED" ? "active" : ""}`}
          onClick={() => setFilterMode("COMPLETED")}
        >
          ✓ Completed ({completedCount})
        </button>
      </div>

      {/* SCHEDULE ITEMS LIST */}
      {filteredItems.length === 0 ? (
        <div className="tsm-empty-state">
          <div className="tsm-empty-icon">🗓️</div>
          <p>No topics match the selected schedule filter ({filterMode.replace("_", " ")}).</p>
        </div>
      ) : (
        <div className="tsm-timeline-list">
          {filteredItems.map((item) => {
            const isOverdue = item.scheduleClassification === "OVERDUE";
            const isInProgress = item.scheduleClassification === "IN_PROGRESS";
            const isUpcoming = item.scheduleClassification === "UPCOMING";
            const isUnscheduled = item.scheduleClassification === "UNSCHEDULED";
            const isCompleted = item.scheduleClassification === "COMPLETED";

            return (
              <div
                key={item.id}
                className={`tsm-timeline-card ${
                  isOverdue
                    ? "overdue"
                    : isInProgress
                    ? "in-progress"
                    : isUpcoming
                    ? "upcoming"
                    : isCompleted
                    ? "completed"
                    : ""
                }`}
              >
                <div className="tsm-timeline-header">
                  <div className="tsm-timeline-topic-info">
                    <span className="tsm-timeline-unit-badge">{item.unit || "General"}</span>
                    <span className="tsm-timeline-topic-title">{item.topic}</span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {isOverdue && <span className="tsm-badge tsm-badge-overdue">⚠️ Overdue</span>}
                    {isInProgress && (
                      <span className="tsm-badge tsm-badge-in-progress">⚡ In Progress</span>
                    )}
                    {isUpcoming && <span className="tsm-badge tsm-badge-upcoming">Upcoming</span>}
                    {isUnscheduled && (
                      <span className="tsm-badge tsm-badge-unscheduled">Unscheduled</span>
                    )}
                    {isCompleted && <span className="tsm-badge tsm-badge-completed">Completed</span>}

                    <button
                      type="button"
                      className="tsm-btn-secondary"
                      style={{ padding: "4px 10px", fontSize: "0.78rem" }}
                      onClick={() => onEditTopic(item)}
                    >
                      ✏️ Edit Schedule
                    </button>
                  </div>
                </div>

                {/* SCHEDULE TIMING & HOURS */}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <div className="tsm-timeline-date-cluster">
                    <span>🗓️ Planned Timeline:</span>
                    <strong>
                      {item.plannedStartDate || "Start TBD"} → {item.plannedCompletionDate || "Completion TBD"}
                    </strong>
                  </div>

                  {item.estimatedHours && (
                    <div className="tsm-timeline-date-cluster">
                      <span>⏱️ Estimated:</span>
                      <strong>{item.estimatedHours} hours</strong>
                    </div>
                  )}

                  {item.actualCompletionDate && (
                    <div className="tsm-timeline-date-cluster">
                      <span>✅ Completed On:</span>
                      <strong>{item.actualCompletionDate}</strong>
                    </div>
                  )}
                </div>

                {/* DETAILS EXPANDED: OBJECTIVES, NOTES, RESOURCES */}
                <div className="tsm-details-grid">
                  {/* Learning Objectives */}
                  <div className="tsm-detail-box">
                    <div className="tsm-detail-box-title">🎯 Learning Objectives</div>
                    {item.learningObjectives?.length > 0 ? (
                      <ul className="tsm-objectives-list">
                        {item.learningObjectives.map((obj, idx) => (
                          <li key={idx}>{obj}</li>
                        ))}
                      </ul>
                    ) : (
                      <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                        No specific objectives specified.
                      </span>
                    )}
                  </div>

                  {/* Learning Resources Links */}
                  <div className="tsm-detail-box">
                    <div className="tsm-detail-box-title">🔗 External Resources & References</div>
                    {item.learningResources?.length > 0 ? (
                      <div className="tsm-resources-tags">
                        {item.learningResources.map((res, idx) => (
                          <a
                            key={idx}
                            href={res.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="tsm-resource-link"
                            title={res.url}
                          >
                            <span>↗</span> {res.label || res.url}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                        No external resources attached.
                      </span>
                    )}

                    {item.referenceMaterials && (
                      <div style={{ marginTop: 8, fontSize: "0.78rem", color: "#cbd5e1" }}>
                        <strong>Materials:</strong> {item.referenceMaterials}
                      </div>
                    )}
                  </div>

                  {/* Teaching Notes */}
                  {item.teachingNotes && (
                    <div className="tsm-detail-box" style={{ gridColumn: "1 / -1" }}>
                      <div className="tsm-detail-box-title">📝 Teacher Pedagogical Notes</div>
                      <p style={{ margin: 0, fontSize: "0.82rem", color: "#cbd5e1", lineHeight: 1.5 }}>
                        {item.teachingNotes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
