package com.acadion.backend.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "syllabus_items")
public class SyllabusItem {

    @Id
    private String id;

    private String classroomId;

    private String unit;

    private String topic;

    private String description;

    @Builder.Default
    private SyllabusStatus status = SyllabusStatus.NOT_STARTED;

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
