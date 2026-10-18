import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import "./TeacherDashboard.css";

import imgPapers from "@media/images/topics/teacher_papers.jpg";
import imgEvaluate from "@media/images/topics/teacher_evaluate.jpg";
import imgAnalytics from "@media/images/topics/teacher_analytics.jpg";
import imgManual from "@media/images/topics/teacher_manual.jpg";

function TeacherDashboard() {
  const navigate = useNavigate();
  const [activeModuleSlide, setActiveModuleSlide] = useState(0);

  const teacherName = sessionStorage.getItem("name") || localStorage.getItem("name") || "Faculty";
  const teacherDept = sessionStorage.getItem("department") || localStorage.getItem("department") || "Academic Department";

  const teacherModules = [
    {
      id: "classrooms",
      title: "Classroom Hub",
      tag: "STUDENT ROSTER & CONNECTIONS",
      badgeColor: "purple",
      icon: "🏫",
      path: "/teacher/classrooms",
      image: imgPapers,
      description: "Manage academic classrooms, batch-enroll students via Excel/CSV rosters, and review join code requests.",
      features: [
        "Excel/CSV Batch Student Import",
        "Unique 6-Character Join Code",
        "Student Verification & Approval Gate",
      ],
      actionText: "Open Classrooms",
    },
    {
      id: "create_paper",
      title: "Question Paper Hub",
      tag: "PAPER GENERATOR & EDITOR",
      badgeColor: "purple",
      icon: "📝",
      path: "/teacher/manage-papers",
      image: imgPapers,
      description: "Generate AI question papers from PDF uploads, edit question banks, and publish exam papers for students.",
      features: [
        "PDF Upload & Auto Question Extraction",
        "Interactive Question Bank Editor",
        "One-Click Exam Publication",
      ],
      actionText: "Manage Question Papers",
    },
    {
      id: "evaluate",
      title: "Evaluate Submissions",
      tag: "AUTOMATED ANSWER GRADING",
      badgeColor: "blue",
      icon: "✍️",
      path: "/teacher/evaluate",
      image: imgEvaluate,
      description: "Review student response scripts, grade answers, assign marks, and provide constructive feedback.",
      features: [
        "AI-Assisted Answer Evaluation",
        "Granular Question-wise Marking",
        "Constructive Student Feedback",
      ],
      actionText: "Evaluate Responses",
    },
    {
      id: "analytics",
      title: "Class Analytics",
      tag: "PERFORMANCE METRICS",
      badgeColor: "amber",
      icon: "📈",
      path: "/teacher/analytics",
      image: imgAnalytics,
      description: "View class pass percentage, score distributions, topic mastery insights, and student risk flags.",
      features: [
        "Class Pass / Fail Trajectory",
        "Topic Weak-Spot Analytics",
        "Score Distribution Graphs",
      ],
      actionText: "View Class Analytics",
    },
    {
      id: "manual_marks",
      title: "Manual Marks Entry",
      tag: "INTERNAL ASSESSMENT",
      badgeColor: "green",
      icon: "📋",
      path: "/teacher/manual-marks",
      image: imgManual,
      description: "Record offline IA test marks, lab scores, attendance ratings, and export department marksheets.",
      features: [
        "Offline IA Marks Recording",
        "Department Marksheet Exports",
        "Attendance & Lab Ratings",
      ],
      actionText: "Open Marks Entry",
    },
  ];

  // Automatic slow transition between modules every 6 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveModuleSlide((prev) => (prev + 1) % teacherModules.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [teacherModules.length]);

  return (
    <div className="teacher-dashboard-page">
      <Navbar />

      <div className="dashboard-container">
        {/* TOP WELCOME HEADER */}
        <div className="clean-welcome-header">
          <div className="welcome-text-side">
            <span className="role-pill-purple">👨‍🏫 Faculty &amp; Teaching Portal</span>
            <h1>Welcome back, <span className="highlight-text">{teacherName}</span> 👋</h1>
            <p className="subtext">Upload question papers with AI extraction, grade student responses, analyze class reports, and record internal marks.</p>
          </div>
          <div className="user-chips-side">
            <span className="clean-meta-chip">Department: {teacherDept}</span>
          </div>
        </div>

        {/* FEATURED SHOWCASE BANNER - HORIZONTAL CAMERA SLIDE TRACK FROM FAR END OF DESKTOP */}
        <div className="topic-showcase-banner">
          <div
            className="showcase-reel-track"
            style={{ transform: `translateX(-${activeModuleSlide * 25}%)` }}
          >
            {teacherModules.map((mod) => (
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
                        <span className="check-mark-purple">✓</span>
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>

                  {/* INTERACTIVE MODULE TABS & AUTO-TIMER */}
                  <div className="tabs-bar-row">
                    <div className="tabs-group">
                      {teacherModules.map((tmod, tidx) => (
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
                      <div className="timer-fill-fast-purple" key={activeModuleSlide} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CLEAN SOLID DARK MODULE CARDS GRID BELOW */}
        <div className="grid-section-header">
          <h2>Faculty Workspace Modules</h2>
          <p>Direct workspace cards for question paper management, answer evaluation, class analytics, and IA marks entry.</p>
        </div>

        <div className="clean-modules-grid">
          {/* Card 1: Question Papers */}
          <div className="clean-grid-card border-purple" onClick={() => navigate("/teacher/manage-papers")}>
            <div className="card-top-bar">
              <div className="card-badge purple">QUESTION PAPERS</div>
              <span className="card-arrow">→</span>
            </div>
            <h3>📝 Question Paper Hub</h3>
            <p>Upload PDF question papers, edit questions, and publish exam papers.</p>
            <div className="card-footer-meta">
              <span>• PDF Parsing</span>
              <span>• Editor</span>
            </div>
          </div>

          {/* Card 2: Evaluate Responses */}
          <div className="clean-grid-card border-blue" onClick={() => navigate("/teacher/evaluate")}>
            <div className="card-top-bar">
              <div className="card-badge blue">GRADING</div>
              <span className="card-arrow">→</span>
            </div>
            <h3>✍️ Evaluate Submissions</h3>
            <p>Grade student answers, assign marks, and provide constructive feedback.</p>
            <div className="card-footer-meta">
              <span>• Question Marking</span>
              <span>• Feedback</span>
            </div>
          </div>

          {/* Card 3: Class Analytics */}
          <div className="clean-grid-card border-amber" onClick={() => navigate("/teacher/analytics")}>
            <div className="card-top-bar">
              <div className="card-badge amber">ANALYTICS</div>
              <span className="card-arrow">→</span>
            </div>
            <h3>📈 Class Performance</h3>
            <p>Analyze pass percentage, score distribution, and topic weak spots.</p>
            <div className="card-footer-meta">
              <span>• Pass Trajectory</span>
              <span>• Weak Spots</span>
            </div>
          </div>

          {/* Card 4: Manual Marks Entry */}
          <div className="clean-grid-card border-green" onClick={() => navigate("/teacher/manual-marks")}>
            <div className="card-top-bar">
              <div className="card-badge green">IA MARKS</div>
              <span className="card-arrow">→</span>
            </div>
            <h3>📋 Manual Marks Entry</h3>
            <p>Record offline IA test marks, lab ratings, and export marksheets.</p>
            <div className="card-footer-meta">
              <span>• Offline IA</span>
              <span>• Export CSV</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TeacherDashboard;
