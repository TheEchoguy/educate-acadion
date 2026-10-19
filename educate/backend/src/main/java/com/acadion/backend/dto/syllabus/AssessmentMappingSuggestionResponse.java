package com.acadion.backend.dto.syllabus;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AssessmentMappingSuggestionResponse {

    private String paperId;
    private String questionId;
    private String assessmentTitle;
    private String subject;
    private String subjectCode;
    private String matchedTopicLabel;
    private String confidenceReason;
    private boolean confirmed;
}
