package com.acadion.backend.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class CreateQuestionPaperRequest {

    private String paperId;

    private String subject;

    private Integer internalNo;

    private String collegeName;
    private String subjectCode;
    private String examName;
    private String semester;
    private String date;
    private String duration;
    private Integer durationMinutes;
    private Double maxMarks;

    private Double totalMarks;

    private Double rawMarks;

    private String paperCategory; // ASSESSMENT, PRACTICE, QUIZ

    private String paperFormat; // THEORY, MCQ, HYBRID

    private Boolean allowedForPractice;

    private String assignedSemester;

    private String createdBy;

    private List<QuestionData> questions =
            new ArrayList<>();

    @Data
    public static class QuestionData {

        // Q1
        private String questionId;

        // Full question
        private String text;

        // MODULE 1 / PART A
        private String section;

        // GROUP-A
        private String groupName;

        // Optional question
        private Boolean optionalQuestion;

        // Optional With: Q1
        private String optionalWith;

        // Parent Question
        // Q1 for Q1a
        private String parentQuestion;

        // Answer any ONE
        private Integer maxAttempt;

        // THEORY / MCQ
        private String questionType;

        // Marks
        private Double marks;

        // Topic
        private String topic;

        // Image / Diagram URL or Base64
        private String imageUrl;

        private List<String> options =
                new ArrayList<>();

        // Correct answer option (A, B, C, D or text)
        private String correctAnswer;

        // Solution explanation / rationale
        private String explanation;
    }
}