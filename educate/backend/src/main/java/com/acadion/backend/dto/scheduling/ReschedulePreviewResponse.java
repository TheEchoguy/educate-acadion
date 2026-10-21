package com.acadion.backend.dto.scheduling;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReschedulePreviewResponse {
    private String sessionId;
    private String topicTitle;
    private LocalDate originalDate;
    private LocalTime originalStartTime;
    private LocalDate proposedDate;
    private LocalTime proposedStartTime;
    private LocalTime proposedEndTime;
    private String roomNumber;
    private String proposedDayOfWeek;
    private String reason;
    private int affectedSubsequentSessionsCount;
    private String deadlineImpact;
    @Builder.Default
    private List<String> conflictWarnings = new ArrayList<>();
    private boolean isFeasible;
    private boolean isOutsideTerm;
    private boolean hasConflict;
    @Builder.Default
    private List<AffectedSessionDetail> affectedSessionsPreview = new ArrayList<>();

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AffectedSessionDetail {
        private int sessionNumber;
        private String topicTitle;
        private LocalDate originalDate;
        private LocalDate newDate;
        private LocalTime newStartTime;
        private LocalTime newEndTime;
        private String reason;
    }
}
