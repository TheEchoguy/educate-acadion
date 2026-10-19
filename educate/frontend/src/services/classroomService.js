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
export const downloadIaSampleTemplate = async (classroomId) => {
  const response = await API.get(`/classrooms/${classroomId}/intelligence/download-sample-template`, {
    responseType: "blob",
  });
  return response.data;
};

export const uploadIaMarks = async (classroomId, formData, iaNumber) => {
  const response = await API.post(
    `/classrooms/${classroomId}/intelligence/upload-ia-marks?iaNumber=${iaNumber}`,
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

