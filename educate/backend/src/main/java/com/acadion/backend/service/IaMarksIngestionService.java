package com.acadion.backend.service;

import com.acadion.backend.dto.intelligence.IaIngestionSummary;
import com.acadion.backend.dto.intelligence.StudentIaBreakdownResponse;
import com.acadion.backend.entity.Classroom;
import com.acadion.backend.entity.StudentIaMarksRecord;
import com.acadion.backend.repository.ClassroomRepository;
import com.acadion.backend.repository.StudentIaMarksRecordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Instant;
import java.util.*;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class IaMarksIngestionService {

    private final StudentIaMarksRecordRepository iaMarksRecordRepository;
    private final ClassroomRepository classroomRepository;

    private static final Pattern USN_PATTERN = Pattern.compile("(?i)\\b([0-9][A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{3})\\b");

    // =========================================================================
    // 1. GENERATE & DOWNLOAD SAMPLE EXCEL TEMPLATE
    // =========================================================================
    public byte[] generateSampleTemplate(String classroomId) throws IOException {
        Classroom classroom = classroomRepository.findById(classroomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Classroom not found: " + classroomId));

        String courseCode = classroom.getSubjectCode() != null ? classroom.getSubjectCode() : "BCS701";
        String courseName = classroom.getSubjectName() != null ? classroom.getSubjectName() : "Internet of Things";
        int semester = classroom.getSemester() != null ? classroom.getSemester() : 7;
        String section = classroom.getSection() != null ? classroom.getSection() : "A";

        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("IA-SplitUp-Marks");
            sheet.setDisplayGridlines(true);

            // STYLES
            Font titleFont = workbook.createFont();
            titleFont.setBold(true);
            titleFont.setFontHeightInPoints((short) 13);
            titleFont.setColor(IndexedColors.WHITE.getIndex());

            CellStyle titleStyle = workbook.createCellStyle();
            titleStyle.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
            titleStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            titleStyle.setAlignment(HorizontalAlignment.CENTER);
            titleStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            titleStyle.setFont(titleFont);

            Font subTitleFont = workbook.createFont();
            subTitleFont.setBold(true);
            subTitleFont.setFontHeightInPoints((short) 10);
            subTitleFont.setColor(IndexedColors.WHITE.getIndex());

            CellStyle subTitleStyle = workbook.createCellStyle();
            subTitleStyle.setFillForegroundColor(IndexedColors.ROYAL_BLUE.getIndex());
            subTitleStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            subTitleStyle.setAlignment(HorizontalAlignment.CENTER);
            subTitleStyle.setFont(subTitleFont);

            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setFontHeightInPoints((short) 10);
            headerFont.setColor(IndexedColors.WHITE.getIndex());

            CellStyle headerStyle = workbook.createCellStyle();
            headerStyle.setFillForegroundColor(IndexedColors.VIOLET.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setAlignment(HorizontalAlignment.CENTER);
            headerStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            headerStyle.setBorderBottom(BorderStyle.THIN);
            headerStyle.setBorderTop(BorderStyle.THIN);
            headerStyle.setBorderLeft(BorderStyle.THIN);
            headerStyle.setBorderRight(BorderStyle.THIN);
            headerStyle.setFont(headerFont);

            CellStyle subHeaderStyle = workbook.createCellStyle();
            subHeaderStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            subHeaderStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            subHeaderStyle.setAlignment(HorizontalAlignment.CENTER);
            subHeaderStyle.setBorderBottom(BorderStyle.THIN);
            subHeaderStyle.setBorderTop(BorderStyle.THIN);
            subHeaderStyle.setBorderLeft(BorderStyle.THIN);
            subHeaderStyle.setBorderRight(BorderStyle.THIN);
            Font boldFont = workbook.createFont();
            boldFont.setBold(true);
            subHeaderStyle.setFont(boldFont);

            CellStyle dataStyle = workbook.createCellStyle();
            dataStyle.setAlignment(HorizontalAlignment.CENTER);
            dataStyle.setBorderBottom(BorderStyle.THIN);
            dataStyle.setBorderTop(BorderStyle.THIN);
            dataStyle.setBorderLeft(BorderStyle.THIN);
            dataStyle.setBorderRight(BorderStyle.THIN);

            CellStyle nameStyle = workbook.createCellStyle();
            nameStyle.setAlignment(HorizontalAlignment.LEFT);
            nameStyle.setBorderBottom(BorderStyle.THIN);
            nameStyle.setBorderTop(BorderStyle.THIN);
            nameStyle.setBorderLeft(BorderStyle.THIN);
            nameStyle.setBorderRight(BorderStyle.THIN);

            // ROW 0: Institution
            Row row0 = sheet.createRow(0);
            row0.setHeightInPoints(24);
            Cell c0 = row0.createCell(0);
            c0.setCellValue("ACADION ACADEMIC INTELLIGENCE — CIE SPLIT-UP MARKS SYSTEM");
            c0.setCellStyle(titleStyle);
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 11));

            // ROW 1: Department & Class Info
            Row row1 = sheet.createRow(1);
            row1.setHeightInPoints(20);
            Cell c1 = row1.createCell(0);
            c1.setCellValue("Classroom: " + classroom.getName() + " | Subject: " + courseName + " (" + courseCode + ") | Sem " + semester + " - Sec " + section);
            c1.setCellStyle(subTitleStyle);
            sheet.addMergedRegion(new CellRangeAddress(1, 1, 0, 11));

            // ROW 2: Instructions
            Row row2 = sheet.createRow(2);
            Cell c2 = row2.createCell(0);
            c2.setCellValue("Note: Enter marks for sub-questions (Max 10 per sub-question). Q1/Q2 (Module 1), Q3/Q4 (Module 2). Total Max = 40. Students answer Q1 OR Q2, and Q3 OR Q4.");
            sheet.addMergedRegion(new CellRangeAddress(2, 2, 0, 11));

            // ROW 8: Main Column Headers
            Row row8 = sheet.createRow(8);
            row8.setHeightInPoints(20);
            String[] mainHeaders = { "Sl No", "USN", "Student Name", "Question 1 (Mod 1)", "", "Question 2 (Mod 1)", "", "Question 3 (Mod 2)", "", "Question 4 (Mod 2)", "", "Total Marks" };
            for (int i = 0; i < mainHeaders.length; i++) {
                Cell cell = row8.createCell(i);
                cell.setCellValue(mainHeaders[i]);
                cell.setCellStyle(headerStyle);
            }
            sheet.addMergedRegion(new CellRangeAddress(8, 8, 3, 4));
            sheet.addMergedRegion(new CellRangeAddress(8, 8, 5, 6));
            sheet.addMergedRegion(new CellRangeAddress(8, 8, 7, 8));
            sheet.addMergedRegion(new CellRangeAddress(8, 8, 9, 10));

            // ROW 9: Sub-Question Headers (Row index 9 = Line 10 in Excel)
            Row row9 = sheet.createRow(9);
            row9.setHeightInPoints(18);
            String[] subHeaders = { "", "", "", "1a", "1b", "2a", "2b", "3a", "3b", "4a", "4b", "Total" };
            for (int i = 0; i < subHeaders.length; i++) {
                Cell cell = row9.createCell(i);
                cell.setCellValue(subHeaders[i]);
                cell.setCellStyle(subHeaderStyle);
            }

            // ROW 10: Max Marks Indicator (Row index 10 = Line 11 in Excel)
            Row row10 = sheet.createRow(10);
            String[] maxMarks = { "Max", "-", "-", "10", "10", "10", "10", "10", "10", "10", "10", "40" };
            for (int i = 0; i < maxMarks.length; i++) {
                Cell cell = row10.createCell(i);
                cell.setCellValue(maxMarks[i]);
                cell.setCellStyle(subHeaderStyle);
            }

            // POPULATE ENROLLED STUDENTS (Starting from Row 11 in index, Line 12 in Excel)
            List<Classroom.EnrolledStudent> students = classroom.getEnrolledStudents();
            if (students == null || students.isEmpty()) {
                students = new ArrayList<>();
            }

            // Ensure test members like John Doe and Santhosh are present if missing
            boolean hasJohn = students.stream().anyMatch(s -> "1DB21CS001".equalsIgnoreCase(s.getUsn()));
            boolean hasSanthu = students.stream().anyMatch(s -> "1DB23CS192".equalsIgnoreCase(s.getUsn()));

            List<Classroom.EnrolledStudent> exportList = new ArrayList<>(students);
            if (!hasJohn) {
                exportList.add(Classroom.EnrolledStudent.builder().usn("1DB21CS001").name("John Doe").build());
            }
            if (!hasSanthu) {
                exportList.add(Classroom.EnrolledStudent.builder().usn("1DB23CS192").name("Santhosh").build());
            }

            int rowIndex = 11;
            int slNo = 1;
            for (Classroom.EnrolledStudent st : exportList) {
                Row row = sheet.createRow(rowIndex++);
                row.setHeightInPoints(18);

                // Sl No
                Cell slCell = row.createCell(0);
                slCell.setCellValue(slNo++);
                slCell.setCellStyle(dataStyle);

                // USN
                Cell usnCell = row.createCell(1);
                usnCell.setCellValue(st.getUsn() != null ? st.getUsn() : "N/A");
                usnCell.setCellStyle(dataStyle);

                // Name
                Cell nameCell = row.createCell(2);
                nameCell.setCellValue(st.getName() != null ? st.getName() : "Student Candidate");
                nameCell.setCellStyle(nameStyle);

                // Sub-question sample marks
                // 1a, 1b, 2a, 2b, 3a, 3b, 4a, 4b
                double m1a = (slNo % 2 == 0) ? 9.0 : 8.5;
                double m1b = (slNo % 2 == 0) ? 9.5 : 8.0;
                double m2a = 0.0;
                double m2b = 0.0;
                double m3a = (slNo % 2 == 0) ? 8.5 : 9.0;
                double m3b = (slNo % 2 == 0) ? 8.0 : 7.5;
                double m4a = 0.0;
                double m4b = 0.0;
                double total = m1a + m1b + m3a + m3b;

                double[] marks = { m1a, m1b, m2a, m2b, m3a, m3b, m4a, m4b };
                for (int m = 0; m < marks.length; m++) {
                    Cell markCell = row.createCell(3 + m);
                    if (marks[m] > 0) {
                        markCell.setCellValue(marks[m]);
                    } else {
                        markCell.setCellValue("-");
                    }
                    markCell.setCellStyle(dataStyle);
                }

                // Total Marks
                Cell totalCell = row.createCell(11);
                totalCell.setCellValue(total);
                totalCell.setCellStyle(dataStyle);
            }

            for (int col = 0; col < 12; col++) {
                sheet.autoSizeColumn(col);
            }

            workbook.write(out);
            return out.toByteArray();
        }
    }

    // =========================================================================
    // 2. INGEST IA MARKS FROM EXCEL (.XLSX)
    // =========================================================================
    public IaIngestionSummary ingestIaMarks(String classroomId, MultipartFile file, int iaNumber, String teacherEmail) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Excel file is required");
        }
        if (iaNumber < 1 || iaNumber > 3) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid IA number: " + iaNumber + ". Must be 1, 2, or 3.");
        }

        List<StudentIaMarksRecord> savedRecords = new ArrayList<>();

        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            if (sheet == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The uploaded Excel workbook contains no sheets");
            }

            // Map sub-question columns dynamically
            Map<String, Integer> subQuestionColMap = new HashMap<>();
            int usnCol = 1;
            int nameCol = 2;
            int totalCol = 11;

            // Scan headers in rows 6 to 11
            for (int r = 5; r <= 11 && r <= sheet.getLastRowNum(); r++) {
                Row headerRow = sheet.getRow(r);
                if (headerRow == null) continue;

                for (Cell cell : headerRow) {
                    String val = getCellString(cell).trim().toLowerCase();
                    if (val.equals("1a") || val.equals("q1a") || val.equals("1(a)")) subQuestionColMap.put("1a", cell.getColumnIndex());
                    else if (val.equals("1b") || val.equals("q1b") || val.equals("1(b)")) subQuestionColMap.put("1b", cell.getColumnIndex());
                    else if (val.equals("2a") || val.equals("q2a") || val.equals("2(a)")) subQuestionColMap.put("2a", cell.getColumnIndex());
                    else if (val.equals("2b") || val.equals("q2b") || val.equals("2(b)")) subQuestionColMap.put("2b", cell.getColumnIndex());
                    else if (val.equals("3a") || val.equals("q3a") || val.equals("3(a)")) subQuestionColMap.put("3a", cell.getColumnIndex());
                    else if (val.equals("3b") || val.equals("q3b") || val.equals("3(b)")) subQuestionColMap.put("3b", cell.getColumnIndex());
                    else if (val.equals("4a") || val.equals("q4a") || val.equals("4(a)")) subQuestionColMap.put("4a", cell.getColumnIndex());
                    else if (val.equals("4b") || val.equals("q4b") || val.equals("4(b)")) subQuestionColMap.put("4b", cell.getColumnIndex());
                    else if (val.contains("usn")) usnCol = cell.getColumnIndex();
                    else if (val.contains("name") || val.contains("student")) nameCol = cell.getColumnIndex();
                    else if (val.equals("total") || val.contains("total marks")) totalCol = cell.getColumnIndex();
                }
            }

            // Defaults if sub-questions were not mapped
            subQuestionColMap.putIfAbsent("1a", 3);
            subQuestionColMap.putIfAbsent("1b", 4);
            subQuestionColMap.putIfAbsent("2a", 5);
            subQuestionColMap.putIfAbsent("2b", 6);
            subQuestionColMap.putIfAbsent("3a", 7);
            subQuestionColMap.putIfAbsent("3b", 8);
            subQuestionColMap.putIfAbsent("4a", 9);
            subQuestionColMap.putIfAbsent("4b", 10);

            log.info("Detected column mappings for IA ingestion: USN={}, Name={}, SubQuestions={}",
                    usnCol, nameCol, subQuestionColMap);

            // Scan rows for student records
            for (int r = 0; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                if (row == null) continue;

                // Look for USN in row
                String foundUsn = null;
                String foundName = null;

                Cell usnCell = row.getCell(usnCol);
                if (usnCell != null) {
                    String str = getCellString(usnCell).trim();
                    if (USN_PATTERN.matcher(str).find() || str.toUpperCase().startsWith("1DB")) {
                        foundUsn = str.toUpperCase();
                    }
                }

                // If not found in primary usnCol, inspect other cells in row
                if (foundUsn == null) {
                    for (Cell c : row) {
                        String str = getCellString(c).trim();
                        if (USN_PATTERN.matcher(str).find() || (str.length() >= 10 && str.toUpperCase().startsWith("1DB"))) {
                            foundUsn = str.toUpperCase();
                            break;
                        }
                    }
                }

                if (foundUsn == null) {
                    continue; // Not a student row
                }

                // Extract name
                Cell nameCell = row.getCell(nameCol);
                if (nameCell != null) {
                    foundName = getCellString(nameCell).trim();
                }
                if (foundName == null || foundName.isBlank() || foundName.equalsIgnoreCase("total") || foundName.equalsIgnoreCase("max")) {
                    foundName = "Student (" + foundUsn + ")";
                }

                // Extract sub-question marks
                Map<String, Double> questionMarks = new HashMap<>();
                for (Map.Entry<String, Integer> entry : subQuestionColMap.entrySet()) {
                    String qKey = entry.getKey();
                    int cIdx = entry.getValue();
                    Cell qCell = row.getCell(cIdx);
                    double marks = parseNumericMarks(qCell);
                    questionMarks.put(qKey, marks);
                }

                // Extract or compute total marks
                double extractedTotal = 0.0;
                Cell tCell = row.getCell(totalCol);
                extractedTotal = parseNumericMarks(tCell);

                // Compute module mastery
                Map<Integer, Double> moduleMastery = calculateModuleMastery(iaNumber, questionMarks);

                // If total marks was not in Excel, calculate it
                if (extractedTotal <= 0.0) {
                    double q1orQ2 = Math.max(
                            questionMarks.getOrDefault("1a", 0.0) + questionMarks.getOrDefault("1b", 0.0),
                            questionMarks.getOrDefault("2a", 0.0) + questionMarks.getOrDefault("2b", 0.0)
                    );
                    double q3orQ4 = Math.max(
                            questionMarks.getOrDefault("3a", 0.0) + questionMarks.getOrDefault("3b", 0.0),
                            questionMarks.getOrDefault("4a", 0.0) + questionMarks.getOrDefault("4b", 0.0)
                    );
                    extractedTotal = q1orQ2 + q3orQ4;
                }

                // Upsert into repository
                Optional<StudentIaMarksRecord> existingOpt = iaMarksRecordRepository
                        .findFirstByClassroomIdAndUsnIgnoreCaseAndIaNumber(classroomId, foundUsn, iaNumber);

                StudentIaMarksRecord record;
                if (existingOpt.isPresent()) {
                    record = existingOpt.get();
                    record.setStudentName(foundName);
                    record.setQuestionMarks(questionMarks);
                    record.setTotalMarks(extractedTotal);
                    record.setModuleMastery(moduleMastery);
                    record.setUpdatedAt(Instant.now());
                } else {
                    record = StudentIaMarksRecord.builder()
                            .classroomId(classroomId)
                            .usn(foundUsn)
                            .studentName(foundName)
                            .iaNumber(iaNumber)
                            .questionMarks(questionMarks)
                            .totalMarks(extractedTotal)
                            .moduleMastery(moduleMastery)
                            .updatedAt(Instant.now())
                            .build();
                }

                StudentIaMarksRecord saved = iaMarksRecordRepository.save(record);
                savedRecords.add(saved);
                log.info("Ingested IA-{} marks for {} ({}) - Total: {}", iaNumber, foundName, foundUsn, extractedTotal);
            }
        }

        return IaIngestionSummary.builder()
                .classroomId(classroomId)
                .iaNumber(iaNumber)
                .totalStudentsIngested(savedRecords.size())
                .filename(file.getOriginalFilename())
                .records(savedRecords)
                .message("Successfully ingested IA-" + iaNumber + " marks for " + savedRecords.size() + " student(s)!")
                .build();
    }

    // =========================================================================
    // 3. GET STUDENT IA BREAKDOWN & WEAK TOPIC ANALYSIS
    // =========================================================================
    public StudentIaBreakdownResponse getStudentBreakdown(String classroomId, String usn) {
        List<StudentIaMarksRecord> records = iaMarksRecordRepository.findByClassroomIdAndUsnIgnoreCase(classroomId, usn);
        if (records.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No IA marks records found for USN: " + usn);
        }

        String studentName = records.get(0).getStudentName();
        Map<Integer, Double> cumulativeModuleMastery = new HashMap<>();
        Map<Integer, Integer> moduleCount = new HashMap<>();
        double totalIaMarks = 0.0;

        for (StudentIaMarksRecord r : records) {
            totalIaMarks += r.getTotalMarks();
            if (r.getModuleMastery() != null) {
                for (Map.Entry<Integer, Double> entry : r.getModuleMastery().entrySet()) {
                    int mod = entry.getKey();
                    double val = entry.getValue();
                    cumulativeModuleMastery.put(mod, cumulativeModuleMastery.getOrDefault(mod, 0.0) + val);
                    moduleCount.put(mod, moduleCount.getOrDefault(mod, 0) + 1);
                }
            }
        }

        // Compute averages
        for (Map.Entry<Integer, Integer> entry : moduleCount.entrySet()) {
            int mod = entry.getKey();
            int count = entry.getValue();
            cumulativeModuleMastery.put(mod, cumulativeModuleMastery.get(mod) / count);
        }

        List<String> weakModules = new ArrayList<>();
        List<String> strongModules = new ArrayList<>();
        for (Map.Entry<Integer, Double> entry : cumulativeModuleMastery.entrySet()) {
            int mod = entry.getKey();
            double pct = entry.getValue();
            if (pct < 50.0) {
                weakModules.add("Module " + mod + " (" + String.format("%.1f", pct) + "%)");
            } else if (pct >= 75.0) {
                strongModules.add("Module " + mod + " (" + String.format("%.1f", pct) + "%)");
            }
        }

        double overallAverage = records.size() > 0 ? (totalIaMarks / records.size()) : 0.0;

        return StudentIaBreakdownResponse.builder()
                .classroomId(classroomId)
                .usn(usn.toUpperCase())
                .studentName(studentName)
                .iaRecords(records)
                .cumulativeModuleMastery(cumulativeModuleMastery)
                .weakModules(weakModules)
                .strongModules(strongModules)
                .overallIaAverage(overallAverage)
                .build();
    }

    public List<StudentIaMarksRecord> getIaRecordsByNumber(String classroomId, int iaNumber) {
        return iaMarksRecordRepository.findByClassroomIdAndIaNumber(classroomId, iaNumber);
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================
    private Map<Integer, Double> calculateModuleMastery(int iaNumber, Map<String, Double> qMarks) {
        Map<Integer, Double> mastery = new HashMap<>();

        // Sub-question scores
        double m1a = qMarks.getOrDefault("1a", 0.0);
        double m1b = qMarks.getOrDefault("1b", 0.0);
        double m2a = qMarks.getOrDefault("2a", 0.0);
        double m2b = qMarks.getOrDefault("2b", 0.0);
        double m3a = qMarks.getOrDefault("3a", 0.0);
        double m3b = qMarks.getOrDefault("3b", 0.0);
        double m4a = qMarks.getOrDefault("4a", 0.0);
        double m4b = qMarks.getOrDefault("4b", 0.0);

        double part1Score = Math.max(m1a + m1b, m2a + m2b);
        double part2Score = Math.max(m3a + m3b, m4a + m4b);

        // Max per part = 20.0
        double part1Pct = Math.min(100.0, (part1Score / 20.0) * 100.0);
        double part2Pct = Math.min(100.0, (part2Score / 20.0) * 100.0);

        if (iaNumber == 1) {
            mastery.put(1, Math.round(part1Pct * 10.0) / 10.0);
            mastery.put(2, Math.round(part2Pct * 10.0) / 10.0);
        } else if (iaNumber == 2) {
            mastery.put(3, Math.round(part1Pct * 10.0) / 10.0);
            mastery.put(4, Math.round(part2Pct * 10.0) / 10.0);
        } else if (iaNumber == 3) {
            mastery.put(5, Math.round(part1Pct * 10.0) / 10.0);
        }

        return mastery;
    }

    private double parseNumericMarks(Cell cell) {
        if (cell == null) return 0.0;
        try {
            if (cell.getCellType() == CellType.NUMERIC) {
                return cell.getNumericCellValue();
            } else if (cell.getCellType() == CellType.STRING) {
                String str = cell.getStringCellValue().trim();
                if (str.equals("-") || str.equalsIgnoreCase("ab") || str.equalsIgnoreCase("na")) {
                    return 0.0;
                }
                return Double.parseDouble(str);
            } else if (cell.getCellType() == CellType.FORMULA) {
                return cell.getNumericCellValue();
            }
        } catch (Exception e) {
            return 0.0;
        }
        return 0.0;
    }

    private String getCellString(Cell cell) {
        if (cell == null) return "";
        try {
            if (cell.getCellType() == CellType.STRING) {
                return cell.getStringCellValue();
            } else if (cell.getCellType() == CellType.NUMERIC) {
                long lVal = (long) cell.getNumericCellValue();
                if (cell.getNumericCellValue() == lVal) {
                    return String.valueOf(lVal);
                }
                return String.valueOf(cell.getNumericCellValue());
            } else if (cell.getCellType() == CellType.BOOLEAN) {
                return String.valueOf(cell.getBooleanCellValue());
            }
        } catch (Exception ignored) {
        }
        return "";
    }
}
