package com.acadion.backend.service;

import com.acadion.backend.dto.intelligence.ClassroomAnalyticsSummaryDTO;
import com.acadion.backend.dto.intelligence.ClassroomAnalyticsSummaryDTO.QuestionAnalytics;
import com.acadion.backend.dto.intelligence.ClassroomAnalyticsSummaryDTO.StudentClassSummaryItem;
import com.acadion.backend.dto.intelligence.ClassroomAnalyticsSummaryDTO.StudentDistribution;
import com.acadion.backend.dto.intelligence.ClassroomAnalyticsSummaryDTO.SubQuestionAnalytics;
import com.acadion.backend.dto.intelligence.ClassroomAnalyticsSummaryDTO.TopicClassPerformance;
import com.acadion.backend.dto.intelligence.StudentFourLevelAnalyticsDTO;
import com.acadion.backend.dto.intelligence.StudentFourLevelAnalyticsDTO.ModuleAnalytics;
import com.acadion.backend.dto.intelligence.StudentFourLevelAnalyticsDTO.SemesterAnalytics;
import com.acadion.backend.dto.intelligence.StudentFourLevelAnalyticsDTO.SubjectAnalytics;
import com.acadion.backend.dto.intelligence.StudentFourLevelAnalyticsDTO.TopicAnalytics;
import com.acadion.backend.entity.*;
import com.acadion.backend.repository.ClassroomRepository;
import com.acadion.backend.repository.StudentIaMarksRecordRepository;
import com.acadion.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class HierarchicalAnalyticsService {

    private final ClassroomRepository classroomRepository;
    private final StudentIaMarksRecordRepository iaMarksRecordRepository;
    private final ClassroomPaperParserService paperParserService;
    private final SubjectEvaluationSchemeService schemeService;
    private final UserRepository userRepository;

    /**
     * Computes the complete 4-level hierarchical performance analytics for a specific student.
     */
    public StudentFourLevelAnalyticsDTO getStudentFourLevelAnalytics(String classroomId, String usn) {
        if (usn == null || usn.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "USN is required");
        }
        String cleanUsn = usn.trim().toUpperCase();

        Classroom classroom = classroomRepository.findById(classroomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Classroom not found: " + classroomId));

        SubjectEvaluationScheme scheme = schemeService.getOrCreateScheme(classroomId);
        List<StudentIaMarksRecord> records = iaMarksRecordRepository.findByClassroomIdAndUsnIgnoreCase(classroomId, cleanUsn);
        records.sort(Comparator.comparingInt(StudentIaMarksRecord::getIaNumber));

        String studentName = "Student (" + cleanUsn + ")";
        if (!records.isEmpty() && records.get(0).getStudentName() != null && !records.get(0).getStudentName().isBlank()) {
            studentName = records.get(0).getStudentName();
        } else if (classroom.getEnrolledStudents() != null) {
            for (Classroom.EnrolledStudent es : classroom.getEnrolledStudents()) {
                if (es.getUsn() != null && es.getUsn().equalsIgnoreCase(cleanUsn) && es.getName() != null) {
                    studentName = es.getName();
                    break;
                }
            }
        }

        // =========================================================================
        // LEVEL 1: TOPIC-LEVEL ATOMIC BREAKDOWN
        // =========================================================================
        List<TopicAnalytics> level1Topics = new ArrayList<>();
        Map<Integer, double[]> moduleTotals = new HashMap<>(); // mod -> [obtained, max]
        for (int m = 1; m <= 5; m++) {
            moduleTotals.put(m, new double[]{0.0, 0.0});
        }
        Set<Integer> testedModulesInRecords = new HashSet<>();

        double sumIaTotals = 0.0;
        int publishedIaCount = 0;
        List<Double> allIaScores = new ArrayList<>();

        for (StudentIaMarksRecord rec : records) {
            int iaNo = rec.getIaNumber();
            IaQuestionBlueprint blueprint = paperParserService.getOrCreateDefaultBlueprint(classroomId, iaNo);
            Map<String, Double> marksMap = rec.getQuestionMarks() != null ? rec.getQuestionMarks() : Collections.emptyMap();
            Map<String, Double> maxMap = rec.getMaxMarksPerQuestion() != null ? rec.getMaxMarksPerQuestion() : Collections.emptyMap();

            if (rec.getTotalMarks() > 0) {
                sumIaTotals += rec.getTotalMarks();
                publishedIaCount++;
                allIaScores.add(rec.getTotalMarks());
            }

            if (blueprint.getQuestions() != null) {
                Set<String> attemptedQuestions = evaluateAttemptedQuestions(rec, blueprint);

                for (IaSubQuestionItem q : blueprint.getQuestions()) {
                    String code = q.getCode().toLowerCase();
                    double marksObtained = marksMap.getOrDefault(code, marksMap.getOrDefault(code.toUpperCase(), 0.0));
                    double maxMarks = maxMap.getOrDefault(code, maxMap.getOrDefault(code.toUpperCase(), q.getMaxMarks() > 0 ? q.getMaxMarks() : 10.0));

                    String mainQ = "Q" + q.getQuestionNumber();
                    boolean attempted = attemptedQuestions.contains(mainQ);
                    testedModulesInRecords.add(q.getModuleNumber());

                    double pct;
                    String status;
                    String recommendation;

                    if (attempted) {
                        pct = maxMarks > 0 ? Math.min(100.0, Math.round((marksObtained / maxMarks) * 100.0 * 10.0) / 10.0) : 0.0;
                        if (pct >= 75.0) {
                            status = "STRONG";
                            recommendation = "Strong mastery. Ready for advanced university exam problem-solving.";
                        } else if (pct >= 50.0) {
                            status = "MODERATE";
                            recommendation = "Moderate understanding. Review key definitions and practice previous year numericals.";
                        } else {
                            status = "WEAK";
                            recommendation = "Critical diagnostic gap. Revisit foundational concepts and seek faculty revision.";
                        }
                    } else {
                        // Alternative choice question not chosen by student: DO NOT default to WEAK
                        marksObtained = 0.0;
                        pct = 0.0;
                        status = "NOT_ATTEMPTED";
                        recommendation = "Alternative choice question not attempted in this test.";
                    }

                    level1Topics.add(TopicAnalytics.builder()
                            .code(q.getCode().toUpperCase())
                            .topicName(q.getTopicName())
                            .moduleNumber(q.getModuleNumber())
                            .co(q.getCo())
                            .marksObtained(marksObtained)
                            .maxMarks(maxMarks)
                            .percentage(pct)
                            .status(status)
                            .wasAttempted(attempted)
                            .iaNumber(iaNo)
                            .recommendation(recommendation)
                            .build());

                    // Accumulate for Level 2 Module breakdown strictly from the attempted question
                    int mod = q.getModuleNumber();
                    if (mod >= 1 && mod <= 5 && attempted) {
                        double[] cur = moduleTotals.get(mod);
                        cur[0] += marksObtained;
                        cur[1] += maxMarks;
                    }
                }
            }
        }

        // =========================================================================
        // LEVEL 2: MODULE-LEVEL MASTERY (MODULES 1 TO 5)
        // =========================================================================
        Map<Integer, ModuleAnalytics> level2Modules = new LinkedHashMap<>();
        String[] defaultModuleNames = {
                "Module 1: Fundamentals & Architecture",
                "Module 2: Network Protocols & Logical Design",
                "Module 3: Advanced Communication & Gateways",
                "Module 4: System Management & Interfaces",
                "Module 5: Security, Analytics & Case Studies"
        };

        for (int m = 1; m <= 5; m++) {
            double[] arr = moduleTotals.get(m);
            double obt = arr[0];
            double max = arr[1];
            double pct = max > 0 ? Math.min(100.0, Math.round((obt / max) * 100.0 * 10.0) / 10.0) : 0.0;

            final int modNum = m;
            long totalModTopics = level1Topics.stream().filter(t -> t.getModuleNumber() == modNum).count();
            // Count weak topics strictly from attempted topics that scored < 50%
            long weakModTopics = level1Topics.stream()
                    .filter(t -> t.getModuleNumber() == modNum && "WEAK".equals(t.getStatus()))
                    .count();

            String modStatus;
            if (max > 0) {
                if (pct >= 75.0) {
                    modStatus = "STRONG";
                } else if (pct >= 50.0) {
                    modStatus = "MODERATE";
                } else {
                    modStatus = "WEAK";
                }
            } else {
                // If this module was tested in any IA blueprint evaluated:
                if (testedModulesInRecords.contains(m)) {
                    // Student attended neither question from this tested module -> explicitly WEAK
                    modStatus = "WEAK";
                    max = 20.0;
                    pct = 0.0;
                } else {
                    modStatus = "NOT_ASSESSED";
                }
            }

            level2Modules.put(m, ModuleAnalytics.builder()
                    .moduleNumber(m)
                    .moduleName(defaultModuleNames[m - 1])
                    .totalObtained(obt)
                    .totalMax(max)
                    .percentage(pct)
                    .status(modStatus)
                    .totalTopics((int) totalModTopics)
                    .weakTopicsCount((int) weakModTopics)
                    .build());
        }

        // =========================================================================
        // LEVEL 3: SUBJECT-LEVEL CIE STANDING & TARGET SEE PROJECTIONS
        // =========================================================================
        double rawIaAvg = publishedIaCount > 0 ? (sumIaTotals / publishedIaCount) : 0.0;
        if ("BEST_2".equalsIgnoreCase(scheme.getIaCalculationRule()) && allIaScores.size() >= 2) {
            allIaScores.sort(Collections.reverseOrder());
            rawIaAvg = (allIaScores.get(0) + allIaScores.get(1)) / 2.0;
        }

        double scaledIaMax = scheme.getIaScaledMaxMarks() > 0 ? scheme.getIaScaledMaxMarks() : 15.0;
        double scaledIa = Math.min(scaledIaMax, Math.round(((rawIaAvg / 40.0) * scaledIaMax) * 10.0) / 10.0);
        double assignmentScore = scheme.getAssignmentScaledMaxMarks() > 0 ? Math.min(scheme.getAssignmentScaledMaxMarks(), 5.0) : 5.0;
        double labScore = scheme.isLabIntegrated() ? Math.min(scheme.getLabRecordScaledMarks(), 10.0) : 0.0;

        double totalCie = scaledIa + assignmentScore + labScore;
        double passingThreshold = scheme.getCieMinPassingMarks() > 0 ? scheme.getCieMinPassingMarks() : 20.0;
        double cieMaxMarks = scheme.getCieTotalMaxMarks() > 0 ? scheme.getCieTotalMaxMarks() : 50.0;
        String cieStatus = totalCie >= passingThreshold ? "PASSING" : "AT_RISK";

        // SEE Target Calculator: VTU overall pass criteria requires (CIE + SEE) >= 40/100, with SEE >= 18/50 (or 20/50)
        double minSeePassing = scheme.getSeeMinPassingMarks() > 0 ? scheme.getSeeMinPassingMarks() : 18.0;
        double minTotalPass = scheme.getTotalPassMinMarks() > 0 ? scheme.getTotalPassMinMarks() : 40.0;
        double minSeeForPass = Math.max(minSeePassing, minTotalPass - totalCie);
        double minSeeForDistinction = Math.max(minSeePassing, 75.0 - totalCie);

        String seeTargetMsg = String.format("Need ≥ %.1f marks in SEE (out of 50) to pass course; ≥ %.1f for Distinction.",
                Math.min(50.0, minSeeForPass), Math.min(50.0, minSeeForDistinction));

        SubjectAnalytics level3Subject = SubjectAnalytics.builder()
                .subjectCode(classroom.getSubjectCode() != null ? classroom.getSubjectCode() : "BCS701")
                .subjectName(classroom.getSubjectName() != null ? classroom.getSubjectName() : "Internet of Things")
                .rawIaAverage(Math.round(rawIaAvg * 10.0) / 10.0)
                .scaledIaScore(scaledIa)
                .assignmentScore(assignmentScore)
                .labScore(labScore)
                .totalCieSecured(Math.round(totalCie * 10.0) / 10.0)
                .cieMaxMarks(50.0)
                .passingThreshold(passingThreshold)
                .cieStatus(cieStatus)
                .seeProjectedTarget(seeTargetMsg)
                .calculationRule(scheme.getIaCalculationRule())
                .build();

        // =========================================================================
        // LEVEL 4: SEMESTER-LEVEL ACADEMIC TRAJECTORY & RISK STATUS
        // =========================================================================
        int semester = classroom.getSemester() != null ? classroom.getSemester() : 7;
        String gpaTrajectory;
        String riskCategory;
        String advice;

        if (totalCie >= 25.0) {
            gpaTrajectory = "ON_TRACK_DISTINCTION";
            riskCategory = "LOW";
            advice = "Outstanding CIE trajectory! Maintain consistent revision to secure University S/A grade.";
        } else if (totalCie >= 20.0) {
            gpaTrajectory = "ON_TRACK_FIRST_CLASS";
            riskCategory = "LOW";
            advice = "Solid performance. Prioritize weak topics highlighted in Module 2/3 to push into distinction range.";
        } else if (totalCie >= 15.0) {
            gpaTrajectory = "AVERAGE";
            riskCategory = "MEDIUM";
            advice = "Borderline CIE score. Maximize upcoming assignments and score ≥ 30/40 in next IA to safely secure clearance.";
        } else {
            gpaTrajectory = "AT_RISK";
            riskCategory = "HIGH";
            advice = "High academic risk. Immediate faculty mentoring and remediation recommended before next IA test.";
        }

        SemesterAnalytics level4Semester = SemesterAnalytics.builder()
                .semester(semester)
                .gpaTrajectory(gpaTrajectory)
                .overallRiskCategory(riskCategory)
                .academicAdvice(advice)
                .build();

        return StudentFourLevelAnalyticsDTO.builder()
                .studentUsn(cleanUsn)
                .studentName(studentName)
                .classroomId(classroomId)
                .level1Topics(level1Topics)
                .level2Modules(level2Modules)
                .level3Subject(level3Subject)
                .level4Semester(level4Semester)
                .build();
    }

    /**
     * Resolves the student USN for the authenticated user and returns their 4-level analytics.
     */
    public StudentFourLevelAnalyticsDTO getMyFourLevelAnalytics(String classroomId, String userEmail) {
        User user = userRepository.findByEmail(userEmail).orElse(null);
        String usn = (user != null && user.getUsn() != null && !user.getUsn().isBlank()) ? user.getUsn().trim() : null;

        Classroom classroom = classroomRepository.findById(classroomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Classroom not found: " + classroomId));

        if (usn == null && classroom.getEnrolledStudents() != null) {
            for (Classroom.EnrolledStudent es : classroom.getEnrolledStudents()) {
                if (es.getEmail() != null && es.getEmail().equalsIgnoreCase(userEmail)) {
                    usn = es.getUsn();
                    break;
                }
            }
        }

        if (usn == null || usn.isBlank()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No verified USN found for student profile in classroom " + classroomId);
        }

        return getStudentFourLevelAnalytics(classroomId, usn);
    }

    /**
     * Whole-Class Diagnostic Heatmap and Analytics Summary.
     */
    public ClassroomAnalyticsSummaryDTO getClassroomAnalyticsSummary(String classroomId) {
        Classroom classroom = classroomRepository.findById(classroomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Classroom not found: " + classroomId));

        SubjectEvaluationScheme scheme = schemeService.getOrCreateScheme(classroomId);
        List<StudentIaMarksRecord> allRecords = iaMarksRecordRepository.findByClassroomId(classroomId);

        // Group records by USN
        Map<String, List<StudentIaMarksRecord>> recordsByUsn = new HashMap<>();
        for (StudentIaMarksRecord r : allRecords) {
            if (r.getUsn() != null && !r.getUsn().isBlank()) {
                recordsByUsn.computeIfAbsent(r.getUsn().trim().toUpperCase(), k -> new ArrayList<>()).add(r);
            }
        }

        // Map topic performance across class
        Map<String, TopicAggregator> topicMap = new LinkedHashMap<>();
        Map<Integer, double[]> moduleAggs = new HashMap<>();
        for (int m = 1; m <= 5; m++) moduleAggs.put(m, new double[]{0.0, 0.0});

        int strongCount = 0;
        int moderateCount = 0;
        int needsSupportCount = 0;
        double sumAllClassIa = 0.0;
        int studentEvaluatedCount = 0;

        List<StudentClassSummaryItem> studentSummaries = new ArrayList<>();

        // Track per-question stats for Q1, Q2, Q3, Q4
        Map<String, List<Double>> questionScores = new LinkedHashMap<>();
        Map<String, List<Double>> questionSubScoresA = new LinkedHashMap<>();
        Map<String, List<Double>> questionSubScoresB = new LinkedHashMap<>();
        Map<String, String> questionSubCodeA = new HashMap<>();
        Map<String, String> questionSubCodeB = new HashMap<>();
        Map<String, String> questionSubTopicA = new HashMap<>();
        Map<String, String> questionSubTopicB = new HashMap<>();
        Map<String, Integer> questionModuleMap = new HashMap<>();

        for (String qId : Arrays.asList("Q1", "Q2", "Q3", "Q4")) {
            questionScores.put(qId, new ArrayList<>());
            questionSubScoresA.put(qId, new ArrayList<>());
            questionSubScoresB.put(qId, new ArrayList<>());
        }
        questionModuleMap.put("Q1", 1);
        questionModuleMap.put("Q2", 1);
        questionModuleMap.put("Q3", 2);
        questionModuleMap.put("Q4", 2);

        // Prepopulate default question topics from blueprint
        IaQuestionBlueprint defaultBp = paperParserService.getOrCreateDefaultBlueprint(classroomId, 1);
        if (defaultBp != null && defaultBp.getQuestions() != null) {
            for (IaSubQuestionItem q : defaultBp.getQuestions()) {
                String qId = "Q" + q.getQuestionNumber();
                String sub = q.getSubQuestion() != null ? q.getSubQuestion().toLowerCase() : "";
                if ("a".equals(sub)) {
                    questionSubCodeA.put(qId, q.getCode().toUpperCase());
                    questionSubTopicA.put(qId, q.getTopicName());
                } else if ("b".equals(sub)) {
                    questionSubCodeB.put(qId, q.getCode().toUpperCase());
                    questionSubTopicB.put(qId, q.getTopicName());
                }
            }
        }

        for (Map.Entry<String, List<StudentIaMarksRecord>> entry : recordsByUsn.entrySet()) {
            String usn = entry.getKey();
            List<StudentIaMarksRecord> studentRecs = entry.getValue();
            studentRecs.sort(Comparator.comparingInt(StudentIaMarksRecord::getIaNumber));

            double studentTotalIa = 0.0;
            int iaCount = 0;
            String studentName = studentRecs.get(0).getStudentName();
            boolean anyPublished = false;

            String weakestTopicForStudent = "None";
            double lowestTopicPctForStudent = 100.0;

            for (StudentIaMarksRecord r : studentRecs) {
                if (r.getTotalMarks() > 0) {
                    studentTotalIa += r.getTotalMarks();
                    iaCount++;
                }
                if (r.isPublished()) anyPublished = true;

                IaQuestionBlueprint bp = paperParserService.getOrCreateDefaultBlueprint(classroomId, r.getIaNumber());
                Map<String, Double> marks = r.getQuestionMarks() != null ? r.getQuestionMarks() : Collections.emptyMap();
                Map<String, Double> maxMap = r.getMaxMarksPerQuestion() != null ? r.getMaxMarksPerQuestion() : Collections.emptyMap();

                Set<String> attemptedQuestions = evaluateAttemptedQuestions(r, bp);

                // Collect QuestionAnalytics metrics for Q1, Q2, Q3, Q4 strictly for attempted questions
                for (String qId : Arrays.asList("Q1", "Q2", "Q3", "Q4")) {
                    if (attemptedQuestions.contains(qId)) {
                        String num = qId.substring(1);
                        double scoreA = getSubQuestionScore(marks, num + "a");
                        double scoreB = getSubQuestionScore(marks, num + "b");
                        double totalQ = scoreA + scoreB;
                        questionScores.get(qId).add(totalQ);
                        questionSubScoresA.get(qId).add(scoreA);
                        questionSubScoresB.get(qId).add(scoreB);
                    }
                }

                if (bp.getQuestions() != null) {
                    for (IaSubQuestionItem q : bp.getQuestions()) {
                        String code = q.getCode().toLowerCase();
                        double score = marks.getOrDefault(code, marks.getOrDefault(code.toUpperCase(), 0.0));
                        double max = maxMap.getOrDefault(code, maxMap.getOrDefault(code.toUpperCase(), q.getMaxMarks() > 0 ? q.getMaxMarks() : 10.0));
                        double pct = max > 0 ? (score / max) * 100.0 : 0.0;

                        String mainQ = "Q" + q.getQuestionNumber();
                        boolean wasAttempted = attemptedQuestions.contains(mainQ);

                        // Only accumulate topic metrics if student actually attempted this question
                        if (wasAttempted) {
                            TopicAggregator agg = topicMap.computeIfAbsent(q.getCode().toUpperCase() + "||" + q.getTopicName(),
                                    k -> new TopicAggregator(q.getCode().toUpperCase(), q.getTopicName(), q.getModuleNumber(), q.getCo()));
                            agg.addScore(score, max);

                            double[] mArr = moduleAggs.get(q.getModuleNumber());
                            if (mArr != null) {
                                mArr[0] += score;
                                mArr[1] += max;
                            }
                            if (pct < lowestTopicPctForStudent) {
                                lowestTopicPctForStudent = pct;
                                weakestTopicForStudent = q.getTopicName();
                            }
                        }
                    }
                }
            }

            double avgIa = iaCount > 0 ? (studentTotalIa / iaCount) : 0.0;
            double scaledCie = Math.min(scheme.getIaScaledMaxMarks(), (avgIa / 40.0) * scheme.getIaScaledMaxMarks());
            sumAllClassIa += avgIa;
            studentEvaluatedCount++;

            String overallStatus;
            if (avgIa >= 30.0) {
                strongCount++;
                overallStatus = "STRONG";
            } else if (avgIa >= 20.0) {
                moderateCount++;
                overallStatus = "MODERATE";
            } else {
                needsSupportCount++;
                overallStatus = "NEEDS_SUPPORT";
            }

            studentSummaries.add(StudentClassSummaryItem.builder()
                    .usn(usn)
                    .studentName(studentName)
                    .iaTotal(Math.round(avgIa * 10.0) / 10.0)
                    .scaledCie(Math.round(scaledCie * 10.0) / 10.0)
                    .weakestTopic(weakestTopicForStudent)
                    .weakestTopicPercentage(Math.round(lowestTopicPctForStudent * 10.0) / 10.0)
                    .overallStatus(overallStatus)
                    .published(anyPublished)
                    .build());
        }

        // Build Topic Heatmap (sorted from weakest average percentage to strongest)
        List<TopicClassPerformance> heatmap = new ArrayList<>();
        List<String> lowestTopics = new ArrayList<>();

        for (TopicAggregator agg : topicMap.values()) {
            double avgPct = agg.getAveragePercentage();
            String status;
            if (avgPct < 40.0) {
                status = "CRITICAL_WEAK";
            } else if (avgPct < 55.0) {
                status = "WEAK";
            } else if (avgPct < 75.0) {
                status = "MODERATE";
            } else {
                status = "STRONG";
            }

            heatmap.add(TopicClassPerformance.builder()
                    .code(agg.code)
                    .topicName(agg.topicName)
                    .moduleNumber(agg.moduleNumber)
                    .co(agg.co)
                    .classAveragePercentage(Math.round(avgPct * 10.0) / 10.0)
                    .studentsAttemptedCount(agg.attempts)
                    .weakStudentsCount(agg.weakCount)
                    .status(status)
                    .build());
        }

        heatmap.sort(Comparator.comparingDouble(TopicClassPerformance::getClassAveragePercentage));

        for (int i = 0; i < Math.min(4, heatmap.size()); i++) {
            TopicClassPerformance t = heatmap.get(i);
            lowestTopics.add(t.getTopicName() + " (" + t.getClassAveragePercentage() + "%)");
        }

        // Module averages
        Map<Integer, Double> moduleAverages = new LinkedHashMap<>();
        for (int m = 1; m <= 5; m++) {
            double[] arr = moduleAggs.get(m);
            double pct = arr[1] > 0 ? Math.round((arr[0] / arr[1]) * 100.0 * 10.0) / 10.0 : 0.0;
            moduleAverages.put(m, pct);
        }

        int enrolledCount = classroom.getEnrolledStudents() != null ? classroom.getEnrolledStudents().size() : studentEvaluatedCount;
        double classAvgIa = studentEvaluatedCount > 0 ? (sumAllClassIa / studentEvaluatedCount) : 0.0;
        double classAvgCie = (classAvgIa / 40.0) * scheme.getIaScaledMaxMarks();

        StudentDistribution dist = StudentDistribution.builder()
                .strongCount(strongCount)
                .moderateCount(moderateCount)
                .needsSupportCount(needsSupportCount)
                .classAverageIa(Math.round(classAvgIa * 10.0) / 10.0)
                .classAverageCie(Math.round(classAvgCie * 10.0) / 10.0)
                .build();

        studentSummaries.sort(Comparator.comparing(StudentClassSummaryItem::getUsn));

        // Assemble interactive QuestionAnalytics for Q1, Q2, Q3, Q4
        Map<String, QuestionAnalytics> questionAnalyticsMap = new LinkedHashMap<>();
        List<QuestionAnalytics> questionAnalyticsList = new ArrayList<>();

        for (String qId : Arrays.asList("Q1", "Q2", "Q3", "Q4")) {
            List<Double> qScores = questionScores.get(qId);
            List<Double> subA = questionSubScoresA.get(qId);
            List<Double> subB = questionSubScoresB.get(qId);

            int attCount = qScores.size();
            int weakCount = (int) qScores.stream().filter(s -> s < 10.0).count();
            double avgScore = attCount > 0 ? (qScores.stream().mapToDouble(Double::doubleValue).sum() / attCount) : 0.0;
            double avgPct = Math.min(100.0, (avgScore / 20.0) * 100.0);

            String qStatus;
            if (attCount == 0) {
                qStatus = "NOT_ATTEMPTED";
            } else if (avgPct >= 75.0) {
                qStatus = "STRONG";
            } else if (avgPct >= 50.0) {
                qStatus = "MODERATE";
            } else {
                qStatus = "WEAK";
            }

            Map<String, Integer> brackets = new LinkedHashMap<>();
            int bLow = 0;   // < 10 marks (< 50%)
            int bMed = 0;   // 10 - 14 marks (50 - 74%)
            int bHigh = 0;  // 15 - 20 marks (>= 75%)
            for (double sc : qScores) {
                if (sc < 10.0) bLow++;
                else if (sc < 15.0) bMed++;
                else bHigh++;
            }
            brackets.put("< 10 Marks (<50%)", bLow);
            brackets.put("10-14 Marks (50-74%)", bMed);
            brackets.put("15-20 Marks (≥75%)", bHigh);

            // Sub question A
            String num = qId.substring(1);
            String codeA = questionSubCodeA.getOrDefault(qId, num + "a");
            String topicA = questionSubTopicA.getOrDefault(qId, "Sub-question " + num + "a");
            double avgA = !subA.isEmpty() ? (subA.stream().mapToDouble(Double::doubleValue).sum() / subA.size()) : 0.0;
            int weakA = (int) subA.stream().filter(s -> s < 5.0).count();

            SubQuestionAnalytics subQObjA = SubQuestionAnalytics.builder()
                    .code(codeA)
                    .topicName(topicA)
                    .averageScore(Math.round(avgA * 10.0) / 10.0)
                    .maxMarks(10.0)
                    .attemptedCount(subA.size())
                    .weakCount(weakA)
                    .lowThreshold(4.0)
                    .mediumThreshold(7.5)
                    .highThreshold(10.0)
                    .build();

            // Sub question B
            String codeB = questionSubCodeB.getOrDefault(qId, num + "b");
            String topicB = questionSubTopicB.getOrDefault(qId, "Sub-question " + num + "b");
            double avgB = !subB.isEmpty() ? (subB.stream().mapToDouble(Double::doubleValue).sum() / subB.size()) : 0.0;
            int weakB = (int) subB.stream().filter(s -> s < 5.0).count();

            SubQuestionAnalytics subQObjB = SubQuestionAnalytics.builder()
                    .code(codeB)
                    .topicName(topicB)
                    .averageScore(Math.round(avgB * 10.0) / 10.0)
                    .maxMarks(10.0)
                    .attemptedCount(subB.size())
                    .weakCount(weakB)
                    .lowThreshold(4.0)
                    .mediumThreshold(7.5)
                    .highThreshold(10.0)
                    .build();

            QuestionAnalytics qa = QuestionAnalytics.builder()
                    .questionNumber(qId)
                    .moduleNumber(questionModuleMap.getOrDefault(qId, 1))
                    .attemptedCount(attCount)
                    .weakCount(weakCount)
                    .averageScore(Math.round(avgScore * 10.0) / 10.0)
                    .averagePercentage(Math.round(avgPct * 10.0) / 10.0)
                    .status(qStatus)
                    .scoreBrackets(brackets)
                    .subQuestionA(subQObjA)
                    .subQuestionB(subQObjB)
                    .build();

            questionAnalyticsMap.put(qId, qa);
            questionAnalyticsList.add(qa);
        }

        return ClassroomAnalyticsSummaryDTO.builder()
                .classroomId(classroomId)
                .subjectCode(classroom.getSubjectCode() != null ? classroom.getSubjectCode() : "BCS701")
                .subjectName(classroom.getSubjectName() != null ? classroom.getSubjectName() : "Internet of Things")
                .enrolledStudentsCount(enrolledCount)
                .evaluatedStudentsCount(studentEvaluatedCount)
                .topicHeatmap(heatmap)
                .moduleAverages(moduleAverages)
                .studentDistribution(dist)
                .lowestPerformingTopics(lowestTopics)
                .studentSummaries(studentSummaries)
                .questionAnalytics(questionAnalyticsMap)
                .questionList(questionAnalyticsList)
                .build();
    }

    /**
     * Evaluates question attempt pairing for an IA record based on VTU mutual-exclusion rules:
     * - Q1 (1a, 1b) OR Q2 (2a, 2b) -> Module 1
     * - Q3 (3a, 3b) OR Q4 (4a, 4b) -> Module 2
     * Specifically, if a student attends 1 and 4, then 2 and 3 are automatically considered not attempted.
     * Returns a set of attempted main question identifiers: e.g. ["Q1", "Q4"]
     */
    private Set<String> evaluateAttemptedQuestions(StudentIaMarksRecord rec, IaQuestionBlueprint blueprint) {
        Set<String> attempted = new HashSet<>();
        Map<String, Double> marks = rec.getQuestionMarks() != null ? rec.getQuestionMarks() : Collections.emptyMap();
        Map<String, String> choiceTags = rec.getAttemptedChoiceGroups() != null ? rec.getAttemptedChoiceGroups() : Collections.emptyMap();

        // 1. Evaluate Module 1 Pair: Q1 vs Q2
        double q1Score = getSubQuestionScore(marks, "1a") + getSubQuestionScore(marks, "1b") + getSubQuestionScore(marks, "1c");
        double q2Score = getSubQuestionScore(marks, "2a") + getSubQuestionScore(marks, "2b") + getSubQuestionScore(marks, "2c");
        boolean q1HasPositive = q1Score > 0;
        boolean q2HasPositive = q2Score > 0;
        boolean q1Tagged = "Q1".equalsIgnoreCase(choiceTags.get("Q1_OR_Q2"));
        boolean q2Tagged = "Q2".equalsIgnoreCase(choiceTags.get("Q1_OR_Q2"));
        boolean q1ExplicitKey = hasAnyKey(marks, "1a", "1b");
        boolean q2ExplicitKey = hasAnyKey(marks, "2a", "2b");

        if (q1HasPositive && !q2HasPositive) {
            attempted.add("Q1");
        } else if (q2HasPositive && !q1HasPositive) {
            attempted.add("Q2");
        } else if (q1HasPositive && q2HasPositive) {
            // Both attended: pick higher score, other is redundant
            if (q1Score >= q2Score) {
                attempted.add("Q1");
            } else {
                attempted.add("Q2");
            }
        } else {
            // Neither has score > 0
            if (q1Tagged) {
                attempted.add("Q1");
            } else if (q2Tagged) {
                attempted.add("Q2");
            } else if (q1ExplicitKey && !q2ExplicitKey) {
                attempted.add("Q1");
            } else if (q2ExplicitKey && !q1ExplicitKey) {
                attempted.add("Q2");
            }
        }

        // 2. Evaluate Module 2 Pair: Q3 vs Q4
        double q3Score = getSubQuestionScore(marks, "3a") + getSubQuestionScore(marks, "3b") + getSubQuestionScore(marks, "3c");
        double q4Score = getSubQuestionScore(marks, "4a") + getSubQuestionScore(marks, "4b") + getSubQuestionScore(marks, "4c");
        boolean q3HasPositive = q3Score > 0;
        boolean q4HasPositive = q4Score > 0;
        boolean q3Tagged = "Q3".equalsIgnoreCase(choiceTags.get("Q3_OR_Q4"));
        boolean q4Tagged = "Q4".equalsIgnoreCase(choiceTags.get("Q3_OR_Q4"));
        boolean q3ExplicitKey = hasAnyKey(marks, "3a", "3b");
        boolean q4ExplicitKey = hasAnyKey(marks, "4a", "4b");

        if (q3HasPositive && !q4HasPositive) {
            attempted.add("Q3");
        } else if (q4HasPositive && !q3HasPositive) {
            attempted.add("Q4");
        } else if (q3HasPositive && q4HasPositive) {
            if (q3Score >= q4Score) {
                attempted.add("Q3");
            } else {
                attempted.add("Q4");
            }
        } else {
            if (q3Tagged) {
                attempted.add("Q3");
            } else if (q4Tagged) {
                attempted.add("Q4");
            } else if (q3ExplicitKey && !q4ExplicitKey) {
                attempted.add("Q3");
            } else if (q4ExplicitKey && !q3ExplicitKey) {
                attempted.add("Q4");
            }
        }

        return attempted;
    }

    private double getSubQuestionScore(Map<String, Double> marks, String code) {
        if (marks == null || code == null) return 0.0;
        return marks.getOrDefault(code.toLowerCase(), marks.getOrDefault(code.toUpperCase(), 0.0));
    }

    private boolean hasAnyKey(Map<String, Double> marks, String... codes) {
        if (marks == null || codes == null) return false;
        for (String c : codes) {
            if (marks.containsKey(c.toLowerCase()) || marks.containsKey(c.toUpperCase())) {
                return true;
            }
        }
        return false;
    }

    private static class TopicAggregator {
        final String code;
        final String topicName;
        final int moduleNumber;
        final String co;
        double totalObtained = 0.0;
        double totalMax = 0.0;
        int attempts = 0;
        int weakCount = 0;

        TopicAggregator(String code, String topicName, int moduleNumber, String co) {
            this.code = code;
            this.topicName = topicName;
            this.moduleNumber = moduleNumber;
            this.co = co;
        }

        void addScore(double obt, double max) {
            if (max > 0) {
                totalObtained += obt;
                totalMax += max;
                attempts++;
                if ((obt / max) < 0.5) {
                    weakCount++;
                }
            }
        }

        double getAveragePercentage() {
            return totalMax > 0 ? (totalObtained / totalMax) * 100.0 : 0.0;
        }
    }
}
