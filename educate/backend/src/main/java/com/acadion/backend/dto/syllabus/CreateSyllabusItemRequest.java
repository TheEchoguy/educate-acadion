package com.acadion.backend.dto.syllabus;

import com.acadion.backend.entity.LearningResource;
import com.acadion.backend.entity.SyllabusStatus;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateSyllabusItemRequest {

    @NotBlank(message = "Unit name or identifier is required")
    private String unit;

    @NotBlank(message = "Topic name is required")
    private String topic;

    private String description;

    @Builder.Default
    private SyllabusStatus status = SyllabusStatus.NOT_STARTED;

    private Integer orderIndex;

    private List<String> learningObjectives;

    private String teachingNotes;

    private Double estimatedHours;

    private LocalDate plannedStartDate;

    private LocalDate plannedCompletionDate;

    private List<LearningResource> learningResources;

    private String referenceMaterials;
}
