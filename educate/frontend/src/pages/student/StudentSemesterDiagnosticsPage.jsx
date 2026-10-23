import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import { getAllPublishedMarks, resolveCourseCode } from "../../services/classroomService";
import "./StudentSemesterDiagnosticsPage.css";

const StudentSemesterDiagnosticsPage = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    getAllPublishedMarks()
      .then((res) => {
        if (active) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load published marks ledger:", err);
        if (active) {
          setError(
            err.response?.data?.message ||
              "Could not load semester-wide published marks. Please ensure your classroom enrollments are active."
          );
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const {
    studentUsn = "USN_NOT_SET",
    studentName = "Student",
    semester = 7,
    totalEnrolledCourses = 0,
    cumulativeScaledCie = 0,
    maxPossibleScaledCie = 0,
    projectedGpa = "8.75 / 10.0",
    courses = [],
  } = data || {};

  const publishedCourses = courses.filter((c) => c.isPublished && c.publishedIAs && c.publishedIAs.length > 0);
  const hasAnyPublishedMarks = publishedCourses.length > 0;

  // Determine overall standing
  const cieRatio = maxPossibleScaledCie > 0 ? cumulativeScaledCie / maxPossibleScaledCie : 0;
  const isDistinction = cieRatio >= 0.85;
  const isFirstClass = cieRatio >= 0.65;
  const standingLabel = isDistinction
    ? "🟢 On Track / S-Grade Trajectory"
    : isFirstClass
    ? "🟢 On Track / First-Class Trajectory"
    : cieRatio >= 0.50
    ? "🟡 Needs Attention / Borderline"
    : "🔴 Academic Remediation Recommended";

  // SEE qualification status
  const isSeeQualified = cumulativeScaledCie >= (totalEnrolledCourses * 20.0 * (15.0 / 50.0)) || cieRatio >= 0.40;

  return (
    <div className="semester-diag-page">
      <Navbar />

      <div className="semester-diag-container">
        {/* HEADER BAR */}
        <div className="diag-header-bar">
          <button
            type="button"
            className="diag-back-btn"
            onClick={() => navigate("/student/dashboard")}
          >
            ← Back to Dashboard
          </button>
          <div className="diag-student-chips">
            <span className="diag-chip">USN: <strong>{studentUsn}</strong></span>
            <span className="diag-chip">Semester <strong>{semester}</strong></span>
            <span className="diag-chip">Student: <strong>{studentName}</strong></span>
          </div>
        </div>

        {/* HERO TITLE BLOCK */}
        <div className="diag-hero-text">
          <div className="diag-intel-badge">
            ⚡ MULTI-CLASSROOM ACADEMIC INTELLIGENCE &amp; MARKSHEET LEDGER
          </div>
          <h1>Semester {semester} Multi-Classroom Academic Intelligence &amp; Marksheet Ledger</h1>
          <p>
            Consolidated performance, scaled CIE milestones, and predictive trajectories across all enrolled subjects.
          </p>
        </div>

        {loading ? (
          <div className="diag-loading-box">
            <div className="diag-spinner" />
            <p>Synthesizing verified published IA marks across enrolled courses...</p>
          </div>
        ) : error && (!courses || courses.length === 0) ? (
          <div className="diag-empty-card">
            <span className="diag-empty-icon">⚠️</span>
            <h3>Unable to Load Marks Ledger</h3>
            <p>{error}</p>
            <button
              type="button"
              className="diag-retry-btn"
              onClick={() => window.location.reload()}
            >
              🔄 Refresh Page
            </button>
          </div>
        ) : (
          <>
            {/* TOP KPI RIBBON */}
            <div className="diag-kpi-ribbon">
              {/* Card 1: Total Courses Monitored */}
              <div className="diag-kpi-card">
                <div className="kpi-icon-wrap blue">📚</div>
                <div className="kpi-content">
                  <span className="kpi-label">Total Courses Monitored</span>
                  <div className="kpi-value">{totalEnrolledCourses}</div>
                  <span className="kpi-sub">Active Subject Classrooms</span>
                </div>
              </div>

              {/* Card 2: Cumulative Scaled CIE */}
              <div className="diag-kpi-card">
                <div className="kpi-icon-wrap green">🎯</div>
                <div className="kpi-content">
                  <span className="kpi-label">Cumulative Scaled CIE</span>
                  <div className="kpi-value">
                    {cumulativeScaledCie.toFixed(1)} <small>/ {maxPossibleScaledCie.toFixed(1)} M</small>
                  </div>
                  <span className="kpi-sub">
                    {hasAnyPublishedMarks ? `${Math.round(cieRatio * 100)}% Locked Across IAs` : "Pending IA Publication"}
                  </span>
                </div>
              </div>

              {/* Card 3: Overall Academic Standing */}
              <div className="diag-kpi-card">
                <div className="kpi-icon-wrap amber">📈</div>
                <div className="kpi-content">
                  <span className="kpi-label">Overall Academic Standing</span>
                  <div className="kpi-value-standing">{standingLabel}</div>
                  <span className="kpi-sub">Projected SGPA: <strong>{projectedGpa}</strong></span>
                </div>
              </div>

              {/* Card 4: SEE Qualification Status */}
              <div className="diag-kpi-card">
                <div className="kpi-icon-wrap emerald">🛡️</div>
                <div className="kpi-content">
                  <span className="kpi-label">SEE Qualification Status</span>
                  <div className="kpi-value-status text-emerald">
                    {isSeeQualified ? "✓ Clear of Passing Minimums" : "⚠️ Needs Attention"}
                  </div>
                  <span className="kpi-sub">CIE Passing Threshold: 20 / 50 M</span>
                </div>
              </div>
            </div>

            {/* MAIN SECTION: PUBLISHED CLASSROOM MARKS & MODULE MATRIX */}
            <div className="diag-main-section">
              <div className="diag-section-header">
                <div>
                  <h2>Published Classroom Marks &amp; Module Matrix</h2>
                  <p>
                    Itemized continuous evaluation split-ups, scaled scores, and module mastery indicators per subject
                  </p>
                </div>
              </div>

              {!hasAnyPublishedMarks ? (
                /* CLEAN EMPTY STATE CARD IF NO MARKS ARE PUBLISHED */
                <div className="diag-empty-card">
                  <span className="diag-empty-icon">📋</span>
                  <h3>No Published IA Marks Available</h3>
                  <p>
                    Faculty have not published assessment marks for your enrolled courses yet. Once internal assessments
                    are evaluated and published, your marksheet matrix will appear here.
                  </p>
                </div>
              ) : (
                <div className="diag-courses-grid">
                  {courses.map((course) => {
                    const isCoursePublished = course.isPublished && course.publishedIAs && course.publishedIAs.length > 0;
                    const statusClass =
                      course.status === "ON_TRACK"
                        ? "status-track"
                        : course.status === "NEEDS_ATTENTION"
                        ? "status-med"
                        : course.status === "AT_RISK"
                        ? "status-risk"
                        : "status-draft";

                    const statusBadgeLabel =
                      course.status === "ON_TRACK"
                        ? "🟢 On Track"
                        : course.status === "NEEDS_ATTENTION"
                        ? "🟡 Needs Attention"
                        : course.status === "AT_RISK"
                        ? "🔴 At Risk"
                        : "⏳ Pending Publication";

                    const currentScaled = course.totalScaledCieSecured || 0;
                    const targetMax = course.cieTargetMax || 15.0;
                    const ciePct = targetMax > 0 ? Math.min(100, Math.round((currentScaled / targetMax) * 100)) : 0;
                    const passesThreshold = currentScaled >= (targetMax * (20.0 / 50.0));

                    return (
                      <div key={course.classroomId} className="diag-course-card">
                        {/* CARD HEADER */}
                        <div className="diag-card-head">
                          <div className="diag-head-left">
                            <span className="diag-course-code">{resolveCourseCode(course)}</span>
                            <span className={`diag-status-pill ${statusClass}`}>
                              {statusBadgeLabel}
                            </span>
                          </div>
                          <span className="diag-faculty-name">
                            Faculty: <strong>{course.facultyName || "Course Faculty"}</strong>
                          </span>
                        </div>

                        <h3 className="diag-course-title" title={course.courseName}>
                          {course.courseName}
                        </h3>

                        {/* LIVE SCALED CIE PROGRESS METER */}
                        <div className="diag-cie-meter-wrap">
                          <div className="diag-meter-labels">
                            <span className="diag-meter-lbl">Scaled IA Score Progress</span>
                            <span className="diag-meter-val">
                              <strong>{currentScaled.toFixed(2)}</strong> / {targetMax.toFixed(1)} M ({ciePct}%)
                            </span>
                          </div>
                          <div className="diag-progress-bar-track">
                            <div
                              className={`diag-progress-bar-fill ${passesThreshold ? "fill-green" : "fill-amber"}`}
                              style={{ width: `${Math.max(4, ciePct)}%` }}
                            />
                          </div>
                          <div className="diag-meter-footer">
                            <span>Min Threshold: {(targetMax * 0.4).toFixed(1)} M (40%)</span>
                            <span className={passesThreshold ? "text-emerald" : "text-amber"}>
                              {passesThreshold ? "✓ Threshold Satisfied" : "⚠️ CIE Deficit"}
                            </span>
                          </div>
                        </div>

                        {/* PUBLISHED ASSESSMENTS GRID */}
                        <div className="diag-published-ias-block">
                          <span className="diag-block-title">Published Internal Assessments:</span>
                          {!isCoursePublished ? (
                            <div className="diag-no-ias-note">
                              <span>Draft Mode</span> — Marks recorded by faculty but pending publication.
                            </div>
                          ) : (
                            <div className="diag-ia-pill-grid">
                              {course.publishedIAs.map((ia) => (
                                <div key={ia.iaNumber} className="diag-ia-pill-card">
                                  <div className="ia-pill-top">
                                    <span className="ia-num-chip">IA-{ia.iaNumber}</span>
                                    <span className="ia-raw-score">
                                      {ia.rawTotal} / {ia.rawMax} Raw
                                    </span>
                                  </div>
                                  <div className="ia-scaled-row">
                                    <span className="ia-scaled-label">Scaled CIE:</span>
                                    <span className="ia-scaled-val">
                                      <strong>{ia.scaledScore.toFixed(2)}</strong> / {ia.scaledMax.toFixed(1)} M
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* QUICK MODULE MASTERY SUMMARY (MODULES 1–5 INDICATORS) */}
                        <div className="diag-modules-summary-block">
                          <span className="diag-block-title">Module 1–5 Syllabus Mastery:</span>
                          <div className="diag-modules-row">
                            {[1, 2, 3, 4, 5].map((modNum) => {
                              const score = course.moduleMastery ? course.moduleMastery[String(modNum)] : null;
                              const hasScore = score != null;
                              const isHigh = hasScore && score >= 75;
                              const isMed = hasScore && score >= 50 && score < 75;
                              const dotClass = !hasScore
                                ? "mod-pending"
                                : isHigh
                                ? "mod-high"
                                : isMed
                                ? "mod-med"
                                : "mod-low";

                              return (
                                <div key={modNum} className={`diag-mod-dot-card ${dotClass}`} title={`Module ${modNum}: ${hasScore ? score + "%" : "Not yet tested"}`}>
                                  <span className="mod-label">M{modNum}</span>
                                  <span className="mod-val">{hasScore ? `${Math.round(score)}%` : "—"}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* ACTION BUTTON NAVIGATING INTO SINGLE CLASSROOM VIEW */}
                        <div className="diag-card-footer">
                          <button
                            type="button"
                            className="btn-inspect-classroom"
                            onClick={() => navigate(`/student/classrooms/${course.classroomId}/performance`)}
                          >
                            <span>Inspect Detailed Course Diagnostics</span>
                            <span className="arr">→</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default StudentSemesterDiagnosticsPage;
