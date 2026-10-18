package com.acadion.backend.controller;

import com.acadion.backend.service.SyllabusExportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.Locale;

@RestController
@RequiredArgsConstructor
public class SyllabusExportController {

    private final SyllabusExportService exportService;

    /**
     * Export syllabus topics as CSV or Excel.
     */
    @GetMapping("/api/classrooms/{classroomId}/syllabus/export")
    public ResponseEntity<byte[]> exportSyllabus(
            @PathVariable("classroomId") String classroomId,
            @RequestParam(value = "format", defaultValue = "csv") String format,
            @RequestParam(value = "versionId", required = false) String versionId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        String normFormat = normalizeFormat(format);

        byte[] content;
        MediaType mediaType;
        String extension;

        if ("csv".equals(normFormat)) {
            content = exportService.exportSyllabusCsv(classroomId, versionId, email);
            mediaType = MediaType.parseMediaType("text/csv; charset=UTF-8");
            extension = "csv";
        } else if ("xlsx".equals(normFormat)) {
            content = exportService.exportSyllabusExcel(classroomId, versionId, email);
            mediaType = MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            extension = "xlsx";
        } else {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid export format: " + format + ". Supported formats are 'csv' and 'xlsx'."
            );
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(mediaType);
        headers.setContentDisposition(
                ContentDisposition.attachment()
                        .filename("syllabus-" + classroomId + "." + extension)
                        .build()
        );

        return new ResponseEntity<>(content, headers, HttpStatus.OK);
    }

    /**
     * Export teaching coverage, progress, and revision summary as CSV or Excel.
     */
    @GetMapping("/api/classrooms/{classroomId}/syllabus/export/progress")
    public ResponseEntity<byte[]> exportProgress(
            @PathVariable("classroomId") String classroomId,
            @RequestParam(value = "format", defaultValue = "csv") String format,
            @RequestParam(value = "versionId", required = false) String versionId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        String normFormat = normalizeFormat(format);

        byte[] content;
        MediaType mediaType;
        String extension;

        if ("csv".equals(normFormat)) {
            content = exportService.exportProgressCsv(classroomId, versionId, email);
            mediaType = MediaType.parseMediaType("text/csv; charset=UTF-8");
            extension = "csv";
        } else if ("xlsx".equals(normFormat)) {
            content = exportService.exportProgressExcel(classroomId, versionId, email);
            mediaType = MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            extension = "xlsx";
        } else {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid export format: " + format + ". Supported formats are 'csv' and 'xlsx'."
            );
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(mediaType);
        headers.setContentDisposition(
                ContentDisposition.attachment()
                        .filename("syllabus-progress-" + classroomId + "." + extension)
                        .build()
        );

        return new ResponseEntity<>(content, headers, HttpStatus.OK);
    }

    private String normalizeFormat(String format) {
        if (format == null) {
            return "csv";
        }
        return format.trim().toLowerCase(Locale.ROOT);
    }

    private String getAuthenticatedEmail(Principal principal) {
        if (principal == null || principal.getName() == null || principal.getName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        return principal.getName();
    }
}
