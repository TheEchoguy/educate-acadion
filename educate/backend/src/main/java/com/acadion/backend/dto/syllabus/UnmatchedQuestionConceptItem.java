package com.acadion.backend.dto.syllabus;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UnmatchedQuestionConceptItem {
    private String questionId;
    private String questionIdentifier;
    private String questionText;
    private String detectedConcept;
    private String explanation;
    private String divergenceReason;
    private String potentialModuleMapping;
    private String possibleAlternativeTopic;
    private String teacherReviewAction;

    public String getQuestionIdentifier() {
        return questionIdentifier != null ? questionIdentifier : questionId;
    }

    public String getDivergenceReason() {
        return divergenceReason != null ? divergenceReason : explanation;
    }

    public String getPossibleAlternativeTopic() {
        return possibleAlternativeTopic != null ? possibleAlternativeTopic : potentialModuleMapping;
    }
}
