import { useState } from "react";

export default function SyllabusPublishModal({
  isOpen,
  onClose,
  onPublish,
  topicCount,
  currentVersionNumber,
}) {
  const nextVersion = (currentVersionNumber || 0) + 1;
  const [versionTitle, setVersionTitle] = useState(`Syllabus Release v${nextVersion}`);
  const [changeSummary, setChangeSummary] = useState("");
  const [publishing, setPublishing] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setPublishing(true);
      await onPublish({
        versionTitle: versionTitle.trim() || `Release v${nextVersion}`,
        changeSummary: changeSummary.trim() || "Routine syllabus snapshot publication.",
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="tsm-modal-backdrop" onClick={onClose}>
      <div className="tsm-modal-card" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
        <div className="tsm-modal-header">
          <h2 className="tsm-modal-title">🚀 Publish Syllabus Version</h2>
          <button type="button" className="tsm-modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "contents" }}>
          <div className="tsm-modal-body">
            <div
              style={{
                background: "rgba(147, 51, 234, 0.12)",
                border: "1px solid rgba(168, 85, 247, 0.35)",
                borderRadius: 12,
                padding: "14px 16px",
                fontSize: "0.85rem",
                color: "#e2e8f0",
                lineHeight: 1.5,
              }}
            >
              <p style={{ margin: "0 0 6px 0", fontWeight: 700, color: "#d8b4fe" }}>
                Snapshot & Notification Overview
              </p>
              Publishing will capture an immutable snapshot of all <strong>{topicCount}</strong> current
              syllabus topics as <strong>Version {nextVersion}</strong>.
              <br />
              Enrolled students will receive a notification and can track revision progress against this version.
              Your editable draft remains intact for future updates.
            </div>

            <div className="tsm-form-group">
              <label className="tsm-form-label">Version Title</label>
              <input
                type="text"
                className="tsm-form-input"
                placeholder={`e.g. Mid-Term Syllabus v${nextVersion}`}
                value={versionTitle}
                onChange={(e) => setVersionTitle(e.target.value)}
              />
            </div>

            <div className="tsm-form-group">
              <label className="tsm-form-label">Change Summary</label>
              <textarea
                className="tsm-form-textarea"
                rows={3}
                placeholder="Describe what changed or was added in this syllabus version..."
                value={changeSummary}
                onChange={(e) => setChangeSummary(e.target.value)}
              />
            </div>
          </div>

          <div className="tsm-modal-footer">
            <button type="button" className="tsm-btn-secondary" onClick={onClose} disabled={publishing}>
              Cancel
            </button>
            <button type="submit" className="tsm-btn-primary" disabled={publishing}>
              {publishing ? "Publishing Snapshot..." : `Confirm & Publish v${nextVersion}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
