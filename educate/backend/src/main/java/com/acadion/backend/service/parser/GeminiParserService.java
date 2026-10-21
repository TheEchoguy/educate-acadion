package com.acadion.backend.service.parser;

import com.acadion.backend.entity.QuestionPaper;
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
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

@Slf4j
@Service
public class GeminiParserService {

    private final String apiKey;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public GeminiParserService(
            @Value("${gemini.api.key:}") String apiKey,
            ObjectMapper objectMapper
    ) {
        this.apiKey = apiKey != null && !apiKey.isBlank() ? apiKey.trim() : System.getenv("GEMINI_API_KEY");
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(20))
                .build();

        if (isAvailable()) {
            log.info("Gemini AI Parser Service is ENABLED and ready for multimodal question paper parsing.");
        } else {
            log.info("Gemini AI Parser API key not configured. Using local intelligent OCR/NLP document parser.");
        }
    }

    public boolean isAvailable() {
        return apiKey != null && !apiKey.isBlank() && !apiKey.equalsIgnoreCase("YOUR_GEMINI_API_KEY");
    }

    public ParsedPaperResult parseWithGemini(MultipartFile file, String fallbackText) {
        if (!isAvailable()) {
            return null;
        }

        try {
            log.info("Calling Gemini 1.5 Flash to parse question paper document...");
            byte[] fileBytes = file.getBytes();
            String mimeType = file.getContentType() != null ? file.getContentType() : "application/pdf";
            String base64Data = Base64.getEncoder().encodeToString(fileBytes);

            String prompt = """
                    You are an expert examination question paper parser.
                    Extract all metadata and questions from this question paper document.
                    Return ONLY a valid JSON object matching this exact schema:
                    {
                      "metadata": {
                        "collegeName": "string or null",
                        "subject": "string or null",
                        "subjectCode": "string or null",
                        "examName": "string or null",
                        "semester": "string or null",
                        "date": "string or null",
                        "duration": "string or null",
                        "maxMarks": number or null,
                        "internalNo": number or null,
                        "instructions": ["string"]
                      },
                      "questions": [
                        {
                          "questionId": "Q1(a) or 1.",
                          "text": "Full question prompt text without marks",
                          "marks": number (e.g. 5, 8, 10),
                          "questionType": "THEORY" | "MCQ" | "NUMERICAL" | "PROGRAMMING" | "SHORT" | "DESCRIPTIVE",
                          "parentQuestion": "Q1 or null",
                          "groupName": "OR-Q1 or null",
                          "optionalQuestion": boolean,
                          "maxAttempt": 1,
                          "topic": "string or General",
                          "options": ["string"] (only if MCQ)
                        }
                      ]
                    }
                    Do NOT wrap in markdown code fences. Output pure raw JSON only.
                    """;

            String requestBodyJson;
            if (mimeType.contains("pdf") || mimeType.startsWith("image")) {
                requestBodyJson = String.format("""
                        {
                          "contents": [
                            {
                              "parts": [
                                { "text": %s },
                                {
                                  "inline_data": {
                                    "mime_type": "%s",
                                    "data": "%s"
                                  }
                                }
                              ]
                            }
                          ],
                          "generationConfig": {
                            "response_mime_type": "application/json",
                            "temperature": 0.1
                          }
                        }
                        """,
                        objectMapper.writeValueAsString(prompt),
                        mimeType,
                        base64Data
                );
            } else {
                requestBodyJson = String.format("""
                        {
                          "contents": [
                            {
                              "parts": [
                                { "text": %s },
                                { "text": %s }
                              ]
                            }
                          ],
                          "generationConfig": {
                            "response_mime_type": "application/json",
                            "temperature": 0.1
                          }
                        }
                        """,
                        objectMapper.writeValueAsString(prompt),
                        objectMapper.writeValueAsString("DOCUMENT TEXT:\n" + fallbackText)
                );
            }

            String url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + apiKey;

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(60))
                    .POST(HttpRequest.BodyPublishers.ofString(requestBodyJson))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                log.error("Gemini API returned error status {}: {}", response.statusCode(), response.body());
                return null;
            }

            JsonNode root = objectMapper.readTree(response.body());
            JsonNode candidate = root.path("candidates").get(0);
            if (candidate == null) return null;

            String responseText = candidate.path("content").path("parts").get(0).path("text").asText();
            if (responseText == null || responseText.isBlank()) return null;

            // Strip any accidental markdown formatting
            responseText = responseText.replaceAll("^```json\\s*", "").replaceAll("```$", "").trim();

            JsonNode parsedJson = objectMapper.readTree(responseText);
            return mapJsonToParsedResult(parsedJson);

        } catch (Exception e) {
            log.error("Failed to parse document with Gemini AI: {}", e.getMessage(), e);
            return null;
        }
    }

    public List<String> decomposeTopicWithGemini(String topic, String moduleTitle, int sessionCount) {
        return decomposeTopicWithGemini(topic, moduleTitle, "", sessionCount);
    }

    public List<String> decomposeTopicWithGemini(String topic, String moduleTitle, String surroundingContext, int sessionCount) {
        if (!isAvailable() || sessionCount <= 0 || topic == null || topic.isBlank()) {
            return java.util.Collections.emptyList();
        }
        try {
            log.info("Calling Gemini AI to decompose topic '{}' into {} sessions...", topic, sessionCount);
            String contextBlock = (surroundingContext != null && !surroundingContext.isBlank())
                    ? "\nSurrounding syllabus context:\n" + surroundingContext.substring(0, Math.min(600, surroundingContext.length()))
                    : "";

            String prompt = String.format("""
                You are an academic syllabus curriculum designer.
                Given the Module '%s' and Topic '%s', decompose this topic into exactly %d sequential, specific learning subtopics for %d 1-hour classroom lectures.
                %s

                Requirements:
                - Output ONLY a JSON array of %d strings: ["subtopic 1", "subtopic 2", ...]
                - Each subtopic must be concise, approximately 5 to 6 words long (e.g. 'IoT devices, sensors, actuators and connectivity').
                - Each subtopic must be displayable on a single line.
                - Each subtopic must represent a logical pedagogical progression across the %d lectures.
                - Do NOT use generic labels like 'Part 1', 'Part 2', or repeat the exact same topic title.
                - Do NOT include markdown fences. Output raw JSON array only.
                """,
                    moduleTitle != null ? moduleTitle : "",
                    topic,
                    sessionCount,
                    sessionCount,
                    contextBlock,
                    sessionCount,
                    sessionCount
            );

            String requestBodyJson = String.format("""
                {
                  "contents": [
                    {
                      "parts": [
                        { "text": %s }
                      ]
                    }
                  ],
                  "generationConfig": {
                    "response_mime_type": "application/json",
                    "temperature": 0.2
                  }
                }
                """, objectMapper.writeValueAsString(prompt));

            String url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + apiKey;

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(15))
                    .POST(HttpRequest.BodyPublishers.ofString(requestBodyJson))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                log.warn("Gemini API returned error status {} for topic decomposition", response.statusCode());
                return java.util.Collections.emptyList();
            }

            JsonNode root = objectMapper.readTree(response.body());
            JsonNode candidate = root.path("candidates").get(0);
            if (candidate == null) return java.util.Collections.emptyList();

            String responseText = candidate.path("content").path("parts").get(0).path("text").asText();
            if (responseText == null || responseText.isBlank()) return java.util.Collections.emptyList();

            responseText = responseText.replaceAll("^```json\\s*", "").replaceAll("```$", "").trim();
            JsonNode parsedJson = objectMapper.readTree(responseText);

            List<String> results = new ArrayList<>();
            if (parsedJson.isArray()) {
                for (JsonNode n : parsedJson) {
                    if (n.isTextual() && !n.asText().isBlank()) {
                        String cleaned = n.asText().replaceAll("[\\r\\n]+", " ").trim();
                        cleaned = cleaned.replaceAll("(?i)\\s*\\(part\\s*\\d+\\)", "");
                        results.add(cleaned);
                    }
                }
            }
            return results;
        } catch (Exception e) {
            log.warn("Failed to decompose topic with Gemini AI: {}. Falling back to deterministic progression.", e.getMessage());
            return java.util.Collections.emptyList();
        }
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
                        options.add(o.asText());
                    }
                }

                QuestionPaper.Question q = QuestionPaper.Question.builder()
                        .questionId(qNode.path("questionId").asText("Q" + (questions.size() + 1)))
                        .text(qNode.path("text").asText(""))
                        .marks(qNode.path("marks").asDouble(5.0))
                        .questionType(qNode.path("questionType").asText("THEORY"))
                        .parentQuestion(qNode.path("parentQuestion").asText(null))
                        .groupName(qNode.path("groupName").asText(null))
                        .optionalQuestion(qNode.path("optionalQuestion").asBoolean(false))
                        .maxAttempt(qNode.path("maxAttempt").asInt(1))
                        .topic(qNode.path("topic").asText("General"))
                        .options(options)
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
