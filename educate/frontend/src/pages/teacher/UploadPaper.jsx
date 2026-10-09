import { useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { uploadPaper } from "../../services/teacherService";
import "./UploadPaper.css";

function UploadPaper() {
  const navigate = useNavigate();

  const [file, setFile] = useState(null);
  const [paperId, setPaperId] = useState("");
  const [subject, setSubject] = useState("");
  const [internalNo, setInternalNo] = useState("1");
  const [customExamName, setCustomExamName] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!file) {
      toast.error("Please select a question paper file to upload");
      return;
    }

    try {
      setLoading(true);

      let effectiveIntNo = 1;
      let effectiveExamName = "Internal Assessment Test-I";

      if (internalNo === "1") {
        effectiveIntNo = 1;
        effectiveExamName = "Internal Assessment Test-I";
      } else if (internalNo === "2") {
        effectiveIntNo = 2;
        effectiveExamName = "Internal Assessment Test-II";
      } else if (internalNo === "3") {
        effectiveIntNo = 3;
        effectiveExamName = "Internal Assessment Test-III";
      } else if (internalNo === "MID_TERM") {
        effectiveIntNo = 1;
        effectiveExamName = "Mid-Term Examination";
      } else if (internalNo === "SEM_EXAM") {
        effectiveIntNo = 1;
        effectiveExamName = "Semester End Examination (SEE)";
      } else if (internalNo === "FINAL_EXAM") {
        effectiveIntNo = 1;
        effectiveExamName = "Final University Examination";
      } else if (internalNo === "MODEL_PRACTICE") {
        effectiveIntNo = 1;
        effectiveExamName = "Model / Practice Examination";
      } else if (internalNo === "QUIZ") {
        effectiveIntNo = 1;
        effectiveExamName = "Objective MCQ Quiz";
      } else if (internalNo === "CUSTOM") {
        effectiveIntNo = 1;
        effectiveExamName = customExamName || "Special Examination";
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("paperId", paperId.trim());
      formData.append("subject", subject.trim());
      formData.append("internalNo", String(effectiveIntNo));
      formData.append("examName", effectiveExamName);

      await uploadPaper(formData);

      toast.success("Question Paper Uploaded & Parsed Successfully!");

      setTimeout(() => {
        navigate("/teacher/paper-analysis");
      }, 1000);
    } catch (error) {
      const errorMsg =
        (typeof error.response?.data === "string" && error.response.data) ||
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Upload Failed";
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-page">
      {/* Top Navbar */}
      <div className="upload-top-nav">
        <button className="back-btn" onClick={() => navigate(-1)}>
          ← Back
        </button>
      </div>

      <div className="upload-container">
        <div className="upload-card">
          <div className="upload-header">
            <div className="upload-icon-circle">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <h1>Upload Question Paper</h1>
            <p>
              Upload your PDF, DOCX, or scanned paper. Our AI parser will automatically extract questions, marks, and choice options.
            </p>
          </div>

          <form className="upload-form" onSubmit={handleSubmit}>
            {/* Drag & Drop File Zone */}
            <div
              className={`dropzone-box ${dragOver ? "drag-active" : ""} ${file ? "has-file" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
            >
              {!file ? (
                <label className="dropzone-label">
                  <div className="dropzone-icon">📁</div>
                  <span className="dropzone-main-text">
                    <strong>Click to browse</strong> or drag & drop file here
                  </span>
                  <span className="dropzone-sub-text">PDF, DOCX, PNG, or JPG (up to 20MB)</span>
                  <input
                    type="file"
                    accept=".pdf,.docx,.doc,image/*"
                    onChange={handleFileChange}
                    className="hidden-file-input"
                  />
                </label>
              ) : (
                <div className="selected-file-card">
                  <div className="file-info-left">
                    <div className="file-type-icon">📄</div>
                    <div className="file-details">
                      <span className="file-name-text">{file.name}</span>
                      <span className="file-size-text">{formatFileSize(file.size)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="remove-file-btn"
                    onClick={() => setFile(null)}
                    title="Remove file"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {/* Metadata Inputs */}
            <div className="metadata-grid">
              <div className="upload-input-field">
                <label>Paper ID <span className="opt-tag">(Optional)</span></label>
                <input
                  type="text"
                  placeholder="Auto-generated if blank"
                  value={paperId}
                  onChange={(e) => setPaperId(e.target.value)}
                />
              </div>

              <div className="upload-input-field">
                <label>Examination Category / Type</label>
                <select
                  value={internalNo}
                  onChange={(e) => setInternalNo(e.target.value)}
                >
                  <option value="1">Internal Assessment Test 1 (IA-1)</option>
                  <option value="2">Internal Assessment Test 2 (IA-2)</option>
                  <option value="3">Internal Assessment Test 3 (IA-3)</option>
                  <option value="MID_TERM">Mid-Term Examination</option>
                  <option value="SEM_EXAM">Semester End Examination (SEE)</option>
                  <option value="FINAL_EXAM">Final / University Examination</option>
                  <option value="MODEL_PRACTICE">Model / Practice Examination</option>
                  <option value="QUIZ">Objective MCQ Quiz / Test</option>
                  <option value="CUSTOM">Custom Examination Name...</option>
                </select>
              </div>
            </div>

            {internalNo === "CUSTOM" && (
              <div className="upload-input-field full-width">
                <label>Custom Examination Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Unit Test 1, Lab Exam, Surprise Test..."
                  value={customExamName}
                  onChange={(e) => setCustomExamName(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="upload-input-field full-width">
              <label>Subject Name <span className="opt-tag">(Optional - AI auto-detects)</span></label>
              <input
                type="text"
                placeholder="e.g. Indian Knowledge System or IoT"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="upload-submit-btn"
              disabled={loading || !file}
            >
              {loading ? (
                <span className="loading-btn-content">
                  <span className="spinner"></span>
                  Analyzing & Extracting with AI...
                </span>
              ) : (
                "🚀 Upload & Parse Question Paper"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default UploadPaper;