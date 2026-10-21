package com.acadion.backend.dto.intelligence;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClassroomAnalyticsSummaryDTO {

    private String classroomId;
    private String subjectCode;
    private String subjectName;
    private int enrolledStudentsCount;
    private int evaluatedStudentsCount;

    // Class average per topic (ranked from weakest to strongest for Heatmap)
    private List<TopicClassPerformance> topicHeatmap;

    // Module 1 to 5 class averages
    private Map<Integer, Double> moduleAverages;

    // Distribution of students: Strong (>=75%), Moderate (50-74%), Needs Support (<50%)
    private StudentDistribution studentDistribution;

    // Lowest performing topics (Class Weak Diagnostic Areas)
    private List<String> lowestPerformingTopics;

    // Student summary list for table display
    private List<StudentClassSummaryItem> studentSummaries;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TopicClassPerformance {
        private String code;
        private String topicName;
        private int moduleNumber;
        private String co;
        private double classAveragePercentage;
        private int studentsAttemptedCount;
        private int weakStudentsCount;
        private String status; // "CRITICAL_WEAK" (<40%), "WEAK" (40-50%), "MODERATE" (50-74%), "STRONG" (>=75%)
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StudentDistribution {
        private int strongCount;       // >= 75%
        private int moderateCount;     // 50 - 74%
        private int needsSupportCount; // < 50%
        private double classAverageIa; // / 40.0
        private double classAverageCie; // / 15.0 or 50.0
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StudentClassSummaryItem {
        private String usn;
        private String studentName;
        private double iaTotal;
        private double scaledCie;
        private String weakestTopic;
        private double weakestTopicPercentage;
        private String overallStatus; // "STRONG", "MODERATE", "NEEDS_SUPPORT"
        private boolean published;
    }
}
