package com.acadion.backend.controller;

import com.acadion.backend.dto.CreateQuestionPaperRequest;
import com.acadion.backend.entity.QuestionPaper;
import com.acadion.backend.service.QuestionPaperService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/papers")
@RequiredArgsConstructor
public class QuestionPaperController {

    private final QuestionPaperService questionPaperService;

    @PostMapping(
            value = "/upload",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    public ResponseEntity<?> uploadPaper(
            @RequestParam("file") MultipartFile file,
            @RequestParam(required = false) String paperId,
            @RequestParam(required = false) String subject,
            @RequestParam(required = false) Integer internalNo
    ) {

        try {
            QuestionPaper paper = questionPaperService
                    .uploadPaper(file, paperId, subject, internalNo);
            return ResponseEntity.ok(paper);
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body("Upload failed: " + e.getMessage());
        }
    }

    @GetMapping
    public List<QuestionPaper> getPapers(
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status,
            org.springframework.security.core.Authentication authentication
    ) {
        String effectiveRole = resolveEffectiveRole(authentication, role);
        return questionPaperService.getAllPapers(effectiveRole, status);
    }

    @GetMapping("/{paperId}")
    public ResponseEntity<?> getPaper(
            @PathVariable String paperId,
            org.springframework.security.core.Authentication authentication
    ) {
        try {
            QuestionPaper paper = questionPaperService.getPaper(paperId);
            String effectiveRole = resolveEffectiveRole(authentication, null);
            if ("STUDENT".equalsIgnoreCase(effectiveRole)) {
                if (paper.getPublicationStatus() != null && "DRAFT".equalsIgnoreCase(paper.getPublicationStatus())) {
                    return ResponseEntity.status(org.springframework.http.HttpStatus.NOT_FOUND)
                            .body("Question paper not found or not published.");
                }
                return ResponseEntity.ok(questionPaperService.sanitizeForStudent(paper));
            }
            return ResponseEntity.ok(paper);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(e.getMessage());
        }
    }

    @PutMapping("/{paperId}")
    public ResponseEntity<?> updatePaper(
            @PathVariable String paperId,
            @RequestBody CreateQuestionPaperRequest request,
            org.springframework.security.core.Authentication authentication
    ) {
        try {
            verifyTeacherOrAdmin(authentication, paperId);
            return ResponseEntity.ok(
                    questionPaperService.updatePaper(paperId, request)
            );
        } catch (org.springframework.web.server.ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode()).body(e.getReason());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(e.getMessage());
        }
    }

    @DeleteMapping("/{paperId}")
    public ResponseEntity<?> deletePaper(
            @PathVariable String paperId,
            org.springframework.security.core.Authentication authentication
    ) {
        try {
            verifyTeacherOrAdmin(authentication, paperId);
            return ResponseEntity.ok(
                    questionPaperService.deletePaper(paperId)
            );
        } catch (org.springframework.web.server.ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode()).body(e.getReason());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(e.getMessage());
        }
    }

    @PutMapping("/{paperId}/practice-toggle")
    public ResponseEntity<?> togglePractice(
            @PathVariable String paperId,
            @RequestBody(required = false) java.util.Map<String, Object> payload,
            org.springframework.security.core.Authentication authentication
    ) {
        try {
            verifyTeacherOrAdmin(authentication, paperId);
            Boolean allowed = payload != null && payload.containsKey("allowedForPractice")
                    ? (Boolean) payload.get("allowedForPractice")
                    : null;
            String semester = payload != null && payload.containsKey("assignedSemester")
                    ? (String) payload.get("assignedSemester")
                    : null;
            return ResponseEntity.ok(questionPaperService.togglePracticeStatus(paperId, allowed, semester));
        } catch (org.springframework.web.server.ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode()).body(e.getReason());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Failed to update practice status: " + e.getMessage());
        }
    }

    @PostMapping("/create")
    public ResponseEntity<?> createPaper(
            @RequestBody CreateQuestionPaperRequest request,
            org.springframework.security.core.Authentication authentication
    ) {
        try {
            verifyTeacherOrAdmin(authentication, null);
            if (authentication != null && authentication.getName() != null) {
                request.setCreatedBy(authentication.getName());
            }
            return ResponseEntity.ok(
                    questionPaperService.createPaper(request)
            );
        } catch (org.springframework.web.server.ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode()).body(e.getReason());
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body("Failed to create paper: " + e.getMessage());
        }
    }

    private String resolveEffectiveRole(org.springframework.security.core.Authentication authentication, String clientRoleParam) {
        if (authentication != null && authentication.isAuthenticated() && !"anonymousUser".equals(authentication.getPrincipal())) {
            for (org.springframework.security.core.GrantedAuthority ga : authentication.getAuthorities()) {
                String auth = ga.getAuthority();
                if ("TEACHER".equalsIgnoreCase(auth) || "ROLE_TEACHER".equalsIgnoreCase(auth)
                        || "ADMIN".equalsIgnoreCase(auth) || "ROLE_ADMIN".equalsIgnoreCase(auth)) {
                    return (clientRoleParam != null && !clientRoleParam.isBlank()) ? clientRoleParam : "TEACHER";
                }
            }
        }
        return "STUDENT";
    }

    private void verifyTeacherOrAdmin(org.springframework.security.core.Authentication authentication, String paperId) {
        if (authentication == null || !authentication.isAuthenticated() || "anonymousUser".equals(authentication.getPrincipal())) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        boolean isTeacherOrAdmin = false;
        boolean isAdmin = false;
        for (org.springframework.security.core.GrantedAuthority ga : authentication.getAuthorities()) {
            String a = ga.getAuthority();
            if ("TEACHER".equalsIgnoreCase(a) || "ROLE_TEACHER".equalsIgnoreCase(a)) isTeacherOrAdmin = true;
            if ("ADMIN".equalsIgnoreCase(a) || "ROLE_ADMIN".equalsIgnoreCase(a)) {
                isTeacherOrAdmin = true;
                isAdmin = true;
            }
        }
        if (!isTeacherOrAdmin) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.FORBIDDEN, "Only teachers or administrators can perform this action");
        }
        if (paperId != null && !isAdmin) {
            try {
                QuestionPaper p = questionPaperService.getPaper(paperId);
                if (p != null && p.getCreatedBy() != null && !p.getCreatedBy().isBlank()) {
                    if (!p.getCreatedBy().equalsIgnoreCase(authentication.getName())) {
                        throw new org.springframework.web.server.ResponseStatusException(
                                org.springframework.http.HttpStatus.FORBIDDEN, "You cannot modify or delete another teacher's question paper");
                    }
                }
            } catch (org.springframework.web.server.ResponseStatusException rse) {
                throw rse;
            } catch (Exception ignored) {
            }
        }
    }
}
