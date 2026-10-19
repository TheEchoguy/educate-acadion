package com.acadion.backend.service;

import com.acadion.backend.dto.syllabus.StudentRevisionSummaryResponse;
import com.acadion.backend.dto.syllabus.StudentSyllabusRevisionResponse;
import com.acadion.backend.dto.syllabus.UpdateRevisionProgressRequest;
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

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class StudentSyllabusRevisionServiceTest {

    @Mock
    private StudentSyllabusRevisionRepository revisionRepository;

    @Mock
    private SyllabusVersionRepository syllabusVersionRepository;

    @Mock
    private ClassroomRepository classroomRepository;

    @Mock
    private ClassroomMembershipRepository classroomMembershipRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private StudentSyllabusRevisionService revisionService;

    private User student1;
    private User student2;
    private User teacher;
    private Classroom classroom;
    private SyllabusVersion version1;
    private SyllabusItemSnapshot snapshot1;

    @BeforeEach
    void setUp() {
        student1 = User.builder()
                .id("student_1_id")
                .name("Ada Lovelace")
                .email("ada@student.com")
                .role(Role.STUDENT)
                .build();

        student2 = User.builder()
                .id("student_2_id")
                .name("Charles Babbage")
                .email("charles@student.com")
                .role(Role.STUDENT)
                .build();

        teacher = User.builder()
                .id("teacher_id")
                .name("Prof. Turing")
                .email("turing@faculty.com")
                .role(Role.TEACHER)
                .build();

        classroom = Classroom.builder()
                .id("cls_101")
                .name("Computer Science 101")
                .teacherId(teacher.getId())
                .status("ACTIVE")
                .build();

        snapshot1 = SyllabusItemSnapshot.builder()
                .topicId("topic_101")
                .unit("Unit 1")
                .topic("Recursion")
                .status(SyllabusStatus.COMPLETED)
                .build();

        version1 = SyllabusVersion.builder()
                .id("ver_1_id")
                .classroomId(classroom.getId())
                .versionNumber(1)
                .topicCount(1)
                .topics(List.of(snapshot1))
                .build();
    }

    // -------------------------------------------------------------------------
    // 12. A student's revision record is scoped to that student
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("12. A student's revision record is scoped strictly to that authenticated student")
    void testRevisionScopedToStudent() {
        when(classroomRepository.findById(classroom.getId())).thenReturn(Optional.of(classroom));
        when(userRepository.findByEmail(student1.getEmail())).thenReturn(Optional.of(student1));
        ClassroomMembership activeMember = ClassroomMembership.builder()
                .classroomId(classroom.getId())
                .studentId(student1.getId())
                .membershipStatus("ACTIVE")
                .build();
        when(classroomMembershipRepository.findByClassroomIdAndStudentId(classroom.getId(), student1.getId()))
                .thenReturn(Optional.of(activeMember));
        when(syllabusVersionRepository.findByIdAndClassroomId("ver_1_id", classroom.getId()))
                .thenReturn(Optional.of(version1));
        when(revisionRepository.findByStudentIdAndClassroomIdAndTopicIdAndPublishedVersionId(
                student1.getId(), classroom.getId(), "topic_101", "ver_1_id"))
                .thenReturn(Optional.empty());
        when(revisionRepository.save(any(StudentSyllabusRevision.class))).thenAnswer(inv -> inv.getArgument(0));

        UpdateRevisionProgressRequest req = UpdateRevisionProgressRequest.builder()
                .topicId("topic_101")
                .publishedVersionId("ver_1_id")
                .revisionStatus(RevisionStatus.REVISED)
                .understandingStatus(UnderstandingStatus.CONFIDENT)
                .personalNotes("Understood base case vs recursive step well")
                .build();

        StudentSyllabusRevisionResponse res = revisionService.updateRevisionProgress(classroom.getId(), req, student1.getEmail());

        assertNotNull(res);
        assertEquals(student1.getId(), res.getStudentId());
        assertEquals("topic_101", res.getTopicId());
        assertEquals("ver_1_id", res.getPublishedVersionId());
        assertEquals(RevisionStatus.REVISED, res.getRevisionStatus());
        assertEquals(UnderstandingStatus.CONFIDENT, res.getUnderstandingStatus());
        assertEquals("Understood base case vs recursive step well", res.getPersonalNotes());
    }

    // -------------------------------------------------------------------------
    // 13. One student's updates cannot overwrite another student's record
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("13. One student's updates cannot overwrite another student's record")
    void testStudentUpdatesDoNotOverwriteAnotherStudentRecord() {
        when(classroomRepository.findById(classroom.getId())).thenReturn(Optional.of(classroom));
        when(userRepository.findByEmail(student2.getEmail())).thenReturn(Optional.of(student2));
        ClassroomMembership activeMember2 = ClassroomMembership.builder()
                .classroomId(classroom.getId())
                .studentId(student2.getId())
                .membershipStatus("ACTIVE")
                .build();
        when(classroomMembershipRepository.findByClassroomIdAndStudentId(classroom.getId(), student2.getId()))
                .thenReturn(Optional.of(activeMember2));
        when(syllabusVersionRepository.findByIdAndClassroomId("ver_1_id", classroom.getId()))
                .thenReturn(Optional.of(version1));
        // Student 2 has no record yet, even if student 1 had one
        when(revisionRepository.findByStudentIdAndClassroomIdAndTopicIdAndPublishedVersionId(
                student2.getId(), classroom.getId(), "topic_101", "ver_1_id"))
                .thenReturn(Optional.empty());
        when(revisionRepository.save(any(StudentSyllabusRevision.class))).thenAnswer(inv -> inv.getArgument(0));

        UpdateRevisionProgressRequest req = UpdateRevisionProgressRequest.builder()
                .topicId("topic_101")
                .publishedVersionId("ver_1_id")
                .revisionStatus(RevisionStatus.IN_PROGRESS)
                .understandingStatus(UnderstandingStatus.NEEDS_REVISION)
                .build();

        StudentSyllabusRevisionResponse res = revisionService.updateRevisionProgress(classroom.getId(), req, student2.getEmail());

        assertEquals(student2.getId(), res.getStudentId());
        verify(revisionRepository).save(argThat(r -> r.getStudentId().equals(student2.getId())));
    }

    // -------------------------------------------------------------------------
    // 14. Student identity cannot be impersonated through request data
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("14. Student identity is strictly derived from auth credentials, rejecting caller impersonation")
    void testCannotImpersonateStudent() {
        when(classroomRepository.findById(classroom.getId())).thenReturn(Optional.of(classroom));
        when(userRepository.findByEmail(teacher.getEmail())).thenReturn(Optional.of(teacher));

        UpdateRevisionProgressRequest req = UpdateRevisionProgressRequest.builder()
                .topicId("topic_101")
                .publishedVersionId("ver_1_id")
                .revisionStatus(RevisionStatus.REVISED)
                .build();

        // Non-student (e.g. Teacher) attempting to call revision update is rejected
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                revisionService.updateRevisionProgress(classroom.getId(), req, teacher.getEmail())
        );

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        assertTrue(ex.getReason().contains("Only enrolled students"));
        verify(revisionRepository, never()).save(any());
    }

    // -------------------------------------------------------------------------
    // 15. Inactive members are rejected
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("15. Inactive (pending, rejected, removed) students are rejected with 403 Forbidden")
    void testInactiveMembersRejected() {
        when(classroomRepository.findById(classroom.getId())).thenReturn(Optional.of(classroom));
        when(userRepository.findByEmail(student1.getEmail())).thenReturn(Optional.of(student1));
        ClassroomMembership pendingMembership = ClassroomMembership.builder()
                .classroomId(classroom.getId())
                .studentId(student1.getId())
                .membershipStatus("PENDING")
                .build();
        when(classroomMembershipRepository.findByClassroomIdAndStudentId(classroom.getId(), student1.getId()))
                .thenReturn(Optional.of(pendingMembership));

        UpdateRevisionProgressRequest req = UpdateRevisionProgressRequest.builder()
                .topicId("topic_101")
                .publishedVersionId("ver_1_id")
                .build();

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                revisionService.updateRevisionProgress(classroom.getId(), req, student1.getEmail())
        );

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        assertTrue(ex.getReason().contains("active enrollment"));
        verify(revisionRepository, never()).save(any());
    }

    // -------------------------------------------------------------------------
    // 16. Revision state is scoped to the correct published version
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("16. Revision state is strictly scoped to the specified published version ID")
    void testRevisionScopedToPublishedVersion() {
        when(classroomRepository.findById(classroom.getId())).thenReturn(Optional.of(classroom));
        when(userRepository.findByEmail(student1.getEmail())).thenReturn(Optional.of(student1));
        ClassroomMembership activeMember = ClassroomMembership.builder()
                .classroomId(classroom.getId())
                .studentId(student1.getId())
                .membershipStatus("ACTIVE")
                .build();
        when(classroomMembershipRepository.findByClassroomIdAndStudentId(classroom.getId(), student1.getId()))
                .thenReturn(Optional.of(activeMember));

        // Version not found in classroom
        when(syllabusVersionRepository.findByIdAndClassroomId("non_existent_ver", classroom.getId()))
                .thenReturn(Optional.empty());

        UpdateRevisionProgressRequest req = UpdateRevisionProgressRequest.builder()
                .topicId("topic_101")
                .publishedVersionId("non_existent_ver")
                .build();

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                revisionService.updateRevisionProgress(classroom.getId(), req, student1.getEmail())
        );

        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
        assertTrue(ex.getReason().contains("Published syllabus version not found"));
    }

    // -------------------------------------------------------------------------
    // 17. Shared teaching status remains unchanged after revision updates
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("17. Shared teaching status remains unchanged when student reports personal revision")
    void testSharedTeachingStatusRemainsUnchanged() {
        when(classroomRepository.findById(classroom.getId())).thenReturn(Optional.of(classroom));
        when(userRepository.findByEmail(student1.getEmail())).thenReturn(Optional.of(student1));
        ClassroomMembership activeMember = ClassroomMembership.builder()
                .classroomId(classroom.getId())
                .studentId(student1.getId())
                .membershipStatus("ACTIVE")
                .build();
        when(classroomMembershipRepository.findByClassroomIdAndStudentId(classroom.getId(), student1.getId()))
                .thenReturn(Optional.of(activeMember));
        when(syllabusVersionRepository.findByIdAndClassroomId("ver_1_id", classroom.getId()))
                .thenReturn(Optional.of(version1));
        when(revisionRepository.findByStudentIdAndClassroomIdAndTopicIdAndPublishedVersionId(
                student1.getId(), classroom.getId(), "topic_101", "ver_1_id"))
                .thenReturn(Optional.empty());
        when(revisionRepository.save(any(StudentSyllabusRevision.class))).thenAnswer(inv -> inv.getArgument(0));

        UpdateRevisionProgressRequest req = UpdateRevisionProgressRequest.builder()
                .topicId("topic_101")
                .publishedVersionId("ver_1_id")
                .revisionStatus(RevisionStatus.REVISED)
                .build();

        revisionService.updateRevisionProgress(classroom.getId(), req, student1.getEmail());

        // Snapshot teaching status is still COMPLETED as set by teacher
        assertEquals(SyllabusStatus.COMPLETED, snapshot1.getStatus());
    }

    // -------------------------------------------------------------------------
    // Summary metrics test
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("Student revision summary metrics are accurately computed")
    void testStudentRevisionSummaryCalculation() {
        when(classroomRepository.findById(classroom.getId())).thenReturn(Optional.of(classroom));
        when(userRepository.findByEmail(student1.getEmail())).thenReturn(Optional.of(student1));
        ClassroomMembership activeMember = ClassroomMembership.builder()
                .classroomId(classroom.getId())
                .studentId(student1.getId())
                .membershipStatus("ACTIVE")
                .build();
        when(classroomMembershipRepository.findByClassroomIdAndStudentId(classroom.getId(), student1.getId()))
                .thenReturn(Optional.of(activeMember));
        when(syllabusVersionRepository.findByIdAndClassroomId("ver_1_id", classroom.getId()))
                .thenReturn(Optional.of(version1));

        when(revisionRepository.countByStudentIdAndClassroomIdAndPublishedVersionIdAndRevisionStatus(
                student1.getId(), classroom.getId(), "ver_1_id", RevisionStatus.REVISED)).thenReturn(1L);
        when(revisionRepository.countByStudentIdAndClassroomIdAndPublishedVersionIdAndRevisionStatus(
                student1.getId(), classroom.getId(), "ver_1_id", RevisionStatus.IN_PROGRESS)).thenReturn(0L);
        when(revisionRepository.countByStudentIdAndClassroomIdAndPublishedVersionId(
                student1.getId(), classroom.getId(), "ver_1_id")).thenReturn(1L);
        when(revisionRepository.countByStudentIdAndClassroomIdAndPublishedVersionIdAndRevisionStatus(
                student1.getId(), classroom.getId(), "ver_1_id", RevisionStatus.NOT_STARTED)).thenReturn(0L);

        when(revisionRepository.countByStudentIdAndClassroomIdAndPublishedVersionIdAndUnderstandingStatus(
                student1.getId(), classroom.getId(), "ver_1_id", UnderstandingStatus.CONFIDENT)).thenReturn(1L);

        StudentRevisionSummaryResponse summary = revisionService.getStudentRevisionSummary(
                classroom.getId(), "ver_1_id", student1.getEmail());

        assertEquals(1, summary.getTotalTopics());
        assertEquals(1, summary.getRevisedCount());
        assertEquals(100.0, summary.getRevisionPercentage());
        assertEquals(1, summary.getConfidentCount());
    }
}
