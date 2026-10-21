package com.acadion.backend.service.quiz;

import com.acadion.backend.dto.quiz.GenerateQuizRequest;
import com.acadion.backend.dto.quiz.GeneratedQuestionDto;
import com.acadion.backend.dto.quiz.GeneratedQuizResponse;
import com.acadion.backend.repository.QuestionPaperRepository;
import com.acadion.backend.service.QuestionPaperService;
import com.acadion.backend.service.parser.TextExtractionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.File;
import java.nio.file.Files;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
public class LiveOpenRouterGenerationTest {

    @Mock
    private QuestionPaperRepository questionPaperRepository;

    @Mock
    private QuestionPaperService questionPaperService;

    @Mock
    private TextExtractionService textExtractionService;

    private String loadApiKey() {
        String key = System.getenv("OPENROUTER_API_KEY");
        if (key != null && !key.isBlank()) return key;

        // Fallback to local secure backend/.env
        File envFile = new File(".env");
        if (!envFile.exists()) {
            envFile = new File("backend/.env");
        }
        if (!envFile.exists()) {
            envFile = new File("educate/backend/.env");
        }
        if (envFile.exists()) {
            try {
                List<String> lines = Files.readAllLines(envFile.toPath());
                for (String line : lines) {
                    if (line.startsWith("OPENROUTER_API_KEY=")) {
                        return line.substring("OPENROUTER_API_KEY=".length()).trim();
                    }
                }
            } catch (Exception ignored) {
            }
        }
        return "";
    }

    @Test
    @DisplayName("Verify real OpenRouter generation produces valid academic MCQs")
    void testRealOpenRouterGeneration() {
        String apiKey = loadApiKey();
        assertFalse(apiKey.isBlank(), "OPENROUTER_API_KEY must be configured for live generation test");

        QuizGeneratorService service = new QuizGeneratorService(
                apiKey,
                "google/gemini-2.0-flash-001", // will test model resolution / fallback
                "https://openrouter.ai/api/v1/chat/completions",
                60,
                questionPaperRepository,
                questionPaperService,
                textExtractionService,
                new ObjectMapper()
        );

        GenerateQuizRequest request = GenerateQuizRequest.builder()
                .subject("Computer Science")
                .topic("Data Structures & Algorithms")
                .mode("TOPIC")
                .questionCount(2)
                .difficulty("MEDIUM")
                .mock(false) // REAL OPENROUTER CALL
                .build();

        GeneratedQuizResponse response = service.generateQuiz(request, null);

        assertNotNull(response);
        assertTrue(response.isSuccess(), "Live generation should succeed. Error: " + response.getError());
        assertNotNull(response.getQuestions());
        assertEquals(2, response.getQuestions().size(), "Should generate exactly 2 questions");
        assertNotNull(response.getModelUsed());
        assertFalse(response.getModelUsed().contains("Mock"), "Model must be real OpenRouter model, not mock");

        for (GeneratedQuestionDto q : response.getQuestions()) {
            assertNotNull(q.getText());
            assertFalse(q.getText().isBlank());
            assertEquals(4, q.getOptions().size(), "Question must have exactly 4 choices");
            assertTrue(List.of("A", "B", "C", "D").contains(q.getCorrectAnswer()), "Answer key must be A, B, C, or D");
            assertNotNull(q.getExplanation(), "Explanation must be present");
            assertFalse(q.getExplanation().isBlank());
        }

        System.out.println("LIVE TEST PASSED! Provider model used: " + response.getModelUsed());
        System.out.println("Generated question 1: " + response.getQuestions().get(0).getText());
        System.out.println("Generated question 2: " + response.getQuestions().get(1).getText());
    }
}
