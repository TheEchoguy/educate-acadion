package com.acadion.backend.dto.syllabus;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TopicAssessmentAnalysisResponse {
    private String topicId;
    private String syllabusTopicId;
    private String topicTitle;
    private String syllabusTopicName;
    private String unit;
    private String paperId;
    private String examName;
    private String questionId;
    private String questionIdentifier;
    private String analysisScope;

    @Builder.Default
    private List<MatchedConceptItem> coveredConcepts = new ArrayList<>();
    private List<MatchedConceptItem> matchedConcepts;

    @Builder.Default
    private List<MissingSyllabusConceptItem> missingSyllabusConcepts = new ArrayList<>();

    @Builder.Default
    private List<UnmatchedQuestionConceptItem> unmatchedQuestionConcepts = new ArrayList<>();

    private int totalSyllabusConceptsEvaluated;
    private int totalQuestionConceptsEvaluated;
    private double alignmentPercentage;
    @Builder.Default
    private boolean requiresTeacherConfirmation = true;

    private String limitationsNotes;
    private String notes;
    private String aiProviderUsed;

    public String getTopicId() {
        return topicId != null ? topicId : syllabusTopicId;
    }

    public String getTopicTitle() {
        return topicTitle != null ? topicTitle : syllabusTopicName;
    }

    public List<MatchedConceptItem> getCoveredConcepts() {
        return coveredConcepts != null && !coveredConcepts.isEmpty() ? coveredConcepts : (matchedConcepts != null ? matchedConcepts : new ArrayList<>());
    }

    public List<MatchedConceptItem> getMatchedConcepts() {
        return getCoveredConcepts();
    }
}
