package com.acadion.backend.service;

import com.acadion.backend.dto.CreateQuestionPaperRequest;
import com.acadion.backend.entity.QuestionPaper;
import com.acadion.backend.repository.QuestionPaperRepository;

import com.acadion.backend.service.parser.AiModelParserService;
import com.acadion.backend.service.parser.AiQuestionParserService;
import com.acadion.backend.service.parser.GeminiParserService;
import com.acadion.backend.service.parser.TextExtractionService;

import lombok.RequiredArgsConstructor;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

import java.time.LocalDateTime;
import java.time.Year;

import java.util.*;

@Service
@RequiredArgsConstructor
public class QuestionPaperService {

    private final QuestionPaperRepository
            questionPaperRepository;

    private final TextExtractionService
            textExtractionService;

    private final AiQuestionParserService
            aiQuestionParserService;

    private final GeminiParserService
            geminiParserService;

    private final AiModelParserService
            aiModelParserService;

    // =====================================
    // UPLOAD PAPER
    // =====================================

    public QuestionPaper uploadPaper(
            MultipartFile file,
            String paperId,
            String subject,
            Integer internalNo
    ) throws IOException {

        // =================================
        // 1. EXTRACT DOCUMENT TEXT
        // =================================

        String extractedText =
                textExtractionService
                        .extractText(file);

        // =================================
        // 2. PARSE WITH ADVANCED AI MODEL FIRST
        // =================================

        com.acadion.backend.service.parser.ParsedPaperResult parseResult = null;

        if (aiModelParserService != null) {
            parseResult = aiModelParserService.parseWithAi(extractedText);
        }

        if ((parseResult == null || parseResult.getQuestions().isEmpty()) &&
                geminiParserService != null && geminiParserService.isAvailable()) {
            parseResult = geminiParserService.parseWithGemini(file, extractedText);
        }

        // =================================
        // 3. FALLBACK TO LOCAL NLP ENGINE
        // =================================

        if (parseResult == null || parseResult.getQuestions().isEmpty()) {
            parseResult =
                    aiQuestionParserService
                            .parseDocument(
                                    extractedText
                            );
        }

        List<QuestionPaper.Question> questions =
                parseResult.getQuestions();

        if (questions == null || questions.isEmpty()) {
            throw new IllegalArgumentException(
                    "Unable to extract questions from this document. Please ensure the document contains readable text or create questions using Manual Paper Entry."
            );
        }

        // Auto-detect subject if user didn't provide
        String effectiveSubject = hasText(subject)
                ? subject.trim()
                : (hasText(parseResult.getMetadata().getSubject())
                    ? parseResult.getMetadata().getSubject().trim()
                    : "General");

        // Auto-detect internalNo if user didn't provide
        Integer effectiveInternalNo = (internalNo != null && internalNo > 0)
                ? internalNo
                : (parseResult.getMetadata().getInternalNo() != null
                    ? parseResult.getMetadata().getInternalNo()
                    : 1);

        // =================================
        // SAFE PAPER ID
        // =================================

        String safePaperId =
                hasText(paperId)
                        ? paperId.trim()
                        : generatePaperId(
                                effectiveSubject,
                                effectiveInternalNo
                        );

        if (
                questionPaperRepository
                        .existsByPaperId(
                                safePaperId
                        )
        ) {

            safePaperId =
                    safePaperId
                            + "-"
                            + UUID.randomUUID()
                            .toString()
                            .substring(0, 6);
        }

        // =================================
        // CALCULATE MARKS
        // =================================

        double rawMarks = questions.stream()
                .mapToDouble(question -> question.getMarks() == null ? 0 : question.getMarks())
                .sum();

        com.acadion.backend.service.parser.ParsedMetadata meta =
                parseResult.getMetadata();

        double effectiveMarks = (meta != null && meta.getMaxMarks() != null && meta.getMaxMarks() > 0)
                ? meta.getMaxMarks()
                : calculateEffectiveMarks(questions);

        // =================================
        // CREATE PAPER
        // =================================

        QuestionPaper paper =
                QuestionPaper.builder()
                        .paperId(safePaperId)
                        .subject(effectiveSubject)
                        .internalNo(effectiveInternalNo)
                        .originalFileName(file.getOriginalFilename())
                        .contentType(file.getContentType())
                        .uploadedAt(LocalDateTime.now())
                        .collegeName(meta != null ? meta.getCollegeName() : null)
                        .subjectCode(meta != null ? meta.getSubjectCode() : null)
                        .examName(meta != null ? meta.getExamName() : null)
                        .semester(meta != null ? meta.getSemester() : null)
                        .date(meta != null ? meta.getDate() : null)
                        .duration(meta != null ? meta.getDuration() : null)
                        .maxMarks(meta != null ? meta.getMaxMarks() : effectiveMarks)
                        .rawMarks(rawMarks)
                        .totalMarks(effectiveMarks)
                        .questions(questions)
                        .build();

        return questionPaperRepository.save(paper);
    }

    // =====================================
    // GET ALL PAPERS
    // =====================================

    public List<QuestionPaper> getAllPapers() {
        return questionPaperRepository.findAll();
    }

    // =====================================
    // GET SINGLE PAPER
    // =====================================

    public QuestionPaper getPaper(String identifier) {
        return questionPaperRepository.findById(identifier)
                .or(() -> questionPaperRepository.findFirstByPaperIdOrderByUploadedAtDesc(identifier))
                .orElseThrow(() -> new IllegalArgumentException("Question paper not found"));
    }

    // =====================================
    // CREATE MANUAL PAPER
    // =====================================

    public QuestionPaper createPaper(CreateQuestionPaperRequest request) {
        List<QuestionPaper.Question> questions = request.getQuestions()
                .stream()
                .map(question -> QuestionPaper.Question.builder()
                        .questionId(question.getQuestionId())
                        .text(question.getText())
                        .section(question.getSection())
                        .groupName(question.getGroupName())
                        .optionalQuestion(question.getOptionalQuestion())
                        .optionalWith(question.getOptionalWith())
                        .parentQuestion(question.getParentQuestion())
                        .maxAttempt(question.getMaxAttempt())
                        .questionType(question.getQuestionType())
                        .marks(question.getMarks())
                        .topic(question.getTopic())
                        .imageUrl(question.getImageUrl())
                        .options(question.getOptions())
                        .correctAnswer(question.getCorrectAnswer())
                        .explanation(question.getExplanation())
                        .build()
                )
                .toList();

        double rawMarks = questions.stream()
                .mapToDouble(question -> question.getMarks() == null ? 0 : question.getMarks())
                .sum();

        double effectiveMarks = (request.getMaxMarks() != null && request.getMaxMarks() > 0)
                ? request.getMaxMarks()
                : ((request.getTotalMarks() != null && request.getTotalMarks() > 0)
                    ? request.getTotalMarks()
                    : calculateEffectiveMarks(questions));

        QuestionPaper paper = QuestionPaper.builder()
                .paperId(request.getPaperId())
                .subject(request.getSubject())
                .internalNo(request.getInternalNo())
                .collegeName(request.getCollegeName())
                .subjectCode(request.getSubjectCode())
                .examName(request.getExamName())
                .semester(request.getSemester())
                .date(request.getDate())
                .duration(request.getDuration())
                .durationMinutes(request.getDurationMinutes())
                .maxMarks(request.getMaxMarks() != null ? request.getMaxMarks() : effectiveMarks)
                .uploadedAt(LocalDateTime.now())
                .rawMarks(rawMarks)
                .totalMarks(effectiveMarks)
                .paperCategory(request.getPaperCategory() != null ? request.getPaperCategory() : "ASSESSMENT")
                .paperFormat(request.getPaperFormat() != null ? request.getPaperFormat() : "THEORY")
                .allowedForPractice(request.getAllowedForPractice() != null ? request.getAllowedForPractice() : false)
                .assignedSemester(request.getAssignedSemester() != null ? request.getAssignedSemester() : request.getSemester())
                .createdBy(request.getCreatedBy())
                .questions(questions)
                .build();

        return questionPaperRepository.save(paper);
    }

    // =====================================
    // UPDATE PAPER
    // =====================================

    public QuestionPaper updatePaper(
            String identifier,
            CreateQuestionPaperRequest request
    ) {

        QuestionPaper paper =
                getPaper(identifier);

        List<QuestionPaper.Question> updatedQuestions = request.getQuestions()
                .stream()
                .map(question -> QuestionPaper.Question.builder()
                        .questionId(question.getQuestionId())
                        .text(question.getText())
                        .section(question.getSection())
                        .groupName(question.getGroupName())
                        .optionalQuestion(question.getOptionalQuestion())
                        .optionalWith(question.getOptionalWith())
                        .parentQuestion(question.getParentQuestion())
                        .maxAttempt(question.getMaxAttempt())
                        .questionType(question.getQuestionType())
                        .marks(question.getMarks())
                        .topic(question.getTopic())
                        .imageUrl(question.getImageUrl())
                        .options(question.getOptions())
                        .correctAnswer(question.getCorrectAnswer())
                        .explanation(question.getExplanation())
                        .build()
                )
                .toList();

        double rawMarks = updatedQuestions.stream()
                .mapToDouble(question -> question.getMarks() == null ? 0 : question.getMarks())
                .sum();

        double effectiveMarks = (request.getMaxMarks() != null && request.getMaxMarks() > 0)
                ? request.getMaxMarks()
                : ((request.getTotalMarks() != null && request.getTotalMarks() > 0)
                    ? request.getTotalMarks()
                    : calculateEffectiveMarks(updatedQuestions));

        paper.setSubject(request.getSubject());
        paper.setInternalNo(request.getInternalNo());
        if (request.getCollegeName() != null) paper.setCollegeName(request.getCollegeName());
        if (request.getSubjectCode() != null) paper.setSubjectCode(request.getSubjectCode());
        if (request.getExamName() != null) paper.setExamName(request.getExamName());
        if (request.getSemester() != null) paper.setSemester(request.getSemester());
        if (request.getDate() != null) paper.setDate(request.getDate());
        if (request.getDuration() != null) paper.setDuration(request.getDuration());
        if (request.getDurationMinutes() != null) paper.setDurationMinutes(request.getDurationMinutes());
        if (request.getMaxMarks() != null) paper.setMaxMarks(request.getMaxMarks());
        if (request.getPaperCategory() != null) paper.setPaperCategory(request.getPaperCategory());
        if (request.getPaperFormat() != null) paper.setPaperFormat(request.getPaperFormat());
        if (request.getAllowedForPractice() != null) paper.setAllowedForPractice(request.getAllowedForPractice());
        if (request.getAssignedSemester() != null) paper.setAssignedSemester(request.getAssignedSemester());
        if (request.getCreatedBy() != null) paper.setCreatedBy(request.getCreatedBy());
        paper.setQuestions(updatedQuestions);
        paper.setRawMarks(rawMarks);
        paper.setTotalMarks(effectiveMarks);

        return questionPaperRepository.save(paper);
    }

    public QuestionPaper togglePracticeStatus(String identifier, Boolean allowedForPractice, String assignedSemester) {
        QuestionPaper paper = getPaper(identifier);
        paper.setAllowedForPractice(allowedForPractice != null ? allowedForPractice : !Boolean.TRUE.equals(paper.getAllowedForPractice()));
        if (assignedSemester != null && !assignedSemester.trim().isEmpty()) {
            paper.setAssignedSemester(assignedSemester.trim());
        }
        return questionPaperRepository.save(paper);
    }

    // =====================================
    // DELETE PAPER
    // =====================================

    public String deletePaper(
            String identifier
    ) {
        if (identifier != null && questionPaperRepository.existsById(identifier)) {
            questionPaperRepository.deleteById(identifier);
            return "Paper deleted successfully";
        }
        List<QuestionPaper> papers = questionPaperRepository.findAllByPaperId(identifier);
        if (!papers.isEmpty()) {
            questionPaperRepository.deleteAll(papers);
            return "Paper deleted successfully";
        }
        return "Paper deleted successfully";
    }

    // =====================================
    // EFFECTIVE MARKS CALCULATION
    // =====================================

    private double calculateEffectiveMarks(
            List<QuestionPaper.Question> questions
    ) {

        double total = 0;

        Set<String> processedGroups =
                new HashSet<>();

        for (
                QuestionPaper.Question question
                        : questions
        ) {

            String group =
                    question.getGroupName();

            if (
                    group == null
                            || group.isEmpty()
            ) {

                total +=

                        question.getMarks() == null

                                ? 0

                                : question.getMarks();

                continue;
            }

            if (
                    processedGroups.contains(
                            group
                    )
            ) {
                continue;
            }

            processedGroups.add(
                    group
            );

            List<QuestionPaper.Question>
                    groupQuestions =

                    questions.stream()

                            .filter(item ->

                                    group.equals(
                                            item.getGroupName()
                                    )
                            )

                            .toList();

            int maxAttempt =

                    groupQuestions.get(0)
                            .getMaxAttempt() == null

                            ? 1

                            : groupQuestions.get(0)
                                    .getMaxAttempt();

            double groupTotal =

                    groupQuestions.stream()

                            .mapToDouble(item ->

                                    item.getMarks() == null

                                            ? 0

                                            : item.getMarks()
                            )

                            .boxed()
.sorted(Comparator.reverseOrder())
.mapToDouble(Double::doubleValue)
                            .limit(maxAttempt)

                            .sum();

            total += groupTotal;
        }

        return total;
    }

    // =====================================
    // GENERATE PAPER ID
    // =====================================

    private String generatePaperId(
            String subject,
            Integer internalNo
    ) {

        String subjectPart =

                hasText(subject)

                        ? subject.trim()

                        .toUpperCase()

                        .replaceAll(
                                "[^A-Z0-9]+",
                                "-"
                        )

                        : "GENERAL";

        int internalPart =

                internalNo == null

                        ? 1

                        : internalNo;

        return Year.now()
                + "-INT"
                + internalPart
                + "-"
                + subjectPart;
    }

    // =====================================
    // TEXT CHECK
    // =====================================

    private boolean hasText(
            String value
    ) {

        return value != null
                &&
                !value.trim().isEmpty();
    }
}