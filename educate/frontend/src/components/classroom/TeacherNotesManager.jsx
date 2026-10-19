import React, { useState, useEffect } from "react";
import {
  getModuleNotesStatus,
  uploadModuleNotes,
  askRagTutor,
} from "../../services/classroomService";
import StudentRagTutorModal from "./StudentRagTutorModal";
import "./TeacherNotesManager.css";

const MODULE_TITLES = {
  1: "Module 1: IoT Architecture & Core Fundamentals",
  2: "Module 2: Network & Application Layer Protocols",
  3: "Module 3: Fog/Edge Computing & Smart Sensors",
  4: "Module 4: Security, Privacy & Cloud Platforms",
  5: "Module 5: Real-World Industry & VTU Case Studies",
};

const TeacherNotesManager = ({ classroomId }) => {
  const [statusData, setStatusData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState({});
  const [uploadingModule, setUploadingModule] = useState(null);
  const [alertMsg, setAlertMsg] = useState(null);
  const [previewTutorModal, setPreviewTutorModal] = useState({
    isOpen: false,
    focusModule: null,
    focusTopic: null,
  });

  const loadStatus = async () => {
    if (!classroomId) return;
    try {
      setLoading(true);
      const res = await getModuleNotesStatus(classroomId);
      setStatusData(res);
    } catch (err) {
      console.warn("Could not load RAG notes status:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, [classroomId]);

  const handleFileChange = (moduleNumber, file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setAlertMsg({ type: "error", text: "Please upload a valid .pdf course notes document." });
      return;
    }
    setSelectedFiles((prev) => ({
      ...prev,
      [moduleNumber]: file,
    }));
    setAlertMsg(null);
  };

  const handleUpload = async (moduleNumber) => {
    const file = selectedFiles[moduleNumber];
    if (!file) return;

    try {
      setUploadingModule(moduleNumber);
      setAlertMsg(null);

      const res = await uploadModuleNotes(classroomId, moduleNumber, file);
      setAlertMsg({
        type: "success",
        text: `Module ${moduleNumber} notes uploaded & indexed successfully! (${res.chunksIndexed || "All"} vector chunks ready)`,
      });

      // Clear the selected file and refresh status
      setSelectedFiles((prev) => {
        const next = { ...prev };
        delete next[moduleNumber];
        return next;
      });
      await loadStatus();
    } catch (err) {
      console.error("Upload error:", err);
      setAlertMsg({
        type: "error",
        text: err.response?.data?.message || `Failed to index Module ${moduleNumber} notes.`,
      });
    } finally {
      setUploadingModule(null);
    }
  };

  const openPreviewTutor = (modNum) => {
    setPreviewTutorModal({
      isOpen: true,
      focusModule: modNum,
      focusTopic: `Module ${modNum} Core Syllabus Concepts`,
    });
  };

  const totalIndexed = statusData?.totalIndexedModules || 0;

  return (
    <div className="tnm-container">
      {/* 1. HERO BANNER */}
      <div className="tnm-hero-card">
        <div className="tnm-hero-info">
          <div className="tnm-hero-icon">📚</div>
          <div>
            <h3 className="tnm-hero-title">Course Notes Vector RAG Knowledge Base</h3>
            <p className="tnm-hero-sub">
              Upload your official course notes PDFs (e.g. <code>iot mod1.pdf</code> to <code>iot mod5.pdf</code>).
              The Retrieval-Augmented Generation (RAG) engine chunks, indexes, and grounds AI tutor responses
              with exact module numbers and page citations for students.
            </p>
          </div>
        </div>

        <div className="tnm-hero-badge">
          <span>{totalIndexed} / 5 Modules Indexed</span>
          {totalIndexed === 5 && <span>✨ Full Coverage</span>}
        </div>
      </div>

      {/* FEEDBACK ALERT */}
      {alertMsg && (
        <div
          style={{
            padding: "12px 18px",
            borderRadius: "10px",
            fontSize: "0.9rem",
            background: alertMsg.type === "success" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
            border: `1px solid ${alertMsg.type === "success" ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
            color: alertMsg.type === "success" ? "#34d399" : "#fca5a5",
          }}
        >
          {alertMsg.type === "success" ? "✅" : "⚠️"} {alertMsg.text}
        </div>
      )}

      {/* 2. MODULE CARDS (1 to 5) */}
      <div className="tnm-modules-grid">
        {[1, 2, 3, 4, 5].map((modNum) => {
          const modInfo = statusData?.modules ? statusData.modules[String(modNum)] : null;
          const isIndexed = modInfo && modInfo.indexed;
          const isUploading = uploadingModule === modNum;
          const currentFile = selectedFiles[modNum];

          return (
            <div
              key={modNum}
              className={`tnm-module-card ${isIndexed ? "indexed" : ""}`}
            >
              <div className="tnm-card-header">
                <div className="tnm-card-title-group">
                  <span className="tnm-mod-badge">M{modNum}</span>
                  <h4 className="tnm-mod-title">Module {modNum} Notes</h4>
                </div>

                <span className={`tnm-status-pill ${isIndexed ? "ready" : "pending"}`}>
                  {isIndexed ? "✅ Indexed & Ready" : "⚠️ Needs PDF"}
                </span>
              </div>

              <div className="tnm-card-body">
                <div style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
                  {MODULE_TITLES[modNum]}
                </div>

                {isIndexed && (
                  <div className="tnm-indexed-meta">
                    <div>
                      <strong>Source File: </strong>
                      <span className="tnm-file-name">{modInfo.fileName || `iot mod${modNum}.pdf`}</span>
                    </div>
                    <div>
                      <strong>Vector Chunks: </strong>
                      <span>{modInfo.chunksCount || 0} chunks indexed</span>
                    </div>
                    {modInfo.indexedAt && (
                      <div style={{ color: "#64748b", fontSize: "0.75rem" }}>
                        Indexed: {new Date(modInfo.indexedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                )}

                {/* DROPZONE / FILE PICKER */}
                <div className="tnm-dropzone">
                  <label className="tnm-dropzone-label">
                    <span className="tnm-dropzone-icon">📄</span>
                    {currentFile ? (
                      <span className="tnm-selected-file">
                        Selected: {currentFile.name} ({(currentFile.size / 1024).toFixed(1)} KB)
                      </span>
                    ) : (
                      <span>
                        {isIndexed ? "Select new PDF to replace notes" : "Click to select Module " + modNum + " PDF"}
                      </span>
                    )}
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileChange(modNum, e.target.files[0]);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="tnm-card-footer">
                <button
                  type="button"
                  className="tnm-upload-btn"
                  disabled={!currentFile || isUploading}
                  onClick={() => handleUpload(modNum)}
                >
                  {isUploading ? "Indexing Vector Chunks..." : isIndexed ? "Re-Index Notes" : "Upload & Vectorize"}
                </button>

                {isIndexed && (
                  <button
                    type="button"
                    className="tnm-test-btn"
                    title="Preview AI Tutor responses on this module"
                    onClick={() => openPreviewTutor(modNum)}
                  >
                    🤖 Test Tutor
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. STUDENT RAG TUTOR MODAL FOR PREVIEWS */}
      {previewTutorModal.isOpen && (
        <StudentRagTutorModal
          classroomId={classroomId}
          focusModule={previewTutorModal.focusModule}
          focusTopic={previewTutorModal.focusTopic}
          onClose={() =>
            setPreviewTutorModal({
              isOpen: false,
              focusModule: null,
              focusTopic: null,
            })
          }
        />
      )}
    </div>
  );
};

export default TeacherNotesManager;
