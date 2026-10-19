export default function SyllabusPublishingSection({
  versions = [],
  items = [],
  onOpenPublishModal,
  onViewSnapshot,
}) {
  const latestVersion = versions.length > 0 ? versions[0] : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* CURRENT DRAFT STATUS CARD */}
      <div className="tsm-card">
        <div className="tsm-card-header">
          <div>
            <h3 className="tsm-card-title">📝 Current Draft Syllabus</h3>
            <div className="tsm-card-subtitle">
              Active working copy for instructors • {items.length} topics currently configured
            </div>
          </div>

          <button
            type="button"
            className="tsm-btn-primary"
            onClick={onOpenPublishModal}
            disabled={items.length === 0}
          >
            🚀 {latestVersion ? "Publish New Version" : "Publish Initial Version (v1)"}
          </button>
        </div>

        <div
          style={{
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            borderRadius: 12,
            padding: "16px 20px",
            fontSize: "0.85rem",
            color: "#cbd5e1",
            lineHeight: 1.5,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span className="tsm-badge tsm-badge-in-progress">Live Working Draft</span>
            <span style={{ color: "#94a3b8" }}>
              Contains <strong>{items.length}</strong> topics across{" "}
              <strong>{new Set(items.map((i) => i.unit)).size}</strong> units
            </span>
          </div>
          <p style={{ margin: 0, color: "#94a3b8" }}>
            When you publish, a snapshot of all current topics, learning objectives, dates, and resources is archived as an official version.
            Enrolled students are notified and their personal revision progress tracker synchronizes with the newly published version.
          </p>
        </div>
      </div>

      {/* PUBLISHED VERSIONS HISTORY CARD */}
      <div className="tsm-card">
        <div className="tsm-card-header">
          <div>
            <h3 className="tsm-card-title">📜 Published Version History ({versions.length})</h3>
            <div className="tsm-card-subtitle">
              Audited historical snapshots preserved permanently
            </div>
          </div>
        </div>

        {versions.length === 0 ? (
          <div className="tsm-empty-state">
            <div className="tsm-empty-icon">📭</div>
            <h4>No versions published yet</h4>
            <p>
              This classroom is currently running on draft mode. Publish your first version to create an official syllabus snapshot for students.
            </p>
            {items.length > 0 && (
              <button type="button" className="tsm-btn-primary" onClick={onOpenPublishModal}>
                Publish v1 Now
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {versions.map((ver, idx) => {
              const isLatest = idx === 0;

              return (
                <div key={ver.id} className="tsm-version-card">
                  <div className="tsm-version-left">
                    <div className="tsm-version-pill">v{ver.versionNumber}</div>

                    <div className="tsm-version-details">
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span className="tsm-version-title">{ver.versionTitle}</span>
                        {isLatest && <span className="tsm-badge tsm-badge-published">Active Release</span>}
                        <span className="tsm-badge tsm-badge-unscheduled">{ver.topicCount} topics</span>
                      </div>

                      {ver.changeSummary && (
                        <div className="tsm-version-summary">
                          &ldquo;{ver.changeSummary}&rdquo;
                        </div>
                      )}

                      <div className="tsm-version-meta">
                        <span>
                          📅 Published: {ver.publishedAt ? new Date(ver.publishedAt).toLocaleString() : "Unknown"}
                        </span>
                        <span>👤 Publisher: {ver.publishedBy || "Instructor"}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      type="button"
                      className="tsm-btn-secondary"
                      onClick={() => onViewSnapshot(ver.id)}
                    >
                      🔍 View Snapshot
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
