package com.acadion.backend.service.scheduling;

import com.acadion.backend.dto.scheduling.*;
import com.acadion.backend.entity.Classroom;
import com.acadion.backend.entity.User;
import com.acadion.backend.entity.scheduling.*;
import com.acadion.backend.repository.ClassroomRepository;
import com.acadion.backend.repository.UserRepository;
import com.acadion.backend.repository.SyllabusItemRepository;
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
    private final SyllabusItemRepository syllabusItemRepository;
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
        if (request.getPortionsCovered() != null && !request.getPortionsCovered().isBlank()) {
            session.setPortionsCovered(request.getPortionsCovered().trim());
        }
        if (request.getRemainingPortion() != null && !request.getRemainingPortion().isBlank()) {
            session.setRemainingPortion(request.getRemainingPortion().trim());
        }

        TeachingSchedulePlan plan = planRepository.findById(session.getPlanId()).orElse(null);

        // Carry-Forward Workflow for PARTIALLY_COMPLETED sessions
        if (request.getOutcome() == SessionStatus.PARTIALLY_COMPLETED && plan != null) {
            String remPortion = request.getRemainingPortion() != null && !request.getRemainingPortion().isBlank()
                    ? request.getRemainingPortion().trim()
                    : "Continuation of " + (session.getSubtopic() != null ? session.getSubtopic() : session.getTopicTitle());
            session.setRemainingPortion(remPortion);

            List<ScheduledSession> allSessions = sessionRepository.findByPlanIdOrderBySessionDateAscSessionNumberAsc(plan.getId());
            ScheduledSession nextSession = allSessions.stream()
                    .filter(s -> s.getSessionNumber() > session.getSessionNumber() && s.getStatus() == SessionStatus.SCHEDULED)
                    .findFirst()
                    .orElse(null);

            if (nextSession != null) {
                session.setCarriedForwardToSessionNumber(nextSession.getSessionNumber());

                // Move unfinished content to the immediately next scheduled class period
                nextSession.setCarriedForwardFromSessionNumber(session.getSessionNumber());
                nextSession.setCarriedForward(true);
                nextSession.setTopicTitle(session.getTopicTitle());
                nextSession.setTopicId(session.getTopicId());
                nextSession.setModuleNumber(session.getModuleNumber());
                nextSession.setModuleTitle(session.getModuleTitle());
                nextSession.setSubtopic(String.format("[Carried forward from Session #%d]: %s", session.getSessionNumber(), remPortion));
                nextSession.setMilestoneTag("Carried Forward");
                sessionRepository.save(nextSession);

                // Cascade subsequent sessions to maintain syllabus order without inventing extra timetable slots
                List<TimetableSlot> slots = timetableSlotRepository.findByClassroomIdAndApprovedTrue(classroomId);
                List<AcademicCalendarEvent> events = calendarEventRepository.findByClassroomIdAndApprovedTrue(classroomId);
                Set<LocalDate> nonTeaching = buildNonTeachingDates(events);
                Map<DayOfWeek, List<TimetableSlot>> slotMap = slots.stream().collect(Collectors.groupingBy(TimetableSlot::getDayOfWeek));

                LocalDate nextSlotDate = nextSession.getSessionDate().plusDays(1);
                boolean startCascade = false;
                for (ScheduledSession s : allSessions) {
                    if (s.getId().equals(nextSession.getId())) {
                        startCascade = true;
                        continue;
                    }
                    if (startCascade && s.getStatus() == SessionStatus.SCHEDULED && !s.isLocked()) {
                        while (nonTeaching.contains(nextSlotDate) || !slotMap.containsKey(nextSlotDate.getDayOfWeek()) || slotMap.get(nextSlotDate.getDayOfWeek()).isEmpty()) {
                            nextSlotDate = nextSlotDate.plusDays(1);
                        }
                        s.setSessionDate(nextSlotDate);
                        s.setDayOfWeek(nextSlotDate.getDayOfWeek());
                        TimetableSlot ts = slotMap.get(nextSlotDate.getDayOfWeek()).get(0);
                        s.setStartTime(ts.getStartTime());
                        s.setEndTime(ts.getEndTime());
                        if (plan.getTermEndDate() != null && nextSlotDate.isAfter(plan.getTermEndDate())) {
                            s.setMilestoneTag("⚠️ At Risk: Exceeds term deadline");
                        }
                        sessionRepository.save(s);
                        nextSlotDate = nextSlotDate.plusDays(1);
                    }
                }
            } else {
                session.setTeacherNotes((session.getTeacherNotes() != null ? session.getTeacherNotes() + " | " : "") +
                        "Notice: No subsequent scheduled period available in current term to carry forward remaining content. Compensatory period required.");
            }
        }

        ScheduledSession saved = sessionRepository.save(session);

        // Update plan statistics
        if (plan != null) {
            List<ScheduledSession> allSessions = sessionRepository.findByPlanIdOrderBySessionDateAscSessionNumberAsc(plan.getId());
            int completed = (int) allSessions.stream().filter(s -> s.getStatus() == SessionStatus.COMPLETED).count();
            int skipped = (int) allSessions.stream().filter(s -> s.getStatus() == SessionStatus.SKIPPED || s.getStatus() == SessionStatus.CANCELLED).count();
            plan.setCompletedSessions(completed);
            plan.setSkippedSessions(skipped);
            planRepository.save(plan);
        }

        // Synchronize canonical topic-level progress in SyllabusItem
        if (session.getTopicId() != null) {
            syllabusItemRepository.findById(session.getTopicId()).ifPresent(topicItem -> {
                List<ScheduledSession> topicSessions = sessionRepository.findByPlanIdOrderBySessionDateAscSessionNumberAsc(session.getPlanId())
                        .stream().filter(s -> session.getTopicId().equals(s.getTopicId())).toList();

                if (request.getOutcome() == SessionStatus.COMPLETED) {
                    boolean allDone = !topicSessions.isEmpty() && topicSessions.stream().allMatch(s -> s.getStatus() == SessionStatus.COMPLETED);
                    if (allDone) {
                        topicItem.setStatus(com.acadion.backend.entity.SyllabusStatus.COMPLETED);
                        topicItem.setActualCompletionDate(LocalDate.now());
                    } else {
                        topicItem.setStatus(com.acadion.backend.entity.SyllabusStatus.IN_PROGRESS);
                    }
                } else if (request.getOutcome() == SessionStatus.PARTIALLY_COMPLETED) {
                    topicItem.setStatus(com.acadion.backend.entity.SyllabusStatus.PARTIALLY_COMPLETED);
                } else {
                    boolean anyDone = topicSessions.stream().anyMatch(s -> s.getStatus() == SessionStatus.COMPLETED);
                    boolean anyPart = topicSessions.stream().anyMatch(s -> s.getStatus() == SessionStatus.PARTIALLY_COMPLETED);
                    if (anyPart) {
                        topicItem.setStatus(com.acadion.backend.entity.SyllabusStatus.PARTIALLY_COMPLETED);
                    } else if (anyDone) {
                        topicItem.setStatus(com.acadion.backend.entity.SyllabusStatus.IN_PROGRESS);
                    } else {
                        topicItem.setStatus(com.acadion.backend.entity.SyllabusStatus.NOT_STARTED);
                    }
                }
                topicItem.setUpdatedAt(LocalDateTime.now());
                syllabusItemRepository.save(topicItem);
            });
        }

        log.info("Recorded outcome for session {} ({}): {} -> {}", sessionId, session.getTopicTitle(), previousStatus, request.getOutcome());
        return generator.toSessionDTO(saved);
    }

    public ReschedulePreviewResponse previewReschedule(
            String classroomId,
            String sessionId,
            String teacherEmail
    ) {
        return previewReschedule(classroomId, sessionId, null, teacherEmail);
    }

    public ReschedulePreviewResponse previewReschedule(
            String classroomId,
            String sessionId,
            ReschedulePreviewRequest request,
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

        // Find candidate default slot if request doesn't specify one
        LocalDate autoDate = null;
        TimetableSlot autoSlot = null;
        LocalDate searchDate = session.getSessionDate() != null ? session.getSessionDate().plusDays(1) : LocalDate.now().plusDays(1);
        LocalDate searchLimit = plan.getTermEndDate() != null ? plan.getTermEndDate().plusWeeks(2) : searchDate.plusMonths(2);

        while (autoDate == null && !searchDate.isAfter(searchLimit)) {
            if (!nonTeachingDates.contains(searchDate)) {
                DayOfWeek dow = searchDate.getDayOfWeek();
                if (slotMap.containsKey(dow) && !slotMap.get(dow).isEmpty()) {
                    autoDate = searchDate;
                    autoSlot = slotMap.get(dow).get(0);
                }
            }
            searchDate = searchDate.plusDays(1);
        }

        if (autoDate == null) {
            autoDate = session.getSessionDate() != null ? session.getSessionDate().plusDays(7) : LocalDate.now().plusDays(7);
            autoSlot = !slots.isEmpty() ? slots.get(0) : TimetableSlot.builder().startTime(LocalTime.of(10, 0)).endTime(LocalTime.of(11, 0)).dayOfWeek(DayOfWeek.MONDAY).build();
        }

        LocalDate proposedDate = (request != null && request.getTargetDate() != null) ? request.getTargetDate() : autoDate;
        LocalTime proposedStartTime;
        if (request != null && request.getTargetStartTime() != null) {
            proposedStartTime = request.getTargetStartTime();
        } else {
            DayOfWeek pdow = proposedDate.getDayOfWeek();
            if (slotMap.containsKey(pdow) && !slotMap.get(pdow).isEmpty()) {
                proposedStartTime = slotMap.get(pdow).get(0).getStartTime();
            } else {
                proposedStartTime = autoSlot.getStartTime();
            }
        }

        LocalTime proposedEndTime;
        if (request != null && request.getTargetEndTime() != null) {
            proposedEndTime = request.getTargetEndTime();
        } else if (request != null && request.getDurationMinutes() != null && request.getDurationMinutes() > 0) {
            proposedEndTime = proposedStartTime.plusMinutes(request.getDurationMinutes());
        } else {
            DayOfWeek pdow = proposedDate.getDayOfWeek();
            if (slotMap.containsKey(pdow) && !slotMap.get(pdow).isEmpty()) {
                proposedEndTime = slotMap.get(pdow).get(0).getEndTime();
            } else if (session.getDurationMinutes() > 0) {
                proposedEndTime = proposedStartTime.plusMinutes(session.getDurationMinutes());
            } else {
                proposedEndTime = autoSlot.getEndTime();
            }
        }

        String roomNumber = (request != null && request.getRoomNumber() != null && !request.getRoomNumber().isBlank())
                ? request.getRoomNumber()
                : (session.getRoomNumber() != null ? session.getRoomNumber() : "Main");

        boolean shiftSubsequent = (request == null || request.isShiftSubsequentSessions());

        // Validations
        List<String> warnings = new ArrayList<>();
        boolean isOutsideTerm = false;
        if (plan.getTermStartDate() != null && proposedDate.isBefore(plan.getTermStartDate())) {
            isOutsideTerm = true;
            warnings.add("Proposed date " + proposedDate + " is before the term start (" + plan.getTermStartDate() + ").");
        }
        if (plan.getTermEndDate() != null && proposedDate.isAfter(plan.getTermEndDate())) {
            isOutsideTerm = true;
            warnings.add("Proposed date " + proposedDate + " is after the term end (" + plan.getTermEndDate() + ").");
        }

        boolean isNonTeaching = nonTeachingDates.contains(proposedDate);
        if (isNonTeaching) {
            warnings.add("Notice: Proposed date " + proposedDate + " falls on a designated holiday or non-teaching period.");
        }

        boolean hasSlot = slotMap.containsKey(proposedDate.getDayOfWeek()) && !slotMap.get(proposedDate.getDayOfWeek()).isEmpty();
        if (!hasSlot) {
            warnings.add("Warning: No regular approved timetable slot configured on " + proposedDate.getDayOfWeek() + ".");
        }

        boolean hasTimeConflict = allSessions.stream()
                .filter(s -> !s.getId().equals(sessionId) && s.getSessionDate() != null && s.getSessionDate().equals(proposedDate)
                        && s.getStatus() != SessionStatus.SKIPPED && s.getStatus() != SessionStatus.CANCELLED)
                .anyMatch(s -> {
                    if (s.getStartTime() == null || s.getEndTime() == null) return false;
                    return !(proposedEndTime.compareTo(s.getStartTime()) <= 0 || proposedStartTime.compareTo(s.getEndTime()) >= 0);
                });

        if (hasTimeConflict) {
            warnings.add("Time conflict: Another active session overlaps with " + proposedStartTime + " - " + proposedEndTime + " on " + proposedDate + ".");
        }

        // Simulate subsequent cascade preview
        List<ReschedulePreviewResponse.AffectedSessionDetail> cascadePreview = new ArrayList<>();
        if (shiftSubsequent) {
            LocalDate cascadeCursor = proposedDate.plusDays(1);
            for (ScheduledSession s : allSessions) {
                if (s.getSessionNumber() > session.getSessionNumber() && s.getStatus() == SessionStatus.SCHEDULED && !s.isLocked()) {
                    while (nonTeachingDates.contains(cascadeCursor) || !slotMap.containsKey(cascadeCursor.getDayOfWeek())) {
                        cascadeCursor = cascadeCursor.plusDays(1);
                        if (plan.getTermEndDate() != null && cascadeCursor.isAfter(plan.getTermEndDate().plusMonths(2))) {
                            break;
                        }
                    }
                    DayOfWeek dow = cascadeCursor.getDayOfWeek();
                    TimetableSlot ts = (slotMap.containsKey(dow) && !slotMap.get(dow).isEmpty())
                            ? slotMap.get(dow).get(0)
                            : autoSlot;

                    cascadePreview.add(ReschedulePreviewResponse.AffectedSessionDetail.builder()
                            .sessionNumber(s.getSessionNumber())
                            .topicTitle(s.getTopicTitle())
                            .originalDate(s.getSessionDate())
                            .newDate(cascadeCursor)
                            .newStartTime(ts.getStartTime())
                            .newEndTime(ts.getEndTime())
                            .reason("Shifted forward to preserve syllabus topic order")
                            .build());

                    cascadeCursor = cascadeCursor.plusDays(1);
                }
            }
        }

        String deadlineImpact = "Syllabus sequence preserved. All milestone targets remain on schedule.";
        for (AssessmentMilestone m : milestones) {
            if (m.getStartDate() != null) {
                if (proposedDate.isAfter(m.getStartDate().minusDays(1)) && m.getTargetModules() != null && m.getTargetModules().contains(session.getModuleNumber())) {
                    deadlineImpact = "Notice: Rescheduled date (" + proposedDate + ") is within milestone window for " + m.getName() + " (" + m.getStartDate() + ").";
                    break;
                }
                for (ReschedulePreviewResponse.AffectedSessionDetail affected : cascadePreview) {
                    if (affected.getNewDate() != null && affected.getNewDate().isAfter(m.getStartDate().minusDays(1))) {
                        deadlineImpact = "Notice: Cascaded session #" + affected.getSessionNumber() + " (" + affected.getTopicTitle() + ") approaches milestone " + m.getName() + " (" + m.getStartDate() + ").";
                        break;
                    }
                }
            }
        }

        boolean isFeasible = !isOutsideTerm && !hasTimeConflict;

        return ReschedulePreviewResponse.builder()
                .sessionId(sessionId)
                .topicTitle(session.getTopicTitle())
                .originalDate(session.getSessionDate())
                .originalStartTime(session.getStartTime())
                .proposedDate(proposedDate)
                .proposedStartTime(proposedStartTime)
                .proposedEndTime(proposedEndTime)
                .roomNumber(roomNumber)
                .proposedDayOfWeek(proposedDate.getDayOfWeek().name())
                .reason(request != null && request.getTargetDate() != null ? "Teacher customized reschedule" : "Adaptive curriculum recovery for missed session")
                .affectedSubsequentSessionsCount(cascadePreview.size())
                .deadlineImpact(deadlineImpact)
                .conflictWarnings(warnings)
                .isFeasible(isFeasible)
                .isOutsideTerm(isOutsideTerm)
                .hasConflict(hasTimeConflict)
                .affectedSessionsPreview(cascadePreview)
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

        ReschedulePreviewResponse preview = previewReschedule(classroomId, sessionId, request != null ? ReschedulePreviewRequest.builder()
                .targetDate(request.getTargetDate())
                .targetStartTime(request.getTargetStartTime())
                .targetEndTime(request.getTargetEndTime())
                .durationMinutes(request.getDurationMinutes())
                .roomNumber(request.getRoomNumber())
                .shiftSubsequentSessions(request.isShiftSubsequentSessions())
                .build() : null, teacherEmail);

        LocalDate targetDate = request.getTargetDate() != null ? request.getTargetDate() : preview.getProposedDate();
        LocalTime targetTime = request.getTargetStartTime() != null ? request.getTargetStartTime() : preview.getProposedStartTime();
        LocalTime targetEndTime = request.getTargetEndTime() != null ? request.getTargetEndTime() : preview.getProposedEndTime();
        String roomNumber = (request.getRoomNumber() != null && !request.getRoomNumber().isBlank()) ? request.getRoomNumber() : preview.getRoomNumber();

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
                    if (s.getTopicId() != null) {
                        final LocalDate shiftedDate = nextDate;
                        syllabusItemRepository.findById(s.getTopicId()).ifPresent(item -> {
                            item.setPlannedTeachingDate(shiftedDate);
                            syllabusItemRepository.save(item);
                        });
                    }
                    nextDate = nextDate.plusDays(1);
                }
            }
        }

        session.setSessionDate(targetDate);
        session.setDayOfWeek(targetDate.getDayOfWeek());
        session.setStartTime(targetTime);
        if (targetEndTime != null) {
            session.setEndTime(targetEndTime);
        }
        if (roomNumber != null) {
            session.setRoomNumber(roomNumber);
        }
        session.setStatus(SessionStatus.SCHEDULED);
        session.setTeacherNotes("Rescheduled: " + (request.getReason() != null ? request.getReason() : "Pacing adjustment"));
        sessionRepository.save(session);

        if (session.getTopicId() != null) {
            syllabusItemRepository.findById(session.getTopicId()).ifPresent(item -> {
                item.setPlannedTeachingDate(targetDate);
                syllabusItemRepository.save(item);
            });
        }

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

    public SchedulePlanResponse getPlanById(String classroomId, String planId, String userEmail) {
        verifyTeacherOrStudentAccess(classroomId, userEmail);
        TeachingSchedulePlan plan = planRepository.findById(planId)
                .filter(p -> p.getClassroomId().equals(classroomId))
                .orElseThrow(() -> new IllegalArgumentException("Schedule plan not found: " + planId));
        List<ScheduledSession> sessions = sessionRepository.findByPlanIdOrderBySessionDateAscSessionNumberAsc(plan.getId());
        return generator.toPlanResponse(plan, sessions);
    }

    public SchedulePlanResponse getActiveOrDraftPlan(String classroomId, String userEmail) {
        return getActiveOrDraftPlan(classroomId, null, userEmail);
    }

    public SchedulePlanResponse getActiveOrDraftPlan(String classroomId, String requestedPlanId, String userEmail) {
        verifyTeacherOrStudentAccess(classroomId, userEmail);

        if (requestedPlanId != null && !requestedPlanId.isBlank()) {
            Optional<TeachingSchedulePlan> requested = planRepository.findById(requestedPlanId)
                    .filter(p -> p.getClassroomId().equals(classroomId));
            if (requested.isPresent()) {
                TeachingSchedulePlan p = requested.get();
                List<ScheduledSession> sessions = sessionRepository.findByPlanIdOrderBySessionDateAscSessionNumberAsc(p.getId());
                return generator.toPlanResponse(p, sessions);
            }
        }

        // Determine whether user is teacher/admin or student
        Classroom classroom = classroomRepository.findById(classroomId).orElse(null);
        User user = userRepository.findByEmail(userEmail).orElse(null);
        boolean isTeacherOrAdmin = false;
        if (classroom != null && user != null) {
            isTeacherOrAdmin = (classroom.getTeacherId() != null &&
                    (classroom.getTeacherId().equals(user.getId()) || classroom.getTeacherId().equalsIgnoreCase(user.getEmail())))
                    || (user.getRole() != null && "ADMIN".equalsIgnoreCase(user.getRole().name()));
        }

        TeachingSchedulePlan plan = null;
        if (isTeacherOrAdmin) {
            // For teachers, prefer the latest draft plan if one exists (or latest overall)
            TeachingSchedulePlan draftPlan = planRepository.findFirstByClassroomIdAndStatusOrderByVersionNumberDesc(
                    classroomId, SchedulePlanStatus.DRAFT).orElse(null);
            TeachingSchedulePlan approvedPlan = planRepository.findFirstByClassroomIdAndStatusOrderByVersionNumberDesc(
                    classroomId, SchedulePlanStatus.APPROVED).orElse(null);

            if (draftPlan != null && (approvedPlan == null || draftPlan.getVersionNumber() >= approvedPlan.getVersionNumber())) {
                plan = draftPlan;
            } else if (approvedPlan != null) {
                plan = approvedPlan;
            } else {
                List<TeachingSchedulePlan> all = planRepository.findByClassroomIdOrderByVersionNumberDesc(classroomId);
                if (!all.isEmpty()) {
                    plan = all.get(0);
                }
            }
        } else {
            // For students, prioritize the approved published plan
            plan = planRepository.findFirstByClassroomIdAndStatusOrderByVersionNumberDesc(
                    classroomId, SchedulePlanStatus.APPROVED).orElse(null);
            if (plan == null) {
                List<TeachingSchedulePlan> all = planRepository.findByClassroomIdOrderByVersionNumberDesc(classroomId);
                if (!all.isEmpty()) {
                    plan = all.get(0);
                }
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
        User user = userRepository.findFirstByEmailIgnoreCase(teacherEmail)
                .or(() -> userRepository.findByEmail(teacherEmail))
                .orElseThrow(() -> new AccessDeniedException("User not found: " + teacherEmail));

        boolean isOwner = classroom.getTeacherId() != null && 
                (classroom.getTeacherId().equals(user.getId()) || classroom.getTeacherId().equalsIgnoreCase(user.getEmail()));
        boolean isAdmin = user.getRole() != null && "ADMIN".equalsIgnoreCase(user.getRole().name());

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
