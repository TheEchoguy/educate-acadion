import API from "../api/axiosConfig";

export const getPaperAnalytics =
  async (paperId) => {

    const response =
      await API.get(
        `/analytics/paper/${paperId}`
      );

    return response.data;
};

export const getStudentTrend =
  async (usn) => {

    const response =
      await API.get(
        `/analytics/student/${usn}`
      );

    return response.data;
};