import { useState, useEffect } from "react";
import { getScheduleSummary, getLocalTodayStr } from "./syllabusScheduleUtils";
import { getActivePlan } from "../../services/syllabusSchedulingService";

export default function SyllabusScheduleSection({
  classroomId,
  items = [],
  activePlan: propActivePlan = null,
  onEditTopic,
  initialFilter = "ALL",
}) {
  const [activePlan, setActivePlan] = useState(propActivePlan);
  const [planLoading, setPlanLoading] = useState(false);
  const [viewMode, setViewMode] = useState("topics"); // "topics" | "sessions"
  const [filterMode, setFilterMode] = useState(initialFilter);
  const [prevInitialFilter, setPrevInitialFilter] = useState(initialFilter);

  useEffect(() => {
    if (propActivePlan) {
      setActivePlan(propActivePlan);
    }
  }, [propActivePlan]);

  useEffect(() => {
    let active = true;
    if (classroomId) {
      setPlanLoading(true);
      getActivePlan(classroomId)
        .then((plan) => {
          if (active) {
            setActivePlan(plan);
            setPlanLoading(false);
          }
        })
        .catch(() => {
          if (active) {
            setActivePlan(null);
            setPlanLoading(false);
          }
        });
    }
    return () => {
      active = false;
    };
  }, [classroomId]);

  if (prevInitialFilter !== initialFilter) {
    setPrevInitialFilter(initialFilter);
    setFilterMode(initialFilter);
  }

  const todayStr = getLocalTodayStr();
  const summary = getScheduleSummary(items, todayStr);
  const sessions = activePlan?.sessions || [];

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
      {/* VIEW MODE TOGGLE & HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className={`tsm-subtab-btn ${viewMode === "topics" ? "active" : ""}`}
            onClick={() => setViewMode("topics")}
          >
            📚 Syllabus Topics ({items.length})
          </button>
          <button
            type="button"
            className={`tsm-subtab-btn ${viewMode === "sessions" ? "active" : ""}`}
            onClick={() => setViewMode("sessions")}
            style={{ borderColor: viewMode === "sessions" ? "#38bdf8" : undefined }}
          >
            🗓️ Timetable Class Sessions ({sessions.length})
          </button>
        </div>

        {activePlan && (
          <div style={{ fontSize: "0.8rem", color: "#94a3b8", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span>Plan:</span>
            <span className="tsm-badge tsm-badge-published">
              {activePlan.status === "APPROVED" ? "Approved Plan" : `Draft v${activePlan.versionNumber}`}
            </span>
            <span>({activePlan.allocatedHours ?? 0} / {activePlan.requiredHours ?? 0} hrs)</span>
            <span style={{ color: "#38bdf8", background: "rgba(56, 189, 248, 0.1)", padding: "2px 8px", borderRadius: 4, border: "1px solid rgba(56, 189, 248, 0.25)" }}>
              📊 {items.length} Syllabus Topics mapped across {sessions.length} Scheduled Sessions
            </span>
          </div>
        )}
      </div>

      {viewMode === "topics" ? (
        <>
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
              <p>No topics match the selected schedule filter ({filterMode.replace(/_/g, " ")}).</p>
            </div>
          ) : (
            <div className="tsm-timeline-list">
              {filteredItems.map((item) => {
                const isOverdue = item.scheduleClassification === "OVERDUE";
                const isInProgress = item.scheduleClassification === "IN_PROGRESS";
                const isUpcoming = item.scheduleClassification === "UPCOMING";
                const isUnscheduled = item.scheduleClassification === "UNSCHEDULED";
                const isCompleted = item.scheduleClassification === "COMPLETED";

                // Match active sessions linked to this topic
                const topicSessions = sessions.filter(
                  (s) => s.topicId === item.id || (item.linkedSessionIds && item.linkedSessionIds.includes(s.id))
                );

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
                          {item.plannedStartDate || item.plannedTeachingDate || "Start TBD"} → {item.plannedCompletionDate || "Completion TBD"}
                        </strong>
                      </div>

                      {item.estimatedHours != null && (
                        <div className="tsm-timeline-date-cluster">
                          <span>⏱️ Estimated:</span>
                          <strong>{item.estimatedHours} hours</strong>
                        </div>
                      )}

                      {item.actualTeachingHours != null && (
                        <div className="tsm-timeline-date-cluster">
                          <span>⏱️ Actual Taught:</span>
                          <strong style={{ color: "#34d399" }}>{item.actualTeachingHours} hours</strong>
                        </div>
                      )}

                      {item.actualCompletionDate && (
                        <div className="tsm-timeline-date-cluster">
                          <span>✅ Completed On:</span>
                          <strong style={{ color: "#34d399" }}>{item.actualCompletionDate}</strong>
                        </div>
                      )}
                    </div>

                    {/* LINKED TIMETABLE CLASS SESSIONS */}
                    {topicSessions.length > 0 && (
                      <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.06)", borderRadius: 8, padding: "10px 14px", marginTop: 4 }}>
                        <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "#38bdf8", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                          <span>📅 Linked Timetable Sessions ({topicSessions.length}):</span>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {topicSessions.map((s) => (
                            <div
                              key={s.id || s.sessionNumber}
                              style={{
                                fontSize: "0.76rem",
                                padding: "4px 10px",
                                borderRadius: 6,
                                background: "rgba(56, 189, 248, 0.06)",
                                border: "1px solid rgba(56, 189, 248, 0.2)",
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                color: "#cbd5e1",
                              }}
                            >
                              <strong>#{s.sessionNumber}</strong>
                              <span>{s.sessionDate}</span>
                              <span style={{ color: "#94a3b8" }}>({s.startTime} - {s.endTime})</span>
                              {s.roomNumber && <span style={{ color: "#a855f7" }}>[{s.roomNumber}]</span>}
                              {s.subtopic && (
                                <span style={{ color: "#38bdf8", fontStyle: "italic" }}>— {s.subtopic}</span>
                              )}
                              <span
                                className={`tsm-badge tsm-badge-${
                                  s.status === "COMPLETED"
                                    ? "completed"
                                    : s.status === "PARTIALLY_COMPLETED"
                                    ? "partially-completed"
                                    : "not-started"
                                }`}
                                style={{ fontSize: "0.68rem", padding: "1px 6px" }}
                              >
                                {s.status === "PARTIALLY_COMPLETED" ? "Partial" : s.status}
                              </span>
                              {s.isCarriedForward && (
                                <span style={{ color: "#fbbf24", fontWeight: 600 }}>
                                  ↳ Carried forward
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

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
                          <div style={{ fontSize: "0.8rem", color: "#64748b", fontStyle: "italic", padding: "4px 0" }}>
                            No official learning objectives provided for this topic.
                          </div>
                        )}
                      </div>

                      {/* Learning Resources Links (Module PDFs + external resources) */}
                      <div className="tsm-detail-box">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <div className="tsm-detail-box-title" style={{ margin: 0 }}>🔗 Learning Resources &amp; Module References</div>
                          {onEditTopic && (
                            <button
                              type="button"
                              className="tsm-btn-secondary"
                              style={{ padding: "2px 8px", fontSize: "0.72rem", color: "#38bdf8", borderColor: "rgba(56, 189, 248, 0.4)" }}
                              onClick={() => onEditTopic(item)}
                            >
                              + Add Resource
                            </button>
                          )}
                        </div>

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
                                style={
                                  res.type === "MODULE_PDF"
                                    ? { background: "rgba(168, 85, 247, 0.15)", borderColor: "rgba(168, 85, 247, 0.4)", color: "#d8b4fe" }
                                    : undefined
                                }
                              >
                                <span>{res.type === "MODULE_PDF" ? "📄" : "↗"}</span> {res.label || res.url}
                              </a>
                            ))}
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                            <span style={{ fontSize: "0.8rem", color: "#64748b", fontStyle: "italic" }}>
                              No resources added yet.
                            </span>
                            {onEditTopic && (
                              <button
                                type="button"
                                className="tsm-btn-secondary"
                                style={{ padding: "3px 10px", fontSize: "0.75rem", color: "#a78bfa", borderColor: "rgba(167, 139, 250, 0.3)" }}
                                onClick={() => onEditTopic(item)}
                              >
                                + Add Resource
                              </button>
                            )}
                          </div>
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
        </>
      ) : (
        /* TIMETABLE CLASS SESSIONS VIEW */
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {planLoading ? (
            <div className="tsm-empty-state">
              <div className="tsm-spinner" />
              <p>Loading scheduled class sessions...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="tsm-empty-state">
              <div className="tsm-empty-icon">🗓️</div>
              <h4>No Timetable Sessions Scheduled Yet</h4>
              <p>Generate a draft teaching schedule in Syllabus Scheduling to align timetable periods with curriculum topics.</p>
            </div>
          ) : (
            <div className="tsm-timeline-list">
              {sessions.map((sess) => (
                <div
                  key={sess.id || sess.sessionNumber}
                  className={`tsm-timeline-card ${
                    sess.status === "COMPLETED"
                      ? "completed"
                      : sess.status === "PARTIALLY_COMPLETED"
                      ? "in-progress"
                      : sess.status === "SKIPPED"
                      ? "overdue"
                      : "upcoming"
                  }`}
                >
                  <div className="tsm-timeline-header">
                    <div className="tsm-timeline-topic-info">
                      <span className="tsm-timeline-unit-badge">Session #{sess.sessionNumber}</span>
                      <span className="tsm-timeline-topic-title">{sess.topicTitle || "Lecture Topic"}</span>
                      {(sess.subtopic || sess.subtopicTitle) && (
                        <span style={{ fontSize: "0.82rem", color: "#cbd5e1" }}>
                          ↳ <em>{sess.subtopic || sess.subtopicTitle}</em>
                        </span>
                      )}
                      {sess.subtopicSource && sess.subtopicSource !== "OFFICIAL_SYLLABUS" && (
                        <span
                          style={{
                            fontSize: "0.68rem",
                            padding: "1px 6px",
                            borderRadius: 4,
                            fontWeight: 500,
                            background:
                              sess.subtopicSource === "AI_GENERATED"
                                ? "rgba(168, 85, 247, 0.15)"
                                : sess.subtopicSource === "TEACHER_EDITED"
                                ? "rgba(16, 185, 129, 0.15)"
                                : "rgba(245, 158, 11, 0.15)",
                            color:
                              sess.subtopicSource === "AI_GENERATED"
                                ? "#c084fc"
                                : sess.subtopicSource === "TEACHER_EDITED"
                                ? "#34d399"
                                : "#fbbf24",
                            border:
                              sess.subtopicSource === "AI_GENERATED"
                                ? "1px solid rgba(168, 85, 247, 0.3)"
                                : sess.subtopicSource === "TEACHER_EDITED"
                                ? "1px solid rgba(16, 185, 129, 0.3)"
                                : "1px solid rgba(245, 158, 11, 0.3)",
                          }}
                        >
                          {sess.subtopicSource === "AI_GENERATED"
                            ? "✨ AI Focus"
                            : sess.subtopicSource === "TEACHER_EDITED"
                            ? "✏️ Teacher Focus"
                            : "💡 Suggested Focus"}
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span
                        className={`tsm-badge tsm-badge-${
                          sess.status === "COMPLETED"
                            ? "completed"
                            : sess.status === "PARTIALLY_COMPLETED"
                            ? "partially-completed"
                            : sess.status === "SKIPPED"
                            ? "overdue"
                            : "upcoming"
                        }`}
                      >
                        {sess.status === "PARTIALLY_COMPLETED" ? "Partially Completed" : sess.status}
                      </span>
                    </div>
                  </div>

                  {/* SESSION META ROW */}
                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", fontSize: "0.82rem" }}>
                    <span style={{ color: "#cbd5e1" }}>
                      📅 <strong>{sess.sessionDate}</strong> ({sess.startTime} - {sess.endTime})
                    </span>
                    <span style={{ color: "#94a3b8" }}>⏱️ {sess.durationMinutes || 60} mins</span>
                    {sess.roomNumber && <span style={{ color: "#a855f7" }}>🏫 Room: {sess.roomNumber}</span>}
                    {sess.moduleTitle && <span style={{ color: "#38bdf8" }}>📖 {sess.moduleTitle}</span>}
                  </div>

                  {/* CARRY FORWARD & PORTIONS BANNER */}
                  {(sess.isCarriedForward || sess.carriedForwardFromSessionNumber != null || sess.remainingPortion || sess.portionsCovered) && (
                    <div
                      style={{
                        background: "rgba(245, 158, 11, 0.08)",
                        border: "1px solid rgba(245, 158, 11, 0.25)",
                        borderRadius: 8,
                        padding: "8px 12px",
                        fontSize: "0.8rem",
                        color: "#fbbf24",
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                      }}
                    >
                      {sess.carriedForwardFromSessionNumber != null && (
                        <div>
                          ↳ <strong>Carried forward from Session #{sess.carriedForwardFromSessionNumber}</strong>
                        </div>
                      )}
                      {sess.carriedForwardToSessionNumber != null && (
                        <div>
                          → <strong>Unfinished content continued in Session #{sess.carriedForwardToSessionNumber}</strong>
                        </div>
                      )}
                      {sess.portionsCovered && (
                        <div style={{ color: "#cbd5e1" }}>
                          ✓ Completed portion: <em>{sess.portionsCovered}</em>
                        </div>
                      )}
                      {sess.remainingPortion && (
                        <div style={{ color: "#fcd34d" }}>
                          ⏳ Remaining portion: <em>{sess.remainingPortion}</em>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
