import API from "../api/axiosConfig";

// PENDING USERS
export const getPendingUsers = async () => {
  const response = await API.get(
    "/admin/pending-users"
  );

  return response.data;
};

// APPROVE USER
export const approveUser = async (email) => {
  const response = await API.post(
    `/admin/approve?email=${email}`
  );
  return response.data;
};

// APPROVE TEACHER WITH SUBJECTS
export const approveTeacherWithSubjects = async (email, assignedSubjects = []) => {
  const response = await API.post(
    `/admin/approve-teacher?email=${email}`,
    assignedSubjects
  );
  return response.data;
};

// ASSIGN / UPDATE TEACHER SUBJECTS
export const assignTeacherSubjects = async (email, assignedSubjects = []) => {
  const response = await API.post(
    `/admin/teacher/assign-subjects?email=${email}`,
    assignedSubjects
  );
  return response.data;
};

// REJECT USER
export const rejectUser = async (email) => {
  const response = await API.delete(
    `/admin/reject?email=${email}`
  );

  return response.data;
};

// GET STUDENTS
export const getStudents = async () => {
  const response = await API.get(
    "/admin/students"
  );

  return response.data;
};

// GET TEACHERS
export const getTeachers = async () => {
  const response = await API.get(
    "/admin/teachers"
  );

  return response.data;
};

// GET TEACHER PROFILE
export const getTeacherProfile = async (email) => {
  const response = await API.get(`/admin/teacher-profile?email=${email}`);
  return response.data;
};

// EXPORT USERS TO EXCEL
export const exportUsersExcel = async (role = "TEACHER", status = "APPROVED") => {
  const response = await API.get(
    `/admin/export-users?role=${role}&status=${status}`,
    {
      responseType: "blob",
    }
  );
  return response.data;
};