import {
  useState
} from "react";

import toast from "react-hot-toast";

import {
  getPaperAnalytics
} from "../../services/analyticsService";

import "./TeacherAnalytics.css";

function TeacherAnalytics() {

  const [
    paperId,
    setPaperId
  ] = useState("");

  const [
    analytics,
    setAnalytics
  ] = useState(null);

  const [loading, setLoading] = useState(false);

  const loadAnalytics =
    async () => {
      try {
        if (!paperId.trim()) {
          toast.error(
            "Enter Paper ID"
          );
          return;
        }

        setLoading(true);
        const data =
          await getPaperAnalytics(
            paperId.trim()
          );

        setAnalytics(data);

      } catch (error) {
        console.log(error);
        toast.error(
          error.response?.data?.message ||
          error.response?.data ||
          "Analytics Failed"
        );
      } finally {
        setLoading(false);
      }
    };

  return (

    <div className="analytics-page">

      <div className="analytics-header">

        <h1>
          Teacher Analytics
        </h1>

        <p>
          Analyze question difficulty,
          weak topics and student performance.
        </p>

      </div>

      <div className="analytics-search">

        <input
          type="text"
          placeholder="Enter Paper ID"
          value={paperId}
          onChange={(e) =>
            setPaperId(
              e.target.value
            )
          }
        />

        <button
          onClick={loadAnalytics}
          disabled={loading}
        >
          {loading ? "Analyzing..." : "Analyze"}
        </button>

      </div>

      {analytics && (

        <div className="analytics-content">

          {/* OVERALL */}

          <div className="analytics-card">

            <h2>
              Overall Performance
            </h2>

            <div className="analytics-stat">

              <span>
                Paper ID
              </span>

              <strong>
                {analytics.paperId}
              </strong>

            </div>

            <div className="analytics-stat">

              <span>
                Subject
              </span>

              <strong className="wrap-text">
                {analytics.subject}
              </strong>

            </div>

            <div className="analytics-stat">

              <span>
                Total Responses
              </span>

              <strong>
                {analytics.responseCount}
              </strong>

            </div>

            <div className="analytics-stat">

              <span>
                Class Average
              </span>

              <strong>
                {analytics.classAverage}%
              </strong>

            </div>

          </div>

          {/* TOPIC ANALYSIS */}

          <div className="analytics-card">

            <h2>
              Topic Analysis
            </h2>

            <div className="topic-list">

              {analytics.topicAnalysis?.map(
                (topic, index) => (

                  <div
                    className="topic-item"
                    key={index}
                  >

                    <div className="topic-left">

                      <span className="topic-name">
                        {topic.name}
                      </span>

                      <small className={`status ${topic.status.toLowerCase()}`}>
                        {topic.status}
                      </small>

                    </div>

                    <strong>
                      {topic.averagePercentage}%
                    </strong>

                  </div>
                )
              )}

            </div>

          </div>

          {/* QUESTION ANALYSIS */}

          <div className="analytics-card">

            <h2>
              Question Analysis
            </h2>

            <div className="topic-list">

              {analytics.questionAnalysis?.map(
                (question, index) => (

                  <div
                    className="topic-item"
                    key={index}
                  >

                    <div className="topic-left">

                      <span className="topic-name">
                        {question.name}
                      </span>

                      <small className={`status ${question.status.toLowerCase()}`}>
                        {question.status}
                      </small>

                    </div>

                    <strong>
                      {question.averagePercentage}%
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

export default TeacherAnalytics;