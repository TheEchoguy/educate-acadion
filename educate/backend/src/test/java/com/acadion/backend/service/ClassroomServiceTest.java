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
                .joinCode("ACAD01")
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
        verify(classroomRepository, times(1)).save(argThat(c ->
                c.getJoinCode() != null && ClassroomService.hashJoinCode(c.getJoinCode()).equals(c.getJoinCodeHash())
        ));
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
        assertEquals("ACAD01", list.get(0).getJoinCode()); // Owning teacher receives persisted join code on dashboard
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
        when(userRepository.findByUsn("1DB21CS001")).thenReturn(Optional.of(student1));
        when(userRepository.findByUsn("1DB21CS002")).thenReturn(Optional.of(student2));
        when(classroomMembershipRepository.findByClassroomIdAndStudentId(eq(classroom1.getId()), any()))
                .thenReturn(Optional.empty());

        String csvContent = "USN,Name\n1DB21CS001,John Doe\n1DB21CS002,Jane Smith\n";
        MockMultipartFile file = new MockMultipartFile("file", "roster.csv", "text/csv", csvContent.getBytes(StandardCharsets.UTF_8));

        RosterImportSummary summary = classroomService.importRoster(classroom1.getId(), file, teacher1.getEmail());

        assertEquals(2, summary.getTotalRows());
        assertEquals(2, summary.getValidRows());
        assertEquals(2, summary.getMatchedCount());
        assertEquals(2, summary.getAddedCount());
        assertEquals(0, summary.getUnmatchedCount());
        verify(classroomMembershipRepository, times(2)).save(any(ClassroomMembership.class));
    }

    // -------------------------------------------------------------------------
    // TEST 5B: Valid CSV import with title, blank rows, and repeated headers
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("5B. CSV import with title row, blank lines, and repeated header ignores non-data rows")
    void testAdminReportCsvImportWithTitlesAndBlankRows() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacher1.getEmail())).thenReturn(Optional.of(teacher1));
        when(userRepository.findByUsn("1DB21CS001")).thenReturn(Optional.of(student1));
        when(userRepository.findByUsn("1DB21CS002")).thenReturn(Optional.of(student2));
        when(classroomMembershipRepository.findByClassroomIdAndStudentId(eq(classroom1.getId()), any()))
                .thenReturn(Optional.empty());

        String csvContent = "Acadion LMS - Approved Students Report\n"
                + "\n"
                + "Sl No,Student Name,Email Address,USN,Semester,Department,Approval Status\n"
                + "1,John Doe,john@student.com,1DB21CS001,6,CSE,Approved\n"
                + "\n"
                + "Sl No,Student Name,Email Address,USN,Semester,Department,Approval Status\n"
                + "2,Jane Smith,jane@student.com,1DB21CS002,6,CSE,Approved\n";

        MockMultipartFile file = new MockMultipartFile("file", "roster_report.csv", "text/csv", csvContent.getBytes(StandardCharsets.UTF_8));

        RosterImportSummary summary = classroomService.importRoster(classroom1.getId(), file, teacher1.getEmail());

        assertEquals(2, summary.getTotalRows());
        assertEquals(2, summary.getValidRows());
        assertEquals(2, summary.getMatchedCount());
        assertEquals(2, summary.getAddedCount());
        assertEquals(0, summary.getUnmatchedCount());
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
        when(userRepository.findByUsn("1DB21CS001")).thenReturn(Optional.of(student1));
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
    // TEST 6B: Admin Report Excel import with Title, Blank Rows, and Repeated Headers
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("6B. Admin Report Excel import ignores titles, blank rows, and repeated headers while matching students")
    void testAdminReportExcelImportWithTitlesBlankRowsAndRepeatedHeaders() throws Exception {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacher1.getEmail())).thenReturn(Optional.of(teacher1));
        when(userRepository.findByUsn("1DB21CS001")).thenReturn(Optional.of(student1));
        when(userRepository.findByUsn("1DB21CS002")).thenReturn(Optional.of(student2));
        when(userRepository.findByUsn("1DB99CS999")).thenReturn(Optional.empty());
        when(classroomMembershipRepository.findByClassroomIdAndStudentId(eq(classroom1.getId()), any()))
                .thenReturn(Optional.empty());

        Workbook workbook = new XSSFWorkbook();
        Sheet sheet = workbook.createSheet("Approved Students");

        // Row 0: Title row from Admin portal export
        Row titleRow = sheet.createRow(0);
        titleRow.createCell(0).setCellValue("Acadion LMS - Approved Students Report");

        // Row 1: Blank row
        sheet.createRow(1);

        // Row 2: Actual Admin Report Header row
        Row headerRow = sheet.createRow(2);
        String[] headers = {
                "Sl No", "Student Name", "Email Address", "USN",
                "Semester", "Department", "Approval Status",
                "Registration Date", "Approved Date"
        };
        for (int i = 0; i < headers.length; i++) {
            headerRow.createCell(i).setCellValue(headers[i]);
        }

        // Row 3: Student 1 (registered)
        Row r1 = sheet.createRow(3);
        r1.createCell(0).setCellValue(1);
        r1.createCell(1).setCellValue("John Doe");
        r1.createCell(2).setCellValue("john@student.com");
        r1.createCell(3).setCellValue("1DB21CS001");
        r1.createCell(4).setCellValue("Semester 6");
        r1.createCell(5).setCellValue("CSE");
        r1.createCell(6).setCellValue("Approved");

        // Row 4: Blank row
        sheet.createRow(4);

        // Row 5: Student 2 (registered)
        Row r2 = sheet.createRow(5);
        r2.createCell(0).setCellValue(2);
        r2.createCell(1).setCellValue("Jane Smith");
        r2.createCell(2).setCellValue("jane@student.com");
        r2.createCell(3).setCellValue("1DB21CS002");
        r2.createCell(4).setCellValue("Semester 6");
        r2.createCell(5).setCellValue("CSE");
        r2.createCell(6).setCellValue("Approved");

        // Row 6: Unmatched student USN
        Row r3 = sheet.createRow(6);
        r3.createCell(0).setCellValue(3);
        r3.createCell(1).setCellValue("Ghost Student");
        r3.createCell(2).setCellValue("ghost@student.com");
        r3.createCell(3).setCellValue("1DB99CS999");
        r3.createCell(4).setCellValue("Semester 6");
        r3.createCell(5).setCellValue("CSE");
        r3.createCell(6).setCellValue("Approved");

        // Row 7: Repeated header row
        Row repeatedHeader = sheet.createRow(7);
        for (int i = 0; i < headers.length; i++) {
            repeatedHeader.createCell(i).setCellValue(headers[i]);
        }

        // Row 8: Duplicate student row (same USN as Student 1)
        Row rDuplicate = sheet.createRow(8);
        rDuplicate.createCell(0).setCellValue(4);
        rDuplicate.createCell(1).setCellValue("John Doe Duplicate");
        rDuplicate.createCell(2).setCellValue("john@student.com");
        rDuplicate.createCell(3).setCellValue("1DB21CS001");
        rDuplicate.createCell(4).setCellValue("Semester 6");
        rDuplicate.createCell(5).setCellValue("CSE");
        rDuplicate.createCell(6).setCellValue("Approved");

        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        workbook.write(bos);
        workbook.close();

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "admin_approved_students_report.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                bos.toByteArray()
        );

        RosterImportSummary summary = classroomService.importRoster(classroom1.getId(), file, teacher1.getEmail());

        // 4 candidate student records (Student 1, Student 2, Unmatched Student, Duplicate Student 1)
        assertEquals(4, summary.getTotalRows());
        assertEquals(4, summary.getValidRows());
        assertEquals(1, summary.getDuplicatesInFile());
        assertEquals(2, summary.getMatchedCount());
        assertEquals(2, summary.getAddedCount());
        assertEquals(1, summary.getUnmatchedCount());
        assertEquals(1, summary.getUnmatchedStudents().size());

        // Check unmatched details
        assertEquals("1DB99CS999", summary.getUnmatchedStudents().get(0).getUsn());

        // Ensure title and header texts are NEVER treated as student USNs
        for (RosterImportSummary.UnmatchedStudentDetail detail : summary.getUnmatchedStudents()) {
            assertNotEquals("ACADION LMS - APPROVED STUDENTS REPORT", detail.getUsn().toUpperCase());
            assertNotEquals("SL NO", detail.getUsn().toUpperCase());
            assertNotEquals("USN", detail.getUsn().toUpperCase());
            assertNotEquals("STUDENT NAME", detail.getUsn().toUpperCase());
        }

        // Verify memberships saved
        verify(classroomMembershipRepository, times(2)).save(any(ClassroomMembership.class));
    }

    // -------------------------------------------------------------------------
    // TEST 6C: Workbook without USN column throws BAD_REQUEST
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("6C. Workbook without USN column throws BAD_REQUEST")
    void testWorkbookWithoutUsnColumnThrowsBadRequest() throws Exception {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacher1.getEmail())).thenReturn(Optional.of(teacher1));

        Workbook workbook = new XSSFWorkbook();
        Sheet sheet = workbook.createSheet("Invalid");
        Row header = sheet.createRow(0);
        header.createCell(0).setCellValue("Random Header 1");
        header.createCell(1).setCellValue("Random Header 2");

        Row r1 = sheet.createRow(1);
        r1.createCell(0).setCellValue("Value 1");
        r1.createCell(1).setCellValue("Value 2");

        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        workbook.write(bos);
        workbook.close();

        MockMultipartFile file = new MockMultipartFile(
                "file", "no_usn.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                bos.toByteArray()
        );

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class,
                () -> classroomService.importRoster(classroom1.getId(), file, teacher1.getEmail())
        );

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().contains("missing 'USN' column"));
    }

    // -------------------------------------------------------------------------
    // TEST 7: Duplicate USN handling within file
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("7. Duplicate USN within the same file is deduplicated")
    void testDuplicateUsnHandling() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacher1.getEmail())).thenReturn(Optional.of(teacher1));
        when(userRepository.findByUsn("1DB21CS001")).thenReturn(Optional.of(student1));
        when(classroomMembershipRepository.findByClassroomIdAndStudentId(eq(classroom1.getId()), any()))
                .thenReturn(Optional.empty());

        String csvContent = "USN\n1DB21CS001\n1DB21CS001\n";
        MockMultipartFile file = new MockMultipartFile("file", "roster.csv", "text/csv", csvContent.getBytes(StandardCharsets.UTF_8));

        RosterImportSummary summary = classroomService.importRoster(classroom1.getId(), file, teacher1.getEmail());

        assertEquals(2, summary.getTotalRows());
        assertEquals(2, summary.getValidRows());
        assertEquals(1, summary.getDuplicatesInFile());
        assertEquals(1, summary.getAddedCount());
        assertEquals(1, summary.getDuplicateUsns().size());
    }

    // -------------------------------------------------------------------------
    // TEST 8: Unknown USN handling (No User created, reported in unmatched)
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("8. Unknown USN does not create user, reports UNMATCHED")
    void testUnknownUsnHandling() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacher1.getEmail())).thenReturn(Optional.of(teacher1));
        when(userRepository.findByUsn("1DB99CS999")).thenReturn(Optional.empty());

        String csvContent = "USN\n1DB99CS999\n";
        MockMultipartFile file = new MockMultipartFile("file", "roster.csv", "text/csv", csvContent.getBytes(StandardCharsets.UTF_8));

        RosterImportSummary summary = classroomService.importRoster(classroom1.getId(), file, teacher1.getEmail());

        assertEquals(1, summary.getTotalRows());
        assertEquals(1, summary.getUnmatchedCount());
        assertEquals(0, summary.getAddedCount());
        assertEquals("1DB99CS999", summary.getUnmatchedStudents().get(0).getUsn());
        verify(userRepository, never()).save(any(User.class));
    }

    // -------------------------------------------------------------------------
    // TEST 9: Existing membership handling (Reports ALREADY_MEMBER)
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("9. Existing ACTIVE membership is reported as ALREADY_MEMBER")
    void testExistingMembershipHandling() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacher1.getEmail())).thenReturn(Optional.of(teacher1));
        when(userRepository.findByUsn("1DB21CS001")).thenReturn(Optional.of(student1));

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
        when(userRepository.findByUsn("1DB21CS001")).thenReturn(Optional.of(student1));

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
    @DisplayName("11. Student joins with valid code creates PENDING membership")
    void testStudentJoinsWithValidCode() {
        String rawCode = "ACAD01";
        String hashedCode = ClassroomService.hashJoinCode(rawCode);

        when(userRepository.findByEmail(student1.getEmail())).thenReturn(Optional.of(student1));
        when(classroomRepository.findByJoinCodeHash(hashedCode)).thenReturn(Optional.of(classroom1));
        when(classroomMembershipRepository.findByClassroomIdAndStudentId(classroom1.getId(), student1.getId()))
                .thenReturn(Optional.empty());

        Map<String, Object> result = classroomService.submitJoinRequest(rawCode, student1.getEmail());

        assertTrue((Boolean) result.get("success"));
        assertEquals("PENDING", result.get("status"));
        verify(classroomMembershipRepository, times(1)).save(argThat(m ->
                m.getMembershipStatus().equals("PENDING") && m.getMembershipSource().equals("JOIN_CODE")
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

        ClassroomMembership pending = ClassroomMembership.builder()
                .classroomId(classroom1.getId())
                .studentId(student1.getId())
                .membershipStatus("PENDING")
                .build();

        when(classroomMembershipRepository.findByClassroomIdAndStudentId(classroom1.getId(), student1.getId()))
                .thenReturn(Optional.of(pending));

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
        assertEquals(res.getJoinCode(), classroom1.getJoinCode()); // Plain code persisted to entity
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

    // -------------------------------------------------------------------------
    // TEST 23: Retrieving classroom details repeatedly does not change code
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("23. Repeated classroom details retrieval returns stable join code without side effects")
    void testClassroomDetailsRepeatedRetrievalDoesNotChangeCode() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacher1.getEmail())).thenReturn(Optional.of(teacher1));
        when(userRepository.findById(teacher1.getId())).thenReturn(Optional.of(teacher1));

        ClassroomResponse res1 = classroomService.getClassroomDetails(classroom1.getId(), teacher1.getEmail());
        ClassroomResponse res2 = classroomService.getClassroomDetails(classroom1.getId(), teacher1.getEmail());

        assertEquals("ACAD01", res1.getJoinCode());
        assertEquals("ACAD01", res2.getJoinCode());
        // Verify GET request never mutates or saves to repository
        verify(classroomRepository, never()).save(any(Classroom.class));
    }

    // -------------------------------------------------------------------------
    // TEST 24: Regeneration followed by details retrieval returns new persisted code
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("24. Regeneration updates code and subsequent retrieval returns newly saved code")
    void testRegenerationThenDetailsRetrievalReturnsUpdatedPersistedCode() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacher1.getEmail())).thenReturn(Optional.of(teacher1));
        when(userRepository.findById(teacher1.getId())).thenReturn(Optional.of(teacher1));

        RegenerateJoinCodeResponse regenRes = classroomService.regenerateJoinCode(classroom1.getId(), teacher1.getEmail());
        String newlyGeneratedCode = regenRes.getJoinCode();
        assertNotNull(newlyGeneratedCode);

        // Subsequent details retrieval returns the newly saved code
        ClassroomResponse detailsRes = classroomService.getClassroomDetails(classroom1.getId(), teacher1.getEmail());
        assertEquals(newlyGeneratedCode, detailsRes.getJoinCode());
    }

    // -------------------------------------------------------------------------
    // TEST 25: Student cannot retrieve join code via details endpoint
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("25. Student enrolled in classroom cannot see join code in details response")
    void testStudentCannotRetrieveJoinCodeViaDetails() {
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(student1.getEmail())).thenReturn(Optional.of(student1));
        when(userRepository.findById(teacher1.getId())).thenReturn(Optional.of(teacher1));

        ClassroomMembership enrolled = ClassroomMembership.builder()
                .classroomId(classroom1.getId())
                .studentId(student1.getId())
                .membershipStatus("ACTIVE")
                .build();
        when(classroomMembershipRepository.findByClassroomIdAndStudentId(classroom1.getId(), student1.getId()))
                .thenReturn(Optional.of(enrolled));

        ClassroomResponse res = classroomService.getClassroomDetails(classroom1.getId(), student1.getEmail());

        assertNull(res.getJoinCode(), "Join code must NEVER be exposed to students via details endpoint");
    }

    // -------------------------------------------------------------------------
    // TEST 26: Expired join code rejected
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("26. Expired join code is rejected with 400 Bad Request")
    void testExpiredJoinCodeRejected() {
        classroom1.setJoinCodeExpiresAt(LocalDateTime.now().minusMinutes(5));
        String rawCode = "ACAD01";
        String hashedCode = ClassroomService.hashJoinCode(rawCode);

        when(userRepository.findByEmail(student1.getEmail())).thenReturn(Optional.of(student1));
        when(classroomRepository.findByJoinCodeHash(hashedCode)).thenReturn(Optional.of(classroom1));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                classroomService.submitJoinRequest(rawCode, student1.getEmail())
        );

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().contains("expired"));
    }

    // -------------------------------------------------------------------------
    // TEST 27: Disabled join code rejected
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("27. Disabled join code is rejected with 400 Bad Request")
    void testDisabledJoinCodeRejected() {
        classroom1.setJoinCodeEnabled(false);
        String rawCode = "ACAD01";
        String hashedCode = ClassroomService.hashJoinCode(rawCode);

        when(userRepository.findByEmail(student1.getEmail())).thenReturn(Optional.of(student1));
        when(classroomRepository.findByJoinCodeHash(hashedCode)).thenReturn(Optional.of(classroom1));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                classroomService.submitJoinRequest(rawCode, student1.getEmail())
        );

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().contains("disabled"));
    }

    // -------------------------------------------------------------------------
    // TEST 28: Legacy classroom with null join code handled safely
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("28. Legacy classroom with null join code handled safely without mutating state")
    void testLegacyClassroomWithNullJoinCodeHandledSafely() {
        classroom1.setJoinCode(null);
        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacher1.getEmail())).thenReturn(Optional.of(teacher1));
        when(userRepository.findById(teacher1.getId())).thenReturn(Optional.of(teacher1));

        ClassroomResponse res = classroomService.getClassroomDetails(classroom1.getId(), teacher1.getEmail());

        assertNull(res.getJoinCode());
        // Verify no silent generation or mutation on GET
        verify(classroomRepository, never()).save(any(Classroom.class));
    }

    // -------------------------------------------------------------------------
    // TEST 29: Teacher approves pending join request and member appears as ACTIVE
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("29. Teacher approves pending request, returns ACTIVE status and appears in enrolled members")
    void testApproveJoinRequestUpdatesStatusToActiveAndReturnsAuthoritativeResponse() {
        ClassroomMembership pendingMembership = ClassroomMembership.builder()
                .id("mem_pending_1")
                .classroomId(classroom1.getId())
                .studentId(student1.getId())
                .membershipStatus("PENDING")
                .membershipSource("JOIN_CODE")
                .usnSnapshot(student1.getUsn())
                .requestedAt(LocalDateTime.now().minusHours(1))
                .createdAt(LocalDateTime.now().minusHours(1))
                .build();

        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacher1.getEmail())).thenReturn(Optional.of(teacher1));
        when(classroomMembershipRepository.findByClassroomIdAndStudentId(classroom1.getId(), student1.getId()))
                .thenReturn(Optional.of(pendingMembership));

        Map<String, Object> approveResult = classroomService.approveJoinRequest(
                classroom1.getId(), student1.getId(), teacher1.getEmail()
        );

        assertNotNull(approveResult);
        assertEquals(true, approveResult.get("success"));
        assertEquals("ACTIVE", approveResult.get("status"));
        assertEquals(student1.getId(), approveResult.get("studentId"));

        assertEquals("ACTIVE", pendingMembership.getMembershipStatus());
        assertEquals(teacher1.getId(), pendingMembership.getApprovedBy());
        assertNotNull(pendingMembership.getApprovedAt());
        verify(classroomMembershipRepository, times(1)).save(pendingMembership);

        // Now verify getClassroomMembers returns this student with role STUDENT and status ACTIVE
        when(classroomMembershipRepository.findByClassroomIdAndMembershipStatus(classroom1.getId(), "ACTIVE"))
                .thenReturn(List.of(pendingMembership));
        when(userRepository.findById(student1.getId())).thenReturn(Optional.of(student1));

        List<ClassroomMemberDto> members = classroomService.getClassroomMembers(classroom1.getId(), teacher1.getEmail());
        assertEquals(1, members.size());
        ClassroomMemberDto memberDto = members.get(0);
        assertEquals(student1.getId(), memberDto.getId());
        assertEquals(student1.getName(), memberDto.getStudentName());
        assertEquals("STUDENT", memberDto.getRole());
        assertEquals("ACTIVE", memberDto.getStatus());
        assertEquals("ACTIVE", memberDto.getMembershipStatus());
    }

    // -------------------------------------------------------------------------
    // TEST 30: Get join requests displays student role and PENDING status
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("30. Get join requests displays student role and PENDING status")
    void testGetJoinRequestsReturnsStudentRoleAndPendingStatus() {
        ClassroomMembership pendingMembership = ClassroomMembership.builder()
                .id("mem_pending_2")
                .classroomId(classroom1.getId())
                .studentId(student2.getId())
                .membershipStatus("PENDING")
                .membershipSource("JOIN_CODE")
                .usnSnapshot(student2.getUsn())
                .requestedAt(LocalDateTime.now())
                .createdAt(LocalDateTime.now())
                .build();

        when(classroomRepository.findById(classroom1.getId())).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail(teacher1.getEmail())).thenReturn(Optional.of(teacher1));
        when(classroomMembershipRepository.findByClassroomIdAndMembershipStatus(classroom1.getId(), "PENDING"))
                .thenReturn(List.of(pendingMembership));
        when(userRepository.findById(student2.getId())).thenReturn(Optional.of(student2));

        List<ClassroomMemberDto> pendingList = classroomService.getJoinRequests(classroom1.getId(), teacher1.getEmail());
        assertEquals(1, pendingList.size());
        ClassroomMemberDto dto = pendingList.get(0);
        assertEquals(student2.getId(), dto.getId());
        assertEquals("STUDENT", dto.getRole());
        assertEquals("PENDING", dto.getStatus());
        assertEquals("PENDING", dto.getMembershipStatus());
    }
}
