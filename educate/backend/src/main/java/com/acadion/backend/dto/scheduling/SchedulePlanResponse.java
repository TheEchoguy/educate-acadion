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
    private int totalSessions;
    @Builder.Default
    private int totalUniqueTopics = 0;
    @Builder.Default
    private int totalSubtopics = 0;
    private int completedSessions;
    private int skippedSessions;
    private String feasibilityStatus;
    private String feasibilityReport;
    private Double requiredHours;
    private Double allocatedHours;
    private Double availableHours;
    private Double remainingHours;
    @Builder.Default
    private int bufferSessionsCount = 0;
    @Builder.Default
    private int unscheduledTopicsCount = 0;
    private Double unscheduledHours;
    @Builder.Default
    private List<String> diagnostics = new ArrayList<>();
    @Builder.Default
    private List<ScheduledSessionDTO> sessions = new ArrayList<>();
    private LocalDateTime createdAt;
    private LocalDateTime approvedAt;
    private LocalDateTime publishedAt;
    private String createdBy;

    public int getTotalSessions() {
        return totalPlannedSessions > 0 ? totalPlannedSessions : totalSessions;
    }
}
