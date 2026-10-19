import { useState, useEffect } from "react";
import { getPublishedVersion } from "../../services/syllabusService";

export default function SyllabusVersionViewModal({ isOpen, onClose, classroomId, versionId }) {
  const [versionData, setVersionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    if (isOpen && classroomId && versionId) {
      getPublishedVersion(classroomId, versionId)
        .then((data) => {
          if (active) {
            setVersionData(data);
            setLoading(false);
          }
        })
        .catch((err) => {
          console.error(err);
          if (active) {
            setError("Failed to load version snapshot details");
            setLoading(false);
          }
        });
    }
    return () => {
      active = false;
    };
  }, [isOpen, classroomId, versionId]);

  if (!isOpen) return null;

  // Group topics by unit
  const groupedUnits = {};
  if (versionData?.topics) {
    versionData.topics.forEach((t) => {
      const u = t.unit || "General";
      if (!groupedUnits[u]) groupedUnits[u] = [];
      groupedUnits[u].push(t);
    });
  }

  return (
    <div className="tsm-modal-backdrop" onClick={onClose}>
      <div className="tsm-modal-card" style={{ width: 720 }} onClick={(e) => e.stopPropagation()}>
        <div className="tsm-modal-header">
          <div>
            <h2 className="tsm-modal-title">
              📜 Version Snapshot: {versionData?.versionTitle || `v${versionData?.versionNumber || ""}`}
            </h2>
            <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
              Published {versionData?.publishedAt ? new Date(versionData.publishedAt).toLocaleString() : ""} by {versionData?.publishedBy || "Teacher"}
            </span>
          </div>
          <button type="button" className="tsm-modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="tsm-modal-body">
          {loading ? (
            <div className="tsm-loading-container">
              <div className="tsm-spinner"></div>
              <p>Loading historical snapshot...</p>
            </div>
          ) : error ? (
            <div style={{ color: "#f87171", padding: 20, textAlign: "center" }}>{error}</div>
          ) : !versionData ? (
            <div className="tsm-empty-state">No version data found.</div>
          ) : (
            <>
              {/* IMMUTABLE SNAPSHOT BANNER */}
              <div
                style={{
                  background: "rgba(100, 116, 139, 0.15)",
                  border: "1px solid rgba(148, 163, 184, 0.25)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontSize: "0.82rem",
                  color: "#cbd5e1",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span>🔒</span>
                <div>
                  <strong>Immutable Historical Snapshot:</strong> This captures the exact state of the syllabus at publication time.
                  {versionData.changeSummary && (
                    <div style={{ marginTop: 4, color: "#94a3b8", fontStyle: "italic" }}>
                      &ldquo;{versionData.changeSummary}&rdquo;
                    </div>
                  )}
                </div>
              </div>

              {/* TOPIC LIST GROUPED BY UNIT */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 10 }}>
                {Object.keys(groupedUnits).map((unitName) => (
                  <div key={unitName}>
                    <div
                      style={{
                        fontSize: "0.88rem",
                        fontWeight: 700,
                        color: "#a855f7",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        marginBottom: 8,
                      }}
                    >
                      {unitName} ({groupedUnits[unitName].length} topics)
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {groupedUnits[unitName].map((t, idx) => (
                        <div
                          key={t.topicId || idx}
                          style={{
                            background: "rgba(15, 23, 42, 0.6)",
                            border: "1px solid rgba(255, 255, 255, 0.06)",
                            borderRadius: 10,
                            padding: "12px 14px",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                            <span style={{ fontWeight: 600, color: "#f8fafc", fontSize: "0.92rem" }}>
                              {t.topic}
                            </span>
                            <span
                              className={`tsm-badge tsm-badge-${t.status ? t.status.toLowerCase().replace("_", "-") : "not-started"}`}
                            >
                              {t.status ? t.status.replace("_", " ") : "NOT STARTED"}
                            </span>
                          </div>

                          {t.description && (
                            <p style={{ fontSize: "0.8rem", color: "#94a3b8", margin: "4px 0" }}>
                              {t.description}
                            </p>
                          )}

                          <div style={{ display: "flex", gap: 12, fontSize: "0.75rem", color: "#64748b", marginTop: 6 }}>
                            {t.estimatedHours && <span>⏱️ {t.estimatedHours} hrs</span>}
                            {t.plannedStartDate && <span>🗓️ {t.plannedStartDate} → {t.plannedCompletionDate || "TBD"}</span>}
                            {t.learningObjectives?.length > 0 && <span>🎯 {t.learningObjectives.length} objectives</span>}
                            {t.learningResources?.length > 0 && <span>🔗 {t.learningResources.length} resources</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="tsm-modal-footer">
          <button type="button" className="tsm-btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
