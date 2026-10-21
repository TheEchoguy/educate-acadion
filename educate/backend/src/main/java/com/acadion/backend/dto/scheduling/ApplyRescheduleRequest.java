package com.acadion.backend.dto.scheduling;

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
public class ApplyRescheduleRequest {
    private String reason;
    @Builder.Default
    private boolean shiftSubsequentSessions = true;
    private LocalDate targetDate;
    private LocalTime targetStartTime;
    private LocalTime targetEndTime;
    private int durationMinutes;
    private String roomNumber;
}
