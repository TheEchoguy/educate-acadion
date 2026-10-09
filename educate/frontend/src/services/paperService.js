import API from "../api/axiosConfig";

export const uploadPaper = async (formData) => {

  const response = await API.post(
    "/papers/upload",
    formData,
    {
      headers: {
        "Content-Type":
          "multipart/form-data",
      },
    }
  );

  return response.data;
};

export const getAllPapers = async () => {

  const response =
    await API.get("/papers");

  return response.data;
};

export const getPaperById =
  async (paperId) => {

    const response =
      await API.get(
        `/papers/${paperId}`
      );

    return response.data;
};
export const createQuestionPaper =
  async (paperData) => {

    const response =
      await API.post(
        "/papers/create",
        paperData
      );

    return response.data;
};
export const updatePaper =
  async (
    paperId,
    paperData
  ) => {

    const response =
      await API.put(
        `/papers/${paperId}`,
        paperData
      );

    return response.data;
};

export const deletePaper =
  async (paperId) => {

    const response =
      await API.delete(
        `/papers/${paperId}`
      );

    return response.data;
};

export const togglePaperPractice = async (paperId, allowedForPractice, assignedSemester) => {
  const response = await API.put(`/papers/${paperId}/practice-toggle`, {
    allowedForPractice,
    assignedSemester,
  });
  return response.data;
};