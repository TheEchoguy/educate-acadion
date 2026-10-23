package com.acadion.backend.dto.intelligence;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentAllCoursesPerformanceResponse {

    private String studentName;
    private String studentUsn;
    private Integer semester;
    private String department;

    // Top banner: Overall Semester Trajectory & Combined Credit GPA Projection
    private String overallSemesterTrajectory; // e.g. "ON_TRACK_DISTINCTION", "ON_TRACK_FIRST_CLASS"
    private String overallRiskCategory;       // "LOW", "MEDIUM", "HIGH"
    private double combinedGpaProjection;     // e.g. 8.4
    private int totalEnrolledCourses;
    private double averageScaledCie;          // e.g. 38.5 / 50.0
    private String academicAdvice;

    // Enrolled subjects grid: Summary card for each course
    private List<CourseSummaryDTO> courses;

    // Cross-subject topic mastery comparison
    private List<CrossSubjectMasteryDTO> crossSubjectComparisons;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CourseSummaryDTO {
        private String classroomId;
        private String courseCode;
        private String courseName;
        private String teacherName;
        private Integer semester;
        private String section;
        private double scaledIaScore;       // e.g. 13.5 / 15.0
        private double totalCieSecured;     // Scaled CIE out of 50.0
        private double cieMaxMarks;         // 50.0
        private String cieStatus;           // "PASSING", "AT_RISK", "PENDING"
        private String riskLevel;           // "LOW", "MEDIUM", "HIGH", "ON_TRACK"
        private double coveragePercentage;
        private int totalTopics;
        private int weakTopicsCount;
        private int masteredTopicsCount;
        private boolean isPublished;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CrossSubjectMasteryDTO {
        private String classroomId;
        private String courseCode;
        private String courseName;
        private double masteryPercentage;
        private int weakTopicsCount;
        private int strongTopicsCount;
        private int totalTopicsAssessed;
        private String status;              // "ON_TRACK", "NEEDS_ATTENTION", "AT_RISK"
    }
}
