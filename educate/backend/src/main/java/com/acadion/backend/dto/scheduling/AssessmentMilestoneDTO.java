package com.acadion.backend.dto.scheduling;

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
public class AssessmentMilestoneDTO {
    private String id;
    private String classroomId;
    private String name;
    private LocalDate startDate;
    private LocalDate endDate;
    private boolean isFixed;
    private List<Integer> targetModules;
    private Double targetCoveragePercentage;
    private int revisionBufferDays;
    private String notes;
    private boolean approved;
}
