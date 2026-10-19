import { useState, useEffect } from "react";
import { getScheduleSummary, getLocalTodayStr } from "./syllabusScheduleUtils";
import { getActivePlan } from "../../services/syllabusSchedulingService";

export default function SyllabusOverviewSection({
  items = [],
  coverage = null,
  versions = [],
  revisionStats = null,
  classroom = null,
  onNavigateTab,
  onOpenPublishModal,
  onNavigateToScheduling,
}) {
  const [activePlan, setActivePlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [hoveredStatus, setHoveredStatus] = useState(null);

  const classroomId = classroom?.id;

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

  const todayStr = getLocalTodayStr();
  const summary = getScheduleSummary(items, todayStr);

  const {
    totalTopics,
    completedCount,
    inProgressCount,
    upcomingCount,
    overdueCount,
    unscheduledCount,
    plannedHours,
    completedHours,
    inProgressHours,
    overdue: overdueItems,
    upcoming: upcomingItems,
  } = summary;

  const notStartedCount = Math.max(0, totalTopics - completedCount - inProgressCount);

  // Use backend coverage percentage if reliable; otherwise fallback to local summary
  const coveragePercentage =
    coverage?.coveragePercentage !== undefined && coverage?.coveragePercentage !== null
      ? Number(coverage.coveragePercentage)
      : summary.coveragePercentage;

  // Publication info from coverage or latest version in list
  const latestVersion = versions.length > 0 ? versions[0] : null;
  const versionNum = coverage?.latestVersionNumber ?? latestVersion?.versionNumber ?? null;
  const isPublished = versionNum !== null && versionNum !== undefined;
  const publishedAt = coverage?.latestPublishedAt ?? latestVersion?.publishedAt ?? null;

  // SVG Progress Ring calculations
  const radius = 48;
  const circumference = 2 * Math.PI * radius; // ~301.59
  const strokeOffset = circumference - (Math.min(100, Math.max(0, coveragePercentage)) / 100) * circumference;

  // Teaching hours calculations
  const displayPlannedHours = coverage?.estimatedTotalHours ?? plannedHours;
  const displayCompletedHours = coverage?.completedHours ?? completedHours;
  const hoursPct =
    displayPlannedHours > 0
      ? Math.min(100, Math.round((displayCompletedHours / displayPlannedHours) * 100))
      : 0;

  // Module-wise calculation
  const moduleMap = {};
  items.forEach((item) => {
    const rawUnit = item.unit ? item.unit.trim() : "General";
    if (!moduleMap[rawUnit]) {
      moduleMap[rawUnit] = { unit: rawUnit, total: 0, completed: 0, inProgress: 0, hours: 0 };
    }
    moduleMap[rawUnit].total += 1;
    moduleMap[rawUnit].hours += Number(item.estimatedHours || 0);
    if (item.status === "COMPLETED") {
      moduleMap[rawUnit].completed += 1;
    } else if (item.status === "IN_PROGRESS") {
      moduleMap[rawUnit].inProgress += 1;
    }
  });
  const moduleList = Object.values(moduleMap);

  // Active Plan Teaching Session Analytics (Planned vs Actual)
  const sessions = activePlan?.sessions || [];
  const totalSessions = sessions.length;
  const completedSessions = sessions.filter((s) => s.status === "COMPLETED").length;
  const inProgressSessions = sessions.filter((s) => s.status === "PARTIALLY_COMPLETED").length;
  const skippedSessions = sessions.filter((s) => s.status === "SKIPPED").length;
  const scheduledSessions = sessions.filter((s) => s.status === "SCHEDULED").length;
  const sessionPct = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

  // Doughnut Chart Calculations (Circumference: 2 * Math.PI * 52 ~= 326.73)
  const dRadius = 52;
  const dCircumference = 2 * Math.PI * dRadius;
  const completedPct = totalTopics > 0 ? completedCount / totalTopics : 0;
  const inProgressPct = totalTopics > 0 ? inProgressCount / totalTopics : 0;
  const notStartedPct = totalTopics > 0 ? notStartedCount / totalTopics : 0;

  const completedDash = completedPct * dCircumference;
  const inProgressDash = inProgressPct * dCircumference;
  const notStartedDash = notStartedPct * dCircumference;

  const completedOffset = 0;
  const inProgressOffset = -completedDash;
  const notStartedOffset = -(completedDash + inProgressDash);

  // INFORMATIVE EMPTY STATE WHEN NO TOPICS EXIST
  if (items.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div
          style={{
            background: "rgba(30, 27, 46, 0.7)",
            border: "1px dashed rgba(168, 85, 247, 0.35)",
            borderRadius: 20,
            padding: "48px 32px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 18,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "rgba(168, 85, 247, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "2.2rem",
            }}
          >
            📖
          </div>
          <div style={{ maxWidth: 560 }}>
            <h3 style={{ fontSize: "1.45rem", fontWeight: 800, color: "#ffffff", margin: "0 0 8px 0" }}>
              No Syllabus Topics Configured Yet
            </h3>
            <p style={{ color: "#94a3b8", fontSize: "0.92rem", lineHeight: 1.6, margin: 0 }}>
              This classroom has not yet established its curriculum topics or syllabus units. You can add topics
              manually or use the Syllabus Scheduling document intake to extract your official syllabus automatically.
            </p>
          </div>

          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center", marginTop: 8 }}>
            <button
              type="button"
              className="tsm-btn-primary"
              style={{ padding: "10px 22px", fontSize: "0.9rem" }}
              onClick={() => onNavigateTab("topics")}
            >
              + Add Topics Manually
            </button>
            {onNavigateToScheduling && (
              <button
                type="button"
                className="tsm-btn-secondary"
                style={{ padding: "10px 22px", fontSize: "0.9rem", borderColor: "rgba(56, 189, 248, 0.4)", color: "#38bdf8" }}
                onClick={onNavigateToScheduling}
              >
                📁 Open Document Intake &amp; Scheduling
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* 1. PRIMARY HERO ANALYTICS CARD WITH CIRCULAR PROGRESS RING */}
      <div className="tsm-overview-hero-card">
        <div className="tsm-circular-chart-group">
          <div className="tsm-circular-progress-wrap">
            <svg
              className="tsm-circular-svg"
              viewBox="0 0 120 120"
              role="progressbar"
              aria-valuenow={coveragePercentage}
              aria-valuemin="0"
              aria-valuemax="100"
              aria-label={`Syllabus completion: ${coveragePercentage.toFixed(1)}%`}
            >
              <defs>
                <linearGradient id="tsmCoverageGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#a855f7" />
                  <stop offset="100%" stopColor="#38bdf8" />
                </linearGradient>
              </defs>
              <circle className="tsm-circular-bg" cx="60" cy="60" r={radius} />
              <circle
                className="tsm-circular-meter"
                cx="60"
                cy="60"
                r={radius}
                strokeDasharray={circumference}
                strokeDashoffset={strokeOffset}
              />
            </svg>
            <div className="tsm-circular-text-cluster">
              <span className="tsm-circular-pct-number">{coveragePercentage.toFixed(1)}%</span>
              <span className="tsm-circular-pct-label">Coverage</span>
            </div>
          </div>

          <div className="tsm-hero-analytics-details">
            <h3 className="tsm-hero-analytics-title">Curriculum Delivery Pacing</h3>
            <p className="tsm-hero-analytics-subtitle">
              {completedCount} of {totalTopics} syllabus topics delivered across active units.
            </p>
            <div className="tsm-hero-stat-chips">
              <span className="tsm-hero-stat-chip">
                ⏱️ <strong>{displayCompletedHours}</strong> / {displayPlannedHours} Hours Taught ({hoursPct}%)
              </span>
              <span className="tsm-hero-stat-chip" style={{ color: "#34d399" }}>
                ✓ <strong>{completedCount}</strong> Completed
              </span>
              <span className="tsm-hero-stat-chip" style={{ color: "#f59e0b" }}>
                ⚡ <strong>{inProgressCount}</strong> In Progress
              </span>
              <span className="tsm-hero-stat-chip">
                📌 <strong>{notStartedCount}</strong> Remaining
              </span>
            </div>
          </div>
        </div>

        {/* TOP LEVEL ACTION BUTTONS */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" className="tsm-btn-secondary" onClick={() => onNavigateTab("topics")}>
            📋 Manage Topics &amp; Units
          </button>
          <button type="button" className="tsm-btn-primary" onClick={onOpenPublishModal}>
            🚀 {isPublished ? "Publish New Version" : "Publish v1 Snapshot"}
          </button>
        </div>
      </div>

      {/* 2. ACTIONABLE PACING CARDS GRID */}
      <div className="tsm-pacing-grid">
        {/* Card 1: In Progress */}
        <div
          className="tsm-pacing-card in-progress"
          onClick={() => onNavigateTab("schedule", "IN_PROGRESS")}
          title="Filter schedule by in-progress topics"
        >
          <div className="tsm-pacing-label">
            <span>⚡ In Progress</span>
            <span style={{ color: "#f59e0b" }}>→</span>
          </div>
          <div className="tsm-pacing-val" style={{ color: "#f59e0b" }}>
            {inProgressCount}
            <span style={{ fontSize: "0.8rem", color: "#94a3b8", fontWeight: 500 }}>topics</span>
          </div>
          <div className="tsm-pacing-subtext">Active teaching sessions underway</div>
        </div>

        {/* Card 2: Overdue */}
        <div
          className="tsm-pacing-card overdue"
          onClick={() => onNavigateTab("schedule", "OVERDUE")}
          title="Filter schedule by overdue topics"
        >
          <div className="tsm-pacing-label">
            <span>⚠️ Overdue</span>
            <span style={{ color: "#ef4444" }}>→</span>
          </div>
          <div className="tsm-pacing-val" style={{ color: overdueCount > 0 ? "#ef4444" : "#ffffff" }}>
            {overdueCount}
            <span style={{ fontSize: "0.8rem", color: "#94a3b8", fontWeight: 500 }}>topics</span>
          </div>
          <div className="tsm-pacing-subtext">
            {overdueCount > 0 ? "Passed planned deadline without completion" : "All topic deadlines on track"}
          </div>
        </div>

        {/* Card 3: Upcoming */}
        <div
          className="tsm-pacing-card upcoming"
          onClick={() => onNavigateTab("schedule", "UPCOMING")}
          title="Filter schedule by upcoming topics"
        >
          <div className="tsm-pacing-label">
            <span>🗓️ Upcoming</span>
            <span style={{ color: "#38bdf8" }}>→</span>
          </div>
          <div className="tsm-pacing-val" style={{ color: "#38bdf8" }}>
            {upcomingCount}
            <span style={{ fontSize: "0.8rem", color: "#94a3b8", fontWeight: 500 }}>topics</span>
          </div>
          <div className="tsm-pacing-subtext">Scheduled to start after today</div>
        </div>

        {/* Card 4: Unscheduled */}
        <div
          className="tsm-pacing-card unscheduled"
          onClick={() => onNavigateTab("schedule", "UNSCHEDULED")}
          title="Filter schedule by unscheduled topics"
        >
          <div className="tsm-pacing-label">
            <span>⏳ Unscheduled</span>
            <span style={{ color: "#94a3b8" }}>→</span>
          </div>
          <div className="tsm-pacing-val">
            {unscheduledCount}
            <span style={{ fontSize: "0.8rem", color: "#94a3b8", fontWeight: 500 }}>topics</span>
          </div>
          <div className="tsm-pacing-subtext">Awaiting target date assignment</div>
        </div>
      </div>

      {/* 3. VISUAL CHARTS GRID (DOUGHNUT + MODULE BARS + HOURS DELIVERY + PLANNED VS ACTUAL) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 20 }}>
        {/* CHART 1: DOUGHNUT CHART FOR TOPIC STATUS DISTRIBUTION */}
        <div className="tsm-metric-card" style={{ padding: "22px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span className="tsm-metric-label">Topic Status Distribution</span>
            <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>{totalTopics} Total Topics</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", gap: 16, flexWrap: "wrap" }}>
            {/* SVG Doughnut */}
            <div style={{ position: "relative", width: 140, height: 140 }}>
              <svg viewBox="0 0 140 140" style={{ transform: "rotate(-90deg)", width: "100%", height: "100%" }}>
                {/* Background Track */}
                <circle cx="70" cy="70" r={dRadius} fill="none" stroke="rgba(255, 255, 255, 0.06)" strokeWidth="18" />

                {/* Not Started Segment */}
                {notStartedCount > 0 && (
                  <circle
                    cx="70"
                    cy="70"
                    r={dRadius}
                    fill="none"
                    stroke="#475569"
                    strokeWidth={hoveredStatus === "not_started" ? "22" : "18"}
                    strokeDasharray={`${notStartedDash} ${dCircumference}`}
                    strokeDashoffset={notStartedOffset}
                    style={{ transition: "stroke-width 0.2s" }}
                    onMouseEnter={() => setHoveredStatus("not_started")}
                    onMouseLeave={() => setHoveredStatus(null)}
                  />
                )}

                {/* In Progress Segment */}
                {inProgressCount > 0 && (
                  <circle
                    cx="70"
                    cy="70"
                    r={dRadius}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth={hoveredStatus === "in_progress" ? "22" : "18"}
                    strokeDasharray={`${inProgressDash} ${dCircumference}`}
                    strokeDashoffset={inProgressOffset}
                    style={{ transition: "stroke-width 0.2s" }}
                    onMouseEnter={() => setHoveredStatus("in_progress")}
                    onMouseLeave={() => setHoveredStatus(null)}
                  />
                )}

                {/* Completed Segment */}
                {completedCount > 0 && (
                  <circle
                    cx="70"
                    cy="70"
                    r={dRadius}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth={hoveredStatus === "completed" ? "22" : "18"}
                    strokeDasharray={`${completedDash} ${dCircumference}`}
                    strokeDashoffset={completedOffset}
                    style={{ transition: "stroke-width 0.2s" }}
                    onMouseEnter={() => setHoveredStatus("completed")}
                    onMouseLeave={() => setHoveredStatus(null)}
                  />
                )}
              </svg>

              {/* Center Doughnut Stats */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  pointerEvents: "none",
                }}
              >
                <span style={{ fontSize: "1.35rem", fontWeight: 800, color: "#ffffff" }}>
                  {hoveredStatus === "completed"
                    ? completedCount
                    : hoveredStatus === "in_progress"
                    ? inProgressCount
                    : hoveredStatus === "not_started"
                    ? notStartedCount
                    : totalTopics}
                </span>
                <span style={{ fontSize: "0.68rem", textTransform: "uppercase", color: "#94a3b8", letterSpacing: "0.05em" }}>
                  {hoveredStatus === "completed"
                    ? "Completed"
                    : hoveredStatus === "in_progress"
                    ? "In Progress"
                    : hoveredStatus === "not_started"
                    ? "Not Started"
                    : "Topics"}
                </span>
              </div>
            </div>

            {/* Interactive Legend */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 150 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.82rem",
                  cursor: "pointer",
                  padding: "4px 8px",
                  borderRadius: 6,
                  background: hoveredStatus === "completed" ? "rgba(16, 185, 129, 0.15)" : "transparent",
                }}
                onMouseEnter={() => setHoveredStatus("completed")}
                onMouseLeave={() => setHoveredStatus(null)}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#cbd5e1" }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#10b981" }}></span>
                  Completed
                </span>
                <span style={{ fontWeight: 700, color: "#34d399" }}>
                  {completedCount} ({Math.round(completedPct * 100)}%)
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.82rem",
                  cursor: "pointer",
                  padding: "4px 8px",
                  borderRadius: 6,
                  background: hoveredStatus === "in_progress" ? "rgba(245, 158, 11, 0.15)" : "transparent",
                }}
                onMouseEnter={() => setHoveredStatus("in_progress")}
                onMouseLeave={() => setHoveredStatus(null)}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#cbd5e1" }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b" }}></span>
                  In Progress
                </span>
                <span style={{ fontWeight: 700, color: "#fbbf24" }}>
                  {inProgressCount} ({Math.round(inProgressPct * 100)}%)
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.82rem",
                  cursor: "pointer",
                  padding: "4px 8px",
                  borderRadius: 6,
                  background: hoveredStatus === "not_started" ? "rgba(100, 116, 139, 0.15)" : "transparent",
                }}
                onMouseEnter={() => setHoveredStatus("not_started")}
                onMouseLeave={() => setHoveredStatus(null)}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#cbd5e1" }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#475569" }}></span>
                  Not Started
                </span>
                <span style={{ fontWeight: 700, color: "#94a3b8" }}>
                  {notStartedCount} ({Math.round(notStartedPct * 100)}%)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* CHART 2: MODULE-WISE COMPLETION PROGRESS BARS */}
        <div className="tsm-metric-card" style={{ padding: "22px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span className="tsm-metric-label">Module / Unit-wise Completion</span>
            <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>{moduleList.length} Units</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 180, overflowY: "auto", paddingRight: 4 }}>
            {moduleList.map((m, idx) => {
              const mPct = m.total > 0 ? Math.round((m.completed / m.total) * 100) : 0;
              return (
                <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                    <span style={{ color: "#ffffff", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "65%" }}>
                      {m.unit}
                    </span>
                    <span style={{ color: mPct === 100 ? "#34d399" : "#38bdf8", fontWeight: 700, fontSize: "0.78rem" }}>
                      {m.completed}/{m.total} topics • {mPct}%
                    </span>
                  </div>

                  <div
                    style={{
                      width: "100%",
                      height: 8,
                      background: "rgba(255, 255, 255, 0.08)",
                      borderRadius: 4,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${mPct}%`,
                        height: "100%",
                        background:
                          mPct === 100
                            ? "#10b981"
                            : "linear-gradient(90deg, #9333ea, #38bdf8)",
                        borderRadius: 4,
                        transition: "width 0.4s ease",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CHART 3: TEACHING HOURS DELIVERY */}
        <div className="tsm-metric-card" style={{ padding: "22px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span className="tsm-metric-label">Teaching Hours Delivery Pacing</span>
            <span style={{ fontSize: "0.78rem", color: "#38bdf8", fontWeight: 700 }}>
              {displayCompletedHours} / {displayPlannedHours} hrs ({hoursPct}%)
            </span>
          </div>

          {/* Progress Comparison Bar */}
          <div
            style={{
              width: "100%",
              height: 14,
              background: "rgba(255, 255, 255, 0.08)",
              borderRadius: 7,
              overflow: "hidden",
              marginBottom: 14,
              display: "flex",
            }}
          >
            {displayCompletedHours > 0 && (
              <div
                style={{
                  width: `${Math.min(100, (displayCompletedHours / (displayPlannedHours || 1)) * 100)}%`,
                  background: "linear-gradient(90deg, #0284c7, #38bdf8)",
                  transition: "width 0.5s ease",
                }}
                title={`Completed: ${displayCompletedHours} hrs`}
              />
            )}
            {inProgressHours > 0 && (
              <div
                style={{
                  width: `${Math.min(100, (inProgressHours / (displayPlannedHours || 1)) * 100)}%`,
                  background: "#f59e0b",
                  transition: "width 0.5s ease",
                }}
                title={`In-progress: ${inProgressHours} hrs`}
              />
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, textAlign: "center" }}>
            <div style={{ background: "rgba(56, 189, 248, 0.08)", padding: "8px", borderRadius: 8 }}>
              <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Delivered</div>
              <div style={{ fontSize: "1rem", fontWeight: 800, color: "#38bdf8" }}>{displayCompletedHours} hrs</div>
            </div>
            <div style={{ background: "rgba(245, 158, 11, 0.08)", padding: "8px", borderRadius: 8 }}>
              <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Active</div>
              <div style={{ fontSize: "1rem", fontWeight: 800, color: "#fbbf24" }}>{inProgressHours} hrs</div>
            </div>
            <div style={{ background: "rgba(255, 255, 255, 0.05)", padding: "8px", borderRadius: 8 }}>
              <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Remaining</div>
              <div style={{ fontSize: "1rem", fontWeight: 800, color: "#ffffff" }}>
                {Math.max(0, displayPlannedHours - displayCompletedHours)} hrs
              </div>
            </div>
          </div>
        </div>

        {/* CHART 4: PLANNED VS ACTUAL TEACHING SESSIONS */}
        <div className="tsm-metric-card" style={{ padding: "22px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span className="tsm-metric-label">Planned vs Actual Sessions</span>
            <span style={{ fontSize: "0.78rem", color: activePlan ? "#34d399" : "#94a3b8" }}>
              {activePlan ? `Schedule v${activePlan.versionNumber}` : "No Schedule"}
            </span>
          </div>

          {planLoading ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: "#94a3b8", fontSize: "0.85rem" }}>
              Checking schedule session outcomes...
            </div>
          ) : totalSessions > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{
                  width: "100%",
                  height: 14,
                  background: "rgba(255, 255, 255, 0.08)",
                  borderRadius: 7,
                  overflow: "hidden",
                  display: "flex",
                }}
              >
                <div
                  style={{ width: `${(completedSessions / totalSessions) * 100}%`, background: "#10b981" }}
                  title={`Completed: ${completedSessions}`}
                />
                <div
                  style={{ width: `${(inProgressSessions / totalSessions) * 100}%`, background: "#f59e0b" }}
                  title={`Partial: ${inProgressSessions}`}
                />
                <div
                  style={{ width: `${(skippedSessions / totalSessions) * 100}%`, background: "#ef4444" }}
                  title={`Skipped: ${skippedSessions}`}
                />
                <div
                  style={{ width: `${(scheduledSessions / totalSessions) * 100}%`, background: "rgba(255, 255, 255, 0.2)" }}
                  title={`Scheduled: ${scheduledSessions}`}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, textAlign: "center" }}>
                <div style={{ background: "rgba(16, 185, 129, 0.1)", padding: "6px", borderRadius: 6 }}>
                  <div style={{ fontSize: "0.68rem", color: "#34d399" }}>Completed</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#ffffff" }}>{completedSessions}</div>
                </div>
                <div style={{ background: "rgba(245, 158, 11, 0.1)", padding: "6px", borderRadius: 6 }}>
                  <div style={{ fontSize: "0.68rem", color: "#fbbf24" }}>Partial</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#ffffff" }}>{inProgressSessions}</div>
                </div>
                <div style={{ background: "rgba(239, 68, 68, 0.1)", padding: "6px", borderRadius: 6 }}>
                  <div style={{ fontSize: "0.68rem", color: "#f87171" }}>Skipped</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#ffffff" }}>{skippedSessions}</div>
                </div>
                <div style={{ background: "rgba(255, 255, 255, 0.06)", padding: "6px", borderRadius: 6 }}>
                  <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>Remaining</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#ffffff" }}>{scheduledSessions}</div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "16px 0", color: "#94a3b8", fontSize: "0.85rem" }}>
              <p style={{ margin: "0 0 10px 0" }}>No teaching timetable schedule generated yet.</p>
              {onNavigateToScheduling && (
                <button
                  type="button"
                  className="tsm-btn-secondary"
                  style={{ padding: "5px 12px", fontSize: "0.8rem", color: "#38bdf8", borderColor: "rgba(56, 189, 248, 0.3)" }}
                  onClick={onNavigateToScheduling}
                >
                  Generate Schedule →
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 4. PUBLICATION & VERSION SUMMARY BANNER */}
      <div className="tsm-pub-banner" style={{ margin: 0 }}>
        <div className="tsm-pub-info">
          <span className="tsm-pub-icon">{isPublished ? "🌟" : "📝"}</span>
          <div>
            <div className="tsm-pub-title">
              {isPublished
                ? `Published Curriculum Version ${versionNum}`
                : "Draft Syllabus — Unpublished"}
            </div>
            <div className="tsm-pub-desc">
              {isPublished
                ? `Active student snapshot released on ${publishedAt ? new Date(publishedAt).toLocaleString() : "Confirmed"}. Draft changes will update students upon publishing the next snapshot.`
                : "Students cannot view official syllabus snapshots until Version 1 is published. You can edit topics freely in draft mode."}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" className="tsm-btn-secondary" onClick={() => onNavigateTab("publishing")}>
            📜 View Version History
          </button>
          <button type="button" className="tsm-btn-primary" onClick={onOpenPublishModal}>
            🚀 {isPublished ? "Publish New Version" : "Publish v1 Snapshot"}
          </button>
        </div>
      </div>

      {/* 5. ACTIONABLE LOWER SPLIT: OVERDUE ALERTS & UPCOMING TIMELINE */}
      <div className="tsm-overview-columns">
        {/* Overdue Alerts Panel */}
        <div className="tsm-list-panel">
          <div className="tsm-list-panel-title">
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              ⚠️ Overdue Topics ({overdueCount})
            </span>
            {overdueCount > 0 ? (
              <span className="tsm-badge tsm-badge-overdue">Requires Pacing Action</span>
            ) : (
              <span className="tsm-badge tsm-badge-completed">On Track</span>
            )}
          </div>

          {overdueItems.length === 0 ? (
            <div style={{ color: "#94a3b8", fontSize: "0.85rem", padding: "20px 0", textAlign: "center" }}>
              🎉 Excellent! No overdue topics in this classroom. All planned deadlines are met or upcoming.
            </div>
          ) : (
            overdueItems.slice(0, 4).map((t) => (
              <div key={t.id || t.topicId} className="tsm-mini-item">
                <div className="tsm-mini-item-left">
                  <span className="tsm-mini-item-title">{t.topic}</span>
                  <span className="tsm-mini-item-meta">
                    {t.unit || "General"} • Due: <strong>{t.plannedCompletionDate || "Unset"}</strong> • Status: {t.status}
                  </span>
                </div>
                <button
                  type="button"
                  className="tsm-btn-secondary"
                  style={{ padding: "3px 8px", fontSize: "0.75rem", color: "#f87171", borderColor: "rgba(239, 68, 68, 0.3)" }}
                  onClick={() => onNavigateTab("schedule", "OVERDUE")}
                >
                  Inspect →
                </button>
              </div>
            ))
          )}
        </div>

        {/* Upcoming Timeline Panel */}
        <div className="tsm-list-panel">
          <div className="tsm-list-panel-title">
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              🗓️ Upcoming Topics ({upcomingCount})
            </span>
            <button
              type="button"
              className="tsm-btn-secondary"
              style={{ padding: "3px 8px", fontSize: "0.75rem" }}
              onClick={() => onNavigateTab("schedule", "UPCOMING")}
            >
              Full Schedule →
            </button>
          </div>

          {upcomingItems.length === 0 ? (
            <div style={{ color: "#94a3b8", fontSize: "0.85rem", padding: "20px 0", textAlign: "center" }}>
              No scheduled upcoming topics found starting after today.
            </div>
          ) : (
            upcomingItems.slice(0, 4).map((t) => (
              <div key={t.id || t.topicId} className="tsm-mini-item">
                <div className="tsm-mini-item-left">
                  <span className="tsm-mini-item-title">{t.topic}</span>
                  <span className="tsm-mini-item-meta">
                    {t.unit || "General"} • Starts: <strong>{t.plannedStartDate || "TBD"}</strong> • Est: {t.estimatedHours || 0} hrs
                  </span>
                </div>
                <span className="tsm-badge tsm-badge-upcoming">Upcoming</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 6. REAL STUDENT REVISION & UNDERSTANDING PARTICIPATION */}
      {revisionStats && (
        <div className="tsm-revision-panel">
          <div className="tsm-revision-header">
            <div>
              <span className="tsm-badge tsm-badge-published" style={{ marginBottom: 4, display: "inline-block" }}>
                STUDENT COHORT SIGNALS
              </span>
              <h4 style={{ margin: "2px 0 0 0", color: "#ffffff", fontSize: "1.05rem" }}>
                Classroom Revision &amp; Understanding Aggregate
              </h4>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: "0.82rem" }}>
              <span style={{ color: "#cbd5e1" }}>
                Enrolled: <strong>{revisionStats.enrolledStudentsCount || 0}</strong>
              </span>
              <span style={{ color: "#38bdf8" }}>
                Participating: <strong>{revisionStats.participatingStudentsCount || 0}</strong>
              </span>
              <span style={{ color: "#34d399" }}>
                Avg Revision: <strong>{revisionStats.classAverageRevisionPercentage != null ? `${revisionStats.classAverageRevisionPercentage}%` : "N/A"}</strong>
              </span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginTop: 4 }}>
            <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255, 255, 255, 0.06)" }}>
              <span style={{ fontSize: "0.72rem", color: "#34d399", fontWeight: 700 }}>CONFIDENT</span>
              <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#ffffff", marginTop: 2 }}>
                {revisionStats.understandingStatusDistribution?.CONFIDENT || 0}
              </div>
            </div>

            <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255, 255, 255, 0.06)" }}>
              <span style={{ fontSize: "0.72rem", color: "#38bdf8", fontWeight: 700 }}>UNDERSTOOD</span>
              <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#ffffff", marginTop: 2 }}>
                {revisionStats.understandingStatusDistribution?.UNDERSTOOD || 0}
              </div>
            </div>

            <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255, 255, 255, 0.06)" }}>
              <span style={{ fontSize: "0.72rem", color: "#f59e0b", fontWeight: 700 }}>NEEDS REVISION</span>
              <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#ffffff", marginTop: 2 }}>
                {revisionStats.understandingStatusDistribution?.NEEDS_REVISION || 0}
              </div>
            </div>

            <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255, 255, 255, 0.06)" }}>
              <span style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 700 }}>NOT ASSESSED</span>
              <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#ffffff", marginTop: 2 }}>
                {revisionStats.understandingStatusDistribution?.NOT_ASSESSED || 0}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. SYLLABUS SCHEDULING CALLOUT BANNER */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(56, 189, 248, 0.1), rgba(168, 85, 247, 0.12))",
          border: "1px dashed rgba(56, 189, 248, 0.3)",
          borderRadius: 14,
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: "1.6rem" }}>🗓️</span>
          <div>
            <div style={{ fontWeight: 700, color: "#ffffff", fontSize: "0.95rem" }}>
              Timetable-Aware Syllabus Scheduling Architecture
            </div>
            <div style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
              Explore the automated scheduling pipeline to align teaching hours with institutional class timetables and holiday calendars.
            </div>
          </div>
        </div>

        {onNavigateToScheduling && (
          <button
            type="button"
            className="tsm-btn-secondary"
            style={{ padding: "6px 14px", fontSize: "0.82rem", borderColor: "rgba(56, 189, 248, 0.4)", color: "#38bdf8" }}
            onClick={onNavigateToScheduling}
          >
            Open Syllabus Scheduling →
          </button>
        )}
      </div>
    </div>
  );
}
