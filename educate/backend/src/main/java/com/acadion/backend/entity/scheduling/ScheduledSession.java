package com.acadion.backend.entity.scheduling;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "scheduled_sessions")
@CompoundIndex(name = "plan_session_idx", def = "{'planId': 1, 'sessionDate': 1, 'sessionNumber': 1}")
@CompoundIndex(name = "classroom_session_idx", def = "{'classroomId': 1, 'sessionDate': 1}")
public class ScheduledSession {

    @Id
    private String id;

    @Indexed
    private String planId;

    @Indexed
    private String classroomId;

    private int sessionNumber;

    private LocalDate sessionDate;

    private DayOfWeek dayOfWeek;

    private LocalTime startTime;

    private LocalTime endTime;

    @Builder.Default
    private int durationMinutes = 60;

    private String roomNumber;

    private int moduleNumber;

    private String moduleTitle;

    private String topicId; // Optional link to existing SyllabusItem

    private String topicTitle;

    private String subtopic;

    @Builder.Default
    private String subtopicSource = "OFFICIAL_SYLLABUS";

    private String teachingObjective;

    private String associatedDocumentId; // Link to module PDF

    private String milestoneTag; // e.g. "Pre-CIE-1", "Revision Buffer"

    @Builder.Default
    private SessionStatus status = SessionStatus.SCHEDULED;

    private LocalDateTime actualOutcomeDate;

    private String teacherNotes;

    private String portionsCovered;

    private String remainingPortion;

    private Integer carriedForwardFromSessionNumber;

    private Integer carriedForwardToSessionNumber;

    @Builder.Default
    private boolean isCarriedForward = false;

    @Builder.Default
    private boolean isLocked = false;

    @Builder.Default
    private java.util.List<String> coveredTopics = new java.util.ArrayList<>();
}
