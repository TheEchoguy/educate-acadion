package com.acadion.backend.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "subject_evaluation_schemes")
public class SubjectEvaluationScheme {

    @Id
    private String id;

    @Indexed(unique = true)
    private String classroomId;

    @Builder.Default
    private String courseCode = "BCS701";

    @Builder.Default
    private String courseName = "Internet of Things";

    @Builder.Default
    private int semester = 7;

    @Builder.Default
    private boolean isLabIntegrated = true;

    // IA component
    @Builder.Default
    private int iaCount = 3;

    @Builder.Default
    private double iaRawMaxMarks = 40.0;

    @Builder.Default
    private double iaScaledMaxMarks = 15.0;

    @Builder.Default
    private String iaCalculationRule = "AVERAGE_ALL"; // e.g. "AVERAGE_ALL", "BEST_2"

    // Assignment component
    @Builder.Default
    private double assignmentRawMaxMarks = 25.0;

    @Builder.Default
    private double assignmentScaledMaxMarks = 10.0;

    // Lab components (if isLabIntegrated is true)
    @Builder.Default
    private double labRecordScaledMarks = 15.0;

    @Builder.Default
    private double labTestRawMarks = 50.0;

    @Builder.Default
    private double labTestScaledMarks = 10.0;

    // CIE summary
    @Builder.Default
    private double cieTotalMaxMarks = 50.0;

    @Builder.Default
    private double cieMinPassingMarks = 20.0;

    // SEE component
    @Builder.Default
    private double seeRawMaxMarks = 100.0;

    @Builder.Default
    private double seeScaledMaxMarks = 50.0;

    @Builder.Default
    private double seeMinPassingMarks = 18.0;

    // Overall passing criteria
    @Builder.Default
    private double totalPassMinMarks = 40.0;

    @Builder.Default
    private Instant updatedAt = Instant.now();
}
