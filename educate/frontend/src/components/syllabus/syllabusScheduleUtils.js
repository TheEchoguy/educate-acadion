/**
 * Utility functions for syllabus scheduling and pacing classification.
 * Ensures consistent definitions across Overview, Schedule, and Analytics sections.
 */

/**
 * Returns today's date formatted as YYYY-MM-DD in the local timezone.
 */
export const getLocalTodayStr = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Classifies a syllabus item into one of the following mutually exclusive states:
 * - COMPLETED: status === "COMPLETED"
 * - OVERDUE: status !== "COMPLETED" && plannedCompletionDate < todayStr
 * - IN_PROGRESS: status === "IN_PROGRESS" || (status !== "COMPLETED" && plannedStartDate && plannedStartDate <= todayStr && (!plannedCompletionDate || plannedCompletionDate >= todayStr))
 * - UPCOMING: status !== "COMPLETED" && status !== "IN_PROGRESS" && plannedStartDate && plannedStartDate > todayStr
 * - UNSCHEDULED: !plannedStartDate && !plannedCompletionDate
 */
export const classifyTopicSchedule = (item, todayStr = getLocalTodayStr()) => {
  if (!item) return "UNSCHEDULED";
  if (item.status === "COMPLETED") return "COMPLETED";
  if (item.status === "IN_PROGRESS" || item.status === "PARTIALLY_COMPLETED") return "IN_PROGRESS";

  const start = item.plannedStartDate || null;
  const completion = item.plannedCompletionDate || null;

  // 1. Overdue: incomplete and planned completion deadline has passed
  if (completion && completion < todayStr) {
    return "OVERDUE";
  }

  // 2. In Progress / Active: today is within start and completion
  if (start && start <= todayStr && (!completion || completion >= todayStr)) {
    return "IN_PROGRESS";
  }

  // 3. Upcoming: start date is strictly in the future (after today) and not yet started
  if (start && start > todayStr) {
    return "UPCOMING";
  }

  // 4. Unscheduled: no dates assigned
  if (!start && !completion) {
    return "UNSCHEDULED";
  }

  return "UNSCHEDULED";
};

/**
 * Computes grouped arrays and counts from an array of syllabus items.
 */
export const getScheduleSummary = (items = [], todayStr = getLocalTodayStr()) => {
  const classified = items.map((item) => ({
    ...item,
    scheduleClassification: classifyTopicSchedule(item, todayStr),
  }));

  const overdue = classified.filter((i) => i.scheduleClassification === "OVERDUE");
  const inProgress = classified.filter((i) => i.scheduleClassification === "IN_PROGRESS");
  const upcoming = classified.filter((i) => i.scheduleClassification === "UPCOMING");
  const unscheduled = classified.filter((i) => i.scheduleClassification === "UNSCHEDULED");
  const completed = classified.filter((i) => i.scheduleClassification === "COMPLETED");

  const totalTopics = items.length;
  const completedCount = completed.length;
  const inProgressCount = inProgress.length;
  const upcomingCount = upcoming.length;
  const overdueCount = overdue.length;
  const unscheduledCount = unscheduled.length;

  const plannedHours = items.reduce((acc, curr) => acc + (Number(curr.estimatedHours) || 0), 0);
  const completedHours = completed.reduce((acc, curr) => acc + (Number(curr.estimatedHours) || 0), 0);
  const inProgressHours = inProgress.reduce((acc, curr) => acc + (Number(curr.estimatedHours) || 0), 0);

  const coveragePercentage = totalTopics > 0
    ? Math.round((completedCount / totalTopics) * 1000) / 10
    : 0;

  return {
    classified,
    overdue,
    inProgress,
    upcoming,
    unscheduled,
    completed,
    totalTopics,
    completedCount,
    inProgressCount,
    upcomingCount,
    overdueCount,
    unscheduledCount,
    plannedHours: Math.round(plannedHours * 10) / 10,
    completedHours: Math.round(completedHours * 10) / 10,
    inProgressHours: Math.round(inProgressHours * 10) / 10,
    coveragePercentage,
  };
};
