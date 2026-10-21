package com.acadion.backend.controller;

import com.acadion.backend.dto.scheduling.*;
import com.acadion.backend.entity.scheduling.AcademicDocument;
import com.acadion.backend.entity.scheduling.AcademicDocumentType;
import com.acadion.backend.entity.scheduling.RescheduleRecord;
import com.acadion.backend.service.scheduling.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/syllabus/classroom/{classroomId}/scheduling")
@RequiredArgsConstructor
@Slf4j
public class SyllabusSchedulingController {

    private final AcademicDocumentService documentService;
    private final AcademicExtractionService extractionService;
    private final DeterministicScheduleGenerator scheduleGenerator;
    private final ScheduleExecutionService executionService;
    private final SyllabusSchedulingExportService exportService;
    private final com.acadion.backend.repository.ClassroomRepository classroomRepository;

    // ==========================================
    // 1. DOCUMENT INTAKE & MANAGEMENT
    // ==========================================

    @PostMapping("/documents/upload")
    public ResponseEntity<DocumentMetadataDTO> uploadDocument(
            @PathVariable("classroomId") String classroomId,
            @RequestParam("file") MultipartFile file,
            @RequestParam("documentType") AcademicDocumentType documentType,
            @RequestParam(value = "moduleNumber", required = false) Integer moduleNumber,
            @RequestParam(value = "moduleTitle", required = false) String moduleTitle,
            Principal principal
    ) throws IOException {
        String email = getAuthenticatedEmail(principal);
        DocumentMetadataDTO dto = documentService.uploadDocument(classroomId, documentType, moduleNumber, moduleTitle, file, email);

        // Automatically extract the document immediately upon upload
        AcademicDocument saved = documentService.getDocumentBytesForTeacher(classroomId, dto.getId(), email);
        com.acadion.backend.entity.Classroom classroom = documentService.verifyTeacherOwnership(classroomId, email);
        extractionService.processDocument(saved, classroom);

        // Invalidate previous verification if a required planning document is uploaded or replaced
        if (documentType == AcademicDocumentType.TIMETABLE ||
            documentType == AcademicDocumentType.ACADEMIC_CALENDAR ||
            documentType == AcademicDocumentType.OFFICIAL_SYLLABUS) {
            classroom.setSchedulingInputsVerified(false);
            classroomRepository.save(classroom);
        }

        AcademicDocument processed = documentService.getDocumentBytesForTeacher(classroomId, dto.getId(), email);
        return ResponseEntity.status(HttpStatus.CREATED).body(documentService.toDTO(processed));
    }

    @GetMapping("/documents")
    public ResponseEntity<List<DocumentMetadataDTO>> listDocuments(
            @PathVariable("classroomId") String classroomId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        List<DocumentMetadataDTO> docs = documentService.listDocumentsForTeacher(classroomId, email);
        return ResponseEntity.ok(docs);
    }

    @GetMapping("/documents/{docId}/download")
    public ResponseEntity<byte[]> downloadDocument(
            @PathVariable("classroomId") String classroomId,
            @PathVariable("docId") String docId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        AcademicDocument doc = documentService.getDocumentBytesForTeacher(classroomId, docId, email);

        String contentType = doc.getContentType() != null ? doc.getContentType() : "application/pdf";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + doc.getOriginalFileName() + "\"")
                .contentType(MediaType.parseMediaType(contentType))
                .body(doc.getFileData());
    }

    @PostMapping("/documents/{docId}/publish")
    public ResponseEntity<DocumentMetadataDTO> publishModuleDocument(
            @PathVariable("classroomId") String classroomId,
            @PathVariable("docId") String docId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        DocumentMetadataDTO dto = documentService.publishModuleDocument(classroomId, docId, email);
        return ResponseEntity.ok(dto);
    }

    @PostMapping("/documents/{docId}/unpublish")
    public ResponseEntity<DocumentMetadataDTO> unpublishModuleDocument(
            @PathVariable("classroomId") String classroomId,
            @PathVariable("docId") String docId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        DocumentMetadataDTO dto = documentService.unpublishModuleDocument(classroomId, docId, email);
        return ResponseEntity.ok(dto);
    }

    @DeleteMapping("/documents/{docId}")
    public ResponseEntity<Void> deleteDocument(
            @PathVariable("classroomId") String classroomId,
            @PathVariable("docId") String docId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        documentService.deleteDocument(classroomId, docId, email);
        return ResponseEntity.noContent().build();
    }

    // ==========================================
    // 2. EXTRACTION REVIEW & INPUT ADJUSTMENT
    // ==========================================

    @GetMapping("/inputs")
    public ResponseEntity<ExtractionReviewResponse> getExtractionInputs(
            @PathVariable("classroomId") String classroomId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        ExtractionReviewResponse response = extractionService.extractAndReview(classroomId, email);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/extract")
    public ResponseEntity<ExtractionReviewResponse> triggerExtraction(
            @PathVariable("classroomId") String classroomId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        ExtractionReviewResponse response = extractionService.extractAndReview(classroomId, email);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/timetable/slots")
    public ResponseEntity<List<TimetableSlotDTO>> updateTimetableSlots(
            @PathVariable("classroomId") String classroomId,
            @RequestBody List<TimetableSlotDTO> slots,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        List<TimetableSlotDTO> updated = extractionService.updateTimetableSlots(classroomId, slots, email);
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/timetable/confirm-mapping")
    public ResponseEntity<ExtractionReviewResponse> confirmTimetableMapping(
            @PathVariable("classroomId") String classroomId,
            @RequestBody ConfirmSubjectMappingRequest request,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        ExtractionReviewResponse response = extractionService.confirmTimetableMapping(classroomId, request.getSubjectCode(), email);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/calendar/events")
    public ResponseEntity<List<CalendarEventDTO>> updateCalendarEvents(
            @PathVariable("classroomId") String classroomId,
            @RequestBody List<CalendarEventDTO> events,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        List<CalendarEventDTO> updated = extractionService.updateCalendarEvents(classroomId, events, email);
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/milestones")
    public ResponseEntity<List<AssessmentMilestoneDTO>> updateMilestones(
            @PathVariable("classroomId") String classroomId,
            @RequestBody List<AssessmentMilestoneDTO> milestones,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        List<AssessmentMilestoneDTO> updated = extractionService.updateMilestones(classroomId, milestones, email);
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/modules")
    public ResponseEntity<List<ModuleOutlineDTO>> updateModuleOutlines(
            @PathVariable("classroomId") String classroomId,
            @RequestBody List<UpdateModuleOutlineRequest> outlines,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        List<ModuleOutlineDTO> updated = extractionService.updateModuleOutlines(classroomId, outlines, email);
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/inputs/verify")
    public ResponseEntity<ExtractionReviewResponse> verifyInputs(
            @PathVariable("classroomId") String classroomId,
            @RequestBody(required = false) VerifyInputsRequest request,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        if (request == null) {
            request = VerifyInputsRequest.builder().verifyAll(true).build();
        }
        ExtractionReviewResponse response = extractionService.verifyInputs(classroomId, request, email);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/reset")
    public ResponseEntity<Void> resetSchedulingData(
            @PathVariable("classroomId") String classroomId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        extractionService.resetSchedulingData(classroomId, email);
        return ResponseEntity.noContent().build();
    }

    // ==========================================
    // 3. SCHEDULE GENERATION & APPROVAL
    // ==========================================

    @PostMapping("/generate")
    public ResponseEntity<SchedulePlanResponse> generateSchedule(
            @PathVariable("classroomId") String classroomId,
            @RequestBody(required = false) GenerateScheduleRequest request,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        if (request == null) {
            request = GenerateScheduleRequest.builder().build();
        }
        SchedulePlanResponse response = scheduleGenerator.generateDraftSchedule(classroomId, request, email);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/plans")
    public ResponseEntity<List<SchedulePlanResponse>> listPlanVersions(
            @PathVariable("classroomId") String classroomId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        List<SchedulePlanResponse> plans = executionService.listPlanVersions(classroomId, email);
        return ResponseEntity.ok(plans);
    }

    @GetMapping("/plans/active")
    public ResponseEntity<SchedulePlanResponse> getActivePlan(
            @PathVariable("classroomId") String classroomId,
            @RequestParam(value = "planId", required = false) String planId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        SchedulePlanResponse plan = executionService.getActiveOrDraftPlan(classroomId, planId, email);
        if (plan == null) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(plan);
    }

    @GetMapping("/plans/{planId}")
    public ResponseEntity<SchedulePlanResponse> getPlanById(
            @PathVariable("classroomId") String classroomId,
            @PathVariable("planId") String planId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        SchedulePlanResponse plan = executionService.getPlanById(classroomId, planId, email);
        return ResponseEntity.ok(plan);
    }

    @PostMapping("/plans/{planId}/approve")
    public ResponseEntity<SchedulePlanResponse> approvePlan(
            @PathVariable("classroomId") String classroomId,
            @PathVariable("planId") String planId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        SchedulePlanResponse approved = executionService.approveAndPublishPlan(classroomId, planId, email);
        return ResponseEntity.ok(approved);
    }

    // ==========================================
    // 4. SESSION OUTCOMES & ADAPTIVE RESCHEDULING
    // ==========================================

    @PatchMapping("/sessions/{sessionId}/outcome")
    public ResponseEntity<ScheduledSessionDTO> recordSessionOutcome(
            @PathVariable("classroomId") String classroomId,
            @PathVariable("sessionId") String sessionId,
            @RequestBody RecordSessionOutcomeRequest request,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        ScheduledSessionDTO session = executionService.recordSessionOutcome(classroomId, sessionId, request, email);
        return ResponseEntity.ok(session);
    }

    @PostMapping("/sessions/manual-allocate")
    public ResponseEntity<ScheduledSessionDTO> manualAllocateSession(
            @PathVariable("classroomId") String classroomId,
            @RequestBody ManualSessionAllocationRequest request,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        ScheduledSessionDTO session = executionService.manualAllocateSession(classroomId, request, email);
        return ResponseEntity.status(HttpStatus.CREATED).body(session);
    }

    @DeleteMapping("/sessions/{sessionId}")
    public ResponseEntity<Void> deleteSession(
            @PathVariable("classroomId") String classroomId,
            @PathVariable("sessionId") String sessionId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        executionService.deleteSession(classroomId, sessionId, email);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/sessions/{sessionId}/reschedule-preview")
    public ResponseEntity<ReschedulePreviewResponse> previewReschedule(
            @PathVariable("classroomId") String classroomId,
            @PathVariable("sessionId") String sessionId,
            @RequestBody(required = false) ReschedulePreviewRequest request,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        ReschedulePreviewResponse preview = executionService.previewReschedule(classroomId, sessionId, request, email);
        return ResponseEntity.ok(preview);
    }

    @PostMapping("/sessions/{sessionId}/reschedule-apply")
    public ResponseEntity<SchedulePlanResponse> applyReschedule(
            @PathVariable("classroomId") String classroomId,
            @PathVariable("sessionId") String sessionId,
            @RequestBody ApplyRescheduleRequest request,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        SchedulePlanResponse plan = executionService.applyReschedule(classroomId, sessionId, request, email);
        return ResponseEntity.ok(plan);
    }

    @GetMapping("/history")
    public ResponseEntity<List<RescheduleRecord>> getRescheduleHistory(
            @PathVariable("classroomId") String classroomId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        List<RescheduleRecord> records = executionService.getRescheduleHistory(classroomId, email);
        return ResponseEntity.ok(records);
    }

    // ==========================================
    // 5. EXPORTS
    // ==========================================

    @GetMapping("/export/ical")
    public ResponseEntity<byte[]> exportIcal(
            @PathVariable("classroomId") String classroomId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        byte[] icsBytes = exportService.exportScheduleIcal(classroomId, email);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"acadion_teaching_schedule.ics\"")
                .contentType(MediaType.parseMediaType("text/calendar"))
                .body(icsBytes);
    }

    @GetMapping("/export/csv")
    public ResponseEntity<byte[]> exportCsv(
            @PathVariable("classroomId") String classroomId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        byte[] csvBytes = exportService.exportScheduleCsv(classroomId, email);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"acadion_teaching_schedule.csv\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csvBytes);
    }

    // ==========================================
    // 6. STUDENT-FACING ENDPOINTS
    // ==========================================

    @GetMapping("/student/schedule")
    public ResponseEntity<SchedulePlanResponse> getStudentSchedule(
            @PathVariable("classroomId") String classroomId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        documentService.verifyStudentEnrollment(classroomId, email);
        SchedulePlanResponse plan = executionService.getActiveOrDraftPlan(classroomId, email);
        if (plan == null) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(plan);
    }

    @GetMapping("/student/modules")
    public ResponseEntity<List<DocumentMetadataDTO>> getStudentModules(
            @PathVariable("classroomId") String classroomId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        List<DocumentMetadataDTO> modules = documentService.listPublishedModulesForStudent(classroomId, email);
        return ResponseEntity.ok(modules);
    }

    @GetMapping("/student/modules/{docId}/download")
    public ResponseEntity<byte[]> downloadStudentModule(
            @PathVariable("classroomId") String classroomId,
            @PathVariable("docId") String docId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        AcademicDocument doc = documentService.getPublishedDocumentBytesForStudent(classroomId, docId, email);

        String contentType = doc.getContentType() != null ? doc.getContentType() : "application/pdf";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + doc.getOriginalFileName() + "\"")
                .contentType(MediaType.parseMediaType(contentType))
                .body(doc.getFileData());
    }

    private String getAuthenticatedEmail(Principal principal) {
        if (principal == null || principal.getName() == null || principal.getName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User authentication required");
        }
        return principal.getName();
    }
}
