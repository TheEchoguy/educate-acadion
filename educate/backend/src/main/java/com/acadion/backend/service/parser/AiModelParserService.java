package com.acadion.backend.service.parser;

import com.acadion.backend.entity.QuestionPaper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
public class AiModelParserService {

    private final String pythonServiceUrl;
    private final String openrouterKey;
    private final String openrouterModel;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public AiModelParserService(
            @Value("${ai.python.service.url:http://127.0.0.1:5000/api/ai/parse-text}") String pythonServiceUrl,
            @Value("${ai.openrouter.key:}") String openrouterKey,
            @Value("${ai.openrouter.model:openrouter/free}") String openrouterModel,
            ObjectMapper objectMapper
    ) {
        this.pythonServiceUrl = pythonServiceUrl;
        this.openrouterKey = openrouterKey;
        this.openrouterModel = openrouterModel;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .build();
    }

    public ParsedPaperResult parseWithAi(String extractedText) {
        if (extractedText == null || extractedText.isBlank()) {
            return null;
        }

        // ============================================
        // 1. TRY LOCAL PYTHON AI MICROSERVICE (logs/)
        // ============================================
        ParsedPaperResult pythonResult = tryPythonMicroservice(extractedText);
        if (pythonResult != null && !pythonResult.getQuestions().isEmpty()) {
            log.info("Successfully parsed {} questions via Python AI Microservice (logs/app.py)!", pythonResult.getQuestions().size());
            return pythonResult;
        }

        // ============================================
        // 2. DIRECT OPENROUTER CLOUD AI CALL
        // ============================================
        return tryDirectOpenRouter(extractedText);
    }

    private ParsedPaperResult tryPythonMicroservice(String text) {
        try {
            String requestJson = objectMapper.writeValueAsString(java.util.Map.of("text", text));
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(pythonServiceUrl))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(30))
                    .POST(HttpRequest.BodyPublishers.ofString(requestJson))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                JsonNode root = objectMapper.readTree(response.body());
                return mapJsonToParsedResult(root);
            }
        } catch (Exception e) {
            log.debug("Python microservice not reachable ({}). Using direct AI fallback.", e.getMessage());
        }
        return null;
    }

    private ParsedPaperResult tryDirectOpenRouter(String extractedText) {
        if (openrouterKey == null || openrouterKey.isBlank()) {
            log.debug("OpenRouter AI key not configured. Skipping direct AI fallback.");
            return null;
        }
        try {
            log.info("Calling OpenRouter AI ({}) directly...", openrouterModel);

            String prompt = """
                    You are an expert academic examination question paper analyzer (supporting VTU, CBSE, AICTE, and university formats).
                    Analyze the following raw OCR/document text from an examination question paper:

                    \"\"\"%s\"\"\"

                    CRITICAL EXTRACTION INSTRUCTIONS:
                    1. MCQ VS THEORY DETECTION:
                       - If the paper contains Multiple Choice Questions (with A, B, C, D choices), set "questionType": "MCQ", extract options into ["A) ...", "B) ...", "C) ...", "D) ..."], and assign 1 mark per MCQ (unless specified).
                       - If the paper is a descriptive/theory paper, set "questionType": "THEORY".

                    2. ACCURATE MARKS EXTRACTION (SUPPORT ALL FORMATS):
                       - Format A (Tables with M L C / Marks Blooms CO columns):
                         Look at column headers: 'M' is MARKS! Extract the numeric value in column 'M' (e.g. 8, 8, 4, 10).
                         DO NOT confuse with 'L' (Blooms level) or 'C' (Course outcome).
                         Example: 'Explain ... 8 2 3' -> marks is 8.0!
                         Example: 'What ... 4 1 3' -> marks is 4.0!
                         Example: 'Discuss ... 8 2 4' -> marks is 8.0!
                       - Format B (Bracketed/Inline marks):
                         e.g. '[10 Marks]', '[8M]', '(8)', 'Marks: 10' -> extract that exact number.

                    3. MODULES & OR CHOICE RELATIONSHIPS:
                       - Group questions by module (e.g. Q1 and Q2 in MODULE-2, Q3 and Q4 in MODULE-3).
                       - Primary questions (Q1, Q3): optionalQuestion = false, optionalWith = null.
                       - Alternative questions (Q2, Q4): optionalQuestion = true, optionalWith = 'Q1' (for Q2) and optionalWith = 'Q3' (for Q4).

                    4. SUB-QUESTIONS:
                       - Decompose main questions into sub-questions: Q1(a), Q1(b), Q1(c), Q2(a), Q2(b), Q2(c), Q3(a), Q3(b), Q3(c), Q4(a), Q4(b), Q4(c).

                    Return ONLY a JSON object matching this schema:
                    {
                      "metadata": {
                        "collegeName": "string or null",
                        "subject": "string",
                        "subjectCode": "string or null",
                        "examName": "string or null",
                        "semester": "string or null",
                        "date": "string or null",
                        "duration": "string or null",
                        "maxMarks": number or null,
                        "internalNo": number or null
                      },
                      "questions": [
                        {
                          "questionId": "Q1(a)",
                          "text": "Full question prompt text",
                          "marks": 8.0,
                          "questionType": "THEORY",
                          "section": "MODULE-2",
                          "parentQuestion": "Q1",
                          "groupName": "GROUP-A",
                          "optionalQuestion": false,
                          "optionalWith": null,
                          "maxAttempt": 1,
                          "topic": "string",
                          "options": []
                        }
                      ]
                    }
                    Do NOT wrap in markdown fences. Output pure raw JSON only.
                    """.formatted(extractedText);

            String requestBody = objectMapper.writeValueAsString(
                    java.util.Map.of(
                            "model", openrouterModel,
                            "messages", List.of(
                                    java.util.Map.of("role", "user", "content", prompt)
                            ),
                            "temperature", 0.0
                    )
            );

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://openrouter.ai/api/v1/chat/completions"))
                    .header("Authorization", "Bearer " + openrouterKey)
                    .header("Content-Type", "application/json")
                    .header("HTTP-Referer", "http://localhost:8080")
                    .header("X-Title", "Acadion")
                    .timeout(Duration.ofSeconds(90))
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                log.error("AI Model API error (status {}): {}", response.statusCode(), response.body());
                return null;
            }

            JsonNode root = objectMapper.readTree(response.body());
            JsonNode choices = root.path("choices");
            if (!choices.isArray() || choices.isEmpty()) return null;

            String content = choices.get(0).path("message").path("content").asText().trim();
            if (content.isBlank()) return null;

            if (content.startsWith("```")) {
                content = content.replaceAll("^```(?:json)?\\s*", "").replaceAll("```$", "").trim();
            }

            JsonNode parsedJson = objectMapper.readTree(content);
            ParsedPaperResult result = mapJsonToParsedResult(parsedJson);

            if (result != null && result.getQuestions() != null && !result.getQuestions().isEmpty()) {
                log.info("AI Model successfully extracted {} distinct questions!", result.getQuestions().size());
                return result;
            }

        } catch (Exception e) {
            log.error("Direct AI model extraction failed: {}", e.getMessage(), e);
        }
        return null;
    }

    private ParsedPaperResult mapJsonToParsedResult(JsonNode root) {
        ParsedMetadata meta = new ParsedMetadata();
        JsonNode mNode = root.path("metadata");
        if (mNode.isObject()) {
            meta.setCollegeName(mNode.path("collegeName").asText(null));
            meta.setSubject(mNode.path("subject").asText(null));
            meta.setSubjectCode(mNode.path("subjectCode").asText(null));
            meta.setExamName(mNode.path("examName").asText(null));
            meta.setSemester(mNode.path("semester").asText(null));
            meta.setDate(mNode.path("date").asText(null));
            meta.setDuration(mNode.path("duration").asText(null));
            if (mNode.has("maxMarks") && !mNode.path("maxMarks").isNull()) {
                meta.setMaxMarks(mNode.path("maxMarks").asDouble());
            }
            if (mNode.has("internalNo") && !mNode.path("internalNo").isNull()) {
                meta.setInternalNo(mNode.path("internalNo").asInt());
            }
        }

        List<QuestionPaper.Question> questions = new ArrayList<>();
        JsonNode qArray = root.path("questions");
        if (qArray.isArray()) {
            for (JsonNode qNode : qArray) {
                List<String> options = new ArrayList<>();
                JsonNode optArray = qNode.path("options");
                if (optArray.isArray()) {
                    for (JsonNode o : optArray) {
                        if (o.isObject() && o.has("text")) {
                            options.add(o.path("text").asText());
                        } else {
                            options.add(o.asText());
                        }
                    }
                }

                String qType = qNode.path("questionType").asText("THEORY");
                if (qType.equalsIgnoreCase("THEORY") && options.size() >= 2) {
                    qType = "MCQ";
                }

                String textPrompt = qNode.has("prompt") && !qNode.path("prompt").asText().isBlank()
                        ? qNode.path("prompt").asText()
                        : qNode.path("text").asText("");

                String correct = qNode.has("correctOption") && !qNode.path("correctOption").asText().isBlank()
                        ? qNode.path("correctOption").asText()
                        : qNode.path("correctAnswer").asText(null);

                String explanation = qNode.path("explanation").asText(null);
                Integer moduleNum = qNode.has("module") && !qNode.path("module").isNull() ? qNode.path("module").asInt() : null;

                QuestionPaper.Question q = QuestionPaper.Question.builder()
                        .questionId(qNode.path("questionId").asText("Q" + (questions.size() + 1)))
                        .text(textPrompt)
                        .prompt(textPrompt)
                        .marks(qNode.path("marks").asDouble(qType.equalsIgnoreCase("MCQ") ? 1.0 : 5.0))
                        .section(qNode.path("section").asText(moduleNum != null ? "MODULE-" + moduleNum : null))
                        .questionType(qType)
                        .parentQuestion(qNode.path("parentQuestion").asText(null))
                        .groupName(qNode.path("groupName").asText(null))
                        .optionalQuestion(qNode.path("optionalQuestion").asBoolean(false))
                        .optionalWith(qNode.path("optionalWith").asText(null))
                        .maxAttempt(qNode.path("maxAttempt").asInt(1))
                        .topic(qNode.path("topic").asText("General"))
                        .imageUrl(qNode.path("imageUrl").asText(null))
                        .options(options)
                        .correctAnswer(correct)
                        .correctOption(correct)
                        .explanation(explanation)
                        .module(moduleNum)
                        .build();

                if (!q.getText().isBlank()) {
                    questions.add(q);
                }
            }
        }

        return ParsedPaperResult.builder()
                .metadata(meta)
                .questions(questions)
                .warnings(new ArrayList<>())
                .build();
    }
}
