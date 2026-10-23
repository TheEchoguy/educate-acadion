import React, { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  getMyPerformance,
  getMyFourLevelAnalytics,
} from "../../services/classroomService";
import StudentRiskXaiCoach from "../../components/classroom/StudentRiskXaiCoach";
import StudentRagTutorModal from "../../components/classroom/StudentRagTutorModal";
import "./StudentPerformanceView.css";

// Case-insensitive marks accessor helper
export const getMark = (marksMap, code) => {
  if (!marksMap || !code) return 0;
  const upper = code.toUpperCase();
  const lower = code.toLowerCase();
  return marksMap[upper] ?? marksMap[lower] ?? 0;
};

// 1. Strict 4-Level Mutual-Exclusion Deficit Analyzer (VTU Modular Choice Rules)
const analyzeIaQuestionsAndDeficits = (questions = []) => {
  if (!questions || questions.length === 0) {
    return {
      deficits: [],
      alternativeChoices: [],
      chosenMap: {},
      totalDeficitMarks: 0,
      priorityRevisionList: [],
    };
  }

  // Group questions by module
  const moduleGroups = {};
  questions.forEach((q) => {
    const qNumMatch = (q.code || q.questionNumber || "").match(/(\d+)/);
    const qNum = qNumMatch ? parseInt(qNumMatch[1], 10) : 1;
    const inferredMod = q.moduleNumber || Math.ceil(qNum / 2) || 1;

    if (!moduleGroups[inferredMod]) {
      moduleGroups[inferredMod] = [];
    }
    moduleGroups[inferredMod].push({
      ...q,
      parsedQNum: qNum,
      effectiveModule: inferredMod,
    });
  });

  const deficits = [];
  const alternativeChoices = [];
  const chosenMap = {};

  Object.entries(moduleGroups).forEach(([modNum, modQuestions]) => {
    // Group sub-questions by main question number (e.g., Q1 vs Q2)
    const byMainQ = {};
    modQuestions.forEach((q) => {
      if (!byMainQ[q.parsedQNum]) {
        byMainQ[q.parsedQNum] = [];
      }
      byMainQ[q.parsedQNum].push(q);
    });

    const mainQKeys = Object.keys(byMainQ).map(Number);
    if (mainQKeys.length === 0) return;

    // Detect chosen question per module:
    // If ANY sub-part of Question 1 was attempted (marks > 0 or status === "ATTEMPTED"), mark Q1 as chosen!
    let chosenQNum = null;
    let maxAttemptMarks = -1;

    mainQKeys.forEach((qKey) => {
      const subQs = byMainQ[qKey];
      const hasAttempt = subQs.some(
        (sq) => (sq.marksScored != null && sq.marksScored > 0) || sq.status === "ATTEMPTED"
      );
      const totalMarks = subQs.reduce((acc, sq) => acc + (sq.marksScored || 0), 0);
      if (hasAttempt && totalMarks > maxAttemptMarks) {
        maxAttemptMarks = totalMarks;
        chosenQNum = qKey;
      }
    });

    // Default to the first question if no explicit attempt was made
    if (chosenQNum === null && mainQKeys.length > 0) {
      chosenQNum = mainQKeys[0];
    }

    chosenMap[modNum] = chosenQNum;

    // Evaluate sub-questions
    mainQKeys.forEach((qKey) => {
      const subQs = byMainQ[qKey];
      const isChosen = qKey === chosenQNum;

      subQs.forEach((sq) => {
        const scored = sq.marksScored != null ? sq.marksScored : 0;
        const max = sq.maxMarks || 10;
        const deficit = Number(Math.max(0, max - scored).toFixed(1));
        const pct = max > 0 ? (scored / max) * 100 : 0;

        if (isChosen) {
          // All sub-parts of the chosen question are MANDATORY!
          const isBlankOrMissed = scored === 0 && sq.status !== "ATTEMPTED";

          if (deficit > 0) {
            let cognitiveError = "Conceptual Inaccuracy & Missing Steps";
            let severity = "HIGH";

            if (isBlankOrMissed) {
              cognitiveError = "Missed Mandatory Sub-Question";
              severity = "CRITICAL";
            } else if (scored === 0) {
              cognitiveError = "Conceptual Inaccuracy (Zero Marks)";
              severity = "HIGH";
            } else if (pct < 50) {
              cognitiveError = "Conceptual Inaccuracy & Missing Derivations";
              severity = "HIGH";
            } else if (pct < 75) {
              cognitiveError = "Missing Diagrams / Incomplete Steps";
              severity = "MEDIUM";
            } else {
              cognitiveError = "Calculation Slip / Minor Detailing Gap";
              severity = "LOW";
            }

            deficits.push({
              ...sq,
              deficitMarks: deficit,
              marksScored: scored,
              maxMarks: max,
              pct,
              cognitiveError,
              severity,
              isChosen: true,
              isMandatoryMissed: isBlankOrMissed,
              moduleNumber: Number(modNum),
            });
          }
        } else {
          // The unchosen alternative question (e.g. Q2: 2A, 2B) is treated as
          // an unattempted optional choice, with ZERO deficit and NO penalty.
          alternativeChoices.push({
            ...sq,
            isChosen: false,
            alternativeTo: chosenQNum,
            moduleNumber: Number(modNum),
          });
        }
      });
    });
  });

  // Sort deficits by recovery impact (highest deficit first)
  deficits.sort((a, b) => b.deficitMarks - a.deficitMarks);

  const totalDeficitMarks = deficits.reduce((acc, d) => acc + d.deficitMarks, 0);
  const priorityRevisionList = deficits.slice(0, 2);

  return {
    deficits,
    alternativeChoices,
    chosenMap,
    totalDeficitMarks,
    priorityRevisionList,
  };
};

// 2. Reference / Model Solution & Rubric Generator
const getModelSolutionData = (item) => {
  const topic = item.topicName || "Core Engineering Concept";
  const max = item.maxMarks || 10;
  const qCode = item.code ? item.code.toUpperCase() : "Q";

  return {
    benchmarkSolution:
      item.modelSolution ||
      `To achieve full credit (${max}.0 M) on Sub-Q ${qCode} (${topic}), the answer must provide standard technical definitions, present governing equations with all variables and units defined, provide a clean schematic or state diagram, and conclude with practical engineering constraints.`,
    expectedDiagrams: [
      `Standard labeled architectural schematic / block diagram illustrating ${topic}.`,
      `State transition sequence, timing waveform, or data-flow interaction chart.`,
      `Mathematical governing equations with explicit parameter definitions in SI units.`,
    ],
    rubricCriteria: [
      {
        criterion: "Conceptual Principle & Technical Accuracy",
        weight: "40%",
        marks: `${(max * 0.4).toFixed(1)} M`,
        details: "Accurate terminology, fundamental working mechanism, and conceptual correctness.",
      },
      {
        criterion: "Labeled Schematics / Derivations / Steps",
        weight: "40%",
        marks: `${(max * 0.4).toFixed(1)} M`,
        details: "Clean labeled diagram with signal flows and full step-by-step mathematical proof.",
      },
      {
        criterion: "Engineering Constraints & Result Accuracy",
        weight: "20%",
        marks: `${(max * 0.2).toFixed(1)} M`,
        details: "Practical trade-offs, standard conventions, and correct numerical units.",
      },
    ],
  };
};

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
  const [expandedSolutions, setExpandedSolutions] = useState({});
  const [tutorModal, setTutorModal] = useState({
    isOpen: false,
    focusTopic: null,
    focusModule: null,
    assessmentName: "IA-1",
    deficitContext: null,
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

  // Compute currentIaTest & deficits via useMemo at top level before ANY conditional return
  const currentIaTest =
    (performance?.iaTests || []).find((t) => t.iaNumber === selectedIa) ||
    (performance?.iaTests || [])[0] ||
    null;

  const {
    deficits = [],
    alternativeChoices = [],
    chosenMap = {},
    totalDeficitMarks = 0,
    priorityRevisionList = [],
  } = useMemo(
    () => analyzeIaQuestionsAndDeficits(currentIaTest?.questions || []),
    [currentIaTest]
  );

  if (loading) {
    return (
      <div className="sp-loading-container">
        <div className="sp-spinner" />
        <p>Crunching your 4-level CIE performance and question analytics...</p>
      </div>
    );
  }

  // Safe destructuring of 4-level analytics data with default fallbacks
  const {
    studentName: flStudentName,
    studentUsn: flStudentUsn,
    level1Topics = [],
    level2Modules = {},
    level3Subject = {},
    level4Semester = {},
    shapAttributions = [],
    aiActionPlan = [],
    cieProgress = { secured: 0, max: 15 },
  } = fourLevelData || {};

  // Check if student's record is unpublished / in draft mode
  const isDraft = fourLevelData?.isPublished === false || performance?.isPublished === false;
  if (isDraft) {
    return (
      <div
        className="sp-empty-card"
        style={{
          maxWidth: "600px",
          margin: "40px auto",
          textAlign: "center",
          padding: "40px 24px",
          border: "1px solid rgba(234, 179, 8, 0.3)",
          borderRadius: "16px",
          background: "rgba(15, 23, 42, 0.7)",
        }}
      >
        <div className="sp-empty-icon" style={{ fontSize: "2.8rem", marginBottom: "14px" }}>
          📋
        </div>
        <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#facc15", marginBottom: "8px" }}>
          IA-1 Marks Pending Publication
        </h3>
        <p style={{ color: "#94a3b8", fontSize: "0.92rem", lineHeight: "1.6", margin: "0 0 20px 0" }}>
          Your subject faculty has recorded your marks in draft mode. Detailed question breakdown and performance analytics will unlock once published by faculty.
        </p>
      </div>
    );
  }

  // Check if any assessment marks are recorded
  const hasRecordedMarks =
    (Array.isArray(level1Topics) && level1Topics.length > 0) ||
    (performance && Array.isArray(performance.iaTests) && performance.iaTests.length > 0);

  // Graceful "No Marks Yet" Empty State
  if (error || !hasRecordedMarks) {
    return (
      <div className="sp-empty-card" style={{ maxWidth: "600px", margin: "40px auto", textAlign: "center", padding: "40px 24px" }}>
        <div className="sp-empty-icon" style={{ fontSize: "2.8rem", marginBottom: "14px" }}>📝</div>
        <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#ffffff", marginBottom: "8px" }}>
          No Assessment Marks Recorded Yet
        </h3>
        <p style={{ color: "#94a3b8", fontSize: "0.92rem", lineHeight: "1.6", margin: "0 0 20px 0" }}>
          {error ||
            "Your subject faculty has not published IA marks for this section yet. As soon as IA papers or split-up marks are recorded, your 4-level topic analytics and CIE progress will appear here."}
        </p>
      </div>
    );
  }

  // Extract student details
  const studentName = flStudentName || performance?.studentName || "Student";
  const studentUsn = flStudentUsn || performance?.usn || "Not Verified";

  // Level 3 Subject
  const level3 = (level3Subject && Object.keys(level3Subject).length > 0) ? level3Subject : {
    rawIaAverage: performance?.overallIaAverage || 0,
    scaledIaScore: performance?.scaledCieEarned || cieProgress?.secured || 0,
    assignmentScore: 5.0,
    labScore: 0.0,
    totalCieSecured: (performance?.scaledCieEarned || cieProgress?.secured || 0) + 5.0,
    cieMaxMarks: 50.0,
    passingThreshold: 20.0,
    cieStatus:
      (performance?.scaledCieEarned || cieProgress?.secured || 0) + 5.0 >= 20.0 ? "PASSING" : "AT_RISK",
    seeProjectedTarget: "Need >= 20 marks in SEE (out of 50) to pass course.",
  };

  // Level 4 Semester
  const level4 = (level4Semester && Object.keys(level4Semester).length > 0) ? level4Semester : {
    semester: 7,
    gpaTrajectory: "ON_TRACK_FIRST_CLASS",
    overallRiskCategory: level3.cieStatus === "PASSING" ? "LOW" : "MEDIUM",
    academicAdvice: "Keep up regular study of weak module concepts before semester exams.",
  };

  const legacyModuleMastery = performance?.moduleMastery || {};

  // Safe weak topics array
  const weakTopics = (Array.isArray(level1Topics) ? level1Topics : []).filter((t) => t && t.status === "WEAK");

  // Dynamic SEE Marks Needed Calculator
  const currentCie = level3.totalCieSecured || 0;
  const seeMax = 50.0;
  const calcMarksNeeded = (targetTotal) => {
    const needed = targetTotal - currentCie;
    if (needed <= 0) return 0;
    return Math.min(seeMax, Math.max(18.0, Number(needed.toFixed(1))));
  };

  const seeNeededForPass = Math.max(18.0, Number((40.0 - currentCie).toFixed(1)));
  const seeNeededForA = Math.max(18.0, Number((75.0 - currentCie).toFixed(1)));
  const seeNeededForS = Math.max(18.0, Number((90.0 - currentCie).toFixed(1)));

  // Filter topics safely
  const filteredTopics = (Array.isArray(level1Topics) ? level1Topics : []).filter((t) => {
    if (!t) return false;
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
        classroomId={effectiveClassroomId}
        studentUsn={studentUsn !== "Not Verified" ? studentUsn : null}
        totalCieSecured={level3.totalCieSecured || 20.0}
        rawIaAverage={level3.rawIaAverage || 28.0}
        scaledIaScore={level3.scaledIaScore || 10.5}
        deficits={deficits}
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
          {Object.entries(level2Modules || {}).length > 0
            ? Object.entries(level2Modules || {}).map(([modKey, modInfo]) => {
                const modNum = Number(modKey) || modKey;
                const pct =
                  modInfo && modInfo.percentage != null
                    ? modInfo.percentage
                    : legacyModuleMastery && legacyModuleMastery[modNum] != null
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
                  <div key={modKey} className="sp-module-card">
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
              })
            : [1, 2, 3, 4, 5].map((modNum) => {
                const modInfo = (level2Modules || {})[modNum] || (level2Modules || {})[String(modNum)] || null;
                const pct =
                  modInfo && modInfo.percentage != null
                    ? modInfo.percentage
                    : legacyModuleMastery && legacyModuleMastery[modNum] != null
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
              {(Array.isArray(weakTopics) ? weakTopics : []).map((item, idx) => (
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
            {(Array.isArray(filteredTopics) ? filteredTopics : []).map((topic, idx) => {
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

      {/* 5. DYNAMIC QUESTION DEFICIT & LOST MARKS ANALYSIS (STRICT VTU MODULAR CHOICE RULES) */}
      {performance && performance.iaTests && performance.iaTests.length > 0 && (
        <div className="sp-section sp-deficit-analysis-section">
          <div className="sp-section-header">
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                <h3 className="sp-section-title" style={{ margin: 0 }}>
                  🔍 Where You Dropped Marks &amp; Diagnostic Analysis
                </h3>
                <span className="sp-vtu-rule-tag">VTU Modular Choice Rules Applied</span>
              </div>
              <span className="sp-section-desc">
                Itemized cognitive error breakdown across your chosen mandatory sub-questions. Unchosen alternative options carry zero penalty.
              </span>
            </div>

            {Array.isArray(performance?.iaTests) && performance.iaTests.length > 1 && (
              <div className="sp-ia-selector-bar">
                {(Array.isArray(performance.iaTests) ? performance.iaTests : []).map((t) => (
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

          {/* SUMMARY STRIP */}
          <div className="sp-deficit-summary-bar">
            <div className="sp-deficit-sum-metric">
              <span className="sp-dsum-lbl">Assessment</span>
              <strong>IA-{selectedIa} ({currentIaTest?.totalMarks || 0} / {currentIaTest?.maxMarks || 40} M)</strong>
            </div>
            <div className="sp-deficit-sum-metric">
              <span className="sp-dsum-lbl">Total Marks Dropped</span>
              <strong className="text-red">-{totalDeficitMarks.toFixed(1)} M Lost</strong>
            </div>
            <div className="sp-deficit-sum-metric">
              <span className="sp-dsum-lbl">Recoverable CIE Potential</span>
              <strong className="text-green">+{(totalDeficitMarks * (15.0 / 40.0)).toFixed(1)} M Scaled CIE</strong>
            </div>
            <div className="sp-deficit-sum-metric">
              <span className="sp-dsum-lbl">Choice Rule Enforcement</span>
              <span className="sp-rule-chip">✓ Mutual-Exclusion Verified</span>
            </div>
          </div>

          {/* PRIORITIZED REVISION ROADMAP (FASTEST GRADE JUMP) */}
          {priorityRevisionList.length > 0 && (
            <div className="sp-priority-remedial-box">
              <div className="sp-priority-head">
                <span className="sp-priority-star">🚀</span>
                <div>
                  <h4 className="sp-priority-title">Fast-Track Grade Recovery: Top Priority Remediation</h4>
                  <p className="sp-priority-sub">
                    Focus on these high-deficit topics first for the quickest jump on your continuous evaluation:
                  </p>
                </div>
              </div>

              <div className="sp-priority-items-row">
                {(Array.isArray(priorityRevisionList) ? priorityRevisionList : []).map((pri, pIdx) => {
                  const priCode = pri.code ? pri.code.toUpperCase() : `Q${pIdx + 1}`;
                  const priGain = Number((pri.deficitMarks * (15.0 / 40.0)).toFixed(1));

                  return (
                    <div key={pIdx} className="sp-priority-item-card">
                      <div className="sp-pri-badge-cluster">
                        <span className="sp-pri-rank">Priority #{pIdx + 1}</span>
                        <span className="sp-pri-gain">+{priGain} M Scaled CIE</span>
                      </div>
                      <div className="sp-pri-title">
                        Sub-Q {priCode}: {pri.topicName}
                      </div>
                      <div className="sp-pri-error">
                        ⚠️ Reason: {pri.cognitiveError} (-{pri.deficitMarks} M)
                      </div>
                      <button
                        type="button"
                        className="sp-pri-tutor-btn"
                        onClick={() =>
                          setTutorModal({
                            isOpen: true,
                            focusTopic: pri.topicName,
                            focusModule: pri.moduleNumber,
                            assessmentName: `IA-${selectedIa}`,
                            deficitContext: pri,
                          })
                        }
                      >
                        📖 Remediate with RAG Tutor →
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ITEM-BY-ITEM DEFICIT CARDS */}
          {deficits.length === 0 ? (
            <div className="sp-clean-score-card">
              <span className="sp-clean-icon">🎉</span>
              <h4>Flawless Score on Chosen Questions!</h4>
              <p>You scored full marks across all mandatory sub-questions in IA-{selectedIa}. Outstanding mastery!</p>
            </div>
          ) : (
            <div className="sp-deficits-list">
              <div className="sp-deficits-list-header">
                <span>Detailed Question Deficit &amp; Cognitive Diagnostic Breakdown:</span>
                <span className="sp-deficits-count">{deficits.length} Sub-Question Deficit{deficits.length > 1 ? "s" : ""}</span>
              </div>

              {(Array.isArray(deficits) ? deficits : []).map((item, idx) => {
                const qCode = item.code ? item.code.toUpperCase() : `Q${idx + 1}`;
                const qKey = `def-${item.parsedQNum}-${item.code || idx}`;
                const isExpanded = !!expandedSolutions[qKey];
                const modelData = getModelSolutionData(item);
                const isCritical = item.severity === "CRITICAL" || item.marksScored === 0;

                return (
                  <div key={idx} className={`sp-deficit-card ${isCritical ? "border-critical" : ""}`}>
                    {/* TOP META ROW */}
                    <div className="sp-deficit-top-row">
                      <div className="sp-deficit-badges-left">
                        <span className="sp-def-code-chip">Sub-Q {qCode}</span>
                        <span className="sp-def-mod-chip">Module {item.moduleNumber}</span>
                        {item.co && <span className="sp-def-co-chip">{item.co}</span>}
                        <span className={`sp-def-error-badge ${isCritical ? "badge-critical" : "badge-warn"}`}>
                          ⚠️ {item.cognitiveError}
                        </span>
                      </div>

                      <div className="sp-deficit-scores-right">
                        <div className="sp-def-score-pair">
                          <span className="sp-def-scored">
                            Scored: <strong>{item.marksScored}</strong> / {item.maxMarks} M
                          </span>
                          <span className="sp-def-lost-tag">-{item.deficitMarks} M Deficit</span>
                        </div>
                      </div>
                    </div>

                    {/* TOPIC / CONCEPT TITLE */}
                    <div className="sp-deficit-topic-block">
                      <h4 className="sp-def-topic-heading">{item.topicName}</h4>
                      <p className="sp-def-concept-sub">
                        Associated Syllabus Learning Objective: {item.co || "CO1"} • Module {item.moduleNumber} Core Curriculum
                      </p>
                    </div>

                    {/* PROGRESS BAR DISPLAY */}
                    <div className="sp-def-progress-wrap">
                      <div className="sp-def-bar-bg">
                        <div
                          className="sp-def-bar-fill"
                          style={{
                            width: `${Math.min(100, Math.max(4, item.pct))}%`,
                            background: item.pct < 50 ? "#ef4444" : "#f59e0b",
                          }}
                        />
                      </div>
                      <span className="sp-def-pct-text">{item.pct.toFixed(0)}% Scored</span>
                    </div>

                    {/* ACTIONS ROW */}
                    <div className="sp-def-actions-row">
                      <button
                        type="button"
                        className="sp-def-rag-btn"
                        onClick={() =>
                          setTutorModal({
                            isOpen: true,
                            focusTopic: item.topicName,
                            focusModule: item.moduleNumber,
                            assessmentName: `IA-${selectedIa}`,
                            deficitContext: item,
                          })
                        }
                      >
                        📖 Study Notes &amp; RAG Excerpts
                      </button>

                      <button
                        type="button"
                        className={`sp-def-model-toggle-btn ${isExpanded ? "active" : ""}`}
                        onClick={() =>
                          setExpandedSolutions((prev) => ({ ...prev, [qKey]: !prev[qKey] }))
                        }
                      >
                        {isExpanded ? "▲ Hide Model Solution & Rubric" : "💡 View Model Solution & Rubric"}
                      </button>
                    </div>

                    {/* EXPANDABLE MODEL SOLUTION & RUBRIC REVEAL */}
                    {isExpanded && (
                      <div className="sp-model-reveal-panel">
                        <div className="sp-model-section">
                          <div className="sp-model-sub-heading">
                            <span>💡 Benchmark Model Solution:</span>
                          </div>
                          <p className="sp-model-text">{modelData.benchmarkSolution}</p>
                        </div>

                        <div className="sp-model-section">
                          <div className="sp-model-sub-heading">
                            <span>📐 Expected Diagram &amp; Derivation Components:</span>
                          </div>
                          <ul className="sp-model-diagrams-list">
                            {(Array.isArray(modelData?.expectedDiagrams) ? modelData.expectedDiagrams : []).map((d, dIdx) => (
                              <li key={dIdx}>{d}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="sp-model-section">
                          <div className="sp-model-sub-heading">
                            <span>📋 Grading Rubric Breakdown:</span>
                          </div>
                          <div className="sp-rubric-table">
                            {(Array.isArray(modelData?.rubricCriteria) ? modelData.rubricCriteria : []).map((rc, rIdx) => (
                              <div key={rIdx} className="sp-rubric-row">
                                <div className="sp-rubric-criterion">
                                  <strong>{rc.criterion}</strong>
                                  <span className="sp-rubric-sub">{rc.details}</span>
                                </div>
                                <div className="sp-rubric-weight">
                                  <span className="sp-rweight-chip">{rc.weight} ({rc.marks})</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ALTERNATIVE CHOICE QUESTIONS (UNPENALIZED) */}
          {alternativeChoices.length > 0 && (
            <div className="sp-unchosen-choices-block">
              <div className="sp-unchosen-head">
                <span className="sp-unchosen-icon">⚖️</span>
                <div>
                  <h5 className="sp-unchosen-title">Alternative Modular Choice Questions (Unpenalized)</h5>
                  <p className="sp-unchosen-sub">
                    In accordance with VTU examination scheme, the alternative question options below were omitted without deficit or score penalty:
                  </p>
                </div>
              </div>

              <div className="sp-unchosen-grid">
                {(Array.isArray(alternativeChoices) ? alternativeChoices : []).map((alt, aIdx) => {
                  const altCode = alt.code ? alt.code.toUpperCase() : `Q${aIdx + 1}`;
                  return (
                    <div key={aIdx} className="sp-unchosen-chip">
                      <span className="sp-unchosen-code">Sub-Q {altCode}</span>
                      <span className="sp-unchosen-mod">Module {alt.moduleNumber}</span>
                      <span className="sp-unchosen-status">
                        ✓ Omitted Choice (Alternative to Question {alt.alternativeTo}) — 0.0 M Deficit
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. INTERACTIVE RAG STUDY TUTOR DRAWER / MODAL */}
      {tutorModal.isOpen && (
        <StudentRagTutorModal
          classroomId={effectiveClassroomId}
          focusTopic={tutorModal.focusTopic}
          focusModule={tutorModal.focusModule}
          assessmentName={tutorModal.assessmentName}
          deficitContext={tutorModal.deficitContext}
          onClose={() =>
            setTutorModal({
              isOpen: false,
              focusTopic: null,
              focusModule: null,
              assessmentName: "IA-1",
              deficitContext: null,
            })
          }
        />
      )}
    </div>
  );
};

export default StudentPerformanceView;
