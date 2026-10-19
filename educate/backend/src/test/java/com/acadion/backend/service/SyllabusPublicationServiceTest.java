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
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class SyllabusPublicationServiceTest {

    @Mock
    private SyllabusVersionRepository syllabusVersionRepository;

    @Mock
    private SyllabusItemRepository syllabusItemRepository;

    @Mock
    private ClassroomRepository classroomRepository;

    @Mock
    private ClassroomMembershipRepository classroomMembershipRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private SyllabusAuditService auditService;

    @Mock
    private SyllabusNotificationService notificationService;

    @InjectMocks
    private SyllabusPublicationService publicationService;

    private User teacherOwner;
    private User otherTeacher;
    private User activeStudent;
    private Classroom classroom1;
    private SyllabusItem item1;
    private SyllabusItem item2;

    @BeforeEach
    void setUp() {
        teacherOwner = User.builder()
                .id("teacher_1")
                .name("Prof. Turing")
                .email("turing@acadion.com")
                .role(Role.TEACHER)
                .build();

        otherTeacher = User.builder()
                .id("teacher_2")
                .name("Prof. Babbage")
                .email("babbage@acadion.com")
                .role(Role.TEACHER)
                .build();

        activeStudent = User.builder()
                .id("student_1")
                .name("Ada Lovelace")
                .email("ada@student.com")
                .role(Role.STUDENT)
                .build();

        classroom1 = Classroom.builder()
                .id("cls_1")
                .name("Algorithms")
                .subjectCode("21CS42")
                .teacherId(teacherOwner.getId())
                .status("ACTIVE")
                .build();

        item1 = SyllabusItem.builder()
                .id("item_1")
                .classroomId(classroom1.getId())
                .unit("Unit 1")
                .topic("Big-O Notation")
                .description("Asymptotic bounds")
                .status(SyllabusStatus.COMPLETED)
                .orderIndex(0)
                .learningObjectives(new java.util.ArrayList<>(List.of("Upper bound analysis")))
                .teachingNotes("Use formal definitions")
                .estimatedHours(3.0)
                .plannedStartDate(LocalDate.of(2026, 9, 1))
                .plannedCompletionDate(LocalDate.of(2026, 9, 5))
                .learningResources(List.of(LearningResource.builder().label("Slides").url("https://acadion.edu/l1.pdf").build()))
                .createdBy(teacherOwner.getId())
                .createdAt(LocalDateTime.now().minusDays(5))
                .updatedAt(LocalDateTime.now().minusDays(1))
                .build();

        item2 = SyllabusItem.builder()
                .id("item_2")
                .classroomId(classroom1.getId())
                .unit("Unit 2")
                .topic("Divide and Conquer")
                .status(SyllabusStatus.IN_PROGRESS)
                .orderIndex(1)
                .createdBy(teacherOwner.getId())
                .createdAt(LocalDateTime.now().minusDays(3))
                .updatedAt(LocalDateTime.now().minusDays(1))
                .build();
    }

    // -------------------------------------------------------------------------
    // 5. Publishing creates the first version (v1)
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("5. Publishing creates the first version (v1) with immutable topic snapshots")
    void testPublishingCreatesFirstVersion() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacherOwner.getEmail())).thenReturn(Optional.of(teacherOwner));
        when(syllabusItemRepository.findByClassroomIdOrderByOrderIndexAscCreatedAtAsc(classroom1.getId()))
                .thenReturn(List.of(item1, item2));
        when(syllabusVersionRepository.findTopByClassroomIdOrderByVersionNumberDesc(classroom1.getId()))
                .thenReturn(Optional.empty());
        when(syllabusVersionRepository.save(any(SyllabusVersion.class))).thenAnswer(inv -> {
            SyllabusVersion v = inv.getArgument(0);
            v.setId("version_v1");
            return v;
        });

        PublishSyllabusRequest req = PublishSyllabusRequest.builder()
                .versionTitle("Initial Syllabus")
                .changeSummary("Initial publication for semester start")
                .build();

        SyllabusVersionResponse response = publicationService.publishSyllabus(classroom1.getId(), req, teacherOwner.getEmail());

        assertNotNull(response);
        assertEquals(1, response.getVersionNumber());
        assertEquals("Initial Syllabus", response.getVersionTitle());
        assertEquals(2, response.getTopicCount());
        assertEquals(2, response.getTopics().size());
        assertEquals("item_1", response.getTopics().get(0).getTopicId());
        assertEquals("Big-O Notation", response.getTopics().get(0).getTopic());
        assertEquals(3.0, response.getTopics().get(0).getEstimatedHours());

        verify(syllabusVersionRepository).save(any(SyllabusVersion.class));
        verify(auditService).recordEvent(eq(classroom1.getId()), isNull(), eq("version_v1"), isNull(),
                eq(teacherOwner), eq(SyllabusAuditEventType.SYLLABUS_PUBLISHED), anyString(), anyMap());
    }

    // -------------------------------------------------------------------------
    // 6. Publishing again creates a distinct version (v2)
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("6. Publishing again creates a distinct incremented version (v2)")
    void testPublishingAgainCreatesDistinctVersion() {
        SyllabusVersion existingV1 = SyllabusVersion.builder()
                .id("version_v1")
                .classroomId(classroom1.getId())
                .versionNumber(1)
                .build();

        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacherOwner.getEmail())).thenReturn(Optional.of(teacherOwner));
        when(syllabusItemRepository.findByClassroomIdOrderByOrderIndexAscCreatedAtAsc(classroom1.getId()))
                .thenReturn(List.of(item1));
        when(syllabusVersionRepository.findTopByClassroomIdOrderByVersionNumberDesc(classroom1.getId()))
                .thenReturn(Optional.of(existingV1));
        when(syllabusVersionRepository.save(any(SyllabusVersion.class))).thenAnswer(inv -> inv.getArgument(0));

        PublishSyllabusRequest req = PublishSyllabusRequest.builder()
                .versionTitle("Midterm Update")
                .changeSummary("Refined scope")
                .build();

        SyllabusVersionResponse response = publicationService.publishSyllabus(classroom1.getId(), req, teacherOwner.getEmail());

        assertEquals(2, response.getVersionNumber());
        assertEquals("Midterm Update", response.getVersionTitle());
    }

    // -------------------------------------------------------------------------
    // 7. Editing a draft does not mutate an earlier published snapshot
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("7. Editing draft topics does not mutate an earlier published snapshot (immutability)")
    void testEditingDraftDoesNotMutateEarlierSnapshot() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacherOwner.getEmail())).thenReturn(Optional.of(teacherOwner));
        when(syllabusItemRepository.findByClassroomIdOrderByOrderIndexAscCreatedAtAsc(classroom1.getId()))
                .thenReturn(List.of(item1));
        when(syllabusVersionRepository.findTopByClassroomIdOrderByVersionNumberDesc(classroom1.getId()))
                .thenReturn(Optional.empty());

        // Capture snapshot saved in version
        final SyllabusVersion[] capturedVersion = new SyllabusVersion[1];
        when(syllabusVersionRepository.save(any(SyllabusVersion.class))).thenAnswer(inv -> {
            capturedVersion[0] = inv.getArgument(0);
            return capturedVersion[0];
        });

        publicationService.publishSyllabus(classroom1.getId(), null, teacherOwner.getEmail());

        assertNotNull(capturedVersion[0]);
        SyllabusItemSnapshot snapshot = capturedVersion[0].getTopics().get(0);
        assertEquals("Big-O Notation", snapshot.getTopic());
        assertEquals(3.0, snapshot.getEstimatedHours());

        // Mutate original draft item
        item1.setTopic("Mutated Topic Title");
        item1.setEstimatedHours(10.0);
        item1.getLearningObjectives().add("New Objective Injected");

        // Published snapshot remains unaffected!
        assertEquals("Big-O Notation", snapshot.getTopic());
        assertEquals(3.0, snapshot.getEstimatedHours());
        assertEquals(1, snapshot.getLearningObjectives().size());
    }

    // -------------------------------------------------------------------------
    // 8. Deleting a draft topic does not remove it from historical snapshots
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("8. Deleting a draft topic leaves historical snapshots completely intact")
    void testDeletingDraftTopicPreservesHistoricalSnapshots() {
        SyllabusItemSnapshot snapshot = SyllabusItemSnapshot.builder()
                .topicId("deleted_item_id")
                .unit("Unit 1")
                .topic("Deleted Topic")
                .status(SyllabusStatus.NOT_STARTED)
                .build();

        SyllabusVersion v1 = SyllabusVersion.builder()
                .id("v1_id")
                .classroomId(classroom1.getId())
                .versionNumber(1)
                .topicCount(1)
                .topics(List.of(snapshot))
                .build();

        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacherOwner.getEmail())).thenReturn(Optional.of(teacherOwner));
        when(syllabusVersionRepository.findByClassroomIdAndVersionNumber(classroom1.getId(), 1))
                .thenReturn(Optional.of(v1));

        SyllabusVersionResponse fetched = publicationService.getPublishedVersion(classroom1.getId(), 1, teacherOwner.getEmail());

        assertNotNull(fetched);
        assertEquals(1, fetched.getTopics().size());
        assertEquals("deleted_item_id", fetched.getTopics().get(0).getTopicId());
        assertEquals("Deleted Topic", fetched.getTopics().get(0).getTopic());
    }

    // -------------------------------------------------------------------------
    // 9. Unauthorized teachers cannot publish another classroom's syllabus
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("9. Unauthorized teachers cannot publish another classroom's syllabus (403 Forbidden)")
    void testUnauthorizedTeacherCannotPublish() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(otherTeacher.getEmail())).thenReturn(Optional.of(otherTeacher));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                publicationService.publishSyllabus(classroom1.getId(), null, otherTeacher.getEmail())
        );

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        verify(syllabusVersionRepository, never()).save(any());
    }

    // -------------------------------------------------------------------------
    // 10. Version retrieval cannot cross classroom boundaries
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("10. Version retrieval cannot cross classroom boundaries (404 Not Found)")
    void testVersionRetrievalCannotCrossClassrooms() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacherOwner.getEmail())).thenReturn(Optional.of(teacherOwner));
        when(syllabusVersionRepository.findByIdAndClassroomId("foreign_ver_id", classroom1.getId()))
                .thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                publicationService.getPublishedVersionById(classroom1.getId(), "foreign_ver_id", teacherOwner.getEmail())
        );

        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
    }

    // -------------------------------------------------------------------------
    // 11. Failed publication does not leave a misleading success result
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("11. Attempting to publish an empty syllabus draft is rejected with 400 Bad Request")
    void testPublishingEmptySyllabusFails() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacherOwner.getEmail())).thenReturn(Optional.of(teacherOwner));
        when(syllabusItemRepository.findByClassroomIdOrderByOrderIndexAscCreatedAtAsc(classroom1.getId()))
                .thenReturn(Collections.emptyList());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                publicationService.publishSyllabus(classroom1.getId(), null, teacherOwner.getEmail())
        );

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().contains("Cannot publish an empty syllabus"));
        verify(syllabusVersionRepository, never()).save(any());
        verify(auditService, never()).recordEvent(any(), any(), any(), any(), any(), any(), any(), any());
    }
}
