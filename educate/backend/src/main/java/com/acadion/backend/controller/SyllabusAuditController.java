package com.acadion.backend.controller;

import com.acadion.backend.dto.syllabus.SyllabusAuditEventResponse;
import com.acadion.backend.service.SyllabusAuditService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/classrooms/{classroomId}/syllabus/audit")
@RequiredArgsConstructor
public class SyllabusAuditController {

    private final SyllabusAuditService auditService;

    /**
     * Retrieve read-only append-only audit trail for a classroom's syllabus operations.
     * Accessible only by the classroom teacher owner or administrator.
     */
    @GetMapping
    public ResponseEntity<List<SyllabusAuditEventResponse>> getAuditHistory(
            @PathVariable("classroomId") String classroomId,
            @RequestParam(value = "topicId", required = false) String topicId,
            @RequestParam(value = "page", defaultValue = "0") Integer page,
            @RequestParam(value = "limit", defaultValue = "50") Integer limit,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        List<SyllabusAuditEventResponse> response = auditService.getAuditEvents(classroomId, topicId, page, limit, email);
        return ResponseEntity.ok(response);
    }

    private String getAuthenticatedEmail(Principal principal) {
        if (principal == null || principal.getName() == null || principal.getName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User authentication required");
        }
        return principal.getName();
    }
}
