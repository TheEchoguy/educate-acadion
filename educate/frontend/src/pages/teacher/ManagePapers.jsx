import { useNavigate }
from "react-router-dom";

import "./ManagePapers.css";

function ManagePapers() {

  const navigate = useNavigate();

  return (

    <div className="manage-papers-page">

      <button
        className="back-btn"
        onClick={() =>
          navigate("/teacher/dashboard")
        }
      >
        ← Back To Dashboard
      </button>

      <div className="manage-papers-header">

        <h1>
          Manage Papers
        </h1>

        <p>
          Create, upload and manage
          question papers.
        </p>

      </div>

      <div className="manage-papers-grid">

        <div
          className="paper-card"
          onClick={() =>
            navigate(
              "/teacher/create-paper"
            )
          }
        >

          <h2>
            Create Question Paper
          </h2>

          <p>
            Create your own manual
            question paper with
            questions and marks.
          </p>

        </div>

        <div
          className="paper-card"
          onClick={() =>
            navigate(
              "/teacher/upload-paper"
            )
          }
        >

          <h2>
            Upload Question Paper
          </h2>

          <p>
            Upload PDF, DOCX or
            image-based papers.
          </p>

        </div>

        <div
          className="paper-card"
          onClick={() =>
            navigate(
              "/teacher/paper-analysis"
            )
          }
        >

          <h2>
            Uploaded Paper Analysis
          </h2>

          <p>
            Analyze extracted
            questions, topics and
            marks.
          </p>

        </div>

        <div
          className="paper-card"
          onClick={() =>
            navigate(
              "/teacher/practice-permissions"
            )
          }
        >

          <h2>
            🎯 Practice Paper Permissions
          </h2>

          <p>
            Allow students to practice
            your subject question papers,
            retake exams & self-grade.
          </p>

        </div>

      </div>

    </div>
  );
}

export default ManagePapers;