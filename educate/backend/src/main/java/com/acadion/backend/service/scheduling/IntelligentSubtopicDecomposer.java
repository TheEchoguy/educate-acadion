package com.acadion.backend.service.scheduling;

import com.acadion.backend.dto.scheduling.ModuleOutlineDTO;
import com.acadion.backend.entity.SyllabusItem;
import com.acadion.backend.service.parser.GeminiParserService;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Intelligent topic-aware learning focus and subtopic decomposer.
 * Generates meaningful, curriculum-tailored subtopics (~5-6 words) for every scheduled session.
 * Eliminates generic placeholders and "Part 1 / Part 2" labels completely.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class IntelligentSubtopicDecomposer {

    private final GeminiParserService geminiParserService;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SessionFocus {
        private int moduleNumber;
        private String moduleTitle;
        private String topicTitle;
        private String subtopic;
        private String subtopicSource; // "OFFICIAL_SYLLABUS", "AI_GENERATED", "DETERMINISTIC_PROGRESSION", "TEACHER_REVIEW_SUGGESTION", "TEACHER_EDITED"
        private String teachingObjective;
        private String associatedDocumentId;
        @Builder.Default
        private List<String> coveredTopics = new ArrayList<>();
    }

    /**
     * Decomposes all topics in a module outline across its estimated teaching hours.
     * Prefers official extracted subtopics, queries configured AI (Gemini) if available,
     * or uses a deterministic, source-grounded curriculum progression.
     */
    public List<SessionFocus> decomposeModule(ModuleOutlineDTO mod, List<SyllabusItem> classroomSyllabusItems) {
        int modNum = mod.getModuleNumber();
        String modTitle = mod.getModuleTitle() != null && !mod.getModuleTitle().isBlank()
                ? mod.getModuleTitle().trim()
                : "Module " + modNum;
        String docId = mod.getAssociatedDocumentId();

        List<String> rawTopics = mod.getTopics() != null ? mod.getTopics() : Collections.emptyList();
        List<String> officialSubtopics = mod.getSubtopics() != null ? mod.getSubtopics() : Collections.emptyList();

        // If no topics in outline, check classroom syllabus items for this unit
        List<String> topics = new ArrayList<>(rawTopics);
        if (topics.isEmpty() && classroomSyllabusItems != null) {
            String unitPrefix = "module " + modNum;
            for (SyllabusItem item : classroomSyllabusItems) {
                if (item.getUnit() != null && item.getUnit().toLowerCase().contains(unitPrefix) && item.getTopic() != null) {
                    topics.add(item.getTopic().trim());
                }
            }
        }

        // If still empty, use module title as the single parent topic
        if (topics.isEmpty()) {
            topics.add(modTitle);
        }

        int totalHours = mod.getEstimatedHours() > 0 ? mod.getEstimatedHours() : 8;
        int topicCount = topics.size();

        List<SessionFocus> result = new ArrayList<>();
        int officialSubtopicCursor = 0;

        if (topicCount <= totalHours) {
            // Standard progression: Each topic gets at least 1 session
            int baseHours = totalHours / topicCount;
            int extraHours = totalHours % topicCount;

            for (int tIdx = 0; tIdx < topicCount; tIdx++) {
                String topic = cleanText(topics.get(tIdx));
                int allocatedHours = baseHours + (tIdx < extraHours ? 1 : 0);

                List<String> matchingOfficial = findMatchingOfficialSubtopics(topic, officialSubtopics);

                // Check AI provider decomposition if multi-session and available
                List<String> aiSubtopics = Collections.emptyList();
                if (allocatedHours > 1 && geminiParserService != null && geminiParserService.isAvailable()) {
                    try {
                        aiSubtopics = geminiParserService.decomposeTopicWithGemini(topic, modTitle, allocatedHours);
                    } catch (Exception e) {
                        log.warn("Gemini subtopic decomposition failed for topic '{}': {}", topic, e.getMessage());
                        aiSubtopics = Collections.emptyList();
                    }
                }

                for (int sIdx = 0; sIdx < allocatedHours; sIdx++) {
                    String subtopic;
                    String source;
                    String objective = null;

                    if (sIdx < matchingOfficial.size()) {
                        subtopic = formatTo5or6Words(matchingOfficial.get(sIdx));
                        source = "OFFICIAL_SYLLABUS";
                    } else if (officialSubtopicCursor < officialSubtopics.size()) {
                        subtopic = formatTo5or6Words(officialSubtopics.get(officialSubtopicCursor++));
                        source = "OFFICIAL_SYLLABUS";
                    } else if (sIdx < aiSubtopics.size() && !aiSubtopics.get(sIdx).isBlank()) {
                        subtopic = formatTo5or6Words(aiSubtopics.get(sIdx));
                        source = "AI_GENERATED";
                    } else {
                        FocusDecomposition decomp = deterministicDecompose(topic, modTitle, sIdx, allocatedHours);
                        subtopic = decomp.focusTitle;
                        source = decomp.source;
                        objective = decomp.objective;
                    }

                    result.add(SessionFocus.builder()
                            .moduleNumber(modNum)
                            .moduleTitle(modTitle)
                            .topicTitle(topic)
                            .subtopic(subtopic)
                            .subtopicSource(source)
                            .teachingObjective(objective)
                            .associatedDocumentId(docId)
                            .coveredTopics(List.of(topic))
                            .build());
                }
            }
        } else {
            // Dense curriculum: More topics than total available module hours.
            // Distribute topics cleanly across the totalHours sessions without dropping any topic.
            for (int sIdx = 0; sIdx < totalHours; sIdx++) {
                int startIdx = (sIdx * topicCount) / totalHours;
                int endIdx = ((sIdx + 1) * topicCount) / totalHours;
                List<String> topicSlice = topics.subList(startIdx, endIdx);

                String primaryTopic = cleanText(topicSlice.get(0));
                String subtopicText;
                if (topicSlice.size() == 1) {
                    subtopicText = formatTo5or6Words(primaryTopic);
                } else {
                    String combined = topicSlice.stream().map(this::cleanText).collect(Collectors.joining(", "));
                    subtopicText = formatTo5or6Words(combined);
                }

                String source = "OFFICIAL_SYLLABUS";
                if (sIdx < officialSubtopics.size()) {
                    subtopicText = formatTo5or6Words(officialSubtopics.get(sIdx));
                }

                result.add(SessionFocus.builder()
                        .moduleNumber(modNum)
                        .moduleTitle(modTitle)
                        .topicTitle(primaryTopic)
                        .subtopic(subtopicText)
                        .subtopicSource(source)
                        .teachingObjective(null)
                        .associatedDocumentId(docId)
                        .coveredTopics(new ArrayList<>(topicSlice))
                        .build());
            }
        }

        return result;
    }

    /**
     * Deterministic, source-grounded topic-aware progression.
     * Generates concise, meaningful ~5-6 word subtopics directly based on the topic's conceptual domain.
     * Never generates "Part 1" or "Part 2".
     */
    public FocusDecomposition deterministicDecompose(String topic, String moduleTitle, int sessionIndex, int totalSessionsForTopic) {
        // 1. Check for embedded sub-concepts inside the topic string (e.g. colon, semicolon, comma delimiters)
        List<String> extractedSubparts = extractSubparts(topic);

        if (extractedSubparts.size() >= 2 && sessionIndex < extractedSubparts.size()) {
            String part = formatTo5or6Words(extractedSubparts.get(sessionIndex));
            return new FocusDecomposition(part, "OFFICIAL_SYLLABUS", null);
        }

        if (totalSessionsForTopic == 1) {
            return new FocusDecomposition(formatTo5or6Words(topic), "OFFICIAL_SYLLABUS", null);
        }

        // 2. Synthesize curriculum-grounded conceptual phases tailored to the specific topic domain
        String lower = topic.toLowerCase();
        String domain = extractDomainPhrase(topic, moduleTitle);

        String focus;
        // Physical design / Hardware / Sensors
        if (lower.contains("physical") || lower.contains("hardware") || lower.contains("sensor")) {
            if (sessionIndex == 0) {
                focus = "IoT devices, sensors, actuators and connectivity";
            } else if (sessionIndex == 1) {
                focus = "Hardware protocols, communication endpoints and interfaces";
            } else {
                focus = "Physical deployment, peripheral wiring and telemetry";
            }
        }
        // Logical design / Architecture / Functional blocks
        else if (lower.contains("logical") || lower.contains("functional") || lower.contains("architecture")) {
            if (sessionIndex == 0) {
                focus = "Functional blocks, communication models and APIs";
            } else if (sessionIndex == 1) {
                focus = "Request-response protocols, WebSocket and REST APIs";
            } else {
                focus = "Communication APIs, message brokers and middleware";
            }
        }
        // Introduction / Fundamentals / Concepts
        else if (lower.contains("introduction") || lower.contains("overview") || lower.contains("concept")) {
            if (sessionIndex == 0) {
                focus = "Core concepts, architecture and foundational principles";
            } else if (sessionIndex == 1) {
                focus = "Ecosystem evolution, technical standards and applications";
            } else {
                focus = "Market landscape, design constraints and requirements";
            }
        }
        // Methodology / Design process
        else if (lower.contains("methodology") || lower.contains("design") || lower.contains("platform")) {
            if (sessionIndex == 0) {
                focus = "Design specifications, process model and requirements";
            } else if (sessionIndex == 1) {
                focus = "Information modeling, service specifications and mapping";
            } else {
                focus = "Implementation validation, integration and case studies";
            }
        }
        // Python / Programming / Software
        else if (lower.contains("python") || lower.contains("program") || lower.contains("code")) {
            if (sessionIndex == 0) {
                focus = "Syntax fundamentals, data types and structures";
            } else if (sessionIndex == 1) {
                focus = "Control flow, modular functions and packages";
            } else {
                focus = "File handling, object-oriented classes and libraries";
            }
        }
        // Device / Raspberry Pi / Board
        else if (lower.contains("device") || lower.contains("raspberry") || lower.contains("board") || lower.contains("endpoint")) {
            if (sessionIndex == 0) {
                focus = "Hardware architecture, pin configurations and interfaces";
            } else if (sessionIndex == 1) {
                focus = "Linux operating system, shell and services";
            } else {
                focus = "Peripheral interfacing, sensor drivers and scripts";
            }
        }
        // Data Analytics / Big Data / Hadoop / Spark / Storm
        else if (lower.contains("hadoop") || lower.contains("spark") || lower.contains("storm") || lower.contains("data") || lower.contains("analytics")) {
            if (sessionIndex == 0) {
                focus = "Cluster architecture, distributed storage and nodes";
            } else if (sessionIndex == 1) {
                focus = "Batch processing, MapReduce workflows and transformations";
            } else {
                focus = "Real-time stream processing, pipelines and analytics";
            }
        }
        // Network / Protocol / M2M / NETCONF / YANG / SNMP
        else if (lower.contains("network") || lower.contains("protocol") || lower.contains("snmp") || lower.contains("netconf") || lower.contains("yang") || lower.contains("m2m")) {
            if (sessionIndex == 0) {
                focus = "Network protocol standards, formats and configurations";
            } else if (sessionIndex == 1) {
                focus = "Data modeling, configuration protocols and agents";
            } else {
                focus = "Network operations, security models and monitoring";
            }
        }
        // Enabling technologies
        else if (lower.contains("enabling") || lower.contains("technolog")) {
            if (sessionIndex == 0) {
                focus = "Wireless sensor networks, cloud and computing";
            } else if (sessionIndex == 1) {
                focus = "Big data analytics and communication protocols";
            } else {
                focus = "Embedded systems, connectivity and security frameworks";
            }
        }
        // Levels & deployment templates
        else if (lower.contains("level") || lower.contains("template") || lower.contains("deploy")) {
            if (sessionIndex == 0) {
                focus = "Deployment tiers, node specification and levels";
            } else if (sessionIndex == 1) {
                focus = "Cloud deployment templates, monitoring and scalability";
            } else {
                focus = "Multi-tier architectures, redundancy and operations";
            }
        }
        // Generic conceptual synthesizer for any subject
        else {
            if (sessionIndex == 0) {
                focus = formatTo5or6Words(domain + " architecture, foundations and core components");
            } else if (sessionIndex == 1) {
                focus = formatTo5or6Words(domain + " technical protocols, interfacing and workflows");
            } else if (sessionIndex == 2) {
                focus = formatTo5or6Words(domain + " deployment patterns, integration and optimization");
            } else {
                focus = formatTo5or6Words(domain + " evaluation metrics, testing and operations");
            }
        }

        return new FocusDecomposition(formatTo5or6Words(focus), "TEACHER_REVIEW_SUGGESTION", null);
    }

    /**
     * Formats any phrase into a concise, meaningful single-line subtopic of ~5-6 words.
     */
    public String formatTo5or6Words(String text) {
        if (text == null || text.isBlank()) return "Curriculum topic lecture and discussion";
        String cleaned = text.replaceAll("^[0-9]+[.\\-_)\\s]+", "")
                .replaceAll("(?i)\\s*\\(part\\s*\\d+\\)", "")
                .replaceAll("[\\r\\n]+", " ")
                .replaceAll("[:;–—]+", " ")
                .replaceAll("\\s+", " ")
                .trim();
        String[] words = cleaned.split(" ");
        if (words.length >= 5 && words.length <= 6) {
            return cleaned;
        }
        if (words.length > 6) {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 6; i++) {
                if (i > 0) sb.append(" ");
                sb.append(words[i]);
            }
            return sb.toString().replaceAll("[,.]+$", "");
        }
        if (words.length == 4) return cleaned + " overview";
        if (words.length == 3) return cleaned + " concepts and principles";
        if (words.length == 2) return cleaned + " architecture and core foundations";
        if (words.length == 1) return cleaned + " foundational principles and core concepts";
        return cleaned;
    }

    private String extractDomainPhrase(String topic, String moduleTitle) {
        String cleanT = cleanText(topic);
        if (cleanT.equalsIgnoreCase("introduction") || cleanT.length() <= 3) {
            if (moduleTitle != null && !moduleTitle.isBlank()) {
                String cleanM = cleanText(moduleTitle).replaceAll("(?i)^module\\s*\\d+[:\\s-]*", "");
                return cleanM.length() > 30 ? cleanM.substring(0, 30).trim() : cleanM;
            }
            return "Core curriculum";
        }
        return cleanT;
    }

    private List<String> extractSubparts(String topic) {
        if (topic == null || topic.isBlank()) return Collections.emptyList();

        // Case A: Topic has colon separating title from sub-items
        if (topic.contains(":")) {
            String[] colonSplit = topic.split(":\\s*", 2);
            if (colonSplit.length == 2 && !colonSplit[1].isBlank()) {
                String subSection = colonSplit[1].trim();
                String[] items = subSection.split("[,;]\\s*|\\s+and\\s+");
                List<String> list = Arrays.stream(items)
                        .map(this::cleanText)
                        .filter(s -> s.length() >= 3)
                        .collect(Collectors.toList());
                if (list.size() >= 2) return list;
            }
        }

        // Case B: Topic has semicolons
        if (topic.contains(";")) {
            String[] items = topic.split(";\\s*");
            List<String> list = Arrays.stream(items)
                    .map(this::cleanText)
                    .filter(s -> s.length() >= 3)
                    .collect(Collectors.toList());
            if (list.size() >= 2) return list;
        }

        // Case C: Topic has commas
        if (topic.contains(",")) {
            String[] items = topic.split("[,/]\\s*|\\s+and\\s+");
            List<String> list = Arrays.stream(items)
                    .map(this::cleanText)
                    .filter(s -> s.length() >= 3)
                    .collect(Collectors.toList());
            if (list.size() >= 2) return list;
        }

        return Collections.emptyList();
    }

    private List<String> findMatchingOfficialSubtopics(String topic, List<String> officialSubtopics) {
        if (officialSubtopics == null || officialSubtopics.isEmpty()) return Collections.emptyList();
        String lowerTopic = topic.toLowerCase();
        Set<String> topicKeywords = Arrays.stream(lowerTopic.split("[\\s,;:.\\-_()]+"))
                .filter(w -> w.length() > 3 && !isStopWord(w))
                .collect(Collectors.toSet());

        List<String> matches = new ArrayList<>();
        for (String sub : officialSubtopics) {
            String lowerSub = sub.toLowerCase();
            boolean hasOverlap = topicKeywords.stream().anyMatch(lowerSub::contains);
            if (hasOverlap) {
                matches.add(sub.trim());
            }
        }
        return matches;
    }

    private boolean isStopWord(String word) {
        return Set.of("introduction", "overview", "basics", "module", "unit", "with", "from", "using", "that", "this", "concept", "concepts").contains(word);
    }

    private String cleanText(String s) {
        if (s == null) return "";
        return s.replaceAll("^[0-9]+[.\\-_)\\s]+", "").trim();
    }

    public record FocusDecomposition(String focusTitle, String source, String objective) {}
}

