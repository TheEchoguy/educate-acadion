package com.acadion.backend.dto.syllabus;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TopicAssessmentInsightResponse {

    private String classroomId;
    private String topicId;
    private String unit;
    private String topic;

    private boolean hasEvidence;
    private String evidenceSummary;

    // Mapping metrics
    private int confirmedMappingsCount;
    private int mappedPapersCount;
    private int mappedQuestionsCount;

    // Student performance metrics
    private int totalResponsesEvaluated;
    private int distinctStudentsCount;
    private Double totalMarksObtained;
    private Double totalMaxMarks;
    private Double averageScorePercentage;

    // Evidence-based recommendations
    private boolean recommendedForReview;
    private String reviewReason;
    private String sampleSizeReliability; // NONE, LOW (<5), MODERATE (5-15), HIGH (>15)

    // Mapped assessment references (safe titles only)
    private List<MappedAssessmentReference> mappedAssessments;

    @Builder.Default
    private String limitationDisclaimer = "Assessment mappings are verified by teacher ownership and subject alignment. Assessment papers are not strictly bound by classroom foreign keys.";

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MappedAssessmentReference {
        private String paperId;
        private String questionId;
        private String assessmentTitle;
        private String subject;
        private Double questionScorePercentage;
        private Integer attemptsCount;
    }
}
