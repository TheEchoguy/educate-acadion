package com.acadion.backend.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SyllabusItemSnapshot {

    /**
     * Stable syllabus topic identifier preserving identity across successive versions.
     */
    private String topicId;

    private String unit;

    private String topic;

    private String description;

    private SyllabusStatus status;

    private Integer orderIndex;

    @Builder.Default
    private List<String> learningObjectives = new ArrayList<>();

    private String teachingNotes;

    private Double estimatedHours;

    private LocalDate plannedStartDate;

    private LocalDate plannedCompletionDate;

    @Builder.Default
    private List<LearningResource> learningResources = new ArrayList<>();

    private String referenceMaterials;

    private String createdBy;

    private String updatedBy;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
