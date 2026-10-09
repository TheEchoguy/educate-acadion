package com.acadion.backend.service;

import com.acadion.backend.dto.*;
import com.acadion.backend.entity.QuestionPaper;
import com.acadion.backend.entity.Role;
import com.acadion.backend.entity.StudentResponse;
import com.acadion.backend.entity.User;
import com.acadion.backend.mail.EmailSenderService;
import com.acadion.backend.repository.StudentResponseRepository;
import com.acadion.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StudentResponseService {

    private final QuestionPaperService questionPaperService;
    private final StudentResponseRepository studentResponseRepository;
    private final PredictionService predictionService;
    private final UserRepository userRepository;
    private final EmailSenderService emailSenderService;
    private final BCryptPasswordEncoder passwordEncoder;

    public StudentResponse submit(ResponseSubmissionRequest request) {
        QuestionPaper paper = questionPaperService.getPaper(request.getPaperId());

        boolean isOffline = "OFFLINE_MANUAL".equalsIgnoreCase(request.getSubmissionMode());
        boolean isExplicitPractice = Boolean.TRUE.equals(request.getIsPractice()) || "PRACTICE".equalsIgnoreCase(request.getSubmissionMode());
        boolean isPaperAllowedForPractice = paper != null && (Boolean.TRUE.equals(paper.getAllowedForPractice()) || "PRACTICE".equalsIgnoreCase(paper.getPaperCategory()));
        boolean isPracticePaper = isExplicitPractice || isPaperAllowedForPractice;

        List<StudentResponse> existingList = studentResponseRepository.findByUsnOrderBySubmittedAtAsc(request.getUsn())
                .stream()
                .filter(r -> r.getPaperId().equalsIgnoreCase(request.getPaperId()))
                .toList();

        // 1. OFFLINE_MANUAL submission by teacher (Written classroom exams)
        if (isOffline) {
            StudentResponse existingOffline = existingList.stream()
                    .filter(r -> "OFFLINE_MANUAL".equalsIgnoreCase(r.getSubmissionMode()))
                    .findFirst()
                    .orElse(null);

            List<StudentResponse.ResponseAnswer> answers = new ArrayList<>();
            double totalMarks = 0.0;
            double maxMarks = 0.0;

            for (ResponseSubmissionRequest.AnswerRequest answerRequest : request.getResponses()) {
                QuestionPaper.Question question = paper != null && paper.getQuestions() != null
                        ? paper.getQuestions().stream()
                            .filter(item -> item.getQuestionId().equalsIgnoreCase(answerRequest.getQuestionId()))
                            .findFirst()
                            .orElse(null)
                        : null;

                double questionMax = question == null || question.getMarks() == null ? 5.0 : question.getMarks();
                String qType = question != null && question.getQuestionType() != null ? question.getQuestionType() : "THEORY";
                double marksObtained = answerRequest.getMarksObtained() != null
                        ? Math.max(0.0, Math.min(questionMax, answerRequest.getMarksObtained()))
                        : 0.0;

                totalMarks += marksObtained;
                maxMarks += questionMax;

                answers.add(
                        StudentResponse.ResponseAnswer.builder()
                                .questionId(answerRequest.getQuestionId())
                                .questionText(question != null ? question.getText() : "")
                                .questionType(qType)
                                .answer(answerRequest.getAnswer() != null ? answerRequest.getAnswer() : "Offline Written Exam")
                                .marksObtained(round(marksObtained))
                                .maxMarks(questionMax)
                                .topic(question == null ? (paper != null ? paper.getSubject() : "General") : question.getTopic())
                                .evaluated(true)
                                .feedback("Offline Written Exam Evaluation")
                                .build()
                );
            }

            double paperEffectiveMax = (paper != null && paper.getMaxMarks() != null && paper.getMaxMarks() > 0)
                    ? paper.getMaxMarks()
                    : (paper != null && paper.getTotalMarks() != null && paper.getTotalMarks() > 0 ? paper.getTotalMarks() : maxMarks);

            StudentResponse offlineResponse = existingOffline != null ? existingOffline : new StudentResponse();
            offlineResponse.setUsn(request.getUsn());
            offlineResponse.setPaperId(request.getPaperId());
            offlineResponse.setSubmissionMode("OFFLINE_MANUAL");
            offlineResponse.setIncludeInOverallPercentage(request.getIncludeInOverallPercentage() != null ? request.getIncludeInOverallPercentage() : true);
            offlineResponse.setPaperCategory(paper != null ? paper.getPaperCategory() : "ASSESSMENT");
            String evaluatorName = (request.getEvaluatedBy() != null && !request.getEvaluatedBy().trim().isEmpty())
                    ? request.getEvaluatedBy().trim()
                    : "Faculty Evaluator";
            offlineResponse.setEvaluatedBy(evaluatorName);
            offlineResponse.setEvaluatedByEmail(request.getEvaluatedByEmail());
            offlineResponse.setEvaluatedAt(LocalDateTime.now());
            offlineResponse.setSubmittedAt(offlineResponse.getSubmittedAt() != null ? offlineResponse.getSubmittedAt() : LocalDateTime.now());
            offlineResponse.setTotalMarks(round(totalMarks));
            offlineResponse.setMaxMarks(round(paperEffectiveMax));

            PredictionResult prediction = predictionService.predictFromResponses(offlineResponse);
            offlineResponse.setPredictedScore(prediction.getPredictedScore());
            offlineResponse.setRiskLevel(prediction.getRiskLevel());

            return studentResponseRepository.save(offlineResponse);
        }

        // 2. ONLINE student exam submission (Digital)
        List<StudentResponse> existingOnlineList = existingList.stream()
                .filter(r -> r.getSubmissionMode() == null || !"OFFLINE_MANUAL".equalsIgnoreCase(r.getSubmissionMode()))
                .toList();

        StudentResponse existingResponse = existingOnlineList.isEmpty() ? null : existingOnlineList.get(existingOnlineList.size() - 1);

        if (!isPracticePaper && existingResponse != null && !existingResponse.isReExamGranted()) {
            throw new RuntimeException("Exam already submitted. Contact your faculty if a re-exam attempt is required.");
        }

        List<StudentResponse.ResponseAnswer> answers = new ArrayList<>();
        double totalMarks = 0.0;
        double maxMarks = 0.0;
        boolean allMcqEvaluated = true;

        for (ResponseSubmissionRequest.AnswerRequest answerRequest : request.getResponses()) {
            QuestionPaper.Question question = paper.getQuestions()
                    .stream()
                    .filter(item -> item.getQuestionId().equalsIgnoreCase(answerRequest.getQuestionId()))
                    .findFirst()
                    .orElse(null);

            double questionMax = question == null || question.getMarks() == null ? 5.0 : question.getMarks();
            String qType = question != null && question.getQuestionType() != null ? question.getQuestionType() : "THEORY";
            boolean isMcq = qType.equalsIgnoreCase("MCQ");

            double marksObtained;
            boolean isCorrect = false;
            String feedback = "";
            boolean evaluated = false;

            if (isMcq && question != null) {
                // Auto-Score MCQ
                String studentAns = answerRequest.getAnswer() != null ? answerRequest.getAnswer().trim() : "";
                isCorrect = isMcqAnswerCorrect(question, studentAns);

                if (isCorrect) {
                    marksObtained = questionMax;
                    feedback = "✓ Correct Answer";
                    evaluated = true;
                } else {
                    marksObtained = 0.0;
                    String correctDisplay = getMcqCorrectAnswerDisplay(question);
                    feedback = "✗ Incorrect. Correct answer: " + correctDisplay;
                    evaluated = true;
                }
            } else {
                allMcqEvaluated = false;
                marksObtained = answerRequest.getMarksObtained() == null
                        ? autoScore(answerRequest.getAnswer(), questionMax)
                        : Math.max(0.0, Math.min(questionMax, answerRequest.getMarksObtained()));
            }

            totalMarks += marksObtained;
            maxMarks += questionMax;

            answers.add(
                    StudentResponse.ResponseAnswer.builder()
                            .questionId(answerRequest.getQuestionId())
                            .questionText(question != null ? question.getText() : "")
                            .questionType(qType)
                            .answer(answerRequest.getAnswer())
                            .isCorrect(isMcq ? isCorrect : null)
                            .marksObtained(round(marksObtained))
                            .maxMarks(questionMax)
                            .topic(question == null ? paper.getSubject() : question.getTopic())
                            .feedback(feedback)
                            .evaluated(evaluated)
                            .build()
            );
        }

        double paperEffectiveMax = (paper != null && paper.getMaxMarks() != null && paper.getMaxMarks() > 0)
                ? paper.getMaxMarks()
                : (paper != null && paper.getTotalMarks() != null && paper.getTotalMarks() > 0 ? paper.getTotalMarks() : maxMarks);

        StudentResponse response;
        if (existingResponse != null && (existingResponse.isReExamGranted() || isPracticePaper)) {
            // Processing Re-Exam or Practice Retake
            int nextAttempt = (existingResponse.getAttemptCount() != null ? existingResponse.getAttemptCount() : 1) + 1;
            existingResponse.setAttemptCount(nextAttempt);
            existingResponse.setReExamGranted(false);
            existingResponse.setSubmissionMode(isExplicitPractice ? "PRACTICE" : "ONLINE");
            existingResponse.setIncludeInOverallPercentage(!isPracticePaper);
            existingResponse.setPaperCategory(isPracticePaper ? "PRACTICE" : (paper != null ? paper.getPaperCategory() : "ASSESSMENT"));
            existingResponse.setPractice(isPracticePaper);
            existingResponse.setEvaluationCompleted(allMcqEvaluated && !isPracticePaper);
            if (allMcqEvaluated) {
                existingResponse.setEvaluatedBy(isPracticePaper ? "Self / Peer Review Required" : "AI Auto-Evaluator (MCQ)");
                existingResponse.setEvaluatedAt(LocalDateTime.now());
            }
            existingResponse.setResponses(answers);
            existingResponse.setSubmittedAt(LocalDateTime.now());
            existingResponse.setTotalMarks(round(totalMarks));
            existingResponse.setMaxMarks(round(paperEffectiveMax));
            response = existingResponse;
        } else {
            response = StudentResponse.builder()
                    .usn(request.getUsn())
                    .paperId(request.getPaperId())
                    .submissionMode(isExplicitPractice ? "PRACTICE" : "ONLINE")
                    .includeInOverallPercentage(!isPracticePaper)
                    .paperCategory(isPracticePaper ? "PRACTICE" : (paper != null ? paper.getPaperCategory() : "ASSESSMENT"))
                    .isPractice(isPracticePaper)
                    .responses(answers)
                    .attemptCount(1)
                    .reExamGranted(false)
                    .evaluationCompleted(allMcqEvaluated && !isPracticePaper)
                    .evaluatedBy(allMcqEvaluated ? (isPracticePaper ? "Self / Peer Review Required" : "AI Auto-Evaluator (MCQ)") : null)
                    .evaluatedAt(allMcqEvaluated ? LocalDateTime.now() : null)
                    .submittedAt(LocalDateTime.now())
                    .totalMarks(round(totalMarks))
                    .maxMarks(round(paperEffectiveMax))
                    .build();
        }

        PredictionResult prediction = predictionService.predictFromResponses(response);
        response.setPredictedScore(prediction.getPredictedScore());
        response.setRiskLevel(prediction.getRiskLevel());

        return studentResponseRepository.save(response);
    }

    private boolean isMcqAnswerCorrect(QuestionPaper.Question question, String studentAns) {
        if (question == null || studentAns == null || studentAns.trim().isEmpty()) return false;
        String correct = question.getCorrectAnswer() != null ? question.getCorrectAnswer().trim() : "";
        if (correct.isEmpty()) return false;

        String cleanStudent = studentAns.trim();
        String cleanCorrect = correct.trim();

        // 1. Direct equals (case-insensitive)
        if (cleanStudent.equalsIgnoreCase(cleanCorrect)) return true;

        List<String> options = question.getOptions();
        if (options != null && !options.isEmpty()) {
            int correctIdx = -1;
            if (cleanCorrect.length() == 1) {
                char c = Character.toUpperCase(cleanCorrect.charAt(0));
                if (c >= 'A' && c <= 'Z') {
                    correctIdx = c - 'A';
                }
            }

            int studentIdx = -1;
            if (cleanStudent.length() == 1) {
                char s = Character.toUpperCase(cleanStudent.charAt(0));
                if (s >= 'A' && s <= 'Z') {
                    studentIdx = s - 'A';
                }
            }

            // Both resolved to option letter indices
            if (studentIdx >= 0 && correctIdx >= 0 && studentIdx == correctIdx) {
                return true;
            }

            // Student typed option text, compare with correct option index text
            if (correctIdx >= 0 && correctIdx < options.size()) {
                String correctOptionText = options.get(correctIdx).trim();
                if (cleanStudent.equalsIgnoreCase(correctOptionText) ||
                    cleanStudent.toLowerCase().startsWith(correctOptionText.toLowerCase()) ||
                    correctOptionText.toLowerCase().startsWith(cleanStudent.toLowerCase())) {
                    return true;
                }
            }

            // Correct was full text, student selected letter
            if (studentIdx >= 0 && studentIdx < options.size()) {
                String studentOptionText = options.get(studentIdx).trim();
                if (cleanCorrect.equalsIgnoreCase(studentOptionText) ||
                    cleanCorrect.toLowerCase().startsWith(studentOptionText.toLowerCase()) ||
                    studentOptionText.toLowerCase().startsWith(cleanCorrect.toLowerCase())) {
                    return true;
                }
            }
        }

        return false;
    }

    private String getMcqCorrectAnswerDisplay(QuestionPaper.Question question) {
        if (question == null) return "N/A";
        String correct = question.getCorrectAnswer();
        if (correct == null || correct.trim().isEmpty()) {
            return "N/A";
        }
        String cleanCorrect = correct.trim();
        List<String> options = question.getOptions();
        if (options != null && !options.isEmpty() && cleanCorrect.length() == 1) {
            char c = Character.toUpperCase(cleanCorrect.charAt(0));
            if (c >= 'A' && c <= 'Z') {
                int idx = c - 'A';
                if (idx >= 0 && idx < options.size()) {
                    return "Option " + cleanCorrect.toUpperCase() + " (" + options.get(idx) + ")";
                }
            }
        }
        return "Option " + cleanCorrect;
    }

    public StudentResponse grantReExam(String responseId, String note) {
        StudentResponse response = studentResponseRepository.findById(responseId)
                .orElseThrow(() -> new RuntimeException("Student submission record not found"));

        response.setReExamGranted(true);
        response.setReExamNote(note != null && !note.trim().isEmpty() ? note.trim() : "Re-exam permitted by faculty for score improvement.");
        response.setReExamGrantedAt(LocalDateTime.now());
        return studentResponseRepository.save(response);
    }

    public List<StudentResponse> getByPaper(String paperId) {
        List<StudentResponse> list = studentResponseRepository.findByPaperId(paperId);
        try {
            QuestionPaper paper = questionPaperService.getPaper(paperId);
            if (paper != null && paper.getMaxMarks() != null && paper.getMaxMarks() > 0) {
                for (StudentResponse r : list) {
                    if (r.getMaxMarks() == null || r.getMaxMarks() > paper.getMaxMarks()) {
                        r.setMaxMarks(paper.getMaxMarks());
                    }
                }
            }
        } catch (Exception ignored) {}
        return list;
    }

    public List<StudentResponse> getByStudent(String usn) {
        List<StudentResponse> list = studentResponseRepository.findByUsnOrderBySubmittedAtAsc(usn);
        for (StudentResponse r : list) {
            try {
                QuestionPaper paper = questionPaperService.getPaper(r.getPaperId());
                if (paper != null && paper.getMaxMarks() != null && paper.getMaxMarks() > 0) {
                    if (r.getMaxMarks() == null || r.getMaxMarks() > paper.getMaxMarks()) {
                        r.setMaxMarks(paper.getMaxMarks());
                    }
                }
            } catch (Exception ignored) {}
        }
        return list;
    }

    private double autoScore(String answer, double maxMarks) {
        if (answer == null || answer.trim().isEmpty()) {
            return 0.0;
        }
        String[] words = answer.trim().split("\\s+");
        double completionRatio = Math.min(1.0, words.length / 45.0);
        return maxMarks * completionRatio;
    }

    private double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    public StudentResponse evaluateResponse(EvaluateResponseRequest request) {
        StudentResponse response = studentResponseRepository.findById(request.getResponseId())
                .orElseThrow(() -> new RuntimeException("Response not found"));

        for (StudentResponse.ResponseAnswer answer : response.getResponses()) {
            if (answer.getQuestionId().equalsIgnoreCase(request.getQuestionId())) {
                answer.setMarksObtained(request.getMarksObtained());
                answer.setFeedback(request.getFeedback());
                answer.setEvaluated(true);
            }
        }

        double totalMarks = response.getResponses().stream()
                .mapToDouble(item -> item.getMarksObtained() == null ? 0 : item.getMarksObtained())
                .sum();

        response.setTotalMarks(round(totalMarks));
        response.setEvaluationCompleted(true);
        response.setEvaluatedBy(request.getEvaluatedBy());
        response.setEvaluatedAt(LocalDateTime.now());

        PredictionResult prediction = predictionService.predictFromResponses(response);
        response.setPredictedScore(prediction.getPredictedScore());
        response.setRiskLevel(prediction.getRiskLevel());

        return studentResponseRepository.save(response);
    }

    public List<StudentResponse> getAllResponses() {
        return studentResponseRepository.findAll();
    }

    // =========================================================================
    // 1. TEACHER SECURITY VERIFICATION & SUBJECT CONFIRMATION GATE
    // =========================================================================
    public Map<String, Object> getMySubjects(String email) {
        User teacher = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Teacher account not found"));

        Map<String, Object> res = new HashMap<>();
        res.put("name", teacher.getName());
        res.put("email", teacher.getEmail());
        res.put("employeeId", teacher.getEmployeeId());
        res.put("department", teacher.getTeacherDepartment());
        res.put("role", teacher.getRole().name());
        res.put("assignedSubjects", teacher.getAssignedSubjects() != null ? teacher.getAssignedSubjects() : new ArrayList<>());
        return res;
    }

    public Map<String, Object> verifyTeacherAccess(TeacherVerifyRequest request) {
        User teacher = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("Teacher account not found"));

        if (!teacher.getRole().equals(Role.TEACHER) && !teacher.getRole().equals(Role.ADMIN)) {
            throw new RuntimeException("Access denied: Not a teacher or admin account");
        }

        if (!teacher.isApproved()) {
            throw new RuntimeException("Teacher account is pending administrator approval");
        }

        if (teacher.isBanned()) {
            throw new RuntimeException("Teacher account is suspended");
        }

        // Validate password
        if (request.getPassword() == null || !passwordEncoder.matches(request.getPassword(), teacher.getPassword())) {
            throw new RuntimeException("Invalid teacher security password");
        }

        // STRICT SUBJECT AUTHORIZATION: Teachers can only evaluate subjects assigned to them by Admin
        if (teacher.getRole().equals(Role.TEACHER)) {
            List<String> assigned = teacher.getAssignedSubjects();
            if (assigned == null || assigned.isEmpty()) {
                throw new RuntimeException("Unauthorized: No teaching subjects have been allocated to your account yet. Please contact the administrator for subject allocation.");
            }

            if (request.getSubject() != null && !request.getSubject().trim().isEmpty() && !request.getSubject().equalsIgnoreCase("ALL")) {
                String requested = request.getSubject().trim().toLowerCase();
                boolean isAuthorized = assigned.stream()
                        .anyMatch(s -> {
                            String sLower = s.trim().toLowerCase();
                            if (sLower.equalsIgnoreCase(requested) || requested.contains(sLower) || sLower.contains(requested)) {
                                return true;
                            }
                            if (sLower.contains("(") && sLower.contains(")")) {
                                String codePart = sLower.substring(sLower.indexOf("(") + 1, sLower.indexOf(")")).trim();
                                if (!codePart.isEmpty() && (requested.contains(codePart) || codePart.contains(requested))) {
                                    return true;
                                }
                                String namePart = sLower.substring(0, sLower.indexOf("(")).trim();
                                if (!namePart.isEmpty() && (requested.contains(namePart) || namePart.contains(requested))) {
                                    return true;
                                }
                            }
                            return false;
                        });

                if (!isAuthorized) {
                    throw new RuntimeException("Access Denied: You are not authorized to evaluate '" + request.getSubject() + "'. You are allocated: " + assigned + ". Please contact the administrator.");
                }
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("verified", true);
        response.put("teacherName", teacher.getName());
        response.put("employeeId", teacher.getEmployeeId());
        response.put("department", teacher.getTeacherDepartment());
        response.put("assignedSubjects", teacher.getAssignedSubjects());
        response.put("verifiedSubject", request.getSubject());
        response.put("verifiedSemester", request.getSemester());
        response.put("message", "Teacher identity and subject authorization verified successfully");

        return response;
    }

    // =========================================================================
    // 2. ENRICHED RESPONSE ROSTER FILTERED BY SEMESTER / SUBJECT / PAPER ID
    // =========================================================================
    public List<EnrichedStudentResponseDto> getEnrichedResponses(String paperId, Integer semester, String subject) {
        List<StudentResponse> responses = studentResponseRepository.findAll();
        List<EnrichedStudentResponseDto> enrichedList = new ArrayList<>();

        for (StudentResponse resp : responses) {
            QuestionPaper paper = null;
            try {
                paper = questionPaperService.getPaper(resp.getPaperId());
            } catch (Exception ignored) {}

            User student = userRepository.findByUsn(resp.getUsn()).orElse(null);

            // Filter conditions
            if (paperId != null && !paperId.trim().isEmpty() && !paperId.equalsIgnoreCase("ALL")) {
                if (!resp.getPaperId().equalsIgnoreCase(paperId.trim())) {
                    continue;
                }
            }

            if (subject != null && !subject.trim().isEmpty() && !subject.equalsIgnoreCase("ALL")) {
                String paperSubject = paper != null ? paper.getSubject() : "";
                if (!paperSubject.toLowerCase().contains(subject.toLowerCase().trim())) {
                    continue;
                }
            }

            if (semester != null && semester > 0) {
                boolean semMatches = false;
                if (student != null && student.getSemester() != null && student.getSemester().equals(semester)) {
                    semMatches = true;
                } else if (paper != null && paper.getSemester() != null) {
                    if (paper.getSemester().contains(String.valueOf(semester))) {
                        semMatches = true;
                    }
                }
                if (!semMatches) {
                    continue;
                }
            }

            double maxM = (paper != null && paper.getMaxMarks() != null && paper.getMaxMarks() > 0)
                    ? paper.getMaxMarks()
                    : (resp.getMaxMarks() != null ? resp.getMaxMarks() : 40.0);

            double totalM = resp.getTotalMarks() != null ? resp.getTotalMarks() : 0.0;
            double percentage = maxM > 0 ? Math.round((totalM / maxM) * 10000.0) / 100.0 : 0.0;

            enrichedList.add(EnrichedStudentResponseDto.builder()
                    .id(resp.getId())
                    .usn(resp.getUsn())
                    .studentName(student != null ? student.getName() : "Student (" + resp.getUsn() + ")")
                    .studentEmail(student != null ? student.getEmail() : null)
                    .semester(student != null ? student.getSemester() : (paper != null ? parseSemester(paper.getSemester()) : null))
                    .department(student != null ? student.getStudentDepartment() : "CSE")
                    .paperId(resp.getPaperId())
                    .subject(paper != null ? paper.getSubject() : resp.getPaperId())
                    .subjectCode(paper != null ? paper.getSubjectCode() : null)
                    .internalNo(paper != null ? paper.getInternalNo() : 1)
                    .submittedAt(resp.getSubmittedAt())
                    .totalMarks(totalM)
                    .maxMarks(maxM)
                    .percentage(percentage)
                    .predictedScore(resp.getPredictedScore())
                    .riskLevel(resp.getRiskLevel() != null ? resp.getRiskLevel() : "LOW")
                    .evaluationCompleted(resp.isEvaluationCompleted())
                    .evaluatedBy(resp.getEvaluatedBy())
                    .evaluatedAt(resp.getEvaluatedAt())
                    .attemptCount(resp.getAttemptCount() != null ? resp.getAttemptCount() : 1)
                    .reExamGranted(resp.isReExamGranted())
                    .reExamNote(resp.getReExamNote())
                    .reExamGrantedAt(resp.getReExamGrantedAt())
                    .submissionMode(resp.getSubmissionMode() != null ? resp.getSubmissionMode() : "ONLINE")
                    .includeInOverallPercentage(resp.getIncludeInOverallPercentage() != null ? resp.getIncludeInOverallPercentage() : true)
                    .responses(resp.getResponses())
                    .build());
        }

        return enrichedList;
    }

    private Integer parseSemester(String semStr) {
        if (semStr == null) return null;
        for (char c : semStr.toCharArray()) {
            if (Character.isDigit(c)) {
                return Character.getNumericValue(c);
            }
        }
        return null;
    }

    // =========================================================================
    // 3. SEND EVALUATED SCORECARD TO STUDENT VIA EMAIL
    // =========================================================================
    public Map<String, Object> sendEvaluationEmailToStudent(String responseId) {
        StudentResponse response = studentResponseRepository.findById(responseId)
                .orElseThrow(() -> new RuntimeException("Response not found"));

        User student = userRepository.findByUsn(response.getUsn())
                .orElseThrow(() -> new RuntimeException("Student profile not found for USN: " + response.getUsn()));

        if (student.getEmail() == null || student.getEmail().trim().isEmpty()) {
            throw new RuntimeException("Student does not have a registered email address");
        }

        QuestionPaper paper = null;
        try {
            paper = questionPaperService.getPaper(response.getPaperId());
        } catch (Exception ignored) {}

        String subjectName = paper != null ? paper.getSubject() : response.getPaperId();
        double maxMarks = paper != null && paper.getMaxMarks() != null ? paper.getMaxMarks() : (response.getMaxMarks() != null ? response.getMaxMarks() : 40.0);

        emailSenderService.sendEvaluationResultEmail(
                student.getEmail(),
                student.getName(),
                subjectName,
                response.getTotalMarks(),
                maxMarks,
                response.getResponses(),
                response.getEvaluatedBy() != null ? response.getEvaluatedBy() : "Faculty Evaluator"
        );

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("recipient", student.getEmail());
        res.put("studentName", student.getName());
        res.put("message", "Evaluation scorecard successfully sent to " + student.getEmail());
        return res;
    }

    // =========================================================================
    // 4. EXPORT FILTERED EVALUATION ROSTER TO EXCEL (.XLSX)
    // =========================================================================
    public byte[] generateExcelReport(String paperId, Integer semester, String subject) throws IOException {
        List<EnrichedStudentResponseDto> list = getEnrichedResponses(paperId, semester, subject);

        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Evaluation Summary");

            // Header Style
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setColor(IndexedColors.WHITE.getIndex());
            headerFont.setFontHeightInPoints((short) 11);

            CellStyle headerStyle = workbook.createCellStyle();
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setAlignment(HorizontalAlignment.CENTER);
            headerStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            headerStyle.setBorderBottom(BorderStyle.THIN);
            headerStyle.setBorderTop(BorderStyle.THIN);
            headerStyle.setBorderLeft(BorderStyle.THIN);
            headerStyle.setBorderRight(BorderStyle.THIN);

            // Data Cell Styles
            CellStyle normalStyle = workbook.createCellStyle();
            normalStyle.setBorderBottom(BorderStyle.THIN);
            normalStyle.setBorderTop(BorderStyle.THIN);
            normalStyle.setBorderLeft(BorderStyle.THIN);
            normalStyle.setBorderRight(BorderStyle.THIN);

            CellStyle centerStyle = workbook.createCellStyle();
            centerStyle.cloneStyleFrom(normalStyle);
            centerStyle.setAlignment(HorizontalAlignment.CENTER);

            // Row 0: Headers
            String[] headers = {
                    "Sl No", "USN", "Student Name", "Semester", "Department",
                    "Paper ID", "Subject", "Total Marks", "Max Marks",
                    "Percentage (%)", "Risk Level", "Status", "Evaluated By", "Evaluated Date"
            };

            Row headerRow = sheet.createRow(0);
            headerRow.setHeightInPoints(24);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            // Fill rows
            int rowIdx = 1;
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

            for (EnrichedStudentResponseDto dto : list) {
                Row row = sheet.createRow(rowIdx++);
                row.createCell(0).setCellValue(rowIdx - 1);
                row.createCell(1).setCellValue(dto.getUsn() != null ? dto.getUsn() : "");
                row.createCell(2).setCellValue(dto.getStudentName() != null ? dto.getStudentName() : "");
                row.createCell(3).setCellValue(dto.getSemester() != null ? String.valueOf(dto.getSemester()) : "N/A");
                row.createCell(4).setCellValue(dto.getDepartment() != null ? dto.getDepartment() : "CSE");
                row.createCell(5).setCellValue(dto.getPaperId() != null ? dto.getPaperId() : "");
                row.createCell(6).setCellValue(dto.getSubject() != null ? dto.getSubject() : "");
                row.createCell(7).setCellValue(dto.getTotalMarks() != null ? dto.getTotalMarks() : 0.0);
                row.createCell(8).setCellValue(dto.getMaxMarks() != null ? dto.getMaxMarks() : 40.0);
                row.createCell(9).setCellValue(dto.getPercentage() != null ? dto.getPercentage() : 0.0);
                row.createCell(10).setCellValue(dto.getRiskLevel() != null ? dto.getRiskLevel() : "LOW");
                row.createCell(11).setCellValue(dto.isEvaluationCompleted() ? "Evaluated" : "Pending");
                row.createCell(12).setCellValue(dto.getEvaluatedBy() != null ? dto.getEvaluatedBy() : "N/A");
                row.createCell(13).setCellValue(dto.getEvaluatedAt() != null ? dto.getEvaluatedAt().format(formatter) : "N/A");

                for (int c = 0; c < headers.length; c++) {
                    Cell cell = row.getCell(c);
                    if (cell != null && cell.getCellStyle() == null) {
                        cell.setCellStyle(c == 0 || c == 3 || c == 7 || c == 8 || c == 9 || c == 11 ? centerStyle : normalStyle);
                    }
                }
            }

            // Autosize columns
            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
            }

            workbook.write(out);
            return out.toByteArray();
        }
    }

    // =========================================================================
    // 5. OVERALL CLASS EVALUATION SUMMARY ANALYTICS
    // =========================================================================
    public EvaluationSummaryDto getOverallSummary(String paperId, Integer semester, String subject) {
        List<EnrichedStudentResponseDto> list = getEnrichedResponses(paperId, semester, subject);

        int total = list.size();
        int evaluatedCount = (int) list.stream().filter(EnrichedStudentResponseDto::isEvaluationCompleted).count();
        int pendingCount = total - evaluatedCount;

        double avgScore = total > 0
                ? list.stream().mapToDouble(d -> d.getTotalMarks() != null ? d.getTotalMarks() : 0.0).average().orElse(0.0)
                : 0.0;

        double highestScore = total > 0
                ? list.stream().mapToDouble(d -> d.getTotalMarks() != null ? d.getTotalMarks() : 0.0).max().orElse(0.0)
                : 0.0;

        double lowestScore = total > 0
                ? list.stream().mapToDouble(d -> d.getTotalMarks() != null ? d.getTotalMarks() : 0.0).min().orElse(0.0)
                : 0.0;

        int passedCount = (int) list.stream().filter(d -> (d.getPercentage() != null && d.getPercentage() >= 40.0)).count();
        double passPct = total > 0 ? Math.round(((double) passedCount / total) * 10000.0) / 100.0 : 0.0;

        int lowRisk = (int) list.stream().filter(d -> "LOW".equalsIgnoreCase(d.getRiskLevel())).count();
        int medRisk = (int) list.stream().filter(d -> "MEDIUM".equalsIgnoreCase(d.getRiskLevel())).count();
        int highRisk = (int) list.stream().filter(d -> "HIGH".equalsIgnoreCase(d.getRiskLevel())).count();

        // Topic Breakdown
        Map<String, List<Double>> topicScores = new HashMap<>();
        for (EnrichedStudentResponseDto dto : list) {
            if (dto.getResponses() != null) {
                for (StudentResponse.ResponseAnswer ans : dto.getResponses()) {
                    String topic = ans.getTopic() != null ? ans.getTopic() : "General";
                    double score = ans.getMarksObtained() != null ? ans.getMarksObtained() : 0.0;
                    topicScores.computeIfAbsent(topic, k -> new ArrayList<>()).add(score);
                }
            }
        }

        Map<String, Double> topicAverages = new HashMap<>();
        topicScores.forEach((topic, scores) -> {
            double avg = scores.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
            topicAverages.put(topic, round(avg));
        });

        return EvaluationSummaryDto.builder()
                .paperId(paperId)
                .subject(subject != null ? subject : "All Filtered Subjects")
                .semester(semester)
                .totalStudents(total)
                .evaluatedCount(evaluatedCount)
                .pendingCount(pendingCount)
                .averageScore(round(avgScore))
                .highestScore(round(highestScore))
                .lowestScore(round(lowestScore))
                .passPercentage(passPct)
                .lowRiskCount(lowRisk)
                .mediumRiskCount(medRisk)
                .highRiskCount(highRisk)
                .topicAverageScores(topicAverages)
                .build();
    }

    // =========================================================================
    // 6. EXPORT SINGLE STUDENT SUBMISSION TO EXCEL
    // =========================================================================
    public byte[] exportSingleSubmissionToExcel(String responseId) throws IOException {
        StudentResponse response = studentResponseRepository.findById(responseId)
                .orElseThrow(() -> new RuntimeException("Student response not found: " + responseId));

        QuestionPaper paper = questionPaperService.getPaper(response.getPaperId());
        User student = userRepository.findByUsn(response.getUsn()).orElse(null);

        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Student Written Paper");

            // Styles
            Font titleFont = workbook.createFont();
            titleFont.setBold(true);
            titleFont.setFontHeightInPoints((short) 14);

            CellStyle titleStyle = workbook.createCellStyle();
            titleStyle.setFont(titleFont);

            Font metaLabelFont = workbook.createFont();
            metaLabelFont.setBold(true);
            metaLabelFont.setFontHeightInPoints((short) 10);

            CellStyle metaLabelStyle = workbook.createCellStyle();
            metaLabelStyle.setFont(metaLabelFont);

            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setColor(IndexedColors.WHITE.getIndex());
            headerFont.setFontHeightInPoints((short) 10);

            CellStyle headerStyle = workbook.createCellStyle();
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.ROYAL_BLUE.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setAlignment(HorizontalAlignment.CENTER);
            headerStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            headerStyle.setBorderBottom(BorderStyle.THIN);
            headerStyle.setBorderTop(BorderStyle.THIN);
            headerStyle.setBorderLeft(BorderStyle.THIN);
            headerStyle.setBorderRight(BorderStyle.THIN);

            CellStyle cellStyle = workbook.createCellStyle();
            cellStyle.setBorderBottom(BorderStyle.THIN);
            cellStyle.setBorderTop(BorderStyle.THIN);
            cellStyle.setBorderLeft(BorderStyle.THIN);
            cellStyle.setBorderRight(BorderStyle.THIN);
            cellStyle.setWrapText(true);

            CellStyle centerStyle = workbook.createCellStyle();
            centerStyle.cloneStyleFrom(cellStyle);
            centerStyle.setAlignment(HorizontalAlignment.CENTER);
            centerStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            // Title
            Row titleRow = sheet.createRow(0);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("ACADION LMS - STUDENT EXAM SUBMISSION REPORT");
            titleCell.setCellStyle(titleStyle);

            // Student & Paper Metadata Block
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
            int r = 2;

            Row r1 = sheet.createRow(r++);
            r1.createCell(0).setCellValue("Student Name:");
            r1.getCell(0).setCellStyle(metaLabelStyle);
            r1.createCell(1).setCellValue(student != null ? student.getName() : response.getUsn());
            r1.createCell(3).setCellValue("USN / Roll No:");
            r1.getCell(3).setCellStyle(metaLabelStyle);
            r1.createCell(4).setCellValue(response.getUsn());

            Row r2 = sheet.createRow(r++);
            r2.createCell(0).setCellValue("Subject:");
            r2.getCell(0).setCellStyle(metaLabelStyle);
            r2.createCell(1).setCellValue(paper != null ? paper.getSubject() : response.getPaperId());
            r2.createCell(3).setCellValue("Paper ID / Code:");
            r2.getCell(3).setCellStyle(metaLabelStyle);
            r2.createCell(4).setCellValue(response.getPaperId());

            Row r3 = sheet.createRow(r++);
            r3.createCell(0).setCellValue("Submission Date:");
            r3.getCell(0).setCellStyle(metaLabelStyle);
            r3.createCell(1).setCellValue(response.getSubmittedAt() != null ? response.getSubmittedAt().format(formatter) : "N/A");
            r3.createCell(3).setCellValue("Attempt Number:");
            r3.getCell(3).setCellStyle(metaLabelStyle);
            r3.createCell(4).setCellValue("Attempt #" + (response.getAttemptCount() != null ? response.getAttemptCount() : 1));

            Row r4 = sheet.createRow(r++);
            r4.createCell(0).setCellValue("Evaluated By:");
            r4.getCell(0).setCellStyle(metaLabelStyle);
            r4.createCell(1).setCellValue(response.getEvaluatedBy() != null ? response.getEvaluatedBy() : "Pending Faculty Evaluation");
            r4.createCell(3).setCellValue("Total Score:");
            r4.getCell(3).setCellStyle(metaLabelStyle);
            r4.createCell(4).setCellValue((response.getTotalMarks() != null ? response.getTotalMarks() : 0.0) + " / " + (response.getMaxMarks() != null ? response.getMaxMarks() : 40.0) + " Marks");

            r++; // blank row

            // Question by Question Table Header
            String[] headers = {
                    "Q.No", "Question Prompt", "Type", "Student Written Answer",
                    "Max Marks", "Marks Awarded", "Evaluation Status", "Evaluator Feedback / Solution"
            };

            Row headerRow = sheet.createRow(r++);
            headerRow.setHeightInPoints(24);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            // Question Rows
            if (response.getResponses() != null) {
                int qIdx = 1;
                for (StudentResponse.ResponseAnswer ans : response.getResponses()) {
                    Row qRow = sheet.createRow(r++);
                    qRow.createCell(0).setCellValue(ans.getQuestionId() != null ? ans.getQuestionId() : "Q" + qIdx);
                    qRow.createCell(1).setCellValue(ans.getQuestionText() != null ? ans.getQuestionText() : (ans.getTopic() != null ? ans.getTopic() : ""));
                    qRow.createCell(2).setCellValue(ans.getQuestionType() != null ? ans.getQuestionType() : "THEORY");
                    qRow.createCell(3).setCellValue(ans.getAnswer() != null ? ans.getAnswer() : "(Not Answered)");
                    qRow.createCell(4).setCellValue(ans.getMaxMarks() != null ? ans.getMaxMarks() : 5.0);
                    qRow.createCell(5).setCellValue(ans.getMarksObtained() != null ? ans.getMarksObtained() : 0.0);
                    qRow.createCell(6).setCellValue(ans.isEvaluated() ? "Evaluated" : "Pending");
                    qRow.createCell(7).setCellValue(ans.getFeedback() != null ? ans.getFeedback() : "");

                    qRow.getCell(0).setCellStyle(centerStyle);
                    qRow.getCell(1).setCellStyle(cellStyle);
                    qRow.getCell(2).setCellStyle(centerStyle);
                    qRow.getCell(3).setCellStyle(cellStyle);
                    qRow.getCell(4).setCellStyle(centerStyle);
                    qRow.getCell(5).setCellStyle(centerStyle);
                    qRow.getCell(6).setCellStyle(centerStyle);
                    qRow.getCell(7).setCellStyle(cellStyle);
                    qIdx++;
                }
            }

            sheet.setColumnWidth(0, 10 * 256);
            sheet.setColumnWidth(1, 35 * 256);
            sheet.setColumnWidth(2, 12 * 256);
            sheet.setColumnWidth(3, 40 * 256);
            sheet.setColumnWidth(4, 12 * 256);
            sheet.setColumnWidth(5, 14 * 256);
            sheet.setColumnWidth(6, 16 * 256);
            sheet.setColumnWidth(7, 30 * 256);

            workbook.write(out);
            return out.toByteArray();
        }
    }

    // =========================================================================
    // 7. SELF EVALUATION BY STUDENT (PRACTICE PAPERS)
    // =========================================================================
    public StudentResponse selfEvaluateResponse(String responseId, List<EvaluateResponseRequest.QuestionScoreRequest> scores) {
        StudentResponse response = studentResponseRepository.findById(responseId)
                .orElseThrow(() -> new RuntimeException("Submission not found: " + responseId));

        double total = 0.0;
        for (EvaluateResponseRequest.QuestionScoreRequest item : scores) {
            for (StudentResponse.ResponseAnswer ans : response.getResponses()) {
                if (ans.getQuestionId().equalsIgnoreCase(item.getQuestionId())) {
                    ans.setMarksObtained(round(item.getMarksObtained()));
                    ans.setFeedback(item.getFeedback() != null ? item.getFeedback() : "Self-graded by student");
                    ans.setEvaluated(true);
                }
            }
        }

        for (StudentResponse.ResponseAnswer ans : response.getResponses()) {
            total += (ans.getMarksObtained() != null ? ans.getMarksObtained() : 0.0);
        }

        response.setTotalMarks(round(total));
        response.setEvaluationCompleted(true);
        response.setEvaluationMode("SELF");
        response.setEvaluatedBy("Self Evaluated");
        response.setEvaluatedAt(LocalDateTime.now());

        return studentResponseRepository.save(response);
    }

    // =========================================================================
    // 8. PEER / FRIEND EVALUATION (PRACTICE PAPERS)
    // =========================================================================
    public StudentResponse peerEvaluateResponse(
            String responseId,
            String peerUsn,
            String peerName,
            String peerOverallFeedback,
            List<EvaluateResponseRequest.QuestionScoreRequest> scores
    ) {
        StudentResponse response = studentResponseRepository.findById(responseId)
                .orElseThrow(() -> new RuntimeException("Submission not found: " + responseId));

        double total = 0.0;
        for (EvaluateResponseRequest.QuestionScoreRequest item : scores) {
            for (StudentResponse.ResponseAnswer ans : response.getResponses()) {
                if (ans.getQuestionId().equalsIgnoreCase(item.getQuestionId())) {
                    ans.setMarksObtained(round(item.getMarksObtained()));
                    ans.setFeedback(item.getFeedback());
                    ans.setEvaluated(true);
                }
            }
        }

        for (StudentResponse.ResponseAnswer ans : response.getResponses()) {
            total += (ans.getMarksObtained() != null ? ans.getMarksObtained() : 0.0);
        }

        response.setTotalMarks(round(total));
        response.setEvaluationCompleted(true);
        response.setEvaluationMode("PEER");
        response.setPeerEvaluatorUsn(peerUsn);
        response.setPeerEvaluatorName(peerName);
        response.setPeerEvaluatedAt(LocalDateTime.now());
        response.setPeerFeedback(peerOverallFeedback);
        response.setEvaluatedBy("Peer: " + peerName + " (" + peerUsn + ")");
        response.setEvaluatedAt(LocalDateTime.now());

        return studentResponseRepository.save(response);
    }

    // =========================================================================
    // 9. ASSIGN PEER / FRIEND FOR PRACTICE PAPER REVIEW
    // =========================================================================
    public StudentResponse assignPeerReview(String responseId, String friendUsn, String friendName) {
        StudentResponse response = studentResponseRepository.findById(responseId)
                .orElseThrow(() -> new RuntimeException("Submission not found: " + responseId));

        response.setAssignedPeerUsn(friendUsn != null ? friendUsn.trim() : null);
        response.setAssignedPeerName(friendName != null ? friendName.trim() : null);

        return studentResponseRepository.save(response);
    }
}
