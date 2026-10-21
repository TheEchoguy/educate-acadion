import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import {
  getDocuments,
  uploadDocument,
  downloadDocument,
  publishModuleDocument,
  unpublishModuleDocument,
  deleteDocument,
  getExtractionInputs,
  updateTimetableSlots,
  confirmTimetableMapping,
  updateCalendarEvents,
  updateModuleOutlines,
  verifyInputs,
  resetSchedulingData,
  generateSchedule,
  getPlans,
  getPlanById,
  getActivePlan,
  approvePlan,
  recordSessionOutcome,
  manualAllocateSession,
  deleteSession,
  previewReschedule,
  applyReschedule,
  getRescheduleHistory,
  downloadIcalExport,
  downloadCsvExport,
} from "../../services/syllabusSchedulingService";
import "./TeacherSyllabusManagement.css";

export default function TeacherSyllabusSchedulingSection({ classroom, onNavigateToSyllabus }) {
  const classroomId = classroom?.id;

  // Subtabs: "intake" | "review" | "generate" | "calendar" | "resources" | "history"
  const [activeTab, setActiveTab] = useState("intake");

  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [inputs, setInputs] = useState(null);
  const [activePlan, setActivePlan] = useState(null);
  const [availablePlans, setAvailablePlans] = useState([]);
  const [rescheduleHistory, setRescheduleHistory] = useState([]);

  // Planning Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadDocType, setUploadDocType] = useState("TIMETABLE");
  const [uploadModuleNum] = useState(1);
  const [uploadModuleTitle, setUploadModuleTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  // Dedicated Learning Resources upload state (Section K & L)
  const [learningResourceType, setLearningResourceType] = useState("MODULE_PDF");
  const [learningModuleNum, setLearningModuleNum] = useState(1);
  const [learningResourceTitle, setLearningResourceTitle] = useState("");
  const [learningResourceFile, setLearningResourceFile] = useState(null);
  const [uploadingResource, setUploadingResource] = useState(false);
  const [resourceUploadStatus, setResourceUploadStatus] = useState(null);

  // Calendar filter state
  const [selectedModuleFilter, setSelectedModuleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Record outcome dialog state
  const [selectedSessionForOutcome, setSelectedSessionForOutcome] = useState(null);
  const [outcomeStatus, setOutcomeStatus] = useState("COMPLETED");
  const [outcomeNotes, setOutcomeNotes] = useState("");
  const [outcomePortionsCovered, setOutcomePortionsCovered] = useState("");
  const [outcomeRemainingPortion, setOutcomeRemainingPortion] = useState("");

  // Reschedule simulation modal state
  const [selectedSessionForReschedule, setSelectedSessionForReschedule] = useState(null);
  const [reschedulePreview, setReschedulePreview] = useState(null);
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [shiftSubsequent, setShiftSubsequent] = useState(true);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleTargetDate, setRescheduleTargetDate] = useState("");
  const [rescheduleStartTime, setRescheduleStartTime] = useState("");
  const [rescheduleEndTime, setRescheduleEndTime] = useState("");
  const [rescheduleRoom, setRescheduleRoom] = useState("");

  // Manual topic allocation modal state
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualDate, setManualDate] = useState("");
  const [manualPeriodId, setManualPeriodId] = useState("");
  const [manualModule, setManualModule] = useState(1);
  const [manualTopic, setManualTopic] = useState("");
  const [manualSubtopic, setManualSubtopic] = useState("");
  const [manualDuration, setManualDuration] = useState(60);
  const [manualNotes, setManualNotes] = useState("");
  const [allocating, setAllocating] = useState(false);

  // Generation parameters state
  const [termStartDate, setTermStartDate] = useState("2026-07-20");
  const [termEndDate, setTermEndDate] = useState("2026-11-13");
  const [allowPastDates, setAllowPastDates] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Extraction Review local edits state
  const [reviewSlots, setReviewSlots] = useState([]);
  const [reviewEvents, setReviewEvents] = useState([]);
  const [, setReviewMilestones] = useState([]);
  const [reviewModules, setReviewModules] = useState([]);
  const [savingReview, setSavingReview] = useState(false);

  // Modal toggles for review additions
  const [showAddSlotModal, setShowAddSlotModal] = useState(false);
  const [newSlot, setNewSlot] = useState({
    dayOfWeek: "MONDAY",
    startTime: "09:00",
    endTime: "10:00",
    durationMinutes: 60,
    roomNumber: "",
    facultyName: "",
  });

  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [newEvent, setNewEvent] = useState({
    startDate: "",
    endDate: "",
    eventName: "",
    eventType: "HOLIDAY",
    isTeachingDay: false,
    colorCode: "#ef4444",
  });

  const reloadData = useCallback(async () => {
    if (!classroomId) return;
    try {
      const [docsRes, inputsRes, planRes, historyRes, plansRes] = await Promise.allSettled([
        getDocuments(classroomId),
        getExtractionInputs(classroomId),
        getActivePlan(classroomId),
        getRescheduleHistory(classroomId),
        getPlans(classroomId),
      ]);

      if (docsRes.status === "fulfilled") {
        setDocuments(docsRes.value || []);
      } else {
        setDocuments([]);
      }

      if (inputsRes.status === "fulfilled") {
        const inp = inputsRes.value || null;
        setInputs(inp);
        setReviewSlots(inp?.timetableSlots || []);
        setReviewEvents(inp?.calendarEvents || []);
        setReviewMilestones(inp?.assessmentMilestones || inp?.milestones || []);
        setReviewModules(inp?.moduleOutlines || []);

        // Prepopulate term start and end dates from events if available
        if (inp?.calendarEvents?.length > 0) {
          const starts = inp.calendarEvents.map((e) => e.startDate).filter(Boolean).sort();
          const seeEvent = inp.calendarEvents.find((e) => {
            const name = (e.name || e.title || e.eventType || "").toUpperCase();
            return name.includes("SEE") || name.includes("SEMESTER END") || name.includes("EXAMINATION");
          });
          const cutoff = seeEvent?.startDate ? seeEvent.startDate : "2026-11-13";
          if (!termStartDate && starts.length > 0) {
            setTermStartDate(starts[0].startsWith("2026") ? starts[0] : "2026-07-20");
          }
          if (!termEndDate) {
            setTermEndDate(cutoff.startsWith("2026") ? cutoff : "2026-11-13");
          }
        }
      } else {
        setInputs(null);
        setReviewSlots([]);
        setReviewEvents([]);
        setReviewMilestones([]);
        setReviewModules([]);
      }

      if (plansRes.status === "fulfilled") {
        setAvailablePlans(plansRes.value || []);
      } else {
        setAvailablePlans([]);
      }

      if (planRes.status === "fulfilled" && planRes.value) {
        setActivePlan(planRes.value);
      }

      if (historyRes.status === "fulfilled") {
        setRescheduleHistory(historyRes.value || []);
      } else {
        setRescheduleHistory([]);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || "Failed to load scheduling workspace");
    } finally {
      setLoading(false);
    }
  }, [classroomId, termStartDate]);

  const handleSelectPlanVersion = async (planId) => {
    if (!planId) return;
    try {
      setLoading(true);
      const plan = await getPlanById(classroomId, planId);
      setActivePlan(plan);
      toast.success(`Switched to schedule v${plan.versionNumber} (${plan.status})`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load selected schedule version");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active && classroomId) {
        // Reset previous classroom state asynchronously before loading new data
        setActivePlan(null);
        setDocuments([]);
        setInputs(null);
        setReviewSlots([]);
        setReviewEvents([]);
        setReviewMilestones([]);
        setReviewModules([]);
        setRescheduleHistory([]);
        setLoading(true);
        reloadData();
      }
    });
    return () => {
      active = false;
    };
  }, [classroomId, reloadData]);

  // Document Upload
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error("Please select a file to upload");
      return;
    }

    try {
      setUploading(true);
      const res = await uploadDocument(
        classroomId,
        selectedFile,
        uploadDocType,
        uploadDocType === "MODULE_PDF" ? uploadModuleNum : null,
        uploadDocType === "MODULE_PDF" ? uploadModuleTitle : ""
      );
      if (res && res.id) {
        setDocuments((prev) => {
          const filtered = prev.filter((d) => d.id !== res.id && d.documentType !== res.documentType);
          return [...filtered, res];
        });
      }
      toast.success(`${uploadDocType.replace("_", " ")} uploaded and analyzed successfully!`);
      setSelectedFile(null);
      setUploadModuleTitle("");
      await reloadData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || "Document upload failed");
    } finally {
      setUploading(false);
    }
  };

  // Dedicated Learning Resource Upload (Section K & L)
  const handleUploadLearningResource = async (e) => {
    e.preventDefault();
    if (!learningResourceFile) {
      toast.error("Please choose a file to upload");
      return;
    }
    if (!learningResourceTitle.trim()) {
      toast.error("Please enter a resource title");
      return;
    }

    try {
      setUploadingResource(true);
      setResourceUploadStatus("Uploading to server...");
      const res = await uploadDocument(
        classroomId,
        learningResourceFile,
        learningResourceType,
        learningResourceType === "MODULE_PDF" ? learningModuleNum : null,
        learningResourceTitle.trim()
      );
      const vStr = res?.version ? `v${res.version}` : "v1";
      setResourceUploadStatus(`Uploaded successfully (${vStr})`);
      toast.success("Learning resource uploaded successfully as draft!");
      setLearningResourceFile(null);
      setLearningResourceTitle("");
      const fileEl = document.getElementById("learningResourceFileInput");
      if (fileEl) fileEl.value = "";
      await reloadData();
    } catch (err) {
      console.error(err);
      setResourceUploadStatus("Upload failed");
      toast.error(err.response?.data?.message || err.message || "Failed to upload resource");
    } finally {
      setUploadingResource(false);
    }
  };

  // Publish / Unpublish Learning Material
  const handlePublishModule = async (docId) => {
    try {
      await publishModuleDocument(classroomId, docId);
      toast.success("Learning resource published! Enrolled students can now access it.");
      await reloadData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || "Failed to publish resource");
    }
  };

  const handleUnpublishModule = async (docId) => {
    try {
      await unpublishModuleDocument(classroomId, docId);
      toast.success("Learning resource unpublished from student view.");
      await reloadData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || "Failed to unpublish resource");
    }
  };

  const handleDeleteDoc = async (docId) => {
    if (!window.confirm("Are you sure you want to delete this document?")) return;
    try {
      await deleteDocument(classroomId, docId);
      toast.success("Document removed");
      await reloadData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || "Failed to delete document");
    }
  };

  // Reset Legacy Data
  const handleResetLegacyData = async () => {
    if (
      !window.confirm(
        "Reset unverified planning data? This will clear any fabricated timetable slots, calendar events, and draft schedules so you can start fresh with real uploaded documents."
      )
    ) {
      return;
    }
    try {
      await resetSchedulingData(classroomId);
      toast.success("Unverified scheduling data reset successfully.");
      await reloadData();
      setActiveTab("intake");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || "Failed to reset scheduling data");
    }
  };

  // Save Timetable Slots Corrections
  const handleSaveSlots = async () => {
    try {
      setSavingReview(true);
      await updateTimetableSlots(classroomId, reviewSlots);
      toast.success("Timetable slots saved!");
      await reloadData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || "Failed to save timetable slots");
    } finally {
      setSavingReview(false);
    }
  };

  // Save Calendar Events Corrections
  const handleSaveEvents = async () => {
    try {
      setSavingReview(true);
      await updateCalendarEvents(classroomId, reviewEvents);
      toast.success("Calendar events saved!");
      await reloadData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || "Failed to save calendar events");
    } finally {
      setSavingReview(false);
    }
  };

  // Save Module Outlines
  const handleSaveModules = async () => {
    try {
      setSavingReview(true);
      const payload = reviewModules.map((m) => ({
        moduleNumber: m.moduleNumber,
        moduleTitle: m.moduleTitle,
        estimatedHours: parseInt(m.estimatedHours ?? m.pedagogyHours ?? 8, 10),
        topics: m.topics || [],
        subtopics: m.subtopics || [],
        textbookReference: m.textbookReference || "",
        associatedDocumentId: m.associatedDocumentId || null,
      }));
      await updateModuleOutlines(classroomId, payload);
      toast.success("Module outlines saved!");
      await reloadData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || "Failed to save module outlines");
    } finally {
      setSavingReview(false);
    }
  };

  // Explicit Verification of Planning Inputs
  const handleVerifyAllInputs = async () => {
    try {
      setSavingReview(true);
      const res = await verifyInputs(classroomId, {
        verifiedByTeacher: true,
        notes: "Verified by teacher",
      });
      setInputs(res);
      toast.success("Planning inputs verified! Schedule generation unlocked.");
      setActiveTab("generate");
      await reloadData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || "Failed to verify inputs");
    } finally {
      setSavingReview(false);
    }
  };

  // Generate Teaching Schedule
  const handleGenerateSchedule = async () => {
    if (!inputs?.inputsVerified) {
      toast.error("You must review and verify planning inputs before generating a schedule.");
      setActiveTab("review");
      return;
    }

    if (!termStartDate || !termEndDate) {
      toast.error("Please specify both Term Start Date and Term End Date");
      return;
    }

    try {
      setGenerating(true);
      const res = await generateSchedule(classroomId, {
        termStartDate,
        termEndDate,
        sessionDurationMinutes: 60,
        revisionBufferDays: 2,
        allowPastDates,
      });
      setActivePlan(res);
      toast.success(`Draft schedule v${res.versionNumber} generated successfully!`);
      setActiveTab("calendar");
      await reloadData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || "Failed to generate schedule");
    } finally {
      setGenerating(false);
    }
  };

  // Approve & Publish Plan
  const handleApprovePlan = async () => {
    if (!activePlan?.planId) return;
    try {
      const approved = await approvePlan(classroomId, activePlan.planId);
      setActivePlan(approved);
      toast.success("Teaching schedule approved & published! Enrolled students notified.");
      await reloadData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || "Failed to approve plan");
    }
  };

  // Outcome Handling
  const handleOpenOutcome = (session) => {
    setSelectedSessionForOutcome(session);
    setOutcomeStatus(session.status || "COMPLETED");
    setOutcomeNotes(session.teacherNotes || "");
    setOutcomePortionsCovered(session.portionsCovered || "");
    setOutcomeRemainingPortion(session.remainingPortion || "");
  };

  const handleSaveOutcome = async () => {
    if (!selectedSessionForOutcome) return;
    try {
      await recordSessionOutcome(
        classroomId,
        selectedSessionForOutcome.id,
        {
          outcome: outcomeStatus,
          teacherNotes: outcomeNotes,
          portionsCovered: outcomePortionsCovered,
          remainingPortion: outcomeRemainingPortion,
        }
      );
      toast.success("Session outcome updated!");
      setSelectedSessionForOutcome(null);
      await reloadData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || "Failed to record outcome");
    }
  };

  // Reschedule Handling
  const handleOpenReschedule = async (session) => {
    setSelectedSessionForReschedule(session);
    setRescheduleReason("");
    setReschedulePreview(null);
    try {
      const preview = await previewReschedule(classroomId, session.id);
      setReschedulePreview(preview);
      if (preview) {
        setRescheduleTargetDate(preview.proposedDate || "");
        setRescheduleStartTime(preview.proposedStartTime ? preview.proposedStartTime.substring(0, 5) : "");
        setRescheduleEndTime(preview.proposedEndTime ? preview.proposedEndTime.substring(0, 5) : "");
        setRescheduleRoom(preview.roomNumber || session.roomNumber || "Main");
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || "Failed to calculate replacement slot");
    }
  };

  const handleLiveReschedulePreview = async (date, start, end, room, shift) => {
    if (!selectedSessionForReschedule) return;
    try {
      const preview = await previewReschedule(classroomId, selectedSessionForReschedule.id, {
        targetDate: date || rescheduleTargetDate || undefined,
        targetStartTime: (start || rescheduleStartTime) ? `${(start || rescheduleStartTime).substring(0, 5)}:00` : undefined,
        targetEndTime: (end || rescheduleEndTime) ? `${(end || rescheduleEndTime).substring(0, 5)}:00` : undefined,
        roomNumber: room !== undefined ? room : rescheduleRoom,
        shiftSubsequentSessions: shift !== undefined ? shift : shiftSubsequent,
      });
      setReschedulePreview(preview);
    } catch (err) {
      console.warn("Live reschedule preview error:", err);
    }
  };

  const handleApplyReschedule = async () => {
    if (!selectedSessionForReschedule || !reschedulePreview) return;
    try {
      setIsRescheduling(true);
      const updatedPlan = await applyReschedule(classroomId, selectedSessionForReschedule.id, {
        reason: rescheduleReason || "Pacing adjustment",
        shiftSubsequentSessions: shiftSubsequent,
        targetDate: rescheduleTargetDate || reschedulePreview.proposedDate,
        targetStartTime: rescheduleStartTime ? `${rescheduleStartTime.substring(0, 5)}:00` : reschedulePreview.proposedStartTime,
        targetEndTime: rescheduleEndTime ? `${rescheduleEndTime.substring(0, 5)}:00` : reschedulePreview.proposedEndTime,
        roomNumber: rescheduleRoom || reschedulePreview.roomNumber || "Main",
      });
      if (updatedPlan) {
        setActivePlan(updatedPlan);
      }
      toast.success("Session rescheduled and calendar updated!");
      setSelectedSessionForReschedule(null);
      setReschedulePreview(null);
      await reloadData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || "Failed to apply reschedule");
    } finally {
      setIsRescheduling(false);
    }
  };

  // Manual Session Allocation
  const handleManualAllocate = async (e) => {
    e.preventDefault();
    if (!manualDate) {
      toast.error("Please pick a date");
      return;
    }
    if (!manualTopic.trim()) {
      toast.error("Please provide a topic title");
      return;
    }

    try {
      setAllocating(true);
      await manualAllocateSession(classroomId, {
        sessionDate: manualDate,
        timetableSlotId: manualPeriodId || null,
        moduleNumber: parseInt(manualModule, 10),
        topicTitle: manualTopic.trim(),
        subtopic: manualSubtopic.trim(),
        durationMinutes: parseInt(manualDuration, 10) || 60,
        notes: manualNotes.trim(),
      });
      toast.success("Topic manually allocated to calendar!");
      setShowManualModal(false);
      setManualTopic("");
      setManualSubtopic("");
      setManualNotes("");
      await reloadData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || "Failed to allocate topic");
    } finally {
      setAllocating(false);
    }
  };

  // Delete Session
  const handleDeleteSession = async (sessionId) => {
    if (!window.confirm("Remove this session from the schedule?")) return;
    try {
      await deleteSession(classroomId, sessionId);
      toast.success("Session removed");
      await reloadData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || "Failed to delete session");
    }
  };

  // Filtered Sessions
  const sessions = activePlan?.sessions || [];
  const filteredSessions = sessions.filter((s) => {
    if (selectedModuleFilter !== "ALL" && s.moduleNumber !== parseInt(selectedModuleFilter, 10)) {
      return false;
    }
    if (statusFilter !== "ALL" && s.status !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTopic = s.topicTitle?.toLowerCase().includes(q);
      const matchSubtopic = s.subtopic?.toLowerCase().includes(q);
      const matchRoom = s.roomNumber?.toLowerCase().includes(q);
      if (!matchTopic && !matchSubtopic && !matchRoom) return false;
    }
    return true;
  });

  // Dynamic modules list strictly from saved official syllabus extraction (no mock data)
  const availableModules = reviewModules || [];

  // Dedicated helper to format distinct document intake statuses
  const getDocStatusBadge = (doc, isVerified, isDocUploading) => {
    if (isDocUploading) {
      return {
        text: "Uploading...",
        bg: "rgba(59, 130, 246, 0.2)",
        color: "#60a5fa",
        border: "1px solid rgba(59, 130, 246, 0.4)",
      };
    }
    if (!doc) {
      return {
        text: "Required — Missing",
        bg: "rgba(239, 68, 68, 0.2)",
        color: "#f87171",
        border: "1px solid rgba(239, 68, 68, 0.35)",
      };
    }
    const status = doc.processingStatus || doc.extractionStatus;
    const vStr = doc.version ? `v${doc.version}` : "v1";

    if (isVerified) {
      return {
        text: `Teacher Verified (${vStr})`,
        bg: "rgba(16, 185, 129, 0.2)",
        color: "#34d399",
        border: "1px solid rgba(16, 185, 129, 0.4)",
      };
    }
    if (status === "EXTRACTED") {
      return {
        text: `Extraction Completed — Review Required (${vStr})`,
        bg: "rgba(16, 185, 129, 0.15)",
        color: "#34d399",
        border: "1px solid rgba(16, 185, 129, 0.4)",
      };
    }
    if (status === "PARTIALLY_EXTRACTED") {
      return {
        text: `Extraction Partially Completed (${vStr})`,
        bg: "rgba(245, 158, 11, 0.2)",
        color: "#fbbf24",
        border: "1px solid rgba(245, 158, 11, 0.4)",
      };
    }
    if (status === "NEEDS_OCR") {
      return {
        text: `OCR Required (${vStr})`,
        bg: "rgba(249, 115, 22, 0.2)",
        color: "#fb923c",
        border: "1px solid rgba(249, 115, 22, 0.4)",
      };
    }
    if (status === "ERROR") {
      return {
        text: `Extraction Failed (${vStr})`,
        bg: "rgba(239, 68, 68, 0.2)",
        color: "#f87171",
        border: "1px solid rgba(239, 68, 68, 0.4)",
      };
    }
    if (status === "EXTRACTING") {
      return {
        text: `Extracting... (${vStr})`,
        bg: "rgba(147, 51, 234, 0.2)",
        color: "#c084fc",
        border: "1px solid rgba(147, 51, 234, 0.4)",
      };
    }
    return {
      text: `Uploaded (${vStr})`,
      bg: "rgba(59, 130, 246, 0.15)",
      color: "#93c5fd",
      border: "1px solid rgba(59, 130, 246, 0.3)",
    };
  };

  // Matched timetable slots for manual allocation date
  const selectedDayOfWeek = manualDate
    ? new Date(manualDate + "T00:00:00")
        .toLocaleDateString("en-US", { weekday: "long" })
        .toUpperCase()
    : null;
  const dayMatchedSlots = selectedDayOfWeek
    ? reviewSlots.filter((slot) => slot.dayOfWeek === selectedDayOfWeek)
    : [];

  // Group documents by type for intake status check
  const timetableDoc = documents.find((d) => d.documentType === "TIMETABLE");
  const calendarDoc = documents.find((d) => d.documentType === "ACADEMIC_CALENDAR");
  const syllabusDoc = documents.find((d) => d.documentType === "OFFICIAL_SYLLABUS");
  const learningDocs = documents.filter((d) => d.documentType === "MODULE_PDF" || d.documentType === "SUPPORTING_NOTES");

  const hasRequiredDocs = Boolean(timetableDoc && calendarDoc && syllabusDoc);
  const inputsVerified = Boolean(inputs?.inputsVerified);
  const canVerifyInputs = Boolean(
    hasRequiredDocs &&
    reviewSlots.length > 0 &&
    reviewEvents.length > 0 &&
    reviewModules.length > 0
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* 1. TOP HERO HEADER */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(30, 27, 46, 0.95), rgba(15, 23, 42, 0.98))",
          border: "1px solid rgba(139, 92, 246, 0.35)",
          borderRadius: 20,
          padding: "24px 28px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 20,
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: 14,
              background: "rgba(139, 92, 246, 0.15)",
              border: "1px solid rgba(139, 92, 246, 0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.7rem",
            }}
          >
            🗓️
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  padding: "3px 10px",
                  borderRadius: 20,
                  background:
                    activePlan?.status === "APPROVED"
                      ? "rgba(16, 185, 129, 0.2)"
                      : activePlan?.status === "DRAFT"
                      ? "rgba(245, 158, 11, 0.2)"
                      : inputsVerified
                      ? "rgba(56, 189, 248, 0.2)"
                      : "rgba(148, 163, 184, 0.2)",
                  color:
                    activePlan?.status === "APPROVED"
                      ? "#34d399"
                      : activePlan?.status === "DRAFT"
                      ? "#fbbf24"
                      : inputsVerified
                      ? "#38bdf8"
                      : "#cbd5e1",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  textTransform: "uppercase",
                }}
              >
                {activePlan
                  ? `${activePlan.status} (v${activePlan.versionNumber})`
                  : inputsVerified
                  ? "Inputs Verified — Ready to Generate"
                  : "Inputs Pending Verification"}
              </span>
              <span style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
                {classroom?.subjectCode} • {classroom?.name} • Sem {classroom?.semester} - Sec {classroom?.section}
              </span>
            </div>
            <h2 style={{ fontSize: "1.55rem", fontWeight: 800, color: "#ffffff", margin: "2px 0 4px 0" }}>
              Document-First Syllabus Scheduling Engine
            </h2>
            <p style={{ margin: 0, fontSize: "0.86rem", color: "#94a3b8" }}>
              Authentic constraint scheduling derived from verified Timetable, Academic Calendar, and Official Syllabus documents.
            </p>
          </div>
        </div>

        {/* TOP QUICK ACTION BUTTONS */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {onNavigateToSyllabus && (
            <button
              type="button"
              className="tsm-btn-secondary"
              style={{ padding: "8px 14px", fontSize: "0.85rem" }}
              onClick={onNavigateToSyllabus}
            >
              📖 Back to Syllabus
            </button>
          )}

          {activePlan && activePlan.status !== "APPROVED" && (
            <button
              type="button"
              className="tsm-btn-primary"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                fontSize: "0.85rem",
                background: "linear-gradient(135deg, #10b981, #059669)",
              }}
              onClick={handleApprovePlan}
            >
              ✓ Approve &amp; Publish Schedule
            </button>
          )}

          {activePlan && (
            <>
              <button
                type="button"
                className="tsm-btn-export"
                style={{ padding: "8px 12px", fontSize: "0.82rem" }}
                onClick={() => downloadIcalExport(classroomId)}
                title="Download iCalendar file"
              >
                📅 iCal (.ics)
              </button>
              <button
                type="button"
                className="tsm-btn-export"
                style={{ padding: "8px 12px", fontSize: "0.82rem" }}
                onClick={() => downloadCsvExport(classroomId)}
                title="Download schedule spreadsheet as CSV"
              >
                📥 CSV
              </button>
            </>
          )}
        </div>
      </div>

      {/* LEGACY UNVERIFIED DATA WARNING BANNER */}
      {inputs?.legacyDataDetected && (
        <div
          style={{
            background: "rgba(245, 158, 11, 0.12)",
            border: "1px solid rgba(245, 158, 11, 0.35)",
            borderRadius: 14,
            padding: "16px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: "1.6rem" }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 700, color: "#fbbf24", fontSize: "0.92rem" }}>
                Legacy Unverified Planning Data Detected
              </div>
              <div style={{ fontSize: "0.82rem", color: "#cbd5e1" }}>
                This classroom has default institutional data from previous versions. To ensure honest scheduling, reset
                unverified records and upload your actual Timetable and Calendar.
              </div>
            </div>
          </div>
          <button
            type="button"
            className="tsm-btn-danger"
            style={{ padding: "6px 14px", fontSize: "0.82rem" }}
            onClick={handleResetLegacyData}
          >
            🔄 Reset Unverified Planning Data
          </button>
        </div>
      )}

      {/* 2. SCHEDULING MODULE SUBTABS */}
      <div className="workspace-subtabs-row" style={{ marginTop: 0 }}>
        <button
          type="button"
          className={`subtab-btn ${activeTab === "intake" ? "active" : ""}`}
          onClick={() => setActiveTab("intake")}
        >
          📁 Planning Document Intake {!hasRequiredDocs && <span className="tab-count-pill" style={{ background: "#ef4444" }}>Required</span>}
        </button>

        <button
          type="button"
          className={`subtab-btn ${activeTab === "review" ? "active" : ""}`}
          onClick={() => setActiveTab("review")}
        >
          🔍 Extraction Review &amp; Inputs {!inputsVerified && <span className="tab-count-pill">Verify</span>}
        </button>

        <button
          type="button"
          className={`subtab-btn ${activeTab === "generate" ? "active" : ""}`}
          onClick={() => setActiveTab("generate")}
        >
          ⚡ Pacing &amp; Feasibility
        </button>

        <button
          type="button"
          className={`subtab-btn ${activeTab === "calendar" ? "active" : ""}`}
          onClick={() => setActiveTab("calendar")}
        >
          📅 Teaching Calendar {sessions.length > 0 && <span className="tab-count-pill">{sessions.length}</span>}
        </button>

        <button
          type="button"
          className={`subtab-btn ${activeTab === "resources" ? "active" : ""}`}
          onClick={() => setActiveTab("resources")}
        >
          📚 Published Learning Resources ({learningDocs.length})
        </button>

        <button
          type="button"
          className={`subtab-btn ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          🔄 Reschedule History {rescheduleHistory.length > 0 && <span className="tab-count-pill">{rescheduleHistory.length}</span>}
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}>
          <div className="spinner" style={{ margin: "0 auto 16px auto" }}></div>
          <p>Loading academic scheduling workspace...</p>
        </div>
      ) : (
        <>
          {/* ======================================================== */}
          {/* TAB 1: PLANNING DOCUMENT INTAKE                          */}
          {/* ======================================================== */}
          {activeTab === "intake" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div
                style={{
                  background: "rgba(30, 27, 46, 0.7)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 16,
                  padding: "24px",
                }}
              >
                <h3 style={{ margin: "0 0 6px 0", color: "#ffffff", fontSize: "1.25rem" }}>
                  Required Planning Documents Intake
                </h3>
                <p style={{ margin: "0 0 20px 0", color: "#94a3b8", fontSize: "0.88rem", lineHeight: 1.5 }}>
                  The scheduling engine generates deterministic sessions by extracting periods from your official Class Timetable,
                  validating dates against your Academic Calendar, and aligning topics from your Subject Syllabus.
                </p>

                {/* INTAKE CARDS GRID */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
                  {/* CARD 1: TIMETABLE */}
                  {(() => {
                    const ttBadge = getDocStatusBadge(timetableDoc, inputs?.timetableVerified, uploading && uploadDocType === "TIMETABLE");
                    return (
                      <div
                        style={{
                          background: timetableDoc ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.06)",
                          border: timetableDoc ? "1px solid rgba(16, 185, 129, 0.3)" : "1px dashed rgba(239, 68, 68, 0.4)",
                          borderRadius: 14,
                          padding: "20px",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          gap: 14,
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
                            <span style={{ fontWeight: 800, color: "#ffffff", fontSize: "1.05rem" }}>1. Class Timetable</span>
                            <span
                              style={{
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                padding: "3px 8px",
                                borderRadius: 6,
                                background: ttBadge.bg,
                                color: ttBadge.color,
                                border: ttBadge.border,
                              }}
                            >
                              {ttBadge.text}
                            </span>
                          </div>
                          <p style={{ fontSize: "0.82rem", color: "#cbd5e1", margin: "0 0 10px 0" }}>
                            Provides weekly periods, day of week, start/end times, room number, and faculty code.
                          </p>
                          {timetableDoc && (
                            <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                              File: <strong>{timetableDoc.originalFilename || timetableDoc.originalFileName || "Timetable"}</strong> ({timetableDoc.formattedFileSize || "Document"}) • Version: v{timetableDoc.version || 1}
                              {timetableDoc.extractedSummary && (
                                <div style={{ marginTop: 4, color: timetableDoc.processingStatus === "ERROR" ? "#f87171" : "#38bdf8", fontSize: "0.75rem" }}>
                                  {timetableDoc.extractedSummary}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <input
                            type="file"
                            id="ttFileInput"
                            style={{ display: "none" }}
                            accept=".pdf,.xlsx,.xls,.csv"
                            onChange={(e) => {
                              if (e.target.files?.[0]) {
                                setSelectedFile(e.target.files[0]);
                                setUploadDocType("TIMETABLE");
                              }
                            }}
                          />
                          <label htmlFor="ttFileInput" className="tsm-btn-secondary" style={{ cursor: "pointer", fontSize: "0.8rem", padding: "6px 12px" }}>
                            📁 {timetableDoc ? "Replace Timetable" : "Upload Timetable"}
                          </label>
                          {selectedFile && uploadDocType === "TIMETABLE" && (
                            <button
                              type="button"
                              className="tsm-btn-primary"
                              style={{ fontSize: "0.8rem", padding: "6px 12px" }}
                              disabled={uploading}
                              onClick={handleUploadSubmit}
                            >
                              {uploading ? "Analyzing..." : "Confirm & Extract"}
                            </button>
                          )}
                          {timetableDoc && (
                            <button
                              type="button"
                              className="tsm-btn-danger"
                              style={{ fontSize: "0.78rem", padding: "5px 10px" }}
                              onClick={() => handleDeleteDoc(timetableDoc.id)}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* CARD 2: ACADEMIC CALENDAR */}
                  {(() => {
                    const calBadge = getDocStatusBadge(calendarDoc, inputs?.calendarVerified, uploading && uploadDocType === "ACADEMIC_CALENDAR");
                    return (
                      <div
                        style={{
                          background: calendarDoc ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.06)",
                          border: calendarDoc ? "1px solid rgba(16, 185, 129, 0.3)" : "1px dashed rgba(239, 68, 68, 0.4)",
                          borderRadius: 14,
                          padding: "20px",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          gap: 14,
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
                            <span style={{ fontWeight: 800, color: "#ffffff", fontSize: "1.05rem" }}>2. Academic Calendar</span>
                            <span
                              style={{
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                padding: "3px 8px",
                                borderRadius: 6,
                                background: calBadge.bg,
                                color: calBadge.color,
                                border: calBadge.border,
                              }}
                            >
                              {calBadge.text}
                            </span>
                          </div>
                          <p style={{ fontSize: "0.82rem", color: "#cbd5e1", margin: "0 0 10px 0" }}>
                            Identifies semester start/end dates, institutional holidays, CIE tests, and examination windows.
                          </p>
                          {calendarDoc && (
                            <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                              File: <strong>{calendarDoc.originalFilename || calendarDoc.originalFileName || "Calendar"}</strong> ({calendarDoc.formattedFileSize || "Document"}) • Version: v{calendarDoc.version || 1}
                              {calendarDoc.extractedSummary && (
                                <div style={{ marginTop: 4, color: calendarDoc.processingStatus === "ERROR" ? "#f87171" : "#38bdf8", fontSize: "0.75rem" }}>
                                  {calendarDoc.extractedSummary}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <input
                            type="file"
                            id="calFileInput"
                            style={{ display: "none" }}
                            accept=".pdf,.xlsx,.xls,.csv"
                            onChange={(e) => {
                              if (e.target.files?.[0]) {
                                setSelectedFile(e.target.files[0]);
                                setUploadDocType("ACADEMIC_CALENDAR");
                              }
                            }}
                          />
                          <label htmlFor="calFileInput" className="tsm-btn-secondary" style={{ cursor: "pointer", fontSize: "0.8rem", padding: "6px 12px" }}>
                            📁 {calendarDoc ? "Replace Calendar" : "Upload Calendar"}
                          </label>
                          {selectedFile && uploadDocType === "ACADEMIC_CALENDAR" && (
                            <button
                              type="button"
                              className="tsm-btn-primary"
                              style={{ fontSize: "0.8rem", padding: "6px 12px" }}
                              disabled={uploading}
                              onClick={handleUploadSubmit}
                            >
                              {uploading ? "Analyzing..." : "Confirm & Extract"}
                            </button>
                          )}
                          {calendarDoc && (
                            <button
                              type="button"
                              className="tsm-btn-danger"
                              style={{ fontSize: "0.78rem", padding: "5px 10px" }}
                              onClick={() => handleDeleteDoc(calendarDoc.id)}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* CARD 3: OFFICIAL SYLLABUS */}
                  {(() => {
                    const sylBadge = getDocStatusBadge(syllabusDoc, inputs?.syllabusVerified, uploading && uploadDocType === "OFFICIAL_SYLLABUS");
                    return (
                      <div
                        style={{
                          background: syllabusDoc ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.06)",
                          border: syllabusDoc ? "1px solid rgba(16, 185, 129, 0.3)" : "1px dashed rgba(239, 68, 68, 0.4)",
                          borderRadius: 14,
                          padding: "20px",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          gap: 14,
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
                            <span style={{ fontWeight: 800, color: "#ffffff", fontSize: "1.05rem" }}>3. Official Subject Syllabus</span>
                            <span
                              style={{
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                padding: "3px 8px",
                                borderRadius: 6,
                                background: sylBadge.bg,
                                color: sylBadge.color,
                                border: sylBadge.border,
                              }}
                            >
                              {sylBadge.text}
                            </span>
                          </div>
                          <p style={{ fontSize: "0.82rem", color: "#cbd5e1", margin: "0 0 10px 0" }}>
                            Extracts subject code, 5 module structures, detailed topic hierarchies, and pedagogy hour requirements.
                          </p>
                          {syllabusDoc && (
                            <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                              File: <strong>{syllabusDoc.originalFilename || syllabusDoc.originalFileName || "Syllabus"}</strong> ({syllabusDoc.formattedFileSize || "Document"}) • Version: v{syllabusDoc.version || 1}
                              {syllabusDoc.extractedSummary && (
                                <div style={{ marginTop: 4, color: syllabusDoc.processingStatus === "ERROR" ? "#f87171" : "#38bdf8", fontSize: "0.75rem" }}>
                                  {syllabusDoc.extractedSummary}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <input
                            type="file"
                            id="sylFileInput"
                            style={{ display: "none" }}
                            accept=".pdf,.txt,.docx,.doc"
                            onChange={(e) => {
                              if (e.target.files?.[0]) {
                                setSelectedFile(e.target.files[0]);
                                setUploadDocType("OFFICIAL_SYLLABUS");
                              }
                            }}
                          />
                          <label htmlFor="sylFileInput" className="tsm-btn-secondary" style={{ cursor: "pointer", fontSize: "0.8rem", padding: "6px 12px" }}>
                            📁 {syllabusDoc ? "Replace Syllabus" : "Upload Syllabus"}
                          </label>
                          {selectedFile && uploadDocType === "OFFICIAL_SYLLABUS" && (
                            <button
                              type="button"
                              className="tsm-btn-primary"
                              style={{ fontSize: "0.8rem", padding: "6px 12px" }}
                              disabled={uploading}
                              onClick={handleUploadSubmit}
                            >
                              {uploading ? "Analyzing..." : "Confirm & Extract"}
                            </button>
                          )}
                          {syllabusDoc && (
                            <button
                              type="button"
                              className="tsm-btn-danger"
                              style={{ fontSize: "0.78rem", padding: "5px 10px" }}
                              onClick={() => handleDeleteDoc(syllabusDoc.id)}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* INTAKE COMPLETION CALLOUT */}
                <div
                  style={{
                    marginTop: 24,
                    padding: "16px 20px",
                    borderRadius: 12,
                    background: "rgba(139, 92, 246, 0.1)",
                    border: "1px solid rgba(139, 92, 246, 0.25)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: "1.4rem" }}>{inputsVerified ? "✅" : "📋"}</span>
                    <div>
                      <div style={{ fontWeight: 700, color: "#ffffff", fontSize: "0.95rem" }}>
                        {inputsVerified
                          ? "Planning Inputs Verified by Teacher"
                          : hasRequiredDocs
                          ? "All Required Documents Uploaded — Ready for Review"
                          : "Upload All 3 Required Documents to Proceed"}
                      </div>
                      <div style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
                        Review extracted timetable periods, calendar holidays, and module hours before generating a schedule.
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="tsm-btn-primary"
                    style={{ padding: "8px 18px", fontSize: "0.85rem" }}
                    onClick={() => setActiveTab("review")}
                  >
                    Open Extraction Review Workspace →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: EXTRACTION REVIEW & TEACHER CORRECTIONS           */}
          {/* ======================================================== */}
          {activeTab === "review" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {/* CLEAN EMPTY STATE WHEN NO PLANNING DATA EXISTS */}
              {!hasRequiredDocs && reviewSlots.length === 0 && reviewEvents.length === 0 && reviewModules.length === 0 ? (
                <div
                  style={{
                    background: "rgba(30, 27, 46, 0.75)",
                    border: "1px dashed rgba(147, 51, 234, 0.45)",
                    borderRadius: 16,
                    padding: "48px 24px",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "2.8rem", marginBottom: 12 }}>📋</div>
                  <h3 style={{ color: "#ffffff", margin: "0 0 10px 0", fontSize: "1.35rem" }}>
                    No Planning Documents Extracted Yet
                  </h3>
                  <p style={{ color: "#94a3b8", maxWidth: 640, margin: "0 auto 24px auto", fontSize: "0.92rem", lineHeight: 1.6 }}>
                    The Extraction Review workspace remains clean and empty until you upload the required documents.
                    Please navigate to the <strong>Document Intake</strong> tab to upload your <strong>Class Timetable</strong>, <strong>Academic Calendar</strong>, and <strong>Official Subject Syllabus</strong>.
                  </p>
                  <button
                    type="button"
                    className="tsm-btn-primary"
                    style={{ padding: "10px 22px", fontSize: "0.9rem" }}
                    onClick={() => setActiveTab("intake")}
                  >
                    Go to Document Intake →
                  </button>
                </div>
              ) : (
                <>
                  {/* VERIFICATION BAR */}
                  <div
                    style={{
                      background: "linear-gradient(135deg, rgba(30, 27, 46, 0.9), rgba(15, 23, 42, 0.9))",
                      border: "1px solid rgba(56, 189, 248, 0.35)",
                      borderRadius: 16,
                      padding: "20px 24px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 16,
                    }}
                  >
                    <div>
                      <h4 style={{ margin: "0 0 4px 0", color: "#ffffff", fontSize: "1.15rem" }}>
                        Teacher Verification &amp; Inputs Review
                      </h4>
                      <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.84rem" }}>
                        Verify extracted periods, calendar non-teaching dates, and module outlines. You can edit any field before generating a plan.
                      </p>
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      {!canVerifyInputs && !inputsVerified && (
                        <span style={{ fontSize: "0.78rem", color: "#f87171" }}>
                          Requires all 3 documents &amp; extracted inputs
                        </span>
                      )}
                      <button
                        type="button"
                        className="tsm-btn-primary"
                        style={{
                          background: inputsVerified
                            ? "#10b981"
                            : canVerifyInputs
                            ? "linear-gradient(135deg, #9333ea, #38bdf8)"
                            : "rgba(100, 116, 139, 0.4)",
                          padding: "10px 20px",
                          fontSize: "0.88rem",
                          fontWeight: 700,
                          cursor: canVerifyInputs && !savingReview ? "pointer" : "not-allowed",
                          opacity: canVerifyInputs || inputsVerified ? 1 : 0.6,
                        }}
                        disabled={savingReview || (!canVerifyInputs && !inputsVerified)}
                        title={
                          !canVerifyInputs && !inputsVerified
                            ? "Please upload Timetable, Calendar, and Official Syllabus and ensure inputs are populated before verification."
                            : ""
                        }
                        onClick={handleVerifyAllInputs}
                      >
                        {inputsVerified ? "✓ Confirmed & Verified" : "✓ Confirm & Verify All Inputs"}
                      </button>
                    </div>
                  </div>

                  {/* EXTRACTION WARNINGS & CONFLICTS BANNER */}
                  {inputs?.warnings && inputs.warnings.length > 0 && (
                    <div
                      style={{
                        background: "rgba(245, 158, 11, 0.08)",
                        border: "1px solid rgba(245, 158, 11, 0.3)",
                        borderRadius: 12,
                        padding: "16px 20px",
                      }}
                    >
                      <h5 style={{ margin: "0 0 8px 0", color: "#fbbf24", display: "flex", alignItems: "center", gap: 8, fontSize: "0.92rem" }}>
                        ⚠️ Extraction &amp; Mapping Notices ({inputs.warnings.length})
                      </h5>
                      <ul style={{ margin: 0, paddingLeft: 20, color: "#fef08a", fontSize: "0.84rem", lineHeight: 1.5 }}>
                        {inputs.warnings.map((w, idx) => (
                          <li key={idx}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 1. TIMETABLE SLOTS REVIEW */}
                  <div
                    style={{
                      background: "rgba(30, 27, 46, 0.65)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: 16,
                      padding: "24px",
                    }}
                  >
                    {/* SUBJECT CODE MISMATCH BANNER */}
                    {inputs?.subjectMismatchWarning && (
                      <div
                        id="timetable-subject-mismatch-banner"
                        style={{
                          background: "rgba(245, 158, 11, 0.12)",
                          border: "1px solid rgba(245, 158, 11, 0.35)",
                          borderRadius: 12,
                          padding: "16px 20px",
                          marginBottom: 20,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: 14,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 260 }}>
                          <div style={{ color: "#fbbf24", fontWeight: 700, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: 8 }}>
                            <span>⚠️</span>
                            <span>Subject Code Mapping Conflict Detected</span>
                          </div>
                          <p style={{ color: "#fef3c7", fontSize: "0.85rem", margin: "6px 0 4px 0", lineHeight: 1.5 }}>
                            {inputs.subjectMismatchWarning}
                          </p>
                          <div style={{ color: "#94a3b8", fontSize: "0.8rem" }}>
                            Detected in Timetable: <strong style={{ color: "#38bdf8" }}>{inputs.detectedTimetableSubjectCode || inputs.detectedSubjectCodes?.join(", ") || classroom?.subjectCode}</strong> • Registered Classroom Code: <strong style={{ color: "#ffffff" }}>{classroom?.subjectCode}</strong>
                          </div>
                        </div>
                        <button
                          type="button"
                          id="btn-confirm-timetable-mapping"
                          style={{
                            background: "linear-gradient(135deg, #f59e0b, #d97706)",
                            color: "#ffffff",
                            fontSize: "0.85rem",
                            padding: "9px 18px",
                            borderRadius: 8,
                            fontWeight: 700,
                            border: "none",
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                            boxShadow: "0 2px 10px rgba(245, 158, 11, 0.3)",
                          }}
                          onClick={async () => {
                            try {
                              const target = inputs.detectedTimetableSubjectCode || inputs.detectedSubjectCodes?.[0] || classroom?.subjectCode;
                              const updated = await confirmTimetableMapping(classroomId, target);
                              setInputs(updated);
                              setReviewSlots(updated?.timetableSlots || []);
                              toast.success(`Confirmed subject mapping for ${target}!`);
                              await reloadData();
                            } catch (err) {
                              toast.error(err.response?.data?.message || err.message || "Failed to confirm subject mapping");
                            }
                          }}
                        >
                          ✓ Confirm & Use {inputs.detectedTimetableSubjectCode || inputs.detectedSubjectCodes?.[0] || classroom?.subjectCode} Periods
                        </button>
                      </div>
                    )}

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                      <div>
                        <h4 style={{ color: "#ffffff", margin: 0, fontSize: "1.15rem" }}>
                          1. Class Timetable Slots ({reviewSlots.length} periods/week)
                        </h4>
                        <p style={{ margin: "2px 0 0 0", color: "#94a3b8", fontSize: "0.82rem" }}>
                          Weekly teaching periods mapped to{" "}
                          <strong style={{ color: "#38bdf8" }}>
                            {inputs?.confirmedSubjectCode || inputs?.detectedTimetableSubjectCode || classroom?.subjectCode || "this classroom"}
                          </strong>
                          {inputs?.confirmedSubjectCode && " (Teacher Confirmed)"}.
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          className="tsm-btn-secondary"
                          style={{ fontSize: "0.8rem", padding: "6px 12px" }}
                          onClick={() => setShowAddSlotModal(true)}
                        >
                          + Add Period
                        </button>
                        <button
                          type="button"
                          className="tsm-btn-primary"
                          style={{ fontSize: "0.8rem", padding: "6px 14px" }}
                          disabled={savingReview}
                          onClick={handleSaveSlots}
                        >
                          Save Slots
                        </button>
                      </div>
                    </div>

                    {reviewSlots.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "30px 0", color: "#94a3b8", fontSize: "0.88rem" }}>
                        {inputs?.subjectMismatchWarning
                          ? inputs.subjectMismatchWarning
                          : "No timetable slots configured. Upload your Class Timetable in the Intake tab or click \"+ Add Period\"."}
                      </div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                        {reviewSlots.map((slot, idx) => (
                          <div
                            key={slot.id || idx}
                            style={{
                              background: "rgba(139, 92, 246, 0.08)",
                              border: "1px solid rgba(139, 92, 246, 0.25)",
                              borderRadius: 12,
                              padding: "16px",
                              position: "relative",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                              <span style={{ fontWeight: 800, color: "#c084fc", fontSize: "1rem" }}>{slot.dayOfWeek}</span>
                              <span style={{ color: "#38bdf8", fontSize: "0.8rem", background: "rgba(56, 189, 248, 0.1)", padding: "2px 6px", borderRadius: 4 }}>
                                Room {slot.roomNumber || "Main"}
                              </span>
                            </div>
                            <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#ffffff" }}>
                              {slot.startTime} - {slot.endTime}
                            </div>
                            <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: 4 }}>
                              Duration: {slot.durationMinutes} mins • Faculty: {slot.facultyName || classroom?.teacherName || "Assigned"}
                            </div>
                            <button
                              type="button"
                              style={{
                                position: "absolute",
                                top: 12,
                                right: 12,
                                background: "transparent",
                                border: "none",
                                color: "#f87171",
                                cursor: "pointer",
                                fontSize: "0.85rem",
                              }}
                              title="Remove slot"
                              onClick={() => {
                                setReviewSlots(reviewSlots.filter((_, sIdx) => sIdx !== idx));
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 2. CALENDAR EVENTS REVIEW */}
                  <div
                    style={{
                      background: "rgba(30, 27, 46, 0.65)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: 16,
                      padding: "24px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                      <div>
                        <h4 style={{ color: "#ffffff", margin: "0 0 4px 0", fontSize: "1.15rem" }}>
                          2. Academic Calendar Events ({reviewEvents.length} entries)
                        </h4>
                        <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.82rem" }}>
                          Holidays, restricted days, assessment tests, and semester examinations.
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          className="tsm-btn-secondary"
                          style={{ fontSize: "0.8rem", padding: "6px 12px" }}
                          onClick={() => setShowAddEventModal(true)}
                        >
                          + Add Calendar Event
                        </button>
                        <button
                          type="button"
                          className="tsm-btn-primary"
                          style={{ fontSize: "0.8rem", padding: "6px 14px" }}
                          disabled={savingReview}
                          onClick={handleSaveEvents}
                        >
                          Save Calendar
                        </button>
                      </div>
                    </div>

                    {reviewEvents.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "30px 0", color: "#94a3b8", fontSize: "0.88rem" }}>
                        No calendar events loaded. Upload your Academic Calendar in the Intake tab or click "+ Add Calendar Event".
                      </div>
                    ) : (
                      <div style={{ maxHeight: 300, overflowY: "auto" }}>
                        <table className="workspace-table">
                          <thead>
                            <tr>
                              <th>Date(s)</th>
                              <th>Event Name</th>
                              <th>Type</th>
                              <th>Teaching Allowed?</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reviewEvents.map((ev, idx) => (
                              <tr key={ev.id || idx}>
                                <td style={{ fontWeight: 600, color: "#ffffff", fontSize: "0.85rem" }}>
                                  {ev.startDate} {ev.endDate && ev.endDate !== ev.startDate ? `to ${ev.endDate}` : ""}
                                </td>
                                <td style={{ color: "#cbd5e1" }}>{ev.eventName}</td>
                                <td>
                                  <span
                                    style={{
                                      color: ev.colorCode || "#94a3b8",
                                      background: `${ev.colorCode || "#94a3b8"}20`,
                                      padding: "2px 8px",
                                      borderRadius: 4,
                                      fontSize: "0.78rem",
                                      fontWeight: 700,
                                    }}
                                  >
                                    {ev.eventType}
                                  </span>
                                </td>
                                <td>
                                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: "0.82rem" }}>
                                    <input
                                      type="checkbox"
                                      checked={ev.isTeachingDay}
                                      onChange={(e) => {
                                        const updated = [...reviewEvents];
                                        updated[idx] = { ...updated[idx], isTeachingDay: e.target.checked };
                                        setReviewEvents(updated);
                                      }}
                                    />
                                    <span style={{ color: ev.isTeachingDay ? "#34d399" : "#f87171", fontWeight: 600 }}>
                                      {ev.isTeachingDay ? "Teaching Allowed" : "No Regular Classes"}
                                    </span>
                                  </label>
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="btn-remove-student"
                                    style={{ padding: "3px 8px", fontSize: "0.75rem" }}
                                    onClick={() => {
                                      setReviewEvents(reviewEvents.filter((_, eIdx) => eIdx !== idx));
                                    }}
                                  >
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* 3. MODULE OUTLINES & PEDAGOGY HOURS REVIEW */}
                  <div
                    style={{
                      background: "rgba(30, 27, 46, 0.65)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: 16,
                      padding: "24px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                      <div>
                        <h4 style={{ color: "#ffffff", margin: "0 0 4px 0", fontSize: "1.15rem" }}>
                          3. Official Syllabus Module Structures ({reviewModules.length} Modules)
                        </h4>
                        <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.82rem" }}>
                          Official modules extracted from syllabus. Edit titles, pedagogy hours, topics, and subtopics before verification.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="tsm-btn-primary"
                        style={{ fontSize: "0.8rem", padding: "6px 14px" }}
                        disabled={savingReview || reviewModules.length === 0}
                        onClick={handleSaveModules}
                      >
                        Save Outlines
                      </button>
                    </div>

                    {reviewModules.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "30px 0", color: "#94a3b8", fontSize: "0.88rem" }}>
                        No syllabus module outlines extracted yet. Please upload the Official Subject Syllabus in the Document Intake tab.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {reviewModules.map((mod, idx) => (
                          <div
                            key={mod.id || idx}
                            style={{
                              background: "rgba(255, 255, 255, 0.03)",
                              border: "1px solid rgba(255, 255, 255, 0.08)",
                              borderRadius: 12,
                              padding: "18px",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                <span className="hero-code-badge">Module {mod.moduleNumber}</span>
                                <input
                                  type="text"
                                  value={mod.moduleTitle || ""}
                                  style={{
                                    background: "rgba(0, 0, 0, 0.3)",
                                    border: "1px solid rgba(255, 255, 255, 0.15)",
                                    color: "#ffffff",
                                    fontWeight: 700,
                                    borderRadius: 6,
                                    padding: "4px 10px",
                                    fontSize: "0.95rem",
                                    minWidth: 260,
                                  }}
                                  onChange={(e) => {
                                    const updated = [...reviewModules];
                                    updated[idx] = { ...updated[idx], moduleTitle: e.target.value };
                                    setReviewModules(updated);
                                  }}
                                />
                                <span
                                  style={{
                                    fontSize: "0.72rem",
                                    padding: "2px 8px",
                                    borderRadius: 4,
                                    background: mod.associatedDocumentId ? "rgba(56, 189, 248, 0.12)" : "rgba(168, 85, 247, 0.12)",
                                    color: mod.associatedDocumentId ? "#38bdf8" : "#c084fc",
                                    border: mod.associatedDocumentId ? "1px solid rgba(56, 189, 248, 0.25)" : "1px solid rgba(168, 85, 247, 0.25)",
                                  }}
                                >
                                  {mod.associatedDocumentId ? "Module PDF Material" : "Official University Syllabus"}
                                </span>
                              </div>

                              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.82rem", color: "#38bdf8" }}>
                                <span>Official Teaching Hours:</span>
                                <input
                                  type="number"
                                  value={mod.estimatedHours ?? mod.pedagogyHours ?? 8}
                                  style={{
                                    width: 58,
                                    background: "rgba(0, 0, 0, 0.3)",
                                    border: "1px solid rgba(56, 189, 248, 0.4)",
                                    color: "#38bdf8",
                                    fontWeight: 800,
                                    borderRadius: 6,
                                    padding: "4px",
                                    textAlign: "center",
                                  }}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10) || 0;
                                    const updated = [...reviewModules];
                                    updated[idx] = { ...updated[idx], estimatedHours: val, pedagogyHours: val };
                                    setReviewModules(updated);
                                  }}
                                />
                                <span>hrs</span>
                              </div>
                            </div>

                            {/* TOPIC HIERARCHY */}
                            <div style={{ marginTop: 10 }}>
                              <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#94a3b8", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                Extracted Topics &amp; Subtopics Hierarchy ({mod.topics?.length || 0} topics, {mod.subtopics?.length || 0} subtopics):
                              </div>

                              {mod.topics && mod.topics.length > 0 ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                  {mod.topics.map((t, tIdx) => (
                                    <div
                                      key={tIdx}
                                      style={{
                                        background: "rgba(255, 255, 255, 0.04)",
                                        border: "1px solid rgba(255, 255, 255, 0.08)",
                                        borderRadius: 6,
                                        padding: "6px 10px",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        fontSize: "0.82rem",
                                      }}
                                    >
                                      <span style={{ color: "#e2e8f0" }}>
                                        <strong style={{ color: "#c084fc", marginRight: 6 }}>Topic {tIdx + 1}:</strong> {t}
                                      </span>
                                      <button
                                        type="button"
                                        style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer", fontSize: "0.78rem" }}
                                        title="Remove topic"
                                        onClick={() => {
                                          const updated = [...reviewModules];
                                          const newTopics = updated[idx].topics.filter((_, i) => i !== tIdx);
                                          updated[idx] = { ...updated[idx], topics: newTopics };
                                          setReviewModules(updated);
                                        }}
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div style={{ fontSize: "0.78rem", color: "#64748b", fontStyle: "italic", marginBottom: 6 }}>
                                  No individual topics parsed yet. Use the inputs below to add topics.
                                </div>
                              )}

                              {/* SUBTOPICS CHIPS */}
                              {mod.subtopics && mod.subtopics.length > 0 && (
                                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  {mod.subtopics.map((st, stIdx) => (
                                    <span
                                      key={stIdx}
                                      style={{
                                        background: "rgba(56, 189, 248, 0.08)",
                                        border: "1px solid rgba(56, 189, 248, 0.2)",
                                        color: "#7dd3fc",
                                        fontSize: "0.75rem",
                                        padding: "3px 8px",
                                        borderRadius: 4,
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 6,
                                      }}
                                    >
                                      <span>↳ {st}</span>
                                      <button
                                        type="button"
                                        style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer", fontSize: "0.72rem", padding: 0 }}
                                        title="Remove subtopic"
                                        onClick={() => {
                                          const updated = [...reviewModules];
                                          const newSubtopics = updated[idx].subtopics.filter((_, i) => i !== stIdx);
                                          updated[idx] = { ...updated[idx], subtopics: newSubtopics };
                                          setReviewModules(updated);
                                        }}
                                      >
                                        ✕
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* ADD TOPIC / SUBTOPIC INPUTS */}
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
                                <input
                                  type="text"
                                  placeholder="+ Add topic (press Enter)..."
                                  style={{
                                    background: "rgba(0, 0, 0, 0.3)",
                                    border: "1px solid rgba(255, 255, 255, 0.12)",
                                    borderRadius: 6,
                                    padding: "6px 10px",
                                    color: "#ffffff",
                                    fontSize: "0.8rem",
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && e.target.value.trim()) {
                                      e.preventDefault();
                                      const updated = [...reviewModules];
                                      const currentTopics = updated[idx].topics || [];
                                      updated[idx] = { ...updated[idx], topics: [...currentTopics, e.target.value.trim()] };
                                      setReviewModules(updated);
                                      e.target.value = "";
                                    }
                                  }}
                                />
                                <input
                                  type="text"
                                  placeholder="+ Add subtopic (press Enter)..."
                                  style={{
                                    background: "rgba(0, 0, 0, 0.3)",
                                    border: "1px solid rgba(255, 255, 255, 0.12)",
                                    borderRadius: 6,
                                    padding: "6px 10px",
                                    color: "#ffffff",
                                    fontSize: "0.8rem",
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && e.target.value.trim()) {
                                      e.preventDefault();
                                      const updated = [...reviewModules];
                                      const currentSubtopics = updated[idx].subtopics || [];
                                      updated[idx] = { ...updated[idx], subtopics: [...currentSubtopics, e.target.value.trim()] };
                                      setReviewModules(updated);
                                      e.target.value = "";
                                    }
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: TEACHING CALENDAR                                 */}
          {/* ======================================================== */}
          {activeTab === "calendar" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* FILTERS & SEARCH BAR */}
              <div
                style={{
                  background: "rgba(30, 27, 46, 0.65)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 14,
                  padding: "16px 20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 16,
                }}
              >
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <input
                    type="text"
                    className="search-input"
                    style={{ width: 260 }}
                    placeholder="Search session topic, subtopic or room..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />

                  {/* Dynamic Module Filter */}
                  <select
                    className="ssm-version-select"
                    value={selectedModuleFilter}
                    onChange={(e) => setSelectedModuleFilter(e.target.value)}
                  >
                    <option value="ALL">All Modules</option>
                    {availableModules.map((m) => (
                      <option key={m.moduleNumber} value={m.moduleNumber}>
                        Module {m.moduleNumber} ({m.moduleTitle})
                      </option>
                    ))}
                  </select>

                  {/* Status Filter */}
                  <select
                    className="ssm-version-select"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="PARTIALLY_COMPLETED">Partially Completed</option>
                    <option value="SKIPPED">Skipped</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>

                  {/* Schedule Plan Version Switcher */}
                  {availablePlans.length > 1 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: "0.8rem", color: "#a78bfa", fontWeight: 600 }}>Plan:</span>
                      <select
                        className="ssm-version-select"
                        value={activePlan?.planId || ""}
                        onChange={(e) => handleSelectPlanVersion(e.target.value)}
                        style={{ borderColor: "rgba(167, 139, 250, 0.4)" }}
                      >
                        {availablePlans.map((p) => (
                          <option key={p.planId} value={p.planId}>
                            v{p.versionNumber} ({p.status}) — {p.totalSessions} Sessions
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="tsm-btn-primary"
                    style={{ padding: "8px 16px", fontSize: "0.85rem" }}
                    onClick={() => setShowManualModal(true)}
                  >
                    + Add Topic to Date
                  </button>
                  <div style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
                    Showing <strong>{filteredSessions.length}</strong> of {sessions.length} sessions
                  </div>
                </div>
              </div>

              {/* SESSIONS LIST */}
              {filteredSessions.length === 0 ? (
                <div className="empty-tab-notice" style={{ padding: 48 }}>
                  <div style={{ fontSize: "2rem", marginBottom: 12 }}>📅</div>
                  <h4 style={{ color: "#ffffff", fontSize: "1.2rem", margin: "0 0 6px 0" }}>
                    No Teaching Sessions Found
                  </h4>
                  <p style={{ color: "#94a3b8", maxWidth: 500, margin: "0 auto 18px auto", fontSize: "0.88rem" }}>
                    {sessions.length === 0
                      ? "No teaching schedule has been generated for this classroom yet. Upload planning documents and generate your schedule to begin."
                      : "No sessions matched your current filter criteria."}
                  </p>
                  {sessions.length === 0 ? (
                    <button className="tsm-btn-primary" onClick={() => setActiveTab("intake")}>
                      Start Document Intake →
                    </button>
                  ) : (
                    <button
                      className="tsm-btn-secondary"
                      onClick={() => {
                        setSelectedModuleFilter("ALL");
                        setStatusFilter("ALL");
                        setSearchQuery("");
                      }}
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {filteredSessions.map((session) => (
                    <div key={session.id} className="tsm-session-card">
                      <div className="tsm-session-card-left">
                        {/* DATE BOX */}
                        <div className="tsm-session-date-box">
                          <span className="tsm-session-date-dow">{session.dayOfWeek?.slice(0, 3)}</span>
                          <span className="tsm-session-date-day">
                            {session.sessionDate ? session.sessionDate.split("-")[2] : ""}
                          </span>
                          <span className="tsm-session-date-month">
                            {session.sessionDate
                              ? new Date(session.sessionDate + "T00:00:00").toLocaleString("default", { month: "short" })
                              : ""}
                          </span>
                        </div>

                        {/* SESSION INFO */}
                        <div className="tsm-session-info">
                          <div className="tsm-session-badges-row">
                            <span className="tsm-topic-type-badge">Session #{session.sessionNumber}</span>
                            <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                              {session.startTime} - {session.endTime} ({session.durationMinutes}m)
                            </span>
                            <span style={{ fontSize: "0.78rem", color: "#38bdf8", background: "rgba(56, 189, 248, 0.1)", padding: "2px 8px", borderRadius: 4 }}>
                              Room {session.roomNumber || "Main"}
                            </span>
                            <span style={{ fontSize: "0.78rem", color: "#c084fc", background: "rgba(192, 132, 252, 0.1)", padding: "2px 8px", borderRadius: 4 }}>
                              Module {session.moduleNumber}
                            </span>
                            {session.milestoneTag && (
                              <span style={{ fontSize: "0.75rem", color: "#fbbf24", background: "rgba(245, 158, 11, 0.15)", padding: "2px 8px", borderRadius: 4, border: "1px solid rgba(245, 158, 11, 0.3)" }}>
                                🎯 {session.milestoneTag}
                              </span>
                            )}
                          </div>

                          <h4 className="tsm-session-title">{session.topicTitle}</h4>
                          {session.subtopic && (
                            <p className="tsm-session-subtopic">
                              ↳ <em>{session.subtopic}</em>
                              {session.subtopicSource && session.subtopicSource !== "OFFICIAL_SYLLABUS" && (
                                <span
                                  className="tsm-subtopic-source-badge"
                                  style={{
                                    marginLeft: 8,
                                    fontSize: "0.68rem",
                                    padding: "1px 6px",
                                    borderRadius: 4,
                                    fontWeight: 500,
                                    background:
                                      session.subtopicSource === "AI_GENERATED"
                                        ? "rgba(168, 85, 247, 0.15)"
                                        : session.subtopicSource === "TEACHER_EDITED"
                                        ? "rgba(16, 185, 129, 0.15)"
                                        : session.subtopicSource === "TEACHER_REVIEW_SUGGESTION"
                                        ? "rgba(245, 158, 11, 0.15)"
                                        : "rgba(59, 130, 246, 0.15)",
                                    color:
                                      session.subtopicSource === "AI_GENERATED"
                                        ? "#c084fc"
                                        : session.subtopicSource === "TEACHER_EDITED"
                                        ? "#34d399"
                                        : session.subtopicSource === "TEACHER_REVIEW_SUGGESTION"
                                        ? "#fbbf24"
                                        : "#60a5fa",
                                    border:
                                      session.subtopicSource === "AI_GENERATED"
                                        ? "1px solid rgba(168, 85, 247, 0.3)"
                                        : session.subtopicSource === "TEACHER_EDITED"
                                        ? "1px solid rgba(16, 185, 129, 0.3)"
                                        : session.subtopicSource === "TEACHER_REVIEW_SUGGESTION"
                                        ? "1px solid rgba(245, 158, 11, 0.3)"
                                        : "1px solid rgba(59, 130, 246, 0.3)",
                                  }}
                                >
                                  {session.subtopicSource === "AI_GENERATED"
                                    ? "✨ AI Focus"
                                    : session.subtopicSource === "TEACHER_EDITED"
                                    ? "✏️ Teacher Focus"
                                    : session.subtopicSource === "TEACHER_REVIEW_SUGGESTION"
                                    ? "💡 Suggested Focus"
                                    : "⚡ Learning Focus"}
                                </span>
                              )}
                              {session.isLocked && (
                                <span
                                  title="Teacher Locked"
                                  style={{
                                    marginLeft: 6,
                                    fontSize: "0.72rem",
                                  }}
                                >
                                  🔒
                                </span>
                              )}
                            </p>
                          )}
                          {session.isCarriedForward && (
                            <div style={{ marginTop: 4 }}>
                              <span style={{ fontSize: "0.72rem", color: "#fbbf24", background: "rgba(245, 158, 11, 0.15)", padding: "2px 8px", borderRadius: 4, border: "1px solid rgba(245, 158, 11, 0.3)" }}>
                                ⚡ Carried forward from Session #{session.carriedForwardFromSessionNumber}
                              </span>
                            </div>
                          )}
                          {session.carriedForwardToSessionNumber && (
                            <div style={{ marginTop: 4 }}>
                              <span style={{ fontSize: "0.72rem", color: "#38bdf8", background: "rgba(56, 189, 248, 0.15)", padding: "2px 8px", borderRadius: 4, border: "1px solid rgba(56, 189, 248, 0.3)" }}>
                                ➡️ Continued in Session #{session.carriedForwardToSessionNumber}
                              </span>
                            </div>
                          )}
                          {session.portionsCovered && (
                            <p style={{ margin: "3px 0 0 0", fontSize: "0.76rem", color: "#cbd5e1" }}>
                              <strong style={{ color: "#34d399" }}>Covered:</strong> {session.portionsCovered}
                            </p>
                          )}
                          {session.remainingPortion && (
                            <p style={{ margin: "3px 0 0 0", fontSize: "0.76rem", color: "#fca5a5" }}>
                              <strong style={{ color: "#fbbf24" }}>Carry-Forward:</strong> {session.remainingPortion}
                            </p>
                          )}
                          {session.teacherNotes && (
                            <p style={{ margin: "4px 0 0 0", fontSize: "0.78rem", color: "#34d399", background: "rgba(16, 185, 129, 0.1)", padding: "3px 8px", borderRadius: 4, display: "inline-block" }}>
                              Note: {session.teacherNotes}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* ACTIONS CLUSTER */}
                      <div className="tsm-session-actions-cluster">
                        <span
                          className={`tsm-badge-${session.status === "COMPLETED" ? "completed" : session.status === "SKIPPED" ? "overdue" : session.status === "PARTIALLY_COMPLETED" ? "in-progress" : "not-started"}`}
                          style={{ fontSize: "0.78rem", padding: "4px 10px", borderRadius: 6 }}
                        >
                          {session.status}
                        </span>

                        <button
                          type="button"
                          className="tsm-session-btn tsm-session-btn-outcome"
                          onClick={() => handleOpenOutcome(session)}
                        >
                          📝 Outcome
                        </button>

                        <button
                          type="button"
                          className="tsm-session-btn tsm-session-btn-reschedule"
                          onClick={() => handleOpenReschedule(session)}
                        >
                          🔄 Reschedule
                        </button>

                        <button
                          type="button"
                          className="tsm-session-btn tsm-session-btn-delete"
                          onClick={() => handleDeleteSession(session.id)}
                          title="Remove session"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 4: PACING & FEASIBILITY / GENERATE                   */}
          {/* ======================================================== */}
          {activeTab === "generate" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div
                style={{
                  background: "rgba(30, 27, 46, 0.7)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 16,
                  padding: "24px",
                }}
              >
                <h3 style={{ margin: "0 0 6px 0", color: "#ffffff", fontSize: "1.25rem" }}>
                  Schedule Generation Parameters &amp; Feasibility
                </h3>
                <p style={{ margin: "0 0 20px 0", color: "#94a3b8", fontSize: "0.88rem" }}>
                  The generator maps verified module pedagogy hours across available timetable slots while honoring non-teaching
                  holidays and exam windows.
                </p>

                {/* GENERATION CONTROLS */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                    gap: 16,
                    background: "rgba(0, 0, 0, 0.25)",
                    padding: "20px",
                    borderRadius: 12,
                    marginBottom: 20,
                  }}
                >
                  <div>
                    <label style={{ display: "block", fontSize: "0.82rem", color: "#cbd5e1", marginBottom: 6, fontWeight: 600 }}>
                      Term Start Date
                    </label>
                    <input
                      type="date"
                      className="search-input"
                      style={{ width: "100%" }}
                      value={termStartDate}
                      onChange={(e) => setTermStartDate(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.82rem", color: "#cbd5e1", marginBottom: 6, fontWeight: 600 }}>
                      Term End Date (Last Working Day)
                    </label>
                    <input
                      type="date"
                      className="search-input"
                      style={{ width: "100%" }}
                      value={termEndDate}
                      onChange={(e) => setTermEndDate(e.target.value)}
                    />
                  </div>
                </div>

                {/* PAST DATES REPLANNING OPTION */}
                {termEndDate && new Date(termEndDate) < new Date() && (
                  <div
                    style={{
                      background: "rgba(245, 158, 11, 0.12)",
                      border: "1px solid rgba(245, 158, 11, 0.35)",
                      borderRadius: 10,
                      padding: "12px 16px",
                      marginBottom: 20,
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <span style={{ fontSize: "1.3rem" }}>⚠️</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: "#fbbf24", fontSize: "0.85rem" }}>
                        Selected Term End Date is in the past ({termEndDate})
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "#cbd5e1" }}>
                        To avoid presenting expired dates as a newly planned semester, please select upcoming term dates,
                        or check the box below if performing historical replanning.
                      </div>
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: "0.82rem", color: "#ffffff", fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={allowPastDates}
                        onChange={(e) => setAllowPastDates(e.target.checked)}
                      />
                      Allow Past Dates Replanning
                    </label>
                  </div>
                )}

                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="tsm-btn-primary"
                    style={{ padding: "10px 22px", fontSize: "0.9rem" }}
                    disabled={generating || !inputsVerified}
                    onClick={handleGenerateSchedule}
                  >
                    {generating ? "Generating Teaching Plan..." : "⚡ Generate Draft Schedule"}
                  </button>

                  {!inputsVerified && (
                    <span style={{ fontSize: "0.82rem", color: "#f87171" }}>
                      ⚠️ Planning inputs must be verified in the Review tab before generating.
                    </span>
                  )}
                </div>
              </div>

              {/* ACTIVE PLAN FEASIBILITY REPORT */}
              {activePlan && (
                <div
                  style={{
                    background: "rgba(30, 27, 46, 0.7)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: 16,
                    padding: "24px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <h4 style={{ color: "#ffffff", margin: 0, fontSize: "1.15rem" }}>
                          Feasibility &amp; Capacity Report (Plan v{activePlan.versionNumber})
                        </h4>
                        <span style={{ fontSize: "0.72rem", padding: "2px 8px", borderRadius: 4, background: activePlan.status === "APPROVED" ? "rgba(16, 185, 129, 0.2)" : "rgba(168, 85, 247, 0.2)", color: activePlan.status === "APPROVED" ? "#34d399" : "#c084fc", fontWeight: 600, border: "1px solid rgba(255, 255, 255, 0.1)" }}>
                          {activePlan.status === "APPROVED" ? "Approved Plan" : "Editable Draft"}
                        </span>
                      </div>
                      <p style={{ margin: "2px 0 0 0", color: "#94a3b8", fontSize: "0.82rem" }}>
                        Evaluation of pedagogy hours vs available timetable periods between {activePlan.termStartDate || "start"} and {activePlan.termEndDate || "end"}.
                      </p>
                    </div>

                    <span
                      style={{
                        padding: "4px 12px",
                        borderRadius: 8,
                        fontWeight: 800,
                        fontSize: "0.82rem",
                        background:
                          activePlan.feasibilityStatus === "FEASIBLE"
                            ? "rgba(16, 185, 129, 0.2)"
                            : activePlan.feasibilityStatus === "TIGHT"
                            ? "rgba(245, 158, 11, 0.2)"
                            : "rgba(239, 68, 68, 0.2)",
                        color:
                          activePlan.feasibilityStatus === "FEASIBLE"
                            ? "#34d399"
                            : activePlan.feasibilityStatus === "TIGHT"
                            ? "#fbbf24"
                            : "#f87171",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                      }}
                    >
                      {activePlan.feasibilityStatus || "FEASIBLE"}
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 18 }}>
                    <div style={{ background: "rgba(255, 255, 255, 0.04)", padding: "12px", borderRadius: 10 }}>
                      <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>Total Sessions</div>
                      <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#ffffff" }}>
                        {activePlan.totalSessions ?? activePlan.totalPlannedSessions ?? activePlan.sessions?.length ?? 0}
                      </div>
                    </div>
                    <div style={{ background: "rgba(255, 255, 255, 0.04)", padding: "12px", borderRadius: 10 }}>
                      <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>Required Teaching Hours</div>
                      <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#38bdf8" }}>
                        {activePlan.requiredHours != null ? `${Number(activePlan.requiredHours).toFixed(0)} hrs` : "0 hrs"}
                      </div>
                    </div>
                    <div style={{ background: "rgba(255, 255, 255, 0.04)", padding: "12px", borderRadius: 10 }}>
                      <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>Allocated Hours</div>
                      <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#34d399" }}>
                        {activePlan.allocatedHours != null ? `${Number(activePlan.allocatedHours).toFixed(0)} hrs` : "0 hrs"}
                      </div>
                    </div>
                    <div style={{ background: "rgba(255, 255, 255, 0.04)", padding: "12px", borderRadius: 10 }}>
                      <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>Available Period Capacity</div>
                      <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#a78bfa" }}>
                        {activePlan.availableHours != null ? `${Number(activePlan.availableHours).toFixed(0)} hrs` : "0 hrs"}
                      </div>
                    </div>
                    <div style={{ background: "rgba(255, 255, 255, 0.04)", padding: "12px", borderRadius: 10 }}>
                      <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>Buffer / Revision Sessions</div>
                      <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#fbbf24" }}>
                        {activePlan.bufferSessionsCount ?? 0}
                      </div>
                    </div>
                  </div>

                  {activePlan.diagnostics?.length > 0 && (
                    <div style={{ background: "rgba(0, 0, 0, 0.25)", padding: "14px", borderRadius: 10 }}>
                      <h5 style={{ margin: "0 0 8px 0", color: "#ffffff", fontSize: "0.88rem" }}>Pacing Diagnostics:</h5>
                      <ul style={{ margin: 0, paddingLeft: 18, color: "#cbd5e1", fontSize: "0.82rem", lineHeight: 1.6 }}>
                        {activePlan.diagnostics.map((d, dIdx) => (
                          <li key={dIdx}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 5: PUBLISHED LEARNING RESOURCES                      */}
          {/* ======================================================== */}
          {activeTab === "resources" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div
                style={{
                  background: "rgba(30, 27, 46, 0.7)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 16,
                  padding: "24px",
                }}
              >
                <h3 style={{ margin: "0 0 6px 0", color: "#ffffff", fontSize: "1.25rem" }}>
                  Published Module Learning Resources
                </h3>
                <p style={{ margin: "0 0 20px 0", color: "#94a3b8", fontSize: "0.88rem" }}>
                  Module PDFs and learning materials are kept logically separate from planning documents.
                  Uploading a module PDF does not automatically release it to students until you explicitly publish it.
                </p>

                {/* RESOURCE UPLOAD FORM (Section K & L: Responsive 3-Row Layout) */}
                <form
                  onSubmit={handleUploadLearningResource}
                  style={{
                    background: "rgba(0, 0, 0, 0.28)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    padding: "24px",
                    borderRadius: 14,
                    marginBottom: 28,
                  }}
                >
                  {/* ROW 1: Resource Type and Target Module */}
                  <div className="tsm-form-row" style={{ marginBottom: 16 }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.82rem", color: "#cbd5e1", marginBottom: 6, fontWeight: 600 }}>
                        Resource Type <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <select
                        id="resourceTypeSelect"
                        className="ssm-version-select tsm-form-input"
                        value={learningResourceType}
                        onChange={(e) => {
                          const newType = e.target.value;
                          setLearningResourceType(newType);
                          if (newType === "MODULE_PDF" && !learningModuleNum && availableModules.length > 0) {
                            setLearningModuleNum(availableModules[0].moduleNumber);
                          }
                        }}
                      >
                        <option value="MODULE_PDF">Module PDF (Topic / Unit Notes)</option>
                        <option value="QUESTION_PAPER">Question Paper (Model / Previous Exam)</option>
                        <option value="NOTES_STUDY_MATERIAL">Notes / Study Material</option>
                        <option value="OFFICIAL_SYLLABUS">Subject Syllabus</option>
                        <option value="OTHER_RESOURCE">Other Resource</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.82rem", color: "#cbd5e1", marginBottom: 6, fontWeight: 600 }}>
                        Target Module {learningResourceType === "MODULE_PDF" ? <span style={{ color: "#ef4444" }}>*</span> : <span style={{ color: "#94a3b8" }}>(Optional / Subject-wide)</span>}
                      </label>
                      <select
                        id="resourceTargetModuleSelect"
                        className="ssm-version-select tsm-form-input"
                        value={learningModuleNum ?? ""}
                        disabled={learningResourceType !== "MODULE_PDF" && availableModules.length === 0}
                        onChange={(e) => setLearningModuleNum(e.target.value ? parseInt(e.target.value, 10) : null)}
                      >
                        {learningResourceType !== "MODULE_PDF" && <option value="">Subject-wide (All Modules)</option>}
                        {availableModules.length === 0 ? (
                          <option value="" disabled>No extracted modules available</option>
                        ) : (
                          availableModules.map((m) => (
                            <option key={m.moduleNumber} value={m.moduleNumber}>
                              Module {m.moduleNumber}: {m.moduleTitle}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  </div>

                  {/* ROW 2: Resource Title and Choose File */}
                  <div className="tsm-form-row" style={{ marginBottom: 18 }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.82rem", color: "#cbd5e1", marginBottom: 6, fontWeight: 600 }}>
                        Resource Title <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <input
                        id="resourceTitleInput"
                        type="text"
                        className="tsm-form-input"
                        placeholder="e.g. Module 1 Complete Reference Notes & Solved Problems"
                        value={learningResourceTitle}
                        onChange={(e) => setLearningResourceTitle(e.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.82rem", color: "#cbd5e1", marginBottom: 6, fontWeight: 600 }}>
                        Choose File (PDF, XLSX, DOCX, PPTX) <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <input
                        id="learningResourceFileInput"
                        type="file"
                        className="tsm-form-input"
                        style={{ cursor: "pointer", padding: "8px 12px" }}
                        accept=".pdf,.xlsx,.xls,.docx,.pptx,.txt"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            setLearningResourceFile(e.target.files[0]);
                            setResourceUploadStatus(null);
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* ROW 3: Upload Resource button and upload status */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
                    <button
                      id="btn-upload-learning-resource"
                      type="submit"
                      className="tsm-btn-primary"
                      style={{ minWidth: 200, padding: "10px 24px", fontSize: "0.9rem" }}
                      disabled={uploadingResource || !learningResourceFile || !learningResourceTitle.trim()}
                    >
                      {uploadingResource ? "Uploading Resource..." : "Upload Resource"}
                    </button>

                    {resourceUploadStatus && (
                      <div
                        style={{
                          fontSize: "0.85rem",
                          fontWeight: 600,
                          padding: "6px 14px",
                          borderRadius: 8,
                          background: resourceUploadStatus.includes("success") ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)",
                          color: resourceUploadStatus.includes("success") ? "#34d399" : "#fbbf24",
                          border: "1px solid rgba(255, 255, 255, 0.1)",
                        }}
                      >
                        {resourceUploadStatus}
                      </div>
                    )}
                  </div>
                </form>

                {/* RESOURCES LIST */}
                {learningDocs.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "30px 0", color: "#94a3b8", fontSize: "0.88rem" }}>
                    No learning materials uploaded yet. Use the form above to attach module-specific PDFs.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="workspace-table">
                      <thead>
                        <tr>
                          <th>Module</th>
                          <th>Resource Title / File</th>
                          <th>Version</th>
                          <th>Size</th>
                          <th>Status</th>
                          <th>Student Visibility</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {learningDocs.map((doc) => (
                          <tr key={doc.id}>
                            <td>
                              <span className="hero-code-badge">Module {doc.moduleNumber || "—"}</span>
                            </td>
                            <td>
                              <div style={{ fontWeight: 600, color: "#ffffff" }}>
                                {doc.moduleTitle || doc.originalFilename || doc.originalFileName || "Learning Resource"}
                              </div>
                              <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>{doc.originalFilename || doc.originalFileName}</div>
                            </td>
                            <td>{doc.version ? `v${doc.version}` : "v1"}</td>
                            <td>{doc.formattedFileSize || "PDF"}</td>
                            <td>
                              <span
                                style={{
                                  padding: "2px 8px",
                                  borderRadius: 4,
                                  fontSize: "0.76rem",
                                  fontWeight: 700,
                                  background: doc.published ? "rgba(16, 185, 129, 0.2)" : "rgba(148, 163, 184, 0.2)",
                                  color: doc.published ? "#34d399" : "#cbd5e1",
                                }}
                              >
                                {doc.published ? "PUBLISHED" : "DRAFT"}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: "0.82rem", color: doc.published ? "#34d399" : "#94a3b8" }}>
                                {doc.published ? "✓ Visible to Enrolled Students" : "Teacher Only (Hidden)"}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {doc.published ? (
                                  <button
                                    type="button"
                                    className="tsm-btn-secondary"
                                    style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                                    onClick={() => handleUnpublishModule(doc.id)}
                                  >
                                    Unpublish
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="tsm-btn-primary"
                                    style={{ padding: "4px 8px", fontSize: "0.75rem", background: "linear-gradient(135deg, #10b981, #059669)" }}
                                    onClick={() => handlePublishModule(doc.id)}
                                  >
                                    Publish
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="tsm-btn-secondary"
                                  style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                                  onClick={() => downloadDocument(classroomId, doc.id, doc.originalFilename)}
                                >
                                  Download
                                </button>
                                <button
                                  type="button"
                                  className="btn-remove-student"
                                  style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                                  onClick={() => handleDeleteDoc(doc.id)}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 6: RESCHEDULE HISTORY                                */}
          {/* ======================================================== */}
          {activeTab === "history" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div
                style={{
                  background: "rgba(30, 27, 46, 0.7)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 16,
                  padding: "24px",
                }}
              >
                <h3 style={{ margin: "0 0 6px 0", color: "#ffffff", fontSize: "1.25rem" }}>
                  Schedule Modification &amp; Reschedule Audit History
                </h3>
                <p style={{ margin: "0 0 20px 0", color: "#94a3b8", fontSize: "0.88rem" }}>
                  Chronological record of teaching session replanning, replacement slot shifts, and pacing adjustments.
                </p>

                {rescheduleHistory.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "30px 0", color: "#94a3b8", fontSize: "0.88rem" }}>
                    No sessions have been rescheduled yet. The active schedule is running on its original plan.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="workspace-table">
                      <thead>
                        <tr>
                          <th>Topic</th>
                          <th>Original Date</th>
                          <th>Rescheduled Date</th>
                          <th>Reason</th>
                          <th>Rescheduled By</th>
                          <th>Timestamp</th>
                          <th>Impacted Sessions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rescheduleHistory.map((rec) => (
                          <tr key={rec.id}>
                            <td style={{ fontWeight: 600, color: "#ffffff" }}>{rec.topicTitle || "Session"}</td>
                            <td style={{ color: "#f87171" }}>{rec.originalDate}</td>
                            <td style={{ color: "#34d399", fontWeight: 700 }}>{rec.newDate}</td>
                            <td>{rec.reason || "Pacing adjustment"}</td>
                            <td>{rec.rescheduledBy || "Teacher"}</td>
                            <td style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                              {rec.rescheduledAt ? new Date(rec.rescheduledAt).toLocaleString() : "Recently"}
                            </td>
                            <td>
                              <span style={{ color: "#fbbf24", fontWeight: 700 }}>
                                {rec.impactedSubsequentSessions || 0}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: RECORD OUTCOME                                  */}
      {/* ======================================================== */}
      {selectedSessionForOutcome && (
        <div className="modal-backdrop">
          <div className="sched-modal-card" style={{ maxWidth: 480 }}>
            <div className="sched-modal-header">
              <h2>Record Teaching Outcome</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedSessionForOutcome(null)}
              >
                ✕
              </button>
            </div>

            <div className="sched-modal-body">
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontWeight: 700, color: "#ffffff", fontSize: "1.05rem" }}>
                  Session #{selectedSessionForOutcome.sessionNumber}: {selectedSessionForOutcome.topicTitle}
                </div>
                <div style={{ fontSize: "0.82rem", color: "#94a3b8", marginTop: 2 }}>
                  Date: {selectedSessionForOutcome.sessionDate} • Module {selectedSessionForOutcome.moduleNumber}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: "0.82rem", color: "#cbd5e1", marginBottom: 6, fontWeight: 600 }}>
                  Delivery Status
                </label>
                <select
                  className="ssm-version-select"
                  style={{ width: "100%" }}
                  value={outcomeStatus}
                  onChange={(e) => setOutcomeStatus(e.target.value)}
                >
                  <option value="COMPLETED">Completed (Fully Delivered)</option>
                  <option value="PARTIALLY_COMPLETED">Partially Completed (Requires Continuation)</option>
                  <option value="SKIPPED">Skipped (Class Postponed / Missed)</option>
                  <option value="SCHEDULED">Scheduled (Not Yet Conducted)</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              {outcomeStatus === "PARTIALLY_COMPLETED" && (
                <div style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: 10, padding: "12px", marginBottom: 16 }}>
                  <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#fbbf24", marginBottom: 6 }}>
                    ⚡ Adaptive Carry-Forward Workflow
                  </div>
                  <p style={{ margin: "0 0 10px 0", fontSize: "0.78rem", color: "#e2e8f0", lineHeight: 1.4 }}>
                    The unfinished portion will be carried forward into the next available timetable period. Downstream sessions shift to preserve syllabus sequence without inventing extra slots.
                  </p>
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ display: "block", fontSize: "0.78rem", color: "#cbd5e1", marginBottom: 4 }}>
                      Portion Completed in this Session:
                    </label>
                    <input
                      type="text"
                      className="search-input"
                      style={{ width: "100%" }}
                      placeholder="e.g. Completed Introduction & Architecture concepts"
                      value={outcomePortionsCovered}
                      onChange={(e) => setOutcomePortionsCovered(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.78rem", color: "#cbd5e1", marginBottom: 4 }}>
                      Remaining Portion to Carry Forward:
                    </label>
                    <input
                      type="text"
                      className="search-input"
                      style={{ width: "100%" }}
                      placeholder="e.g. Practical Implementation & Protocol details remaining"
                      value={outcomeRemainingPortion}
                      onChange={(e) => setOutcomeRemainingPortion(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: "0.82rem", color: "#cbd5e1", marginBottom: 6, fontWeight: 600 }}>
                  Teacher Notes / Topics Covered
                </label>
                <textarea
                  className="search-input"
                  style={{ width: "100%", height: 75, resize: "none" }}
                  placeholder="e.g. Covered core concepts; hands-on demo to be continued in next period."
                  value={outcomeNotes}
                  onChange={(e) => setOutcomeNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="sched-modal-footer">
              <button
                type="button"
                className="tsm-btn-secondary"
                onClick={() => setSelectedSessionForOutcome(null)}
              >
                Cancel
              </button>
              <button type="button" className="tsm-btn-primary" onClick={handleSaveOutcome}>
                Save Outcome
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: RESCHEDULE PREVIEW & CONFIRMATION               */}
      {/* ======================================================== */}
      {selectedSessionForReschedule && (
        <div className="modal-backdrop">
          <div className="sched-modal-card" style={{ maxWidth: 580 }}>
            <div className="sched-modal-header">
              <h2>Adaptive Session Reschedule</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedSessionForReschedule(null)}
              >
                ✕
              </button>
            </div>

            <div className="sched-modal-body">
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontWeight: 700, color: "#ffffff", fontSize: "1.05rem" }}>
                  #{selectedSessionForReschedule.sessionNumber}: {selectedSessionForReschedule.topicTitle}
                </div>
                <div style={{ fontSize: "0.82rem", color: "#f87171", marginTop: 2 }}>
                  Current Allocated Date: {selectedSessionForReschedule.sessionDate} ({selectedSessionForReschedule.startTime} - {selectedSessionForReschedule.endTime}) • Room {selectedSessionForReschedule.roomNumber || "Main"}
                </div>
              </div>

              {/* EDITABLE RESCHEDULING PARAMETERS */}
              <div style={{ background: "rgba(255, 255, 255, 0.04)", borderRadius: 10, padding: "14px", marginBottom: 14 }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#a78bfa", marginBottom: 10 }}>
                  Customize Replacement Slot
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.76rem", color: "#cbd5e1", marginBottom: 4 }}>
                      Replacement Date
                    </label>
                    <input
                      type="date"
                      className="search-input"
                      style={{ width: "100%" }}
                      value={rescheduleTargetDate}
                      onChange={(e) => {
                        setRescheduleTargetDate(e.target.value);
                        handleLiveReschedulePreview(e.target.value, rescheduleStartTime, rescheduleEndTime, rescheduleRoom, shiftSubsequent);
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.76rem", color: "#cbd5e1", marginBottom: 4 }}>
                      Room Number
                    </label>
                    <input
                      type="text"
                      className="search-input"
                      style={{ width: "100%" }}
                      placeholder="e.g. Room A201"
                      value={rescheduleRoom}
                      onChange={(e) => {
                        setRescheduleRoom(e.target.value);
                        handleLiveReschedulePreview(rescheduleTargetDate, rescheduleStartTime, rescheduleEndTime, e.target.value, shiftSubsequent);
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.76rem", color: "#cbd5e1", marginBottom: 4 }}>
                      Start Time
                    </label>
                    <input
                      type="time"
                      className="search-input"
                      style={{ width: "100%" }}
                      value={rescheduleStartTime}
                      onChange={(e) => {
                        setRescheduleStartTime(e.target.value);
                        handleLiveReschedulePreview(rescheduleTargetDate, e.target.value, rescheduleEndTime, rescheduleRoom, shiftSubsequent);
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.76rem", color: "#cbd5e1", marginBottom: 4 }}>
                      End Time
                    </label>
                    <input
                      type="time"
                      className="search-input"
                      style={{ width: "100%" }}
                      value={rescheduleEndTime}
                      onChange={(e) => {
                        setRescheduleEndTime(e.target.value);
                        handleLiveReschedulePreview(rescheduleTargetDate, rescheduleStartTime, e.target.value, rescheduleRoom, shiftSubsequent);
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* VALIDATION NOTICES & CONFLICTS */}
              {reschedulePreview?.conflictWarnings?.length > 0 && (
                <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.4)", borderRadius: 8, padding: "10px", marginBottom: 12 }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#f87171" }}>Schedule Conflict / Warnings:</div>
                  <ul style={{ margin: "4px 0 0 0", paddingLeft: 18, color: "#fca5a5", fontSize: "0.76rem", lineHeight: 1.5 }}>
                    {reschedulePreview.conflictWarnings.map((w, wIdx) => (
                      <li key={wIdx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {reschedulePreview?.deadlineImpact && (
                <div style={{ fontSize: "0.78rem", color: "#38bdf8", marginBottom: 12 }}>
                  ℹ️ {reschedulePreview.deadlineImpact}
                </div>
              )}

              {/* CASCADING IMPACT PREVIEW */}
              {shiftSubsequent && reschedulePreview?.affectedSessionsPreview?.length > 0 && (
                <div style={{ maxHeight: 150, overflowY: "auto", background: "rgba(0, 0, 0, 0.3)", borderRadius: 8, padding: "8px", marginBottom: 14, border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                  <div style={{ fontSize: "0.76rem", color: "#fbbf24", fontWeight: 700, marginBottom: 4 }}>
                    Cascading Impact ({reschedulePreview.affectedSessionsPreview.length} subsequent sessions will move):
                  </div>
                  <table style={{ width: "100%", fontSize: "0.74rem", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ color: "#94a3b8", textAlign: "left" }}>
                        <th style={{ padding: "3px 6px" }}>Session</th>
                        <th style={{ padding: "3px 6px" }}>Topic</th>
                        <th style={{ padding: "3px 6px" }}>Original</th>
                        <th style={{ padding: "3px 6px" }}>Proposed New</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reschedulePreview.affectedSessionsPreview.slice(0, 8).map((aff, aIdx) => (
                        <tr key={aIdx} style={{ borderTop: "1px solid rgba(255, 255, 255, 0.05)", color: "#cbd5e1" }}>
                          <td style={{ padding: "3px 6px" }}>#{aff.sessionNumber}</td>
                          <td style={{ padding: "3px 6px" }}>{aff.topicTitle}</td>
                          <td style={{ padding: "3px 6px", color: "#f87171" }}>{aff.originalDate}</td>
                          <td style={{ padding: "3px 6px", color: "#34d399", fontWeight: 600 }}>{aff.newDate} ({aff.newStartTime?.substring(0, 5)})</td>
                        </tr>
                      ))}
                      {reschedulePreview.affectedSessionsPreview.length > 8 && (
                        <tr>
                          <td colSpan={4} style={{ padding: "4px 6px", color: "#94a3b8", fontStyle: "italic", textAlign: "center" }}>
                            ...and {reschedulePreview.affectedSessionsPreview.length - 8} more subsequent sessions shift forward
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: "0.82rem", color: "#cbd5e1", marginBottom: 6, fontWeight: 600 }}>
                  Reason for Rescheduling
                </label>
                <input
                  type="text"
                  className="search-input"
                  style={{ width: "100%" }}
                  placeholder="e.g. Faculty on duty / Special lab session"
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.82rem", color: "#cbd5e1" }}>
                  <input
                    type="checkbox"
                    checked={shiftSubsequent}
                    onChange={(e) => {
                      setShiftSubsequent(e.target.checked);
                      handleLiveReschedulePreview(rescheduleTargetDate, rescheduleStartTime, rescheduleEndTime, rescheduleRoom, e.target.checked);
                    }}
                  />
                  Shift subsequent sessions to preserve syllabus order
                </label>
              </div>
            </div>

            <div className="sched-modal-footer">
              <button
                type="button"
                className="tsm-btn-secondary"
                onClick={() => setSelectedSessionForReschedule(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="tsm-btn-primary"
                disabled={!reschedulePreview || isRescheduling}
                onClick={handleApplyReschedule}
              >
                {isRescheduling ? "Applying..." : "Confirm Reschedule"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: MANUAL TOPIC ALLOCATION (+ Add Topic to Date)   */}
      {/* ======================================================== */}
      {showManualModal && (
        <div className="modal-backdrop">
          <div className="sched-modal-card" style={{ maxWidth: 520 }}>
            <div className="sched-modal-header">
              <h2>Add Topic to Date (Manual Allocation)</h2>
              <button type="button" className="modal-close-btn" onClick={() => setShowManualModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleManualAllocate} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
              <div className="sched-modal-body">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "#cbd5e1", marginBottom: 6, fontWeight: 600 }}>
                      Target Date
                    </label>
                    <input
                      type="date"
                      className="search-input"
                      style={{ width: "100%" }}
                      value={manualDate}
                      onChange={(e) => setManualDate(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "#cbd5e1", marginBottom: 6, fontWeight: 600 }}>
                      Target Module
                    </label>
                    <select
                      className="ssm-version-select"
                      style={{ width: "100%" }}
                      value={manualModule}
                      onChange={(e) => setManualModule(e.target.value)}
                    >
                      {availableModules.length === 0 ? (
                        <option value="" disabled>No extracted modules available</option>
                      ) : (
                        availableModules.map((m) => (
                          <option key={m.moduleNumber} value={m.moduleNumber}>
                            Module {m.moduleNumber}: {m.moduleTitle}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                {/* TIMETABLE PERIOD SELECTION FOR THIS DAY */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "#cbd5e1", marginBottom: 6, fontWeight: 600 }}>
                    Timetable Period on {selectedDayOfWeek || "Selected Day"}
                  </label>
                  {dayMatchedSlots.length > 0 ? (
                    <select
                      className="ssm-version-select"
                      style={{ width: "100%" }}
                      value={manualPeriodId}
                      onChange={(e) => setManualPeriodId(e.target.value)}
                    >
                      <option value="">Default Timetable Slot (Auto-match)</option>
                      {dayMatchedSlots.map((slot) => (
                        <option key={slot.id} value={slot.id}>
                          {slot.startTime} - {slot.endTime} (Room {slot.roomNumber || "Main"}, {slot.durationMinutes}m)
                        </option>
                      ))}
                    </select>
                  ) : manualDate ? (
                    <div style={{ fontSize: "0.8rem", color: "#fbbf24", background: "rgba(245, 158, 11, 0.1)", padding: "8px 12px", borderRadius: 8 }}>
                      ℹ️ No verified slot on {selectedDayOfWeek}. An extra/compensatory period will be allocated.
                    </div>
                  ) : (
                    <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Pick a date to view available periods.</div>
                  )}
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "#cbd5e1", marginBottom: 6, fontWeight: 600 }}>
                    Topic Title
                  </label>
                  <input
                    type="text"
                    className="search-input"
                    style={{ width: "100%" }}
                    placeholder="e.g. Distributed File System Architecture"
                    value={manualTopic}
                    onChange={(e) => setManualTopic(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 14 }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "#cbd5e1", marginBottom: 6, fontWeight: 600 }}>
                      Subtopic / Focus
                    </label>
                    <input
                      type="text"
                      className="search-input"
                      style={{ width: "100%" }}
                      placeholder="e.g. NameNode replication"
                      value={manualSubtopic}
                      onChange={(e) => setManualSubtopic(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "#cbd5e1", marginBottom: 6, fontWeight: 600 }}>
                      Duration (mins)
                    </label>
                    <input
                      type="number"
                      className="search-input"
                      style={{ width: "100%" }}
                      value={manualDuration}
                      onChange={(e) => setManualDuration(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "#cbd5e1", marginBottom: 6, fontWeight: 600 }}>
                    Notes / Reason for Manual Allocation
                  </label>
                  <input
                    type="text"
                    className="search-input"
                    style={{ width: "100%" }}
                    placeholder="e.g. Special lecture / syllabus advance"
                    value={manualNotes}
                    onChange={(e) => setManualNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="sched-modal-footer">
                <button type="button" className="tsm-btn-secondary" onClick={() => setShowManualModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="tsm-btn-primary" disabled={allocating}>
                  {allocating ? "Allocating..." : "Add to Calendar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: ADD TIMETABLE SLOT                              */}
      {/* ======================================================== */}
      {showAddSlotModal && (
        <div className="modal-backdrop">
          <div className="sched-modal-card" style={{ maxWidth: 460 }}>
            <div className="sched-modal-header">
              <h2>Add Timetable Period</h2>
              <button type="button" className="modal-close-btn" onClick={() => setShowAddSlotModal(false)}>
                ✕
              </button>
            </div>

            <div className="sched-modal-body">
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "#cbd5e1", marginBottom: 4 }}>Day of Week</label>
                  <select
                    className="ssm-version-select"
                    style={{ width: "100%" }}
                    value={newSlot.dayOfWeek}
                    onChange={(e) => setNewSlot({ ...newSlot, dayOfWeek: e.target.value })}
                  >
                    {["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"].map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "#cbd5e1", marginBottom: 4 }}>Start Time</label>
                    <input
                      type="time"
                      className="search-input"
                      style={{ width: "100%" }}
                      value={newSlot.startTime}
                      onChange={(e) => setNewSlot({ ...newSlot, startTime: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "#cbd5e1", marginBottom: 4 }}>End Time</label>
                    <input
                      type="time"
                      className="search-input"
                      style={{ width: "100%" }}
                      value={newSlot.endTime}
                      onChange={(e) => setNewSlot({ ...newSlot, endTime: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "#cbd5e1", marginBottom: 4 }}>Room Number</label>
                    <input
                      type="text"
                      className="search-input"
                      style={{ width: "100%" }}
                      placeholder="e.g. 302"
                      value={newSlot.roomNumber}
                      onChange={(e) => setNewSlot({ ...newSlot, roomNumber: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "#cbd5e1", marginBottom: 4 }}>Faculty</label>
                    <input
                      type="text"
                      className="search-input"
                      style={{ width: "100%" }}
                      placeholder="Faculty Name"
                      value={newSlot.facultyName}
                      onChange={(e) => setNewSlot({ ...newSlot, facultyName: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="sched-modal-footer">
              <button type="button" className="tsm-btn-secondary" onClick={() => setShowAddSlotModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="tsm-btn-primary"
                onClick={() => {
                  setReviewSlots([...reviewSlots, { ...newSlot, id: `slot_${Date.now()}` }]);
                  setShowAddSlotModal(false);
                }}
              >
                Add Slot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: ADD CALENDAR EVENT                              */}
      {/* ======================================================== */}
      {showAddEventModal && (
        <div className="modal-backdrop">
          <div className="sched-modal-card" style={{ maxWidth: 480 }}>
            <div className="sched-modal-header">
              <h2>Add Academic Calendar Event</h2>
              <button type="button" className="modal-close-btn" onClick={() => setShowAddEventModal(false)}>
                ✕
              </button>
            </div>

            <div className="sched-modal-body">
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "#cbd5e1", marginBottom: 4 }}>Event Name</label>
                  <input
                    type="text"
                    className="search-input"
                    style={{ width: "100%" }}
                    placeholder="e.g. Independence Day / Internal Assessment 1"
                    value={newEvent.eventName}
                    onChange={(e) => setNewEvent({ ...newEvent, eventName: e.target.value })}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "#cbd5e1", marginBottom: 4 }}>Start Date</label>
                    <input
                      type="date"
                      className="search-input"
                      style={{ width: "100%" }}
                      value={newEvent.startDate}
                      onChange={(e) => setNewEvent({ ...newEvent, startDate: e.target.value, endDate: newEvent.endDate || e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: "#cbd5e1", marginBottom: 4 }}>End Date</label>
                    <input
                      type="date"
                      className="search-input"
                      style={{ width: "100%" }}
                      value={newEvent.endDate}
                      onChange={(e) => setNewEvent({ ...newEvent, endDate: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "#cbd5e1", marginBottom: 4 }}>Event Type</label>
                  <select
                    className="ssm-version-select"
                    style={{ width: "100%" }}
                    value={newEvent.eventType}
                    onChange={(e) => {
                      const type = e.target.value;
                      const isHoliday = type === "HOLIDAY" || type === "RESTRICTED_HOLIDAY";
                      setNewEvent({
                        ...newEvent,
                        eventType: type,
                        isTeachingDay: !isHoliday,
                        colorCode: isHoliday ? "#ef4444" : "#3b82f6",
                      });
                    }}
                  >
                    <option value="HOLIDAY">Holiday (Non-Teaching)</option>
                    <option value="RESTRICTED_HOLIDAY">Restricted Holiday</option>
                    <option value="COLLEGE_EVENT">Institutional / College Event</option>
                    <option value="EXAM_INTERNAL">Internal Assessment (CIE)</option>
                    <option value="EXAM_SEMESTER">Semester Exam (SEE)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.84rem", color: "#cbd5e1" }}>
                    <input
                      type="checkbox"
                      checked={newEvent.isTeachingDay}
                      onChange={(e) => setNewEvent({ ...newEvent, isTeachingDay: e.target.checked })}
                    />
                    Regular teaching is permitted on this date
                  </label>
                </div>
              </div>
            </div>

            <div className="sched-modal-footer">
              <button type="button" className="tsm-btn-secondary" onClick={() => setShowAddEventModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="tsm-btn-primary"
                onClick={() => {
                  if (!newEvent.startDate || !newEvent.eventName) {
                    toast.error("Please provide event name and start date");
                    return;
                  }
                  setReviewEvents([...reviewEvents, { ...newEvent, id: `ev_${Date.now()}` }]);
                  setShowAddEventModal(false);
                }}
              >
                Add Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
