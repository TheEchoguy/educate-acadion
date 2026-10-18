package com.acadion.backend.service;

import com.acadion.backend.entity.*;
import com.acadion.backend.repository.*;
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

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class SyllabusExportServiceTest {

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

    @Mock
    private SyllabusAuditService auditService;

    @InjectMocks
    private SyllabusExportService exportService;

    private User teacherOwner;
    private User studentUser;
    private Classroom classroom1;

    @BeforeEach
    void setUp() {
        teacherOwner = User.builder()
                .id("teacher-1")
                .email("teacher@acadion.com")
                .name("Teacher One")
                .role(Role.TEACHER)
                .build();

        studentUser = User.builder()
                .id("student-1")
                .email("student@acadion.com")
                .name("Student One")
                .role(Role.STUDENT)
                .build();

        classroom1 = Classroom.builder()
                .id("class-1")
                .name("Physics 101")
                .subjectCode("PHYS101")
                .teacherId("teacher-1")
                .build();
    }

    @Test
    @DisplayName("CSV export returns UTF-8 BOM, correct headers, handles quotes/commas/Unicode, and sanitizes formulas")
    void testExportSyllabusCsv_successWithFormulaSanitization() {
        when(classroomRepository.findById("class-1")).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail("teacher@acadion.com")).thenReturn(Optional.of(teacherOwner));

        SyllabusItem normalItem = SyllabusItem.builder()
                .id("top-1").classroomId("class-1").unit("Unit 1")
                .topic("Normal Topic, with comma & \"quotes\" and Unicode: α + β = γ")
                .description("Line 1\nLine 2")
                .status(SyllabusStatus.COMPLETED).orderIndex(1).estimatedHours(3.5)
                .plannedStartDate(LocalDate.of(2026, 9, 1))
                .plannedCompletionDate(LocalDate.of(2026, 9, 5))
                .build();

        // Formula injection attempt in topic title & description
        SyllabusItem injectionItem = SyllabusItem.builder()
                .id("top-2").classroomId("class-1").unit("Unit 2")
                .topic("=SUM(A1:A10)")
                .description("+cmd|' /C calc'!A0")
                .teachingNotes("@dangerous_formula")
                .status(SyllabusStatus.NOT_STARTED).orderIndex(2)
                .build();

        when(syllabusItemRepository.findByClassroomIdOrderByOrderIndexAscCreatedAtAsc("class-1"))
                .thenReturn(List.of(normalItem, injectionItem));

        byte[] csvBytes = exportService.exportSyllabusCsv("class-1", null, "teacher@acadion.com");

        assertNotNull(csvBytes);
        String csv = new String(csvBytes, StandardCharsets.UTF_8);

        // UTF-8 BOM
        assertTrue(csv.startsWith("\uFEFF"));

        // Headers
        assertTrue(csv.contains("Unit,Topic,Description,Learning Objectives,Teaching Notes"));

        // Quotes, commas, and Unicode preserved in CSV
        assertTrue(csv.contains("Normal Topic, with comma & \"\"quotes\"\" and Unicode: α + β = γ"));

        // Formula injection neutralized: prepended with single quote '
        assertTrue(csv.contains("'=SUM(A1:A10)"));
        assertTrue(csv.contains("'+cmd|' /C calc'!A0"));
        assertTrue(csv.contains("'@dangerous_formula"));

        // Audit event recorded
        verify(auditService, times(1)).recordEvent(
                eq("class-1"), isNull(), isNull(), isNull(), eq(teacherOwner),
                eq(SyllabusAuditEventType.SYLLABUS_EXPORTED), any(), any()
        );
    }

    @Test
    @DisplayName("Excel export produces a valid POI XSSFWorkbook with sanitized cells")
    void testExportSyllabusExcel_validWorkbookAndFormulaSanitization() throws Exception {
        when(classroomRepository.findById("class-1")).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail("teacher@acadion.com")).thenReturn(Optional.of(teacherOwner));

        SyllabusItem item = SyllabusItem.builder()
                .id("top-1").classroomId("class-1").unit("Unit 1")
                .topic("=HYPERLINK(\"http://evil.com\")")
                .status(SyllabusStatus.IN_PROGRESS).orderIndex(1)
                .build();

        when(syllabusItemRepository.findByClassroomIdOrderByOrderIndexAscCreatedAtAsc("class-1"))
                .thenReturn(List.of(item));

        byte[] xlsxBytes = exportService.exportSyllabusExcel("class-1", null, "teacher@acadion.com");

        assertNotNull(xlsxBytes);
        assertTrue(xlsxBytes.length > 0);

        try (Workbook workbook = new XSSFWorkbook(new ByteArrayInputStream(xlsxBytes))) {
            Sheet sheet = workbook.getSheet("Syllabus");
            assertNotNull(sheet);

            Row headerRow = sheet.getRow(0);
            assertEquals("Unit", headerRow.getCell(0).getStringCellValue());
            assertEquals("Topic", headerRow.getCell(1).getStringCellValue());

            Row dataRow = sheet.getRow(1);
            assertEquals("Unit 1", dataRow.getCell(0).getStringCellValue());
            // Formula neutralized with single quote prefix
            assertEquals("'=HYPERLINK(\"http://evil.com\")", dataRow.getCell(1).getStringCellValue());
        }
    }

    @Test
    @DisplayName("Student caller exports published snapshot only and cannot see unreleased draft items")
    void testExportSyllabusCsv_studentOnlyReceivesPublishedSnapshot() {
        when(classroomRepository.findById("class-1")).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail("student@acadion.com")).thenReturn(Optional.of(studentUser));

        ClassroomMembership activeMembership = ClassroomMembership.builder()
                .classroomId("class-1").studentId("student-1").membershipStatus("ACTIVE")
                .build();
        when(classroomMembershipRepository.findByClassroomIdAndStudentId("class-1", "student-1"))
                .thenReturn(Optional.of(activeMembership));

        SyllabusItemSnapshot snapshot = SyllabusItemSnapshot.builder()
                .topicId("top-1").topic("Published Topic 101").unit("Unit 1")
                .status(SyllabusStatus.COMPLETED).orderIndex(1)
                .build();

        SyllabusVersion version = SyllabusVersion.builder()
                .id("ver-1").classroomId("class-1").versionNumber(1)
                .versionTitle("Initial Release")
                .publishedAt(LocalDateTime.now())
                .topics(List.of(snapshot))
                .build();

        when(syllabusVersionRepository.findTopByClassroomIdOrderByVersionNumberDesc("class-1"))
                .thenReturn(Optional.of(version));

        byte[] csvBytes = exportService.exportSyllabusCsv("class-1", null, "student@acadion.com");

        String csv = new String(csvBytes, StandardCharsets.UTF_8);
        assertTrue(csv.contains("Published Topic 101"));
        assertTrue(csv.contains("v1 (Initial Release)"));

        // Verify draft repository was never called
        verify(syllabusItemRepository, never()).findByClassroomIdOrderByOrderIndexAscCreatedAtAsc(any());
    }

    @Test
    @DisplayName("Progress export separates teaching status, revision progress, and assessment performance")
    void testExportProgressCsv_separatesMetricsClearly() {
        when(classroomRepository.findById("class-1")).thenReturn(Optional.of(classroom1));
        when(userRepository.findByEmail("teacher@acadion.com")).thenReturn(Optional.of(teacherOwner));

        SyllabusItem item = SyllabusItem.builder()
                .id("top-1").classroomId("class-1").unit("Unit 1").topic("Oscillations")
                .status(SyllabusStatus.COMPLETED).orderIndex(1)
                .build();

        when(syllabusItemRepository.findByClassroomIdOrderByOrderIndexAscCreatedAtAsc("class-1"))
                .thenReturn(List.of(item));
        when(mappingRepository.findByClassroomIdAndSyllabusTopicId("class-1", "top-1"))
                .thenReturn(Collections.emptyList());

        byte[] csvBytes = exportService.exportProgressCsv("class-1", null, "teacher@acadion.com");

        assertNotNull(csvBytes);
        String csv = new String(csvBytes, StandardCharsets.UTF_8);

        assertTrue(csv.contains("Teaching Status"));
        assertTrue(csv.contains("Class Revision Progress"));
        assertTrue(csv.contains("Assessment Performance"));
        assertTrue(csv.contains("Oscillations"));
    }
}
