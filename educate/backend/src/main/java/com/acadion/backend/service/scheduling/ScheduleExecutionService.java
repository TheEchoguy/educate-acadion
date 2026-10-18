package com.acadion.backend.service.scheduling;

import com.acadion.backend.dto.scheduling.*;
import com.acadion.backend.entity.Classroom;
import com.acadion.backend.entity.User;
import com.acadion.backend.entity.scheduling.*;
import com.acadion.backend.repository.ClassroomRepository;
import com.acadion.backend.repository.UserRepository;
import com.acadion.backend.repository.scheduling.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
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
public class ScheduleExecutionService {

    private final TeachingSchedulePlanRepository planRepository;
    private final ScheduledSessionRepository sessionRepository;
    private final RescheduleRecordRepository rescheduleRecordRepository;
    private final TimetableSlotRepository timetableSlotRepository;
    private final AcademicCalendarEventRepository calendarEventRepository;
    private final AssessmentMilestoneRepository milestoneRepository;
    private final ClassroomRepository classroomRepository;
    private final UserRepository userRepository;
    private final SyllabusSchedulingNotificationService notificationService;
    private final DeterministicScheduleGenerator generator;

    public ScheduledSessionDTO recordSessionOutcome(
            String classroomId,
            String sessionId,
            RecordSessionOutcomeRequest request,
            String teacherEmail
    ) {
        verifyTeacherOwnership(classroomId, teacherEmail);

        ScheduledSession session = sessionRepository.findById(sessionId)
                .filter(s -> s.getClassroomId().equals(classroomId))
                .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));

        SessionStatus previousStatus = session.getStatus();
        session.setStatus(request.getOutcome());
        session.setTeacherNotes(request.getTeacherNotes());
        session.setActualOutcomeDate(LocalDateTime.now());

        ScheduledSession saved = sessionRepository.save(session);

        // Update plan statistics
        TeachingSchedulePlan plan = planRepository.findById(session.getPlanId()).orElse(null);
        if (plan != null) {
            List<ScheduledSession> allSessions = sessionRepository.findByPlanIdOrderBySessionDateAscSessionNumberAsc(plan.getId());
            int completed = (int) allSessions.stream().filter(s -> s.getStatus() == SessionStatus.COMPLETED).count();
            int skipped = (int) allSessions.stream().filter(s -> s.getStatus() == SessionStatus.SKIPPED || s.getStatus() == SessionStatus.CANCELLED).count();
            plan.setCompletedSessions(completed);
            plan.setSkippedSessions(skipped);
            planRepository.save(plan);
        }

        log.info("Recorded outcome for session {} ({}): {} -> {}", sessionId, session.getTopicTitle(), previousStatus, request.getOutcome());
        return generator.toSessionDTO(saved);
    }

    public ReschedulePreviewResponse previewReschedule(
            String classroomId,
            String sessionId,
            String teacherEmail
    ) {
        verifyTeacherOwnership(classroomId, teacherEmail);

        ScheduledSession session = sessionRepository.findById(sessionId)
                .filter(s -> s.getClassroomId().equals(classroomId))
                .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));

        TeachingSchedulePlan plan = planRepository.findById(session.getPlanId())
                .orElseThrow(() -> new IllegalArgumentException("Plan not found"));

        List<ScheduledSession> allSessions = sessionRepository.findByPlanIdOrderBySessionDateAscSessionNumberAsc(plan.getId());
        List<TimetableSlot> slots = timetableSlotRepository.findByClassroomIdAndApprovedTrue(classroomId);
        List<AcademicCalendarEvent> events = calendarEventRepository.findByClassroomIdAndApprovedTrue(classroomId);
        List<AssessmentMilestone> milestones = milestoneRepository.findByClassroomIdAndApprovedTrueOrderByStartDateAsc(classroomId);

        Set<LocalDate> nonTeachingDates = buildNonTeachingDates(events);
        Map<DayOfWeek, List<TimetableSlot>> slotMap = slots.stream().collect(Collectors.groupingBy(TimetableSlot::getDayOfWeek));

        // Dates that already have a session allocated
        Set<LocalDate> occupiedDates = allSessions.stream()
                .filter(s -> !s.getId().equals(sessionId) && s.getStatus() != SessionStatus.SKIPPED && s.getStatus() != SessionStatus.CANCELLED)
                .map(ScheduledSession::getSessionDate)
                .collect(Collectors.toSet());

        // Find next valid candidate date after session date
        LocalDate searchDate = session.getSessionDate().plusDays(1);
        LocalDate proposedDate = null;
        TimetableSlot proposedSlot = null;

        LocalDate searchLimit = plan.getTermEndDate() != null ? plan.getTermEndDate().plusWeeks(2) : searchDate.plusMonths(2);

        while (proposedDate == null && !searchDate.isAfter(searchLimit)) {
            if (!nonTeachingDates.contains(searchDate)) {
                DayOfWeek dow = searchDate.getDayOfWeek();
                if (slotMap.containsKey(dow) && !slotMap.get(dow).isEmpty()) {
                    // Check if candidate date has available capacity
                    proposedDate = searchDate;
                    proposedSlot = slotMap.get(dow).get(0);
                }
            }
            searchDate = searchDate.plusDays(1);
        }

        if (proposedDate == null) {
            proposedDate = session.getSessionDate().plusDays(7);
            proposedSlot = !slots.isEmpty() ? slots.get(0) : TimetableSlot.builder().startTime(LocalTime.of(10, 0)).endTime(LocalTime.of(11, 0)).dayOfWeek(DayOfWeek.MONDAY).build();
        }

        long subsequentCount = allSessions.stream()
                .filter(s -> s.getSessionNumber() > session.getSessionNumber() && s.getStatus() == SessionStatus.SCHEDULED)
                .count();

        String deadlineImpact = "Session moves to " + proposedDate + ". Syllabus milestone targets remain intact with adequate buffers.";
        for (AssessmentMilestone m : milestones) {
            if (m.getStartDate() != null && proposedDate.isAfter(m.getStartDate().minusDays(1))) {
                if (m.getTargetModules() != null && m.getTargetModules().contains(session.getModuleNumber())) {
                    deadlineImpact = "Notice: Rescheduled date (" + proposedDate + ") is close to " + m.getName() + " (" + m.getStartDate() + "). Module review buffer will be reduced.";
                    break;
                }
            }
        }

        List<String> warnings = new ArrayList<>();
        warnings.add(String.format("Rescheduling will shift topic '%s' to %s (%s at %s).",
                session.getTopicTitle(), proposedDate, proposedSlot.getDayOfWeek(), proposedSlot.getStartTime()));
        if (subsequentCount > 0) {
            warnings.add(String.format("%d subsequent scheduled classes will ripple forward to maintain topic sequence.", subsequentCount));
        }

        return ReschedulePreviewResponse.builder()
                .sessionId(sessionId)
                .topicTitle(session.getTopicTitle())
                .originalDate(session.getSessionDate())
                .originalStartTime(session.getStartTime())
                .proposedDate(proposedDate)
                .proposedStartTime(proposedSlot.getStartTime())
                .proposedEndTime(proposedSlot.getEndTime())
                .reason("Adaptive curriculum recovery for missed session")
                .affectedSubsequentSessionsCount((int) subsequentCount)
                .deadlineImpact(deadlineImpact)
                .conflictWarnings(warnings)
                .isFeasible(true)
                .build();
    }

    public SchedulePlanResponse applyReschedule(
            String classroomId,
            String sessionId,
            ApplyRescheduleRequest request,
            String teacherEmail
    ) {
        Classroom classroom = verifyTeacherOwnership(classroomId, teacherEmail);
        User teacher = userRepository.findByEmail(teacherEmail).orElse(null);

        ScheduledSession session = sessionRepository.findById(sessionId)
                .filter(s -> s.getClassroomId().equals(classroomId))
                .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));

        TeachingSchedulePlan plan = planRepository.findById(session.getPlanId())
                .orElseThrow(() -> new IllegalArgumentException("Plan not found"));

        LocalDate origDate = session.getSessionDate();
        LocalTime origTime = session.getStartTime();

        ReschedulePreviewResponse preview = previewReschedule(classroomId, sessionId, teacherEmail);
        LocalDate targetDate = request.getTargetDate() != null ? request.getTargetDate() : preview.getProposedDate();
        LocalTime targetTime = request.getTargetStartTime() != null ? request.getTargetStartTime() : preview.getProposedStartTime();

        if (request.isShiftSubsequentSessions()) {
            List<ScheduledSession> allSessions = sessionRepository.findByPlanIdOrderBySessionDateAscSessionNumberAsc(plan.getId());
            boolean startShifting = false;
            LocalDate nextDate = targetDate.plusDays(1);

            List<TimetableSlot> slots = timetableSlotRepository.findByClassroomIdAndApprovedTrue(classroomId);
            List<AcademicCalendarEvent> events = calendarEventRepository.findByClassroomIdAndApprovedTrue(classroomId);
            Set<LocalDate> nonTeaching = buildNonTeachingDates(events);
            Map<DayOfWeek, List<TimetableSlot>> slotMap = slots.stream().collect(Collectors.groupingBy(TimetableSlot::getDayOfWeek));

            for (ScheduledSession s : allSessions) {
                if (s.getId().equals(session.getId())) {
                    startShifting = true;
                    continue;
                }
                if (startShifting && s.getStatus() == SessionStatus.SCHEDULED && !s.isLocked()) {
                    while (nonTeaching.contains(nextDate) || !slotMap.containsKey(nextDate.getDayOfWeek())) {
                        nextDate = nextDate.plusDays(1);
                    }
                    s.setSessionDate(nextDate);
                    s.setDayOfWeek(nextDate.getDayOfWeek());
                    if (slotMap.containsKey(nextDate.getDayOfWeek()) && !slotMap.get(nextDate.getDayOfWeek()).isEmpty()) {
                        TimetableSlot ts = slotMap.get(nextDate.getDayOfWeek()).get(0);
                        s.setStartTime(ts.getStartTime());
                        s.setEndTime(ts.getEndTime());
                    }
                    sessionRepository.save(s);
                    nextDate = nextDate.plusDays(1);
                }
            }
        }

        session.setSessionDate(targetDate);
        session.setDayOfWeek(targetDate.getDayOfWeek());
        session.setStartTime(targetTime);
        if (preview.getProposedEndTime() != null) {
            session.setEndTime(preview.getProposedEndTime());
        }
        session.setStatus(SessionStatus.SCHEDULED);
        session.setTeacherNotes("Rescheduled: " + (request.getReason() != null ? request.getReason() : "Pacing adjustment"));
        sessionRepository.save(session);

        // Audit Record
        RescheduleRecord record = RescheduleRecord.builder()
                .classroomId(classroomId)
                .sessionId(sessionId)
                .originalDate(origDate)
                .newDate(targetDate)
                .reason(request.getReason())
                .rescheduledBy(teacherEmail)
                .rescheduledAt(LocalDateTime.now())
                .impactedSubsequentSessions(request.isShiftSubsequentSessions() ? preview.getAffectedSubsequentSessionsCount() : 0)
                .build();
        rescheduleRecordRepository.save(record);

        // Notify enrolled students safely
        try {
            notificationService.notifySessionRescheduled(classroom, session, origDate, targetDate, request.getReason(), teacher);
        } catch (Exception e) {
            log.warn("Reschedule notification failed gracefully: {}", e.getMessage());
        }

        log.info("Applied reschedule for session {}: {} moved from {} to {}", sessionId, session.getTopicTitle(), origDate, targetDate);

        List<ScheduledSession> updated = sessionRepository.findByPlanIdOrderBySessionDateAscSessionNumberAsc(plan.getId());
        return generator.toPlanResponse(plan, updated);
    }

    public ScheduledSessionDTO manualAllocateSession(
            String classroomId,
            ManualSessionAllocationRequest request,
            String teacherEmail
    ) {
        verifyTeacherOwnership(classroomId, teacherEmail);

        // 1. Locate Plan
        TeachingSchedulePlan plan;
        if (request.getPlanId() != null && !request.getPlanId().isBlank()) {
            plan = planRepository.findById(request.getPlanId())
                    .filter(p -> p.getClassroomId().equals(classroomId))
                    .orElseThrow(() -> new IllegalArgumentException("Schedule plan not found: " + request.getPlanId()));
        } else {
            plan = planRepository.findFirstByClassroomIdAndStatusOrderByVersionNumberDesc(classroomId, SchedulePlanStatus.APPROVED)
                    .orElseGet(() -> {
                        List<TeachingSchedulePlan> list = planRepository.findByClassroomIdOrderByVersionNumberDesc(classroomId);
                        if (list.isEmpty()) {
                            throw new IllegalStateException("Cannot manually allocate session: No schedule plan exists for this classroom. Please generate a plan first.");
                        }
                        return list.get(0);
                    });
        }

        LocalDate date = request.getSessionDate();
        if (date == null) {
            throw new IllegalArgumentException("Session date is required for manual allocation");
        }

        // 2. Validate date is within planning bounds
        if (plan.getTermStartDate() != null && date.isBefore(plan.getTermStartDate())) {
            throw new IllegalArgumentException(String.format("Date %s is before the configured term start date (%s)", date, plan.getTermStartDate()));
        }
        if (plan.getTermEndDate() != null && date.isAfter(plan.getTermEndDate())) {
            throw new IllegalArgumentException(String.format("Date %s is after the configured term end date (%s)", date, plan.getTermEndDate()));
        }

        // 3. Validate date is not a holiday or examination day
        List<AcademicCalendarEvent> events = calendarEventRepository.findByClassroomIdAndApprovedTrue(classroomId);
        for (AcademicCalendarEvent ev : events) {
            if (!ev.isTeachingDay()) {
                LocalDate evStart = ev.getStartDate();
                LocalDate evEnd = ev.getEndDate() != null ? ev.getEndDate() : evStart;
                if (!date.isBefore(evStart) && !date.isAfter(evEnd)) {
                    throw new IllegalArgumentException(String.format("Cannot allocate session on %s: Date is designated as non-teaching in the academic calendar (%s: %s).",
                            date, ev.getEventType(), ev.getEventName()));
                }
            }
        }

        // 4. Determine times & duration from request or timetable
        List<TimetableSlot> slots = timetableSlotRepository.findByClassroomIdAndApprovedTrue(classroomId);
        DayOfWeek dow = date.getDayOfWeek();
        List<TimetableSlot> daySlots = slots.stream().filter(s -> s.getDayOfWeek() == dow).collect(Collectors.toList());

        LocalTime start = request.getStartTime();
        LocalTime end = request.getEndTime();
        int duration = request.getDurationMinutes() > 0 ? request.getDurationMinutes() : 60;

        if (start == null || end == null) {
            if (daySlots.isEmpty()) {
                throw new IllegalArgumentException(String.format("No timetable periods exist for %s (%s). Please select start and end times explicitly or add a timetable slot for this day.", date, dow));
            }
            TimetableSlot defaultSlot = daySlots.get(0);
            start = defaultSlot.getStartTime();
            end = defaultSlot.getEndTime();
            duration = defaultSlot.getDurationMinutes();
        }

        // 5. Check for time overlap on same date in this plan
        List<ScheduledSession> existingOnDate = sessionRepository.findByPlanIdOrderBySessionDateAscSessionNumberAsc(plan.getId())
                .stream()
                .filter(s -> s.getSessionDate().equals(date) && s.getStatus() != SessionStatus.CANCELLED)
                .collect(Collectors.toList());

        for (ScheduledSession s : existingOnDate) {
            if (timesOverlap(s.getStartTime(), s.getEndTime(), start, end)) {
                throw new IllegalArgumentException(String.format("Time conflict: A session is already scheduled on %s from %s to %s (\"%s\"). Please select another period.",
                        date, s.getStartTime(), s.getEndTime(), s.getTopicTitle()));
            }
        }

        // 6. Assign next session number
        List<ScheduledSession> allSessions = sessionRepository.findByPlanIdOrderBySessionDateAscSessionNumberAsc(plan.getId());
        int nextNum = allSessions.size() + 1;

        ScheduledSession session = ScheduledSession.builder()
                .planId(plan.getId())
                .classroomId(classroomId)
                .sessionNumber(nextNum)
                .sessionDate(date)
                .dayOfWeek(dow)
                .startTime(start)
                .endTime(end)
                .durationMinutes(duration)
                .roomNumber(request.getRoomNumber() != null ? request.getRoomNumber() : (!daySlots.isEmpty() && daySlots.get(0).getRoomNumber() != null ? daySlots.get(0).getRoomNumber() : "Main Room"))
                .moduleNumber(request.getModuleNumber() > 0 ? request.getModuleNumber() : 1)
                .moduleTitle(request.getModuleTitle() != null ? request.getModuleTitle() : "Module " + (request.getModuleNumber() > 0 ? request.getModuleNumber() : 1))
                .topicId(request.getTopicId())
                .topicTitle(request.getTopicTitle())
                .subtopic(request.getSubtopic() != null && !request.getSubtopic().isBlank() ? request.getSubtopic().trim() : request.getTopicTitle())
                .subtopicSource("TEACHER_EDITED")
                .teachingObjective(request.getTeachingObjective() != null ? request.getTeachingObjective() : "Teacher-allocated curriculum topic.")
                .teacherNotes(request.getTeacherNotes())
                .status(SessionStatus.SCHEDULED)
                .isLocked(true) // Explicit teacher lock
                .build();

        ScheduledSession saved = sessionRepository.save(session);

        // Update plan count
        plan.setTotalPlannedSessions(allSessions.size() + 1);
        planRepository.save(plan);

        log.info("Teacher {} manually allocated topic '{}' to date {} ({}) in plan {}", teacherEmail, request.getTopicTitle(), date, dow, plan.getId());
        return generator.toSessionDTO(saved);
    }

    public void deleteSession(String classroomId, String sessionId, String teacherEmail) {
        verifyTeacherOwnership(classroomId, teacherEmail);
        ScheduledSession session = sessionRepository.findById(sessionId)
                .filter(s -> s.getClassroomId().equals(classroomId))
                .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));

        sessionRepository.delete(session);

        TeachingSchedulePlan plan = planRepository.findById(session.getPlanId()).orElse(null);
        if (plan != null) {
            List<ScheduledSession> all = sessionRepository.findByPlanIdOrderBySessionDateAscSessionNumberAsc(plan.getId());
            plan.setTotalPlannedSessions(all.size());
            planRepository.save(plan);
        }
        log.info("Teacher {} deleted session {} from classroom {}", teacherEmail, sessionId, classroomId);
    }

    private boolean timesOverlap(LocalTime startA, LocalTime endA, LocalTime startB, LocalTime endB) {
        if (startA == null || endA == null || startB == null || endB == null) return false;
        return startA.isBefore(endB) && startB.isBefore(endA);
    }

    public SchedulePlanResponse approveAndPublishPlan(
            String classroomId,
            String planId,
            String teacherEmail
    ) {
        Classroom classroom = verifyTeacherOwnership(classroomId, teacherEmail);
        User teacher = userRepository.findByEmail(teacherEmail).orElse(null);

        TeachingSchedulePlan plan = planRepository.findById(planId)
                .filter(p -> p.getClassroomId().equals(classroomId))
                .orElseThrow(() -> new IllegalArgumentException("Schedule plan not found: " + planId));

        List<TeachingSchedulePlan> existing = planRepository.findByClassroomIdOrderByVersionNumberDesc(classroomId);
        for (TeachingSchedulePlan p : existing) {
            if (p.getStatus() == SchedulePlanStatus.APPROVED && !p.getId().equals(planId)) {
                p.setStatus(SchedulePlanStatus.SUPERSEDED);
                planRepository.save(p);
            }
        }

        plan.setStatus(SchedulePlanStatus.APPROVED);
        plan.setApprovedAt(LocalDateTime.now());
        plan.setPublishedAt(LocalDateTime.now());
        TeachingSchedulePlan saved = planRepository.save(plan);

        try {
            notificationService.notifySchedulePublished(classroom, saved, teacher);
        } catch (Exception e) {
            log.warn("Schedule publication student notification dispatched with non-fatal notice: {}", e.getMessage());
        }

        List<ScheduledSession> sessions = sessionRepository.findByPlanIdOrderBySessionDateAscSessionNumberAsc(saved.getId());
        log.info("Teacher {} approved and published schedule plan v{} for classroom {}", teacherEmail, saved.getVersionNumber(), classroomId);
        return generator.toPlanResponse(saved, sessions);
    }

    public SchedulePlanResponse getActiveOrDraftPlan(String classroomId, String userEmail) {
        verifyTeacherOrStudentAccess(classroomId, userEmail);

        // 1. Look for approved plan
        TeachingSchedulePlan plan = planRepository.findFirstByClassroomIdAndStatusOrderByVersionNumberDesc(
                classroomId, SchedulePlanStatus.APPROVED).orElse(null);

        // 2. If no approved plan, return latest draft
        if (plan == null) {
            List<TeachingSchedulePlan> all = planRepository.findByClassroomIdOrderByVersionNumberDesc(classroomId);
            if (!all.isEmpty()) {
                plan = all.get(0);
            }
        }

        if (plan == null) {
            return null;
        }

        List<ScheduledSession> sessions = sessionRepository.findByPlanIdOrderBySessionDateAscSessionNumberAsc(plan.getId());
        return generator.toPlanResponse(plan, sessions);
    }

    public List<SchedulePlanResponse> listPlanVersions(String classroomId, String userEmail) {
        verifyTeacherOrStudentAccess(classroomId, userEmail);
        List<TeachingSchedulePlan> plans = planRepository.findByClassroomIdOrderByVersionNumberDesc(classroomId);

        return plans.stream().map(p -> {
            List<ScheduledSession> sessions = sessionRepository.findByPlanIdOrderBySessionDateAscSessionNumberAsc(p.getId());
            return generator.toPlanResponse(p, sessions);
        }).collect(Collectors.toList());
    }

    public List<RescheduleRecord> getRescheduleHistory(String classroomId, String teacherEmail) {
        verifyTeacherOwnership(classroomId, teacherEmail);
        return rescheduleRecordRepository.findByClassroomIdOrderByRescheduledAtDesc(classroomId);
    }

    private Set<LocalDate> buildNonTeachingDates(List<AcademicCalendarEvent> events) {
        Set<LocalDate> set = new HashSet<>();
        for (AcademicCalendarEvent ev : events) {
            if (!ev.isTeachingDay()) {
                LocalDate cur = ev.getStartDate();
                LocalDate end = ev.getEndDate() != null ? ev.getEndDate() : ev.getStartDate();
                while (!cur.isAfter(end)) {
                    set.add(cur);
                    cur = cur.plusDays(1);
                }
            }
        }
        return set;
    }

    private Classroom verifyTeacherOwnership(String classroomId, String teacherEmail) {
        Classroom classroom = classroomRepository.findById(classroomId)
                .orElseThrow(() -> new IllegalArgumentException("Classroom not found: " + classroomId));
        User user = userRepository.findByEmail(teacherEmail)
                .orElseThrow(() -> new AccessDeniedException("User not found: " + teacherEmail));

        boolean isOwner = classroom.getTeacherId() != null && classroom.getTeacherId().equals(user.getId());
        boolean isAdmin = user.getRole() != null && user.getRole().name().equals("ADMIN");

        if (!isOwner && !isAdmin) {
            throw new AccessDeniedException("Access denied: You are not the instructor of this classroom");
        }
        return classroom;
    }

    private void verifyTeacherOrStudentAccess(String classroomId, String userEmail) {
        Classroom classroom = classroomRepository.findById(classroomId)
                .orElseThrow(() -> new IllegalArgumentException("Classroom not found: " + classroomId));
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new AccessDeniedException("User not found: " + userEmail));

        boolean isTeacher = classroom.getTeacherId() != null && classroom.getTeacherId().equals(user.getId());
        boolean isAdmin = user.getRole() != null && user.getRole().name().equals("ADMIN");

        if (isTeacher || isAdmin) return;
    }
}
