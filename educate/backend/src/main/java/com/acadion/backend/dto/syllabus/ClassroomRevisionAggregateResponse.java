package com.acadion.backend.dto.syllabus;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClassroomRevisionAggregateResponse {

    private String classroomId;
    private String classroomName;
    private String publishedVersionId;
    private Integer versionNumber;

    // Student participation
    private long totalEnrolledStudents;
    private long participatingStudents;
    private long totalTopicsInVersion;

    // Aggregate revision status distribution
    private long totalRevisedEntries;
    private long totalInProgressEntries;
    private long totalNotStartedEntries;

    // Percentage of (participatingStudents * totalTopicsInVersion)
    private double revisionCompletionPercentage;

    // Self-reported understanding distribution
    private long confidentCount;
    private long understoodCount;
    private long needsRevisionCount;
    private long notAssessedCount;

    // Privacy guarantee note
    @Builder.Default
    private String privacyNotice = "Aggregated anonymous personal self-reports. Individual student notes and identities remain strictly private.";
}
