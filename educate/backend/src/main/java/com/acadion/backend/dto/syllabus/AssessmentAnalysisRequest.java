package com.acadion.backend.dto.syllabus;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AssessmentAnalysisRequest {
    @NotBlank(message = "Syllabus topic ID is required")
    private String topicId;
    private String paperId;
    private String questionId;
    private String manualContent;
    private String manualText;

    public String getManualText() {
        return manualText != null && !manualText.isBlank() ? manualText : manualContent;
    }
}
