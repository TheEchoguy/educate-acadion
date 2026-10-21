package com.acadion.backend.service.scheduling;

import com.acadion.backend.dto.scheduling.GenerateScheduleRequest;
import com.acadion.backend.dto.scheduling.ModuleOutlineDTO;
import com.acadion.backend.dto.scheduling.SchedulePlanResponse;
import com.acadion.backend.dto.scheduling.ScheduledSessionDTO;
import com.acadion.backend.entity.Classroom;
import com.acadion.backend.entity.SyllabusItem;
import com.acadion.backend.entity.SyllabusStatus;
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
                    .orElse(LocalDate.of(2026, 7, 20));
        }

        if (endDate == null) {
            // Find regular teaching end date before semester end exams (regular teaching ends around Nov 13, 2026 before SEE starts Nov 14)
            endDate = events.stream()
                    .filter(e -> e.getEventName() != null &&
                            (e.getEventName().toLowerCase().contains("last working day") ||
                             e.getEventName().toLowerCase().contains("lwd") ||
                             (e.getEventName().toLowerCase().contains("see") && !e.getEventName().toLowerCase().contains("display")) ||
                             e.getEventName().toLowerCase().contains("semester end exam")))
                    .map(e -> {
                        String name = e.getEventName().toLowerCase();
                        if (name.contains("see") || name.contains("semester end exam")) {
                            return e.getStartDate().minusDays(1);
                        }
                        return e.getStartDate();
                    })
                    .findFirst()
                    .orElse(LocalDate.of(2026, 11, 13));
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

        // 7. Feasibility & Capacity Evaluation
        int totalAvailablePeriods = candidateSlots.size();
        int totalRequiredSessions = sessionTemplates.size();
        double requiredHours = outlineDTOs.stream().mapToDouble(o -> (double) Math.max(1, o.getEstimatedHours())).sum();
        double availableHours = candidateSlots.stream().mapToDouble(cs -> cs.slot.getDurationMinutes() / 60.0).sum();
        int sessionsToAllocate = Math.min(totalRequiredSessions, totalAvailablePeriods);
        double allocatedHours = sessionsToAllocate * 1.0;
        double remainingHours = Math.max(0.0, requiredHours - allocatedHours);
        int bufferSessionsCount = Math.max(0, totalAvailablePeriods - totalRequiredSessions);
        int unscheduledTopicsCount = Math.max(0, totalRequiredSessions - totalAvailablePeriods);
        double unscheduledHours = unscheduledTopicsCount * 1.0;

        List<String> diagnostics = new ArrayList<>();
        diagnostics.add(String.format("Available teaching capacity: %d timetable period(s) (%.1f hrs) across %s to %s",
                totalAvailablePeriods, availableHours, startDate, endDate));
        diagnostics.add(String.format("Curriculum demand: %d pedagogy session(s) (%.1f hrs) required for %d syllabus module(s)",
                totalRequiredSessions, requiredHours, outlineDTOs.size()));

        String feasibilityStatus;
        StringBuilder feasibilityReport = new StringBuilder();

        if (totalAvailablePeriods >= totalRequiredSessions) {
            int surplus = totalAvailablePeriods - totalRequiredSessions;
            if (surplus <= 2) {
                feasibilityStatus = "TIGHT";
                feasibilityReport.append(String.format("Curriculum schedule is tightly fitted: %d available teaching periods for %d required pedagogy sessions (%d surplus buffer periods). Very little buffer remains for unexpected cancellations.",
                        totalAvailablePeriods, totalRequiredSessions, surplus));
                diagnostics.add(String.format("Pacing is tight: %d surplus buffer session(s) remain for unexpected class cancellations.", surplus));
            } else {
                feasibilityStatus = "FEASIBLE";
                feasibilityReport.append(String.format("Curriculum schedule is fully feasible: %d available teaching periods for %d required sessions. %d spare periods available for revision, lab buffer, and assessments.",
                        totalAvailablePeriods, totalRequiredSessions, surplus));
                diagnostics.add(String.format("Curriculum is fully accommodable with %d spare buffer period(s) available for revision and review.", surplus));
            }
        } else {
            feasibilityStatus = "INFEASIBLE";
            int deficit = totalRequiredSessions - totalAvailablePeriods;
            feasibilityReport.append(String.format("Warning: Curriculum schedule is infeasible under current constraints! Only %d teaching periods available between %s and %s, but %d pedagogy sessions are required (Deficit: %d hours). Recommend adding compensatory slots on working Saturdays or extending lecture periods.",
                    totalAvailablePeriods, startDate, endDate, totalRequiredSessions, deficit));
            diagnostics.add(String.format("Capacity deficit: %d required session(s) (%.1f hrs) could not be accommodated before %s.",
                    deficit, unscheduledHours, endDate));
            diagnostics.add(String.format("Suggested resolution: Extend term end date past %s, allocate compensatory Saturday lectures, or reduce buffer periods.",
                    endDate));
        }

        // 8. Prevent Duplicate Sessions & Draft Plan Accumulation
        // 8. Prevent Duplicate Sessions & Draft Plan Accumulation
        // Collect existing session outcomes and teacher notes across previous sessions to preserve history
        List<TeachingSchedulePlan> existingPlans = planRepository.findByClassroomIdOrderByVersionNumberDesc(classroomId);
        Map<String, ScheduledSession> priorSessionByTopicAndIndex = new HashMap<>();
        Map<Integer, ScheduledSession> priorSessionByNumber = new HashMap<>();

        for (TeachingSchedulePlan ep : existingPlans) {
            List<ScheduledSession> priorSessions = sessionRepository.findByPlanIdOrderBySessionDateAscSessionNumberAsc(ep.getId());
            Map<String, Integer> topicOccurrenceCounter = new HashMap<>();

            for (ScheduledSession ps : priorSessions) {
                String cleanTopic = ps.getTopicTitle() != null ? ps.getTopicTitle().trim().toLowerCase() : "";
                int occurrence = topicOccurrenceCounter.getOrDefault(cleanTopic, 0);
                topicOccurrenceCounter.put(cleanTopic, occurrence + 1);

                String keyWithOccurrence = ps.getModuleNumber() + "::" + cleanTopic + "::" + occurrence;
                priorSessionByTopicAndIndex.putIfAbsent(keyWithOccurrence, ps);
                priorSessionByNumber.putIfAbsent(ps.getSessionNumber(), ps);
            }
        }

        // Clean up any unapproved draft plans and their sessions
        List<TeachingSchedulePlan> existingDrafts = existingPlans.stream()
                .filter(p -> p.getStatus() == SchedulePlanStatus.DRAFT)
                .toList();

        for (TeachingSchedulePlan oldDraft : existingDrafts) {
            sessionRepository.deleteByPlanId(oldDraft.getId());
            planRepository.delete(oldDraft);
            log.info("Cleaned up previous draft plan {} and its sessions before generating fresh schedule", oldDraft.getId());
        }

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
                .requiredHours(requiredHours)
                .allocatedHours(allocatedHours)
                .availableHours(availableHours)
                .remainingHours(remainingHours)
                .bufferSessionsCount(bufferSessionsCount)
                .unscheduledTopicsCount(unscheduledTopicsCount)
                .unscheduledHours(unscheduledHours)
                .diagnostics(diagnostics)
                .createdAt(LocalDateTime.now())
                .createdBy(teacherEmail)
                .build();

        TeachingSchedulePlan savedPlan = planRepository.save(plan);

        // 9. Allocate Sessions Deterministically
        List<ScheduledSession> scheduledSessions = new ArrayList<>();
        Map<String, Integer> currentTopicOccurrence = new HashMap<>();

        for (int i = 0; i < sessionsToAllocate; i++) {
            CandidateSlot cs = candidateSlots.get(i);
            SessionTemplate st = sessionTemplates.get(i);

            String milestoneTag = determineMilestoneTag(cs.date, milestones);

            String cleanTopic = st.topicTitle != null ? st.topicTitle.trim().toLowerCase() : "";
            int occurrence = currentTopicOccurrence.getOrDefault(cleanTopic, 0);
            currentTopicOccurrence.put(cleanTopic, occurrence + 1);

            String keyWithOccurrence = st.moduleNumber + "::" + cleanTopic + "::" + occurrence;
            ScheduledSession prior = priorSessionByTopicAndIndex.get(keyWithOccurrence);
            if (prior == null) {
                prior = priorSessionByNumber.get(i + 1);
            }

            SessionStatus status = prior != null ? prior.getStatus() : SessionStatus.SCHEDULED;
            LocalDateTime outcomeDate = prior != null ? prior.getActualOutcomeDate() : null;
            String teacherNotes = prior != null ? prior.getTeacherNotes() : null;
            String portionsCovered = prior != null ? prior.getPortionsCovered() : null;
            String remainingPortion = prior != null ? prior.getRemainingPortion() : null;

            // Preserve teacher-edited subtopic if teacher explicitly customized it
            String subtopic = st.subtopic;
            String subtopicSource = st.subtopicSource;
            if (prior != null && "TEACHER_EDITED".equals(prior.getSubtopicSource()) && prior.getSubtopic() != null && !prior.getSubtopic().isBlank()) {
                subtopic = prior.getSubtopic();
                subtopicSource = "TEACHER_EDITED";
            }

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
                    .subtopic(subtopic)
                    .subtopicSource(subtopicSource)
                    .teachingObjective(st.teachingObjective)
                    .associatedDocumentId(st.associatedDocumentId)
                    .milestoneTag(milestoneTag)
                    .status(status)
                    .actualOutcomeDate(outcomeDate)
                    .teacherNotes(teacherNotes)
                    .portionsCovered(portionsCovered)
                    .remainingPortion(remainingPortion)
                    .isLocked(false)
                    .coveredTopics(new ArrayList<>(st.coveredTopics))
                    .build();

            scheduledSessions.add(session);
        }

        // Update plan completed / skipped session counts if restored from prior outcomes
        int initialCompleted = (int) scheduledSessions.stream().filter(s -> s.getStatus() == SessionStatus.COMPLETED).count();
        int initialSkipped = (int) scheduledSessions.stream().filter(s -> s.getStatus() == SessionStatus.SKIPPED || s.getStatus() == SessionStatus.CANCELLED).count();
        if (initialCompleted > 0 || initialSkipped > 0) {
            savedPlan.setCompletedSessions(initialCompleted);
            savedPlan.setSkippedSessions(initialSkipped);
            savedPlan = planRepository.save(savedPlan);
        }

        List<ScheduledSession> savedSessions = sessionRepository.saveAll(scheduledSessions);

        // 10. Reconcile Canonical Syllabus Topics and Link Stable Identifiers
        reconcileSyllabusItemsAndLinkSessions(classroomId, moduleOutlines, savedSessions, teacherEmail);
        savedSessions = sessionRepository.saveAll(savedSessions);

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
                        focus.getAssociatedDocumentId(),
                        focus.getCoveredTopics()
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
        long uniqueTopicsInSessions = sessions != null
                ? sessions.stream().map(ScheduledSession::getTopicTitle).filter(t -> t != null && !t.isBlank()).distinct().count()
                : 0L;
        long uniqueSubtopicsInSessions = sessions != null
                ? sessions.stream().map(ScheduledSession::getSubtopic).filter(st -> st != null && !st.isBlank()).distinct().count()
                : 0L;

        int totalUniqueTopics = (int) uniqueTopicsInSessions;
        int totalSubtopics = (int) uniqueSubtopicsInSessions;

        if (syllabusItemRepository != null && plan != null && plan.getClassroomId() != null) {
            List<SyllabusItem> items = syllabusItemRepository.findByClassroomIdOrderByOrderIndexAscCreatedAtAsc(plan.getClassroomId());
            if (items != null && !items.isEmpty()) {
                totalUniqueTopics = (int) items.stream().map(SyllabusItem::getTopic).filter(t -> t != null && !t.isBlank()).distinct().count();
                totalSubtopics = (int) items.stream().map(SyllabusItem::getDescription).filter(d -> d != null && !d.isBlank()).distinct().count();
            }
        }

        return SchedulePlanResponse.builder()
                .planId(plan.getId())
                .classroomId(plan.getClassroomId())
                .versionNumber(plan.getVersionNumber())
                .planTitle(plan.getPlanTitle())
                .status(plan.getStatus())
                .termStartDate(plan.getTermStartDate())
                .termEndDate(plan.getTermEndDate())
                .totalPlannedSessions(plan.getTotalPlannedSessions())
                .totalSessions(plan.getTotalPlannedSessions())
                .totalUniqueTopics(totalUniqueTopics)
                .totalSubtopics(totalSubtopics)
                .completedSessions(plan.getCompletedSessions())
                .skippedSessions(plan.getSkippedSessions())
                .feasibilityStatus(plan.getFeasibilityStatus())
                .feasibilityReport(plan.getFeasibilityReport())
                .requiredHours(plan.getRequiredHours())
                .allocatedHours(plan.getAllocatedHours())
                .availableHours(plan.getAvailableHours())
                .remainingHours(plan.getRemainingHours())
                .bufferSessionsCount(plan.getBufferSessionsCount())
                .unscheduledTopicsCount(plan.getUnscheduledTopicsCount())
                .unscheduledHours(plan.getUnscheduledHours())
                .diagnostics(plan.getDiagnostics() != null ? plan.getDiagnostics() : new ArrayList<>())
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
                .portionsCovered(s.getPortionsCovered())
                .remainingPortion(s.getRemainingPortion())
                .carriedForwardFromSessionNumber(s.getCarriedForwardFromSessionNumber())
                .carriedForwardToSessionNumber(s.getCarriedForwardToSessionNumber())
                .isCarriedForward(s.isCarriedForward())
                .isLocked(s.isLocked())
                .coveredTopics(s.getCoveredTopics() != null ? s.getCoveredTopics() : Collections.emptyList())
                .build();
    }

    public void reconcileSyllabusItemsAndLinkSessions(
            String classroomId,
            List<ClassroomModuleOutline> moduleOutlines,
            List<ScheduledSession> scheduledSessions,
            String teacherEmail
    ) {
        List<SyllabusItem> existingItems = syllabusItemRepository != null
                ? syllabusItemRepository.findByClassroomIdOrderByOrderIndexAscCreatedAtAsc(classroomId)
                : Collections.emptyList();

        Map<String, SyllabusItem> uniqueMap = new LinkedHashMap<>();
        List<SyllabusItem> duplicatesToDelete = new ArrayList<>();

        for (SyllabusItem it : existingItems) {
            if (it.getTopic() == null || it.getTopic().isBlank()) continue;
            int modNum = extractModuleNumber(it.getUnit());
            String topicKey = normalizeTopicKey(it.getTopic());
            String key = (modNum > 0 ? "mod_" + modNum : "unit_" + normalizeUnitKey(it.getUnit())) + "::" + topicKey;

            if (uniqueMap.containsKey(key)) {
                SyllabusItem existing = uniqueMap.get(key);
                if (it.getStatus() != null && it.getStatus() != SyllabusStatus.NOT_STARTED && existing.getStatus() == SyllabusStatus.NOT_STARTED) {
                    duplicatesToDelete.add(existing);
                    uniqueMap.put(key, it);
                } else {
                    duplicatesToDelete.add(it);
                }
            } else {
                uniqueMap.put(key, it);
            }
        }

        if (!duplicatesToDelete.isEmpty() && syllabusItemRepository != null) {
            syllabusItemRepository.deleteAll(duplicatesToDelete);
            log.info("Pruned {} duplicate SyllabusItems for classroom {}", duplicatesToDelete.size(), classroomId);
        }

        Map<String, SyllabusItem> itemLookup = new HashMap<>();
        for (Map.Entry<String, SyllabusItem> entry : uniqueMap.entrySet()) {
            SyllabusItem item = entry.getValue();
            itemLookup.put(entry.getKey(), item);
            itemLookup.putIfAbsent(normalizeTopicKey(item.getTopic()), item);
        }

        int globalOrder = 0;
        List<SyllabusItem> itemsToSave = new ArrayList<>();

        for (ClassroomModuleOutline outline : moduleOutlines) {
            int modNum = outline.getModuleNumber();
            String unitTitle = outline.getModuleTitle() != null && !outline.getModuleTitle().isBlank()
                    ? outline.getModuleTitle().trim()
                    : "Module " + modNum;
            String unitName = String.format("Module %d: %s", modNum, unitTitle);

            List<String> rawTopics = outline.getTopics() != null ? outline.getTopics() : Collections.emptyList();
            List<String> topics = new ArrayList<>(rawTopics);
            if (topics.isEmpty()) {
                topics.add(unitTitle);
            }

            double hoursPerTopic = outline.getEstimatedHours() > 0
                    ? ((double) outline.getEstimatedHours()) / topics.size()
                    : 1.0;

            for (String tName : topics) {
                String cleanTName = cleanText(tName);
                String normTopic = normalizeTopicKey(cleanTName);
                String modKey = "mod_" + modNum + "::" + normTopic;
                String unitKey = "unit_" + normalizeUnitKey(unitTitle) + "::" + normTopic;

                SyllabusItem item = itemLookup.get(modKey);
                if (item == null) item = itemLookup.get(unitKey);
                if (item == null) item = itemLookup.get(normTopic);

                List<ScheduledSession> matchingSessions = scheduledSessions.stream()
                        .filter(s -> s.getModuleNumber() == modNum)
                        .filter(s -> {
                            if (s.getTopicTitle() != null && normalizeTopicKey(s.getTopicTitle()).equals(normTopic)) {
                                return true;
                            }
                            if (s.getCoveredTopics() != null && s.getCoveredTopics().stream().anyMatch(ct -> normalizeTopicKey(ct).equals(normTopic))) {
                                return true;
                            }
                            if (s.getTopicTitle() != null && s.getTopicTitle().toLowerCase().contains(normTopic)) {
                                return true;
                            }
                            if (s.getSubtopic() != null && s.getSubtopic().toLowerCase().contains(normTopic)) {
                                return true;
                            }
                            return false;
                        })
                        .collect(Collectors.toList());

                LocalDate plannedStart = null;
                LocalDate plannedEnd = null;
                List<String> sessionIds = new ArrayList<>();
                List<String> objectives = new ArrayList<>();

                if (!matchingSessions.isEmpty()) {
                    plannedStart = matchingSessions.stream()
                            .map(ScheduledSession::getSessionDate)
                            .filter(Objects::nonNull)
                            .min(LocalDate::compareTo)
                            .orElse(null);
                    plannedEnd = matchingSessions.stream()
                            .map(ScheduledSession::getSessionDate)
                            .filter(Objects::nonNull)
                            .max(LocalDate::compareTo)
                            .orElse(null);
                    sessionIds = matchingSessions.stream()
                            .map(ScheduledSession::getId)
                            .filter(Objects::nonNull)
                            .collect(Collectors.toList());
                    objectives = matchingSessions.stream()
                            .map(ScheduledSession::getTeachingObjective)
                            .filter(obj -> obj != null && !obj.isBlank())
                            .distinct()
                            .collect(Collectors.toList());
                }

                if (item != null) {
                    if (item.getUnit() == null || item.getUnit().isBlank()) {
                        item.setUnit(unitName);
                    }
                    if (plannedStart != null) item.setPlannedStartDate(plannedStart);
                    if (plannedEnd != null) item.setPlannedCompletionDate(plannedEnd);
                    if (!sessionIds.isEmpty()) item.setLinkedSessionIds(sessionIds);
                    if (item.getEstimatedHours() == null || item.getEstimatedHours() <= 0) {
                        item.setEstimatedHours(hoursPerTopic);
                    }
                    if (item.getLearningObjectives() != null && !item.getLearningObjectives().isEmpty()) {
                        // Preserve legitimate teacher objectives
                    } else if (!objectives.isEmpty()) {
                        item.setLearningObjectives(objectives);
                    } else {
                        item.setLearningObjectives(Collections.emptyList());
                    }
                    item.setOrderIndex(globalOrder++);
                    item.setUpdatedAt(LocalDateTime.now());
                    itemsToSave.add(item);

                    for (ScheduledSession s : matchingSessions) {
                        if (s.getTopicId() == null || (s.getTopicTitle() != null && normalizeTopicKey(s.getTopicTitle()).equals(normTopic))) {
                            s.setTopicId(item.getId());
                        }
                    }
                } else {
                    List<com.acadion.backend.entity.LearningResource> resources = new ArrayList<>();
                    if (outline.getAssociatedDocumentId() != null && !outline.getAssociatedDocumentId().isBlank()) {
                        resources.add(com.acadion.backend.entity.LearningResource.builder()
                                .label(unitTitle + " Reference Material (Official PDF)")
                                .url(String.format("/api/syllabus/classroom/%s/scheduling/documents/%s/download", classroomId, outline.getAssociatedDocumentId()))
                                .type("MODULE_PDF")
                                .build());
                    }

                    String subtopicDesc = outline.getSubtopics() != null && !outline.getSubtopics().isEmpty()
                            ? String.join("; ", outline.getSubtopics())
                            : "";

                    SyllabusItem newItem = SyllabusItem.builder()
                            .classroomId(classroomId)
                            .unit(unitName)
                            .topic(cleanTName)
                            .description(subtopicDesc)
                            .status(com.acadion.backend.entity.SyllabusStatus.NOT_STARTED)
                            .orderIndex(globalOrder++)
                            .estimatedHours(hoursPerTopic)
                            .plannedStartDate(plannedStart)
                            .plannedCompletionDate(plannedEnd)
                            .linkedSessionIds(sessionIds)
                            .learningObjectives(objectives != null && !objectives.isEmpty() ? objectives : Collections.emptyList())
                            .learningResources(resources)
                            .createdBy(teacherEmail)
                            .createdAt(LocalDateTime.now())
                            .updatedAt(LocalDateTime.now())
                            .build();

                    if (newItem.getId() == null) {
                        newItem.setId("syl_" + System.currentTimeMillis() + "_" + globalOrder);
                    }
                    SyllabusItem savedNew = syllabusItemRepository != null ? syllabusItemRepository.save(newItem) : null;
                    SyllabusItem effectiveItem = savedNew != null ? savedNew : newItem;
                    itemsToSave.add(effectiveItem);

                    itemLookup.put(modKey, effectiveItem);
                    itemLookup.put(unitKey, effectiveItem);
                    itemLookup.putIfAbsent(normTopic, effectiveItem);

                    String assignedTopicId = effectiveItem.getId();
                    for (ScheduledSession s : matchingSessions) {
                        if (s.getTopicId() == null || (s.getTopicTitle() != null && normalizeTopicKey(s.getTopicTitle()).equals(normTopic))) {
                            s.setTopicId(assignedTopicId);
                        }
                    }
                }
            }
        }

        if (!itemsToSave.isEmpty() && syllabusItemRepository != null) {
            syllabusItemRepository.saveAll(itemsToSave);
        }
    }

    private int extractModuleNumber(String unit) {
        if (unit == null) return 0;
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("(?i)module\\s*(\\d+)").matcher(unit);
        if (m.find()) {
            try {
                return Integer.parseInt(m.group(1));
            } catch (NumberFormatException ignored) {}
        }
        return 0;
    }

    private String normalizeUnitKey(String unit) {
        if (unit == null) return "";
        return unit.replaceAll("(?i)^module\\s*\\d+\\s*[:\\-\\.]?\\s*", "").trim().toLowerCase().replaceAll("\\s+", " ");
    }

    private String normalizeTopicKey(String topic) {
        if (topic == null) return "";
        return topic.trim().toLowerCase().replaceAll("\\s+", " ");
    }

    private String cleanText(String s) {
        if (s == null) return "";
        return s.replaceAll("[\\r\\n]+", " ").trim();
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
        List<String> coveredTopics;

        SessionTemplate(int moduleNumber, String moduleTitle, String topicTitle, String subtopic, String subtopicSource, String teachingObjective, String associatedDocumentId, List<String> coveredTopics) {
            this.moduleNumber = moduleNumber;
            this.moduleTitle = moduleTitle;
            this.topicTitle = topicTitle;
            this.subtopic = subtopic;
            this.subtopicSource = subtopicSource;
            this.teachingObjective = teachingObjective;
            this.associatedDocumentId = associatedDocumentId;
            this.coveredTopics = coveredTopics;
        }
    }
}
