import API from "../api/axiosConfig";

export const submitResponses =
  async (data) => {

    const response =
      await API.post(
        "/responses",
        data
      );

    return response.data;
};
export const getStudentResults = async (usn) => {
  const response = await API.get(`/responses/student/${usn}`);
  return response.data;
};

export const exportSubmissionExcel = async (responseId) => {
  const response = await API.get(`/responses/my-submission-excel/${responseId}`, {
    responseType: "blob",
  });
  return response.data;
};

export const selfEvaluateResponse = async (responseId, scores) => {
  const response = await API.post(`/responses/${responseId}/self-evaluate`, scores);
  return response.data;
};

export const peerEvaluateResponse = async (responseId, payload) => {
  const response = await API.post(`/responses/${responseId}/peer-evaluate`, payload);
  return response.data;
};

export const assignPeerReview = async (responseId, friendUsn, friendName) => {
  const response = await API.post(`/responses/${responseId}/assign-peer`, {
    friendUsn,
    friendName,
  });
  return response.data;
};

export const getClassmates = async (semester, excludeUsn) => {
  const params = {};
  if (semester) params.semester = semester;
  if (excludeUsn) params.excludeUsn = excludeUsn;
  const response = await API.get("/students/classmates", { params });
  return response.data;
};