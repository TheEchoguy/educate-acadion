package com.acadion.backend.controller;

import com.acadion.backend.dto.intelligence.ClassroomAnalyticsSummaryDTO;
import com.acadion.backend.dto.intelligence.ClassroomRiskWatchlistResponse;
import com.acadion.backend.dto.intelligence.IaIngestionSummary;
import com.acadion.backend.dto.intelligence.ManualMarksRecordRequest;
import com.acadion.backend.dto.intelligence.StudentFourLevelAnalyticsDTO;
import com.acadion.backend.dto.intelligence.StudentIaBreakdownResponse;
import com.acadion.backend.dto.intelligence.StudentPerformanceResponse;
import com.acadion.backend.dto.intelligence.StudentRiskXaiResponse;
import com.acadion.backend.entity.IaQuestionBlueprint;
import com.acadion.backend.entity.StudentIaMarksRecord;
import com.acadion.backend.dto.intelligence.ModuleNotesStatusResponse;
import com.acadion.backend.dto.intelligence.RagTutorChatRequest;
import com.acadion.backend.dto.intelligence.RagTutorChatResponse;
import com.acadion.backend.service.AcademicRiskService;
import com.acadion.backend.service.ClassroomPaperParserService;
import com.acadion.backend.service.HierarchicalAnalyticsService;
import com.acadion.backend.service.IaMarksIngestionService;
import com.acadion.backend.service.RagTutorService;
import com.acadion.backend.service.StudentPerformanceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.security.Principal;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/classrooms/{classroomId}/intelligence")
@RequiredArgsConstructor
public class AcademicIntelligenceController {

    private final IaMarksIngestionService iaMarksIngestionService;
    private final ClassroomPaperParserService paperParserService;
    private final StudentPerformanceService studentPerformanceService;
    private final HierarchicalAnalyticsService hierarchicalAnalyticsService;
    private final AcademicRiskService academicRiskService;
    private final RagTutorService ragTutorService;

    /**
     * Download dynamic blank Excel template (.xlsx) for any IA (1, 2, or 3) containing ONLY
     * confirmed sub-question columns for that IA pre-populated with enrolled students.
     */
    @GetMapping({"/download-ia-template", "/download-sample-template", "/export-ia-report"})
    public ResponseEntity<byte[]> downloadIaTemplate(
            @PathVariable("classroomId") String classroomId,
            @RequestParam(value = "iaNumber", defaultValue = "1") int iaNumber
    ) {
        try {
            byte[] fileBytes = iaMarksIngestionService.generateDynamicBlankTemplate(classroomId, iaNumber);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
            headers.setContentDispositionFormData("attachment", "IA-" + iaNumber + "-SplitupMarks-Template.xlsx");
            headers.setCacheControl("must-revalidate, post-check=0, pre-check=0");

            return new ResponseEntity<>(fileBytes, headers, HttpStatus.OK);
        } catch (IOException e) {
            log.error("Failed to generate IA-{} sample template for classroom {}", iaNumber, classroomId, e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to generate Excel template: " + e.getMessage());
        }
    }

    /**
     * Save manually entered IA marks for enrolled students.
     * Calculates choice totals: Max(Q1, Q2) + Max(Q3, Q4) and saves to repository.
     */
    @PostMapping("/save-manual-marks")
    public ResponseEntity<List<StudentIaMarksRecord>> saveManualMarks(
            @PathVariable("classroomId") String classroomId,
            @RequestParam(value = "iaNumber", defaultValue = "1") int iaNumber,
            @RequestBody List<ManualMarksRecordRequest> requests
    ) {
        log.info("Saving manual IA-{} marks for classroom {}, records: {}",
                iaNumber, classroomId, requests != null ? requests.size() : 0);
        List<StudentIaMarksRecord> saved = iaMarksIngestionService.saveManualMarks(classroomId, iaNumber, requests);
        return ResponseEntity.ok(saved);
    }

    /**
     * Download Unified Master Split-Up Sheet (.xlsx) containing IA-1, IA-2, IA-3, and Assignments.
     */
    @GetMapping("/download-master-template")
    public ResponseEntity<byte[]> downloadMasterTemplate(
            @PathVariable("classroomId") String classroomId
    ) {
        try {
            byte[] fileBytes = iaMarksIngestionService.generateMasterUnifiedTemplate(classroomId);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
            headers.setContentDispositionFormData("attachment", "Master-SplitupMarks-Template.xlsx");
            headers.setCacheControl("must-revalidate, post-check=0, pre-check=0");

            return new ResponseEntity<>(fileBytes, headers, HttpStatus.OK);
        } catch (IOException e) {
            log.error("Failed to generate Master Unified template for classroom {}", classroomId, e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to generate Master Excel template: " + e.getMessage());
        }
    }

    /**
     * Export Latest Class Marks Report (.xlsx) containing all entered IA marks and module mastery.
     */
    @GetMapping("/export-master-report")
    public ResponseEntity<byte[]> exportMasterReport(
            @PathVariable("classroomId") String classroomId
    ) {
        try {
            byte[] fileBytes = iaMarksIngestionService.exportMasterMarksSheet(classroomId);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
            headers.setContentDispositionFormData("attachment", "Class-Marks-Master-Report.xlsx");
            headers.setCacheControl("must-revalidate, post-check=0, pre-check=0");

            return new ResponseEntity<>(fileBytes, headers, HttpStatus.OK);
        } catch (IOException e) {
            log.error("Failed to export Master Marks Report for classroom {}", classroomId, e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to export report: " + e.getMessage());
        }
    }

    /**
     * Upload and parse Master Unified Split-Up Excel file (simultaneously ingests IA-1, IA-2, IA-3).
     */
    @PostMapping("/upload-master-sheet")
    public ResponseEntity<IaIngestionSummary> uploadMasterSheet(
            @PathVariable("classroomId") String classroomId,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        String teacherEmail = userDetails != null ? userDetails.getUsername() : "teacher";
        log.info("Received Master Unified sheet upload for classroom={}, file={}, uploadedBy={}",
                classroomId, file != null ? file.getOriginalFilename() : "null", teacherEmail);

        try {
            IaIngestionSummary summary = iaMarksIngestionService.ingestMasterUnifiedSheet(classroomId, file, teacherEmail);
            return ResponseEntity.ok(summary);
        } catch (IOException e) {
            log.error("Failed to parse Master Unified sheet for classroom {}", classroomId, e);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Failed to parse Master Excel sheet: " + e.getMessage());
        }
    }

    /**
     * Upload and parse single IA Split-Up Marks Excel file.
     */
    @PostMapping("/upload-ia-marks")
    public ResponseEntity<IaIngestionSummary> uploadIaMarks(
            @PathVariable("classroomId") String classroomId,
            @RequestParam("file") MultipartFile file,
            @RequestParam("iaNumber") int iaNumber,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        String teacherEmail = userDetails != null ? userDetails.getUsername() : "teacher";
        log.info("Received IA marks upload for classroom={}, iaNumber={}, file={}, uploadedBy={}",
                classroomId, iaNumber, file != null ? file.getOriginalFilename() : "null", teacherEmail);

        try {
            IaIngestionSummary summary = iaMarksIngestionService.ingestIaMarks(classroomId, file, iaNumber, teacherEmail);
            return ResponseEntity.ok(summary);
        } catch (IOException e) {
            log.error("Failed to parse and ingest IA marks file for classroom {}", classroomId, e);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Failed to parse IA marks Excel: " + e.getMessage());
        }
    }

    /**
     * Get student question-wise breakdown, weak topics, and module mastery across IAs.
     */
    @GetMapping("/student/{usn}")
    public ResponseEntity<StudentIaBreakdownResponse> getStudentBreakdown(
            @PathVariable("classroomId") String classroomId,
            @PathVariable("usn") String usn
    ) {
        StudentIaBreakdownResponse response = iaMarksIngestionService.getStudentBreakdown(classroomId, usn);
        return ResponseEntity.ok(response);
    }

    /**
     * Get all ingested student IA marks for a specific IA number.
     */
    @GetMapping("/ia/{iaNumber}")
    public ResponseEntity<List<StudentIaMarksRecord>> getIaRecords(
            @PathVariable("classroomId") String classroomId,
            @PathVariable("iaNumber") int iaNumber
    ) {
        List<StudentIaMarksRecord> records = iaMarksIngestionService.getIaRecordsByNumber(classroomId, iaNumber);
        return ResponseEntity.ok(records);
    }

    /**
     * Teacher confirmation to publish or unpublish IA marks to students.
     */
    @PostMapping("/publish-ia-marks")
    public ResponseEntity<Map<String, Object>> publishIaMarks(
            @PathVariable("classroomId") String classroomId,
            @RequestParam(value = "iaNumber", defaultValue = "0") int iaNumber,
            @RequestParam(value = "publish", defaultValue = "true") boolean publish
    ) {
        Map<String, Object> result = iaMarksIngestionService.publishIaMarks(classroomId, iaNumber, publish);
        return ResponseEntity.ok(result);
    }

    /**
     * Get publication status for each IA test in the classroom.
     */
    @GetMapping("/ia-publish-status")
    public ResponseEntity<Map<String, Object>> getIaPublishStatus(
            @PathVariable("classroomId") String classroomId
    ) {
        Map<String, Object> status = iaMarksIngestionService.getIaPublishStatus(classroomId);
        return ResponseEntity.ok(status);
    }

    /**
     * Reset and wipe all recorded marks for a specific IA test (or all if iaNumber == 0).
     */
    @DeleteMapping("/reset-ia-marks")
    public ResponseEntity<Map<String, Object>> resetIaMarks(
            @PathVariable("classroomId") String classroomId,
            @RequestParam(value = "iaNumber", defaultValue = "1") int iaNumber
    ) {
        log.info("Resetting marks for classroom {}, IA={}", classroomId, iaNumber);
        Map<String, Object> result = iaMarksIngestionService.resetIaMarks(classroomId, iaNumber);
        return ResponseEntity.ok(result);
    }

    /**
     * Get active blueprint for an IA test (or generates default a, b, c blueprint).
     */
    @GetMapping("/blueprint")
    public ResponseEntity<IaQuestionBlueprint> getBlueprint(
            @PathVariable("classroomId") String classroomId,
            @RequestParam(value = "iaNumber", defaultValue = "1") int iaNumber
    ) {
        IaQuestionBlueprint blueprint = paperParserService.getOrCreateDefaultBlueprint(classroomId, iaNumber);
        return ResponseEntity.ok(blueprint);
    }

    /**
     * Upload and parse Question Paper (PDF / Image) using Python AI OCR/LLM service.
     */
    @PostMapping("/parse-paper")
    public ResponseEntity<IaQuestionBlueprint> parsePaper(
            @PathVariable("classroomId") String classroomId,
            @RequestParam(value = "iaNumber", defaultValue = "1") int iaNumber,
            @RequestParam("file") MultipartFile file
    ) {
        log.info("Parsing question paper for classroom={}, iaNumber={}, filename={}",
                classroomId, iaNumber, file != null ? file.getOriginalFilename() : "null");
        IaQuestionBlueprint blueprint = paperParserService.parseAndUpdateBlueprint(classroomId, iaNumber, file);
        return ResponseEntity.ok(blueprint);
    }

    /**
     * Manually update blueprint questions and max marks, with optional confirm/lock and applyToAll propagation.
     */
    @PutMapping("/blueprint")
    public ResponseEntity<IaQuestionBlueprint> updateBlueprint(
            @PathVariable("classroomId") String classroomId,
            @RequestParam(value = "iaNumber", defaultValue = "1") int iaNumber,
            @RequestParam(value = "applyToAll", defaultValue = "false") boolean applyToAll,
            @RequestParam(value = "confirm", defaultValue = "false") boolean confirm,
            @RequestBody IaQuestionBlueprint blueprint
    ) {
        IaQuestionBlueprint updated = paperParserService.updateBlueprint(classroomId, iaNumber, blueprint, applyToAll, confirm);
        return ResponseEntity.ok(updated);
    }

    /**
     * Instantly generate blueprint with configurable sub-question counts (e.g. 2 or 3 per question).
     */
    @PostMapping("/blueprint/generate")
    public ResponseEntity<IaQuestionBlueprint> generateBlueprint(
            @PathVariable("classroomId") String classroomId,
            @RequestParam(value = "iaNumber", defaultValue = "1") int iaNumber,
            @RequestParam(value = "q1Count", defaultValue = "2") int q1Count,
            @RequestParam(value = "q2Count", defaultValue = "2") int q2Count,
            @RequestParam(value = "q3Count", defaultValue = "2") int q3Count,
            @RequestParam(value = "q4Count", defaultValue = "2") int q4Count
    ) {
        IaQuestionBlueprint bp = paperParserService.generateConfigurableBlueprint(classroomId, iaNumber, q1Count, q2Count, q3Count, q4Count);
        return ResponseEntity.ok(bp);
    }

    /**
     * Isolated Student Performance View: Retrieves authenticated student's personal IA marks,
     * scaled CIE progress locked in, attempted question breakdowns with "Skipped via Choice" tags,
     * weak topics (<50%), and module mastery.
     */
    @GetMapping("/my-performance")
    public ResponseEntity<StudentPerformanceResponse> getMyPerformance(
            @PathVariable("classroomId") String classroomId,
            @AuthenticationPrincipal UserDetails userDetails,
            Principal principal
    ) {
        String studentEmail = userDetails != null ? userDetails.getUsername() : (principal != null ? principal.getName() : null);
        if (studentEmail == null || studentEmail.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated");
        }
        StudentPerformanceResponse response = studentPerformanceService.getStudentPerformance(classroomId, studentEmail);
        return ResponseEntity.ok(response);
    }

    /**
     * Feature 3: Get 4-Level Hierarchical Analytics for a specific student (Teacher inspection).
     */
    @GetMapping("/analytics/student/{usn}")
    public ResponseEntity<StudentFourLevelAnalyticsDTO> getStudentFourLevelAnalytics(
            @PathVariable("classroomId") String classroomId,
            @PathVariable("usn") String usn
    ) {
        StudentFourLevelAnalyticsDTO dto = hierarchicalAnalyticsService.getStudentFourLevelAnalytics(classroomId, usn);
        return ResponseEntity.ok(dto);
    }

    /**
     * Feature 3: Get 4-Level Hierarchical Analytics for authenticated student.
     */
    @GetMapping("/analytics/my-performance")
    public ResponseEntity<StudentFourLevelAnalyticsDTO> getMyFourLevelAnalytics(
            @PathVariable("classroomId") String classroomId,
            @AuthenticationPrincipal UserDetails userDetails,
            Principal principal
    ) {
        String studentEmail = userDetails != null ? userDetails.getUsername() : (principal != null ? principal.getName() : null);
        if (studentEmail == null || studentEmail.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated");
        }
        StudentFourLevelAnalyticsDTO dto = hierarchicalAnalyticsService.getMyFourLevelAnalytics(classroomId, studentEmail);
        return ResponseEntity.ok(dto);
    }

    /**
     * Feature 3: Whole-Class Topic Diagnostic Heatmap & Module Mastery Summary.
     */
    @GetMapping("/analytics/class-summary")
    public ResponseEntity<ClassroomAnalyticsSummaryDTO> getClassroomAnalyticsSummary(
            @PathVariable("classroomId") String classroomId
    ) {
        ClassroomAnalyticsSummaryDTO summary = hierarchicalAnalyticsService.getClassroomAnalyticsSummary(classroomId);
        return ResponseEntity.ok(summary);
    }

    /**
     * Feature 4: Python ML Risk Prediction & SHAP Explainable AI (XAI) Report for a specific student.
     */
    @GetMapping("/risk-xai/student/{usn}")
    public ResponseEntity<StudentRiskXaiResponse> getStudentRiskXai(
            @PathVariable("classroomId") String classroomId,
            @PathVariable("usn") String usn
    ) {
        StudentRiskXaiResponse response = academicRiskService.evaluateStudentRisk(classroomId, usn);
        return ResponseEntity.ok(response);
    }

    /**
     * Feature 4: Python ML Risk Prediction & SHAP XAI for authenticated student.
     */
    @GetMapping("/risk-xai/my-performance")
    public ResponseEntity<StudentRiskXaiResponse> getMyRiskXai(
            @PathVariable("classroomId") String classroomId,
            @AuthenticationPrincipal UserDetails userDetails,
            Principal principal
    ) {
        String studentEmail = userDetails != null ? userDetails.getUsername() : (principal != null ? principal.getName() : null);
        if (studentEmail == null || studentEmail.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated");
        }
        StudentRiskXaiResponse response = academicRiskService.evaluateMyRisk(classroomId, studentEmail);
        return ResponseEntity.ok(response);
    }

    /**
     * Feature 4: Classroom At-Risk Ranking Watchlist with SHAP primary drivers.
     */
    @GetMapping("/risk-xai/watchlist")
    public ResponseEntity<ClassroomRiskWatchlistResponse> getClassroomRiskWatchlist(
            @PathVariable("classroomId") String classroomId
    ) {
        ClassroomRiskWatchlistResponse response = academicRiskService.evaluateClassroomWatchlist(classroomId);
        return ResponseEntity.ok(response);
    }

    /**
     * Feature 5: Upload and index module notes PDF (Modules 1 to 5) into the RAG vector store.
     */
    @PostMapping("/notes/upload")
    public ResponseEntity<Map<String, Object>> uploadModuleNotes(
            @PathVariable("classroomId") String classroomId,
            @RequestParam("moduleNumber") int moduleNumber,
            @RequestParam("file") MultipartFile file
    ) {
        log.info("Received request to upload Module {} notes for classroom {}", moduleNumber, classroomId);
        Map<String, Object> result = ragTutorService.uploadModuleNotes(classroomId, moduleNumber, file);
        return ResponseEntity.ok(result);
    }

    /**
     * Feature 5: Interactive Grounded RAG Study Tutor Chat.
     */
    @PostMapping("/tutor/chat")
    public ResponseEntity<RagTutorChatResponse> chatWithTutor(
            @PathVariable("classroomId") String classroomId,
            @RequestBody RagTutorChatRequest request
    ) {
        if (request.getClassroomId() == null || request.getClassroomId().isBlank()) {
            request.setClassroomId(classroomId);
        }
        log.info("Student asking RAG Tutor in classroom {}: query='{}', focusTopic='{}', focusModule={}",
                classroomId, request.getQuery(), request.getFocusTopic(), request.getFocusModule());
        RagTutorChatResponse response = ragTutorService.chatWithTutor(classroomId, request);
        return ResponseEntity.ok(response);
    }

    /**
     * Feature 5: Get status of uploaded/indexed notes across modules 1 to 5.
     */
    @GetMapping("/notes/status")
    public ResponseEntity<ModuleNotesStatusResponse> getNotesStatus(
            @PathVariable("classroomId") String classroomId
    ) {
        ModuleNotesStatusResponse status = ragTutorService.getModuleNotesStatus(classroomId);
        return ResponseEntity.ok(status);
    }
}


