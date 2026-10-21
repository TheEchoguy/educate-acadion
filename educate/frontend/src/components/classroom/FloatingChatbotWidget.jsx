import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./FloatingChatbotWidget.css";

function FloatingChatbotWidget({ defaultClassroomId = null, targetPath = "/student/tutor" }) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const handleOpenChat = (promptQuery = null) => {
    let url = targetPath;
    const params = new URLSearchParams();
    if (defaultClassroomId) {
      params.append("classroomId", defaultClassroomId);
    }
    if (promptQuery) {
      params.append("q", promptQuery);
    }
    const queryStr = params.toString();
    if (queryStr) {
      url += `?${queryStr}`;
    }
    navigate(url);
    setIsOpen(false);
  };

  return (
    <div className="floating-chatbot-container">
      {/* Popover Preview Card */}
      {isOpen && (
        <div className="floating-chatbot-popover" role="dialog" aria-label="Acadion AI Study Tutor Preview">
          <div className="popover-header">
            <div className="popover-header-title">
              <div className="floating-chatbot-icon-wrap" style={{ width: 34, height: 34 }}>
                <svg className="floating-chatbot-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
                  <rect x="4" y="8" width="16" height="12" rx="4" />
                  <circle cx="9" cy="13" r="1.5" fill="currentColor" />
                  <circle cx="15" cy="13" r="1.5" fill="currentColor" />
                  <path d="M10 17h4" />
                </svg>
              </div>
              <div className="popover-title-text">
                <h4>Acadion AI Study Tutor</h4>
                <span>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
                  Grounded on VTU Notes
                </span>
              </div>
            </div>
            <button
              type="button"
              className="popover-close-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="popover-body">
            <p className="popover-desc">
              Your 24/7 academic copilot grounded exclusively on Module 1–5 IoT syllabus notes with verifiable section citations.
            </p>

            <div className="popover-feature-badges">
              <div className="popover-feature-item">
                <span className="popover-feature-icon">📚</span>
                <span><strong>Modules 1–5 Grounded:</strong> Zero-hallucination textbook citations</span>
              </div>
              <div className="popover-feature-item">
                <span className="popover-feature-icon">🎯</span>
                <span><strong>Exam Tip Structure:</strong> Summary, details, diagrams & key tips</span>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <span style={{ fontSize: "0.74rem", textTransform: "uppercase", color: "#94a3b8", fontWeight: 700, letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>
                Popular Study Queries:
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  "Explain SNMP with architecture and its limitations",
                  "Differentiate between IoT and M2M with key parameters",
                  "What are the 6 security challenges in IoT deployment?",
                ].map((query, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleOpenChat(query)}
                    style={{
                      background: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: 8,
                      padding: "8px 12px",
                      textAlign: "left",
                      color: "#93c5fd",
                      fontSize: "0.78rem",
                      cursor: "pointer",
                      transition: "all 0.15s",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(56, 189, 248, 0.15)";
                      e.currentTarget.style.borderColor = "rgba(56, 189, 248, 0.4)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                      e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
                    }}
                  >
                    <span>{query}</span>
                    <span style={{ color: "#38bdf8", marginLeft: 8 }}>→</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="popover-actions">
              <button
                type="button"
                className="popover-btn-primary"
                onClick={() => handleOpenChat()}
              >
                <span>Launch Fullscreen Chatbot UI</span>
                <span>↗</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Trigger Pill */}
      <button
        type="button"
        className="floating-chatbot-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle AI Study Tutor"
      >
        <div className="floating-chatbot-icon-wrap">
          <svg className="floating-chatbot-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
            <rect x="4" y="8" width="16" height="12" rx="4" />
            <circle cx="9" cy="13" r="1.5" fill="currentColor" />
            <circle cx="15" cy="13" r="1.5" fill="currentColor" />
            <path d="M10 17h4" />
          </svg>
          <span className="floating-chatbot-pulse" />
        </div>

        <div className="floating-chatbot-text">
          <span className="floating-chatbot-title">AI Study Tutor</span>
          <span className="floating-chatbot-subtitle">
            RAG Agent <span className="floating-chatbot-pill-tag">ACTIVE</span>
          </span>
        </div>
      </button>
    </div>
  );
}

export default FloatingChatbotWidget;
