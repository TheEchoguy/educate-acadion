import React, { useState, useEffect } from "react";
import { getMyRiskXai, getStudentRiskXai } from "../../services/classroomService";
import StudentRagTutorModal from "./StudentRagTutorModal";
import "./StudentRiskXaiCoach.css";

const StudentRiskXaiCoach = ({ classroomId, studentUsn = null }) => {
  const [riskData, setRiskData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [completedSteps, setCompletedSteps] = useState({});
  const [tutorModal, setTutorModal] = useState({
    isOpen: false,
    focusTopic: null,
    focusModule: null,
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

      {/* 2. SHAP ATTRIBUTION EXPLAINABILITY BARS */}
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
          {shapAttributions.map((attr, idx) => {
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

      {/* 3. PERSONALIZED AI ACTION PLAN */}
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
                })
              }
            >
              🤖 Study with AI Tutor
            </button>
          </div>

          <div className="xai-plan-checklist">
            {studentActionPlan.map((step, idx) => {
              // Extract potential module number or topic keywords from step
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

      {/* 4. TEACHER INTERVENTION NOTE (VISIBLE TO STUDENT FOR TRANSPARENCY) */}
      {teacherIntervention && (
        <div className="xai-teacher-note">
          <span className="xai-note-icon">👩‍🏫</span>
          <div className="xai-note-body">
            <strong>Recommended Instructor Remedial Action:</strong>
            <p>{teacherIntervention}</p>
          </div>
        </div>
      )}

      {/* 5. INTERACTIVE RAG STUDY TUTOR DRAWER / MODAL */}
      {tutorModal.isOpen && (
        <StudentRagTutorModal
          classroomId={classroomId}
          focusTopic={tutorModal.focusTopic}
          focusModule={tutorModal.focusModule}
          onClose={() =>
            setTutorModal({
              isOpen: false,
              focusTopic: null,
              focusModule: null,
            })
          }
        />
      )}
    </div>
  );
};

export default StudentRiskXaiCoach;
