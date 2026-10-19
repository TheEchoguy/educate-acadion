package com.acadion.backend.entity.scheduling;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "assessment_milestones")
public class AssessmentMilestone {

    @Id
    private String id;

    @Indexed
    private String classroomId;

    private String name; // e.g. "CIE-1", "CIE-2", "CIE-3", "SEE"

    private LocalDate startDate;

    private LocalDate endDate;

    @Builder.Default
    private boolean isFixed = true;

    @Builder.Default
    private List<Integer> targetModules = new ArrayList<>(); // e.g. [1, 2] for CIE-1

    private Double targetCoveragePercentage; // e.g. 40.0% for CIE-1, 80.0% for CIE-2, 100.0% for CIE-3

    @Builder.Default
    private int revisionBufferDays = 2; // Days before exam reserved for revision

    private String notes;

    @Builder.Default
    private boolean approved = true;
}
