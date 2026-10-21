import React, { useState, useEffect } from "react";
import {
  downloadIaTemplate,
  downloadIaSampleTemplate,
  downloadMasterTemplate,
  exportMasterReport,
  uploadMasterSheet,
  uploadIaMarks,
  saveManualMarks,
  getIaRecordsByNumber,
  getStudentIaBreakdown,
  getBlueprint,
  parseQuestionPaper,
  updateBlueprint,
  generateBlueprint,
  publishIaMarks,
  getIaPublishStatus,
  resetIaMarks,
} from "../../services/classroomService";
import "./IaMarksUploadSection.css";

const IaMarksUploadSection = ({ classroomId, classroomName, enrolledStudents = [] }) => {
  const [activeStep, setActiveStep] = useState(1); // 1: Blueprint, 2: Excel Ingestion / Manual Grid
  const [entryMode, setEntryMode] = useState("excel"); // 'excel' | 'manual'
  const [manualMarks, setManualMarks] = useState({}); // { [usn]: { [code]: value } }
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [selectedIa, setSelectedIa] = useState(1);
  const [uploadMode, setUploadMode] = useState("master"); // 'master' | 'single'
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: string, summary: object }
  const [iaRecords, setIaRecords] = useState([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Publish / Draft Confirmation State
  const [publishStatus, setPublishStatus] = useState(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isIngestedDropdownOpen, setIsIngestedDropdownOpen] = useState(true);
  const [isResettingMarks, setIsResettingMarks] = useState(false);

  // Blueprint & Paper Parser State
  const [blueprint, setBlueprint] = useState(null);
  const [isLoadingBlueprint, setIsLoadingBlueprint] = useState(false);
  const [paperFile, setPaperFile] = useState(null);
  const [isParsingPaper, setIsParsingPaper] = useState(false);
  const [isSavingBlueprint, setIsSavingBlueprint] = useState(false);
  const [isConfirmingBlueprint, setIsConfirmingBlueprint] = useState(false);
  const [applyToAll, setApplyToAll] = useState(false);

  // Student breakdown modal state
  const [inspectStudentUsn, setInspectStudentUsn] = useState(null);
  const [studentBreakdown, setStudentBreakdown] = useState(null);
  const [isLoadingBreakdown, setIsLoadingBreakdown] = useState(false);

  // Load records and blueprint for selected IA on mount or change
  useEffect(() => {
    if (classroomId) {
      loadIaRecords(selectedIa);
      loadBlueprint(selectedIa);
      loadPublishStatus();
    }
  }, [classroomId, selectedIa]);

  const loadPublishStatus = async () => {
    try {
      const status = await getIaPublishStatus(classroomId);
      setPublishStatus(status);
    } catch (err) {
      console.error("Failed to load publish status:", err);
    }
  };

  // Synchronize manualMarks state whenever iaRecords change
  useEffect(() => {
    if (iaRecords && iaRecords.length > 0) {
      const initial = {};
      iaRecords.forEach((r) => {
        const u = (r.usn || "").trim().toUpperCase();
        if (u && r.questionMarks) {
          initial[u] = { ...r.questionMarks };
        }
      });
      setManualMarks((prev) => ({ ...initial, ...prev }));
    }
  }, [iaRecords]);

  // Combine roster from enrolledStudents and any existing records + default test members
  const getRoster = () => {
    const map = new Map();
    if (enrolledStudents && enrolledStudents.length > 0) {
      enrolledStudents.forEach((st) => {
        const u = (st.usn || "").trim().toUpperCase();
        if (u) map.set(u, { usn: u, name: st.name || "Student" });
      });
    }
    if (iaRecords && iaRecords.length > 0) {
      iaRecords.forEach((r) => {
        const u = (r.usn || "").trim().toUpperCase();
        if (u && !map.has(u)) {
          map.set(u, { usn: u, name: r.studentName || "Student" });
        }
      });
    }
    if (!map.has("1DB21CS001")) map.set("1DB21CS001", { usn: "1DB21CS001", name: "John Doe" });
    if (!map.has("1DB23CS192")) map.set("1DB23CS192", { usn: "1DB23CS192", name: "Santhosh" });
    return Array.from(map.values());
  };

  const activeQuestions =
    blueprint?.questions && blueprint.questions.length > 0
      ? [...blueprint.questions].sort((a, b) => a.code.localeCompare(b.code))
      : [
          { code: "1a", maxMarks: 10, questionNumber: "1" },
          { code: "1b", maxMarks: 10, questionNumber: "1" },
          { code: "2a", maxMarks: 10, questionNumber: "2" },
          { code: "2b", maxMarks: 10, questionNumber: "2" },
          { code: "3a", maxMarks: 10, questionNumber: "3" },
          { code: "3b", maxMarks: 10, questionNumber: "3" },
          { code: "4a", maxMarks: 10, questionNumber: "4" },
          { code: "4b", maxMarks: 10, questionNumber: "4" },
        ];

  const sanitizeBlueprint = (bp) => {
    if (!bp || !Array.isArray(bp.questions)) return bp;
    const grouped = {};
    const cleanList = [];
    for (const q of bp.questions) {
      let qn = String(q.questionNumber || "").trim();
      let sub = String(q.subQuestion || "").toLowerCase().trim();
      if ((!qn || !sub) && q.code && q.code.length >= 2) {
        if (!qn) qn = q.code[0];
        if (!sub) sub = q.code.slice(1).toLowerCase();
      }
      if (!["1", "2", "3", "4"].includes(qn)) continue;
      if (!["a", "b", "c", "d"].includes(sub)) continue;
      if (!grouped[qn]) grouped[qn] = new Set();
      if (grouped[qn].has(sub) || grouped[qn].size >= 4) continue;
      grouped[qn].add(sub);
      cleanList.push({
        ...q,
        questionNumber: qn,
        subQuestion: sub,
        code: `${qn}${sub}`,
        maxMarks: q.maxMarks > 0 ? q.maxMarks : 10.0,
      });
    }

    // Ensure all 8 sub-questions (1a, 1b, 2a, 2b, 3a, 3b, 4a, 4b) are present across all 4 boxes
    const defaultCodes = ["1a", "1b", "2a", "2b", "3a", "3b", "4a", "4b"];
    const existingCodeSet = new Set(cleanList.map((c) => c.code.toLowerCase()));
    for (const defCode of defaultCodes) {
      if (!existingCodeSet.has(defCode)) {
        const dQn = defCode[0];
        const dSub = defCode[1];
        cleanList.push({
          code: defCode,
          questionNumber: dQn,
          subQuestion: dSub,
          maxMarks: 10.0,
          part: ["1", "2"].includes(dQn) ? "PART-A" : "PART-B",
          choiceGroup: ["1", "2"].includes(dQn) ? "Q1_OR_Q2" : "Q3_OR_Q4",
          topicName: `Topic for ${defCode.toUpperCase()}`,
        });
      }
    }

    cleanList.sort((a, b) => a.code.localeCompare(b.code));
    return { ...bp, questions: cleanList };
  };

  const calculateStudentTotal = (usn) => {
    const qMarks = manualMarks[usn.toUpperCase()] || {};
    const m1a = parseFloat(qMarks["1a"]) || 0;
    const m1b = parseFloat(qMarks["1b"]) || 0;
    const m1c = parseFloat(qMarks["1c"]) || 0;
    const m1d = parseFloat(qMarks["1d"]) || 0;
    const m2a = parseFloat(qMarks["2a"]) || 0;
    const m2b = parseFloat(qMarks["2b"]) || 0;
    const m2c = parseFloat(qMarks["2c"]) || 0;
    const m2d = parseFloat(qMarks["2d"]) || 0;
    const m3a = parseFloat(qMarks["3a"]) || 0;
    const m3b = parseFloat(qMarks["3b"]) || 0;
    const m3c = parseFloat(qMarks["3c"]) || 0;
    const m3d = parseFloat(qMarks["3d"]) || 0;
    const m4a = parseFloat(qMarks["4a"]) || 0;
    const m4b = parseFloat(qMarks["4b"]) || 0;
    const m4c = parseFloat(qMarks["4c"]) || 0;
    const m4d = parseFloat(qMarks["4d"]) || 0;

    const q1 = m1a + m1b + m1c + m1d;
    const q2 = m2a + m2b + m2c + m2d;
    const q3 = m3a + m3b + m3c + m3d;
    const q4 = m4a + m4b + m4c + m4d;

    const partA = Math.max(q1, q2);
    const partB = Math.max(q3, q4);

    return Math.min(40, Math.round((partA + partB) * 10) / 10);
  };

  const handleManualMarkChange = (usn, code, val) => {
    let cleanVal = val;
    if (val !== "") {
      const num = parseFloat(val);
      if (isNaN(num)) cleanVal = "";
      else cleanVal = Math.max(0, Math.min(20, num));
    }
    setManualMarks((prev) => ({
      ...prev,
      [usn.toUpperCase()]: {
        ...(prev[usn.toUpperCase()] || {}),
        [code]: cleanVal,
      },
    }));
  };

  const handleSaveAllManualMarks = async () => {
    const roster = getRoster();
    const payload = roster.map((st) => {
      const u = st.usn.toUpperCase();
      const stMarks = manualMarks[u] || {};
      const cleanMap = {};
      activeQuestions.forEach((q) => {
        const v = stMarks[q.code];
        cleanMap[q.code] = v === "" || v === undefined || v === null ? 0.0 : parseFloat(v) || 0.0;
      });
      return {
        usn: u,
        studentName: st.name,
        questionMarks: cleanMap,
      };
    });

    try {
      setIsSavingManual(true);
      setFeedback(null);
      const saved = await saveManualMarks(classroomId, selectedIa, payload);
      setFeedback({
        type: "success",
        message: `Successfully saved marks for ${saved.length} student(s) in IA-${selectedIa}! (Saved as Draft - click 'Publish' to make visible to students)`,
      });
      await loadIaRecords(selectedIa);
      await loadPublishStatus();
    } catch (err) {
      console.error("Save manual marks error:", err);
      setFeedback({
        type: "error",
        message: err.response?.data?.message || "Failed to save manual marks.",
      });
    } finally {
      setIsSavingManual(false);
    }
  };

  const loadBlueprint = async (iaNum) => {
    try {
      setIsLoadingBlueprint(true);
      const data = await getBlueprint(classroomId, iaNum);
      setBlueprint(sanitizeBlueprint(data));
    } catch (err) {
      console.error("Failed to load blueprint:", err);
    } finally {
      setIsLoadingBlueprint(false);
    }
  };

  const handleParsePaper = async (e) => {
    e.preventDefault();
    if (!paperFile) return;
    try {
      setIsParsingPaper(true);
      setFeedback(null);
      const updated = await parseQuestionPaper(classroomId, paperFile, selectedIa);
      const cleanBp = sanitizeBlueprint(updated);
      setBlueprint(cleanBp);
      setFeedback({
        type: "success",
        message: `Successfully extracted blueprint from '${paperFile.name}'! (${cleanBp.questions?.length || 0} sub-questions identified: ${cleanBp.questions?.map(q => q.code).join(", ")}).`,
      });
      setPaperFile(null);
      const input = document.getElementById("ia-paper-file-input");
      if (input) input.value = "";
    } catch (err) {
      console.error("Paper parse error:", err);
      setFeedback({
        type: "error",
        message: err.response?.data?.message || "Failed to parse question paper. Please verify the file.",
      });
    } finally {
      setIsParsingPaper(false);
    }
  };

  const handleQuestionChange = (index, field, value) => {
    if (!blueprint || !blueprint.questions) return;
    const updatedQuestions = [...blueprint.questions];
    updatedQuestions[index] = {
      ...updatedQuestions[index],
      [field]: field === "maxMarks" ? parseFloat(value) || 0 : value,
    };
    setBlueprint({ ...blueprint, questions: updatedQuestions });
  };

  const handleSubQuestionFieldChange = (code, field, value) => {
    if (!blueprint || !blueprint.questions) return;
    const updatedQuestions = blueprint.questions.map((q) => {
      if (q.code === code) {
        return {
          ...q,
          [field]: field === "maxMarks" ? (value === "" ? "" : parseFloat(value) || 0) : value,
        };
      }
      return q;
    });
    setBlueprint({ ...blueprint, questions: updatedQuestions });
  };

  const handlePresetLayout = async (count) => {
    try {
      setIsLoadingBlueprint(true);
      setFeedback(null);
      const res = await generateBlueprint(classroomId, selectedIa, {
        q1Count: count,
        q2Count: count,
        q3Count: count,
        q4Count: count,
      });
      setBlueprint(sanitizeBlueprint(res));
      setFeedback({
        type: "success",
        message: `Switched layout to ${count * 4} questions (${count} sub-questions per main question @ ${count === 2 ? "10M each" : "5M, 5M, 10M"}).`,
      });
    } catch (err) {
      console.error("Preset layout error:", err);
      setFeedback({
        type: "error",
        message: "Failed to apply preset layout.",
      });
    } finally {
      setIsLoadingBlueprint(false);
    }
  };

  const handleAddSubQuestion = (qNum) => {
    if (!blueprint) return;
    const currentQuestions = blueprint.questions || [];
    const existing = currentQuestions.filter((q) => q.questionNumber === String(qNum));
    if (existing.length >= 4) {
      alert(`Maximum 4 sub-questions allowed for Q${qNum} (${qNum}a, ${qNum}b, ${qNum}c, ${qNum}d).`);
      return;
    }
    const nextChar = String.fromCharCode(97 + existing.length); // 'a', 'b', 'c', 'd'
    const part = (qNum === "1" || qNum === "2") ? "PART-A" : "PART-B";
    const choiceGroup = (qNum === "1" || qNum === "2") ? "Q1_OR_Q2" : "Q3_OR_Q4";
    const co = (qNum === "1" || qNum === "2")
      ? (selectedIa === 1 ? "CO1" : selectedIa === 2 ? "CO3" : "CO5")
      : (selectedIa === 1 ? "CO2" : selectedIa === 2 ? "CO4" : "CO5");
    const moduleNumber = (qNum === "1" || qNum === "2")
      ? (selectedIa === 1 ? 1 : selectedIa === 2 ? 3 : 5)
      : (selectedIa === 1 ? 2 : selectedIa === 2 ? 4 : 5);

    const newSubQ = {
      questionNumber: String(qNum),
      subQuestion: nextChar,
      code: `${qNum}${nextChar}`,
      maxMarks: 10.0,
      part,
      choiceGroup,
      moduleNumber,
      co,
      topicName: "",
    };

    const newQuestions = [...currentQuestions];
    let insertIndex = newQuestions.length;
    for (let i = newQuestions.length - 1; i >= 0; i--) {
      if (newQuestions[i].questionNumber === String(qNum)) {
        insertIndex = i + 1;
        break;
      }
    }
    newQuestions.splice(insertIndex, 0, newSubQ);
    setBlueprint({ ...blueprint, questions: newQuestions });
  };

  const handleRemoveSubQuestion = (code) => {
    if (!blueprint || !blueprint.questions) return;
    const target = blueprint.questions.find((q) => q.code === code);
    if (!target) return;
    const sameQ = blueprint.questions.filter((q) => q.questionNumber === target.questionNumber);
    if (sameQ.length <= 1) {
      alert(`Question Q${target.questionNumber} must have at least 1 sub-question.`);
      return;
    }
    setBlueprint({
      ...blueprint,
      questions: blueprint.questions.filter((q) => q.code !== code),
    });
  };

  const handleSaveBlueprint = async () => {
    try {
      setIsSavingBlueprint(true);
      setFeedback(null);
      const res = await updateBlueprint(classroomId, blueprint, selectedIa, applyToAll, false);
      setBlueprint(sanitizeBlueprint(res));
      setFeedback({
        type: "success",
        message: `Blueprint draft saved for IA-${selectedIa}${applyToAll ? " (propagated to all 3 IAs)" : ""}!`,
      });
    } catch (err) {
      console.error("Save blueprint error:", err);
      setFeedback({
        type: "error",
        message: "Failed to save blueprint modifications.",
      });
    } finally {
      setIsSavingBlueprint(false);
    }
  };

  const handleConfirmAndLockBlueprint = async () => {
    try {
      setIsConfirmingBlueprint(true);
      setFeedback(null);
      const res = await updateBlueprint(classroomId, blueprint, selectedIa, applyToAll, true);
      setBlueprint(sanitizeBlueprint(res));
      setFeedback({
        type: "success",
        message: `✅ Blueprint & curriculum topics confirmed and saved for IA-${selectedIa}${applyToAll ? " (Applied to IA-1, IA-2, and IA-3)" : ""}! Topics are persisted to MongoDB and ground Level 1 Mastery, SHAP XAI attribution, and the RAG Study Tutor.`,
      });
    } catch (err) {
      console.error("Confirm blueprint error:", err);
      setFeedback({
        type: "error",
        message: "Failed to confirm and lock blueprint.",
      });
    } finally {
      setIsConfirmingBlueprint(false);
    }
  };

  const handlePublishIaMarks = async (iaNum = selectedIa, publish = true) => {
    const targetLabel = iaNum === 0 ? "all 3 IAs" : `IA-${iaNum}`;
    const confirmed = window.confirm(
      publish
        ? `Are you sure you want to publish marks for ${targetLabel} to students?\n\nOnce published, students will immediately be able to view their scores, question breakdown, and module mastery on their personal student dashboard.`
        : `Are you sure you want to unpublish marks for ${targetLabel}? They will be hidden from student dashboards and reverted to draft status.`
    );
    if (!confirmed) return;

    try {
      setIsPublishing(true);
      setFeedback(null);
      const res = await publishIaMarks(classroomId, iaNum, publish);
      await loadIaRecords(selectedIa);
      await loadPublishStatus();
      setFeedback({
        type: "success",
        message: res.message || `Successfully ${publish ? "published" : "unpublished"} marks for ${targetLabel}!`,
      });
    } catch (err) {
      console.error("Publish error:", err);
      setFeedback({
        type: "error",
        message: err.response?.data?.message || `Failed to ${publish ? "publish" : "unpublish"} marks.`,
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const loadIaRecords = async (iaNum) => {
    try {
      setIsLoadingRecords(true);
      const records = await getIaRecordsByNumber(classroomId, iaNum);
      setIaRecords(records || []);
    } catch (err) {
      console.error("Failed to load IA records:", err);
      setIaRecords([]);
    } finally {
      setIsLoadingRecords(false);
    }
  };

  // 1. Download Master Unified Template
  const handleDownloadMasterTemplate = async () => {
    try {
      setIsDownloading(true);
      setFeedback(null);
      const blob = await downloadMasterTemplate(classroomId);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Master_SplitupMarks_${classroomName || "Classroom"}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

      setFeedback({
        type: "success",
        message: "Unified Master Split-Up Sheet downloaded! It contains IA-1, IA-2, IA-3, and Assignments pre-populated with all enrolled students and existing saved marks.",
      });
    } catch (err) {
      console.error("Master template download error:", err);
      setFeedback({
        type: "error",
        message: "Failed to download master template. Ensure backend is running and you have proper permissions.",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  // 2. Export Current Class Marks Report (.xlsx)
  const handleExportMasterReport = async () => {
    try {
      setIsDownloading(true);
      setFeedback(null);
      const blob = await exportMasterReport(classroomId);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Class_Marks_Report_${classroomName || "Classroom"}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

      setFeedback({
        type: "success",
        message: "Class Marks Report exported! Contains all current students, entered IA marks, module mastery, and class averages.",
      });
    } catch (err) {
      console.error("Export report error:", err);
      setFeedback({
        type: "error",
        message: "Failed to export class marks report.",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  // 3. Download Single IA Blank Template
  const handleDownloadSingleIaTemplate = async (iaNum = selectedIa) => {
    try {
      setIsDownloading(true);
      setFeedback(null);
      const blob = await downloadIaSampleTemplate(classroomId, iaNum);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `IA_${iaNum}_SplitupMarks_${classroomName || "Classroom"}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

      setFeedback({
        type: "success",
        message: `Dynamic blank template for IA-${iaNum} downloaded with clean mark cells + 10 manual entry rows.`,
      });
    } catch (err) {
      console.error("Template download error:", err);
      setFeedback({
        type: "error",
        message: "Failed to download template.",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  // 4. Reset Marks for a specific IA or All IAs
  const handleResetMarks = async (iaNum = selectedIa) => {
    const iaLabel = iaNum === 0 ? "ALL Internal Assessments (IA-1, IA-2, and IA-3)" : `IA-${iaNum}`;
    const confirmed = window.confirm(
      `⚠️ RESET CONFIRMATION:\n\nAre you sure you want to completely RESET and delete all student marks for ${iaLabel}?\n\nThis will remove all entered/ingested scores for ${iaLabel} in ${classroomName || "this classroom"}. This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      setIsResettingMarks(true);
      setFeedback(null);
      const res = await resetIaMarks(classroomId, iaNum);

      // Clear manual marks cache
      setManualMarks({});
      setIaRecords([]);

      setFeedback({
        type: "success",
        message: res.message || `Successfully reset marks for ${iaLabel}. All records have been cleared.`,
      });

      // Reload records and publish status
      await Promise.all([
        loadIaRecords(selectedIa),
        loadPublishStatus(),
      ]);
    } catch (err) {
      console.error("Failed to reset marks:", err);
      setFeedback({
        type: "error",
        message: err.response?.data?.message || `Failed to reset marks for ${iaLabel}.`,
      });
    } finally {
      setIsResettingMarks(false);
    }
  };

  // File selection
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setFeedback(null);
    }
  };

  // Unified or Single Upload Handler
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setFeedback({ type: "error", message: "Please select an Excel file (.xlsx) first." });
      return;
    }

    try {
      setIsUploading(true);
      setFeedback(null);

      const formData = new FormData();
      formData.append("file", selectedFile);

      let summary;
      if (uploadMode === "master") {
        summary = await uploadMasterSheet(classroomId, formData);
      } else {
        summary = await uploadIaMarks(classroomId, formData, selectedIa);
      }

      setFeedback({
        type: "success",
        message: `${summary.message || "Upload successful!"} Note: Marks are saved as DRAFT. Review the student marks below and click '📢 Publish IA Marks to Students' when you're ready to release them to student dashboards.`,
        summary,
      });

      setSelectedFile(null);
      const fileInput = document.getElementById("ia-excel-file-input");
      if (fileInput) fileInput.value = "";

      // Refresh list & publish status
      loadIaRecords(selectedIa);
      loadPublishStatus();
    } catch (err) {
      console.error("Ingestion error:", err);
      const errorMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Failed to ingest Excel file. Ensure file follows standard VTU split-up format (e.g., Iot-7A-SplitupMarks.xlsx).";
      setFeedback({
        type: "error",
        message: errorMsg,
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Inspect student breakdown
  const handleInspectStudent = async (usn) => {
    setInspectStudentUsn(usn);
    try {
      setIsLoadingBreakdown(true);
      const data = await getStudentIaBreakdown(classroomId, usn);
      setStudentBreakdown(data);
    } catch (err) {
      console.error("Failed to fetch student breakdown:", err);
      setStudentBreakdown(null);
    } finally {
      setIsLoadingBreakdown(false);
    }
  };

  const closeInspectModal = () => {
    setInspectStudentUsn(null);
    setStudentBreakdown(null);
  };

  const filteredRecords = iaRecords.filter(
    (r) =>
      r.usn?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.studentName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getQuestionMark = (q, code) => {
    if (!q) return "-";
    const val = q[code] ?? q[code.toLowerCase()] ?? q[code.toUpperCase()];
    return val !== undefined && val !== null ? val : "-";
  };

  const isCurrentIaPublished =
    publishStatus?.[`ia${selectedIa}Published`] ??
    (iaRecords.length > 0 && iaRecords.every((r) => r.published));

  return (
    <div className="ia-marks-section">
      {/* Top Banner / Actions Card */}
      <div className="ia-header-banner">
        <div className="ia-header-text">
          <div className="ia-badge">Feature 2: Academic Intelligence</div>
          <h2>📊 Unified Master Split-Up Excel Parser & Module Mapper</h2>
          <p>
            Seamlessly download, grade, and ingest the Unified Master Split-Up Workbook (matching{" "}
            <code>Iot-7A-SplitupMarks.xlsx</code>). Automatically parses IA-1, IA-2, IA-3, and assignments,
            mapping sub-questions to Modules 1–5 to track mastery and diagnose weak academic areas.
          </p>
        </div>

        {/* Action Buttons: Master Template & Marks Report */}
        <div className="ia-header-actions">
          <button
            type="button"
            className="btn-download-master"
            onClick={handleDownloadMasterTemplate}
            disabled={isDownloading}
            title="Download complete Master Workbook containing IA-1, IA-2, IA-3, and Assignments pre-populated with enrolled students"
          >
            {isDownloading ? (
              <>
                <span className="ia-spinner" /> Generating Master Sheet...
              </>
            ) : (
              <>📥 Download Master Unified Split-Up Sheet</>
            )}
          </button>

          <button
            type="button"
            className="btn-export-report"
            onClick={handleExportMasterReport}
            disabled={isDownloading}
            title="Export all current students with their latest entered marks, module mastery percentages, and class averages"
          >
            📊 Download Current Class Marks Report (.xlsx)
          </button>
        </div>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div className={`ia-feedback-alert ${feedback.type}`}>
          <div className="ia-feedback-icon">
            {feedback.type === "success" ? "✅" : "⚠️"}
          </div>
          <div className="ia-feedback-content">
            <strong>{feedback.type === "success" ? "Success!" : "Notice:"}</strong> {feedback.message}
            {feedback.summary?.totalStudentsIngested !== undefined && (
              <span className="ia-feedback-count">
                (Students processed: {feedback.summary.totalStudentsIngested})
              </span>
            )}
          </div>
          <button
            type="button"
            className="ia-feedback-close"
            onClick={() => setFeedback(null)}
          >
            ×
          </button>
        </div>
      )}

      {/* 2-STEP DATA INGESTION WORKFLOW NAVIGATOR */}
      <div className="ia-steps-nav">
        <button
          type="button"
          className={`ia-step-btn ${activeStep === 1 ? "active" : ""}`}
          onClick={() => setActiveStep(1)}
        >
          <span className="step-number">1</span>
          <span>Step 1: Exam Blueprint</span>
        </button>
        <button
          type="button"
          className={`ia-step-btn ${activeStep === 2 ? "active" : ""}`}
          onClick={() => setActiveStep(2)}
        >
          <span className="step-number">2</span>
          <span>Step 2: Marks Ingestion</span>
        </button>
      </div>

      {/* STEP 1: EXAM QUESTION PAPER & BLUEPRINT */}
      {activeStep === 1 && (
        <div className="bp-card">
          <div className="bp-header-row">
            <div>
              <h3 style={{ margin: "0 0 6px 0", color: "#ffffff", fontSize: "1.15rem" }}>
                🎯 Internal Assessment Question Distribution Engine
              </h3>
              <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.85rem" }}>
                Select an IA test to review its active sub-question blueprint, extract from an uploaded question paper, or adjust marks.
              </p>
            </div>

            {/* Target IA Selector */}
            <div className="ia-pill-selector">
              {[
                { num: 1, label: "IA-1", desc: "Modules 1 & 2" },
                { num: 2, label: "IA-2", desc: "Modules 3 & 4" },
                { num: 3, label: "IA-3", desc: "Module 5" },
              ].map((ia) => (
                <button
                  key={ia.num}
                  type="button"
                  className={`ia-pill-btn ${selectedIa === ia.num ? "active" : ""}`}
                  onClick={() => {
                    setSelectedIa(ia.num);
                    setFeedback(null);
                  }}
                >
                  <span className="pill-title">{ia.label}</span>
                  <span className="pill-desc">{ia.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Blueprint Status Badge & AI Uploader */}
          <div className="bp-upload-zone">
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ marginBottom: 6, display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                {blueprint?.isLocked || blueprint?.confirmed ? (
                  <span className="bp-status-badge locked">
                    🔒 Blueprint Confirmed & Locked (IA-{selectedIa})
                  </span>
                ) : blueprint?.rawPaperUrl ? (
                  <span className="bp-status-badge ai">
                    📄 AI Blueprint Active: {blueprint.rawPaperUrl}
                  </span>
                ) : (
                  <span className="bp-status-badge default">
                    ⚡ Editable Blueprint Active (IA-{selectedIa})
                  </span>
                )}
                {blueprint?.questions && (
                  <span style={{ fontSize: "0.8rem", color: "#94a3b8", fontWeight: 600 }}>
                    ({blueprint.questions.length} Sub-Questions Configured)
                  </span>
                )}
              </div>
              <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.82rem", lineHeight: 1.4 }}>
                Upload question paper image or PDF (e.g. <code>iot 1st internals.jpeg</code>). AI OCR will parse sub-questions, marks, and clean topics.
              </p>
            </div>

            <form onSubmit={handleParsePaper} className="bp-file-input-wrapper">
              <input
                id="ia-paper-file-input"
                type="file"
                accept=".pdf, .png, .jpg, .jpeg"
                onChange={(e) => setPaperFile(e.target.files ? e.target.files[0] : null)}
                style={{ color: "#cbd5e1", fontSize: "0.82rem" }}
              />
              <button
                type="submit"
                className="btn-ai-parse"
                disabled={!paperFile || isParsingPaper}
              >
                {isParsingPaper ? (
                  <>
                    <span className="ia-spinner" /> Parsing with AI...
                  </>
                ) : (
                  <>🤖 Extract & Update Blueprint with AI</>
                )}
              </button>
            </form>
          </div>

          {/* Preset Layout Switcher */}
          <div className="bp-preset-bar" style={{ margin: "16px 0" }}>
            <span className="bp-preset-label">⚡ Quick Presets:</span>
            <button
              type="button"
              className="btn-preset"
              onClick={() => handlePresetLayout(2)}
              title="Standard VTU 8-Question pattern: 1a, 1b, 2a, 2b, 3a, 3b, 4a, 4b @ 10 Marks each"
            >
              ⚡ Standard 8 Questions (2 per Q @ 10M)
            </button>
            <button
              type="button"
              className="btn-preset"
              onClick={() => handlePresetLayout(3)}
              title="Extended 12-Question pattern: 1a, 1b, 1c ... 4c @ 5M, 5M, 10M"
            >
              📑 Extended 12 Questions (3 per Q @ 5, 5, 10M)
            </button>
          </div>

          {/* Hierarchical Question Configuration Cards */}
          {isLoadingBlueprint ? (
            <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
              <div className="ia-spinner" style={{ margin: "0 auto 10px" }} />
              Loading blueprint question structure...
            </div>
          ) : blueprint?.questions && blueprint.questions.length > 0 ? (
            <div className="bp-parts-container">
              {/* Helper renderer for a single Main Question Card */}
              {[
                {
                  partName: "PART A",
                  partBadge: "PART A (Choice Group Q1_OR_Q2) • Answer Q1 OR Q2",
                  mainQuestions: [
                    { num: "1", title: "Question 1", sub: (blueprint.questions || []).filter((q) => q.questionNumber === "1" && ["a", "b", "c", "d"].includes(q.subQuestion?.toLowerCase())).slice(0, 4) },
                    { num: "2", title: "Question 2", sub: (blueprint.questions || []).filter((q) => q.questionNumber === "2" && ["a", "b", "c", "d"].includes(q.subQuestion?.toLowerCase())).slice(0, 4) },
                  ],
                },
                {
                  partName: "PART B",
                  partBadge: "PART B (Choice Group Q3_OR_Q4) • Answer Q3 OR Q4",
                  mainQuestions: [
                    { num: "3", title: "Question 3", sub: (blueprint.questions || []).filter((q) => q.questionNumber === "3" && ["a", "b", "c", "d"].includes(q.subQuestion?.toLowerCase())).slice(0, 4) },
                    { num: "4", title: "Question 4", sub: (blueprint.questions || []).filter((q) => q.questionNumber === "4" && ["a", "b", "c", "d"].includes(q.subQuestion?.toLowerCase())).slice(0, 4) },
                  ],
                },
              ].map((partSection, pIdx) => (
                <div key={pIdx} className="bp-part-section">
                  <div className="bp-part-header">
                    <span className="bp-part-title-badge">{partSection.partBadge}</span>
                    <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                      {partSection.partName === "PART A" ? "Module 1 / 2 • CO1 / CO2" : "Module 3 / 4 / 5 • CO3 / CO4 / CO5"}
                    </span>
                  </div>

                  <div className="bp-main-q-grid">
                    {partSection.mainQuestions.map((mq) => (
                      <div key={mq.num} className="bp-main-q-card">
                        <div className="bp-main-q-header">
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span className="bp-q-title">{mq.title}</span>
                            <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                              ({mq.sub.length} {mq.sub.length === 1 ? "sub-question" : "sub-questions"})
                            </span>
                          </div>
                          <button
                            type="button"
                            className="btn-add-subq"
                            onClick={() => handleAddSubQuestion(mq.num)}
                            title={mq.sub.length >= 4 ? "Maximum 4 sub-questions reached" : `Add sub-question (${mq.num}${String.fromCharCode(97 + mq.sub.length)})`}
                            disabled={mq.sub.length >= 4}
                          >
                            + Add Sub-Question
                          </button>
                        </div>

                        <div className="bp-subq-list">
                          {mq.sub.map((subQ) => (
                            <div key={subQ.code} className="bp-subq-row">
                              <span className="bp-subq-badge">{subQ.code.toUpperCase()}</span>

                              <div className="bp-subq-marks-wrapper">
                                <input
                                  type="number"
                                  className="bp-subq-marks-input"
                                  value={subQ.maxMarks}
                                  onChange={(e) =>
                                    handleSubQuestionFieldChange(subQ.code, "maxMarks", e.target.value)
                                  }
                                  title="Max Marks"
                                />
                                <span className="bp-subq-marks-label">M</span>
                              </div>

                              <input
                                type="text"
                                className="bp-subq-topic-input"
                                placeholder="Topic / Curriculum Concept (e.g. IoT Architecture)"
                                value={subQ.topicName || ""}
                                onChange={(e) =>
                                  handleSubQuestionFieldChange(subQ.code, "topicName", e.target.value)
                                }
                              />

                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  color: "#a78bfa",
                                  padding: "2px 6px",
                                  background: "rgba(167, 139, 250, 0.1)",
                                  borderRadius: "4px",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {subQ.co}
                              </span>

                              <button
                                type="button"
                                className="btn-remove-subq"
                                onClick={() => handleRemoveSubQuestion(subQ.code)}
                                disabled={mq.sub.length <= 1}
                                title={
                                  mq.sub.length <= 1
                                    ? "At least 1 sub-question is required"
                                    : `Remove sub-question ${subQ.code}`
                                }
                              >
                                🗑
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: 30, textAlign: "center", color: "#94a3b8" }}>
              No blueprint configured. Click a Quick Preset above to initialize the question distribution.
            </div>
          )}

          {/* Action Row: Save Draft, Apply to All, and Confirm & Lock */}
          <div
            className="bp-footer-row"
            style={{
              marginTop: 20,
              paddingTop: 16,
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 14,
            }}
          >
            <label className="bp-apply-all-toggle">
              <input
                type="checkbox"
                checked={applyToAll}
                onChange={(e) => setApplyToAll(e.target.checked)}
                style={{ cursor: "pointer", accentColor: "#10b981" }}
              />
              <span>Apply this question configuration across all 3 IAs (IA-1, IA-2, IA-3)</span>
            </label>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn-preset"
                onClick={() => handleDownloadSingleIaTemplate(selectedIa)}
                disabled={isDownloading}
                title={`Download dynamically generated blank template for IA-${selectedIa} with confirmed question columns`}
                style={{ color: "#38bdf8", borderColor: "rgba(56, 189, 248, 0.4)", padding: "10px 16px" }}
              >
                📥 Download IA-{selectedIa} Blank Template (.xlsx)
              </button>

              <button
                type="button"
                className="btn-save-bp"
                onClick={handleSaveBlueprint}
                disabled={isSavingBlueprint || isConfirmingBlueprint || !blueprint}
              >
                {isSavingBlueprint ? "Saving..." : "💾 Save Draft Changes"}
              </button>

              <button
                type="button"
                className="btn-confirm-lock"
                onClick={handleConfirmAndLockBlueprint}
                disabled={isConfirmingBlueprint || isSavingBlueprint || !blueprint}
                title="Save blueprint and confirm curriculum topics to MongoDB"
              >
                {isConfirmingBlueprint ? (
                  <>
                    <span className="ia-spinner" /> Saving & Confirming Topics...
                  </>
                ) : (
                  <>💾 Save Blueprint & Confirm Topics</>
                )}
              </button>

              <button
                type="button"
                className="mode-pill-btn active"
                onClick={() => setActiveStep(2)}
                style={{ padding: "10px 18px", fontSize: "0.85rem" }}
              >
                Proceed to Step 2: Excel Ingestion →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: MARKS INGESTION & MANUAL ENTRY GRID */}
      {activeStep === 2 && (
        <div className="ia-step2-container">
          {/* Workflow Toggle Bar */}
          <div className="entry-mode-toggle-bar">
            <button
              type="button"
              className={`entry-mode-tab-btn ${entryMode === "excel" ? "active" : ""}`}
              onClick={() => {
                setEntryMode("excel");
                setFeedback(null);
              }}
            >
              📄 Upload / Download Excel
            </button>
            <button
              type="button"
              className={`entry-mode-tab-btn ${entryMode === "manual" ? "active" : ""}`}
              onClick={() => {
                setEntryMode("manual");
                setFeedback(null);
              }}
            >
              ✏️ Manual Marks Entry Grid
            </button>
          </div>

          {entryMode === "excel" ? (
            <div className="ia-control-grid">
              {/* Left Card: Ingestion Mode Selector & Guidelines */}
              <div className="ia-card ia-selector-card">
                <div className="upload-mode-toggle-row">
                  <label className="ia-card-label">1. Choose Ingestion Mode</label>
                  <div className="upload-mode-pills">
                    <button
                      type="button"
                      className={`mode-pill-btn ${uploadMode === "master" ? "active" : ""}`}
                      onClick={() => {
                        setUploadMode("master");
                        setFeedback(null);
                      }}
                    >
                      🌟 Master Unified Sheet
                    </button>
                    <button
                      type="button"
                      className={`mode-pill-btn ${uploadMode === "single" ? "active" : ""}`}
                      onClick={() => {
                        setUploadMode("single");
                        setFeedback(null);
                      }}
                    >
                      Single IA Sheet
                    </button>
                  </div>
                </div>

                {uploadMode === "master" ? (
                  <div className="master-mode-desc-box">
                    <div className="mode-badge">⚡ Recommended for VTU Faculty</div>
                    <h4>Unified Multi-IA Workbook Mode</h4>
                    <p>
                      Upload your completed <code>Iot-7A-SplitupMarks.xlsx</code> workbook. Acadion will
                      automatically detect and parse:
                    </p>
                    <ul className="master-parsing-points">
                      <li>
                        <strong>1st IA (Cols D–Q):</strong> Sub-questions 1a..4b $\rightarrow$ Modules 1 & 2
                      </li>
                      <li>
                        <strong>2nd IA (Cols S–AH):</strong> Sub-questions 1a..4c $\rightarrow$ Modules 3 & 4
                      </li>
                      <li>
                        <strong>3rd IA (Cols AJ–AV):</strong> Sub-questions 1a..4b $\rightarrow$ Module 5
                      </li>
                      <li>
                        <strong>Assignments/Lab (Cols AX–BE):</strong> A1..A3, S1, S2, Q1, Q2
                      </li>
                    </ul>
                    <div className="vtu-safe-note">
                      🔒 Safe merge: Existing marks for other IAs are preserved and merged seamlessly.
                    </div>
                  </div>
                ) : (
                  <div className="single-mode-box">
                    <label className="ia-card-label">Target Internal Assessment</label>
                    <div className="ia-pill-selector">
                      {[
                        { num: 1, label: "IA-1", desc: "Modules 1 & 2" },
                        { num: 2, label: "IA-2", desc: "Modules 3 & 4" },
                        { num: 3, label: "IA-3", desc: "Module 5" },
                      ].map((ia) => (
                        <button
                          key={ia.num}
                          type="button"
                          className={`ia-pill-btn ${selectedIa === ia.num ? "active" : ""}`}
                          onClick={() => {
                            setSelectedIa(ia.num);
                            setFeedback(null);
                          }}
                        >
                          <span className="pill-title">{ia.label}</span>
                          <span className="pill-desc">{ia.desc}</span>
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="btn-download-single-link"
                      onClick={() => handleDownloadSingleIaTemplate(selectedIa)}
                    >
                      📥 Download Individual IA-{selectedIa} Blank Template
                    </button>
                  </div>
                )}
              </div>

              {/* Right Card: Upload Form */}
              <div className="ia-card ia-upload-card">
                <label className="ia-card-label">
                  2. Upload Completed {uploadMode === "master" ? "Master Unified" : `IA-${selectedIa}`} Excel (.xlsx)
                </label>
                <form onSubmit={handleUploadSubmit} className="ia-upload-form">
                  <div className="ia-file-dropzone">
                    <input
                      id="ia-excel-file-input"
                      type="file"
                      accept=".xlsx, .xls"
                      onChange={handleFileChange}
                      className="ia-file-input"
                    />
                    <div className="dropzone-inner">
                      <span className="dropzone-icon">📁</span>
                      <span className="dropzone-prompt">
                        {selectedFile ? (
                          <strong className="dropzone-selected-name">
                            {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                          </strong>
                        ) : (
                          "Choose completed .xlsx file or drag & drop here"
                        )}
                      </span>
                      <span className="dropzone-subtext">
                        {uploadMode === "master"
                          ? "Supports Master Multi-IA Sheets (e.g. Iot-7A-SplitupMarks.xlsx)"
                          : `Supports Individual IA-${selectedIa} Split-Up Sheets`}
                      </span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className={`btn-upload-ia ${uploadMode === "master" ? "master-btn" : ""}`}
                    disabled={!selectedFile || isUploading}
                  >
                    {isUploading ? (
                      <>
                        <span className="ia-spinner" /> Parsing & Ingesting Marks...
                      </>
                    ) : uploadMode === "master" ? (
                      <>📤 Upload Master Unified Split-Up Sheet (Auto-Parses IA-1, IA-2, IA-3)</>
                    ) : (
                      <>📤 Ingest IA-{selectedIa} Marks</>
                    )}
                  </button>
                </form>
              </div>
            </div>
          ) : (
            /* MANUAL MARKS ENTRY GRID */
            <div className="ia-card ia-manual-grid-card">
              <div className="manual-grid-header">
                <div className="manual-grid-header-left">
                  <div className="manual-grid-title-row">
                    <span className="manual-grid-badge">✏️ Live Grading Grid</span>
                    <h4>Classroom Manual Marks Entry — IA-{selectedIa}</h4>
                  </div>
                  <p className="manual-grid-subtitle">
                    Directly type marks for each enrolled student. Total score (/40) calculates live using the university choice rule: <code>Max(Q1, Q2) + Max(Q3, Q4)</code>.
                  </p>
                </div>

                <div className="manual-grid-header-right">
                  <div className="ia-pill-selector mini-selector">
                    {[1, 2, 3].map((num) => (
                      <button
                        key={num}
                        type="button"
                        className={`ia-pill-btn ${selectedIa === num ? "active" : ""}`}
                        onClick={() => {
                          setSelectedIa(num);
                          setFeedback(null);
                        }}
                      >
                        <span className="pill-title">IA-{num}</span>
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="btn-save-manual-marks"
                    onClick={handleSaveAllManualMarks}
                    disabled={isSavingManual}
                  >
                    {isSavingManual ? (
                      <>
                        <span className="ia-spinner" /> Saving Marks...
                      </>
                    ) : (
                      <>💾 Save All Marks</>
                    )}
                  </button>
                </div>
              </div>

              {/* Editable Table */}
              <div className="manual-table-responsive">
                <table className="manual-marks-table">
                  <thead>
                    <tr>
                      <th style={{ width: "50px", textAlign: "center" }}>Sl</th>
                      <th style={{ width: "140px" }}>USN</th>
                      <th style={{ minWidth: "160px" }}>Student Name</th>
                      {activeQuestions.map((q) => (
                        <th key={q.code} className="subq-col-header" title={`Question ${q.code.toUpperCase()} (Max ${q.maxMarks} Marks)`}>
                          <div className="subq-col-code">{q.code.toUpperCase()}</div>
                          <div className="subq-col-max">({q.maxMarks}M)</div>
                        </th>
                      ))}
                      <th style={{ width: "120px", textAlign: "center" }} className="total-col-header">
                        Total (/40)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {getRoster().map((student, sIdx) => {
                      const u = student.usn.toUpperCase();
                      const stMarks = manualMarks[u] || {};
                      const studentTotal = calculateStudentTotal(u);

                      return (
                        <tr key={u} className="manual-student-row">
                          <td style={{ textAlign: "center", color: "#64748b", fontWeight: 600 }}>{sIdx + 1}</td>
                          <td className="manual-usn-cell">{student.usn}</td>
                          <td className="manual-name-cell">{student.name}</td>
                          {activeQuestions.map((q) => {
                            const val = stMarks[q.code] !== undefined ? stMarks[q.code] : "";
                            return (
                              <td key={q.code} className="manual-input-cell">
                                <input
                                  type="number"
                                  min="0"
                                  max={q.maxMarks || 10}
                                  step="0.5"
                                  className="manual-mark-input"
                                  placeholder="-"
                                  value={val}
                                  onChange={(e) => handleManualMarkChange(student.usn, q.code, e.target.value)}
                                  title={`USN: ${student.usn} | Q${q.code.toUpperCase()} (Max: ${q.maxMarks}M)`}
                                />
                              </td>
                            );
                          })}
                          <td className="manual-total-cell" style={{ textAlign: "center" }}>
                            <span className={`manual-total-badge ${studentTotal >= 20 ? "pass" : studentTotal > 0 ? "low" : "empty"}`}>
                              {studentTotal} / 40
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer status & Save button */}
              <div className="manual-grid-footer">
                <div className="choice-calc-note">
                  <span>💡 <strong>Choice Rule Applied Live:</strong> Part A = <code>Max(Q1, Q2)</code>, Part B = <code>Max(Q3, Q4)</code>. Total = Part A + Part B.</span>
                </div>

                <button
                  type="button"
                  className="btn-save-manual-marks"
                  onClick={handleSaveAllManualMarks}
                  disabled={isSavingManual}
                >
                  {isSavingManual ? (
                    <>
                      <span className="ia-spinner" /> Saving Marks...
                    </>
                  ) : (
                    <>💾 Save All Marks</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ingested Records Display Section (Collapsible Dropdown Accordion) */}
      <div className={`ia-records-section ${isIngestedDropdownOpen ? "open" : "collapsed"}`}>
        <div
          className="ia-records-header ia-records-header-clickable"
          onClick={() => setIsIngestedDropdownOpen((prev) => !prev)}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="ia-accordion-chevron" title={isIngestedDropdownOpen ? "Click to collapse" : "Click to expand"}>
              {isIngestedDropdownOpen ? "▲" : "▼"}
            </span>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0 }}>📋 Ingested IA Marks & Module Mastery</h3>
                <span className="bp-status-badge default" style={{ fontSize: "0.76rem", padding: "3px 8px" }}>
                  IA-{selectedIa}
                </span>
                <span className="bp-status-badge" style={{ fontSize: "0.76rem", padding: "3px 8px" }}>
                  {filteredRecords.length} Student{filteredRecords.length !== 1 ? "s" : ""}
                </span>
                {isCurrentIaPublished ? (
                  <span className="bp-status-badge locked" style={{ fontSize: "0.76rem", padding: "3px 8px" }}>
                    ✅ Published
                  </span>
                ) : (
                  <span
                    className="bp-status-badge default"
                    style={{
                      background: "rgba(234, 179, 8, 0.15)",
                      color: "#facc15",
                      borderColor: "rgba(234, 179, 8, 0.3)",
                      fontSize: "0.76rem",
                      padding: "3px 8px",
                    }}
                  >
                    🟡 Draft
                  </span>
                )}
              </div>
              <p style={{ margin: "4px 0 0 0", color: "#94a3b8", fontSize: "0.85rem" }}>
                Inspect student question-wise breakdown and module mastery percentages. (Click header to {isIngestedDropdownOpen ? "collapse" : "expand"})
              </p>
            </div>
          </div>

          <div className="ia-view-filter-group" onClick={(e) => e.stopPropagation()}>
            <div className="ia-filter-pills">
              {[1, 2, 3].map((num) => (
                <button
                  key={num}
                  type="button"
                  className={`ia-filter-pill-btn ${selectedIa === num ? "active" : ""}`}
                  onClick={() => setSelectedIa(num)}
                >
                  View IA-{num}
                </button>
              ))}
            </div>

            <div className="ia-search-box">
              <input
                type="text"
                placeholder="Filter by USN or Name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ia-search-input"
              />
            </div>
          </div>
        </div>

        {/* Collapsible Dropdown Content */}
        {isIngestedDropdownOpen && (
          <>
            {/* ACTION TOOLBAR: DOWNLOAD IA EXCEL & RESET MARKS BUTTONS */}
            <div className="ia-records-action-bar">
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn-action-download-excel"
                  onClick={() => handleDownloadSingleIaTemplate(selectedIa)}
                  disabled={isDownloading}
                  title={`Download Excel sheet of IA-${selectedIa} with all current student marks and formulas pre-populated`}
                >
                  {isDownloading ? (
                    <>
                      <span className="ia-spinner" /> Preparing Excel...
                    </>
                  ) : (
                    <>📥 Download IA-{selectedIa} Excel</>
                  )}
                </button>

                <button
                  type="button"
                  className="btn-export-report"
                  onClick={handleExportMasterReport}
                  disabled={isDownloading}
                  style={{ padding: "8px 14px", fontSize: "0.82rem" }}
                  title="Export full master workbook covering all 3 IAs and Assignments"
                >
                  📊 Export Master Sheet (All IAs)
                </button>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn-action-reset-marks"
                  onClick={() => handleResetMarks(selectedIa)}
                  disabled={isResettingMarks || filteredRecords.length === 0}
                  title={`Wipe and reset all entered/ingested marks for IA-${selectedIa}`}
                >
                  {isResettingMarks ? (
                    <>
                      <span className="ia-spinner" /> Resetting...
                    </>
                  ) : (
                    <>🗑️ Reset IA-{selectedIa} Marks</>
                  )}
                </button>

                <button
                  type="button"
                  className="btn-action-reset-subtle"
                  onClick={() => handleResetMarks(0)}
                  disabled={isResettingMarks}
                  title="Wipe and reset marks across all 3 IAs simultaneously"
                >
                  Reset All IAs
                </button>
              </div>
            </div>

            {/* TEACHER CONFIRMATION & PUBLICATION CONTROL BANNER */}
            <div
              className="bp-preset-bar"
              style={{
                margin: "4px 0 10px 0",
                padding: "12px 16px",
                background: isCurrentIaPublished ? "rgba(16, 185, 129, 0.1)" : "rgba(234, 179, 8, 0.08)",
                borderColor: isCurrentIaPublished ? "rgba(16, 185, 129, 0.3)" : "rgba(234, 179, 8, 0.25)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "#ffffff" }}>
                  IA-{selectedIa} Visibility Status:
                </span>
                {isCurrentIaPublished ? (
                  <span className="bp-status-badge locked" style={{ padding: "4px 10px", fontSize: "0.82rem" }}>
                    ✅ Published to Students ({publishStatus?.[`ia${selectedIa}PublishedCount`] || filteredRecords.length} records)
                  </span>
                ) : (
                  <span
                    className="bp-status-badge default"
                    style={{
                      background: "rgba(234, 179, 8, 0.15)",
                      color: "#facc15",
                      borderColor: "rgba(234, 179, 8, 0.3)",
                      padding: "4px 10px",
                      fontSize: "0.82rem",
                    }}
                  >
                    🟡 DRAFT (Unpublished) — Students cannot see these marks yet
                  </span>
                )}
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                {isCurrentIaPublished ? (
                  <button
                    type="button"
                    className="btn-preset"
                    onClick={() => handlePublishIaMarks(selectedIa, false)}
                    disabled={isPublishing}
                    style={{ color: "#f87171", borderColor: "rgba(248, 113, 113, 0.3)" }}
                  >
                    {isPublishing ? "Updating..." : "🔒 Unpublish IA-" + selectedIa + " (Revert to Draft)"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-confirm-lock"
                    onClick={() => handlePublishIaMarks(selectedIa, true)}
                    disabled={isPublishing || filteredRecords.length === 0}
                    style={{
                      background: "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)",
                      borderColor: "#60a5fa",
                      padding: "8px 18px",
                      fontSize: "0.88rem",
                    }}
                    title="Confirm and publish these marks so students can view them on their dashboard"
                  >
                    {isPublishing ? (
                      <>
                        <span className="ia-spinner" /> Publishing...
                      </>
                    ) : (
                      <>📢 Publish IA-{selectedIa} Marks to Students</>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  className="btn-preset"
                  onClick={() => handlePublishIaMarks(0, true)}
                  disabled={isPublishing || filteredRecords.length === 0}
                  title="Confirm & publish all 3 IAs simultaneously"
                >
                  📢 Publish All IAs
                </button>
              </div>
            </div>

        {isLoadingRecords ? (
          <div className="ia-empty-state">
            <span className="ia-spinner large" />
            <p>Loading IA-{selectedIa} records...</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="ia-empty-state">
            <span className="empty-icon">📑</span>
            <h4>No marks recorded for IA-{selectedIa} yet</h4>
            <p>
              Download the Master Unified Split-Up Sheet above, enter student marks (or upload your existing{" "}
              <code>Iot-7A-SplitupMarks.xlsx</code>), and click Upload to view automated intelligence.
            </p>
          </div>
        ) : (
          <div className="ia-table-wrapper">
            <table className="ia-marks-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>USN</th>
                  <th>Student Name</th>
                  {activeQuestions.map((q) => (
                    <th key={q.code}>{q.code.toUpperCase()}</th>
                  ))}
                  <th>Total (/40)</th>
                  <th>Module Mastery</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((r, idx) => {
                  const q = r.questionMarks || {};
                  return (
                    <tr key={r.id || r.usn}>
                      <td className="cell-muted">{idx + 1}</td>
                      <td>
                        <strong className="usn-tag">{r.usn}</strong>
                      </td>
                      <td className="name-cell">{r.studentName}</td>
                      {activeQuestions.map((qItem) => {
                        const m = getQuestionMark(q, qItem.code);
                        return (
                          <td key={qItem.code} className="mark-cell">
                            {m}
                          </td>
                        );
                      })}
                      <td>
                        <span className="badge-total-marks">
                          {r.totalMarks !== undefined ? r.totalMarks.toFixed(1) : "0.0"}
                        </span>
                      </td>
                      <td>
                        <div className="mastery-badges-row">
                          {r.moduleMastery &&
                            Object.entries(r.moduleMastery).map(([modNum, pct]) => {
                              const isLow = pct < 50;
                              const isHigh = pct >= 75;
                              return (
                                <span
                                  key={modNum}
                                  className={`mastery-chip ${isLow ? "low" : isHigh ? "high" : "mid"}`}
                                  title={`Module ${modNum}: ${pct}% mastery`}
                                >
                                  M{modNum}: {pct}%
                                </span>
                              );
                            })}
                        </div>
                      </td>
                      <td>
                        {r.published ? (
                          <span style={{ color: "#34d399", fontWeight: 700, fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                            ● Published
                          </span>
                        ) : (
                          <span style={{ color: "#facc15", fontWeight: 700, fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                            ● Draft
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-inspect-student"
                          onClick={() => handleInspectStudent(r.usn)}
                          title="View weak topics and full multi-IA history"
                        >
                          🔍 Breakdown
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
          </>
        )}
      </div>

      {/* Inspect Student Modal */}
      {inspectStudentUsn && (
        <div className="ia-modal-backdrop" onClick={closeInspectModal}>
          <div className="ia-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="ia-modal-header">
              <div>
                <h3>🎓 Academic Intelligence Breakdown</h3>
                <p>
                  Student: <strong>{studentBreakdown?.studentName || inspectStudentUsn}</strong> ({inspectStudentUsn})
                </p>
              </div>
              <button type="button" className="ia-modal-close" onClick={closeInspectModal}>
                ×
              </button>
            </div>

            <div className="ia-modal-body">
              {isLoadingBreakdown ? (
                <div className="ia-empty-state">
                  <span className="ia-spinner" />
                  <p>Calculating academic mastery & weak topics...</p>
                </div>
              ) : !studentBreakdown ? (
                <div className="ia-empty-state">
                  <p>No breakdown data available for {inspectStudentUsn}</p>
                </div>
              ) : (
                <>
                  {/* Summary Metric Cards */}
                  <div className="ia-stats-grid">
                    <div className="ia-stat-box">
                      <span className="stat-label">Overall IA Average</span>
                      <span className="stat-value highlight">
                        {studentBreakdown.overallIaAverage !== undefined
                          ? studentBreakdown.overallIaAverage.toFixed(1)
                          : "0.0"}{" "}
                        / 40
                      </span>
                    </div>

                    <div className="ia-stat-box">
                      <span className="stat-label">Weak Modules (&lt; 50%)</span>
                      <span className="stat-value alert">
                        {studentBreakdown.weakModules?.length > 0 ? (
                          studentBreakdown.weakModules.join(", ")
                        ) : (
                          <span className="text-success">None 🎉</span>
                        )}
                      </span>
                    </div>

                    <div className="ia-stat-box">
                      <span className="stat-label">Strong Modules (≥ 75%)</span>
                      <span className="stat-value success">
                        {studentBreakdown.strongModules?.length > 0 ? (
                          studentBreakdown.strongModules.join(", ")
                        ) : (
                          "In Progress"
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Cumulative Module Mastery Bar */}
                  <h4 className="section-subtitle">Module-by-Module Mastery</h4>
                  <div className="module-bars-list">
                    {studentBreakdown.cumulativeModuleMastery &&
                      Object.entries(studentBreakdown.cumulativeModuleMastery).map(([mod, pct]) => (
                        <div key={mod} className="module-bar-item">
                          <div className="bar-labels">
                            <span>Module {mod}</span>
                            <strong>{pct.toFixed(1)}%</strong>
                          </div>
                          <div className="bar-track">
                            <div
                              className={`bar-fill ${pct < 50 ? "low" : pct >= 75 ? "high" : "mid"}`}
                              style={{ width: `${Math.min(100, Math.max(5, pct))}%` }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>

                  {/* Individual IA Tests Taken */}
                  <h4 className="section-subtitle">Recorded IA Submissions</h4>
                  <div className="ia-submissions-list">
                    {studentBreakdown.iaRecords?.map((rec) => (
                      <div key={rec.id || rec.iaNumber} className="submission-item">
                        <div className="submission-title">
                          <strong>IA-{rec.iaNumber}</strong>
                          <span className="submission-total">Score: {rec.totalMarks} / 40</span>
                        </div>
                        <div className="submission-breakdown">
                          {rec.questionMarks &&
                            Object.entries(rec.questionMarks).map(([q, mark]) => (
                              <span key={q} className="q-mark-pill">
                                {q}: <strong>{mark}</strong>
                              </span>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="ia-modal-footer">
              <button type="button" className="btn-close-modal" onClick={closeInspectModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IaMarksUploadSection;
