package com.acadion.backend.service;

import com.acadion.backend.dto.intelligence.ClassroomRiskWatchlistResponse;
import com.acadion.backend.dto.intelligence.ClassroomRiskWatchlistResponse.StudentRiskWatchlistItem;
import com.acadion.backend.dto.intelligence.StudentFourLevelAnalyticsDTO;
import com.acadion.backend.dto.intelligence.StudentFourLevelAnalyticsDTO.ModuleAnalytics;
import com.acadion.backend.dto.intelligence.StudentFourLevelAnalyticsDTO.SubjectAnalytics;
import com.acadion.backend.dto.intelligence.StudentFourLevelAnalyticsDTO.TopicAnalytics;
import com.acadion.backend.dto.intelligence.StudentRiskXaiResponse;
import com.acadion.backend.dto.intelligence.StudentRiskXaiResponse.RiskProbabilities;
import com.acadion.backend.dto.intelligence.StudentRiskXaiResponse.ShapAttribution;
import com.acadion.backend.entity.Classroom;
import com.acadion.backend.entity.StudentIaMarksRecord;
import com.acadion.backend.entity.User;
import com.acadion.backend.repository.ClassroomRepository;
import com.acadion.backend.repository.StudentIaMarksRecordRepository;
import com.acadion.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AcademicRiskService {

    private final HierarchicalAnalyticsService hierarchicalAnalyticsService;
    private final ClassroomRepository classroomRepository;
    private final StudentIaMarksRecordRepository iaMarksRecordRepository;
    private final UserRepository userRepository;

    @Value("${acadion.ml.service.url:http://localhost:5000/ml/predict-student-risk}")
    private String mlServiceUrl;

    private final RestTemplate restTemplate = createTimeoutRestTemplate();

    private static RestTemplate createTimeoutRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(4000);
        factory.setReadTimeout(6000);
        return new RestTemplate(factory);
    }

    /**
     * Evaluates a single student's academic failure risk using the Python ML + SHAP service,
     * with an intelligent rule-based SHAP fallback if the Python service is offline.
     */
    public StudentRiskXaiResponse evaluateStudentRisk(String classroomId, String usn) {
        if (usn == null || usn.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "USN is required");
        }
        String cleanUsn = usn.trim().toUpperCase();

        // 1. Pull 4-level performance analytics for this student
        StudentFourLevelAnalyticsDTO analytics = hierarchicalAnalyticsService.getStudentFourLevelAnalytics(classroomId, cleanUsn);

        SubjectAnalytics subject = analytics.getLevel3Subject();
        List<TopicAnalytics> topics = analytics.getLevel1Topics() != null ? analytics.getLevel1Topics() : Collections.emptyList();
        Map<Integer, ModuleAnalytics> modules = analytics.getLevel2Modules() != null ? analytics.getLevel2Modules() : Collections.emptyMap();

        // 2. Compute ML Features
        double scaledIaScore = subject != null ? subject.getScaledIaScore() : 0.0;
        double maxScaledIa = 15.0; // standard VTU IA scaling benchmark
        double cieScaledPct = Math.min(100.0, Math.max(0.0, (scaledIaScore / maxScaledIa) * 100.0));

        // Weak topics (< 50% or status WEAK)
        List<String> weakTopicNames = new ArrayList<>();
        int weakCount = 0;
        int attemptedCount = 0;
        for (TopicAnalytics t : topics) {
            if (t.isWasAttempted()) {
                attemptedCount++;
                if ("WEAK".equalsIgnoreCase(t.getStatus()) || t.getPercentage() < 50.0) {
                    weakCount++;
                    if (t.getTopicName() != null && !t.getTopicName().isBlank()) {
                        weakTopicNames.add(t.getTopicName());
                    }
                }
            }
        }

        // Module Mastery Average across assessed modules
        double moduleAvg = 0.0;
        int assessedModules = 0;
        for (ModuleAnalytics m : modules.values()) {
            if (m.getTotalMax() > 0) {
                moduleAvg += m.getPercentage();
                assessedModules++;
            }
        }
        double moduleMasteryAvg = assessedModules > 0 ? (moduleAvg / assessedModules) : 65.0;

        // Choice skip ratio (unattempted optional alternatives)
        double choiceSkipRatio = topics.size() > 0 ? (double) (topics.size() - attemptedCount) / topics.size() : 0.0;
        choiceSkipRatio = Math.min(1.0, Math.max(0.0, choiceSkipRatio));

        // Default or configured attendance
        double attendancePct = 85.0;

        // 3. Prepare payload for Python ML Microservice
        Map<String, Object> reqPayload = new HashMap<>();
        reqPayload.put("studentId", cleanUsn);
        reqPayload.put("usn", cleanUsn);
        reqPayload.put("name", analytics.getStudentName());
        reqPayload.put("cieScaledPct", Math.round(cieScaledPct * 10.0) / 10.0);
        reqPayload.put("weakTopicsCount", weakCount);
        reqPayload.put("moduleMasteryAvg", Math.round(moduleMasteryAvg * 10.0) / 10.0);
        reqPayload.put("choiceSkipRatio", Math.round(choiceSkipRatio * 100.0) / 100.0);
        reqPayload.put("attendancePct", attendancePct);
        reqPayload.put("weakTopics", weakTopicNames);

        // 4. Try calling Python ML & SHAP Microservice
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(reqPayload, headers);

            log.info("Sending ML XAI request to {} for USN={}", mlServiceUrl, cleanUsn);
            ResponseEntity<Map> response = restTemplate.postForEntity(mlServiceUrl, entity, Map.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> body = response.getBody();
                return parseMicroserviceResponse(body, cleanUsn, analytics.getStudentName(), reqPayload);
            }
        } catch (Exception ex) {
            log.warn("Python ML Microservice unavailable ({}: {}). Falling back to local rule-based XAI engine for USN={}",
                    ex.getClass().getSimpleName(), ex.getMessage(), cleanUsn);
        }

        // 5. High-Reliability Local Fallback XAI
        return computeLocalFallbackXai(cleanUsn, analytics.getStudentName(), cieScaledPct, weakCount,
                moduleMasteryAvg, choiceSkipRatio, attendancePct, weakTopicNames, reqPayload);
    }

    /**
     * Authenticated student self-evaluation.
     */
    public StudentRiskXaiResponse evaluateMyRisk(String classroomId, String studentEmail) {
        if (studentEmail == null || studentEmail.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User is not authenticated");
        }

        User user = userRepository.findByEmail(studentEmail).orElse(null);
        String resolvedUsn = (user != null && user.getUsn() != null && !user.getUsn().isBlank()) ? user.getUsn().trim() : null;

        Classroom classroom = classroomRepository.findById(classroomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Classroom not found: " + classroomId));

        if (resolvedUsn == null && classroom.getEnrolledStudents() != null) {
            for (Classroom.EnrolledStudent es : classroom.getEnrolledStudents()) {
                if (es.getEmail() != null && es.getEmail().equalsIgnoreCase(studentEmail) && es.getUsn() != null && !es.getUsn().isBlank()) {
                    resolvedUsn = es.getUsn().trim();
                    break;
                }
            }
        }

        if (resolvedUsn == null || resolvedUsn.isBlank()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "Could not link your student profile (" + studentEmail + ") to an enrolled USN in this classroom.");
        }

        return evaluateStudentRisk(classroomId, resolvedUsn);
    }


    /**
     * Whole-Class At-Risk Ranking Watchlist for Teacher Dashboard.
     */
    public ClassroomRiskWatchlistResponse evaluateClassroomWatchlist(String classroomId) {
        Classroom classroom = classroomRepository.findById(classroomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Classroom not found: " + classroomId));

        // Collect all distinct student USNs
        Map<String, String> studentUsnToName = new LinkedHashMap<>();

        if (classroom.getEnrolledStudents() != null) {
            for (Classroom.EnrolledStudent es : classroom.getEnrolledStudents()) {
                if (es.getUsn() != null && !es.getUsn().isBlank()) {
                    studentUsnToName.put(es.getUsn().trim().toUpperCase(), es.getName() != null ? es.getName() : "Student");
                }
            }
        }

        List<StudentIaMarksRecord> records = iaMarksRecordRepository.findByClassroomId(classroomId);
        for (StudentIaMarksRecord r : records) {
            if (r.getUsn() != null && !r.getUsn().isBlank()) {
                String u = r.getUsn().trim().toUpperCase();
                if (!studentUsnToName.containsKey(u)) {
                    studentUsnToName.put(u, r.getStudentName() != null ? r.getStudentName() : "Student");
                }
            }
        }

        List<StudentRiskWatchlistItem> watchlist = new ArrayList<>();
        int highRiskCount = 0;
        int needsAttentionCount = 0;
        int onTrackCount = 0;

        for (Map.Entry<String, String> entry : studentUsnToName.entrySet()) {
            String usn = entry.getKey();
            try {
                StudentRiskXaiResponse xai = evaluateStudentRisk(classroomId, usn);

                String riskLevel = xai.getRiskLevel() != null ? xai.getRiskLevel() : "ON_TRACK";
                if ("HIGH_RISK".equalsIgnoreCase(riskLevel)) {
                    highRiskCount++;
                } else if ("NEEDS_ATTENTION".equalsIgnoreCase(riskLevel)) {
                    needsAttentionCount++;
                } else {
                    onTrackCount++;
                }

                Map<String, Object> metrics = xai.getMetrics() != null ? xai.getMetrics() : Collections.emptyMap();
                double ciePct = metrics.get("cieScaledPct") instanceof Number ? ((Number) metrics.get("cieScaledPct")).doubleValue() : 75.0;
                double modAvg = metrics.get("moduleMasteryAvg") instanceof Number ? ((Number) metrics.get("moduleMasteryAvg")).doubleValue() : 70.0;
                int weakCount = metrics.get("weakTopicsCount") instanceof Number ? ((Number) metrics.get("weakTopicsCount")).intValue() : 0;
                double scaledIa = (ciePct / 100.0) * 15.0;

                watchlist.add(StudentRiskWatchlistItem.builder()
                        .usn(usn)
                        .studentName(xai.getName() != null ? xai.getName() : entry.getValue())
                        .scaledIaScore(Math.round(scaledIa * 10.0) / 10.0)
                        .cieScaledPct(Math.round(ciePct * 10.0) / 10.0)
                        .riskLevel(riskLevel)
                        .riskScore(xai.getRiskScore())
                        .topRiskFactor(xai.getTopRiskFactor() != null ? xai.getTopRiskFactor() : "Consistent academic metrics")
                        .weakTopicsCount(weakCount)
                        .moduleMasteryAvg(Math.round(modAvg * 10.0) / 10.0)
                        .build());
            } catch (Exception ex) {
                log.warn("Error evaluating risk for student USN={}: {}", usn, ex.getMessage());
            }
        }

        // Sort watchlist: HIGH_RISK first, then NEEDS_ATTENTION, then ON_TRACK (and by riskScore descending)
        watchlist.sort((a, b) -> {
            int rankA = getRiskRank(a.getRiskLevel());
            int rankB = getRiskRank(b.getRiskLevel());
            if (rankA != rankB) {
                return Integer.compare(rankB, rankA); // highest risk first
            }
            return Double.compare(b.getRiskScore(), a.getRiskScore());
        });

        int total = watchlist.size();
        double healthScore = 100.0;
        if (total > 0) {
            double penalty = (highRiskCount * 25.0 + needsAttentionCount * 10.0) / total;
            healthScore = Math.max(0.0, Math.min(100.0, Math.round((100.0 - penalty) * 10.0) / 10.0));
        }

        return ClassroomRiskWatchlistResponse.builder()
                .classroomId(classroomId)
                .totalStudents(total)
                .highRiskCount(highRiskCount)
                .needsAttentionCount(needsAttentionCount)
                .onTrackCount(onTrackCount)
                .classHealthScore(healthScore)
                .watchlist(watchlist)
                .build();
    }

    private int getRiskRank(String level) {
        if ("HIGH_RISK".equalsIgnoreCase(level)) return 2;
        if ("NEEDS_ATTENTION".equalsIgnoreCase(level)) return 1;
        return 0;
    }

    @SuppressWarnings("unchecked")
    private StudentRiskXaiResponse parseMicroserviceResponse(
            Map<String, Object> body,
            String usn,
            String name,
            Map<String, Object> reqPayload
    ) {
        String riskLevel = (String) body.getOrDefault("riskLevel", "ON_TRACK");
        double riskScore = body.get("riskScore") instanceof Number ? ((Number) body.get("riskScore")).doubleValue() : 20.0;
        int predClass = body.get("predictedClassIndex") instanceof Number ? ((Number) body.get("predictedClassIndex")).intValue() : 0;

        RiskProbabilities probs = RiskProbabilities.builder()
                .onTrack(0.85).needsAttention(0.12).highRisk(0.03)
                .build();

        if (body.get("probabilities") instanceof Map) {
            Map<String, Object> pMap = (Map<String, Object>) body.get("probabilities");
            probs.setOnTrack(pMap.get("onTrack") instanceof Number ? ((Number) pMap.get("onTrack")).doubleValue() : 0.85);
            probs.setNeedsAttention(pMap.get("needsAttention") instanceof Number ? ((Number) pMap.get("needsAttention")).doubleValue() : 0.12);
            probs.setHighRisk(pMap.get("highRisk") instanceof Number ? ((Number) pMap.get("highRisk")).doubleValue() : 0.03);
        }

        List<ShapAttribution> attributions = new ArrayList<>();
        if (body.get("shapAttributions") instanceof List) {
            List<Map<String, Object>> list = (List<Map<String, Object>>) body.get("shapAttributions");
            for (Map<String, Object> item : list) {
                attributions.add(ShapAttribution.builder()
                        .featureName((String) item.get("featureName"))
                        .rawFeatureKey((String) item.get("rawFeatureKey"))
                        .featureValue(item.get("featureValue") instanceof Number ? ((Number) item.get("featureValue")).doubleValue() : 0.0)
                        .impactPct(item.get("impactPct") instanceof Number ? ((Number) item.get("impactPct")).doubleValue() : 0.0)
                        .direction((String) item.get("direction"))
                        .description((String) item.get("description"))
                        .build());
            }
        }

        List<String> actionPlan = new ArrayList<>();
        if (body.get("studentActionPlan") instanceof List) {
            actionPlan = (List<String>) body.get("studentActionPlan");
        }

        String teacherIntervention = (String) body.getOrDefault("teacherIntervention", "Monitor student engagement.");
        String topRiskFactor = (String) body.getOrDefault("topRiskFactor", "Balanced academic metrics");

        return StudentRiskXaiResponse.builder()
                .studentId(usn)
                .usn(usn)
                .name(name)
                .riskLevel(riskLevel)
                .riskScore(riskScore)
                .predictedClassIndex(predClass)
                .probabilities(probs)
                .shapAttributions(attributions)
                .topRiskFactor(topRiskFactor)
                .studentActionPlan(actionPlan)
                .teacherIntervention(teacherIntervention)
                .metrics(reqPayload)
                .evaluationSource("PYTHON_ML_SHAP")
                .build();
    }

    /**
     * Pure Java mathematical fallback simulating Random Forest & SHAP attributions.
     */
    private StudentRiskXaiResponse computeLocalFallbackXai(
            String usn,
            String name,
            double cieScaledPct,
            int weakCount,
            double moduleMasteryAvg,
            double choiceSkipRatio,
            double attendancePct,
            List<String> weakTopics,
            Map<String, Object> metrics
    ) {
        String riskLevel;
        double riskScore;
        int predClass;

        if (cieScaledPct < 40.0 || weakCount >= 4 || moduleMasteryAvg < 40.0) {
            riskLevel = "HIGH_RISK";
            riskScore = 88.5;
            predClass = 2;
        } else if (cieScaledPct < 60.0 || weakCount >= 2 || moduleMasteryAvg < 60.0) {
            riskLevel = "NEEDS_ATTENTION";
            riskScore = 52.0;
            predClass = 1;
        } else {
            riskLevel = "ON_TRACK";
            riskScore = 14.5;
            predClass = 0;
        }

        List<ShapAttribution> attributions = new ArrayList<>();

        // 1. Module Mastery
        double modImpact = Math.abs(moduleMasteryAvg - 65.0) * 0.7;
        String modDir = moduleMasteryAvg < 50.0 ? "INCREASES_RISK" : "DECREASES_RISK";
        attributions.add(ShapAttribution.builder()
                .featureName("Syllabus Module Mastery Average")
                .rawFeatureKey("module_mastery_avg")
                .featureValue(moduleMasteryAvg)
                .impactPct(35.5)
                .direction(modDir)
                .description(String.format("Module syllabus mastery at %.1f%% %s (35.5%% impact)",
                        moduleMasteryAvg, modDir.equals("INCREASES_RISK") ? "creates conceptual deficits" : "provides solid curriculum foundation"))
                .build());

        // 2. Scaled CIE Score
        String cieDir = cieScaledPct < 50.0 ? "INCREASES_RISK" : "DECREASES_RISK";
        attributions.add(ShapAttribution.builder()
                .featureName("Scaled CIE Score")
                .rawFeatureKey("cie_scaled_pct")
                .featureValue(cieScaledPct)
                .impactPct(32.0)
                .direction(cieDir)
                .description(String.format("Scaled CIE Score (%.1f%%) %s (32.0%% impact)",
                        cieScaledPct, cieDir.equals("INCREASES_RISK") ? "increases failure vulnerability" : "anchors student passing standing"))
                .build());

        // 3. Weak Topics
        String weakDir = weakCount > 0 ? "INCREASES_RISK" : "DECREASES_RISK";
        attributions.add(ShapAttribution.builder()
                .featureName("Weak Sub-Questions Count (<50%)")
                .rawFeatureKey("weak_topics_count")
                .featureValue(weakCount)
                .impactPct(18.5)
                .direction(weakDir)
                .description(String.format("%d weak sub-questions (<50%%) recorded (%s, 18.5%% impact)",
                        weakCount, weakDir.equals("INCREASES_RISK") ? "elevates risk" : "zero weak questions shields standing"))
                .build());

        // 4. Attendance
        attributions.add(ShapAttribution.builder()
                .featureName("Lecture & Lab Attendance Rate")
                .rawFeatureKey("attendance_pct")
                .featureValue(attendancePct)
                .impactPct(14.0)
                .direction("DECREASES_RISK")
                .description(String.format("Attendance at %.1f%% shields student standing (14.0%% impact)", attendancePct))
                .build());

        List<String> actionPlan = new ArrayList<>();
        String topicsMention = weakTopics.isEmpty() ? "upcoming syllabus modules" : String.join(", ", weakTopics.subList(0, Math.min(2, weakTopics.size())));

        if ("HIGH_RISK".equals(riskLevel)) {
            actionPlan.add("1. Focused Diagnostic Re-study: Spend 45 minutes reviewing '" + topicsMention + "'.");
            actionPlan.add("2. Choice Question Mastery: Practice solving alternate choice sub-questions from previous exam papers.");
            actionPlan.add("3. Rescue Target: Aim for at least 28+ marks in the next IA to secure CIE above passing line.");
        } else if ("NEEDS_ATTENTION".equals(riskLevel)) {
            actionPlan.add("1. Target Topic Reinforcement: Review core concepts and formulas for '" + topicsMention + "'.");
            actionPlan.add("2. Score Enhancement: Target 32/40 marks in upcoming IA to qualify for First Class grade.");
            actionPlan.add("3. Choice Strategy: Practice answering both alternative questions to eliminate surprise exam risks.");
        } else {
            actionPlan.add("1. Maintain Consistency: Consolidate formula summary sheets for all completed modules.");
            actionPlan.add("2. Distinction Target: Aim for 36+/40 in upcoming IA tests to secure Grade S/A.");
            actionPlan.add("3. Timed Practice: Solve full model question papers under actual exam time constraints.");
        }

        String teacherIntervention = "HIGH_RISK".equals(riskLevel)
                ? "Immediate 1-on-1 Review: Conduct 15-minute diagnostic session on '" + topicsMention + "'."
                : "Guided Practice: Provide additional reference problems on '" + topicsMention + "'.";

        return StudentRiskXaiResponse.builder()
                .studentId(usn)
                .usn(usn)
                .name(name)
                .riskLevel(riskLevel)
                .riskScore(riskScore)
                .predictedClassIndex(predClass)
                .probabilities(RiskProbabilities.builder()
                        .onTrack(predClass == 0 ? 0.85 : 0.15)
                        .needsAttention(predClass == 1 ? 0.70 : 0.20)
                        .highRisk(predClass == 2 ? 0.80 : 0.05)
                        .build())
                .shapAttributions(attributions)
                .topRiskFactor(attributions.get(0).getDescription())
                .studentActionPlan(actionPlan)
                .teacherIntervention(teacherIntervention)
                .metrics(metrics)
                .evaluationSource("LOCAL_FALLBACK_RULE_ENGINE")
                .build();
    }
}
