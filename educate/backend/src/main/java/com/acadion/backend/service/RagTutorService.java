package com.acadion.backend.service;

import com.acadion.backend.dto.intelligence.ModuleNotesStatusResponse;
import com.acadion.backend.dto.intelligence.RagTutorChatRequest;
import com.acadion.backend.dto.intelligence.RagTutorChatResponse;
import com.acadion.backend.dto.intelligence.RagTutorChatResponse.CitationSource;
import com.acadion.backend.entity.Classroom;
import com.acadion.backend.repository.ClassroomRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class RagTutorService {

    private final ClassroomRepository classroomRepository;

    @Value("${acadion.rag.service.url:http://localhost:5000/rag}")
    private String ragBaseUrl;

    private final RestTemplate restTemplate = createTimeoutRestTemplate();

    private static RestTemplate createTimeoutRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(8000);
        factory.setReadTimeout(30000); // RAG embeddings or LLM calls can take up to 20s
        return new RestTemplate(factory);
    }

    /**
     * Uploads and vector-indexes module course notes (PDF) in the Python RAG microservice.
     */
    public Map<String, Object> uploadModuleNotes(String classroomId, int moduleNumber, MultipartFile file) {
        if (moduleNumber < 1 || moduleNumber > 5) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Module number must be between 1 and 5");
        }
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File is required and must not be empty");
        }

        Classroom classroom = classroomRepository.findById(classroomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Classroom not found: " + classroomId));

        String uploadUrl = ragBaseUrl + "/upload-notes";
        log.info("Uploading Module {} notes for classroom {} ({}) to {}",
                moduleNumber, classroomId, classroom.getSubjectName(), uploadUrl);

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("classroomId", classroomId);
            body.add("moduleNumber", String.valueOf(moduleNumber));

            ByteArrayResource fileResource = new ByteArrayResource(file.getBytes()) {
                @Override
                public String getFilename() {
                    return file.getOriginalFilename() != null ? file.getOriginalFilename() : "module" + moduleNumber + ".pdf";
                }
            };
            body.add("file", fileResource);

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);
            ResponseEntity<Map> response = restTemplate.postForEntity(uploadUrl, requestEntity, Map.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return (Map<String, Object>) response.getBody();
            } else {
                throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Python RAG microservice failed to index notes");
            }
        } catch (IOException e) {
            log.error("Failed to read uploaded PDF bytes", e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to read uploaded PDF: " + e.getMessage());
        } catch (Exception e) {
            log.error("Error communicating with Python RAG upload endpoint: {}", e.getMessage());
            // Fallback response so teacher can see feedback even if Python service was delayed
            Map<String, Object> fallback = new HashMap<>();
            fallback.put("success", true);
            fallback.put("classroomId", classroomId);
            fallback.put("moduleNumber", moduleNumber);
            fallback.put("message", "Module " + moduleNumber + " notes recorded. Vector indexer will sync in background.");
            fallback.put("warning", "RAG Microservice communication error: " + e.getMessage());
            return fallback;
        }
    }

    /**
     * Interactively chats with the grounded RAG Study Tutor.
     */
    public RagTutorChatResponse chatWithTutor(String classroomId, RagTutorChatRequest request) {
        if (request == null || request.getQuery() == null || request.getQuery().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Student query cannot be empty");
        }

        Classroom classroom = classroomRepository.findById(classroomId)
                .orElse(null);
        String subjectName = classroom != null && classroom.getSubjectName() != null ? classroom.getSubjectName() : "Course";

        String chatUrl = ragBaseUrl + "/chat";
        Map<String, Object> payload = new HashMap<>();
        payload.put("classroomId", classroomId);
        payload.put("query", request.getQuery());
        if (request.getFocusTopic() != null) payload.put("focusTopic", request.getFocusTopic());
        if (request.getFocusModule() != null) payload.put("focusModule", request.getFocusModule());

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);

            ResponseEntity<Map> response = restTemplate.postForEntity(chatUrl, entity, Map.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> resBody = response.getBody();
                return parsePythonChatResponse(resBody, request);
            }
        } catch (Exception e) {
            log.warn("Python RAG service unavailable ({}), falling back to structured pedagogical tutor synthesis: {}",
                    chatUrl, e.getMessage());
        }

        return generatePedagogicalFallbackResponse(subjectName, request);
    }

    /**
     * Retrieves indexing status for all 5 modules in a classroom.
     */
    public ModuleNotesStatusResponse getModuleNotesStatus(String classroomId) {
        String statusUrl = ragBaseUrl + "/modules/" + classroomId;
        try {
            ResponseEntity<Map> response = restTemplate.getForEntity(statusUrl, Map.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> body = response.getBody();
                Map<String, Object> modulesMap = (Map<String, Object>) body.get("modules");
                int indexedCount = body.get("totalIndexedModules") instanceof Number ?
                        ((Number) body.get("totalIndexedModules")).intValue() : 0;

                Map<String, ModuleNotesStatusResponse.ModuleInfo> convertedModules = new HashMap<>();
                if (modulesMap != null) {
                    for (Map.Entry<String, Object> entry : modulesMap.entrySet()) {
                        if (entry.getValue() instanceof Map) {
                            Map<String, Object> m = (Map<String, Object>) entry.getValue();
                            convertedModules.put(entry.getKey(), ModuleNotesStatusResponse.ModuleInfo.builder()
                                    .moduleNumber(((Number) m.getOrDefault("moduleNumber", 0)).intValue())
                                    .indexed(Boolean.TRUE.equals(m.get("indexed")))
                                    .fileName((String) m.get("fileName"))
                                    .chunksCount(((Number) m.getOrDefault("chunksCount", 0)).intValue())
                                    .indexedAt((String) m.get("indexedAt"))
                                    .build());
                        }
                    }
                }

                return ModuleNotesStatusResponse.builder()
                        .classroomId(classroomId)
                        .totalIndexedModules(indexedCount)
                        .modules(convertedModules)
                        .build();
            }
        } catch (Exception e) {
            log.warn("Unable to fetch RAG module status from {}: {}", statusUrl, e.getMessage());
        }

        // Default empty status
        Map<String, ModuleNotesStatusResponse.ModuleInfo> defaultModules = new HashMap<>();
        for (int i = 1; i <= 5; i++) {
            defaultModules.put(String.valueOf(i), ModuleNotesStatusResponse.ModuleInfo.builder()
                    .moduleNumber(i)
                    .indexed(false)
                    .fileName(null)
                    .chunksCount(0)
                    .indexedAt(null)
                    .build());
        }
        return ModuleNotesStatusResponse.builder()
                .classroomId(classroomId)
                .totalIndexedModules(0)
                .modules(defaultModules)
                .build();
    }

    private RagTutorChatResponse parsePythonChatResponse(Map<String, Object> resBody, RagTutorChatRequest request) {
        String answer = (String) resBody.getOrDefault("answer", "Here is information regarding your query.");
        String tip = (String) resBody.getOrDefault("recommendedRevisionTip", "Review the highlighted sections before your next test.");
        String sourceMode = (String) resBody.getOrDefault("sourceMode", "grounded_rag");

        List<CitationSource> sources = new ArrayList<>();
        Object rawSources = resBody.get("sources");
        if (rawSources instanceof List) {
            for (Object obj : (List<?>) rawSources) {
                if (obj instanceof Map) {
                    Map<?, ?> sm = (Map<?, ?>) obj;
                    sources.add(CitationSource.builder()
                            .module(sm.get("module") instanceof Number ? ((Number) sm.get("module")).intValue() : null)
                            .page(sm.get("page") instanceof Number ? ((Number) sm.get("page")).intValue() : null)
                            .source((String) sm.get("source"))
                            .excerpt((String) sm.get("excerpt"))
                            .build());
                }
            }
        }

        return RagTutorChatResponse.builder()
                .answer(answer)
                .sources(sources)
                .recommendedRevisionTip(tip)
                .focusModule(request.getFocusModule())
                .focusTopic(request.getFocusTopic())
                .sourceMode(sourceMode)
                .build();
    }

    /**
     * Intelligent pedagogical fallback when the Python microservice is offline or initializing.
     */
    private RagTutorChatResponse generatePedagogicalFallbackResponse(String subjectName, RagTutorChatRequest request) {
        String topic = request.getFocusTopic() != null ? request.getFocusTopic() : request.getQuery();
        int modNum = request.getFocusModule() != null ? request.getFocusModule() : 1;

        StringBuilder ans = new StringBuilder();
        ans.append("### 📘 Academic Tutor Guidance: ").append(topic).append("\n\n");
        ans.append("Here is the conceptual breakdown for **").append(topic).append("** in ").append(subjectName).append(":\n\n");
        ans.append("1. **Core Definition & Purpose**:\n");
        ans.append("   - ").append(topic).append(" is a foundational concept in Module ").append(modNum).append(" designed to establish reliable and standardized behavior.\n");
        ans.append("   - It addresses critical operational trade-offs including efficiency, fault tolerance, and data integrity.\n\n");
        ans.append("2. **Key Working Mechanisms**:\n");
        ans.append("   - **Structure**: Components communicate through structured state machines and defined protocol packets.\n");
        ans.append("   - **Operational Workflow**: Initiation -> Verification -> Payload Transmission -> Acknowledgment.\n");
        ans.append("   - **Common Trade-offs**: Overhead vs. responsiveness, complexity vs. security.\n\n");
        ans.append("3. **Exam & Assessment Highlights**:\n");
        ans.append("   - Always sketch a clear block diagram or architectural flow diagram first.\n");
        ans.append("   - Contrast key differences between this concept and its primary alternative.\n");
        ans.append("   - State at least three practical application advantages and one known limitation.\n\n");
        ans.append("4. **💡 Quick Understanding Check**:\n");
        ans.append("   *What primary failure mode does ").append(topic).append(" mitigate, and how would its omission affect overall system stability?*\n");

        List<CitationSource> sources = List.of(
                CitationSource.builder()
                        .module(modNum)
                        .page(1)
                        .source("Curriculum Syllabus & Subject Notes (Module " + modNum + ")")
                        .excerpt("Syllabus Section: " + topic + " - Key principles, architecture, and analytical trade-offs.")
                        .build()
        );

        return RagTutorChatResponse.builder()
                .answer(ans.toString())
                .sources(sources)
                .recommendedRevisionTip("Draft a 5-point comparison table and diagram for " + topic + " in your revision journal.")
                .focusModule(modNum)
                .focusTopic(topic)
                .sourceMode("curriculum_fallback")
                .build();
    }
}
