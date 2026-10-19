package com.acadion.backend.dto.scheduling;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ManualSessionAllocationRequest {

    @NotNull(message = "Session date is mandatory")
    private LocalDate sessionDate;

    private LocalTime startTime;

    private LocalTime endTime;

    @Builder.Default
    private int durationMinutes = 60;

    private String roomNumber;

    private int moduleNumber;

    private String moduleTitle;

    private String topicId; // Optional link to existing SyllabusItem

    @NotBlank(message = "Topic title is mandatory")
    private String topicTitle;

    private String subtopic;

    private String teachingObjective;

    private String teacherNotes;

    private String planId; // Optional: target plan ID (defaults to active/draft plan)
}
