import React, { useState, useEffect } from "react";
import { getMyRiskXai, getStudentRiskXai } from "../../services/classroomService";
import StudentRagTutorModal from "./StudentRagTutorModal";
import "./StudentRiskXaiCoach.css";

const StudentRiskXaiCoach = ({
  classroomId,
  studentUsn = null,
  totalCieSecured = 20.0,
  rawIaAverage = 28.0,
  scaledIaScore = 10.5,
  deficits = [],
}) => {
  const [riskData, setRiskData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [completedSteps, setCompletedSteps] = useState({});
  const [simulatedNextIa, setSimulatedNextIa] = useState(32);
  const [simulatedRemediated, setSimulatedRemediated] = useState(1);
  const [tutorModal, setTutorModal] = useState({
    isOpen: false,
    focusTopic: null,
    focusModule: null,
    deficitContext: null,
  });

  useEffect(() => {
    let active = true;
    if (classroomId) {
      setLoading(true);
      setError(null);

      const fetchPromise = studentUsn
        ? getStudentRiskXai(classroomId, studentUsn)
        : getMyRiskXai(classroomId);

      fetchPromise
        .then((data) => {
          if (active) {
            setRiskData(data);
            setLoading(false);
          }
        })
        .catch((err) => {
          console.error("Failed to load risk XAI data:", err);
          if (active) {
            setError(
              err.response?.data?.message ||
                "Failed to load Explainable AI risk diagnostics."
            );
            setLoading(false);
          }
        });
    }

    return () => {
      active = false;
    };
  }, [classroomId, studentUsn]);

  useEffect(() => {
    if (rawIaAverage) {
      setSimulatedNextIa(Math.min(40, Math.max(15, Math.round(rawIaAverage + 4))));
    }
    if (deficits && deficits.length > 0) {
      setSimulatedRemediated(Math.min(deficits.length, Math.max(1, Math.ceil(deficits.length / 2))));
    }
  }, [rawIaAverage, deficits]);

  const toggleStep = (idx) => {
    setCompletedSteps((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  if (loading) {
    return (
      <div className="xai-loading-box">
        <div className="xai-spinner" />
        <p>Synthesizing Random Forest & SHAP Explainable AI diagnostics...</p>
      </div>
    );
  }

  if (error || !riskData) {
    return (
      <div className="xai-empty-box">
        <span className="xai-empty-icon">🤖</span>
        <h4>Explainable AI Risk Engine Idle</h4>
        <p>
          {error ||
            "Please ensure IA question blueprint and marks are recorded to compute machine learning risk predictions."}
        </p>
      </div>
    );
  }

  const {
    riskLevel = "ON_TRACK",
    riskScore = 15.0,
    probabilities = { onTrack: 0.85, needsAttention: 0.12, highRisk: 0.03 },
    shapAttributions = [],
    studentActionPlan = [],
    teacherIntervention = "",
    evaluationSource = "PYTHON_ML_SHAP",
  } = riskData;

  const isHigh = riskLevel === "HIGH_RISK";
  const isMed = riskLevel === "NEEDS_ATTENTION";
  const statusTheme = isHigh ? "theme-high" : isMed ? "theme-med" : "theme-safe";

  const statusLabel = isHigh
    ? "High Risk of CIE / Course Failure"
    : isMed
    ? "Needs Academic Attention (Marginal Standing)"
    : "On Track for Distinction / Full Clearance";

  // Dynamic Trajectory Simulation Calculations
  const nextIaScaled = (simulatedNextIa / 40.0) * 15.0;
  const scaledGain = Math.max(0, nextIaScaled - (scaledIaScore || 10.0));
  const remediationScaledGain = simulatedRemediated * 1.15;
  const simProjectedTotalCie = Math.min(
    50.0,
    Number(((totalCieSecured || 20.0) + scaledGain + remediationScaledGain).toFixed(1))
  );

  const baselineHazard = Math.round(riskScore || 15);
  const hazardDrop = Math.round((simulatedRemediated * 11.0) + (scaledGain * 3.4));
  const simProjectedHazard = Math.max(5, Math.min(95, baselineHazard - hazardDrop));
  const actualHazardReduction = Math.max(0, baselineHazard - simProjectedHazard);

  let simTrajectoryStatus = "Needs Attention (< 20 M)";
  let simTrajectoryTheme = "high";
  if (simProjectedTotalCie >= 42.0) {
    simTrajectoryStatus = "On Track (Distinction / Grade S)";
    simTrajectoryTheme = "safe";
  } else if (simProjectedTotalCie >= 32.0) {
    simTrajectoryStatus = "On Track (First Class)";
    simTrajectoryTheme = "safe";
  } else if (simProjectedTotalCie >= 20.0) {
    simTrajectoryStatus = "On Track (Passing Benchmark Cleared)";
    simTrajectoryTheme = "med";
  }

  const seeNeededToPass = Math.max(18.0, Number((40.0 - simProjectedTotalCie).toFixed(1)));
  const seeNeededForFirstClass = Math.max(18.0, Number((60.0 - simProjectedTotalCie).toFixed(1)));
  const seeNeededForDistinction = Math.max(18.0, Number((75.0 - simProjectedTotalCie).toFixed(1)));

  // Prioritized Revision: Top 1-2 Deficits sorted by recovery impact
  const topPriorities = deficits && deficits.length > 0 ? deficits.slice(0, 2) : [];

  return (
    <div className={`xai-coach-card ${statusTheme}`}>
      {/* 1. TOP RISK HERO BANNER */}
      <div className="xai-hero-row">
        <div className="xai-hero-left">
          <div className="xai-engine-tag">
            <span>⚡ SHAP Explainable AI (XAI) Coach</span>
            {evaluationSource && (
              <span className="xai-source-chip">
                {evaluationSource === "PYTHON_ML_SHAP" ? "Random Forest + TreeExplainer" : "Local Rule Engine"}
              </span>
            )}
          </div>
          <h3 className="xai-status-title">{statusLabel}</h3>
          <p className="xai-status-sub">
            Real-time machine learning failure-hazard assessment based on your syllabus coverage, sub-question mastery, and choice efficiency.
          </p>

          <div className="xai-prob-pills">
            <span className="xai-prob-chip safe">
              Pass Prob: <strong>{(probabilities.onTrack * 100).toFixed(0)}%</strong>
            </span>
            <span className="xai-prob-chip med">
              Marginal: <strong>{(probabilities.needsAttention * 100).toFixed(0)}%</strong>
            </span>
            <span className="xai-prob-chip high">
              Hazard: <strong>{(probabilities.highRisk * 100).toFixed(0)}%</strong>
            </span>
          </div>
        </div>

        {/* RISK GAUGE METER */}
        <div className="xai-gauge-box">
          <span className="xai-gauge-lbl">Failure Hazard Score</span>
          <div className="xai-gauge-score-row">
            <span className="xai-gauge-score">{riskScore.toFixed(0)}</span>
            <span className="xai-gauge-max">/ 100</span>
          </div>
          <div className="xai-gauge-bar-bg">
            <div
              className={`xai-gauge-bar-fill ${statusTheme}`}
              style={{ width: `${Math.min(100, Math.max(5, riskScore))}%` }}
            />
          </div>
          <span className="xai-gauge-status">
            {isHigh ? "Critical Action Required" : isMed ? "Reviewing Weak Topics Advised" : "Healthy Standing"}
          </span>
        </div>
      </div>

      {/* 2. STUDENT INTERACTIVE WHAT-IF TRAJECTORY SIMULATOR */}
      <div className="xai-section xai-simulator-wrapper">
        <div className="xai-section-head">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "8px", width: "100%" }}>
            <div>
              <h4 className="xai-section-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span>🔮 Future Trajectory Simulator</span>
                <span className="xai-interactive-badge">Interactive Live Forecast</span>
              </h4>
              <p className="xai-section-sub">
                Adjust projected targets on upcoming assessments and see how quickly your failure hazard collapses and your final CIE grade trajectory jumps.
              </p>
            </div>
            <span className="xai-live-indicator">● LIVE SIMULATION</span>
          </div>
        </div>

        <div className="xai-sim-body">
          {/* SLIDERS CONTROLS */}
          <div className="xai-sim-controls-grid">
            <div className="xai-sim-control-card">
              <div className="xai-slider-header">
                <label>Target Upcoming IA Score</label>
                <span className="xai-slider-val-tag">
                  {simulatedNextIa} / 40.0 M <small>({nextIaScaled.toFixed(1)}/15 Scaled)</small>
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="40"
                step="1"
                value={simulatedNextIa}
                onChange={(e) => setSimulatedNextIa(Number(e.target.value))}
                className="xai-range-slider"
              />
              <div className="xai-slider-ticks">
                <span>10 M (Passing)</span>
                <span>25 M (Average)</span>
                <span>40 M (Max)</span>
              </div>
            </div>

            <div className="xai-sim-control-card">
              <div className="xai-slider-header">
                <label>Remediated Sub-Questions Resolved</label>
                <span className="xai-slider-val-tag">
                  {simulatedRemediated} of {Math.max(1, deficits.length || 4)} Sub-Questions
                </span>
              </div>
              <input
                type="range"
                min="0"
                max={Math.max(1, deficits.length || 4)}
                step="1"
                value={simulatedRemediated}
                onChange={(e) => setSimulatedRemediated(Number(e.target.value))}
                className="xai-range-slider"
              />
              <div className="xai-slider-ticks">
                <span>0 Fixed</span>
                <span>{Math.ceil(Math.max(1, deficits.length || 4) / 2)} Half Remediated</span>
                <span>All {Math.max(1, deficits.length || 4)} Solved</span>
              </div>
            </div>
          </div>

          {/* SIMULATION PREVIEW DASHBOARD */}
          <div className="xai-sim-preview-grid">
            {/* Box 1: Hazard Collapse */}
            <div className="xai-preview-box">
              <span className="xai-prev-lbl">Hazard Score Reduction</span>
              <div className="xai-hazard-transition">
                <span className="xai-hazard-old">{baselineHazard}</span>
                <span className="xai-arrow">➔</span>
                <span className="xai-hazard-new">{simProjectedHazard}</span>
              </div>
              <div className="xai-hazard-reduction-chip">
                ⚡ -{actualHazardReduction} Pts Hazard Reduction
              </div>
            </div>

            {/* Box 2: Projected CIE Status */}
            <div className="xai-preview-box">
              <span className="xai-prev-lbl">Projected Total CIE (out of 50)</span>
              <div className="xai-cie-projection-row">
                <span className="xai-cie-score-big">{simProjectedTotalCie.toFixed(1)}</span>
                <span className="xai-cie-denom">/ 50 M</span>
              </div>
              <span className={`xai-trajectory-pill ${simTrajectoryTheme}`}>
                {simTrajectoryStatus}
              </span>
            </div>

            {/* Box 3: Minimum Target Marks in SEE */}
            <div className="xai-preview-box xai-see-targets-box">
              <span className="xai-prev-lbl">SEE Target Marks Needed (out of 50)</span>
              <div className="xai-see-targets-list">
                <div className="xai-see-target-row">
                  <span>To Pass (Total ≥ 40):</span>
                  <strong>{seeNeededToPass} M</strong>
                </div>
                <div className="xai-see-target-row">
                  <span>First Class (Total ≥ 60):</span>
                  <strong>{seeNeededForFirstClass <= 50 ? `${seeNeededForFirstClass} M` : "CIE Gap"}</strong>
                </div>
                <div className="xai-see-target-row">
                  <span>Distinction (Total ≥ 75):</span>
                  <strong>{seeNeededForDistinction <= 50 ? `${seeNeededForDistinction} M` : "48+ M"}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. PRIORITIZED REVISION ROADMAP (FASTEST GRADE JUMP) */}
      {topPriorities.length > 0 && (
        <div className="xai-section xai-priorities-box">
          <div className="xai-section-head">
            <h4 className="xai-section-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span>🚀 Prioritized Revision Sequence</span>
              <span className="xai-fast-jump-tag">Fastest Grade Jump</span>
            </h4>
            <p className="xai-section-sub">
              Remediating these specific high-deficit questions first will yield the steepest score recovery on your continuous evaluation:
            </p>
          </div>

          <div className="xai-priorities-grid">
            {(Array.isArray(topPriorities) ? topPriorities : []).map((item, idx) => {
              const qCode = item.code ? item.code.toUpperCase() : `Q${idx + 1}`;
              const marksRecovery = item.deficitMarks || (item.maxMarks - (item.marksScored || 0));
              const scaledRecovery = Number((marksRecovery * (15.0 / 40.0)).toFixed(1));

              return (
                <div key={idx} className="xai-priority-card">
                  <div className="xai-priority-rank-badge">
                    #{idx + 1} IMPACT PRIORITY
                  </div>

                  <div className="xai-priority-header">
                    <span className="xai-priority-code">Sub-Q {qCode}</span>
                    <span className="xai-priority-mod">Mod {item.moduleNumber}</span>
                    <span className="xai-priority-gain-pill">
                      +{scaledRecovery} M Scaled CIE
                    </span>
                  </div>

                  <h5 className="xai-priority-topic">{item.topicName}</h5>

                  <div className="xai-priority-error-row">
                    <span className="xai-error-tag">
                      ⚠️ {item.cognitiveError || "Conceptual Gap"}
                    </span>
                    <span className="xai-marks-lost-tag">
                      -{marksRecovery} M Deficit
                    </span>
                  </div>

                  <button
                    type="button"
                    className="xai-priority-tutor-btn"
                    onClick={() =>
                      setTutorModal({
                        isOpen: true,
                        focusTopic: item.topicName,
                        focusModule: item.moduleNumber,
                        deficitContext: item,
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

      {/* 4. SHAP ATTRIBUTION EXPLAINABILITY BARS */}
      <div className="xai-section">
        <div className="xai-section-head">
          <div>
            <h4 className="xai-section-title">
              🔍 What Drives This Assessment? (SHAP Feature Attributions)
            </h4>
            <p className="xai-section-sub">
              Mathematical feature attributions revealing factors pulling down your standing (Red) versus protective factors (Green).
            </p>
          </div>
        </div>

        <div className="xai-attributions-list">
          {(Array.isArray(shapAttributions) ? shapAttributions : []).map((attr, idx) => {
            const increasesRisk = attr.direction === "INCREASES_RISK";
            const barClass = increasesRisk ? "bar-risk" : "bar-shield";

            return (
              <div key={idx} className="xai-attr-row">
                <div className="xai-attr-meta">
                  <div className="xai-attr-name-row">
                    <span className="xai-attr-name">{attr.featureName}</span>
                    <span className={`xai-attr-badge ${increasesRisk ? "badge-risk" : "badge-shield"}`}>
                      {increasesRisk ? `+${attr.impactPct}% Increases Risk` : `-${attr.impactPct}% Protects Grade`}
                    </span>
                  </div>
                  <p className="xai-attr-desc">{attr.description}</p>
                </div>

                <div className="xai-attr-bar-wrap">
                  <div className="xai-attr-bar-bg">
                    <div
                      className={`xai-attr-bar-fill ${barClass}`}
                      style={{ width: `${Math.min(100, Math.max(8, attr.impactPct))}%` }}
                    />
                  </div>
                  <span className="xai-attr-pct">{attr.impactPct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. PERSONALIZED AI ACTION PLAN */}
      {studentActionPlan && studentActionPlan.length > 0 && (
        <div className="xai-section">
          <div className="xai-section-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <h4 className="xai-section-title">🎯 Targeted AI Study Prescription</h4>
              <p className="xai-section-sub">
                Follow this actionable checklist to reinforce your weak topic areas before next assessment:
              </p>
            </div>
            <button
              type="button"
              className="xai-study-tutor-btn"
              onClick={() =>
                setTutorModal({
                  isOpen: true,
                  focusTopic: "High-Priority Exam Topics & Weak Points",
                  focusModule: 1,
                  deficitContext: null,
                })
              }
            >
              🤖 Study with AI Tutor
            </button>
          </div>

          <div className="xai-plan-checklist">
            {(Array.isArray(studentActionPlan) ? studentActionPlan : []).map((step, idx) => {
              const modMatch = step.match(/Module\s*(\d)/i);
              const stepMod = modMatch ? parseInt(modMatch[1], 10) : 1;

              return (
                <div
                  key={idx}
                  className={`xai-plan-item ${completedSteps[idx] ? "completed" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={!!completedSteps[idx]}
                    onChange={() => toggleStep(idx)}
                    className="xai-checkbox"
                  />
                  <span className="xai-step-text" onClick={() => toggleStep(idx)} style={{ cursor: "pointer", flex: 1 }}>
                    {step}
                  </span>
                  <button
                    type="button"
                    className="xai-tutor-chip"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTutorModal({
                        isOpen: true,
                        focusTopic: step.replace(/^(Focus on|Revise|Review|Practice)\s*/i, "").slice(0, 50),
                        focusModule: stepMod,
                        deficitContext: null,
                      });
                    }}
                  >
                    🤖 Study Notes
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. TEACHER INTERVENTION NOTE */}
      {teacherIntervention && (
        <div className="xai-teacher-note">
          <span className="xai-note-icon">👩‍🏫</span>
          <div className="xai-note-body">
            <strong>Recommended Instructor Remedial Action:</strong>
            <p>{teacherIntervention}</p>
          </div>
        </div>
      )}

      {/* 7. INTERACTIVE RAG STUDY TUTOR DRAWER / MODAL */}
      {tutorModal.isOpen && (
        <StudentRagTutorModal
          classroomId={classroomId}
          focusTopic={tutorModal.focusTopic}
          focusModule={tutorModal.focusModule}
          deficitContext={tutorModal.deficitContext}
          onClose={() =>
            setTutorModal({
              isOpen: false,
              focusTopic: null,
              focusModule: null,
              deficitContext: null,
            })
          }
        />
      )}
    </div>
  );
};

export default StudentRiskXaiCoach;
