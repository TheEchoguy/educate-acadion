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
public class GeneratedQuestionDto {

    private String questionId; // e.g. Q1, Q2
    private String text;

    @Builder.Default
    private List<String> options = new ArrayList<>(); // exactly 4 options

    private String correctAnswer; // "A", "B", "C", "D"

    private String explanation;

    @Builder.Default
    private Double marks = 1.0;

    private String topic;

    @Builder.Default
    private String questionType = "MCQ";
}
