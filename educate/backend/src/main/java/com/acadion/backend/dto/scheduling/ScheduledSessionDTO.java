package com.acadion.backend.dto.scheduling;

import com.acadion.backend.entity.scheduling.SessionStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScheduledSessionDTO {
    private String id;
    private String planId;
    private String classroomId;
    private int sessionNumber;
    private LocalDate sessionDate;
    private DayOfWeek dayOfWeek;
    private LocalTime startTime;
    private LocalTime endTime;
    private int durationMinutes;
    private String roomNumber;
    private int moduleNumber;
    private String moduleTitle;
    private String topicId;
    private String topicTitle;
    private String subtopic;
    private String subtopicSource;
    private String teachingObjective;
    private String associatedDocumentId;
    private String milestoneTag;
    private SessionStatus status;
    private LocalDateTime actualOutcomeDate;
    private String teacherNotes;
    private boolean isLocked;
}
