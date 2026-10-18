package com.acadion.backend.dto.syllabus;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SyllabusProgressResponse {

    private String classroomId;
    private long totalTopics;
    private long completedTopics;
    private long inProgressTopics;
    private long notStartedTopics;
    private double completionPercentage;
}
