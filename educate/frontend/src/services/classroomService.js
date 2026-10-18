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

export const importRoster = async (classroomId, formData) => {
  const response = await API.post(`/classrooms/${classroomId}/upload-roster`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

export const uploadRoster = importRoster;

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
