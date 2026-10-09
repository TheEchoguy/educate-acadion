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
    public List<QuestionPaper> getPapers() {

        return questionPaperService.getAllPapers();
    }

    @GetMapping("/{paperId}")
    public ResponseEntity<?> getPaper(
            @PathVariable String paperId
    ) {

        try {
            return ResponseEntity.ok(
                    questionPaperService.getPaper(paperId)
            );
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(e.getMessage());
        }
    }

    @PutMapping("/{paperId}")
    public ResponseEntity<?> updatePaper(
            @PathVariable String paperId,
            @RequestBody CreateQuestionPaperRequest request
    ) {

        try {
            return ResponseEntity.ok(
                    questionPaperService.updatePaper(paperId, request)
            );
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(e.getMessage());
        }
    }

    @DeleteMapping("/{paperId}")
    public ResponseEntity<?> deletePaper(
            @PathVariable String paperId
    ) {

        try {
            return ResponseEntity.ok(
                    questionPaperService.deletePaper(paperId)
            );
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(e.getMessage());
        }
    }

    @PutMapping("/{paperId}/practice-toggle")
    public ResponseEntity<?> togglePractice(
            @PathVariable String paperId,
            @RequestBody(required = false) java.util.Map<String, Object> payload
    ) {
        try {
            Boolean allowed = payload != null && payload.containsKey("allowedForPractice")
                    ? (Boolean) payload.get("allowedForPractice")
                    : null;
            String semester = payload != null && payload.containsKey("assignedSemester")
                    ? (String) payload.get("assignedSemester")
                    : null;
            return ResponseEntity.ok(questionPaperService.togglePracticeStatus(paperId, allowed, semester));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Failed to update practice status: " + e.getMessage());
        }
    }

    @PostMapping("/create")
    public ResponseEntity<?> createPaper(
            @RequestBody CreateQuestionPaperRequest request
    ) {

        try {
            return ResponseEntity.ok(
                    questionPaperService.createPaper(request)
            );
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body("Failed to create paper: " + e.getMessage());
        }
    }
}
