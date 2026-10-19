package com.acadion.backend.dto.syllabus;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClassroomAssessmentInsightsResponse {

    private String classroomId;
    private String classroomName;
    private String subjectName;
    private String subjectCode;

    private int totalSyllabusTopics;
    private int mappedTopicsCount;
    private int topicsWithEvaluatedEvidenceCount;
    private int topicsRecommendedForReviewCount;

    private Double classAverageAssessmentPercentage;
    private LocalDateTime generatedAt;

    private List<TopicAssessmentInsightResponse> topicInsights;

    @Builder.Default
    private String limitationDisclaimer = "Assessment mappings are verified by teacher ownership and subject alignment. Assessment papers are not strictly bound by classroom foreign keys.";
}
