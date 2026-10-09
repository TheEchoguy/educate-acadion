import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { getStudentTrend } from "../../services/analyticsService";
import { getStudentResults } from "../../services/responseService";
import "./StudentPerformance.css";

function StudentPerformance() {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [studentResults, setStudentResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPerformance();
  }, []);

  const loadPerformance = async () => {
    try {
      setLoading(true);
      const usn = localStorage.getItem("usn");
      if (!usn) {
        toast.error("USN not found");
        return;
      }

      const [trendData, resultsData] = await Promise.all([
        getStudentTrend(usn).catch(() => null),
        getStudentResults(usn).catch(() => []),
      ]);

      setAnalytics(trendData);
      setStudentResults(resultsData || []);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  // Calculations for Theory, MCQ, and Offline Breakdown
  const isMcqResult = (r) => {
    if (!r) return false;
    if (r.paperCategory === "QUIZ" || r.paperFormat === "MCQ") return true;
    if (r.paperId && r.paperId.toUpperCase().includes("MCQ")) return true;
    return false;
  };

  const onlineTheoryResults = studentResults.filter(
    (r) => r.submissionMode !== "OFFLINE_MANUAL" && !isMcqResult(r) && r.includeInOverallPercentage !== false
  );
  const onlineMcqResults = studentResults.filter(
    (r) => r.submissionMode !== "OFFLINE_MANUAL" && isMcqResult(r) && r.includeInOverallPercentage !== false
  );
  const offlineResults = studentResults.filter(
    (r) => r.submissionMode === "OFFLINE_MANUAL" && r.includeInOverallPercentage !== false
  );

  const calcAveragePct = (list) => {
    if (!list || list.length === 0) return 0;
    const sum = list.reduce((acc, r) => {
      const maxM = r.maxMarks || 40;
      const totalM = r.totalMarks != null ? r.totalMarks : 0;
      return acc + (maxM > 0 ? (totalM / maxM) * 100 : 0);
    }, 0);
    return Math.round((sum / list.length) * 10) / 10;
  };

  const theoryAvg = calcAveragePct(onlineTheoryResults);
  const mcqAvg = calcAveragePct(onlineMcqResults);
  const offlineAvg = calcAveragePct(offlineResults);
  const allApplicable = [...onlineTheoryResults, ...onlineMcqResults, ...offlineResults];
  const overallAvg = calcAveragePct(allApplicable);

  return (
    <div className="performance-page">
      <div className="performance-top-bar">
        <button className="back-btn" onClick={() => navigate("/student/dashboard")}>
          ← Back To Dashboard
        </button>
      </div>

      <div className="performance-header">
        <h1>Student Performance & Predictive Analytics</h1>
        <p>Comprehensive evaluation combining online theory exams, objective MCQ quizzes, classroom written tests, and performance trends.</p>
      </div>

      {loading ? (
        <div className="loading-msg">Loading student performance data...</div>
      ) : (
        <div className="performance-content">
          {/* Overall Performance Card */}
          <div className="performance-card">
            <h2>Overall Academic Performance</h2>

            <div className="summary-item">
              <span>Student USN</span>
              <strong>{analytics?.usn || localStorage.getItem("usn")}</strong>
            </div>

            <div className="summary-item">
              <span>Overall Aggregate Score</span>
              <strong className="score-highlight">{allApplicable.length > 0 ? `${overallAvg}%` : "N/A"}</strong>
            </div>

            <div className="summary-item">
              <span>Performance Trend</span>
              <strong className={`direction-tag ${analytics?.direction?.toLowerCase()}`}>
                {analytics?.direction || "STABLE"}
              </strong>
            </div>

            <div className="summary-item">
              <span>Total Evaluations</span>
              <strong>{allApplicable.length} Tests ({onlineTheoryResults.length} Theory · {onlineMcqResults.length} MCQ · {offlineResults.length} Offline)</strong>
            </div>
          </div>

          {/* Assessment Mode Breakdown Card */}
          <div className="performance-card">
            <h2>Assessment Breakdown</h2>

            <div className="mode-breakdown-row">
              <div className="mode-stat-box online-box">
                <span className="mode-title">📑 Theory Exams</span>
                <span className="mode-avg">{onlineTheoryResults.length > 0 ? `${theoryAvg}%` : "No submissions"}</span>
                <small className="mode-count">{onlineTheoryResults.length} Written Tests</small>
              </div>

              <div className="mode-stat-box mcq-box">
                <span className="mode-title">🎯 MCQ Quizzes</span>
                <span className="mode-avg">{onlineMcqResults.length > 0 ? `${mcqAvg}%` : "No submissions"}</span>
                <small className="mode-count">{onlineMcqResults.length} Objective Quizzes</small>
              </div>

              <div className="mode-stat-box offline-box">
                <span className="mode-title">📝 Offline Written</span>
                <span className="mode-avg">{offlineResults.length > 0 ? `${offlineAvg}%` : "No records"}</span>
                <small className="mode-count">{offlineResults.length} Classroom Tests</small>
              </div>
            </div>
          </div>

          <div className="performance-card">
            <h2>Exam History</h2>

            <div className="history-list">

              {analytics.trend?.map(
                (exam, index) => (

                  <div
                    className="history-item"
                    key={index}
                  >

                    <div>

                      <span>
                        {
                          exam.paperId
                        }
                      </span>

                      <small>
                        {
                          exam.submittedAt
                        }
                      </small>

                    </div>

                    <strong>

                      {
                        exam.percentage
                      }
                      %

                    </strong>

                  </div>
                )
              )}

            </div>

          </div>

          <div className="performance-card">

            <h2>
              Prediction Insights
            </h2>

            <div className="history-list">

              {analytics.trend?.map(
                (exam, index) => (

                  <div
                    className="history-item"
                    key={index}
                  >

                    <div>

                      <span>
                        {
                          exam.paperId
                        }
                      </span>

                      <small>
                        {
                          exam.riskLevel
                        }
                      </small>

                    </div>

                    <strong>
                      {exam.predictedScore != null ? `${exam.predictedScore}%` : "N/A"}
                    </strong>

                  </div>
                )
              )}

            </div>

          </div>

        </div>
      )}

    </div>
  );
}

export default StudentPerformance;