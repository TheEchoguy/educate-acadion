package com.acadion.backend.controller;

import com.acadion.backend.dto.syllabus.AssessmentMappingResponse;
import com.acadion.backend.dto.syllabus.AssessmentMappingSuggestionResponse;
import com.acadion.backend.dto.syllabus.CreateAssessmentMappingRequest;
import com.acadion.backend.service.SyllabusAssessmentMappingService;
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
public class SyllabusAssessmentMappingController {

    private final SyllabusAssessmentMappingService mappingService;

    /**
     * List authorized assessment mappings for a classroom (optionally filtered by topicId).
     */
    @GetMapping("/assessment-mappings")
    public ResponseEntity<List<AssessmentMappingResponse>> getAssessmentMappings(
            @PathVariable("classroomId") String classroomId,
            @RequestParam(value = "topicId", required = false) String topicId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        List<AssessmentMappingResponse> response = mappingService.getMappings(classroomId, topicId, email);
        return ResponseEntity.ok(response);
    }

    /**
     * Create a manual assessment-to-syllabus mapping.
     */
    @PostMapping("/assessment-mappings")
    public ResponseEntity<AssessmentMappingResponse> createManualMapping(
            @PathVariable("classroomId") String classroomId,
            @Valid @RequestBody CreateAssessmentMappingRequest request,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        AssessmentMappingResponse response = mappingService.createManualMapping(classroomId, request, email);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Retrieve unconfirmed explainable assessment mapping suggestions for a syllabus topic.
     */
    @GetMapping("/topics/{topicId}/mapping-suggestions")
    public ResponseEntity<List<AssessmentMappingSuggestionResponse>> getMappingSuggestions(
            @PathVariable("classroomId") String classroomId,
            @PathVariable("topicId") String topicId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        List<AssessmentMappingSuggestionResponse> response = mappingService.getMappingSuggestions(classroomId, topicId, email);
        return ResponseEntity.ok(response);
    }

    /**
     * Confirm an existing suggested mapping by mapping ID.
     */
    @PostMapping("/assessment-mappings/{mappingId}/confirm")
    public ResponseEntity<AssessmentMappingResponse> confirmMapping(
            @PathVariable("classroomId") String classroomId,
            @PathVariable("mappingId") String mappingId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        AssessmentMappingResponse response = mappingService.confirmMappingById(classroomId, mappingId, email);
        return ResponseEntity.ok(response);
    }

    /**
     * Confirm a suggested mapping directly from recommendation body.
     */
    @PostMapping("/assessment-mappings/confirm")
    public ResponseEntity<AssessmentMappingResponse> confirmSuggestedMappingFromBody(
            @PathVariable("classroomId") String classroomId,
            @Valid @RequestBody CreateAssessmentMappingRequest request,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        AssessmentMappingResponse response = mappingService.confirmSuggestedMapping(classroomId, request, email);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Delete an authorized assessment mapping.
     */
    @DeleteMapping("/assessment-mappings/{mappingId}")
    public ResponseEntity<Void> deleteAssessmentMapping(
            @PathVariable("classroomId") String classroomId,
            @PathVariable("mappingId") String mappingId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        mappingService.deleteMapping(classroomId, mappingId, email);
        return ResponseEntity.noContent().build();
    }

    private String getAuthenticatedEmail(Principal principal) {
        if (principal == null || principal.getName() == null || principal.getName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User authentication required");
        }
        return principal.getName();
    }
}
