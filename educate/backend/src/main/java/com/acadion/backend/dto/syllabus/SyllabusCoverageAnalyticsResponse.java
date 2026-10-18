package com.acadion.backend.dto.syllabus;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SyllabusCoverageAnalyticsResponse {

    private String classroomId;
    private String classroomName;
    private String subjectName;
    private String subjectCode;

    // Teaching progress counts
    private long totalTopics;
    private long completedTopics;
    private long inProgressTopics;
    private long notStartedTopics;
    private double coveragePercentage;

    // Teaching hours metrics
    private Double estimatedTotalHours;
    private Double completedHours;

    // Schedule status counts
    private long upcomingTopicsCount;
    private long overdueTopicsCount;
    private long unscheduledTopicsCount;

    // Versioning information
    private Integer latestVersionNumber;
    private LocalDateTime latestPublishedAt;

    // Detailed topic summaries for schedule insights
    private List<ScheduledTopicSummary> upcomingTopics;
    private List<ScheduledTopicSummary> overdueTopics;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ScheduledTopicSummary {
        private String topicId;
        private String unit;
        private String topic;
        private String status;
        private LocalDate plannedStartDate;
        private LocalDate plannedCompletionDate;
        private Double estimatedHours;
        private String scheduleClassification; // OVERDUE, UPCOMING, UNSCHEDULED
    }
}
