import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { askRagTutor, getModuleNotesStatus } from "../../services/classroomService";
import toast from "react-hot-toast";
import "./RagStudyTutorSection.css";

const QUICK_QUESTIONS = [
  { module: 2, query: "What are the limitations of SNMP?", topic: "SNMP Limitations" },
  { module: 2, query: "Explain differences between IoT and M2M with communication protocols.", topic: "IoT vs M2M" },
  { module: 2, query: "Describe the SDN Architecture and OpenFlow Southbound interface.", topic: "SDN & OpenFlow" },
  { module: 2, query: "How does NFV virtualize the Home Gateway in IoT networks?", topic: "NFV Home Gateway" },
  { module: 2, query: "Explain IoT device management using NETCONF and YANG with Netopeer.", topic: "NETCONF-YANG" },
  { module: 1, query: "What are the core characteristics and physical design of IoT?", topic: "Physical Design of IoT" },
];

export default function RagStudyTutorSection({ classroomId, classroomName, isTeacher = false }) {
  const navigate = useNavigate();
  const [selectedModule, setSelectedModule] = useState(2);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversation, setConversation] = useState([]);
  const [moduleStatus, setModuleStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [expandedSources, setExpandedSources] = useState({});

  useEffect(() => {
    if (classroomId) {
      loadNotesStatus();
    }
  }, [classroomId]);

  const loadNotesStatus = async () => {
    try {
      setLoadingStatus(true);
      const res = await getModuleNotesStatus(classroomId);
      setModuleStatus(res?.modules || null);
    } catch (err) {
      console.warn("Could not load module notes status:", err);
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleAsk = async (questionText = query, modScope = selectedModule, topicName = null) => {
    const cleanQ = (questionText || "").trim();
    if (!cleanQ) {
      toast.error("Please enter a question about your course notes.");
      return;
    }

    const userMsg = {
      id: Date.now(),
      sender: "student",
      text: cleanQ,
      module: modScope,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setConversation((prev) => [...prev, userMsg]);
    setQuery("");
    setLoading(true);

    try {
      const payload = {
        query: cleanQ,
        focusModule: modScope && modScope !== "all" ? Number(modScope) : null,
        focusTopic: topicName || null,
      };

      const res = await askRagTutor(classroomId, payload);

      const aiMsg = {
        id: Date.now() + 1,
        sender: "tutor",
        answer: res.answer || "No response generated.",
        generationMode: res.generationMode || "LLM",
        sources: res.sources || [],
        tip: res.recommendedRevisionTip,
        focusModule: res.focusModule,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setConversation((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Tutor query failed. Please ensure the Python service is active.");
      const errorMsg = {
        id: Date.now() + 1,
        sender: "tutor",
        answer: "⚠️ Unable to contact AI Study Tutor service right now. Please verify course notes have been uploaded and try again.",
        sources: [],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setConversation((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const toggleSources = (msgId) => {
    setExpandedSources((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  const copyAnswer = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Answer copied to clipboard!");
  };

  const openFullscreenChat = () => {
    const url = `/student/tutor?classroomId=${classroomId}&module=${selectedModule || 2}`;
    navigate(url);
  };

  return (
    <div className="rag-study-section-container">
      {/* SECTION HEADER CARD */}
      <div className="rag-section-header-card">
        <div className="rag-header-info">
          <div className="rag-badge-row">
            <span className="rag-chip-pill">⚡ Grounded Academic RAG</span>
            <span className="rag-pulse-dot">● Active</span>
            <span className="rag-vtu-badge">VTU 2022 Scheme</span>
          </div>
          <h2>AI Study Tutor: Course Notes Knowledge Engine</h2>
          <p>
            Ask conceptual questions grounded strictly in official Module 1–5 lecture notes.
            All explanations include direct citations to <strong>Module & Section numbers</strong>,
            technical bullet points, and 10-mark exam tips.
          </p>
        </div>

        <div className="rag-header-actions">
          <button
            type="button"
            className="btn-open-fullscreen-chat"
            onClick={openFullscreenChat}
          >
            <span>Open Fullscreen Chat</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6"></path>
              <path d="M10 14L21 3"></path>
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            </svg>
          </button>
        </div>
      </div>

      {/* MODULE NOTES INDEX STATUS STRIP */}
      <div className="rag-module-status-strip">
        <div className="module-status-title">
          <span>📚 Module Notes Coverage</span>
          <span className="text-muted">Click a module to set search scope</span>
        </div>

        <div className="module-cards-grid">
          {[1, 2, 3, 4, 5].map((m) => {
            const modInfo = moduleStatus ? moduleStatus[String(m)] : null;
            const isIndexed = modInfo?.indexed;
            const isSelected = selectedModule === m;

            return (
              <div
                key={m}
                className={`module-status-card ${isIndexed ? "is-indexed" : "is-pending"} ${isSelected ? "is-selected" : ""}`}
                onClick={() => setSelectedModule(m)}
              >
                <div className="card-top-row">
                  <span className="mod-number">Module {m}</span>
                  <span className={`mod-badge ${isIndexed ? "badge-success" : "badge-warn"}`}>
                    {isIndexed ? "✓ Ready" : "Pending"}
                  </span>
                </div>
                <div className="mod-details">
                  <span className="mod-filename" title={modInfo?.filename || "Course Notes PDF"}>
                    {modInfo?.filename || `iot mod${m}.pdf`}
                  </span>
                  <span className="mod-chunks">
                    {isIndexed ? `${modInfo?.chunksCount || "Multi"} chunks indexed` : "Not uploaded yet"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SCOPE SELECTOR & QUICK PROMPTS */}
      <div className="rag-controls-bar">
        <div className="module-scope-filters">
          <span className="filter-label">Search Scope:</span>
          <button
            type="button"
            className={`scope-pill-btn ${selectedModule === "all" ? "active" : ""}`}
            onClick={() => setSelectedModule("all")}
          >
            All Modules
          </button>
          {[1, 2, 3, 4, 5].map((m) => (
            <button
              key={m}
              type="button"
              className={`scope-pill-btn ${selectedModule === m ? "active" : ""}`}
              onClick={() => setSelectedModule(m)}
            >
              Module {m}
            </button>
          ))}
        </div>

        <div className="quick-prompts-scroller">
          <span className="prompt-label">Quick Prompts:</span>
          {QUICK_QUESTIONS.map((q, idx) => (
            <button
              key={idx}
              type="button"
              className="quick-prompt-btn"
              onClick={() => {
                setSelectedModule(q.module);
                handleAsk(q.query, q.module, q.topic);
              }}
            >
              <span>{q.topic}</span>
              <span className="prompt-mod-tag">M{q.module}</span>
            </button>
          ))}
        </div>
      </div>

      {/* CONVERSATION AREA */}
      <div className="rag-conversation-viewport">
        {conversation.length === 0 ? (
          <div className="rag-empty-welcome">
            <div className="welcome-avatar-glow">🤖</div>
            <h3>How can I assist your course preparation today?</h3>
            <p>
              Ask any question from Module 1 to 5. The tutor performs deep semantic retrieval with context breadcrumbs,
              returning direct summaries, protocol flows, and 10-mark exam tips.
            </p>
            <div className="welcome-sample-chips">
              <button
                type="button"
                className="sample-chip"
                onClick={() => {
                  setSelectedModule(2);
                  handleAsk("What are the limitations of SNMP?", 2, "SNMP Limitations");
                }}
              >
                💡 "What are the limitations of SNMP?" (Module 2, Section 2.6)
              </button>
              <button
                type="button"
                className="sample-chip"
                onClick={() => {
                  setSelectedModule(2);
                  handleAsk("Explain differences between IoT and M2M with communication protocols.", 2, "IoT vs M2M");
                }}
              >
                📐 "Explain differences between IoT and M2M." (Module 2, Section 2.3)
              </button>
            </div>
          </div>
        ) : (
          <div className="rag-messages-stream">
            {conversation.map((msg) => (
              <div key={msg.id} className={`rag-chat-bubble-wrap ${msg.sender}`}>
                {msg.sender === "student" ? (
                  <div className="student-bubble">
                    <div className="bubble-meta">
                      <span className="bubble-author">You</span>
                      <span className="bubble-time">{msg.timestamp}</span>
                      {msg.module && <span className="bubble-scope-tag">Module {msg.module}</span>}
                    </div>
                    <div className="bubble-text">{msg.text}</div>
                  </div>
                ) : (
                  <div className="tutor-bubble">
                    <div className="bubble-meta">
                      <span className="bubble-author">
                        <span className="tutor-icon-spark">🎓</span>
                        Acadion Senior Academic Tutor
                      </span>
                      <span className="bubble-time">{msg.timestamp}</span>
                      <button
                        type="button"
                        className="btn-copy-bubble"
                        onClick={() => copyAnswer(msg.answer)}
                        title="Copy to clipboard"
                      >
                        Copy
                      </button>
                    </div>

                    <div className="tutor-answer-content">
                      {msg.generationMode === "EXTRACTIVE_FALLBACK" && (
                        <div style={{ background: "rgba(245, 158, 11, 0.15)", border: "1px solid rgba(245, 158, 11, 0.35)", borderRadius: "6px", padding: "6px 10px", marginBottom: "8px", color: "#fbbf24", fontSize: "0.82rem", fontWeight: 600 }}>
                          ⚠️ AI answer unavailable - showing note excerpts
                        </div>
                      )}
                      <pre className="academic-markdown-view">{msg.answer}</pre>
                    </div>

                    {/* CITATION & RETRIEVED SOURCES ACCORDION */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="sources-collapsible-wrapper">
                        <button
                          type="button"
                          className="sources-toggle-btn"
                          onClick={() => toggleSources(msg.id)}
                        >
                          <span>
                            📚 Grounded Sources ({msg.sources.length} excerpts retrieved)
                          </span>
                          <span>{expandedSources[msg.id] ? "▲ Hide" : "▼ Show Citations"}</span>
                        </button>

                        {expandedSources[msg.id] && (
                          <div className="sources-drawer-list">
                            {msg.sources.map((src, sIdx) => (
                              <div key={sIdx} className="source-item-card">
                                <div className="src-header-line">
                                  <span className="src-badge-mod">
                                    Module {src.module} • {src.section || "Lecture Notes"}
                                  </span>
                                  <span className="src-page-pill">Page {src.page}</span>
                                  <span className="src-file-name">{src.source}</span>
                                </div>
                                <p className="src-snippet-text">{src.excerpt || src.content || "Passage excerpt"}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="rag-chat-bubble-wrap tutor">
                <div className="tutor-bubble thinking-bubble">
                  <div className="thinking-dots">
                    <span className="dot"></span>
                    <span className="dot"></span>
                    <span className="dot"></span>
                  </div>
                  <span className="thinking-text">
                    Consulting Module {selectedModule === "all" ? "1-5" : selectedModule} course notes & synthesizing academic response...
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* INPUT FORM */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAsk();
        }}
        className="rag-input-composer-form"
      >
        <div className="composer-wrapper">
          <div className="composer-scope-tag">
            <span>Scoped to:</span>
            <strong>{selectedModule === "all" ? "All Modules" : `Module ${selectedModule}`}</strong>
          </div>
          <input
            type="text"
            className="composer-input"
            placeholder={
              selectedModule === "all"
                ? "Ask anything about IoT syllabus notes (e.g. SNMP limitations, SDN, M2M)..."
                : `Ask a question from Module ${selectedModule} course notes...`
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={loading}
          />
          <button
            type="submit"
            className="composer-send-btn"
            disabled={loading || !query.trim()}
          >
            {loading ? "Searching..." : "Ask Tutor →"}
          </button>
        </div>
      </form>
    </div>
  );
}
