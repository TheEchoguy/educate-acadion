package com.acadion.backend.dto.syllabus;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentRevisionSummaryResponse {

    private String classroomId;
    private String studentId;
    private String publishedVersionId;
    private long totalTopics;
    private long revisedCount;
    private long inProgressCount;
    private long notStartedCount;
    private double revisionPercentage;

    private long confidentCount;
    private long understoodCount;
    private long needsRevisionCount;
    private long notAssessedCount;
}
