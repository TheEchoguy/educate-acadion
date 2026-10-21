import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import {
  getStudentSchedule,
  getStudentModules,
  downloadStudentModule,
} from "../../../services/syllabusSchedulingService";

export default function StudentTeachingScheduleSection({ classroomId }) {
  const [schedulePlan, setSchedulePlan] = useState(null);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (classroomId) {
      Promise.allSettled([
        getStudentSchedule(classroomId),
        getStudentModules(classroomId),
      ]).then(([schedRes, modRes]) => {
        if (!active) return;
        if (schedRes.status === "fulfilled") setSchedulePlan(schedRes.value || null);
        if (modRes.status === "fulfilled") setModules(modRes.value || []);
        setLoading(false);
      }).catch((err) => {
        console.error(err);
        if (active) setLoading(false);
      });
    }

    return () => {
      active = false;
    };
  }, [classroomId]);

  const handleDownload = async (doc) => {
    try {
      await downloadStudentModule(classroomId, doc.id, doc.originalFileName);
      toast.success("Downloading " + doc.originalFileName);
    } catch (err) {
      console.error(err);
      toast.error("Failed to download study material");
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>
        <div className="spinner" style={{ margin: "0 auto 10px auto" }}></div>
        <p>Loading course schedule and published module PDFs...</p>
      </div>
    );
  }

  const sessions = schedulePlan?.sessions || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* 1. PUBLISHED MODULE STUDY MATERIALS */}
      <div
        style={{
          background: "rgba(26, 32, 58, 0.75)",
          border: "1px solid rgba(139, 92, 246, 0.25)",
          borderRadius: 16,
          padding: "24px",
        }}
      >
        <h3 style={{ margin: "0 0 6px 0", color: "#ffffff", fontSize: "1.2rem" }}>
          📚 Official Module Study Materials & Notes ({modules.length})
        </h3>
        <p style={{ margin: "0 0 16px 0", color: "#94a3b8", fontSize: "0.85rem" }}>
          Course study materials approved and published by your instructor for download.
        </p>

        {modules.length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: "0.88rem" }}>
            No module materials published yet for this course. Your instructor will publish module PDFs as lectures progress.
          </p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {modules.map((m) => (
              <div
                key={m.id}
                style={{
                  background: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 12,
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "#c084fc", background: "rgba(139, 92, 246, 0.15)", padding: "2px 8px", borderRadius: 4 }}>
                      {m.moduleNumber ? `Module ${m.moduleNumber}` : "Resource"}
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                      {Math.round(m.fileSize / 1024)} KB
                    </span>
                  </div>
                  <h4 style={{ margin: "4px 0", fontSize: "1rem", color: "#ffffff", fontWeight: 700 }}>
                    {m.moduleTitle || m.originalFileName}
                  </h4>
                  <p style={{ margin: 0, fontSize: "0.78rem", color: "#94a3b8" }}>
                    File: {m.originalFileName}
                  </p>
                </div>

                <button
                  type="button"
                  className="tsm-btn-export"
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={() => handleDownload(m)}
                >
                  📥 Download Study PDF
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. APPROVED TEACHING SCHEDULE */}
      <div
        style={{
          background: "rgba(26, 32, 58, 0.75)",
          border: "1px solid rgba(56, 189, 248, 0.25)",
          borderRadius: 16,
          padding: "24px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: "0 0 4px 0", color: "#ffffff", fontSize: "1.2rem" }}>
              🗓️ Approved Course Teaching Schedule
            </h3>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.85rem" }}>
              {schedulePlan ? (
                <>Plan: <strong>{schedulePlan.planTitle}</strong> • {schedulePlan.termStartDate} to {schedulePlan.termEndDate}</>
              ) : (
                "Your instructor has not published a finalized teaching schedule yet."
              )}
            </p>
          </div>
          {schedulePlan && (
            <span style={{ background: "rgba(16, 185, 129, 0.15)", color: "#34d399", padding: "4px 12px", borderRadius: 20, fontSize: "0.82rem", fontWeight: 700 }}>
              {schedulePlan.completedSessions} / {schedulePlan.totalPlannedSessions} Classes Completed
            </span>
          )}
        </div>

        {sessions.length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: "0.88rem" }}>
            No scheduled lecture dates available yet. Check back once your instructor publishes the course calendar.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 500, overflowY: "auto" }}>
            {sessions.map((s) => (
              <div
                key={s.id}
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  borderRadius: 10,
                  padding: "12px 16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ textAlign: "center", minWidth: 55 }}>
                    <span style={{ display: "block", fontSize: "0.72rem", color: "#a78bfa", textTransform: "uppercase" }}>
                      {s.dayOfWeek?.slice(0, 3)}
                    </span>
                    <span style={{ display: "block", fontSize: "1rem", fontWeight: 800, color: "#ffffff" }}>
                      {s.sessionDate ? s.sessionDate.split("-")[2] : ""}
                    </span>
                    <span style={{ display: "block", fontSize: "0.68rem", color: "#94a3b8" }}>
                      {s.sessionDate ? new Date(s.sessionDate).toLocaleString("default", { month: "short" }) : ""}
                    </span>
                  </div>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                        {s.startTime} - {s.endTime}
                      </span>
                      <span style={{ fontSize: "0.75rem", color: "#38bdf8" }}>
                        {s.roomNumber ? `Room ${s.roomNumber}` : "Main Classroom"}
                      </span>
                      <span style={{ fontSize: "0.75rem", color: "#c084fc" }}>
                        Module {s.moduleNumber}
                      </span>
                      {s.milestoneTag && (
                        <span style={{ fontSize: "0.72rem", color: "#fbbf24", background: "rgba(245, 158, 11, 0.15)", padding: "1px 6px", borderRadius: 4 }}>
                          🎯 {s.milestoneTag}
                        </span>
                      )}
                    </div>
                    <div style={{ color: "#ffffff", fontWeight: 600, fontSize: "0.92rem" }}>
                      #{s.sessionNumber}: {s.topicTitle}
                    </div>
                    {s.subtopic && (
                      <div style={{ color: "#94a3b8", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                        <span>↳ {s.subtopic}</span>
                        {s.subtopicSource && s.subtopicSource !== "OFFICIAL_SYLLABUS" && (
                          <span style={{ fontSize: "0.68rem", padding: "1px 6px", borderRadius: 4, background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa" }}>
                            {s.subtopicSource === "AI_GENERATED" ? "AI Focus" : s.subtopicSource === "TEACHER_EDITED" ? "Teacher Focus" : s.subtopicSource === "TEACHER_REVIEW_SUGGESTION" ? "Suggested Focus" : "Learning Focus"}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <span
                  className={`tsm-badge-${s.status === "COMPLETED" ? "completed" : s.status === "SKIPPED" ? "overdue" : "not-started"}`}
                  style={{ fontSize: "0.75rem", padding: "3px 8px", borderRadius: 4 }}
                >
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
