package com.acadion.backend.service;

import com.acadion.backend.dto.classroom.ClassroomMemberDto;
import com.acadion.backend.dto.classroom.ClassroomResponse;
import com.acadion.backend.dto.classroom.CreateClassroomRequest;
import com.acadion.backend.dto.classroom.RegenerateJoinCodeResponse;
import com.acadion.backend.dto.classroom.RosterImportSummary;
import com.acadion.backend.entity.Classroom;
import com.acadion.backend.entity.ClassroomMembership;
import com.acadion.backend.entity.Role;
import com.acadion.backend.entity.User;
import com.acadion.backend.repository.ClassroomMembershipRepository;
import com.acadion.backend.repository.ClassroomRepository;
import com.acadion.backend.repository.UserRepository;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class ClassroomServiceTest {

    @Mock
    private ClassroomRepository classroomRepository;

    @Mock
    private ClassroomMembershipRepository classroomMembershipRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder passwordEncoder;

    @InjectMocks
    private ClassroomService classroomService;

    private User teacher1;
    private User teacher2;
    private User student1;
    private User student2;
    private Classroom classroom1;

    @BeforeEach
    void setUp() {
        teacher1 = User.builder()
                .id("teacher_1_id")
                .name("Prof. Alan Turing")
                .email("turing@acadion.com")
                .role(Role.TEACHER)
                .build();

        teacher2 = User.builder()
                .id("teacher_2_id")
                .name("Prof. Ada Lovelace")
                .email("lovelace@acadion.com")
                .role(Role.TEACHER)
                .build();

        student1 = User.builder()
                .id("student_1_id")
                .name("John Doe")
                .email("john@student.com")
                .usn("1DB21CS001")
                .role(Role.STUDENT)
                .build();

        student2 = User.builder()
                .id("student_2_id")
                .name("Jane Smith")
                .email("jane@student.com")
                .usn("1DB21CS002")
                .role(Role.STUDENT)
                .build();

        classroom1 = Classroom.builder()
                .id("class_1_id")
                .name("AI & ML Section A")
                .subjectName("Artificial Intelligence")
                .subjectCode("21CS62")
                .teacherId(teacher1.getId())
                .department("CSE")
                .semester(6)
                .section("A")
                .academicBatch("2022-2026")
                .academicYear("2025-2026")
                .connectionMode("TEACHER_PROVISIONED")
                .joinCodeHash(ClassroomService.hashJoinCode("ACAD01"))
                .joinCodeEnabled(true)
                .joinCodeCreatedAt(LocalDateTime.now())
                .joinCodeExpiresAt(LocalDateTime.now().plusDays(30))
                .status("ACTIVE")
                .build();
    }

    // -------------------------------------------------------------------------
    // TEST 1: Teacher creates classroom
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("1. Teacher creates classroom with auto-generated hashed join code")
    void testTeacherCreatesClassroom() {
        when(userRepository.findByEmail(teacher1.getEmail())).thenReturn(Optional.of(teacher1));
        when(classroomRepository.save(any(Classroom.class))).thenAnswer(i -> {
            Classroom c = i.getArgument(0);
            c.setId("generated_class_id");
            return c;
        });

        CreateClassroomRequest req = CreateClassroomRequest.builder()
                .name("AI & ML")
                .subjectName("Artificial Intelligence")
                .subjectCode("21CS62")
                .department("CSE")
                .semester(6)
                .section("A")
                .academicBatch("2022-2026")
                .academicYear("2025-2026")
                .build();

        ClassroomResponse response = classroomService.createClassroom(req, teacher1.getEmail());

        assertNotNull(response);
        assertEquals("generated_class_id", response.getId());
        assertEquals("AI & ML", response.getName());
        assertEquals(teacher1.getId(), response.getTeacherId());
        assertNotNull(response.getJoinCode()); // Plain code returned to teacher
        verify(classroomRepository, times(1)).save(any(Classroom.class));
    }

    // -------------------------------------------------------------------------
    // TEST 2: Student cannot create classroom
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("2. Student cannot create classroom (Throws 403 Forbidden)")
    void testStudentCannotCreateClassroom() {
        when(userRepository.findByEmail(student1.getEmail())).thenReturn(Optional.of(student1));

        CreateClassroomRequest req = CreateClassroomRequest.builder()
                .name("Invalid Class")
                .subjectName("Subject")
                .subjectCode("SUB1")
                .department("CSE")
                .semester(6)
                .section("A")
                .academicBatch("2022-2026")
                .academicYear("2025-2026")
                .build();

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                classroomService.createClassroom(req, student1.getEmail())
        );

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        verify(classroomRepository, never()).save(any(Classroom.class));
    }

    // -------------------------------------------------------------------------
    // TEST 3: Teacher sees own classrooms
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("3. Teacher sees own classrooms")
    void testTeacherSeesOwnClassrooms() {
        when(userRepository.findByEmail(teacher1.getEmail())).thenReturn(Optional.of(teacher1));
        when(classroomRepository.findByTeacherIdOrderByCreatedAtDesc(teacher1.getId()))
                .thenReturn(List.of(classroom1));

        List<ClassroomResponse> list = classroomService.getTeacherClassrooms(teacher1.getEmail());

        assertEquals(1, list.size());
        assertEquals(classroom1.getId(), list.get(0).getId());
    }

    // -------------------------------------------------------------------------
    // TEST 4: Teacher cannot access another teacher's classroom
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("4. Teacher cannot access another teacher's classroom members (403 Forbidden)")
    void testTeacherCannotAccessAnotherTeachersClassroom() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacher2.getEmail())).thenReturn(Optional.of(teacher2));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                classroomService.getClassroomMembers(classroom1.getId(), teacher2.getEmail())
        );

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    }

    // -------------------------------------------------------------------------
    // TEST 5: Valid CSV import
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("5. Valid CSV import creates ACTIVE memberships with source ROSTER")
    void testValidCsvImport() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacher1.getEmail())).thenReturn(Optional.of(teacher1));
        when(userRepository.findByUsnIgnoreCase("1DB21CS001")).thenReturn(Optional.of(student1));
        when(userRepository.findByUsnIgnoreCase("1DB21CS002")).thenReturn(Optional.of(student2));
        when(classroomMembershipRepository.findByClassroomIdAndStudentId(eq(classroom1.getId()), any()))
                .thenReturn(Optional.empty());

        String csvContent = "USN,Name\n1DB21CS001,John Doe\n1DB21CS002,Jane Smith\n";
        MockMultipartFile file = new MockMultipartFile("file", "roster.csv", "text/csv", csvContent.getBytes(StandardCharsets.UTF_8));

        RosterImportSummary summary = classroomService.importRoster(classroom1.getId(), file, teacher1.getEmail());

        assertEquals(2, summary.getTotalRows());
        assertEquals(2, summary.getValidRows());
        assertEquals(2, summary.getMatchedCount());
        assertEquals(2, summary.getAddedCount());
        assertEquals(2, summary.getExistingVerifiedUsersLinked());
        assertEquals(0, summary.getNewStudentAccountsCreated());
        verify(classroomMembershipRepository, times(2)).save(any(ClassroomMembership.class));
    }

    // -------------------------------------------------------------------------
    // TEST 6: Valid XLSX import
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("6. Valid XLSX import successfully parses workbook and enrolls students")
    void testValidXlsxImport() throws Exception {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacher1.getEmail())).thenReturn(Optional.of(teacher1));
        when(userRepository.findByUsnIgnoreCase("1DB21CS001")).thenReturn(Optional.of(student1));
        when(classroomMembershipRepository.findByClassroomIdAndStudentId(classroom1.getId(), student1.getId()))
                .thenReturn(Optional.empty());

        Workbook workbook = new XSSFWorkbook();
        Sheet sheet = workbook.createSheet("Students");
        Row header = sheet.createRow(0);
        header.createCell(0).setCellValue("USN");
        header.createCell(1).setCellValue("Student Name");

        Row r1 = sheet.createRow(1);
        r1.createCell(0).setCellValue("1DB21CS001");
        r1.createCell(1).setCellValue("John Doe");

        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        workbook.write(bos);
        workbook.close();

        MockMultipartFile file = new MockMultipartFile("file", "roster.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bos.toByteArray());

        RosterImportSummary summary = classroomService.importRoster(classroom1.getId(), file, teacher1.getEmail());

        assertEquals(1, summary.getTotalRows());
        assertEquals(1, summary.getMatchedCount());
        assertEquals(1, summary.getAddedCount());
    }

    // -------------------------------------------------------------------------
    // TEST 7: Duplicate USN handling within file
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("7. Duplicate USN within the same file is deduplicated")
    void testDuplicateUsnHandling() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacher1.getEmail())).thenReturn(Optional.of(teacher1));
        when(userRepository.findByUsnIgnoreCase("1DB21CS001")).thenReturn(Optional.of(student1));
        when(classroomMembershipRepository.findByClassroomIdAndStudentId(eq(classroom1.getId()), any()))
                .thenReturn(Optional.empty());

        String csvContent = "USN\n1DB21CS001\n1DB21CS001\n";
        MockMultipartFile file = new MockMultipartFile("file", "roster.csv", "text/csv", csvContent.getBytes(StandardCharsets.UTF_8));

        RosterImportSummary summary = classroomService.importRoster(classroom1.getId(), file, teacher1.getEmail());

        assertEquals(1, summary.getTotalProcessed());
        assertEquals(1, summary.getDuplicatesInFile());
        assertEquals(1, summary.getAddedCount());
        assertEquals(1, summary.getDuplicateUsns().size());
    }

    // -------------------------------------------------------------------------
    // TEST 8: Unknown USN handling (Auto-creates verified Student account)
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("8. Unknown USN auto-creates verified Student User account and enrolls")
    void testUnknownUsnHandling() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacher1.getEmail())).thenReturn(Optional.of(teacher1));
        when(userRepository.findByUsnIgnoreCase("1DB99CS999")).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(i -> {
            User u = i.getArgument(0);
            u.setId("new_stu_id");
            return u;
        });

        String csvContent = "USN,Name\n1DB99CS999,Newbie Student\n";
        MockMultipartFile file = new MockMultipartFile("file", "roster.csv", "text/csv", csvContent.getBytes(StandardCharsets.UTF_8));

        RosterImportSummary summary = classroomService.importRoster(classroom1.getId(), file, teacher1.getEmail());

        assertEquals(1, summary.getTotalProcessed());
        assertEquals(1, summary.getNewStudentAccountsCreated());
        assertEquals(0, summary.getExistingVerifiedUsersLinked());
        verify(userRepository, times(1)).save(any(User.class));
        verify(classroomMembershipRepository, times(1)).save(any(ClassroomMembership.class));
    }

    // -------------------------------------------------------------------------
    // TEST 9: Existing membership handling (Reports ALREADY_MEMBER)
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("9. Existing ACTIVE membership is reported as ALREADY_MEMBER")
    void testExistingMembershipHandling() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacher1.getEmail())).thenReturn(Optional.of(teacher1));
        when(userRepository.findByUsnIgnoreCase("1DB21CS001")).thenReturn(Optional.of(student1));

        ClassroomMembership existing = ClassroomMembership.builder()
                .id("mem_1")
                .classroomId(classroom1.getId())
                .studentId(student1.getId())
                .membershipStatus("ACTIVE")
                .build();

        when(classroomMembershipRepository.findByClassroomIdAndStudentId(classroom1.getId(), student1.getId()))
                .thenReturn(Optional.of(existing));

        String csvContent = "USN\n1DB21CS001\n";
        MockMultipartFile file = new MockMultipartFile("file", "roster.csv", "text/csv", csvContent.getBytes(StandardCharsets.UTF_8));

        RosterImportSummary summary = classroomService.importRoster(classroom1.getId(), file, teacher1.getEmail());

        assertEquals(1, summary.getAlreadyMembersCount());
        assertEquals(0, summary.getAddedCount());
        assertTrue(summary.getAlreadyMemberUsns().contains("1DB21CS001"));
    }

    // -------------------------------------------------------------------------
    // TEST 10: Repeated roster upload is idempotent
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("10. Repeated roster upload is idempotent (Second upload adds 0 new)")
    void testRepeatedRosterUploadIsIdempotent() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacher1.getEmail())).thenReturn(Optional.of(teacher1));
        when(userRepository.findByUsnIgnoreCase("1DB21CS001")).thenReturn(Optional.of(student1));

        ClassroomMembership alreadyActive = ClassroomMembership.builder()
                .classroomId(classroom1.getId())
                .studentId(student1.getId())
                .membershipStatus("ACTIVE")
                .build();

        when(classroomMembershipRepository.findByClassroomIdAndStudentId(classroom1.getId(), student1.getId()))
                .thenReturn(Optional.of(alreadyActive));

        String csvContent = "USN\n1DB21CS001\n";
        MockMultipartFile file = new MockMultipartFile("file", "roster.csv", "text/csv", csvContent.getBytes(StandardCharsets.UTF_8));

        RosterImportSummary secondUpload = classroomService.importRoster(classroom1.getId(), file, teacher1.getEmail());

        assertEquals(0, secondUpload.getAddedCount());
        assertEquals(1, secondUpload.getAlreadyMembersCount());
    }

    // -------------------------------------------------------------------------
    // TEST 11: Student joins with valid code
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("11. Student joins with valid code creates ACTIVE membership immediately")
    void testStudentJoinsWithValidCode() {
        String rawCode = "ACAD01";
        String hashedCode = ClassroomService.hashJoinCode(rawCode);

        when(userRepository.findByEmail(student1.getEmail())).thenReturn(Optional.of(student1));
        when(classroomRepository.findByJoinCodeHash(hashedCode)).thenReturn(Optional.of(classroom1));
        when(classroomMembershipRepository.findByClassroomIdAndStudentId(classroom1.getId(), student1.getId()))
                .thenReturn(Optional.empty());

        Map<String, Object> result = classroomService.submitJoinRequest(rawCode, student1.getEmail());

        assertTrue((Boolean) result.get("success"));
        assertEquals("ACTIVE", result.get("status"));
        verify(classroomMembershipRepository, times(1)).save(argThat(m ->
                m.getMembershipStatus().equals("ACTIVE") && m.getMembershipSource().equals("JOIN_CODE")
        ));
    }

    // -------------------------------------------------------------------------
    // TEST 12: Invalid join code rejected
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("12. Invalid join code is rejected with 404 Not Found")
    void testInvalidJoinCodeRejected() {
        when(userRepository.findByEmail(student1.getEmail())).thenReturn(Optional.of(student1));
        when(classroomRepository.findByJoinCodeHash(anyString())).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                classroomService.submitJoinRequest("WRONG1", student1.getEmail())
        );

        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
    }

    // -------------------------------------------------------------------------
    // TEST 13: Inactive classroom join rejected
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("13. Inactive classroom join rejected with 400 Bad Request")
    void testInactiveClassroomJoinRejected() {
        classroom1.setStatus("INACTIVE");
        String rawCode = "ACAD01";
        String hashedCode = ClassroomService.hashJoinCode(rawCode);

        when(userRepository.findByEmail(student1.getEmail())).thenReturn(Optional.of(student1));
        when(classroomRepository.findByJoinCodeHash(hashedCode)).thenReturn(Optional.of(classroom1));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                classroomService.submitJoinRequest(rawCode, student1.getEmail())
        );

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
    }

    // -------------------------------------------------------------------------
    // TEST 14: Duplicate join request prevented (409 Conflict)
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("14. Duplicate join request throws 409 Conflict")
    void testDuplicateJoinRequestPrevented() {
        String rawCode = "ACAD01";
        String hashedCode = ClassroomService.hashJoinCode(rawCode);

        when(userRepository.findByEmail(student1.getEmail())).thenReturn(Optional.of(student1));
        when(classroomRepository.findByJoinCodeHash(hashedCode)).thenReturn(Optional.of(classroom1));

        ClassroomMembership alreadyActive = ClassroomMembership.builder()
                .classroomId(classroom1.getId())
                .studentId(student1.getId())
                .membershipStatus("ACTIVE")
                .build();

        when(classroomMembershipRepository.findByClassroomIdAndStudentId(classroom1.getId(), student1.getId()))
                .thenReturn(Optional.of(alreadyActive));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                classroomService.submitJoinRequest(rawCode, student1.getEmail())
        );

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
    }

    // -------------------------------------------------------------------------
    // TEST 15: Teacher approves request
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("15. Teacher approves pending request -> ACTIVE")
    void testTeacherApprovesRequest() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacher1.getEmail())).thenReturn(Optional.of(teacher1));

        ClassroomMembership pending = ClassroomMembership.builder()
                .id("mem_1")
                .classroomId(classroom1.getId())
                .studentId(student1.getId())
                .membershipStatus("PENDING")
                .build();

        when(classroomMembershipRepository.findByClassroomIdAndStudentId(classroom1.getId(), student1.getId()))
                .thenReturn(Optional.of(pending));

        Map<String, Object> res = classroomService.approveJoinRequest(classroom1.getId(), student1.getId(), teacher1.getEmail());

        assertTrue((Boolean) res.get("success"));
        assertEquals("ACTIVE", pending.getMembershipStatus());
        assertEquals(teacher1.getId(), pending.getApprovedBy());
        verify(classroomMembershipRepository, times(1)).save(pending);
    }

    // -------------------------------------------------------------------------
    // TEST 16: Teacher rejects request
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("16. Teacher rejects pending request -> REJECTED")
    void testTeacherRejectsRequest() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacher1.getEmail())).thenReturn(Optional.of(teacher1));

        ClassroomMembership pending = ClassroomMembership.builder()
                .id("mem_1")
                .classroomId(classroom1.getId())
                .studentId(student1.getId())
                .membershipStatus("PENDING")
                .build();

        when(classroomMembershipRepository.findByClassroomIdAndStudentId(classroom1.getId(), student1.getId()))
                .thenReturn(Optional.of(pending));

        Map<String, Object> res = classroomService.rejectJoinRequest(classroom1.getId(), student1.getId(), teacher1.getEmail());

        assertTrue((Boolean) res.get("success"));
        assertEquals("REJECTED", pending.getMembershipStatus());
        verify(classroomMembershipRepository, times(1)).save(pending);
    }

    // -------------------------------------------------------------------------
    // TEST 17: Student cannot approve request
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("17. Student cannot approve request (403 Forbidden)")
    void testStudentCannotApproveRequest() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(student1.getEmail())).thenReturn(Optional.of(student1));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                classroomService.approveJoinRequest(classroom1.getId(), student2.getId(), student1.getEmail())
        );

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    }

    // -------------------------------------------------------------------------
    // TEST 18: Teacher cannot manipulate another classroom
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("18. Teacher cannot manipulate another teacher's classroom (403 Forbidden)")
    void testTeacherCannotManipulateAnotherClassroom() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacher2.getEmail())).thenReturn(Optional.of(teacher2));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                classroomService.approveJoinRequest(classroom1.getId(), student1.getId(), teacher2.getEmail())
        );

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    }

    // -------------------------------------------------------------------------
    // TEST 19: Removed student membership behaves correctly
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("19. Removed student membership transitions to REMOVED")
    void testRemovedStudentMembershipBehavesCorrectly() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacher1.getEmail())).thenReturn(Optional.of(teacher1));

        ClassroomMembership active = ClassroomMembership.builder()
                .id("mem_1")
                .classroomId(classroom1.getId())
                .studentId(student1.getId())
                .membershipStatus("ACTIVE")
                .build();

        when(classroomMembershipRepository.findByClassroomIdAndStudentId(classroom1.getId(), student1.getId()))
                .thenReturn(Optional.of(active));

        Map<String, Object> res = classroomService.removeMember(classroom1.getId(), student1.getId(), teacher1.getEmail());

        assertTrue((Boolean) res.get("success"));
        assertEquals("REMOVED", active.getMembershipStatus());
        verify(classroomMembershipRepository, times(1)).save(active);
    }

    // -------------------------------------------------------------------------
    // TEST 20: Join-code regeneration invalidates previous code
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("20. Join code regeneration updates hash, invalidates previous code")
    void testJoinCodeRegenerationInvalidatesPreviousCode() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacher1.getEmail())).thenReturn(Optional.of(teacher1));

        String oldHash = classroom1.getJoinCodeHash();

        RegenerateJoinCodeResponse res = classroomService.regenerateJoinCode(classroom1.getId(), teacher1.getEmail());

        assertNotNull(res.getJoinCode());
        assertNotEquals(oldHash, classroom1.getJoinCodeHash());
        assertEquals(classroom1.getJoinCodeHash(), ClassroomService.hashJoinCode(res.getJoinCode()));
        verify(classroomRepository, times(1)).save(classroom1);
    }

    // -------------------------------------------------------------------------
    // TEST 21: Student identity is derived from JWT (caller email)
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("21. Student identity is derived from authenticated session email")
    void testStudentIdentityDerivedFromJwt() {
        String rawCode = "ACAD01";
        String hashedCode = ClassroomService.hashJoinCode(rawCode);

        when(userRepository.findByEmail(student1.getEmail())).thenReturn(Optional.of(student1));
        when(classroomRepository.findByJoinCodeHash(hashedCode)).thenReturn(Optional.of(classroom1));
        when(classroomMembershipRepository.findByClassroomIdAndStudentId(classroom1.getId(), student1.getId()))
                .thenReturn(Optional.empty());

        classroomService.submitJoinRequest(rawCode, student1.getEmail());

        // Verifies membership was saved specifically for student1.getId()
        verify(classroomMembershipRepository).save(argThat(m -> m.getStudentId().equals(student1.getId())));
    }

    // -------------------------------------------------------------------------
    // TEST 22: Teacher identity is derived from JWT (caller email)
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("22. Teacher identity is derived from authenticated session email")
    void testTeacherIdentityDerivedFromJwt() {
        when(userRepository.findByEmail(teacher1.getEmail())).thenReturn(Optional.of(teacher1));
        when(classroomRepository.save(any(Classroom.class))).thenAnswer(i -> i.getArgument(0));

        CreateClassroomRequest req = CreateClassroomRequest.builder()
                .name("Calculus")
                .subjectName("Mathematics")
                .subjectCode("MATH1")
                .department("MATH")
                .semester(1)
                .section("B")
                .academicBatch("2025-2029")
                .academicYear("2025-2026")
                .build();

        classroomService.createClassroom(req, teacher1.getEmail());

        // Verifies classroom was created with teacherId = teacher1.getId()
        verify(classroomRepository).save(argThat(c -> c.getTeacherId().equals(teacher1.getId())));
    }
}
