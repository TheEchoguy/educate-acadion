package com.acadion.backend.controller;

import com.acadion.backend.dto.CreateQuestionPaperRequest;
import com.acadion.backend.dto.quiz.GenerateQuizRequest;
import com.acadion.backend.dto.quiz.GeneratedQuestionDto;
import com.acadion.backend.dto.quiz.GeneratedQuizResponse;
import com.acadion.backend.dto.quiz.RegenerateQuestionRequest;
import com.acadion.backend.entity.QuestionPaper;
import com.acadion.backend.service.quiz.QuizGeneratorService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/quiz-generator")
@RequiredArgsConstructor
public class QuizGeneratorController {

    private final QuizGeneratorService quizGeneratorService;

    /**
     * Generate an MCQ quiz from JSON payload (Topic-Based or Pasted Notes).
     */
    @PostMapping(value = "/generate", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> generateQuizJson(@RequestBody(required = false) GenerateQuizRequest request) {
        try {
            if (request == null) {
                request = new GenerateQuizRequest();
            }
            GeneratedQuizResponse response = quizGeneratorService.generateQuiz(request, null);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to generate quiz (JSON): {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of("success", false, "error", "Generation error: " + e.getMessage()));
        }
    }

    /**
     * Generate an MCQ quiz from Multipart request with uploaded document (Notes-Based).
     */
    @PostMapping(value = "/generate", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> generateQuizMultipart(
            @RequestPart(value = "file", required = false) MultipartFile file,
            @RequestPart(value = "request", required = false) GenerateQuizRequest jsonPart,
            @ModelAttribute GenerateQuizRequest formRequest,
            @RequestParam(value = "subject", required = false) String subject,
            @RequestParam(value = "topic", required = false) String topic,
            @RequestParam(value = "mode", required = false) String mode,
            @RequestParam(value = "notesText", required = false) String notesText,
            @RequestParam(value = "questionCount", required = false) Integer questionCount,
            @RequestParam(value = "difficulty", required = false) String difficulty,
            @RequestParam(value = "semester", required = false) String semester,
            @RequestParam(value = "marksPerQuestion", required = false) Double marksPerQuestion,
            @RequestParam(value = "includeExplanations", required = false) Boolean includeExplanations,
            @RequestParam(value = "createdBy", required = false) String createdBy,
            @RequestParam(value = "mock", required = false) Boolean mock
    ) {
        try {
            GenerateQuizRequest request = jsonPart != null ? jsonPart : (formRequest != null ? formRequest : new GenerateQuizRequest());

            // Override with explicit form params if present
            if (subject != null && !subject.isBlank()) request.setSubject(subject);
            if (topic != null && !topic.isBlank()) request.setTopic(topic);
            if (mode != null && !mode.isBlank()) request.setMode(mode);
            if (notesText != null && !notesText.isBlank()) request.setNotesText(notesText);
            if (questionCount != null) request.setQuestionCount(questionCount);
            if (difficulty != null && !difficulty.isBlank()) request.setDifficulty(difficulty);
            if (semester != null && !semester.isBlank()) request.setSemester(semester);
            if (marksPerQuestion != null) request.setMarksPerQuestion(marksPerQuestion);
            if (includeExplanations != null) request.setIncludeExplanations(includeExplanations);
            if (createdBy != null && !createdBy.isBlank()) request.setCreatedBy(createdBy);
            if (mock != null) request.setMock(mock);

            GeneratedQuizResponse response = quizGeneratorService.generateQuiz(request, file);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to generate quiz (Multipart): {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of("success", false, "error", "Generation error: " + e.getMessage()));
        }
    }

    /**
     * Extract text from uploaded document notes.
     */
    @PostMapping(value = "/extract-notes", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> extractNotes(@RequestParam("file") MultipartFile file) {
        try {
            String extracted = quizGeneratorService.extractNotesText(file);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "fileName", file.getOriginalFilename(),
                    "fileSize", file.getSize(),
                    "text", extracted,
                    "charCount", extracted.length()
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    /**
     * Regenerate an individual question.
     */
    @PostMapping("/regenerate-question")
    public ResponseEntity<?> regenerateQuestion(@RequestBody RegenerateQuestionRequest request) {
        try {
            GeneratedQuestionDto q = quizGeneratorService.regenerateQuestion(request);
            return ResponseEntity.ok(Map.of("success", true, "question", q));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    /**
     * Save reviewed quiz as a Draft.
     */
    @PostMapping("/draft")
    public ResponseEntity<?> saveDraft(
            @RequestBody CreateQuestionPaperRequest request,
            @RequestParam(required = false) String teacherEmail,
            java.security.Principal principal
    ) {
        try {
            String effectiveEmail = resolveTeacherEmail(principal, teacherEmail);
            QuestionPaper draft = quizGeneratorService.saveDraft(request, effectiveEmail);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Quiz draft saved successfully.",
                    "paper", draft
            ));
        } catch (org.springframework.web.server.ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode()).body(Map.of("success", false, "error", e.getReason()));
        } catch (Exception e) {
            log.error("Failed to save draft: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    /**
     * List drafts for a teacher.
     */
    @GetMapping("/drafts")
    public ResponseEntity<?> getDrafts(
            @RequestParam(required = false) String teacherEmail,
            java.security.Principal principal
    ) {
        try {
            String effectiveEmail = resolveTeacherEmail(principal, teacherEmail);
            List<QuestionPaper> drafts = quizGeneratorService.getTeacherDrafts(effectiveEmail);
            return ResponseEntity.ok(drafts);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    /**
     * Publish an approved quiz.
     */
    @PostMapping("/publish")
    public ResponseEntity<?> publishQuiz(
            @RequestBody CreateQuestionPaperRequest request,
            @RequestParam(required = false) String teacherEmail,
            java.security.Principal principal
    ) {
        try {
            String effectiveEmail = resolveTeacherEmail(principal, teacherEmail);
            QuestionPaper published = quizGeneratorService.publishQuiz(null, request, effectiveEmail);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Quiz published successfully to Acadion examinations and practice portal.",
                    "paper", published
            ));
        } catch (org.springframework.web.server.ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode()).body(Map.of("success", false, "error", e.getReason()));
        } catch (Exception e) {
            log.error("Failed to publish quiz: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    /**
     * Publish an existing draft.
     */
    @PutMapping("/{paperId}/publish")
    public ResponseEntity<?> publishExistingDraft(
            @PathVariable String paperId,
            @RequestBody CreateQuestionPaperRequest request,
            @RequestParam(required = false) String teacherEmail,
            java.security.Principal principal
    ) {
        try {
            String effectiveEmail = resolveTeacherEmail(principal, teacherEmail);
            QuestionPaper published = quizGeneratorService.publishQuiz(paperId, request, effectiveEmail);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Quiz published successfully.",
                    "paper", published
            ));
        } catch (org.springframework.web.server.ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode()).body(Map.of("success", false, "error", e.getReason()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    private String resolveTeacherEmail(java.security.Principal principal, String fallbackEmail) {
        if (principal != null && principal.getName() != null && !principal.getName().isBlank()) {
            return principal.getName();
        }
        if (fallbackEmail != null && !fallbackEmail.isBlank()) {
            return fallbackEmail;
        }
        return "teacher@acadion.com";
    }
}
