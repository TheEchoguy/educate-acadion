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
public class StudentRiskXaiResponse {

    private String studentId;
    private String usn;
    private String name;
    private String riskLevel;            // "ON_TRACK", "NEEDS_ATTENTION", "HIGH_RISK"
    private double riskScore;            // 0.0 to 100.0
    private int predictedClassIndex;     // 0, 1, 2
    private RiskProbabilities probabilities;
    private List<ShapAttribution> shapAttributions;
    private String topRiskFactor;
    private List<String> studentActionPlan;
    private String teacherIntervention;
    private Map<String, Object> metrics;
    private String evaluationSource;     // "PYTHON_ML_SHAP" or "LOCAL_FALLBACK_RULE_ENGINE"

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RiskProbabilities {
        private double onTrack;
        private double needsAttention;
        private double highRisk;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ShapAttribution {
        private String featureName;
        private String rawFeatureKey;
        private double featureValue;
        private double impactPct;
        private String direction;        // "INCREASES_RISK", "DECREASES_RISK"
        private String description;
    }
}
