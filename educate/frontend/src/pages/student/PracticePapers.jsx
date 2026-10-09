import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { getAllPapers } from "../../services/paperService";
import {
  getStudentResults,
  selfEvaluateResponse,
  peerEvaluateResponse,
  assignPeerReview,
  getClassmates,
} from "../../services/responseService";
import { getAllResponses } from "../../services/evaluationService";
import { exportEvaluatedSubmissionPdf } from "../../utils/pdfGenerator";
import "./PracticePapers.css";

function PracticePapers() {
  const navigate = useNavigate();
  const usn = localStorage.getItem("usn") || "";
  const studentName = localStorage.getItem("name") || "Student";
  const studentSem = localStorage.getItem("semester") || "6";

  const [activeTab, setActiveTab] = useState("PRACTICE_LIST"); // PRACTICE_LIST, MY_ATTEMPTS, PEER_REVIEWS
  const [practicePapers, setPracticePapers] = useState([]);
  const [mySubmissions, setMySubmissions] = useState([]);
  const [allClassSubmissions, setAllClassSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Self Evaluation Modal State
  const [selfEvalTarget, setSelfEvalTarget] = useState(null);
  const [selfScores, setSelfScores] = useState({});
  const [selfFeedbacks, setSelfFeedbacks] = useState({});
  const [selfSaving, setSelfSaving] = useState(false);

  // Assign Friend Modal State
  const [assignTarget, setAssignTarget] = useState(null);
  const [friendUsn, setFriendUsn] = useState("");
  const [friendName, setFriendName] = useState("");
  const [classmates, setClassmates] = useState([]);
  const [classmateSearch, setClassmateSearch] = useState("");
  const [loadingClassmates, setLoadingClassmates] = useState(false);
  const [assignSaving, setAssignSaving] = useState(false);

  // Peer Evaluation Modal State
  const [peerEvalTarget, setPeerEvalTarget] = useState(null);
  const [peerScores, setPeerScores] = useState({});
  const [peerFeedbacks, setPeerFeedbacks] = useState({});
  const [peerOverallFeedback, setPeerOverallFeedback] = useState("");
  const [peerSaving, setPeerSaving] = useState(false);

  const [selectedSemester, setSelectedSemester] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchPracticeData();
  }, []);

  const fetchPracticeData = async () => {
    try {
      setLoading(true);
      const papers = await getAllPapers();
      // STRICT FILTER: Papers allowed for practice by teacher or with category PRACTICE
      const practiceList = (papers || []).filter(
        (p) => p.allowedForPractice === true || p.paperCategory === "PRACTICE"
      );
      setPracticePapers(practiceList);

      if (usn) {
        const results = await getStudentResults(usn);
        // STRICT FILTER: Only practice attempts taken in practice sessions
        const practiceAttempts = (results || []).filter(
          (r) =>
            r.isPractice === true ||
            r.submissionMode === "PRACTICE" ||
            r.paperCategory === "PRACTICE" ||
            r.evaluationMode === "SELF" ||
            r.evaluationMode === "PEER"
        );
        setMySubmissions(practiceAttempts);
      }

      try {
        const allResp = await getAllResponses();
        const practiceClassResp = (allResp || []).filter(
          (r) =>
            r.isPractice === true ||
            r.submissionMode === "PRACTICE" ||
            r.paperCategory === "PRACTICE" ||
            r.evaluationMode === "SELF" ||
            r.evaluationMode === "PEER" ||
            Boolean(r.assignedPeerUsn)
        );
        setAllClassSubmissions(practiceClassResp);
      } catch (e) {}
    } catch (error) {
      console.error(error);
      toast.error("Failed to load practice workspace");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = (sub) => {
    try {
      const matchedPaper = practicePapers.find(
        (p) => p.paperId?.toLowerCase() === sub.paperId?.toLowerCase()
      );
      const studentInfo = {
        name: localStorage.getItem("name") || studentName,
        usn: localStorage.getItem("usn") || usn,
        department: localStorage.getItem("department") || "Computer Science",
      };
      exportEvaluatedSubmissionPdf(
        sub,
        studentInfo,
        matchedPaper?.questions || sub.responses || []
      );
      toast.success(`Practice Answer Paper PDF downloaded for ${sub.paperId}!`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF");
    }
  };

  // Filter practice papers by semester & search
  const filteredPracticePapers = practicePapers.filter((p) => {
    // Semester match
    if (selectedSemester !== "ALL") {
      const semStr = (p.assignedSemester || p.semester || "").toLowerCase();
      const targetSem = selectedSemester.toLowerCase().replace("sem ", "").replace("sem", "").trim();
      if (!semStr.includes(targetSem)) return false;
    }
    // Search match
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const subj = (p.subject || "").toLowerCase();
      const code = (p.subjectCode || "").toLowerCase();
      const pid = (p.paperId || "").toLowerCase();
      return subj.includes(q) || code.includes(q) || pid.includes(q);
    }
    return true;
  });

  // Self Evaluation Handlers
  const handleOpenSelfEval = (submission) => {
    setSelfEvalTarget(submission);
    const initialScores = {};
    const initialFb = {};
    submission.responses?.forEach((r) => {
      initialScores[r.questionId] = r.marksObtained != null ? r.marksObtained : r.maxMarks || 5;
      initialFb[r.questionId] = r.feedback || "";
    });
    setSelfScores(initialScores);
    setSelfFeedbacks(initialFb);
  };

  const handleSaveSelfEval = async () => {
    if (!selfEvalTarget) return;
    try {
      setSelfSaving(true);
      const scoreList = Object.entries(selfScores).map(([qId, marks]) => ({
        questionId: qId,
        marksObtained: Number(marks),
        feedback: selfFeedbacks[qId] || "Self graded",
      }));

      await selfEvaluateResponse(selfEvalTarget.id, scoreList);
      toast.success("Self-evaluation recorded successfully!");
      setSelfEvalTarget(null);
      fetchPracticeData();
    } catch (err) {
      toast.error("Failed to save self-evaluation");
    } finally {
      setSelfSaving(false);
    }
  };

  // Assign Friend Handlers
  const handleOpenAssignFriend = async (submission) => {
    setAssignTarget(submission);
    setFriendUsn(submission.assignedPeerUsn || "");
    setFriendName(submission.assignedPeerName || "");
    setClassmateSearch("");
    try {
      setLoadingClassmates(true);
      const data = await getClassmates(studentSem, usn);
      setClassmates(data || []);
    } catch (e) {
      console.error("Failed to load classmates", e);
    } finally {
      setLoadingClassmates(false);
    }
  };

  const handleSaveAssignFriend = async () => {
    if (!assignTarget) return;
    if (!friendUsn.trim()) {
      toast.error("Please enter your friend's USN / Roll Number");
      return;
    }
    if (friendUsn.trim().toLowerCase() === usn.toLowerCase()) {
      toast.error("You cannot assign peer review to yourself. Use 'Self Check' instead.");
      return;
    }
    try {
      setAssignSaving(true);
      await assignPeerReview(assignTarget.id, friendUsn.trim(), friendName.trim() || friendUsn.trim());
      toast.success(`Assigned paper to ${friendName || friendUsn} for peer review!`);
      setAssignTarget(null);
      fetchPracticeData();
    } catch (err) {
      toast.error("Failed to assign paper to friend");
    } finally {
      setAssignSaving(false);
    }
  };

  // Peer Evaluation Handlers
  const handleOpenPeerEval = (submission) => {
    setPeerEvalTarget(submission);
    const initialScores = {};
    const initialFb = {};
    submission.responses?.forEach((r) => {
      initialScores[r.questionId] = r.marksObtained != null ? r.marksObtained : r.maxMarks || 5;
      initialFb[r.questionId] = r.feedback || "";
    });
    setPeerScores(initialScores);
    setPeerFeedbacks(initialFb);
    setPeerOverallFeedback("");
  };

  const handleSavePeerEval = async () => {
    if (!peerEvalTarget) return;
    try {
      setPeerSaving(true);
      const scoreList = Object.entries(peerScores).map(([qId, marks]) => ({
        questionId: qId,
        marksObtained: Number(marks),
        feedback: peerFeedbacks[qId] || "Good attempt",
      }));

      const payload = {
        peerUsn: usn,
        peerName: studentName,
        peerFeedback: peerOverallFeedback || "Reviewed and graded by classmate.",
        scores: scoreList,
      };

      await peerEvaluateResponse(peerEvalTarget.id, payload);
      toast.success(`Peer evaluation saved for ${peerEvalTarget.usn}!`);
      setPeerEvalTarget(null);
      fetchPracticeData();
    } catch (err) {
      toast.error("Failed to save peer evaluation");
    } finally {
      setPeerSaving(false);
    }
  };

  // Filter papers assigned specifically to current student
  const myAssignedPeerPapers = allClassSubmissions.filter((r) => {
    if (r.usn?.toLowerCase() === usn.toLowerCase()) return false;
    return r.assignedPeerUsn && r.assignedPeerUsn.toLowerCase() === usn.toLowerCase();
  });

  return (
    <div className="practice-page">
      <div className="practice-top-bar">
        <button className="back-btn" onClick={() => navigate("/student/dashboard")}>
          ← Back To Dashboard
        </button>
      </div>

      <div className="practice-header-card">
        <div className="header-left">
          <h1>🎯 Practice Papers & Peer Learning</h1>
          <p>
            Retake practice papers as many times as you like, self-grade your answers, exchange papers strictly with assigned friends for peer review, and download your evaluated PDF answer papers!
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="practice-tabs">
          <button
            className={`tab-btn ${activeTab === "PRACTICE_LIST" ? "active" : ""}`}
            onClick={() => setActiveTab("PRACTICE_LIST")}
          >
            📚 Practice Papers ({practicePapers.length})
          </button>
          <button
            className={`tab-btn ${activeTab === "MY_ATTEMPTS" ? "active" : ""}`}
            onClick={() => setActiveTab("MY_ATTEMPTS")}
          >
            📊 My Attempts & Assignments ({mySubmissions.length})
          </button>
          <button
            className={`tab-btn ${activeTab === "PEER_REVIEWS" ? "active" : ""}`}
            onClick={() => setActiveTab("PEER_REVIEWS")}
          >
            👥 Friends Assigned to Me ({myAssignedPeerPapers.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="practice-loading-card">Loading practice library...</div>
      ) : (
        <>
          {/* TAB 1: PRACTICE PAPERS LIST */}
          {activeTab === "PRACTICE_LIST" && (
            <>
              {/* Semester & Search Controls */}
              <div className="practice-controls-row">
                <div className="practice-search-box">
                  <span className="search-icon">🔍</span>
                  <input
                    type="text"
                    placeholder="Search practice papers by subject or code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="practice-search-input"
                  />
                  {searchQuery && (
                    <button className="clear-search-btn" onClick={() => setSearchQuery("")}>✕</button>
                  )}
                </div>

                <div className="semester-pill-group">
                  {["ALL", "Sem 1", "Sem 2", "Sem 3", "Sem 4", "Sem 5", "Sem 6", "Sem 7", "Sem 8"].map((sem) => (
                    <button
                      key={sem}
                      className={`sem-filter-pill ${selectedSemester === sem ? "active" : ""}`}
                      onClick={() => setSelectedSemester(sem)}
                    >
                      {sem}
                    </button>
                  ))}
                </div>
              </div>

              {filteredPracticePapers.length === 0 ? (
                <div className="empty-practice-card">
                  <div className="empty-icon">📚</div>
                  <h3>No Practice Papers Available</h3>
                  <p>
                    {selectedSemester !== "ALL"
                      ? `Faculty has not assigned any practice papers for ${selectedSemester} yet.`
                      : "No question papers have been assigned for practice by teachers yet. Once your subject teacher enables practice permissions, they will appear here."}
                  </p>
                </div>
              ) : (
                <div className="practice-grid">
                  {filteredPracticePapers.map((paper) => {
                    const attempts = mySubmissions.filter(
                      (s) => s.paperId?.toLowerCase() === paper.paperId?.toLowerCase()
                    );
                    const latestSubmission = attempts[attempts.length - 1];

                    return (
                      <div className="practice-card" key={paper.paperId}>
                        <div className="practice-card-header">
                          <span className="paper-cat-badge">
                            {paper.paperCategory === "QUIZ" ? "🔘 MCQ Quiz" : "🎯 Practice Paper"}
                          </span>
                          {attempts.length > 0 && (
                            <span className="attempt-counter-tag">
                              {attempts.length} {attempts.length === 1 ? "Attempt" : "Attempts"} Taken
                            </span>
                          )}
                        </div>

                        <h2 className="practice-subj-title">{paper.subject}</h2>

                        <div className="practice-meta-grid">
                          <div className="p-tile">
                            <small>Format</small>
                            <strong>{paper.paperFormat || "Theory & MCQ"}</strong>
                          </div>
                          <div className="p-tile">
                            <small>Total Questions</small>
                            <strong>{paper.questions?.length || 0} Qs</strong>
                          </div>
                          <div className="p-tile">
                            <small>Max Score</small>
                            <strong>{paper.maxMarks || 40} Marks</strong>
                          </div>
                          <div className="p-tile">
                            <small>Retakes</small>
                            <strong style={{ color: "#34d399" }}>Unlimited</strong>
                          </div>
                        </div>

                        {latestSubmission && (
                          <div className="latest-attempt-banner">
                            <span>Latest Score:</span>
                            <strong>
                              {latestSubmission.totalMarks != null ? latestSubmission.totalMarks : 0} /{" "}
                              {latestSubmission.maxMarks || paper.maxMarks || 40} M
                            </strong>
                          </div>
                        )}

                        <button
                          className="practice-now-btn"
                          onClick={() => navigate(`/student/attend/${paper.paperId}?mode=practice`)}
                        >
                          {attempts.length > 0 ? "🔁 Practice Again (Retake)" : "🎯 Start Practice Paper"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* TAB 2: MY ATTEMPTS & SELF EVALUATION / ASSIGN FRIEND */}
          {activeTab === "MY_ATTEMPTS" && (
            <div className="attempts-table-container">
              {mySubmissions.length === 0 ? (
                <div className="empty-state-box">
                  <h3>No Practice Attempts Yet</h3>
                  <p>Start a practice paper to build your mastery, self-grade answers, and download PDFs.</p>
                </div>
              ) : (
                <table className="practice-table">
                  <thead>
                    <tr>
                      <th>Paper ID & Subject</th>
                      <th>Attempt #</th>
                      <th>Submitted At</th>
                      <th>Score / Max</th>
                      <th>Assigned Friend / Reviewer</th>
                      <th style={{ textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mySubmissions.map((sub) => {
                      const matchedPaper = practicePapers.find(
                        (p) => p.paperId?.toLowerCase() === sub.paperId?.toLowerCase()
                      );
                      const paperTitle = matchedPaper?.subject || sub.paperId;
                      const isSelfEval = sub.evaluationMode === "SELF";
                      const isPeerEval = sub.evaluationMode === "PEER";
                      const isFacultyEval = sub.evaluationCompleted === true && sub.evaluatedBy && sub.submissionMode === "OFFLINE_MANUAL";
                      const isEvaluated = isSelfEval || isPeerEval || isFacultyEval;
                      const maxScore = sub.maxMarks || matchedPaper?.maxMarks || 40;

                      return (
                        <tr key={sub.id}>
                          <td>
                            <strong className="table-subj-title">{paperTitle}</strong>
                            {sub.paperId && sub.paperId !== paperTitle && (
                              <small className="table-subcode">ID: {sub.paperId}</small>
                            )}
                          </td>
                          <td>
                            <span className="attempt-pill">Attempt #{sub.attemptCount || 1}</span>
                          </td>
                          <td>
                            <span className="date-subtext">
                              {sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              }) : "Recently"}
                            </span>
                          </td>
                          <td>
                            {isEvaluated ? (
                              <div className="eval-score-cluster">
                                <span className="score-val evaluated">
                                  ✓ {sub.totalMarks != null ? sub.totalMarks : 0} / {maxScore} M
                                </span>
                                <small className="eval-date-note">
                                  {isSelfEval
                                    ? `Self-Graded (${sub.evaluatedAt ? new Date(sub.evaluatedAt).toLocaleDateString("en-IN") : "Recorded"})`
                                    : isPeerEval
                                    ? `Friend Checked (${sub.peerEvaluatedAt ? new Date(sub.peerEvaluatedAt).toLocaleDateString("en-IN") : (sub.evaluatedAt ? new Date(sub.evaluatedAt).toLocaleDateString("en-IN") : "Recorded")})`
                                    : `Faculty: ${sub.evaluatedBy}`}
                                </small>
                              </div>
                            ) : (
                              <div className="eval-score-cluster">
                                <span className="score-val pending">
                                  — / {maxScore} M
                                </span>
                                <small className="eval-date-note pending">
                                  ⏳ Pending Evaluation
                                </small>
                              </div>
                            )}
                          </td>
                          <td>
                            {sub.assignedPeerUsn ? (
                              <div className="assigned-friend-badge">
                                <span>👥 Friend: {sub.assignedPeerName || sub.assignedPeerUsn}</span>
                                {sub.evaluationMode === "PEER" ? (
                                  <small className="reviewed-check">✓ Review Completed</small>
                                ) : (
                                  <small className="waiting-check">⏳ Review Pending</small>
                                )}
                              </div>
                            ) : (
                              <span className="unassigned-text">(Not assigned yet)</span>
                            )}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <div className="table-actions-cluster">
                              <button
                                className="assign-friend-btn"
                                onClick={() => handleOpenAssignFriend(sub)}
                                title="Assign this paper to a specific friend to check"
                              >
                                👥 {sub.assignedPeerUsn ? "Change Friend" : "Assign to Friend"}
                              </button>
                              <button
                                className="self-check-btn"
                                onClick={() => handleOpenSelfEval(sub)}
                                title="Self-grade your answers"
                              >
                                🔍 Self Check
                              </button>
                              <button
                                className="export-pdf-paper-btn"
                                onClick={() => handleDownloadPdf(sub)}
                                title="Download Evaluated Practice Answer Paper PDF"
                              >
                                📄 PDF
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB 3: PEER REVIEW CENTER (ONLY PAPERS ASSIGNED TO CURRENT STUDENT) */}
          {activeTab === "PEER_REVIEWS" && (
            <div className="peer-review-section">
              <div className="peer-notice-banner">
                <span>🤝 Friend Peer Exchange:</span> Only practice papers that your classmates have specifically assigned to you (USN: <strong>{usn}</strong>) appear here.
              </div>

              {myAssignedPeerPapers.length === 0 ? (
                <div className="empty-state-box">
                  <h3>No Papers Assigned To You By Friends</h3>
                  <p>When a classmate selects your USN ({usn}) to review their practice paper, it will appear here for you to score and provide feedback.</p>
                </div>
              ) : (
                <div className="peer-grid">
                  {myAssignedPeerPapers.map((cand) => (
                    <div className="peer-card" key={cand.id}>
                      <div className="peer-card-top">
                        <span className="peer-usn-pill">From Friend: {cand.usn}</span>
                        <span className="peer-date-pill">
                          {cand.submittedAt ? new Date(cand.submittedAt).toLocaleDateString() : "Recent"}
                        </span>
                      </div>

                      <h3 className="peer-paper-title">{cand.paperId}</h3>
                      <p className="peer-meta-info">Questions Answered: {cand.responses?.length || 0} Qs</p>

                      {cand.evaluationMode === "PEER" ? (
                        <div className="reviewed-by-tag">
                          ✓ Evaluated by you ({cand.totalMarks} / {cand.maxMarks || 40} M)
                        </div>
                      ) : (
                        <div className="pending-review-tag">
                          ⏳ Waiting for your review & scores
                        </div>
                      )}

                      <button
                        className="peer-eval-action-btn"
                        onClick={() => handleOpenPeerEval(cand)}
                      >
                        {cand.evaluationMode === "PEER" ? "✏ Edit Friend's Review" : "👥 Review & Score Friend's Paper"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ASSIGN FRIEND MODAL WITH SMART CLASSMATE PICKER */}
      {assignTarget && (
        <div className="modal-backdrop" onClick={() => setAssignTarget(null)}>
          <div className="assign-friend-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>👥 Assign Paper to a Classmate for Peer Review</h2>
              <button className="close-modal-btn" onClick={() => setAssignTarget(null)}>✕</button>
            </div>

            <p className="modal-subtitle">
              Select a friend from your semester ({studentSem}). Only your selected classmate will be able to review and grade your paper in their Peer Review portal.
            </p>

            {/* Currently Selected Friend Banner */}
            {friendUsn ? (
              <div className="selected-friend-banner">
                <span className="sel-label">Selected Classmate for Review:</span>
                <div className="sel-details">
                  <strong>{friendName || "Classmate"}</strong>
                  <span className="sel-usn">({friendUsn})</span>
                </div>
              </div>
            ) : (
              <div className="unselected-friend-prompt">
                <span>👈 Please select a classmate from the list below:</span>
              </div>
            )}

            {/* Classmate Search Filter */}
            <div className="classmate-search-container">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search classmates by name or USN..."
                value={classmateSearch}
                onChange={(e) => setClassmateSearch(e.target.value)}
                autoFocus
              />
              {classmateSearch && (
                <button className="clear-search-btn" onClick={() => setClassmateSearch("")}>
                  ✕
                </button>
              )}
            </div>

            {/* Classmates Scrollable Grid */}
            <div className="classmates-scroll-grid">
              {loadingClassmates ? (
                <div className="classmates-loading-box">
                  <div className="spinner"></div>
                  <p>Loading classmates for Semester {studentSem}...</p>
                </div>
              ) : classmates.filter((c) => {
                  if (!classmateSearch.trim()) return true;
                  const q = classmateSearch.toLowerCase();
                  return (
                    (c.name || "").toLowerCase().includes(q) ||
                    (c.usn || "").toLowerCase().includes(q) ||
                    (c.department || "").toLowerCase().includes(q)
                  );
                }).length === 0 ? (
                <div className="classmates-empty-box">
                  <span>👥</span>
                  <p>
                    {classmateSearch
                      ? `No classmates found matching "${classmateSearch}"`
                      : `No other registered classmates found in Semester ${studentSem}. You can also type their USN manually below.`}
                  </p>
                </div>
              ) : (
                classmates
                  .filter((c) => {
                    if (!classmateSearch.trim()) return true;
                    const q = classmateSearch.toLowerCase();
                    return (
                      (c.name || "").toLowerCase().includes(q) ||
                      (c.usn || "").toLowerCase().includes(q) ||
                      (c.department || "").toLowerCase().includes(q)
                    );
                  })
                  .map((c) => {
                    const isSelected = friendUsn === c.usn;
                    return (
                      <div
                        key={c.id || c.usn}
                        className={`classmate-picker-card ${isSelected ? "selected" : ""}`}
                        onClick={() => {
                          setFriendUsn(c.usn);
                          setFriendName(c.name);
                        }}
                      >
                        <div className="classmate-avatar">
                          {c.name ? c.name.charAt(0).toUpperCase() : "S"}
                        </div>
                        <div className="classmate-info">
                          <strong className="classmate-name">{c.name}</strong>
                          <div className="classmate-submeta">
                            <span className="classmate-usn-tag">{c.usn}</span>
                            {c.department && <span className="classmate-dept"> • {c.department}</span>}
                          </div>
                        </div>
                        <button
                          type="button"
                          className={`select-btn ${isSelected ? "selected" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setFriendUsn(c.usn);
                            setFriendName(c.name);
                          }}
                        >
                          {isSelected ? "✓ Selected" : "Select"}
                        </button>
                      </div>
                    );
                  })
              )}
            </div>

            <div className="modal-footer">
              <button className="modal-cancel-btn" onClick={() => setAssignTarget(null)}>
                Cancel
              </button>
              <button
                className="confirm-assign-btn"
                disabled={assignSaving || !friendUsn}
                onClick={handleSaveAssignFriend}
              >
                {assignSaving ? "Assigning..." : "✓ Confirm Assignment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SELF EVALUATION MODAL */}
      {selfEvalTarget && (
        <div className="modal-backdrop" onClick={() => setSelfEvalTarget(null)}>
          <div className="self-eval-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🔍 Self-Evaluation: {selfEvalTarget.paperId}</h2>
              <button className="close-modal-btn" onClick={() => setSelfEvalTarget(null)}>✕</button>
            </div>

            <p className="self-eval-desc">
              Review your written answers, verify against model solutions, and assign self-grades for each question.
            </p>

            <div className="self-eval-scroll-area">
              {selfEvalTarget.responses?.map((r, i) => (
                <div className="self-eval-q-card" key={i}>
                  <div className="self-q-header">
                    <span className="q-tag">{r.questionId || `Q${i + 1}`}</span>
                    <span className="max-tag">Max: {r.maxMarks || 5} M</span>
                  </div>

                  <div className="self-written-view">
                    <label>Your Written Response:</label>
                    <p>{r.answer || "(No response written)"}</p>
                  </div>

                  <div className="self-score-row">
                    <div className="score-input-field">
                      <label>Your Self-Assigned Marks:</label>
                      <input
                        type="number"
                        step="0.5"
                        max={r.maxMarks || 5}
                        min="0"
                        value={selfScores[r.questionId] !== undefined ? selfScores[r.questionId] : (r.marksObtained || 0)}
                        onChange={(e) =>
                          setSelfScores({
                            ...selfScores,
                            [r.questionId]: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="fb-input-field">
                      <label>Self Notes / Improvements:</label>
                      <input
                        type="text"
                        placeholder="e.g. Need to explain 2 more points next time"
                        value={selfFeedbacks[r.questionId] || ""}
                        onChange={(e) =>
                          setSelfFeedbacks({
                            ...selfFeedbacks,
                            [r.questionId]: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="modal-footer">
              <button className="modal-cancel-btn" onClick={() => setSelfEvalTarget(null)}>
                Cancel
              </button>
              <button
                className="confirm-self-btn"
                disabled={selfSaving}
                onClick={handleSaveSelfEval}
              >
                {selfSaving ? "Saving..." : "✓ Save Self-Evaluation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PEER EVALUATION MODAL */}
      {peerEvalTarget && (
        <div className="modal-backdrop" onClick={() => setPeerEvalTarget(null)}>
          <div className="self-eval-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>👥 Peer Review: Student {peerEvalTarget.usn}</h2>
              <button className="close-modal-btn" onClick={() => setPeerEvalTarget(null)}>✕</button>
            </div>

            <p className="self-eval-desc">
              Grade your classmate's written answers and give encouraging, constructive feedback.
            </p>

            <div className="self-eval-scroll-area">
              {peerEvalTarget.responses?.map((r, i) => (
                <div className="self-eval-q-card" key={i}>
                  <div className="self-q-header">
                    <span className="q-tag">{r.questionId || `Q${i + 1}`}</span>
                    <span className="max-tag">Max: {r.maxMarks || 5} M</span>
                  </div>

                  <div className="self-written-view">
                    <label>Classmate's Written Response:</label>
                    <p>{r.answer || "(No response written)"}</p>
                  </div>

                  <div className="self-score-row">
                    <div className="score-input-field">
                      <label>Peer Awarded Marks:</label>
                      <input
                        type="number"
                        step="0.5"
                        max={r.maxMarks || 5}
                        min="0"
                        value={peerScores[r.questionId] !== undefined ? peerScores[r.questionId] : (r.marksObtained || 0)}
                        onChange={(e) =>
                          setPeerScores({
                            ...peerScores,
                            [r.questionId]: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="fb-input-field">
                      <label>Question Feedback:</label>
                      <input
                        type="text"
                        placeholder="e.g. Good derivation, minor calculation miss"
                        value={peerFeedbacks[r.questionId] || ""}
                        onChange={(e) =>
                          setPeerFeedbacks({
                            ...peerFeedbacks,
                            [r.questionId]: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}

              <div className="overall-peer-feedback-box">
                <label>Overall Constructive Feedback for your Classmate:</label>
                <textarea
                  rows="3"
                  placeholder="e.g. Great overall attempt! Focus more on diagrams for full marks."
                  value={peerOverallFeedback}
                  onChange={(e) => setPeerOverallFeedback(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="modal-cancel-btn" onClick={() => setPeerEvalTarget(null)}>
                Cancel
              </button>
              <button
                className="confirm-self-btn peer"
                disabled={peerSaving}
                onClick={handleSavePeerEval}
              >
                {peerSaving ? "Submitting..." : "✓ Submit Peer Review"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PracticePapers;
