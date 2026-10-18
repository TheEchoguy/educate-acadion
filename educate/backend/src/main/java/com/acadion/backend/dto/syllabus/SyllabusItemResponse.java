package com.acadion.backend.dto.syllabus;

import com.acadion.backend.entity.LearningResource;
import com.acadion.backend.entity.SyllabusStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SyllabusItemResponse {

    private String id;
    private String classroomId;
    private String unit;
    private String topic;
    private String description;
    private SyllabusStatus status;
    private Integer orderIndex;
    private List<String> learningObjectives;
    private String teachingNotes;
    private Double estimatedHours;
    private LocalDate plannedStartDate;
    private LocalDate plannedCompletionDate;
    private List<LearningResource> learningResources;
    private String referenceMaterials;
    private String createdBy;
    private String updatedBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
