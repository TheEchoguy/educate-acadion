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
public class CreateAssessmentMappingRequest {

    @NotBlank(message = "Syllabus topic ID is required")
    private String syllabusTopicId;

    @NotBlank(message = "Assessment paper ID is required")
    private String paperId;

    private String questionId;

    private String matchedTopicLabel;
}
