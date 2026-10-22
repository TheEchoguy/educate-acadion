import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  getMyPerformance,
  getMyFourLevelAnalytics,
} from "../../services/classroomService";
import StudentRiskXaiCoach from "../../components/classroom/StudentRiskXaiCoach";
import StudentRagTutorModal from "../../components/classroom/StudentRagTutorModal";
import "./StudentPerformanceView.css";

const StudentPerformanceView = ({ classroomId }) => {
  const params = useParams();
  const effectiveClassroomId = classroomId || params?.classroomId || params?.id;
  const [fourLevelData, setFourLevelData] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [topicFilter, setTopicFilter] = useState("ALL"); // ALL | WEAK | STRONG
  const [selectedIa, setSelectedIa] = useState(1);
  const [targetGrade, setTargetGrade] = useState("PASS"); // PASS | GRADE_A | GRADE_S
  const [tutorModal, setTutorModal] = useState({
    isOpen: false,
    focusTopic: null,
    focusModule: null,
    assessmentName: "IA-1",
  });

  useEffect(() => {
    let active = true;
    if (effectiveClassroomId) {
      setLoading(true);
      setError(null);

      Promise.allSettled([
        getMyFourLevelAnalytics(effectiveClassroomId),
        getMyPerformance(effectiveClassroomId),
      ])
        .then(([flRes, perfRes]) => {
          if (!active) return;
          const fl = flRes.status === "fulfilled" ? flRes.value : null;
          const pf = perfRes.status === "fulfilled" ? perfRes.value : null;

          if (fl) {
            setFourLevelData(fl);
          }
          if (pf) {
            setPerformance(pf);
            if (pf.iaTests && pf.iaTests.length > 0) {
              setSelectedIa(pf.iaTests[0].iaNumber);
            }
          }

          if (!fl && !pf) {
            const err = flRes.reason || perfRes.reason;
            setError(
              err?.response?.data?.message ||
                "Failed to load your personal performance data."
            );
          }
          setLoading(false);
        })
        .catch((err) => {
          console.error("Failed to load performance:", err);
          if (active) {
            setError("Failed to load your personal performance data.");
            setLoading(false);
          }
        });
    }

    return () => {
      active = false;
    };
  }, [effectiveClassroomId]);

  if (loading) {
    return (
      <div className="sp-loading-container">
        <div className="sp-spinner" />
        <p>Crunching your 4-level CIE performance and question analytics...</p>
      </div>
    );
  }

  const hasData =
    fourLevelData ||
    (performance && performance.iaTests && performance.iaTests.length > 0);

  if (error || !hasData) {
    return (
      <div className="sp-empty-card">
        <div className="sp-empty-icon">⏳</div>
        <h3>CIE Marks Pending Instructor Confirmation</h3>
        <p>
          {error ||
            "Internal Assessment (CIE) marks have not yet been published by your course instructor. Once confirmed and published, your verified scores, module mastery, and diagnostic insights will appear here."}
        </p>
      </div>
    );
  }

  // Extract from 4-level data or performance
  const studentName = fourLevelData?.studentName || performance?.studentName || "Student";
  const studentUsn = fourLevelData?.studentUsn || performance?.usn || "Not Verified";

  // Level 3 Subject
  const level3 = fourLevelData?.level3Subject || {
    rawIaAverage: performance?.overallIaAverage || 0,
    scaledIaScore: performance?.scaledCieEarned || 0,
    assignmentScore: 5.0,
    labScore: 0.0,
    totalCieSecured: (performance?.scaledCieEarned || 0) + 5.0,
    cieMaxMarks: 50.0,
    passingThreshold: 20.0,
    cieStatus:
      (performance?.scaledCieEarned || 0) + 5.0 >= 20.0 ? "PASSING" : "AT_RISK",
    seeProjectedTarget: "Need >= 20 marks in SEE (out of 50) to pass course.",
  };

  // Level 4 Semester
  const level4 = fourLevelData?.level4Semester || {
    semester: 7,
    gpaTrajectory: "ON_TRACK_FIRST_CLASS",
    overallRiskCategory: level3.cieStatus === "PASSING" ? "LOW" : "MEDIUM",
    academicAdvice: "Keep up regular study of weak module concepts before semester exams.",
  };

  // Level 2 Modules
  const level2Modules = fourLevelData?.level2Modules || null;
  const legacyModuleMastery = performance?.moduleMastery || {};

  // Level 1 Topics
  const level1Topics =
    fourLevelData?.level1Topics && fourLevelData.level1Topics.length > 0
      ? fourLevelData.level1Topics
      : [];

  // Weak topics
  const weakTopics = level1Topics.filter((t) => t.status === "WEAK");

  // Dynamic SEE Marks Needed Calculator
  const currentCie = level3.totalCieSecured || 0;
  const seeMax = 50.0; // Scaled SEE is 50 marks (or 50 out of 100)
  const calcMarksNeeded = (targetTotal) => {
    const needed = targetTotal - currentCie;
    if (needed <= 0) return 0;
    return Math.min(seeMax, Math.max(18.0, Number(needed.toFixed(1)))); // Minimum SEE pass is 18/50 (35%)
  };

  const seeNeededForPass = Math.max(18.0, Number((40.0 - currentCie).toFixed(1)));
  const seeNeededForA = Math.max(18.0, Number((75.0 - currentCie).toFixed(1)));
  const seeNeededForS = Math.max(18.0, Number((90.0 - currentCie).toFixed(1)));

  // Filter topics
  const filteredTopics = level1Topics.filter((t) => {
    if (topicFilter === "WEAK") return t.status === "WEAK";
    if (topicFilter === "STRONG") return t.status === "STRONG";
    return true;
  });

  const scaledCieEarned = level3.scaledIaScore || 0;
  const scaledCieMax = 15.0;
  const ciePercentage = Math.min(100, Math.round((scaledCieEarned / scaledCieMax) * 100));

  return (
    <div className="sp-container">
      {/* 1. TOP SCALED CIE PROGRESS HERO BANNER */}
      <div className="sp-hero-banner">
        <div className="sp-hero-info">
          <div className="sp-hero-badge">
            🔒 4-Level Academic Intelligence & Diagnostics
          </div>
          <h2>{studentName}</h2>
          <p className="sp-hero-subtitle">
            Course Continuous Internal Evaluation (CIE) Progress & Syllabus Diagnostics
          </p>
          <div className="sp-student-meta">
            <span className="sp-meta-chip">
              USN: <strong>{studentUsn}</strong>
            </span>
            <span className="sp-meta-chip">
              Raw IA Average: <strong>{level3.rawIaAverage?.toFixed(1)} / 40.0</strong>
            </span>
            <span className="sp-meta-chip">
              Total CIE: <strong>{level3.totalCieSecured?.toFixed(1)} / 50.0</strong>
            </span>
            <span
              className={`sp-meta-chip ${
                level3.cieStatus === "PASSING" ? "status-pass" : "status-risk"
              }`}
            >
              {level3.cieStatus === "PASSING" ? "✅ Passing Threshold Met" : "⚠️ At Risk (< 20 M)"}
            </span>
          </div>
        </div>

        {/* CIE METER */}
        <div className="sp-cie-meter-box">
          <div className="sp-cie-label-row">
            <span className="sp-cie-title">Live Scaled IA Score</span>
            <span className="sp-cie-rule-note">{ciePercentage}% Locked In</span>
          </div>
          <div className="sp-cie-score-display">
            <span className="sp-cie-score-val">{scaledCieEarned.toFixed(1)}</span>
            <span className="sp-cie-max-val">/ {scaledCieMax.toFixed(1)} M</span>
          </div>
          <div className="sp-progress-bar-bg">
            <div className="sp-progress-bar-fill" style={{ width: `${ciePercentage}%` }} />
          </div>
          <div className="sp-cie-rule-note">
            <span>Pass Threshold: 6.0 / 15.0</span>
            <span>Target: {scaledCieMax} M</span>
          </div>
        </div>
      </div>

      {/* LEVEL 4: SEMESTER ACADEMIC TRAJECTORY BANNER */}
      {level4 && (
        <div className="sp-level4-banner">
          <div className="sp-l4-top">
            <div className="sp-l4-tag">LEVEL 4: SEMESTER STANDING & TRAJECTORY</div>
            <div className="sp-l4-chips">
              <span className="sp-gpa-badge">
                Trajectory: <strong>{level4.gpaTrajectory?.replace(/_/g, " ")}</strong>
              </span>
              <span
                className={`sp-risk-badge ${
                  level4.overallRiskCategory === "HIGH"
                    ? "high"
                    : level4.overallRiskCategory === "MEDIUM"
                    ? "med"
                    : "low"
                }`}
              >
                {level4.overallRiskCategory} RISK
              </span>
            </div>
          </div>
          <div className="sp-l4-advice">
            💡 <strong>Academic Guidance:</strong> {level4.academicAdvice}
          </div>
        </div>
      )}

      {/* FEATURE 4: SHAP EXPLAINABLE AI (XAI) RISK & DIAGNOSTIC COACH */}
      <StudentRiskXaiCoach
        classroomId={classroomId}
        studentUsn={studentUsn !== "Not Verified" ? studentUsn : null}
      />

      {/* LEVEL 3: SUBJECT STANDING & SEE MARKS NEEDED CALCULATOR */}
      <div className="sp-section">
        <div className="sp-section-header">
          <h3 className="sp-section-title">
            📐 Level 3: Subject Standing & Marks Needed Calculator
          </h3>
          <span className="sp-section-desc">
            Continuous Internal Evaluation Breakdown + Semester End Exam Target Projection
          </span>
        </div>

        <div className="sp-level3-container">
          <div className="sp-cie-components-grid">
            <div className="sp-cie-card">
              <span className="sp-cie-card-lbl">Scaled IA Score</span>
              <span className="sp-cie-card-val highlight-blue">
                {level3.scaledIaScore?.toFixed(1)} <span>/ 15.0</span>
              </span>
              <span className="sp-cie-card-sub">Best 2 IAs Scaled</span>
            </div>
            <div className="sp-cie-card">
              <span className="sp-cie-card-lbl">Assignments</span>
              <span className="sp-cie-card-val">
                {level3.assignmentScore?.toFixed(1)} <span>/ 5.0</span>
              </span>
              <span className="sp-cie-card-sub">Activity / Quiz</span>
            </div>
            {level3.labScore > 0 && (
              <div className="sp-cie-card">
                <span className="sp-cie-card-lbl">Lab Component</span>
                <span className="sp-cie-card-val">
                  {level3.labScore?.toFixed(1)} <span>/ 10.0</span>
                </span>
                <span className="sp-cie-card-sub">Lab CIE</span>
              </div>
            )}
            <div className="sp-cie-card highlight-total">
              <span className="sp-cie-card-lbl">Total CIE Secured</span>
              <span className="sp-cie-card-val highlight-green">
                {level3.totalCieSecured?.toFixed(1)} <span>/ {level3.cieMaxMarks || 50.0}</span>
              </span>
              <span className="sp-cie-card-sub">Min to Qualify: 20.0</span>
            </div>
          </div>

          {/* DYNAMIC TARGET CALCULATOR */}
          <div className="sp-target-calculator-box">
            <div className="sp-calc-header">
              <span className="sp-calc-title">🎯 Semester End Exam (SEE) Target Calculator</span>
              <div className="sp-calc-buttons">
                <button
                  type="button"
                  className={`sp-calc-btn ${targetGrade === "PASS" ? "active" : ""}`}
                  onClick={() => setTargetGrade("PASS")}
                >
                  To Pass (Total ≥ 40)
                </button>
                <button
                  type="button"
                  className={`sp-calc-btn ${targetGrade === "GRADE_A" ? "active" : ""}`}
                  onClick={() => setTargetGrade("GRADE_A")}
                >
                  Grade A (Total ≥ 75)
                </button>
                <button
                  type="button"
                  className={`sp-calc-btn ${targetGrade === "GRADE_S" ? "active" : ""}`}
                  onClick={() => setTargetGrade("GRADE_S")}
                >
                  Grade S (Total ≥ 90)
                </button>
              </div>
            </div>

            <div className="sp-calc-result-row">
              <div className="sp-calc-result-main">
                <span className="sp-calc-needed-label">Marks Required in SEE (out of 50):</span>
                <span className="sp-calc-needed-val">
                  {targetGrade === "PASS"
                    ? `${seeNeededForPass} / 50`
                    : targetGrade === "GRADE_A"
                    ? seeNeededForA > 50
                      ? "50+ (CIE deficit)"
                      : `${seeNeededForA} / 50`
                    : seeNeededForS > 50
                    ? "50+ (CIE deficit)"
                    : `${seeNeededForS} / 50`}
                </span>
              </div>
              <div className="sp-calc-advice">
                {targetGrade === "PASS"
                  ? seeNeededForPass <= 18
                    ? "You are safely on track! Scoring the minimum 18 marks in SEE will successfully pass the course."
                    : `You need ${seeNeededForPass} marks in SEE to satisfy the 40/100 aggregate pass requirement.`
                  : targetGrade === "GRADE_A"
                  ? seeNeededForA <= 50
                    ? `Scoring ${seeNeededForA} marks or higher in SEE locks in an 'A' Distinction grade.`
                    : "An 'A' grade requires scoring near full marks in upcoming IAs and SEE."
                  : seeNeededForS <= 50
                  ? `Outstanding! Scoring ${seeNeededForS} marks in SEE will secure the top 'S' grade.`
                  : "An 'S' grade is challenging given current CIE. Focus on securing a solid 'A' grade."}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* LEVEL 2: MODULE 1-5 MASTERY BREAKDOWN */}
      <div className="sp-section">
        <div className="sp-section-header">
          <h3 className="sp-section-title">📚 Level 2: Modules 1–5 Syllabus Mastery</h3>
          <span className="sp-section-desc">
            Calculated across answered questions (unpenalized by choice alternatives)
          </span>
        </div>

        <div className="sp-modules-grid">
          {[1, 2, 3, 4, 5].map((modNum) => {
            const modInfo = level2Modules ? level2Modules[modNum] : null;
            const pct = modInfo !== undefined && modInfo !== null
              ? modInfo.percentage
              : legacyModuleMastery[modNum] !== undefined
              ? legacyModuleMastery[modNum]
              : 0;

            const isMastered = pct >= 75;
            const isSat = pct >= 50 && pct < 75;
            const levelClass = isMastered ? "high" : isSat ? "med" : pct > 0 ? "low" : "pending";
            const levelStatus = isMastered
              ? "Mastered"
              : isSat
              ? "Satisfactory"
              : pct > 0
              ? "Needs Review"
              : "Pending Test";

            return (
              <div key={modNum} className="sp-module-card">
                <div className="sp-module-header">
                  <span className="sp-module-number">MODULE {modNum}</span>
                  <span className={`sp-module-pct ${levelClass}`}>{pct.toFixed(0)}%</span>
                </div>
                <div className="sp-module-bar">
                  <div className={`sp-module-fill ${levelClass}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="sp-module-card-footer">
                  <span className={`sp-module-status ${levelClass}`}>{levelStatus}</span>
                  {modInfo && modInfo.weakTopicsCount > 0 && (
                    <span className="sp-mod-weak-flag">
                      ⚠️ {modInfo.weakTopicsCount} weak
                    </span>
                  )}
                  <button
                    type="button"
                    className="sp-mod-tutor-btn"
                    onClick={() =>
                      setTutorModal({
                        isOpen: true,
                        focusTopic: `Module ${modNum} Core Concepts`,
                        focusModule: modNum,
                        assessmentName: "Course Notes",
                      })
                    }
                  >
                    📖 Study Notes
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* LEVEL 1: TOPIC MASTERY CARDS */}
      <div className="sp-section">
        <div className="sp-section-header">
          <div>
            <h3 className="sp-section-title">
              💡 Level 1: Atomic Topic Mastery Cards
            </h3>
            <span className="sp-section-desc">
              Clean 3-to-6 word universal topics synthesized from your question papers
            </span>
          </div>

          <div className="sp-topic-filters">
            <button
              type="button"
              className={`sp-filter-btn ${topicFilter === "ALL" ? "active" : ""}`}
              onClick={() => setTopicFilter("ALL")}
            >
              All Topics ({level1Topics.length})
            </button>
            <button
              type="button"
              className={`sp-filter-btn ${topicFilter === "WEAK" ? "active" : ""}`}
              onClick={() => setTopicFilter("WEAK")}
            >
              Weak Areas &lt;50% ({weakTopics.length})
            </button>
            <button
              type="button"
              className={`sp-filter-btn ${topicFilter === "STRONG" ? "active" : ""}`}
              onClick={() => setTopicFilter("STRONG")}
            >
              Strong ≥75%
            </button>
          </div>
        </div>

        {/* WEAK TOPIC ALERT BANNER */}
        {weakTopics.length > 0 && (
          <div className="sp-weak-banner">
            <div className="sp-weak-header">
              <span className="sp-weak-icon">⚠️</span>
              <h4 className="sp-weak-title">
                Diagnostic Alert: {weakTopics.length} Academic Topic
                {weakTopics.length > 1 ? "s" : ""} Below 50%
              </h4>
            </div>
            <p style={{ margin: "0 0 12px 0", fontSize: "0.85rem", color: "#fecaca" }}>
              Focus your exam revision on these core topics to maximize your Semester End Exam (SEE) score:
            </p>
            <div className="sp-weak-grid">
              {weakTopics.map((item, idx) => (
                <div key={idx} className="sp-weak-item">
                  <div className="sp-weak-item-name">{item.topicName}</div>
                  <div className="sp-weak-item-meta">
                    <span>Q{item.code?.toUpperCase()} • Module {item.moduleNumber}</span>
                    <span>
                      {item.percentage?.toFixed(0)}% ({item.marksObtained}/{item.maxMarks} M)
                    </span>
                  </div>
                  <div className="sp-weak-advice">💡 {item.recommendation}</div>
                  <button
                    type="button"
                    className="sp-weak-tutor-btn"
                    onClick={() =>
                      setTutorModal({
                        isOpen: true,
                        focusTopic: item.topicName,
                        focusModule: item.moduleNumber,
                        assessmentName: `IA-${item.iaNumber || 1}`,
                      })
                    }
                  >
                    🤖 Study with AI Tutor
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {filteredTopics.length === 0 ? (
          <div className="sp-empty-card">
            <p>No topics matching the selected filter.</p>
          </div>
        ) : (
          <div className="sp-topic-cards-grid">
            {filteredTopics.map((topic, idx) => {
              const isWeak = topic.status === "WEAK";
              const isStrong = topic.status === "STRONG";
              const cardClass = isWeak ? "card-weak" : isStrong ? "card-strong" : "card-mod";

              return (
                <div key={idx} className={`sp-atomic-topic-card ${cardClass}`}>
                  <div className="sp-topic-top-row">
                    <span className="sp-topic-code">Q{topic.code?.toUpperCase()}</span>
                    <span className="sp-topic-mod-chip">Mod {topic.moduleNumber}</span>
                    {topic.co && <span className="sp-topic-co-chip">{topic.co}</span>}
                    <span className={`sp-topic-status-pill ${cardClass}`}>
                      {topic.status}
                    </span>
                  </div>

                  <div className="sp-topic-name-heading" title={topic.topicName}>
                    {topic.topicName}
                  </div>

                  <div className="sp-topic-score-bar-row">
                    <div className="sp-progress-bar-bg" style={{ height: 8 }}>
                      <div
                        className="sp-progress-bar-fill"
                        style={{
                          width: `${Math.min(100, Math.max(5, topic.percentage))}%`,
                          background: isWeak
                            ? "#ef4444"
                            : isStrong
                            ? "#10b981"
                            : "#f59e0b",
                        }}
                      />
                    </div>
                    <span className="sp-topic-pct-num">
                      {topic.percentage?.toFixed(0)}%
                    </span>
                  </div>

                  <div className="sp-topic-score-meta">
                    <span>
                      Marks: <strong>{topic.marksObtained?.toFixed(1)}</strong> / {topic.maxMarks?.toFixed(1)} M
                    </span>
                    <span className="sp-ia-tag">IA-{topic.iaNumber || 1}</span>
                  </div>

                  {topic.recommendation && (
                    <div className="sp-topic-guidance">
                      💡 {topic.recommendation}
                    </div>
                  )}

                  <button
                    type="button"
                    className="sp-topic-tutor-btn"
                    onClick={() =>
                      setTutorModal({
                        isOpen: true,
                        focusTopic: topic.topicName,
                        focusModule: topic.moduleNumber,
                        assessmentName: `IA-${topic.iaNumber || 1}`,
                      })
                    }
                  >
                    🤖 Study with AI Tutor
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. QUESTION-WISE BREAKDOWN & CHOICE TAGS (FROM RECORDED PAPERS) */}
      {performance && performance.iaTests && performance.iaTests.length > 0 && (
        <div className="sp-section">
          <div className="sp-section-header">
            <h3 className="sp-section-title">
              📝 Internal Assessment Question Breakdown & Choices
            </h3>
            {performance.iaTests.length > 1 && (
              <div className="sp-ia-selector-bar">
                {performance.iaTests.map((t) => (
                  <button
                    key={t.iaNumber}
                    type="button"
                    className={`sp-ia-tab-btn ${selectedIa === t.iaNumber ? "active" : ""}`}
                    onClick={() => setSelectedIa(t.iaNumber)}
                  >
                    IA-{t.iaNumber} ({t.totalMarks}/{t.maxMarks} M)
                  </button>
                ))}
              </div>
            )}
          </div>

          {(() => {
            const currentIaTest =
              performance.iaTests.find((t) => t.iaNumber === selectedIa) ||
              performance.iaTests[0];

            return currentIaTest ? (
              <div className="sp-questions-grid">
                {currentIaTest.questions?.map((q, idx) => {
                  const isAttempted = q.status === "ATTEMPTED";
                  const isSkipped = q.status === "SKIPPED_CHOICE";
                  const cardClass = isAttempted ? "attempted" : isSkipped ? "skipped" : "";

                  return (
                    <div key={idx} className={`sp-question-card ${cardClass}`}>
                      <div className="sp-question-top">
                        <span className="sp-q-code-badge">
                          Q{q.code?.toUpperCase()} ({q.part})
                        </span>
                        <span
                          className={`sp-status-badge ${
                            isAttempted ? "attempted" : isSkipped ? "skipped" : "unattempted"
                          }`}
                        >
                          {isAttempted
                            ? "Attempted"
                            : isSkipped
                            ? "Skipped via Choice"
                            : "Unattempted"}
                        </span>
                      </div>

                      <div className="sp-q-topic">{q.topicName}</div>

                      <div className="sp-q-meta-row">
                        <span>Module {q.moduleNumber}</span>
                        <span>{q.co}</span>
                      </div>

                      {isSkipped ? (
                        <div className="sp-skipped-notice">
                          Alternative choice question — omitted without score penalty.
                        </div>
                      ) : (
                        <>
                          <div className="sp-q-score-row">
                            <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                              Marks Scored:
                            </span>
                            <div className="sp-q-marks">
                              {q.marksScored} <span>/ {q.maxMarks}</span>
                            </div>
                          </div>
                          <div className="sp-progress-bar-bg" style={{ height: 6 }}>
                            <div
                              className="sp-progress-bar-fill"
                              style={{
                                width: `${q.percentage}%`,
                                background: q.percentage < 50 ? "#ef4444" : "#10b981",
                              }}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null;
          })()}
        </div>
      )}

      {/* 6. INTERACTIVE RAG STUDY TUTOR DRAWER / MODAL */}
      {tutorModal.isOpen && (
        <StudentRagTutorModal
          classroomId={classroomId}
          focusTopic={tutorModal.focusTopic}
          focusModule={tutorModal.focusModule}
          assessmentName={tutorModal.assessmentName}
          onClose={() =>
            setTutorModal({
              isOpen: false,
              focusTopic: null,
              focusModule: null,
              assessmentName: "IA-1",
            })
          }
        />
      )}
    </div>
  );
};

export default StudentPerformanceView;
