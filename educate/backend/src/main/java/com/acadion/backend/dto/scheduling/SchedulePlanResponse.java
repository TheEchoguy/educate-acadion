package com.acadion.backend.dto.scheduling;

import com.acadion.backend.entity.scheduling.SchedulePlanStatus;
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
public class SchedulePlanResponse {
    private String planId;
    private String classroomId;
    private int versionNumber;
    private String planTitle;
    private SchedulePlanStatus status;
    private LocalDate termStartDate;
    private LocalDate termEndDate;
    private int totalPlannedSessions;
    private int completedSessions;
    private int skippedSessions;
    private String feasibilityStatus;
    private String feasibilityReport;
    @Builder.Default
    private List<ScheduledSessionDTO> sessions = new ArrayList<>();
    private LocalDateTime createdAt;
    private LocalDateTime approvedAt;
    private LocalDateTime publishedAt;
    private String createdBy;
}
