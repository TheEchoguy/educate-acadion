package com.acadion.backend.controller;

import com.acadion.backend.dto.syllabus.PublishSyllabusRequest;
import com.acadion.backend.dto.syllabus.SyllabusVersionResponse;
import com.acadion.backend.dto.syllabus.SyllabusVersionSummaryResponse;
import com.acadion.backend.service.SyllabusPublicationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/classrooms/{classroomId}/syllabus/versions")
@RequiredArgsConstructor
public class SyllabusPublicationController {

    private final SyllabusPublicationService publicationService;

    /**
     * Publish the current syllabus draft as an immutable snapshot version.
     * Only authorized faculty owner or admin may publish.
     */
    @PostMapping("/publish")
    public ResponseEntity<SyllabusVersionResponse> publishSyllabus(
            @PathVariable("classroomId") String classroomId,
            @Valid @RequestBody(required = false) PublishSyllabusRequest request,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        SyllabusVersionResponse response = publicationService.publishSyllabus(classroomId, request, email);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * List all published syllabus versions for a classroom.
     */
    @GetMapping
    public ResponseEntity<List<SyllabusVersionSummaryResponse>> getPublishedVersions(
            @PathVariable("classroomId") String classroomId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        List<SyllabusVersionSummaryResponse> response = publicationService.getPublishedVersions(classroomId, email);
        return ResponseEntity.ok(response);
    }

    /**
     * Retrieve a specific published version by ID or version number.
     */
    @GetMapping("/{versionId}")
    public ResponseEntity<SyllabusVersionResponse> getPublishedVersion(
            @PathVariable("classroomId") String classroomId,
            @PathVariable("versionId") String versionId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        SyllabusVersionResponse response = publicationService.getPublishedVersionByIdOrNumber(classroomId, versionId, email);
        return ResponseEntity.ok(response);
    }

    private String getAuthenticatedEmail(Principal principal) {
        if (principal == null || principal.getName() == null || principal.getName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User authentication required");
        }
        return principal.getName();
    }
}
