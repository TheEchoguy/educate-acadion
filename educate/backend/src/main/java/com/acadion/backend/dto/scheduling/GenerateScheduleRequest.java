package com.acadion.backend.dto.scheduling;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GenerateScheduleRequest {
    private LocalDate termStartDate;
    private LocalDate termEndDate;

    @Builder.Default
    private int sessionDurationMinutes = 60;

    @Builder.Default
    private int revisionBufferDays = 2;

    @Builder.Default
    private boolean includeBufferSessions = true;

    private String planTitle;

    @Builder.Default
    private Boolean allowPastDates = false;
}
