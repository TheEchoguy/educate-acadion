import { useState } from "react";

function getInitialFormData(initialData) {
  if (initialData) {
    return {
      unit: initialData.unit || "",
      topic: initialData.topic || "",
      description: initialData.description || "",
      status: initialData.status || "NOT_STARTED",
      estimatedHours:
        initialData.estimatedHours !== null && initialData.estimatedHours !== undefined
          ? initialData.estimatedHours
          : "",
      plannedStartDate: initialData.plannedStartDate || "",
      plannedCompletionDate: initialData.plannedCompletionDate || "",
      teachingNotes: initialData.teachingNotes || "",
      referenceMaterials: initialData.referenceMaterials || "",
      learningObjectives: Array.isArray(initialData.learningObjectives)
        ? [...initialData.learningObjectives]
        : [],
      learningResources: Array.isArray(initialData.learningResources)
        ? initialData.learningResources.map((r) => ({ label: r.label || "", url: r.url || "" }))
        : [],
    };
  }
  return {
    unit: "",
    topic: "",
    description: "",
    status: "NOT_STARTED",
    estimatedHours: "",
    plannedStartDate: "",
    plannedCompletionDate: "",
    teachingNotes: "",
    referenceMaterials: "",
    learningObjectives: [],
    learningResources: [],
  };
}

function SyllabusTopicModalContent({ onClose, onSave, initialData }) {
  const [formData, setFormData] = useState(() => getInitialFormData(initialData));
  const [newObjective, setNewObjective] = useState("");
  const [newResource, setNewResource] = useState({ label: "", url: "" });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!formData.unit.trim()) {
      errs.unit = "Unit name or number is required";
    }
    if (!formData.topic.trim()) {
      errs.topic = "Topic title is required";
    }
    if (formData.plannedStartDate && formData.plannedCompletionDate) {
      if (new Date(formData.plannedStartDate) > new Date(formData.plannedCompletionDate)) {
        errs.plannedCompletionDate = "Completion date cannot be before start date";
      }
    }
    if (
      formData.estimatedHours !== "" &&
      (isNaN(Number(formData.estimatedHours)) || Number(formData.estimatedHours) < 0)
    ) {
      errs.estimatedHours = "Hours must be a valid positive number";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setSaving(true);
      const payload = {
        unit: formData.unit.trim(),
        topic: formData.topic.trim(),
        description: formData.description.trim() || null,
        status: formData.status,
        estimatedHours: formData.estimatedHours !== "" ? Number(formData.estimatedHours) : null,
        plannedStartDate: formData.plannedStartDate || null,
        plannedCompletionDate: formData.plannedCompletionDate || null,
        teachingNotes: formData.teachingNotes.trim() || null,
        referenceMaterials: formData.referenceMaterials.trim() || null,
        learningObjectives: formData.learningObjectives,
        learningResources: formData.learningResources.filter((r) => r.label || r.url),
      };

      await onSave(payload);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddObjective = () => {
    if (!newObjective.trim()) return;
    setFormData((prev) => ({
      ...prev,
      learningObjectives: [...prev.learningObjectives, newObjective.trim()],
    }));
    setNewObjective("");
  };

  const handleRemoveObjective = (index) => {
    setFormData((prev) => ({
      ...prev,
      learningObjectives: prev.learningObjectives.filter((_, i) => i !== index),
    }));
  };

  const handleAddResource = () => {
    if (!newResource.label.trim() && !newResource.url.trim()) return;
    setFormData((prev) => ({
      ...prev,
      learningResources: [...prev.learningResources, { ...newResource }],
    }));
    setNewResource({ label: "", url: "" });
  };

  const handleRemoveResource = (index) => {
    setFormData((prev) => ({
      ...prev,
      learningResources: prev.learningResources.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="tsm-modal-backdrop" onClick={onClose}>
      <div className="tsm-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="tsm-modal-header">
          <h2 className="tsm-modal-title">
            {initialData ? "✏️ Edit Syllabus Topic" : "➕ Add New Syllabus Topic"}
          </h2>
          <button type="button" className="tsm-modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "contents" }}>
          <div className="tsm-modal-body">
            {/* Unit & Topic Title */}
            <div className="tsm-form-row">
              <div className="tsm-form-group">
                <label className="tsm-form-label">Unit / Module *</label>
                <input
                  type="text"
                  className="tsm-form-input"
                  placeholder="e.g. Unit 1: Foundations"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                />
                {errors.unit && <span style={{ color: "#f87171", fontSize: "0.75rem" }}>{errors.unit}</span>}
              </div>

              <div className="tsm-form-group">
                <label className="tsm-form-label">Teaching Status</label>
                <select
                  className="tsm-form-select"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="NOT_STARTED">Not Started</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
            </div>

            <div className="tsm-form-group">
              <label className="tsm-form-label">Topic Title *</label>
              <input
                type="text"
                className="tsm-form-input"
                placeholder="e.g. Binary Search Trees & Balanced AVL Trees"
                value={formData.topic}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
              />
              {errors.topic && <span style={{ color: "#f87171", fontSize: "0.75rem" }}>{errors.topic}</span>}
            </div>

            <div className="tsm-form-group">
              <label className="tsm-form-label">Description</label>
              <textarea
                className="tsm-form-textarea"
                rows={2}
                placeholder="High-level summary of concepts covered in this topic..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            {/* Schedule & Hours */}
            <div className="tsm-form-row">
              <div className="tsm-form-group">
                <label className="tsm-form-label">Estimated Teaching Hours</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  className="tsm-form-input"
                  placeholder="e.g. 4.0"
                  value={formData.estimatedHours}
                  onChange={(e) => setFormData({ ...formData, estimatedHours: e.target.value })}
                />
                {errors.estimatedHours && (
                  <span style={{ color: "#f87171", fontSize: "0.75rem" }}>{errors.estimatedHours}</span>
                )}
              </div>

              <div className="tsm-form-group">
                <label className="tsm-form-label">Planned Start Date</label>
                <input
                  type="date"
                  className="tsm-form-input"
                  value={formData.plannedStartDate}
                  onChange={(e) => setFormData({ ...formData, plannedStartDate: e.target.value })}
                />
              </div>
            </div>

            <div className="tsm-form-row">
              <div className="tsm-form-group">
                <label className="tsm-form-label">Planned Completion Date</label>
                <input
                  type="date"
                  className="tsm-form-input"
                  value={formData.plannedCompletionDate}
                  onChange={(e) => setFormData({ ...formData, plannedCompletionDate: e.target.value })}
                />
                {errors.plannedCompletionDate && (
                  <span style={{ color: "#f87171", fontSize: "0.75rem" }}>{errors.plannedCompletionDate}</span>
                )}
              </div>

              <div className="tsm-form-group">
                <label className="tsm-form-label">Reference Materials</label>
                <input
                  type="text"
                  className="tsm-form-input"
                  placeholder="Textbook ch. 4, IEEE paper..."
                  value={formData.referenceMaterials}
                  onChange={(e) => setFormData({ ...formData, referenceMaterials: e.target.value })}
                />
              </div>
            </div>

            {/* Learning Objectives */}
            <div className="tsm-form-group">
              <label className="tsm-form-label">Learning Objectives</label>
              <div className="tsm-dynamic-row">
                <input
                  type="text"
                  className="tsm-form-input"
                  style={{ flex: 1 }}
                  placeholder="Add specific learning objective..."
                  value={newObjective}
                  onChange={(e) => setNewObjective(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddObjective();
                    }
                  }}
                />
                <button type="button" className="tsm-btn-secondary" onClick={handleAddObjective}>
                  + Add
                </button>
              </div>
              {formData.learningObjectives.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                  {formData.learningObjectives.map((obj, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        background: "rgba(255,255,255,0.04)",
                        padding: "6px 10px",
                        borderRadius: 6,
                        fontSize: "0.82rem",
                      }}
                    >
                      <span>• {obj}</span>
                      <button
                        type="button"
                        style={{ background: "none", color: "#f87171", cursor: "pointer" }}
                        onClick={() => handleRemoveObjective(i)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Teaching Notes */}
            <div className="tsm-form-group">
              <label className="tsm-form-label">Teacher-Only Notes</label>
              <textarea
                className="tsm-form-textarea"
                rows={2}
                placeholder="Internal pedagogical notes, lab demonstrations or quiz pointers..."
                value={formData.teachingNotes}
                onChange={(e) => setFormData({ ...formData, teachingNotes: e.target.value })}
              />
            </div>

            {/* Learning Resources */}
            <div className="tsm-form-group">
              <label className="tsm-form-label">External Learning Resources (URLs)</label>
              <div className="tsm-form-row">
                <input
                  type="text"
                  className="tsm-form-input"
                  placeholder="Resource Label (e.g. Visualizer Tool)"
                  value={newResource.label}
                  onChange={(e) => setNewResource({ ...newResource, label: e.target.value })}
                />
                <input
                  type="url"
                  className="tsm-form-input"
                  placeholder="URL (https://...)"
                  value={newResource.url}
                  onChange={(e) => setNewResource({ ...newResource, url: e.target.value })}
                />
              </div>
              <button
                type="button"
                className="tsm-btn-secondary"
                style={{ alignSelf: "flex-start", marginTop: 6 }}
                onClick={handleAddResource}
              >
                + Add Resource Link
              </button>

              {formData.learningResources.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                  {formData.learningResources.map((res, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        background: "rgba(255,255,255,0.04)",
                        padding: "6px 10px",
                        borderRadius: 6,
                        fontSize: "0.82rem",
                      }}
                    >
                      <div>
                        <strong>{res.label || "Link"}:</strong>{" "}
                        <span style={{ color: "#38bdf8" }}>{res.url}</span>
                      </div>
                      <button
                        type="button"
                        style={{ background: "none", color: "#f87171", cursor: "pointer" }}
                        onClick={() => handleRemoveResource(i)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="tsm-modal-footer">
            <button type="button" className="tsm-btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="tsm-btn-primary" disabled={saving}>
              {saving ? "Saving..." : initialData ? "Save Changes" : "Create Topic"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SyllabusTopicModal({ isOpen, onClose, onSave, initialData }) {
  if (!isOpen) return null;

  return (
    <SyllabusTopicModalContent
      key={initialData?.id || "new-syllabus-topic"}
      onClose={onClose}
      onSave={onSave}
      initialData={initialData}
    />
  );
}
