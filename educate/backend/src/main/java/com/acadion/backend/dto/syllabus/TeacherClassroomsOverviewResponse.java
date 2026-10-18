package com.acadion.backend.dto.syllabus;

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
public class TeacherClassroomsOverviewResponse {

    private String teacherEmail;
    private int totalManagedClassrooms;
    private long totalSyllabusTopics;
    private double overallAverageCoverage;
    private LocalDateTime generatedAt;
    private List<ClassroomOverviewItemResponse> classrooms;
}
