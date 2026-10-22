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
public class ClassroomRiskWatchlistResponse {

    private String classroomId;
    private int totalStudents;
    private int highRiskCount;
    private int needsAttentionCount;
    private int onTrackCount;
    private double classHealthScore;      // 0.0 to 100.0 (100 is optimal)
    private List<StudentRiskWatchlistItem> watchlist;
    private List<CohortRiskDriverDTO> cohortRiskDrivers;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CohortRiskDriverDTO {
        private String driverKey;
        private String driverName;
        private String description;
        private double impactPercentage; // e.g. 42.5%
        private int affectedStudentsCount;
        private String severity; // "CRITICAL", "MODERATE", "LOW"
        private List<String> affectedStudentUsns;
        private List<String> affectedStudentNames;
        private List<String> clusteredConcepts;
        private String commonMistakePattern;
        private double averageScoreDeficit; // e.g. -6.5 marks average deficit
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StudentRiskWatchlistItem {
        private String usn;
        private String studentName;
        private double scaledIaScore;
        private double cieScaledPct;
        private String riskLevel;          // "HIGH_RISK", "NEEDS_ATTENTION", "ON_TRACK"
        private double riskScore;          // 0.0 to 100.0
        private String topRiskFactor;
        private int weakTopicsCount;
        private double moduleMasteryAvg;
    }
}
