package com.acadion.backend.service;

import com.acadion.backend.dto.syllabus.AssessmentMappingResponse;
import com.acadion.backend.dto.syllabus.AssessmentMappingSuggestionResponse;
import com.acadion.backend.dto.syllabus.CreateAssessmentMappingRequest;
import com.acadion.backend.entity.*;
import com.acadion.backend.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class SyllabusAssessmentMappingServiceTest {

    @Mock
    private SyllabusAssessmentMappingRepository mappingRepository;

    @Mock
    private SyllabusItemRepository syllabusItemRepository;

    @Mock
    private QuestionPaperRepository questionPaperRepository;

    @Mock
    private ClassroomRepository classroomRepository;

    @Mock
    private ClassroomMembershipRepository classroomMembershipRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private SyllabusAuditService auditService;

    @InjectMocks
    private SyllabusAssessmentMappingService mappingService;

    private User teacherOwner;
    private User otherTeacher;
    private Classroom classroom;
    private SyllabusItem topicItem;
    private QuestionPaper validPaper;

    @BeforeEach
    void setUp() {
        teacherOwner = User.builder()
                .id("teacher_1")
                .name("Prof. Turing")
                .email("turing@acadion.com")
                .role(Role.TEACHER)
                .build();

        otherTeacher = User.builder()
                .id("teacher_2")
                .name("Prof. Babbage")
                .email("babbage@acadion.com")
                .role(Role.TEACHER)
                .build();

        classroom = Classroom.builder()
                .id("cls_1")
                .name("Algorithms")
                .subjectCode("21CS42")
                .subjectName("Design and Analysis of Algorithms")
                .teacherId(teacherOwner.getId())
                .status("ACTIVE")
                .build();

        topicItem = SyllabusItem.builder()
                .id("topic_1")
                .classroomId(classroom.getId())
                .unit("Unit 2")
                .topic("Dynamic Programming")
                .status(SyllabusStatus.IN_PROGRESS)
                .build();

        QuestionPaper.Question q1 = QuestionPaper.Question.builder()
                .questionId("Q1")
                .text("Solve 0/1 Knapsack using DP")
                .topic("Dynamic Programming")
                .marks(10.0)
                .build();

        validPaper = QuestionPaper.builder()
                .id("qp_doc_1")
                .paperId("QP-2026-IA1")
                .subject("Design and Analysis of Algorithms")
                .subjectCode("21CS42")
                .examName("Internal Assessment 1")
                .createdBy(teacherOwner.getId())
                .questions(List.of(q1))
                .uploadedAt(LocalDateTime.now())
                .build();
    }

    // -------------------------------------------------------------------------
    // 18. A valid existing assessment can be mapped to an authorized topic
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("18. Valid existing assessment is mapped to an authorized syllabus topic successfully")
    void testValidAssessmentMappedSuccessfully() {
        when(classroomRepository.findById(classroom.getId())).thenReturn(Optional.of(classroom));
        when(userRepository.findByEmail(teacherOwner.getEmail())).thenReturn(Optional.of(teacherOwner));
        when(syllabusItemRepository.findByIdAndClassroomId("topic_1", classroom.getId()))
                .thenReturn(Optional.of(topicItem));
        when(questionPaperRepository.findFirstByPaperIdOrderByUploadedAtDesc("QP-2026-IA1"))
                .thenReturn(Optional.of(validPaper));
        when(mappingRepository.existsByClassroomIdAndSyllabusTopicIdAndPaperIdAndQuestionId(
                classroom.getId(), "topic_1", "QP-2026-IA1", "Q1"))
                .thenReturn(false);
        when(mappingRepository.save(any(SyllabusAssessmentMapping.class))).thenAnswer(inv -> {
            SyllabusAssessmentMapping m = inv.getArgument(0);
            m.setId("map_1");
            return m;
        });

        CreateAssessmentMappingRequest req = CreateAssessmentMappingRequest.builder()
                .syllabusTopicId("topic_1")
                .paperId("QP-2026-IA1")
                .questionId("Q1")
                .build();

        AssessmentMappingResponse res = mappingService.createManualMapping(classroom.getId(), req, teacherOwner.getEmail());

        assertNotNull(res);
        assertEquals("map_1", res.getId());
        assertEquals("QP-2026-IA1", res.getPaperId());
        assertEquals("Q1", res.getQuestionId());
        assertEquals(MappingSource.MANUAL, res.getMappingSource());
        assertTrue(res.isConfirmed());
        assertEquals(teacherOwner.getId(), res.getCreatedBy());

        verify(mappingRepository).save(any(SyllabusAssessmentMapping.class));
        verify(auditService).recordEvent(eq(classroom.getId()), eq("topic_1"), isNull(), eq("map_1"),
                eq(teacherOwner), eq(SyllabusAuditEventType.ASSESSMENT_MAPPED), anyString(), anyMap());
    }

    // -------------------------------------------------------------------------
    // 19. Nonexistent or cross-classroom assessments are rejected
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("19. Nonexistent or cross-classroom assessments are rejected with 404 or 400")
    void testNonexistentOrCrossClassroomAssessmentRejected() {
        when(classroomRepository.findById(classroom.getId())).thenReturn(Optional.of(classroom));
        when(userRepository.findByEmail(teacherOwner.getEmail())).thenReturn(Optional.of(teacherOwner));
        when(syllabusItemRepository.findByIdAndClassroomId("topic_1", classroom.getId()))
                .thenReturn(Optional.of(topicItem));

        // Case A: Paper not found
        when(questionPaperRepository.findFirstByPaperIdOrderByUploadedAtDesc("QP-MISSING"))
                .thenReturn(Optional.empty());
        when(questionPaperRepository.findById("QP-MISSING"))
                .thenReturn(Optional.empty());

        CreateAssessmentMappingRequest reqMissing = CreateAssessmentMappingRequest.builder()
                .syllabusTopicId("topic_1")
                .paperId("QP-MISSING")
                .build();

        ResponseStatusException ex404 = assertThrows(ResponseStatusException.class, () ->
                mappingService.createManualMapping(classroom.getId(), reqMissing, teacherOwner.getEmail())
        );
        assertEquals(HttpStatus.NOT_FOUND, ex404.getStatusCode());

        // Case B: Foreign / unrelated paper from different subject and different teacher
        QuestionPaper foreignPaper = QuestionPaper.builder()
                .paperId("QP-FOREIGN")
                .subject("Electrical Circuits")
                .subjectCode("21EC32")
                .createdBy("foreign_teacher_999")
                .build();

        when(questionPaperRepository.findFirstByPaperIdOrderByUploadedAtDesc("QP-FOREIGN"))
                .thenReturn(Optional.of(foreignPaper));

        CreateAssessmentMappingRequest reqForeign = CreateAssessmentMappingRequest.builder()
                .syllabusTopicId("topic_1")
                .paperId("QP-FOREIGN")
                .build();

        ResponseStatusException ex400 = assertThrows(ResponseStatusException.class, () ->
                mappingService.createManualMapping(classroom.getId(), reqForeign, teacherOwner.getEmail())
        );
        assertEquals(HttpStatus.BAD_REQUEST, ex400.getStatusCode());
        assertTrue(ex400.getReason().contains("does not belong to this teacher or classroom"));
    }

    // -------------------------------------------------------------------------
    // 20. Duplicate mappings are prevented
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("20. Duplicate mappings for the same topic and assessment are prevented")
    void testDuplicateMappingsPrevented() {
        when(classroomRepository.findById(classroom.getId())).thenReturn(Optional.of(classroom));
        when(userRepository.findByEmail(teacherOwner.getEmail())).thenReturn(Optional.of(teacherOwner));
        when(syllabusItemRepository.findByIdAndClassroomId("topic_1", classroom.getId()))
                .thenReturn(Optional.of(topicItem));
        when(questionPaperRepository.findFirstByPaperIdOrderByUploadedAtDesc("QP-2026-IA1"))
                .thenReturn(Optional.of(validPaper));

        // Duplicate exists!
        when(mappingRepository.existsByClassroomIdAndSyllabusTopicIdAndPaperIdAndQuestionId(
                classroom.getId(), "topic_1", "QP-2026-IA1", "Q1"))
                .thenReturn(true);

        CreateAssessmentMappingRequest req = CreateAssessmentMappingRequest.builder()
                .syllabusTopicId("topic_1")
                .paperId("QP-2026-IA1")
                .questionId("Q1")
                .build();

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                mappingService.createManualMapping(classroom.getId(), req, teacherOwner.getEmail())
        );

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().contains("already mapped"));
        verify(mappingRepository, never()).save(any());
    }

    // -------------------------------------------------------------------------
    // 21. Suggested mappings require explicit teacher confirmation
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("21. Suggested mappings are initially unconfirmed; confirming saves CONFIRMED_SUGGESTION")
    void testSuggestedMappingsRequireExplicitConfirmation() {
        when(classroomRepository.findById(classroom.getId())).thenReturn(Optional.of(classroom));
        when(userRepository.findByEmail(teacherOwner.getEmail())).thenReturn(Optional.of(teacherOwner));
        when(syllabusItemRepository.findByIdAndClassroomId("topic_1", classroom.getId()))
                .thenReturn(Optional.of(topicItem));
        when(questionPaperRepository.findAll()).thenReturn(List.of(validPaper));
        when(mappingRepository.existsByClassroomIdAndSyllabusTopicIdAndPaperIdAndQuestionId(
                classroom.getId(), "topic_1", "QP-2026-IA1", "Q1")).thenReturn(false);

        // Step 1: Suggestion generated with confirmed = false
        List<AssessmentMappingSuggestionResponse> suggestions = mappingService
                .getMappingSuggestions(classroom.getId(), "topic_1", teacherOwner.getEmail());

        assertEquals(1, suggestions.size());
        assertFalse(suggestions.get(0).isConfirmed());
        assertEquals("Q1", suggestions.get(0).getQuestionId());
        assertTrue(suggestions.get(0).getConfidenceReason().contains("Dynamic Programming"));

        // Step 2: Confirm suggestion explicitly
        when(questionPaperRepository.findFirstByPaperIdOrderByUploadedAtDesc("QP-2026-IA1"))
                .thenReturn(Optional.of(validPaper));
        when(mappingRepository.save(any(SyllabusAssessmentMapping.class))).thenAnswer(inv -> inv.getArgument(0));

        CreateAssessmentMappingRequest confirmReq = CreateAssessmentMappingRequest.builder()
                .syllabusTopicId("topic_1")
                .paperId("QP-2026-IA1")
                .questionId("Q1")
                .build();

        AssessmentMappingResponse confirmed = mappingService.confirmSuggestedMapping(classroom.getId(), confirmReq, teacherOwner.getEmail());

        assertTrue(confirmed.isConfirmed());
        assertEquals(MappingSource.CONFIRMED_SUGGESTION, confirmed.getMappingSource());
        verify(mappingRepository).save(argThat(m -> m.getMappingSource() == MappingSource.CONFIRMED_SUGGESTION));
    }

    // -------------------------------------------------------------------------
    // 22. Unreliable or unavailable topic data does not produce fabricated suggestions
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("22. Questions or papers without matching topic/subject labels produce empty suggestions")
    void testNoFabricatedSuggestionsWhenNoDataMatches() {
        when(classroomRepository.findById(classroom.getId())).thenReturn(Optional.of(classroom));
        when(userRepository.findByEmail(teacherOwner.getEmail())).thenReturn(Optional.of(teacherOwner));
        when(syllabusItemRepository.findByIdAndClassroomId("topic_1", classroom.getId()))
                .thenReturn(Optional.of(topicItem));

        QuestionPaper unrelatedPaper = QuestionPaper.builder()
                .paperId("QP-2026-UNRELATED")
                .subject("Design and Analysis of Algorithms")
                .subjectCode("21CS42")
                .createdBy(teacherOwner.getId())
                .questions(List.of(
                        QuestionPaper.Question.builder().questionId("Q1").topic("Asymptotics").build(),
                        QuestionPaper.Question.builder().questionId("Q2").topic("Sorting Algorithms").build()
                ))
                .build();

        when(questionPaperRepository.findAll()).thenReturn(List.of(unrelatedPaper));

        // Syllabus topic is "Dynamic Programming", so no questions match
        List<AssessmentMappingSuggestionResponse> suggestions = mappingService
                .getMappingSuggestions(classroom.getId(), "topic_1", teacherOwner.getEmail());

        assertTrue(suggestions.isEmpty());
    }

    // -------------------------------------------------------------------------
    // 23. Three-way Semantic Assessment Analysis (Matches, Missing in Paper, Unmatched Question Content)
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("23. Topic assessment analysis distinguishes matched concepts, missing syllabus concepts, and unmatched question concepts")
    void testAnalyzeTopicAssessment_WithQuestionPaper_ConceptMatchingAndCoverage() {
        when(classroomRepository.findById(classroom.getId())).thenReturn(Optional.of(classroom));
        when(userRepository.findByEmail(teacherOwner.getEmail())).thenReturn(Optional.of(teacherOwner));

        SyllabusItem dpTopic = SyllabusItem.builder()
                .id("topic_dp")
                .classroomId(classroom.getId())
                .unit("Unit 3")
                .topic("Dynamic Programming")
                .subtopics(List.of("0/1 Knapsack Problem", "Matrix Chain Multiplication", "Bellman Ford Algorithm"))
                .build();

        when(syllabusItemRepository.findByIdAndClassroomId("topic_dp", classroom.getId()))
                .thenReturn(Optional.of(dpTopic));

        QuestionPaper paperWithQuestions = QuestionPaper.builder()
                .paperId("QP-2026-FINAL")
                .subject("Design and Analysis of Algorithms")
                .subjectCode("21CS42")
                .createdBy(teacherOwner.getId())
                .questions(List.of(
                        QuestionPaper.Question.builder()
                                .questionId("Q1")
                                .text("Explain the 0/1 Knapsack Problem using Dynamic Programming formulation")
                                .topic("Dynamic Programming")
                                .marks(10.0)
                                .build(),
                        QuestionPaper.Question.builder()
                                .questionId("Q2")
                                .text("Explain QuickSort partitioning and worst-case recurrence")
                                .topic("Divide and Conquer")
                                .marks(8.0)
                                .build()
                ))
                .build();

        when(questionPaperRepository.findFirstByPaperIdOrderByUploadedAtDesc("QP-2026-FINAL"))
                .thenReturn(Optional.of(paperWithQuestions));

        com.acadion.backend.dto.syllabus.AssessmentAnalysisRequest req =
                com.acadion.backend.dto.syllabus.AssessmentAnalysisRequest.builder()
                        .topicId("topic_dp")
                        .paperId("QP-2026-FINAL")
                        .build();

        com.acadion.backend.dto.syllabus.TopicAssessmentAnalysisResponse analysis =
                mappingService.analyzeTopicAssessment(classroom.getId(), req, teacherOwner.getEmail());

        assertNotNull(analysis);
        assertEquals("topic_dp", analysis.getTopicId());
        assertEquals("Dynamic Programming", analysis.getTopicTitle());
        assertEquals("QP-2026-FINAL", analysis.getPaperId());

        // A. Matched concepts
        assertFalse(analysis.getMatchedConcepts().isEmpty());
        assertTrue(analysis.getMatchedConcepts().stream().anyMatch(m -> m.getConcept().toLowerCase().contains("knapsack") || "Q1".equals(m.getQuestionId())));

        // B. Missing syllabus concepts (Matrix Chain Multiplication or Bellman Ford not covered in Q1/Q2)
        assertFalse(analysis.getMissingSyllabusConcepts().isEmpty());
        assertTrue(analysis.getMissingSyllabusConcepts().stream().anyMatch(mis -> mis.getConcept().contains("Matrix Chain") || mis.getConcept().contains("Bellman Ford")));

        // C. Unmatched question concepts (Q2 QuickSort does not match DP topic)
        assertFalse(analysis.getUnmatchedQuestionConcepts().isEmpty());
        assertTrue(analysis.getUnmatchedQuestionConcepts().stream().anyMatch(u -> "Q2".equals(u.getQuestionId())));
    }

    @Test
    @DisplayName("24. Manual question content analysis evaluates supplied text against topic")
    void testAnalyzeTopicAssessment_ManualContentAnalysis() {
        when(classroomRepository.findById(classroom.getId())).thenReturn(Optional.of(classroom));
        when(userRepository.findByEmail(teacherOwner.getEmail())).thenReturn(Optional.of(teacherOwner));

        SyllabusItem dpTopic = SyllabusItem.builder()
                .id("topic_dp")
                .classroomId(classroom.getId())
                .unit("Unit 3")
                .topic("Dynamic Programming")
                .subtopics(List.of("0/1 Knapsack Problem", "Matrix Chain Multiplication"))
                .build();

        when(syllabusItemRepository.findByIdAndClassroomId("topic_dp", classroom.getId()))
                .thenReturn(Optional.of(dpTopic));

        com.acadion.backend.dto.syllabus.AssessmentAnalysisRequest req =
                com.acadion.backend.dto.syllabus.AssessmentAnalysisRequest.builder()
                        .topicId("topic_dp")
                        .manualContent("Solve 0/1 Knapsack Problem with optimal substructure property")
                        .build();

        com.acadion.backend.dto.syllabus.TopicAssessmentAnalysisResponse analysis =
                mappingService.analyzeTopicAssessment(classroom.getId(), req, teacherOwner.getEmail());

        assertNotNull(analysis);
        assertEquals("MANUAL_INPUT", analysis.getPaperId());
        assertFalse(analysis.getMatchedConcepts().isEmpty());
        assertTrue(analysis.getMatchedConcepts().stream().anyMatch(m -> m.getConcept().toLowerCase().contains("knapsack")));
        assertTrue(analysis.getMissingSyllabusConcepts().stream().anyMatch(mis -> mis.getConcept().contains("Matrix Chain")));
    }
}
