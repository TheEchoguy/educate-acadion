package com.acadion.backend.service;

import com.acadion.backend.dto.syllabus.*;
import com.acadion.backend.entity.*;
import com.acadion.backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class SyllabusAssessmentMappingService {

    private final SyllabusAssessmentMappingRepository mappingRepository;
    private final SyllabusItemRepository syllabusItemRepository;
    private final QuestionPaperRepository questionPaperRepository;
    private final ClassroomRepository classroomRepository;
    private final ClassroomMembershipRepository classroomMembershipRepository;
    private final UserRepository userRepository;
    private final SyllabusAuditService auditService;

    /**
     * Map an existing assessment or question to a syllabus topic manually.
     */
    public AssessmentMappingResponse createManualMapping(
            String classroomId,
            CreateAssessmentMappingRequest request,
            String teacherEmail
    ) {
        return saveMapping(classroomId, request, MappingSource.MANUAL, teacherEmail);
    }

    /**
     * Explicitly confirm a suggested mapping between an assessment and a syllabus topic.
     */
    public AssessmentMappingResponse confirmSuggestedMapping(
            String classroomId,
            CreateAssessmentMappingRequest request,
            String teacherEmail
    ) {
        return saveMapping(classroomId, request, MappingSource.CONFIRMED_SUGGESTION, teacherEmail);
    }

    /**
     * Remove an existing assessment-to-topic mapping.
     */
    public void deleteMapping(String classroomId, String mappingId, String teacherEmail) {
        Classroom classroom = getExistingClassroom(classroomId);
        User teacher = getAuthenticatedTeacher(teacherEmail);
        verifyClassroomOwnership(classroom, teacher);

        SyllabusAssessmentMapping mapping = mappingRepository.findByIdAndClassroomId(mappingId, classroom.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Assessment mapping not found with ID " + mappingId + " in classroom " + classroomId));

        mappingRepository.delete(mapping);
        log.info("Teacher {} deleted assessment mapping {} in classroom {}", teacher.getEmail(), mappingId, classroomId);

        auditService.recordEvent(
                classroomId,
                mapping.getSyllabusTopicId(),
                null,
                mapping.getId(),
                teacher,
                SyllabusAuditEventType.ASSESSMENT_UNMAPPED,
                "Removed assessment mapping for paper " + mapping.getPaperId(),
                Map.of(
                        "paperId", mapping.getPaperId(),
                        "topicId", mapping.getSyllabusTopicId()
                )
        );
    }

    /**
     * List assessment mappings for a classroom, optionally filtered by topicId.
     */
    public List<AssessmentMappingResponse> getMappings(
            String classroomId,
            String topicId,
            String userEmail
    ) {
        if (topicId != null && !topicId.isBlank()) {
            return getMappingsForTopic(classroomId, topicId.trim(), userEmail);
        }
        return getMappingsForClassroom(classroomId, userEmail);
    }

    /**
     * List all confirmed assessment mappings for a classroom.
     */
    public List<AssessmentMappingResponse> getMappingsForClassroom(String classroomId, String userEmail) {
        Classroom classroom = getExistingClassroom(classroomId);
        User caller = getAuthenticatedUser(userEmail);
        verifyClassroomReadAccess(classroom, caller);

        return mappingRepository.findByClassroomId(classroom.getId())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    /**
     * Confirm an existing mapping by mapping ID.
     */
    public AssessmentMappingResponse confirmMappingById(String classroomId, String mappingId, String teacherEmail) {
        Classroom classroom = getExistingClassroom(classroomId);
        User teacher = getAuthenticatedTeacher(teacherEmail);
        verifyClassroomOwnership(classroom, teacher);

        SyllabusAssessmentMapping mapping = mappingRepository.findByIdAndClassroomId(mappingId, classroom.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Assessment mapping not found with ID " + mappingId + " in classroom " + classroomId));

        mapping.setConfirmed(true);
        mapping.setMappingSource(MappingSource.CONFIRMED_SUGGESTION);
        mapping.setUpdatedAt(LocalDateTime.now());

        SyllabusAssessmentMapping saved = mappingRepository.save(mapping);
        log.info("Teacher {} confirmed assessment mapping {} in classroom {}", teacher.getEmail(), mappingId, classroomId);

        auditService.recordEvent(
                classroomId,
                saved.getSyllabusTopicId(),
                null,
                saved.getId(),
                teacher,
                SyllabusAuditEventType.ASSESSMENT_MAPPED,
                "Confirmed assessment mapping for paper " + saved.getPaperId(),
                Map.of(
                        "paperId", saved.getPaperId(),
                        "topicId", saved.getSyllabusTopicId(),
                        "confirmed", true
                )
        );

        return toResponse(saved);
    }

    /**
     * List all confirmed assessment mappings for a syllabus topic.
     */
    public List<AssessmentMappingResponse> getMappingsForTopic(
            String classroomId,
            String topicId,
            String userEmail
    ) {
        Classroom classroom = getExistingClassroom(classroomId);
        User caller = getAuthenticatedUser(userEmail);
        verifyClassroomReadAccess(classroom, caller);

        if (!syllabusItemRepository.existsByIdAndClassroomId(topicId, classroom.getId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "Syllabus topic not found with ID " + topicId + " in classroom " + classroomId);
        }

        return mappingRepository.findByClassroomIdAndSyllabusTopicId(classroom.getId(), topicId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    /**
     * Generate explainable assessment mapping suggestions based on reliable schema topic and subject labels.
     */
    public List<AssessmentMappingSuggestionResponse> getMappingSuggestions(
            String classroomId,
            String topicId,
            String teacherEmail
    ) {
        Classroom classroom = getExistingClassroom(classroomId);
        User teacher = getAuthenticatedTeacher(teacherEmail);
        verifyClassroomOwnership(classroom, teacher);

        SyllabusItem topicItem = syllabusItemRepository.findByIdAndClassroomId(topicId, classroom.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Syllabus topic not found with ID " + topicId + " in classroom " + classroomId));

        List<QuestionPaper> allPapers = questionPaperRepository.findAll();
        List<AssessmentMappingSuggestionResponse> suggestions = new ArrayList<>();

        String topicName = topicItem.getTopic().toLowerCase(Locale.ROOT);
        String unitName = topicItem.getUnit().toLowerCase(Locale.ROOT);

        for (QuestionPaper paper : allPapers) {
            boolean isRelevantToClassroom = isPaperRelevantToClassroom(paper, classroom, teacher);
            if (!isRelevantToClassroom) {
                continue;
            }

            String paperSubject = paper.getSubject() != null ? paper.getSubject() : "";
            String paperTitle = paper.getExamName() != null ? paper.getExamName() : paperSubject;

            // 1. Question-level topic matching
            if (paper.getQuestions() != null) {
                for (QuestionPaper.Question q : paper.getQuestions()) {
                    if (q.getTopic() != null && !q.getTopic().isBlank()) {
                        String qTopic = q.getTopic().toLowerCase(Locale.ROOT);
                        if (qTopic.contains(topicName) || topicName.contains(qTopic)) {
                            boolean alreadyMapped = mappingRepository
                                    .existsByClassroomIdAndSyllabusTopicIdAndPaperIdAndQuestionId(
                                            classroom.getId(), topicId, paper.getPaperId(), q.getQuestionId());
                            if (!alreadyMapped) {
                                suggestions.add(AssessmentMappingSuggestionResponse.builder()
                                        .paperId(paper.getPaperId())
                                        .questionId(q.getQuestionId())
                                        .assessmentTitle(paperTitle + " [" + q.getQuestionId() + "]")
                                        .subject(paper.getSubject())
                                        .subjectCode(paper.getSubjectCode())
                                        .matchedTopicLabel(q.getTopic())
                                        .confidenceReason("Question " + q.getQuestionId() + " topic '" + q.getTopic() + "' matches syllabus topic")
                                        .confirmed(false)
                                        .build());
                            }
                        }
                    }
                }
            }

            // 2. Paper-level subject/exam matching
            if (paperSubject.toLowerCase(Locale.ROOT).contains(topicName) || topicName.contains(paperSubject.toLowerCase(Locale.ROOT))) {
                boolean alreadyMapped = mappingRepository
                        .existsByClassroomIdAndSyllabusTopicIdAndPaperIdAndQuestionId(
                                classroom.getId(), topicId, paper.getPaperId(), null);
                if (!alreadyMapped) {
                    suggestions.add(AssessmentMappingSuggestionResponse.builder()
                            .paperId(paper.getPaperId())
                            .questionId(null)
                            .assessmentTitle(paperTitle)
                            .subject(paper.getSubject())
                            .subjectCode(paper.getSubjectCode())
                            .matchedTopicLabel(paperSubject)
                            .confidenceReason("Question paper subject '" + paperSubject + "' matches syllabus topic")
                            .confirmed(false)
                            .build());
                }
            }
        }

        return suggestions;
    }

    // =========================================================================
    // INTERNAL HELPER METHODS
    // =========================================================================

    private AssessmentMappingResponse saveMapping(
            String classroomId,
            CreateAssessmentMappingRequest request,
            MappingSource source,
            String teacherEmail
    ) {
        Classroom classroom = getExistingClassroom(classroomId);
        User teacher = getAuthenticatedTeacher(teacherEmail);
        verifyClassroomOwnership(classroom, teacher);

        if (request.getSyllabusTopicId() == null || request.getSyllabusTopicId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Syllabus topic ID is required");
        }
        if (request.getPaperId() == null || request.getPaperId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Assessment paper ID is required");
        }

        SyllabusItem topic = syllabusItemRepository.findByIdAndClassroomId(request.getSyllabusTopicId(), classroom.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Syllabus topic not found with ID " + request.getSyllabusTopicId() + " in classroom " + classroomId));

        QuestionPaper paper = questionPaperRepository.findFirstByPaperIdOrderByUploadedAtDesc(request.getPaperId().trim())
                .or(() -> questionPaperRepository.findById(request.getPaperId().trim()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Assessment question paper not found with ID " + request.getPaperId()));

        if (!isPaperRelevantToClassroom(paper, classroom, teacher)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Assessment paper does not belong to this teacher or classroom");
        }

        String questionId = request.getQuestionId() != null && !request.getQuestionId().isBlank()
                ? request.getQuestionId().trim()
                : null;

        String matchedLabel = request.getMatchedTopicLabel() != null && !request.getMatchedTopicLabel().isBlank()
                ? request.getMatchedTopicLabel().trim()
                : null;

        if (questionId != null) {
            boolean questionExists = paper.getQuestions() != null && paper.getQuestions().stream()
                    .anyMatch(q -> questionId.equalsIgnoreCase(q.getQuestionId()));
            if (!questionExists) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Question ID '" + questionId + "' not found in question paper " + paper.getPaperId());
            }
            if (matchedLabel == null && paper.getQuestions() != null) {
                matchedLabel = paper.getQuestions().stream()
                        .filter(q -> questionId.equalsIgnoreCase(q.getQuestionId()))
                        .findFirst()
                        .map(QuestionPaper.Question::getTopic)
                        .orElse(null);
            }
        }

        if (matchedLabel == null) {
            matchedLabel = paper.getSubject();
        }

        boolean exists = mappingRepository.existsByClassroomIdAndSyllabusTopicIdAndPaperIdAndQuestionId(
                classroom.getId(), topic.getId(), paper.getPaperId(), questionId);
        if (exists) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Assessment is already mapped to this syllabus topic");
        }

        LocalDateTime now = LocalDateTime.now();
        String title = paper.getExamName() != null ? paper.getExamName() : paper.getSubject();

        SyllabusAssessmentMapping mapping = SyllabusAssessmentMapping.builder()
                .classroomId(classroom.getId())
                .syllabusTopicId(topic.getId())
                .paperId(paper.getPaperId())
                .questionId(questionId)
                .assessmentTitle(title)
                .subject(paper.getSubject())
                .subjectCode(paper.getSubjectCode())
                .matchedTopicLabel(matchedLabel)
                .mappingSource(source)
                .confirmed(true)
                .createdBy(teacher.getId())
                .createdAt(now)
                .updatedAt(now)
                .build();

        SyllabusAssessmentMapping saved = mappingRepository.save(mapping);
        log.info("Teacher {} mapped assessment {} (q={}) to topic '{}' ({}) in classroom {}",
                teacher.getEmail(), paper.getPaperId(), questionId, topic.getTopic(), topic.getId(), classroomId);

        auditService.recordEvent(
                classroomId,
                topic.getId(),
                null,
                saved.getId(),
                teacher,
                SyllabusAuditEventType.ASSESSMENT_MAPPED,
                "Mapped assessment " + paper.getPaperId() + " to topic " + topic.getTopic(),
                Map.of(
                        "paperId", paper.getPaperId(),
                        "topicId", topic.getId(),
                        "mappingSource", source.name()
                )
        );

        return toResponse(saved);
    }

    private boolean isPaperRelevantToClassroom(QuestionPaper paper, Classroom classroom, User teacher) {
        if (teacher.getRole() == Role.ADMIN) {
            return true;
        }

        if (paper.getCreatedBy() != null &&
                (paper.getCreatedBy().equals(teacher.getId()) || paper.getCreatedBy().equalsIgnoreCase(teacher.getEmail()))) {
            return true;
        }

        if (classroom.getSubjectCode() != null && paper.getSubjectCode() != null &&
                classroom.getSubjectCode().equalsIgnoreCase(paper.getSubjectCode())) {
            return true;
        }

        return classroom.getSubjectName() != null && paper.getSubject() != null &&
                classroom.getSubjectName().equalsIgnoreCase(paper.getSubject());
    }

    private Classroom getExistingClassroom(String classroomId) {
        return classroomRepository.findById(classroomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Classroom not found: " + classroomId));
    }

    private User getAuthenticatedUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User account not found"));
    }

    private User getAuthenticatedTeacher(String email) {
        User user = getAuthenticatedUser(email);
        if (user.getRole() != Role.TEACHER && user.getRole() != Role.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: Only faculty can perform this action");
        }
        return user;
    }

    private void verifyClassroomOwnership(Classroom classroom, User teacher) {
        if (!classroom.getTeacherId().equals(teacher.getId()) && teacher.getRole() != Role.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden: You are not authorized to manage this classroom");
        }
    }

    private void verifyClassroomReadAccess(Classroom classroom, User caller) {
        if (classroom.getTeacherId().equals(caller.getId()) || caller.getRole() == Role.ADMIN) {
            return;
        }

        if (caller.getRole() == Role.STUDENT) {
            Optional<ClassroomMembership> membershipOpt = classroomMembershipRepository
                    .findByClassroomIdAndStudentId(classroom.getId(), caller.getId());

            if (membershipOpt.isEmpty() || !"ACTIVE".equalsIgnoreCase(membershipOpt.get().getMembershipStatus())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Access denied: You do not have an active enrollment in this classroom");
            }
            return;
        }

        throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                "Access denied: You are not authorized to view the syllabus for this classroom");
    }

    private AssessmentMappingResponse toResponse(SyllabusAssessmentMapping m) {
        return AssessmentMappingResponse.builder()
                .id(m.getId())
                .classroomId(m.getClassroomId())
                .syllabusTopicId(m.getSyllabusTopicId())
                .paperId(m.getPaperId())
                .questionId(m.getQuestionId())
                .assessmentTitle(m.getAssessmentTitle())
                .subject(m.getSubject())
                .subjectCode(m.getSubjectCode())
                .matchedTopicLabel(m.getMatchedTopicLabel())
                .mappingSource(m.getMappingSource())
                .confirmed(m.isConfirmed())
                .createdBy(m.getCreatedBy())
                .createdAt(m.getCreatedAt())
                .updatedAt(m.getUpdatedAt())
                .build();
    }

    public TopicAssessmentAnalysisResponse analyzeTopicAssessment(
            String classroomId,
            AssessmentAnalysisRequest request,
            String teacherEmail
    ) {
        Classroom classroom = getExistingClassroom(classroomId);
        User teacher = getAuthenticatedTeacher(teacherEmail);
        verifyClassroomOwnership(classroom, teacher);

        if (request.getTopicId() == null || request.getTopicId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Syllabus topic ID is required for assessment analysis");
        }

        boolean hasPaper = request.getPaperId() != null && !request.getPaperId().isBlank();
        boolean hasManual = request.getManualText() != null && !request.getManualText().isBlank();

        if (!hasPaper && !hasManual) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Either an assessment paper ID or manual question text must be provided");
        }

        SyllabusItem targetTopic = syllabusItemRepository.findByIdAndClassroomId(request.getTopicId(), classroom.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Syllabus topic not found: " + request.getTopicId()));

        List<SyllabusItem> allClassroomTopics = syllabusItemRepository.findByClassroomIdOrderByOrderIndexAscCreatedAtAsc(classroom.getId());

        // Extract syllabus concepts
        Set<String> syllabusConcepts = new LinkedHashSet<>();
        syllabusConcepts.add(targetTopic.getTopic().trim());
        if (targetTopic.getSubtopics() != null) {
            for (String sub : targetTopic.getSubtopics()) {
                if (sub != null && !sub.isBlank()) {
                    syllabusConcepts.add(sub.trim());
                }
            }
        }
        // Also split topic by delimiter if only 1 concept
        if (syllabusConcepts.size() == 1) {
            String[] splits = targetTopic.getTopic().split("[,;—\\-]+");
            for (String s : splits) {
                if (s.trim().length() > 3) {
                    syllabusConcepts.add(s.trim());
                }
            }
        }

        // Collect questions to evaluate
        List<QuestionPaper.Question> questionsToEvaluate = new ArrayList<>();
        String paperTitle = "Manual Content";
        QuestionPaper paper = null;

        if (hasPaper) {
            paper = questionPaperRepository.findFirstByPaperIdOrderByUploadedAtDesc(request.getPaperId().trim())
                    .or(() -> questionPaperRepository.findById(request.getPaperId().trim()))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Question paper not found: " + request.getPaperId()));

            paperTitle = paper.getExamName() != null ? paper.getExamName() : (paper.getSubject() != null ? paper.getSubject() : paper.getPaperId());

            if (paper.getQuestions() != null) {
                if (request.getQuestionId() != null && !request.getQuestionId().isBlank()) {
                    String qid = request.getQuestionId().trim();
                    paper.getQuestions().stream()
                            .filter(q -> qid.equalsIgnoreCase(q.getQuestionId()))
                            .findFirst()
                            .ifPresent(questionsToEvaluate::add);
                } else {
                    questionsToEvaluate.addAll(paper.getQuestions());
                }
            }
        }

        if (hasManual) {
            String manual = request.getManualText().trim();
            String[] blocks = manual.split("\n\n+");
            int manualIdx = 1;
            for (String block : blocks) {
                if (!block.isBlank()) {
                    questionsToEvaluate.add(QuestionPaper.Question.builder()
                            .questionId("M" + manualIdx)
                            .text(block.trim())
                            .topic("Manual Submission")
                            .build());
                    manualIdx++;
                }
            }
        }

        // Three-way breakdown
        List<MatchedConceptItem> matchedConcepts = new ArrayList<>();
        List<MissingSyllabusConceptItem> missingSyllabusConcepts = new ArrayList<>();
        List<UnmatchedQuestionConceptItem> unmatchedQuestionConcepts = new ArrayList<>();

        Set<String> matchedConceptNames = new HashSet<>();
        Set<String> matchedQuestionIds = new HashSet<>();

        // Match concepts
        for (String concept : syllabusConcepts) {
            Set<String> conceptTokens = tokenizeAndFilter(concept);
            QuestionPaper.Question bestMatchQuestion = null;
            double bestScore = 0.0;

            for (QuestionPaper.Question q : questionsToEvaluate) {
                String qText = (q.getText() != null ? q.getText() : "") + " " + (q.getTopic() != null ? q.getTopic() : "");
                Set<String> qTokens = tokenizeAndFilter(qText);

                double score = computeConceptSimilarity(concept, conceptTokens, qText, qTokens);
                if (score > bestScore) {
                    bestScore = score;
                    bestMatchQuestion = q;
                }
            }

            if (bestMatchQuestion != null && bestScore >= 0.30) {
                matchedConceptNames.add(concept);
                matchedQuestionIds.add(bestMatchQuestion.getQuestionId());

                String matchType = bestScore >= 0.70 ? "STRONG" : (bestScore >= 0.45 ? "PARTIAL" : "UNCERTAIN");
                String confidenceBand = bestScore >= 0.70 ? "HIGH" : (bestScore >= 0.45 ? "MEDIUM" : "LOW");
                String qExcerpt = bestMatchQuestion.getText() != null
                        ? (bestMatchQuestion.getText().length() > 140 ? bestMatchQuestion.getText().substring(0, 140) + "..." : bestMatchQuestion.getText())
                        : bestMatchQuestion.getTopic();

                matchedConcepts.add(MatchedConceptItem.builder()
                        .concept(concept)
                        .conceptName(concept)
                        .syllabusTopic(targetTopic.getTopic())
                        .subtopic(concept)
                        .questionId(bestMatchQuestion.getQuestionId())
                        .questionIdentifier(bestMatchQuestion.getQuestionId())
                        .syllabusExcerpt((targetTopic.getUnit() != null ? targetTopic.getUnit() + " — " : "") + concept)
                        .syllabusSnippet((targetTopic.getUnit() != null ? targetTopic.getUnit() + " — " : "") + concept)
                        .questionExcerpt(qExcerpt)
                        .questionSnippet(qExcerpt)
                        .matchType(matchType)
                        .confidenceScore(Math.round(bestScore * 100.0) / 100.0)
                        .confidenceBand(confidenceBand)
                        .explanation("Question " + bestMatchQuestion.getQuestionId() + " tests '" + concept + "' with " + confidenceBand.toLowerCase() + " semantic alignment.")
                        .build());
            } else {
                missingSyllabusConcepts.add(MissingSyllabusConceptItem.builder()
                        .concept(concept)
                        .conceptName(concept)
                        .subtopic(concept)
                        .syllabusExcerpt((targetTopic.getUnit() != null ? targetTopic.getUnit() + " — " : "") + concept)
                        .explanation("No question in the evaluated paper/content directly addresses this syllabus concept.")
                        .confidenceBand("HIGH")
                        .suggestedAction("Consider incorporating an assessment item for '" + concept + "' in upcoming internal evaluations.")
                        .build());
            }
        }

        // Unmatched questions
        for (QuestionPaper.Question q : questionsToEvaluate) {
            if (!matchedQuestionIds.contains(q.getQuestionId())) {
                SyllabusItem candidateOtherTopic = null;
                double bestOtherScore = 0.0;
                String qText = (q.getText() != null ? q.getText() : "") + " " + (q.getTopic() != null ? q.getTopic() : "");
                Set<String> qTokens = tokenizeAndFilter(qText);

                for (SyllabusItem other : allClassroomTopics) {
                    if (other.getId().equals(targetTopic.getId())) continue;
                    Set<String> otherTokens = tokenizeAndFilter(other.getTopic());
                    double score = computeOverlap(qTokens, otherTokens);
                    if (score > bestOtherScore) {
                        bestOtherScore = score;
                        candidateOtherTopic = other;
                    }
                }

                String detectedConcept = q.getTopic() != null && !q.getTopic().isBlank()
                        ? q.getTopic()
                        : extractCoreConceptPhrase(q.getText());

                String possibleAlt = (candidateOtherTopic != null && bestOtherScore > 0.20)
                        ? (candidateOtherTopic.getUnit() + ": " + candidateOtherTopic.getTopic())
                        : "Advanced / Out-of-scope extension";

                String divergence = "Question focuses on '" + detectedConcept + "', which is outside the scope of selected topic '" + targetTopic.getTopic() + "'.";

                unmatchedQuestionConcepts.add(UnmatchedQuestionConceptItem.builder()
                        .questionId(q.getQuestionId())
                        .questionIdentifier(q.getQuestionId())
                        .questionText(q.getText() != null && q.getText().length() > 180 ? q.getText().substring(0, 180) + "..." : q.getText())
                        .detectedConcept(detectedConcept)
                        .explanation(divergence)
                        .divergenceReason(divergence)
                        .potentialModuleMapping(possibleAlt)
                        .possibleAlternativeTopic(possibleAlt)
                        .teacherReviewAction("Verify whether this question belongs to " + possibleAlt + " or should remain excluded.")
                        .build());
            }
        }

        double alignmentPct = syllabusConcepts.isEmpty() ? 0.0 : ((double) matchedConceptNames.size() / syllabusConcepts.size()) * 100.0;

        String scope = "Syllabus Topic: " + targetTopic.getTopic() + " (" + (targetTopic.getUnit() != null ? targetTopic.getUnit() : "Unit") + ") vs. "
                + (hasPaper ? "Assessment Paper: " + paperTitle : "Manual Content Submission");

        String resolvedPaperId = paper != null ? paper.getPaperId() : (hasManual ? "MANUAL_INPUT" : null);

        return TopicAssessmentAnalysisResponse.builder()
                .analysisScope(scope)
                .topicId(targetTopic.getId())
                .topicTitle(targetTopic.getTopic())
                .syllabusTopicId(targetTopic.getId())
                .syllabusTopicName(targetTopic.getTopic())
                .unit(targetTopic.getUnit())
                .paperId(resolvedPaperId)
                .examName(paper != null ? paper.getSubject() : "Manual Input Analysis")
                .questionId(request.getQuestionId())
                .questionIdentifier(request.getQuestionId())
                .coveredConcepts(matchedConcepts)
                .matchedConcepts(matchedConcepts)
                .missingSyllabusConcepts(missingSyllabusConcepts)
                .unmatchedQuestionConcepts(unmatchedQuestionConcepts)
                .totalSyllabusConceptsEvaluated(syllabusConcepts.size())
                .totalQuestionConceptsEvaluated(questionsToEvaluate.size())
                .alignmentPercentage(Math.round(alignmentPct * 10.0) / 10.0)
                .requiresTeacherConfirmation(true)
                .limitationsNotes("Semantic suggestions are generated for educator validation. Topics absent from this assessment paper are not presumed absent from the curriculum.")
                .notes("Generated suggestions are for teacher review. Concepts absent from this assessment paper are not presumed absent from the curriculum.")
                .aiProviderUsed("Deterministic Semantic Analyzer (Fallback)")
                .build();
    }

    private Set<String> tokenizeAndFilter(String text) {
        if (text == null) return Collections.emptySet();
        Set<String> stopWords = Set.of(
                "what", "is", "are", "explain", "describe", "define", "discuss", "with", "neat", "sketch",
                "diagram", "write", "note", "the", "and", "for", "from", "that", "this", "these", "those",
                "how", "does", "which", "when", "where", "module", "unit", "part", "question", "marks"
        );
        Set<String> tokens = new HashSet<>();
        String[] words = text.toLowerCase(Locale.ROOT).split("[^a-zA-Z0-9]+");
        for (String w : words) {
            if (w.length() >= 3 && !stopWords.contains(w)) {
                tokens.add(w);
            }
        }
        return tokens;
    }

    private double computeConceptSimilarity(String concept, Set<String> conceptTokens, String qText, Set<String> qTokens) {
        if (conceptTokens.isEmpty() || qTokens.isEmpty()) return 0.0;

        String normConcept = concept.toLowerCase(Locale.ROOT).trim();
        String normQText = qText.toLowerCase(Locale.ROOT).trim();

        if (normQText.contains(normConcept) && normConcept.length() > 4) {
            return 0.92;
        }

        long commonCount = conceptTokens.stream().filter(qTokens::contains).count();
        double recall = (double) commonCount / conceptTokens.size();
        double precision = (double) commonCount / Math.min(qTokens.size(), conceptTokens.size() + 4);
        double f1 = (recall + precision > 0) ? (2.0 * recall * precision) / (recall + precision) : 0.0;

        if (recall >= 0.75) {
            return Math.max(0.80, f1);
        } else if (recall >= 0.50) {
            return Math.max(0.60, f1);
        } else if (commonCount >= 1) {
            return Math.max(0.35, f1);
        }
        return 0.0;
    }

    private double computeOverlap(Set<String> s1, Set<String> s2) {
        if (s1.isEmpty() || s2.isEmpty()) return 0.0;
        long common = s1.stream().filter(s2::contains).count();
        return (double) common / Math.max(s1.size(), s2.size());
    }

    private String extractCoreConceptPhrase(String text) {
        if (text == null || text.isBlank()) return "General Question Concept";
        String clean = text.replaceAll("^[0-9a-zA-Z\\(\\)\\.\\-\\s]{1,6}\\s+", "").trim();
        String[] words = clean.split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < Math.min(words.length, 6); i++) {
            if (sb.length() > 0) sb.append(" ");
            sb.append(words[i]);
        }
        return sb.toString();
    }
}
