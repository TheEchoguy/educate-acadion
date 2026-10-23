import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import toast from "react-hot-toast";
import { getStudentClassrooms, joinClassroom, resolveCourseCode } from "../../services/classroomService";
import { getMyProfile } from "../../services/profileService";
import FloatingChatbotWidget from "../../components/classroom/FloatingChatbotWidget";
import "./StudentDashboard.css";

import imgExams from "@media/images/topics/topic_exams.jpg";
import imgResults from "@media/images/topics/topic_results.jpg";
import imgPractice from "@media/images/topics/topic_practice.jpg";
import imgAnalytics from "@media/images/topics/topic_analytics.jpg";

function StudentDashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [activeModuleSlide, setActiveModuleSlide] = useState(0);

  // Classroom Live Integration
  const [enrolledClassrooms, setEnrolledClassrooms] = useState([]);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [joiningClassroom, setJoiningClassroom] = useState(false);

  const studentModules = [
    {
      id: "classrooms",
      title: "My Classrooms",
      tag: "ENROLLED SUBJECTS & BATCHES",
      badgeColor: "blue",
      icon: "🏫",
      path: "/student/classrooms",
      image: imgPractice,
      description: "Join teacher classrooms using a 6-character code, track approval status, and access enrolled classes.",
      features: [
        "Instant Join Code Requests",
        "Real-Time Approval Tracking",
        "Verified Faculty Connections",
      ],
      actionText: "Open My Classrooms",
    },
    {
      id: "exam-hub",
      title: "Examinations & Marksheets Hub",
      tag: "CENTRAL ASSESSMENT SUITE",
      badgeColor: "blue",
      icon: "📝",
      path: "/student/results",
      image: imgExams,
      description: "Attend scheduled classroom assessments, take unlimited practice papers, and inspect evaluated results.",
      features: [
        "Available Classroom Timed Exams",
        "Practice Papers & Self-Testing Retakes",
        "Evaluated Marksheets & IA Split-Up Scores",
      ],
      actionText: "Open Exam Hub →",
    },
    {
      id: "analytics",
      title: "Performance Analytics",
      tag: "RISK LEVEL: ON_TRACK",
      badgeColor: "amber",
      icon: "📈",
      path: "/student/performance",
      image: imgAnalytics,
      description: "Analyze performance trends, subject masteries, academic risk levels, and AI prediction reports.",
      features: [
        "Subject Weak-Spot Detection",
        "Academic Risk Trajectory (Low/Medium/High)",
        "Pass/Fail Grade Predictions",
      ],
      actionText: "Inspect Detailed 4-Level Diagnostics",
    },
    {
      id: "tutor",
      title: "AI Study Tutor (RAG Agent)",
      tag: "GROUNDED ON MODULE 1–5 NOTES",
      badgeColor: "blue",
      icon: "🤖",
      path: "/student/tutor",
      image: imgPractice,
      description: "Chat with your 24/7 Academic Study Tutor grounded strictly on VTU course notes with verifiable section citations.",
      features: [
        "Module 1–5 Scoped Semantic Search",
        "Exam Questions & 4-Tier Answer Framework",
        "Zero-Hallucination Textbook Grounding",
      ],
      actionText: "Launch AI Study Tutor",
    },
  ];

  const loadClassrooms = async () => {
    try {
      const data = await getStudentClassrooms();
      setEnrolledClassrooms(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    let ignore = false;
    const initData = async () => {
      try {
        const storedEmail = sessionStorage.getItem("email") || localStorage.getItem("email");
        const storedUsn = sessionStorage.getItem("usn") || localStorage.getItem("usn");
        const data = await getMyProfile(storedEmail, storedUsn);
        if (!ignore && data) setProfile(data);
      } catch (err) {
        console.log("Could not load student profile", err);
      }

      try {
        const classrooms = await getStudentClassrooms();
        if (!ignore && classrooms) setEnrolledClassrooms(classrooms);
      } catch (err) {
        console.error(err);
      }
    };

    initData();
    return () => {
      ignore = true;
    };
  }, []);

  const handleJoinClassroom = async (e) => {
    e.preventDefault();
    const cleanCode = joinCodeInput.trim().toUpperCase();
    if (!cleanCode) {
      toast.error("Please enter a valid classroom join code");
      return;
    }
    try {
      setJoiningClassroom(true);
      const res = await joinClassroom(cleanCode);
      toast.success(res.message || `Joined classroom '${res.classroomName || cleanCode}' successfully!`);
      setJoinCodeInput("");
      loadClassrooms();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to join classroom. Please check the code.");
    } finally {
      setJoiningClassroom(false);
    }
  };

  // Automatic slow transition between modules every 6 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveModuleSlide((prev) => (prev + 1) % studentModules.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [studentModules.length]);

  const studentName = profile?.name || sessionStorage.getItem("name") || localStorage.getItem("name") || "Student";
  const studentUsn = profile?.usn || sessionStorage.getItem("usn") || localStorage.getItem("usn") || "";
  const studentSem = profile?.semester || sessionStorage.getItem("semester") || localStorage.getItem("semester") || "";
  const studentDept = profile?.department || sessionStorage.getItem("department") || localStorage.getItem("department") || "";

  return (
    <div className="student-dashboard-page">
      <Navbar />

      <div className="dashboard-container">
        {/* TOP WELCOME HEADER */}
        <div className="clean-welcome-header">
          <div className="welcome-text-side">
            <span className="role-pill-blue">👨‍🎓 Verified Student Portal</span>
            <h1>Welcome back, <span className="highlight-text">{studentName}</span> 👋</h1>
            <p className="subtext">Access active exams, retake practice papers, view evaluated marksheets, and monitor your score analytics.</p>
          </div>
          <div className="user-chips-side">
            {studentUsn && <span className="clean-meta-chip">USN: {studentUsn}</span>}
            {studentSem && <span className="clean-meta-chip">Semester {studentSem}</span>}
            {studentDept && <span className="clean-meta-chip">Dept: {studentDept}</span>}
          </div>
        </div>

        {/* PROMINENT HERO JOIN CLASSROOM BOX */}
        <div className="join-classroom-hero-box">
          <div className="join-hero-left">
            <span className="join-pill-tag">⚡ Connect to Course</span>
            <h2>Join Classroom via Code</h2>
            <p>Enter the 6-character Join Code provided by your teacher to immediately link this classroom to your dashboard.</p>
          </div>

          <form onSubmit={handleJoinClassroom} className="join-hero-right">
            <div className="join-input-wrap">
              <span className="code-prefix-icon">🔑</span>
              <input
                type="text"
                maxLength={8}
                placeholder="ENTER 6-CHAR CODE"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                className="join-code-input"
              />
              <button
                type="submit"
                className="btn-join-action"
                disabled={joiningClassroom || !joinCodeInput.trim()}
              >
                {joiningClassroom ? "Connecting..." : "Join Now →"}
              </button>
            </div>
          </form>
        </div>

        {/* ENROLLED CLASSROOMS STRIP */}
        {enrolledClassrooms.length > 0 && (
          <div className="enrolled-classrooms-strip">
            <div className="strip-header">
              <div>
                <span className="strip-tag">🏛️ ACTIVE SUBJECTS</span>
                <h3>My Enrolled Classrooms ({enrolledClassrooms.length})</h3>
              </div>
              <button
                className="btn-manage-all-cls"
                onClick={() => navigate("/student/classrooms")}
              >
                Open Classrooms Hub →
              </button>
            </div>

            <div className="enrolled-cards-scroller">
              {enrolledClassrooms.map((cls) => {
                const courseCode = resolveCourseCode(cls);
                const courseTitle = cls.subjectName || cls.name || "Course Subject";
                const facultyName = cls.teacherName || "Faculty";
                const totalTopics = cls.totalTopics || 0;
                const completedTopics = cls.completedTopics || 0;
                const coveragePct = cls.coveragePercentage != null ? cls.coveragePercentage : (totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 1000) / 10 : 0);
                const isNeedsAttention = cls.riskStatus === "HIGH_RISK" || cls.statusBadge === "NEEDS_ATTENTION";

                return (
                  <div
                    key={cls.id}
                    className="enrolled-mini-card"
                    onClick={() => navigate(`/student/classrooms/${cls.id}`)}
                  >
                    <div className="mini-card-top">
                      <span className="mini-code-badge">{courseCode}</span>
                      <span className={`mini-status-badge ${isNeedsAttention ? "needs-attention" : "on-track"}`}>
                        {isNeedsAttention ? "🟡 Needs Attention" : "🟢 On Track"}
                      </span>
                    </div>

                    <h4 className="mini-classroom-name">
                      {courseTitle}
                    </h4>

                    <p className="mini-faculty-name">
                      Faculty: <strong>{facultyName}</strong>
                    </p>

                    {/* VISUAL SYLLABUS TEACHING COVERAGE PROGRESS BAR */}
                    <div className="mini-syllabus-coverage" style={{ margin: "10px 0 12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.76rem", color: "#94a3b8", marginBottom: "4px" }}>
                        <span style={{ fontWeight: 600, color: "#38bdf8" }}>Teaching Coverage: {coveragePct}%</span>
                        <span>({completedTopics}/{totalTopics} Topics Completed)</span>
                      </div>
                      <div style={{ width: "100%", height: "6px", background: "rgba(255, 255, 255, 0.08)", borderRadius: "4px", overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${Math.min(100, Math.max(0, coveragePct))}%`,
                            height: "100%",
                            background: "linear-gradient(90deg, #0284c7, #38bdf8)",
                            borderRadius: "4px",
                            transition: "width 0.4s ease",
                          }}
                        />
                      </div>
                    </div>

                    <div className="mini-card-bottom">
                      <span className="mini-arrow-btn">Enter Classroom Workspace →</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 4-LEVEL ACADEMIC INTELLIGENCE & EXPLAINABLE AI (XAI) HIGHLIGHT CARD */}
        <div className="xai-placeholder-card">
          <div className="xai-placeholder-left">
            <span className="xai-diagnostics-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              Diagnostics Available
            </span>
            <h2 className="xai-placeholder-title">
              📊 4-Level Academic Intelligence &amp; Explainable AI (XAI)
            </h2>
            <p className="xai-placeholder-subtitle">
              Topic-by-topic diagnostic mastery, Module 1–5 drop rates, and SHAP-explained performance drivers are accessible directly inside each enrolled course workspace.
            </p>
          </div>

          <div className="xai-embedded-badge">
            <span>⚡ Embedded in Classrooms</span>
          </div>
        </div>

        {/* FEATURED SHOWCASE BANNER - HORIZONTAL CAMERA SLIDE TRACK FROM FAR END OF DESKTOP */}
        <div className="topic-showcase-banner">
          <div
            className="showcase-reel-track"
            style={{
              width: `${studentModules.length * 100}%`,
              transform: `translateX(-${(activeModuleSlide * 100) / studentModules.length}%)`,
            }}
          >
            {studentModules.map((mod) => (
              <div
                key={mod.id}
                className="showcase-reel-item"
                style={{
                  width: `${100 / studentModules.length}%`,
                  flex: `0 0 ${100 / studentModules.length}%`,
                }}
              >
                <div
                  className="topic-photo-slide active-zoom"
                  style={{ backgroundImage: `url(${mod.image})` }}
                />
                <div className="topic-photo-scrim" />

                <div className="topic-showcase-inner">
                  <div className="showcase-top-row">
                    <div className="module-title-box">
                      <span className={`status-badge-pill ${mod.badgeColor}`}>
                        <span className="dot-indicator" />
                        {mod.tag}
                      </span>
                      <h2>
                        <span className="mod-emoji">{mod.icon}</span>
                        {mod.title}
                      </h2>
                    </div>

                    <button
                      className={`launch-btn ${mod.badgeColor}`}
                      onClick={() => navigate(mod.path)}
                    >
                      <span>{mod.actionText}</span>
                      <span className="arrow">→</span>
                    </button>
                  </div>

                  <p className="showcase-desc">{mod.description}</p>

                  <div className="features-row">
                    {mod.features.map((feat, fidx) => (
                      <div key={fidx} className="feature-chip">
                        <span className="check-mark">✓</span>
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>

                  {/* INTERACTIVE MODULE TABS & AUTO-TIMER */}
                  <div className="tabs-bar-row">
                    <div className="tabs-group">
                      {studentModules.map((tmod, tidx) => (
                        <button
                          key={tmod.id}
                          className={`tab-chip-btn ${activeModuleSlide === tidx ? "active" : ""}`}
                          onClick={() => setActiveModuleSlide(tidx)}
                        >
                          <span className="tab-icon">{tmod.icon}</span>
                          <span className="tab-title">{tmod.title}</span>
                        </button>
                      ))}
                    </div>

                    <div className="timer-track">
                      <div className="timer-fill-fast-blue" key={activeModuleSlide} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CLEAN SOLID DARK MODULE CARDS GRID BELOW */}
        <div className="grid-section-header">
          <h2>Student Portal Modules</h2>
          <p>Direct workspace cards for exam taking, marksheets, practice, and trend analysis.</p>
        </div>

        <div className="clean-modules-grid">
          {/* Consolidated Module: Examinations & Marksheets Hub */}
          <div className="clean-grid-card border-blue" onClick={() => navigate("/student/results")}>
            <div className="card-top-bar">
              <div className="card-badge blue">UNIFIED ASSESSMENT HUB</div>
              <span className="card-arrow">→</span>
            </div>
            <h3>📝 Examinations &amp; Marksheets Hub</h3>
            <p>Attend scheduled classroom assessments, take unlimited practice papers, and inspect evaluated results.</p>
            <div className="card-footer-meta">
              <span>• Classroom Exams</span>
              <span>• Unlimited Retakes</span>
              <span>• Evaluated Marksheets</span>
            </div>
          </div>

          {/* Card 4: Performance Analytics */}
          <div className="clean-grid-card border-amber" onClick={() => navigate("/student/performance")}>
            <div className="card-top-bar">
              <div className="card-badge amber">ANALYTICS &amp; RISKS</div>
              <span className="card-arrow">→</span>
            </div>
            <h3>📈 Performance Analytics</h3>
            <p>Track academic performance trajectory, weak spots, and AI grade prediction metrics.</p>
            <div className="card-footer-meta">
              <span style={{ color: "#f59e0b", fontWeight: 600 }}>Inspect Detailed 4-Level Diagnostics →</span>
            </div>
          </div>

          {/* Card 5: AI Study Tutor (RAG Agent) */}
          <div
            className="clean-grid-card border-blue"
            style={{
              borderColor: "rgba(56, 189, 248, 0.4)",
              background: "linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(99, 102, 241, 0.08) 100%)",
            }}
            onClick={() => navigate("/student/tutor")}
          >
            <div className="card-top-bar">
              <div
                className="card-badge blue"
                style={{
                  background: "rgba(6, 182, 212, 0.2)",
                  color: "#38bdf8",
                  border: "1px solid rgba(56, 189, 248, 0.4)",
                }}
              >
                RAG AGENT 2.0
              </div>
              <span className="card-arrow" style={{ color: "#38bdf8" }}>→</span>
            </div>
            <h3>🤖 AI Study Tutor</h3>
            <p>24/7 syllabus tutor strictly grounded on VTU Module 1–5 notes with verified citations.</p>
            <div className="card-footer-meta">
              <span>• Module 1–5 Grounded</span>
              <span>• Zero Hallucination</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Chatbot Launch Widget */}
      <FloatingChatbotWidget targetPath="/student/tutor" />
    </div>
  );
}

export default StudentDashboard;
