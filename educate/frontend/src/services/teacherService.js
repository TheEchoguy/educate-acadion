import axios from "axios";
import API from "../api/axiosConfig";

const AI_SERVICE_URL = "http://127.0.0.1:5000";

export const uploadPaper = async (formData) => {
  try {
    // Send file directly to Python AI Microservice (port 5000) which extracts and saves to DB
    const response = await axios.post(`${AI_SERVICE_URL}/api/ai/upload-paper`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      timeout: 30000,
    });

    return response.data;
  } catch (error) {
    console.error("AI Microservice error, trying backend route:", error);
    const response = await API.post("/papers/upload", formData);
    return response.data;
  }
};

export const getAllPapers = async () => {
  const response = await API.get("/papers");
  return response.data;
};