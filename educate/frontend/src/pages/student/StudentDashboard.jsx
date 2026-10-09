import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import { getMyProfile } from "../../services/profileService";
import "./StudentDashboard.css";

import imgExams from "@media/images/topics/topic_exams.jpg";
import imgResults from "@media/images/topics/topic_results.jpg";
import imgPractice from "@media/images/topics/topic_practice.jpg";
import imgAnalytics from "@media/images/topics/topic_analytics.jpg";

function StudentDashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [activeModuleSlide, setActiveModuleSlide] = useState(0);

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
      id: "exams",
      title: "Available Exams",
      tag: "ACTIVE EXAMS READY",
      badgeColor: "blue",
      icon: "📝",
      path: "/student/exams",
      image: imgExams,
      description: "View and launch all formal online examinations uploaded by faculty for your batch and department.",
      features: [
        "Timed Online Exam Interface",
        "Instant Submission & System Logging",
        "Automated Question Paper Parsing",
      ],
      actionText: "Launch Available Exams",
    },
    {
      id: "results",
      title: "My Results & Marksheets",
      tag: "EVALUATED MARKS",
      badgeColor: "green",
      icon: "📊",
      path: "/student/results",
      image: imgResults,
      description: "Check evaluated marks, question-by-question breakdown, and constructive feedback recorded by your teachers.",
      features: [
        "Question-wise Marks Breakdown",
        "Detailed Teacher Remarks & Feedback",
        "Downloadable PDF Score Report",
      ],
      actionText: "View Evaluated Results",
    },
    {
      id: "practice",
      title: "Practice Test Papers",
      tag: "UNLIMITED RETAKES",
      badgeColor: "purple",
      icon: "🎯",
      path: "/student/practice",
      image: imgPractice,
      description: "Unlimited practice retakes, self-study paper sets, instant AI scoring, and peer review reference papers.",
      features: [
        "Unlimited Self-Study Exam Retakes",
        "Instant Automated AI Answer Scoring",
        "Peer Review & Reference Answers",
      ],
      actionText: "Start Practice Retake",
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
      actionText: "Analyze Performance Trends",
    },
  ];

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const storedEmail = localStorage.getItem("email");
        const storedUsn = localStorage.getItem("usn");
        const data = await getMyProfile(storedEmail, storedUsn);
        if (data) setProfile(data);
      } catch (err) {
        console.log("Could not load student profile", err);
      }
    };
    fetchProfile();
  }, []);

  // Automatic slow transition between modules every 6 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveModuleSlide((prev) => (prev + 1) % studentModules.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [studentModules.length]);

  const studentName = profile?.name || localStorage.getItem("name") || "Student";
  const studentUsn = profile?.usn || localStorage.getItem("usn") || "";
  const studentSem = profile?.semester || localStorage.getItem("semester") || "";
  const studentDept = profile?.department || localStorage.getItem("department") || "";

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

        {/* FEATURED SHOWCASE BANNER - HORIZONTAL CAMERA SLIDE TRACK FROM FAR END OF DESKTOP */}
        <div className="topic-showcase-banner">
          <div
            className="showcase-reel-track"
            style={{ transform: `translateX(-${activeModuleSlide * 25}%)` }}
          >
            {studentModules.map((mod) => (
              <div key={mod.id} className="showcase-reel-item">
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
          {/* Card 1: Available Exams */}
          <div className="clean-grid-card border-blue" onClick={() => navigate("/student/exams")}>
            <div className="card-top-bar">
              <div className="card-badge blue">ACTIVE EXAMS</div>
              <span className="card-arrow">→</span>
            </div>
            <h3>📝 Available Examinations</h3>
            <p>Launch official timed question papers assigned to your semester and department.</p>
            <div className="card-footer-meta">
              <span>• Timed Interface</span>
              <span>• Automated Logging</span>
            </div>
          </div>

          {/* Card 2: Results & Marksheets */}
          <div className="clean-grid-card border-green" onClick={() => navigate("/student/results")}>
            <div className="card-top-bar">
              <div className="card-badge green">EVALUATED MARKS</div>
              <span className="card-arrow">→</span>
            </div>
            <h3>📊 Results &amp; Marksheets</h3>
            <p>Inspect evaluated marks, question-by-question breakdown, and teacher remarks.</p>
            <div className="card-footer-meta">
              <span>• PDF Download</span>
              <span>• Teacher Feedback</span>
            </div>
          </div>

          {/* Card 3: Practice Retakes */}
          <div className="clean-grid-card border-purple" onClick={() => navigate("/student/practice")}>
            <div className="card-top-bar">
              <div className="card-badge purple">PRACTICE RETAKES</div>
              <span className="card-arrow">→</span>
            </div>
            <h3>🎯 Practice Test Papers</h3>
            <p>Take unlimited self-study retakes with instant AI answer scoring and reference keys.</p>
            <div className="card-footer-meta">
              <span>• Instant Scoring</span>
              <span>• Peer Reference</span>
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
              <span>• Weak-Spot Detect</span>
              <span>• Risk Prediction</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StudentDashboard;
