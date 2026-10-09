package com.acadion.backend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class ResponseSubmissionRequest {

    @NotBlank
private String usn;
    @NotBlank
    private String paperId;

    private String submissionMode; // ONLINE, OFFLINE_MANUAL, PRACTICE
    private Boolean isPractice;
    private String paperCategory;
    private Boolean includeInOverallPercentage;
    private String evaluatedBy;
    private String evaluatedByEmail;

    @Valid
    @NotEmpty
    private List<AnswerRequest> responses;

    @Data
    public static class AnswerRequest {

        @NotBlank
        private String questionId;

        private String answer;

        private Double marksObtained;
    }
}
