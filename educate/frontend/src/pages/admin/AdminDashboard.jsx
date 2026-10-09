import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import "./AdminDashboard.css";

import imgPending from "@media/images/topics/admin_pending_approvals.jpg";
import imgUsers from "@media/images/topics/admin_manage_users.jpg";
import imgAnalytics from "@media/images/topics/admin_platform_analytics.jpg";
import imgGovernance from "@media/images/topics/admin_department_governance.jpg";

function AdminDashboard() {
  const navigate = useNavigate();
  const [activeModuleSlide, setActiveModuleSlide] = useState(0);

  const adminName = localStorage.getItem("name") || "Administrator";

  const adminModules = [
    {
      id: "pending_users",
      title: "Pending Registrations",
      tag: "APPROVAL QUEUE READY",
      badgeColor: "amber",
      icon: "⏳",
      path: "/admin/pending-users",
      image: imgPending,
      description: "Review and approve pending student and faculty account registrations requiring OTP verification.",
      features: [
        "OTP Verification Queue",
        "Brevo Automated Approval Emails",
        "Role Assignment (Student/Teacher)",
      ],
      actionText: "Review Pending Users",
    },
    {
      id: "manage_users",
      title: "Manage Platform Users",
      tag: "USER DIRECTORY & ROLES",
      badgeColor: "blue",
      icon: "👥",
      path: "/admin/manage-users",
      image: imgUsers,
      description: "Search, filter, edit, or deactivate registered student and faculty accounts across departments.",
      features: [
        "Institutional User Directory",
        "Department & USN Search Filters",
        "Account Status Control (Active/Locked)",
      ],
      actionText: "Manage Directory",
    },
    {
      id: "platform_analytics",
      title: "Platform Analytics",
      tag: "SYSTEM METRICS & USAGE",
      badgeColor: "purple",
      icon: "📊",
      path: null,
      image: imgAnalytics,
      description: "Monitor platform uptime, total examination attempts, evaluation completion rates, and active sessions.",
      features: [
        "Total Examination Attempt Metrics",
        "Faculty Evaluation Completion Rate",
        "Active System Sessions Overview",
      ],
      actionText: "System Operational",
    },
    {
      id: "governance",
      title: "Department Governance",
      tag: "ACADEMIC AUDITING",
      badgeColor: "green",
      icon: "🛡️",
      path: null,
      image: imgGovernance,
      description: "Audit department performance metrics, faculty question paper publishing velocity, and pass percentage thresholds.",
      features: [
        "Department Velocity Audits",
        "Question Paper Publishing Logs",
        "Institutional Pass Rate Thresholds",
      ],
      actionText: "Governance Active",
    },
  ];

  // Automatic slow transition between modules every 6 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveModuleSlide((prev) => (prev + 1) % adminModules.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [adminModules.length]);

  return (
    <div className="admin-dashboard-page">
      <Navbar />

      <div className="dashboard-container">
        {/* TOP WELCOME HEADER */}
        <div className="clean-welcome-header">
          <div className="welcome-text-side">
            <span className="role-pill-amber">⚡ Institutional Admin Portal</span>
            <h1>Welcome back, <span className="highlight-text">{adminName}</span> 👋</h1>
            <p className="subtext">Approve user account registrations, manage platform permissions, monitor system analytics, and enforce governance.</p>
          </div>
          <div className="user-chips-side">
            <span className="clean-meta-chip">Role: Platform Admin</span>
          </div>
        </div>

        {/* FEATURED SHOWCASE BANNER - HORIZONTAL CAMERA SLIDE TRACK FROM FAR END OF DESKTOP */}
        <div className="topic-showcase-banner">
          <div
            className="showcase-reel-track"
            style={{ transform: `translateX(-${activeModuleSlide * 25}%)` }}
          >
            {adminModules.map((mod) => (
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

                    {mod.path && (
                      <button
                        className={`launch-btn ${mod.badgeColor}`}
                        onClick={() => navigate(mod.path)}
                      >
                        <span>{mod.actionText}</span>
                        <span className="arrow">→</span>
                      </button>
                    )}
                  </div>

                  <p className="showcase-desc">{mod.description}</p>

                  <div className="features-row">
                    {mod.features.map((feat, fidx) => (
                      <div key={fidx} className="feature-chip">
                        <span className="check-mark-green">✓</span>
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>

                  {/* INTERACTIVE MODULE TABS & AUTO-TIMER */}
                  <div className="tabs-bar-row">
                    <div className="tabs-group">
                      {adminModules.map((tmod, tidx) => (
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
                      <div className="timer-fill-fast-green" key={activeModuleSlide} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CLEAN SOLID DARK MODULE CARDS GRID BELOW */}
        <div className="grid-section-header">
          <h2>Admin Governance Modules</h2>
          <p>Direct workspace cards for user registration approvals, platform user management, and system metrics.</p>
        </div>

        <div className="clean-modules-grid">
          {/* Card 1: Pending Approvals */}
          <div className="clean-grid-card border-amber" onClick={() => navigate("/admin/pending-users")}>
            <div className="card-top-bar">
              <div className="card-badge amber">APPROVAL QUEUE</div>
              <span className="card-arrow">→</span>
            </div>
            <h3>⏳ Pending User Approvals</h3>
            <p>Approve new student and faculty account registrations.</p>
            <div className="card-footer-meta">
              <span>• OTP Verified</span>
              <span>• Email Dispatch</span>
            </div>
          </div>

          {/* Card 2: User Directory */}
          <div className="clean-grid-card border-blue" onClick={() => navigate("/admin/manage-users")}>
            <div className="card-top-bar">
              <div className="card-badge blue">DIRECTORY</div>
              <span className="card-arrow">→</span>
            </div>
            <h3>👥 Manage Platform Users</h3>
            <p>Search, filter, edit, or deactivate student and teacher accounts.</p>
            <div className="card-footer-meta">
              <span>• Search USN</span>
              <span>• Role Control</span>
            </div>
          </div>

          {/* Card 3: Platform Analytics */}
          <div className="clean-grid-card border-purple">
            <div className="card-top-bar">
              <div className="card-badge purple">SYSTEM METRICS</div>
              <span className="card-arrow">✓</span>
            </div>
            <h3>📊 Platform System Metrics</h3>
            <p>Monitor system uptime, total exam attempts, and active sessions.</p>
            <div className="card-footer-meta">
              <span>• Exam Attempts</span>
              <span>• Active Sessions</span>
            </div>
          </div>

          {/* Card 4: Governance */}
          <div className="clean-grid-card border-green">
            <div className="card-top-bar">
              <div className="card-badge green">GOVERNANCE</div>
              <span className="card-arrow">✓</span>
            </div>
            <h3>🛡️ Department Governance</h3>
            <p>Audit department performance metrics and question paper publishing velocity.</p>
            <div className="card-footer-meta">
              <span>• Velocity Audits</span>
              <span>• Pass Thresholds</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
