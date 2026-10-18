package com.acadion.backend.service.scheduling;

import com.acadion.backend.dto.scheduling.SchedulePlanResponse;
import com.acadion.backend.dto.scheduling.ScheduledSessionDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;

@Service
@RequiredArgsConstructor
@Slf4j
public class SyllabusSchedulingExportService {

    private final ScheduleExecutionService executionService;

    public byte[] exportScheduleIcal(String classroomId, String userEmail) {
        SchedulePlanResponse plan = executionService.getActiveOrDraftPlan(classroomId, userEmail);
        if (plan == null || plan.getSessions().isEmpty()) {
            throw new IllegalStateException("No active schedule plan found to export");
        }

        StringBuilder ics = new StringBuilder();
        ics.append("BEGIN:VCALENDAR\r\n");
        ics.append("VERSION:2.0\r\n");
        ics.append("PRODID:-//Acadion//Syllabus Scheduling Engine//EN\r\n");
        ics.append("CALSCALE:GREGORIAN\r\n");
        ics.append("METHOD:PUBLISH\r\n");
        ics.append("X-WR-CALNAME:").append(escapeIcal(plan.getPlanTitle())).append("\r\n");

        DateTimeFormatter dateFmt = DateTimeFormatter.ofPattern("yyyyMMdd");
        DateTimeFormatter timeFmt = DateTimeFormatter.ofPattern("HHmmss");

        for (ScheduledSessionDTO s : plan.getSessions()) {
            if (s.getSessionDate() == null || s.getStartTime() == null) continue;

            String dtStart = s.getSessionDate().format(dateFmt) + "T" + s.getStartTime().format(timeFmt);
            String dtEnd = s.getSessionDate().format(dateFmt) + "T" + (s.getEndTime() != null ? s.getEndTime().format(timeFmt) : s.getStartTime().plusHours(1).format(timeFmt));

            ics.append("BEGIN:VEVENT\r\n");
            ics.append("UID:acadion-session-").append(s.getId()).append("@acadion.com\r\n");
            ics.append("DTSTAMP:").append(dtStart).append("Z\r\n");
            ics.append("DTSTART:").append(dtStart).append("\r\n");
            ics.append("DTEND:").append(dtEnd).append("\r\n");
            ics.append("SUMMARY:Session #").append(s.getSessionNumber()).append(": ").append(escapeIcal(s.getTopicTitle())).append("\r\n");

            StringBuilder desc = new StringBuilder();
            desc.append("Module ").append(s.getModuleNumber()).append(": ").append(s.getModuleTitle()).append("\\n");
            if (s.getSubtopic() != null) desc.append("Subtopic: ").append(s.getSubtopic()).append("\\n");
            if (s.getMilestoneTag() != null) desc.append("Target: ").append(s.getMilestoneTag()).append("\\n");
            desc.append("Objective: ").append(s.getTeachingObjective() != null ? s.getTeachingObjective() : "Curriculum Delivery");

            ics.append("DESCRIPTION:").append(escapeIcal(desc.toString())).append("\r\n");
            if (s.getRoomNumber() != null) {
                ics.append("LOCATION:Room ").append(escapeIcal(s.getRoomNumber())).append("\r\n");
            }
            ics.append("STATUS:CONFIRMED\r\n");
            ics.append("END:VEVENT\r\n");
        }

        ics.append("END:VCALENDAR\r\n");
        return ics.toString().getBytes(StandardCharsets.UTF_8);
    }

    public byte[] exportScheduleCsv(String classroomId, String userEmail) {
        SchedulePlanResponse plan = executionService.getActiveOrDraftPlan(classroomId, userEmail);
        if (plan == null || plan.getSessions().isEmpty()) {
            throw new IllegalStateException("No active schedule plan found to export");
        }

        StringBuilder csv = new StringBuilder();
        csv.append("Session Number,Date,Day of Week,Start Time,End Time,Module Number,Module Title,Topic Title,Subtopic,Milestone,Status,Room\r\n");

        for (ScheduledSessionDTO s : plan.getSessions()) {
            csv.append(s.getSessionNumber()).append(",")
                    .append(csvCell(s.getSessionDate() != null ? s.getSessionDate().toString() : "")).append(",")
                    .append(csvCell(s.getDayOfWeek() != null ? s.getDayOfWeek().toString() : "")).append(",")
                    .append(csvCell(s.getStartTime() != null ? s.getStartTime().toString() : "")).append(",")
                    .append(csvCell(s.getEndTime() != null ? s.getEndTime().toString() : "")).append(",")
                    .append(s.getModuleNumber()).append(",")
                    .append(csvCell(s.getModuleTitle())).append(",")
                    .append(csvCell(s.getTopicTitle())).append(",")
                    .append(csvCell(s.getSubtopic())).append(",")
                    .append(csvCell(s.getMilestoneTag())).append(",")
                    .append(csvCell(s.getStatus() != null ? s.getStatus().toString() : "SCHEDULED")).append(",")
                    .append(csvCell(s.getRoomNumber() != null ? s.getRoomNumber() : "Main"))
                    .append("\r\n");
        }

        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }

    private String escapeIcal(String text) {
        if (text == null) return "";
        return text.replace("\\", "\\\\")
                .replace(";", "\\;")
                .replace(",", "\\,")
                .replace("\n", "\\n");
    }

    private String csvCell(String text) {
        if (text == null) return "\"\"";
        return "\"" + text.replace("\"", "\"\"") + "\"";
    }
}
