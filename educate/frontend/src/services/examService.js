import API from "../api/axiosConfig";

export const getQuestionPapers = async () => {
  const response = await API.get("/papers");

  return response.data;
};

export const getQuestionPaper = async (paperId) => {
  const response = await API.get(`/papers/${paperId}`);

  return response.data;
};

export const uploadQuestionPaper = async (formData) => {
  const response = await API.post(
    "/papers/upload",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  return response.data;
};

export const submitStudentResponses = async (payload) => {
  const response = await API.post("/responses", payload);

  return response.data;
};

export const getPaperAnalytics = async (paperId) => {
  const response = await API.get(`/analytics/paper/${paperId}`);

  return response.data;
};

export const getStudentTrend = async (studentId) => {
  const response = await API.get(`/analytics/student/${studentId}`);

  return response.data;
};
