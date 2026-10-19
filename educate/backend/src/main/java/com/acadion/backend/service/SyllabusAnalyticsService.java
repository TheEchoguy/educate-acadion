package com.acadion.backend.service;

import com.acadion.backend.dto.syllabus.*;
import com.acadion.backend.entity.*;
import com.acadion.backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class SyllabusAnalyticsService {

    private final SyllabusItemRepository syllabusItemRepository;
    private final SyllabusVersionRepository syllabusVersionRepository;
    private final StudentSyllabusRevisionRepository revisionRepository;
    private final SyllabusAssessmentMappingRepository mappingRepository;
    private final StudentResponseRepository studentResponseRepository;
    private final ClassroomRepository classroomRepository;
    private final ClassroomMembershipRepository classroomMembershipRepository;
    private final UserRepository userRepository;

    // =========================================================================
    // FEATURE A & E: CLASSROOM TEACHING-COVERAGE & SCHEDULING ANALYTICS
    // =========================================================================

    public SyllabusCoverageAnalyticsResponse getClassroomCoverageAnalytics(
            String classroomId,
            String userEmail
    ) {
        Classroom classroom = getExistingClassroom(classroomId);
        User caller = getAuthenticatedUser(userEmail);
        verifyClassroomReadAccess(classroom, caller);

        LocalDate today = LocalDate.now();
        List<SyllabusCoverageAnalyticsResponse.ScheduledTopicSummary> upcomingList = new ArrayList<>();
        List<SyllabusCoverageAnalyticsResponse.ScheduledTopicSummary> overdueList = new ArrayList<>();

        long totalTopics = 0;
        long completedTopics = 0;
        long inProgressTopics = 0;
        long notStartedTopics = 0;
        double estimatedTotalHours = 0.0;
        double completedHours = 0.0;
        long upcomingCount = 0;
        long overdueCount = 0;
        long unscheduledCount = 0;

        Optional<SyllabusVersion> latestVersionOpt = syllabusVersionRepository
                .findTopByClassroomIdOrderByVersionNumberDesc(classroomId);

        // Security boundary: active students view metrics derived strictly from latest published version
        if (caller.getRole() == Role.STUDENT) {
            if (latestVersionOpt.isEmpty()) {
                return SyllabusCoverageAnalyticsResponse.builder()
                        .classroomId(classroomId)
                        .classroomName(classroom.getName())
                        .subjectName(classroom.getSubjectName())
                        .subjectCode(classroom.getSubjectCode())
                        .totalTopics(0)
                        .completedTopics(0)
                        .inProgressTopics(0)
                        .notStartedTopics(0)
                        .coveragePercentage(0.0)
                        .estimatedTotalHours(0.0)
                        .completedHours(0.0)
                        .upcomingTopicsCount(0)
                        .overdueTopicsCount(0)
                        .unscheduledTopicsCount(0)
                        .latestVersionNumber(null)
                        .latestPublishedAt(null)
                        .upcomingTopics(Collections.emptyList())
                        .overdueTopics(Collections.emptyList())
                        .build();
            }

            SyllabusVersion latestVersion = latestVersionOpt.get();
            List<SyllabusItemSnapshot> snapshots = latestVersion.getTopics() != null
                    ? latestVersion.getTopics() : Collections.emptyList();
            totalTopics = snapshots.size();

            for (SyllabusItemSnapshot s : snapshots) {
                if (s.getStatus() == SyllabusStatus.COMPLETED) {
                    completedTopics++;
                    if (s.getEstimatedHours() != null && s.getEstimatedHours() > 0) {
                        completedHours += s.getEstimatedHours();
                    }
                } else if (s.getStatus() == SyllabusStatus.IN_PROGRESS) {
                    inProgressTopics++;
                } else {
                    notStartedTopics++;
                }

                if (s.getEstimatedHours() != null && s.getEstimatedHours() > 0) {
                    estimatedTotalHours += s.getEstimatedHours();
                }

                LocalDate start = s.getPlannedStartDate();
                LocalDate completion = s.getPlannedCompletionDate();

                if (start == null && completion == null) {
                    unscheduledCount++;
                } else if (completion != null && completion.isBefore(today) && s.getStatus() != SyllabusStatus.COMPLETED) {
                    overdueCount++;
                    overdueList.add(SyllabusCoverageAnalyticsResponse.ScheduledTopicSummary.builder()
                            .topicId(s.getTopicId())
                            .unit(s.getUnit())
                            .topic(s.getTopic())
                            .status(s.getStatus() != null ? s.getStatus().name() : "NOT_STARTED")
                            .plannedStartDate(start)
                            .plannedCompletionDate(completion)
                            .estimatedHours(s.getEstimatedHours())
                            .scheduleClassification("OVERDUE")
                            .build());
                } else if (start != null && start.isAfter(today) && s.getStatus() != SyllabusStatus.COMPLETED) {
                    upcomingCount++;
                    upcomingList.add(SyllabusCoverageAnalyticsResponse.ScheduledTopicSummary.builder()
                            .topicId(s.getTopicId())
                            .unit(s.getUnit())
                            .topic(s.getTopic())
                            .status(s.getStatus() != null ? s.getStatus().name() : "NOT_STARTED")
                            .plannedStartDate(start)
                            .plannedCompletionDate(completion)
                            .estimatedHours(s.getEstimatedHours())
                            .scheduleClassification("UPCOMING")
                            .build());
                }
            }

            double coveragePct = totalTopics > 0
                    ? Math.round(((double) completedTopics / totalTopics) * 10000.0) / 100.0 : 0.0;

            return SyllabusCoverageAnalyticsResponse.builder()
                    .classroomId(classroomId)
                    .classroomName(classroom.getName())
                    .subjectName(classroom.getSubjectName())
                    .subjectCode(classroom.getSubjectCode())
                    .totalTopics(totalTopics)
                    .completedTopics(completedTopics)
                    .inProgressTopics(inProgressTopics)
                    .notStartedTopics(notStartedTopics)
                    .coveragePercentage(coveragePct)
                    .estimatedTotalHours(roundDouble(estimatedTotalHours))
                    .completedHours(roundDouble(completedHours))
                    .upcomingTopicsCount(upcomingCount)
                    .overdueTopicsCount(overdueCount)
                    .unscheduledTopicsCount(unscheduledCount)
                    .latestVersionNumber(latestVersion.getVersionNumber())
                    .latestPublishedAt(latestVersion.getPublishedAt())
                    .upcomingTopics(upcomingList)
                    .overdueTopics(overdueList)
                    .build();
        }

        // Teachers & Admin evaluate live draft topics
        List<SyllabusItem> items = syllabusItemRepository.findByClassroomIdOrderByOrderIndexAscCreatedAtAsc(classroomId);
        totalTopics = items.size();

        for (SyllabusItem item : items) {
            if (item.getStatus() == SyllabusStatus.COMPLETED) {
                completedTopics++;
                if (item.getEstimatedHours() != null && item.getEstimatedHours() > 0) {
                    completedHours += item.getEstimatedHours();
                }
            } else if (item.getStatus() == SyllabusStatus.IN_PROGRESS) {
                inProgressTopics++;
            } else {
                notStartedTopics++;
            }

            if (item.getEstimatedHours() != null && item.getEstimatedHours() > 0) {
                estimatedTotalHours += item.getEstimatedHours();
            }

            LocalDate start = item.getPlannedStartDate();
            LocalDate completion = item.getPlannedCompletionDate();

            if (start == null && completion == null) {
                unscheduledCount++;
            } else if (completion != null && completion.isBefore(today) && item.getStatus() != SyllabusStatus.COMPLETED) {
                overdueCount++;
                overdueList.add(SyllabusCoverageAnalyticsResponse.ScheduledTopicSummary.builder()
                        .topicId(item.getId())
                        .unit(item.getUnit())
                        .topic(item.getTopic())
                        .status(item.getStatus() != null ? item.getStatus().name() : "NOT_STARTED")
                        .plannedStartDate(start)
                        .plannedCompletionDate(completion)
                        .estimatedHours(item.getEstimatedHours())
                        .scheduleClassification("OVERDUE")
                        .build());
            } else if (start != null && start.isAfter(today) && item.getStatus() != SyllabusStatus.COMPLETED) {
                upcomingCount++;
                upcomingList.add(SyllabusCoverageAnalyticsResponse.ScheduledTopicSummary.builder()
                        .topicId(item.getId())
                        .unit(item.getUnit())
                        .topic(item.getTopic())
                        .status(item.getStatus() != null ? item.getStatus().name() : "NOT_STARTED")
                        .plannedStartDate(start)
                        .plannedCompletionDate(completion)
                        .estimatedHours(item.getEstimatedHours())
                        .scheduleClassification("UPCOMING")
                        .build());
            }
        }

        double coveragePct = totalTopics > 0
                ? Math.round(((double) completedTopics / totalTopics) * 10000.0) / 100.0 : 0.0;

        return SyllabusCoverageAnalyticsResponse.builder()
                .classroomId(classroomId)
                .classroomName(classroom.getName())
                .subjectName(classroom.getSubjectName())
                .subjectCode(classroom.getSubjectCode())
                .totalTopics(totalTopics)
                .completedTopics(completedTopics)
                .inProgressTopics(inProgressTopics)
                .notStartedTopics(notStartedTopics)
                .coveragePercentage(coveragePct)
                .estimatedTotalHours(roundDouble(estimatedTotalHours))
                .completedHours(roundDouble(completedHours))
                .upcomingTopicsCount(upcomingCount)
                .overdueTopicsCount(overdueCount)
                .unscheduledTopicsCount(unscheduledCount)
                .latestVersionNumber(latestVersionOpt.map(SyllabusVersion::getVersionNumber).orElse(null))
                .latestPublishedAt(latestVersionOpt.map(SyllabusVersion::getPublishedAt).orElse(null))
                .upcomingTopics(upcomingList)
                .overdueTopics(overdueList)
                .build();
    }

    // =========================================================================
    // FEATURE B: TEACHER-FACING CLASSROOM REVISION AGGREGATE
    // =========================================================================

    public ClassroomRevisionAggregateResponse getClassroomRevisionAggregate(
            String classroomId,
            String versionId,
            String teacherEmail
    ) {
        Classroom classroom = getExistingClassroom(classroomId);
        User teacher = getAuthenticatedTeacher(teacherEmail);
        verifyClassroomOwnership(classroom, teacher);

        SyllabusVersion version;
        if (versionId != null && !versionId.isBlank()) {
            version = syllabusVersionRepository.findByIdAndClassroomId(versionId.trim(), classroom.getId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                            "Published syllabus version not found with ID " + versionId + " in classroom " + classroomId));
        } else {
            Optional<SyllabusVersion> latestOpt = syllabusVersionRepository
                    .findTopByClassroomIdOrderByVersionNumberDesc(classroom.getId());
            if (latestOpt.isEmpty()) {
                return ClassroomRevisionAggregateResponse.builder()
                        .classroomId(classroomId)
                        .classroomName(classroom.getName())
                        .publishedVersionId(null)
                        .versionNumber(null)
                        .totalEnrolledStudents(0)
                        .participatingStudents(0)
                        .totalTopicsInVersion(0)
                        .totalRevisedEntries(0)
                        .totalInProgressEntries(0)
                        .totalNotStartedEntries(0)
                        .revisionCompletionPercentage(0.0)
                        .confidentCount(0)
                        .understoodCount(0)
                        .needsRevisionCount(0)
                        .notAssessedCount(0)
                        .build();
            }
            version = latestOpt.get();
        }

        long totalEnrolled = classroomMembershipRepository.countByClassroomIdAndMembershipStatus(classroom.getId(), "ACTIVE");
        long topicsInVersion = version.getTopicCount() != null ? version.getTopicCount() : 0;

        List<StudentSyllabusRevision> allRevisions = revisionRepository
                .findByClassroomIdAndPublishedVersionId(classroom.getId(), version.getId());

        Set<String> participatingStudentIds = new HashSet<>();
        long revisedCount = 0;
        long inProgressCount = 0;
        long notStartedCount = 0;
        long confidentCount = 0;
        long understoodCount = 0;
        long needsRevisionCount = 0;
        long notAssessedCount = 0;

        for (StudentSyllabusRevision r : allRevisions) {
            participatingStudentIds.add(r.getStudentId());
            if (r.getRevisionStatus() == RevisionStatus.REVISED) {
                revisedCount++;
            } else if (r.getRevisionStatus() == RevisionStatus.IN_PROGRESS) {
                inProgressCount++;
            } else {
                notStartedCount++;
            }

            if (r.getUnderstandingStatus() == UnderstandingStatus.CONFIDENT) {
                confidentCount++;
            } else if (r.getUnderstandingStatus() == UnderstandingStatus.UNDERSTOOD) {
                understoodCount++;
            } else if (r.getUnderstandingStatus() == UnderstandingStatus.NEEDS_REVISION) {
                needsRevisionCount++;
            } else {
                notAssessedCount++;
            }
        }

        long participatingCount = participatingStudentIds.size();
        // Explicit denominator: total opportunities across participating students (or 0 if none)
        long totalOpportunities = participatingCount * topicsInVersion;
        double completionPct = totalOpportunities > 0
                ? Math.round(((double) revisedCount / totalOpportunities) * 10000.0) / 100.0 : 0.0;

        return ClassroomRevisionAggregateResponse.builder()
                .classroomId(classroomId)
                .classroomName(classroom.getName())
                .publishedVersionId(version.getId())
                .versionNumber(version.getVersionNumber())
                .totalEnrolledStudents(totalEnrolled)
                .participatingStudents(participatingCount)
                .totalTopicsInVersion(topicsInVersion)
                .totalRevisedEntries(revisedCount)
                .totalInProgressEntries(inProgressCount)
                .totalNotStartedEntries(notStartedCount)
                .revisionCompletionPercentage(completionPct)
                .confidentCount(confidentCount)
                .understoodCount(understoodCount)
                .needsRevisionCount(needsRevisionCount)
                .notAssessedCount(notAssessedCount)
                .build();
    }

    // =========================================================================
    // FEATURE C: CROSS-CLASSROOM TEACHER OVERVIEW
    // =========================================================================

    public TeacherClassroomsOverviewResponse getTeacherClassroomsOverview(String userEmail) {
        User teacher = getAuthenticatedTeacher(userEmail);

        List<Classroom> classrooms;
        if (teacher.getRole() == Role.ADMIN) {
            classrooms = classroomRepository.findAll();
        } else {
            classrooms = classroomRepository.findByTeacherIdOrderByCreatedAtDesc(teacher.getId());
        }

        LocalDate today = LocalDate.now();
        List<ClassroomOverviewItemResponse> overviewItems = new ArrayList<>();
        long grandTotalTopics = 0;
        double cumulativeCoverage = 0.0;

        for (Classroom c : classrooms) {
            List<SyllabusItem> items = syllabusItemRepository.findByClassroomIdOrderByOrderIndexAscCreatedAtAsc(c.getId());
            long total = items.size();
            long completed = 0;
            long inProgress = 0;
            long notStarted = 0;
            long upcoming = 0;
            long overdue = 0;

            for (SyllabusItem item : items) {
                if (item.getStatus() == SyllabusStatus.COMPLETED) {
                    completed++;
                } else if (item.getStatus() == SyllabusStatus.IN_PROGRESS) {
                    inProgress++;
                } else {
                    notStarted++;
                }

                if (item.getPlannedCompletionDate() != null && item.getPlannedCompletionDate().isBefore(today)
                        && item.getStatus() != SyllabusStatus.COMPLETED) {
                    overdue++;
                } else if (item.getPlannedStartDate() != null && item.getPlannedStartDate().isAfter(today)
                        && item.getStatus() != SyllabusStatus.COMPLETED) {
                    upcoming++;
                }
            }

            double coveragePct = total > 0 ? Math.round(((double) completed / total) * 10000.0) / 100.0 : 0.0;
            grandTotalTopics += total;
            cumulativeCoverage += coveragePct;

            Optional<SyllabusVersion> versionOpt = syllabusVersionRepository
                    .findTopByClassroomIdOrderByVersionNumberDesc(c.getId());

            long enrolledCount = classroomMembershipRepository
                    .countByClassroomIdAndMembershipStatus(c.getId(), "ACTIVE");

            long participatingCount = 0;
            Double avgRevisionPct = null;

            if (versionOpt.isPresent()) {
                SyllabusVersion version = versionOpt.get();
                List<StudentSyllabusRevision> revs = revisionRepository
                        .findByClassroomIdAndPublishedVersionId(c.getId(), version.getId());
                Set<String> stuIds = new HashSet<>();
                long revised = 0;
                for (StudentSyllabusRevision r : revs) {
                    stuIds.add(r.getStudentId());
                    if (r.getRevisionStatus() == RevisionStatus.REVISED) {
                        revised++;
                    }
                }
                participatingCount = stuIds.size();
                long denom = participatingCount * (version.getTopicCount() != null ? version.getTopicCount() : 0);
                if (denom > 0) {
                    avgRevisionPct = Math.round(((double) revised / denom) * 10000.0) / 100.0;
                }
            }

            overviewItems.add(ClassroomOverviewItemResponse.builder()
                    .classroomId(c.getId())
                    .classroomName(c.getName())
                    .subjectName(c.getSubjectName())
                    .subjectCode(c.getSubjectCode())
                    .department(c.getDepartment())
                    .semester(c.getSemester())
                    .currentVersionNumber(versionOpt.map(SyllabusVersion::getVersionNumber).orElse(null))
                    .latestPublicationDate(versionOpt.map(SyllabusVersion::getPublishedAt).orElse(null))
                    .topicCount(total)
                    .coveragePercentage(coveragePct)
                    .completedTopics(completed)
                    .inProgressTopics(inProgress)
                    .notStartedTopics(notStarted)
                    .upcomingTopicsCount(upcoming)
                    .overdueTopicsCount(overdue)
                    .enrolledStudentsCount(enrolledCount)
                    .participatingStudentsCount(participatingCount)
                    .averageRevisionPercentage(avgRevisionPct)
                    .build());
        }

        double overallAverage = !classrooms.isEmpty()
                ? Math.round((cumulativeCoverage / classrooms.size()) * 100.0) / 100.0 : 0.0;

        return TeacherClassroomsOverviewResponse.builder()
                .teacherEmail(teacher.getEmail())
                .totalManagedClassrooms(classrooms.size())
                .totalSyllabusTopics(grandTotalTopics)
                .overallAverageCoverage(overallAverage)
                .generatedAt(LocalDateTime.now())
                .classrooms(overviewItems)
                .build();
    }

    // =========================================================================
    // FEATURE D: ASSESSMENT-BACKED TOPIC INSIGHTS
    // =========================================================================

    public TopicAssessmentInsightResponse getTopicAssessmentInsights(
            String classroomId,
            String topicId,
            String userEmail
    ) {
        Classroom classroom = getExistingClassroom(classroomId);
        User caller = getAuthenticatedUser(userEmail);
        verifyClassroomReadAccess(classroom, caller);

        SyllabusItem topic = syllabusItemRepository.findByIdAndClassroomId(topicId, classroom.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Syllabus topic not found with ID " + topicId + " in classroom " + classroomId));

        List<SyllabusAssessmentMapping> confirmedMappings = mappingRepository
                .findByClassroomIdAndSyllabusTopicId(classroom.getId(), topic.getId())
                .stream()
                .filter(SyllabusAssessmentMapping::isConfirmed)
                .toList();

        if (confirmedMappings.isEmpty()) {
            return TopicAssessmentInsightResponse.builder()
                    .classroomId(classroomId)
                    .topicId(topic.getId())
                    .unit(topic.getUnit())
                    .topic(topic.getTopic())
                    .hasEvidence(false)
                    .evidenceSummary("No confirmed assessment mappings exist for this topic.")
                    .confirmedMappingsCount(0)
                    .mappedPapersCount(0)
                    .mappedQuestionsCount(0)
                    .totalResponsesEvaluated(0)
                    .distinctStudentsCount(0)
                    .totalMarksObtained(0.0)
                    .totalMaxMarks(0.0)
                    .averageScorePercentage(null)
                    .recommendedForReview(false)
                    .reviewReason("Insufficient assessment evidence.")
                    .sampleSizeReliability("NONE")
                    .mappedAssessments(Collections.emptyList())
                    .build();
        }

        // Gather active enrolled student USNs for classroom scoping
        List<ClassroomMembership> memberships = classroomMembershipRepository
                .findByClassroomIdAndMembershipStatus(classroom.getId(), "ACTIVE");
        Set<String> classroomUsns = new HashSet<>();
        for (ClassroomMembership m : memberships) {
            if (m.getUsnSnapshot() != null && !m.getUsnSnapshot().isBlank()) {
                classroomUsns.add(m.getUsnSnapshot().trim().toUpperCase(Locale.ROOT));
            }
            userRepository.findById(m.getStudentId()).ifPresent(u -> {
                if (u.getUsn() != null && !u.getUsn().isBlank()) {
                    classroomUsns.add(u.getUsn().trim().toUpperCase(Locale.ROOT));
                }
            });
        }

        Set<String> uniquePaperIds = new HashSet<>();
        int mappedQuestionCount = 0;
        double accumulatedObtained = 0.0;
        double accumulatedMax = 0.0;
        int evaluatedResponsesCount = 0;
        Set<String> evaluatedStudentUsns = new HashSet<>();
        List<TopicAssessmentInsightResponse.MappedAssessmentReference> references = new ArrayList<>();

        for (SyllabusAssessmentMapping mapping : confirmedMappings) {
            uniquePaperIds.add(mapping.getPaperId());
            boolean isQuestionLevel = mapping.getQuestionId() != null && !mapping.getQuestionId().isBlank();
            if (isQuestionLevel) {
                mappedQuestionCount++;
            }

            List<StudentResponse> paperResponses = studentResponseRepository.findByPaperId(mapping.getPaperId());

            // Score aggregation for this specific mapping
            double mappingObtained = 0.0;
            double mappingMax = 0.0;
            int mappingAttempts = 0;

            for (StudentResponse resp : paperResponses) {
                // If classroom has enrolled students with USNs, scope responses to this class
                if (!classroomUsns.isEmpty() && resp.getUsn() != null
                        && !classroomUsns.contains(resp.getUsn().trim().toUpperCase(Locale.ROOT))) {
                    continue;
                }

                if (isQuestionLevel) {
                    if (resp.getResponses() != null) {
                        for (StudentResponse.ResponseAnswer ans : resp.getResponses()) {
                            if (mapping.getQuestionId().equalsIgnoreCase(ans.getQuestionId())) {
                                if (ans.getMarksObtained() != null && ans.getMaxMarks() != null && ans.getMaxMarks() > 0) {
                                    mappingObtained += ans.getMarksObtained();
                                    mappingMax += ans.getMaxMarks();
                                    mappingAttempts++;
                                    if (resp.getUsn() != null) {
                                        evaluatedStudentUsns.add(resp.getUsn());
                                    }
                                }
                            }
                        }
                    }
                } else {
                    // Paper-level mapping
                    if (resp.getTotalMarks() != null && resp.getMaxMarks() != null && resp.getMaxMarks() > 0) {
                        mappingObtained += resp.getTotalMarks();
                        mappingMax += resp.getMaxMarks();
                        mappingAttempts++;
                        if (resp.getUsn() != null) {
                            evaluatedStudentUsns.add(resp.getUsn());
                        }
                    }
                }
            }

            Double mappingScorePct = mappingMax > 0
                    ? Math.round((mappingObtained / mappingMax) * 10000.0) / 100.0 : null;

            references.add(TopicAssessmentInsightResponse.MappedAssessmentReference.builder()
                    .paperId(mapping.getPaperId())
                    .questionId(mapping.getQuestionId())
                    .assessmentTitle(mapping.getAssessmentTitle())
                    .subject(mapping.getSubject())
                    .questionScorePercentage(mappingScorePct)
                    .attemptsCount(mappingAttempts)
                    .build());

            accumulatedObtained += mappingObtained;
            accumulatedMax += mappingMax;
            evaluatedResponsesCount += mappingAttempts;
        }

        boolean hasEvidence = evaluatedResponsesCount > 0 && accumulatedMax > 0;
        Double averageScorePct = hasEvidence
                ? Math.round((accumulatedObtained / accumulatedMax) * 10000.0) / 100.0 : null;

        String reliability;
        if (evaluatedResponsesCount == 0) {
            reliability = "NONE";
        } else if (evaluatedResponsesCount < 5) {
            reliability = "LOW";
        } else if (evaluatedResponsesCount <= 15) {
            reliability = "MODERATE";
        } else {
            reliability = "HIGH";
        }

        boolean recommendedForReview = hasEvidence && averageScorePct != null && averageScorePct < 50.0;
        String reason;
        if (!hasEvidence) {
            reason = "Assessment questions mapped, but no evaluated student submissions recorded yet.";
        } else if (recommendedForReview) {
            reason = "Observed student performance on mapped questions (" + averageScorePct + "%) is below the 50% academic benchmark.";
        } else {
            reason = "Student performance meets the benchmark (" + averageScorePct + "% average score).";
        }

        return TopicAssessmentInsightResponse.builder()
                .classroomId(classroomId)
                .topicId(topic.getId())
                .unit(topic.getUnit())
                .topic(topic.getTopic())
                .hasEvidence(hasEvidence)
                .evidenceSummary(hasEvidence ? "Evidence based on " + evaluatedResponsesCount + " evaluated student submission(s)." : reason)
                .confirmedMappingsCount(confirmedMappings.size())
                .mappedPapersCount(uniquePaperIds.size())
                .mappedQuestionsCount(mappedQuestionCount)
                .totalResponsesEvaluated(evaluatedResponsesCount)
                .distinctStudentsCount(evaluatedStudentUsns.size())
                .totalMarksObtained(roundDouble(accumulatedObtained))
                .totalMaxMarks(roundDouble(accumulatedMax))
                .averageScorePercentage(averageScorePct)
                .recommendedForReview(recommendedForReview)
                .reviewReason(reason)
                .sampleSizeReliability(reliability)
                .mappedAssessments(references)
                .build();
    }

    public ClassroomAssessmentInsightsResponse getClassroomAssessmentInsights(
            String classroomId,
            String userEmail
    ) {
        Classroom classroom = getExistingClassroom(classroomId);
        User caller = getAuthenticatedUser(userEmail);
        verifyClassroomReadAccess(classroom, caller);

        List<SyllabusItem> items = syllabusItemRepository.findByClassroomIdOrderByOrderIndexAscCreatedAtAsc(classroom.getId());
        List<TopicAssessmentInsightResponse> insights = new ArrayList<>();

        int mappedTopicsCount = 0;
        int evaluatedCount = 0;
        int reviewCount = 0;
        double sumPercentages = 0.0;

        for (SyllabusItem item : items) {
            TopicAssessmentInsightResponse insight = getTopicAssessmentInsights(classroom.getId(), item.getId(), userEmail);
            insights.add(insight);
            if (insight.getConfirmedMappingsCount() > 0) {
                mappedTopicsCount++;
            }
            if (insight.isHasEvidence() && insight.getAverageScorePercentage() != null) {
                evaluatedCount++;
                sumPercentages += insight.getAverageScorePercentage();
            }
            if (insight.isRecommendedForReview()) {
                reviewCount++;
            }
        }

        Double classAverage = evaluatedCount > 0
                ? Math.round((sumPercentages / evaluatedCount) * 100.0) / 100.0 : null;

        return ClassroomAssessmentInsightsResponse.builder()
                .classroomId(classroomId)
                .classroomName(classroom.getName())
                .subjectName(classroom.getSubjectName())
                .subjectCode(classroom.getSubjectCode())
                .totalSyllabusTopics(items.size())
                .mappedTopicsCount(mappedTopicsCount)
                .topicsWithEvaluatedEvidenceCount(evaluatedCount)
                .topicsRecommendedForReviewCount(reviewCount)
                .classAverageAssessmentPercentage(classAverage)
                .generatedAt(LocalDateTime.now())
                .topicInsights(insights)
                .build();
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    private Classroom getExistingClassroom(String classroomId) {
        return classroomRepository.findById(classroomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Classroom not found: " + classroomId));
    }

    private User getAuthenticatedUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User account not found"));
    }

    private User getAuthenticatedTeacher(String email) {
        User user = getAuthenticatedUser(email);
        if (user.getRole() != Role.TEACHER && user.getRole() != Role.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: Only faculty can perform this action");
        }
        return user;
    }

    private void verifyClassroomOwnership(Classroom classroom, User teacher) {
        if (!classroom.getTeacherId().equals(teacher.getId()) && teacher.getRole() != Role.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden: You are not authorized to manage this classroom");
        }
    }

    private void verifyClassroomReadAccess(Classroom classroom, User caller) {
        if (classroom.getTeacherId().equals(caller.getId()) || caller.getRole() == Role.ADMIN) {
            return;
        }

        if (caller.getRole() == Role.STUDENT) {
            Optional<ClassroomMembership> membershipOpt = classroomMembershipRepository
                    .findByClassroomIdAndStudentId(classroom.getId(), caller.getId());

            if (membershipOpt.isEmpty() || !"ACTIVE".equalsIgnoreCase(membershipOpt.get().getMembershipStatus())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Access denied: You do not have an active enrollment in this classroom");
            }
            return;
        }

        throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                "Access denied: You are not authorized to view the syllabus for this classroom");
    }

    private Double roundDouble(double val) {
        return Math.round(val * 100.0) / 100.0;
    }
}
