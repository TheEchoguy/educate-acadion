package com.acadion.backend.controller;

import com.acadion.backend.dto.classroom.CreateAnnouncementRequest;
import com.acadion.backend.entity.ClassroomAnnouncement;
import com.acadion.backend.service.ClassroomAnnouncementService;
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
import java.util.Collections;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/classrooms/{classroomId}/announcements")
@RequiredArgsConstructor
@Slf4j
public class ClassroomAnnouncementController {

    private final ClassroomAnnouncementService announcementService;

    // 1. GET /: Returns all announcements for that classroom
    @GetMapping
    public ResponseEntity<List<ClassroomAnnouncement>> getAnnouncements(
            @PathVariable("classroomId") String classroomId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        List<ClassroomAnnouncement> announcements = announcementService.getAnnouncements(classroomId, email);
        return ResponseEntity.ok(announcements);
    }

    // 2a. POST / (Multipart): Creates an announcement with optional file attachments
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ClassroomAnnouncement> createAnnouncementMultipart(
            @PathVariable("classroomId") String classroomId,
            @RequestParam("title") String title,
            @RequestParam(value = "message", required = false) String message,
            @RequestParam(value = "category", defaultValue = "GENERAL") String category,
            @RequestParam(value = "isPinned", defaultValue = "false") boolean isPinned,
            @RequestParam(value = "files", required = false) List<MultipartFile> files,
            Principal principal
    ) throws IOException {
        String email = getAuthenticatedEmail(principal);
        ClassroomAnnouncement created = announcementService.createAnnouncement(
                classroomId,
                title,
                message,
                category,
                isPinned,
                files,
                email
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    // 2b. POST / (JSON): Creates an announcement from JSON payload
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ClassroomAnnouncement> createAnnouncementJson(
            @PathVariable("classroomId") String classroomId,
            @RequestBody CreateAnnouncementRequest request,
            Principal principal
    ) throws IOException {
        String email = getAuthenticatedEmail(principal);
        ClassroomAnnouncement created = announcementService.createAnnouncement(
                classroomId,
                request.getTitle(),
                request.getMessage(),
                request.getCategory(),
                request.isPinned(),
                Collections.emptyList(),
                email
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    // 3. DELETE /{id}: (Teacher only) Deletes an announcement
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> deleteAnnouncement(
            @PathVariable("classroomId") String classroomId,
            @PathVariable("id") String id,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        announcementService.deleteAnnouncement(classroomId, id, email);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Announcement deleted successfully",
                "id", id
        ));
    }

    // 4. GET /{id}/attachments/{attachmentId}/download: Download attachment file
    @GetMapping("/{id}/attachments/{attachmentId}/download")
    public ResponseEntity<byte[]> downloadAttachment(
            @PathVariable("classroomId") String classroomId,
            @PathVariable("id") String id,
            @PathVariable("attachmentId") String attachmentId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        ClassroomAnnouncement.AnnouncementAttachment att = announcementService.getAttachment(classroomId, id, attachmentId, email);

        if (att.getFileData() == null || att.getFileData().length == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Attachment content is empty or unavailable");
        }

        String mediaType = resolveMediaType(att.getFileName(), att.getFileType());
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + sanitizeFileName(att.getFileName()) + "\"")
                .header(HttpHeaders.CONTENT_TYPE, mediaType)
                .body(att.getFileData());
    }

    private String getAuthenticatedEmail(Principal principal) {
        if (principal == null || principal.getName() == null || principal.getName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User authentication required");
        }
        return principal.getName();
    }

    private String resolveMediaType(String fileName, String fileType) {
        if (fileName != null) {
            String lower = fileName.toLowerCase();
            if (lower.endsWith(".pdf")) return "application/pdf";
            if (lower.endsWith(".pptx")) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
            if (lower.endsWith(".ppt")) return "application/vnd.ms-powerpoint";
            if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            if (lower.endsWith(".doc")) return "application/msword";
            if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
            if (lower.endsWith(".png")) return "image/png";
            if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
            if (lower.endsWith(".txt")) return "text/plain";
            if (lower.endsWith(".zip")) return "application/zip";
        }
        return "application/octet-stream";
    }

    private String sanitizeFileName(String fileName) {
        if (fileName == null) return "attachment";
        return fileName.replaceAll("[^a-zA-Z0-9._-]", "_");
    }
}
