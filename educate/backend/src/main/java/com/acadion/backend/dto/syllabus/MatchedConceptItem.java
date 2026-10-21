package com.acadion.backend.dto.syllabus;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MatchedConceptItem {
    private String concept;
    private String conceptName;
    private String syllabusTopic;
    private String subtopic;
    private String questionId;
    private String questionIdentifier;
    private String questionSnippet;
    private String questionExcerpt;
    private String syllabusSnippet;
    private String syllabusExcerpt;
    private String matchType; // "STRONG", "PARTIAL", "UNCERTAIN"
    private double confidenceScore; // 0.0 - 1.0
    private String confidenceBand; // "HIGH", "MEDIUM", "LOW"
    private String explanation;

    public String getConceptName() {
        return conceptName != null ? conceptName : concept;
    }

    public String getQuestionIdentifier() {
        return questionIdentifier != null ? questionIdentifier : questionId;
    }

    public String getQuestionExcerpt() {
        return questionExcerpt != null ? questionExcerpt : questionSnippet;
    }

    public String getSyllabusExcerpt() {
        return syllabusExcerpt != null ? syllabusExcerpt : syllabusSnippet;
    }
}
