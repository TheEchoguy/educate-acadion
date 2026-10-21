package com.acadion.backend.service;

import com.acadion.backend.dto.intelligence.IaIngestionSummary;
import com.acadion.backend.dto.intelligence.ManualMarksRecordRequest;
import com.acadion.backend.dto.intelligence.StudentIaBreakdownResponse;
import com.acadion.backend.entity.Classroom;
import com.acadion.backend.entity.IaQuestionBlueprint;
import com.acadion.backend.entity.IaSubQuestionItem;
import com.acadion.backend.entity.StudentIaMarksRecord;
import com.acadion.backend.repository.ClassroomRepository;
import com.acadion.backend.repository.IaQuestionBlueprintRepository;
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
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class IaMarksIngestionService {

    private final StudentIaMarksRecordRepository iaMarksRecordRepository;
    private final ClassroomRepository classroomRepository;
    private final ClassroomPaperParserService paperParserService;
    private final IaQuestionBlueprintRepository blueprintRepository;

    private static final Pattern USN_PATTERN = Pattern.compile("(?i)\\b([0-9][A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{3})\\b");
    private static final Pattern SUB_Q_PATTERN = Pattern.compile("([1-4][a-c])(?:\\((\\d+)\\))?", Pattern.CASE_INSENSITIVE);

    // =========================================================================
    // 1. GENERATE & DOWNLOAD DYNAMIC BLANK EXCEL TEMPLATE FOR ANY IA
    // =========================================================================
    public byte[] generateSampleTemplate(String classroomId) throws IOException {
        return generateDynamicBlankTemplate(classroomId, 1);
    }

    public byte[] generateDynamicBlankTemplate(String classroomId, int iaNumber) throws IOException {
        if (iaNumber < 1 || iaNumber > 3) {
            iaNumber = 1;
        }

        Classroom classroom = classroomRepository.findById(classroomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Classroom not found: " + classroomId));

        String courseCode = classroom.getSubjectCode() != null ? classroom.getSubjectCode() : "BCS701";
        String courseName = classroom.getSubjectName() != null ? classroom.getSubjectName() : "Internet of Things";
        int semester = classroom.getSemester() != null ? classroom.getSemester() : 7;
        String section = classroom.getSection() != null ? classroom.getSection() : "A";

        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("IA-" + iaNumber + "-SplitUp-Marks");
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

            Font instructionFont = workbook.createFont();
            instructionFont.setItalic(true);
            instructionFont.setFontHeightInPoints((short) 9);
            instructionFont.setColor(IndexedColors.GREY_50_PERCENT.getIndex());
            CellStyle instructionStyle = workbook.createCellStyle();
            instructionStyle.setFont(instructionFont);
            instructionStyle.setAlignment(HorizontalAlignment.LEFT);

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

            CellStyle totalStyle = workbook.createCellStyle();
            totalStyle.setAlignment(HorizontalAlignment.CENTER);
            totalStyle.setBorderBottom(BorderStyle.THIN);
            totalStyle.setBorderTop(BorderStyle.THIN);
            totalStyle.setBorderLeft(BorderStyle.THIN);
            totalStyle.setBorderRight(BorderStyle.THIN);
            Font totalFont = workbook.createFont();
            totalFont.setBold(true);
            totalFont.setColor(IndexedColors.DARK_BLUE.getIndex());
            totalStyle.setFont(totalFont);

            // ROW 0: Title Header
            Row row0 = sheet.createRow(0);
            row0.setHeightInPoints(24);
            Cell c0 = row0.createCell(0);
            c0.setCellValue("ACADION ACADEMIC INTELLIGENCE — CIE IA-" + iaNumber + " SPLIT-UP MARKS SYSTEM");
            c0.setCellStyle(titleStyle);

            // ROW 1: Class & Subject Metadata
            Row row1 = sheet.createRow(1);
            row1.setHeightInPoints(20);
            Cell c1 = row1.createCell(0);
            c1.setCellValue("Classroom: " + classroom.getName() + " | Subject: " + courseName + " (" + courseCode + ") | Sem " + semester + " - Sec " + section + " | Test: IA-" + iaNumber);
            c1.setCellStyle(subTitleStyle);

            // ROW 2: Instructions row customized for IA
            Row row2 = sheet.createRow(2);
            row2.setHeightInPoints(18);
            Cell c2 = row2.createCell(0);
            String noteText;
            String modLabelA, modLabelB;
            if (iaNumber == 1) {
                modLabelA = "Module 1";
                modLabelB = "Module 2";
                noteText = "Instructions: Enter marks for IA-1 (Max 10 per sub-question). Q1/Q2 (" + modLabelA + "), Q3/Q4 (" + modLabelB + "). Total Max = 40. Students answer Q1 OR Q2, and Q3 OR Q4.";
            } else if (iaNumber == 2) {
                modLabelA = "Module 3";
                modLabelB = "Module 4";
                noteText = "Instructions: Enter marks for IA-2 (Max 10 per sub-question). Q1/Q2 (" + modLabelA + "), Q3/Q4 (" + modLabelB + "). Total Max = 40. Students answer Q1 OR Q2, and Q3 OR Q4.";
            } else {
                modLabelA = "Module 5 (Pt 1)";
                modLabelB = "Module 5 (Pt 2)";
                noteText = "Instructions: Enter marks for IA-3 (Max 10 per sub-question). Q1/Q2 (" + modLabelA + "), Q3/Q4 (" + modLabelB + "). Total Max = 40. Students answer Q1 OR Q2, and Q3 OR Q4.";
            }
            c2.setCellValue(noteText);
            c2.setCellStyle(instructionStyle);

            // Fetch active blueprint to dynamically generate columns
            IaQuestionBlueprint blueprint = paperParserService.getOrCreateDefaultBlueprint(classroomId, iaNumber);
            List<IaSubQuestionItem> questions = blueprint.getQuestions();
            if (questions == null || questions.isEmpty()) {
                questions = paperParserService.buildDefaultBlueprint(classroomId, iaNumber).getQuestions();
            }
            questions.sort(Comparator.comparing(IaSubQuestionItem::getCode));

            // Separate questions by parent question: Q1, Q2, Q3, Q4
            List<IaSubQuestionItem> q1List = new ArrayList<>();
            List<IaSubQuestionItem> q2List = new ArrayList<>();
            List<IaSubQuestionItem> q3List = new ArrayList<>();
            List<IaSubQuestionItem> q4List = new ArrayList<>();
            for (IaSubQuestionItem item : questions) {
                if ("1".equals(item.getQuestionNumber())) q1List.add(item);
                else if ("2".equals(item.getQuestionNumber())) q2List.add(item);
                else if ("3".equals(item.getQuestionNumber())) q3List.add(item);
                else if ("4".equals(item.getQuestionNumber())) q4List.add(item);
            }

            int startCol = 3;
            int q1Start = startCol;
            int q1End = q1Start + Math.max(1, q1List.size()) - 1;
            int q2Start = q1End + 1;
            int q2End = q2Start + Math.max(1, q2List.size()) - 1;
            int q3Start = q2End + 1;
            int q3End = q3Start + Math.max(1, q3List.size()) - 1;
            int q4Start = q3End + 1;
            int q4End = q4Start + Math.max(1, q4List.size()) - 1;
            int totalCol = q4End + 1;
            int totalColsCount = totalCol + 1;

            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, totalCol));
            sheet.addMergedRegion(new CellRangeAddress(1, 1, 0, totalCol));
            sheet.addMergedRegion(new CellRangeAddress(2, 2, 0, totalCol));

            // ROW 8: Main Question Headers
            Row row8 = sheet.createRow(8);
            row8.setHeightInPoints(20);
            for (int i = 0; i < totalColsCount; i++) {
                Cell c = row8.createCell(i);
                c.setCellStyle(headerStyle);
            }
            row8.getCell(0).setCellValue("Sl No");
            row8.getCell(1).setCellValue("USN");
            row8.getCell(2).setCellValue("Student Name");
            row8.getCell(q1Start).setCellValue("Question 1 (" + modLabelA + ")");
            row8.getCell(q2Start).setCellValue("Question 2 (" + modLabelA + ")");
            row8.getCell(q3Start).setCellValue("Question 3 (" + modLabelB + ")");
            row8.getCell(q4Start).setCellValue("Question 4 (" + modLabelB + ")");
            row8.getCell(totalCol).setCellValue("Total Marks");

            if (q1End > q1Start) sheet.addMergedRegion(new CellRangeAddress(8, 8, q1Start, q1End));
            if (q2End > q2Start) sheet.addMergedRegion(new CellRangeAddress(8, 8, q2Start, q2End));
            if (q3End > q3Start) sheet.addMergedRegion(new CellRangeAddress(8, 8, q3Start, q3End));
            if (q4End > q4Start) sheet.addMergedRegion(new CellRangeAddress(8, 8, q4Start, q4End));

            // ROW 9: Sub-Question Headers
            Row row9 = sheet.createRow(9);
            row9.setHeightInPoints(18);
            for (int i = 0; i < totalColsCount; i++) {
                Cell c = row9.createCell(i);
                c.setCellStyle(subHeaderStyle);
            }
            for (int i = 0; i < questions.size(); i++) {
                row9.getCell(startCol + i).setCellValue(questions.get(i).getCode());
            }
            row9.getCell(totalCol).setCellValue("Total");

            // ROW 10: Max Marks Indicator
            Row row10 = sheet.createRow(10);
            row10.setHeightInPoints(18);
            for (int i = 0; i < totalColsCount; i++) {
                Cell c = row10.createCell(i);
                c.setCellStyle(subHeaderStyle);
            }
            row10.getCell(0).setCellValue("Max");
            row10.getCell(1).setCellValue("-");
            row10.getCell(2).setCellValue("-");
            for (int i = 0; i < questions.size(); i++) {
                row10.getCell(startCol + i).setCellValue(String.valueOf((int) questions.get(i).getMaxMarks()));
            }
            row10.getCell(totalCol).setCellValue("40");

            // POPULATE ENROLLED STUDENTS & PRE-POPULATE ANY SAVED MARKS FOR THIS IA
            List<Classroom.EnrolledStudent> students = classroom.getEnrolledStudents();
            if (students == null) students = new ArrayList<>();

            boolean hasJohn = students.stream().anyMatch(s -> "1DB21CS001".equalsIgnoreCase(s.getUsn()));
            boolean hasSanthu = students.stream().anyMatch(s -> "1DB23CS192".equalsIgnoreCase(s.getUsn()));

            List<Classroom.EnrolledStudent> exportList = new ArrayList<>(students);
            if (!hasJohn) exportList.add(Classroom.EnrolledStudent.builder().usn("1DB21CS001").name("John Doe").build());
            if (!hasSanthu) exportList.add(Classroom.EnrolledStudent.builder().usn("1DB23CS192").name("Santhosh").build());

            // Map existing marks for this IA
            List<StudentIaMarksRecord> existingIaMarks = iaMarksRecordRepository.findByClassroomIdAndIaNumber(classroomId, iaNumber);
            Map<String, StudentIaMarksRecord> existingMarksMap = new HashMap<>();
            for (StudentIaMarksRecord r : existingIaMarks) {
                if (r.getUsn() != null) {
                    existingMarksMap.put(r.getUsn().trim().toUpperCase(), r);
                }
            }

            int rowIndex = 11;
            int slNo = 1;

            for (Classroom.EnrolledStudent st : exportList) {
                Row row = sheet.createRow(rowIndex++);
                row.setHeightInPoints(19);

                Cell slCell = row.createCell(0);
                slCell.setCellValue(slNo++);
                slCell.setCellStyle(dataStyle);

                String cleanUsn = st.getUsn() != null ? st.getUsn().trim().toUpperCase() : "N/A";
                Cell usnCell = row.createCell(1);
                usnCell.setCellValue(cleanUsn);
                usnCell.setCellStyle(dataStyle);

                Cell nameCell = row.createCell(2);
                nameCell.setCellValue(st.getName() != null ? st.getName() : "Student Candidate");
                nameCell.setCellStyle(nameStyle);

                StudentIaMarksRecord savedRecord = existingMarksMap.get(cleanUsn);
                Map<String, Double> qMarks = savedRecord != null ? savedRecord.getQuestionMarks() : null;

                for (int m = 0; m < questions.size(); m++) {
                    Cell markCell = row.createCell(startCol + m);
                    markCell.setCellStyle(dataStyle);
                    if (qMarks != null) {
                        String code = questions.get(m).getCode();
                        Double val = qMarks.get(code);
                        if (val != null) {
                            markCell.setCellValue(val);
                        }
                    }
                }

                int excelRow = rowIndex;
                Cell totalCell = row.createCell(totalCol);
                String q1R = org.apache.poi.ss.util.CellReference.convertNumToColString(q1Start) + excelRow + ":" + org.apache.poi.ss.util.CellReference.convertNumToColString(q1End) + excelRow;
                String q2R = org.apache.poi.ss.util.CellReference.convertNumToColString(q2Start) + excelRow + ":" + org.apache.poi.ss.util.CellReference.convertNumToColString(q2End) + excelRow;
                String q3R = org.apache.poi.ss.util.CellReference.convertNumToColString(q3Start) + excelRow + ":" + org.apache.poi.ss.util.CellReference.convertNumToColString(q3End) + excelRow;
                String q4R = org.apache.poi.ss.util.CellReference.convertNumToColString(q4Start) + excelRow + ":" + org.apache.poi.ss.util.CellReference.convertNumToColString(q4End) + excelRow;
                String formula = "MAX(SUM(" + q1R + "),SUM(" + q2R + "))+MAX(SUM(" + q3R + "),SUM(" + q4R + "))";
                totalCell.setCellFormula(formula);
                totalCell.setCellStyle(totalStyle);
            }

            // ADD 10 EXTRA BLANK ROWS FOR MANUAL ENTRY
            for (int k = 0; k < 10; k++) {
                Row row = sheet.createRow(rowIndex++);
                row.setHeightInPoints(19);

                Cell slCell = row.createCell(0);
                slCell.setCellValue(slNo++);
                slCell.setCellStyle(dataStyle);

                row.createCell(1).setCellStyle(dataStyle);
                row.createCell(2).setCellStyle(nameStyle);

                for (int m = 0; m < questions.size(); m++) {
                    Cell markCell = row.createCell(startCol + m);
                    markCell.setCellStyle(dataStyle);
                }

                int excelRow = rowIndex;
                Cell totalCell = row.createCell(totalCol);
                String q1R = org.apache.poi.ss.util.CellReference.convertNumToColString(q1Start) + excelRow + ":" + org.apache.poi.ss.util.CellReference.convertNumToColString(q1End) + excelRow;
                String q2R = org.apache.poi.ss.util.CellReference.convertNumToColString(q2Start) + excelRow + ":" + org.apache.poi.ss.util.CellReference.convertNumToColString(q2End) + excelRow;
                String q3R = org.apache.poi.ss.util.CellReference.convertNumToColString(q3Start) + excelRow + ":" + org.apache.poi.ss.util.CellReference.convertNumToColString(q3End) + excelRow;
                String q4R = org.apache.poi.ss.util.CellReference.convertNumToColString(q4Start) + excelRow + ":" + org.apache.poi.ss.util.CellReference.convertNumToColString(q4End) + excelRow;
                String formula = "MAX(SUM(" + q1R + "),SUM(" + q2R + "))+MAX(SUM(" + q3R + "),SUM(" + q4R + "))";
                totalCell.setCellFormula(formula);
                totalCell.setCellStyle(totalStyle);
            }

            for (int col = 0; col < totalColsCount; col++) {
                sheet.autoSizeColumn(col);
            }

            workbook.write(out);
            return out.toByteArray();
        }
    }

    // =========================================================================
    // 1B. GENERATE & DOWNLOAD MASTER UNIFIED SPLIT-UP EXCEL SHEET (IA-1, IA-2, IA-3, LAB)
    // Exactly matches the structure of Iot-7A-SplitupMarks.xlsx
    // =========================================================================
    public byte[] exportMasterMarksSheet(String classroomId) throws IOException {
        return generateMasterUnifiedTemplate(classroomId);
    }

    public byte[] generateMasterUnifiedTemplate(String classroomId) throws IOException {
        Classroom classroom = classroomRepository.findById(classroomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Classroom not found: " + classroomId));

        String courseCode = classroom.getSubjectCode() != null ? classroom.getSubjectCode() : "BCS701";
        String courseName = classroom.getSubjectName() != null ? classroom.getSubjectName() : "Internet of Things";
        int semester = classroom.getSemester() != null ? classroom.getSemester() : 7;
        String section = classroom.getSection() != null ? classroom.getSection() : "A";

        // Load existing saved records for classroom to pre-populate saved marks
        List<StudentIaMarksRecord> allSaved = iaMarksRecordRepository.findByClassroomId(classroomId);
        Map<String, StudentIaMarksRecord> ia1Map = new HashMap<>();
        Map<String, StudentIaMarksRecord> ia2Map = new HashMap<>();
        Map<String, StudentIaMarksRecord> ia3Map = new HashMap<>();
        for (StudentIaMarksRecord r : allSaved) {
            String u = r.getUsn() != null ? r.getUsn().trim().toUpperCase() : "";
            if (r.getIaNumber() == 1) ia1Map.put(u, r);
            else if (r.getIaNumber() == 2) ia2Map.put(u, r);
            else if (r.getIaNumber() == 3) ia3Map.put(u, r);
        }

        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("IoT-SplitUpMarks-" + semester + section);
            sheet.setDisplayGridlines(true);

            // STYLES
            Font titleFont = workbook.createFont();
            titleFont.setBold(true);
            titleFont.setFontHeightInPoints((short) 13);
            titleFont.setColor(IndexedColors.DARK_BLUE.getIndex());

            CellStyle collegeStyle = workbook.createCellStyle();
            collegeStyle.setAlignment(HorizontalAlignment.CENTER);
            collegeStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            collegeStyle.setFont(titleFont);

            Font subHeaderFont = workbook.createFont();
            subHeaderFont.setBold(true);
            subHeaderFont.setFontHeightInPoints((short) 11);
            CellStyle deptStyle = workbook.createCellStyle();
            deptStyle.setAlignment(HorizontalAlignment.CENTER);
            deptStyle.setFont(subHeaderFont);

            Font sectionFont = workbook.createFont();
            sectionFont.setBold(true);
            sectionFont.setFontHeightInPoints((short) 11);
            sectionFont.setColor(IndexedColors.WHITE.getIndex());

            // Section colors
            CellStyle ia1HeaderStyle = workbook.createCellStyle();
            ia1HeaderStyle.setFillForegroundColor(IndexedColors.ROYAL_BLUE.getIndex());
            ia1HeaderStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            ia1HeaderStyle.setAlignment(HorizontalAlignment.CENTER);
            ia1HeaderStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            ia1HeaderStyle.setFont(sectionFont);

            CellStyle ia2HeaderStyle = workbook.createCellStyle();
            ia2HeaderStyle.setFillForegroundColor(IndexedColors.DARK_TEAL.getIndex());
            ia2HeaderStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            ia2HeaderStyle.setAlignment(HorizontalAlignment.CENTER);
            ia2HeaderStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            ia2HeaderStyle.setFont(sectionFont);

            CellStyle ia3HeaderStyle = workbook.createCellStyle();
            ia3HeaderStyle.setFillForegroundColor(IndexedColors.VIOLET.getIndex());
            ia3HeaderStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            ia3HeaderStyle.setAlignment(HorizontalAlignment.CENTER);
            ia3HeaderStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            ia3HeaderStyle.setFont(sectionFont);

            CellStyle asoHeaderStyle = workbook.createCellStyle();
            asoHeaderStyle.setFillForegroundColor(IndexedColors.INDIGO.getIndex());
            asoHeaderStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            asoHeaderStyle.setAlignment(HorizontalAlignment.CENTER);
            asoHeaderStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            asoHeaderStyle.setFont(sectionFont);

            CellStyle colHeaderStyle = workbook.createCellStyle();
            colHeaderStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            colHeaderStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            colHeaderStyle.setAlignment(HorizontalAlignment.CENTER);
            colHeaderStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            colHeaderStyle.setBorderBottom(BorderStyle.THIN);
            colHeaderStyle.setBorderTop(BorderStyle.THIN);
            colHeaderStyle.setBorderLeft(BorderStyle.THIN);
            colHeaderStyle.setBorderRight(BorderStyle.THIN);
            Font boldColFont = workbook.createFont();
            boldColFont.setBold(true);
            boldColFont.setFontHeightInPoints((short) 9);
            colHeaderStyle.setFont(boldColFont);

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

            CellStyle totalStyle = workbook.createCellStyle();
            totalStyle.setAlignment(HorizontalAlignment.CENTER);
            totalStyle.setBorderBottom(BorderStyle.THIN);
            totalStyle.setBorderTop(BorderStyle.THIN);
            totalStyle.setBorderLeft(BorderStyle.THIN);
            totalStyle.setBorderRight(BorderStyle.THIN);
            Font boldTotal = workbook.createFont();
            boldTotal.setBold(true);
            totalStyle.setFont(boldTotal);

            // ROW 0: College
            Row r0 = sheet.createRow(0);
            Cell c0 = r0.createCell(0);
            c0.setCellValue("DON BOSCO INSTITUTE OF TECHNOLOGY, BANGALORE");
            c0.setCellStyle(collegeStyle);
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 56));

            // ROW 1: Dept
            Row r1 = sheet.createRow(1);
            Cell c1 = r1.createCell(0);
            c1.setCellValue("DEPARTMENT OF COMPUTER SCIENCE & ENGG.");
            c1.setCellStyle(deptStyle);
            sheet.addMergedRegion(new CellRangeAddress(1, 1, 0, 56));

            // ROW 2: Subject & Class
            Row r2 = sheet.createRow(2);
            Cell c2 = r2.createCell(0);
            c2.setCellValue("Subject: " + courseName + " (" + courseCode + ") | Semester: " + semester + " | Section: " + section + " | Classroom: " + classroom.getName());
            c2.setCellStyle(deptStyle);
            sheet.addMergedRegion(new CellRangeAddress(2, 2, 0, 56));

            // ROW 4: Main Section Category Bands (1st IA, 2ND IA, 3RD IA, A/S/O)
            Row r4 = sheet.createRow(4);
            r4.setHeightInPoints(22);

            Cell cellIa1 = r4.createCell(3);
            cellIa1.setCellValue("1st  IA (Modules 1 & 2)");
            cellIa1.setCellStyle(ia1HeaderStyle);
            sheet.addMergedRegion(new CellRangeAddress(4, 4, 3, 16));

            Cell cellIa2 = r4.createCell(18);
            cellIa2.setCellValue("2ND IA (Modules 3 & 4)");
            cellIa2.setCellStyle(ia2HeaderStyle);
            sheet.addMergedRegion(new CellRangeAddress(4, 4, 18, 33));

            Cell cellIa3 = r4.createCell(35);
            cellIa3.setCellValue("3RD IA (Module 5)");
            cellIa3.setCellStyle(ia3HeaderStyle);
            sheet.addMergedRegion(new CellRangeAddress(4, 4, 35, 47));

            Cell cellAso = r4.createCell(49);
            cellAso.setCellValue("A/S/O (Assignments & Lab)");
            cellAso.setCellStyle(asoHeaderStyle);
            sheet.addMergedRegion(new CellRangeAddress(4, 4, 49, 56));

            // ROW 11: Main Column Headers (Exactly matching Iot-7A-SplitupMarks.xlsx)
            Row r11 = sheet.createRow(11);
            r11.setHeightInPoints(20);

            Map<Integer, String> headerMap = new LinkedHashMap<>();
            headerMap.put(0, "Sl No");
            headerMap.put(1, "USN");
            headerMap.put(2, "STUDENT NAME");

            // IA-1 (cols 3..16)
            headerMap.put(3, "1a(10)");
            headerMap.put(4, "1b(10)");
            headerMap.put(5, "2a(10)");
            headerMap.put(6, "2b(10)");
            headerMap.put(7, "3a(10)");
            headerMap.put(8, "3b(10)");
            headerMap.put(9, "4a(10)");
            headerMap.put(10, "4b(10)");
            headerMap.put(12, "1");
            headerMap.put(13, "2");
            headerMap.put(14, "3");
            headerMap.put(15, "4");
            headerMap.put(16, "Total");

            // IA-2 (cols 18..33)
            headerMap.put(18, "1a(10)");
            headerMap.put(19, "1b(10)");
            headerMap.put(20, "2a(10)");
            headerMap.put(21, "2b(10)");
            headerMap.put(22, "3a(5)");
            headerMap.put(23, "3b(5)");
            headerMap.put(24, "3c(10)");
            headerMap.put(25, "4a(10)");
            headerMap.put(26, "4b(5)");
            headerMap.put(27, "4c(5)");
            headerMap.put(28, "Total");
            headerMap.put(29, "1");
            headerMap.put(30, "2");
            headerMap.put(31, "3");
            headerMap.put(32, "4");
            headerMap.put(33, "TOTAL");

            // IA-3 (cols 35..47)
            headerMap.put(35, "1a(10)");
            headerMap.put(36, "1b(10)");
            headerMap.put(37, "2a(10)");
            headerMap.put(38, "2b(10)");
            headerMap.put(39, "3a(10)");
            headerMap.put(40, "3b(10)");
            headerMap.put(41, "4a(10)");
            headerMap.put(42, "4b(10)");
            headerMap.put(43, "1");
            headerMap.put(44, "2");
            headerMap.put(45, "3");
            headerMap.put(46, "4");
            headerMap.put(47, "Total");

            // Assignments / Lab (cols 49..56)
            headerMap.put(49, "A1");
            headerMap.put(50, "A2");
            headerMap.put(51, "A3");
            headerMap.put(52, "S1");
            headerMap.put(53, "S2");
            headerMap.put(54, "Q1");
            headerMap.put(55, "Q2");
            headerMap.put(56, "AVG");

            for (Map.Entry<Integer, String> entry : headerMap.entrySet()) {
                Cell cell = r11.createCell(entry.getKey());
                cell.setCellValue(entry.getValue());
                cell.setCellStyle(colHeaderStyle);
            }

            // POPULATE ENROLLED STUDENTS
            List<Classroom.EnrolledStudent> students = classroom.getEnrolledStudents();
            if (students == null || students.isEmpty()) {
                students = new ArrayList<>();
            }

            // Ensure test members like John Doe and Santhosh are present if missing
            boolean hasJohn = students.stream().anyMatch(s -> "1DB21CS001".equalsIgnoreCase(s.getUsn()));
            boolean hasSanthu = students.stream().anyMatch(s -> "1DB23CS192".equalsIgnoreCase(s.getUsn()));
            List<Classroom.EnrolledStudent> exportList = new ArrayList<>(students);
            if (!hasJohn) exportList.add(Classroom.EnrolledStudent.builder().usn("1DB21CS001").name("John Doe").build());
            if (!hasSanthu) exportList.add(Classroom.EnrolledStudent.builder().usn("1DB23CS192").name("Santhosh").build());

            int rowIndex = 12; // row 13 in Excel
            int slNo = 1;

            for (Classroom.EnrolledStudent st : exportList) {
                Row row = sheet.createRow(rowIndex++);
                row.setHeightInPoints(18);

                String u = st.getUsn() != null ? st.getUsn().trim().toUpperCase() : "N/A";
                StudentIaMarksRecord rec1 = ia1Map.get(u);
                StudentIaMarksRecord rec2 = ia2Map.get(u);
                StudentIaMarksRecord rec3 = ia3Map.get(u);

                // Sl No
                Cell slCell = row.createCell(0);
                slCell.setCellValue(slNo++);
                slCell.setCellStyle(dataStyle);

                // USN
                Cell usnCell = row.createCell(1);
                usnCell.setCellValue(u);
                usnCell.setCellStyle(dataStyle);

                // Name
                Cell nameCell = row.createCell(2);
                nameCell.setCellValue(st.getName() != null ? st.getName() : "Student Candidate");
                nameCell.setCellStyle(nameStyle);

                // IA-1 subquestion marks (cols 3..10)
                int[] ia1Cols = { 3, 4, 5, 6, 7, 8, 9, 10 };
                String[] ia1Keys = { "1a", "1b", "2a", "2b", "3a", "3b", "4a", "4b" };
                for (int i = 0; i < ia1Cols.length; i++) {
                    Cell c = row.createCell(ia1Cols[i]);
                    c.setCellStyle(dataStyle);
                    if (rec1 != null && rec1.getQuestionMarks() != null && rec1.getQuestionMarks().containsKey(ia1Keys[i])) {
                        double v = rec1.getQuestionMarks().get(ia1Keys[i]);
                        if (v > 0) c.setCellValue(v);
                    }
                }

                // IA-1 Q totals: col 12=Q1, col 13=Q2, col 14=Q3, col 15=Q4
                int excelR = rowIndex;
                Cell cQ1 = row.createCell(12);
                cQ1.setCellFormula("SUM(D" + excelR + ":E" + excelR + ")");
                cQ1.setCellStyle(dataStyle);

                Cell cQ2 = row.createCell(13);
                cQ2.setCellFormula("SUM(F" + excelR + ":G" + excelR + ")");
                cQ2.setCellStyle(dataStyle);

                Cell cQ3 = row.createCell(14);
                cQ3.setCellFormula("SUM(H" + excelR + ":I" + excelR + ")");
                cQ3.setCellStyle(dataStyle);

                Cell cQ4 = row.createCell(15);
                cQ4.setCellFormula("SUM(J" + excelR + ":K" + excelR + ")");
                cQ4.setCellStyle(dataStyle);

                // IA-1 Total (col 16)
                Cell cTot1 = row.createCell(16);
                cTot1.setCellFormula("MAX(M" + excelR + ",N" + excelR + ")+MAX(O" + excelR + ",P" + excelR + ")");
                cTot1.setCellStyle(totalStyle);

                // IA-2 subquestion marks (cols 18..27)
                int[] ia2Cols = { 18, 19, 20, 21, 22, 23, 24, 25, 26, 27 };
                String[] ia2Keys = { "1a", "1b", "2a", "2b", "3a", "3b", "3c", "4a", "4b", "4c" };
                for (int i = 0; i < ia2Cols.length; i++) {
                    Cell c = row.createCell(ia2Cols[i]);
                    c.setCellStyle(dataStyle);
                    if (rec2 != null && rec2.getQuestionMarks() != null && rec2.getQuestionMarks().containsKey(ia2Keys[i])) {
                        double v = rec2.getQuestionMarks().get(ia2Keys[i]);
                        if (v > 0) c.setCellValue(v);
                    }
                }

                // IA-2 Q totals
                Cell cQ2_1 = row.createCell(29);
                cQ2_1.setCellFormula("SUM(S" + excelR + ":T" + excelR + ")");
                cQ2_1.setCellStyle(dataStyle);

                Cell cQ2_2 = row.createCell(30);
                cQ2_2.setCellFormula("SUM(U" + excelR + ":V" + excelR + ")");
                cQ2_2.setCellStyle(dataStyle);

                Cell cQ2_3 = row.createCell(31);
                cQ2_3.setCellFormula("SUM(W" + excelR + ":Y" + excelR + ")");
                cQ2_3.setCellStyle(dataStyle);

                Cell cQ2_4 = row.createCell(32);
                cQ2_4.setCellFormula("SUM(Z" + excelR + ":AB" + excelR + ")");
                cQ2_4.setCellStyle(dataStyle);

                // IA-2 Total (col 33)
                Cell cTot2 = row.createCell(33);
                cTot2.setCellFormula("MAX(AD" + excelR + ",AE" + excelR + ")+MAX(AF" + excelR + ",AG" + excelR + ")");
                cTot2.setCellStyle(totalStyle);

                // IA-3 subquestion marks (cols 35..42)
                int[] ia3Cols = { 35, 36, 37, 38, 39, 40, 41, 42 };
                String[] ia3Keys = { "1a", "1b", "2a", "2b", "3a", "3b", "4a", "4b" };
                for (int i = 0; i < ia3Cols.length; i++) {
                    Cell c = row.createCell(ia3Cols[i]);
                    c.setCellStyle(dataStyle);
                    if (rec3 != null && rec3.getQuestionMarks() != null && rec3.getQuestionMarks().containsKey(ia3Keys[i])) {
                        double v = rec3.getQuestionMarks().get(ia3Keys[i]);
                        if (v > 0) c.setCellValue(v);
                    }
                }

                Cell cQ3_1 = row.createCell(43);
                cQ3_1.setCellFormula("SUM(AJ" + excelR + ":AK" + excelR + ")");
                cQ3_1.setCellStyle(dataStyle);

                Cell cQ3_2 = row.createCell(44);
                cQ3_2.setCellFormula("SUM(AL" + excelR + ":AM" + excelR + ")");
                cQ3_2.setCellStyle(dataStyle);

                Cell cQ3_3 = row.createCell(45);
                cQ3_3.setCellFormula("SUM(AN" + excelR + ":AO" + excelR + ")");
                cQ3_3.setCellStyle(dataStyle);

                Cell cQ3_4 = row.createCell(46);
                cQ3_4.setCellFormula("SUM(AP" + excelR + ":AQ" + excelR + ")");
                cQ3_4.setCellStyle(dataStyle);

                // IA-3 Total (col 47)
                Cell cTot3 = row.createCell(47);
                cTot3.setCellFormula("MAX(AR" + excelR + ",AS" + excelR + ")+MAX(AT" + excelR + ",AU" + excelR + ")");
                cTot3.setCellStyle(totalStyle);

                // A/S/O cols 49..56
                for (int a = 49; a <= 55; a++) {
                    Cell c = row.createCell(a);
                    c.setCellStyle(dataStyle);
                }
                Cell cAvg = row.createCell(56);
                cAvg.setCellFormula("AVERAGE(AX" + excelR + ":BD" + excelR + ")");
                cAvg.setCellStyle(totalStyle);
            }

            // ADD 10 EXTRA BLANK ROWS FOR MANUAL ENTRY
            for (int k = 0; k < 10; k++) {
                Row row = sheet.createRow(rowIndex++);
                row.setHeightInPoints(18);

                Cell slCell = row.createCell(0);
                slCell.setCellValue(slNo++);
                slCell.setCellStyle(dataStyle);

                row.createCell(1).setCellStyle(dataStyle);
                row.createCell(2).setCellStyle(nameStyle);

                // All mark cells
                for (int col = 3; col <= 56; col++) {
                    Cell c = row.createCell(col);
                    c.setCellStyle(dataStyle);
                }

                int excelR = rowIndex;
                row.getCell(12).setCellFormula("SUM(D" + excelR + ":E" + excelR + ")");
                row.getCell(13).setCellFormula("SUM(F" + excelR + ":G" + excelR + ")");
                row.getCell(14).setCellFormula("SUM(H" + excelR + ":I" + excelR + ")");
                row.getCell(15).setCellFormula("SUM(J" + excelR + ":K" + excelR + ")");
                Cell cTot1 = row.getCell(16);
                cTot1.setCellFormula("MAX(M" + excelR + ",N" + excelR + ")+MAX(O" + excelR + ",P" + excelR + ")");
                cTot1.setCellStyle(totalStyle);

                row.getCell(29).setCellFormula("SUM(S" + excelR + ":T" + excelR + ")");
                row.getCell(30).setCellFormula("SUM(U" + excelR + ":V" + excelR + ")");
                row.getCell(31).setCellFormula("SUM(W" + excelR + ":Y" + excelR + ")");
                row.getCell(32).setCellFormula("SUM(Z" + excelR + ":AB" + excelR + ")");
                Cell cTot2 = row.getCell(33);
                cTot2.setCellFormula("MAX(AD" + excelR + ",AE" + excelR + ")+MAX(AF" + excelR + ",AG" + excelR + ")");
                cTot2.setCellStyle(totalStyle);

                row.getCell(43).setCellFormula("SUM(AJ" + excelR + ":AK" + excelR + ")");
                row.getCell(44).setCellFormula("SUM(AL" + excelR + ":AM" + excelR + ")");
                row.getCell(45).setCellFormula("SUM(AN" + excelR + ":AO" + excelR + ")");
                row.getCell(46).setCellFormula("SUM(AP" + excelR + ":AQ" + excelR + ")");
                Cell cTot3 = row.getCell(47);
                cTot3.setCellFormula("MAX(AR" + excelR + ",AS" + excelR + ")+MAX(AT" + excelR + ",AU" + excelR + ")");
                cTot3.setCellStyle(totalStyle);
            }

            sheet.setColumnWidth(0, 8 * 256);
            sheet.setColumnWidth(1, 16 * 256);
            sheet.setColumnWidth(2, 26 * 256);
            for (int c = 3; c <= 56; c++) {
                sheet.setColumnWidth(c, 8 * 256);
            }

            workbook.write(out);
            return out.toByteArray();
        }
    }

    // =========================================================================
    // 1C. INGEST MASTER UNIFIED SPLIT-UP SHEET (MULTI-IA SIMULTANEOUS PARSER)
    // =========================================================================
    public IaIngestionSummary ingestMasterUnifiedSheet(String classroomId, MultipartFile file, String teacherEmail) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Excel file is required");
        }

        List<StudentIaMarksRecord> allSavedRecords = new ArrayList<>();
        Set<String> uniqueStudentsIngested = new HashSet<>();
        Set<Integer> ingestedIas = new TreeSet<>();

        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            if (sheet == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No sheets found in Excel file");
            }

            // Dynamic Column detection for IA-1, IA-2, IA-3
            int usnCol = 1;
            int nameCol = 2;

            // Default column index arrays based on Iot-7A-SplitupMarks.xlsx (overridden dynamically below)
            Map<String, Integer> ia1Cols = new LinkedHashMap<>();
            ia1Cols.put("1a", 3); ia1Cols.put("1b", 4);
            ia1Cols.put("2a", 5); ia1Cols.put("2b", 6);
            ia1Cols.put("3a", 7); ia1Cols.put("3b", 8);
            ia1Cols.put("4a", 9); ia1Cols.put("4b", 10);
            int ia1TotalCol = 16;

            Map<String, Integer> ia2Cols = new LinkedHashMap<>();
            ia2Cols.put("1a", 18); ia2Cols.put("1b", 19);
            ia2Cols.put("2a", 20); ia2Cols.put("2b", 21);
            ia2Cols.put("3a", 22); ia2Cols.put("3b", 23); ia2Cols.put("3c", 24);
            ia2Cols.put("4a", 25); ia2Cols.put("4b", 26); ia2Cols.put("4c", 27);
            int ia2TotalCol = 33;

            Map<String, Integer> ia3Cols = new LinkedHashMap<>();
            ia3Cols.put("1a", 35); ia3Cols.put("1b", 36);
            ia3Cols.put("2a", 37); ia3Cols.put("2b", 38);
            ia3Cols.put("3a", 39); ia3Cols.put("3b", 40);
            ia3Cols.put("4a", 41); ia3Cols.put("4b", 42);
            int ia3TotalCol = 47;

            // Dynamic Row and Column detection for IA-1, IA-2, IA-3
            int headerRowIndex = -1;
            Pattern subQCheckPattern = Pattern.compile("(?i)([1-9][a-c])(?:\\((\\d+)\\))?");

            // Scan rows dynamically to locate the header row containing "USN" and question markers
            for (int r = 0; r <= sheet.getLastRowNum(); r++) {
                Row hr = sheet.getRow(r);
                if (hr == null) continue;
                boolean hasUsn = false;
                int qCount = 0;
                for (Cell c : hr) {
                    String str = getCellString(c).trim();
                    if (str.toLowerCase().contains("usn")) hasUsn = true;
                    if (subQCheckPattern.matcher(str).find()) qCount++;
                }
                if (hasUsn && qCount > 0) {
                    headerRowIndex = r;
                    // Dynamically map columns for IA-1, IA-2, IA-3 from this header row
                    Map<String, Integer> dynIa1Cols = new LinkedHashMap<>();
                    Map<String, Integer> dynIa2Cols = new LinkedHashMap<>();
                    Map<String, Integer> dynIa3Cols = new LinkedHashMap<>();
                    int dynIa1Total = -1;
                    int dynIa2Total = -1;
                    int dynIa3Total = -1;

                    // Group questions by section: a section's questions end when a "Total" column is encountered
                    int sectionIdx = 1;
                    for (Cell c : hr) {
                        String val = getCellString(c).trim();
                        String valLower = val.toLowerCase();
                        int cIdx = c.getColumnIndex();

                        if (valLower.contains("usn")) {
                            usnCol = cIdx;
                        } else if (valLower.contains("student name") || valLower.contains("name") || valLower.contains("student")) {
                            nameCol = cIdx;
                        }

                        Matcher m = subQCheckPattern.matcher(val);
                        if (m.find()) {
                            String code = m.group(1).toLowerCase();
                            // If we encountered a total for section 1, next question begins section 2; similarly for section 3
                            if (sectionIdx == 1 && dynIa1Total >= 0) {
                                sectionIdx = 2;
                            } else if (sectionIdx == 2 && dynIa2Total >= 0) {
                                sectionIdx = 3;
                            }

                            if (sectionIdx == 1) {
                                dynIa1Cols.put(code, cIdx);
                            } else if (sectionIdx == 2) {
                                dynIa2Cols.put(code, cIdx);
                            } else if (sectionIdx == 3) {
                                dynIa3Cols.put(code, cIdx);
                            }
                        } else if (valLower.contains("total") || valLower.endsWith("total")) {
                            if (sectionIdx == 1 && dynIa1Total < 0 && !dynIa1Cols.isEmpty()) {
                                dynIa1Total = cIdx;
                            } else if (sectionIdx == 2 && dynIa2Total < 0 && !dynIa2Cols.isEmpty()) {
                                dynIa2Total = cIdx;
                            } else if (sectionIdx == 3 && dynIa3Total < 0 && !dynIa3Cols.isEmpty()) {
                                dynIa3Total = cIdx;
                            }
                        }
                    }

                    if (!dynIa1Cols.isEmpty()) ia1Cols = dynIa1Cols;
                    if (dynIa1Total >= 0) ia1TotalCol = dynIa1Total;

                    if (!dynIa2Cols.isEmpty()) ia2Cols = dynIa2Cols;
                    if (dynIa2Total >= 0) ia2TotalCol = dynIa2Total;

                    if (!dynIa3Cols.isEmpty()) ia3Cols = dynIa3Cols;
                    if (dynIa3Total >= 0) ia3TotalCol = dynIa3Total;

                    break;
                }
            }

            int startRow = (headerRowIndex >= 0) ? headerRowIndex + 1 : 12;
            log.info("Master unified ingestion: detected headerRowIndex={}, startStudentRow={}, usnCol={}, nameCol={}, ia1Cols={}, ia1Total={}, ia2Cols={}, ia2Total={}, ia3Cols={}, ia3Total={}",
                    headerRowIndex, startRow, usnCol, nameCol, ia1Cols, ia1TotalCol, ia2Cols, ia2TotalCol, ia3Cols, ia3TotalCol);

            // Loop student rows starting right after the detected header row
            for (int r = startRow; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                if (row == null) continue;

                // Look for USN
                String foundUsn = null;
                Cell uCell = row.getCell(usnCol);
                if (uCell != null) {
                    String str = getCellString(uCell).trim();
                    if (USN_PATTERN.matcher(str).find() || (str.length() >= 10 && str.toUpperCase().startsWith("1DB"))) {
                        foundUsn = str.toUpperCase();
                    }
                }
                if (foundUsn == null) {
                    for (Cell c : row) {
                        String str = getCellString(c).trim();
                        if (USN_PATTERN.matcher(str).find() || (str.length() >= 10 && str.toUpperCase().startsWith("1DB"))) {
                            foundUsn = str.toUpperCase();
                            break;
                        }
                    }
                }

                if (foundUsn == null) continue;

                // Student name
                String foundName = "Student (" + foundUsn + ")";
                Cell nCell = row.getCell(nameCol);
                if (nCell != null) {
                    String str = getCellString(nCell).trim();
                    if (!str.isEmpty() && !str.equalsIgnoreCase("student name") && !str.equalsIgnoreCase("max")) {
                        foundName = str;
                    }
                }

                // Parse IA-1
                boolean hasIa1 = false;
                Map<String, Double> ia1Marks = new HashMap<>();
                for (Map.Entry<String, Integer> e : ia1Cols.entrySet()) {
                    double m = parseNumericMarks(row.getCell(e.getValue()));
                    ia1Marks.put(e.getKey(), m);
                    if (m > 0) hasIa1 = true;
                }
                double ia1Tot = parseNumericMarks(row.getCell(ia1TotalCol));
                if (ia1Tot > 0) hasIa1 = true;

                if (hasIa1) {
                    if (ia1Tot <= 0) {
                        ia1Tot = Math.max(ia1Marks.getOrDefault("1a", 0.0) + ia1Marks.getOrDefault("1b", 0.0),
                                          ia1Marks.getOrDefault("2a", 0.0) + ia1Marks.getOrDefault("2b", 0.0)) +
                                 Math.max(ia1Marks.getOrDefault("3a", 0.0) + ia1Marks.getOrDefault("3b", 0.0),
                                          ia1Marks.getOrDefault("4a", 0.0) + ia1Marks.getOrDefault("4b", 0.0));
                    }
                    StudentIaMarksRecord rec1 = upsertStudentRecord(classroomId, foundUsn, foundName, 1, ia1Marks, ia1Tot);
                    allSavedRecords.add(rec1);
                    uniqueStudentsIngested.add(foundUsn);
                    ingestedIas.add(1);
                }

                // Parse IA-2
                boolean hasIa2 = false;
                Map<String, Double> ia2Marks = new HashMap<>();
                for (Map.Entry<String, Integer> e : ia2Cols.entrySet()) {
                    double m = parseNumericMarks(row.getCell(e.getValue()));
                    ia2Marks.put(e.getKey(), m);
                    if (m > 0) hasIa2 = true;
                }
                double ia2Tot = parseNumericMarks(row.getCell(ia2TotalCol));
                if (ia2Tot > 0) hasIa2 = true;

                if (hasIa2) {
                    if (ia2Tot <= 0) {
                        ia2Tot = Math.max(ia2Marks.getOrDefault("1a", 0.0) + ia2Marks.getOrDefault("1b", 0.0),
                                          ia2Marks.getOrDefault("2a", 0.0) + ia2Marks.getOrDefault("2b", 0.0)) +
                                 Math.max(ia2Marks.getOrDefault("3a", 0.0) + ia2Marks.getOrDefault("3b", 0.0) + ia2Marks.getOrDefault("3c", 0.0),
                                          ia2Marks.getOrDefault("4a", 0.0) + ia2Marks.getOrDefault("4b", 0.0) + ia2Marks.getOrDefault("4c", 0.0));
                    }
                    StudentIaMarksRecord rec2 = upsertStudentRecord(classroomId, foundUsn, foundName, 2, ia2Marks, ia2Tot);
                    allSavedRecords.add(rec2);
                    uniqueStudentsIngested.add(foundUsn);
                    ingestedIas.add(2);
                }

                // Parse IA-3
                boolean hasIa3 = false;
                Map<String, Double> ia3Marks = new HashMap<>();
                for (Map.Entry<String, Integer> e : ia3Cols.entrySet()) {
                    double m = parseNumericMarks(row.getCell(e.getValue()));
                    ia3Marks.put(e.getKey(), m);
                    if (m > 0) hasIa3 = true;
                }
                double ia3Tot = parseNumericMarks(row.getCell(ia3TotalCol));
                if (ia3Tot > 0) hasIa3 = true;

                if (hasIa3) {
                    if (ia3Tot <= 0) {
                        ia3Tot = Math.max(ia3Marks.getOrDefault("1a", 0.0) + ia3Marks.getOrDefault("1b", 0.0),
                                          ia3Marks.getOrDefault("2a", 0.0) + ia3Marks.getOrDefault("2b", 0.0)) +
                                 Math.max(ia3Marks.getOrDefault("3a", 0.0) + ia3Marks.getOrDefault("3b", 0.0),
                                          ia3Marks.getOrDefault("4a", 0.0) + ia3Marks.getOrDefault("4b", 0.0));
                    }
                    StudentIaMarksRecord rec3 = upsertStudentRecord(classroomId, foundUsn, foundName, 3, ia3Marks, ia3Tot);
                    allSavedRecords.add(rec3);
                    uniqueStudentsIngested.add(foundUsn);
                    ingestedIas.add(3);
                }
            }
        }

        String iaListStr = ingestedIas.isEmpty() ? "None" : ingestedIas.stream().map(i -> "IA-" + i).reduce((a, b) -> a + ", " + b).orElse("");
        log.info("Master unified ingestion complete for classroom {}: {} unique students, IAs: {}",
                classroomId, uniqueStudentsIngested.size(), iaListStr);

        return IaIngestionSummary.builder()
                .classroomId(classroomId)
                .iaNumber(0) // 0 denotes Master All-IA
                .totalStudentsIngested(uniqueStudentsIngested.size())
                .filename(file.getOriginalFilename())
                .records(allSavedRecords)
                .ingestedIas(new ArrayList<>(ingestedIas))
                .message("Successfully ingested master marks for " + uniqueStudentsIngested.size() + " student(s) across " + iaListStr + "!")
                .build();
    }

    private StudentIaMarksRecord upsertStudentRecord(String classroomId, String usn, String name, int iaNumber, Map<String, Double> questionMarks, double totalMarks) {
        Map<Integer, Double> moduleMastery = calculateModuleMastery(iaNumber, questionMarks);
        Optional<StudentIaMarksRecord> existingOpt = iaMarksRecordRepository
                .findFirstByClassroomIdAndUsnIgnoreCaseAndIaNumber(classroomId, usn, iaNumber);

        StudentIaMarksRecord record;
        if (existingOpt.isPresent()) {
            record = existingOpt.get();
            record.setStudentName(name);
            record.setQuestionMarks(questionMarks);
            record.setTotalMarks(totalMarks);
            record.setModuleMastery(moduleMastery);
            record.setPublished(false); // Reset to unpublished draft
            record.setUpdatedAt(Instant.now());
        } else {
            record = StudentIaMarksRecord.builder()
                    .classroomId(classroomId)
                    .usn(usn)
                    .studentName(name)
                    .iaNumber(iaNumber)
                    .questionMarks(questionMarks)
                    .totalMarks(totalMarks)
                    .moduleMastery(moduleMastery)
                    .published(false) // Draft by default
                    .updatedAt(Instant.now())
                    .build();
        }
        return iaMarksRecordRepository.save(record);
    }

    // =========================================================================
    // 2. INGEST SINGLE IA MARKS FROM EXCEL (.XLSX)
    // =========================================================================
    public IaIngestionSummary ingestIaMarks(String classroomId, MultipartFile file, int iaNumber, String teacherEmail) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Excel file is required");
        }
        if (iaNumber < 1 || iaNumber > 3) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid IA number: " + iaNumber + ". Must be 1, 2, or 3.");
        }

        List<StudentIaMarksRecord> savedRecords = new ArrayList<>();

        // Load classroom roster for fallback name resolution & USN matching
        Classroom classroom = classroomRepository.findById(classroomId).orElse(null);
        Map<String, String> enrolledNames = new HashMap<>();
        if (classroom != null && classroom.getEnrolledStudents() != null) {
            for (Classroom.EnrolledStudent es : classroom.getEnrolledStudents()) {
                if (es.getUsn() != null && !es.getUsn().isBlank()) {
                    enrolledNames.put(es.getUsn().trim().toUpperCase(), es.getName() != null ? es.getName() : "Student");
                }
            }
        }

        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            if (sheet == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The uploaded Excel workbook contains no sheets");
            }

            // Map sub-question columns dynamically using regex ([1-9][a-c])
            Map<String, Integer> subQuestionColMap = new LinkedHashMap<>();
            Map<String, Double> maxMarksMap = new HashMap<>();
            int usnCol = 1;
            int nameCol = 2;
            int totalCol = -1;
            int headerRowIndex = -1;
            Row headerRow = null;

            Pattern subQRegex = Pattern.compile("(?i)([1-9][a-c])(?:\\((\\d+)\\))?");

            // Search every row dynamically to locate the header row containing "USN" and question markers (matching regex ([1-9][a-c]))
            // In Iot-7A-SplitupMarks.xlsx, the header row is at index 11 and students start at index 12.
            for (int r = 0; r <= sheet.getLastRowNum(); r++) {
                Row candidateRow = sheet.getRow(r);
                if (candidateRow == null) continue;

                boolean hasUsnHeader = false;
                int questionMarkerCount = 0;

                for (Cell cell : candidateRow) {
                    String val = getCellString(cell).trim();
                    if (val.toLowerCase().contains("usn")) {
                        hasUsnHeader = true;
                    }
                    if (subQRegex.matcher(val).find()) {
                        questionMarkerCount++;
                    }
                }

                if (hasUsnHeader && questionMarkerCount > 0) {
                    headerRowIndex = r;
                    headerRow = candidateRow;
                    break;
                }
            }

            // Build dynamic column index map from detected header row:
            List<Map<String, Integer>> detectedSections = new ArrayList<>();
            List<Integer> detectedSectionTotals = new ArrayList<>();
            Map<String, Integer> currentSectionMap = new LinkedHashMap<>();
            int currentSectionTotal = -1;

            if (headerRow != null) {
                for (Cell cell : headerRow) {
                    String val = getCellString(cell).trim();
                    String valLower = val.toLowerCase();
                    int cIdx = cell.getColumnIndex();

                    if (valLower.contains("usn")) {
                        usnCol = cIdx;
                    } else if (valLower.contains("student name") || valLower.contains("name") || valLower.contains("student")) {
                        nameCol = cIdx;
                    }

                    Matcher m = subQRegex.matcher(val);
                    if (m.find()) {
                        String code = m.group(1).toLowerCase();
                        // If we already saw a total for the current section of questions, this question starts a new IA section!
                        if (currentSectionTotal >= 0) {
                            detectedSections.add(currentSectionMap);
                            detectedSectionTotals.add(currentSectionTotal);
                            currentSectionMap = new LinkedHashMap<>();
                            currentSectionTotal = -1;
                        }
                        currentSectionMap.put(code, cIdx);
                        if (m.group(2) != null) {
                            try {
                                maxMarksMap.put(code, Double.parseDouble(m.group(2)));
                            } catch (Exception ignored) {}
                        }
                    } else if (valLower.contains("total") || valLower.endsWith("total")) {
                        if (currentSectionTotal < 0 && !currentSectionMap.isEmpty()) {
                            currentSectionTotal = cIdx;
                        }
                    }
                }
                if (!currentSectionMap.isEmpty()) {
                    detectedSections.add(currentSectionMap);
                    detectedSectionTotals.add(currentSectionTotal);
                }
            } else {
                // Fallback scan for template headers
                for (int r = 0; r <= 15 && r <= sheet.getLastRowNum(); r++) {
                    Row hr = sheet.getRow(r);
                    if (hr == null) continue;
                    for (Cell cell : hr) {
                        String val = getCellString(cell).trim();
                        String valLower = val.toLowerCase();
                        Matcher m = subQRegex.matcher(val);
                        if (m.find()) {
                            currentSectionMap.put(m.group(1).toLowerCase(), cell.getColumnIndex());
                        } else if (valLower.contains("usn")) {
                            usnCol = cell.getColumnIndex();
                            if (headerRowIndex < 0) headerRowIndex = r;
                        } else if (valLower.contains("name") || valLower.contains("student")) {
                            nameCol = cell.getColumnIndex();
                        } else if (valLower.contains("total") || valLower.endsWith("total")) {
                            if (currentSectionTotal < 0) currentSectionTotal = cell.getColumnIndex();
                        }
                    }
                }
                if (!currentSectionMap.isEmpty()) {
                    detectedSections.add(currentSectionMap);
                    detectedSectionTotals.add(currentSectionTotal);
                }
            }

            // Pick the target section corresponding to iaNumber:
            // In a Master Unified Sheet: section 0 is IA-1, section 1 is IA-2, section 2 is IA-3.
            // In a Single IA Sheet: section 0 is the uploaded IA.
            int targetSectionIdx = -1;
            if (detectedSections.size() >= iaNumber) {
                targetSectionIdx = iaNumber - 1;
            } else if (detectedSections.size() == 1) {
                targetSectionIdx = 0;
            } else if (!detectedSections.isEmpty()) {
                targetSectionIdx = 0;
            }

            if (targetSectionIdx >= 0) {
                subQuestionColMap = detectedSections.get(targetSectionIdx);
                totalCol = detectedSectionTotals.get(targetSectionIdx);
            }

            // Fallback: If subQuestionColMap is empty, lookup active blueprint
            if (subQuestionColMap.isEmpty()) {
                IaQuestionBlueprint bp = paperParserService.getOrCreateDefaultBlueprint(classroomId, iaNumber);
                if (bp.getQuestions() != null && !bp.getQuestions().isEmpty()) {
                    int c = 3;
                    for (IaSubQuestionItem q : bp.getQuestions()) {
                        subQuestionColMap.put(q.getCode().toLowerCase(), c++);
                    }
                    if (totalCol < 0) totalCol = c;
                }
            }

            if (totalCol < 0) {
                totalCol = 16;
            }

            int startRow = (headerRowIndex >= 0) ? headerRowIndex + 1 : 1;
            log.info("Single IA ingestion: target IA={}, detectedSectionsCount={}, chosenSectionIdx={}, startStudentRow={}, USN={}, Name={}, Total={}, SubQuestions={}",
                    iaNumber, detectedSections.size(), targetSectionIdx, startRow, usnCol, nameCol, totalCol, subQuestionColMap);

            // For every row after the header row: extract USN, Student Name, and parse marks
            for (int r = startRow; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                if (row == null) continue;

                // Look for USN in row
                String foundUsn = null;
                String foundName = null;

                Cell usnCell = row.getCell(usnCol);
                if (usnCell != null) {
                    String str = getCellString(usnCell).trim();
                    if (isUsn(str) || enrolledNames.containsKey(str.toUpperCase())) {
                        foundUsn = str.toUpperCase();
                    }
                }

                if (foundUsn == null) {
                    for (Cell c : row) {
                        String str = getCellString(c).trim();
                        if (isUsn(str) || enrolledNames.containsKey(str.toUpperCase())) {
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
                if ((foundName == null || foundName.isBlank() || foundName.equalsIgnoreCase("total") || foundName.equalsIgnoreCase("max")) && enrolledNames.containsKey(foundUsn)) {
                    foundName = enrolledNames.get(foundUsn);
                }
                if (foundName == null || foundName.isBlank()) {
                    foundName = "Student (" + foundUsn + ")";
                }

                // Extract sub-question marks (Double for each mapped question column, handling unattempted)
                Map<String, Double> questionMarks = new HashMap<>();
                for (Map.Entry<String, Integer> entry : subQuestionColMap.entrySet()) {
                    String qKey = entry.getKey();
                    int cIdx = entry.getValue();
                    Cell qCell = row.getCell(cIdx);
                    double marks = parseNumericMarks(qCell);
                    questionMarks.put(qKey, marks);
                }

                // Calculate Total = Math.max(Q1_total, Q2_total) + Math.max(Q3_total, Q4_total)
                double q1Total = questionMarks.getOrDefault("1a", 0.0) + questionMarks.getOrDefault("1b", 0.0) + questionMarks.getOrDefault("1c", 0.0);
                double q2Total = questionMarks.getOrDefault("2a", 0.0) + questionMarks.getOrDefault("2b", 0.0) + questionMarks.getOrDefault("2c", 0.0);
                double partAScore = Math.max(q1Total, q2Total);

                double q3Total = questionMarks.getOrDefault("3a", 0.0) + questionMarks.getOrDefault("3b", 0.0) + questionMarks.getOrDefault("3c", 0.0);
                double q4Total = questionMarks.getOrDefault("4a", 0.0) + questionMarks.getOrDefault("4b", 0.0) + questionMarks.getOrDefault("4c", 0.0);
                double partBScore = Math.max(q3Total, q4Total);

                double computedTotal = partAScore + partBScore;

                double extractedTotal = 0.0;
                Cell tCell = row.getCell(totalCol);
                extractedTotal = parseNumericMarks(tCell);
                if (extractedTotal <= 0.0) {
                    extractedTotal = computedTotal;
                }

                // Map attempted choices
                Map<String, String> choiceTags = new HashMap<>();
                choiceTags.put("Q1_OR_Q2", (q1Total >= q2Total && (q1Total > 0 || !questionMarks.containsKey("2a"))) ? "Q1" : "Q2");
                choiceTags.put("Q3_OR_Q4", (q3Total >= q4Total && (q3Total > 0 || !questionMarks.containsKey("4a"))) ? "Q3" : "Q4");

                // Compute module mastery
                Map<Integer, Double> moduleMastery = calculateModuleMastery(iaNumber, questionMarks);

                // Upsert into repository with published = false (DRAFT status)
                Optional<StudentIaMarksRecord> existingOpt = iaMarksRecordRepository
                        .findFirstByClassroomIdAndUsnIgnoreCaseAndIaNumber(classroomId, foundUsn, iaNumber);

                StudentIaMarksRecord record;
                if (existingOpt.isPresent()) {
                    record = existingOpt.get();
                    record.setStudentName(foundName);
                    record.setQuestionMarks(questionMarks);
                    record.setTotalMarks(extractedTotal);
                    record.setModuleMastery(moduleMastery);
                    record.setAttemptedChoiceGroups(choiceTags);
                    if (!maxMarksMap.isEmpty()) record.setMaxMarksPerQuestion(maxMarksMap);
                    record.setPublished(false); // Reset to draft: wait for teacher confirmation!
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
                            .attemptedChoiceGroups(choiceTags)
                            .maxMarksPerQuestion(maxMarksMap)
                            .published(false) // Draft by default: wait for teacher confirmation!
                            .updatedAt(Instant.now())
                            .build();
                }

                StudentIaMarksRecord saved = iaMarksRecordRepository.save(record);
                savedRecords.add(saved);
                log.info("Ingested IA-{} marks for {} ({}) - Total: {} (DRAFT - unpublished)",
                        iaNumber, foundName, foundUsn, extractedTotal);
            }
        }

        return IaIngestionSummary.builder()
                .classroomId(classroomId)
                .iaNumber(iaNumber)
                .totalStudentsIngested(savedRecords.size())
                .filename(file.getOriginalFilename())
                .records(savedRecords)
                .published(false)
                .message("Successfully ingested IA-" + iaNumber + " marks for " + savedRecords.size() + " student(s)! (Saved as Draft - click 'Publish' to make visible to students)")
                .build();
    }

    // =========================================================================
    // 2B. SAVE MANUAL MARKS FROM ENTRY GRID
    // =========================================================================
    public List<StudentIaMarksRecord> saveManualMarks(String classroomId, int iaNumber, List<ManualMarksRecordRequest> requests) {
        if (iaNumber < 1 || iaNumber > 3) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid IA number: " + iaNumber + ". Must be 1, 2, or 3.");
        }
        if (requests == null || requests.isEmpty()) {
            return Collections.emptyList();
        }

        List<StudentIaMarksRecord> savedRecords = new ArrayList<>();
        for (ManualMarksRecordRequest req : requests) {
            if (req.getUsn() == null || req.getUsn().isBlank()) continue;
            String usn = req.getUsn().trim().toUpperCase();
            String name = req.getStudentName() != null && !req.getStudentName().isBlank() ? req.getStudentName().trim() : "Student (" + usn + ")";
            Map<String, Double> questionMarks = req.getQuestionMarks() != null ? req.getQuestionMarks() : new HashMap<>();

            // Calculate choice totals: Max(Q1, Q2) + Max(Q3, Q4)
            double q1Total = questionMarks.getOrDefault("1a", 0.0) + questionMarks.getOrDefault("1b", 0.0) + questionMarks.getOrDefault("1c", 0.0);
            double q2Total = questionMarks.getOrDefault("2a", 0.0) + questionMarks.getOrDefault("2b", 0.0) + questionMarks.getOrDefault("2c", 0.0);
            double partAScore = Math.max(q1Total, q2Total);

            double q3Total = questionMarks.getOrDefault("3a", 0.0) + questionMarks.getOrDefault("3b", 0.0) + questionMarks.getOrDefault("3c", 0.0);
            double q4Total = questionMarks.getOrDefault("4a", 0.0) + questionMarks.getOrDefault("4b", 0.0) + questionMarks.getOrDefault("4c", 0.0);
            double partBScore = Math.max(q3Total, q4Total);

            double computedTotal = partAScore + partBScore;

            Map<String, String> choiceTags = new HashMap<>();
            choiceTags.put("Q1_OR_Q2", (q1Total >= q2Total && (q1Total > 0 || !questionMarks.containsKey("2a"))) ? "Q1" : "Q2");
            choiceTags.put("Q3_OR_Q4", (q3Total >= q4Total && (q3Total > 0 || !questionMarks.containsKey("4a"))) ? "Q3" : "Q4");

            Map<Integer, Double> moduleMastery = calculateModuleMastery(iaNumber, questionMarks);

            Optional<StudentIaMarksRecord> existingOpt = iaMarksRecordRepository
                    .findFirstByClassroomIdAndUsnIgnoreCaseAndIaNumber(classroomId, usn, iaNumber);

            StudentIaMarksRecord record;
            if (existingOpt.isPresent()) {
                record = existingOpt.get();
                record.setStudentName(name);
                record.setQuestionMarks(questionMarks);
                record.setTotalMarks(computedTotal);
                record.setModuleMastery(moduleMastery);
                record.setAttemptedChoiceGroups(choiceTags);
                record.setPublished(false); // Saved as draft until confirmed
                record.setUpdatedAt(Instant.now());
            } else {
                record = StudentIaMarksRecord.builder()
                        .classroomId(classroomId)
                        .usn(usn)
                        .studentName(name)
                        .iaNumber(iaNumber)
                        .questionMarks(questionMarks)
                        .totalMarks(computedTotal)
                        .moduleMastery(moduleMastery)
                        .attemptedChoiceGroups(choiceTags)
                        .published(false)
                        .updatedAt(Instant.now())
                        .build();
            }

            StudentIaMarksRecord saved = iaMarksRecordRepository.save(record);
            savedRecords.add(saved);
        }
        return savedRecords;
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

    /**
     * Teacher confirmation to publish or unpublish marks to students.
     * When publish=true, students can see their score and module mastery on their dashboard.
     */
    public Map<String, Object> publishIaMarks(String classroomId, int iaNumber, boolean publish) {
        List<StudentIaMarksRecord> records = iaMarksRecordRepository.findByClassroomId(classroomId);
        int updatedCount = 0;
        Instant now = Instant.now();

        for (StudentIaMarksRecord r : records) {
            if (iaNumber == 0 || r.getIaNumber() == iaNumber) {
                r.setPublished(publish);
                r.setPublishedAt(publish ? now : null);
                r.setUpdatedAt(now);
                iaMarksRecordRepository.save(r);
                updatedCount++;
            }
        }

        log.info("Teacher {} published marks for classroom {}, IA={}: {} records updated",
                publish ? "CONFIRMED" : "REVOKED", classroomId, iaNumber, updatedCount);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("classroomId", classroomId);
        response.put("iaNumber", iaNumber);
        response.put("published", publish);
        response.put("updatedCount", updatedCount);
        response.put("message", publish
                ? "Successfully published " + (iaNumber == 0 ? "all IA" : "IA-" + iaNumber) + " marks to students! (" + updatedCount + " records published)"
                : "Unpublished " + (iaNumber == 0 ? "all IA" : "IA-" + iaNumber) + " marks (reverted to teacher draft).");
        return response;
    }

    /**
     * Get publication status for each IA test in the classroom.
     */
    public Map<String, Object> getIaPublishStatus(String classroomId) {
        List<StudentIaMarksRecord> records = iaMarksRecordRepository.findByClassroomId(classroomId);
        Map<String, Object> status = new HashMap<>();

        for (int i = 1; i <= 3; i++) {
            final int ia = i;
            List<StudentIaMarksRecord> iaRecs = records.stream().filter(r -> r.getIaNumber() == ia).toList();
            long total = iaRecs.size();
            long pubCount = iaRecs.stream().filter(StudentIaMarksRecord::isPublished).count();
            boolean isPublished = total > 0 && pubCount == total;

            status.put("ia" + ia + "Published", isPublished);
            status.put("ia" + ia + "TotalRecords", total);
            status.put("ia" + ia + "PublishedCount", pubCount);
            status.put("ia" + ia + "Status", total == 0 ? "NO_MARKS" : (isPublished ? "PUBLISHED" : (pubCount > 0 ? "PARTIAL" : "DRAFT")));
        }

        return status;
    }

    /**
     * Reset and wipe all recorded marks for a specific IA test (or all IAs if iaNumber == 0).
     */
    public Map<String, Object> resetIaMarks(String classroomId, int iaNumber) {
        List<StudentIaMarksRecord> records = iaMarksRecordRepository.findByClassroomId(classroomId);
        int deletedCount = 0;
        for (StudentIaMarksRecord r : records) {
            if (iaNumber == 0 || r.getIaNumber() == iaNumber) {
                iaMarksRecordRepository.delete(r);
                deletedCount++;
            }
        }

        log.info("Reset marks for classroom {}, IA={}: {} records deleted", classroomId, iaNumber, deletedCount);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("classroomId", classroomId);
        response.put("iaNumber", iaNumber);
        response.put("deletedCount", deletedCount);
        response.put("message", "Successfully reset " + (iaNumber == 0 ? "all IA" : "IA-" + iaNumber) + " marks (" + deletedCount + " records removed).");
        return response;
    }

    private boolean isUsn(String s) {
        if (s == null) return false;
        String str = s.trim().toUpperCase();
        if (str.isEmpty() || str.equals("USN") || str.equals("TOTAL") || str.equals("MAX") || str.equals("SL NO") || str.equals("STUDENT")) {
            return false;
        }
        if (USN_PATTERN.matcher(str).find()) return true;
        if (str.matches("^[0-9][A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{2,4}$")) return true;
        if (str.startsWith("1DB") && str.length() >= 7) return true;
        return false;
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================
    private Map<Integer, Double> calculateModuleMastery(int iaNumber, Map<String, Double> qMarks) {
        Map<Integer, Double> mastery = new HashMap<>();

        // Sub-question scores
        double m1a = qMarks.getOrDefault("1a", 0.0);
        double m1b = qMarks.getOrDefault("1b", 0.0);
        double m1c = qMarks.getOrDefault("1c", 0.0);
        double m2a = qMarks.getOrDefault("2a", 0.0);
        double m2b = qMarks.getOrDefault("2b", 0.0);
        double m2c = qMarks.getOrDefault("2c", 0.0);
        double m3a = qMarks.getOrDefault("3a", 0.0);
        double m3b = qMarks.getOrDefault("3b", 0.0);
        double m3c = qMarks.getOrDefault("3c", 0.0);
        double m4a = qMarks.getOrDefault("4a", 0.0);
        double m4b = qMarks.getOrDefault("4b", 0.0);
        double m4c = qMarks.getOrDefault("4c", 0.0);

        double part1Score = Math.max(m1a + m1b + m1c, m2a + m2b + m2c);
        double part2Score = Math.max(m3a + m3b + m3c, m4a + m4b + m4c);

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
            switch (cell.getCellType()) {
                case NUMERIC:
                    return cell.getNumericCellValue();
                case STRING:
                    String str = cell.getStringCellValue().trim();
                    if (str.isEmpty() || str.equals("-") || str.equalsIgnoreCase("ab") || str.equalsIgnoreCase("na")) {
                        return 0.0;
                    }
                    return Double.parseDouble(str);
                case FORMULA:
                    try {
                        return cell.getNumericCellValue();
                    } catch (Exception ignored) {
                        try {
                            String fStr = cell.getStringCellValue().trim();
                            if (!fStr.isEmpty() && !fStr.equals("-") && !fStr.equalsIgnoreCase("ab") && !fStr.equalsIgnoreCase("na")) {
                                return Double.parseDouble(fStr);
                            }
                        } catch (Exception ignored2) {}
                        DataFormatter formatter = new DataFormatter();
                        String formatted = formatter.formatCellValue(cell).trim();
                        if (!formatted.isEmpty() && !formatted.equals("-") && !formatted.equalsIgnoreCase("ab") && !formatted.equalsIgnoreCase("na")) {
                            return Double.parseDouble(formatted);
                        }
                    }
                    return 0.0;
                case BOOLEAN:
                    return cell.getBooleanCellValue() ? 1.0 : 0.0;
                default:
                    DataFormatter formatter = new DataFormatter();
                    String text = formatter.formatCellValue(cell).trim();
                    if (!text.isEmpty() && !text.equals("-") && !text.equalsIgnoreCase("ab") && !text.equalsIgnoreCase("na")) {
                        return Double.parseDouble(text);
                    }
                    return 0.0;
            }
        } catch (Exception e) {
            return 0.0;
        }
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
