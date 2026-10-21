import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import {
  getSyllabusItems,
  getCoverageAnalytics,
  getPublishedVersions,
  getRevisionAggregate,
  createSyllabusItem,
  updateSyllabusItem,
  updateSyllabusStatus,
  deleteSyllabusItem,
  reorderSyllabusItems,
  publishSyllabus,
} from "../../services/syllabusService";
import { getActivePlan } from "../../services/syllabusSchedulingService";

import SyllabusOverviewSection from "./SyllabusOverviewSection";
import SyllabusTopicsSection from "./SyllabusTopicsSection";
import SyllabusScheduleSection from "./SyllabusScheduleSection";
import SyllabusPublishingSection from "./SyllabusPublishingSection";
import SyllabusAssessmentMappingSection from "./SyllabusAssessmentMappingSection";
import SyllabusReportsSection from "./SyllabusReportsSection";

import SyllabusTopicModal from "./SyllabusTopicModal";
import SyllabusPublishModal from "./SyllabusPublishModal";
import SyllabusVersionViewModal from "./SyllabusVersionViewModal";

import "./TeacherSyllabusManagement.css";

export default function TeacherSyllabusManagement({
  classroomId,
  classroom,
  onNavigateToScheduling,
}) {
  // Navigation: "overview" | "topics" | "schedule" | "publishing" | "mappings" | "reports"
  const [activeSection, setActiveSection] = useState("overview");
  const [scheduleFilter, setScheduleFilter] = useState("ALL");

  // Syllabus Data
  const [items, setItems] = useState([]);
  const [activePlan, setActivePlan] = useState(null);
  const [coverage, setCoverage] = useState(null);
  const [versions, setVersions] = useState([]);
  const [revisionStats, setRevisionStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal states
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState(null);

  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);

  const [viewingVersionId, setViewingVersionId] = useState(null);
  const [isVersionViewModalOpen, setIsVersionViewModalOpen] = useState(false);

  const fetchData = async (showLoadingSpinner = false) => {
    if (showLoadingSpinner) setLoading(true);
    setError(null);
    try {
      const [itemsRes, coverageRes, versionsRes, revRes, planRes] = await Promise.allSettled([
        getSyllabusItems(classroomId),
        getCoverageAnalytics(classroomId),
        getPublishedVersions(classroomId),
        getRevisionAggregate(classroomId),
        getActivePlan(classroomId),
      ]);

      setItems(itemsRes.status === "fulfilled" ? itemsRes.value || [] : []);
      setCoverage(coverageRes.status === "fulfilled" ? coverageRes.value || null : null);
      setVersions(versionsRes.status === "fulfilled" ? versionsRes.value || [] : []);
      setRevisionStats(revRes.status === "fulfilled" ? revRes.value || null : null);
      setActivePlan(planRes.status === "fulfilled" ? planRes.value || null : null);
    } catch (err) {
      console.error(err);
      setError("Failed to load classroom syllabus data");
      toast.error("Failed to load syllabus data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    if (classroomId) {
      Promise.allSettled([
        getSyllabusItems(classroomId),
        getCoverageAnalytics(classroomId),
        getPublishedVersions(classroomId),
        getRevisionAggregate(classroomId),
        getActivePlan(classroomId),
      ]).then(([itemsRes, coverageRes, versionsRes, revRes, planRes]) => {
        if (!active) return;
        setItems(itemsRes.status === "fulfilled" ? itemsRes.value || [] : []);
        setCoverage(coverageRes.status === "fulfilled" ? coverageRes.value || null : null);
        setVersions(versionsRes.status === "fulfilled" ? versionsRes.value || [] : []);
        setRevisionStats(revRes.status === "fulfilled" ? revRes.value || null : null);
        setActivePlan(planRes.status === "fulfilled" ? planRes.value || null : null);
        setLoading(false);
      }).catch((err) => {
        console.error(err);
        if (active) {
          setError("Failed to load classroom syllabus data");
          setLoading(false);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [classroomId]);

  const loadAllSyllabusData = () => fetchData(true);

  // =========================================================================
  // TOPIC OPERATIONS
  // =========================================================================

  const handleOpenAddTopic = () => {
    setEditingTopic(null);
    setIsTopicModalOpen(true);
  };

  const handleOpenEditTopic = (topic) => {
    setEditingTopic(topic);
    setIsTopicModalOpen(true);
  };

  const handleSaveTopic = async (payload) => {
    try {
      if (editingTopic) {
        await updateSyllabusItem(classroomId, editingTopic.id, payload);
        toast.success(`Updated topic: ${payload.topic}`);
      } else {
        await createSyllabusItem(classroomId, payload);
        toast.success(`Created topic: ${payload.topic}`);
      }
      loadAllSyllabusData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to save syllabus topic");
      throw err;
    }
  };

  const handleStatusChange = async (itemId, newStatus) => {
    try {
      await updateSyllabusStatus(classroomId, itemId, newStatus);
      toast.success("Topic teaching status updated");
      // Fast optimistic update
      setItems((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, status: newStatus } : it))
      );
      // Reload fresh analytics and items from backend
      const [freshItems, freshCov] = await Promise.all([
        getSyllabusItems(classroomId),
        getCoverageAnalytics(classroomId)
      ]);
      if (freshItems) setItems(freshItems);
      if (freshCov) setCoverage(freshCov);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to update status");
    }
  };

  const handleDeleteTopic = async (itemId, topicTitle) => {
    if (!window.confirm(`Are you sure you want to delete topic "${topicTitle}"?`)) return;

    try {
      await deleteSyllabusItem(classroomId, itemId);
      toast.success(`Deleted topic: ${topicTitle}`);
      loadAllSyllabusData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to delete topic");
    }
  };

  const handleReorder = async (orderedItemIds) => {
    try {
      await reorderSyllabusItems(classroomId, orderedItemIds);
      toast.success("Syllabus sequence reordered");
      // Fast optimistic reorder
      const reordered = [...items].sort((a, b) => {
        return orderedItemIds.indexOf(a.id) - orderedItemIds.indexOf(b.id);
      });
      setItems(reordered);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to reorder topics");
      loadAllSyllabusData();
    }
  };

  // =========================================================================
  // PUBLICATION OPERATIONS
  // =========================================================================

  const handleOpenPublishModal = () => {
    if (items.length === 0) {
      toast.error("Cannot publish an empty syllabus. Please add topics first.");
      return;
    }
    setIsPublishModalOpen(true);
  };

  const handlePublish = async (publishData) => {
    try {
      const res = await publishSyllabus(classroomId, publishData);
      toast.success(`Published Version ${res.versionNumber} successfully! Students notified.`);
      loadAllSyllabusData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to publish syllabus version");
      throw err;
    }
  };

  const handleViewSnapshot = (versionId) => {
    setViewingVersionId(versionId);
    setIsVersionViewModalOpen(true);
  };

  return (
    <div className="tsm-container">
      {/* SYLLABUS SECTION NAVIGATION BAR */}
      <div className="tsm-header-nav">
        <div className="tsm-subtabs-group">
          <button
            type="button"
            className={`tsm-subtab-btn ${activeSection === "overview" ? "active" : ""}`}
            onClick={() => setActiveSection("overview")}
          >
            📊 Overview
          </button>
          <button
            type="button"
            className={`tsm-subtab-btn ${activeSection === "topics" ? "active" : ""}`}
            onClick={() => setActiveSection("topics")}
          >
            📚 Topics & Units ({items.length})
          </button>
          <button
            type="button"
            className={`tsm-subtab-btn ${activeSection === "schedule" ? "active" : ""}`}
            onClick={() => setActiveSection("schedule")}
          >
            🗓️ Schedule & Resources {activePlan?.sessions?.length ? `(${activePlan.sessions.length} sessions)` : ""}
          </button>
          <button
            type="button"
            className={`tsm-subtab-btn ${activeSection === "publishing" ? "active" : ""}`}
            onClick={() => setActiveSection("publishing")}
          >
            🏷️ Versions & Publishing {versions.length > 0 && `(v${versions[0].versionNumber})`}
          </button>
          <button
            type="button"
            className={`tsm-subtab-btn ${activeSection === "mappings" ? "active" : ""}`}
            onClick={() => setActiveSection("mappings")}
          >
            🎯 Assessment Mapping
          </button>
          <button
            type="button"
            className={`tsm-subtab-btn ${activeSection === "reports" ? "active" : ""}`}
            onClick={() => setActiveSection("reports")}
          >
            📥 Reports & Exports
          </button>
        </div>

        {/* HEADER ACTIONS */}
        <div className="tsm-header-actions">
          <button
            type="button"
            className="tsm-btn-secondary"
            onClick={loadAllSyllabusData}
            title="Refresh Syllabus Data"
          >
            🔄 Refresh
          </button>
          <button
            type="button"
            className="tsm-btn-primary"
            onClick={handleOpenAddTopic}
          >
            + Add Topic
          </button>
          <button
            type="button"
            className="tsm-btn-primary"
            style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}
            onClick={handleOpenPublishModal}
            disabled={items.length === 0}
            title={items.length === 0 ? "Add topics before publishing" : "Publish snapshot"}
          >
            🚀 Publish
          </button>
        </div>
      </div>

      {/* BODY CONTENT */}
      {loading ? (
        <div className="tsm-loading-container">
          <div className="tsm-spinner"></div>
          <p>Loading syllabus curriculum and tracking data...</p>
        </div>
      ) : error ? (
        <div className="tsm-empty-state">
          <p style={{ color: "#f87171" }}>{error}</p>
          <button className="tsm-btn-secondary" onClick={loadAllSyllabusData}>
            Retry Loading
          </button>
        </div>
      ) : (
        <>
          {activeSection === "overview" && (
            <SyllabusOverviewSection
              items={items}
              activePlan={activePlan}
              coverage={coverage}
              versions={versions}
              revisionStats={revisionStats}
              classroom={classroom}
              onNavigateTab={(tab, filter = "ALL") => {
                setActiveSection(tab);
                if (tab === "schedule" && filter) {
                  setScheduleFilter(filter);
                }
              }}
              onOpenPublishModal={handleOpenPublishModal}
              onNavigateToScheduling={onNavigateToScheduling}
            />
          )}

          {activeSection === "topics" && (
            <SyllabusTopicsSection
              items={items}
              onAddTopic={handleOpenAddTopic}
              onEditTopic={handleOpenEditTopic}
              onDeleteTopic={handleDeleteTopic}
              onStatusChange={handleStatusChange}
              onReorder={handleReorder}
              onNavigateToScheduling={onNavigateToScheduling}
            />
          )}

          {activeSection === "schedule" && (
            <SyllabusScheduleSection
              classroomId={classroomId}
              items={items}
              activePlan={activePlan}
              onEditTopic={handleOpenEditTopic}
              initialFilter={scheduleFilter}
            />
          )}

          {activeSection === "publishing" && (
            <SyllabusPublishingSection
              versions={versions}
              items={items}
              onOpenPublishModal={handleOpenPublishModal}
              onViewSnapshot={handleViewSnapshot}
            />
          )}

          {activeSection === "mappings" && (
            <SyllabusAssessmentMappingSection
              classroomId={classroomId}
              items={items}
            />
          )}

          {activeSection === "reports" && (
            <SyllabusReportsSection
              classroomId={classroomId}
              versions={versions}
              items={items}
            />
          )}
        </>
      )}

      {/* MODAL 1: ADD / EDIT TOPIC */}
      <SyllabusTopicModal
        isOpen={isTopicModalOpen}
        onClose={() => setIsTopicModalOpen(false)}
        onSave={handleSaveTopic}
        initialData={editingTopic}
      />

      {/* MODAL 2: CONFIRM PUBLISH */}
      <SyllabusPublishModal
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        onPublish={handlePublish}
        topicCount={items.length}
        currentVersionNumber={versions.length > 0 ? versions[0].versionNumber : 0}
      />

      {/* MODAL 3: VIEW VERSION SNAPSHOT */}
      <SyllabusVersionViewModal
        isOpen={isVersionViewModalOpen}
        onClose={() => setIsVersionViewModalOpen(false)}
        classroomId={classroomId}
        versionId={viewingVersionId}
      />
    </div>
  );
}
