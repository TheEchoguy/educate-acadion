import React, { useState, useEffect } from "react";
import {
  getClassroomAnalyticsSummary,
  getStudentFourLevelAnalytics,
} from "../../services/classroomService";
import "./TeacherClassAnalyticsView.css";

const TeacherClassAnalyticsView = ({ classroomId, classroomName }) => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [topicFilter, setTopicFilter] = useState("ALL"); // ALL | WEAK | STRONG

  // Drilldown Modal State
  const [selectedStudentUsn, setSelectedStudentUsn] = useState(null);
  const [drilldownData, setDrilldownData] = useState(null);
  const [loadingDrilldown, setLoadingDrilldown] = useState(false);
  const [drilldownError, setDrilldownError] = useState(null);

  useEffect(() => {
    let active = true;
    if (classroomId) {
      setLoading(true);
      setError(null);
      getClassroomAnalyticsSummary(classroomId)
        .then((data) => {
          if (active) {
            setSummary(data);
            setLoading(false);
          }
        })
        .catch((err) => {
          console.error("Failed to load class analytics:", err);
          if (active) {
            setError(
              err.response?.data?.message ||
                "Failed to load class-wide analytics summary."
            );
            setLoading(false);
          }
        });
    }
    return () => {
      active = false;
    };
  }, [classroomId]);

  // Open 4-Level Drilldown Modal for Student
  const handleInspectStudent = async (usn) => {
    setSelectedStudentUsn(usn);
    setLoadingDrilldown(true);
    setDrilldownError(null);
    try {
      const data = await getStudentFourLevelAnalytics(classroomId, usn);
      setDrilldownData(data);
    } catch (err) {
      console.error("Failed to load student drilldown:", err);
      setDrilldownError(
        err.response?.data?.message || "Failed to load student 4-level analytics."
      );
    } finally {
      setLoadingDrilldown(false);
    }
  };

  const closeDrilldownModal = () => {
    setSelectedStudentUsn(null);
    setDrilldownData(null);
    setDrilldownError(null);
  };

  if (loading) {
    return (
      <div className="tca-loading-container">
        <div className="tca-spinner" />
        <p>Crunching class-wide 4-level performance analytics...</p>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="tca-empty-card">
        <div className="tca-empty-icon">📊</div>
        <h3>Class Analytics Not Available</h3>
        <p>
          {error ||
            "Please upload question paper blueprints and student IA marks to generate whole-class diagnostic analytics."}
        </p>
      </div>
    );
  }

  const {
    enrolledStudentsCount = 0,
    evaluatedStudentsCount = 0,
    topicHeatmap = [],
    moduleAverages = {},
    studentDistribution = {},
    lowestPerformingTopics = [],
    studentSummaries = [],
  } = summary;

  const {
    strongCount = 0,
    moderateCount = 0,
    needsSupportCount = 0,
    classAverageIa = 0,
    classAverageCie = 0,
  } = studentDistribution;

  const totalEvaluated = Math.max(1, evaluatedStudentsCount);
  const strongPct = Math.round((strongCount / totalEvaluated) * 100);
  const modPct = Math.round((moderateCount / totalEvaluated) * 100);
  const weakPct = Math.round((needsSupportCount / totalEvaluated) * 100);

  // Filter topics
  const filteredTopics = topicHeatmap.filter((t) => {
    if (topicFilter === "WEAK") return t.classAveragePercentage < 50;
    if (topicFilter === "STRONG") return t.classAveragePercentage >= 75;
    return true;
  });

  // Filter students
  const filteredStudents = studentSummaries.filter((st) => {
    const q = searchQuery.toLowerCase().trim();
    const matchQuery =
      !q ||
      (st.usn && st.usn.toLowerCase().includes(q)) ||
      (st.studentName && st.studentName.toLowerCase().includes(q)) ||
      (st.weakestTopic && st.weakestTopic.toLowerCase().includes(q));

    const matchStatus =
      statusFilter === "ALL" || st.overallStatus === statusFilter;

    return matchQuery && matchStatus;
  });

  return (
    <div className="tca-container">
      {/* 1. TOP HERO STATS & DISTRIBUTION */}
      <div className="tca-hero-banner">
        <div className="tca-hero-left">
          <div className="tca-badge-engine">
            🎯 4-Level Hierarchical Performance Analytics Engine
          </div>
          <h2>Whole-Class Diagnostic Overview</h2>
          <p className="tca-hero-sub">
            Real-time multi-dimensional intelligence synthesized across atomic topics, syllabus modules, scaled CIE, and semester trajectory.
          </p>

          <div className="tca-quick-metrics">
            <div className="tca-metric-pill">
              <span className="tca-metric-label">Enrolled / Evaluated</span>
              <span className="tca-metric-val">
                {evaluatedStudentsCount} / {enrolledStudentsCount}
              </span>
            </div>
            <div className="tca-metric-pill">
              <span className="tca-metric-label">Class Avg IA</span>
              <span className="tca-metric-val highlight">
                {classAverageIa.toFixed(1)} / 40.0
              </span>
            </div>
            <div className="tca-metric-pill">
              <span className="tca-metric-label">Class Scaled CIE</span>
              <span className="tca-metric-val highlight-green">
                {classAverageCie.toFixed(1)} / 15.0
              </span>
            </div>
          </div>
        </div>

        {/* DISTRIBUTION BAR CARD */}
        <div className="tca-dist-card">
          <div className="tca-dist-header">
            <span className="tca-dist-title">Cohort Mastery Distribution</span>
            <span className="tca-dist-total">{evaluatedStudentsCount} Students</span>
          </div>

          <div className="tca-dist-stacked-bar">
            {strongPct > 0 && (
              <div
                className="tca-bar-segment strong"
                style={{ width: `${strongPct}%` }}
                title={`Strong: ${strongCount} (${strongPct}%)`}
              />
            )}
            {modPct > 0 && (
              <div
                className="tca-bar-segment mod"
                style={{ width: `${modPct}%` }}
                title={`Moderate: ${moderateCount} (${modPct}%)`}
              />
            )}
            {weakPct > 0 && (
              <div
                className="tca-bar-segment weak"
                style={{ width: `${weakPct}%` }}
                title={`Needs Support: ${needsSupportCount} (${weakPct}%)`}
              />
            )}
          </div>

          <div className="tca-dist-legend">
            <div className="tca-legend-item">
              <span className="dot dot-strong" />
              <span>Strong (≥75%): <strong>{strongCount}</strong> ({strongPct}%)</span>
            </div>
            <div className="tca-legend-item">
              <span className="dot dot-mod" />
              <span>Moderate (50-74%): <strong>{moderateCount}</strong> ({modPct}%)</span>
            </div>
            <div className="tca-legend-item">
              <span className="dot dot-weak" />
              <span>Needs Support (&lt;50%): <strong>{needsSupportCount}</strong> ({weakPct}%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* ALERT: LOWEST PERFORMING TOPICS */}
      {lowestPerformingTopics && lowestPerformingTopics.length > 0 && (
        <div className="tca-alert-banner">
          <div className="tca-alert-icon">⚠️</div>
          <div className="tca-alert-content">
            <h4>Class Weak Areas Requiring Immediate Pedagogical Revision</h4>
            <p>
              The following universal topics scored below 50% across student submissions:
            </p>
            <div className="tca-topic-chips">
              {lowestPerformingTopics.map((tp, idx) => (
                <span key={idx} className="tca-weak-chip">
                  🔴 {tp}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. CARD 1: CLASS TOPIC PERFORMANCE HEATMAP */}
      <div className="tca-section-card">
        <div className="tca-card-header">
          <div>
            <h3 className="tca-card-title">
              🔥 Card 1: Universal Topic Performance Heatmap
            </h3>
            <p className="tca-card-subtitle">
              Ranked from weakest to strongest. Helps identify specific concepts where students struggle the most.
            </p>
          </div>
          <div className="tca-filter-group">
            <button
              type="button"
              className={`tca-tab-btn ${topicFilter === "ALL" ? "active" : ""}`}
              onClick={() => setTopicFilter("ALL")}
            >
              All Topics ({topicHeatmap.length})
            </button>
            <button
              type="button"
              className={`tca-tab-btn ${topicFilter === "WEAK" ? "active" : ""}`}
              onClick={() => setTopicFilter("WEAK")}
            >
              Weak Areas &lt;50%
            </button>
            <button
              type="button"
              className={`tca-tab-btn ${topicFilter === "STRONG" ? "active" : ""}`}
              onClick={() => setTopicFilter("STRONG")}
            >
              Strong ≥75%
            </button>
          </div>
        </div>

        {filteredTopics.length === 0 ? (
          <div className="tca-empty-small">
            No topics matching the selected filter.
          </div>
        ) : (
          <div className="tca-heatmap-grid">
            {filteredTopics.map((topic, idx) => {
              const pct = topic.classAveragePercentage;
              const isWeak = pct < 50;
              const isMod = pct >= 50 && pct < 75;
              const barClass = isWeak ? "bar-weak" : isMod ? "bar-mod" : "bar-strong";
              const badgeClass = isWeak
                ? "badge-weak"
                : isMod
                ? "badge-mod"
                : "badge-strong";

              return (
                <div key={idx} className={`tca-heatmap-item ${isWeak ? "item-weak" : ""}`}>
                  <div className="tca-item-top">
                    <span className="tca-item-code">Q{topic.code.toUpperCase()}</span>
                    <span className="tca-item-module">Module {topic.moduleNumber}</span>
                    {topic.co && <span className="tca-item-co">{topic.co}</span>}
                    <span className={`tca-item-status ${badgeClass}`}>
                      {topic.status}
                    </span>
                  </div>

                  <div className="tca-item-title" title={topic.topicName}>
                    {topic.topicName}
                  </div>

                  <div className="tca-item-bar-row">
                    <div className="tca-item-bar-bg">
                      <div
                        className={`tca-item-bar-fill ${barClass}`}
                        style={{ width: `${Math.min(100, Math.max(5, pct))}%` }}
                      />
                    </div>
                    <span className="tca-item-pct">{pct.toFixed(1)}%</span>
                  </div>

                  <div className="tca-item-footer">
                    <span>
                      Attempted: <strong>{topic.studentsAttemptedCount}</strong>
                    </span>
                    {topic.weakStudentsCount > 0 ? (
                      <span className="tca-weak-count">
                        ⚠️ <strong>{topic.weakStudentsCount}</strong> scored &lt;50%
                      </span>
                    ) : (
                      <span className="tca-success-count">
                        ✅ 0 weak students
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. CARD 2: MODULES 1–5 MASTERY PROGRESS */}
      <div className="tca-section-card">
        <div className="tca-card-header">
          <div>
            <h3 className="tca-card-title">
              📚 Card 2: Modules 1–5 Syllabus Mastery Progress
            </h3>
            <p className="tca-card-subtitle">
              Cumulative syllabus unit performance across all evaluated internal tests.
            </p>
          </div>
        </div>

        <div className="tca-modules-grid">
          {[1, 2, 3, 4, 5].map((modNum) => {
            const avg = moduleAverages[modNum] !== undefined ? moduleAverages[modNum] : 0;
            const hasData = moduleAverages[modNum] !== undefined;
            const isHigh = avg >= 75;
            const isMed = avg >= 50 && avg < 75;
            const modClass = !hasData ? "pending" : isHigh ? "strong" : isMed ? "mod" : "weak";

            return (
              <div key={modNum} className={`tca-module-box ${modClass}`}>
                <div className="tca-mod-header">
                  <span className="tca-mod-num">MODULE {modNum}</span>
                  <span className={`tca-mod-pct-badge ${modClass}`}>
                    {hasData ? `${avg.toFixed(1)}%` : "Pending"}
                  </span>
                </div>

                <div className="tca-mod-bar-bg">
                  <div
                    className={`tca-mod-bar-fill ${modClass}`}
                    style={{ width: `${hasData ? Math.min(100, avg) : 0}%` }}
                  />
                </div>

                <div className="tca-mod-status-label">
                  {!hasData
                    ? "Pending Evaluation"
                    : isHigh
                    ? "🌟 High Mastery"
                    : isMed
                    ? "👍 Satisfactory"
                    : "⚠️ Needs Reinforcement"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. CARD 3: STUDENT PERFORMANCE TABLE WITH 4-LEVEL INSPECT */}
      <div className="tca-section-card">
        <div className="tca-card-header">
          <div>
            <h3 className="tca-card-title">
              👥 Card 3: Student Performance Table & 4-Level Drilldown
            </h3>
            <p className="tca-card-subtitle">
              Inspect individual student breakdowns across atomic questions, syllabus modules, CIE standing, and projected SEE requirements.
            </p>
          </div>

          <div className="tca-search-row">
            <input
              type="text"
              placeholder="Search by USN or Name..."
              className="tca-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              className="tca-status-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Cohort Statuses</option>
              <option value="STRONG">Strong (≥75%)</option>
              <option value="MODERATE">Moderate (50-74%)</option>
              <option value="NEEDS_SUPPORT">Needs Support (&lt;50%)</option>
            </select>
          </div>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="tca-empty-small">
            No students found matching your filter criteria.
          </div>
        ) : (
          <div className="tca-table-wrap">
            <table className="tca-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>USN</th>
                  <th>Student Name</th>
                  <th>IA Total (/40)</th>
                  <th>Scaled CIE (/15)</th>
                  <th>Weakest Academic Topic</th>
                  <th>Standing</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((st, idx) => {
                  const isWeak = st.overallStatus === "NEEDS_SUPPORT";
                  const isStrong = st.overallStatus === "STRONG";
                  const statusClass = isWeak
                    ? "tag-weak"
                    : isStrong
                    ? "tag-strong"
                    : "tag-mod";

                  return (
                    <tr key={st.usn || idx}>
                      <td className="tca-cell-muted">{idx + 1}</td>
                      <td>
                        <span className="tca-usn-pill">{st.usn}</span>
                      </td>
                      <td className="tca-name-cell">{st.studentName}</td>
                      <td className="tca-num-cell">
                        <strong>{st.iaTotal.toFixed(1)}</strong> / 40.0
                      </td>
                      <td className="tca-num-cell highlight-cie">
                        <strong>{st.scaledCie.toFixed(1)}</strong> / 15.0
                      </td>
                      <td>
                        {st.weakestTopic ? (
                          <span className="tca-weakest-badge" title={st.weakestTopic}>
                            ⚠️ {st.weakestTopic} ({st.weakestTopicPercentage.toFixed(0)}%)
                          </span>
                        ) : (
                          <span className="tca-none-badge">All ≥ 50%</span>
                        )}
                      </td>
                      <td>
                        <span className={`tca-status-tag ${statusClass}`}>
                          {st.overallStatus === "NEEDS_SUPPORT"
                            ? "Needs Support"
                            : st.overallStatus === "STRONG"
                            ? "Strong"
                            : "Moderate"}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="tca-inspect-btn"
                          onClick={() => handleInspectStudent(st.usn)}
                          title="Open 4-Level Drilldown"
                        >
                          🔍 Inspect 4-Level Drilldown
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. 4-LEVEL DRILLDOWN MODAL */}
      {selectedStudentUsn && (
        <div className="tca-modal-overlay" onClick={closeDrilldownModal}>
          <div
            className="tca-modal-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tca-modal-header">
              <div>
                <span className="tca-modal-badge">
                  Level 1 → Level 2 → Level 3 → Level 4 Drilldown
                </span>
                <h3 className="tca-modal-title">
                  {drilldownData?.studentName || "Student Performance Details"}
                </h3>
                <span className="tca-modal-usn">USN: {selectedStudentUsn}</span>
              </div>
              <button
                type="button"
                className="tca-modal-close"
                onClick={closeDrilldownModal}
              >
                ✕
              </button>
            </div>

            <div className="tca-modal-body">
              {loadingDrilldown ? (
                <div className="tca-loading-modal">
                  <div className="tca-spinner" />
                  <p>Synthesizing complete 4-level diagnostic report...</p>
                </div>
              ) : drilldownError ? (
                <div className="tca-error-modal">
                  <p>{drilldownError}</p>
                </div>
              ) : drilldownData ? (
                <div className="tca-drilldown-stack">
                  {/* LEVEL 4: SEMESTER STANDING & ADVICE (TOP SUMMARY) */}
                  {drilldownData.level4Semester && (
                    <div className="tca-level-card level-4">
                      <div className="tca-level-tag">
                        LEVEL 4: SEMESTER ACADEMIC TRAJECTORY
                      </div>
                      <div className="tca-level4-row">
                        <div>
                          <span className="tca-lbl">GPA Trajectory:</span>
                          <span className="tca-val-badge">
                            {drilldownData.level4Semester.gpaTrajectory?.replace(/_/g, " ")}
                          </span>
                        </div>
                        <div>
                          <span className="tca-lbl">Risk Category:</span>
                          <span
                            className={`tca-risk-chip ${
                              drilldownData.level4Semester.overallRiskCategory === "HIGH"
                                ? "risk-high"
                                : drilldownData.level4Semester.overallRiskCategory === "MEDIUM"
                                ? "risk-med"
                                : "risk-low"
                            }`}
                          >
                            {drilldownData.level4Semester.overallRiskCategory} RISK
                          </span>
                        </div>
                      </div>
                      <p className="tca-advice-text">
                        💡 <strong>Academic Advice:</strong>{" "}
                        {drilldownData.level4Semester.academicAdvice}
                      </p>
                    </div>
                  )}

                  {/* LEVEL 3: SUBJECT STANDING & PROJECTED SEE TARGET */}
                  {drilldownData.level3Subject && (
                    <div className="tca-level-card level-3">
                      <div className="tca-level-tag">
                        LEVEL 3: SUBJECT CIE STANDING & TARGET SEE PROJECTION
                      </div>
                      <div className="tca-level3-grid">
                        <div className="tca-stat-item">
                          <span className="tca-stat-title">Raw IA Average</span>
                          <span className="tca-stat-val">
                            {drilldownData.level3Subject.rawIaAverage?.toFixed(1)} / 40.0
                          </span>
                        </div>
                        <div className="tca-stat-item">
                          <span className="tca-stat-title">Scaled IA Score</span>
                          <span className="tca-stat-val highlight">
                            {drilldownData.level3Subject.scaledIaScore?.toFixed(1)} / 15.0
                          </span>
                        </div>
                        <div className="tca-stat-item">
                          <span className="tca-stat-title">Assignments</span>
                          <span className="tca-stat-val">
                            {drilldownData.level3Subject.assignmentScore?.toFixed(1)} / 5.0
                          </span>
                        </div>
                        <div className="tca-stat-item">
                          <span className="tca-stat-title">Total CIE Secured</span>
                          <span className="tca-stat-val highlight-green">
                            {drilldownData.level3Subject.totalCieSecured?.toFixed(1)} / 50.0
                          </span>
                        </div>
                      </div>
                      <div className="tca-see-projection-box">
                        🎯 <strong>Projected Target for SEE Exam:</strong>{" "}
                        {drilldownData.level3Subject.seeProjectedTarget}
                      </div>
                    </div>
                  )}

                  {/* LEVEL 2: MODULE-WISE MASTERY */}
                  {drilldownData.level2Modules && (
                    <div className="tca-level-card level-2">
                      <div className="tca-level-tag">
                        LEVEL 2: MODULE MASTERY (MODULES 1 TO 5)
                      </div>
                      <div className="tca-mod-drill-grid">
                        {Object.entries(drilldownData.level2Modules).map(([mNum, mod]) => (
                          <div key={mNum} className="tca-mod-drill-box">
                            <div className="tca-mod-drill-head">
                              <span>Module {mod.moduleNumber}</span>
                              <span className="tca-mod-pct-mini">
                                {mod.percentage?.toFixed(0)}%
                              </span>
                            </div>
                            <div className="tca-item-bar-bg" style={{ height: 6 }}>
                              <div
                                className="tca-item-bar-fill"
                                style={{
                                  width: `${Math.min(100, mod.percentage || 0)}%`,
                                  background:
                                    mod.percentage >= 75
                                      ? "#10b981"
                                      : mod.percentage >= 50
                                      ? "#f59e0b"
                                      : "#ef4444",
                                }}
                              />
                            </div>
                            <div className="tca-mod-drill-sub">
                              {mod.totalObtained?.toFixed(1)} / {mod.totalMax?.toFixed(1)} M
                              {mod.weakTopicsCount > 0 && (
                                <span className="tca-drill-weak">
                                  ({mod.weakTopicsCount} weak)
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* LEVEL 1: ATOMIC TOPIC-LEVEL BREAKDOWN */}
                  {drilldownData.level1Topics && (
                    <div className="tca-level-card level-1">
                      <div className="tca-level-tag">
                        LEVEL 1: ATOMIC TOPIC-LEVEL BREAKDOWN
                      </div>
                      <div className="tca-topic-table-wrap">
                        <table className="tca-topic-table">
                          <thead>
                            <tr>
                              <th>Code</th>
                              <th>Module</th>
                              <th>Topic Name</th>
                              <th>Marks</th>
                              <th>%</th>
                              <th>Status</th>
                              <th>Guidance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {drilldownData.level1Topics.map((t, idx) => {
                              const isWeak = t.status === "WEAK";
                              return (
                                <tr key={idx} className={isWeak ? "tr-weak" : ""}>
                                  <td>
                                    <span className="tca-q-code">Q{t.code}</span>
                                  </td>
                                  <td>Mod {t.moduleNumber}</td>
                                  <td className="tca-topic-cell">
                                    <strong>{t.topicName}</strong>
                                  </td>
                                  <td>
                                    {t.marksObtained?.toFixed(1)} / {t.maxMarks?.toFixed(1)}
                                  </td>
                                  <td>
                                    <strong>{t.percentage?.toFixed(0)}%</strong>
                                  </td>
                                  <td>
                                    <span
                                      className={`tca-status-pill ${
                                        isWeak
                                          ? "pill-weak"
                                          : t.status === "STRONG"
                                          ? "pill-strong"
                                          : "pill-mod"
                                      }`}
                                    >
                                      {t.status}
                                    </span>
                                  </td>
                                  <td className="tca-rec-cell">
                                    {t.recommendation || "—"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="tca-modal-footer">
              <button
                type="button"
                className="tca-btn-close-modal"
                onClick={closeDrilldownModal}
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherClassAnalyticsView;
