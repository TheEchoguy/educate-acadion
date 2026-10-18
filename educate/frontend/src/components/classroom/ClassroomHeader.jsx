import React from "react";
import toast from "react-hot-toast";
import "./ClassroomHeader.css";

export default function ClassroomHeader({
  classroom,
  backLabel = "← Back to All Classrooms",
  onBack,
  workspaceTitle = null,
  onRegenerateCode = null,
  regenerating = false,
  showJoinCode = true,
}) {
  if (!classroom) return null;

  const handleCopyCode = (e) => {
    e.stopPropagation();
    if (!classroom.joinCode) return;
    navigator.clipboard.writeText(classroom.joinCode);
    toast.success(`Join code ${classroom.joinCode} copied to clipboard!`);
  };

  const status = (classroom.status || "ACTIVE").toUpperCase();

  return (
    <div className="classroom-header-card classroom-identity-card" id="classroom-header">
      {/* TOP ROW: Back Navigation & Status Badge */}
      <div className="classroom-header-top-row">
        <div className="classroom-header-nav-group">
          {onBack && (
            <button
              type="button"
              className="classroom-header-back-btn btn-back-classrooms"
              onClick={onBack}
              id="btn-classroom-header-back"
            >
              {backLabel}
            </button>
          )}
          {workspaceTitle && (
            <>
              <span className="classroom-header-separator">/</span>
              <span className="classroom-header-workspace-badge">
                {workspaceTitle}
              </span>
            </>
          )}
        </div>

        <div className="classroom-header-status-wrap">
          <span className={`classroom-status-badge badge-status status-${status.toLowerCase()}`}>
            <span className="status-dot">●</span> {status}
          </span>
        </div>
      </div>

      {/* MAIN HEADING: Subject Code Tag + Classroom Name */}
      <div className="classroom-header-identity identity-left-col">
        <div className="classroom-header-code-tag subject-code-tag" id="header-subject-code">
          {classroom.subjectCode || "N/A"}
        </div>
        <h1 className="classroom-header-title classroom-title" id="header-classroom-name">
          {classroom.name}
        </h1>
      </div>

      {/* SUBJECT LINE */}
      <div className="classroom-header-subject-line subject-fullname" id="header-subject-name">
        <span className="subject-icon">📖</span>
        <span className="subject-text">{classroom.subjectName || "Subject Workspace"}</span>
      </div>

      {/* METADATA CHIPS ROW */}
      <div className="classroom-header-chips-row meta-badges-row">
        <span className="classroom-meta-chip badge-meta" id="chip-semester">
          <span className="chip-icon">🎓</span> Sem {classroom.semester || "1"}
        </span>
        <span className="classroom-meta-chip badge-meta" id="chip-section">
          <span className="chip-icon">🏷️</span> Section {classroom.section || "A"}
        </span>
        {classroom.department && (
          <span className="classroom-meta-chip badge-meta" id="chip-department">
            <span className="chip-icon">🏛️</span> {classroom.department}
          </span>
        )}
        {(classroom.academicBatch || classroom.academicYear) && (
          <span className="classroom-meta-chip badge-meta" id="chip-academic-year">
            <span className="chip-icon">📅</span> {classroom.academicBatch || classroom.academicYear}
          </span>
        )}
      </div>

      {/* JOIN CODE ROW / PANEL (where authorized & available) */}
      {showJoinCode && classroom.joinCode && (
        <div className="classroom-header-join-panel join-code-panel" id="header-join-code-panel">
          <div className="join-panel-info">
            <span className="join-panel-label code-label">Student Join Code</span>
            <span className="join-panel-code code-display" id="header-join-code-value">
              {classroom.joinCode}
            </span>
          </div>

          <div className="join-panel-actions code-cluster">
            <button
              type="button"
              className="btn-join-action btn-join-copy btn-code-action"
              id="btn-copy-join-code"
              onClick={handleCopyCode}
              title="Copy join code to clipboard"
            >
              📋 Copy
            </button>
            {onRegenerateCode && (
              <button
                type="button"
                className="btn-join-action btn-join-regen btn-code-action btn-regen"
                id="btn-regenerate-join-code"
                onClick={onRegenerateCode}
                disabled={regenerating}
                title="Regenerate join code"
              >
                {regenerating ? "..." : "🔄 Regenerate"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
