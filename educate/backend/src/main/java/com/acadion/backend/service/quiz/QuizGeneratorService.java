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
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
public class QuizGeneratorService {

    private final String openrouterKey;
    private final String openrouterModel;
    private final String openrouterUrl;
    private final int timeoutSeconds;

    private final QuestionPaperRepository questionPaperRepository;
    private final QuestionPaperService questionPaperService;
    private final TextExtractionService textExtractionService;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public QuizGeneratorService(
            @Value("${ai.openrouter.key:${OPENROUTER_API_KEY:}}") String openrouterKey,
            @Value("${ai.openrouter.model:${OPENROUTER_MODEL:openrouter/free}}") String openrouterModel,
            @Value("${ai.openrouter.url:https://openrouter.ai/api/v1/chat/completions}") String openrouterUrl,
            @Value("${ai.openrouter.timeout:60}") int timeoutSeconds,
            QuestionPaperRepository questionPaperRepository,
            QuestionPaperService questionPaperService,
            TextExtractionService textExtractionService,
            ObjectMapper objectMapper
    ) {
        this.openrouterKey = openrouterKey != null ? openrouterKey.trim() : "";
        this.openrouterModel = (openrouterModel != null && !openrouterModel.isBlank()) ? openrouterModel.trim() : "openrouter/free";
        this.openrouterUrl = openrouterUrl;
        this.timeoutSeconds = timeoutSeconds > 0 ? timeoutSeconds : 60;
        this.questionPaperRepository = questionPaperRepository;
        this.questionPaperService = questionPaperService;
        this.textExtractionService = textExtractionService;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .build();
    }

    public boolean isOpenRouterConfigured() {
        return openrouterKey != null && !openrouterKey.isBlank();
    }

    /**
     * Extract text from uploaded document (PDF, DOCX, TXT)
     */
    public String extractNotesText(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("No file was uploaded or the file is empty.");
        }
        if (file.getSize() > 15 * 1024 * 1024) {
            throw new IllegalArgumentException("File size exceeds 15MB limit. Please upload a smaller document.");
        }
        try {
            String extracted = textExtractionService.extractText(file);
            if (extracted == null || extracted.trim().isEmpty()) {
                throw new IllegalArgumentException("Could not extract any readable text from the uploaded document.");
            }
            return extracted.trim();
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to extract notes text: {}", e.getMessage());
            throw new RuntimeException("Failed to process document: " + e.getMessage(), e);
        }
    }

    /**
     * Main quiz generation entry point supporting TOPIC, NOTES, and TOPIC_NOTES modes.
     */
    public GeneratedQuizResponse generateQuiz(GenerateQuizRequest request, MultipartFile file) {
        if (request == null) {
            request = new GenerateQuizRequest();
        }

        // Clamp question count
        int qCount = request.getQuestionCount() != null ? Math.max(1, Math.min(30, request.getQuestionCount())) : 10;
        request.setQuestionCount(qCount);

        String mode = request.getMode() != null ? request.getMode().toUpperCase().trim() : "TOPIC";
        request.setMode(mode);

        String subject = request.getSubject() != null && !request.getSubject().isBlank()
                ? request.getSubject().trim()
                : (request.getTopic() != null ? request.getTopic().trim() : "General Knowledge");
        request.setSubject(subject);

        String difficulty = request.getDifficulty() != null ? request.getDifficulty().toUpperCase() : "MEDIUM";
        request.setDifficulty(difficulty);

        // Handle uploaded file if provided in NOTES or TOPIC_NOTES mode
        if (file != null && !file.isEmpty()) {
            try {
                String fileText = extractNotesText(file);
                if (request.getNotesText() != null && !request.getNotesText().isBlank()) {
                    if (!request.getNotesText().contains(fileText.trim())) {
                        request.setNotesText(fileText + "\n\n" + request.getNotesText());
                    }
                } else {
                    request.setNotesText(fileText);
                }
            } catch (Exception e) {
                log.warn("Failed to extract notes text from document: {}", e.getMessage());
                return GeneratedQuizResponse.builder()
                        .success(false)
                        .errorCode("DOCUMENT_EXTRACTION_FAILED")
                        .error("Failed to process document: " + e.getMessage())
                        .build();
            }
        }

        // Validate notes mode inputs
        if ("NOTES".equals(mode) || "TOPIC_NOTES".equals(mode)) {
            if (request.getNotesText() == null || request.getNotesText().isBlank()) {
                return GeneratedQuizResponse.builder()
                        .success(false)
                        .errorCode("NOTES_MISSING")
                        .error("Study notes or document content is required for Notes-based quiz generation.")
                        .build();
            }
        }

        // Check if mock mode is requested or if key is missing
        boolean isMock = Boolean.TRUE.equals(request.getMock());
        if (isMock) {
            log.info("Generating mock academic quiz for topic='{}', mode='{}', count={}", request.getTopic(), mode, qCount);
            return generateMockQuiz(request);
        }

        if (!isOpenRouterConfigured()) {
            log.warn("OpenRouter API key is not configured in backend environment.");
            return GeneratedQuizResponse.builder()
                    .success(false)
                    .errorCode("OPENROUTER_KEY_NOT_CONFIGURED")
                    .error("OpenRouter API key is not configured on the server. Please set the OPENROUTER_API_KEY environment variable or ai.openrouter.key in application.properties to enable live AI generation. You can also enable 'Mock Test Mode' to preview and verify the complete workflow.")
                    .build();
        }

        // Generate questions using OpenRouter
        try {
            return callOpenRouter(request);
        } catch (Exception e) {
            log.error("OpenRouter generation error: {}", e.getMessage(), e);
            return GeneratedQuizResponse.builder()
                    .success(false)
                    .errorCode("AI_GENERATION_FAILED")
                    .error("AI quiz generation failed: " + sanitizeErrorMessage(e.getMessage()))
                    .build();
        }
    }

    /**
     * Call OpenRouter API with bounded retry and robust JSON parsing.
     */
    private GeneratedQuizResponse callOpenRouter(GenerateQuizRequest request) throws Exception {
        String prompt = buildPrompt(request);

        Map<String, Object> bodyMap = new HashMap<>();
        String effectiveModel = openrouterModel != null && !openrouterModel.isBlank() ? openrouterModel : "google/gemini-2.5-flash-lite";
        bodyMap.put("model", effectiveModel);
        bodyMap.put("messages", List.of(
                Map.of(
                        "role", "system",
                        "content", "You are an expert university professor and exam controller. Your task is to generate rigorous, curriculum-aligned multiple-choice questions (MCQs) for academic assessments. Always return pure, valid JSON with no markdown wrapping."
                ),
                Map.of(
                        "role", "user",
                        "content", prompt
                )
        ));
        int targetTokens = Math.max(1200, Math.min(4000, (request.getQuestionCount() != null ? request.getQuestionCount() : 5) * 400));
        bodyMap.put("max_tokens", targetTokens);
        bodyMap.put("temperature", 0.3);

        String jsonBody = objectMapper.writeValueAsString(bodyMap);

        HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(openrouterUrl))
                .header("Authorization", "Bearer " + openrouterKey)
                .header("Content-Type", "application/json")
                .header("HTTP-Referer", "http://localhost:8080")
                .header("X-Title", "Acadion Quiz Generator")
                .timeout(Duration.ofSeconds(timeoutSeconds))
                .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                .build();

        log.info("Sending quiz generation request to OpenRouter (model: {}, questions: {})...", effectiveModel, request.getQuestionCount());

        HttpResponse<String> response = sendWithBoundedRetry(httpRequest);

        // If configured model is deprecated/unavailable on OpenRouter (404), fallback to active model
        if (response.statusCode() == 404 && !"google/gemini-2.5-flash-lite".equals(effectiveModel)) {
            log.warn("Model '{}' not found on OpenRouter (404). Attempting fallback to 'google/gemini-2.5-flash-lite'...", effectiveModel);
            effectiveModel = "google/gemini-2.5-flash-lite";
            bodyMap.put("model", effectiveModel);
            jsonBody = objectMapper.writeValueAsString(bodyMap);
            httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(openrouterUrl))
                    .header("Authorization", "Bearer " + openrouterKey)
                    .header("Content-Type", "application/json")
                    .header("HTTP-Referer", "http://localhost:8080")
                    .header("X-Title", "Acadion Quiz Generator")
                    .timeout(Duration.ofSeconds(timeoutSeconds))
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                    .build();
            response = sendWithBoundedRetry(httpRequest);
        }

        if (response.statusCode() == 401) {
            return GeneratedQuizResponse.builder()
                    .success(false)
                    .errorCode("OPENROUTER_AUTH_FAILED")
                    .error("OpenRouter authentication failed. Please verify that your OPENROUTER_API_KEY is valid.")
                    .build();
        }

        if (response.statusCode() == 402) {
            return GeneratedQuizResponse.builder()
                    .success(false)
                    .errorCode("OPENROUTER_INSUFFICIENT_CREDITS")
                    .error("OpenRouter credit quota exceeded for this model. Please check credits at https://openrouter.ai/settings/credits.")
                    .build();
        }

        if (response.statusCode() == 429) {
            return GeneratedQuizResponse.builder()
                    .success(false)
                    .errorCode("OPENROUTER_RATE_LIMITED")
                    .error("OpenRouter rate limit or credit quota exceeded. Please check your OpenRouter credits or try again in a few moments.")
                    .build();
        }

        if (response.statusCode() != 200) {
            log.error("OpenRouter returned error status {}: {}", response.statusCode(), response.body());
            return GeneratedQuizResponse.builder()
                    .success(false)
                    .errorCode("OPENROUTER_HTTP_ERROR")
                    .error("OpenRouter provider returned status " + response.statusCode() + ". Please try again.")
                    .build();
        }

        // Parse LLM response
        JsonNode root = objectMapper.readTree(response.body());
        JsonNode choices = root.path("choices");
        if (!choices.isArray() || choices.isEmpty()) {
            throw new RuntimeException("OpenRouter returned an empty choices array.");
        }

        String rawContent = choices.get(0).path("message").path("content").asText("");
        if (rawContent.isBlank()) {
            throw new RuntimeException("Model returned an empty content message.");
        }

        return parseAndValidateModelOutput(rawContent, request, effectiveModel);
    }

    /**
     * Bounded retry for transient HTTP errors (e.g. 503, 429).
     */
    private HttpResponse<String> sendWithBoundedRetry(HttpRequest request) throws Exception {
        int maxAttempts = 2;
        HttpResponse<String> response = null;
        for (int i = 0; i < maxAttempts; i++) {
            try {
                response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() != 429 && response.statusCode() < 500) {
                    return response;
                }
                log.warn("Attempt {} got status {}. Waiting before retry...", i + 1, response.statusCode());
                Thread.sleep(1500);
            } catch (Exception e) {
                if (i == maxAttempts - 1) throw e;
                Thread.sleep(1000);
            }
        }
        return response;
    }

    /**
     * Build the structured prompt for OpenRouter.
     */
    private String buildPrompt(GenerateQuizRequest request) {
        StringBuilder sb = new StringBuilder();
        sb.append("Generate an academic MCQ quiz with exactly ").append(request.getQuestionCount()).append(" questions.\n");
        sb.append("Subject/Title: ").append(request.getSubject()).append("\n");

        if (request.getTopic() != null && !request.getTopic().isBlank()) {
            sb.append("Focus Topic: ").append(request.getTopic()).append("\n");
        }
        sb.append("Difficulty Level: ").append(request.getDifficulty()).append("\n");
        sb.append("Target Academic Level: University/College Semester Assessment\n\n");

        if ("NOTES".equals(request.getMode()) || "TOPIC_NOTES".equals(request.getMode())) {
            sb.append("STUDY NOTES & REFERENCE CONTENT:\n");
            sb.append("\"\"\"\n");
            // Bound notes length to 12,000 characters to stay within token context
            String notes = request.getNotesText();
            if (notes.length() > 12000) {
                notes = notes.substring(0, 12000) + "... [truncated for context limit]";
            }
            sb.append(notes).append("\n");
            sb.append("\"\"\"\n\n");
            sb.append("GROUNDING CONSTRAINT: Every question MUST be directly answerable from the study notes provided above. Do not hallucinate external facts.\n\n");
        }

        sb.append("""
                CRITICAL REQUIREMENTS:
                1. Each question must have EXACTLY 4 distinct answer choices labeled as options array: ["Option text 1", "Option text 2", "Option text 3", "Option text 4"].
                   DO NOT prefix option text with 'A)', 'B)', etc.
                2. Specify the correct answer using EXACTLY one letter: "A", "B", "C", or "D" (where A=index 0, B=index 1, C=index 2, D=index 3).
                3. Provide a clear, educational "explanation" for why the correct option is right.
                4. Distractors must be plausible, distinct, and error-free. Avoid "All of the above" or "None of the above".
                5. Output pure JSON matching this exact structure:
                {
                  "subject": "%s",
                  "topic": "%s",
                  "questions": [
                    {
                      "questionId": "Q1",
                      "text": "Question text here?",
                      "options": [
                        "First option text",
                        "Second option text",
                        "Third option text",
                        "Fourth option text"
                      ],
                      "correctAnswer": "A",
                      "explanation": "Detailed explanation of why A is correct and why other options are incorrect.",
                      "marks": 1.0,
                      "topic": "Subtopic name"
                    }
                  ]
                }
                Do not include markdown code block syntax. Return only raw JSON.
                """.formatted(request.getSubject(), request.getTopic() != null ? request.getTopic() : request.getSubject()));

        return sb.toString();
    }

    /**
     * Parse and validate model JSON output, performing bounded repair where needed.
     */
    private GeneratedQuizResponse parseAndValidateModelOutput(String rawText, GenerateQuizRequest request, String model) {
        String cleanJson = extractJsonSubstring(rawText);
        List<String> warnings = new ArrayList<>();
        List<GeneratedQuestionDto> validatedQuestions = new ArrayList<>();

        try {
            JsonNode root = objectMapper.readTree(cleanJson);
            JsonNode qArray = root.path("questions");
            if (!qArray.isArray() || qArray.isEmpty()) {
                throw new RuntimeException("JSON response did not contain a valid 'questions' array.");
            }

            int idx = 1;
            Set<String> seenQuestions = new HashSet<>();

            for (JsonNode qNode : qArray) {
                String qText = qNode.path("text").asText("").trim();
                if (qText.isBlank()) {
                    continue;
                }

                // Check duplicate question text
                String normalizedText = qText.toLowerCase().replaceAll("[^a-z0-9]", "");
                if (seenQuestions.contains(normalizedText)) {
                    warnings.add("Duplicate question detected and omitted: " + qText);
                    continue;
                }
                seenQuestions.add(normalizedText);

                // Extract options
                JsonNode optsNode = qNode.path("options");
                List<String> options = new ArrayList<>();
                if (optsNode.isArray()) {
                    for (JsonNode opt : optsNode) {
                        String optStr = opt.asText("").trim().replaceFirst("^[A-Da-d][\\)\\.\\s]+\\s*", "");
                        if (!optStr.isBlank()) {
                            options.add(optStr);
                        }
                    }
                }

                // Bounded repair: ensure exactly 4 options
                if (options.size() < 4) {
                    warnings.add("Question Q" + idx + " had only " + options.size() + " options. Added default distractor.");
                    while (options.size() < 4) {
                        options.add("Alternative choice " + (char) ('A' + options.size()));
                    }
                } else if (options.size() > 4) {
                    options = new ArrayList<>(options.subList(0, 4));
                }

                // Validate correct answer
                String rawAns = qNode.path("correctAnswer").asText("A").trim().toUpperCase();
                String correctAnswer = "A";
                if (rawAns.matches("^[A-D]$")) {
                    correctAnswer = rawAns;
                } else {
                    // Try to match option text
                    int matchIdx = -1;
                    for (int o = 0; o < options.size(); o++) {
                        if (options.get(o).equalsIgnoreCase(rawAns) || options.get(o).toLowerCase().startsWith(rawAns.toLowerCase())) {
                            matchIdx = o;
                            break;
                        }
                    }
                    if (matchIdx >= 0) {
                        correctAnswer = String.valueOf((char) ('A' + matchIdx));
                    } else if (rawAns.contains("B")) {
                        correctAnswer = "B";
                    } else if (rawAns.contains("C")) {
                        correctAnswer = "C";
                    } else if (rawAns.contains("D")) {
                        correctAnswer = "D";
                    }
                }

                String explanation = qNode.path("explanation").asText("").trim();
                if (explanation.isBlank()) {
                    explanation = "The correct answer is Option " + correctAnswer + ".";
                }

                String topic = qNode.path("topic").asText("").trim();
                if (topic.isBlank()) {
                    topic = request.getTopic() != null ? request.getTopic() : request.getSubject();
                }

                double marks = qNode.path("marks").asDouble(request.getMarksPerQuestion() != null ? request.getMarksPerQuestion() : 1.0);

                validatedQuestions.add(GeneratedQuestionDto.builder()
                        .questionId("Q" + idx)
                        .text(qText)
                        .options(options)
                        .correctAnswer(correctAnswer)
                        .explanation(explanation)
                        .marks(marks)
                        .topic(topic)
                        .questionType("MCQ")
                        .build());

                idx++;
            }

            if (validatedQuestions.isEmpty()) {
                throw new RuntimeException("No valid questions could be extracted from the model output.");
            }

            double totalMarks = validatedQuestions.stream().mapToDouble(GeneratedQuestionDto::getMarks).sum();

            return GeneratedQuizResponse.builder()
                    .success(true)
                    .message("Successfully generated " + validatedQuestions.size() + " academic MCQs.")
                    .subject(request.getSubject())
                    .topic(request.getTopic())
                    .mode(request.getMode())
                    .difficulty(request.getDifficulty())
                    .questions(validatedQuestions)
                    .totalMarks(totalMarks)
                    .modelUsed(model)
                    .warnings(warnings)
                    .build();

        } catch (Exception e) {
            log.error("Failed to parse model JSON: {}. Raw: {}", e.getMessage(), rawText);
            throw new RuntimeException("Model returned malformed JSON: " + e.getMessage(), e);
        }
    }

    /**
     * Clean and extract JSON substring from raw model output.
     */
    private String extractJsonSubstring(String text) {
        if (text == null) return "{}";
        String trimmed = text.trim();

        // Strip markdown code fences if present
        if (trimmed.startsWith("```json")) {
            trimmed = trimmed.substring(7);
        } else if (trimmed.startsWith("```")) {
            trimmed = trimmed.substring(3);
        }
        if (trimmed.endsWith("```")) {
            trimmed = trimmed.substring(0, trimmed.length() - 3);
        }
        trimmed = trimmed.trim();

        int start = trimmed.indexOf('{');
        int end = trimmed.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return trimmed.substring(start, end + 1);
        }
        return trimmed;
    }

    /**
     * Regenerate an individual question.
     */
    public GeneratedQuestionDto regenerateQuestion(RegenerateQuestionRequest req) {
        if (req == null) {
            req = new RegenerateQuestionRequest();
        }
        String topic = req.getTopic() != null && !req.getTopic().isBlank() ? req.getTopic().trim() : "Computer Science";
        String diff = req.getDifficulty() != null ? req.getDifficulty() : "MEDIUM";
        String qId = req.getExistingQuestionId() != null ? req.getExistingQuestionId() : "Q1";

        if (!isOpenRouterConfigured()) {
            if (Boolean.TRUE.equals(req.getMock())) {
                return generateMockSingleQuestion(qId, topic, diff);
            }
            throw new IllegalStateException("OpenRouter API key is not configured on the server. Set OPENROUTER_API_KEY or enable Mock Test Mode.");
        }

        try {
            String prompt = """
                    Generate ONE new, distinct academic multiple choice question for topic '%s' (difficulty: %s).
                    Avoid repeating the following existing question: "%s".
                    Output ONLY a JSON object:
                    {
                      "questionId": "%s",
                      "text": "Question prompt?",
                      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
                      "correctAnswer": "A",
                      "explanation": "Why correct option is right.",
                      "marks": 1.0,
                      "topic": "%s"
                    }
                    No markdown formatting.
                    """.formatted(topic, diff, req.getExistingQuestionText() != null ? req.getExistingQuestionText() : "", qId, topic);

            Map<String, Object> bodyMap = Map.of(
                    "model", openrouterModel,
                    "messages", List.of(Map.of("role", "user", "content", prompt)),
                    "temperature", 0.7
            );

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(openrouterUrl))
                    .header("Authorization", "Bearer " + openrouterKey)
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(timeoutSeconds))
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(bodyMap)))
                    .build();

            HttpResponse<String> resp = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() == 200) {
                JsonNode root = objectMapper.readTree(resp.body());
                String content = root.path("choices").get(0).path("message").path("content").asText("");
                String clean = extractJsonSubstring(content);
                JsonNode qNode = objectMapper.readTree(clean);
                List<String> options = new ArrayList<>();
                for (JsonNode o : qNode.path("options")) {
                    options.add(o.asText().trim().replaceFirst("^[A-Da-d][\\)\\.\\s]+\\s*", ""));
                }
                while (options.size() < 4) {
                    options.add("Choice " + (char) ('A' + options.size()));
                }
                return GeneratedQuestionDto.builder()
                        .questionId(qId)
                        .text(qNode.path("text").asText("Regenerated question prompt"))
                        .options(options.subList(0, 4))
                        .correctAnswer(qNode.path("correctAnswer").asText("A").trim().toUpperCase())
                        .explanation(qNode.path("explanation").asText("Explanatory rationale."))
                        .marks(1.0)
                        .topic(topic)
                        .questionType("MCQ")
                        .build();
            } else {
                throw new RuntimeException("OpenRouter returned HTTP " + resp.statusCode() + ": " + sanitizeErrorMessage(resp.body()));
            }
        } catch (Exception e) {
            log.error("Failed to regenerate single question via OpenRouter: {}", e.getMessage());
            if (Boolean.TRUE.equals(req.getMock())) {
                return generateMockSingleQuestion(qId, topic, diff);
            }
            throw new RuntimeException("Question regeneration failed: " + sanitizeErrorMessage(e.getMessage()));
        }
    }

    /**
     * Save reviewed quiz as a Draft in question_papers collection.
     */
    public QuestionPaper saveDraft(CreateQuestionPaperRequest request, String teacherEmail) {
        if (request == null) {
            throw new IllegalArgumentException("Draft request payload cannot be empty.");
        }
        request.setPublicationStatus("DRAFT");
        request.setPaperCategory("QUIZ");
        request.setPaperFormat("MCQ");
        request.setAllowedForPractice(false);
        if (teacherEmail != null && !teacherEmail.isBlank()) {
            request.setCreatedBy(teacherEmail);
        }

        // If draft exists, check ownership and update it
        if (request.getPaperId() != null && !request.getPaperId().isBlank()) {
            try {
                QuestionPaper existing = questionPaperService.getPaper(request.getPaperId());
                if (existing != null) {
                    if (existing.getCreatedBy() != null && teacherEmail != null
                            && !existing.getCreatedBy().equalsIgnoreCase(teacherEmail)
                            && !"admin@acadion.com".equalsIgnoreCase(teacherEmail)) {
                        throw new org.springframework.web.server.ResponseStatusException(
                                org.springframework.http.HttpStatus.FORBIDDEN,
                                "You cannot modify another teacher's quiz draft."
                        );
                    }
                    return questionPaperService.updatePaper(request.getPaperId(), request);
                }
            } catch (org.springframework.web.server.ResponseStatusException rse) {
                throw rse;
            } catch (Exception ignored) {
                // proceed to create if not found
            }
        }

        if (request.getPaperId() == null || request.getPaperId().isBlank()) {
            String cleanCode = (request.getSubjectCode() != null && !request.getSubjectCode().isBlank())
                    ? request.getSubjectCode().toUpperCase().replaceAll("[^A-Z0-9]", "")
                    : "QUIZ";
            String uniqueSuffix = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
            request.setPaperId("DRAFT-" + cleanCode + "-" + uniqueSuffix);
        }

        return questionPaperService.createPaper(request);
    }

    /**
     * Publish approved quiz so it is visible in Uploaded Papers Analysis and accessible to students.
     */
    public QuestionPaper publishQuiz(String paperId, CreateQuestionPaperRequest request, String teacherEmail) {
        if (request == null) {
            throw new IllegalArgumentException("Publish request payload cannot be empty.");
        }

        request.setPublicationStatus("PUBLISHED");
        request.setPaperCategory("QUIZ");
        request.setPaperFormat("MCQ");
        request.setAllowedForPractice(true);
        if (teacherEmail != null && !teacherEmail.isBlank()) {
            request.setCreatedBy(teacherEmail);
        }

        String targetPaperId = (paperId != null && !paperId.isBlank()) ? paperId : request.getPaperId();
        if (targetPaperId != null && !targetPaperId.isBlank()) {
            try {
                QuestionPaper existing = questionPaperService.getPaper(targetPaperId);
                if (existing != null) {
                    if (existing.getCreatedBy() != null && teacherEmail != null
                            && !existing.getCreatedBy().equalsIgnoreCase(teacherEmail)
                            && !"admin@acadion.com".equalsIgnoreCase(teacherEmail)) {
                        throw new org.springframework.web.server.ResponseStatusException(
                                org.springframework.http.HttpStatus.FORBIDDEN,
                                "You cannot publish another teacher's quiz."
                        );
                    }
                    request.setPaperId(existing.getPaperId());
                    return questionPaperService.updatePaper(targetPaperId, request);
                }
            } catch (org.springframework.web.server.ResponseStatusException rse) {
                throw rse;
            } catch (Exception ignored) {
                // proceed to create
            }
        }

        if (request.getPaperId() == null || request.getPaperId().isBlank() || request.getPaperId().startsWith("DRAFT-")) {
            String cleanCode = (request.getSubjectCode() != null && !request.getSubjectCode().isBlank())
                    ? request.getSubjectCode().toUpperCase().replaceAll("[^A-Z0-9]", "")
                    : "QUIZ";
            String uniqueSuffix = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
            request.setPaperId("PUB-" + cleanCode + "-" + uniqueSuffix);
        }

        return questionPaperService.createPaper(request);
    }

    /**
     * Retrieve all drafts created by a teacher.
     */
    public List<QuestionPaper> getTeacherDrafts(String teacherEmail) {
        List<QuestionPaper> all = questionPaperRepository.findAll();
        return all.stream()
                .filter(p -> "DRAFT".equalsIgnoreCase(p.getPublicationStatus()))
                .filter(p -> teacherEmail != null && !teacherEmail.isBlank() && teacherEmail.equalsIgnoreCase(p.getCreatedBy()))
                .sorted((a, b) -> {
                    LocalDateTime ta = a.getUploadedAt() != null ? a.getUploadedAt() : LocalDateTime.MIN;
                    LocalDateTime tb = b.getUploadedAt() != null ? b.getUploadedAt() : LocalDateTime.MIN;
                    return tb.compareTo(ta);
                })
                .toList();
    }

    // =========================================================================
    // MOCK GENERATOR FOR OFFLINE / TEST VERIFICATION
    // =========================================================================

    private GeneratedQuizResponse generateMockQuiz(GenerateQuizRequest req) {
        String topic = req.getTopic() != null && !req.getTopic().isBlank() ? req.getTopic() : req.getSubject();
        int count = req.getQuestionCount() != null ? req.getQuestionCount() : 5;
        List<GeneratedQuestionDto> list = new ArrayList<>();

        for (int i = 1; i <= count; i++) {
            list.add(generateMockSingleQuestion("Q" + i, topic, req.getDifficulty(), i));
        }

        double totalMarks = list.stream().mapToDouble(GeneratedQuestionDto::getMarks).sum();

        return GeneratedQuizResponse.builder()
                .success(true)
                .message("Generated " + list.size() + " academic questions in Mock Test Mode.")
                .subject(req.getSubject())
                .topic(topic)
                .mode(req.getMode())
                .difficulty(req.getDifficulty())
                .questions(list)
                .totalMarks(totalMarks)
                .modelUsed("acadion-academic-engine (Mock Mode)")
                .warnings(List.of("Mock Mode is active: Questions generated via Acadion Academic Curriculum Template Engine."))
                .build();
    }

    private GeneratedQuestionDto generateMockSingleQuestion(String qId, String topic, String diff) {
        return generateMockSingleQuestion(qId, topic, diff, 1);
    }

    private GeneratedQuestionDto generateMockSingleQuestion(String qId, String topic, String diff, int seed) {
        String lower = topic.toLowerCase();

        if (lower.contains("python")) {
            String[][] pythonBank = {
                    {"What is the time complexity of searching for a key in a Python dictionary on average?", "O(1)", "O(n)", "O(log n)", "O(n^2)", "A", "Python dictionaries are implemented using hash tables, which offer O(1) average-time complexity for key lookups."},
                    {"Which built-in function returns an immutable sequence of numbers frequently used in loops?", "range()", "enumerate()", "list()", "iter()", "A", "The range() function returns an immutable sequence of numbers from start to stop with step."},
                    {"What happens when a list is passed into a Python function as an argument and modified?", "The original list in the caller scope is modified", "A local copy is automatically created", "A TypeError is raised", "The modifications are silently discarded", "A", "In Python, lists are mutable objects passed by object reference, so mutations inside the function affect the caller's object."},
                    {"Which Python keyword is used to handle exceptions caught during runtime?", "except", "catch", "throw", "handle", "A", "Python uses try-except blocks for structured exception handling, unlike Java which uses catch."},
                    {"What is the output of bool([]) in Python?", "False", "True", "None", "Raises TypeError", "A", "Empty sequences such as lists, tuples, dictionaries, and empty strings evaluate to False in boolean context."}
            };
            int idx = (seed - 1) % pythonBank.length;
            String[] item = pythonBank[idx];
            return GeneratedQuestionDto.builder()
                    .questionId(qId)
                    .text(item[0])
                    .options(List.of(item[1], item[2], item[3], item[4]))
                    .correctAnswer(item[5])
                    .explanation(item[6])
                    .marks(1.0)
                    .topic("Python Programming")
                    .questionType("MCQ")
                    .build();
        }

        if (lower.contains("dbms") || lower.contains("database") || lower.contains("sql")) {
            String[][] dbBank = {
                    {"Which normal form eliminates transitive functional dependencies on candidate keys?", "Third Normal Form (3NF)", "First Normal Form (1NF)", "Second Normal Form (2NF)", "Boyce-Codd Normal Form (BCNF)", "A", "3NF requires a relation to be in 2NF and have no non-prime attribute transitively dependent on any candidate key."},
                    {"In ACID properties of database transactions, what does 'A' represent?", "Atomicity", "Accuracy", "Availability", "Authorization", "A", "Atomicity guarantees that all operations within a transaction complete successfully, or all changes are rolled back."},
                    {"Which SQL clause is used to filter aggregated group records returned by GROUP BY?", "HAVING", "WHERE", "ORDER BY", "FILTER", "A", "HAVING filters groups after aggregation, while WHERE filters individual rows before aggregation."},
                    {"What type of join returns all rows from both tables, filling with NULLs where there is no match?", "FULL OUTER JOIN", "INNER JOIN", "CROSS JOIN", "NATURAL JOIN", "A", "FULL OUTER JOIN combines the results of both LEFT and RIGHT outer joins."},
                    {"Which indexing structure provides balanced search with logarithmic depth for database range queries?", "B+ Tree", "Hash Table", "Binary Search Tree", "Linked List", "A", "B+ Trees maintain balanced logarithmic height and keep all data pointers at leaf nodes linked sequentially for fast range scans."}
            };
            int idx = (seed - 1) % dbBank.length;
            String[] item = dbBank[idx];
            return GeneratedQuestionDto.builder()
                    .questionId(qId)
                    .text(item[0])
                    .options(List.of(item[1], item[2], item[3], item[4]))
                    .correctAnswer(item[5])
                    .explanation(item[6])
                    .marks(1.0)
                    .topic("Database Management Systems")
                    .questionType("MCQ")
                    .build();
        }

        // Generic academic curriculum fallback
        return GeneratedQuestionDto.builder()
                .questionId(qId)
                .text("In " + topic + ", which fundamental principle governs optimal system decomposition and high coherence?")
                .options(List.of(
                        "Separation of concerns and modular encapsulation",
                        "Monolithic coupling with global variable states",
                        "Cyclic redundancy check with unconditional branching",
                        "Static memory allocation without dynamic garbage collection"
                ))
                .correctAnswer("A")
                .explanation("Separation of concerns ensures modular design with high internal cohesion and loose coupling between subsystems.")
                .marks(1.0)
                .topic(topic)
                .questionType("MCQ")
                .build();
    }

    private String sanitizeErrorMessage(String msg) {
        if (msg == null) return "Unknown error occurred.";
        return msg.replaceAll("Bearer\\s+[A-Za-z0-9_\\-\\.]+", "Bearer [REDACTED]")
                  .replaceAll("key=[A-Za-z0-9_\\-\\.]+", "key=[REDACTED]");
    }
}
