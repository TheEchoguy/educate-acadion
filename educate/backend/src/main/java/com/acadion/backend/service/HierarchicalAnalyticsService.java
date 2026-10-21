package com.acadion.backend.service;

import com.acadion.backend.dto.intelligence.ClassroomAnalyticsSummaryDTO;
import com.acadion.backend.dto.intelligence.ClassroomAnalyticsSummaryDTO.StudentClassSummaryItem;
import com.acadion.backend.dto.intelligence.ClassroomAnalyticsSummaryDTO.StudentDistribution;
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
                for (IaSubQuestionItem q : blueprint.getQuestions()) {
                    String code = q.getCode().toLowerCase();
                    double marksObtained = marksMap.getOrDefault(code, marksMap.getOrDefault(code.toUpperCase(), 0.0));
                    double maxMarks = maxMap.getOrDefault(code, maxMap.getOrDefault(code.toUpperCase(), q.getMaxMarks() > 0 ? q.getMaxMarks() : 10.0));
                    double pct = maxMarks > 0 ? Math.min(100.0, Math.round((marksObtained / maxMarks) * 100.0 * 10.0) / 10.0) : 0.0;

                    boolean attempted = marksObtained > 0;
                    if (!attempted && rec.getAttemptedChoiceGroups() != null) {
                        String chosen = rec.getAttemptedChoiceGroups().get(q.getChoiceGroup());
                        if (chosen != null && chosen.equalsIgnoreCase("Q" + q.getQuestionNumber())) {
                            attempted = true; // Attempted but scored 0
                        }
                    }

                    String status;
                    String recommendation;
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

                    // Accumulate for Level 2 Module breakdown
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
            long weakModTopics = level1Topics.stream().filter(t -> t.getModuleNumber() == modNum && "WEAK".equals(t.getStatus())).count();

            String modStatus;
            if (max == 0) {
                modStatus = "NOT_ASSESSED";
            } else if (pct >= 75.0) {
                modStatus = "STRONG";
            } else if (pct >= 50.0) {
                modStatus = "MODERATE";
            } else {
                modStatus = "WEAK";
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

                if (bp.getQuestions() != null) {
                    for (IaSubQuestionItem q : bp.getQuestions()) {
                        String code = q.getCode().toLowerCase();
                        double score = marks.getOrDefault(code, marks.getOrDefault(code.toUpperCase(), 0.0));
                        double max = maxMap.getOrDefault(code, maxMap.getOrDefault(code.toUpperCase(), q.getMaxMarks() > 0 ? q.getMaxMarks() : 10.0));
                        double pct = max > 0 ? (score / max) * 100.0 : 0.0;

                        TopicAggregator agg = topicMap.computeIfAbsent(q.getCode().toUpperCase() + "||" + q.getTopicName(),
                                k -> new TopicAggregator(q.getCode().toUpperCase(), q.getTopicName(), q.getModuleNumber(), q.getCo()));
                        agg.addScore(score, max);

                        if (score > 0 || (r.getAttemptedChoiceGroups() != null && ("Q" + q.getQuestionNumber()).equalsIgnoreCase(r.getAttemptedChoiceGroups().get(q.getChoiceGroup())))) {
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
                .build();
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
