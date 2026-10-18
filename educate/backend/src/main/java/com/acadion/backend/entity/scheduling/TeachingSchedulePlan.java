package com.acadion.backend.entity.scheduling;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "teaching_schedule_plans")
@CompoundIndex(name = "classroom_plan_ver_idx", def = "{'classroomId': 1, 'versionNumber': -1}")
public class TeachingSchedulePlan {

    @Id
    private String id;

    @Indexed
    private String classroomId;

    private int versionNumber;

    private String planTitle;

    @Builder.Default
    private SchedulePlanStatus status = SchedulePlanStatus.DRAFT;

    private LocalDate termStartDate;

    private LocalDate termEndDate;

    private int totalPlannedSessions;

    private int completedSessions;

    private int skippedSessions;

    private String feasibilityStatus; // FEASIBLE, TIGHT, INFEASIBLE

    private String feasibilityReport;

    private LocalDateTime createdAt;

    private LocalDateTime approvedAt;

    private LocalDateTime publishedAt;

    private String createdBy; // Teacher email
}
