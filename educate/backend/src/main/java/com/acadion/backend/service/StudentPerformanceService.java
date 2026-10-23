package com.acadion.backend.service;

import com.acadion.backend.dto.intelligence.StudentPerformanceResponse;
import com.acadion.backend.dto.intelligence.StudentPerformanceResponse.QuestionScoreDetail;
import com.acadion.backend.dto.intelligence.StudentPerformanceResponse.StudentIaTestSummary;
import com.acadion.backend.dto.intelligence.StudentPerformanceResponse.TopicPerformanceItem;
import com.acadion.backend.dto.intelligence.StudentAllCoursesPerformanceResponse;
import com.acadion.backend.dto.intelligence.StudentFourLevelAnalyticsDTO;
import com.acadion.backend.dto.intelligence.StudentPublishedMarksSemesterResponse;
import com.acadion.backend.entity.*;
import com.acadion.backend.repository.ClassroomMembershipRepository;
import com.acadion.backend.repository.ClassroomRepository;
import com.acadion.backend.repository.StudentIaMarksRecordRepository;
import com.acadion.backend.repository.SyllabusItemRepository;
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
public class StudentPerformanceService {

    private final UserRepository userRepository;
    private final ClassroomRepository classroomRepository;
    private final ClassroomMembershipRepository classroomMembershipRepository;
    private final SyllabusItemRepository syllabusItemRepository;
    private final StudentIaMarksRecordRepository iaMarksRecordRepository;
    private final SubjectEvaluationSchemeService schemeService;
    private final ClassroomPaperParserService paperParserService;
    private final HierarchicalAnalyticsService hierarchicalAnalyticsService;

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

        boolean hasAnyPublished = records.stream().anyMatch(StudentIaMarksRecord::isPublished);
        if (!hasAnyPublished) {
            log.info("Student {} has no published marks records in classroom {}", usn, classroomId);
            return StudentPerformanceResponse.builder()
                    .classroomId(classroomId)
                    .studentName(studentName)
                    .usn(usn)
                    .studentEmail(userEmail)
                    .isPublished(false)
                    .message("Draft mode: detailed question breakdown and performance analytics will unlock once published by faculty.")
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
                .isPublished(true)
                .message("Published")
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

    /**
     * Route A: Global Semester Report across all enrolled courses for authenticated student.
     * Computes overall semester trajectory, combined credit GPA projection, enrolled courses summary grid,
     * and cross-subject topic mastery comparisons.
     */
    public StudentAllCoursesPerformanceResponse getAllCoursesPerformance(String userEmail) {
        log.info("Computing global semester report across all courses for student: {}", userEmail);

        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User account not found"));

        String studentName = user.getName() != null ? user.getName() : "Student";
        String usn = user.getUsn() != null && !user.getUsn().isBlank() ? user.getUsn().trim() : "Not Verified";
        Integer semester = user.getSemester();
        String department = user.getStudentDepartment() != null ? user.getStudentDepartment() : (user.getTeacherDepartment() != null ? user.getTeacherDepartment() : "Engineering");

        // Retrieve classrooms where student is enrolled
        List<ClassroomMembership> memberships = classroomMembershipRepository.findByStudentId(user.getId());
        Set<String> classroomIds = new LinkedHashSet<>();
        if (memberships != null) {
            for (ClassroomMembership m : memberships) {
                if (m.getClassroomId() != null && ("ACTIVE".equalsIgnoreCase(m.getMembershipStatus()) || "ENROLLED".equalsIgnoreCase(m.getMembershipStatus()) || m.getMembershipStatus() == null)) {
                    classroomIds.add(m.getClassroomId());
                }
            }
        }

        // Also check if any classroom has student in enrolledStudents roster matching email or USN
        List<Classroom> allClassrooms = classroomRepository.findAll();
        for (Classroom c : allClassrooms) {
            if (c.getEnrolledStudents() != null) {
                for (Classroom.EnrolledStudent es : c.getEnrolledStudents()) {
                    if ((es.getEmail() != null && es.getEmail().equalsIgnoreCase(userEmail)) ||
                        (usn != null && !"Not Verified".equals(usn) && es.getUsn() != null && es.getUsn().equalsIgnoreCase(usn))) {
                        classroomIds.add(c.getId());
                        break;
                    }
                }
            }
        }

        List<StudentAllCoursesPerformanceResponse.CourseSummaryDTO> courseSummaries = new ArrayList<>();
        List<StudentAllCoursesPerformanceResponse.CrossSubjectMasteryDTO> crossComparisons = new ArrayList<>();

        double totalCieSum = 0.0;
        int coursesWithMarks = 0;
        boolean hasHighRisk = false;
        boolean hasMediumRisk = false;

        for (String cId : classroomIds) {
            Classroom c = classroomRepository.findById(cId).orElse(null);
            if (c == null) continue;

            User teacher = c.getTeacherId() != null ? userRepository.findById(c.getTeacherId()).orElse(null) : null;
            String teacherName = teacher != null ? teacher.getName() : "Faculty";
            String courseCode = c.getCourseCode() != null && !c.getCourseCode().isBlank() ? c.getCourseCode().trim() : (c.getSubjectCode() != null ? c.getSubjectCode().trim() : null);
            String rawName = ((c.getName() != null ? c.getName() : "") + " " + (c.getSubjectName() != null ? c.getSubjectName() : "")).toLowerCase();
            if (rawName.contains("energy") || rawName.contains("ec&a") || rawName.contains("audit")) {
                if (courseCode == null || courseCode.isBlank() || "BCS701".equalsIgnoreCase(courseCode) || "COURSE".equalsIgnoreCase(courseCode)) {
                    courseCode = "BEE755B";
                }
            } else if (courseCode == null || courseCode.isBlank()) {
                courseCode = (rawName.contains("iot") || rawName.contains("internet") ? "BCS701" : "COURSE");
            }
            String courseTitle = c.getSubjectName() != null && !c.getSubjectName().isBlank() ? c.getSubjectName() : c.getName();

            double scaledIaScore = 0.0;
            double totalCieSecured = 0.0;
            String cieStatus = "PENDING";
            String riskLevel = "ON_TRACK";
            int weakCount = 0;
            int strongCount = 0;
            int totalTopicsAssessed = 0;
            boolean isPublished = false;

            try {
                StudentFourLevelAnalyticsDTO analytics = hierarchicalAnalyticsService.getMyFourLevelAnalytics(c.getId(), userEmail);
                if (analytics != null) {
                    isPublished = analytics.isPublished();
                    if (analytics.getLevel3Subject() != null) {
                        scaledIaScore = analytics.getLevel3Subject().getScaledIaScore();
                        totalCieSecured = analytics.getLevel3Subject().getTotalCieSecured();
                        cieStatus = analytics.getLevel3Subject().getCieStatus();
                    }
                    if (analytics.getLevel4Semester() != null) {
                        riskLevel = analytics.getLevel4Semester().getOverallRiskCategory();
                    }
                    if (analytics.getLevel1Topics() != null) {
                        totalTopicsAssessed = analytics.getLevel1Topics().size();
                        for (StudentFourLevelAnalyticsDTO.TopicAnalytics t : analytics.getLevel1Topics()) {
                            if ("WEAK".equalsIgnoreCase(t.getStatus())) {
                                weakCount++;
                            } else if ("STRONG".equalsIgnoreCase(t.getStatus())) {
                                strongCount++;
                            }
                        }
                    }
                    if (isPublished && totalTopicsAssessed > 0) {
                        totalCieSum += totalCieSecured;
                        coursesWithMarks++;
                        if ("HIGH".equalsIgnoreCase(riskLevel)) hasHighRisk = true;
                        if ("MEDIUM".equalsIgnoreCase(riskLevel)) hasMediumRisk = true;
                    }
                }
            } catch (Exception e) {
                log.debug("No 4-level analytics for classroom {}: {}", c.getId(), e.getMessage());
            }

            long totalTopicsCount = syllabusItemRepository != null ? syllabusItemRepository.countByClassroomId(c.getId()) : 0;
            long completedTopicsCount = syllabusItemRepository != null ? syllabusItemRepository.countByClassroomIdAndStatus(c.getId(), SyllabusStatus.COMPLETED) : 0;
            double coveragePct = totalTopicsCount > 0 ? Math.round(((double) completedTopicsCount / totalTopicsCount) * 1000.0) / 10.0 : 0.0;
            int totalTopics = (int) totalTopicsCount;

            courseSummaries.add(StudentAllCoursesPerformanceResponse.CourseSummaryDTO.builder()
                    .classroomId(c.getId())
                    .courseCode(courseCode)
                    .courseName(courseTitle)
                    .teacherName(teacherName)
                    .semester(c.getSemester())
                    .section(c.getSection())
                    .scaledIaScore(Math.round(scaledIaScore * 10.0) / 10.0)
                    .totalCieSecured(Math.round(totalCieSecured * 10.0) / 10.0)
                    .cieMaxMarks(50.0)
                    .cieStatus(cieStatus)
                    .riskLevel(riskLevel)
                    .coveragePercentage(coveragePct)
                    .totalTopics(totalTopics)
                    .weakTopicsCount(weakCount)
                    .masteredTopicsCount(strongCount)
                    .isPublished(isPublished)
                    .build());

            double masteryPct = totalTopicsAssessed > 0 ? (strongCount * 100.0 / totalTopicsAssessed) : 0.0;
            crossComparisons.add(StudentAllCoursesPerformanceResponse.CrossSubjectMasteryDTO.builder()
                    .classroomId(c.getId())
                    .courseCode(courseCode)
                    .courseName(courseTitle)
                    .masteryPercentage(Math.round(masteryPct * 10.0) / 10.0)
                    .weakTopicsCount(weakCount)
                    .strongTopicsCount(strongCount)
                    .totalTopicsAssessed(totalTopicsAssessed)
                    .status(weakCount > 1 ? "NEEDS_ATTENTION" : (weakCount > 0 ? "SATISFACTORY" : "ON_TRACK"))
                    .build());
        }

        double averageCie = coursesWithMarks > 0 ? (totalCieSum / coursesWithMarks) : 0.0;
        String overallRisk = hasHighRisk ? "HIGH" : (hasMediumRisk ? "MEDIUM" : "LOW");
        String trajectory;
        double gpaProjection;

        if (averageCie >= 40.0) {
            trajectory = "ON_TRACK_DISTINCTION";
            gpaProjection = 8.8 + ((averageCie - 40.0) / 10.0) * 1.0;
        } else if (averageCie >= 30.0) {
            trajectory = "ON_TRACK_FIRST_CLASS";
            gpaProjection = 7.5 + ((averageCie - 30.0) / 10.0) * 1.2;
        } else if (averageCie >= 20.0) {
            trajectory = "SATISFACTORY_PASS";
            gpaProjection = 6.0 + ((averageCie - 20.0) / 10.0) * 1.4;
        } else {
            trajectory = "AT_RISK";
            gpaProjection = Math.max(4.0, (averageCie / 20.0) * 5.9);
        }
        gpaProjection = Math.round(gpaProjection * 10.0) / 10.0;

        String advice;
        if ("HIGH".equals(overallRisk)) {
            advice = "High academic risk detected in one or more courses. Immediate revision of flagged weak sub-questions and faculty mentoring advised.";
        } else if ("MEDIUM".equals(overallRisk)) {
            advice = "Borderline CIE standing in some courses. Maximize upcoming assignments and prepare targeted topics to guarantee first-class clearance.";
        } else {
            advice = "Excellent semester trajectory across all enrolled courses! Continue consistent revision to secure top university grades.";
        }

        return StudentAllCoursesPerformanceResponse.builder()
                .studentName(studentName)
                .studentUsn(usn)
                .semester(semester)
                .department(department)
                .overallSemesterTrajectory(trajectory)
                .overallRiskCategory(overallRisk)
                .combinedGpaProjection(gpaProjection)
                .totalEnrolledCourses(classroomIds.size())
                .averageScaledCie(Math.round(averageCie * 10.0) / 10.0)
                .academicAdvice(advice)
                .courses(courseSummaries)
                .crossSubjectComparisons(crossComparisons)
                .build();
    }

    /**
     * Dedicated Semester-Wide Published Marks Ledger:
     * Endpoint: GET /api/student/performance/all-published-marks
     * Strictly queries published IA marks (isPublished == true) for the authenticated student
     * across all enrolled classrooms.
     */
    public StudentPublishedMarksSemesterResponse getAllPublishedMarks(String userEmail) {
        log.info("Fetching all published marks across enrolled courses for student: {}", userEmail);

        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User account not found"));

        String studentName = user.getName() != null ? user.getName() : "Student";
        String usn = user.getUsn() != null && !user.getUsn().isBlank() ? user.getUsn().trim() : null;
        Integer semester = user.getSemester() != null ? user.getSemester() : 7;

        // Retrieve classrooms where student is enrolled
        List<ClassroomMembership> memberships = classroomMembershipRepository.findByStudentId(user.getId());
        Set<String> classroomIds = new LinkedHashSet<>();
        if (memberships != null) {
            for (ClassroomMembership m : memberships) {
                if (m.getClassroomId() != null && ("ACTIVE".equalsIgnoreCase(m.getMembershipStatus()) || "ENROLLED".equalsIgnoreCase(m.getMembershipStatus()) || m.getMembershipStatus() == null)) {
                    classroomIds.add(m.getClassroomId());
                }
            }
        }

        // Also check enrolledStudents snapshot in all classrooms
        List<Classroom> allClassrooms = classroomRepository.findAll();
        for (Classroom c : allClassrooms) {
            if (c.getEnrolledStudents() != null) {
                for (Classroom.EnrolledStudent es : c.getEnrolledStudents()) {
                    if ((es.getEmail() != null && es.getEmail().equalsIgnoreCase(userEmail)) ||
                        (usn != null && es.getUsn() != null && es.getUsn().equalsIgnoreCase(usn))) {
                        classroomIds.add(c.getId());
                        if (usn == null && es.getUsn() != null) {
                            usn = es.getUsn().trim();
                        }
                        if (es.getName() != null && (studentName.equals("Student") || studentName.isBlank())) {
                            studentName = es.getName().trim();
                        }
                        break;
                    }
                }
            }
        }

        if (usn == null || usn.isBlank()) {
            usn = "USN_NOT_SET";
        }

        List<StudentPublishedMarksSemesterResponse.PublishedCourseMarksDTO> courseDtos = new ArrayList<>();
        double cumulativeScaledCie = 0.0;
        double maxPossibleScaledCie = 0.0;

        for (String cId : classroomIds) {
            Classroom c = classroomRepository.findById(cId).orElse(null);
            if (c == null) continue;

            User teacher = c.getTeacherId() != null ? userRepository.findById(c.getTeacherId()).orElse(null) : null;
            String facultyName = teacher != null ? teacher.getName() : "Faculty";

            SubjectEvaluationScheme scheme = schemeService.getOrCreateScheme(c.getId());
            String courseCode = c.getCourseCode() != null && !c.getCourseCode().isBlank() ? c.getCourseCode().trim() : (c.getSubjectCode() != null ? c.getSubjectCode().trim() : null);
            String rawName = ((c.getName() != null ? c.getName() : "") + " " + (c.getSubjectName() != null ? c.getSubjectName() : "")).toLowerCase();
            if (rawName.contains("energy") || rawName.contains("ec&a") || rawName.contains("audit")) {
                if (courseCode == null || courseCode.isBlank() || "BCS701".equalsIgnoreCase(courseCode) || "COURSE".equalsIgnoreCase(courseCode)) {
                    courseCode = "BEE755B";
                }
            } else if (courseCode == null || courseCode.isBlank()) {
                courseCode = (rawName.contains("iot") || rawName.contains("internet") ? "BCS701" : "COURSE");
            }
            String courseName = c.getSubjectName() != null && !c.getSubjectName().isBlank() ? c.getSubjectName() : c.getName();
            if (courseName == null || courseName.isBlank()) {
                courseName = scheme.getCourseName() != null ? scheme.getCourseName() : "Course Subject";
            }

            double rawMax = scheme.getIaRawMaxMarks() > 0 ? scheme.getIaRawMaxMarks() : 40.0;
            double scaledMax = scheme.getIaScaledMaxMarks() > 0 ? scheme.getIaScaledMaxMarks() : 15.0;

            // Query published marks records for this classroom & usn
            List<StudentIaMarksRecord> records = iaMarksRecordRepository.findByClassroomIdAndUsnIgnoreCase(c.getId(), usn);
            records.sort(Comparator.comparingInt(StudentIaMarksRecord::getIaNumber));

            List<StudentPublishedMarksSemesterResponse.PublishedIaItemDTO> publishedIAs = new ArrayList<>();
            Map<String, List<Double>> moduleScores = new HashMap<>();

            for (StudentIaMarksRecord r : records) {
                if (!r.isPublished()) continue; // Strictly exclude unpublished draft marks!

                double rawTotal = r.getTotalMarks();
                double scaledScore = rawMax > 0 ? (rawTotal / rawMax) * scaledMax : 0.0;
                scaledScore = Math.round(scaledScore * 100.0) / 100.0;

                publishedIAs.add(StudentPublishedMarksSemesterResponse.PublishedIaItemDTO.builder()
                        .iaNumber(r.getIaNumber())
                        .rawTotal(Math.round(rawTotal * 10.0) / 10.0)
                        .rawMax(rawMax)
                        .scaledScore(scaledScore)
                        .scaledMax(scaledMax)
                        .build());

                if (r.getModuleMastery() != null) {
                    for (Map.Entry<Integer, Double> entry : r.getModuleMastery().entrySet()) {
                        String modKey = String.valueOf(entry.getKey());
                        moduleScores.computeIfAbsent(modKey, k -> new ArrayList<>()).add(entry.getValue());
                    }
                }
            }

            boolean isPublished = !publishedIAs.isEmpty();
            double totalScaledCieSecured = 0.0;

            if (isPublished) {
                String calcRule = scheme.getIaCalculationRule() != null ? scheme.getIaCalculationRule() : "AVERAGE_ALL";
                if ("BEST_2".equalsIgnoreCase(calcRule) && publishedIAs.size() >= 2) {
                    List<Double> scores = publishedIAs.stream()
                            .map(StudentPublishedMarksSemesterResponse.PublishedIaItemDTO::getScaledScore)
                            .sorted(Comparator.reverseOrder())
                            .limit(2)
                            .toList();
                    totalScaledCieSecured = (scores.get(0) + scores.get(1)) / 2.0;
                } else {
                    double sum = publishedIAs.stream().mapToDouble(StudentPublishedMarksSemesterResponse.PublishedIaItemDTO::getScaledScore).sum();
                    totalScaledCieSecured = sum / publishedIAs.size();
                }
                totalScaledCieSecured = Math.round(totalScaledCieSecured * 100.0) / 100.0;
            }

            // Module mastery averages
            Map<String, Double> moduleMasteryMap = new LinkedHashMap<>();
            for (int m = 1; m <= 5; m++) {
                String mKey = String.valueOf(m);
                List<Double> vals = moduleScores.get(mKey);
                if (vals != null && !vals.isEmpty()) {
                    double avg = vals.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
                    moduleMasteryMap.put(mKey, Math.round(avg * 10.0) / 10.0);
                }
            }

            // Determine status ("ON_TRACK" >= 60%, "NEEDS_ATTENTION" 40-59%, "AT_RISK" < 40%)
            double ratio = scaledMax > 0 ? (totalScaledCieSecured / scaledMax) : 0.0;
            String status;
            if (!isPublished) {
                status = "PENDING_PUBLICATION";
            } else if (ratio >= 0.60) {
                status = "ON_TRACK";
            } else if (ratio >= 0.40) {
                status = "NEEDS_ATTENTION";
            } else {
                status = "AT_RISK";
            }

            cumulativeScaledCie += totalScaledCieSecured;
            maxPossibleScaledCie += scaledMax;

            courseDtos.add(StudentPublishedMarksSemesterResponse.PublishedCourseMarksDTO.builder()
                    .classroomId(c.getId())
                    .courseCode(courseCode)
                    .courseName(courseName)
                    .facultyName(facultyName)
                    .isPublished(isPublished)
                    .publishedIAs(publishedIAs)
                    .totalScaledCieSecured(totalScaledCieSecured)
                    .cieTargetMax(scaledMax)
                    .moduleMastery(moduleMasteryMap)
                    .status(status)
                    .build());
        }

        cumulativeScaledCie = Math.round(cumulativeScaledCie * 100.0) / 100.0;
        maxPossibleScaledCie = Math.round(maxPossibleScaledCie * 100.0) / 100.0;

        double overallPct = maxPossibleScaledCie > 0 ? (cumulativeScaledCie / maxPossibleScaledCie) * 100.0 : 0.0;
        double gpa = overallPct >= 85.0 ? 8.75 : (overallPct >= 75.0 ? 8.0 : (overallPct >= 60.0 ? 7.2 : (overallPct >= 40.0 ? 6.0 : 5.0)));
        String projectedGpa = String.format(Locale.US, "%.2f / 10.0", gpa);

        return StudentPublishedMarksSemesterResponse.builder()
                .studentUsn(usn)
                .studentName(studentName)
                .semester(semester)
                .totalEnrolledCourses(classroomIds.size())
                .cumulativeScaledCie(cumulativeScaledCie)
                .maxPossibleScaledCie(maxPossibleScaledCie)
                .projectedGpa(projectedGpa)
                .courses(courseDtos)
                .build();
    }
}

