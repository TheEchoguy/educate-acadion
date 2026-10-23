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
public class StudentFourLevelAnalyticsDTO {

    private String studentUsn;
    private String studentName;
    private String classroomId;
    @Builder.Default
    private boolean isPublished = true;
    private String message;

    // LEVEL 1: TOPIC-LEVEL ATOMIC BREAKDOWN
    private List<TopicAnalytics> level1Topics;

    // LEVEL 2: MODULE-LEVEL MASTERY (MODULES 1 TO 5)
    private Map<Integer, ModuleAnalytics> level2Modules;

    // LEVEL 3: SUBJECT-LEVEL CIE STANDING & TARGET SEE PROJECTIONS
    private SubjectAnalytics level3Subject;

    // LEVEL 4: SEMESTER-LEVEL ACADEMIC TRAJECTORY & RISK STATUS
    private SemesterAnalytics level4Semester;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TopicAnalytics {
        private String code;            // "1a", "1b", etc.
        private String topicName;       // Synthesized 3-6 word topic
        private int moduleNumber;       // 1 - 5
        private String co;              // "CO1", etc.
        private double marksObtained;
        private double maxMarks;
        private double percentage;
        private String status;          // "WEAK" (<50%), "MODERATE" (50-74%), "STRONG" (>=75%)
        private boolean wasAttempted;
        private int iaNumber;           // 1, 2, or 3
        private String recommendation;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ModuleAnalytics {
        private int moduleNumber;
        private String moduleName;
        private double totalObtained;
        private double totalMax;
        private double percentage;
        private String status;          // "WEAK", "MODERATE", "STRONG"
        private int totalTopics;
        private int weakTopicsCount;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SubjectAnalytics {
        private String subjectCode;
        private String subjectName;
        private double rawIaAverage;           // Out of 40
        private double scaledIaScore;          // Out of 15.0
        private double assignmentScore;        // Out of 5.0
        private double labScore;               // Out of 10.0 / 0.0
        private double totalCieSecured;        // Out of 50.0
        private double cieMaxMarks;            // 50.0
        private double passingThreshold;       // 20.0
        private String cieStatus;              // "PASSING" (>= 20.0), "AT_RISK" (< 20.0)
        private String seeProjectedTarget;     // Target needed in SEE (out of 50/100)
        private String calculationRule;        // "BEST_2", "AVERAGE"
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SemesterAnalytics {
        private int semester;
        private String gpaTrajectory;          // "ON_TRACK_DISTINCTION", "ON_TRACK_FIRST_CLASS", "AVERAGE", "AT_RISK"
        private String overallRiskCategory;    // "LOW", "MEDIUM", "HIGH"
        private String academicAdvice;
    }
}
