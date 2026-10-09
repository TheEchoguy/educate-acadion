import API from "../api/axiosConfig";

export const getAllResponses = async () => {
  const response = await API.get("/responses");
  return response.data;
};

export const evaluateResponse = async (data) => {
  const response = await API.put("/responses/evaluate", data);
  return response.data;
};

export const getMySubjects = async (email) => {
  const response = await API.get(`/responses/teacher/my-subjects?email=${email}`);
  return response.data;
};

export const verifyTeacherAccess = async (data) => {
  const response = await API.post("/responses/teacher/verify-access", data);
  return response.data;
};

export const getEnrichedResponses = async (params = {}) => {
  const response = await API.get("/responses/enriched", { params });
  return response.data;
};

export const sendEvaluationEmail = async (responseId) => {
  const response = await API.post(`/responses/${responseId}/send-email`);
  return response.data;
};

export const exportEvaluationExcel = async (params = {}) => {
  const response = await API.get("/responses/export-excel", {
    params,
    responseType: "blob",
  });
  return response.data;
};

export const getEvaluationSummary = async (params = {}) => {
  const response = await API.get("/responses/summary", { params });
  return response.data;
};

export const grantReExam = async (responseId, note = "") => {
  const response = await API.post(`/responses/${responseId}/grant-re-exam`, { note });
  return response.data;
};