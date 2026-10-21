import API from "../api/axiosConfig";

export const createClassroom = async (classroomData) => {
  const response = await API.post("/classrooms", classroomData);
  return response.data;
};

export const getTeacherClassrooms = async () => {
  const response = await API.get("/classrooms/teacher");
  return response.data;
};

export const getStudentClassrooms = async () => {
  const response = await API.get("/classrooms/student");
  return response.data;
};

export const getClassroomDetails = async (classroomId) => {
  const response = await API.get(`/classrooms/${classroomId}`);
  return response.data;
};

export const updateClassroom = async (classroomId, classroomData) => {
  const response = await API.put(`/classrooms/${classroomId}`, classroomData);
  return response.data;
};

export const deleteClassroom = async (classroomId) => {
  const response = await API.delete(`/classrooms/${classroomId}`);
  return response.data;
};

export const importRoster = async (classroomId, formData) => {
  const response = await API.post(`/classrooms/${classroomId}/upload-roster`, formData);
  return response.data;
};

export const uploadRoster = importRoster;

export const parseRoster = async (classroomId, formData) => {
  const response = await API.post(`/classrooms/${classroomId}/roster/parse`, formData);
  return response.data;
};

export const enrollBatch = async (classroomId, students) => {
  const response = await API.post(`/classrooms/${classroomId}/roster/enroll-batch`, { students });
  return response.data;
};

export const removeAllMembers = async (classroomId) => {
  const response = await API.delete(`/classrooms/${classroomId}/members`);
  return response.data;
};

export const addStudent = async (classroomId, studentData) => {
  const response = await API.post(`/classrooms/${classroomId}/add-student`, studentData);
  return response.data;
};

export const getClassroomMembers = async (classroomId) => {
  const response = await API.get(`/classrooms/${classroomId}/members`);
  return response.data;
};

export const joinClassroom = async (joinCode) => {
  const response = await API.post("/classrooms/join", { joinCode });
  return response.data;
};

export const getJoinRequests = async (classroomId) => {
  const response = await API.get(`/classrooms/${classroomId}/join-requests`);
  return response.data;
};

export const approveJoinRequest = async (classroomId, studentId) => {
  const response = await API.post(`/classrooms/${classroomId}/members/${studentId}/approve`);
  return response.data;
};

export const rejectJoinRequest = async (classroomId, studentId) => {
  const response = await API.post(`/classrooms/${classroomId}/members/${studentId}/reject`);
  return response.data;
};

export const removeMember = async (classroomId, studentId) => {
  const response = await API.delete(`/classrooms/${classroomId}/members/${studentId}`);
  return response.data;
};

export const regenerateJoinCode = async (classroomId) => {
  const response = await API.post(`/classrooms/${classroomId}/join-code/regenerate`);
  return response.data;
};

export const getEvaluationScheme = async (classroomId) => {
  const response = await API.get(`/classrooms/${classroomId}/evaluation-scheme`);
  return response.data;
};

export const updateEvaluationScheme = async (classroomId, schemeData) => {
  const response = await API.put(`/classrooms/${classroomId}/evaluation-scheme`, schemeData);
  return response.data;
};

// ============================================================================
// ACADEMIC INTELLIGENCE - IA SPLIT-UP MARKS
// ============================================================================
export const downloadIaTemplate = async (classroomId, iaNumber = 1) => {
  const response = await API.get(
    `/classrooms/${classroomId}/intelligence/download-ia-template?iaNumber=${iaNumber}`,
    {
      responseType: "blob",
    }
  );
  return response.data;
};

export const downloadIaSampleTemplate = downloadIaTemplate;

export const saveManualMarks = async (classroomId, iaNumber, records) => {
  const response = await API.post(
    `/classrooms/${classroomId}/intelligence/save-manual-marks?iaNumber=${iaNumber}`,
    records
  );
  return response.data;
};

export const uploadIaMarks = async (classroomId, formData, iaNumber) => {
  const response = await API.post(
    `/classrooms/${classroomId}/intelligence/upload-ia-marks?iaNumber=${iaNumber}`,
    formData
  );
  return response.data;
};

export const resetIaMarks = async (classroomId, iaNumber = 1) => {
  const response = await API.delete(
    `/classrooms/${classroomId}/intelligence/reset-ia-marks?iaNumber=${iaNumber}`
  );
  return response.data;
};

export const downloadMasterTemplate = async (classroomId) => {
  const response = await API.get(
    `/classrooms/${classroomId}/intelligence/download-master-template`,
    {
      responseType: "blob",
    }
  );
  return response.data;
};

export const exportMasterReport = async (classroomId) => {
  const response = await API.get(
    `/classrooms/${classroomId}/intelligence/export-master-report`,
    {
      responseType: "blob",
    }
  );
  return response.data;
};

export const uploadMasterSheet = async (classroomId, formData) => {
  const response = await API.post(
    `/classrooms/${classroomId}/intelligence/upload-master-sheet`,
    formData
  );
  return response.data;
};

export const getStudentIaBreakdown = async (classroomId, usn) => {
  const response = await API.get(`/classrooms/${classroomId}/intelligence/student/${usn}`);
  return response.data;
};

export const getIaRecordsByNumber = async (classroomId, iaNumber) => {
  const response = await API.get(`/classrooms/${classroomId}/intelligence/ia/${iaNumber}`);
  return response.data;
};

export const publishIaMarks = async (classroomId, iaNumber = 0, publish = true) => {
  const response = await API.post(
    `/classrooms/${classroomId}/intelligence/publish-ia-marks?iaNumber=${iaNumber}&publish=${publish}`
  );
  return response.data;
};

export const getIaPublishStatus = async (classroomId) => {
  const response = await API.get(`/classrooms/${classroomId}/intelligence/ia-publish-status`);
  return response.data;
};

// ============================================================================
// ACADEMIC INTELLIGENCE - QUESTION BLUEPRINT & PAPER PARSER
// ============================================================================
export const getBlueprint = async (classroomId, iaNumber = 1) => {
  const response = await API.get(
    `/classrooms/${classroomId}/intelligence/blueprint?iaNumber=${iaNumber}`
  );
  return response.data;
};

export const parseQuestionPaper = async (classroomId, file, iaNumber = 1) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await API.post(
    `/classrooms/${classroomId}/intelligence/parse-paper?iaNumber=${iaNumber}`,
    formData
  );
  return response.data;
};

export const updateBlueprint = async (classroomId, blueprint, iaNumber = 1, applyToAll = false, confirm = false) => {
  const response = await API.put(
    `/classrooms/${classroomId}/intelligence/blueprint?iaNumber=${iaNumber}&applyToAll=${applyToAll}&confirm=${confirm}`,
    blueprint
  );
  return response.data;
};

export const generateBlueprint = async (classroomId, iaNumber = 1, counts = {}) => {
  const { q1Count = 2, q2Count = 2, q3Count = 2, q4Count = 2 } = counts;
  const response = await API.post(
    `/classrooms/${classroomId}/intelligence/blueprint/generate?iaNumber=${iaNumber}&q1Count=${q1Count}&q2Count=${q2Count}&q3Count=${q3Count}&q4Count=${q4Count}`
  );
  return response.data;
};

// ============================================================================
// ACADEMIC INTELLIGENCE - 4-LEVEL HIERARCHICAL PERFORMANCE ANALYTICS ENGINE
// ============================================================================
export const getMyPerformance = async (classroomId) => {
  const response = await API.get(
    `/classrooms/${classroomId}/intelligence/my-performance`
  );
  return response.data;
};

export const getStudentFourLevelAnalytics = async (classroomId, usn) => {
  const response = await API.get(
    `/classrooms/${classroomId}/intelligence/analytics/student/${encodeURIComponent(usn)}`
  );
  return response.data;
};

export const getMyFourLevelAnalytics = async (classroomId) => {
  const response = await API.get(
    `/classrooms/${classroomId}/intelligence/analytics/my-performance`
  );
  return response.data;
};

export const getClassroomAnalyticsSummary = async (classroomId) => {
  const response = await API.get(
    `/classrooms/${classroomId}/intelligence/analytics/class-summary`
  );
  return response.data;
};

// ============================================================================
// ACADEMIC INTELLIGENCE - PYTHON ML RISK PREDICTION & SHAP XAI ENGINE
// ============================================================================
export const getStudentRiskXai = async (classroomId, usn) => {
  const response = await API.get(
    `/classrooms/${classroomId}/intelligence/risk-xai/student/${encodeURIComponent(usn)}`
  );
  return response.data;
};

export const getMyRiskXai = async (classroomId) => {
  const response = await API.get(
    `/classrooms/${classroomId}/intelligence/risk-xai/my-performance`
  );
  return response.data;
};

export const getClassroomRiskWatchlist = async (classroomId) => {
  const response = await API.get(
    `/classrooms/${classroomId}/intelligence/risk-xai/watchlist`
  );
  return response.data;
};

// ============================================================================
// ACADEMIC INTELLIGENCE - MODULE 1–5 NOTES RAG STUDY TUTOR
// ============================================================================
export const uploadModuleNotes = async (classroomId, moduleNumber, file) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await API.post(
    `/classrooms/${classroomId}/intelligence/notes/upload?moduleNumber=${moduleNumber}`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );
  return response.data;
};

export const askRagTutor = async (classroomId, payload) => {
  const response = await API.post(
    `/classrooms/${classroomId}/intelligence/tutor/chat`,
    payload
  );
  return response.data;
};

export const getModuleNotesStatus = async (classroomId) => {
  const response = await API.get(
    `/classrooms/${classroomId}/intelligence/notes/status`
  );
  return response.data;
};


