import { useState } from "react";
import toast from "react-hot-toast";
import {
  exportSyllabusFile,
  exportProgressFile,
  triggerBlobDownload,
} from "../../services/syllabusService";

export default function SyllabusReportsSection({ classroomId, versions = [] }) {
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [downloading, setDownloading] = useState({
    syllabusCsv: false,
    syllabusXlsx: false,
    progressCsv: false,
    progressXlsx: false,
  });

  const handleDownloadSyllabus = async (format) => {
    const key = format === "xlsx" ? "syllabusXlsx" : "syllabusCsv";
    if (downloading[key]) return;

    try {
      setDownloading((prev) => ({ ...prev, [key]: true }));
      const response = await exportSyllabusFile(classroomId, format, selectedVersionId || null);
      const fallbackName = `syllabus_${classroomId}.${format}`;
      triggerBlobDownload(response, fallbackName);
      toast.success(`Syllabus ${format.toUpperCase()} report downloaded!`);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || `Failed to download syllabus ${format.toUpperCase()}`);
    } finally {
      setDownloading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleDownloadProgress = async (format) => {
    const key = format === "xlsx" ? "progressXlsx" : "progressCsv";
    if (downloading[key]) return;

    try {
      setDownloading((prev) => ({ ...prev, [key]: true }));
      const response = await exportProgressFile(classroomId, format, selectedVersionId || null);
      const fallbackName = `syllabus_progress_${classroomId}.${format}`;
      triggerBlobDownload(response, fallbackName);
      toast.success(`Progress ${format.toUpperCase()} report downloaded!`);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || `Failed to download progress ${format.toUpperCase()}`);
    } finally {
      setDownloading((prev) => ({ ...prev, [key]: false }));
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* SCOPE SELECTOR */}
      <div
        style={{
          background: "rgba(30, 27, 46, 0.6)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 14,
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontWeight: 700, color: "#f8fafc", fontSize: "0.95rem" }}>
            Export Dataset Scope
          </div>
          <div style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
            Select whether to download reports generated from the current live draft or an official published version snapshot.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <label style={{ fontSize: "0.8rem", color: "#cbd5e1" }}>Report Source:</label>
          <select
            className="tsm-form-select"
            value={selectedVersionId}
            onChange={(e) => setSelectedVersionId(e.target.value)}
          >
            <option value="">Live Working Draft (Default)</option>
            {versions.map((ver) => (
              <option key={ver.id} value={ver.id}>
                v{ver.versionNumber}: {ver.versionTitle}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* EXPORTS CARDS GRID */}
      <div className="tsm-exports-grid">
        {/* CARD 1: SYLLABUS TOPIC OUTLINE */}
        <div className="tsm-export-box">
          <div>
            <div className="tsm-export-box-icon">📑</div>
            <h4 className="tsm-export-box-title">Syllabus Topic Outline</h4>
            <p className="tsm-export-box-desc">
              Exports the complete curriculum structure including unit titles, topic descriptions, teaching hours, planned schedule dates, learning objectives, and external reference links.
            </p>
          </div>

          <div className="tsm-export-actions">
            <button
              type="button"
              className="tsm-btn-secondary"
              onClick={() => handleDownloadSyllabus("csv")}
              disabled={downloading.syllabusCsv}
            >
              {downloading.syllabusCsv ? "Generating..." : "📥 Export CSV"}
            </button>
            <button
              type="button"
              className="tsm-btn-primary"
              onClick={() => handleDownloadSyllabus("xlsx")}
              disabled={downloading.syllabusXlsx}
            >
              {downloading.syllabusXlsx ? "Generating..." : "📊 Export Excel (.xlsx)"}
            </button>
          </div>
        </div>

        {/* CARD 2: PROGRESS & COVERAGE REPORT */}
        <div className="tsm-export-box">
          <div>
            <div className="tsm-export-box-icon">📈</div>
            <h4 className="tsm-export-box-title">Coverage & Progress Report</h4>
            <p className="tsm-export-box-desc">
              Exports teaching delivery progress metrics, completion status breakdown, schedule compliance (upcoming vs. overdue topics), and cumulative teaching hours tracked.
            </p>
          </div>

          <div className="tsm-export-actions">
            <button
              type="button"
              className="tsm-btn-secondary"
              onClick={() => handleDownloadProgress("csv")}
              disabled={downloading.progressCsv}
            >
              {downloading.progressCsv ? "Generating..." : "📥 Export CSV"}
            </button>
            <button
              type="button"
              className="tsm-btn-primary"
              onClick={() => handleDownloadProgress("xlsx")}
              disabled={downloading.progressXlsx}
            >
              {downloading.progressXlsx ? "Generating..." : "📊 Export Excel (.xlsx)"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
