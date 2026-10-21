import API from "../api/axiosConfig";

/**
 * Generate an MCQ quiz using OpenRouter AI or the Mock Engine.
 */
export const generateQuiz = async (payload, file = null) => {
  if (file) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("subject", payload.subject || "");
    formData.append("topic", payload.topic || "");
    formData.append("mode", payload.mode || "TOPIC");
    formData.append("notesText", payload.notesText || "");
    formData.append("questionCount", payload.questionCount || 10);
    formData.append("difficulty", payload.difficulty || "MEDIUM");
    formData.append("semester", payload.semester || "5th Sem");
    formData.append("marksPerQuestion", payload.marksPerQuestion || 1.0);
    formData.append("includeExplanations", payload.includeExplanations !== false);
    formData.append("createdBy", payload.createdBy || "");
    formData.append("mock", Boolean(payload.mock));

    const response = await API.post("/quiz-generator/generate", formData);
    return response.data;
  }

  const response = await API.post("/quiz-generator/generate", payload);
  return response.data;
};

/**
 * Extract text from an uploaded document (PDF, DOCX, TXT).
 */
export const extractNotesText = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await API.post("/quiz-generator/extract-notes", formData);
  return response.data;
};

/**
 * Regenerate an individual question.
 */
export const regenerateQuestion = async (payload) => {
  const response = await API.post("/quiz-generator/regenerate-question", payload);
  return response.data;
};

/**
 * Save reviewed quiz as a Draft.
 */
export const saveQuizDraft = async (paperData, teacherEmail) => {
  const url = teacherEmail
    ? `/quiz-generator/draft?teacherEmail=${encodeURIComponent(teacherEmail)}`
    : "/quiz-generator/draft";
  const response = await API.post(url, paperData);
  return response.data;
};

/**
 * Retrieve saved drafts for a teacher.
 */
export const getTeacherDrafts = async (teacherEmail) => {
  const url = teacherEmail
    ? `/quiz-generator/drafts?teacherEmail=${encodeURIComponent(teacherEmail)}`
    : "/quiz-generator/drafts";
  const response = await API.get(url);
  return response.data;
};

/**
 * Publish approved quiz to Acadion examinations and practice portal.
 */
export const publishQuiz = async (paperData, teacherEmail) => {
  const url = teacherEmail
    ? `/quiz-generator/publish?teacherEmail=${encodeURIComponent(teacherEmail)}`
    : "/quiz-generator/publish";
  const response = await API.post(url, paperData);
  return response.data;
};
