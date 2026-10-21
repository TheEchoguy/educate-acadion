package com.acadion.backend.dto.quiz;

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
public class GeneratedQuizResponse {

    private boolean success;
    private String message;
    private String subject;
    private String topic;
    private String mode;
    private String difficulty;
    private Double totalMarks;
    private String modelUsed;

    @Builder.Default
    private List<GeneratedQuestionDto> questions = new ArrayList<>();

    @Builder.Default
    private List<String> warnings = new ArrayList<>();

    // Error details if success is false
    private String error;
    private String errorCode;
}
