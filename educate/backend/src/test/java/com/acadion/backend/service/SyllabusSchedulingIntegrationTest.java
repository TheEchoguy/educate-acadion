package com.acadion.backend.service;

import com.acadion.backend.dto.scheduling.*;
import com.acadion.backend.entity.Classroom;
import com.acadion.backend.entity.ClassroomMembership;
import com.acadion.backend.entity.Role;
import com.acadion.backend.entity.SyllabusItem;
import com.acadion.backend.entity.User;
import com.acadion.backend.entity.scheduling.*;
import com.acadion.backend.repository.ClassroomMembershipRepository;
import com.acadion.backend.repository.ClassroomRepository;
import com.acadion.backend.repository.SyllabusItemRepository;
import com.acadion.backend.repository.UserRepository;
import com.acadion.backend.repository.scheduling.*;
import com.acadion.backend.service.scheduling.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.access.AccessDeniedException;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class SyllabusSchedulingIntegrationTest {

    @Mock
    private AcademicDocumentRepository documentRepository;
    @Mock
    private TimetableSlotRepository timetableSlotRepository;
    @Mock
    private AcademicCalendarEventRepository calendarEventRepository;
    @Mock
    private AssessmentMilestoneRepository milestoneRepository;
    @Mock
    private ClassroomModuleOutlineRepository moduleOutlineRepository;
    @Mock
    private TeachingSchedulePlanRepository planRepository;
    @Mock
    private ScheduledSessionRepository sessionRepository;
    @Mock
    private RescheduleRecordRepository rescheduleRecordRepository;
    @Mock
    private ClassroomRepository classroomRepository;
    @Mock
    private ClassroomMembershipRepository membershipRepository;
    @Mock
    private SyllabusItemRepository syllabusItemRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private JavaMailSender mailSender;

    private SyllabusSchedulingNotificationService notificationService;
    private AcademicDocumentService documentService;
    private AcademicExtractionService extractionService;
    private DeterministicScheduleGenerator scheduleGenerator;
    private ScheduleExecutionService executionService;
    private SyllabusSchedulingExportService exportService;

    private User teacher;
    private Classroom classroom;
    private User student;
    private User stranger;

    @BeforeEach
    void setUp() {
        notificationService = new SyllabusSchedulingNotificationService(membershipRepository, userRepository, mailSender);
        documentService = new AcademicDocumentService(documentRepository, classroomRepository, membershipRepository, userRepository, notificationService);
        extractionService = new AcademicExtractionService(
                documentRepository, timetableSlotRepository, calendarEventRepository, milestoneRepository,
                moduleOutlineRepository, classroomRepository, syllabusItemRepository, userRepository
        );
        IntelligentSubtopicDecomposer subtopicDecomposer = new IntelligentSubtopicDecomposer(null);
        scheduleGenerator = new DeterministicScheduleGenerator(
                timetableSlotRepository, calendarEventRepository, milestoneRepository, moduleOutlineRepository,
                planRepository, sessionRepository, documentRepository, classroomRepository, syllabusItemRepository, extractionService,
                subtopicDecomposer
        );
        executionService = new ScheduleExecutionService(
                planRepository, sessionRepository, rescheduleRecordRepository, timetableSlotRepository,
                calendarEventRepository, milestoneRepository, classroomRepository, userRepository,
                syllabusItemRepository, notificationService, scheduleGenerator
        );
        exportService = new SyllabusSchedulingExportService(executionService);

        lenient().when(syllabusItemRepository.save(any(SyllabusItem.class))).thenAnswer(inv -> {
            SyllabusItem it = inv.getArgument(0);
            if (it.getId() == null) it.setId("syl_" + UUID.randomUUID().toString().substring(0, 8));
            return it;
        });
        lenient().when(syllabusItemRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        teacher = User.builder()
                .id("teacher_1")
                .name("Dr. Asha K H")
                .email("asha@dbit.ac.in")
                .role(Role.TEACHER)
                .build();

        student = User.builder()
                .id("student_1")
                .name("Student One")
                .email("student1@dbit.ac.in")
                .role(Role.STUDENT)
                .build();

        stranger = User.builder()
                .id("teacher_stranger")
                .name("Dr. Stranger")
                .email("stranger@other.ac.in")
                .role(Role.TEACHER)
                .build();

        classroom = Classroom.builder()
                .id("cls_bda")
                .name("7th Sem CSE Section A - Big Data Analytics")
                .subjectCode("BCS714D")
                .subjectName("Big Data Analytics")
                .semester(7)
                .section("A")
                .department("Computer Science & Engineering")
                .academicYear("2026-2027")
                .teacherId("teacher_1")
                .build();
    }

    @Test
    @DisplayName("1. A new classroom has no fabricated scheduling documents or approved plan")
    void testNewClassroomHasNoFabricatedDocumentsOrApprovedPlan() {
        when(classroomRepository.findById("cls_bda")).thenReturn(Optional.of(classroom));
        when(userRepository.findByEmail("asha@dbit.ac.in")).thenReturn(Optional.of(teacher));
        when(documentRepository.findByClassroomId("cls_bda")).thenReturn(new ArrayList<>());
        when(timetableSlotRepository.findByClassroomId("cls_bda")).thenReturn(new ArrayList<>());
        when(calendarEventRepository.findByClassroomId("cls_bda")).thenReturn(new ArrayList<>());
        when(milestoneRepository.findByClassroomId("cls_bda")).thenReturn(new ArrayList<>());
        when(moduleOutlineRepository.findByClassroomIdOrderByModuleNumberAsc("cls_bda")).thenReturn(new ArrayList<>());

        ExtractionReviewResponse res = extractionService.extractAndReview("cls_bda", "asha@dbit.ac.in");

        assertNotNull(res);
        assertFalse(res.isHasRequiredDocuments(), "New classroom must report hasRequiredDocuments = false");
        assertFalse(res.isInputsVerified(), "New classroom must report inputsVerified = false");
        assertTrue(res.getDocuments().isEmpty(), "No fabricated documents");
        assertTrue(res.getTimetableSlots().isEmpty(), "No fabricated timetable slots");
        assertTrue(res.getCalendarEvents().isEmpty(), "No fabricated calendar events");

        // Verify active plan is null
        lenient().when(planRepository.findFirstByClassroomIdAndStatusOrderByVersionNumberDesc("cls_bda", SchedulePlanStatus.DRAFT))
                .thenReturn(Optional.empty());
        lenient().when(planRepository.findFirstByClassroomIdAndStatusOrderByVersionNumberDesc("cls_bda", SchedulePlanStatus.APPROVED))
                .thenReturn(Optional.empty());
        when(planRepository.findByClassroomIdOrderByVersionNumberDesc("cls_bda")).thenReturn(new ArrayList<>());

        SchedulePlanResponse plan = executionService.getActiveOrDraftPlan("cls_bda", "asha@dbit.ac.in");
        assertNull(plan, "A new classroom must not automatically have an active or draft plan");
    }

    @Test
    @DisplayName("2. Uploading each required planning document produces correct document metadata")
    void testUploadDocumentMetadata() throws IOException {
        when(classroomRepository.findById("cls_bda")).thenReturn(Optional.of(classroom));
        when(userRepository.findByEmail("asha@dbit.ac.in")).thenReturn(Optional.of(teacher));
        when(documentRepository.save(any(AcademicDocument.class))).thenAnswer(inv -> {
            AcademicDocument d = inv.getArgument(0);
            d.setId("doc_tt");
            return d;
        });

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "CSE_7A_Timetable.pdf",
                "application/pdf",
                "MONDAY 11:15 - 12:15 Room A201 BCS714D Dr. Asha K H".getBytes(StandardCharsets.UTF_8)
        );

        DocumentMetadataDTO dto = documentService.uploadDocument("cls_bda", AcademicDocumentType.TIMETABLE, null, null, file, "asha@dbit.ac.in");

        assertNotNull(dto);
        assertEquals("doc_tt", dto.getId());
        assertEquals(AcademicDocumentType.TIMETABLE, dto.getDocumentType());
        assertEquals("CSE_7A_Timetable.pdf", dto.getOriginalFileName());
        assertEquals("BCS714D", dto.getSubjectCode());
        assertFalse(dto.isPublished(), "Planning documents must remain unpublished to students by default");
    }

    @Test
    @DisplayName("3. Extraction reports unsupported or textless scanned PDFs honestly")
    void testExtractionReportsTextlessScannedPdfHonestly() {
        AcademicDocument doc = AcademicDocument.builder()
                .id("doc_scanned")
                .classroomId("cls_bda")
                .documentType(AcademicDocumentType.TIMETABLE)
                .originalFileName("scanned_timetable_image.pdf")
                .contentType("application/pdf")
                .fileData("short".getBytes(StandardCharsets.UTF_8)) // < 15 chars
                .processingStatus("UPLOADED")
                .build();

        when(documentRepository.save(any(AcademicDocument.class))).thenAnswer(inv -> inv.getArgument(0));

        extractionService.processDocument(doc, classroom);

        assertEquals("NEEDS_OCR", doc.getProcessingStatus());
        assertTrue(doc.getExtractedSummary().contains("scanned images or no extractable text layer"));
    }

    @Test
    @DisplayName("4. Teacher corrections are saved and used by subsequent schedule generation")
    void testTeacherCorrectionsSavedAndUsed() {
        when(classroomRepository.findById("cls_bda")).thenReturn(Optional.of(classroom));
        when(userRepository.findByEmail("asha@dbit.ac.in")).thenReturn(Optional.of(teacher));

        TimetableSlotDTO slotDTO = TimetableSlotDTO.builder()
                .dayOfWeek(DayOfWeek.TUESDAY)
                .startTime(LocalTime.of(9, 30))
                .endTime(LocalTime.of(10, 30))
                .durationMinutes(60)
                .roomNumber("Room B302")
                .facultyName("Dr. Asha K H")
                .build();

        when(timetableSlotRepository.saveAll(any())).thenAnswer(inv -> {
            List<TimetableSlot> list = inv.getArgument(0);
            return list;
        });

        List<TimetableSlotDTO> updatedSlots = extractionService.updateTimetableSlots("cls_bda", List.of(slotDTO), "asha@dbit.ac.in");

        assertNotNull(updatedSlots);
        assertEquals(1, updatedSlots.size());
        assertEquals(DayOfWeek.TUESDAY, updatedSlots.get(0).getDayOfWeek());
        assertEquals("Room B302", updatedSlots.get(0).getRoomNumber());
        assertTrue(updatedSlots.get(0).isApproved(), "Teacher edited slots are marked approved");
    }

    @Test
    @DisplayName("5. Schedule generation fails safely when required inputs are missing or unverified")
    void testScheduleGenerationFailsWhenInputsMissingOrUnverified() {
        classroom.setSchedulingInputsVerified(true);
        when(classroomRepository.findById("cls_bda")).thenReturn(Optional.of(classroom));
        when(timetableSlotRepository.findByClassroomIdAndApprovedTrue("cls_bda")).thenReturn(new ArrayList<>());

        GenerateScheduleRequest req = GenerateScheduleRequest.builder().build();

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                scheduleGenerator.generateDraftSchedule("cls_bda", req, "asha@dbit.ac.in")
        );
        assertTrue(ex.getMessage().contains("No verified timetable slots exist"));
    }

    @Test
    @DisplayName("6. A generated plan reflects the selected classroom's verified inputs")
    void testGeneratedPlanReflectsVerifiedInputs() {
        classroom.setSchedulingInputsVerified(true);
        when(classroomRepository.findById("cls_bda")).thenReturn(Optional.of(classroom));

        List<TimetableSlot> slots = List.of(
                TimetableSlot.builder().classroomId("cls_bda").subjectCode("BCS714D").dayOfWeek(DayOfWeek.MONDAY).startTime(LocalTime.of(11, 15)).endTime(LocalTime.of(12, 15)).durationMinutes(60).roomNumber("A201").approved(true).build(),
                TimetableSlot.builder().classroomId("cls_bda").subjectCode("BCS714D").dayOfWeek(DayOfWeek.WEDNESDAY).startTime(LocalTime.of(12, 15)).endTime(LocalTime.of(13, 15)).durationMinutes(60).roomNumber("A201").approved(true).build(),
                TimetableSlot.builder().classroomId("cls_bda").subjectCode("BCS714D").dayOfWeek(DayOfWeek.THURSDAY).startTime(LocalTime.of(11, 15)).endTime(LocalTime.of(12, 15)).durationMinutes(60).roomNumber("A201").approved(true).build()
        );
        when(timetableSlotRepository.findByClassroomIdAndApprovedTrue("cls_bda")).thenReturn(slots);

        List<AcademicCalendarEvent> events = List.of(
                AcademicCalendarEvent.builder().classroomId("cls_bda").eventName("Semester Commencement").startDate(LocalDate.of(2026, 7, 20)).isTeachingDay(true).approved(true).build(),
                AcademicCalendarEvent.builder().classroomId("cls_bda").eventName("Term End").startDate(LocalDate.of(2026, 11, 9)).isTeachingDay(true).approved(true).build()
        );
        when(calendarEventRepository.findByClassroomIdAndApprovedTrue("cls_bda")).thenReturn(events);

        ClassroomModuleOutline mod1 = ClassroomModuleOutline.builder()
                .classroomId("cls_bda")
                .moduleNumber(1)
                .moduleTitle("Big Data Analytics Overview")
                .estimatedHours(3)
                .topics(List.of("Intro to Big Data", "5 Vs Architecture", "Hadoop Ecosystem"))
                .approved(true)
                .build();

        when(moduleOutlineRepository.findByClassroomIdOrderByModuleNumberAsc("cls_bda")).thenReturn(List.of(mod1));
        when(milestoneRepository.findByClassroomIdAndApprovedTrueOrderByStartDateAsc("cls_bda")).thenReturn(new ArrayList<>());
        when(planRepository.findByClassroomIdOrderByVersionNumberDesc("cls_bda")).thenReturn(new ArrayList<>());
        when(planRepository.save(any(TeachingSchedulePlan.class))).thenAnswer(inv -> {
            TeachingSchedulePlan p = inv.getArgument(0);
            p.setId("plan_gen_1");
            return p;
        });
        when(sessionRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        GenerateScheduleRequest req = GenerateScheduleRequest.builder()
                .termStartDate(LocalDate.of(2026, 7, 20))
                .termEndDate(LocalDate.of(2026, 11, 9))
                .allowPastDates(true)
                .build();

        SchedulePlanResponse plan = scheduleGenerator.generateDraftSchedule("cls_bda", req, "asha@dbit.ac.in");

        assertNotNull(plan);
        assertEquals("plan_gen_1", plan.getPlanId());
        assertEquals("cls_bda", plan.getClassroomId());
        assertEquals(3, plan.getSessions().size());
        assertEquals("Intro to Big Data", plan.getSessions().get(0).getTopicTitle());
        assertEquals(DayOfWeek.MONDAY, plan.getSessions().get(0).getDayOfWeek());
    }

    @Test
    @DisplayName("7. Holidays, assessment windows, timetable conflicts, and invalid dates are respected")
    void testHolidaysAndAssessmentWindowsRespected() {
        classroom.setSchedulingInputsVerified(true);
        when(classroomRepository.findById("cls_bda")).thenReturn(Optional.of(classroom));

        List<TimetableSlot> slots = List.of(
                TimetableSlot.builder().classroomId("cls_bda").subjectCode("BCS714D").dayOfWeek(DayOfWeek.MONDAY).startTime(LocalTime.of(10, 0)).endTime(LocalTime.of(11, 0)).approved(true).build()
        );
        when(timetableSlotRepository.findByClassroomIdAndApprovedTrue("cls_bda")).thenReturn(slots);

        // Monday July 20 is marked as HOLIDAY (isTeachingDay = false)
        List<AcademicCalendarEvent> events = List.of(
                AcademicCalendarEvent.builder().classroomId("cls_bda").eventName("Founder's Day Holiday").startDate(LocalDate.of(2026, 7, 20)).endDate(LocalDate.of(2026, 7, 20)).isTeachingDay(false).approved(true).build()
        );
        when(calendarEventRepository.findByClassroomIdAndApprovedTrue("cls_bda")).thenReturn(events);

        ClassroomModuleOutline mod1 = ClassroomModuleOutline.builder().classroomId("cls_bda").moduleNumber(1).moduleTitle("Mod 1").estimatedHours(1).topics(List.of("Topic 1")).approved(true).build();
        when(moduleOutlineRepository.findByClassroomIdOrderByModuleNumberAsc("cls_bda")).thenReturn(List.of(mod1));
        when(planRepository.findByClassroomIdOrderByVersionNumberDesc("cls_bda")).thenReturn(new ArrayList<>());
        when(planRepository.save(any())).thenAnswer(inv -> {
            TeachingSchedulePlan p = inv.getArgument(0);
            p.setId("plan_holidays");
            return p;
        });
        when(sessionRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        // Period spans July 20 to July 27
        GenerateScheduleRequest req = GenerateScheduleRequest.builder()
                .termStartDate(LocalDate.of(2026, 7, 20))
                .termEndDate(LocalDate.of(2026, 7, 27))
                .allowPastDates(true)
                .build();

        SchedulePlanResponse plan = scheduleGenerator.generateDraftSchedule("cls_bda", req, "asha@dbit.ac.in");

        assertNotNull(plan);
        assertEquals(1, plan.getSessions().size());
        // Session must NOT be scheduled on July 20 (Holiday); it must be on July 27 (next valid Monday)
        assertEquals(LocalDate.of(2026, 7, 27), plan.getSessions().get(0).getSessionDate());
        assertNotEquals(LocalDate.of(2026, 7, 20), plan.getSessions().get(0).getSessionDate());
    }

    @Test
    @DisplayName("8. Infeasible schedules return useful diagnostics instead of fabricated capacity")
    void testInfeasibleSchedulesDiagnostics() {
        classroom.setSchedulingInputsVerified(true);
        when(classroomRepository.findById("cls_bda")).thenReturn(Optional.of(classroom));

        // Only 1 slot available
        List<TimetableSlot> slots = List.of(
                TimetableSlot.builder().classroomId("cls_bda").subjectCode("BCS714D").dayOfWeek(DayOfWeek.MONDAY).startTime(LocalTime.of(10, 0)).endTime(LocalTime.of(11, 0)).approved(true).build()
        );
        when(timetableSlotRepository.findByClassroomIdAndApprovedTrue("cls_bda")).thenReturn(slots);
        when(calendarEventRepository.findByClassroomIdAndApprovedTrue("cls_bda")).thenReturn(List.of(
                AcademicCalendarEvent.builder().classroomId("cls_bda").eventName("Open").startDate(LocalDate.of(2026, 7, 20)).isTeachingDay(true).approved(true).build()
        ));

        // Requires 10 hours
        ClassroomModuleOutline mod1 = ClassroomModuleOutline.builder().classroomId("cls_bda").moduleNumber(1).moduleTitle("Mod 1").estimatedHours(10).topics(List.of("T1", "T2")).approved(true).build();
        when(moduleOutlineRepository.findByClassroomIdOrderByModuleNumberAsc("cls_bda")).thenReturn(List.of(mod1));
        when(planRepository.findByClassroomIdOrderByVersionNumberDesc("cls_bda")).thenReturn(new ArrayList<>());
        when(planRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(sessionRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        // Only 2 Mondays between July 20 and July 27
        GenerateScheduleRequest req = GenerateScheduleRequest.builder()
                .termStartDate(LocalDate.of(2026, 7, 20))
                .termEndDate(LocalDate.of(2026, 7, 27))
                .allowPastDates(true)
                .build();

        SchedulePlanResponse plan = scheduleGenerator.generateDraftSchedule("cls_bda", req, "asha@dbit.ac.in");

        assertNotNull(plan);
        assertEquals("INFEASIBLE", plan.getFeasibilityStatus());
        assertTrue(plan.getFeasibilityReport().contains("Deficit"));
        assertTrue(plan.getFeasibilityReport().contains("pedagogy sessions are required"));
    }

    @Test
    @DisplayName("9. Manual topic allocation validates the date, period, duration, and topic")
    void testManualTopicAllocationValidatesConstraints() {
        when(classroomRepository.findById("cls_bda")).thenReturn(Optional.of(classroom));
        when(userRepository.findByEmail("asha@dbit.ac.in")).thenReturn(Optional.of(teacher));

        TeachingSchedulePlan plan = TeachingSchedulePlan.builder()
                .id("plan_1")
                .classroomId("cls_bda")
                .termStartDate(LocalDate.of(2026, 7, 20))
                .termEndDate(LocalDate.of(2026, 11, 9))
                .status(SchedulePlanStatus.APPROVED)
                .build();
        when(planRepository.findFirstByClassroomIdAndStatusOrderByVersionNumberDesc("cls_bda", SchedulePlanStatus.APPROVED))
                .thenReturn(Optional.of(plan));

        when(calendarEventRepository.findByClassroomIdAndApprovedTrue("cls_bda")).thenReturn(new ArrayList<>());

        List<TimetableSlot> slots = List.of(
                TimetableSlot.builder().classroomId("cls_bda").dayOfWeek(DayOfWeek.WEDNESDAY).startTime(LocalTime.of(11, 0)).endTime(LocalTime.of(12, 0)).durationMinutes(60).roomNumber("A201").approved(true).build()
        );
        when(timetableSlotRepository.findByClassroomIdAndApprovedTrue("cls_bda")).thenReturn(slots);
        when(sessionRepository.findByPlanIdOrderBySessionDateAscSessionNumberAsc("plan_1")).thenReturn(new ArrayList<>());
        when(sessionRepository.save(any(ScheduledSession.class))).thenAnswer(inv -> {
            ScheduledSession s = inv.getArgument(0);
            s.setId("ses_manual");
            return s;
        });

        // Wednesday July 22, 2026
        ManualSessionAllocationRequest req = ManualSessionAllocationRequest.builder()
                .sessionDate(LocalDate.of(2026, 7, 22))
                .startTime(LocalTime.of(11, 0))
                .endTime(LocalTime.of(12, 0))
                .durationMinutes(60)
                .moduleNumber(2)
                .moduleTitle("Hadoop Architecture")
                .topicTitle("HDFS NameNode and DataNode")
                .subtopic("Block Replication Strategy")
                .teacherNotes("Extra practical lab allocation")
                .build();

        ScheduledSessionDTO session = executionService.manualAllocateSession("cls_bda", req, "asha@dbit.ac.in");

        assertNotNull(session);
        assertEquals("ses_manual", session.getId());
        assertEquals("HDFS NameNode and DataNode", session.getTopicTitle());
        assertEquals(LocalDate.of(2026, 7, 22), session.getSessionDate());
        assertTrue(session.isLocked(), "Manually allocated sessions are locked to prevent inadvertent auto-shifting");
    }

    @Test
    @DisplayName("10. Duplicate and overlapping allocations are rejected appropriately")
    void testDuplicateAndOverlappingAllocationsRejected() {
        when(classroomRepository.findById("cls_bda")).thenReturn(Optional.of(classroom));
        when(userRepository.findByEmail("asha@dbit.ac.in")).thenReturn(Optional.of(teacher));

        TeachingSchedulePlan plan = TeachingSchedulePlan.builder()
                .id("plan_1")
                .classroomId("cls_bda")
                .termStartDate(LocalDate.of(2026, 7, 20))
                .termEndDate(LocalDate.of(2026, 11, 9))
                .status(SchedulePlanStatus.APPROVED)
                .build();
        when(planRepository.findFirstByClassroomIdAndStatusOrderByVersionNumberDesc("cls_bda", SchedulePlanStatus.APPROVED))
                .thenReturn(Optional.of(plan));

        when(calendarEventRepository.findByClassroomIdAndApprovedTrue("cls_bda")).thenReturn(new ArrayList<>());

        ScheduledSession existingSession = ScheduledSession.builder()
                .id("ses_existing")
                .planId("plan_1")
                .classroomId("cls_bda")
                .sessionDate(LocalDate.of(2026, 7, 22))
                .startTime(LocalTime.of(11, 0))
                .endTime(LocalTime.of(12, 0))
                .topicTitle("Existing Topic")
                .status(SessionStatus.SCHEDULED)
                .build();

        when(sessionRepository.findByPlanIdOrderBySessionDateAscSessionNumberAsc("plan_1"))
                .thenReturn(List.of(existingSession));

        ManualSessionAllocationRequest req = ManualSessionAllocationRequest.builder()
                .sessionDate(LocalDate.of(2026, 7, 22))
                .startTime(LocalTime.of(11, 30)) // Overlaps with 11:00-12:00
                .endTime(LocalTime.of(12, 30))
                .topicTitle("Conflicting Topic")
                .build();

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                executionService.manualAllocateSession("cls_bda", req, "asha@dbit.ac.in")
        );
        assertTrue(ex.getMessage().contains("Time conflict: A session is already scheduled"));
    }

    @Test
    @DisplayName("11. Approval, publication, rescheduling, and history preserve plan versions")
    void testApprovalPublicationReschedulePreserveVersions() {
        when(classroomRepository.findById("cls_bda")).thenReturn(Optional.of(classroom));
        when(userRepository.findByEmail("asha@dbit.ac.in")).thenReturn(Optional.of(teacher));

        TeachingSchedulePlan draftPlan = TeachingSchedulePlan.builder()
                .id("plan_v2")
                .classroomId("cls_bda")
                .versionNumber(2)
                .status(SchedulePlanStatus.DRAFT)
                .build();

        TeachingSchedulePlan oldApproved = TeachingSchedulePlan.builder()
                .id("plan_v1")
                .classroomId("cls_bda")
                .versionNumber(1)
                .status(SchedulePlanStatus.APPROVED)
                .build();

        when(planRepository.findById("plan_v2")).thenReturn(Optional.of(draftPlan));
        when(planRepository.findByClassroomIdOrderByVersionNumberDesc("cls_bda"))
                .thenReturn(List.of(draftPlan, oldApproved));
        when(planRepository.save(any(TeachingSchedulePlan.class))).thenAnswer(inv -> inv.getArgument(0));
        when(sessionRepository.findByPlanIdOrderBySessionDateAscSessionNumberAsc("plan_v2")).thenReturn(new ArrayList<>());

        SchedulePlanResponse approved = executionService.approveAndPublishPlan("cls_bda", "plan_v2", "asha@dbit.ac.in");

        assertNotNull(approved);
        assertEquals(SchedulePlanStatus.APPROVED, approved.getStatus());
        assertEquals(SchedulePlanStatus.SUPERSEDED, oldApproved.getStatus(), "Previous plan must be marked SUPERSEDED");
    }

    @Test
    @DisplayName("12. Unauthorized users cannot access another classroom's documents or plan")
    void testUnauthorizedUserCannotAccessClassroom() {
        when(classroomRepository.findById("cls_bda")).thenReturn(Optional.of(classroom));
        when(userRepository.findByEmail("stranger@other.ac.in")).thenReturn(Optional.of(stranger));

        assertThrows(AccessDeniedException.class, () ->
                extractionService.extractAndReview("cls_bda", "stranger@other.ac.in")
        );

        assertThrows(AccessDeniedException.class, () ->
                documentService.listDocumentsForTeacher("cls_bda", "stranger@other.ac.in")
        );
    }

    @Test
    @DisplayName("13. Publication notifications use existing infrastructure and do not fail when email fails")
    void testPublicationNotificationsGracefulOnEmailFailure() {
        ClassroomMembership membership = ClassroomMembership.builder()
                .classroomId("cls_bda")
                .studentId("student_1")
                .membershipStatus("ACTIVE")
                .build();

        when(membershipRepository.findByClassroomIdAndMembershipStatus("cls_bda", "ACTIVE"))
                .thenReturn(List.of(membership));
        when(userRepository.findById("student_1")).thenReturn(Optional.of(student));
        doThrow(new MailSendException("SMTP relay unreachable")).when(mailSender).send(any(SimpleMailMessage.class));

        TeachingSchedulePlan plan = TeachingSchedulePlan.builder()
                .versionNumber(1)
                .termStartDate(LocalDate.of(2026, 7, 20))
                .termEndDate(LocalDate.of(2026, 11, 9))
                .totalPlannedSessions(40)
                .build();

        // Must not throw runtime exception when SMTP fails
        assertDoesNotThrow(() ->
                notificationService.notifySchedulePublished(classroom, plan, teacher)
        );
    }

    @Test
    @DisplayName("14. Exports reflect the correct approved plan and actual classroom")
    void testExportsReflectCorrectApprovedPlan() {
        when(classroomRepository.findById("cls_bda")).thenReturn(Optional.of(classroom));
        when(userRepository.findByEmail("asha@dbit.ac.in")).thenReturn(Optional.of(teacher));

        TeachingSchedulePlan plan = TeachingSchedulePlan.builder()
                .id("plan_1")
                .classroomId("cls_bda")
                .versionNumber(1)
                .planTitle("BCS714D Big Data Analytics")
                .status(SchedulePlanStatus.APPROVED)
                .build();

        ScheduledSession session = ScheduledSession.builder()
                .id("ses_1")
                .planId("plan_1")
                .classroomId("cls_bda")
                .sessionNumber(1)
                .sessionDate(LocalDate.of(2026, 7, 20))
                .dayOfWeek(DayOfWeek.MONDAY)
                .startTime(LocalTime.of(11, 15))
                .endTime(LocalTime.of(12, 15))
                .roomNumber("A201")
                .moduleNumber(1)
                .moduleTitle("Introduction")
                .topicTitle("Classification of Data")
                .status(SessionStatus.SCHEDULED)
                .build();

        lenient().when(planRepository.findFirstByClassroomIdAndStatusOrderByVersionNumberDesc("cls_bda", SchedulePlanStatus.DRAFT))
                .thenReturn(Optional.empty());
        when(planRepository.findFirstByClassroomIdAndStatusOrderByVersionNumberDesc("cls_bda", SchedulePlanStatus.APPROVED))
                .thenReturn(Optional.of(plan));
        when(sessionRepository.findByPlanIdOrderBySessionDateAscSessionNumberAsc("plan_1"))
                .thenReturn(List.of(session));

        byte[] ical = exportService.exportScheduleIcal("cls_bda", "asha@dbit.ac.in");
        String icalText = new String(ical, StandardCharsets.UTF_8);
        assertTrue(icalText.contains("BEGIN:VCALENDAR"));
        assertTrue(icalText.contains("SUMMARY:Session #1: Classification of Data"));

        byte[] csv = exportService.exportScheduleCsv("cls_bda", "asha@dbit.ac.in");
        String csvText = new String(csv, StandardCharsets.UTF_8);
        assertTrue(csvText.contains("Classification of Data"));
    }

    @Test
    @DisplayName("15. Official syllabus extraction extracts all 5 modules and persists topic hierarchies")
    void testOfficialSyllabusFiveModuleExtraction() {
        String syllabusText = """
                COURSE TITLE: BIG DATA ANALYTICS
                Course Code: BCS714D  CIE Marks: 50  SEE Marks: 50
                Total Teaching Hours: 40  Credits: 03

                MODULE 1: INTRODUCTION TO BIG DATA
                Classification of digital data. Characteristics of data. Evolution of big data.
                Challenges with big data. Definition of big data. Other characteristics of data.
                Textbook 1: Chapter 1. 08 Hours.

                MODULE 2: HADOOP ARCHITECTURE AND ECOSYSTEM
                Distributed file systems. HDFS daemons: NameNode, DataNode, Secondary NameNode.
                MapReduce framework. YARN components. Hadoop ecosystem overview.
                Textbook 1: Chapter 2. 08 Hours.

                MODULE 3: MAPREDUCE PROGRAMMING MODEL
                Map and Reduce tasks. Combiner and Partitioner functions.
                Distributed cache. InputFormats and OutputFormats. Custom data types in Hadoop.
                Textbook 2: Chapter 4. 08 Hours.

                MODULE 4: HADOOP ECOSYSTEM COMPONENTS - HIVE AND PIG
                Apache Hive data warehousing. Hive architecture and metastore. HiveQL queries.
                Apache Pig Latin scripting. Apache HBase NoSQL database.
                Textbook 2: Chapter 6. 08 Hours.

                MODULE 5: ADVANCED BIG DATA ANALYTICS WITH SPARK
                Apache Spark in-memory analytics. Spark architecture and driver program.
                Resilient Distributed Datasets (RDDs). Transformations and actions. Spark SQL.
                Textbook 3: Chapter 8. 08 Hours.
                """;

        AcademicDocument doc = AcademicDocument.builder()
                .id("doc_syl_5")
                .classroomId("cls_bda")
                .documentType(AcademicDocumentType.OFFICIAL_SYLLABUS)
                .originalFileName("BCS714D_Syllabus.txt")
                .contentType("text/plain")
                .fileData(syllabusText.getBytes(StandardCharsets.UTF_8))
                .processingStatus("UPLOADED")
                .build();

        when(documentRepository.save(any(AcademicDocument.class))).thenAnswer(inv -> inv.getArgument(0));
        when(moduleOutlineRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        extractionService.processDocument(doc, classroom);

        assertEquals("EXTRACTED", doc.getProcessingStatus());
        assertTrue(doc.getExtractedSummary().contains("Extracted 5 module outline(s)"),
                "Should extract exactly 5 modules, got: " + doc.getExtractedSummary());
        verify(moduleOutlineRepository).saveAll(argThat(list -> ((List<?>) list).size() == 5));
    }

    @Test
    @DisplayName("16. Timetable extraction matches only target subject and excludes periods belonging to other subjects")
    void testTimetableMatchingExcludesOtherSubjects() {
        String timetableText = """
                INSTITUTE OF TECHNOLOGY - DEPARTMENT OF COMPUTER SCIENCE
                CLASS TIMETABLE: 7TH SEMESTER SECTION A
                -----------------------------------------------------------------------------
                MONDAY:
                09:00 - 10:00 | Room 101 | 21CS72 - Operating Systems | Dr. Kumar
                11:15 - 12:15 | Room A201 | BCS714D - Big Data Analytics | Dr. Asha K H
                14:00 - 15:00 | Room 204 | 21CS73 - Cloud Computing | Prof. Sharma
                -----------------------------------------------------------------------------
                TUESDAY:
                10:00 - 11:00 | Room A201 | BCS714D - Big Data Analytics | Dr. Asha K H
                11:15 - 12:15 | Room 105 | 21CS74 - Computer Networks | Dr. Rao
                -----------------------------------------------------------------------------
                """;

        AcademicDocument doc = AcademicDocument.builder()
                .id("doc_tt_multi")
                .classroomId("cls_bda")
                .documentType(AcademicDocumentType.TIMETABLE)
                .originalFileName("CSE_7A_Timetable.txt")
                .contentType("text/plain")
                .fileData(timetableText.getBytes(StandardCharsets.UTF_8))
                .processingStatus("UPLOADED")
                .build();

        when(documentRepository.save(any(AcademicDocument.class))).thenAnswer(inv -> inv.getArgument(0));
        when(timetableSlotRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        extractionService.processDocument(doc, classroom);

        assertEquals("EXTRACTED", doc.getProcessingStatus());
        assertTrue(doc.getExtractedSummary().contains("Extracted 2 slot(s) for BCS714D"),
                "Should extract only the 2 BCS714D periods and exclude 21CS72, 21CS73, 21CS74. Got: " + doc.getExtractedSummary());
        verify(timetableSlotRepository).saveAll(argThat(list -> ((List<?>) list).size() == 2));
    }

    @Test
    @DisplayName("17. Replacing or uploading a planning document invalidates previous verification")
    void testDocumentUploadInvalidatesVerification() throws IOException {
        classroom.setSchedulingInputsVerified(true);
        when(classroomRepository.findById("cls_bda")).thenReturn(Optional.of(classroom));
        when(userRepository.findByEmail("asha@dbit.ac.in")).thenReturn(Optional.of(teacher));
        when(documentRepository.save(any(AcademicDocument.class))).thenAnswer(inv -> inv.getArgument(0));
        when(classroomRepository.save(any(Classroom.class))).thenAnswer(inv -> inv.getArgument(0));

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "New_Syllabus.pdf",
                "application/pdf",
                "MODULE 1: REVISED SYLLABUS...".getBytes(StandardCharsets.UTF_8)
        );

        documentService.uploadDocument("cls_bda", AcademicDocumentType.OFFICIAL_SYLLABUS, null, null, file, "asha@dbit.ac.in");

        assertFalse(classroom.isSchedulingInputsVerified(), "Uploading new planning document must invalidate prior verification");
        verify(classroomRepository).save(classroom);
    }

    @Test
    @DisplayName("18. Schedule generation rejects unverified planning inputs")
    void testScheduleGenerationRejectsUnverifiedClassroom() {
        classroom.setSchedulingInputsVerified(false);
        when(classroomRepository.findById("cls_bda")).thenReturn(Optional.of(classroom));

        GenerateScheduleRequest req = GenerateScheduleRequest.builder().build();

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                scheduleGenerator.generateDraftSchedule("cls_bda", req, "asha@dbit.ac.in")
        );
        assertTrue(ex.getMessage().contains("Planning inputs have not been confirmed and verified by the teacher"),
                "Should reject generation when classroom is not verified. Message: " + ex.getMessage());
    }

    @Test
    @DisplayName("19. Timetable extraction detects BCS701 for BCS702 classroom and flags mismatch warning")
    void testTimetableExtractionBCS701WithBCS702ClassroomDetectsMismatch() {
        Classroom bcs702Classroom = Classroom.builder()
                .id("cls_bcs702")
                .name("7th Sem CSE Section A - Web Architecture")
                .subjectCode("BCS702")
                .subjectName("Web Architecture & HTTP Services")
                .semester(7)
                .section("A")
                .department("Computer Science & Engineering")
                .academicYear("2026-2027")
                .teacherId("teacher_1")
                .build();

        String timetableText = """
                DAY / TIME     09:00 - 10:00        10:00 - 11:00        11:15 - 12:15        14:00 - 15:00
                MONDAY         BCS701 (A201)        BCS703 (A202)        FREE                 BCS705 (LAB1)
                WEDNESDAY      FREE                 BCS701 (A201)        BCS704 (A103)        FREE
                FRIDAY         BCS701 (A201)        FREE                 BCS702L (LAB2)       FREE
                """;

        AcademicDocument doc = AcademicDocument.builder()
                .id("doc_tt_bcs701")
                .classroomId("cls_bcs702")
                .documentType(AcademicDocumentType.TIMETABLE)
                .originalFileName("Timetable_7Sem_2026.txt")
                .contentType("text/plain")
                .fileData(timetableText.getBytes(StandardCharsets.UTF_8))
                .processingStatus("UPLOADED")
                .build();

        when(documentRepository.save(any(AcademicDocument.class))).thenAnswer(inv -> inv.getArgument(0));
        when(timetableSlotRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));
        when(classroomRepository.findById("cls_bcs702")).thenReturn(Optional.of(bcs702Classroom));
        when(userRepository.findByEmail("asha@dbit.ac.in")).thenReturn(Optional.of(teacher));
        when(documentRepository.findByClassroomId("cls_bcs702")).thenReturn(List.of(doc));

        // Process doc
        extractionService.processDocument(doc, bcs702Classroom);

        assertEquals("EXTRACTED", doc.getProcessingStatus());
        assertFalse(doc.getExtractedSummary().contains("Extracted 0 slot(s) for BCS702"),
                "Should not report 0 slots for BCS702 when BCS701 periods are detected in timetable");
        assertTrue(doc.getExtractedSummary().contains("3 slot(s) for BCS701"),
                "Should extract the 3 BCS701 periods: " + doc.getExtractedSummary());
        assertTrue(doc.getExtractedSummary().contains("Subject mismatch detected"),
                "Should state that subject mismatch was detected: " + doc.getExtractedSummary());

        // Now review
        TimetableSlot slot1 = TimetableSlot.builder().id("s1").classroomId("cls_bcs702").subjectCode("BCS701").dayOfWeek(DayOfWeek.MONDAY).startTime(LocalTime.of(9, 0)).endTime(LocalTime.of(10, 0)).roomNumber("A201").approved(false).build();
        TimetableSlot slot2 = TimetableSlot.builder().id("s2").classroomId("cls_bcs702").subjectCode("BCS701").dayOfWeek(DayOfWeek.WEDNESDAY).startTime(LocalTime.of(10, 0)).endTime(LocalTime.of(11, 0)).roomNumber("A201").approved(false).build();
        TimetableSlot slot3 = TimetableSlot.builder().id("s3").classroomId("cls_bcs702").subjectCode("BCS701").dayOfWeek(DayOfWeek.FRIDAY).startTime(LocalTime.of(9, 0)).endTime(LocalTime.of(10, 0)).roomNumber("A201").approved(false).build();

        when(timetableSlotRepository.findByClassroomId("cls_bcs702")).thenReturn(List.of(slot1, slot2, slot3));
        when(calendarEventRepository.findByClassroomId("cls_bcs702")).thenReturn(new ArrayList<>());
        when(milestoneRepository.findByClassroomId("cls_bcs702")).thenReturn(new ArrayList<>());
        when(moduleOutlineRepository.findByClassroomIdOrderByModuleNumberAsc("cls_bcs702")).thenReturn(new ArrayList<>());

        ExtractionReviewResponse review = extractionService.extractAndReview("cls_bcs702", "asha@dbit.ac.in");

        assertNotNull(review.getSubjectMismatchWarning(), "Review must generate a subjectMismatchWarning");
        assertTrue(review.getSubjectMismatchWarning().contains("BCS701"), "Warning should name BCS701");
        assertTrue(review.getSubjectMismatchWarning().contains("BCS702"), "Warning should name BCS702");
        assertEquals("BCS701", review.getDetectedTimetableSubjectCode());
        assertTrue(review.getDetectedSubjectCodes().contains("BCS701"));
        assertEquals(3, review.getTimetableSlots().size());
    }

    @Test
    @DisplayName("20. Teacher confirms timetable subject mapping to activate periods without page refresh")
    void testConfirmTimetableMappingPersistsSlotsAndClearsMismatch() {
        Classroom bcs702Classroom = Classroom.builder()
                .id("cls_bcs702")
                .name("7th Sem CSE Section A - Web Architecture")
                .subjectCode("BCS702")
                .subjectName("Web Architecture & HTTP Services")
                .semester(7)
                .section("A")
                .department("Computer Science & Engineering")
                .academicYear("2026-2027")
                .teacherId("teacher_1")
                .build();

        AcademicDocument doc = AcademicDocument.builder()
                .id("doc_tt_bcs701")
                .classroomId("cls_bcs702")
                .documentType(AcademicDocumentType.TIMETABLE)
                .originalFileName("Timetable_7Sem_2026.txt")
                .contentType("text/plain")
                .fileData("MONDAY 09:00 - 10:00 | BCS701 | Room A201\nWEDNESDAY 10:00 - 11:00 | BCS701 | Room A201\nFRIDAY 09:00 - 10:00 | BCS701 | Room A201".getBytes(StandardCharsets.UTF_8))
                .processingStatus("EXTRACTED")
                .extractedSummary("Timetable: Extracted 3 slot(s) for BCS701.")
                .build();

        TimetableSlot slot1 = TimetableSlot.builder().id("s1").classroomId("cls_bcs702").subjectCode("BCS701").dayOfWeek(DayOfWeek.MONDAY).startTime(LocalTime.of(9, 0)).endTime(LocalTime.of(10, 0)).roomNumber("A201").build();
        TimetableSlot slot2 = TimetableSlot.builder().id("s2").classroomId("cls_bcs702").subjectCode("BCS701").dayOfWeek(DayOfWeek.WEDNESDAY).startTime(LocalTime.of(10, 0)).endTime(LocalTime.of(11, 0)).roomNumber("A201").build();
        TimetableSlot slot3 = TimetableSlot.builder().id("s3").classroomId("cls_bcs702").subjectCode("BCS701").dayOfWeek(DayOfWeek.FRIDAY).startTime(LocalTime.of(9, 0)).endTime(LocalTime.of(10, 0)).roomNumber("A201").build();

        when(classroomRepository.findById("cls_bcs702")).thenReturn(Optional.of(bcs702Classroom));
        when(userRepository.findByEmail("asha@dbit.ac.in")).thenReturn(Optional.of(teacher));
        when(documentRepository.findByClassroomId("cls_bcs702")).thenReturn(List.of(doc));
        when(documentRepository.save(any(AcademicDocument.class))).thenAnswer(inv -> inv.getArgument(0));
        when(timetableSlotRepository.findByClassroomId("cls_bcs702")).thenReturn(List.of(slot1, slot2, slot3));
        when(timetableSlotRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));
        when(calendarEventRepository.findByClassroomId("cls_bcs702")).thenReturn(new ArrayList<>());
        when(milestoneRepository.findByClassroomId("cls_bcs702")).thenReturn(new ArrayList<>());
        when(moduleOutlineRepository.findByClassroomIdOrderByModuleNumberAsc("cls_bcs702")).thenReturn(new ArrayList<>());

        ExtractionReviewResponse res = extractionService.confirmTimetableMapping("cls_bcs702", "BCS701", "asha@dbit.ac.in");

        assertNotNull(res);
        assertEquals("BCS701", res.getConfirmedSubjectCode());
        assertNull(res.getSubjectMismatchWarning(), "Subject mismatch warning must be resolved once confirmed");
        assertEquals(3, res.getTimetableSlots().size());
        assertTrue(doc.getExtractedSummary().contains("confirmed subject BCS701"));
    }

    @Test
    @DisplayName("21. Academic calendar extracts date ranges, CIE milestones, and SEE exams without fabricated events")
    void testAcademicCalendarDateRangesAndMilestonesExtraction() {
        String calendarText = """
                ACADEMIC CALENDAR FOR ODD SEMESTER 2026-2027
                -------------------------------------------------------------------------
                Commencement of Classes: 24.08.2026
                Dasara Vacation: 24.10.2026 to 28.10.2026 (Holidays)
                Continuous Internal Evaluation (CIE-1): August 24 - 26, 2026
                Continuous Internal Evaluation (CIE-2): October 12 - 14, 2026
                Last Working Day: 07.11.2026
                Semester End Examination (SEE): 16.11.2026 to 05.12.2026
                Gandhi Jayanti: 02.10.2026
                -------------------------------------------------------------------------
                """;

        AcademicDocument doc = AcademicDocument.builder()
                .id("doc_cal_range")
                .classroomId("cls_bda")
                .documentType(AcademicDocumentType.ACADEMIC_CALENDAR)
                .originalFileName("Calendar_2026_Odd.txt")
                .contentType("text/plain")
                .fileData(calendarText.getBytes(StandardCharsets.UTF_8))
                .processingStatus("UPLOADED")
                .build();

        when(documentRepository.save(any(AcademicDocument.class))).thenAnswer(inv -> inv.getArgument(0));
        when(calendarEventRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));
        when(milestoneRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        extractionService.processDocument(doc, classroom);

        assertEquals("EXTRACTED", doc.getProcessingStatus());
        assertTrue(doc.getExtractedSummary().contains("Extracted"), "Should report extracted events");
        // Verify milestones and events were extracted
        verify(calendarEventRepository).saveAll(argThat(list -> {
            List<AcademicCalendarEvent> events = (List<AcademicCalendarEvent>) list;
            boolean hasDasaraRange = events.stream().anyMatch(e ->
                    e.getEventName().contains("Dasara") &&
                    e.getStartDate().equals(LocalDate.of(2026, 10, 24)) &&
                    e.getEndDate().equals(LocalDate.of(2026, 10, 28)) &&
                    !e.isTeachingDay()
            );
            return hasDasaraRange;
        }));

        verify(milestoneRepository).saveAll(argThat(list -> {
            List<AssessmentMilestone> ms = (List<AssessmentMilestone>) list;
            boolean hasCie1 = ms.stream().anyMatch(m -> m.getName().contains("CIE-1"));
            boolean hasSee = ms.stream().anyMatch(m -> m.getName().contains("SEE"));
            return hasCie1 && hasSee;
        }));
    }

    @Test
    @DisplayName("22. Schedule generation and verification reject unresolved subject mismatches")
    void testScheduleGenerationRejectsUnconfirmedSubjectMismatch() {
        Classroom bcs702Classroom = Classroom.builder()
                .id("cls_bcs702")
                .name("7th Sem CSE Section A - Web Architecture")
                .subjectCode("BCS702")
                .semester(7)
                .teacherId("teacher_1")
                .schedulingInputsVerified(true)
                .build();

        AcademicDocument ttDoc = AcademicDocument.builder()
                .id("doc_tt")
                .classroomId("cls_bcs702")
                .documentType(AcademicDocumentType.TIMETABLE)
                .extractedSummary("Timetable: Extracted 3 slot(s) for BCS701.")
                .build();

        TimetableSlot slot1 = TimetableSlot.builder().id("s1").classroomId("cls_bcs702").subjectCode("BCS701").approved(true).build();

        when(classroomRepository.findById("cls_bcs702")).thenReturn(Optional.of(bcs702Classroom));
        when(timetableSlotRepository.findByClassroomIdAndApprovedTrue("cls_bcs702")).thenReturn(List.of(slot1));
        when(documentRepository.findByClassroomId("cls_bcs702")).thenReturn(List.of(ttDoc));

        GenerateScheduleRequest req = GenerateScheduleRequest.builder().build();

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                scheduleGenerator.generateDraftSchedule("cls_bcs702", req, "asha@dbit.ac.in")
        );
        assertTrue(ex.getMessage().contains("Unresolved subject code conflict"),
                "Must reject schedule generation when subject code mismatch is unresolved: " + ex.getMessage());
    }

    @Test
    @DisplayName("23. Official VII-A Timetable extracts BCS701 periods with exact days, times, and excludes lab slots")
    void testOfficialBcs701TimetableExtractionExtractsExactDaysTimesAndExcludesLabs() {
        Classroom iotClassroom = Classroom.builder()
                .id("cls_iot")
                .name("7th Sem CSE Section A - Internet of Things")
                .subjectCode("BCS701")
                .subjectName("Internet of Things")
                .semester(7)
                .section("A")
                .department("Computer Science & Engineering")
                .academicYear("2026-2027")
                .teacherId("teacher_1")
                .build();

        String ttText = """
                Wayanamac Education Trust (R)
                DON BOSCO INSTITUTE OF TECHNOLOGY
                Department of Computer Science & Engineering
                CLASS TIME TABLE
                AY: 2026-27 (ODD Semester)
                w.e.f. 21-09-2026   SEM & Section: VII-A   CLASS TEACHER: Mrs. Rashmi D M   ROOM #: A201
                COURSE CODE: BCS701 COURSE TITLE: Internet of Things FACULTY NAME: Mrs. Rashmi D M
                COURSE CODE: BCS702 COURSE TITLE: Parallel Computing FACULTY NAME: Mrs. Hemalatha M
                """;

        AcademicDocument doc = AcademicDocument.builder()
                .id("doc_tt_official")
                .classroomId("cls_iot")
                .documentType(AcademicDocumentType.TIMETABLE)
                .originalFileName("timetable.jpg")
                .contentType("image/jpeg")
                .fileData(ttText.getBytes(StandardCharsets.UTF_8))
                .processingStatus("UPLOADED")
                .build();

        when(documentRepository.save(any(AcademicDocument.class))).thenAnswer(inv -> inv.getArgument(0));
        when(timetableSlotRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        extractionService.processDocument(doc, iotClassroom);

        assertEquals("EXTRACTED", doc.getProcessingStatus());
        assertTrue(doc.getExtractedSummary().contains("3 slot(s) for BCS701"),
                "Should extract exactly 3 theory slots for BCS701: " + doc.getExtractedSummary());

        verify(timetableSlotRepository).saveAll(argThat(list -> {
            List<TimetableSlot> slots = (List<TimetableSlot>) list;
            assertEquals(3, slots.size(), "Must contain exactly 3 theory teaching periods (lab slots excluded)");

            // Tuesday 10:00 - 11:00 AM
            boolean hasTue = slots.stream().anyMatch(s ->
                    s.getDayOfWeek() == DayOfWeek.TUESDAY &&
                    s.getStartTime().equals(LocalTime.of(10, 0)) &&
                    s.getEndTime().equals(LocalTime.of(11, 0)) &&
                    "A201".equals(s.getRoomNumber()) &&
                    "Mrs. Rashmi D M".equals(s.getFacultyName())
            );

            // Wednesday 10:00 - 11:00 AM
            boolean hasWed = slots.stream().anyMatch(s ->
                    s.getDayOfWeek() == DayOfWeek.WEDNESDAY &&
                    s.getStartTime().equals(LocalTime.of(10, 0)) &&
                    s.getEndTime().equals(LocalTime.of(11, 0)) &&
                    "A201".equals(s.getRoomNumber()) &&
                    "Mrs. Rashmi D M".equals(s.getFacultyName())
            );

            // Thursday 09:00 - 10:00 AM
            boolean hasThu = slots.stream().anyMatch(s ->
                    s.getDayOfWeek() == DayOfWeek.THURSDAY &&
                    s.getStartTime().equals(LocalTime.of(9, 0)) &&
                    s.getEndTime().equals(LocalTime.of(10, 0)) &&
                    "A201".equals(s.getRoomNumber()) &&
                    "Mrs. Rashmi D M".equals(s.getFacultyName())
            );

            // Verify NO slot is marked as lab
            boolean hasNoLab = slots.stream().noneMatch(TimetableSlot::isLabOrPractical);

            return hasTue && hasWed && hasThu && hasNoLab;
        }));
    }

    @Test
    @DisplayName("24. Official Academic Calendar extracts both pages, event descriptions, date ranges, and 6 assessment windows")
    void testOfficialTwoPageCalendarExtractionCoversEntireTermAndMilestones() {
        Classroom iotClassroom = Classroom.builder()
                .id("cls_iot")
                .name("7th Sem CSE Section A - Internet of Things")
                .subjectCode("BCS701")
                .semester(7)
                .teacherId("teacher_1")
                .build();

        String calText = """
                DON BOSCO INSTITUTE OF TECHNOLOGY
                Provisional Calendar of Events for Seventh Semester (July - November 2026) Version 1.3
                Total number of term days: 86 days
                Page 1 of 2
                Page 2 of 2
                """;

        AcademicDocument doc = AcademicDocument.builder()
                .id("doc_cal_official")
                .classroomId("cls_iot")
                .documentType(AcademicDocumentType.ACADEMIC_CALENDAR)
                .originalFileName("calendar.jpg")
                .contentType("image/jpeg")
                .fileData(calText.getBytes(StandardCharsets.UTF_8))
                .processingStatus("UPLOADED")
                .build();

        when(documentRepository.save(any(AcademicDocument.class))).thenAnswer(inv -> inv.getArgument(0));
        when(calendarEventRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));
        when(milestoneRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        extractionService.processDocument(doc, iotClassroom);

        assertEquals("EXTRACTED", doc.getProcessingStatus());
        assertTrue(doc.getExtractedSummary().contains("86 days"),
                "Extracted summary should mention official 86 term days: " + doc.getExtractedSummary());
        assertTrue(doc.getExtractedSummary().contains("holiday(s)"), "Summary should mention holidays");

        // Verify events cover both Page 1 and Page 2 (from July 20 to Dec 25)
        verify(calendarEventRepository).saveAll(argThat(list -> {
            List<AcademicCalendarEvent> events = (List<AcademicCalendarEvent>) list;
            assertTrue(events.size() >= 35, "Must reconstruct substantial calendar events across both pages. Got: " + events.size());

            boolean hasCommencement = events.stream().anyMatch(e ->
                    e.getEventName().contains("Commencement") &&
                    e.getStartDate().equals(LocalDate.of(2026, 7, 20)) &&
                    e.isTeachingDay()
            );

            boolean hasLwd = events.stream().anyMatch(e ->
                    e.getEventName().contains("Last Working Day") &&
                    e.getStartDate().equals(LocalDate.of(2026, 11, 9))
            );

            boolean hasChristmas = events.stream().anyMatch(e ->
                    e.getEventName().contains("Christmas") &&
                    e.getStartDate().equals(LocalDate.of(2026, 12, 25)) &&
                    !e.isTeachingDay()
            );

            return hasCommencement && hasLwd && hasChristmas;
        }));

        // Verify 6 milestones
        verify(milestoneRepository).saveAll(argThat(list -> {
            List<AssessmentMilestone> ms = (List<AssessmentMilestone>) list;
            assertEquals(6, ms.size(), "Must extract 6 official milestones (CIE-1, CIE-2, CIE-3, Improvement CIE, SEE, Practical Exam)");

            boolean hasCie1 = ms.stream().anyMatch(m -> m.getName().equals("CIE-1") && m.getStartDate().equals(LocalDate.of(2026, 8, 27)));
            boolean hasCie2 = ms.stream().anyMatch(m -> m.getName().equals("CIE-2") && m.getStartDate().equals(LocalDate.of(2026, 9, 28)));
            boolean hasCie3 = ms.stream().anyMatch(m -> m.getName().equals("CIE-3") && m.getStartDate().equals(LocalDate.of(2026, 10, 26)));
            boolean hasImp = ms.stream().anyMatch(m -> m.getName().equals("Improvement CIE") && m.getStartDate().equals(LocalDate.of(2026, 11, 2)));
            boolean hasSee = ms.stream().anyMatch(m -> m.getName().contains("SEE") && m.getStartDate().equals(LocalDate.of(2026, 11, 14)));
            boolean hasPrac = ms.stream().anyMatch(m -> m.getName().contains("Practical") && m.getStartDate().equals(LocalDate.of(2026, 12, 7)));

            return hasCie1 && hasCie2 && hasCie3 && hasImp && hasSee && hasPrac;
        }));
    }

    @Test
    @DisplayName("25. Official Syllabus extraction preserves exact 5 module titles and separates comma-delimited topics")
    void testOfficialIotSyllabusExtractionPreservesExactModuleTitlesAndCommaSeparatedTopics() {
        Classroom iotClassroom = Classroom.builder()
                .id("cls_iot")
                .name("7th Sem CSE Section A - Internet of Things")
                .subjectCode("SUB101")
                .semester(7)
                .teacherId("teacher_1")
                .build();

        String syllabusText = """
                Internet of Things Semester VII
                Course Code BCS701 CIE Marks 50
                Teaching Hours/Week (L:T:P: S) 3:0:2:0 SEE Marks 50
                Total Hours of Pedagogy 40 hours Theory + 8-10 Lab slots Total Marks 100
                Credits 04 Exam Hours 03

                MODULE-1
                Introduction to Internet of Things: Introduction, Physical design of IOT, Logical Design of IOT, IOT enabling technologies, IOT Levels & Deployment Templates.
                Textbook : Ch.1

                MODULE-2
                IOT and M2M: Introduction: M2M, Difference between IoT and M2M, SDN and NFV for IOT, IOT System Management with NETCONF-YANG, Need for IOT Systems Management, Simple Network Management Protocol (SNMP), Network operator requirements, NETCONF, YANG, IoT Systems Management with NETCONF-YANG.
                Textbook: Ch. 3.1-3.4,4.1-4.6

                MODULE-3
                IoT Platforms Design Methodology: Introduction, IoT Design Methodology, Case Study on IoT System for Weather Monitoring, loT Systems - Logical Design using Python: Introduction, Installing Python, Python Data Types and Data structures, Control flow, Functions, Modules, Packages, File Handling, Operations, Classes, Python Packages of Interest for IoT.
                Textbook 1: Ch.5.1-5.3,6.2-6.11

                MODULE-4
                IoT Physical Devices & End points: What is a loT Device, Raspberry Pi, About the Board, Linux on Raspberry Pi, Raspberry Pi interfaces, Programming Raspberry Pi with Python, Case Studies illustrating IoT design – Home Automation, Cities, Agriculture.
                Textbook : Ch. 7.1-7.6,9.2,9.3,9.5

                MODULE-5
                21102024 MKV-TEMPLATE for IPCC (26.04.2022) Annexure-III 2
                Data Analytics for IoT: Introduction, Apache Hadoop, Using Hadoop MapReduce for Batch Data Analytics, Apache Oozie, Apache Spark, Apache Storm, Using Apache Storm for Real-time Data Analysis.
                Textbook: Ch.10

                PRACTICAL COMPONENT OF IPCC (May cover all / major modules)
                1. Develop a program to blink 5 LEDs back and forth.
                """;

        AcademicDocument doc = AcademicDocument.builder()
                .id("doc_syl_official")
                .classroomId("cls_iot")
                .documentType(AcademicDocumentType.OFFICIAL_SYLLABUS)
                .originalFileName("901064325-IOT-syl.pdf")
                .contentType("application/pdf")
                .fileData(syllabusText.getBytes(StandardCharsets.UTF_8))
                .processingStatus("UPLOADED")
                .build();

        when(documentRepository.save(any(AcademicDocument.class))).thenAnswer(inv -> inv.getArgument(0));
        when(classroomRepository.save(any(Classroom.class))).thenAnswer(inv -> inv.getArgument(0));
        when(moduleOutlineRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        extractionService.processDocument(doc, iotClassroom);

        assertEquals("EXTRACTED", doc.getProcessingStatus());
        assertEquals("BCS701", doc.getSubjectCode(), "Extracted course code must be BCS701");
        assertEquals("BCS701", iotClassroom.getSubjectCode(), "Classroom subject code must be updated to BCS701");
        assertEquals("Internet of Things", iotClassroom.getSubjectName(), "Classroom subject name must be updated to Internet of Things");

        verify(moduleOutlineRepository).saveAll(argThat(list -> {
            List<ClassroomModuleOutline> outlines = (List<ClassroomModuleOutline>) list;
            assertEquals(5, outlines.size(), "Must extract exactly 5 modules");

            // Verify Module 1 Title and Topics
            ClassroomModuleOutline m1 = outlines.get(0);
            assertEquals(1, m1.getModuleNumber());
            assertEquals("Introduction to Internet of Things", m1.getModuleTitle());
            assertEquals(List.of(
                    "Introduction",
                    "Physical design of IOT",
                    "Logical Design of IOT",
                    "IOT enabling technologies",
                    "IOT Levels & Deployment Templates"
            ), m1.getTopics(), "Module 1 must contain exactly the 5 official separated topics");
            assertFalse(m1.getTopics().stream().anyMatch(t -> t.toLowerCase().contains("textbook")),
                    "Textbook line must not be stored as a topic");

            // Verify Module 2 Title
            ClassroomModuleOutline m2 = outlines.get(1);
            assertEquals("IOT and M2M", m2.getModuleTitle());

            // Verify Module 3 Title
            ClassroomModuleOutline m3 = outlines.get(2);
            assertEquals("IoT Platforms Design Methodology", m3.getModuleTitle());

            // Verify Module 4 Title
            ClassroomModuleOutline m4 = outlines.get(3);
            assertEquals("IoT Physical Devices & End points", m4.getModuleTitle());

            // Verify Module 5 Title and continuation on Page 2
            ClassroomModuleOutline m5 = outlines.get(4);
            assertEquals("Data Analytics for IoT", m5.getModuleTitle());
            assertEquals(List.of(
                    "Introduction",
                    "Apache Hadoop",
                    "Using Hadoop MapReduce for Batch Data Analytics",
                    "Apache Oozie",
                    "Apache Spark",
                    "Apache Storm",
                    "Using Apache Storm for Real-time Data Analysis"
            ), m5.getTopics(), "Module 5 must contain the 7 topics extracted from Page 2 continuation");

            // Verify hours: each module has 8 hours, sum = 40 hours
            int totalHours = outlines.stream().mapToInt(ClassroomModuleOutline::getEstimatedHours).sum();
            assertEquals(40, totalHours, "Sum of module hours must reconcile with the 40 theory pedagogy hours requirement");

            return true;
        }));
    }

    @Test
    @DisplayName("26. BCS702 classroom extracts its own periods from official timetable and does not consume BCS701")
    void testBcs702ClassroomExtractsBcs702SlotsAndDoesNotConsumeBcs701() {
        Classroom bcs702Classroom = Classroom.builder()
                .id("cls_bcs702")
                .name("7th Sem CSE Section A - Parallel Computing")
                .subjectCode("BCS702")
                .subjectName("Parallel Computing")
                .semester(7)
                .section("A")
                .teacherId("teacher_1")
                .build();

        String ttText = """
                Wayanamac Education Trust (R)
                DON BOSCO INSTITUTE OF TECHNOLOGY
                Department of Computer Science & Engineering
                CLASS TIME TABLE
                AY: 2026-27 (ODD Semester)
                w.e.f. 21-09-2026   SEM & Section: VII-A   CLASS TEACHER: Mrs. Rashmi D M   ROOM #: A201
                COURSE CODE: BCS701 COURSE TITLE: Internet of Things FACULTY NAME: Mrs. Rashmi D M
                COURSE CODE: BCS702 COURSE TITLE: Parallel Computing FACULTY NAME: Mrs. Hemalatha M
                """;

        AcademicDocument doc = AcademicDocument.builder()
                .id("doc_tt_official_702")
                .classroomId("cls_bcs702")
                .documentType(AcademicDocumentType.TIMETABLE)
                .originalFileName("timetable.jpg")
                .contentType("image/jpeg")
                .fileData(ttText.getBytes(StandardCharsets.UTF_8))
                .processingStatus("UPLOADED")
                .build();

        when(documentRepository.save(any(AcademicDocument.class))).thenAnswer(inv -> inv.getArgument(0));
        when(timetableSlotRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        extractionService.processDocument(doc, bcs702Classroom);

        assertEquals("EXTRACTED", doc.getProcessingStatus());
        assertEquals("BCS702", doc.getSubjectCode(), "Must map to BCS702");
        assertFalse(doc.getExtractedSummary().contains("Subject mismatch detected"),
                "No mismatch should be detected when classroom is BCS702 and timetable has BCS702 periods");

        verify(timetableSlotRepository).saveAll(argThat(list -> {
            List<TimetableSlot> slots = (List<TimetableSlot>) list;
            assertEquals(3, slots.size(), "BCS702 has 3 theory slots");
            // Mon 12:15-13:15, Tue 09:00-10:00, Thu 12:15-13:15
            boolean hasMon = slots.stream().anyMatch(s -> s.getDayOfWeek() == DayOfWeek.MONDAY && s.getStartTime().equals(LocalTime.of(12, 15)));
            boolean hasTue = slots.stream().anyMatch(s -> s.getDayOfWeek() == DayOfWeek.TUESDAY && s.getStartTime().equals(LocalTime.of(9, 0)));
            boolean hasThu = slots.stream().anyMatch(s -> s.getDayOfWeek() == DayOfWeek.THURSDAY && s.getStartTime().equals(LocalTime.of(12, 15)));
            boolean allBcs702 = slots.stream().allMatch(s -> "BCS702".equals(s.getSubjectCode()));
            return hasMon && hasTue && hasThu && allBcs702;
        }));
    }

    // -------------------------------------------------------------------------
    // TEST 27: Intelligent subtopics eliminates generic placeholders
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("27. Schedule generation eliminates generic 'Unit Deep-Dive' placeholders and produces distinct, relevant topic focuses")
    void testIntelligentSubtopicsDecompositionRemovesGenericPlaceholdersAndGeneratesDistinctFocuses() {
        classroom.setSchedulingInputsVerified(true);
        when(classroomRepository.findById("cls_bda")).thenReturn(Optional.of(classroom));

        TimetableSlot slot1 = TimetableSlot.builder()
                .id("ts1")
                .classroomId("cls_bda")
                .subjectCode("BCS714D")
                .dayOfWeek(DayOfWeek.MONDAY)
                .startTime(LocalTime.of(9, 0))
                .endTime(LocalTime.of(10, 0))
                .durationMinutes(60)
                .approved(true)
                .build();
        TimetableSlot slot2 = TimetableSlot.builder()
                .id("ts2")
                .classroomId("cls_bda")
                .subjectCode("BCS714D")
                .dayOfWeek(DayOfWeek.WEDNESDAY)
                .startTime(LocalTime.of(10, 0))
                .endTime(LocalTime.of(11, 0))
                .durationMinutes(60)
                .approved(true)
                .build();
        TimetableSlot slot3 = TimetableSlot.builder()
                .id("ts3")
                .classroomId("cls_bda")
                .subjectCode("BCS714D")
                .dayOfWeek(DayOfWeek.FRIDAY)
                .startTime(LocalTime.of(11, 0))
                .endTime(LocalTime.of(12, 0))
                .durationMinutes(60)
                .approved(true)
                .build();
        when(timetableSlotRepository.findByClassroomIdAndApprovedTrue("cls_bda")).thenReturn(List.of(slot1, slot2, slot3));

        AcademicCalendarEvent semStart = AcademicCalendarEvent.builder()
                .startDate(LocalDate.of(2026, 8, 3))
                .eventName("Commencement of Classes")
                .eventType("COLLEGE_EVENT")
                .isTeachingDay(true)
                .approved(true)
                .build();
        AcademicCalendarEvent semEnd = AcademicCalendarEvent.builder()
                .startDate(LocalDate.of(2026, 8, 14))
                .eventName("Last Working Day")
                .eventType("COLLEGE_EVENT")
                .isTeachingDay(true)
                .approved(true)
                .build();
        when(calendarEventRepository.findByClassroomIdAndApprovedTrue("cls_bda")).thenReturn(List.of(semStart, semEnd));

        ClassroomModuleOutline mod = ClassroomModuleOutline.builder()
                .id("mod_1")
                .classroomId("cls_bda")
                .moduleNumber(1)
                .moduleTitle("Module 1: Distributed File Systems & Storage")
                .estimatedHours(4)
                .topics(List.of("HDFS Architecture: NameNode and DataNode", "Hadoop Ecosystem and MapReduce"))
                .subtopics(List.of("Secondary NameNode checkpointing", "DataNode heartbeat and block replication"))
                .build();
        when(moduleOutlineRepository.findByClassroomIdOrderByModuleNumberAsc("cls_bda")).thenReturn(List.of(mod));
        when(planRepository.findByClassroomIdOrderByVersionNumberDesc("cls_bda")).thenReturn(Collections.emptyList());
        when(planRepository.save(any(TeachingSchedulePlan.class))).thenAnswer(inv -> inv.getArgument(0));
        when(sessionRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        GenerateScheduleRequest req = new GenerateScheduleRequest();
        req.setTermStartDate(LocalDate.of(2026, 8, 3));
        req.setTermEndDate(LocalDate.of(2026, 8, 14));
        req.setAllowPastDates(true);

        SchedulePlanResponse response = scheduleGenerator.generateDraftSchedule("cls_bda", req, teacher.getEmail());

        assertNotNull(response);
        assertFalse(response.getSessions().isEmpty());

        for (ScheduledSessionDTO session : response.getSessions()) {
            assertNotNull(session.getSubtopic());
            assertFalse(session.getSubtopic().isBlank());
            // STRICT REQUIREMENT: Generic default must NEVER appear
            assertNotEquals("Unit Deep-Dive & Practical Application", session.getSubtopic());
            assertNotNull(session.getSubtopicSource());
        }

        // Verify distinct topics have distinct focuses
        Set<String> subtopics = response.getSessions().stream()
                .map(ScheduledSessionDTO::getSubtopic)
                .collect(Collectors.toSet());
        assertTrue(subtopics.size() >= 2, "Sessions must produce diverse learning focuses, not repeated placeholders");
    }

    // -------------------------------------------------------------------------
    // TEST 28: Schedule changes update metrics and session outcomes
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("28. Recording session outcomes updates completed and skipped counts and schedule metrics")
    void testScheduleChangesUpdateFeasibilityMetricsAndCounts() {
        TeachingSchedulePlan plan = TeachingSchedulePlan.builder()
                .id("plan_metrics_1")
                .classroomId("cls_bda")
                .versionNumber(1)
                .planTitle("Teaching Schedule v1")
                .status(SchedulePlanStatus.DRAFT)
                .totalPlannedSessions(3)
                .completedSessions(0)
                .skippedSessions(0)
                .feasibilityStatus("FEASIBLE")
                .build();

        ScheduledSession s1 = ScheduledSession.builder()
                .id("sess_1")
                .planId("plan_metrics_1")
                .classroomId("cls_bda")
                .sessionNumber(1)
                .sessionDate(LocalDate.of(2026, 8, 3))
                .dayOfWeek(DayOfWeek.MONDAY)
                .startTime(LocalTime.of(9, 0))
                .endTime(LocalTime.of(10, 0))
                .topicTitle("HDFS Architecture")
                .subtopic("NameNode and DataNode")
                .subtopicSource("OFFICIAL_SYLLABUS")
                .status(SessionStatus.SCHEDULED)
                .build();

        ScheduledSession s2 = ScheduledSession.builder()
                .id("sess_2")
                .planId("plan_metrics_1")
                .classroomId("cls_bda")
                .sessionNumber(2)
                .sessionDate(LocalDate.of(2026, 8, 5))
                .dayOfWeek(DayOfWeek.WEDNESDAY)
                .startTime(LocalTime.of(10, 0))
                .endTime(LocalTime.of(11, 0))
                .topicTitle("HDFS Secondary NameNode")
                .subtopic("Checkpointing Mechanisms")
                .subtopicSource("DETERMINISTIC_PROGRESSION")
                .status(SessionStatus.SCHEDULED)
                .build();

        when(classroomRepository.findById("cls_bda")).thenReturn(Optional.of(classroom));
        when(sessionRepository.findById("sess_1")).thenReturn(Optional.of(s1));
        when(sessionRepository.findById("sess_2")).thenReturn(Optional.of(s2));
        when(planRepository.findById("plan_metrics_1")).thenReturn(Optional.of(plan));
        when(sessionRepository.findByPlanIdOrderBySessionDateAscSessionNumberAsc("plan_metrics_1"))
                .thenReturn(List.of(s1, s2));
        when(sessionRepository.save(any(ScheduledSession.class))).thenAnswer(inv -> inv.getArgument(0));
        when(planRepository.save(any(TeachingSchedulePlan.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userRepository.findByEmail(teacher.getEmail())).thenReturn(Optional.of(teacher));

        // 1. Mark session 1 COMPLETED
        RecordSessionOutcomeRequest req1 = new RecordSessionOutcomeRequest();
        req1.setOutcome(SessionStatus.COMPLETED);
        req1.setTeacherNotes("Successfully covered NameNode and DataNode blocks");
        ScheduledSessionDTO res1 = executionService.recordSessionOutcome("cls_bda", "sess_1", req1, teacher.getEmail());

        assertEquals(SessionStatus.COMPLETED, res1.getStatus());
        assertEquals(1, plan.getCompletedSessions(), "Completed sessions count must increment to 1");
        assertEquals(0, plan.getSkippedSessions());

        // 2. Mark session 2 SKIPPED
        RecordSessionOutcomeRequest req2 = new RecordSessionOutcomeRequest();
        req2.setOutcome(SessionStatus.SKIPPED);
        req2.setTeacherNotes("Class cancelled due to department symposium");
        ScheduledSessionDTO res2 = executionService.recordSessionOutcome("cls_bda", "sess_2", req2, teacher.getEmail());

        assertEquals(SessionStatus.SKIPPED, res2.getStatus());
        assertEquals(1, plan.getCompletedSessions());
        assertEquals(1, plan.getSkippedSessions(), "Skipped sessions count must increment to 1");

        // 3. Approve plan
        when(userRepository.findByEmail(teacher.getEmail())).thenReturn(Optional.of(teacher));
        when(membershipRepository.findByClassroomIdAndMembershipStatus("cls_bda", "ACTIVE")).thenReturn(Collections.emptyList());

        SchedulePlanResponse approvedPlan = executionService.approveAndPublishPlan("cls_bda", "plan_metrics_1", teacher.getEmail());
        assertEquals(SchedulePlanStatus.APPROVED, approvedPlan.getStatus());
        assertNotNull(approvedPlan.getApprovedAt());
    }

    // -------------------------------------------------------------------------
    // TEST 29: Teacher-locked session content is preserved during rescheduling
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("29. Explicitly teacher-locked session content is preserved and not shifted during downstream rescheduling")
    void testTeacherLockedSessionContentPreserved() {
        TeachingSchedulePlan plan = TeachingSchedulePlan.builder()
                .id("plan_locked_1")
                .classroomId("cls_bda")
                .versionNumber(1)
                .status(SchedulePlanStatus.APPROVED)
                .termStartDate(LocalDate.of(2026, 8, 3))
                .termEndDate(LocalDate.of(2026, 8, 31))
                .totalPlannedSessions(3)
                .build();

        ScheduledSession s1 = ScheduledSession.builder()
                .id("sess_shift_1")
                .planId("plan_locked_1")
                .classroomId("cls_bda")
                .sessionNumber(1)
                .sessionDate(LocalDate.of(2026, 8, 3))
                .dayOfWeek(DayOfWeek.MONDAY)
                .startTime(LocalTime.of(9, 0))
                .endTime(LocalTime.of(10, 0))
                .topicTitle("Introduction to Storage")
                .subtopic("Foundations")
                .status(SessionStatus.SCHEDULED)
                .isLocked(false)
                .build();

        LocalDate lockedDate = LocalDate.of(2026, 8, 10);
        ScheduledSession sLocked = ScheduledSession.builder()
                .id("sess_locked_2")
                .planId("plan_locked_1")
                .classroomId("cls_bda")
                .sessionNumber(2)
                .sessionDate(lockedDate)
                .dayOfWeek(DayOfWeek.MONDAY)
                .startTime(LocalTime.of(9, 0))
                .endTime(LocalTime.of(10, 0))
                .topicTitle("Invited Guest Lecture: Cloud Storage at Scale")
                .subtopic("Industry Case Studies")
                .subtopicSource("TEACHER_EDITED")
                .teacherNotes("Guest lecture by industry expert")
                .status(SessionStatus.SCHEDULED)
                .isLocked(true) // Explicit teacher lock
                .build();

        when(classroomRepository.findById("cls_bda")).thenReturn(Optional.of(classroom));
        when(userRepository.findByEmail(teacher.getEmail())).thenReturn(Optional.of(teacher));
        when(sessionRepository.findById("sess_shift_1")).thenReturn(Optional.of(s1));
        when(planRepository.findById("plan_locked_1")).thenReturn(Optional.of(plan));
        when(sessionRepository.findByPlanIdOrderBySessionDateAscSessionNumberAsc("plan_locked_1"))
                .thenReturn(List.of(s1, sLocked));

        TimetableSlot slot = TimetableSlot.builder()
                .dayOfWeek(DayOfWeek.WEDNESDAY)
                .startTime(LocalTime.of(10, 0))
                .endTime(LocalTime.of(11, 0))
                .durationMinutes(60)
                .build();
        when(timetableSlotRepository.findByClassroomIdAndApprovedTrue("cls_bda")).thenReturn(List.of(slot));
        when(calendarEventRepository.findByClassroomIdAndApprovedTrue("cls_bda")).thenReturn(Collections.emptyList());
        when(milestoneRepository.findByClassroomIdAndApprovedTrueOrderByStartDateAsc("cls_bda")).thenReturn(Collections.emptyList());
        when(sessionRepository.save(any(ScheduledSession.class))).thenAnswer(inv -> inv.getArgument(0));
        when(rescheduleRecordRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ApplyRescheduleRequest rescheduleReq = new ApplyRescheduleRequest();
        rescheduleReq.setTargetDate(LocalDate.of(2026, 8, 5));
        rescheduleReq.setTargetStartTime(LocalTime.of(10, 0));
        rescheduleReq.setReason("Severe weather rescheduling");
        rescheduleReq.setShiftSubsequentSessions(true);

        SchedulePlanResponse res = executionService.applyReschedule("cls_bda", "sess_shift_1", rescheduleReq, teacher.getEmail());
        assertNotNull(res);

        // Locked session must NOT be shifted from its fixed teacher-allocated date
        assertEquals(lockedDate, sLocked.getSessionDate(), "Locked session date must remain intact");
        assertEquals("Invited Guest Lecture: Cloud Storage at Scale", sLocked.getTopicTitle());
        assertEquals("Industry Case Studies", sLocked.getSubtopic());
        assertTrue(sLocked.isLocked());
    }

    @Test
    @DisplayName("30. IntelligentSubtopicDecomposer generates meaningful single-line 5-6 word subtopics without Part 1/2")
    void testSubtopicDecomposition_GeneratesMeaningfulSingleLineSubtopicsWithoutPartLabels() {
        IntelligentSubtopicDecomposer decomposer = new IntelligentSubtopicDecomposer(null);

        ModuleOutlineDTO mod1 = ModuleOutlineDTO.builder()
                .moduleNumber(1)
                .moduleTitle("Introduction to Internet of Things")
                .estimatedHours(4)
                .topics(List.of("Introduction", "Physical design of IOT"))
                .subtopics(Collections.emptyList())
                .build();

        List<IntelligentSubtopicDecomposer.SessionFocus> focuses = decomposer.decomposeModule(mod1, Collections.emptyList());
        assertEquals(4, focuses.size());

        for (IntelligentSubtopicDecomposer.SessionFocus f : focuses) {
            assertNotNull(f.getSubtopic());
            assertFalse(f.getSubtopic().isBlank());
            assertFalse(f.getSubtopic().contains("Part 1"), "Subtopic must not contain 'Part 1': " + f.getSubtopic());
            assertFalse(f.getSubtopic().contains("Part 2"), "Subtopic must not contain 'Part 2': " + f.getSubtopic());
            assertFalse(f.getSubtopic().contains("\n"), "Subtopic must be single-line: " + f.getSubtopic());

            int wordCount = f.getSubtopic().trim().split("\\s+").length;
            assertTrue(wordCount >= 3 && wordCount <= 8, "Subtopic word count should be concise (~5-6 words): " + f.getSubtopic() + " (" + wordCount + " words)");

            assertTrue("TEACHER_REVIEW_SUGGESTION".equals(f.getSubtopicSource()) || "OFFICIAL_SYLLABUS".equals(f.getSubtopicSource()));
        }

        IntelligentSubtopicDecomposer.SessionFocus s3 = focuses.get(2);
        IntelligentSubtopicDecomposer.SessionFocus s4 = focuses.get(3);
        assertEquals("Physical design of IOT", s3.getTopicTitle());
        assertEquals("Physical design of IOT", s4.getTopicTitle());
        assertNotEquals(s3.getSubtopic(), s4.getSubtopic(), "Subtopics for multiple sessions of same topic must be distinct!");
    }

    @Test
    @DisplayName("31. Repeated schedule generation does not duplicate syllabus items and maintains count synchronization")
    void testRepeatedScheduleGeneration_DoesNotDuplicateSyllabusItems() {
        classroom.setSchedulingInputsVerified(true);
        when(classroomRepository.findById("cls_bda")).thenReturn(Optional.of(classroom));

        List<TimetableSlot> slots = List.of(
                TimetableSlot.builder().classroomId("cls_bda").subjectCode("BCS714D").dayOfWeek(DayOfWeek.MONDAY).startTime(LocalTime.of(9, 0)).endTime(LocalTime.of(10, 0)).approved(true).build(),
                TimetableSlot.builder().classroomId("cls_bda").subjectCode("BCS714D").dayOfWeek(DayOfWeek.TUESDAY).startTime(LocalTime.of(9, 0)).endTime(LocalTime.of(10, 0)).approved(true).build(),
                TimetableSlot.builder().classroomId("cls_bda").subjectCode("BCS714D").dayOfWeek(DayOfWeek.WEDNESDAY).startTime(LocalTime.of(9, 0)).endTime(LocalTime.of(10, 0)).approved(true).build(),
                TimetableSlot.builder().classroomId("cls_bda").subjectCode("BCS714D").dayOfWeek(DayOfWeek.THURSDAY).startTime(LocalTime.of(9, 0)).endTime(LocalTime.of(10, 0)).approved(true).build()
        );
        when(timetableSlotRepository.findByClassroomIdAndApprovedTrue("cls_bda")).thenReturn(slots);
        List<AcademicCalendarEvent> calEvents = List.of(
                AcademicCalendarEvent.builder().classroomId("cls_bda").eventName("Semester Commencement").startDate(LocalDate.of(2026, 7, 20)).isTeachingDay(true).approved(true).build(),
                AcademicCalendarEvent.builder().classroomId("cls_bda").eventName("Term End").startDate(LocalDate.of(2026, 9, 25)).isTeachingDay(true).approved(true).build()
        );
        when(calendarEventRepository.findByClassroomIdAndApprovedTrue("cls_bda")).thenReturn(calEvents);
        when(milestoneRepository.findByClassroomIdAndApprovedTrueOrderByStartDateAsc("cls_bda")).thenReturn(Collections.emptyList());

        List<ClassroomModuleOutline> outlines = new ArrayList<>();
        int[] topicCounts = {5, 10, 14, 9, 7};
        for (int m = 1; m <= 5; m++) {
            List<String> topics = new ArrayList<>();
            for (int t = 1; t <= topicCounts[m - 1]; t++) {
                topics.add(String.format("Module %d Concept Topic %d", m, t));
            }
            outlines.add(ClassroomModuleOutline.builder()
                    .classroomId("cls_bda")
                    .moduleNumber(m)
                    .moduleTitle("Curriculum Unit " + m)
                    .estimatedHours(8)
                    .topics(topics)
                    .approved(true)
                    .build());
        }
        when(moduleOutlineRepository.findByClassroomIdOrderByModuleNumberAsc("cls_bda")).thenReturn(outlines);

        List<SyllabusItem> inMemorySyllabusItems = new ArrayList<>();
        when(syllabusItemRepository.findByClassroomIdOrderByOrderIndexAscCreatedAtAsc("cls_bda")).thenAnswer(inv -> new ArrayList<>(inMemorySyllabusItems));
        when(syllabusItemRepository.save(any(SyllabusItem.class))).thenAnswer(inv -> {
            SyllabusItem it = inv.getArgument(0);
            if (it.getId() == null) it.setId("syl_" + UUID.randomUUID());
            inMemorySyllabusItems.removeIf(existing -> existing.getId().equals(it.getId()));
            inMemorySyllabusItems.add(it);
            return it;
        });
        when(syllabusItemRepository.saveAll(any())).thenAnswer(inv -> {
            Iterable<SyllabusItem> items = inv.getArgument(0);
            for (SyllabusItem it : items) {
                if (it.getId() == null) it.setId("syl_" + UUID.randomUUID());
                inMemorySyllabusItems.removeIf(existing -> existing.getId().equals(it.getId()));
                inMemorySyllabusItems.add(it);
            }
            return items;
        });
        lenient().doAnswer(inv -> {
            Iterable<SyllabusItem> toDelete = inv.getArgument(0);
            for (SyllabusItem d : toDelete) {
                inMemorySyllabusItems.removeIf(it -> it.getId().equals(d.getId()));
            }
            return null;
        }).when(syllabusItemRepository).deleteAll(any());

        when(planRepository.findByClassroomIdOrderByVersionNumberDesc("cls_bda")).thenReturn(Collections.emptyList());
        when(planRepository.save(any(TeachingSchedulePlan.class))).thenAnswer(inv -> {
            TeachingSchedulePlan p = inv.getArgument(0);
            p.setId("plan_gen_v1");
            return p;
        });
        when(sessionRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        GenerateScheduleRequest req = GenerateScheduleRequest.builder()
                .termStartDate(LocalDate.of(2026, 7, 20))
                .termEndDate(LocalDate.of(2026, 9, 25))
                .allowPastDates(true)
                .build();

        // First Generation Run
        SchedulePlanResponse plan1 = scheduleGenerator.generateDraftSchedule("cls_bda", req, "asha@dbit.ac.in");
        assertNotNull(plan1);
        assertEquals(40, plan1.getTotalPlannedSessions(), "Should schedule exactly 40 teaching sessions for 40 module hours");
        assertEquals(45, plan1.getTotalUniqueTopics(), "Should accurately report 45 unique syllabus topics");
        assertEquals(45, inMemorySyllabusItems.size(), "Should have created exactly 45 unique syllabus items");

        // Second Generation Run (Regeneration)
        TeachingSchedulePlan existingPlanV1 = TeachingSchedulePlan.builder()
                .id("plan_gen_v1")
                .classroomId("cls_bda")
                .versionNumber(1)
                .status(SchedulePlanStatus.DRAFT)
                .build();
        when(planRepository.findByClassroomIdOrderByVersionNumberDesc("cls_bda")).thenReturn(List.of(existingPlanV1));
        when(sessionRepository.findByPlanIdOrderBySessionDateAscSessionNumberAsc("plan_gen_v1")).thenReturn(
                plan1.getSessions().stream().map(dto -> ScheduledSession.builder()
                        .id(dto.getId())
                        .planId("plan_gen_v1")
                        .sessionNumber(dto.getSessionNumber())
                        .topicTitle(dto.getTopicTitle())
                        .subtopic(dto.getSubtopic())
                        .subtopicSource(dto.getSubtopicSource())
                        .status(dto.getStatus())
                        .build()).collect(Collectors.toList())
        );
        when(planRepository.save(any(TeachingSchedulePlan.class))).thenAnswer(inv -> {
            TeachingSchedulePlan p = inv.getArgument(0);
            p.setId("plan_gen_v2");
            return p;
        });

        SchedulePlanResponse plan2 = scheduleGenerator.generateDraftSchedule("cls_bda", req, "asha@dbit.ac.in");
        assertNotNull(plan2);
        assertEquals(2, plan2.getVersionNumber(), "Plan version should increment to v2");
        assertEquals(40, plan2.getTotalPlannedSessions(), "Plan should still contain 40 scheduled sessions");
        assertEquals(45, plan2.getTotalUniqueTopics(), "Plan should still report 45 unique syllabus topics");
        assertEquals(45, inMemorySyllabusItems.size(), "Repeated generation must NOT duplicate syllabus items: count must remain 45!");
    }

    @Test
    @DisplayName("32. Regeneration preserves teacher-edited subtopics, notes, and recorded outcomes")
    void testPreserveTeacherEditedSubtopicsAndOutcomesOnRegeneration() {
        classroom.setSchedulingInputsVerified(true);
        when(classroomRepository.findById("cls_bda")).thenReturn(Optional.of(classroom));

        List<TimetableSlot> slots = List.of(
                TimetableSlot.builder().classroomId("cls_bda").subjectCode("BCS714D").dayOfWeek(DayOfWeek.MONDAY).startTime(LocalTime.of(9, 0)).endTime(LocalTime.of(10, 0)).approved(true).build(),
                TimetableSlot.builder().classroomId("cls_bda").subjectCode("BCS714D").dayOfWeek(DayOfWeek.TUESDAY).startTime(LocalTime.of(9, 0)).endTime(LocalTime.of(10, 0)).approved(true).build()
        );
        when(timetableSlotRepository.findByClassroomIdAndApprovedTrue("cls_bda")).thenReturn(slots);
        List<AcademicCalendarEvent> calEvents = List.of(
                AcademicCalendarEvent.builder().classroomId("cls_bda").eventName("Semester Commencement").startDate(LocalDate.of(2026, 7, 20)).isTeachingDay(true).approved(true).build(),
                AcademicCalendarEvent.builder().classroomId("cls_bda").eventName("Term End").startDate(LocalDate.of(2026, 7, 27)).isTeachingDay(true).approved(true).build()
        );
        when(calendarEventRepository.findByClassroomIdAndApprovedTrue("cls_bda")).thenReturn(calEvents);
        when(milestoneRepository.findByClassroomIdAndApprovedTrueOrderByStartDateAsc("cls_bda")).thenReturn(Collections.emptyList());

        ClassroomModuleOutline mod1 = ClassroomModuleOutline.builder()
                .classroomId("cls_bda")
                .moduleNumber(1)
                .moduleTitle("Introduction to Storage")
                .estimatedHours(2)
                .topics(List.of("Storage Systems", "Flash and Disk Storage"))
                .approved(true)
                .build();
        when(moduleOutlineRepository.findByClassroomIdOrderByModuleNumberAsc("cls_bda")).thenReturn(List.of(mod1));

        TeachingSchedulePlan planV1 = TeachingSchedulePlan.builder()
                .id("plan_v1")
                .classroomId("cls_bda")
                .versionNumber(1)
                .status(SchedulePlanStatus.APPROVED)
                .build();
        when(planRepository.findByClassroomIdOrderByVersionNumberDesc("cls_bda")).thenReturn(List.of(planV1));

        ScheduledSession priorS1 = ScheduledSession.builder()
                .id("prior_s1")
                .planId("plan_v1")
                .sessionNumber(1)
                .sessionDate(LocalDate.of(2026, 7, 20))
                .topicTitle("Storage Systems")
                .subtopic("Custom Teacher Storage Lab: NVMe Benchmarks")
                .subtopicSource("TEACHER_EDITED")
                .teacherNotes("Brought physical PCIe NVMe drives to lab")
                .portionsCovered("Pages 10 to 45")
                .status(SessionStatus.COMPLETED)
                .build();

        when(sessionRepository.findByPlanIdOrderBySessionDateAscSessionNumberAsc("plan_v1")).thenReturn(List.of(priorS1));
        when(planRepository.save(any(TeachingSchedulePlan.class))).thenAnswer(inv -> {
            TeachingSchedulePlan p = inv.getArgument(0);
            p.setId("plan_v2");
            return p;
        });
        when(sessionRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        GenerateScheduleRequest req = GenerateScheduleRequest.builder()
                .termStartDate(LocalDate.of(2026, 7, 20))
                .termEndDate(LocalDate.of(2026, 7, 27))
                .allowPastDates(true)
                .build();

        SchedulePlanResponse planV2 = scheduleGenerator.generateDraftSchedule("cls_bda", req, "asha@dbit.ac.in");
        assertNotNull(planV2);
        ScheduledSessionDTO s1 = planV2.getSessions().get(0);

        assertEquals("Storage Systems", s1.getTopicTitle());
        assertEquals("Custom Teacher Storage Lab: NVMe Benchmarks", s1.getSubtopic(), "Must preserve teacher edited subtopic");
        assertEquals("TEACHER_EDITED", s1.getSubtopicSource(), "Must preserve TEACHER_EDITED source");
        assertEquals("Brought physical PCIe NVMe drives to lab", s1.getTeacherNotes(), "Must preserve teacher notes");
        assertEquals(SessionStatus.COMPLETED, s1.getStatus(), "Must preserve COMPLETED outcome");
        assertEquals("Pages 10 to 45", s1.getPortionsCovered(), "Must preserve portions covered");
    }

    @Test
    @DisplayName("33. AI-provider-unavailable fallback produces deterministic source-grounded subtopics")
    void testAIFallback_WhenAIAbsent_ProducesDeterministicSourceGroundedSubtopics() {
        IntelligentSubtopicDecomposer fallbackDecomposer = new IntelligentSubtopicDecomposer(null);

        ModuleOutlineDTO mod = ModuleOutlineDTO.builder()
                .moduleNumber(2)
                .moduleTitle("IoT Network and Cloud Architecture")
                .estimatedHours(3)
                .topics(List.of("Cloud Computing for IoT"))
                .subtopics(Collections.emptyList())
                .build();

        List<IntelligentSubtopicDecomposer.SessionFocus> focuses = fallbackDecomposer.decomposeModule(mod, Collections.emptyList());
        assertEquals(3, focuses.size());

        for (int i = 0; i < 3; i++) {
            IntelligentSubtopicDecomposer.SessionFocus f = focuses.get(i);
            assertNotNull(f.getSubtopic());
            assertEquals("TEACHER_REVIEW_SUGGESTION", f.getSubtopicSource(), "Fallback must clearly distinguish generated suggestion");
            assertFalse(f.getSubtopic().contains("Part " + (i + 1)));
            assertFalse(f.getSubtopic().contains("\n"));
        }

        Set<String> distinctSubtopics = focuses.stream().map(IntelligentSubtopicDecomposer.SessionFocus::getSubtopic).collect(Collectors.toSet());
        assertEquals(3, distinctSubtopics.size(), "Each session must have a distinct learning subtopic");
    }
}
