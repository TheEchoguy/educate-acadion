package com.acadion.backend.entity.scheduling;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "reschedule_records")
public class RescheduleRecord {

    @Id
    private String id;

    @Indexed
    private String classroomId;

    private String planId;

    private String sessionId;

    private String topicTitle;

    private LocalDate originalDate;

    private LocalTime originalStartTime;

    private LocalDate newDate;

    private LocalTime newStartTime;

    private String reason;

    private LocalDateTime rescheduledAt;

    private String rescheduledBy;

    private int impactedSubsequentSessions;
}
