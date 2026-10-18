package com.acadion.backend.service.scheduling;

import com.acadion.backend.dto.scheduling.GenerateScheduleRequest;
import com.acadion.backend.dto.scheduling.ModuleOutlineDTO;
import com.acadion.backend.dto.scheduling.SchedulePlanResponse;
import com.acadion.backend.dto.scheduling.ScheduledSessionDTO;
import com.acadion.backend.entity.Classroom;
import com.acadion.backend.entity.SyllabusItem;
import com.acadion.backend.entity.scheduling.*;
import com.acadion.backend.repository.ClassroomRepository;
import com.acadion.backend.repository.SyllabusItemRepository;
import com.acadion.backend.repository.scheduling.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class DeterministicScheduleGenerator {

    private final TimetableSlotRepository timetableSlotRepository;
    private final AcademicCalendarEventRepository calendarEventRepository;
    private final AssessmentMilestoneRepository milestoneRepository;
    private final ClassroomModuleOutlineRepository moduleOutlineRepository;
    private final TeachingSchedulePlanRepository planRepository;
    private final ScheduledSessionRepository sessionRepository;
    private final AcademicDocumentRepository documentRepository;
    private final ClassroomRepository classroomRepository;
    private final SyllabusItemRepository syllabusItemRepository;
    private final AcademicExtractionService extractionService;
    private final IntelligentSubtopicDecomposer subtopicDecomposer;

    public SchedulePlanResponse generateDraftSchedule(
            String classroomId,
            GenerateScheduleRequest request,
            String teacherEmail
    ) {
        Classroom classroom = classroomRepository.findById(classroomId)
                .orElseThrow(() -> new IllegalArgumentException("Classroom not found: " + classroomId));

        // Strict verification enforcement: Inputs must be verified before generation
        if (!classroom.isSchedulingInputsVerified()) {
            throw new IllegalStateException("Cannot generate schedule: Planning inputs have not been confirmed and verified by the teacher. Please review and verify all inputs in the Review workspace first.");
        }

        // 1. Fetch Approved/Verified Inputs
        List<TimetableSlot> slots = timetableSlotRepository.findByClassroomIdAndApprovedTrue(classroomId);
        if (slots.isEmpty()) {
            throw new IllegalStateException("Cannot generate schedule: No verified timetable slots exist. Please upload and verify your Class Timetable first.");
        }

        // Strict subject mapping check: Reject unresolved subject-code conflicts
        String slotCode = slots.get(0).getSubjectCode();
        AcademicDocument ttDoc = documentRepository.findByClassroomId(classroomId).stream()
                .filter(d -> d.getDocumentType() == AcademicDocumentType.TIMETABLE)
                .findFirst()
                .orElse(null);
        boolean isConfirmed = ttDoc != null && ttDoc.getExtractedSummary() != null && ttDoc.getExtractedSummary().contains("confirmed");
        if (!AcademicExtractionService.normalizeSubjectCode(slotCode).equals(AcademicExtractionService.normalizeSubjectCode(classroom.getSubjectCode())) && !isConfirmed) {
            throw new IllegalStateException(String.format("Cannot generate schedule: Unresolved subject code conflict. Timetable periods belong to '%s', but classroom is registered as '%s'. Teacher must confirm mapping first.", slotCode, classroom.getSubjectCode()));
        }

        List<AcademicCalendarEvent> events = calendarEventRepository.findByClassroomIdAndApprovedTrue(classroomId);
        if (events.isEmpty()) {
            throw new IllegalStateException("Cannot generate schedule: No verified academic calendar exists. Please upload and verify your Academic Calendar first.");
        }

        List<AssessmentMilestone> milestones = milestoneRepository.findByClassroomIdAndApprovedTrueOrderByStartDateAsc(classroomId);

        // Fetch verified module outlines strictly from official syllabus extraction
        List<ClassroomModuleOutline> moduleOutlines = moduleOutlineRepository.findByClassroomIdOrderByModuleNumberAsc(classroomId);
        if (moduleOutlines.isEmpty()) {
            throw new IllegalStateException("Cannot generate schedule: No verified official syllabus module hierarchy exists. Please upload and verify your Official Syllabus first.");
        }
        List<ModuleOutlineDTO> outlineDTOs = moduleOutlines.stream().map(extractionService::toModuleDTO).collect(Collectors.toList());

        // 2. Determine Date Bounds honestly from request or verified calendar events
        LocalDate startDate = request.getTermStartDate();
        LocalDate endDate = request.getTermEndDate();

        if (startDate == null) {
            startDate = events.stream()
                    .filter(e -> e.getEventType() != null && e.getEventType().equals("COLLEGE_EVENT") &&
                            (e.getEventName().toLowerCase().contains("commencement") || e.getEventName().toLowerCase().contains("start") || e.getEventName().toLowerCase().contains("open")))
                    .map(AcademicCalendarEvent::getStartDate)
                    .findFirst()
                    .orElse(events.stream().map(AcademicCalendarEvent::getStartDate).min(LocalDate::compareTo).orElse(LocalDate.now()));
        }

        if (endDate == null) {
            endDate = events.stream()
                    .filter(e -> e.getEventType() != null && e.getEventType().equals("COLLEGE_EVENT") &&
                            (e.getEventName().toLowerCase().contains("last working day") || e.getEventName().toLowerCase().contains("lwd") || e.getEventName().toLowerCase().contains("end")))
                    .map(AcademicCalendarEvent::getStartDate)
                    .findFirst()
                    .orElse(events.stream().map(e -> e.getEndDate() != null ? e.getEndDate() : e.getStartDate()).max(LocalDate::compareTo).orElse(startDate.plusMonths(4)));
        }

        if (endDate.isBefore(startDate)) {
            throw new IllegalArgumentException("Term end date cannot be before term start date");
        }

        // Past dates check: Do not pretend a past semester date is a new schedule unless explicitly replanning
        if (endDate.isBefore(LocalDate.now()) && !Boolean.TRUE.equals(request.getAllowPastDates())) {
            throw new IllegalArgumentException(String.format("The specified term dates (%s to %s) have already passed. Please select upcoming term dates or enable replanning.", startDate, endDate));
        }

        // 3. Build Non-Teaching Dates Map from calendar
        Set<LocalDate> nonTeachingDates = new HashSet<>();
        for (AcademicCalendarEvent ev : events) {
            if (!ev.isTeachingDay()) {
                LocalDate cur = ev.getStartDate();
                LocalDate evEnd = ev.getEndDate() != null ? ev.getEndDate() : ev.getStartDate();
                while (!cur.isAfter(evEnd)) {
                    nonTeachingDates.add(cur);
                    cur = cur.plusDays(1);
                }
            }
        }

        // 4. Map Timetable Slots by DayOfWeek
        Map<DayOfWeek, List<TimetableSlot>> slotMap = slots.stream()
                .collect(Collectors.groupingBy(TimetableSlot::getDayOfWeek));

        // 5. Expand Candidate Teaching Periods between startDate and endDate
        List<CandidateSlot> candidateSlots = new ArrayList<>();
        LocalDate curDate = startDate;
        while (!curDate.isAfter(endDate)) {
            if (!nonTeachingDates.contains(curDate)) {
                DayOfWeek dow = curDate.getDayOfWeek();
                if (slotMap.containsKey(dow)) {
                    List<TimetableSlot> daySlots = slotMap.get(dow);
                    daySlots.sort(Comparator.comparing(TimetableSlot::getStartTime));
                    for (TimetableSlot ts : daySlots) {
                        candidateSlots.add(new CandidateSlot(curDate, ts));
                    }
                }
            }
            curDate = curDate.plusDays(1);
        }

        // 6. Compile Topic Units & Sessions
        List<SyllabusItem> classroomSyllabusItems = syllabusItemRepository.findByClassroomIdOrderByOrderIndexAscCreatedAtAsc(classroomId);
        List<SessionTemplate> sessionTemplates = buildSessionTemplates(outlineDTOs, classroomSyllabusItems);

        // 7. Feasibility Evaluation
        int totalAvailablePeriods = candidateSlots.size();
        int totalRequiredSessions = sessionTemplates.size();

        String feasibilityStatus;
        StringBuilder feasibilityReport = new StringBuilder();

        if (totalAvailablePeriods >= totalRequiredSessions) {
            int surplus = totalAvailablePeriods - totalRequiredSessions;
            if (surplus <= 2) {
                feasibilityStatus = "TIGHT";
                feasibilityReport.append(String.format("Curriculum schedule is tightly fitted: %d available teaching periods for %d required pedagogy sessions (%d surplus buffer periods). Very little buffer remains for unexpected cancellations.",
                        totalAvailablePeriods, totalRequiredSessions, surplus));
            } else {
                feasibilityStatus = "FEASIBLE";
                feasibilityReport.append(String.format("Curriculum schedule is fully feasible: %d available teaching periods for %d required sessions. %d spare periods available for revision, lab buffer, and assessments.",
                        totalAvailablePeriods, totalRequiredSessions, surplus));
            }
        } else {
            feasibilityStatus = "INFEASIBLE";
            int deficit = totalRequiredSessions - totalAvailablePeriods;
            feasibilityReport.append(String.format("Warning: Curriculum schedule is infeasible under current constraints! Only %d teaching periods available between %s and %s, but %d pedagogy sessions are required (Deficit: %d hours). Recommend adding compensatory slots on working Saturdays or extending lecture periods.",
                    totalAvailablePeriods, startDate, endDate, totalRequiredSessions, deficit));
        }

        // 8. Determine Version Number for new Plan
        int nextVersion = planRepository.findByClassroomIdOrderByVersionNumberDesc(classroomId)
                .stream()
                .mapToInt(TeachingSchedulePlan::getVersionNumber)
                .max()
                .orElse(0) + 1;

        String planTitle = request.getPlanTitle() != null && !request.getPlanTitle().isBlank()
                ? request.getPlanTitle().trim()
                : String.format("Teaching Schedule v%d (%s - %s)", nextVersion, classroom.getSubjectCode(), classroom.getSubjectName());

        TeachingSchedulePlan plan = TeachingSchedulePlan.builder()
                .classroomId(classroomId)
                .versionNumber(nextVersion)
                .planTitle(planTitle)
                .status(SchedulePlanStatus.DRAFT)
                .termStartDate(startDate)
                .termEndDate(endDate)
                .totalPlannedSessions(Math.min(totalRequiredSessions, totalAvailablePeriods))
                .completedSessions(0)
                .skippedSessions(0)
                .feasibilityStatus(feasibilityStatus)
                .feasibilityReport(feasibilityReport.toString())
                .createdAt(LocalDateTime.now())
                .createdBy(teacherEmail)
                .build();

        TeachingSchedulePlan savedPlan = planRepository.save(plan);

        // 9. Allocate Sessions Deterministically
        List<ScheduledSession> scheduledSessions = new ArrayList<>();
        int sessionsToAllocate = Math.min(totalRequiredSessions, totalAvailablePeriods);

        for (int i = 0; i < sessionsToAllocate; i++) {
            CandidateSlot cs = candidateSlots.get(i);
            SessionTemplate st = sessionTemplates.get(i);

            String milestoneTag = determineMilestoneTag(cs.date, milestones);

            ScheduledSession session = ScheduledSession.builder()
                    .planId(savedPlan.getId())
                    .classroomId(classroomId)
                    .sessionNumber(i + 1)
                    .sessionDate(cs.date)
                    .dayOfWeek(cs.slot.getDayOfWeek())
                    .startTime(cs.slot.getStartTime())
                    .endTime(cs.slot.getEndTime())
                    .durationMinutes(cs.slot.getDurationMinutes())
                    .roomNumber(cs.slot.getRoomNumber())
                    .moduleNumber(st.moduleNumber)
                    .moduleTitle(st.moduleTitle)
                    .topicTitle(st.topicTitle)
                    .subtopic(st.subtopic)
                    .subtopicSource(st.subtopicSource)
                    .teachingObjective(st.teachingObjective)
                    .associatedDocumentId(st.associatedDocumentId)
                    .milestoneTag(milestoneTag)
                    .status(SessionStatus.SCHEDULED)
                    .isLocked(false)
                    .build();

            scheduledSessions.add(session);
        }

        List<ScheduledSession> savedSessions = sessionRepository.saveAll(scheduledSessions);
        log.info("Successfully generated draft teaching schedule plan v{} for classroom {} with {} sessions (feasibility: {})",
                nextVersion, classroomId, savedSessions.size(), feasibilityStatus);

        return toPlanResponse(savedPlan, savedSessions);
    }

    private String determineMilestoneTag(LocalDate date, List<AssessmentMilestone> milestones) {
        for (AssessmentMilestone m : milestones) {
            if (m.getStartDate() != null) {
                long daysDiff = java.time.temporal.ChronoUnit.DAYS.between(date, m.getStartDate());
                if (daysDiff >= 0 && daysDiff <= 3) {
                    return "Pre-" + m.getName() + " Review";
                }
            }
        }
        return null;
    }

    private List<SessionTemplate> buildSessionTemplates(List<ModuleOutlineDTO> outlines, List<SyllabusItem> syllabusItems) {
        List<SessionTemplate> list = new ArrayList<>();

        for (ModuleOutlineDTO mod : outlines) {
            List<IntelligentSubtopicDecomposer.SessionFocus> focuses = subtopicDecomposer.decomposeModule(mod, syllabusItems);
            for (IntelligentSubtopicDecomposer.SessionFocus focus : focuses) {
                list.add(new SessionTemplate(
                        focus.getModuleNumber(),
                        focus.getModuleTitle(),
                        focus.getTopicTitle(),
                        focus.getSubtopic(),
                        focus.getSubtopicSource(),
                        focus.getTeachingObjective(),
                        focus.getAssociatedDocumentId()
                ));
            }
        }

        return list;
    }

    private List<ModuleOutlineDTO> buildFromSyllabusItems(List<SyllabusItem> items) {
        Map<String, List<SyllabusItem>> unitMap = items.stream()
                .collect(Collectors.groupingBy(it -> it.getUnit() != null ? it.getUnit() : "Module 1"));

        List<ModuleOutlineDTO> outlines = new ArrayList<>();
        int modNum = 1;

        for (Map.Entry<String, List<SyllabusItem>> entry : unitMap.entrySet()) {
            List<String> topics = entry.getValue().stream().map(SyllabusItem::getTopic).collect(Collectors.toList());
            List<String> subtopics = entry.getValue().stream()
                    .filter(it -> it.getDescription() != null && !it.getDescription().isBlank())
                    .map(SyllabusItem::getDescription)
                    .collect(Collectors.toList());

            double totalHours = entry.getValue().stream()
                    .mapToDouble(it -> it.getEstimatedHours() != null ? it.getEstimatedHours() : 1.0)
                    .sum();

            outlines.add(ModuleOutlineDTO.builder()
                    .moduleNumber(modNum)
                    .moduleTitle(entry.getKey())
                    .estimatedHours(Math.max(1, (int) Math.round(totalHours)))
                    .topics(topics)
                    .subtopics(subtopics)
                    .build());
            modNum++;
        }
        return outlines;
    }

    public SchedulePlanResponse toPlanResponse(TeachingSchedulePlan plan, List<ScheduledSession> sessions) {
        return SchedulePlanResponse.builder()
                .planId(plan.getId())
                .classroomId(plan.getClassroomId())
                .versionNumber(plan.getVersionNumber())
                .planTitle(plan.getPlanTitle())
                .status(plan.getStatus())
                .termStartDate(plan.getTermStartDate())
                .termEndDate(plan.getTermEndDate())
                .totalPlannedSessions(plan.getTotalPlannedSessions())
                .completedSessions(plan.getCompletedSessions())
                .skippedSessions(plan.getSkippedSessions())
                .feasibilityStatus(plan.getFeasibilityStatus())
                .feasibilityReport(plan.getFeasibilityReport())
                .createdAt(plan.getCreatedAt())
                .approvedAt(plan.getApprovedAt())
                .publishedAt(plan.getPublishedAt())
                .createdBy(plan.getCreatedBy())
                .sessions(sessions.stream().map(this::toSessionDTO).collect(Collectors.toList()))
                .build();
    }

    public ScheduledSessionDTO toSessionDTO(ScheduledSession s) {
        return ScheduledSessionDTO.builder()
                .id(s.getId())
                .planId(s.getPlanId())
                .classroomId(s.getClassroomId())
                .sessionNumber(s.getSessionNumber())
                .sessionDate(s.getSessionDate())
                .dayOfWeek(s.getDayOfWeek())
                .startTime(s.getStartTime())
                .endTime(s.getEndTime())
                .durationMinutes(s.getDurationMinutes())
                .roomNumber(s.getRoomNumber())
                .moduleNumber(s.getModuleNumber())
                .moduleTitle(s.getModuleTitle())
                .topicId(s.getTopicId())
                .topicTitle(s.getTopicTitle())
                .subtopic(s.getSubtopic())
                .subtopicSource(s.getSubtopicSource())
                .teachingObjective(s.getTeachingObjective())
                .associatedDocumentId(s.getAssociatedDocumentId())
                .milestoneTag(s.getMilestoneTag())
                .status(s.getStatus())
                .actualOutcomeDate(s.getActualOutcomeDate())
                .teacherNotes(s.getTeacherNotes())
                .isLocked(s.isLocked())
                .build();
    }

    private static class CandidateSlot {
        LocalDate date;
        TimetableSlot slot;

        CandidateSlot(LocalDate date, TimetableSlot slot) {
            this.date = date;
            this.slot = slot;
        }
    }

    private static class SessionTemplate {
        int moduleNumber;
        String moduleTitle;
        String topicTitle;
        String subtopic;
        String subtopicSource;
        String teachingObjective;
        String associatedDocumentId;

        SessionTemplate(int moduleNumber, String moduleTitle, String topicTitle, String subtopic, String subtopicSource, String teachingObjective, String associatedDocumentId) {
            this.moduleNumber = moduleNumber;
            this.moduleTitle = moduleTitle;
            this.topicTitle = topicTitle;
            this.subtopic = subtopic;
            this.subtopicSource = subtopicSource;
            this.teachingObjective = teachingObjective;
            this.associatedDocumentId = associatedDocumentId;
        }
    }
}
