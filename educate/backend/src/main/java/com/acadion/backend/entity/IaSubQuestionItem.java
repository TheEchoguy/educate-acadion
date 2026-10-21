package com.acadion.backend.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IaSubQuestionItem {
    private String questionNumber; // "1", "2", "3", "4"
    private String subQuestion;    // "a", "b", "c"
    private String code;           // "1a", "1b", "1c", etc.
    private double maxMarks;       // 5.0, 10.0
    private String part;           // "PART-A", "PART-B"
    private String choiceGroup;    // "Q1_OR_Q2", "Q3_OR_Q4"
    private int moduleNumber;      // 1 to 5
    private String co;             // "CO1".."CO5"
    private String topicName;
    private String questionText;

    @Builder.Default
    private String questionType = "THEORY"; // "THEORY" or "MCQ"
    private String prompt;
    private java.util.List<String> options;
    private String correctOption;
    private String explanation;
}
