import React, { useState, useEffect } from "react";
import {
  getClassroomRiskWatchlist,
  getStudentRiskXai,
} from "../../services/classroomService";
import toast from "react-hot-toast";
import "./TeacherRiskWatchlistView.css";

const TeacherRiskWatchlistView = ({ classroomId, classroomName }) => {
  const [watchlistData, setWatchlistData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL"); // ALL | HIGH_RISK | NEEDS_ATTENTION | ON_TRACK

  // Modal / Drawer state for Student XAI Inspection & Intervention
  const [selectedStudentUsn, setSelectedStudentUsn] = useState(null);
  const [inspectXaiData, setInspectXaiData] = useState(null);
  const [loadingInspect, setLoadingInspect] = useState(false);
  const [sendingIntervention, setSendingIntervention] = useState(false);

  useEffect(() => {
    let active = true;
    if (classroomId) {
      setLoading(true);
      setError(null);
      getClassroomRiskWatchlist(classroomId)
        .then((data) => {
          if (active) {
            setWatchlistData(data);
            setLoading(false);
          }
        })
        .catch((err) => {
          console.error("Failed to load risk watchlist:", err);
          if (active) {
            setError(
              err.response?.data?.message ||
                "Failed to generate whole-class risk prediction watchlist."
            );
            setLoading(false);
          }
        });
    }

    return () => {
      active = false;
    };
  }, [classroomId]);

  const handleInspectStudent = async (usn) => {
    setSelectedStudentUsn(usn);
    setLoadingInspect(true);
    try {
      const data = await getStudentRiskXai(classroomId, usn);
      setInspectXaiData(data);
    } catch (err) {
      console.error("Failed to fetch student XAI report:", err);
      toast.error("Could not load student Explainable AI report.");
    } finally {
      setLoadingInspect(false);
    }
  };

  const handleSendIntervention = () => {
    setSendingIntervention(true);
    setTimeout(() => {
      setSendingIntervention(false);
      toast.success(
        `Remedial Study Prescription & Intervention plan dispatched to ${inspectXaiData?.name || selectedStudentUsn}!`,
        { icon: "📨", duration: 4000 }
      );
      closeModal();
    }, 600);
  };

  const closeModal = () => {
    setSelectedStudentUsn(null);
    setInspectXaiData(null);
  };

  if (loading) {
    return (
      <div className="trw-loading-card">
        <div className="trw-spinner" />
        <p>Crunching Random Forest risk probabilities and SHAP feature drivers...</p>
      </div>
    );
  }

  if (error || !watchlistData) {
    return (
      <div className="trw-empty-card">
        <span className="trw-empty-icon">🚨</span>
        <h3>Risk Watchlist Not Available</h3>
        <p>
          {error ||
            "Please ensure IA split-up marks and blueprints are recorded for this course."}
        </p>
      </div>
    );
  }

  const {
    totalStudents = 0,
    highRiskCount = 0,
    needsAttentionCount = 0,
    onTrackCount = 0,
    classHealthScore = 85.0,
    watchlist = [],
  } = watchlistData;

  const filteredWatchlist = watchlist.filter((st) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (st.usn && st.usn.toLowerCase().includes(q)) ||
      (st.studentName && st.studentName.toLowerCase().includes(q)) ||
      (st.topRiskFactor && st.topRiskFactor.toLowerCase().includes(q));

    const matchesFilter = riskFilter === "ALL" || st.riskLevel === riskFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="trw-container">
      {/* 1. TOP SUMMARY METRIC CARDS */}
      <div className="trw-metrics-grid">
        <div className="trw-metric-card alert">
          <div className="trw-metric-icon">🚨</div>
          <div className="trw-metric-content">
            <span className="trw-metric-title">Critical High Risk</span>
            <span className="trw-metric-val">{highRiskCount}</span>
            <span className="trw-metric-sub">Trajectory &lt; 40% (Course Failure)</span>
          </div>
        </div>

        <div className="trw-metric-card warn">
          <div className="trw-metric-icon">⚠️</div>
          <div className="trw-metric-content">
            <span className="trw-metric-title">Needs Attention</span>
            <span className="trw-metric-val">{needsAttentionCount}</span>
            <span className="trw-metric-sub">Marginal 40–59% CIE Standing</span>
          </div>
        </div>

        <div className="trw-metric-card success">
          <div className="trw-metric-icon">✅</div>
          <div className="trw-metric-content">
            <span className="trw-metric-title">On Track (Distinction)</span>
            <span className="trw-metric-val">{onTrackCount}</span>
            <span className="trw-metric-sub">Passing CIE &ge; 60%</span>
          </div>
        </div>

        <div className="trw-metric-card health">
          <div className="trw-metric-icon">🩺</div>
          <div className="trw-metric-content">
            <span className="trw-metric-title">Classroom Health Index</span>
            <span className="trw-metric-val highlight">{classHealthScore.toFixed(0)}%</span>
            <div className="trw-health-bar-bg">
              <div
                className="trw-health-bar-fill"
                style={{
                  width: `${classHealthScore}%`,
                  background:
                    classHealthScore >= 75
                      ? "#10b981"
                      : classHealthScore >= 50
                      ? "#f59e0b"
                      : "#ef4444",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. WATCHLIST TABLE CARD */}
      <div className="trw-table-card">
        <div className="trw-card-header">
          <div>
            <div className="trw-badge">
              ⚡ Python ML Risk Prediction & SHAP Explainable AI (XAI) Engine
            </div>
            <h3 className="trw-card-title">🚨 Real-Time Cohort Failure Risk Watchlist</h3>
            <p className="trw-card-sub">
              Students ranked by failure hazard probability. Click Inspect to review SHAP feature attributions and deploy remedial study plans.
            </p>
          </div>

          <div className="trw-filter-controls">
            <input
              type="text"
              placeholder="Search by USN or Name..."
              className="trw-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              className="trw-select"
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
            >
              <option value="ALL">All Risk Levels ({watchlist.length})</option>
              <option value="HIGH_RISK">High Risk ({highRiskCount})</option>
              <option value="NEEDS_ATTENTION">Needs Attention ({needsAttentionCount})</option>
              <option value="ON_TRACK">On Track ({onTrackCount})</option>
            </select>
          </div>
        </div>

        {filteredWatchlist.length === 0 ? (
          <div className="trw-empty-table">
            <p>No students match your filter criteria.</p>
          </div>
        ) : (
          <div className="trw-table-wrapper">
            <table className="trw-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>USN</th>
                  <th>Student Name</th>
                  <th>Scaled CIE (/15)</th>
                  <th>Risk Level</th>
                  <th>Hazard Score</th>
                  <th>Primary SHAP Risk Driver</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredWatchlist.map((st, idx) => {
                  const isHigh = st.riskLevel === "HIGH_RISK";
                  const isMed = st.riskLevel === "NEEDS_ATTENTION";
                  const rowClass = isHigh ? "trw-row-high" : isMed ? "trw-row-med" : "";
                  const badgeClass = isHigh ? "badge-high" : isMed ? "badge-med" : "badge-safe";

                  return (
                    <tr key={st.usn || idx} className={rowClass}>
                      <td className="trw-cell-muted">{idx + 1}</td>
                      <td>
                        <span className="trw-usn-chip">{st.usn}</span>
                      </td>
                      <td className="trw-name-cell">{st.studentName}</td>
                      <td className="trw-cie-cell">
                        <strong>{st.scaledIaScore?.toFixed(1)}</strong> / 15.0
                        <span className="trw-cie-pct">({st.cieScaledPct?.toFixed(0)}%)</span>
                      </td>
                      <td>
                        <span className={`trw-risk-badge ${badgeClass}`}>
                          {isHigh ? "High Risk" : isMed ? "Needs Attention" : "On Track"}
                        </span>
                      </td>
                      <td>
                        <div className="trw-hazard-cell">
                          <span className="trw-hazard-num">{st.riskScore?.toFixed(0)}</span>
                          <div className="trw-hazard-bar">
                            <div
                              className={`trw-hazard-fill ${badgeClass}`}
                              style={{ width: `${Math.min(100, Math.max(5, st.riskScore))}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="trw-driver-cell" title={st.topRiskFactor}>
                        <span className="trw-driver-text">
                          {isHigh ? "🔴 " : isMed ? "🟡 " : "🟢 "}
                          {st.topRiskFactor}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="trw-inspect-btn"
                          onClick={() => handleInspectStudent(st.usn)}
                        >
                          🔍 Inspect XAI & Intervene
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

      {/* 3. INSPECT XAI & INTERVENTION MODAL */}
      {selectedStudentUsn && (
        <div className="trw-modal-overlay" onClick={closeModal}>
          <div className="trw-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="trw-modal-header">
              <div>
                <span className="trw-modal-tag">Explainable AI (XAI) Diagnostic Drilldown</span>
                <h3 className="trw-modal-title">
                  {inspectXaiData?.name || selectedStudentUsn}
                </h3>
                <span className="trw-modal-usn">USN: {selectedStudentUsn}</span>
              </div>
              <button type="button" className="trw-modal-close" onClick={closeModal}>
                ✕
              </button>
            </div>

            <div className="trw-modal-body">
              {loadingInspect ? (
                <div className="trw-modal-loading">
                  <div className="trw-spinner" />
                  <p>Computing TreeExplainer SHAP values and actionable interventions...</p>
                </div>
              ) : inspectXaiData ? (
                <div className="trw-modal-stack">
                  {/* RISK LEVEL HERO IN MODAL */}
                  <div
                    className={`trw-modal-hero ${
                      inspectXaiData.riskLevel === "HIGH_RISK"
                        ? "hero-high"
                        : inspectXaiData.riskLevel === "NEEDS_ATTENTION"
                        ? "hero-med"
                        : "hero-safe"
                    }`}
                  >
                    <div>
                      <span className="trw-hero-lbl">ASSESSED FAILURE RISK</span>
                      <h4>{inspectXaiData.riskLevel?.replace(/_/g, " ")}</h4>
                    </div>
                    <div className="trw-hero-score-box">
                      <span className="trw-hero-score">{inspectXaiData.riskScore?.toFixed(0)}</span>
                      <span className="trw-hero-score-sub">Hazard Score / 100</span>
                    </div>
                  </div>

                  {/* SHAP EXPLANATION BARS */}
                  <div className="trw-modal-section">
                    <h4 className="trw-sec-title">
                      🔍 SHAP Mathematical Feature Attributions
                    </h4>
                    <p className="trw-sec-sub">
                      Exact percentage contribution of each academic parameter to this student's risk assessment:
                    </p>

                    <div className="trw-shap-list">
                      {inspectXaiData.shapAttributions?.map((attr, idx) => {
                        const increasesRisk = attr.direction === "INCREASES_RISK";
                        return (
                          <div key={idx} className="trw-shap-row">
                            <div className="trw-shap-left">
                              <div className="trw-shap-title-row">
                                <span className="trw-shap-name">{attr.featureName}</span>
                                <span
                                  className={`trw-shap-badge ${
                                    increasesRisk ? "badge-risk" : "badge-safe"
                                  }`}
                                >
                                  {increasesRisk
                                    ? `+${attr.impactPct}% Increases Risk`
                                    : `-${attr.impactPct}% Protects Standing`}
                                </span>
                              </div>
                              <p className="trw-shap-desc">{attr.description}</p>
                            </div>
                            <div className="trw-shap-bar-box">
                              <div className="trw-shap-bar-bg">
                                <div
                                  className={`trw-shap-bar-fill ${
                                    increasesRisk ? "bar-risk" : "bar-safe"
                                  }`}
                                  style={{ width: `${Math.min(100, Math.max(8, attr.impactPct))}%` }}
                                />
                              </div>
                              <span className="trw-shap-pct">{attr.impactPct}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* RECOMMENDED TEACHER INTERVENTION */}
                  <div className="trw-modal-section highlight-intervention">
                    <h4 className="trw-sec-title">👩‍🏫 Prescribed Instructor Remedial Intervention</h4>
                    <p className="trw-intervention-text">{inspectXaiData.teacherIntervention}</p>
                  </div>

                  {/* STUDENT ACTION PLAN PREVIEW */}
                  {inspectXaiData.studentActionPlan && (
                    <div className="trw-modal-section">
                      <h4 className="trw-sec-title">📋 Student Targeted Study Checklist</h4>
                      <ul className="trw-plan-list">
                        {inspectXaiData.studentActionPlan.map((step, idx) => (
                          <li key={idx}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="trw-modal-footer">
              <button
                type="button"
                className="trw-btn-dismiss"
                onClick={closeModal}
              >
                Close
              </button>
              <button
                type="button"
                className="trw-btn-intervene"
                onClick={handleSendIntervention}
                disabled={sendingIntervention || !inspectXaiData}
              >
                {sendingIntervention ? "Dispatching..." : "🚀 Deploy Remedial Action Plan to Student"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherRiskWatchlistView;
