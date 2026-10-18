package com.acadion.backend.entity.scheduling;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.DayOfWeek;
import java.time.LocalTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "timetable_slots")
public class TimetableSlot {

    @Id
    private String id;

    @Indexed
    private String classroomId;

    private String subjectCode;

    private DayOfWeek dayOfWeek;

    private LocalTime startTime;

    private LocalTime endTime;

    @Builder.Default
    private int durationMinutes = 60;

    private String roomNumber;

    private String facultyName;

    private boolean isLabOrPractical;

    private String sourceDocumentId;

    @Builder.Default
    private boolean approved = true;
}
