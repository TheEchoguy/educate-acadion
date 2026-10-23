import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Navbar from "../../components/Navbar";
import { getAllCoursesPerformance } from "../../services/classroomService";
import "./StudentPerformance.css";

function StudentPerformance() {
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadPerformanceReport();
  }, []);

  const loadPerformanceReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllCoursesPerformance();
      setReport(data);
    } catch (err) {
      console.error("Failed to load global semester report:", err);
      setError(
        err.response?.data?.message ||
          "Failed to load semester-level performance diagnostics. Please check your classroom enrollments."
      );
      toast.error("Could not load global semester performance report");
    } finally {
      setLoading(false);
    }
  };

  const {
    studentName = "Student",
    studentUsn = "USN_NOT_SET",
    semester = 7,
    department = "Engineering",
    overallSemesterTrajectory = "ON_TRACK_FIRST_CLASS",
    overallRiskCategory = "LOW",
    combinedGpaProjection = 8.4,
    totalEnrolledCourses = 0,
    averageScaledCie = 38.5,
    academicAdvice = "Consistent performance across subjects. Focus on upcoming IAs to lock in distinction.",
    courses = [],
    crossSubjectComparisons = [],
  } = report || {};

  const trajectoryLabel = overallSemesterTrajectory.replace(/_/g, " ");
  const isHighRisk = overallRiskCategory === "HIGH";
  const isMedRisk = overallRiskCategory === "MEDIUM";

  return (
    <div className="performance-page global-semester-page">
      <Navbar />

      <div className="global-performance-container">
        {/* TOP NAVIGATION BAR */}
        <div className="perf-top-navigation">
          <button
            type="button"
            className="back-btn"
            onClick={() => navigate("/student/dashboard")}
          >
            ← Back To Dashboard
          </button>
          <div className="student-header-meta">
            <span className="meta-tag">USN: <strong>{studentUsn}</strong></span>
            {semester && <span className="meta-tag">Semester: <strong>{semester}</strong></span>}
            {department && <span className="meta-tag">{department}</span>}
          </div>
        </div>

        {/* PAGE HEADER */}
        <div className="global-report-header">
          <div className="intel-badge">
            🌐 LEVEL 4: GLOBAL SEMESTER ACADEMIC REPORT
          </div>
          <h1>Semester Performance &amp; Degree Trajectory</h1>
          <p>
            Combined Continuous Internal Evaluation (CIE) metrics, credit-weighted GPA projections,
            and cross-subject topic mastery comparisons synthesized across all enrolled courses.
          </p>
        </div>

        {loading ? (
          <div className="sp-loading-container">
            <div className="sp-spinner" />
            <p>Aggregating 4-level diagnostics across all enrolled classrooms...</p>
          </div>
        ) : error && (!courses || courses.length === 0) ? (
          <div className="sp-empty-card">
            <div style={{ fontSize: "2.8rem", marginBottom: "14px" }}>⚠️</div>
            <h3>Unable to Load Global Performance Report</h3>
            <p style={{ color: "#94a3b8", lineHeight: "1.6", marginBottom: "20px" }}>{error}</p>
            <button
              type="button"
              className="btn-retry"
              onClick={loadPerformanceReport}
            >
              🔄 Retry Diagnostics
            </button>
          </div>
        ) : courses.length === 0 ? (
          <div className="sp-empty-card">
            <div style={{ fontSize: "3rem", marginBottom: "16px" }}>🏫</div>
            <h3>No Enrolled Courses Found</h3>
            <p style={{ color: "#94a3b8", lineHeight: "1.6", marginBottom: "24px" }}>
              You are not currently enrolled in any active course workspaces. Join classrooms via join codes
              provided by your faculty to monitor your semester trajectory and CIE scores.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => navigate("/student/dashboard")}
            >
              ← Go to Dashboard &amp; Enter Join Code
            </button>
          </div>
        ) : (
          <>
            {/* 1. TOP BANNER: OVERALL SEMESTER TRAJECTORY & COMBINED CREDIT GPA PROJECTION */}
            <div className="global-hero-banner">
              <div className="hero-banner-main">
                <div className="hero-status-row">
                  <span
                    className={`trajectory-pill ${
                      isHighRisk
                        ? "badge-risk-high"
                        : isMedRisk
                        ? "badge-risk-med"
                        : "badge-risk-low"
                    }`}
                  >
                    ● Trajectory: {trajectoryLabel}
                  </span>
                  <span className="courses-count-pill">
                    📚 {totalEnrolledCourses} Enrolled Course{totalEnrolledCourses !== 1 ? "s" : ""}
                  </span>
                </div>

                <h2 className="hero-student-title">
                  {studentName}’s Academic Standing
                </h2>

                <div className="hero-guidance-callout">
                  <span className="guidance-icon">💡</span>
                  <div className="guidance-text">
                    <strong>Academic Trajectory Analysis:</strong> {academicAdvice}
                  </div>
                </div>
              </div>

              {/* METRICS CLUSTER */}
              <div className="hero-metrics-cluster">
                <div className="hero-metric-tile">
                  <span className="metric-tile-lbl">Projected SGPA</span>
                  <div className="metric-tile-val text-blue">
                    {combinedGpaProjection.toFixed(1)} <small>/ 10.0</small>
                  </div>
                  <span className="metric-tile-sub">Combined Credit Estimation</span>
                </div>

                <div className="hero-metric-tile">
                  <span className="metric-tile-lbl">Average Scaled CIE</span>
                  <div className="metric-tile-val text-green">
                    {averageScaledCie.toFixed(1)} <small>/ 50.0 M</small>
                  </div>
                  <span className="metric-tile-sub">
                    {averageScaledCie >= 20.0 ? "✓ Passing Threshold Met" : "⚠️ CIE Deficit Alert"}
                  </span>
                </div>

                <div className="hero-metric-tile">
                  <span className="metric-tile-lbl">Overall Semester Risk</span>
                  <div
                    className={`metric-tile-val ${
                      isHighRisk ? "text-red" : isMedRisk ? "text-amber" : "text-green"
                    }`}
                  >
                    {overallRiskCategory} RISK
                  </div>
                  <span className="metric-tile-sub">Based on VTU Evaluation Scheme</span>
                </div>
              </div>
            </div>

            {/* 2. ENROLLED SUBJECTS GRID */}
            <div className="global-section">
              <div className="section-header-row">
                <div>
                  <h3 className="section-title">📚 Enrolled Subjects Standing</h3>
                  <span className="section-desc">
                    Individual subject CIE scores, syllabus progress, and course-specific 4-level breakdowns
                  </span>
                </div>
              </div>

              <div className="courses-summary-grid">
                {courses.map((course) => {
                  const isPassing = (course.totalCieSecured || 0) >= (course.cieMaxMarks * 0.4);
                  const courseRisk = (course.riskLevel || "LOW").toUpperCase();
                  const riskClass =
                    courseRisk === "HIGH" || courseRisk === "HIGH_RISK"
                      ? "risk-high"
                      : courseRisk === "MEDIUM" || courseRisk === "NEEDS_ATTENTION"
                      ? "risk-med"
                      : "risk-low";

                  return (
                    <div key={course.classroomId} className="course-summary-card">
                      <div className="card-top-header">
                        <span className="course-code-badge">{course.courseCode}</span>
                        <span className={`risk-badge-tag ${riskClass}`}>
                          {courseRisk.replace(/_/g, " ")} RISK
                        </span>
                      </div>

                      <h4 className="course-name-heading" title={course.courseName}>
                        {course.courseName}
                      </h4>

                      <div className="course-faculty-meta">
                        <span>Faculty: <strong>{course.teacherName || "Faculty"}</strong></span>
                        {course.semester && (
                          <span className="sec-chip">Sem {course.semester} - {course.section || "A"}</span>
                        )}
                      </div>

                      {/* SCALED CIE GAUGE BLOCK */}
                      <div className="cie-score-block">
                        <div className="cie-score-header">
                          <span className="cie-label">Continuous Internal Evaluation (CIE)</span>
                          <span className={`cie-status-tag ${isPassing ? "status-pass" : "status-risk"}`}>
                            {course.isPublished
                              ? isPassing
                                ? "✓ Passing (≥20 M)"
                                : "⚠️ At Risk (<20 M)"
                              : "Draft Mode"}
                          </span>
                        </div>

                        <div className="cie-score-display-row">
                          <div className="cie-main-score">
                            <span className="val">{course.totalCieSecured?.toFixed(1) || "0.0"}</span>
                            <span className="max">/ {course.cieMaxMarks?.toFixed(1) || "50.0"} M</span>
                          </div>
                          <span className="cie-scaled-ia-note">
                            Scaled IA: {course.scaledIaScore?.toFixed(1) || "0.0"} / 15.0 M
                          </span>
                        </div>

                        <div className="cie-progress-track">
                          <div
                            className={`cie-progress-bar ${isPassing ? "bar-green" : "bar-amber"}`}
                            style={{
                              width: `${Math.min(
                                100,
                                Math.max(5, ((course.totalCieSecured || 0) / (course.cieMaxMarks || 50.0)) * 100)
                              )}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* TEACHING COVERAGE PROGRESS BAR */}
                      <div className="course-coverage-block">
                        <div className="coverage-meta-row">
                          <span className="cov-label">Teaching Coverage</span>
                          <span className="cov-pct">{course.coveragePercentage?.toFixed(0) || 0}%</span>
                        </div>
                        <div className="cov-track">
                          <div
                            className="cov-fill"
                            style={{
                              width: `${Math.min(100, Math.max(0, course.coveragePercentage || 0))}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* TOPIC DEFICIT CHIPS */}
                      <div className="topics-assessed-meta">
                        {course.weakTopicsCount > 0 ? (
                          <span className="topic-flag weak">
                            ⚠️ {course.weakTopicsCount} Weak Topic{course.weakTopicsCount > 1 ? "s" : ""}
                          </span>
                        ) : (
                          <span className="topic-flag clean">
                            ✓ 0 Deficit Topics
                          </span>
                        )}
                        {course.masteredTopicsCount > 0 && (
                          <span className="topic-flag strong">
                            ★ {course.masteredTopicsCount} Mastered
                          </span>
                        )}
                      </div>

                      {/* ACTION BUTTON TO ENTER CLASSROOM DIAGNOSTICS */}
                      <button
                        type="button"
                        className="btn-view-breakdown"
                        onClick={() =>
                          navigate(`/student/classrooms/${course.classroomId}/performance`)
                        }
                      >
                        <span>View Course Breakdown</span>
                        <span className="arr">→</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. CROSS-SUBJECT TOPIC MASTERY COMPARISON */}
            {crossSubjectComparisons.length > 0 && (
              <div className="global-section">
                <div className="section-header-row">
                  <div>
                    <h3 className="section-title">📊 Cross-Subject Topic Mastery Matrix</h3>
                    <span className="section-desc">
                      Comparative multi-course analysis of atomic syllabus mastery and deficit vulnerabilities
                    </span>
                  </div>
                </div>

                <div className="matrix-table-card">
                  <div className="matrix-table-wrap">
                    <table className="matrix-table">
                      <thead>
                        <tr>
                          <th>Subject / Course</th>
                          <th>Course Code</th>
                          <th>Topics Assessed</th>
                          <th>Mastered Topics (≥75%)</th>
                          <th>Weak Concepts (&lt;50%)</th>
                          <th>Mastery Rate</th>
                          <th>Curriculum Readiness</th>
                          <th>Detailed Diagnostic</th>
                        </tr>
                      </thead>
                      <tbody>
                        {crossSubjectComparisons.map((csm) => {
                          const isWarning = csm.weakTopicsCount > 0;
                          return (
                            <tr key={csm.classroomId || csm.courseCode}>
                              <td className="col-subject-name">
                                <strong>{csm.courseName}</strong>
                              </td>
                              <td>
                                <span className="col-code-pill">{csm.courseCode}</span>
                              </td>
                              <td>{csm.totalTopicsAssessed} topics</td>
                              <td>
                                <span className="col-mastered-count">
                                  ★ {csm.strongTopicsCount}
                                </span>
                              </td>
                              <td>
                                {csm.weakTopicsCount > 0 ? (
                                  <span className="col-weak-count">
                                    ⚠️ {csm.weakTopicsCount} weak
                                  </span>
                                ) : (
                                  <span className="col-clean-count">✓ None</span>
                                )}
                              </td>
                              <td>
                                <div className="matrix-pct-cell">
                                  <div className="matrix-bar-track">
                                    <div
                                      className="matrix-bar-fill"
                                      style={{
                                        width: `${Math.min(100, Math.max(5, csm.masteryPercentage || 0))}%`,
                                        background: isWarning ? "#f59e0b" : "#10b981",
                                      }}
                                    />
                                  </div>
                                  <span className="matrix-pct-num">{csm.masteryPercentage}%</span>
                                </div>
                              </td>
                              <td>
                                <span
                                  className={`matrix-status-pill ${
                                    csm.status === "ON_TRACK"
                                      ? "status-clean"
                                      : csm.status === "SATISFACTORY"
                                      ? "status-sat"
                                      : "status-warn"
                                  }`}
                                >
                                  {csm.status?.replace(/_/g, " ")}
                                </span>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="matrix-action-btn"
                                  onClick={() =>
                                    navigate(
                                      `/student/classrooms/${csm.classroomId}/performance`
                                    )
                                  }
                                >
                                  Inspect Subject →
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default StudentPerformance;