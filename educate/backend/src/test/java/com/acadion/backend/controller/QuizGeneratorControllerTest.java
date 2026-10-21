package com.acadion.backend.controller;

import com.acadion.backend.dto.CreateQuestionPaperRequest;
import com.acadion.backend.dto.quiz.GenerateQuizRequest;
import com.acadion.backend.dto.quiz.GeneratedQuestionDto;
import com.acadion.backend.dto.quiz.GeneratedQuizResponse;
import com.acadion.backend.entity.QuestionPaper;
import com.acadion.backend.service.quiz.QuizGeneratorService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
public class QuizGeneratorControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private QuizGeneratorService quizGeneratorService;

    @Test
    @DisplayName("POST /api/quiz-generator/generate returns generated quiz response")
    void testGenerateQuizEndpoint() throws Exception {
        GenerateQuizRequest request = GenerateQuizRequest.builder()
                .subject("Operating Systems")
                .topic("Deadlocks & Semaphore")
                .mode("TOPIC")
                .questionCount(5)
                .mock(true)
                .build();

        GeneratedQuizResponse response = GeneratedQuizResponse.builder()
                .success(true)
                .message("Generated 5 questions")
                .subject("Operating Systems")
                .questions(List.of(
                        GeneratedQuestionDto.builder()
                                .questionId("Q1")
                                .text("What is a condition for deadlock?")
                                .options(List.of("Mutual Exclusion", "Arbitrary Scheduling", "Preemption", "Single Threading"))
                                .correctAnswer("A")
                                .explanation("Mutual exclusion is one of Coffman's four conditions for deadlock.")
                                .marks(1.0)
                                .build()
                ))
                .build();

        when(quizGeneratorService.generateQuiz(any(GenerateQuizRequest.class), any())).thenReturn(response);

        mockMvc.perform(post("/api/quiz-generator/generate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.subject").value("Operating Systems"))
                .andExpect(jsonPath("$.questions[0].correctAnswer").value("A"));
    }

    @Test
    @DisplayName("POST /api/quiz-generator/draft saves quiz draft")
    void testSaveDraftEndpoint() throws Exception {
        CreateQuestionPaperRequest request = new CreateQuestionPaperRequest();
        request.setSubject("Database Systems");

        QuestionPaper saved = QuestionPaper.builder()
                .paperId("DRAFT-DBMS-123456")
                .subject("Database Systems")
                .publicationStatus("DRAFT")
                .build();

        when(quizGeneratorService.saveDraft(any(CreateQuestionPaperRequest.class), any())).thenReturn(saved);

        mockMvc.perform(post("/api/quiz-generator/draft")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.paper.publicationStatus").value("DRAFT"));
    }

    @Test
    @DisplayName("POST /api/quiz-generator/publish publishes approved quiz")
    void testPublishQuizEndpoint() throws Exception {
        CreateQuestionPaperRequest request = new CreateQuestionPaperRequest();
        request.setSubject("Computer Networks");

        QuestionPaper published = QuestionPaper.builder()
                .paperId("PUB-CN-123456")
                .subject("Computer Networks")
                .publicationStatus("PUBLISHED")
                .allowedForPractice(true)
                .build();

        when(quizGeneratorService.publishQuiz(any(), any(CreateQuestionPaperRequest.class), any())).thenReturn(published);

        mockMvc.perform(post("/api/quiz-generator/publish")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.paper.publicationStatus").value("PUBLISHED"));
    }

    @Test
    @DisplayName("GET /api/quiz-generator/drafts lists teacher drafts")
    void testGetDraftsEndpoint() throws Exception {
        QuestionPaper draft = QuestionPaper.builder()
                .paperId("DRAFT-1")
                .subject("Algorithms")
                .publicationStatus("DRAFT")
                .build();

        when(quizGeneratorService.getTeacherDrafts(any())).thenReturn(List.of(draft));

        mockMvc.perform(get("/api/quiz-generator/drafts?teacherEmail=teacher@acadion.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].paperId").value("DRAFT-1"))
                .andExpect(jsonPath("$[0].subject").value("Algorithms"));
    }

    @Test
    @DisplayName("POST /api/quiz-generator/generate with Multipart file succeeds without 415 error")
    void testGenerateQuizMultipartEndpoint() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "lecture_notes.pdf",
                "application/pdf",
                "%PDF-1.4 sample content".getBytes()
        );

        GeneratedQuizResponse response = GeneratedQuizResponse.builder()
                .success(true)
                .message("Generated 5 questions from notes")
                .subject("Operating Systems")
                .questions(List.of(
                        GeneratedQuestionDto.builder()
                                .questionId("Q1")
                                .text("What is a semaphore?")
                                .options(List.of("Synchronization tool", "Memory unit", "CPU register", "File format"))
                                .correctAnswer("A")
                                .marks(1.0)
                                .build()
                ))
                .build();

        when(quizGeneratorService.generateQuiz(any(GenerateQuizRequest.class), any())).thenReturn(response);

        mockMvc.perform(multipart("/api/quiz-generator/generate")
                        .file(file)
                        .param("subject", "Operating Systems")
                        .param("topic", "Synchronization")
                        .param("mode", "NOTES")
                        .param("questionCount", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.subject").value("Operating Systems"))
                .andExpect(jsonPath("$.questions[0].correctAnswer").value("A"));
    }

    @Test
    @DisplayName("POST /api/quiz-generator/extract-notes extracts text from document without 415 error")
    void testExtractNotesEndpoint() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "notes.txt",
                "text/plain",
                "Operating systems manage hardware resources.".getBytes()
        );

        when(quizGeneratorService.extractNotesText(any())).thenReturn("Operating systems manage hardware resources.");

        mockMvc.perform(multipart("/api/quiz-generator/extract-notes")
                        .file(file))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.text").value("Operating systems manage hardware resources."));
    }
}
