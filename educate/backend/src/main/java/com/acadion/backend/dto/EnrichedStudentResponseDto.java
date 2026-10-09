package com.acadion.backend.dto;

import com.acadion.backend.entity.StudentResponse;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EnrichedStudentResponseDto {
    private String id;
    private String usn;
    private String studentName;
    private String studentEmail;
    private Integer semester;
    private String department;
    private String paperId;
    private String subject;
    private String subjectCode;
    private Integer internalNo;
    private LocalDateTime submittedAt;
    private Double totalMarks;
    private Double maxMarks;
    private Double percentage;
    private Double predictedScore;
    private String riskLevel;
    private boolean evaluationCompleted;
    private String evaluatedBy;
    private LocalDateTime evaluatedAt;
    private Integer attemptCount;
    private boolean reExamGranted;
    private String reExamNote;
    private LocalDateTime reExamGrantedAt;
    private String submissionMode;
    private Boolean includeInOverallPercentage;
    private List<StudentResponse.ResponseAnswer> responses;
}
