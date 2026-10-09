import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { getAllPapers, togglePaperPractice } from "../../services/paperService";
import { getMySubjects } from "../../services/evaluationService";
import "./PracticePaperPermission.css";

function PracticePaperPermission() {
  const navigate = useNavigate();
  const teacherEmail = localStorage.getItem("email") || "";
  const teacherName = localStorage.getItem("name") || "Faculty";

  const [papers, setPapers] = useState([]);
  const [assignedSubjects, setAssignedSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [paperSemesters, setPaperSemesters] = useState({});
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allPapers, subjData] = await Promise.all([
        getAllPapers(),
        teacherEmail ? getMySubjects(teacherEmail).catch(() => null) : null,
      ]);

      const mySubs = subjData?.assignedSubjects || [];
      const isTeacherAdmin = subjData?.role === "ADMIN" || localStorage.getItem("role") === "ADMIN";
      setAssignedSubjects(mySubs);

      // Filter papers strictly to the teacher's assigned subjects
      let teacherPapers = allPapers || [];
      if (!isTeacherAdmin && mySubs.length > 0) {
        teacherPapers = teacherPapers.filter((p) => {
          const pSubj = (p.subject || "").toLowerCase();
          const pCode = (p.subjectCode || "").toLowerCase();
          return mySubs.some((sub) => {
            const s = sub.toLowerCase();
            return pSubj.includes(s) || s.includes(pSubj) || pCode.includes(s) || s.includes(pCode);
          });
        });
      }

      setPapers(teacherPapers);

      // Initial semester map
      const semMap = {};
      teacherPapers.forEach((p) => {
        semMap[p.paperId] = p.assignedSemester || p.semester || "ALL";
      });
      setPaperSemesters(semMap);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load your subject papers");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (paper) => {
    const currentStatus = paper.allowedForPractice === true || paper.paperCategory === "PRACTICE";
    const targetStatus = !currentStatus;
    const assignedSem = paperSemesters[paper.paperId] || paper.assignedSemester || paper.semester || "ALL";

    try {
      setUpdatingId(paper.paperId);
      await togglePaperPractice(paper.paperId, targetStatus, assignedSem);

      setPapers((prev) =>
        prev.map((p) =>
          p.paperId === paper.paperId
            ? { ...p, allowedForPractice: targetStatus, assignedSemester: assignedSem }
            : p
        )
      );

      if (targetStatus) {
        toast.success(`Practice enabled for "${paper.subject}" (Target: Sem ${assignedSem})`);
      } else {
        toast.success(`Practice disabled for "${paper.subject}"`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to update practice permission");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSemesterChange = (paperId, semVal) => {
    setPaperSemesters((prev) => ({ ...prev, [paperId]: semVal }));
  };

  const filteredPapers = papers.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (p.subject || "").toLowerCase().includes(q) ||
      (p.subjectCode || "").toLowerCase().includes(q) ||
      (p.paperId || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="practice-perm-page">
      <div className="practice-perm-topbar">
        <button className="back-btn" onClick={() => navigate("/teacher/manage-papers")}>
          ← Back To Manage Papers
        </button>
      </div>

      <div className="practice-perm-header">
        <div className="header-info">
          <h1>🎯 Practice Paper Permission Manager</h1>
          <p>
            Grant student permission to practice your subject question papers. Students can retake enabled
            papers, self-grade, and perform peer reviews with classmates.
          </p>
        </div>

        {assignedSubjects.length > 0 && (
          <div className="teacher-subjects-pillbox">
            <span className="sub-label">Your Allocated Teaching Subjects:</span>
            <div className="sub-tags">
              {assignedSubjects.map((s, idx) => (
                <span className="subject-tag" key={idx}>
                  📚 {s}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Search & Filter Toolbar */}
      <div className="perm-toolbar">
        <div className="perm-search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search your subject papers by title, code, or paper ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-btn" onClick={() => setSearchQuery("")}>
              ✕
            </button>
          )}
        </div>
        <span className="paper-count-badge">{filteredPapers.length} Subject Papers Available</span>
      </div>

      {loading ? (
        <div className="perm-loading-state">
          <div className="spinner"></div>
          <p>Loading your subject question papers and permissions...</p>
        </div>
      ) : filteredPapers.length === 0 ? (
        <div className="perm-empty-state">
          <span className="empty-icon">📂</span>
          <h3>No Question Papers Found For Your Assigned Subjects</h3>
          <p>
            {searchQuery
              ? `No papers match "${searchQuery}". Try a different search term.`
              : "You haven't uploaded or created question papers for your assigned subjects yet."}
          </p>
          <button className="create-paper-btn" onClick={() => navigate("/teacher/create-paper")}>
            ✍️ Create New Question Paper
          </button>
        </div>
      ) : (
        <div className="perm-papers-list">
          {filteredPapers.map((paper) => {
            const isPracticeAllowed = paper.allowedForPractice === true || paper.paperCategory === "PRACTICE";
            const currentSem = paperSemesters[paper.paperId] || paper.assignedSemester || paper.semester || "ALL";
            const isUpdating = updatingId === paper.paperId;

            return (
              <div
                className={`perm-paper-row ${isPracticeAllowed ? "enabled-row" : "disabled-row"}`}
                key={paper.paperId}
              >
                {/* Left: Paper Info */}
                <div className="perm-info-cell">
                  <div className="perm-badge-cluster">
                    <span className="perm-code-pill">{paper.subjectCode || paper.paperId}</span>
                    <span className={`perm-cat-pill ${paper.paperFormat === "MCQ" ? "mcq" : "theory"}`}>
                      {paper.paperFormat === "MCQ" ? "🎯 MCQ Quiz" : "📑 Theory Exam"}
                    </span>
                    <span className={`perm-status-indicator ${isPracticeAllowed ? "active" : "inactive"}`}>
                      {isPracticeAllowed ? "🟢 Practice Enabled" : "⚪ Exam Only (Practice Disabled)"}
                    </span>
                  </div>

                  <h3 className="perm-subject-title">{paper.subject}</h3>
                  <div className="perm-submeta">
                    <span>Paper ID: {paper.paperId}</span>
                    <span> • Max Marks: {paper.maxMarks || paper.totalMarks || 40} M</span>
                    <span> • Questions: {paper.questions?.length || 0} Qs</span>
                  </div>
                </div>

                {/* Middle: Target Semester Selector */}
                <div className="perm-sem-cell">
                  <label className="sem-select-label">Target Student Semester:</label>
                  <select
                    className="perm-sem-select"
                    value={currentSem}
                    onChange={(e) => handleSemesterChange(paper.paperId, e.target.value)}
                  >
                    <option value="ALL">All Semesters</option>
                    <option value="1">Semester 1 (1st Year)</option>
                    <option value="2">Semester 2 (1st Year)</option>
                    <option value="3">Semester 3 (2nd Year)</option>
                    <option value="4">Semester 4 (2nd Year)</option>
                    <option value="5">Semester 5 (3rd Year)</option>
                    <option value="6">Semester 6 (3rd Year)</option>
                    <option value="7">Semester 7 (4th Year)</option>
                    <option value="8">Semester 8 (4th Year)</option>
                  </select>
                </div>

                {/* Right: Permission Toggle Button */}
                <div className="perm-action-cell">
                  <button
                    className={`perm-toggle-btn ${isPracticeAllowed ? "revoke-btn" : "grant-btn"}`}
                    onClick={() => handleToggle(paper)}
                    disabled={isUpdating}
                  >
                    {isUpdating ? (
                      "⏳ Updating..."
                    ) : isPracticeAllowed ? (
                      "🔒 Revoke Practice Access"
                    ) : (
                      "✅ Allow Student Practice"
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default PracticePaperPermission;
