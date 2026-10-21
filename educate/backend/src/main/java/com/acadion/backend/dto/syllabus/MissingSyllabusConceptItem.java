package com.acadion.backend.dto.syllabus;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MissingSyllabusConceptItem {
    private String concept;
    private String conceptName;
    private String subtopic;
    private String syllabusExcerpt;
    private String explanation;
    private String confidenceLevel; // "HIGH", "MODERATE", "LOW"
    private String confidenceBand;
    private String suggestedFollowUp;
    private String suggestedAction;

    public String getConceptName() {
        return conceptName != null ? conceptName : concept;
    }

    public String getConfidenceBand() {
        return confidenceBand != null ? confidenceBand : confidenceLevel;
    }

    public String getSuggestedAction() {
        return suggestedAction != null ? suggestedAction : suggestedFollowUp;
    }
}
