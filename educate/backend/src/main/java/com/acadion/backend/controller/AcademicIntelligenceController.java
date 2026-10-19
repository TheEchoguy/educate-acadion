package com.acadion.backend.controller;

import com.acadion.backend.dto.intelligence.IaIngestionSummary;
import com.acadion.backend.dto.intelligence.StudentIaBreakdownResponse;
import com.acadion.backend.entity.StudentIaMarksRecord;
import com.acadion.backend.service.IaMarksIngestionService;
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
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/classrooms/{classroomId}/intelligence")
@RequiredArgsConstructor
public class AcademicIntelligenceController {

    private final IaMarksIngestionService iaMarksIngestionService;

    /**
     * Download sample Excel template (.xlsx) pre-populated with enrolled students.
     */
    @GetMapping("/download-sample-template")
    public ResponseEntity<byte[]> downloadSampleTemplate(
            @PathVariable("classroomId") String classroomId
    ) {
        try {
            byte[] fileBytes = iaMarksIngestionService.generateSampleTemplate(classroomId);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
            headers.setContentDispositionFormData("attachment", "Iot-7A-SplitupMarks.xlsx");
            headers.setCacheControl("must-revalidate, post-check=0, pre-check=0");

            return new ResponseEntity<>(fileBytes, headers, HttpStatus.OK);
        } catch (IOException e) {
            log.error("Failed to generate IA sample template for classroom {}", classroomId, e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to generate Excel template: " + e.getMessage());
        }
    }

    /**
     * Upload and parse completed IA Split-Up Marks Excel file.
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
}
