package com.acadion.backend.controller;

import com.acadion.backend.dto.EnrichedStudentResponseDto;
import com.acadion.backend.dto.EvaluateResponseRequest;
import com.acadion.backend.dto.EvaluationSummaryDto;
import com.acadion.backend.dto.ResponseSubmissionRequest;
import com.acadion.backend.dto.TeacherVerifyRequest;
import com.acadion.backend.entity.StudentResponse;
import com.acadion.backend.service.StudentResponseService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/responses")
@RequiredArgsConstructor
public class StudentResponseController {

    private final StudentResponseService studentResponseService;

    @PostMapping
    public StudentResponse submitResponse(@Valid @RequestBody ResponseSubmissionRequest request) {
        return studentResponseService.submit(request);
    }

    @GetMapping("/paper/{paperId}")
    public List<StudentResponse> getByPaper(@PathVariable String paperId) {
        return studentResponseService.getByPaper(paperId);
    }

    @GetMapping
    public List<StudentResponse> getAllResponses() {
        return studentResponseService.getAllResponses();
    }

    @GetMapping("/student/{studentId}")
    public List<StudentResponse> getByStudent(@PathVariable String studentId) {
        return studentResponseService.getByStudent(studentId);
    }

    @PutMapping("/evaluate")
    public StudentResponse evaluateResponse(@RequestBody EvaluateResponseRequest request) {
        return studentResponseService.evaluateResponse(request);
    }

    // Grant Re-Exam to Student
    @PostMapping("/{responseId}/grant-re-exam")
    public ResponseEntity<?> grantReExam(
            @PathVariable String responseId,
            @RequestBody(required = false) Map<String, String> body
    ) {
        try {
            String note = body != null ? body.get("note") : null;
            StudentResponse updated = studentResponseService.grantReExam(responseId, note);
            return ResponseEntity.ok(Map.of(
                    "message", "Re-exam granted successfully for attempt #" + ((updated.getAttemptCount() != null ? updated.getAttemptCount() : 1) + 1),
                    "response", updated
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    // 1. Get Teacher's Authorized Subjects
    @GetMapping("/teacher/my-subjects")
    public ResponseEntity<?> getMySubjects(@RequestParam String email) {
        try {
            Map<String, Object> res = studentResponseService.getMySubjects(email);
            return ResponseEntity.ok(res);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    // 2. Teacher Verification & Subject Confirmation
    @PostMapping("/teacher/verify-access")
    public ResponseEntity<?> verifyTeacherAccess(@RequestBody TeacherVerifyRequest request) {
        try {
            Map<String, Object> res = studentResponseService.verifyTeacherAccess(request);
            return ResponseEntity.ok(res);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    // 2. Enriched Student Responses Filtered by Semester, Subject, and Paper ID
    @GetMapping("/enriched")
    public List<EnrichedStudentResponseDto> getEnrichedResponses(
            @RequestParam(required = false) String paperId,
            @RequestParam(required = false) Integer semester,
            @RequestParam(required = false) String subject
    ) {
        return studentResponseService.getEnrichedResponses(paperId, semester, subject);
    }

    // 3. Send Evaluation Result Email to Student
    @PostMapping("/{responseId}/send-email")
    public ResponseEntity<?> sendEvaluationEmail(@PathVariable String responseId) {
        try {
            Map<String, Object> res = studentResponseService.sendEvaluationEmailToStudent(responseId);
            return ResponseEntity.ok(res);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    // 4. Export Class Evaluation Report to Excel (.xlsx)
    @GetMapping("/export-excel")
    public ResponseEntity<byte[]> exportExcel(
            @RequestParam(required = false) String paperId,
            @RequestParam(required = false) Integer semester,
            @RequestParam(required = false) String subject
    ) throws IOException {
        byte[] excelBytes = studentResponseService.generateExcelReport(paperId, semester, subject);

        String filename = "Evaluation_Report_" + (subject != null ? subject.replaceAll("\\s+", "_") : "All") + ".xlsx";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(excelBytes);
    }

    // 5. Overall Class Evaluation Summary Statistics
    @GetMapping("/summary")
    public EvaluationSummaryDto getSummary(
            @RequestParam(required = false) String paperId,
            @RequestParam(required = false) Integer semester,
            @RequestParam(required = false) String subject
    ) {
        return studentResponseService.getOverallSummary(paperId, semester, subject);
    }

    // 6. Export Individual Student Submission to Excel
    @GetMapping("/my-submission-excel/{responseId}")
    public ResponseEntity<byte[]> exportSingleSubmissionExcel(@PathVariable String responseId) {
        try {
            byte[] excelBytes = studentResponseService.exportSingleSubmissionToExcel(responseId);
            String filename = "Exam_Submission_" + responseId + ".xlsx";

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                    .contentType(MediaType.APPLICATION_OCTET_STREAM)
                    .body(excelBytes);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    // 7. Student Self Evaluation
    @PostMapping("/{responseId}/self-evaluate")
    public ResponseEntity<?> selfEvaluate(
            @PathVariable String responseId,
            @RequestBody List<EvaluateResponseRequest.QuestionScoreRequest> scores
    ) {
        try {
            StudentResponse updated = studentResponseService.selfEvaluateResponse(responseId, scores);
            return ResponseEntity.ok(Map.of(
                    "message", "Self-evaluation completed successfully!",
                    "response", updated
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    // 8. Student Peer Evaluation (Friend Review)
    @PostMapping("/{responseId}/peer-evaluate")
    public ResponseEntity<?> peerEvaluate(
            @PathVariable String responseId,
            @RequestBody Map<String, Object> body
    ) {
        try {
            String peerUsn = (String) body.get("peerUsn");
            String peerName = (String) body.get("peerName");
            String peerFeedback = (String) body.get("peerFeedback");
            // Map scores list
            List<?> scoresRaw = (List<?>) body.get("scores");
            List<EvaluateResponseRequest.QuestionScoreRequest> scoreList = new ArrayList<>();
            if (scoresRaw != null) {
                for (Object item : scoresRaw) {
                    if (item instanceof Map<?, ?> map) {
                        scoreList.add(EvaluateResponseRequest.QuestionScoreRequest.builder()
                                .questionId((String) map.get("questionId"))
                                .marksObtained(map.get("marksObtained") != null ? Double.valueOf(map.get("marksObtained").toString()) : 0.0)
                                .feedback((String) map.get("feedback"))
                                .build());
                    }
                }
            }

            StudentResponse updated = studentResponseService.peerEvaluateResponse(
                    responseId, peerUsn, peerName, peerFeedback, scoreList
            );

            return ResponseEntity.ok(Map.of(
                    "message", "Peer evaluation saved successfully!",
                    "response", updated
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/{responseId}/assign-peer")
    public ResponseEntity<?> assignPeerReview(
            @PathVariable String responseId,
            @RequestBody Map<String, String> body
    ) {
        try {
            String friendUsn = body.get("friendUsn");
            String friendName = body.get("friendName");

            StudentResponse updated = studentResponseService.assignPeerReview(responseId, friendUsn, friendName);
            return ResponseEntity.ok(Map.of(
                    "message", "Assigned practice paper to " + (friendName != null ? friendName : friendUsn) + " for peer review!",
                    "response", updated
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}
