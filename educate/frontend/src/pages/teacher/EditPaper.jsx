import {
  useEffect,
  useState
} from "react";

import {
  useNavigate,
  useParams
} from "react-router-dom";

import toast from "react-hot-toast";

import {
  getPaperById,
  updatePaper
} from "../../services/paperService";

import "./EditPaper.css";

function EditPaper() {

  const navigate =
    useNavigate();

  const { paperId } =
    useParams();

  const [paper,
    setPaper] =
      useState(null);

  useEffect(() => {

    fetchPaper();

  }, []);

  const fetchPaper =
    async () => {

      try {

        const data =
          await getPaperById(
            paperId
          );

        setPaper(data);

      } catch {

        toast.error(
          "Failed to load paper"
        );
      }
    };

  const handleQuestionChange =
    (
      index,
      field,
      value
    ) => {

      const updatedQuestions =
        [...paper.questions];

      updatedQuestions[index][field] =
        value;

      setPaper({
        ...paper,
        questions:
          updatedQuestions,
      });
    };

  const addQuestion =
    () => {

      setPaper({

        ...paper,

        questions: [

          ...paper.questions,

          {
            questionId:
              `Q${paper.questions.length + 1}`,

            text: "",

            marks: 0,

            topic: "",
          },
        ],
      });
    };

  const deleteQuestion =
    (index) => {

      const updatedQuestions =
        paper.questions.filter(
          (_, i) =>
            i !== index
        );

      setPaper({
        ...paper,
        questions:
          updatedQuestions,
      });
    };

  const [saving, setSaving] = useState(false);

  const handleSave =
    async () => {
      try {
        setSaving(true);
        await updatePaper(
          paper.paperId,
          paper
        );
        toast.success(
          "Paper Updated Successfully"
        );
      } catch (error) {
        toast.error(
          error.response?.data?.message ||
          error.response?.data ||
          "Update Failed"
        );
      } finally {
        setSaving(false);
      }
    };

  if (!paper) {
    return <h2>Loading...</h2>;
  }

  return (

    <div className="edit-paper-page">

      <button
        className="back-btn"
        onClick={() =>
          navigate(
            "/teacher/paper-analysis"
          )
        }
      >
        ← Back
      </button>

      <div className="edit-paper-header">

        <h1>
          Edit Question Paper
        </h1>

      </div>

      <div className="paper-info">

        <input
          type="text"
          value={paper.subject}
          onChange={(e) =>
            setPaper({
              ...paper,
              subject:
                e.target.value,
            })
          }
          placeholder="Subject"
        />

        <input
          type="number"
          value={paper.internalNo}
          onChange={(e) =>
            setPaper({
              ...paper,
              internalNo:
                e.target.value,
            })
          }
          placeholder="Internal No"
        />

      </div>

      <div className="questions-section">

        {paper.questions.map(
          (
            question,
            index
          ) => (

            <div
              className="question-card"
              key={index}
            >

              <input
                type="text"
                value={
                  question.questionId
                }
                onChange={(e) =>
                  handleQuestionChange(
                    index,
                    "questionId",
                    e.target.value
                  )
                }
              />

              <textarea
                value={
                  question.text
                }
                onChange={(e) =>
                  handleQuestionChange(
                    index,
                    "text",
                    e.target.value
                  )
                }
                placeholder="Question"
              />

              <input
                type="text"
                value={
                  question.topic
                }
                onChange={(e) =>
                  handleQuestionChange(
                    index,
                    "topic",
                    e.target.value
                  )
                }
                placeholder="Topic"
              />

              <input
                type="number"
                value={
                  question.marks
                }
                onChange={(e) =>
                  handleQuestionChange(
                    index,
                    "marks",
                    e.target.value
                  )
                }
                placeholder="Marks"
              />

              <button
                className="delete-question-btn"
                onClick={() =>
                  deleteQuestion(
                    index
                  )
                }
              >
                Delete Question
              </button>

            </div>
          )
        )}

      </div>

      <div className="editor-actions">

        <button
          className="add-btn"
          onClick={addQuestion}
        >
          + Add Question
        </button>

        <button
          className="save-btn"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Final Paper"}
        </button>

      </div>

    </div>
  );
}

export default EditPaper;