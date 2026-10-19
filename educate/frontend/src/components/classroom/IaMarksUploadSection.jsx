import React, { useState, useEffect } from "react";
import {
  downloadIaSampleTemplate,
  uploadIaMarks,
  getIaRecordsByNumber,
  getStudentIaBreakdown,
} from "../../services/classroomService";
import "./IaMarksUploadSection.css";

const IaMarksUploadSection = ({ classroomId, classroomName, enrolledStudents = [] }) => {
  const [selectedIa, setSelectedIa] = useState(1);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: string, summary: object }
  const [iaRecords, setIaRecords] = useState([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Student breakdown modal state
  const [inspectStudentUsn, setInspectStudentUsn] = useState(null);
  const [studentBreakdown, setStudentBreakdown] = useState(null);
  const [isLoadingBreakdown, setIsLoadingBreakdown] = useState(false);

  // Load records for selected IA on mount or change
  useEffect(() => {
    if (classroomId) {
      loadIaRecords(selectedIa);
    }
  }, [classroomId, selectedIa]);

  const loadIaRecords = async (iaNum) => {
    try {
      setIsLoadingRecords(true);
      const records = await getIaRecordsByNumber(classroomId, iaNum);
      setIaRecords(records || []);
    } catch (err) {
      console.error("Failed to load IA records:", err);
      // Non-fatal, just set empty
      setIaRecords([]);
    } finally {
      setIsLoadingRecords(false);
    }
  };

  // Download Sample Template
  const handleDownloadTemplate = async () => {
    try {
      setIsDownloading(true);
      setFeedback(null);
      const blob = await downloadIaSampleTemplate(classroomId);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `IA_SplitupMarks_${classroomName || "Classroom"}_IA${selectedIa}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

      setFeedback({
        type: "success",
        message: "Sample Excel template downloaded! It contains enrolled students with standard VTU sub-question headers.",
      });
    } catch (err) {
      console.error("Template download error:", err);
      setFeedback({
        type: "error",
        message: "Failed to download template. Ensure backend is running and you have proper permissions.",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  // File selection
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setFeedback(null);
    }
  };

  // Upload IA marks
  const handleUploadMarks = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setFeedback({ type: "error", message: "Please select an Excel file (.xlsx) first." });
      return;
    }

    try {
      setIsUploading(true);
      setFeedback(null);

      const formData = new FormData();
      formData.append("file", selectedFile);

      const summary = await uploadIaMarks(classroomId, formData, selectedIa);

      setFeedback({
        type: "success",
        message: summary.message || `Successfully ingested IA-${selectedIa} marks for ${summary.totalStudentsIngested} students!`,
        summary,
      });

      setSelectedFile(null);
      // Reset input element if available
      const fileInput = document.getElementById("ia-excel-file-input");
      if (fileInput) fileInput.value = "";

      // Refresh list
      loadIaRecords(selectedIa);
    } catch (err) {
      console.error("IA ingestion error:", err);
      const errorMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Failed to ingest Excel file. Ensure file follows standard VTU split-up format.";
      setFeedback({
        type: "error",
        message: errorMsg,
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Inspect student breakdown
  const handleInspectStudent = async (usn) => {
    setInspectStudentUsn(usn);
    try {
      setIsLoadingBreakdown(true);
      const data = await getStudentIaBreakdown(classroomId, usn);
      setStudentBreakdown(data);
    } catch (err) {
      console.error("Failed to fetch student breakdown:", err);
      setStudentBreakdown(null);
    } finally {
      setIsLoadingBreakdown(false);
    }
  };

  const closeInspectModal = () => {
    setInspectStudentUsn(null);
    setStudentBreakdown(null);
  };

  const filteredRecords = iaRecords.filter(
    (r) =>
      r.usn?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.studentName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="ia-marks-section">
      {/* Top Banner / Actions Card */}
      <div className="ia-header-banner">
        <div className="ia-header-text">
          <div className="ia-badge">Feature 2: Academic Intelligence</div>
          <h2>📊 Iterative IA Split-Up Excel Parser & Module Mapper</h2>
          <p>
            Ingest question-wise sub-marks (1a, 1b, 2a, 2b, 3a, 3b, 4a, 4b) for VTU assessments.
            Acadion maps sub-questions directly to Modules 1–5 to track module mastery and diagnose weak topics.
          </p>
        </div>

        <div className="ia-header-actions">
          <button
            type="button"
            className="btn-download-template"
            onClick={handleDownloadTemplate}
            disabled={isDownloading}
            title="Download an Excel template pre-filled with all currently enrolled students in this classroom"
          >
            {isDownloading ? (
              <>
                <span className="ia-spinner" /> Generating Template...
              </>
            ) : (
              <>📥 Download Sample Excel Template for Enrolled Students</>
            )}
          </button>
        </div>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div className={`ia-feedback-alert ${feedback.type}`}>
          <div className="ia-feedback-icon">
            {feedback.type === "success" ? "✅" : "⚠️"}
          </div>
          <div className="ia-feedback-content">
            <strong>{feedback.type === "success" ? "Success!" : "Notice:"}</strong> {feedback.message}
            {feedback.summary?.totalStudentsIngested !== undefined && (
              <span className="ia-feedback-count">
                (Students processed: {feedback.summary.totalStudentsIngested})
              </span>
            )}
          </div>
          <button
            type="button"
            className="ia-feedback-close"
            onClick={() => setFeedback(null)}
          >
            ×
          </button>
        </div>
      )}

      {/* Control Card: IA Selector & Upload Dropzone */}
      <div className="ia-control-grid">
        {/* IA Selector Card */}
        <div className="ia-card ia-selector-card">
          <label className="ia-card-label">1. Select Internal Assessment (IA)</label>
          <div className="ia-pill-selector">
            {[
              { num: 1, label: "IA-1", desc: "Modules 1 & 2" },
              { num: 2, label: "IA-2", desc: "Modules 3 & 4" },
              { num: 3, label: "IA-3", desc: "Module 5" },
            ].map((ia) => (
              <button
                key={ia.num}
                type="button"
                className={`ia-pill-btn ${selectedIa === ia.num ? "active" : ""}`}
                onClick={() => {
                  setSelectedIa(ia.num);
                  setFeedback(null);
                }}
              >
                <span className="pill-title">{ia.label}</span>
                <span className="pill-desc">{ia.desc}</span>
              </button>
            ))}
          </div>

          <div className="ia-vtu-rule-hint">
            <strong>VTU Choice Rule:</strong> Sub-questions 1a/1b or 2a/2b cover Part A; 3a/3b or 4a/4b cover Part B.
            Max 20 marks per part (Total: 40 marks).
          </div>
        </div>

        {/* Upload Form Card */}
        <div className="ia-card ia-upload-card">
          <label className="ia-card-label">2. Upload Completed IA-{selectedIa} Marks Excel (.xlsx)</label>
          <form onSubmit={handleUploadMarks} className="ia-upload-form">
            <div className="ia-file-dropzone">
              <input
                id="ia-excel-file-input"
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                className="ia-file-input"
              />
              <div className="dropzone-inner">
                <span className="dropzone-icon">📁</span>
                <span className="dropzone-prompt">
                  {selectedFile ? (
                    <strong className="dropzone-selected-name">
                      {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </strong>
                  ) : (
                    "Choose an .xlsx file or drag & drop here"
                  )}
                </span>
                <span className="dropzone-subtext">
                  Supports VTU Multi-Row Header Sheets (e.g., Iot-7A-SplitupMarks.xlsx)
                </span>
              </div>
            </div>

            <button
              type="submit"
              className="btn-upload-ia"
              disabled={!selectedFile || isUploading}
            >
              {isUploading ? (
                <>
                  <span className="ia-spinner" /> Parsing & Ingesting IA-{selectedIa}...
                </>
              ) : (
                <>📤 Ingest IA-{selectedIa} Marks</>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Ingested Records Display Section */}
      <div className="ia-records-section">
        <div className="ia-records-header">
          <div>
            <h3>
              📋 Ingested IA-{selectedIa} Marks Records ({iaRecords.length})
            </h3>
            <p>Students with parsed sub-question split-ups and computed module mastery.</p>
          </div>

          <div className="ia-search-box">
            <input
              type="text"
              placeholder="Filter by USN or Name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ia-search-input"
            />
          </div>
        </div>

        {isLoadingRecords ? (
          <div className="ia-empty-state">
            <span className="ia-spinner large" />
            <p>Loading IA-{selectedIa} records...</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="ia-empty-state">
            <span className="empty-icon">📑</span>
            <h4>No marks ingested yet for IA-{selectedIa}</h4>
            <p>
              Download the sample Excel template above, fill in student marks (or use default sample marks),
              and upload the file to view automated module analytics.
            </p>
          </div>
        ) : (
          <div className="ia-table-wrapper">
            <table className="ia-marks-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>USN</th>
                  <th>Student Name</th>
                  <th>1a</th>
                  <th>1b</th>
                  <th>2a</th>
                  <th>2b</th>
                  <th>3a</th>
                  <th>3b</th>
                  <th>4a</th>
                  <th>4b</th>
                  <th>Total (/40)</th>
                  <th>Module Mastery</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((r, idx) => {
                  const q = r.questionMarks || {};
                  return (
                    <tr key={r.id || r.usn}>
                      <td className="cell-muted">{idx + 1}</td>
                      <td>
                        <strong className="usn-tag">{r.usn}</strong>
                      </td>
                      <td className="name-cell">{r.studentName}</td>
                      <td className="mark-cell">{q["1a"] !== undefined ? q["1a"] : "-"}</td>
                      <td className="mark-cell">{q["1b"] !== undefined ? q["1b"] : "-"}</td>
                      <td className="mark-cell">{q["2a"] !== undefined ? q["2a"] : "-"}</td>
                      <td className="mark-cell">{q["2b"] !== undefined ? q["2b"] : "-"}</td>
                      <td className="mark-cell">{q["3a"] !== undefined ? q["3a"] : "-"}</td>
                      <td className="mark-cell">{q["3b"] !== undefined ? q["3b"] : "-"}</td>
                      <td className="mark-cell">{q["4a"] !== undefined ? q["4a"] : "-"}</td>
                      <td className="mark-cell">{q["4b"] !== undefined ? q["4b"] : "-"}</td>
                      <td>
                        <span className="badge-total-marks">
                          {r.totalMarks !== undefined ? r.totalMarks.toFixed(1) : "0.0"}
                        </span>
                      </td>
                      <td>
                        <div className="mastery-badges-row">
                          {r.moduleMastery &&
                            Object.entries(r.moduleMastery).map(([modNum, pct]) => {
                              const isLow = pct < 50;
                              const isHigh = pct >= 75;
                              return (
                                <span
                                  key={modNum}
                                  className={`mastery-chip ${isLow ? "low" : isHigh ? "high" : "mid"}`}
                                  title={`Module ${modNum}: ${pct}% mastery`}
                                >
                                  M{modNum}: {pct}%
                                </span>
                              );
                            })}
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-inspect-student"
                          onClick={() => handleInspectStudent(r.usn)}
                          title="View weak topics and full IA history"
                        >
                          🔍 Breakdown
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

      {/* Inspect Student Modal */}
      {inspectStudentUsn && (
        <div className="ia-modal-backdrop" onClick={closeInspectModal}>
          <div className="ia-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="ia-modal-header">
              <div>
                <h3>🎓 Academic Intelligence Breakdown</h3>
                <p>
                  Student: <strong>{studentBreakdown?.studentName || inspectStudentUsn}</strong> ({inspectStudentUsn})
                </p>
              </div>
              <button type="button" className="ia-modal-close" onClick={closeInspectModal}>
                ×
              </button>
            </div>

            <div className="ia-modal-body">
              {isLoadingBreakdown ? (
                <div className="ia-empty-state">
                  <span className="ia-spinner" />
                  <p>Calculating academic mastery & weak topics...</p>
                </div>
              ) : !studentBreakdown ? (
                <div className="ia-empty-state">
                  <p>No breakdown data available for {inspectStudentUsn}</p>
                </div>
              ) : (
                <>
                  {/* Summary Metric Cards */}
                  <div className="ia-stats-grid">
                    <div className="ia-stat-box">
                      <span className="stat-label">Overall IA Average</span>
                      <span className="stat-value highlight">
                        {studentBreakdown.overallIaAverage !== undefined
                          ? studentBreakdown.overallIaAverage.toFixed(1)
                          : "0.0"}{" "}
                        / 40
                      </span>
                    </div>

                    <div className="ia-stat-box">
                      <span className="stat-label">Weak Modules (&lt; 50%)</span>
                      <span className="stat-value alert">
                        {studentBreakdown.weakModules?.length > 0 ? (
                          studentBreakdown.weakModules.join(", ")
                        ) : (
                          <span className="text-success">None 🎉</span>
                        )}
                      </span>
                    </div>

                    <div className="ia-stat-box">
                      <span className="stat-label">Strong Modules (≥ 75%)</span>
                      <span className="stat-value success">
                        {studentBreakdown.strongModules?.length > 0 ? (
                          studentBreakdown.strongModules.join(", ")
                        ) : (
                          "In Progress"
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Cumulative Module Mastery Bar */}
                  <h4 className="section-subtitle">Module-by-Module Mastery</h4>
                  <div className="module-bars-list">
                    {studentBreakdown.cumulativeModuleMastery &&
                      Object.entries(studentBreakdown.cumulativeModuleMastery).map(([mod, pct]) => (
                        <div key={mod} className="module-bar-item">
                          <div className="bar-labels">
                            <span>Module {mod}</span>
                            <strong>{pct.toFixed(1)}%</strong>
                          </div>
                          <div className="bar-track">
                            <div
                              className={`bar-fill ${pct < 50 ? "low" : pct >= 75 ? "high" : "mid"}`}
                              style={{ width: `${Math.min(100, Math.max(5, pct))}%` }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>

                  {/* Individual IA Tests Taken */}
                  <h4 className="section-subtitle">Recorded IA Submissions</h4>
                  <div className="ia-submissions-list">
                    {studentBreakdown.iaRecords?.map((rec) => (
                      <div key={rec.id || rec.iaNumber} className="submission-item">
                        <div className="submission-title">
                          <strong>IA-{rec.iaNumber}</strong>
                          <span className="submission-total">Score: {rec.totalMarks} / 40</span>
                        </div>
                        <div className="submission-breakdown">
                          {rec.questionMarks &&
                            Object.entries(rec.questionMarks).map(([q, mark]) => (
                              <span key={q} className="q-mark-pill">
                                {q}: <strong>{mark}</strong>
                              </span>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="ia-modal-footer">
              <button type="button" className="btn-close-modal" onClick={closeInspectModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IaMarksUploadSection;
