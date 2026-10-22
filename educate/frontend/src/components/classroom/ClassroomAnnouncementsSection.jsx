import React, { useState, useEffect, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import {
  getClassroomAnnouncements,
  createClassroomAnnouncement,
  deleteClassroomAnnouncement,
  downloadAnnouncementAttachment,
} from "../../services/classroomService";
import "./ClassroomAnnouncementsSection.css";

export default function ClassroomAnnouncementsSection({
  classroomId,
  isTeacher = false,
  compact = false,
}) {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filterCategory, setFilterCategory] = useState("ALL");

  // Create Form State
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const [isPinned, setIsPinned] = useState(false);
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  const fileInputRef = useRef(null);

  const loadAnnouncements = useCallback(async () => {
    if (!classroomId) return;
    try {
      setLoading(true);
      const data = await getClassroomAnnouncements(classroomId);
      setAnnouncements(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load announcements:", err);
      // Suppress noisy toast on 404 or empty
      setAnnouncements([]);
    } finally {
      setLoading(false);
    }
  }, [classroomId]);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const handleFileChange = (e) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...selected]);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const dropped = Array.from(e.dataTransfer.files);
      setFiles((prev) => [...prev, ...dropped]);
    }
  };

  const handleRemoveFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter an announcement title");
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("message", message.trim());
      formData.append("category", category);
      formData.append("isPinned", isPinned ? "true" : "false");

      for (const file of files) {
        formData.append("files", file);
      }

      await createClassroomAnnouncement(classroomId, formData);
      toast.success("Notice & resources broadcasted successfully!");

      // Reset form
      setTitle("");
      setMessage("");
      setCategory("GENERAL");
      setIsPinned(false);
      setFiles([]);
      setShowCreateForm(false);
      loadAnnouncements();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to broadcast announcement");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (announcementId, annTitle) => {
    if (!window.confirm(`Delete notice "${annTitle || "this announcement"}"?`)) {
      return;
    }
    try {
      await deleteClassroomAnnouncement(classroomId, announcementId);
      toast.success("Announcement deleted");
      loadAnnouncements();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to delete announcement");
    }
  };

  const handleDownloadAttachment = async (announcementId, attachment) => {
    try {
      setDownloadingId(attachment.id);
      await downloadAnnouncementAttachment(
        classroomId,
        announcementId,
        attachment.id,
        attachment.fileName
      );
    } catch (err) {
      console.error("Download failed:", err);
      toast.error("Failed to download resource file");
    } finally {
      setDownloadingId(null);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatTimestamp = (instantStr) => {
    if (!instantStr) return "";
    try {
      const date = new Date(instantStr);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  // Sort pinned first, then by date descending
  const sortedAnnouncements = [...announcements].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });

  const filteredAnnouncements = sortedAnnouncements.filter((a) => {
    if (filterCategory === "ALL") return true;
    return (a.category || "GENERAL").toUpperCase() === filterCategory;
  });

  const getCategoryClass = (cat) => {
    const c = (cat || "GENERAL").toUpperCase();
    if (c === "NOTES") return "cat-notes";
    if (c === "ASSIGNMENT") return "cat-assignment";
    if (c === "EXAM_ALERT") return "cat-exam";
    return "cat-general";
  };

  const getCategoryLabel = (cat) => {
    const c = (cat || "GENERAL").toUpperCase();
    if (c === "NOTES") return "Lecture Notes";
    if (c === "ASSIGNMENT") return "Assignment Alert";
    if (c === "EXAM_ALERT") return "Exam Notice";
    return "General Broadcast";
  };

  return (
    <div className={`ca-container ${compact ? "ca-compact" : ""}`}>
      {/* Header Panel */}
      <div className="ca-header-panel">
        <div className="ca-header-left">
          <span className="ca-header-tag">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            Official Noticeboard &amp; Resources
          </span>
          <h2 className="ca-header-title">
            {isTeacher ? "📢 Classroom Noticeboard & Resource Broadcast" : "📢 Classroom Noticeboard & Shared Resources"}
          </h2>
          <p className="ca-header-desc">
            {isTeacher
              ? "Broadcast course announcements, syllabus updates, assignment guides, and lecture slide decks directly to enrolled students."
              : "Review official announcements, examination alerts, and 1-click downloadable study materials shared by your instructor."}
          </p>
        </div>

        {isTeacher && (
          <button
            type="button"
            className="ca-toggle-create-btn"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            {showCreateForm ? "✕ Close Studio" : "+ New Announcement"}
          </button>
        )}
      </div>

      {/* Creator Studio Card (Teacher Only) */}
      {isTeacher && showCreateForm && (
        <div className="ca-create-card">
          <h3 className="ca-create-title">
            <span>📢</span> Create New Announcement &amp; Resource Broadcast
          </h3>

          <form onSubmit={handleSubmit} className="ca-form-grid">
            <div className="ca-field-group">
              <label className="ca-label">Announcement Title *</label>
              <input
                type="text"
                className="ca-input"
                placeholder="e.g. Module 2 Question Bank & Assignment 1 Guidelines"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="ca-field-group">
              <label className="ca-label">Category</label>
              <div className="ca-category-row">
                {[
                  { key: "GENERAL", label: "General Notice" },
                  { key: "NOTES", label: "Lecture Notes & Slides" },
                  { key: "ASSIGNMENT", label: "Assignment Guidelines" },
                  { key: "EXAM_ALERT", label: "Exam Notice" },
                ].map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    className={`ca-category-btn ${getCategoryClass(cat.key)} ${category === cat.key ? "active" : ""}`}
                    onClick={() => setCategory(cat.key)}
                  >
                    {category === cat.key ? "✓ " : ""}{cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="ca-field-group">
              <label className="ca-label">Announcement Details / Message</label>
              <textarea
                className="ca-textarea"
                placeholder="Write your announcement details, lecture summary, or assignment instructions here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            <div className="ca-field-group">
              <label className="ca-label">Attach Resource Documents (PDF, PPTX, DOCX)</label>
              <div
                className="ca-dropzone"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  multiple
                  accept=".pdf,.pptx,.ppt,.docx,.doc,.xlsx,.xls,.zip,.png,.jpg"
                  onChange={handleFileChange}
                />
                <div className="ca-dropzone-icon">📁</div>
                <div className="ca-dropzone-text">Click or drag &amp; drop reference files here</div>
                <div className="ca-dropzone-subtext">Supports PDF Notes, PPTX Slide Decks, and DOCX Guidelines</div>
              </div>

              {files.length > 0 && (
                <div className="ca-pending-files">
                  {files.map((file, idx) => (
                    <div key={idx} className="ca-pending-pill">
                      <span>📄 {file.name}</span>
                      <span className="ca-file-size">({formatFileSize(file.size)})</span>
                      <button
                        type="button"
                        className="ca-remove-file-btn"
                        onClick={() => handleRemoveFile(idx)}
                        title="Remove file"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="ca-create-footer">
              <label className="ca-pin-checkbox-label">
                <input
                  type="checkbox"
                  className="ca-pin-checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                />
                <span>📌 Pin this notice to the top of the classroom feed</span>
              </label>

              <button
                type="submit"
                className="ca-submit-btn"
                disabled={submitting || !title.trim()}
              >
                {submitting ? "Broadcasting..." : "Broadcast to Students →"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter and Counter Bar */}
      <div className="ca-filter-bar">
        <div className="ca-filter-tabs">
          {[
            { key: "ALL", label: "All Feeds" },
            { key: "NOTES", label: "Lecture Notes" },
            { key: "ASSIGNMENT", label: "Assignments" },
            { key: "EXAM_ALERT", label: "Exam Notices" },
            { key: "GENERAL", label: "General" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`ca-filter-tab ${filterCategory === tab.key ? "active" : ""}`}
              onClick={() => setFilterCategory(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <span className="ca-count-badge">
          {filteredAnnouncements.length} {filteredAnnouncements.length === 1 ? "Notice" : "Notices"}
        </span>
      </div>

      {/* Announcements Feed List */}
      {loading ? (
        <div className="ca-loading-state">
          <div className="ca-spinner"></div>
          <p>Loading classroom noticeboard...</p>
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <div className="ca-empty-state">
          <div className="ca-empty-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          </div>
          <h3 className="ca-empty-title">No Announcements Posted Yet</h3>
          <p className="ca-empty-desc">
            {isTeacher
              ? "You haven't broadcast any notices or shared lecture resources for this classroom yet. Click '+ New Announcement' to publish your first note or assignment."
              : "Your course instructor has not broadcast any notices or shared lecture documents for this classroom yet. Check back soon!"}
          </p>
        </div>
      ) : (
        <div className="ca-feed-list">
          {filteredAnnouncements.map((item) => (
            <div
              key={item.id}
              className={`ca-item-card ${item.isPinned ? "is-pinned" : ""}`}
            >
              <div className="ca-item-top">
                <div className="ca-item-meta-group">
                  <span className={`ca-badge-category ${getCategoryClass(item.category)}`}>
                    {getCategoryLabel(item.category)}
                  </span>
                  {item.isPinned && (
                    <span className="ca-pinned-pill">
                      <span>📌</span> PINNED
                    </span>
                  )}
                  <span className="ca-author-name">{item.authorName || "Faculty Instructor"}</span>
                  <span className="ca-timestamp">• {formatTimestamp(item.createdAt)}</span>
                </div>

                {isTeacher && (
                  <button
                    type="button"
                    className="ca-delete-btn"
                    onClick={() => handleDelete(item.id, item.title)}
                    title="Delete notice"
                  >
                    🗑️ Delete
                  </button>
                )}
              </div>

              <h3 className="ca-item-title">{item.title}</h3>

              {item.message && <p className="ca-item-message">{item.message}</p>}

              {/* Attachments Section */}
              {item.attachedResources && item.attachedResources.length > 0 && (
                <div className="ca-attachments-container">
                  <span className="ca-attachments-label">
                    📎 Shared Course Resources ({item.attachedResources.length})
                  </span>
                  <div className="ca-attachments-grid">
                    {item.attachedResources.map((att) => (
                      <button
                        key={att.id}
                        type="button"
                        className="ca-download-pill"
                        onClick={() => handleDownloadAttachment(item.id, att)}
                        disabled={downloadingId === att.id}
                        title={`Click to download ${att.fileName}`}
                      >
                        <span className="ca-file-type-badge">
                          {att.fileType || "DOC"}
                        </span>
                        <span className="ca-file-name">{att.fileName}</span>
                        {att.fileSize > 0 && (
                          <span className="ca-file-size">({formatFileSize(att.fileSize)})</span>
                        )}
                        <span className="ca-download-arrow">
                          {downloadingId === att.id ? "⏳" : "↓"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
