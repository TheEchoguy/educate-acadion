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
public class StudentPerformanceResponse {
    private String classroomId;
    private String studentName;
    private String usn;
    private String studentEmail;
    
    // Scaled CIE Calculation
    private double scaledCieEarned;
    private double scaledCieMax;
    private String iaCalculationRule;
    private double overallIaAverage;
    
    // IA Tests summary
    private List<StudentIaTestSummary> iaTests;
    
    // Topic & Module Analytics
    private List<TopicPerformanceItem> weakTopics;   // < 50%
    private List<TopicPerformanceItem> strongTopics; // >= 75%
    private Map<Integer, Double> moduleMastery;      // Module (1-5) -> percentage (0-100)

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StudentIaTestSummary {
        private int iaNumber;
        private double totalMarks;
        private double maxMarks;
        private double percentage;
        private List<QuestionScoreDetail> questions;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QuestionScoreDetail {
        private String code;            // "1a", "1b", etc.
        private String questionNumber; // "1", "2", etc.
        private String subQuestion;    // "a", "b", "c"
        private String part;           // "PART-A", "PART-B"
        private String choiceGroup;    // "Q1_OR_Q2", "Q3_OR_Q4"
        private String topicName;
        private int moduleNumber;
        private String co;
        private double marksScored;
        private double maxMarks;
        private double percentage;
        private String status;         // "ATTEMPTED", "SKIPPED_CHOICE", "UNATTEMPTED"
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TopicPerformanceItem {
        private String topicName;
        private int moduleNumber;
        private String co;
        private double percentage;
        private double totalScored;
        private double totalMax;
        private String recommendation;
    }
}
