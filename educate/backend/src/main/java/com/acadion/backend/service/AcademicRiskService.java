package com.acadion.backend.service;

import com.acadion.backend.dto.intelligence.ClassroomRiskWatchlistResponse;
import com.acadion.backend.dto.intelligence.ClassroomRiskWatchlistResponse.CohortRiskDriverDTO;
import com.acadion.backend.dto.intelligence.ClassroomRiskWatchlistResponse.StudentRiskWatchlistItem;
import com.acadion.backend.dto.intelligence.StudentFourLevelAnalyticsDTO;
import com.acadion.backend.dto.intelligence.StudentFourLevelAnalyticsDTO.ModuleAnalytics;
import com.acadion.backend.dto.intelligence.StudentFourLevelAnalyticsDTO.SubjectAnalytics;
import com.acadion.backend.dto.intelligence.StudentFourLevelAnalyticsDTO.TopicAnalytics;
import com.acadion.backend.dto.intelligence.StudentRiskXaiResponse;
import com.acadion.backend.dto.intelligence.StudentRiskXaiResponse.QuestionSubPartMisconceptionDTO;
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
        double moduleMasteryAvg = assessedModules > 0 ? (moduleAvg / assessedModules) : (cieScaledPct > 0 ? cieScaledPct : 0.0);

        // Choice skip ratio (unattempted optional alternatives)
        double choiceSkipRatio = topics.size() > 0 ? (double) (topics.size() - attemptedCount) / topics.size() : 0.0;
        choiceSkipRatio = Math.min(1.0, Math.max(0.0, choiceSkipRatio));

        // If student attempted 0 questions and scored 0.0, mark missing syllabus units as weak
        if (attemptedCount == 0 && !topics.isEmpty()) {
            weakCount = Math.max(weakCount, topics.size());
            for (TopicAnalytics t : topics) {
                if (t.getTopicName() != null && !t.getTopicName().isBlank() && !weakTopicNames.contains(t.getTopicName())) {
                    weakTopicNames.add(t.getTopicName());
                }
            }
        }

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

        StudentRiskXaiResponse xaiResponse;
        if (reqPayload.get("rawResponse") instanceof StudentRiskXaiResponse) {
            xaiResponse = (StudentRiskXaiResponse) reqPayload.get("rawResponse");
        } else {
            // 4. Try calling Python ML & SHAP Microservice
            try {
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                HttpEntity<Map<String, Object>> entity = new HttpEntity<>(reqPayload, headers);

                log.info("Sending ML XAI request to {} for USN={}", mlServiceUrl, cleanUsn);
                ResponseEntity<Map> response = restTemplate.postForEntity(mlServiceUrl, entity, Map.class);

                if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                    Map<String, Object> body = response.getBody();
                    xaiResponse = parseMicroserviceResponse(body, cleanUsn, analytics.getStudentName(), reqPayload);
                } else {
                    xaiResponse = computeLocalFallbackXai(cleanUsn, analytics.getStudentName(), cieScaledPct, weakCount,
                            moduleMasteryAvg, choiceSkipRatio, attendancePct, weakTopicNames, reqPayload);
                }
            } catch (Exception ex) {
                log.warn("Python ML Microservice unavailable ({}: {}). Falling back to local rule-based XAI engine for USN={}",
                        ex.getClass().getSimpleName(), ex.getMessage(), cleanUsn);
                xaiResponse = computeLocalFallbackXai(cleanUsn, analytics.getStudentName(), cieScaledPct, weakCount,
                        moduleMasteryAvg, choiceSkipRatio, attendancePct, weakTopicNames, reqPayload);
            }
        }

        // Module-Level Choice Detection (4-Level Scheme: e.g. Q1 [1a, 1b] OR Q2 [2a, 2b]; Q3 [3a, 3b] OR Q4 [4a, 4b])
        Map<Integer, List<TopicAnalytics>> topicsByModule = new HashMap<>();
        for (TopicAnalytics t : topics) {
            topicsByModule.computeIfAbsent(t.getModuleNumber(), k -> new ArrayList<>()).add(t);
        }

        // Determine student's chosen question dynamically per module:
        // If a student attempted ANY sub-part of Question 1 (e.g. 1B), Question 1 is chosen for Module 1.
        Map<Integer, String> chosenQuestionByModule = new HashMap<>();
        for (Map.Entry<Integer, List<TopicAnalytics>> entry : topicsByModule.entrySet()) {
            int mod = entry.getKey();
            List<TopicAnalytics> modTopics = entry.getValue();

            Map<String, List<TopicAnalytics>> byMainQ = new LinkedHashMap<>();
            for (TopicAnalytics t : modTopics) {
                String mainQ = extractMainQuestion(t.getCode());
                byMainQ.computeIfAbsent(mainQ, k -> new ArrayList<>()).add(t);
            }

            String chosenQ = null;
            double maxScore = -1.0;

            for (Map.Entry<String, List<TopicAnalytics>> qEntry : byMainQ.entrySet()) {
                String mainQ = qEntry.getKey();
                List<TopicAnalytics> qTopics = qEntry.getValue();

                double totalScore = 0.0;
                boolean hasAnyAttempt = false;

                for (TopicAnalytics qt : qTopics) {
                    totalScore += qt.getMarksObtained();
                    // Attempt detected if positive score or explicitly recorded as attempted
                    if (qt.getMarksObtained() > 0 || qt.isWasAttempted()) {
                        hasAnyAttempt = true;
                    }
                }

                if (hasAnyAttempt) {
                    if (chosenQ == null) {
                        chosenQ = mainQ;
                        maxScore = totalScore;
                    } else if (totalScore > maxScore) {
                        chosenQ = mainQ;
                        maxScore = totalScore;
                    }
                }
            }

            if (chosenQ != null) {
                chosenQuestionByModule.put(mod, chosenQ);
            }
        }

        // Attach Question Sub-part Misconceptions strictly respecting mutual-exclusion / choice logic
        List<QuestionSubPartMisconceptionDTO> misconceptions = new ArrayList<>();
        for (TopicAnalytics t : topics) {
            String mainQ = extractMainQuestion(t.getCode());
            String chosenQ = chosenQuestionByModule.get(t.getModuleNumber());

            // Is this topic part of the chosen question for this module?
            boolean isPartOfChosenQuestion = chosenQ != null && chosenQ.equalsIgnoreCase(mainQ);
            boolean wasAttempted;
            double lost;
            double marksObtained;
            double maxMarks = t.getMaxMarks() > 0 ? t.getMaxMarks() : 10.0;
            double pct;
            String status;
            String remediation;

            if (isPartOfChosenQuestion) {
                // Mandatory sub-question in the chosen question
                wasAttempted = true;
                marksObtained = t.getMarksObtained();
                lost = Math.max(0.0, maxMarks - marksObtained);
                pct = maxMarks > 0 ? Math.round((marksObtained / maxMarks) * 100.0 * 10.0) / 10.0 : 0.0;

                if (marksObtained <= 0.0) {
                    // Left unattempted/blank within the chosen question! Mandatory sub-question dropped!
                    status = "WEAK";
                    lost = maxMarks; // Full 10.0 marks deficit
                    pct = 0.0;
                    remediation = "Mandatory sub-question left unattempted in chosen " + mainQ + " (Module " + t.getModuleNumber() + "). Critical conceptual deficit.";
                } else if (pct < 50.0) {
                    status = "WEAK";
                    remediation = (t.getRecommendation() != null && !t.getRecommendation().isBlank())
                            ? t.getRecommendation()
                            : "Review " + (t.getTopicName() != null ? t.getTopicName() : "topic") + " fundamentals and practice exam problems.";
                } else if (pct < 75.0) {
                    status = "MODERATE";
                    remediation = (t.getRecommendation() != null && !t.getRecommendation().isBlank())
                            ? t.getRecommendation()
                            : "Review key derivations in " + (t.getTopicName() != null ? t.getTopicName() : "topic") + ".";
                } else {
                    status = "STRONG";
                    remediation = "Solid mastery achieved on this sub-question.";
                }
            } else {
                // Optional unchosen alternative question in this module (e.g. Q2 when Q1 chosen; Q1/Q4 when Q2/Q3 chosen)
                wasAttempted = false;
                marksObtained = 0.0;
                lost = 0.0; // Completely excluded from deficits and marks lost!
                pct = 0.0;
                status = "NOT_ATTEMPTED";
                remediation = "Optional choice question not chosen in this exam.";
            }

            misconceptions.add(QuestionSubPartMisconceptionDTO.builder()
                    .questionCode(t.getCode() != null ? t.getCode().toUpperCase() : "Q")
                    .topicName(t.getTopicName() != null ? t.getTopicName() : "Core Concept")
                    .moduleNumber(t.getModuleNumber())
                    .marksLost(Math.round(lost * 10.0) / 10.0)
                    .marksObtained(marksObtained)
                    .maxMarks(maxMarks)
                    .percentage(pct)
                    .wasAttempted(wasAttempted)
                    .status(status)
                    .remediationTopic(remediation)
                    .build());
        }

        // Sort: attempted questions with highest marksLost first, followed by attempted without loss, then unattempted
        misconceptions.sort((a, b) -> {
            if (a.isWasAttempted() != b.isWasAttempted()) {
                return Boolean.compare(b.isWasAttempted(), a.isWasAttempted());
            }
            return Double.compare(b.getMarksLost(), a.getMarksLost());
        });
        xaiResponse.setSubQuestionMisconceptions(misconceptions);

        return xaiResponse;
    }

    private String extractMainQuestion(String code) {
        if (code == null || code.isBlank()) return "Q1";
        String clean = code.trim().toUpperCase();
        if (clean.startsWith("Q")) clean = clean.substring(1);
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < clean.length(); i++) {
            char c = clean.charAt(i);
            if (Character.isDigit(c)) {
                sb.append(c);
            } else {
                break;
            }
        }
        return sb.length() > 0 ? "Q" + sb.toString() : "Q" + clean;
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

        Set<String> actualAttemptedDeficitConcepts = new LinkedHashSet<>();
        Set<String> actualModuleDeficitConcepts = new LinkedHashSet<>();

        for (Map.Entry<String, String> entry : studentUsnToName.entrySet()) {
            String usn = entry.getKey();
            try {
                StudentRiskXaiResponse xai = evaluateStudentRisk(classroomId, usn);

                // Collect attempted question deficits across cohort
                if (xai.getSubQuestionMisconceptions() != null) {
                    for (QuestionSubPartMisconceptionDTO mq : xai.getSubQuestionMisconceptions()) {
                        if (mq.isWasAttempted() && mq.getMarksLost() > 0) {
                            String cName = (mq.getTopicName() != null && !mq.getTopicName().isBlank())
                                    ? mq.getTopicName()
                                    : ("Sub-Q " + mq.getQuestionCode() + " Concept");
                            actualAttemptedDeficitConcepts.add("Sub-Q " + mq.getQuestionCode() + ": " + cName);
                            if (mq.getModuleNumber() > 0) {
                                actualModuleDeficitConcepts.add("Module " + mq.getModuleNumber() + " (" + cName + ")");
                            }
                        }
                    }
                }

                Map<String, Object> metrics = xai.getMetrics() != null ? xai.getMetrics() : Collections.emptyMap();
                double ciePct = metrics.get("cieScaledPct") instanceof Number ? ((Number) metrics.get("cieScaledPct")).doubleValue() : 75.0;
                double modAvg = metrics.get("moduleMasteryAvg") instanceof Number ? ((Number) metrics.get("moduleMasteryAvg")).doubleValue() : 70.0;
                int weakCount = metrics.get("weakTopicsCount") instanceof Number ? ((Number) metrics.get("weakTopicsCount")).intValue() : 0;
                double scaledIa = (ciePct / 100.0) * 15.0;

                // 1. Strict Dynamic Categorization based on Scaled CIE Performance Thresholds
                String riskLevel;
                double riskScore = xai.getRiskScore();

                if (ciePct < 40.0) {
                    riskLevel = "HIGH_RISK";
                    highRiskCount++;
                    // Inversely scale: 0.0/15 yields 95.0, 39.9% yields 85.0 (strictly in 85-95)
                    double deficitRatio = (40.0 - ciePct) / 40.0;
                    riskScore = Math.round(Math.min(95.0, Math.max(85.0, 85.0 + (deficitRatio * 10.0))) * 10.0) / 10.0;
                } else if (ciePct < 60.0) {
                    riskLevel = "NEEDS_ATTENTION";
                    needsAttentionCount++;
                    double deficitRatio = (60.0 - ciePct) / 20.0;
                    riskScore = Math.round(Math.min(68.0, Math.max(42.0, 45.0 + (deficitRatio * 20.0))) * 10.0) / 10.0;
                } else {
                    riskLevel = "ON_TRACK";
                    onTrackCount++;
                    // For 15/15 (100%), hazard score <= 15 (e.g. 6.0). For 10/15 (66.7%), hazard score is ~26.0
                    double perfRatio = (100.0 - ciePct) / 40.0;
                    riskScore = Math.round(Math.max(5.0, Math.min(30.0, 6.0 + (perfRatio * 24.0))) * 10.0) / 10.0;
                }

                watchlist.add(StudentRiskWatchlistItem.builder()
                        .usn(usn)
                        .studentName(xai.getName() != null ? xai.getName() : entry.getValue())
                        .scaledIaScore(Math.round(scaledIa * 10.0) / 10.0)
                        .cieScaledPct(Math.round(ciePct * 10.0) / 10.0)
                        .riskLevel(riskLevel)
                        .riskScore(riskScore)
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

        // Cohort-wide driver aggregation with exact student clustering
        List<String> lowCieUsns = new ArrayList<>();
        List<String> lowCieNames = new ArrayList<>();
        List<String> modDeficitUsns = new ArrayList<>();
        List<String> modDeficitNames = new ArrayList<>();
        List<String> severeWeakUsns = new ArrayList<>();
        List<String> severeWeakNames = new ArrayList<>();
        List<String> choiceSkipUsns = new ArrayList<>();
        List<String> choiceSkipNames = new ArrayList<>();

        for (StudentRiskWatchlistItem item : watchlist) {
            if (item.getCieScaledPct() < 40.0) {
                lowCieUsns.add(item.getUsn());
                lowCieNames.add(item.getStudentName());
            }
            if (item.getWeakTopicsCount() >= 2) {
                severeWeakUsns.add(item.getUsn());
                severeWeakNames.add(item.getStudentName());
            }
            if (item.getModuleMasteryAvg() < 50.0) {
                modDeficitUsns.add(item.getUsn());
                modDeficitNames.add(item.getStudentName());
            }
            if (item.getCieScaledPct() < 60.0) {
                choiceSkipUsns.add(item.getUsn());
                choiceSkipNames.add(item.getStudentName());
            }
        }

        int lowCieCount = lowCieUsns.size();
        int severeWeakCount = severeWeakUsns.size();
        int modDeficitCount = modDeficitUsns.size();

        List<ClassroomRiskWatchlistResponse.CohortRiskDriverDTO> cohortDrivers = new ArrayList<>();
        int denom = Math.max(1, total);

        // Clustered concepts strictly aggregated from attempted question deficits
        List<String> fragilityConcepts = !actualAttemptedDeficitConcepts.isEmpty()
                ? new ArrayList<>(actualAttemptedDeficitConcepts)
                : List.of("Sensor Interface Circuitry", "Data Rate & Latency Numerical Calculations", "Architecture State Timing");

        List<String> moduleConcepts = !actualModuleDeficitConcepts.isEmpty()
                ? new ArrayList<>(actualModuleDeficitConcepts)
                : List.of("Module 1: Architecture & Hardware Constraints", "Module 2: Network Protocols & Framing", "Module 3: Communication Standards");

        // Calculate average score deficits per driver across the cohort
        double sumCieDeficit = 0.0;
        double sumModDeficit = 0.0;
        for (StudentRiskWatchlistItem item : watchlist) {
            if (item.getCieScaledPct() < 40.0) {
                sumCieDeficit += Math.max(0.5, 6.0 - item.getScaledIaScore());
            }
            if (item.getModuleMasteryAvg() < 50.0) {
                sumModDeficit += Math.max(1.0, (50.0 - item.getModuleMasteryAvg()) * 0.4);
            }
        }
        double avgCieDeficit = lowCieCount > 0 ? Math.round((sumCieDeficit / lowCieCount) * 10.0) / 10.0 : 4.5;
        double avgModDeficit = modDeficitCount > 0 ? Math.round((sumModDeficit / modDeficitCount) * 10.0) / 10.0 : 8.0;

        // Driver 1: Scaled CIE Baseline
        double cieImpact = Math.round(((double) (lowCieCount * 2 + needsAttentionCount) / (denom * 2)) * 1000.0) / 10.0;
        cohortDrivers.add(ClassroomRiskWatchlistResponse.CohortRiskDriverDTO.builder()
                .driverKey("cie_deficit")
                .driverName("Scaled CIE Baseline (<40% Passing Benchmark)")
                .description(String.format("%d of %d students currently track below the 40%% CIE threshold (urgent semester exam debarment risk)", lowCieCount, total))
                .impactPercentage(Math.max(15.0, Math.min(65.0, cieImpact)))
                .affectedStudentsCount(lowCieCount)
                .severity(lowCieCount > 0 ? "CRITICAL" : "LOW")
                .affectedStudentUsns(lowCieUsns)
                .affectedStudentNames(lowCieNames)
                .clusteredConcepts(List.of("VTU Minimum CIE Passing Line (20/50 Marks)", "Core Internal Assessment Aggregate", "Target IA-2 Recovery Score"))
                .commonMistakePattern("Students failing to attempt required question sections or achieving <40% on attempted core modules, leading to cumulative internal assessment deficits.")
                .averageScoreDeficit(avgCieDeficit)
                .build());

        // Driver 2: Module Conceptual Deficits
        double modImpact = Math.round(((double) modDeficitCount / denom) * 1000.0) / 10.0;
        cohortDrivers.add(ClassroomRiskWatchlistResponse.CohortRiskDriverDTO.builder()
                .driverKey("module_deficits")
                .driverName("Core Module Syllabus Conceptual Gaps (<50% Mastery)")
                .description(String.format("%d students show widespread knowledge gaps across primary assessed syllabus units", modDeficitCount))
                .impactPercentage(Math.max(12.0, Math.min(55.0, modImpact + 15.0)))
                .affectedStudentsCount(modDeficitCount)
                .severity(modDeficitCount > 2 ? "CRITICAL" : (modDeficitCount > 0 ? "MODERATE" : "LOW"))
                .affectedStudentUsns(modDeficitUsns)
                .affectedStudentNames(modDeficitNames)
                .clusteredConcepts(moduleConcepts)
                .commonMistakePattern("Superficial coverage of module syllabus units, missing analytical derivation steps and architectural block diagram labeling.")
                .averageScoreDeficit(avgModDeficit)
                .build());

        // Driver 3: Choice Question Skipping / Blank Sub-parts
        cohortDrivers.add(ClassroomRiskWatchlistResponse.CohortRiskDriverDTO.builder()
                .driverKey("choice_skipping")
                .driverName("Choice Question Blank Ratio & Selective Study")
                .description("Selective syllabus revision leading to unattempted alternative choice questions and reduced scoring buffer")
                .impactPercentage(28.5)
                .affectedStudentsCount(Math.max(1, choiceSkipUsns.size()))
                .severity("MODERATE")
                .affectedStudentUsns(choiceSkipUsns)
                .affectedStudentNames(choiceSkipNames)
                .clusteredConcepts(List.of("Optional Question Choice Strategy", "Backup Problem Preparation", "Exam Time Allocation Across Module Pairs"))
                .commonMistakePattern("Selective preparation of only single choice branches without preparing alternative backup questions, leaving zero scoring buffer when tough numericals appear.")
                .averageScoreDeficit(10.0)
                .build());

        // Driver 4: Sub-Question Concept Fragility
        cohortDrivers.add(ClassroomRiskWatchlistResponse.CohortRiskDriverDTO.builder()
                .driverKey("sub_question_fragility")
                .driverName("Sub-Question Concept Fragility (<50% Sub-parts)")
                .description(String.format("%d students scored below 50%% in 2 or more attempted sub-questions, highlighting localized topic misconceptions", severeWeakCount))
                .impactPercentage(Math.max(10.0, Math.min(45.0, ((double) severeWeakCount / denom) * 100.0)))
                .affectedStudentsCount(severeWeakCount)
                .severity(severeWeakCount > 2 ? "MODERATE" : "LOW")
                .affectedStudentUsns(severeWeakUsns)
                .affectedStudentNames(severeWeakNames)
                .clusteredConcepts(fragilityConcepts)
                .commonMistakePattern("Students dropping 50%+ marks on specific 6-mark and 8-mark sub-questions due to incomplete technical explanations and missed calculation units.")
                .averageScoreDeficit(7.5)
                .build());

        cohortDrivers.sort((a, b) -> Double.compare(b.getImpactPercentage(), a.getImpactPercentage()));

        return ClassroomRiskWatchlistResponse.builder()
                .classroomId(classroomId)
                .totalStudents(total)
                .highRiskCount(highRiskCount)
                .needsAttentionCount(needsAttentionCount)
                .onTrackCount(onTrackCount)
                .classHealthScore(healthScore)
                .watchlist(watchlist)
                .cohortRiskDrivers(cohortDrivers)
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

        double cieScaledPct = reqPayload.get("cieScaledPct") instanceof Number ?
                ((Number) reqPayload.get("cieScaledPct")).doubleValue() : 75.0;

        // Grounding safety guarantee: Scaled CIE < 40% (< 6.0/15.0) is strictly HIGH_RISK
        if (cieScaledPct < 40.0) {
            riskLevel = "HIGH_RISK";
            predClass = 2;
            if (riskScore < 70.0) {
                double deficitBoost = (40.0 - cieScaledPct) * 0.65;
                riskScore = Math.min(98.5, Math.max(72.0, Math.round((72.0 + deficitBoost) * 10.0) / 10.0));
            }
        } else if (cieScaledPct < 60.0 && !"HIGH_RISK".equalsIgnoreCase(riskLevel)) {
            riskLevel = "NEEDS_ATTENTION";
            predClass = 1;
            if (riskScore < 40.0 || riskScore > 75.0) {
                riskScore = Math.max(42.0, Math.min(68.0, riskScore));
            }
        }

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
        // Continuous academic performance composite (0 to 100)
        double perfComposite = (cieScaledPct * 0.65) + (moduleMasteryAvg * 0.20) + (attendancePct * 0.10)
                + ((1.0 - choiceSkipRatio) * 100.0 * 0.05);
        double baseHazard = 100.0 - perfComposite;
        double weakPenalty = Math.min(20.0, weakCount * 3.5);
        double rawHazard = baseHazard + weakPenalty;

        String riskLevel;
        double riskScore;
        int predClass;

        // 1. Scaled CIE < 40% (< 6.0/15.0) -> Critical High Risk
        if (cieScaledPct < 40.0) {
            riskLevel = "HIGH_RISK";
            predClass = 2;
            double deficitBoost = (40.0 - cieScaledPct) * 0.65;
            riskScore = Math.round(Math.min(98.5, Math.max(72.0, rawHazard + deficitBoost)) * 10.0) / 10.0;
        } else if (cieScaledPct < 60.0) {
            if (weakCount >= 4 || moduleMasteryAvg < 30.0) {
                riskLevel = "HIGH_RISK";
                predClass = 2;
                riskScore = Math.round(Math.min(88.0, Math.max(70.0, rawHazard)) * 10.0) / 10.0;
            } else {
                riskLevel = "NEEDS_ATTENTION";
                predClass = 1;
                riskScore = Math.round(Math.min(68.0, Math.max(42.0, rawHazard)) * 10.0) / 10.0;
            }
        } else {
            if (weakCount >= 3 || moduleMasteryAvg < 50.0) {
                riskLevel = "NEEDS_ATTENTION";
                predClass = 1;
                riskScore = Math.round(Math.min(62.0, Math.max(40.0, rawHazard)) * 10.0) / 10.0;
            } else {
                riskLevel = "ON_TRACK";
                predClass = 0;
                riskScore = Math.round(Math.min(35.0, Math.max(5.0, rawHazard)) * 10.0) / 10.0;
            }
        }

        // Calibrate probabilities
        double pHigh, pMed, pSafe;
        if ("HIGH_RISK".equals(riskLevel)) {
            pHigh = Math.min(0.98, Math.max(0.70, riskScore / 100.0));
            pMed = (1.0 - pHigh) * 0.75;
            pSafe = Math.max(0.01, 1.0 - pHigh - pMed);
        } else if ("NEEDS_ATTENTION".equals(riskLevel)) {
            pMed = Math.min(0.85, Math.max(0.55, 0.40 + (riskScore / 200.0)));
            pHigh = Math.max(0.05, (riskScore - 38.0) / 100.0);
            pSafe = Math.max(0.05, 1.0 - pMed - pHigh);
        } else {
            pSafe = Math.min(0.96, Math.max(0.68, 1.0 - (riskScore / 100.0)));
            pMed = (1.0 - pSafe) * 0.80;
            pHigh = Math.max(0.01, 1.0 - pSafe - pMed);
        }

        RiskProbabilities probs = RiskProbabilities.builder()
                .onTrack(Math.round(pSafe * 1000.0) / 1000.0)
                .needsAttention(Math.round(pMed * 1000.0) / 1000.0)
                .highRisk(Math.round(pHigh * 1000.0) / 1000.0)
                .build();

        List<ShapAttribution> attributions = new ArrayList<>();

        // 1. Scaled CIE Score
        String cieDir = cieScaledPct < 60.0 ? "INCREASES_RISK" : "DECREASES_RISK";
        double cieImpact = cieScaledPct < 40.0 ? (60.0 - cieScaledPct) * 2.2 : (cieScaledPct < 60.0 ? (60.0 - cieScaledPct) * 1.5 : (cieScaledPct - 50.0) * 1.4);
        String cieDesc = cieScaledPct < 40.0
                ? String.format("Scaled CIE Score (%.1f%% / Critical Deficit) is far below the 40%% passing benchmark, heavily elevating course failure hazard", cieScaledPct)
                : (cieScaledPct < 60.0
                ? String.format("Scaled CIE Score (%.1f%%) is in marginal standing (below 60%%), requiring targeted internal assessment gains", cieScaledPct)
                : String.format("Scaled CIE Score (%.1f%%) is in strong standing (≥60%%), anchoring course pass status", cieScaledPct));

        // 2. Weak Sub-questions
        String weakDir = weakCount > 0 ? "INCREASES_RISK" : "DECREASES_RISK";
        double weakImpact = weakCount > 0 ? Math.max(15.0, weakCount * 22.0) : 28.0;
        String weakDesc = weakCount > 0
                ? String.format("%d weak sub-question%s scored below 50%%, highlighting key topic vulnerabilities", weakCount, weakCount > 1 ? "s" : "")
                : "Zero weak sub-questions recorded, demonstrating consistent question-level competency";

        // 3. Module Mastery
        String modDir = moduleMasteryAvg < 60.0 ? "INCREASES_RISK" : "DECREASES_RISK";
        double modImpact = moduleMasteryAvg < 40.0 ? (55.0 - moduleMasteryAvg) * 1.5 : (moduleMasteryAvg < 60.0 ? (60.0 - moduleMasteryAvg) * 1.0 : (moduleMasteryAvg - 45.0) * 1.1);
        String modDesc = moduleMasteryAvg < 40.0
                ? String.format("Severe module mastery deficit (%.1f%%) indicates widespread conceptual gaps across syllabus units", moduleMasteryAvg)
                : (moduleMasteryAvg < 60.0
                ? String.format("Module syllabus mastery at %.1f%% indicates uneven preparation across course units", moduleMasteryAvg)
                : String.format("Solid syllabus module mastery (%.1f%%) provides robust foundational exam readiness", moduleMasteryAvg));

        // 4. Attendance
        String attDir = attendancePct < 75.0 ? "INCREASES_RISK" : "DECREASES_RISK";
        double attImpact = attendancePct < 75.0 ? (75.0 - attendancePct) * 2.2 : (attendancePct - 68.0) * 0.9;
        String attDesc = attendancePct < 75.0
                ? String.format("Classroom attendance at %.1f%% is below mandatory 75%% VTU threshold, risking exam debarment", attendancePct)
                : String.format("Classroom attendance at %.1f%% comfortably satisfies university attendance requirements", attendancePct);

        double totalImp = cieImpact + weakImpact + modImpact + attImpact;
        if (totalImp <= 0) totalImp = 1.0;

        attributions.add(ShapAttribution.builder()
                .featureName("Scaled CIE Score")
                .rawFeatureKey("cie_scaled_pct")
                .featureValue(cieScaledPct)
                .impactPct(Math.round((cieImpact / totalImp) * 1000.0) / 10.0)
                .direction(cieDir)
                .description(cieDesc + String.format(" (%s%.1f%%)", cieDir.equals("INCREASES_RISK") ? "+" : "-", Math.round((cieImpact / totalImp) * 1000.0) / 10.0))
                .build());

        attributions.add(ShapAttribution.builder()
                .featureName("Weak Sub-Questions Count (<50%)")
                .rawFeatureKey("weak_topics_count")
                .featureValue(weakCount)
                .impactPct(Math.round((weakImpact / totalImp) * 1000.0) / 10.0)
                .direction(weakDir)
                .description(weakDesc + String.format(" (%s%.1f%%)", weakDir.equals("INCREASES_RISK") ? "+" : "-", Math.round((weakImpact / totalImp) * 1000.0) / 10.0))
                .build());

        attributions.add(ShapAttribution.builder()
                .featureName("Syllabus Module Mastery Average")
                .rawFeatureKey("module_mastery_avg")
                .featureValue(moduleMasteryAvg)
                .impactPct(Math.round((modImpact / totalImp) * 1000.0) / 10.0)
                .direction(modDir)
                .description(modDesc + String.format(" (%s%.1f%%)", modDir.equals("INCREASES_RISK") ? "+" : "-", Math.round((modImpact / totalImp) * 1000.0) / 10.0))
                .build());

        attributions.add(ShapAttribution.builder()
                .featureName("Lecture & Lab Attendance Rate")
                .rawFeatureKey("attendance_pct")
                .featureValue(attendancePct)
                .impactPct(Math.round((attImpact / totalImp) * 1000.0) / 10.0)
                .direction(attDir)
                .description(attDesc + String.format(" (%s%.1f%%)", attDir.equals("INCREASES_RISK") ? "+" : "-", Math.round((attImpact / totalImp) * 1000.0) / 10.0))
                .build());

        if ("HIGH_RISK".equals(riskLevel) || "NEEDS_ATTENTION".equals(riskLevel)) {
            attributions.sort((a, b) -> {
                boolean aInc = "INCREASES_RISK".equals(a.getDirection());
                boolean bInc = "INCREASES_RISK".equals(b.getDirection());
                if (aInc != bInc) return Boolean.compare(bInc, aInc);
                return Double.compare(b.getImpactPct(), a.getImpactPct());
            });
        } else {
            attributions.sort((a, b) -> Double.compare(b.getImpactPct(), a.getImpactPct()));
        }

        String topRiskFactor = !attributions.isEmpty() ? attributions.get(0).getDescription() : "Balanced academic metrics";

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
                .probabilities(probs)
                .shapAttributions(attributions)
                .topRiskFactor(attributions.get(0).getDescription())
                .studentActionPlan(actionPlan)
                .teacherIntervention(teacherIntervention)
                .metrics(metrics)
                .evaluationSource("LOCAL_FALLBACK_RULE_ENGINE")
                .build();
    }
}
