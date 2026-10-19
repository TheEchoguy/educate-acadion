import axios from "axios";

const API_BASE = "http://localhost:8080/api/syllabus/classroom";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
    },
  };
};

export const uploadDocument = async (classroomId, file, documentType, moduleNumber = null, moduleTitle = "") => {
  const token = localStorage.getItem("token");
  const formData = new FormData();
  formData.append("file", file);
  formData.append("documentType", documentType);
  if (moduleNumber) formData.append("moduleNumber", moduleNumber);
  if (moduleTitle) formData.append("moduleTitle", moduleTitle);

  const res = await axios.post(`${API_BASE}/${classroomId}/scheduling/documents/upload`, formData, {
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "multipart/form-data",
    },
  });
  return res.data;
};

export const getDocuments = async (classroomId) => {
  const res = await axios.get(`${API_BASE}/${classroomId}/scheduling/documents`, getAuthHeaders());
  return res.data;
};

export const downloadDocument = async (classroomId, docId, fileName = "document.pdf") => {
  const res = await axios.get(`${API_BASE}/${classroomId}/scheduling/documents/${docId}/download`, {
    ...getAuthHeaders(),
    responseType: "blob",
  });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const publishModuleDocument = async (classroomId, docId) => {
  const res = await axios.post(`${API_BASE}/${classroomId}/scheduling/documents/${docId}/publish`, {}, getAuthHeaders());
  return res.data;
};

export const unpublishModuleDocument = async (classroomId, docId) => {
  const res = await axios.post(`${API_BASE}/${classroomId}/scheduling/documents/${docId}/unpublish`, {}, getAuthHeaders());
  return res.data;
};

export const deleteDocument = async (classroomId, docId) => {
  const res = await axios.delete(`${API_BASE}/${classroomId}/scheduling/documents/${docId}`, getAuthHeaders());
  return res.data;
};

export const getExtractionInputs = async (classroomId) => {
  const res = await axios.get(`${API_BASE}/${classroomId}/scheduling/inputs`, getAuthHeaders());
  return res.data;
};

export const triggerExtraction = async (classroomId) => {
  const res = await axios.post(`${API_BASE}/${classroomId}/scheduling/extract`, {}, getAuthHeaders());
  return res.data;
};

export const updateTimetableSlots = async (classroomId, slots) => {
  const res = await axios.post(`${API_BASE}/${classroomId}/scheduling/timetable/slots`, slots, getAuthHeaders());
  return res.data;
};

export const confirmTimetableMapping = async (classroomId, subjectCode) => {
  const res = await axios.post(`${API_BASE}/${classroomId}/scheduling/timetable/confirm-mapping`, { subjectCode }, getAuthHeaders());
  return res.data;
};

export const updateCalendarEvents = async (classroomId, events) => {
  const res = await axios.post(`${API_BASE}/${classroomId}/scheduling/calendar/events`, events, getAuthHeaders());
  return res.data;
};

export const updateMilestones = async (classroomId, milestones) => {
  const res = await axios.post(`${API_BASE}/${classroomId}/scheduling/milestones`, milestones, getAuthHeaders());
  return res.data;
};

export const updateModuleOutlines = async (classroomId, moduleOutlines) => {
  const res = await axios.post(`${API_BASE}/${classroomId}/scheduling/modules`, moduleOutlines, getAuthHeaders());
  return res.data;
};

export const verifyInputs = async (classroomId, verificationRequest = {}) => {
  const res = await axios.post(`${API_BASE}/${classroomId}/scheduling/inputs/verify`, verificationRequest, getAuthHeaders());
  return res.data;
};

export const resetSchedulingData = async (classroomId) => {
  const res = await axios.post(`${API_BASE}/${classroomId}/scheduling/reset`, {}, getAuthHeaders());
  return res.data;
};

export const generateSchedule = async (classroomId, request = {}) => {
  const res = await axios.post(`${API_BASE}/${classroomId}/scheduling/generate`, request, getAuthHeaders());
  return res.data;
};

export const getPlans = async (classroomId) => {
  const res = await axios.get(`${API_BASE}/${classroomId}/scheduling/plans`, getAuthHeaders());
  return res.data;
};

export const getActivePlan = async (classroomId) => {
  const res = await axios.get(`${API_BASE}/${classroomId}/scheduling/plans/active`, getAuthHeaders());
  return res.data;
};

export const approvePlan = async (classroomId, planId) => {
  const res = await axios.post(`${API_BASE}/${classroomId}/scheduling/plans/${planId}/approve`, {}, getAuthHeaders());
  return res.data;
};

export const recordSessionOutcome = async (classroomId, sessionId, outcome, teacherNotes = "") => {
  const res = await axios.patch(
    `${API_BASE}/${classroomId}/scheduling/sessions/${sessionId}/outcome`,
    { outcome, teacherNotes },
    getAuthHeaders()
  );
  return res.data;
};

export const manualAllocateSession = async (classroomId, payload) => {
  const res = await axios.post(`${API_BASE}/${classroomId}/scheduling/sessions/manual-allocate`, payload, getAuthHeaders());
  return res.data;
};

export const deleteSession = async (classroomId, sessionId) => {
  const res = await axios.delete(`${API_BASE}/${classroomId}/scheduling/sessions/${sessionId}`, getAuthHeaders());
  return res.data;
};

export const previewReschedule = async (classroomId, sessionId) => {
  const res = await axios.post(
    `${API_BASE}/${classroomId}/scheduling/sessions/${sessionId}/reschedule-preview`,
    {},
    getAuthHeaders()
  );
  return res.data;
};

export const applyReschedule = async (classroomId, sessionId, request) => {
  const res = await axios.post(
    `${API_BASE}/${classroomId}/scheduling/sessions/${sessionId}/reschedule-apply`,
    request,
    getAuthHeaders()
  );
  return res.data;
};

export const getRescheduleHistory = async (classroomId) => {
  const res = await axios.get(`${API_BASE}/${classroomId}/scheduling/history`, getAuthHeaders());
  return res.data;
};

export const downloadIcalExport = async (classroomId) => {
  const res = await axios.get(`${API_BASE}/${classroomId}/scheduling/export/ical`, {
    ...getAuthHeaders(),
    responseType: "blob",
  });
  const url = window.URL.createObjectURL(new Blob([res.data], { type: "text/calendar" }));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `acadion_teaching_schedule_${classroomId}.ics`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const downloadCsvExport = async (classroomId) => {
  const res = await axios.get(`${API_BASE}/${classroomId}/scheduling/export/csv`, {
    ...getAuthHeaders(),
    responseType: "blob",
  });
  const url = window.URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `acadion_teaching_schedule_${classroomId}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

// ==========================================
// STUDENT-FACING CLIENT METHODS
// ==========================================

export const getStudentSchedule = async (classroomId) => {
  const res = await axios.get(`${API_BASE}/${classroomId}/scheduling/student/schedule`, getAuthHeaders());
  return res.data;
};

export const getStudentModules = async (classroomId) => {
  const res = await axios.get(`${API_BASE}/${classroomId}/scheduling/student/modules`, getAuthHeaders());
  return res.data;
};

export const downloadStudentModule = async (classroomId, docId, fileName = "module.pdf") => {
  const res = await axios.get(`${API_BASE}/${classroomId}/scheduling/student/modules/${docId}/download`, {
    ...getAuthHeaders(),
    responseType: "blob",
  });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
