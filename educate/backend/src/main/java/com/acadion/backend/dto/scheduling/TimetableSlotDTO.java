package com.acadion.backend.dto.scheduling;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.DayOfWeek;
import java.time.LocalTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TimetableSlotDTO {
    private String id;
    private String classroomId;
    private String subjectCode;
    private DayOfWeek dayOfWeek;
    private LocalTime startTime;
    private LocalTime endTime;
    private int durationMinutes;
    private String roomNumber;
    private String facultyName;
    private boolean isLabOrPractical;
    private boolean approved;
}
