import API from "../api/axiosConfig";

// =============================================================================
// 1. TOPICS & CRUD
// =============================================================================

export const getSyllabusItems = async (classroomId) => {
  const response = await API.get(`/classrooms/${classroomId}/syllabus`);
  return response.data;
};

export const createSyllabusItem = async (classroomId, itemData) => {
  const response = await API.post(`/classrooms/${classroomId}/syllabus`, itemData);
  return response.data;
};

export const updateSyllabusItem = async (classroomId, itemId, itemData) => {
  const response = await API.put(`/classrooms/${classroomId}/syllabus/${itemId}`, itemData);
  return response.data;
};

export const updateSyllabusStatus = async (classroomId, itemId, status) => {
  const response = await API.patch(`/classrooms/${classroomId}/syllabus/${itemId}/status`, { status });
  return response.data;
};

export const deleteSyllabusItem = async (classroomId, itemId) => {
  const response = await API.delete(`/classrooms/${classroomId}/syllabus/${itemId}`);
  return response.data;
};

export const reorderSyllabusItems = async (classroomId, orderedItemIds) => {
  const response = await API.put(`/classrooms/${classroomId}/syllabus/order`, { orderedItemIds });
  return response.data;
};

export const getSyllabusProgress = async (classroomId) => {
  const response = await API.get(`/classrooms/${classroomId}/syllabus/progress`);
  return response.data;
};

// =============================================================================
// 2. PUBLICATION & VERSIONS
// =============================================================================

export const publishSyllabus = async (classroomId, publishData) => {
  const response = await API.post(`/classrooms/${classroomId}/syllabus/versions/publish`, publishData);
  return response.data;
};

export const getPublishedVersions = async (classroomId) => {
  const response = await API.get(`/classrooms/${classroomId}/syllabus/versions`);
  return response.data;
};

export const getPublishedVersion = async (classroomId, versionId) => {
  const response = await API.get(`/classrooms/${classroomId}/syllabus/versions/${versionId}`);
  return response.data;
};

// =============================================================================
// 3. ANALYTICS & INSIGHTS
// =============================================================================

export const getCoverageAnalytics = async (classroomId) => {
  const response = await API.get(`/classrooms/${classroomId}/syllabus/analytics/coverage`);
  return response.data;
};

export const getRevisionAggregate = async (classroomId, versionId = null) => {
  const params = versionId ? { versionId } : {};
  const response = await API.get(`/classrooms/${classroomId}/syllabus/analytics/revisions`, { params });
  return response.data;
};

export const getTopicAssessmentInsights = async (classroomId, topicId) => {
  const response = await API.get(`/classrooms/${classroomId}/syllabus/topics/${topicId}/assessment-insights`);
  return response.data;
};

export const getClassroomAssessmentInsights = async (classroomId) => {
  const response = await API.get(`/classrooms/${classroomId}/syllabus/analytics/assessment-insights`);
  return response.data;
};

export const getTeacherOverview = async () => {
  const response = await API.get("/syllabus/analytics/overview");
  return response.data;
};

// =============================================================================
// 4. ASSESSMENT MAPPINGS
// =============================================================================

export const getAssessmentMappings = async (classroomId, topicId = null) => {
  const params = topicId ? { topicId } : {};
  const response = await API.get(`/classrooms/${classroomId}/syllabus/assessment-mappings`, { params });
  return response.data;
};

export const createAssessmentMapping = async (classroomId, mappingData) => {
  const response = await API.post(`/classrooms/${classroomId}/syllabus/assessment-mappings`, mappingData);
  return response.data;
};

export const getMappingSuggestions = async (classroomId, topicId) => {
  const response = await API.get(`/classrooms/${classroomId}/syllabus/topics/${topicId}/mapping-suggestions`);
  return response.data;
};

export const confirmMappingById = async (classroomId, mappingId) => {
  const response = await API.post(`/classrooms/${classroomId}/syllabus/assessment-mappings/${mappingId}/confirm`);
  return response.data;
};

export const confirmSuggestedMapping = async (classroomId, mappingData) => {
  const response = await API.post(`/classrooms/${classroomId}/syllabus/assessment-mappings/confirm`, mappingData);
  return response.data;
};

export const deleteAssessmentMapping = async (classroomId, mappingId) => {
  const response = await API.delete(`/classrooms/${classroomId}/syllabus/assessment-mappings/${mappingId}`);
  return response.data;
};

// =============================================================================
// 5. EXPORTS & FILE DOWNLOADS
// =============================================================================

export const exportSyllabusFile = async (classroomId, format = "csv", versionId = null) => {
  const params = { format };
  if (versionId) params.versionId = versionId;
  const response = await API.get(`/classrooms/${classroomId}/syllabus/export`, {
    params,
    responseType: "blob",
  });
  return response;
};

export const exportProgressFile = async (classroomId, format = "csv", versionId = null) => {
  const params = { format };
  if (versionId) params.versionId = versionId;
  const response = await API.get(`/classrooms/${classroomId}/syllabus/export/progress`, {
    params,
    responseType: "blob",
  });
  return response;
};

/**
 * Browser file download helper preserving content-disposition filenames.
 */
export const triggerBlobDownload = (response, fallbackFilename) => {
  let filename = fallbackFilename;
  const disposition = response.headers["content-disposition"];
  if (disposition && disposition.indexOf("filename=") !== -1) {
    const filenameMatch = disposition.match(/filename="?([^";]+)"?/);
    if (filenameMatch && filenameMatch[1]) {
      filename = filenameMatch[1].trim();
    }
  }

  const blob = new Blob([response.data], {
    type: response.headers["content-type"] || "application/octet-stream",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.parentNode.removeChild(link);
  window.URL.revokeObjectURL(url);
};

// =============================================================================
// 6. STUDENT PERSONAL REVISION & UNDERSTANDING
// =============================================================================

export const getMyRevisions = async (classroomId, versionId = null) => {
  const params = versionId ? { versionId } : {};
  const response = await API.get(`/classrooms/${classroomId}/syllabus/my-revisions`, { params });
  return response.data;
};

export const updateMyRevision = async (classroomId, versionId, topicId, revisionData) => {
  const response = await API.put(
    `/classrooms/${classroomId}/syllabus/versions/${versionId}/topics/${topicId}/my-revision`,
    revisionData
  );
  return response.data;
};

export const getMyRevisionSummary = async (classroomId, versionId = null) => {
  const params = versionId ? { versionId } : {};
  const response = await API.get(`/classrooms/${classroomId}/syllabus/my-revisions/summary`, { params });
  return response.data;
};

export const getMyTopicRevisionHistory = async (classroomId, topicId) => {
  const response = await API.get(`/classrooms/${classroomId}/syllabus/topics/${topicId}/my-revision-history`);
  return response.data;
};

