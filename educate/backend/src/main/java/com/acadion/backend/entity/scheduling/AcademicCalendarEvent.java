package com.acadion.backend.entity.scheduling;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "academic_calendar_events")
public class AcademicCalendarEvent {

    @Id
    private String id;

    @Indexed
    private String classroomId;

    private String eventName;

    private LocalDate startDate;

    private LocalDate endDate;

    // HOLIDAY, RESTRICTED_HOLIDAY, INTERNAL_ASSESSMENT, EXAM, COLLEGE_EVENT, NON_TEACHING_DAY
    private String eventType;

    // If true, teaching can occur; if false (e.g. holidays, exams), regular classes are not scheduled
    private boolean isTeachingDay;

    private String colorCode; // e.g., "#ef4444" for Holiday, "#fbbf24" for CIE, "#38bdf8" for PTM

    private String description;

    private String sourceDocumentId;

    @Builder.Default
    private boolean approved = true;
}
