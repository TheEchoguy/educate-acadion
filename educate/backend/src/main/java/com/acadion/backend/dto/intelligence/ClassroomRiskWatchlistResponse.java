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
