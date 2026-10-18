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
 * Generates relevant, curriculum-tailored subtopics for every scheduled session.
 * Removes generic placeholders completely from scheduling workflows.
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
        private String subtopicSource; // "OFFICIAL_SYLLABUS", "AI_GENERATED", "DETERMINISTIC_PROGRESSION", "TEACHER_EDITED"
        private String teachingObjective;
        private String associatedDocumentId;
    }

    /**
     * Decomposes all topics in a module outline across its estimated teaching hours.
     * Prefers official extracted subtopics, falls back to AI if configured, or uses
     * deterministic topic-aware progression based on actual syllabus content.
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

        // Calculate hours per topic sequentially
        int baseHours = totalHours / topicCount;
        int extraHours = totalHours % topicCount;

        List<SessionFocus> result = new ArrayList<>();
        int officialSubtopicCursor = 0;

        for (int tIdx = 0; tIdx < topicCount; tIdx++) {
            String topic = cleanText(topics.get(tIdx));
            int allocatedHours = Math.max(1, baseHours + (tIdx < extraHours ? 1 : 0));

            // Find matching official subtopics for this topic if any
            List<String> matchingOfficial = findMatchingOfficialSubtopics(topic, officialSubtopics);

            // Attempt AI decomposition only if provider is explicitly configured and available
            List<String> aiDecomposed = Collections.emptyList();
            if (geminiParserService != null && geminiParserService.isAvailable()) {
                aiDecomposed = geminiParserService.decomposeTopicWithGemini(topic, modTitle, allocatedHours);
                if (!aiDecomposed.isEmpty()) {
                    log.info("Gemini AI successfully decomposed topic '{}' into {} session focuses", topic, aiDecomposed.size());
                }
            }

            for (int sIdx = 0; sIdx < allocatedHours; sIdx++) {
                String subtopic;
                String source;
                String objective;

                // Priority 1: Official extracted subtopic matching this topic
                if (sIdx < matchingOfficial.size()) {
                    subtopic = matchingOfficial.get(sIdx);
                    source = "OFFICIAL_SYLLABUS";
                    objective = String.format("Analyze and master %s within %s concepts with analytical rigor.", subtopic, topic);
                }
                // Priority 2: Next unused general official subtopic from syllabus outline
                else if (officialSubtopicCursor < officialSubtopics.size()) {
                    subtopic = officialSubtopics.get(officialSubtopicCursor++);
                    source = "OFFICIAL_SYLLABUS";
                    objective = String.format("Examine %s in relation to %s with curriculum rigor.", subtopic, topic);
                }
                // Priority 3: Configured AI provider output
                else if (sIdx < aiDecomposed.size()) {
                    subtopic = aiDecomposed.get(sIdx);
                    source = "AI_GENERATED";
                    objective = String.format("Develop comprehensive understanding of %s in %s.", subtopic, topic);
                }
                // Priority 4: Deterministic topic-aware decomposition & progression
                else {
                    FocusDecomposition decomp = deterministicDecompose(topic, sIdx, allocatedHours);
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
                        .build());
            }
        }

        return result;
    }

    /**
     * Deterministic topic-aware decomposition based on actual topic text structure and curriculum progression.
     */
    private FocusDecomposition deterministicDecompose(String topic, int sessionIndex, int totalSessionsForTopic) {
        // 1. Check for embedded sub-concepts inside the topic string (e.g. colon, semicolon, comma delimiters)
        List<String> extractedSubparts = extractSubparts(topic);

        if (extractedSubparts.size() >= 2 && sessionIndex < extractedSubparts.size()) {
            String part = extractedSubparts.get(sessionIndex);
            String cleanMain = getMainTopicPrefix(topic);
            return new FocusDecomposition(
                    part,
                    "DETERMINISTIC_PROGRESSION",
                    String.format("Analyze %s mechanisms and operational dynamics in %s.", part, cleanMain)
            );
        }

        // 2. If topic is single concept or sessions exceed extracted subparts, build a sensible pedagogical progression
        if (totalSessionsForTopic == 1) {
            // Show the actual topic as the learning focus instead of inserting a generic placeholder
            return new FocusDecomposition(
                    topic,
                    "OFFICIAL_SYLLABUS",
                    String.format("Understand %s concepts with analytical rigor and curriculum depth.", topic)
            );
        }

        String cleanTopic = getMainTopicPrefix(topic);
        String focus;
        String objective;

        if (totalSessionsForTopic == 2) {
            if (sessionIndex == 0) {
                focus = cleanTopic + " — Foundations & Architectural Overview";
                objective = String.format("Understand core principles, fundamental abstractions, and structural architecture of %s.", cleanTopic);
            } else {
                focus = cleanTopic + " — Practical Mechanics, Analysis & Evaluation";
                objective = String.format("Analyze operational mechanics, implementation dynamics, and applied problem solving in %s.", cleanTopic);
            }
        } else if (totalSessionsForTopic == 3) {
            if (sessionIndex == 0) {
                focus = cleanTopic + " — Conceptual Foundations & Principles";
                objective = String.format("Establish foundational concepts, theoretical background, and scope of %s.", cleanTopic);
            } else if (sessionIndex == 1) {
                focus = cleanTopic + " — Core Mechanics & Execution Dynamics";
                objective = String.format("Examine internal mechanics, algorithmic execution, and operational pipelines in %s.", cleanTopic);
            } else {
                focus = cleanTopic + " — Applied Problem Solving & Implementation Patterns";
                objective = String.format("Explore implementation patterns, case studies, and analytical problem solving in %s.", cleanTopic);
            }
        } else {
            // 4 or more sessions
            switch (sessionIndex) {
                case 0 -> {
                    focus = cleanTopic + " — Fundamentals & Conceptual Overview";
                    objective = String.format("Understand core concepts, design goals, and curriculum fundamentals of %s.", cleanTopic);
                }
                case 1 -> {
                    focus = cleanTopic + " — Internal Architecture & Structural Dynamics";
                    objective = String.format("Analyze architectural blocks, internal relationships, and data pathways in %s.", cleanTopic);
                }
                case 2 -> {
                    focus = cleanTopic + " — Implementation Patterns & Practical Workflow";
                    objective = String.format("Implement practical algorithms, configuration flows, and programming models in %s.", cleanTopic);
                }
                default -> {
                    focus = cleanTopic + String.format(" — Part %d: Advanced Problem Solving & Synthesis", sessionIndex + 1);
                    objective = String.format("Synthesize advanced concepts, evaluate edge cases, and perform holistic review of %s.", cleanTopic);
                }
            }
        }

        return new FocusDecomposition(focus, "DETERMINISTIC_PROGRESSION", objective);
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

    private String getMainTopicPrefix(String topic) {
        if (topic == null) return "Topic";
        if (topic.contains(":")) {
            String prefix = topic.split(":\\s*", 2)[0].trim();
            if (prefix.length() >= 3) return prefix;
        }
        return cleanText(topic);
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

    private record FocusDecomposition(String focusTitle, String source, String objective) {}
}
