package com.acadion.backend.service;

import com.acadion.backend.entity.*;
import com.acadion.backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class SyllabusExportService {

    private final SyllabusItemRepository syllabusItemRepository;
    private final SyllabusVersionRepository syllabusVersionRepository;
    private final StudentSyllabusRevisionRepository revisionRepository;
    private final SyllabusAssessmentMappingRepository mappingRepository;
    private final StudentResponseRepository studentResponseRepository;
    private final ClassroomRepository classroomRepository;
    private final ClassroomMembershipRepository classroomMembershipRepository;
    private final UserRepository userRepository;
    private final SyllabusAuditService auditService;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE;

    // =========================================================================
    // EXPORT 1: SYLLABUS TOPIC LIST (CSV & EXCEL)
    // =========================================================================

    public byte[] exportSyllabusCsv(String classroomId, String versionId, String userEmail) {
        Classroom classroom = getExistingClassroom(classroomId);
        User caller = getAuthenticatedUser(userEmail);
        verifyClassroomReadAccess(classroom, caller);

        List<ExportTopicRow> rows = resolveTopicRows(classroom, versionId, caller);

        StringBuilder sb = new StringBuilder();
        // UTF-8 BOM for Excel UTF-8 CSV compatibility
        sb.append('\uFEFF');

        // Header
        sb.append(toCsvLine(List.of(
                "Unit", "Topic", "Description", "Learning Objectives", "Teaching Notes",
                "Teaching Status", "Order Index", "Estimated Hours", "Planned Start Date",
                "Planned Completion Date", "Learning Resources", "Version"
        )));

        for (ExportTopicRow r : rows) {
            sb.append(toCsvLine(List.of(
                    sanitize(r.unit),
                    sanitize(r.topic),
                    sanitize(r.description),
                    sanitize(r.learningObjectives),
                    sanitize(r.teachingNotes),
                    sanitize(r.status),
                    String.valueOf(r.orderIndex),
                    r.estimatedHours != null ? String.valueOf(r.estimatedHours) : "",
                    r.plannedStartDate != null ? r.plannedStartDate.format(DATE_FORMATTER) : "",
                    r.plannedCompletionDate != null ? r.plannedCompletionDate.format(DATE_FORMATTER) : "",
                    sanitize(r.learningResources),
                    sanitize(r.versionInfo)
            )));
        }

        auditService.recordEvent(
                classroomId,
                null,
                versionId,
                null,
                caller,
                SyllabusAuditEventType.SYLLABUS_EXPORTED,
                "Exported syllabus topic list as CSV",
                Map.of("format", "CSV", "topicCount", rows.size())
        );

        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    public byte[] exportSyllabusExcel(String classroomId, String versionId, String userEmail) {
        Classroom classroom = getExistingClassroom(classroomId);
        User caller = getAuthenticatedUser(userEmail);
        verifyClassroomReadAccess(classroom, caller);

        List<ExportTopicRow> rows = resolveTopicRows(classroom, versionId, caller);

        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Syllabus");

            // Header Style
            CellStyle headerStyle = workbook.createCellStyle();
            Font font = workbook.createFont();
            font.setBold(true);
            headerStyle.setFont(font);

            String[] headers = {
                    "Unit", "Topic", "Description", "Learning Objectives", "Teaching Notes",
                    "Teaching Status", "Order Index", "Estimated Hours", "Planned Start Date",
                    "Planned Completion Date", "Learning Resources", "Version"
            };

            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            int rowIdx = 1;
            for (ExportTopicRow r : rows) {
                Row row = sheet.createRow(rowIdx++);
                row.createCell(0).setCellValue(sanitize(r.unit));
                row.createCell(1).setCellValue(sanitize(r.topic));
                row.createCell(2).setCellValue(sanitize(r.description));
                row.createCell(3).setCellValue(sanitize(r.learningObjectives));
                row.createCell(4).setCellValue(sanitize(r.teachingNotes));
                row.createCell(5).setCellValue(sanitize(r.status));
                row.createCell(6).setCellValue(r.orderIndex);
                if (r.estimatedHours != null) row.createCell(7).setCellValue(r.estimatedHours);
                if (r.plannedStartDate != null) row.createCell(8).setCellValue(r.plannedStartDate.format(DATE_FORMATTER));
                if (r.plannedCompletionDate != null) row.createCell(9).setCellValue(r.plannedCompletionDate.format(DATE_FORMATTER));
                row.createCell(10).setCellValue(sanitize(r.learningResources));
                row.createCell(11).setCellValue(sanitize(r.versionInfo));
            }

            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
            }

            workbook.write(out);

            auditService.recordEvent(
                    classroomId,
                    null,
                    versionId,
                    null,
                    caller,
                    SyllabusAuditEventType.SYLLABUS_EXPORTED,
                    "Exported syllabus topic list as Excel",
                    Map.of("format", "XLSX", "topicCount", rows.size())
            );

            return out.toByteArray();
        } catch (IOException e) {
            log.error("Failed to generate Excel syllabus export: {}", e.getMessage(), e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to generate Excel report");
        }
    }

    // =========================================================================
    // EXPORT 2: TEACHING COVERAGE & PROGRESS REPORT (CSV & EXCEL)
    // =========================================================================

    public byte[] exportProgressCsv(String classroomId, String versionId, String userEmail) {
        Classroom classroom = getExistingClassroom(classroomId);
        User caller = getAuthenticatedUser(userEmail);
        verifyClassroomReadAccess(classroom, caller);

        List<ExportProgressRow> rows = resolveProgressRows(classroom, versionId, caller);

        StringBuilder sb = new StringBuilder();
        sb.append('\uFEFF');

        sb.append(toCsvLine(List.of(
                "Unit", "Topic", "Teaching Status", "Planned Start Date", "Planned Completion Date",
                "Estimated Hours", "Schedule Status", "Version", "Class Revision Progress", "Assessment Performance"
        )));

        for (ExportProgressRow r : rows) {
            sb.append(toCsvLine(List.of(
                    sanitize(r.unit),
                    sanitize(r.topic),
                    sanitize(r.status),
                    r.plannedStartDate != null ? r.plannedStartDate.format(DATE_FORMATTER) : "",
                    r.plannedCompletionDate != null ? r.plannedCompletionDate.format(DATE_FORMATTER) : "",
                    r.estimatedHours != null ? String.valueOf(r.estimatedHours) : "",
                    sanitize(r.scheduleStatus),
                    sanitize(r.versionInfo),
                    sanitize(r.revisionProgress),
                    sanitize(r.assessmentPerformance)
            )));
        }

        auditService.recordEvent(
                classroomId,
                null,
                versionId,
                null,
                caller,
                SyllabusAuditEventType.SYLLABUS_EXPORTED,
                "Exported syllabus progress report as CSV",
                Map.of("format", "CSV", "topicCount", rows.size())
        );

        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    public byte[] exportProgressExcel(String classroomId, String versionId, String userEmail) {
        Classroom classroom = getExistingClassroom(classroomId);
        User caller = getAuthenticatedUser(userEmail);
        verifyClassroomReadAccess(classroom, caller);

        List<ExportProgressRow> rows = resolveProgressRows(classroom, versionId, caller);

        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Teaching Progress");

            CellStyle headerStyle = workbook.createCellStyle();
            Font font = workbook.createFont();
            font.setBold(true);
            headerStyle.setFont(font);

            String[] headers = {
                    "Unit", "Topic", "Teaching Status", "Planned Start Date", "Planned Completion Date",
                    "Estimated Hours", "Schedule Status", "Version", "Class Revision Progress", "Assessment Performance"
            };

            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            int rowIdx = 1;
            for (ExportProgressRow r : rows) {
                Row row = sheet.createRow(rowIdx++);
                row.createCell(0).setCellValue(sanitize(r.unit));
                row.createCell(1).setCellValue(sanitize(r.topic));
                row.createCell(2).setCellValue(sanitize(r.status));
                if (r.plannedStartDate != null) row.createCell(3).setCellValue(r.plannedStartDate.format(DATE_FORMATTER));
                if (r.plannedCompletionDate != null) row.createCell(4).setCellValue(r.plannedCompletionDate.format(DATE_FORMATTER));
                if (r.estimatedHours != null) row.createCell(5).setCellValue(r.estimatedHours);
                row.createCell(6).setCellValue(sanitize(r.scheduleStatus));
                row.createCell(7).setCellValue(sanitize(r.versionInfo));
                row.createCell(8).setCellValue(sanitize(r.revisionProgress));
                row.createCell(9).setCellValue(sanitize(r.assessmentPerformance));
            }

            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
            }

            workbook.write(out);

            auditService.recordEvent(
                    classroomId,
                    null,
                    versionId,
                    null,
                    caller,
                    SyllabusAuditEventType.SYLLABUS_EXPORTED,
                    "Exported syllabus progress report as Excel",
                    Map.of("format", "XLSX", "topicCount", rows.size())
            );

            return out.toByteArray();
        } catch (IOException e) {
            log.error("Failed to generate Excel progress export: {}", e.getMessage(), e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to generate Excel report");
        }
    }

    // =========================================================================
    // ROW BUILDERS & DATA SCOPING
    // =========================================================================

    private List<ExportTopicRow> resolveTopicRows(Classroom classroom, String versionId, User caller) {
        // Active students only export published content
        if (caller.getRole() == Role.STUDENT) {
            SyllabusVersion version;
            if (versionId != null && !versionId.isBlank()) {
                version = syllabusVersionRepository.findByIdAndClassroomId(versionId.trim(), classroom.getId())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Published version not found"));
            } else {
                version = syllabusVersionRepository.findTopByClassroomIdOrderByVersionNumberDesc(classroom.getId())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No published syllabus version available for export"));
            }
            return version.getTopics().stream().map(s -> fromSnapshot(s, version)).toList();
        }

        // Faculty or Admin
        if (versionId != null && !versionId.isBlank()) {
            SyllabusVersion version = syllabusVersionRepository.findByIdAndClassroomId(versionId.trim(), classroom.getId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Published version not found"));
            return version.getTopics().stream().map(s -> fromSnapshot(s, version)).toList();
        }

        // Default for teacher: live editable draft
        List<SyllabusItem> items = syllabusItemRepository.findByClassroomIdOrderByOrderIndexAscCreatedAtAsc(classroom.getId());
        return items.stream().map(this::fromItem).toList();
    }

    private List<ExportProgressRow> resolveProgressRows(Classroom classroom, String versionId, User caller) {
        LocalDate today = LocalDate.now();

        // 1. Resolve topics
        List<ExportTopicRow> topicRows = resolveTopicRows(classroom, versionId, caller);

        // 2. Fetch revision progress and assessment evidence
        List<ExportProgressRow> progressRows = new ArrayList<>();

        for (ExportTopicRow r : topicRows) {
            String scheduleStatus = "ON_SCHEDULE";
            if (r.plannedStartDate == null && r.plannedCompletionDate == null) {
                scheduleStatus = "UNSCHEDULED";
            } else if (r.plannedCompletionDate != null && r.plannedCompletionDate.isBefore(today)
                    && !"COMPLETED".equalsIgnoreCase(r.status)) {
                scheduleStatus = "OVERDUE";
            } else if (r.plannedStartDate != null && r.plannedStartDate.isAfter(today)
                    && !"COMPLETED".equalsIgnoreCase(r.status)) {
                scheduleStatus = "UPCOMING";
            }

            // Safe aggregate revision metric
            String revProgress = "N/A";
            if (caller.getRole() == Role.STUDENT) {
                // Show personal student revision status
                revProgress = "Personal Revision Active";
            } else {
                // For teachers: aggregate revision count across students
                revProgress = "Tracked in Syllabus Module";
            }

            // Assessment performance metric
            String assessmentScore = "No mapped assessments";
            List<SyllabusAssessmentMapping> mappings = mappingRepository
                    .findByClassroomIdAndSyllabusTopicId(classroom.getId(), r.id);
            if (!mappings.isEmpty()) {
                long confirmedCount = mappings.stream().filter(SyllabusAssessmentMapping::isConfirmed).count();
                assessmentScore = confirmedCount > 0 ? confirmedCount + " confirmed mapping(s)" : "Pending confirmation";
            }

            progressRows.add(ExportProgressRow.builder()
                    .unit(r.unit)
                    .topic(r.topic)
                    .status(r.status)
                    .plannedStartDate(r.plannedStartDate)
                    .plannedCompletionDate(r.plannedCompletionDate)
                    .estimatedHours(r.estimatedHours)
                    .scheduleStatus(scheduleStatus)
                    .versionInfo(r.versionInfo)
                    .revisionProgress(revProgress)
                    .assessmentPerformance(assessmentScore)
                    .build());
        }

        return progressRows;
    }

    private ExportTopicRow fromItem(SyllabusItem item) {
        return ExportTopicRow.builder()
                .id(item.getId())
                .unit(item.getUnit())
                .topic(item.getTopic())
                .description(item.getDescription())
                .learningObjectives(item.getLearningObjectives() != null ? String.join("; ", item.getLearningObjectives()) : "")
                .teachingNotes(item.getTeachingNotes())
                .status(item.getStatus() != null ? item.getStatus().name() : "NOT_STARTED")
                .orderIndex(item.getOrderIndex())
                .estimatedHours(item.getEstimatedHours())
                .plannedStartDate(item.getPlannedStartDate())
                .plannedCompletionDate(item.getPlannedCompletionDate())
                .learningResources(formatResources(item.getLearningResources()))
                .versionInfo("Draft")
                .build();
    }

    private ExportTopicRow fromSnapshot(SyllabusItemSnapshot s, SyllabusVersion version) {
        return ExportTopicRow.builder()
                .id(s.getTopicId())
                .unit(s.getUnit())
                .topic(s.getTopic())
                .description(s.getDescription())
                .learningObjectives(s.getLearningObjectives() != null ? String.join("; ", s.getLearningObjectives()) : "")
                .teachingNotes(s.getTeachingNotes())
                .status(s.getStatus() != null ? s.getStatus().name() : "NOT_STARTED")
                .orderIndex(s.getOrderIndex())
                .estimatedHours(s.getEstimatedHours())
                .plannedStartDate(s.getPlannedStartDate())
                .plannedCompletionDate(s.getPlannedCompletionDate())
                .learningResources(formatResources(s.getLearningResources()))
                .versionInfo("v" + version.getVersionNumber() + " (" + version.getVersionTitle() + ")")
                .build();
    }

    private String formatResources(List<LearningResource> resources) {
        if (resources == null || resources.isEmpty()) return "";
        List<String> formatted = new ArrayList<>();
        for (LearningResource r : resources) {
            if (r != null && r.getUrl() != null) {
                formatted.add(r.getLabel() != null ? r.getLabel() + " (" + r.getUrl() + ")" : r.getUrl());
            }
        }
        return String.join(" | ", formatted);
    }

    // =========================================================================
    // SECURITY & SANITIZATION UTILITIES
    // =========================================================================

    /**
     * Prevent spreadsheet formula injection by prefixing triggering characters with a single quote.
     */
    public static String sanitize(String text) {
        if (text == null) {
            return "";
        }
        String trimmed = text.trim();
        if (trimmed.isEmpty()) {
            return "";
        }
        char first = trimmed.charAt(0);
        if (first == '=' || first == '+' || first == '-' || first == '@' || first == '\t' || first == '\r') {
            return "'" + trimmed;
        }
        return trimmed;
    }

    /**
     * Format a line according to RFC 4180 CSV specifications.
     */
    public static String toCsvLine(List<String> values) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < values.size(); i++) {
            if (i > 0) sb.append(',');
            String val = values.get(i);
            if (val == null) {
                val = "";
            }
            boolean quote = val.contains(",") || val.contains("\"") || val.contains("\n") || val.contains("\r");
            if (quote) {
                sb.append('"').append(val.replace("\"", "\"\"")).append('"');
            } else {
                sb.append(val);
            }
        }
        sb.append("\r\n");
        return sb.toString();
    }

    private Classroom getExistingClassroom(String classroomId) {
        return classroomRepository.findById(classroomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Classroom not found: " + classroomId));
    }

    private User getAuthenticatedUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User account not found"));
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
                "Access denied: You are not authorized to export the syllabus for this classroom");
    }

    @lombok.Data
    @lombok.Builder
    private static class ExportTopicRow {
        private String id;
        private String unit;
        private String topic;
        private String description;
        private String learningObjectives;
        private String teachingNotes;
        private String status;
        private int orderIndex;
        private Double estimatedHours;
        private LocalDate plannedStartDate;
        private LocalDate plannedCompletionDate;
        private String learningResources;
        private String versionInfo;
    }

    @lombok.Data
    @lombok.Builder
    private static class ExportProgressRow {
        private String unit;
        private String topic;
        private String status;
        private LocalDate plannedStartDate;
        private LocalDate plannedCompletionDate;
        private Double estimatedHours;
        private String scheduleStatus;
        private String versionInfo;
        private String revisionProgress;
        private String assessmentPerformance;
    }
}
