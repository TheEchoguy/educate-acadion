package com.acadion.backend.dto.syllabus;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClassroomOverviewItemResponse {

    private String classroomId;
    private String classroomName;
    private String subjectName;
    private String subjectCode;
    private String department;
    private Integer semester;

    // Versioning
    private Integer currentVersionNumber;
    private LocalDateTime latestPublicationDate;

    // Syllabus items & coverage
    private long topicCount;
    private double coveragePercentage;
    private long completedTopics;
    private long inProgressTopics;
    private long notStartedTopics;

    // Scheduling
    private long upcomingTopicsCount;
    private long overdueTopicsCount;

    // Student counts
    private long enrolledStudentsCount;
    private long participatingStudentsCount;
    private Double averageRevisionPercentage;
}
