package com.acadion.backend.service.quiz;

import com.acadion.backend.dto.CreateQuestionPaperRequest;
import com.acadion.backend.dto.quiz.GenerateQuizRequest;
import com.acadion.backend.dto.quiz.GeneratedQuestionDto;
import com.acadion.backend.dto.quiz.GeneratedQuizResponse;
import com.acadion.backend.dto.quiz.RegenerateQuestionRequest;
import com.acadion.backend.entity.QuestionPaper;
import com.acadion.backend.repository.QuestionPaperRepository;
import com.acadion.backend.service.QuestionPaperService;
import com.acadion.backend.service.parser.TextExtractionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class QuizGeneratorServiceTest {

    @Mock
    private QuestionPaperRepository questionPaperRepository;

    @Mock
    private QuestionPaperService questionPaperService;

    @Mock
    private TextExtractionService textExtractionService;

    private ObjectMapper objectMapper;
    private QuizGeneratorService quizGeneratorService;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        quizGeneratorService = new QuizGeneratorService(
                "", // empty openrouter key for testing
                "openrouter/free",
                "https://openrouter.ai/api/v1/chat/completions",
                60,
                questionPaperRepository,
                questionPaperService,
                textExtractionService,
                objectMapper
        );
    }

    @Test
    @DisplayName("Mock Mode generates curriculum-grounded MCQs with valid options, correct answers, and explanations")
    void testMockQuizGeneration() {
        GenerateQuizRequest request = GenerateQuizRequest.builder()
                .subject("Python Programming")
                .topic("Python Data Structures & Functions")
                .mode("TOPIC")
                .questionCount(5)
                .difficulty("MEDIUM")
                .mock(true)
                .build();

        GeneratedQuizResponse response = quizGeneratorService.generateQuiz(request, null);

        assertNotNull(response);
        assertTrue(response.isSuccess());
        assertEquals(5, response.getQuestions().size());
        assertEquals("Python Programming", response.getSubject());

        for (GeneratedQuestionDto q : response.getQuestions()) {
            assertNotNull(q.getText());
            assertFalse(q.getText().isBlank());
            assertEquals(4, q.getOptions().size(), "Each question must have exactly 4 options");
            assertTrue(List.of("A", "B", "C", "D").contains(q.getCorrectAnswer()), "Correct answer must be A, B, C, or D");
            assertNotNull(q.getExplanation(), "Explanation must be provided");
            assertEquals("MCQ", q.getQuestionType());
            assertEquals(1.0, q.getMarks());
        }
    }

    @Test
    @DisplayName("Notes Mode without notes text or file returns informative validation error")
    void testNotesModeRequiresNotes() {
        GenerateQuizRequest request = GenerateQuizRequest.builder()
                .subject("Database Systems")
                .mode("NOTES")
                .notesText(null)
                .build();

        GeneratedQuizResponse response = quizGeneratorService.generateQuiz(request, null);

        assertNotNull(response);
        assertFalse(response.isSuccess());
        assertEquals("NOTES_MISSING", response.getErrorCode());
        assertTrue(response.getError().contains("Study notes or document content is required"));
    }

    @Test
    @DisplayName("Live generation without OpenRouter key reports clean configuration error instead of crashing")
    void testMissingApiKeyHandling() {
        GenerateQuizRequest request = GenerateQuizRequest.builder()
                .subject("Operating Systems")
                .topic("Process Synchronization")
                .mode("TOPIC")
                .mock(false)
                .build();

        GeneratedQuizResponse response = quizGeneratorService.generateQuiz(request, null);

        assertNotNull(response);
        assertFalse(response.isSuccess());
        assertEquals("OPENROUTER_KEY_NOT_CONFIGURED", response.getErrorCode());
        assertTrue(response.getError().contains("OpenRouter API key is not configured"));
    }

    @Test
    @DisplayName("Regenerate single question produces valid MCQ structure")
    void testRegenerateSingleQuestion() {
        RegenerateQuestionRequest req = RegenerateQuestionRequest.builder()
                .subject("Database Management Systems")
                .topic("SQL Normalization")
                .difficulty("MEDIUM")
                .existingQuestionId("Q2")
                .mock(true)
                .build();

        GeneratedQuestionDto question = quizGeneratorService.regenerateQuestion(req);

        assertNotNull(question);
        assertEquals("Q2", question.getQuestionId());
        assertEquals(4, question.getOptions().size());
        assertTrue(List.of("A", "B", "C", "D").contains(question.getCorrectAnswer()));
        assertNotNull(question.getExplanation());
    }

    @Test
    @DisplayName("Save draft persists quiz with DRAFT status and allowedForPractice false")
    void testSaveDraft() {
        CreateQuestionPaperRequest request = new CreateQuestionPaperRequest();
        request.setSubject("Web Architecture");
        request.setSubjectCode("CS601");

        QuestionPaper mockSaved = QuestionPaper.builder()
                .paperId("DRAFT-CS601-ABC123")
                .subject("Web Architecture")
                .publicationStatus("DRAFT")
                .allowedForPractice(false)
                .paperCategory("QUIZ")
                .paperFormat("MCQ")
                .build();

        when(questionPaperService.createPaper(any(CreateQuestionPaperRequest.class))).thenReturn(mockSaved);

        QuestionPaper result = quizGeneratorService.saveDraft(request, "teacher@acadion.edu");

        assertNotNull(result);
        assertEquals("DRAFT", result.getPublicationStatus());
        assertFalse(result.getAllowedForPractice());
        assertEquals("QUIZ", result.getPaperCategory());
        assertEquals("MCQ", result.getPaperFormat());
        verify(questionPaperService, times(1)).createPaper(any(CreateQuestionPaperRequest.class));
    }

    @Test
    @DisplayName("Publish quiz persists quiz with PUBLISHED status and allowedForPractice true")
    void testPublishQuiz() {
        CreateQuestionPaperRequest request = new CreateQuestionPaperRequest();
        request.setSubject("Cloud Computing");
        request.setSubjectCode("CS702");

        QuestionPaper mockPublished = QuestionPaper.builder()
                .paperId("PUB-CS702-XYZ789")
                .subject("Cloud Computing")
                .publicationStatus("PUBLISHED")
                .allowedForPractice(true)
                .paperCategory("QUIZ")
                .paperFormat("MCQ")
                .build();

        when(questionPaperService.createPaper(any(CreateQuestionPaperRequest.class))).thenReturn(mockPublished);

        QuestionPaper result = quizGeneratorService.publishQuiz(null, request, "teacher@acadion.edu");

        assertNotNull(result);
        assertEquals("PUBLISHED", result.getPublicationStatus());
        assertTrue(result.getAllowedForPractice());
        assertEquals("QUIZ", result.getPaperCategory());
        assertEquals("MCQ", result.getPaperFormat());
        verify(questionPaperService, times(1)).createPaper(any(CreateQuestionPaperRequest.class));
    }

    @Test
    @DisplayName("Get teacher drafts returns only draft quizzes for the teacher")
    void testGetTeacherDrafts() {
        QuestionPaper draft1 = QuestionPaper.builder()
                .paperId("DRAFT-1")
                .publicationStatus("DRAFT")
                .createdBy("teacher@acadion.edu")
                .build();

        QuestionPaper pub1 = QuestionPaper.builder()
                .paperId("PUB-1")
                .publicationStatus("PUBLISHED")
                .createdBy("teacher@acadion.edu")
                .build();

        QuestionPaper draftOther = QuestionPaper.builder()
                .paperId("DRAFT-2")
                .publicationStatus("DRAFT")
                .createdBy("other@acadion.edu")
                .build();

        when(questionPaperRepository.findAll()).thenReturn(List.of(draft1, pub1, draftOther));

        List<QuestionPaper> drafts = quizGeneratorService.getTeacherDrafts("teacher@acadion.edu");

        assertEquals(1, drafts.size());
        assertEquals("DRAFT-1", drafts.get(0).getPaperId());
    }

    @Test
    @DisplayName("Regenerating question without OpenRouter key and mock=false throws IllegalStateException")
    void testRegenerateSingleQuestionWithoutKeyThrowsException() {
        RegenerateQuestionRequest req = RegenerateQuestionRequest.builder()
                .subject("Operating Systems")
                .topic("Deadlocks")
                .mock(false)
                .build();

        assertThrows(IllegalStateException.class, () -> quizGeneratorService.regenerateQuestion(req));
    }

    @Test
    @DisplayName("Publishing existing draft updates it instead of creating duplicate")
    void testPublishExistingDraftUpdatesExisting() {
        CreateQuestionPaperRequest request = new CreateQuestionPaperRequest();
        request.setPaperId("DRAFT-CS-1234");
        request.setSubject("Computer Networks");

        QuestionPaper existingDraft = QuestionPaper.builder()
                .paperId("DRAFT-CS-1234")
                .subject("Computer Networks")
                .publicationStatus("DRAFT")
                .createdBy("teacher@acadion.edu")
                .build();

        QuestionPaper updatedPaper = QuestionPaper.builder()
                .paperId("DRAFT-CS-1234")
                .subject("Computer Networks")
                .publicationStatus("PUBLISHED")
                .createdBy("teacher@acadion.edu")
                .build();

        when(questionPaperService.getPaper("DRAFT-CS-1234")).thenReturn(existingDraft);
        when(questionPaperService.updatePaper(eq("DRAFT-CS-1234"), any(CreateQuestionPaperRequest.class))).thenReturn(updatedPaper);

        QuestionPaper result = quizGeneratorService.publishQuiz("DRAFT-CS-1234", request, "teacher@acadion.edu");

        assertNotNull(result);
        assertEquals("PUBLISHED", result.getPublicationStatus());
        verify(questionPaperService, times(1)).updatePaper(eq("DRAFT-CS-1234"), any());
        verify(questionPaperService, never()).createPaper(any());
    }

    @Test
    @DisplayName("Publishing another teacher's quiz is rejected with 403 Forbidden")
    void testCannotPublishAnotherTeachersQuiz() {
        CreateQuestionPaperRequest request = new CreateQuestionPaperRequest();
        request.setPaperId("PUB-CS-1111");

        QuestionPaper otherTeacherPaper = QuestionPaper.builder()
                .paperId("PUB-CS-1111")
                .createdBy("other_teacher@acadion.edu")
                .build();

        when(questionPaperService.getPaper("PUB-CS-1111")).thenReturn(otherTeacherPaper);

        assertThrows(org.springframework.web.server.ResponseStatusException.class, () ->
                quizGeneratorService.publishQuiz("PUB-CS-1111", request, "intruder@acadion.edu")
        );
    }

    @Test
    @DisplayName("extractNotesText extracts valid text from document")
    void testExtractNotesTextSuccess() throws Exception {
        org.springframework.mock.web.MockMultipartFile file = new org.springframework.mock.web.MockMultipartFile(
                "file", "lecture_notes.pdf", "application/pdf", "Valid lecture content".getBytes()
        );
        when(textExtractionService.extractText(file)).thenReturn("Extracted lecture notes on Cloud Architecture.");

        String text = quizGeneratorService.extractNotesText(file);
        assertEquals("Extracted lecture notes on Cloud Architecture.", text);
    }

    @Test
    @DisplayName("extractNotesText throws IllegalArgumentException when file is empty")
    void testExtractNotesTextEmptyFile() {
        org.springframework.mock.web.MockMultipartFile file = new org.springframework.mock.web.MockMultipartFile(
                "file", "empty.pdf", "application/pdf", new byte[0]
        );
        assertThrows(IllegalArgumentException.class, () -> quizGeneratorService.extractNotesText(file));
    }

    @Test
    @DisplayName("extractNotesText throws IllegalArgumentException when extracted text is blank")
    void testExtractNotesTextBlankExtraction() throws Exception {
        org.springframework.mock.web.MockMultipartFile file = new org.springframework.mock.web.MockMultipartFile(
                "file", "blank.pdf", "application/pdf", "dummy".getBytes()
        );
        when(textExtractionService.extractText(file)).thenReturn("   ");

        assertThrows(IllegalArgumentException.class, () -> quizGeneratorService.extractNotesText(file));
    }

    @Test
    @DisplayName("Notes-Based quiz generation with uploaded PDF file extracts content and generates MCQs")
    void testNotesGenerationWithUploadedPdf() throws Exception {
        org.springframework.mock.web.MockMultipartFile pdfFile = new org.springframework.mock.web.MockMultipartFile(
                "file", "operating_systems.pdf", "application/pdf", "%PDF-1.4 sample content".getBytes()
        );

        when(textExtractionService.extractText(pdfFile))
                .thenReturn("Operating Systems handle process scheduling, virtual memory, and deadlocks through Coffman conditions.");

        GenerateQuizRequest request = GenerateQuizRequest.builder()
                .subject("Operating Systems")
                .mode("NOTES")
                .questionCount(3)
                .difficulty("MEDIUM")
                .mock(true)
                .build();

        GeneratedQuizResponse response = quizGeneratorService.generateQuiz(request, pdfFile);

        assertNotNull(response);
        assertTrue(response.isSuccess());
        assertEquals("Operating Systems", response.getSubject());
        assertEquals(3, response.getQuestions().size());

        for (GeneratedQuestionDto q : response.getQuestions()) {
            assertNotNull(q.getText());
            assertEquals(4, q.getOptions().size(), "Each generated question must have 4 options");
            assertTrue(List.of("A", "B", "C", "D").contains(q.getCorrectAnswer()), "Valid answer key A/B/C/D required");
            assertNotNull(q.getExplanation(), "Explanation must be present");
        }

        verify(textExtractionService, times(1)).extractText(pdfFile);
    }

    @Test
    @DisplayName("Notes-Based quiz generation with DOCX and TXT files extracts text correctly")
    void testNotesGenerationWithDocxAndTxt() throws Exception {
        org.springframework.mock.web.MockMultipartFile docxFile = new org.springframework.mock.web.MockMultipartFile(
                "file", "lecture_notes.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx binary".getBytes()
        );
        when(textExtractionService.extractText(docxFile)).thenReturn("Database Normalization: 1NF, 2NF, 3NF, BCNF.");

        GenerateQuizRequest docxReq = GenerateQuizRequest.builder()
                .subject("Database Systems")
                .mode("NOTES")
                .questionCount(2)
                .mock(true)
                .build();

        GeneratedQuizResponse docxRes = quizGeneratorService.generateQuiz(docxReq, docxFile);
        assertTrue(docxRes.isSuccess());
        assertEquals(2, docxRes.getQuestions().size());

        org.springframework.mock.web.MockMultipartFile txtFile = new org.springframework.mock.web.MockMultipartFile(
                "file", "notes.txt", "text/plain", "Data Structures: Arrays, Linked Lists, Stacks.".getBytes()
        );
        when(textExtractionService.extractText(txtFile)).thenReturn("Data Structures: Arrays, Linked Lists, Stacks.");

        GenerateQuizRequest txtReq = GenerateQuizRequest.builder()
                .subject("Data Structures")
                .mode("NOTES")
                .questionCount(2)
                .mock(true)
                .build();

        GeneratedQuizResponse txtRes = quizGeneratorService.generateQuiz(txtReq, txtFile);
        assertTrue(txtRes.isSuccess());
        assertEquals(2, txtRes.getQuestions().size());
    }

    @Test
    @DisplayName("Notes-Based generation with unreadable document returns informative sanitized failure")
    void testNotesGenerationUnreadableDocument() throws Exception {
        org.springframework.mock.web.MockMultipartFile corruptedFile = new org.springframework.mock.web.MockMultipartFile(
                "file", "corrupt.pdf", "application/pdf", "bad bytes".getBytes()
        );
        when(textExtractionService.extractText(corruptedFile))
                .thenThrow(new IllegalArgumentException("Unsupported file type or unreadable document"));

        GenerateQuizRequest request = GenerateQuizRequest.builder()
                .subject("Computer Architecture")
                .mode("NOTES")
                .questionCount(3)
                .mock(true)
                .build();

        GeneratedQuizResponse response = quizGeneratorService.generateQuiz(request, corruptedFile);

        assertNotNull(response);
        assertFalse(response.isSuccess());
        assertEquals("DOCUMENT_EXTRACTION_FAILED", response.getErrorCode());
        assertTrue(response.getError().contains("Unsupported file type or unreadable document"));
    }
}
