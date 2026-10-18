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
public class CalendarEventDTO {
    private String id;
    private String classroomId;
    private String eventName;
    private LocalDate startDate;
    private LocalDate endDate;
    private String eventType;
    private boolean isTeachingDay;
    private String colorCode;
    private String description;
    private boolean approved;
}
