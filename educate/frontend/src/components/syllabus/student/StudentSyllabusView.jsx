import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import {
  getPublishedVersions,
  getPublishedVersion,
  getMyRevisions,
  updateMyRevision,
  getMyRevisionSummary,
} from "../../../services/syllabusService";

import StudentPublishedSyllabusSection from "./StudentPublishedSyllabusSection";
import StudentMyRevisionSection from "./StudentMyRevisionSection";
import StudentRevisionHistorySection from "./StudentRevisionHistorySection";
import StudentAssessmentInsightsSection from "./StudentAssessmentInsightsSection";
import StudentTeachingScheduleSection from "./StudentTeachingScheduleSection";

import "./StudentSyllabus.css";

export default function StudentSyllabusView({ classroomId }) {
  // Navigation: "syllabus" | "revisions" | "history" | "assessment"
  const [activeSection, setActiveSection] = useState("syllabus");

  const [versions, setVersions] = useState([]);
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [currentVersionData, setCurrentVersionData] = useState(null);
  const [revisions, setRevisions] = useState([]);
  const [summary, setSummary] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 1. Load Versions on Classroom Change
  useEffect(() => {
    let active = true;
    if (classroomId) {
      getPublishedVersions(classroomId)
        .then((vers) => {
          if (!active) return;
          const sorted = (vers || []).sort((a, b) => (b.versionNumber || 0) - (a.versionNumber || 0));
          setVersions(sorted);
          if (sorted.length > 0) {
            setSelectedVersionId(sorted[0].id);
          } else {
            setSelectedVersionId("");
            setLoading(false);
          }
        })
        .catch((err) => {
          console.error(err);
          if (active) {
            setError("Failed to load classroom syllabus versions");
            setLoading(false);
          }
        });
    }

    return () => {
      active = false;
    };
  }, [classroomId]);

  // 2. Load Topics, Student Revisions & Summary when selectedVersionId changes
  useEffect(() => {
    let active = true;
    if (classroomId && selectedVersionId) {
      Promise.allSettled([
        getPublishedVersion(classroomId, selectedVersionId),
        getMyRevisions(classroomId, selectedVersionId),
        getMyRevisionSummary(classroomId, selectedVersionId),
      ]).then(([versionRes, revisionsRes, summaryRes]) => {
        if (!active) return;
        if (versionRes.status === "fulfilled") {
          setCurrentVersionData(versionRes.value);
        } else {
          console.error("Failed to fetch version details:", versionRes.reason);
          setCurrentVersionData(null);
        }

        if (revisionsRes.status === "fulfilled") {
          setRevisions(revisionsRes.value || []);
        } else {
          setRevisions([]);
        }

        if (summaryRes.status === "fulfilled") {
          setSummary(summaryRes.value || null);
        } else {
          setSummary(null);
        }

        setLoading(false);
      }).catch((err) => {
        console.error(err);
        if (active) {
          setError("Failed to load published version data");
          setLoading(false);
        }
      });
    }

    return () => {
      active = false;
    };
  }, [classroomId, selectedVersionId]);

  // Handle Personal Revision Update
  const handleUpdateRevision = async (topicId, payload) => {
    if (!selectedVersionId) return;

    try {
      const updated = await updateMyRevision(classroomId, selectedVersionId, topicId, payload);
      toast.success("Revision progress updated!");

      // Optimistically update revision entry in list
      setRevisions((prev) => {
        const idx = prev.findIndex((r) => r.topicId === topicId);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = updated;
          return next;
        }
        return [...prev, updated];
      });

      // Silently refresh summary
      getMyRevisionSummary(classroomId, selectedVersionId)
        .then((s) => setSummary(s))
        .catch(() => {});
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to update revision status");
      throw err;
    }
  };

  const topics = currentVersionData?.topics || [];

  return (
    <div className="ssm-container">
      {/* NAVIGATION BAR */}
      <div className="ssm-header-nav">
        <div className="ssm-subtabs-group">
          <button
            type="button"
            className={`ssm-subtab-btn ${activeSection === "syllabus" ? "active" : ""}`}
            onClick={() => setActiveSection("syllabus")}
          >
            📖 Published Syllabus ({topics.length})
          </button>

          <button
            type="button"
            className={`ssm-subtab-btn ${activeSection === "revisions" ? "active" : ""}`}
            onClick={() => setActiveSection("revisions")}
          >
            🎯 My Revision
            {summary?.revisionPercentage !== undefined && (
              <span
                style={{
                  background: "rgba(52, 211, 153, 0.2)",
                  color: "#34d399",
                  padding: "1px 6px",
                  borderRadius: 6,
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  marginLeft: 4,
                }}
              >
                {Math.round(summary.revisionPercentage)}%
              </span>
            )}
          </button>

          <button
            type="button"
            className={`ssm-subtab-btn ${activeSection === "schedule" ? "active" : ""}`}
            onClick={() => setActiveSection("schedule")}
          >
            🗓️ Schedule & Modules
          </button>

          <button
            type="button"
            className={`ssm-subtab-btn ${activeSection === "history" ? "active" : ""}`}
            onClick={() => setActiveSection("history")}
          >
            📜 Revision History
          </button>

          <button
            type="button"
            className={`ssm-subtab-btn ${activeSection === "assessment" ? "active" : ""}`}
            onClick={() => setActiveSection("assessment")}
          >
            📊 Assessment Connections
          </button>
        </div>

        {/* VERSION SELECTOR (IF MULTIPLE VERSIONS EXIST) */}
        {versions.length > 0 && (
          <div className="ssm-version-picker-cluster">
            <label style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Viewing:</label>
            <select
              className="ssm-version-select"
              value={selectedVersionId}
              onChange={(e) => setSelectedVersionId(e.target.value)}
            >
              {versions.map((ver, idx) => (
                <option key={ver.id} value={ver.id}>
                  v{ver.versionNumber}: {ver.versionTitle || `Version ${ver.versionNumber}`}
                  {idx === 0 ? " (Latest)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* CONTENT BODY */}
      {loading ? (
        <div className="ssm-loading-container">
          <div className="ssm-spinner"></div>
          <p>Loading course syllabus and your personal revision records...</p>
        </div>
      ) : error ? (
        <div className="ssm-empty-state">
          <p style={{ color: "#f87171" }}>{error}</p>
        </div>
      ) : activeSection === "schedule" ? (
        <StudentTeachingScheduleSection classroomId={classroomId} />
      ) : versions.length === 0 ? (
        <div className="ssm-empty-state">
          <div className="ssm-empty-icon">📭</div>
          <h3>No Published Syllabus Yet</h3>
          <p>
            Your course faculty has not published an official syllabus version for this classroom yet.
            Once a syllabus is published, you will be able to review learning objectives, access course study links, and track your revision progress here.
          </p>
        </div>
      ) : (
        <>
          {activeSection === "syllabus" && (
            <StudentPublishedSyllabusSection
              topics={topics}
              revisions={revisions}
              onQuickUpdateRevision={handleUpdateRevision}
            />
          )}

          {activeSection === "revisions" && (
            <StudentMyRevisionSection
              topics={topics}
              revisions={revisions}
              summary={summary}
              onUpdateRevision={handleUpdateRevision}
            />
          )}

          {activeSection === "history" && (
            <StudentRevisionHistorySection
              classroomId={classroomId}
              topics={topics}
              versions={versions}
            />
          )}

          {activeSection === "assessment" && (
            <StudentAssessmentInsightsSection
              classroomId={classroomId}
              topics={topics}
            />
          )}
        </>
      )}
    </div>
  );
}
