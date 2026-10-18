package com.acadion.backend.service;

import com.acadion.backend.dto.syllabus.*;
import com.acadion.backend.entity.*;
import com.acadion.backend.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class SyllabusAnalyticsServiceTest {

    @Mock
    private SyllabusItemRepository syllabusItemRepository;

    @Mock
    private SyllabusVersionRepository syllabusVersionRepository;

    @Mock
    private StudentSyllabusRevisionRepository revisionRepository;

    @Mock
    private SyllabusAssessmentMappingRepository mappingRepository;

    @Mock
    private StudentResponseRepository studentResponseRepository;

    @Mock
    private ClassroomRepository classroomRepository;

    @Mock
    private ClassroomMembershipRepository classroomMembershipRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private SyllabusAnalyticsService analyticsService;

    private User teacherOwner;
    private User otherTeacher;
    private User studentUser;
    private User adminUser;
    private Classroom classroom1;
    private Classroom classroom2;

    @BeforeEach
    void setUp() {
        teacherOwner = User.builder()
                .id("teacher-1")
                .email("teacher@acadion.com")
                .name("Teacher One")
                .role(Role.TEACHER)
                .build();

        otherTeacher = User.builder()
                .id("teacher-2")
                .email("other.teacher@acadion.com")
                .name("Teacher Two")
                .role(Role.TEACHER)
                .build();

        studentUser = User.builder()
                .id("student-1")
                .email("student@acadion.com")
                .name("Student One")
                .role(Role.STUDENT)
                .usn("USN001")
                .build();

        adminUser = User.builder()
                .id("admin-1")
                .email("admin@acadion.com")
                .name("Admin User")
                .role(Role.ADMIN)
                .build();

        classroom1 = Classroom.builder()
                .id("class-1")
                .name("Physics 101")
                .subjectCode("PHYS101")
                .teacherId("teacher-1")
                .build();

        classroom2 = Classroom.builder()
                .id("class-2")
                .name("Chemistry 101")
                .subjectCode("CHEM101")
                .teacherId("teacher-2")
                .build();
    }

    // =========================================================================
    // FEATURE A & E: CLASSROOM COVERAGE & SCHEDULING ANALYTICS
    // =========================================================================

    @Test
    @DisplayName("Empty syllabus returns safe zero metrics without division errors")
    void testCoverageAnalytics_emptySyllabus_returnsSafeZeroMetrics() {
        when(classroomRepository.findById("class-1")).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail("teacher@acadion.com")).thenReturn(Optional.of(teacherOwner));
        when(syllabusItemRepository.findByClassroomIdOrderByOrderIndexAscCreatedAtAsc("class-1")).thenReturn(Collections.emptyList());
        when(syllabusVersionRepository.findTopByClassroomIdOrderByVersionNumberDesc("class-1")).thenReturn(Optional.empty());

        SyllabusCoverageAnalyticsResponse response = analyticsService.getClassroomCoverageAnalytics("class-1", "teacher@acadion.com");

        assertNotNull(response);
        assertEquals("class-1", response.getClassroomId());
        assertEquals("Physics 101", response.getClassroomName());
        assertEquals(0, response.getTotalTopics());
        assertEquals(0, response.getCompletedTopics());
        assertEquals(0, response.getInProgressTopics());
        assertEquals(0, response.getNotStartedTopics());
        assertEquals(0.0, response.getCoveragePercentage());
        assertEquals(0.0, response.getEstimatedTotalHours());
        assertEquals(0.0, response.getCompletedHours());
        assertTrue(response.getUpcomingTopics().isEmpty());
        assertTrue(response.getOverdueTopics().isEmpty());
        assertEquals(0, response.getUnscheduledTopicsCount());
    }

    @Test
    @DisplayName("Teaching coverage and completed hours are calculated correctly from reliable metadata")
    void testCoverageAnalytics_withTopics_calculatesCorrectly() {
        LocalDate today = LocalDate.now();

        SyllabusItem item1 = SyllabusItem.builder()
                .id("top-1").classroomId("class-1").topic("Kinematics")
                .status(SyllabusStatus.COMPLETED).estimatedHours(3.0)
                .plannedStartDate(today.minusDays(10)).plannedCompletionDate(today.minusDays(5))
                .orderIndex(1)
                .build();

        SyllabusItem item2 = SyllabusItem.builder()
                .id("top-2").classroomId("class-1").topic("Newton's Laws")
                .status(SyllabusStatus.COMPLETED).estimatedHours(2.5)
                .plannedStartDate(today.minusDays(4)).plannedCompletionDate(today.minusDays(1))
                .orderIndex(2)
                .build();

        SyllabusItem item3 = SyllabusItem.builder()
                .id("top-3").classroomId("class-1").topic("Work & Energy")
                .status(SyllabusStatus.IN_PROGRESS).estimatedHours(4.0)
                .plannedStartDate(today.minusDays(2)).plannedCompletionDate(today.plusDays(3))
                .orderIndex(3)
                .build();

        SyllabusItem item4 = SyllabusItem.builder()
                .id("top-4").classroomId("class-1").topic("Rotational Motion")
                .status(SyllabusStatus.NOT_STARTED).estimatedHours(2.0)
                .plannedStartDate(today.plusDays(4)).plannedCompletionDate(today.plusDays(10))
                .orderIndex(4)
                .build();

        when(classroomRepository.findById("class-1")).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail("teacher@acadion.com")).thenReturn(Optional.of(teacherOwner));
        when(syllabusItemRepository.findByClassroomIdOrderByOrderIndexAscCreatedAtAsc("class-1"))
                .thenReturn(List.of(item1, item2, item3, item4));
        when(syllabusVersionRepository.findTopByClassroomIdOrderByVersionNumberDesc("class-1")).thenReturn(Optional.empty());

        SyllabusCoverageAnalyticsResponse response = analyticsService.getClassroomCoverageAnalytics("class-1", "teacher@acadion.com");

        assertNotNull(response);
        assertEquals(4, response.getTotalTopics());
        assertEquals(2, response.getCompletedTopics());
        assertEquals(1, response.getInProgressTopics());
        assertEquals(1, response.getNotStartedTopics());
        assertEquals(50.0, response.getCoveragePercentage());
        assertEquals(11.5, response.getEstimatedTotalHours());
        assertEquals(5.5, response.getCompletedHours());
        // item4 is starting in 4 days (within 14-day upcoming window)
        assertEquals(1, response.getUpcomingTopics().size());
        assertEquals("top-4", response.getUpcomingTopics().get(0).getTopicId());
        // no overdue items
        assertEquals(0, response.getOverdueTopics().size());
    }

    @Test
    @DisplayName("Overdue topic detection identifies uncompleted topics past their planned completion date")
    void testCoverageAnalytics_overdueTopics_detectedAccurately() {
        LocalDate today = LocalDate.now();

        SyllabusItem overdueItem = SyllabusItem.builder()
                .id("top-overdue").classroomId("class-1").topic("Past Topic")
                .status(SyllabusStatus.IN_PROGRESS).estimatedHours(3.0)
                .plannedStartDate(today.minusDays(10)).plannedCompletionDate(today.minusDays(2))
                .orderIndex(1)
                .build();

        SyllabusItem completedPastItem = SyllabusItem.builder()
                .id("top-completed").classroomId("class-1").topic("Completed Past")
                .status(SyllabusStatus.COMPLETED).estimatedHours(2.0)
                .plannedStartDate(today.minusDays(10)).plannedCompletionDate(today.minusDays(2))
                .orderIndex(2)
                .build();

        SyllabusItem noDateItem = SyllabusItem.builder()
                .id("top-no-date").classroomId("class-1").topic("Undated Topic")
                .status(SyllabusStatus.NOT_STARTED).orderIndex(3)
                .build();

        when(classroomRepository.findById("class-1")).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail("teacher@acadion.com")).thenReturn(Optional.of(teacherOwner));
        when(syllabusItemRepository.findByClassroomIdOrderByOrderIndexAscCreatedAtAsc("class-1"))
                .thenReturn(List.of(overdueItem, completedPastItem, noDateItem));
        when(syllabusVersionRepository.findTopByClassroomIdOrderByVersionNumberDesc("class-1")).thenReturn(Optional.empty());

        SyllabusCoverageAnalyticsResponse response = analyticsService.getClassroomCoverageAnalytics("class-1", "teacher@acadion.com");

        assertEquals(1, response.getOverdueTopics().size());
        assertEquals("top-overdue", response.getOverdueTopics().get(0).getTopicId());
        assertEquals(1, response.getUnscheduledTopicsCount());
    }

    @Test
    @DisplayName("Active student caller receives latest published snapshot topics and not teacher draft items")
    void testCoverageAnalytics_studentCaller_usesPublishedSnapshotOnly() {
        when(classroomRepository.findById("class-1")).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail("student@acadion.com")).thenReturn(Optional.of(studentUser));

        ClassroomMembership activeMembership = ClassroomMembership.builder()
                .classroomId("class-1").studentId("student-1").membershipStatus("ACTIVE")
                .build();
        when(classroomMembershipRepository.findByClassroomIdAndStudentId("class-1", "student-1"))
                .thenReturn(Optional.of(activeMembership));

        SyllabusItemSnapshot snapshot = SyllabusItemSnapshot.builder()
                .topicId("top-1").topic("Published Topic 1").unit("Unit 1")
                .status(SyllabusStatus.COMPLETED).estimatedHours(4.0)
                .orderIndex(1)
                .build();

        SyllabusVersion version = SyllabusVersion.builder()
                .id("ver-1").classroomId("class-1").versionNumber(1)
                .publishedAt(LocalDateTime.now())
                .topics(List.of(snapshot))
                .build();

        when(syllabusVersionRepository.findTopByClassroomIdOrderByVersionNumberDesc("class-1"))
                .thenReturn(Optional.of(version));

        SyllabusCoverageAnalyticsResponse response = analyticsService.getClassroomCoverageAnalytics("class-1", "student@acadion.com");

        assertNotNull(response);
        assertEquals(1, response.getLatestVersionNumber());
        assertEquals(1, response.getTotalTopics());
        assertEquals(100.0, response.getCoveragePercentage());
        // Verify draft repository was never queried for student view
        verify(syllabusItemRepository, never()).findByClassroomIdOrderByOrderIndexAscCreatedAtAsc(any());
    }

    @Test
    @DisplayName("Student caller on unpublished classroom gets safe zero-metric response without draft data leakage")
    void testCoverageAnalytics_studentCaller_unpublishedClassroom_returnsSafeZeroMetrics() {
        when(classroomRepository.findById("class-1")).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail("student@acadion.com")).thenReturn(Optional.of(studentUser));

        ClassroomMembership activeMembership = ClassroomMembership.builder()
                .classroomId("class-1").studentId("student-1").membershipStatus("ACTIVE")
                .build();
        when(classroomMembershipRepository.findByClassroomIdAndStudentId("class-1", "student-1"))
                .thenReturn(Optional.of(activeMembership));
        when(syllabusVersionRepository.findTopByClassroomIdOrderByVersionNumberDesc("class-1"))
                .thenReturn(Optional.empty());

        SyllabusCoverageAnalyticsResponse response = analyticsService.getClassroomCoverageAnalytics("class-1", "student@acadion.com");

        assertNotNull(response);
        assertEquals(0, response.getTotalTopics());
        assertEquals(0.0, response.getCoveragePercentage());
        assertNull(response.getLatestVersionNumber());
        verify(syllabusItemRepository, never()).findByClassroomIdOrderByOrderIndexAscCreatedAtAsc(any());
    }

    @Test
    @DisplayName("Cross-classroom analytics access by unauthorized teacher is forbidden")
    void testCoverageAnalytics_unauthorizedTeacher_throwsForbidden() {
        when(classroomRepository.findById("class-1")).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail("other.teacher@acadion.com")).thenReturn(Optional.of(otherTeacher));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                analyticsService.getClassroomCoverageAnalytics("class-1", "other.teacher@acadion.com"));

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    }

    // =========================================================================
    // FEATURE B: STUDENT REVISION AGGREGATE (TEACHER VIEW)
    // =========================================================================

    @Test
    @DisplayName("Classroom revision aggregate computes metrics accurately across eligible roster without leaking identities")
    void testClassroomRevisionAggregate_computesCorrectlyAndPreservesPrivacy() {
        when(classroomRepository.findById("class-1")).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail("teacher@acadion.com")).thenReturn(Optional.of(teacherOwner));

        SyllabusItemSnapshot s1 = SyllabusItemSnapshot.builder().topicId("top-1").topic("T1").build();
        SyllabusItemSnapshot s2 = SyllabusItemSnapshot.builder().topicId("top-2").topic("T2").build();
        SyllabusVersion version = SyllabusVersion.builder()
                .id("ver-1").classroomId("class-1").versionNumber(1).topicCount(2).topics(List.of(s1, s2))
                .build();
        when(syllabusVersionRepository.findTopByClassroomIdOrderByVersionNumberDesc("class-1"))
                .thenReturn(Optional.of(version));

        when(classroomMembershipRepository.countByClassroomIdAndMembershipStatus("class-1", "ACTIVE"))
                .thenReturn(3L);

        // Revisions for students A and B
        StudentSyllabusRevision rev1 = StudentSyllabusRevision.builder()
                .studentId("st-a").classroomId("class-1").topicId("top-1").publishedVersionId("ver-1")
                .revisionStatus(RevisionStatus.REVISED).understandingStatus(UnderstandingStatus.CONFIDENT)
                .personalNotes("Private notes of Alice")
                .build();

        StudentSyllabusRevision rev2 = StudentSyllabusRevision.builder()
                .studentId("st-a").classroomId("class-1").topicId("top-2").publishedVersionId("ver-1")
                .revisionStatus(RevisionStatus.IN_PROGRESS).understandingStatus(UnderstandingStatus.NEEDS_REVISION)
                .build();

        StudentSyllabusRevision rev3 = StudentSyllabusRevision.builder()
                .studentId("st-b").classroomId("class-1").topicId("top-1").publishedVersionId("ver-1")
                .revisionStatus(RevisionStatus.REVISED).understandingStatus(UnderstandingStatus.UNDERSTOOD)
                .build();

        when(revisionRepository.findByClassroomIdAndPublishedVersionId("class-1", "ver-1"))
                .thenReturn(List.of(rev1, rev2, rev3));

        ClassroomRevisionAggregateResponse response = analyticsService.getClassroomRevisionAggregate("class-1", null, "teacher@acadion.com");

        assertNotNull(response);
        assertEquals(3, response.getTotalEnrolledStudents());
        assertEquals(2, response.getParticipatingStudents());
        assertEquals(2, response.getTotalTopicsInVersion());
        // Status counts
        assertEquals(2, response.getTotalRevisedEntries());
        assertEquals(1, response.getTotalInProgressEntries());
        // Understanding counts
        assertEquals(1, response.getConfidentCount());
        assertEquals(1, response.getUnderstoodCount());
        assertEquals(1, response.getNeedsRevisionCount());
        // Verified disclaimer is included
        assertNotNull(response.getPrivacyNotice());
    }

    @Test
    @DisplayName("Student is forbidden from accessing teacher-level classroom revision aggregate")
    void testClassroomRevisionAggregate_studentForbidden() {
        when(classroomRepository.findById("class-1")).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail("student@acadion.com")).thenReturn(Optional.of(studentUser));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                analyticsService.getClassroomRevisionAggregate("class-1", null, "student@acadion.com"));

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    }

    // =========================================================================
    // FEATURE C: CROSS-CLASSROOM TEACHER OVERVIEW
    // =========================================================================

    @Test
    @DisplayName("Teacher overview returns only classrooms authorized to the teacher")
    void testTeacherOverview_scopedToAuthorizedClassrooms() {
        when(userRepository.findByEmail("teacher@acadion.com")).thenReturn(Optional.of(teacherOwner));
        when(classroomRepository.findByTeacherIdOrderByCreatedAtDesc("teacher-1")).thenReturn(List.of(classroom1));

        SyllabusItem item1 = SyllabusItem.builder()
                .id("t-1").classroomId("class-1").status(SyllabusStatus.COMPLETED).orderIndex(1)
                .build();
        when(syllabusItemRepository.findByClassroomIdOrderByOrderIndexAscCreatedAtAsc("class-1")).thenReturn(List.of(item1));
        when(syllabusVersionRepository.findTopByClassroomIdOrderByVersionNumberDesc("class-1")).thenReturn(Optional.empty());
        when(classroomMembershipRepository.countByClassroomIdAndMembershipStatus("class-1", "ACTIVE")).thenReturn(0L);

        TeacherClassroomsOverviewResponse response = analyticsService.getTeacherClassroomsOverview("teacher@acadion.com");

        assertNotNull(response);
        assertEquals("teacher@acadion.com", response.getTeacherEmail());
        assertEquals(1, response.getTotalManagedClassrooms());
        assertEquals(1, response.getClassrooms().size());
        assertEquals("class-1", response.getClassrooms().get(0).getClassroomId());
        assertEquals(100.0, response.getClassrooms().get(0).getCoveragePercentage());
    }

    @Test
    @DisplayName("Admin caller overview returns all classrooms across the system")
    void testTeacherOverview_adminSeesAllClassrooms() {
        when(userRepository.findByEmail("admin@acadion.com")).thenReturn(Optional.of(adminUser));
        when(classroomRepository.findAll()).thenReturn(List.of(classroom1, classroom2));
        when(syllabusItemRepository.findByClassroomIdOrderByOrderIndexAscCreatedAtAsc(any())).thenReturn(Collections.emptyList());
        when(syllabusVersionRepository.findTopByClassroomIdOrderByVersionNumberDesc(any())).thenReturn(Optional.empty());
        when(classroomMembershipRepository.countByClassroomIdAndMembershipStatus(any(), eq("ACTIVE"))).thenReturn(0L);

        TeacherClassroomsOverviewResponse response = analyticsService.getTeacherClassroomsOverview("admin@acadion.com");

        assertNotNull(response);
        assertEquals(2, response.getTotalManagedClassrooms());
    }

    // =========================================================================
    // FEATURE D: ASSESSMENT-BACKED TOPIC INSIGHTS
    // =========================================================================

    @Test
    @DisplayName("Topic assessment insight returns honest unavailable result when no confirmed mappings exist")
    void testTopicAssessmentInsights_noEvidence_returnsHonestUnavailable() {
        when(classroomRepository.findById("class-1")).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail("teacher@acadion.com")).thenReturn(Optional.of(teacherOwner));

        SyllabusItem item = SyllabusItem.builder().id("top-1").classroomId("class-1").topic("Topic 1").build();
        when(syllabusItemRepository.findByIdAndClassroomId("top-1", "class-1")).thenReturn(Optional.of(item));

        when(mappingRepository.findByClassroomIdAndSyllabusTopicId("class-1", "top-1"))
                .thenReturn(Collections.emptyList());

        TopicAssessmentInsightResponse response = analyticsService.getTopicAssessmentInsights("class-1", "top-1", "teacher@acadion.com");

        assertNotNull(response);
        assertEquals("top-1", response.getTopicId());
        assertEquals(0, response.getMappedQuestionsCount());
        assertEquals(0, response.getTotalResponsesEvaluated());
        assertEquals("NONE", response.getSampleSizeReliability());
        assertNull(response.getAverageScorePercentage());
        assertFalse(response.isRecommendedForReview());
        assertNotNull(response.getLimitationDisclaimer());
    }

    @Test
    @DisplayName("Assessment insights accurately compute scores from confirmed question mappings and student responses")
    void testTopicAssessmentInsights_confirmedMappingsWithResponses_computesAccurately() {
        when(classroomRepository.findById("class-1")).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail("teacher@acadion.com")).thenReturn(Optional.of(teacherOwner));

        SyllabusItem item = SyllabusItem.builder().id("top-1").classroomId("class-1").topic("Topic 1").build();
        when(syllabusItemRepository.findByIdAndClassroomId("top-1", "class-1")).thenReturn(Optional.of(item));

        ClassroomMembership m1 = ClassroomMembership.builder().classroomId("class-1").studentId("st-a").usnSnapshot("USN001").membershipStatus("ACTIVE").build();
        ClassroomMembership m2 = ClassroomMembership.builder().classroomId("class-1").studentId("st-b").usnSnapshot("USN002").membershipStatus("ACTIVE").build();
        when(classroomMembershipRepository.findByClassroomIdAndMembershipStatus("class-1", "ACTIVE")).thenReturn(List.of(m1, m2));

        // Confirmed mapping for Q1 on paper-1
        SyllabusAssessmentMapping confirmedMapping = SyllabusAssessmentMapping.builder()
                .id("map-1").classroomId("class-1").syllabusTopicId("top-1")
                .paperId("paper-1").questionId("Q1").confirmed(true)
                .build();

        // Unconfirmed suggested mapping for Q2 (must be excluded!)
        SyllabusAssessmentMapping unconfirmedMapping = SyllabusAssessmentMapping.builder()
                .id("map-2").classroomId("class-1").syllabusTopicId("top-1")
                .paperId("paper-1").questionId("Q2").confirmed(false)
                .build();

        when(mappingRepository.findByClassroomIdAndSyllabusTopicId("class-1", "top-1"))
                .thenReturn(List.of(confirmedMapping, unconfirmedMapping));

        // Student responses
        StudentResponse.ResponseAnswer ansA1 = StudentResponse.ResponseAnswer.builder()
                .questionId("Q1").marksObtained(8.0).maxMarks(10.0).build();
        StudentResponse.ResponseAnswer ansA2 = StudentResponse.ResponseAnswer.builder()
                .questionId("Q2").marksObtained(2.0).maxMarks(10.0).build();

        StudentResponse respA = StudentResponse.builder()
                .id("sr-1").paperId("paper-1").usn("USN001")
                .responses(List.of(ansA1, ansA2))
                .build();

        StudentResponse.ResponseAnswer ansB1 = StudentResponse.ResponseAnswer.builder()
                .questionId("Q1").marksObtained(6.0).maxMarks(10.0).build();

        StudentResponse respB = StudentResponse.builder()
                .id("sr-2").paperId("paper-1").usn("USN002")
                .responses(List.of(ansB1))
                .build();

        when(studentResponseRepository.findByPaperId("paper-1")).thenReturn(List.of(respA, respB));

        TopicAssessmentInsightResponse response = analyticsService.getTopicAssessmentInsights("class-1", "top-1", "teacher@acadion.com");

        assertNotNull(response);
        assertEquals(1, response.getMappedQuestionsCount());
        assertEquals(2, response.getTotalResponsesEvaluated());
        assertEquals(2, response.getDistinctStudentsCount());
        assertEquals(20.0, response.getTotalMaxMarks());
        assertEquals(14.0, response.getTotalMarksObtained());
        assertEquals(70.0, response.getAverageScorePercentage());
        assertFalse(response.isRecommendedForReview()); // 70% >= 50%
    }

    @Test
    @DisplayName("Assessment insights flags topic for review when average score is below threshold")
    void testTopicAssessmentInsights_lowScore_flagsForReview() {
        when(classroomRepository.findById("class-1")).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail("teacher@acadion.com")).thenReturn(Optional.of(teacherOwner));

        SyllabusItem item = SyllabusItem.builder().id("top-low").classroomId("class-1").topic("Difficult Topic").build();
        when(syllabusItemRepository.findByIdAndClassroomId("top-low", "class-1")).thenReturn(Optional.of(item));

        ClassroomMembership m1 = ClassroomMembership.builder().classroomId("class-1").studentId("st-a").usnSnapshot("USN001").membershipStatus("ACTIVE").build();
        when(classroomMembershipRepository.findByClassroomIdAndMembershipStatus("class-1", "ACTIVE")).thenReturn(List.of(m1));

        SyllabusAssessmentMapping confirmedMapping = SyllabusAssessmentMapping.builder()
                .id("map-low").classroomId("class-1").syllabusTopicId("top-low")
                .paperId("paper-1").questionId("Q1").confirmed(true)
                .build();
        when(mappingRepository.findByClassroomIdAndSyllabusTopicId("class-1", "top-low")).thenReturn(List.of(confirmedMapping));

        StudentResponse.ResponseAnswer ansA1 = StudentResponse.ResponseAnswer.builder()
                .questionId("Q1").marksObtained(3.0).maxMarks(10.0).build();

        StudentResponse respA = StudentResponse.builder()
                .id("sr-1").paperId("paper-1").usn("USN001")
                .responses(List.of(ansA1))
                .build();
        when(studentResponseRepository.findByPaperId("paper-1")).thenReturn(List.of(respA));

        TopicAssessmentInsightResponse response = analyticsService.getTopicAssessmentInsights("class-1", "top-low", "teacher@acadion.com");

        assertNotNull(response);
        assertEquals(30.0, response.getAverageScorePercentage());
        assertTrue(response.isRecommendedForReview());
        assertNotNull(response.getReviewReason());
    }
}
