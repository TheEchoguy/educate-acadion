import React, { useState, useEffect, useMemo } from "react";
import {
  getClassroomAnalyticsSummary,
  getStudentFourLevelAnalytics,
} from "../../services/classroomService";
import "./TeacherClassAnalyticsView.css";

/**
 * Interactive SVG Donut / Pie Chart with hover highlights, central stat, and colored legend.
 */
const InteractiveDonutChart = ({ data, totalLabel, totalValue, size = 180 }) => {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const total = data.reduce((acc, d) => acc + (d.value || 0), 0);
  const strokeWidth = 32;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;

  let cumulativeAngle = -90; // Start at 12 o'clock

  const slices = data.map((d, idx) => {
    const value = d.value || 0;
    const percentage = total > 0 ? (value / total) * 100 : 0;
    const angle = total > 0 ? (value / total) * 360 : 0;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + angle;
    cumulativeAngle += angle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);
    const largeArc = angle > 180 ? 1 : 0;

    const pathData =
      angle >= 359.99
        ? `M ${center} ${center - radius} A ${radius} ${radius} 0 1 1 ${center - 0.001} ${center - radius}`
        : `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;

    return {
      ...d,
      pathData,
      percentage: Number(percentage.toFixed(1)),
      index: idx,
    };
  });

  return (
    <div className="tca-donut-chart-wrapper">
      <div className="tca-donut-svg-container" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {total === 0 && (
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth={strokeWidth}
            />
          )}

          {slices.map((slice, idx) => {
            if (slice.value <= 0) return null;
            const isHovered = hoveredIndex === idx;

            return (
              <path
                key={idx}
                d={slice.pathData}
                fill="none"
                stroke={slice.color}
                strokeWidth={isHovered ? strokeWidth + 6 : strokeWidth}
                strokeLinecap="round"
                className="tca-donut-slice"
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{
                  transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                  cursor: "pointer",
                  filter: isHovered ? `drop-shadow(0 0 8px ${slice.color})` : "none",
                }}
              />
            );
          })}

          <text
            x={center}
            y={center - 4}
            textAnchor="middle"
            className="tca-donut-center-val"
          >
            {hoveredIndex !== null && slices[hoveredIndex]
              ? `${slices[hoveredIndex].percentage}%`
              : totalValue}
          </text>
          <text
            x={center}
            y={center + 14}
            textAnchor="middle"
            className="tca-donut-center-lbl"
          >
            {hoveredIndex !== null && slices[hoveredIndex]
              ? `${slices[hoveredIndex].label} (${slices[hoveredIndex].value})`
              : totalLabel}
          </text>
        </svg>
      </div>

      <div className="tca-donut-legend">
        {data.map((item, idx) => {
          const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
          const isHovered = hoveredIndex === idx;
          return (
            <div
              key={idx}
              className={`tca-legend-row ${isHovered ? "legend-hovered" : ""}`}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <span
                className="tca-legend-dot"
                style={{ backgroundColor: item.color }}
              />
              <span className="tca-legend-name">{item.label}</span>
              <strong className="tca-legend-val">{item.value}</strong>
              <span className="tca-legend-pct">({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Sub-Question Line Indicator displaying average score among attempted students
 * across 3 color-divided performance threshold ranges (Low <40%, Med 40-75%, High ≥75%).
 */
const SubQuestionLineIndicator = ({ subData, label }) => {
  if (!subData) return null;
  const avg = subData.averageScore || 0;
  const max = subData.maxMarks || 10.0;
  const pct = Math.min(100, Math.max(0, (avg / max) * 100));

  let statusColor = "#10b981";
  if (pct < 40) {
    statusColor = "#ef4444";
  } else if (pct < 75) {
    statusColor = "#f59e0b";
  }

  return (
    <div className="tca-line-indicator-card">
      <div className="tca-line-indicator-head">
        <div className="tca-subq-badge-wrap">
          <span className="tca-subq-pill">{label || subData.code}</span>
          <span className="tca-subq-topic" title={subData.topicName}>
            {subData.topicName}
          </span>
        </div>
        <div
          className="tca-subq-score-badge"
          style={{ borderColor: `${statusColor}66`, color: statusColor }}
        >
          Avg: <strong>{avg.toFixed(1)}</strong> / {max.toFixed(0)} M ({pct.toFixed(0)}%)
        </div>
      </div>

      {/* Tri-color threshold bar (Low 40%, Med 35%, High 25%) */}
      <div className="tca-threshold-bar-container">
        <div className="tca-threshold-track">
          <div className="tca-threshold-zone zone-low" title="Low Range: 0 - 4.0 Marks (0-40%)" />
          <div className="tca-threshold-zone zone-med" title="Medium Range: 4.0 - 7.5 Marks (40-75%)" />
          <div className="tca-threshold-zone zone-high" title="High Range: 7.5 - 10.0 Marks (75-100%)" />
        </div>

        {/* Dynamic needle pointer marker */}
        <div
          className="tca-threshold-needle"
          style={{ left: `${pct}%`, borderColor: statusColor }}
        >
          <div className="tca-needle-pin" style={{ backgroundColor: statusColor }} />
          <div className="tca-needle-tooltip" style={{ color: statusColor }}>
            {avg.toFixed(1)}M
          </div>
        </div>

        <div className="tca-threshold-labels">
          <span>0M (Low)</span>
          <span>4M (Med)</span>
          <span>7.5M (High)</span>
          <span>10M</span>
        </div>
      </div>

      <div className="tca-line-indicator-meta">
        <span>
          Attempted: <strong>{subData.attemptedCount || 0}</strong> students
        </span>
        <span>
          Weak (&lt;50%):{" "}
          <strong style={{ color: subData.weakCount > 0 ? "#f87171" : "#34d399" }}>
            {subData.weakCount || 0}
          </strong>{" "}
          students
        </span>
      </div>
    </div>
  );
};

const TeacherClassAnalyticsView = ({ classroomId, classroomName }) => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [topicFilter, setTopicFilter] = useState("ALL"); // ALL | WEAK | STRONG
  const [selectedQuestionView, setSelectedQuestionView] = useState("Overall"); // "Overall" | "Q1" | "Q2" | "Q3" | "Q4"
  const [selectedSubQuestion, setSelectedSubQuestion] = useState(null); // e.g. "1a", "2b"

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

  const {
    enrolledStudentsCount = 0,
    evaluatedStudentsCount = 0,
    topicHeatmap = [],
    moduleAverages = {},
    studentDistribution = {},
    lowestPerformingTopics = [],
    studentSummaries = [],
  } = summary || {};

  const {
    strongCount = 0,
    moderateCount = 0,
    needsSupportCount = 0,
    classAverageIa = 0,
    classAverageCie = 0,
  } = studentDistribution || {};

  const totalEvaluated = Math.max(1, evaluatedStudentsCount);
  const strongPct = Math.round((strongCount / totalEvaluated) * 100);
  const modPct = Math.round((moderateCount / totalEvaluated) * 100);
  const weakPct = Math.round((needsSupportCount / totalEvaluated) * 100);

  // Filter topics memoized
  const filteredTopics = useMemo(() => {
    return (topicHeatmap || []).filter((t) => {
      if (topicFilter === "WEAK") return t.classAveragePercentage < 50;
      if (topicFilter === "STRONG") return t.classAveragePercentage >= 75;
      return true;
    });
  }, [topicHeatmap, topicFilter]);

  // Filter students memoized
  const filteredStudents = useMemo(() => {
    return (studentSummaries || []).filter((st) => {
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
  }, [studentSummaries, searchQuery, statusFilter]);

  // Question-level interactive analytics derivation (Q1, Q2, Q3, Q4)
  const questionsData = useMemo(() => {
    if (summary?.questionList && summary.questionList.length > 0) {
      return summary.questionList;
    }
    if (summary?.questionAnalytics && Object.keys(summary.questionAnalytics).length > 0) {
      return ["Q1", "Q2", "Q3", "Q4"]
        .map((qId) => summary.questionAnalytics[qId])
        .filter(Boolean);
    }
    // Fallback derivation from topicHeatmap
    const qMap = {};
    ["Q1", "Q2", "Q3", "Q4"].forEach((qId, idx) => {
      const num = qId.substring(1);
      const mod = idx < 2 ? 1 : 2;
      const subA = (summary?.topicHeatmap || []).find((t) => t.code && t.code.toLowerCase().startsWith(num + "a"));
      const subB = (summary?.topicHeatmap || []).find((t) => t.code && t.code.toLowerCase().startsWith(num + "b"));
      const attemptsA = subA?.studentsAttemptedCount || 0;
      const attemptsB = subB?.studentsAttemptedCount || 0;
      const totalAttempts = Math.max(attemptsA, attemptsB);
      const weakA = subA?.weakStudentsCount || 0;
      const weakB = subB?.weakStudentsCount || 0;
      const avgA = subA?.classAveragePercentage ? (subA.classAveragePercentage / 10.0) : 0;
      const avgB = subB?.classAveragePercentage ? (subB.classAveragePercentage / 10.0) : 0;
      const avgScore = avgA + avgB;
      const avgPct = (avgScore / 20.0) * 100.0;
      const totalWeak = Math.max(weakA, weakB);

      qMap[qId] = {
        questionNumber: qId,
        moduleNumber: mod,
        attemptedCount: totalAttempts,
        weakCount: totalWeak,
        averageScore: Number(avgScore.toFixed(1)),
        averagePercentage: Number(avgPct.toFixed(1)),
        status: avgPct >= 75 ? "STRONG" : avgPct >= 50 ? "MODERATE" : "WEAK",
        scoreBrackets: {
          "< 10 Marks (<50%)": totalWeak,
          "10-14 Marks (50-74%)": Math.max(0, Math.round(totalAttempts * 0.4)),
          "15-20 Marks (≥75%)": Math.max(0, totalAttempts - totalWeak - Math.round(totalAttempts * 0.4)),
        },
        subQuestionA: {
          code: num + "a",
          topicName: subA?.topicName || `Question ${num}a Core Topic`,
          averageScore: Number(avgA.toFixed(1)),
          maxMarks: 10.0,
          attemptedCount: attemptsA,
          weakCount: weakA,
          lowThreshold: 4.0,
          mediumThreshold: 7.5,
          highThreshold: 10.0,
        },
        subQuestionB: {
          code: num + "b",
          topicName: subB?.topicName || `Question ${num}b Advanced Topic`,
          averageScore: Number(avgB.toFixed(1)),
          maxMarks: 10.0,
          attemptedCount: attemptsB,
          weakCount: weakB,
          lowThreshold: 4.0,
          mediumThreshold: 7.5,
          highThreshold: 10.0,
        },
      };
    });
    return Object.values(qMap);
  }, [summary]);

  // Derive compact sub-question items (1a, 1b, 2a, 2b, 3a, 3b, 4a, 4b)
  const subQuestionsData = useMemo(() => {
    const list = [];
    questionsData.forEach((q) => {
      const qNum = q.questionNumber;
      const num = qNum.replace(/^Q/i, "");

      if (q.subQuestionA) {
        const att = q.subQuestionA.attemptedCount ?? 0;
        const weak = q.subQuestionA.weakCount ?? 0;
        const weakPct = att > 0 ? (weak / att) * 100 : 0;
        const maxM = q.subQuestionA.maxMarks > 0 ? q.subQuestionA.maxMarks : 10.0;
        const avgScore = q.subQuestionA.averageScore ?? 0;
        const avgPct = maxM > 0 ? (avgScore / maxM) * 100 : 0;

        list.push({
          code: (q.subQuestionA.code || `${num}a`).toLowerCase(),
          displayCode: (q.subQuestionA.code || `${num}a`).toUpperCase(),
          parentQuestion: qNum,
          moduleNumber: q.moduleNumber,
          attemptedCount: att,
          weakCount: weak,
          weakPercentage: Number(weakPct.toFixed(1)),
          averageScore: Number(avgScore.toFixed(1)),
          averagePercentage: Number(avgPct.toFixed(1)),
          maxMarks: maxM,
          topicName: q.subQuestionA.topicName || `Question ${num}a`,
        });
      }

      if (q.subQuestionB) {
        const att = q.subQuestionB.attemptedCount ?? 0;
        const weak = q.subQuestionB.weakCount ?? 0;
        const weakPct = att > 0 ? (weak / att) * 100 : 0;
        const maxM = q.subQuestionB.maxMarks > 0 ? q.subQuestionB.maxMarks : 10.0;
        const avgScore = q.subQuestionB.averageScore ?? 0;
        const avgPct = maxM > 0 ? (avgScore / maxM) * 100 : 0;

        list.push({
          code: (q.subQuestionB.code || `${num}b`).toLowerCase(),
          displayCode: (q.subQuestionB.code || `${num}b`).toUpperCase(),
          parentQuestion: qNum,
          moduleNumber: q.moduleNumber,
          attemptedCount: att,
          weakCount: weak,
          weakPercentage: Number(weakPct.toFixed(1)),
          averageScore: Number(avgScore.toFixed(1)),
          averagePercentage: Number(avgPct.toFixed(1)),
          maxMarks: maxM,
          topicName: q.subQuestionB.topicName || `Question ${num}b`,
        });
      }
    });

    if (list.length === 0) {
      ["1a", "1b", "2a", "2b", "3a", "3b", "4a", "4b"].forEach((code) => {
        const qNum = "Q" + code.charAt(0);
        list.push({
          code,
          displayCode: code.toUpperCase(),
          parentQuestion: qNum,
          moduleNumber: code.startsWith("1") || code.startsWith("2") ? 1 : 2,
          attemptedCount: 0,
          weakCount: 0,
          weakPercentage: 0,
          averageScore: 0,
          averagePercentage: 0,
          maxMarks: 10.0,
          topicName: `Sub-question ${code}`,
        });
      });
    }

    return list;
  }, [questionsData]);

  const currentQuestionData = useMemo(() => {
    if (selectedQuestionView === "Overall") return null;
    return questionsData.find((q) => q.questionNumber === selectedQuestionView) || null;
  }, [questionsData, selectedQuestionView]);

  const pieChartConfig = useMemo(() => {
    if (selectedQuestionView === "Overall") {
      const colors = {
        Q1: "#38bdf8",
        Q2: "#818cf8",
        Q3: "#f59e0b",
        Q4: "#10b981",
      };
      const slices = questionsData.map((q) => ({
        label: q.questionNumber,
        value: q.attemptedCount || 0,
        color: colors[q.questionNumber] || "#94a3b8",
      }));
      const totalAttempts = slices.reduce((acc, s) => acc + s.value, 0);
      return {
        slices,
        totalLabel: "Total Attempts",
        totalValue: totalAttempts.toString(),
      };
    }

    if (currentQuestionData) {
      const brackets = currentQuestionData.scoreBrackets || {};
      const lowVal = brackets["< 10 Marks (<50%)"] ?? brackets["< 10 Marks"] ?? currentQuestionData.weakCount ?? 0;
      const medVal = brackets["10-14 Marks (50-74%)"] ?? brackets["10 - 14 Marks"] ?? 0;
      const highVal = brackets["15-20 Marks (≥75%)"] ?? brackets["15 - 20 Marks"] ?? 0;

      const slices = [
        { label: "<10 Marks (<50% Weak)", value: lowVal, color: "#ef4444" },
        { label: "10-14 Marks (50-74% Mod)", value: medVal, color: "#f59e0b" },
        { label: "15-20 Marks (≥75% Strong)", value: highVal, color: "#10b981" },
      ];

      return {
        slices,
        totalLabel: `${currentQuestionData.questionNumber} Avg`,
        totalValue: `${currentQuestionData.averageScore?.toFixed(1) || 0}/20`,
      };
    }

    return {
      slices: [],
      totalLabel: "N/A",
      totalValue: "0",
    };
  }, [selectedQuestionView, questionsData, currentQuestionData]);

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

      {/* 2. CARD 1: DIAGNOSTIC QUESTION HEATMAP & INTERACTIVE PERFORMANCE DISTRIBUTION */}
      <div className="tca-section-card">
        <div className="tca-card-header">
          <div>
            <h3 className="tca-card-title">
              🔥 Card 1: Diagnostic Question Heatmap & Performance Distribution
            </h3>
            <p className="tca-card-subtitle">
              Mutual-exclusion module question evaluation (Q1/Q2 for Module 1, Q3/Q4 for Module 2) with atomic score distribution.
            </p>
          </div>
        </div>

        <div className="tca-analytics-split-layout">
          {/* LEFT: COMPACT SUB-QUESTION HEATMAP */}
          <div className="tca-compact-heatmap-col">
            <div className="tca-col-header">
              <span className="tca-col-title">Diagnostic Heatmap</span>
              <span className="tca-col-hint">Click tile to inspect</span>
            </div>

            <div className="tca-subq-heatmap-grid">
              {subQuestionsData.map((sub) => {
                const isDirectlySelected = selectedSubQuestion === sub.code;
                const isParentSelected = selectedQuestionView === sub.parentQuestion;
                let heatClass = "heat-strong";
                if (sub.attemptedCount === 0) {
                  heatClass = "heat-unattempted";
                } else if (sub.averagePercentage < 50 || sub.weakPercentage > 40) {
                  heatClass = "heat-weak";
                } else if (sub.averagePercentage < 75 || sub.weakPercentage >= 20) {
                  heatClass = "heat-mod";
                }

                return (
                  <button
                    key={sub.code}
                    type="button"
                    className={`tca-subq-heat-tile ${heatClass} ${isDirectlySelected ? "selected-tile" : isParentSelected ? "parent-selected" : ""}`}
                    onClick={() => {
                      setSelectedQuestionView(sub.parentQuestion);
                      setSelectedSubQuestion(sub.code);
                    }}
                    title={`Sub-question ${sub.displayCode} (${sub.parentQuestion}): ${sub.averagePercentage.toFixed(1)}% class average (${sub.averageScore}/${sub.maxMarks} marks) • ${sub.attemptedCount} attempted, ${sub.weakCount} weak (<50%)`}
                  >
                    <span className="tca-subq-code">{sub.displayCode}</span>
                    <div className="tca-subq-metric-stack">
                      <span className="tca-subq-stat">
                        {sub.attemptedCount > 0 ? `${Math.round(sub.averagePercentage)}%` : "—"}
                      </span>
                      <span className="tca-subq-substat">
                        {sub.attemptedCount > 0 ? (sub.weakCount > 0 ? `${sub.weakCount} weak` : "0 weak") : "0 attempts"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="tca-heatmap-legend-mini">
              <span className="tca-legend-tag"><span className="dot dot-green" /> &ge;75% Strong</span>
              <span className="tca-legend-tag"><span className="dot dot-amber" /> 50–74% Mod</span>
              <span className="tca-legend-tag"><span className="dot dot-red" /> &lt;50% Weak</span>
            </div>
          </div>

          {/* RIGHT: INTERACTIVE ANALYTICS & PIE CHARTS */}
          <div className="tca-interactive-analytics-col">
            <div className="tca-col-header-right">
              <span className="tca-col-title">
                {selectedQuestionView === "Overall"
                  ? "Overall Question Attempt Distribution"
                  : `${selectedQuestionView} Score Distribution & Sub-Question Metrics`}
              </span>
              <div className="tca-dropdown-wrap">
                <label htmlFor="q-view-select" className="tca-dropdown-label">Question:</label>
                <select
                  id="q-view-select"
                  className="tca-dropdown-select"
                  value={selectedQuestionView}
                  onChange={(e) => {
                    setSelectedQuestionView(e.target.value);
                    setSelectedSubQuestion(null);
                  }}
                >
                  <option value="Overall">Overall</option>
                  <option value="Q1">Q1</option>
                  <option value="Q2">Q2</option>
                  <option value="Q3">Q3</option>
                  <option value="Q4">Q4</option>
                </select>
              </div>
            </div>

            <InteractiveDonutChart
              data={pieChartConfig.slices}
              totalLabel={pieChartConfig.totalLabel}
              totalValue={pieChartConfig.totalValue}
              size={180}
            />

            {selectedQuestionView !== "Overall" && currentQuestionData ? (
              <div className="tca-line-indicators-wrap">
                <div className="tca-line-indicators-title">
                  <span>📊 Sub-Question Average Score Indicators (Strictly Attempted Students)</span>
                </div>
                <SubQuestionLineIndicator
                  subData={currentQuestionData.subQuestionA}
                  label={`${currentQuestionData.questionNumber.substring(1)}a`}
                />
                <SubQuestionLineIndicator
                  subData={currentQuestionData.subQuestionB}
                  label={`${currentQuestionData.questionNumber.substring(1)}b`}
                />
              </div>
            ) : (
              <div className="tca-overall-guidance-card">
                <span>💡</span>
                <span>
                  Select <strong>Q1</strong>, <strong>Q2</strong>, <strong>Q3</strong>, or <strong>Q4</strong> from the dropdown or click a heatmap box to inspect individual 20-mark score distributions and sub-question (a/b) average line indicators.
                </span>
              </div>
            )}
          </div>
        </div>
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
