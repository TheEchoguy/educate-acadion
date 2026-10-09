package com.acadion.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EvaluationSummaryDto {
    private String paperId;
    private String subject;
    private Integer semester;
    private int totalStudents;
    private int evaluatedCount;
    private int pendingCount;
    private double averageScore;
    private double highestScore;
    private double lowestScore;
    private double passPercentage;
    private int lowRiskCount;
    private int mediumRiskCount;
    private int highRiskCount;
    private Map<String, Double> topicAverageScores;
}
