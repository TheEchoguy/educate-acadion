package com.acadion.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EvaluateResponseRequest {

    private String responseId;

    private String questionId;

    private Double marksObtained;

    private String feedback;

    private String evaluatedBy;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QuestionScoreRequest {
        private String questionId;
        private Double marksObtained;
        private String feedback;
    }
}