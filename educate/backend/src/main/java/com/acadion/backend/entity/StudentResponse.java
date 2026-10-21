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
@Document(collection = "student_responses")
public class StudentResponse {

    @Id
    private String id;

    private String usn;

    private String studentId;

    private String paperId;

    private LocalDateTime submittedAt;

    private Double totalMarks;

    private Double maxMarks;

    private Double predictedScore;

    private String riskLevel;
    private boolean evaluationCompleted;

    private String evaluatedBy;
    private String evaluatedByEmail;
    private LocalDateTime evaluatedAt;

    @Builder.Default
    private Integer attemptCount = 1;

    private boolean reExamGranted;
    private String reExamNote;
    private LocalDateTime reExamGrantedAt;

    // Practice / Evaluation Modes
    @Builder.Default
    private String submissionMode = "ONLINE"; // ONLINE, OFFLINE_MANUAL

    @Builder.Default
    private Boolean includeInOverallPercentage = true;

    @Builder.Default
    private String paperCategory = "ASSESSMENT"; // ASSESSMENT, PRACTICE, QUIZ

    private boolean isPractice;

    @Builder.Default
    private String evaluationMode = "FACULTY"; // FACULTY, SELF, PEER

    private String assignedPeerUsn;
    private String assignedPeerName;

    private String peerEvaluatorUsn;
    private String peerEvaluatorName;
    private LocalDateTime peerEvaluatedAt;
    private String peerFeedback;

    @Builder.Default
    private List<ResponseAnswer> responses = new ArrayList<>();

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ResponseAnswer {

        private String questionId;
        private String questionText;
        private String questionType; // THEORY, MCQ

        private String answer;
        private Boolean isCorrect;

        private Double marksObtained;
        private Double maxMarks;

        private String topic;
        private String feedback;

        private boolean evaluated;
    }
}
