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
    private String reason;
    private int affectedSubsequentSessionsCount;
    private String deadlineImpact;
    @Builder.Default
    private List<String> conflictWarnings = new ArrayList<>();
    private boolean isFeasible;
}
