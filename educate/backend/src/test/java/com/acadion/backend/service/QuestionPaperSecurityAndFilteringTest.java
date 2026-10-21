package com.acadion.backend.service;

import com.acadion.backend.entity.QuestionPaper;
import com.acadion.backend.repository.QuestionPaperRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class QuestionPaperSecurityAndFilteringTest {

    @Mock
    private QuestionPaperRepository questionPaperRepository;

    @InjectMocks
    private QuestionPaperService questionPaperService;

    private QuestionPaper samplePaper;

    @BeforeEach
    void setUp() {
        samplePaper = QuestionPaper.builder()
                .paperId("PUB-CS101-001")
                .subject("Data Structures")
                .publicationStatus("PUBLISHED")
                .questions(List.of(
                        QuestionPaper.Question.builder()
                                .questionId("Q1")
                                .text("What is a FIFO structure?")
                                .options(List.of("Queue", "Stack", "Tree", "Graph"))
                                .correctAnswer("A")
                                .explanation("A Queue is First-In First-Out.")
                                .marks(1.0)
                                .build()
                ))
                .build();
    }

    @Test
    @DisplayName("sanitizeForStudent strips correct answer and explanation while keeping options and text")
    void testSanitizeForStudent() {
        QuestionPaper sanitized = questionPaperService.sanitizeForStudent(samplePaper);

        assertNotNull(sanitized);
        assertEquals(1, sanitized.getQuestions().size());
        QuestionPaper.Question q = sanitized.getQuestions().get(0);

        assertEquals("Q1", q.getQuestionId());
        assertEquals("What is a FIFO structure?", q.getText());
        assertEquals(4, q.getOptions().size());
        assertEquals(1.0, q.getMarks());
        assertNull(q.getCorrectAnswer(), "correctAnswer MUST be null for students");
        assertNull(q.getExplanation(), "explanation MUST be null for students");
    }

    @Test
    @DisplayName("getAllPapers for STUDENT excludes drafts and preserves legacy papers")
    void testStudentDraftFiltering() {
        QuestionPaper draft = QuestionPaper.builder()
                .paperId("DRAFT-CS-001")
                .publicationStatus("DRAFT")
                .questions(List.of(QuestionPaper.Question.builder().correctAnswer("B").build()))
                .build();

        QuestionPaper legacyUploaded = QuestionPaper.builder()
                .paperId("LEGACY-CS-002")
                .publicationStatus(null) // legacy record
                .questions(List.of(QuestionPaper.Question.builder().correctAnswer("C").build()))
                .build();

        QuestionPaper published = QuestionPaper.builder()
                .paperId("PUB-CS-003")
                .publicationStatus("PUBLISHED")
                .questions(List.of(QuestionPaper.Question.builder().correctAnswer("D").build()))
                .build();

        when(questionPaperRepository.findAll()).thenReturn(List.of(draft, legacyUploaded, published));

        List<QuestionPaper> studentPapers = questionPaperService.getAllPapers("STUDENT", null);

        assertEquals(2, studentPapers.size(), "Student should only see legacy and published papers");
        assertTrue(studentPapers.stream().noneMatch(p -> "DRAFT-CS-001".equals(p.getPaperId())));
        assertTrue(studentPapers.stream().anyMatch(p -> "LEGACY-CS-002".equals(p.getPaperId())));
        assertTrue(studentPapers.stream().anyMatch(p -> "PUB-CS-003".equals(p.getPaperId())));

        // Verify each paper in student view is sanitized
        for (QuestionPaper p : studentPapers) {
            for (QuestionPaper.Question q : p.getQuestions()) {
                assertNull(q.getCorrectAnswer());
                assertNull(q.getExplanation());
            }
        }
    }

    @Test
    @DisplayName("getAllPapers for TEACHER includes draft papers without stripping answers")
    void testTeacherPaperListing() {
        QuestionPaper draft = QuestionPaper.builder()
                .paperId("DRAFT-CS-001")
                .publicationStatus("DRAFT")
                .questions(List.of(QuestionPaper.Question.builder().correctAnswer("B").explanation("Exp").build()))
                .build();

        when(questionPaperRepository.findAll()).thenReturn(List.of(draft, samplePaper));

        List<QuestionPaper> teacherPapers = questionPaperService.getAllPapers("TEACHER", null);

        assertEquals(2, teacherPapers.size());
        assertTrue(teacherPapers.stream().anyMatch(p -> "DRAFT-CS-001".equals(p.getPaperId())));

        QuestionPaper draftResult = teacherPapers.stream().filter(p -> "DRAFT-CS-001".equals(p.getPaperId())).findFirst().orElseThrow();
        assertEquals("B", draftResult.getQuestions().get(0).getCorrectAnswer());
        assertEquals("Exp", draftResult.getQuestions().get(0).getExplanation());
    }
}
