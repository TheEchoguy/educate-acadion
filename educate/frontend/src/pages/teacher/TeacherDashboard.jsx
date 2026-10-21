import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import { getTeacherOverview } from "../../services/syllabusService";
import "./TeacherDashboard.css";

import imgPapers from "@media/images/topics/teacher_papers.jpg";
import imgEvaluate from "@media/images/topics/teacher_evaluate.jpg";
import imgAnalytics from "@media/images/topics/teacher_analytics.jpg";
import imgManual from "@media/images/topics/teacher_manual.jpg";

function TeacherDashboard() {
  const navigate = useNavigate();
  const [activeModuleSlide, setActiveModuleSlide] = useState(0);
  const [syllabusOverview, setSyllabusOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

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
    {
      id: "ppt_generator",
      title: "AI PPT Generator",
      tag: "SLIDE DECK & OUTLINE GENERATOR",
      badgeColor: "purple",
      icon: "📊",
      path: "/teacher/ppt-generator",
      image: imgPapers,
      description: "Convert lecture notes into multi-part widescreen PowerPoint presentations with AI topic extraction, figure detection, and interactive visual editing.",
      features: [
        "Full Notes Upload & Topic Discovery",
        "Multi-Part Series & Figure Extraction",
        "Visual Slide Canvas Editor & Export",
      ],
      actionText: "Launch PPT Generator",
    },
    {
      id: "quiz_generator",
      title: "AI MCQ Quiz Generator",
      tag: "AI QUESTION GENERATOR & PUBLISHER",
      badgeColor: "purple",
      icon: "🎯",
      path: "/teacher/quiz-generator",
      image: imgPapers,
      description: "Generate academic MCQ quizzes from topics or lecture notes using OpenRouter AI, review & edit questions, and publish directly for student practice.",
      features: [
        "Topic & Document Notes Generation",
        "Interactive Option & Key Editor",
        "End-to-End Publishing & Student Scoring",
      ],
      actionText: "Launch Quiz Generator",
    },
  ];

  // Automatic slow transition between modules every 6 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveModuleSlide((prev) => (prev + 1) % teacherModules.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [teacherModules.length]);

  // Load cross-classroom syllabus overview
  useEffect(() => {
    let active = true;
    getTeacherOverview()
      .then((data) => {
        if (active) {
          setSyllabusOverview(data || null);
          setOverviewLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load cross-classroom syllabus overview", err);
        if (active) {
          setSyllabusOverview(null);
          setOverviewLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

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
            style={{
              width: `${teacherModules.length * 100}%`,
              transform: `translateX(-${(activeModuleSlide * 100) / teacherModules.length}%)`,
            }}
          >
            {teacherModules.map((mod) => (
              <div
                key={mod.id}
                className="showcase-reel-item"
                style={{
                  width: `${100 / teacherModules.length}%`,
                  flex: `0 0 ${100 / teacherModules.length}%`,
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

          {/* Card 5: AI PPT Generator */}
          <div className="clean-grid-card border-purple" onClick={() => navigate("/teacher/ppt-generator")}>
            <div className="card-top-bar">
              <div className="card-badge purple">PPT GENERATOR</div>
              <span className="card-arrow">→</span>
            </div>
            <h3>📊 AI PPT Generator</h3>
            <p>Upload lecture notes, discover topics, edit slides in real-time, and download presentations.</p>
            <div className="card-footer-meta">
              <span>• Multi-Part Series</span>
              <span>• Visual Editor</span>
            </div>
          </div>

          {/* Card 6: AI MCQ Quiz Generator */}
          <div className="clean-grid-card border-purple" onClick={() => navigate("/teacher/quiz-generator")}>
            <div className="card-top-bar">
              <div className="card-badge purple">MCQ QUIZ GENERATOR</div>
              <span className="card-arrow">→</span>
            </div>
            <h3>🎯 AI MCQ Quiz Generator</h3>
            <p>Generate academic quizzes from topics or notes with OpenRouter AI, review &amp; publish for student practice.</p>
            <div className="card-footer-meta">
              <span>• Topic &amp; Notes AI</span>
              <span>• Live Review &amp; Publish</span>
            </div>
          </div>
        </div>

        {/* CROSS-CLASSROOM SYLLABUS OVERVIEW */}
        <div className="syllabus-cross-overview-section" style={{ marginTop: 48 }}>
          <div className="grid-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span className="card-badge purple">ACADEMIC DELIVERY</span>
                <span style={{ fontSize: "0.78rem", color: "#94a3b8", fontWeight: 600 }}>SYLLABUS TRACKING</span>
              </div>
              <h2>Classroom Syllabus &amp; Curriculum Delivery</h2>
              <p>Cross-classroom curriculum coverage, topic delivery progress, and student revision participation across your active courses.</p>
            </div>

            {syllabusOverview && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <div className="clean-meta-chip">
                  Managed: <strong>{syllabusOverview.totalManagedClassrooms ?? 0} Classrooms</strong>
                </div>
                <div className="clean-meta-chip">
                  Topics: <strong>{syllabusOverview.totalSyllabusTopics ?? 0} Total</strong>
                </div>
                <div className="clean-meta-chip" style={{ color: "#38bdf8", borderColor: "rgba(56, 189, 248, 0.3)" }}>
                  Avg Coverage: <strong>{Number(syllabusOverview.overallAverageCoverage || 0).toFixed(1)}%</strong>
                </div>
              </div>
            )}
          </div>

          {overviewLoading ? (
            <div style={{ padding: "32px", textAlign: "center", color: "#64748b", background: "rgba(15, 23, 42, 0.4)", borderRadius: 16, border: "1px solid rgba(255, 255, 255, 0.06)" }}>
              Loading syllabus monitoring metrics...
            </div>
          ) : !syllabusOverview || !syllabusOverview.classrooms || syllabusOverview.classrooms.length === 0 ? (
            <div
              style={{
                background: "rgba(15, 23, 42, 0.6)",
                border: "1px dashed rgba(255, 255, 255, 0.12)",
                borderRadius: 18,
                padding: "36px 24px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "2rem", marginBottom: 8 }}>📖</div>
              <h4 style={{ margin: "0 0 6px 0", color: "#f8fafc", fontSize: "1.1rem" }}>No Classroom Syllabus Data Available</h4>
              <p style={{ margin: "0 0 16px 0", color: "#64748b", fontSize: "0.88rem" }}>
                Classrooms you create in the Classroom Hub will display live curriculum coverage, topic schedules, and student revision metrics here.
              </p>
              <button
                type="button"
                className="launch-btn purple"
                style={{ display: "inline-flex", padding: "8px 20px" }}
                onClick={() => navigate("/teacher/classrooms")}
              >
                <span>Go to Classroom Hub</span>
                <span className="arrow">→</span>
              </button>
            </div>
          ) : (
            <div className="clean-modules-grid">
              {syllabusOverview.classrooms.map((cls) => (
                <div
                  key={cls.classroomId}
                  className="clean-grid-card border-purple"
                  onClick={() => navigate(`/teacher/classrooms/${cls.classroomId}?tab=syllabus`, { state: { tab: "syllabus" } })}
                  style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 14 }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div className="card-top-bar">
                      <span className="card-badge purple">
                        {cls.subjectCode ? cls.subjectCode : "CLASSROOM"}
                      </span>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 8,
                          background: cls.currentVersionNumber ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                          color: cls.currentVersionNumber ? "#34d399" : "#fbbf24",
                          border: `1px solid ${cls.currentVersionNumber ? "rgba(16, 185, 129, 0.3)" : "rgba(245, 158, 11, 0.3)"}`,
                        }}
                      >
                        {cls.currentVersionNumber ? `v${cls.currentVersionNumber} Published` : "Draft"}
                      </span>
                    </div>

                    <h3 style={{ fontSize: "1.1rem", margin: "4px 0 0 0" }}>{cls.classroomName}</h3>
                    {cls.subjectName && (
                      <p style={{ fontSize: "0.82rem", color: "#94a3b8" }}>{cls.subjectName}</p>
                    )}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "6px 0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "#cbd5e1" }}>
                      <span>Teaching Coverage</span>
                      <strong style={{ color: "#38bdf8" }}>{Number(cls.coveragePercentage || 0).toFixed(1)}%</strong>
                    </div>
                    <div
                      style={{
                        width: "100%",
                        height: 6,
                        background: "rgba(255, 255, 255, 0.08)",
                        borderRadius: 3,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(100, Math.max(0, cls.coveragePercentage || 0))}%`,
                          height: "100%",
                          background: "linear-gradient(90deg, #a855f7, #38bdf8)",
                          borderRadius: 3,
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", fontSize: "0.74rem" }}>
                    <span style={{ background: "rgba(255,255,255,0.05)", padding: "3px 8px", borderRadius: 6, color: "#94a3b8" }}>
                      {cls.completedTopics || 0}/{cls.topicCount || 0} Topics
                    </span>
                    {cls.overdueTopicsCount > 0 && (
                      <span style={{ background: "rgba(239, 68, 68, 0.15)", color: "#f87171", padding: "3px 8px", borderRadius: 6 }}>
                        ⚠️ {cls.overdueTopicsCount} Overdue
                      </span>
                    )}
                    {cls.upcomingTopicsCount > 0 && (
                      <span style={{ background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", padding: "3px 8px", borderRadius: 6 }}>
                        📅 {cls.upcomingTopicsCount} Upcoming
                      </span>
                    )}
                  </div>

                  <div className="card-footer-meta" style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <span>
                      {cls.enrolledStudentsCount > 0
                        ? `${cls.participatingStudentsCount || 0}/${cls.enrolledStudentsCount} revising (${cls.averageRevisionPercentage != null ? cls.averageRevisionPercentage.toFixed(0) + '%' : '0%'})`
                        : "No students enrolled"}
                    </span>
                    <span style={{ color: "#c084fc", fontWeight: 600 }}>Syllabus →</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TeacherDashboard;
