package com.acadion.backend.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import org.springframework.data.annotation.Id;

import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

import java.util.ArrayList;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "question_papers")
public class QuestionPaper {

    @Id
    private String id;

    private String paperId;

    private String subject;

    private Integer internalNo;

    private String originalFileName;

    private String contentType;

    private LocalDateTime uploadedAt;

    // Header metadata
    private String collegeName;
    private String subjectCode;
    private String examName;
    private String semester;
    private String date;
    private String duration;
    private Integer durationMinutes;
    private Double maxMarks;

    // TOTAL EFFECTIVE MARKS
    private Double totalMarks;

    // TOTAL RAW MARKS
    private Double rawMarks;

    // ASSESSMENT, PRACTICE, QUIZ
    @Builder.Default
    private String paperCategory = "ASSESSMENT";

    // THEORY, MCQ, HYBRID
    @Builder.Default
    private String paperFormat = "THEORY";

    // Teacher practice assignment
    @Builder.Default
    private Boolean allowedForPractice = false;

    private String assignedSemester;

    private String createdBy;

    @Builder.Default
    private List<Question> questions =
            new ArrayList<>();

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Question {

        // Q1 or Q1(a)
        private String questionId;

        // Full Question
        private String text;

        // Module / Section
        // Example: MODULE 1 / PART A
        private String section;

        // Group Name: GROUP-A / OR-Q1
        private String groupName;

        // true if optional
        private Boolean optionalQuestion;

        // Optional With: Q1
        private String optionalWith;

        // Q1 parent for Q1(a), Q1(b)
        private String parentQuestion;

        // Attempt limit inside group
        private Integer maxAttempt;

        // THEORY / MCQ / SHORT
        private String questionType;

        // 10 marks
        private Double marks;

        // DBMS / SQL
        private String topic;

        // Image / Diagram URL or Base64
        private String imageUrl;

        // Options for MCQ
        @Builder.Default
        private List<String> options =
                new ArrayList<>();

        // Correct Answer for MCQ (e.g. "A" or Option text)
        private String correctAnswer;

        // "A" | "B" | "C" | "D"
        private String correctOption;

        // Solution prompt stem
        private String prompt;

        // Module number 1 to 5
        private Integer module;

        // Explanation / Reference Solution
        private String explanation;
    }
}