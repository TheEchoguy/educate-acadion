package com.acadion.backend.controller;

import com.acadion.backend.dto.syllabus.StudentRevisionSummaryResponse;
import com.acadion.backend.dto.syllabus.StudentSyllabusRevisionResponse;
import com.acadion.backend.dto.syllabus.UpdateRevisionProgressRequest;
import com.acadion.backend.service.StudentSyllabusRevisionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/classrooms/{classroomId}/syllabus")
@RequiredArgsConstructor
public class StudentSyllabusRevisionController {

    private final StudentSyllabusRevisionService revisionService;

    /**
     * Retrieve the authenticated student's revision records (optionally for a specific versionId).
     */
    @GetMapping("/my-revisions")
    public ResponseEntity<List<StudentSyllabusRevisionResponse>> getMyRevisions(
            @PathVariable("classroomId") String classroomId,
            @RequestParam(value = "versionId", required = false) String versionId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        List<StudentSyllabusRevisionResponse> response = revisionService.getStudentRevisions(classroomId, versionId, email);
        return ResponseEntity.ok(response);
    }

    /**
     * Create or update the student's own revision record for a topic in a published version.
     */
    @PutMapping("/versions/{versionId}/topics/{topicId}/my-revision")
    public ResponseEntity<StudentSyllabusRevisionResponse> updateMyRevision(
            @PathVariable("classroomId") String classroomId,
            @PathVariable("versionId") String versionId,
            @PathVariable("topicId") String topicId,
            @Valid @RequestBody UpdateRevisionProgressRequest request,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        if (request == null) {
            request = new UpdateRevisionProgressRequest();
        }
        request.setPublishedVersionId(versionId);
        request.setTopicId(topicId);
        StudentSyllabusRevisionResponse response = revisionService.updateRevisionProgress(classroomId, request, email);
        return ResponseEntity.ok(response);
    }

    /**
     * Optional body-directed revision update endpoint.
     */
    @PutMapping("/my-revision")
    public ResponseEntity<StudentSyllabusRevisionResponse> updateMyRevisionFromBody(
            @PathVariable("classroomId") String classroomId,
            @Valid @RequestBody UpdateRevisionProgressRequest request,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        StudentSyllabusRevisionResponse response = revisionService.updateRevisionProgress(classroomId, request, email);
        return ResponseEntity.ok(response);
    }

    /**
     * Retrieve personal revision and self-reported understanding statistics.
     */
    @GetMapping("/my-revisions/summary")
    public ResponseEntity<StudentRevisionSummaryResponse> getMyRevisionSummary(
            @PathVariable("classroomId") String classroomId,
            @RequestParam(value = "versionId", required = false) String versionId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        StudentRevisionSummaryResponse response = revisionService.getStudentRevisionSummary(classroomId, versionId, email);
        return ResponseEntity.ok(response);
    }

    /**
     * Retrieve the student's longitudinal history for the same stable topic across versions.
     */
    @GetMapping("/topics/{topicId}/my-revision-history")
    public ResponseEntity<List<StudentSyllabusRevisionResponse>> getMyTopicRevisionHistory(
            @PathVariable("classroomId") String classroomId,
            @PathVariable("topicId") String topicId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        List<StudentSyllabusRevisionResponse> response = revisionService.getStudentTopicRevisionHistory(classroomId, topicId, email);
        return ResponseEntity.ok(response);
    }

    private String getAuthenticatedEmail(Principal principal) {
        if (principal == null || principal.getName() == null || principal.getName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User authentication required");
        }
        return principal.getName();
    }
}
