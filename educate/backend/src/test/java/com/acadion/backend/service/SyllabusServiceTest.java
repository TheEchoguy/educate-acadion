package com.acadion.backend.service;

import com.acadion.backend.dto.syllabus.*;
import com.acadion.backend.entity.*;
import com.acadion.backend.repository.ClassroomMembershipRepository;
import com.acadion.backend.repository.ClassroomRepository;
import com.acadion.backend.repository.SyllabusItemRepository;
import com.acadion.backend.repository.SyllabusVersionRepository;
import com.acadion.backend.repository.UserRepository;
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
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class SyllabusServiceTest {

    @Mock
    private SyllabusItemRepository syllabusItemRepository;

    @Mock
    private SyllabusVersionRepository syllabusVersionRepository;

    @Mock
    private ClassroomRepository classroomRepository;

    @Mock
    private ClassroomMembershipRepository classroomMembershipRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private SyllabusAuditService auditService;

    @InjectMocks
    private SyllabusService syllabusService;

    private User teacherOwner;
    private User otherTeacher;
    private User activeStudent;
    private User pendingStudent;
    private User removedStudent;
    private Classroom classroom1;
    private Classroom otherClassroom;
    private SyllabusItem item1;

    @BeforeEach
    void setUp() {
        teacherOwner = User.builder()
                .id("teacher_owner_id")
                .name("Prof. Turing")
                .email("turing@acadion.com")
                .role(Role.TEACHER)
                .build();

        otherTeacher = User.builder()
                .id("other_teacher_id")
                .name("Prof. Babbage")
                .email("babbage@acadion.com")
                .role(Role.TEACHER)
                .build();

        activeStudent = User.builder()
                .id("active_student_id")
                .name("Ada Lovelace")
                .email("ada@student.com")
                .role(Role.STUDENT)
                .usn("1DB21CS001")
                .build();

        pendingStudent = User.builder()
                .id("pending_student_id")
                .name("Pending Student")
                .email("pending@student.com")
                .role(Role.STUDENT)
                .usn("1DB21CS002")
                .build();

        removedStudent = User.builder()
                .id("removed_student_id")
                .name("Removed Student")
                .email("removed@student.com")
                .role(Role.STUDENT)
                .usn("1DB21CS003")
                .build();

        classroom1 = Classroom.builder()
                .id("class_1_id")
                .name("Algorithms & Data Structures")
                .subjectCode("21CS42")
                .teacherId(teacherOwner.getId())
                .status("ACTIVE")
                .build();

        otherClassroom = Classroom.builder()
                .id("class_2_id")
                .name("Operating Systems")
                .subjectCode("21CS43")
                .teacherId(otherTeacher.getId())
                .status("ACTIVE")
                .build();

        item1 = SyllabusItem.builder()
                .id("item_1_id")
                .classroomId(classroom1.getId())
                .unit("Unit 1: Introduction")
                .topic("Asymptotic Analysis")
                .description("Big-O notation and growth rates")
                .status(SyllabusStatus.NOT_STARTED)
                .orderIndex(0)
                .createdBy(teacherOwner.getId())
                .createdAt(LocalDateTime.now().minusDays(1))
                .updatedAt(LocalDateTime.now().minusDays(1))
                .build();
    }

    // -------------------------------------------------------------------------
    // 1. Teacher creates an item in their own classroom
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("1. Teacher creates an item in their own classroom successfully")
    void testTeacherCreatesItemInOwnClassroom() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacherOwner.getEmail())).thenReturn(Optional.of(teacherOwner));
        when(syllabusItemRepository.countByClassroomId(classroom1.getId())).thenReturn(0L);
        when(syllabusItemRepository.save(any(SyllabusItem.class))).thenAnswer(invocation -> {
            SyllabusItem saved = invocation.getArgument(0);
            saved.setId("generated_item_id");
            return saved;
        });

        CreateSyllabusItemRequest request = CreateSyllabusItemRequest.builder()
                .unit("Unit 1")
                .topic("Divide and Conquer")
                .description("Binary search, Merge sort")
                .build();

        SyllabusItemResponse response = syllabusService.createSyllabusItem(classroom1.getId(), request, teacherOwner.getEmail());

        assertNotNull(response);
        assertEquals("generated_item_id", response.getId());
        assertEquals(classroom1.getId(), response.getClassroomId());
        assertEquals("Unit 1", response.getUnit());
        assertEquals("Divide and Conquer", response.getTopic());
        assertEquals(SyllabusStatus.NOT_STARTED, response.getStatus());
        verify(syllabusItemRepository, times(1)).save(any(SyllabusItem.class));
    }

    // -------------------------------------------------------------------------
    // 2. Creator ID is taken from the authenticated teacher
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("2. Creator ID is taken from the authenticated teacher, ignoring any untrusted fields")
    void testCreatorIdTakenFromAuthenticatedTeacher() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacherOwner.getEmail())).thenReturn(Optional.of(teacherOwner));
        when(syllabusItemRepository.countByClassroomId(classroom1.getId())).thenReturn(1L);
        when(syllabusItemRepository.save(any(SyllabusItem.class))).thenAnswer(invocation -> invocation.getArgument(0));

        CreateSyllabusItemRequest request = CreateSyllabusItemRequest.builder()
                .unit("Unit 2")
                .topic("Greedy Algorithms")
                .build();

        SyllabusItemResponse res = syllabusService.createSyllabusItem(classroom1.getId(), request, teacherOwner.getEmail());

        assertEquals(teacherOwner.getId(), res.getCreatedBy());
        verify(syllabusItemRepository).save(argThat(item -> item.getCreatedBy().equals(teacherOwner.getId())));
    }

    // -------------------------------------------------------------------------
    // 3. Default status becomes NOT_STARTED
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("3. Default status becomes NOT_STARTED when status is not specified")
    void testDefaultStatusBecomesNotStarted() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacherOwner.getEmail())).thenReturn(Optional.of(teacherOwner));
        when(syllabusItemRepository.countByClassroomId(classroom1.getId())).thenReturn(0L);
        when(syllabusItemRepository.save(any(SyllabusItem.class))).thenAnswer(invocation -> invocation.getArgument(0));

        CreateSyllabusItemRequest request = CreateSyllabusItemRequest.builder()
                .unit("Unit 1")
                .topic("Dynamic Programming")
                .status(null)
                .build();

        SyllabusItemResponse res = syllabusService.createSyllabusItem(classroom1.getId(), request, teacherOwner.getEmail());

        assertEquals(SyllabusStatus.NOT_STARTED, res.getStatus());
    }

    // -------------------------------------------------------------------------
    // 4. Teacher lists their own classroom syllabus
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("4. Teacher lists their own classroom syllabus")
    void testTeacherListsOwnClassroomSyllabus() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacherOwner.getEmail())).thenReturn(Optional.of(teacherOwner));
        when(syllabusItemRepository.findByClassroomIdOrderByOrderIndexAscCreatedAtAsc(classroom1.getId()))
                .thenReturn(List.of(item1));

        List<SyllabusItemResponse> list = syllabusService.getSyllabusItems(classroom1.getId(), teacherOwner.getEmail());

        assertEquals(1, list.size());
        assertEquals(item1.getId(), list.get(0).getId());
        assertEquals("Asymptotic Analysis", list.get(0).getTopic());
    }

    // -------------------------------------------------------------------------
    // 5. Active student member can list the classroom syllabus
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("5. Active student member can list the classroom syllabus (published version)")
    void testActiveStudentMemberCanListSyllabus() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(activeStudent.getEmail())).thenReturn(Optional.of(activeStudent));
        ClassroomMembership activeMembership = ClassroomMembership.builder()
                .classroomId(classroom1.getId())
                .studentId(activeStudent.getId())
                .membershipStatus("ACTIVE")
                .build();
        when(classroomMembershipRepository.findByClassroomIdAndStudentId(classroom1.getId(), activeStudent.getId()))
                .thenReturn(Optional.of(activeMembership));

        SyllabusItemSnapshot snapshot = SyllabusItemSnapshot.builder()
                .topicId(item1.getId())
                .unit(item1.getUnit())
                .topic(item1.getTopic())
                .status(item1.getStatus())
                .orderIndex(item1.getOrderIndex())
                .build();
        SyllabusVersion version = SyllabusVersion.builder()
                .id("ver_1")
                .classroomId(classroom1.getId())
                .versionNumber(1)
                .topics(List.of(snapshot))
                .build();

        when(syllabusVersionRepository.findTopByClassroomIdOrderByVersionNumberDesc(classroom1.getId()))
                .thenReturn(Optional.of(version));

        List<SyllabusItemResponse> list = syllabusService.getSyllabusItems(classroom1.getId(), activeStudent.getEmail());

        assertEquals(1, list.size());
        assertEquals(item1.getId(), list.get(0).getId());
        assertEquals("Asymptotic Analysis", list.get(0).getTopic());
    }

    @Test
    @DisplayName("5b. Active student sees empty list when no version is published (draft hidden)")
    void testActiveStudentSeesEmptyListWhenNoVersionPublished() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(activeStudent.getEmail())).thenReturn(Optional.of(activeStudent));
        ClassroomMembership activeMembership = ClassroomMembership.builder()
                .classroomId(classroom1.getId())
                .studentId(activeStudent.getId())
                .membershipStatus("ACTIVE")
                .build();
        when(classroomMembershipRepository.findByClassroomIdAndStudentId(classroom1.getId(), activeStudent.getId()))
                .thenReturn(Optional.of(activeMembership));

        when(syllabusVersionRepository.findTopByClassroomIdOrderByVersionNumberDesc(classroom1.getId()))
                .thenReturn(Optional.empty());

        List<SyllabusItemResponse> list = syllabusService.getSyllabusItems(classroom1.getId(), activeStudent.getEmail());

        assertTrue(list.isEmpty());
    }

    // -------------------------------------------------------------------------
    // 6. Pending student cannot list the syllabus
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("6. Pending student cannot list the syllabus (403 Forbidden)")
    void testPendingStudentCannotListSyllabus() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(pendingStudent.getEmail())).thenReturn(Optional.of(pendingStudent));
        ClassroomMembership pendingMembership = ClassroomMembership.builder()
                .classroomId(classroom1.getId())
                .studentId(pendingStudent.getId())
                .membershipStatus("PENDING")
                .build();
        when(classroomMembershipRepository.findByClassroomIdAndStudentId(classroom1.getId(), pendingStudent.getId()))
                .thenReturn(Optional.of(pendingMembership));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                syllabusService.getSyllabusItems(classroom1.getId(), pendingStudent.getEmail())
        );

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        assertTrue(ex.getReason().contains("active enrollment"));
    }

    // -------------------------------------------------------------------------
    // 7. Removed student cannot list the syllabus
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("7. Removed student cannot list the syllabus (403 Forbidden)")
    void testRemovedStudentCannotListSyllabus() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(removedStudent.getEmail())).thenReturn(Optional.of(removedStudent));
        ClassroomMembership removedMembership = ClassroomMembership.builder()
                .classroomId(classroom1.getId())
                .studentId(removedStudent.getId())
                .membershipStatus("REMOVED")
                .build();
        when(classroomMembershipRepository.findByClassroomIdAndStudentId(classroom1.getId(), removedStudent.getId()))
                .thenReturn(Optional.of(removedMembership));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                syllabusService.getSyllabusItems(classroom1.getId(), removedStudent.getEmail())
        );

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    }

    // -------------------------------------------------------------------------
    // 8. Unrelated teacher cannot create or update items
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("8. Unrelated teacher cannot create items in another teacher's classroom (403 Forbidden)")
    void testUnrelatedTeacherCannotCreateOrUpdateItems() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(otherTeacher.getEmail())).thenReturn(Optional.of(otherTeacher));

        CreateSyllabusItemRequest request = CreateSyllabusItemRequest.builder()
                .unit("Unit 1")
                .topic("Unauthorized Topic")
                .build();

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                syllabusService.createSyllabusItem(classroom1.getId(), request, otherTeacher.getEmail())
        );

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        assertTrue(ex.getReason().contains("not authorized to manage this classroom"));
        verify(syllabusItemRepository, never()).save(any());
    }

    // -------------------------------------------------------------------------
    // 9. Teacher cannot modify an item from another classroom
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("9. Teacher cannot modify an item belonging to another classroom (404 Not Found)")
    void testTeacherCannotModifyItemFromAnotherClassroom() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacherOwner.getEmail())).thenReturn(Optional.of(teacherOwner));
        // Item belongs to classroom 2, so looking up with (item_id, class_1_id) returns empty
        when(syllabusItemRepository.findByIdAndClassroomId("item_2_id", classroom1.getId()))
                .thenReturn(Optional.empty());

        UpdateSyllabusItemRequest request = UpdateSyllabusItemRequest.builder()
                .unit("Unit 1")
                .topic("Hacked Topic")
                .status(SyllabusStatus.IN_PROGRESS)
                .build();

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                syllabusService.updateSyllabusItem(classroom1.getId(), "item_2_id", request, teacherOwner.getEmail())
        );

        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
        verify(syllabusItemRepository, never()).save(any());
    }

    // -------------------------------------------------------------------------
    // 10. Student cannot create an item
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("10. Student cannot create a syllabus item (403 Forbidden)")
    void testStudentCannotCreateItem() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(activeStudent.getEmail())).thenReturn(Optional.of(activeStudent));

        CreateSyllabusItemRequest request = CreateSyllabusItemRequest.builder()
                .unit("Unit 1")
                .topic("Student Injected Topic")
                .build();

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                syllabusService.createSyllabusItem(classroom1.getId(), request, activeStudent.getEmail())
        );

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        verify(syllabusItemRepository, never()).save(any());
    }

    // -------------------------------------------------------------------------
    // 11. Student cannot update an item
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("11. Student cannot update a syllabus item (403 Forbidden)")
    void testStudentCannotUpdateItem() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(activeStudent.getEmail())).thenReturn(Optional.of(activeStudent));

        UpdateSyllabusItemRequest request = UpdateSyllabusItemRequest.builder()
                .unit("Unit 1")
                .topic("Modified Topic")
                .status(SyllabusStatus.COMPLETED)
                .build();

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                syllabusService.updateSyllabusItem(classroom1.getId(), item1.getId(), request, activeStudent.getEmail())
        );

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        verify(syllabusItemRepository, never()).save(any());
    }

    // -------------------------------------------------------------------------
    // 12. Student cannot change a status
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("12. Student cannot change topic status (403 Forbidden)")
    void testStudentCannotChangeStatus() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(activeStudent.getEmail())).thenReturn(Optional.of(activeStudent));

        UpdateSyllabusStatusRequest request = UpdateSyllabusStatusRequest.builder()
                .status(SyllabusStatus.COMPLETED)
                .build();

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                syllabusService.updateSyllabusStatus(classroom1.getId(), item1.getId(), request, activeStudent.getEmail())
        );

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    }

    // -------------------------------------------------------------------------
    // 13. Student cannot delete an item
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("13. Student cannot delete a syllabus item (403 Forbidden)")
    void testStudentCannotDeleteItem() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(activeStudent.getEmail())).thenReturn(Optional.of(activeStudent));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                syllabusService.deleteSyllabusItem(classroom1.getId(), item1.getId(), activeStudent.getEmail())
        );

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        verify(syllabusItemRepository, never()).delete(any());
    }

    // -------------------------------------------------------------------------
    // 14. Missing classroom produces the appropriate error
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("14. Missing classroom produces 404 Not Found")
    void testMissingClassroomProducesNotFoundError() {
        when(classroomRepository.findById("non_existent_class")).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                syllabusService.getSyllabusItems("non_existent_class", teacherOwner.getEmail())
        );

        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
        assertTrue(ex.getReason().contains("Classroom not found"));
    }

    // -------------------------------------------------------------------------
    // 15. Missing syllabus item produces the appropriate error
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("15. Missing syllabus item produces 404 Not Found")
    void testMissingSyllabusItemProducesNotFoundError() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacherOwner.getEmail())).thenReturn(Optional.of(teacherOwner));
        when(syllabusItemRepository.findByIdAndClassroomId("missing_item", classroom1.getId())).thenReturn(Optional.empty());

        UpdateSyllabusStatusRequest request = UpdateSyllabusStatusRequest.builder()
                .status(SyllabusStatus.IN_PROGRESS)
                .build();

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                syllabusService.updateSyllabusStatus(classroom1.getId(), "missing_item", request, teacherOwner.getEmail())
        );

        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
        assertTrue(ex.getReason().contains("Syllabus item not found"));
    }

    // -------------------------------------------------------------------------
    // 16. Invalid status and ordering are rejected
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("16. Negative ordering or blank unit/topic are rejected with 400 Bad Request")
    void testInvalidStatusAndOrderingAreRejected() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacherOwner.getEmail())).thenReturn(Optional.of(teacherOwner));

        // Blank topic
        CreateSyllabusItemRequest reqBlank = CreateSyllabusItemRequest.builder()
                .unit("Unit 1")
                .topic("   ")
                .build();

        ResponseStatusException ex1 = assertThrows(ResponseStatusException.class, () ->
                syllabusService.createSyllabusItem(classroom1.getId(), reqBlank, teacherOwner.getEmail())
        );
        assertEquals(HttpStatus.BAD_REQUEST, ex1.getStatusCode());

        // Negative order index
        CreateSyllabusItemRequest reqNeg = CreateSyllabusItemRequest.builder()
                .unit("Unit 1")
                .topic("Valid Topic")
                .orderIndex(-5)
                .build();

        ResponseStatusException ex2 = assertThrows(ResponseStatusException.class, () ->
                syllabusService.createSyllabusItem(classroom1.getId(), reqNeg, teacherOwner.getEmail())
        );
        assertEquals(HttpStatus.BAD_REQUEST, ex2.getStatusCode());
    }

    // -------------------------------------------------------------------------
    // 17. Updating an item preserves its original creator and creation timestamp
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("17. Updating an item preserves original creator ID and creation timestamp")
    void testUpdatingItemPreservesOriginalCreatorAndCreationTimestamp() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacherOwner.getEmail())).thenReturn(Optional.of(teacherOwner));
        when(syllabusItemRepository.findByIdAndClassroomId(item1.getId(), classroom1.getId()))
                .thenReturn(Optional.of(item1));
        when(syllabusItemRepository.save(any(SyllabusItem.class))).thenAnswer(invocation -> invocation.getArgument(0));

        LocalDateTime originalCreatedAt = item1.getCreatedAt();
        String originalCreatedBy = item1.getCreatedBy();

        UpdateSyllabusItemRequest req = UpdateSyllabusItemRequest.builder()
                .unit("Unit 1 Modified")
                .topic("Asymptotic Analysis Detailed")
                .description("Updated notes")
                .status(SyllabusStatus.IN_PROGRESS)
                .orderIndex(2)
                .build();

        SyllabusItemResponse res = syllabusService.updateSyllabusItem(classroom1.getId(), item1.getId(), req, teacherOwner.getEmail());

        assertEquals(originalCreatedBy, res.getCreatedBy());
        assertEquals(originalCreatedAt, res.getCreatedAt());
        assertEquals("Unit 1 Modified", res.getUnit());
        assertEquals("Asymptotic Analysis Detailed", res.getTopic());
        assertEquals(SyllabusStatus.IN_PROGRESS, res.getStatus());
        assertEquals(2, res.getOrderIndex());
    }

    // -------------------------------------------------------------------------
    // 18. Deleting an item does not affect the classroom or its memberships
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("18. Deleting an item deletes only the syllabus item entity")
    void testDeletingItemDoesNotAffectClassroomOrMemberships() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacherOwner.getEmail())).thenReturn(Optional.of(teacherOwner));
        when(syllabusItemRepository.findByIdAndClassroomId(item1.getId(), classroom1.getId()))
                .thenReturn(Optional.of(item1));

        Map<String, Object> result = syllabusService.deleteSyllabusItem(classroom1.getId(), item1.getId(), teacherOwner.getEmail());

        assertTrue((Boolean) result.get("success"));
        verify(syllabusItemRepository, times(1)).delete(item1);
        verify(classroomRepository, never()).delete(any());
        verify(classroomMembershipRepository, never()).delete(any());
    }

    // -------------------------------------------------------------------------
    // 19. Repeated reads do not create or mutate syllabus records
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("19. Repeated reads do not create or mutate syllabus records")
    void testRepeatedReadsDoNotCreateOrMutateSyllabusRecords() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacherOwner.getEmail())).thenReturn(Optional.of(teacherOwner));
        when(syllabusItemRepository.findByClassroomIdOrderByOrderIndexAscCreatedAtAsc(classroom1.getId()))
                .thenReturn(List.of(item1));

        List<SyllabusItemResponse> res1 = syllabusService.getSyllabusItems(classroom1.getId(), teacherOwner.getEmail());
        List<SyllabusItemResponse> res2 = syllabusService.getSyllabusItems(classroom1.getId(), teacherOwner.getEmail());

        assertEquals(1, res1.size());
        assertEquals(1, res2.size());
        verify(syllabusItemRepository, never()).save(any());
        verify(syllabusItemRepository, never()).delete(any());
    }

    // -------------------------------------------------------------------------
    // 20. Progress calculation handles both populated and empty syllabuses
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("20. Progress calculation handles both populated and empty syllabuses without divide by zero")
    void testProgressCalculationHandlesBothPopulatedAndEmptySyllabuses() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacherOwner.getEmail())).thenReturn(Optional.of(teacherOwner));

        // Case A: Empty syllabus
        when(syllabusItemRepository.countByClassroomId(classroom1.getId())).thenReturn(0L);
        when(syllabusItemRepository.countByClassroomIdAndStatus(classroom1.getId(), SyllabusStatus.COMPLETED)).thenReturn(0L);
        when(syllabusItemRepository.countByClassroomIdAndStatus(classroom1.getId(), SyllabusStatus.IN_PROGRESS)).thenReturn(0L);
        when(syllabusItemRepository.countByClassroomIdAndStatus(classroom1.getId(), SyllabusStatus.PARTIALLY_COMPLETED)).thenReturn(0L);
        lenient().when(syllabusItemRepository.countByClassroomIdAndStatus(classroom1.getId(), SyllabusStatus.NOT_STARTED)).thenReturn(0L);

        SyllabusProgressResponse emptyProgress = syllabusService.getSyllabusProgress(classroom1.getId(), teacherOwner.getEmail());
        assertEquals(0L, emptyProgress.getTotalTopics());
        assertEquals(0.0, emptyProgress.getCompletionPercentage());

        // Case B: Populated syllabus (e.g., 4 topics, 2 completed -> 50.0%)
        when(syllabusItemRepository.countByClassroomId(classroom1.getId())).thenReturn(4L);
        when(syllabusItemRepository.countByClassroomIdAndStatus(classroom1.getId(), SyllabusStatus.COMPLETED)).thenReturn(2L);
        when(syllabusItemRepository.countByClassroomIdAndStatus(classroom1.getId(), SyllabusStatus.IN_PROGRESS)).thenReturn(1L);
        when(syllabusItemRepository.countByClassroomIdAndStatus(classroom1.getId(), SyllabusStatus.PARTIALLY_COMPLETED)).thenReturn(0L);
        lenient().when(syllabusItemRepository.countByClassroomIdAndStatus(classroom1.getId(), SyllabusStatus.NOT_STARTED)).thenReturn(1L);

        SyllabusProgressResponse popProgress = syllabusService.getSyllabusProgress(classroom1.getId(), teacherOwner.getEmail());
        assertEquals(4L, popProgress.getTotalTopics());
        assertEquals(2L, popProgress.getCompletedTopics());
        assertEquals(1L, popProgress.getInProgressTopics());
        assertEquals(1L, popProgress.getNotStartedTopics());
        assertEquals(50.0, popProgress.getCompletionPercentage());
    }

    // -------------------------------------------------------------------------
    // 21. Reorder syllabus items updates indices deterministically
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("21. Reorder syllabus items updates order index and updated timestamp deterministically")
    void testReorderSyllabusItemsSuccess() {
        SyllabusItem item2 = SyllabusItem.builder()
                .id("item_2_id")
                .classroomId(classroom1.getId())
                .unit("Unit 1")
                .topic("Divide & Conquer")
                .status(SyllabusStatus.NOT_STARTED)
                .orderIndex(1)
                .build();

        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacherOwner.getEmail())).thenReturn(Optional.of(teacherOwner));
        when(syllabusItemRepository.findByIdAndClassroomId("item_2_id", classroom1.getId())).thenReturn(Optional.of(item2));
        when(syllabusItemRepository.findByIdAndClassroomId("item_1_id", classroom1.getId())).thenReturn(Optional.of(item1));
        when(syllabusItemRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));

        // Request reordering: item_2 first, then item_1
        List<SyllabusItemResponse> reordered = syllabusService.reorderSyllabusItems(
                classroom1.getId(),
                List.of("item_2_id", "item_1_id"),
                teacherOwner.getEmail()
        );

        assertEquals(2, reordered.size());
        assertEquals("item_2_id", reordered.get(0).getId());
        assertEquals(0, reordered.get(0).getOrderIndex());
        assertEquals("item_1_id", reordered.get(1).getId());
        assertEquals(1, reordered.get(1).getOrderIndex());
    }

    // -------------------------------------------------------------------------
    // 22. Basic topic creation without metadata remains fully backward-compatible
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("22. Basic topic creation without optional metadata remains fully valid and backward-compatible")
    void testBasicTopicCreationWithoutMetadataRemainsValid() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacherOwner.getEmail())).thenReturn(Optional.of(teacherOwner));
        when(syllabusItemRepository.countByClassroomId(classroom1.getId())).thenReturn(0L);
        when(syllabusItemRepository.save(any(SyllabusItem.class))).thenAnswer(invocation -> invocation.getArgument(0));

        CreateSyllabusItemRequest request = CreateSyllabusItemRequest.builder()
                .unit("Unit 1")
                .topic("Simple Basic Topic")
                .build();

        SyllabusItemResponse response = syllabusService.createSyllabusItem(classroom1.getId(), request, teacherOwner.getEmail());

        assertNotNull(response);
        assertEquals("Unit 1", response.getUnit());
        assertEquals("Simple Basic Topic", response.getTopic());
        assertNull(response.getEstimatedHours());
        assertNull(response.getPlannedStartDate());
        assertNull(response.getPlannedCompletionDate());
        assertTrue(response.getLearningObjectives().isEmpty());
        assertTrue(response.getLearningResources().isEmpty());
    }

    // -------------------------------------------------------------------------
    // 23. Optional metadata is persisted and returned
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("23. Optional metadata fields are successfully validated, persisted, and returned")
    void testCreateSyllabusItemWithFullMetadata() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacherOwner.getEmail())).thenReturn(Optional.of(teacherOwner));
        when(syllabusItemRepository.countByClassroomId(classroom1.getId())).thenReturn(0L);
        when(syllabusItemRepository.save(any(SyllabusItem.class))).thenAnswer(invocation -> invocation.getArgument(0));

        LearningResource resource = LearningResource.builder()
                .label("Official Lecture Notes")
                .url("https://acadion.edu/resources/asymptotics.pdf")
                .build();

        LocalDate startDate = LocalDate.of(2026, 11, 1);
        LocalDate endDate = LocalDate.of(2026, 11, 15);

        CreateSyllabusItemRequest request = CreateSyllabusItemRequest.builder()
                .unit("Unit 1")
                .topic("Asymptotic Complexity")
                .description("Detailed analysis of algorithms")
                .learningObjectives(List.of("Understand Big-O", "Analyze recursive relations"))
                .teachingNotes("Use recursion trees for intuition")
                .estimatedHours(4.5)
                .plannedStartDate(startDate)
                .plannedCompletionDate(endDate)
                .learningResources(List.of(resource))
                .referenceMaterials("Cormen CLRS Chapter 3")
                .build();

        SyllabusItemResponse response = syllabusService.createSyllabusItem(classroom1.getId(), request, teacherOwner.getEmail());

        assertNotNull(response);
        assertEquals(4.5, response.getEstimatedHours());
        assertEquals(startDate, response.getPlannedStartDate());
        assertEquals(endDate, response.getPlannedCompletionDate());
        assertEquals(2, response.getLearningObjectives().size());
        assertEquals("Use recursion trees for intuition", response.getTeachingNotes());
        assertEquals(1, response.getLearningResources().size());
        assertEquals("https://acadion.edu/resources/asymptotics.pdf", response.getLearningResources().get(0).getUrl());
        assertEquals("Cormen CLRS Chapter 3", response.getReferenceMaterials());
    }

    // -------------------------------------------------------------------------
    // 24. Invalid negative estimated hours is rejected
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("24. Negative estimated hours is rejected with 400 Bad Request")
    void testNegativeHoursRejected() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacherOwner.getEmail())).thenReturn(Optional.of(teacherOwner));

        CreateSyllabusItemRequest request = CreateSyllabusItemRequest.builder()
                .unit("Unit 1")
                .topic("Invalid Hours Topic")
                .estimatedHours(-2.0)
                .build();

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                syllabusService.createSyllabusItem(classroom1.getId(), request, teacherOwner.getEmail())
        );

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().contains("Estimated teaching hours cannot be negative"));
    }

    // -------------------------------------------------------------------------
    // 25. Inconsistent dates are rejected
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("25. Inconsistent dates (completion before start) is rejected with 400 Bad Request")
    void testInconsistentDatesRejected() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacherOwner.getEmail())).thenReturn(Optional.of(teacherOwner));

        CreateSyllabusItemRequest request = CreateSyllabusItemRequest.builder()
                .unit("Unit 1")
                .topic("Time Travel Topic")
                .plannedStartDate(LocalDate.of(2026, 12, 10))
                .plannedCompletionDate(LocalDate.of(2026, 12, 1))
                .build();

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                syllabusService.createSyllabusItem(classroom1.getId(), request, teacherOwner.getEmail())
        );

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().contains("Planned completion date cannot be before planned start date"));
    }

    // -------------------------------------------------------------------------
    // 26. Malformed resource URL is rejected
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("26. Malformed or non-HTTP/HTTPS resource URL is rejected with 400 Bad Request")
    void testMalformedUrlRejected() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacherOwner.getEmail())).thenReturn(Optional.of(teacherOwner));

        LearningResource badResource = LearningResource.builder()
                .label("Bad Link")
                .url("ftp://not-allowed-scheme.com")
                .build();

        CreateSyllabusItemRequest request = CreateSyllabusItemRequest.builder()
                .unit("Unit 1")
                .topic("Resource Topic")
                .learningResources(List.of(badResource))
                .build();

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                syllabusService.createSyllabusItem(classroom1.getId(), request, teacherOwner.getEmail())
        );

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().contains("Resource URL must be a valid HTTP or HTTPS URL"));
    }

    // -------------------------------------------------------------------------
    // 27. Editing metadata updates updatedBy and preserves original creator and createdAt
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("27. Editing metadata updates updatedBy while preserving original creator and createdAt")
    void testEditingMetadataPreservesOriginalCreatorAndCreatedAt() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacherOwner.getEmail())).thenReturn(Optional.of(teacherOwner));
        when(syllabusItemRepository.findByIdAndClassroomId(item1.getId(), classroom1.getId()))
                .thenReturn(Optional.of(item1));
        when(syllabusItemRepository.save(any(SyllabusItem.class))).thenAnswer(invocation -> invocation.getArgument(0));

        LocalDateTime originalCreatedAt = item1.getCreatedAt();
        String originalCreatedBy = item1.getCreatedBy();

        UpdateSyllabusItemRequest request = UpdateSyllabusItemRequest.builder()
                .unit(item1.getUnit())
                .topic(item1.getTopic())
                .status(item1.getStatus())
                .estimatedHours(6.0)
                .teachingNotes("Added new pedagogical instructions")
                .build();

        SyllabusItemResponse res = syllabusService.updateSyllabusItem(classroom1.getId(), item1.getId(), request, teacherOwner.getEmail());

        assertEquals(originalCreatedBy, res.getCreatedBy());
        assertEquals(originalCreatedAt, res.getCreatedAt());
        assertEquals(teacherOwner.getId(), res.getUpdatedBy());
        assertEquals(6.0, res.getEstimatedHours());
        assertEquals("Added new pedagogical instructions", res.getTeachingNotes());
    }
}
