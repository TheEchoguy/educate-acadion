package com.acadion.backend.service;

import com.acadion.backend.dto.syllabus.AssessmentMappingResponse;
import com.acadion.backend.dto.syllabus.AssessmentMappingSuggestionResponse;
import com.acadion.backend.dto.syllabus.CreateAssessmentMappingRequest;
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
}
