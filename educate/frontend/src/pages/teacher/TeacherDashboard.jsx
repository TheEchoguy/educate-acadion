import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import { getTeacherOverview } from "../../services/syllabusService";
import FloatingChatbotWidget from "../../components/classroom/FloatingChatbotWidget";
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
      id: "papers_studio",
      title: "Question Papers & Evaluation Studio",
      tag: "QUESTION PAPERS & EVALUATION STUDIO",
      badgeColor: "purple",
      icon: "📝",
      path: "/teacher/papers",
      image: imgPapers,
      description: "Upload and extract question papers, configure IA blueprints, evaluate student answer submissions, and manage practice permissions.",
      features: [
        "AI Question Extraction & Blueprint Config",
        "Practice Permissions & Self-Testing",
        "Direct Answer Evaluation Studio",
      ],
      actionText: "Open Papers & Studio",
    },
    {
      id: "ia_marks",
      title: "IA Split Marks & Ingestion",
      tag: "DYNAMIC INGESTION & SUB-MARKS",
      badgeColor: "green",
      icon: "📊",
      path: "/teacher/classrooms",
      image: imgManual,
      description: "Download dynamic IA templates, ingest question-wise sub-marks (1a, 1b...), and manage classroom marks sheets.",
      features: [
        "Unified Master Split-Up Sheet Ingestion",
        "Sub-Question Breakdown (1a..4d @ 10M)",
        "Dynamic Blank Excel Template Generation",
      ],
      actionText: "Open Marks & Ingestion",
    },
    {
      id: "class_performance",
      title: "Class Performance & AI Risk Watchlist",
      tag: "ML RISK CLASSIFIER & SHAP INSIGHTS",
      badgeColor: "amber",
      icon: "🚨",
      path: "/teacher/analytics",
      image: imgAnalytics,
      description: "Analyze whole-class topic mastery heatmaps, module 1–5 drop rates, and SHAP-explained student risk predictions.",
      features: [
        "4-Level Multi-Scale Mastery Heatmaps",
        "ML Student Risk Classifier & Watchlist",
        "SHAP Explainable AI Academic Diagnosis",
      ],
      actionText: "View Performance & Risk",
    },
    {
      id: "ppt_generator",
      title: "AI PPT Generator & Studio",
      tag: "AI PRESENTATION STUDIO",
      badgeColor: "purple",
      icon: "✨",
      path: "/teacher/ppt-generator",
      image: imgPapers,
      description: "Generate syllabus-aligned PowerPoint presentations and lecture decks from module notes.",
      features: [
        "Full Notes Upload & Topic Discovery",
        "Multi-Part Widescreen Series Generation",
        "Visual Slide Canvas Editor & PPTX Export",
      ],
      actionText: "Launch PPT Generator",
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
            <p className="subtext">Upload question papers with AI extraction, configure IA blueprints, evaluate student responses, and monitor ML student risk watchlists.</p>
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
          <p>Consolidated workspace cards for question paper management, IA split marks ingestion, whole-class performance analytics, and lecture deck generation.</p>
        </div>

        <div className="clean-modules-grid">
          {/* Card 1: Question Papers & Evaluation Studio */}
          <div className="clean-grid-card border-purple" onClick={() => navigate("/teacher/papers")}>
            <div className="card-top-bar">
              <div className="card-badge purple">PAPERS &amp; EVALUATION</div>
              <span className="card-arrow">→</span>
            </div>
            <h3>📝 Question Papers &amp; Evaluation Studio</h3>
            <p>Upload and extract question papers, configure IA blueprints, evaluate student answer submissions, and manage practice permissions.</p>
            <div className="card-footer-meta">
              <span>• Paper Extraction &amp; Blueprints</span>
              <span>• Practice &amp; Grading Studio</span>
            </div>
          </div>

          {/* Card 2: IA Split Marks & Ingestion */}
          <div className="clean-grid-card border-green" onClick={() => navigate("/teacher/classrooms")}>
            <div className="card-top-bar">
              <div className="card-badge green">IA MARKS &amp; INGESTION</div>
              <span className="card-arrow">→</span>
            </div>
            <h3>📊 IA Split Marks &amp; Ingestion</h3>
            <p>Download dynamic IA templates, ingest question-wise sub-marks (1a, 1b...), and manage classroom marks sheets.</p>
            <div className="card-footer-meta">
              <span>• Dynamic Blank Templates</span>
              <span>• 1a..4d Sub-Marks Ingestion</span>
            </div>
          </div>

          {/* Card 3: Class Performance & AI Risk Watchlist */}
          <div className="clean-grid-card border-amber" onClick={() => navigate("/teacher/analytics")}>
            <div className="card-top-bar">
              <div className="card-badge amber">ANALYTICS &amp; ML RISK</div>
              <span className="card-arrow">→</span>
            </div>
            <h3>🚨 Class Performance &amp; AI Risk Watchlist</h3>
            <p>Analyze whole-class topic mastery heatmaps, module 1–5 drop rates, and SHAP-explained student risk predictions.</p>
            <div className="card-footer-meta">
              <span>• 4-Level Mastery Heatmaps</span>
              <span>• SHAP Explainable AI</span>
            </div>
          </div>

          {/* Card 4: AI PPT Generator & Studio */}
          <div className="clean-grid-card border-purple" onClick={() => navigate("/teacher/ppt-generator")}>
            <div className="card-top-bar">
              <div className="card-badge purple">AI PPT STUDIO</div>
              <span className="card-arrow">→</span>
            </div>
            <h3>✨ AI PPT Generator &amp; Studio</h3>
            <p>Generate syllabus-aligned PowerPoint presentations and lecture decks from module notes.</p>
            <div className="card-footer-meta">
              <span>• Multi-Part Series</span>
              <span>• Visual Slide Editor</span>
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

      {/* Floating Chatbot Launch Widget */}
      <FloatingChatbotWidget targetPath="/teacher/tutor" />
    </div>
  );
}

export default TeacherDashboard;
