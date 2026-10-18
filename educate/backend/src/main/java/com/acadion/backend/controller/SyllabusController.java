package com.acadion.backend.controller;

import com.acadion.backend.dto.syllabus.*;
import com.acadion.backend.service.SyllabusService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/classrooms/{classroomId}/syllabus")
@RequiredArgsConstructor
public class SyllabusController {

    private final SyllabusService syllabusService;

    // 1. List syllabus items for a classroom
    @GetMapping
    public ResponseEntity<List<SyllabusItemResponse>> getSyllabusItems(
            @PathVariable("classroomId") String classroomId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        List<SyllabusItemResponse> response = syllabusService.getSyllabusItems(classroomId, email);
        return ResponseEntity.ok(response);
    }

    // 2. Create a new syllabus topic
    @PostMapping
    public ResponseEntity<SyllabusItemResponse> createSyllabusItem(
            @PathVariable("classroomId") String classroomId,
            @Valid @RequestBody CreateSyllabusItemRequest request,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        SyllabusItemResponse response = syllabusService.createSyllabusItem(classroomId, request, email);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // 3. Update syllabus topic details
    @PutMapping("/{itemId}")
    public ResponseEntity<SyllabusItemResponse> updateSyllabusItem(
            @PathVariable("classroomId") String classroomId,
            @PathVariable("itemId") String itemId,
            @Valid @RequestBody UpdateSyllabusItemRequest request,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        SyllabusItemResponse response = syllabusService.updateSyllabusItem(classroomId, itemId, request, email);
        return ResponseEntity.ok(response);
    }

    // 4. Update topic teaching status
    @PatchMapping("/{itemId}/status")
    public ResponseEntity<SyllabusItemResponse> updateSyllabusStatus(
            @PathVariable("classroomId") String classroomId,
            @PathVariable("itemId") String itemId,
            @Valid @RequestBody UpdateSyllabusStatusRequest request,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        SyllabusItemResponse response = syllabusService.updateSyllabusStatus(classroomId, itemId, request, email);
        return ResponseEntity.ok(response);
    }

    // 5. Delete a syllabus topic
    @DeleteMapping("/{itemId}")
    public ResponseEntity<Map<String, Object>> deleteSyllabusItem(
            @PathVariable("classroomId") String classroomId,
            @PathVariable("itemId") String itemId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        Map<String, Object> response = syllabusService.deleteSyllabusItem(classroomId, itemId, email);
        return ResponseEntity.ok(response);
    }

    // 6. Reorder syllabus topics
    @PutMapping("/order")
    public ResponseEntity<List<SyllabusItemResponse>> reorderSyllabusItems(
            @PathVariable("classroomId") String classroomId,
            @Valid @RequestBody ReorderSyllabusRequest request,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        List<SyllabusItemResponse> response = syllabusService.reorderSyllabusItems(
                classroomId,
                request.getOrderedItemIds(),
                email
        );
        return ResponseEntity.ok(response);
    }

    // 7. Get classroom syllabus coverage statistics
    @GetMapping("/progress")
    public ResponseEntity<SyllabusProgressResponse> getSyllabusProgress(
            @PathVariable("classroomId") String classroomId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        SyllabusProgressResponse response = syllabusService.getSyllabusProgress(classroomId, email);
        return ResponseEntity.ok(response);
    }

    private String getAuthenticatedEmail(Principal principal) {
        if (principal == null || principal.getName() == null || principal.getName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User authentication required");
        }
        return principal.getName();
    }
}
