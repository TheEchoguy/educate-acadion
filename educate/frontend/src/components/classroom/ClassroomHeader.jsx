import React from "react";
import toast from "react-hot-toast";
import "./ClassroomHeader.css";

export default function ClassroomHeader({
  classroom,
  backLabel = "← Back to Classrooms",
  onBack,
  secondaryBackLabel = null,
  onSecondaryBack = null,
  workspaceTitle = null,
  onRegenerateCode = null,
  regenerating = false,
  showJoinCode = true,
  onEditClassroom = null,
  onDeleteClassroom = null,
  compact = false,
}) {
  if (!classroom) return null;

  const handleCopyCode = (e) => {
    e.stopPropagation();
    if (!classroom.joinCode) return;
    navigator.clipboard.writeText(classroom.joinCode);
    toast.success(`Join code ${classroom.joinCode} copied to clipboard!`);
  };

  const status = (classroom.status || "ACTIVE").toUpperCase();
  const rawName = (classroom.name || classroom.subjectName || "").toLowerCase();
  const inferredCode = rawName.includes("energy") ? "BEE755B" : (rawName.includes("internet") || rawName.includes("iot") ? "BCS701" : "COURSE");
  const courseCode = classroom.courseCode || classroom.subjectCode || inferredCode;
  const subjectName = classroom.subjectName || classroom.name || "Subject";
  const semSec = `(Sem ${classroom.semester || "7"}-${classroom.section || "A"})`;

  if (compact) {
    return (
      <div className="compact-classroom-nav-bar" id="compact-classroom-header">
        <div className="compact-nav-left">
          {onSecondaryBack && (
            <>
              <button
                type="button"
                className="compact-back-btn compact-secondary-crumb"
                onClick={onSecondaryBack}
                id="btn-compact-header-secondary-back"
              >
                {secondaryBackLabel || "Classrooms"}
              </button>
              <span className="compact-nav-slash">/</span>
            </>
          )}
          {onBack && (
            <button
              type="button"
              className="compact-back-btn"
              onClick={onBack}
              id="btn-compact-header-back"
            >
              {backLabel}
            </button>
          )}
          <span className="compact-nav-slash">/</span>
          <span className="compact-course-title">
            <strong className="compact-code-highlight">{courseCode}: {subjectName}</strong>{" "}
            <span className="compact-sem-sec">{semSec}</span>
          </span>
          {workspaceTitle && (
            <>
              <span className="compact-nav-bullet">•</span>
              <span className="compact-workspace-title">{workspaceTitle}</span>
            </>
          )}
        </div>

        <div className="compact-nav-right">
          {showJoinCode && classroom.joinCode && (
            <div className="compact-join-code-pill">
              <span className="compact-code-label">Join Code:</span>
              <code className="compact-code-val">{classroom.joinCode}</code>
              <button
                type="button"
                className="compact-copy-btn"
                onClick={handleCopyCode}
                title="Copy Join Code to clipboard"
              >
                📋 Copy
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="classroom-header-card classroom-identity-card" id="classroom-header">
      {/* TOP ROW: Back Navigation & Status Badge */}
      <div className="classroom-header-top-row">
        <div className="classroom-header-nav-group">
          {onSecondaryBack && (
            <>
              <button
                type="button"
                className="classroom-header-back-btn btn-secondary-crumb"
                onClick={onSecondaryBack}
                id="btn-classroom-header-secondary-back"
              >
                {secondaryBackLabel || "Classrooms"}
              </button>
              <span className="classroom-header-separator">/</span>
            </>
          )}
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
          {(onEditClassroom || onDeleteClassroom) && (
            <div className="classroom-header-action-group">
              {onEditClassroom && (
                <button
                  type="button"
                  className="btn-header-action btn-header-edit"
                  onClick={onEditClassroom}
                  id="btn-header-edit-classroom"
                  title="Edit Classroom Settings"
                >
                  ⚙️ Settings
                </button>
              )}
              {onDeleteClassroom && (
                <button
                  type="button"
                  className="btn-header-action btn-header-delete"
                  onClick={onDeleteClassroom}
                  id="btn-header-delete-classroom"
                  title="Delete Classroom"
                >
                  🗑️ Delete
                </button>
              )}
            </div>
          )}
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
