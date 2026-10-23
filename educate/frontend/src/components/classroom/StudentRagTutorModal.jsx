import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { askRagTutor } from "../../services/classroomService";
import "./StudentRagTutorModal.css";

// Lightweight safe Markdown renderer for rich structured tutor responses
const renderMarkdown = (text) => {
  if (!text) return null;
  return (
    <div className="rag-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {text}
      </ReactMarkdown>
    </div>
  );

  const lines = text.split("\n");
  const elements = [];
  let inCodeBlock = false;
  let codeBuffer = [];
  let listBuffer = [];
  let listType = null; // 'ul' or 'ol'

  const flushList = () => {
    if (listBuffer.length > 0) {
      if (listType === "ul") {
        elements.push(
          <ul key={`ul-${elements.length}`}>
            {listBuffer.map((item, idx) => (
              <li key={idx}>{parseInline(item)}</li>
            ))}
          </ul>
        );
      } else {
        elements.push(
          <ol key={`ol-${elements.length}`}>
            {listBuffer.map((item, idx) => (
              <li key={idx}>{parseInline(item)}</li>
            ))}
          </ol>
        );
      }
      listBuffer = [];
      listType = null;
    }
  };

  const parseInline = (str) => {
    // Regex for bold **text**, inline code `code`, and italic *text*
    const parts = [];
    let remaining = str;
    let keyIdx = 0;

    while (remaining.length > 0) {
      // Bold match: **text**
      const boldMatch = remaining.match(/\*\*(.*?)\*\*/);
      // Code match: `code`
      const codeMatch = remaining.match(/`([^`]+)`/);

      let earliestMatch = null;
      let matchType = null;

      if (boldMatch && (!earliestMatch || boldMatch.index < earliestMatch.index)) {
        earliestMatch = boldMatch;
        matchType = "bold";
      }
      if (codeMatch && (!earliestMatch || codeMatch.index < earliestMatch.index)) {
        earliestMatch = codeMatch;
        matchType = "code";
      }

      if (!earliestMatch) {
        parts.push(remaining);
        break;
      }

      if (earliestMatch.index > 0) {
        parts.push(remaining.substring(0, earliestMatch.index));
      }

      if (matchType === "bold") {
        parts.push(<strong key={`b-${keyIdx++}`}>{earliestMatch[1]}</strong>);
      } else if (matchType === "code") {
        parts.push(<code key={`c-${keyIdx++}`}>{earliestMatch[1]}</code>);
      }

      remaining = remaining.substring(earliestMatch.index + earliestMatch[0].length);
    }

    return parts;
  };

  lines.forEach((line, lineIdx) => {
    const trimmed = line.trim();

    // Code block toggle
    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        flushList();
        elements.push(
          <pre key={`code-${lineIdx}`}>
            <code>{codeBuffer.join("\n")}</code>
          </pre>
        );
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        flushList();
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      return;
    }

    // Heading 3: ###
    if (trimmed.startsWith("### ")) {
      flushList();
      elements.push(<h3 key={`h3-${lineIdx}`}>{parseInline(trimmed.replace(/^###\s+/, ""))}</h3>);
      return;
    }

    // Heading 4: ####
    if (trimmed.startsWith("#### ")) {
      flushList();
      elements.push(<h4 key={`h4-${lineIdx}`}>{parseInline(trimmed.replace(/^####\s+/, ""))}</h4>);
      return;
    }

    // Unordered list item: - or *
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      if (listType !== "ul") flushList();
      listType = "ul";
      listBuffer.push(trimmed.replace(/^[-*]\s+/, ""));
      return;
    }

    // Ordered list item: 1. 2. etc
    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      if (listType !== "ol") flushList();
      listType = "ol";
      listBuffer.push(olMatch[2]);
      return;
    }

    // Regular line / Paragraph
    flushList();
    if (trimmed.length > 0) {
      elements.push(<p key={`p-${lineIdx}`}>{parseInline(line)}</p>);
    }
  });

  flushList();
  if (inCodeBlock && codeBuffer.length > 0) {
    elements.push(
      <pre key={`code-end`}>
        <code>{codeBuffer.join("\n")}</code>
      </pre>
    );
  }

  return <div className="rag-markdown">{elements}</div>;
};

const StudentRagTutorModal = ({
  classroomId,
  focusTopic = null,
  focusModule = null,
  assessmentName = "IA-1",
  deficitContext = null,
  onClose,
}) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    let greeting = "";
    let revisionTip = null;

    if (deficitContext) {
      const qCode = deficitContext.code ? deficitContext.code.toUpperCase() : "Q";
      const topic = deficitContext.topicName || focusTopic || "Syllabus Topic";
      const lost = deficitContext.deficitMarks != null ? deficitContext.deficitMarks : 0;
      const scored = deficitContext.marksScored != null ? deficitContext.marksScored : 0;
      const max = deficitContext.maxMarks != null ? deficitContext.maxMarks : 10;
      const err = deficitContext.cognitiveError || "Conceptual Gap";

      greeting = `### 🎯 Diagnostic Remediation: Sub-Q ${qCode} (${topic})\n` +
        `I identified a **-${lost.toFixed(1)} marks deficit** (${scored.toFixed(1)} / ${max.toFixed(1)} M) in ${assessmentName} attributed to: **${err}**.\n\n` +
        `**What to Refer to in Course Notes:**\n` +
        `- **Module ${deficitContext.moduleNumber || focusModule || 1} Textbook Notes**: Review the core definitions, governing equations, and operational working mechanism.\n` +
        `- **Expected Diagram Components**: Ensure all block interconnects, pin labels, and state transitions are explicitly annotated.\n` +
        `- **Model Derivation Standards**: Show intermediate algebraic steps and state assumptions to earn full marks.\n\n` +
        `Ask me anything below, or click any prompt to inspect benchmark solution guidelines and course note excerpts!`;

      revisionTip = `Focus on ${topic} in Module ${deficitContext.moduleNumber || focusModule || 1}: addressing "${err}" can recover up to +${lost.toFixed(1)} marks!`;
    } else if (focusTopic) {
      greeting = `I see you had difficulty with **${focusTopic}** in ${assessmentName}. How can I help you understand this topic from the course notes?`;
      revisionTip = `Review key diagrams and definitions for ${focusTopic} in your Module ${focusModule || 1} course notes.`;
    } else {
      greeting = `Hello! I am the Acadion Academic Tutor for this course. Ask me any question, and I will answer grounded directly in your uploaded Module 1–5 course notes!`;
    }

    setMessages([
      {
        sender: "tutor",
        text: greeting,
        sources: (focusModule || (deficitContext && deficitContext.moduleNumber))
          ? [
              {
                module: deficitContext?.moduleNumber || focusModule,
                page: 1,
                source: `Module ${deficitContext?.moduleNumber || focusModule} Course Notes`,
                excerpt: `Syllabus concepts, formula sheets, and textbook excerpts for ${focusTopic || deficitContext?.topicName || "Module " + focusModule}`,
              },
            ]
          : [],
        revisionTip,
      },
    ]);
  }, [focusTopic, focusModule, assessmentName, deficitContext]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSendMessage = async (textToSend = null) => {
    const query = (textToSend || inputText).trim();
    if (!query || loading) return;

    const userMessage = { sender: "student", text: query };
    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setLoading(true);

    try {
      const payload = {
        classroomId,
        query,
        focusTopic: deficitContext?.topicName || focusTopic,
        focusModule: deficitContext?.moduleNumber || focusModule,
        deficitReason: deficitContext?.cognitiveError,
        deficitQuestionCode: deficitContext?.code,
      };

      const response = await askRagTutor(classroomId, payload);
      const tutorMessage = {
        sender: "tutor",
        text: response.answer || "I could not find specific notes matching your query.",
        generationMode: response.generationMode || "LLM",
        sources: response.sources || [],
        revisionTip: response.recommendedRevisionTip || null,
        sourceMode: response.sourceMode || "grounded_rag",
      };
      setMessages((prev) => [...prev, tutorMessage]);
    } catch (err) {
      console.error("RAG Tutor chat error:", err);
      setMessages((prev) => [
        ...prev,
        {
          sender: "tutor",
          text:
            "Here is the standard academic guidance for this topic: Review the governing laws, draw clean block schematics with all signal directions labeled, and present step-by-step mathematical proofs with units.",
          sources: [],
          revisionTip: "Check your uploaded course lecture slides and recommended textbooks.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const activeTopic = deficitContext?.topicName || focusTopic;
  const qCode = deficitContext?.code ? deficitContext.code.toUpperCase() : null;

  const quickPrompts = deficitContext
    ? [
        `Show expected diagram & derivation steps for Sub-Q ${qCode}`,
        `Explain how to resolve "${deficitContext.cognitiveError}" in exam`,
        `Retrieve key textbook excerpts & formulas on ${activeTopic}`,
        `Give me a 1-question practice problem on ${activeTopic}`,
      ]
    : [
        activeTopic
          ? `Explain ${activeTopic} simply with an analogy`
          : "Explain the core architecture simply",
        activeTopic
          ? `What are the common exam questions on ${activeTopic}?`
          : "What are the common VTU exam questions?",
        activeTopic
          ? `Give me a 1-question practice quiz on ${activeTopic}`
          : "Give me a practice question with answer",
        "Summarize key advantages and trade-offs",
      ];

  return (
    <div className="rag-drawer-backdrop" onClick={onClose}>
      <div className="rag-drawer-panel flex flex-col h-screen max-h-screen overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* HEADER */}
        <div className="rag-header flex-shrink-0">
          <div className="rag-header-left">
            <div className="rag-bot-avatar">🤖</div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <h3 className="rag-title" style={{ margin: 0 }}>Acadion AI Study Tutor</h3>
                {deficitContext && (
                  <span style={{ background: "rgba(239, 68, 68, 0.2)", border: "1px solid rgba(239, 68, 68, 0.4)", color: "#fca5a5", fontSize: "0.72rem", padding: "2px 8px", borderRadius: "9999px", fontWeight: 700 }}>
                    RECOVER Sub-Q {qCode} (-{deficitContext.deficitMarks}M)
                  </span>
                )}
              </div>
              <p className="rag-subtitle">
                <span>Grounded directly in Module 1–5 Course Notes</span>
                {(focusModule || deficitContext?.moduleNumber) && (
                  <span className="rag-focus-tag">
                    Module {deficitContext?.moduleNumber || focusModule}
                    {activeTopic ? `: ${activeTopic}` : ""}
                  </span>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="rag-close-btn"
            onClick={onClose}
            title="Close Tutor"
          >
            ×
          </button>
        </div>

        {/* MESSAGES AREA */}
        <div className="rag-messages-area flex-1 min-h-0 overflow-y-auto">
          {messages.map((msg, idx) => (
            <div key={idx} className={`rag-msg ${msg.sender}`}>
              <div className="rag-bubble">
                {msg.generationMode === "EXTRACTIVE_FALLBACK" && (
                  <div style={{ background: "rgba(245, 158, 11, 0.15)", border: "1px solid rgba(245, 158, 11, 0.35)", borderRadius: "6px", padding: "6px 10px", marginBottom: "8px", color: "#fbbf24", fontSize: "0.82rem", fontWeight: 600 }}>
                    ⚠️ AI answer unavailable - showing note excerpts
                  </div>
                )}
                {renderMarkdown(msg.text)}

                {/* CITATION SOURCES PILLS */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="rag-sources-box">
                    <div className="rag-sources-header">
                      <span>📑 Cited Course Notes Sources:</span>
                    </div>
                    <div className="rag-source-pills-list">
                      {msg.sources.map((s, sIdx) => (
                        <div key={sIdx} className="rag-source-pill">
                          <span className="rag-source-loc">
                            Source: Module {s.module || focusModule || "Notes"}, Page {s.page || 1}{s.section ? ` • ${s.section}` : ""}
                          </span>
                          {s.excerpt && (
                            <span className="rag-source-excerpt">
                              "{s.excerpt.length > 120 ? s.excerpt.substring(0, 120) + "..." : s.excerpt}"
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* REVISION TIP */}
                {msg.revisionTip && (
                  <div className="rag-tip-box">
                    <span>💡</span>
                    <div>
                      <strong>Revision Tip: </strong>
                      <span>{msg.revisionTip}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="rag-msg tutor">
              <div className="rag-bubble" style={{ color: "#94a3b8", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>Retrieving course notes chunks & synthesizing tutor response...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* QUICK PROMPTS */}
        <div className="rag-quick-prompts-area flex-shrink-0">
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              type="button"
              className="rag-quick-btn"
              disabled={loading}
              onClick={() => handleSendMessage(p)}
            >
              💡 {p}
            </button>
          ))}
        </div>

        {/* INPUT BAR */}
        <div className="rag-input-bar flex-shrink-0 border-t border-slate-700/60">
          <input
            type="text"
            className="rag-input"
            placeholder={focusTopic ? `Ask anything about ${focusTopic} from notes...` : "Ask a question from course notes..."}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <button
            type="button"
            className="rag-send-btn"
            disabled={!inputText.trim() || loading}
            onClick={() => handleSendMessage()}
          >
            Send 🚀
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentRagTutorModal;
