package com.acadion.backend.service;

import com.acadion.backend.dto.intelligence.StudentPerformanceResponse;
import com.acadion.backend.dto.intelligence.StudentPerformanceResponse.QuestionScoreDetail;
import com.acadion.backend.dto.intelligence.StudentPerformanceResponse.StudentIaTestSummary;
import com.acadion.backend.dto.intelligence.StudentPerformanceResponse.TopicPerformanceItem;
import com.acadion.backend.entity.*;
import com.acadion.backend.repository.ClassroomRepository;
import com.acadion.backend.repository.StudentIaMarksRecordRepository;
import com.acadion.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class StudentPerformanceService {

    private final UserRepository userRepository;
    private final ClassroomRepository classroomRepository;
    private final StudentIaMarksRecordRepository iaMarksRecordRepository;
    private final SubjectEvaluationSchemeService schemeService;
    private final ClassroomPaperParserService paperParserService;

    public StudentPerformanceResponse getStudentPerformance(String classroomId, String userEmail) {
        log.info("Fetching isolated student performance for classroom: {}, user: {}", classroomId, userEmail);

        User user = userRepository.findByEmail(userEmail).orElse(null);
        String usn = (user != null && user.getUsn() != null && !user.getUsn().isBlank()) ? user.getUsn().trim() : null;
        String studentName = (user != null && user.getName() != null) ? user.getName() : "Student";

        Classroom classroom = classroomRepository.findById(classroomId).orElse(null);

        // Fallback: match USN via classroom enrolled roster if not directly on user profile
        if (usn == null && classroom != null && classroom.getEnrolledStudents() != null) {
            for (Classroom.EnrolledStudent es : classroom.getEnrolledStudents()) {
                if (es.getEmail() != null && es.getEmail().equalsIgnoreCase(userEmail)) {
                    usn = es.getUsn();
                    if (es.getName() != null) studentName = es.getName();
                    break;
                }
                if (user != null && es.getName() != null && es.getName().equalsIgnoreCase(user.getName())) {
                    usn = es.getUsn();
                    break;
                }
            }
        }

        SubjectEvaluationScheme scheme = schemeService.getOrCreateScheme(classroomId);

        if (usn == null || usn.isBlank()) {
            log.warn("No verified USN found for user {} in classroom {}", userEmail, classroomId);
            return StudentPerformanceResponse.builder()
                    .classroomId(classroomId)
                    .studentName(studentName)
                    .usn("USN_PENDING")
                    .studentEmail(userEmail)
                    .scaledCieEarned(0.0)
                    .scaledCieMax(scheme.getIaScaledMaxMarks())
                    .iaCalculationRule(scheme.getIaCalculationRule())
                    .overallIaAverage(0.0)
                    .iaTests(Collections.emptyList())
                    .weakTopics(Collections.emptyList())
                    .strongTopics(Collections.emptyList())
                    .moduleMastery(Collections.emptyMap())
                    .build();
        }

        List<StudentIaMarksRecord> records = iaMarksRecordRepository.findByClassroomIdAndUsnIgnoreCase(classroomId, usn);
        records.sort(Comparator.comparingInt(StudentIaMarksRecord::getIaNumber));

        List<StudentIaTestSummary> testSummaries = new ArrayList<>();
        List<TopicPerformanceItem> weakTopics = new ArrayList<>();
        List<TopicPerformanceItem> strongTopics = new ArrayList<>();
        Map<Integer, Double> cumulativeModuleMastery = new HashMap<>();
        Map<Integer, Integer> moduleAttemptCounts = new HashMap<>();

        double sumTotalMarks = 0.0;
        List<Double> iaScores = new ArrayList<>();

        for (StudentIaMarksRecord rec : records) {
            if (!rec.isPublished()) {
                log.info("Skipping unpublished IA-{} marks for USN {}", rec.getIaNumber(), usn);
                continue;
            }
            int iaNo = rec.getIaNumber();
            IaQuestionBlueprint blueprint = paperParserService.getOrCreateDefaultBlueprint(classroomId, iaNo);
            Map<String, Double> marksMap = rec.getQuestionMarks() != null ? rec.getQuestionMarks() : Collections.emptyMap();

            // Determine attempted choices in Part A & Part B
            double q1Total = marksMap.getOrDefault("1a", 0.0) + marksMap.getOrDefault("1b", 0.0) + marksMap.getOrDefault("1c", 0.0);
            double q2Total = marksMap.getOrDefault("2a", 0.0) + marksMap.getOrDefault("2b", 0.0) + marksMap.getOrDefault("2c", 0.0);
            boolean choseQ1 = q1Total >= q2Total && (q1Total > 0 || (marksMap.containsKey("1a") || marksMap.containsKey("1b") || marksMap.containsKey("1c")));
            boolean choseQ2 = !choseQ1 && (q2Total > 0 || (marksMap.containsKey("2a") || marksMap.containsKey("2b") || marksMap.containsKey("2c")));
            if (!choseQ1 && !choseQ2) choseQ1 = true; // Default fallback to primary question

            double q3Total = marksMap.getOrDefault("3a", 0.0) + marksMap.getOrDefault("3b", 0.0) + marksMap.getOrDefault("3c", 0.0);
            double q4Total = marksMap.getOrDefault("4a", 0.0) + marksMap.getOrDefault("4b", 0.0) + marksMap.getOrDefault("4c", 0.0);
            boolean choseQ3 = q3Total >= q4Total && (q3Total > 0 || (marksMap.containsKey("3a") || marksMap.containsKey("3b") || marksMap.containsKey("3c")));
            boolean choseQ4 = !choseQ3 && (q4Total > 0 || (marksMap.containsKey("4a") || marksMap.containsKey("4b") || marksMap.containsKey("4c")));
            if (!choseQ3 && !choseQ4) choseQ3 = true; // Default fallback to primary question

            List<QuestionScoreDetail> questionDetails = new ArrayList<>();
            for (IaSubQuestionItem item : blueprint.getQuestions()) {
                String qNum = item.getQuestionNumber();
                String code = item.getCode();
                double scored = marksMap.getOrDefault(code, 0.0);
                double maxM = item.getMaxMarks() > 0 ? item.getMaxMarks() : (item.getSubQuestion().equals("c") ? 10.0 : 5.0);

                String status = "UNATTEMPTED";
                if (qNum.equals("1") && choseQ2) {
                    status = "SKIPPED_CHOICE";
                } else if (qNum.equals("2") && choseQ1) {
                    status = "SKIPPED_CHOICE";
                } else if (qNum.equals("3") && choseQ4) {
                    status = "SKIPPED_CHOICE";
                } else if (qNum.equals("4") && choseQ3) {
                    status = "SKIPPED_CHOICE";
                } else {
                    if (marksMap.containsKey(code)) {
                        status = "ATTEMPTED";
                    }
                }

                double pct = maxM > 0 ? Math.min(100.0, (scored / maxM) * 100.0) : 0.0;

                // Identify weak & strong topics exclusively for ATTEMPTED questions (excluding choice skips)
                if ("ATTEMPTED".equals(status)) {
                    if (pct < 50.0) {
                        weakTopics.add(TopicPerformanceItem.builder()
                                .topicName(item.getTopicName())
                                .moduleNumber(item.getModuleNumber())
                                .co(item.getCo())
                                .percentage(Math.round(pct * 10.0) / 10.0)
                                .totalScored(scored)
                                .totalMax(maxM)
                                .recommendation("Review " + item.getTopicName() + " (Module " + item.getModuleNumber() + "). Focus on core conceptual derivations.")
                                .build());
                    } else if (pct >= 75.0) {
                        strongTopics.add(TopicPerformanceItem.builder()
                                .topicName(item.getTopicName())
                                .moduleNumber(item.getModuleNumber())
                                .co(item.getCo())
                                .percentage(Math.round(pct * 10.0) / 10.0)
                                .totalScored(scored)
                                .totalMax(maxM)
                                .recommendation("Mastered! Solid foundation in " + item.getTopicName() + ".")
                                .build());
                    }
                }

                questionDetails.add(QuestionScoreDetail.builder()
                        .code(code)
                        .questionNumber(qNum)
                        .subQuestion(item.getSubQuestion())
                        .part(item.getPart())
                        .choiceGroup(item.getChoiceGroup())
                        .topicName(item.getTopicName())
                        .moduleNumber(item.getModuleNumber())
                        .co(item.getCo())
                        .marksScored(scored)
                        .maxMarks(maxM)
                        .percentage(Math.round(pct * 10.0) / 10.0)
                        .status(status)
                        .build());
            }

            double recTotal = rec.getTotalMarks();
            double maxPaperMarks = blueprint.getMaxMarks() > 0 ? blueprint.getMaxMarks() : 40.0;
            double testPct = (recTotal / maxPaperMarks) * 100.0;

            sumTotalMarks += recTotal;
            iaScores.add(recTotal);

            testSummaries.add(StudentIaTestSummary.builder()
                    .iaNumber(iaNo)
                    .totalMarks(recTotal)
                    .maxMarks(maxPaperMarks)
                    .percentage(Math.round(testPct * 10.0) / 10.0)
                    .questions(questionDetails)
                    .build());

            // Accumulate module mastery
            if (rec.getModuleMastery() != null) {
                for (Map.Entry<Integer, Double> entry : rec.getModuleMastery().entrySet()) {
                    int mod = entry.getKey();
                    double val = entry.getValue();
                    cumulativeModuleMastery.put(mod, cumulativeModuleMastery.getOrDefault(mod, 0.0) + val);
                    moduleAttemptCounts.put(mod, moduleAttemptCounts.getOrDefault(mod, 0) + 1);
                }
            }
        }

        // Average module mastery
        Map<Integer, Double> finalizedModuleMastery = new HashMap<>();
        for (Map.Entry<Integer, Double> entry : cumulativeModuleMastery.entrySet()) {
            int mod = entry.getKey();
            int cnt = moduleAttemptCounts.getOrDefault(mod, 1);
            finalizedModuleMastery.put(mod, Math.round((entry.getValue() / cnt) * 10.0) / 10.0);
        }

        // Scaled CIE Calculation
        double overallIaAverage = !iaScores.isEmpty() ? (sumTotalMarks / iaScores.size()) : 0.0;
        double effectiveIaScore = overallIaAverage;

        if ("BEST_2".equalsIgnoreCase(scheme.getIaCalculationRule()) && iaScores.size() >= 2) {
            iaScores.sort(Collections.reverseOrder());
            effectiveIaScore = (iaScores.get(0) + iaScores.get(1)) / 2.0;
        }

        double rawMaxMarks = scheme.getIaRawMaxMarks() > 0 ? scheme.getIaRawMaxMarks() : 40.0;
        double scaledMaxMarks = scheme.getIaScaledMaxMarks() > 0 ? scheme.getIaScaledMaxMarks() : 15.0;
        double scaledEarned = Math.min(scaledMaxMarks, (effectiveIaScore / rawMaxMarks) * scaledMaxMarks);
        double roundedScaled = Math.round(scaledEarned * 10.0) / 10.0;

        return StudentPerformanceResponse.builder()
                .classroomId(classroomId)
                .studentName(studentName)
                .usn(usn)
                .studentEmail(userEmail)
                .scaledCieEarned(roundedScaled)
                .scaledCieMax(scaledMaxMarks)
                .iaCalculationRule(scheme.getIaCalculationRule())
                .overallIaAverage(Math.round(overallIaAverage * 10.0) / 10.0)
                .iaTests(testSummaries)
                .weakTopics(weakTopics)
                .strongTopics(strongTopics)
                .moduleMastery(finalizedModuleMastery)
                .build();
    }
}
