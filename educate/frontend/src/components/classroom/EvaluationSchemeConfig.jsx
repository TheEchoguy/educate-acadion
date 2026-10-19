import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { getEvaluationScheme, updateEvaluationScheme } from "../../services/classroomService";
import "./EvaluationSchemeConfig.css";

export default function EvaluationSchemeConfig({ classroomId, isTeacher = true }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scheme, setScheme] = useState(null);
  const [activePreset, setActivePreset] = useState("VTU_IPCC");

  const [formData, setFormData] = useState({
    courseCode: "BCS701",
    courseName: "Internet of Things",
    semester: 7,
    isLabIntegrated: true,
    iaCount: 3,
    iaRawMaxMarks: 40.0,
    iaScaledMaxMarks: 15.0,
    iaCalculationRule: "AVERAGE_ALL",
    assignmentRawMaxMarks: 25.0,
    assignmentScaledMaxMarks: 10.0,
    labRecordScaledMarks: 15.0,
    labTestRawMarks: 50.0,
    labTestScaledMarks: 10.0,
    cieTotalMaxMarks: 50.0,
    cieMinPassingMarks: 20.0,
    seeRawMaxMarks: 100.0,
    seeScaledMaxMarks: 50.0,
    seeMinPassingMarks: 18.0,
    totalPassMinMarks: 40.0,
  });

  useEffect(() => {
    let active = true;
    if (!classroomId) return;

    setLoading(true);
    getEvaluationScheme(classroomId)
      .then((data) => {
        if (!active) return;
        setScheme(data);
        setFormData({
          courseCode: data.courseCode || "BCS701",
          courseName: data.courseName || "Internet of Things",
          semester: data.semester || 7,
          isLabIntegrated: data.labIntegrated ?? data.isLabIntegrated ?? true,
          iaCount: data.iaCount || 3,
          iaRawMaxMarks: data.iaRawMaxMarks ?? 40.0,
          iaScaledMaxMarks: data.iaScaledMaxMarks ?? 15.0,
          iaCalculationRule: data.iaCalculationRule || "AVERAGE_ALL",
          assignmentRawMaxMarks: data.assignmentRawMaxMarks ?? 25.0,
          assignmentScaledMaxMarks: data.assignmentScaledMaxMarks ?? 10.0,
          labRecordScaledMarks: data.labRecordScaledMarks ?? 15.0,
          labTestRawMarks: data.labTestRawMarks ?? 50.0,
          labTestScaledMarks: data.labTestScaledMarks ?? 10.0,
          cieTotalMaxMarks: data.cieTotalMaxMarks ?? 50.0,
          cieMinPassingMarks: data.cieMinPassingMarks ?? 20.0,
          seeRawMaxMarks: data.seeRawMaxMarks ?? 100.0,
          seeScaledMaxMarks: data.seeScaledMaxMarks ?? 50.0,
          seeMinPassingMarks: data.seeMinPassingMarks ?? 18.0,
          totalPassMinMarks: data.totalPassMinMarks ?? 40.0,
        });

        if (data.labIntegrated ?? data.isLabIntegrated) {
          setActivePreset("VTU_IPCC");
        } else {
          setActivePreset("PURE_THEORY");
        }
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to load evaluation scheme");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [classroomId]);

  // Apply Presets
  const handleApplyPreset = (presetType) => {
    setActivePreset(presetType);
    if (presetType === "VTU_IPCC") {
      setFormData((prev) => ({
        ...prev,
        isLabIntegrated: true,
        iaCount: 3,
        iaRawMaxMarks: 40.0,
        iaScaledMaxMarks: 15.0,
        iaCalculationRule: "AVERAGE_ALL",
        assignmentRawMaxMarks: 25.0,
        assignmentScaledMaxMarks: 10.0,
        labRecordScaledMarks: 15.0,
        labTestRawMarks: 50.0,
        labTestScaledMarks: 10.0,
        cieTotalMaxMarks: 50.0,
        cieMinPassingMarks: 20.0,
        seeRawMaxMarks: 100.0,
        seeScaledMaxMarks: 50.0,
        seeMinPassingMarks: 18.0,
        totalPassMinMarks: 40.0,
      }));
      toast.success("Applied VTU IPCC Scheme (40->15 IA + 10 Assign + 25 Lab)");
    } else if (presetType === "PURE_THEORY") {
      setFormData((prev) => ({
        ...prev,
        isLabIntegrated: false,
        iaCount: 3,
        iaRawMaxMarks: 40.0,
        iaScaledMaxMarks: 25.0,
        iaCalculationRule: "AVERAGE_ALL",
        assignmentRawMaxMarks: 25.0,
        assignmentScaledMaxMarks: 25.0,
        labRecordScaledMarks: 0.0,
        labTestRawMarks: 0.0,
        labTestScaledMarks: 0.0,
        cieTotalMaxMarks: 50.0,
        cieMinPassingMarks: 20.0,
        seeRawMaxMarks: 100.0,
        seeScaledMaxMarks: 50.0,
        seeMinPassingMarks: 18.0,
        totalPassMinMarks: 40.0,
      }));
      toast.success("Applied Pure Theory Scheme (40->25 IA + 25 Assign)");
    }
  };

  const handleToggleLab = () => {
    setFormData((prev) => {
      const nextLab = !prev.isLabIntegrated;
      setActivePreset(nextLab ? "VTU_IPCC" : "PURE_THEORY");
      return {
        ...prev,
        isLabIntegrated: nextLab,
        labRecordScaledMarks: nextLab ? 15.0 : 0.0,
        labTestRawMarks: nextLab ? 50.0 : 0.0,
        labTestScaledMarks: nextLab ? 10.0 : 0.0,
        iaScaledMaxMarks: nextLab ? 15.0 : 25.0,
        assignmentScaledMaxMarks: nextLab ? 10.0 : 25.0,
      };
    });
  };

  const handleInputChange = (field, value) => {
    setActivePreset("CUSTOM");
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    try {
      setSaving(true);
      const updated = await updateEvaluationScheme(classroomId, formData);
      setScheme(updated);
      toast.success("Evaluation scheme updated successfully!");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to update evaluation scheme");
    } finally {
      setSaving(false);
    }
  };

  // Live Formula Calculations
  const iaScaled = Number(formData.iaScaledMaxMarks) || 0;
  const assignScaled = Number(formData.assignmentScaledMaxMarks) || 0;
  const labScaled = formData.isLabIntegrated
    ? (Number(formData.labRecordScaledMarks) || 0) + (Number(formData.labTestScaledMarks) || 0)
    : 0;
  const liveCieTotal = iaScaled + assignScaled + labScaled;
  const seeScaled = Number(formData.seeScaledMaxMarks) || 0;
  const grandTotal = liveCieTotal + seeScaled;

  if (loading) {
    return (
      <div className="eval-scheme-container" style={{ padding: 40, textAlign: "center" }}>
        <div className="spinner" style={{ margin: "0 auto 16px" }}></div>
        <p style={{ color: "#94a3b8" }}>Loading Subject Evaluation Scheme...</p>
      </div>
    );
  }

  // STUDENT VIEW (READ-ONLY)
  if (!isTeacher) {
    return (
      <div className="eval-scheme-container">
        <div className="student-eval-summary-card">
          <div className="student-eval-top">
            <div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                <span className="eval-card-badge badge-cie">{formData.courseCode}</span>
                <span className="eval-card-badge badge-pass">
                  {formData.isLabIntegrated ? "🔬 Integrated (Theory + Lab)" : "📖 Pure Theory"}
                </span>
                <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Semester {formData.semester}</span>
              </div>
              <h3>{formData.courseName}</h3>
              <p>Official syllabus marks distribution and minimum passing threshold standards.</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#a855f7" }}>
                {formData.cieTotalMaxMarks + formData.seeScaledMaxMarks} Marks
              </div>
              <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Course Total (CIE 50 + SEE 50)</span>
            </div>
          </div>

          <div className="student-breakdown-grid">
            {/* CIE BREAKDOWN */}
            <div className="student-breakdown-box">
              <h4>
                <span>📝</span> Continuous Internal Evaluation (CIE)
                <span className="eval-card-badge badge-cie" style={{ marginLeft: "auto" }}>
                  {formData.cieTotalMaxMarks} Marks
                </span>
              </h4>
              <div className="student-component-list">
                <div className="student-component-item">
                  <span>Internal Assessments ({formData.iaCount} Tests raw /{formData.iaRawMaxMarks})</span>
                  <strong>{formData.iaScaledMaxMarks} Marks</strong>
                </div>
                <div className="student-component-item">
                  <span>Assignments & Quizzes</span>
                  <strong>{formData.assignmentScaledMaxMarks} Marks</strong>
                </div>
                {formData.isLabIntegrated && (
                  <>
                    <div className="student-component-item">
                      <span>Lab Record & Conduction</span>
                      <strong>{formData.labRecordScaledMarks} Marks</strong>
                    </div>
                    <div className="student-component-item">
                      <span>Lab Internal Test (scaled from {formData.labTestRawMarks})</span>
                      <strong>{formData.labTestScaledMarks} Marks</strong>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* SEE BREAKDOWN */}
            <div className="student-breakdown-box">
              <h4>
                <span>🎓</span> Semester End Exam (SEE)
                <span className="eval-card-badge badge-see" style={{ marginLeft: "auto" }}>
                  {formData.seeScaledMaxMarks} Marks
                </span>
              </h4>
              <div className="student-component-list">
                <div className="student-component-item">
                  <span>Theory Written Exam Raw Max</span>
                  <strong>{formData.seeRawMaxMarks} Marks</strong>
                </div>
                <div className="student-component-item">
                  <span>Scaled Weightage in Final Grade</span>
                  <strong>{formData.seeScaledMaxMarks} Marks</strong>
                </div>
                <div className="student-component-item">
                  <span>Minimum Qualifying SEE Marks</span>
                  <strong>{formData.seeMinPassingMarks} / {formData.seeScaledMaxMarks} ({Math.round((formData.seeMinPassingMarks / formData.seeScaledMaxMarks) * 100)}%)</strong>
                </div>
              </div>
            </div>
          </div>

          {/* PASSING CRITERIA CHECKLIST */}
          <div className="student-passing-checklist">
            <h4 style={{ margin: "0 0 4px 0", color: "#4ade80", fontSize: "0.95rem" }}>
              ✓ Mandatory Passing Criteria (University & Institutional Norms)
            </h4>
            <div className="passing-check-row">
              <span className="check-icon">✓</span>
              <span><strong>CIE Minimum:</strong> Must score at least <strong>{formData.cieMinPassingMarks} out of {formData.cieTotalMaxMarks} (40%)</strong> to qualify for SEE eligibility.</span>
            </div>
            <div className="passing-check-row">
              <span className="check-icon">✓</span>
              <span><strong>SEE Minimum:</strong> Must score at least <strong>{formData.seeMinPassingMarks} out of {formData.seeScaledMaxMarks} (35% scaled)</strong> in the semester end exam.</span>
            </div>
            <div className="passing-check-row">
              <span className="check-icon">✓</span>
              <span><strong>Aggregate Minimum:</strong> Total combined (CIE + SEE) must be at least <strong>{formData.totalPassMinMarks} out of {formData.cieTotalMaxMarks + formData.seeScaledMaxMarks} (40%)</strong> to pass the course.</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // TEACHER VIEW (FULL EDITABLE & SCALING ENGINE)
  return (
    <div className="eval-scheme-container">
      {/* HEADER CARD WITH PRESETS */}
      <div className="eval-scheme-header-card">
        <div className="eval-scheme-title-col">
          <h2>
            <span>⚖️</span> Syllabus Evaluation Scheme & Marks Scaling
          </h2>
          <p>
            Configure weightages, internal assessments, assignment, lab scaling, and semester-end exam thresholds.
          </p>
        </div>

        <div className="eval-scheme-presets-row">
          <span className="eval-preset-label">Standard Presets:</span>
          <button
            type="button"
            className={`btn-preset ${activePreset === "VTU_IPCC" ? "active" : ""}`}
            onClick={() => handleApplyPreset("VTU_IPCC")}
          >
            VTU IPCC (15 IA + 10 Assign + 25 Lab)
          </button>
          <button
            type="button"
            className={`btn-preset ${activePreset === "PURE_THEORY" ? "active" : ""}`}
            onClick={() => handleApplyPreset("PURE_THEORY")}
          >
            Pure Theory (25 IA + 25 Assign)
          </button>
        </div>
      </div>

      {/* LIVE FORMULA CALCULATION BANNER */}
      <div className="eval-formula-banner">
        <div className="formula-top-row">
          <span className="formula-tag">
            <span>⚡</span> Live CIE Formula:
          </span>
          <div className="formula-breakdown-pills">
            <span className="pill-component">
              IA Scaled: <strong>{iaScaled}m</strong>
            </span>
            <span className="pill-operator">+</span>
            <span className="pill-component">
              Assignment: <strong>{assignScaled}m</strong>
            </span>
            {formData.isLabIntegrated && (
              <>
                <span className="pill-operator">+</span>
                <span className="pill-component">
                  Lab Components: <strong>{labScaled}m</strong>
                </span>
              </>
            )}
            <span className="pill-operator">=</span>
            <span className="pill-total">
              CIE Total: {liveCieTotal} / {formData.cieTotalMaxMarks} Marks
            </span>
          </div>
        </div>

        <div className="formula-criteria-bar">
          <div className="criteria-item">
            <span className="criteria-dot">●</span>
            <span>CIE Min Pass: <strong>{formData.cieMinPassingMarks} / {formData.cieTotalMaxMarks} (40%)</strong></span>
          </div>
          <div className="criteria-item">
            <span className="criteria-dot">●</span>
            <span>SEE Scaled: <strong>{seeScaled} Marks</strong> (Raw: {formData.seeRawMaxMarks}m)</span>
          </div>
          <div className="criteria-item">
            <span className="criteria-dot">●</span>
            <span>SEE Min Pass: <strong>{formData.seeMinPassingMarks} / {seeScaled} (35%)</strong></span>
          </div>
          <div className="criteria-item">
            <span className="criteria-dot">●</span>
            <span>Grand Total: <strong>{grandTotal} Marks</strong> (Min Pass: {formData.totalPassMinMarks}m)</span>
          </div>
        </div>
      </div>

      {/* CONFIGURATION FORM GRID */}
      <form onSubmit={handleSave} className="eval-scheme-grid">
        {/* CARD 1: GENERAL & COURSE METADATA */}
        <div className="eval-card">
          <div className="eval-card-header">
            <h3><span>🏷️</span> Course Identity</h3>
            <span className="eval-card-badge badge-cie">Meta</span>
          </div>

          <div className="eval-form-row">
            <div className="eval-form-group">
              <label>Course Code</label>
              <input
                type="text"
                value={formData.courseCode}
                onChange={(e) => handleInputChange("courseCode", e.target.value)}
                placeholder="e.g. BCS701"
              />
            </div>
            <div className="eval-form-group">
              <label>Semester</label>
              <input
                type="number"
                min="1"
                max="8"
                value={formData.semester}
                onChange={(e) => handleInputChange("semester", Number(e.target.value))}
              />
            </div>
          </div>

          <div className="eval-form-group">
            <label>Course / Subject Name</label>
            <input
              type="text"
              value={formData.courseName}
              onChange={(e) => handleInputChange("courseName", e.target.value)}
              placeholder="e.g. Internet of Things"
            />
          </div>

          <div className="eval-toggle-row">
            <div className="eval-toggle-info">
              <strong>Lab Integrated Course (IPCC)</strong>
              <span>Includes Practical Lab Record & Conduction in CIE</span>
            </div>
            <label className="switch-toggle">
              <input
                type="checkbox"
                checked={formData.isLabIntegrated}
                onChange={handleToggleLab}
              />
              <span className="slider-round"></span>
            </label>
          </div>
        </div>

        {/* CARD 2: INTERNAL ASSESSMENTS (IA) */}
        <div className="eval-card">
          <div className="eval-card-header">
            <h3><span>📝</span> Internal Assessment (IA) Tests</h3>
            <span className="eval-card-badge badge-cie">IA Component</span>
          </div>

          <div className="eval-form-row">
            <div className="eval-form-group">
              <label>No. of IA Tests</label>
              <input
                type="number"
                min="1"
                max="5"
                value={formData.iaCount}
                onChange={(e) => handleInputChange("iaCount", Number(e.target.value))}
              />
            </div>
            <div className="eval-form-group">
              <label>Raw Max Marks</label>
              <input
                type="number"
                step="0.5"
                value={formData.iaRawMaxMarks}
                onChange={(e) => handleInputChange("iaRawMaxMarks", Number(e.target.value))}
              />
            </div>
            <div className="eval-form-group">
              <label>Scaled Weight (CIE)</label>
              <input
                type="number"
                step="0.5"
                value={formData.iaScaledMaxMarks}
                onChange={(e) => handleInputChange("iaScaledMaxMarks", Number(e.target.value))}
              />
            </div>
          </div>

          <div className="eval-form-group">
            <label>IA Aggregation Rule</label>
            <select
              value={formData.iaCalculationRule}
              onChange={(e) => handleInputChange("iaCalculationRule", e.target.value)}
            >
              <option value="AVERAGE_ALL">Average of All {formData.iaCount} Tests</option>
              <option value="BEST_2">Average of Best 2 Tests</option>
              <option value="BEST_1">Best Single Test Score</option>
            </select>
          </div>
        </div>

        {/* CARD 3: ASSIGNMENTS & CONTINUOUS ACTIVITIES */}
        <div className="eval-card">
          <div className="eval-card-header">
            <h3><span>📑</span> Assignments & Quizzes</h3>
            <span className="eval-card-badge badge-cie">Assignment</span>
          </div>

          <div className="eval-form-row">
            <div className="eval-form-group">
              <label>Assignment Raw Marks</label>
              <input
                type="number"
                step="0.5"
                value={formData.assignmentRawMaxMarks}
                onChange={(e) => handleInputChange("assignmentRawMaxMarks", Number(e.target.value))}
              />
            </div>
            <div className="eval-form-group">
              <label>Scaled Weight (CIE)</label>
              <input
                type="number"
                step="0.5"
                value={formData.assignmentScaledMaxMarks}
                onChange={(e) => handleInputChange("assignmentScaledMaxMarks", Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* CARD 4: LAB COMPONENTS (CONDITIONAL) */}
        {formData.isLabIntegrated && (
          <div className="eval-card">
            <div className="eval-card-header">
              <h3><span>🔬</span> Practical / Lab Components</h3>
              <span className="eval-card-badge badge-cie">25m Lab Total</span>
            </div>

            <div className="eval-form-row">
              <div className="eval-form-group">
                <label>Lab Record Scaled</label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.labRecordScaledMarks}
                  onChange={(e) => handleInputChange("labRecordScaledMarks", Number(e.target.value))}
                />
              </div>
              <div className="eval-form-group">
                <label>Lab Test Raw Marks</label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.labTestRawMarks}
                  onChange={(e) => handleInputChange("labTestRawMarks", Number(e.target.value))}
                />
              </div>
              <div className="eval-form-group">
                <label>Lab Test Scaled</label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.labTestScaledMarks}
                  onChange={(e) => handleInputChange("labTestScaledMarks", Number(e.target.value))}
                />
              </div>
            </div>
          </div>
        )}

        {/* CARD 5: SEMESTER END EXAM (SEE) */}
        <div className="eval-card">
          <div className="eval-card-header">
            <h3><span>🎓</span> Semester End Exam (SEE)</h3>
            <span className="eval-card-badge badge-see">Theory SEE</span>
          </div>

          <div className="eval-form-row">
            <div className="eval-form-group">
              <label>SEE Raw Max Marks</label>
              <input
                type="number"
                step="0.5"
                value={formData.seeRawMaxMarks}
                onChange={(e) => handleInputChange("seeRawMaxMarks", Number(e.target.value))}
              />
            </div>
            <div className="eval-form-group">
              <label>SEE Scaled Max Marks</label>
              <input
                type="number"
                step="0.5"
                value={formData.seeScaledMaxMarks}
                onChange={(e) => handleInputChange("seeScaledMaxMarks", Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* CARD 6: MINIMUM PASSING THRESHOLDS */}
        <div className="eval-card">
          <div className="eval-card-header">
            <h3><span>🎯</span> Passing Thresholds</h3>
            <span className="eval-card-badge badge-pass">University Rules</span>
          </div>

          <div className="eval-form-row">
            <div className="eval-form-group">
              <label>CIE Min Pass (out of {formData.cieTotalMaxMarks})</label>
              <input
                type="number"
                step="0.5"
                value={formData.cieMinPassingMarks}
                onChange={(e) => handleInputChange("cieMinPassingMarks", Number(e.target.value))}
              />
            </div>
            <div className="eval-form-group">
              <label>SEE Min Pass (out of {formData.seeScaledMaxMarks})</label>
              <input
                type="number"
                step="0.5"
                value={formData.seeMinPassingMarks}
                onChange={(e) => handleInputChange("seeMinPassingMarks", Number(e.target.value))}
              />
            </div>
            <div className="eval-form-group">
              <label>Grand Total Min (out of 100)</label>
              <input
                type="number"
                step="0.5"
                value={formData.totalPassMinMarks}
                onChange={(e) => handleInputChange("totalPassMinMarks", Number(e.target.value))}
              />
            </div>
          </div>
        </div>
      </form>

      {/* SAVE BUTTON BAR */}
      <div className="eval-actions-bar">
        <button
          type="button"
          className="btn-save-scheme"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving Scheme..." : "💾 Save Evaluation Scheme"}
        </button>
      </div>
    </div>
  );
}
