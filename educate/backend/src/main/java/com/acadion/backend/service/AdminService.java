package com.acadion.backend.service;

import com.acadion.backend.entity.Role;
import com.acadion.backend.entity.User;
import com.acadion.backend.mail.EmailSenderService;
import com.acadion.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AdminService {

    private final UserRepository userRepository;

    private final EmailSenderService emailSenderService;

    // PENDING USERS
    public List<User> getPendingUsers() {

        return userRepository
                .findByVerifiedTrueAndApprovedFalse();
    }

    // APPROVE USER
    public String approveUser(String email) {
        return approveUserWithSubjects(email, null);
    }

    // APPROVE USER WITH SUBJECT ALLOCATION
    public String approveUserWithSubjects(String email, List<String> assignedSubjects) {
        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            return "User not found";
        }

        user.setApproved(true);
        user.setRejected(false);
        user.setApprovedAt(LocalDateTime.now());

        if (assignedSubjects != null && !assignedSubjects.isEmpty()) {
            user.setAssignedSubjects(assignedSubjects);
        }

        userRepository.save(user);

        // SEND EMAIL
        emailSenderService.sendApprovalEmail(user.getEmail());

        return "User approved successfully";
    }

    // UPDATE TEACHER ASSIGNED SUBJECTS
    public String updateTeacherSubjects(String email, List<String> assignedSubjects) {
        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            return "Teacher not found";
        }

        user.setAssignedSubjects(assignedSubjects != null ? assignedSubjects : new java.util.ArrayList<>());
        userRepository.save(user);
        return "Teacher subjects updated successfully";
    }

    public User getTeacherByEmail(String email) {
        return userRepository.findByEmail(email).orElse(null);
    }

    public String rejectUser(
        String email
) {

    User user = userRepository
            .findByEmail(email)
            .orElse(null);

    if (user == null) {

        return "User not found";
    }

    // SET REJECT STATUS
    user.setRejected(true);

    // SAVE REJECT TIME
    user.setRejectedAt(
            LocalDateTime.now()
    );

    // SAVE REASON
    user.setRejectionReason(
            "Invalid or incomplete details"
    );

    // SEND REJECTION EMAIL
    emailSenderService.sendRejectEmail(
            user.getEmail()
    );

    // DELETE USER
    userRepository.delete(user);

    return "User rejected successfully";
}

    // GET STUDENTS
    public List<User> getStudents() {

        return userRepository
                .findByApprovedTrueAndRole(
                        Role.STUDENT
                );
    }

    // GET TEACHERS
    public List<User> getTeachers() {
        return userRepository.findByApprovedTrueAndRole(Role.TEACHER);
    }

    // EXPORT USERS TO EXCEL (.XLSX)
    public byte[] exportUsersToExcel(String roleStr, String statusStr) {
        try (org.apache.poi.xssf.usermodel.XSSFWorkbook workbook = new org.apache.poi.xssf.usermodel.XSSFWorkbook();
             java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream()) {

            boolean isTeacher = "TEACHER".equalsIgnoreCase(roleStr);
            boolean isPending = "PENDING".equalsIgnoreCase(statusStr);

            List<User> users;
            if (isPending) {
                List<User> allPending = userRepository.findByVerifiedTrueAndApprovedFalse();
                users = allPending.stream()
                        .filter(u -> isTeacher ? Role.TEACHER.equals(u.getRole()) : Role.STUDENT.equals(u.getRole()))
                        .toList();
            } else {
                users = isTeacher ? getTeachers() : getStudents();
            }

            String sheetName = (isPending ? "Pending " : "Approved ") + (isTeacher ? "Faculty" : "Students");
            org.apache.poi.ss.usermodel.Sheet sheet = workbook.createSheet(sheetName);

            // Title Row
            org.apache.poi.ss.usermodel.Row titleRow = sheet.createRow(0);
            org.apache.poi.ss.usermodel.Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("Acadion LMS - " + sheetName + " Report");

            org.apache.poi.ss.usermodel.CellStyle titleStyle = workbook.createCellStyle();
            org.apache.poi.ss.usermodel.Font titleFont = workbook.createFont();
            titleFont.setBold(true);
            titleFont.setFontHeightInPoints((short) 14);
            titleFont.setColor(org.apache.poi.ss.usermodel.IndexedColors.DARK_BLUE.getIndex());
            titleStyle.setFont(titleFont);
            titleCell.setCellStyle(titleStyle);

            // Header Style
            org.apache.poi.ss.usermodel.CellStyle headerStyle = workbook.createCellStyle();
            org.apache.poi.ss.usermodel.Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setColor(org.apache.poi.ss.usermodel.IndexedColors.WHITE.getIndex());
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(isTeacher 
                    ? org.apache.poi.ss.usermodel.IndexedColors.ROYAL_BLUE.getIndex() 
                    : org.apache.poi.ss.usermodel.IndexedColors.SEA_GREEN.getIndex());
            headerStyle.setFillPattern(org.apache.poi.ss.usermodel.FillPatternType.SOLID_FOREGROUND);
            headerStyle.setAlignment(org.apache.poi.ss.usermodel.HorizontalAlignment.CENTER);
            headerStyle.setBorderBottom(org.apache.poi.ss.usermodel.BorderStyle.THIN);
            headerStyle.setBorderTop(org.apache.poi.ss.usermodel.BorderStyle.THIN);
            headerStyle.setBorderLeft(org.apache.poi.ss.usermodel.BorderStyle.THIN);
            headerStyle.setBorderRight(org.apache.poi.ss.usermodel.BorderStyle.THIN);

            // Data Row Style
            org.apache.poi.ss.usermodel.CellStyle dataStyle = workbook.createCellStyle();
            dataStyle.setBorderBottom(org.apache.poi.ss.usermodel.BorderStyle.THIN);
            dataStyle.setBorderTop(org.apache.poi.ss.usermodel.BorderStyle.THIN);
            dataStyle.setBorderLeft(org.apache.poi.ss.usermodel.BorderStyle.THIN);
            dataStyle.setBorderRight(org.apache.poi.ss.usermodel.BorderStyle.THIN);

            // Headers
            String[] headers;
            if (isTeacher) {
                headers = new String[]{
                        "Sl No", "Faculty Name", "Email Address", "Employee ID",
                        "Designation", "Department", "Allocated Teaching Subjects",
                        "Approval Status", "Registration Date", "Approved Date"
                };
            } else {
                headers = new String[]{
                        "Sl No", "Student Name", "Email Address", "USN",
                        "Semester", "Department", "Approval Status",
                        "Registration Date", "Approved Date"
                };
            }

            org.apache.poi.ss.usermodel.Row headerRow = sheet.createRow(2);
            for (int i = 0; i < headers.length; i++) {
                org.apache.poi.ss.usermodel.Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            // Populate Rows
            int rowIdx = 3;
            int slNo = 1;
            java.time.format.DateTimeFormatter dtf = java.time.format.DateTimeFormatter.ofPattern("dd-MMM-yyyy HH:mm");

            for (User u : users) {
                org.apache.poi.ss.usermodel.Row row = sheet.createRow(rowIdx++);
                int col = 0;

                // Sl No
                org.apache.poi.ss.usermodel.Cell c0 = row.createCell(col++);
                c0.setCellValue(slNo++);
                c0.setCellStyle(dataStyle);

                // Name
                org.apache.poi.ss.usermodel.Cell c1 = row.createCell(col++);
                c1.setCellValue(u.getName() != null ? u.getName() : "N/A");
                c1.setCellStyle(dataStyle);

                // Email
                org.apache.poi.ss.usermodel.Cell c2 = row.createCell(col++);
                c2.setCellValue(u.getEmail() != null ? u.getEmail() : "N/A");
                c2.setCellStyle(dataStyle);

                if (isTeacher) {
                    // Employee ID
                    org.apache.poi.ss.usermodel.Cell c3 = row.createCell(col++);
                    c3.setCellValue(u.getEmployeeId() != null ? u.getEmployeeId() : "N/A");
                    c3.setCellStyle(dataStyle);

                    // Designation
                    org.apache.poi.ss.usermodel.Cell c4 = row.createCell(col++);
                    c4.setCellValue(u.getDesignation() != null ? u.getDesignation() : "Lecturer");
                    c4.setCellStyle(dataStyle);

                    // Department
                    org.apache.poi.ss.usermodel.Cell c5 = row.createCell(col++);
                    c5.setCellValue(u.getTeacherDepartment() != null ? u.getTeacherDepartment() : "N/A");
                    c5.setCellStyle(dataStyle);

                    // Allocated Subjects
                    org.apache.poi.ss.usermodel.Cell c6 = row.createCell(col++);
                    String subs = u.getAssignedSubjects() != null && !u.getAssignedSubjects().isEmpty()
                            ? String.join(", ", u.getAssignedSubjects())
                            : "None Allocated";
                    c6.setCellValue(subs);
                    c6.setCellStyle(dataStyle);
                } else {
                    // USN
                    org.apache.poi.ss.usermodel.Cell c3 = row.createCell(col++);
                    c3.setCellValue(u.getUsn() != null ? u.getUsn() : "N/A");
                    c3.setCellStyle(dataStyle);

                    // Semester
                    org.apache.poi.ss.usermodel.Cell c4 = row.createCell(col++);
                    c4.setCellValue(u.getSemester() != null ? "Semester " + u.getSemester() : "N/A");
                    c4.setCellStyle(dataStyle);

                    // Department
                    org.apache.poi.ss.usermodel.Cell c5 = row.createCell(col++);
                    c5.setCellValue(u.getStudentDepartment() != null ? u.getStudentDepartment() : "CSE");
                    c5.setCellStyle(dataStyle);
                }

                // Approval Status
                org.apache.poi.ss.usermodel.Cell cStatus = row.createCell(col++);
                cStatus.setCellValue(u.isApproved() ? "Approved" : "Pending Approval");
                cStatus.setCellStyle(dataStyle);

                // Registration Date
                org.apache.poi.ss.usermodel.Cell cReg = row.createCell(col++);
                cReg.setCellValue(u.getCreatedAt() != null ? u.getCreatedAt().format(dtf) : "N/A");
                cReg.setCellStyle(dataStyle);

                // Approved Date
                org.apache.poi.ss.usermodel.Cell cAppr = row.createCell(col++);
                cAppr.setCellValue(u.getApprovedAt() != null ? u.getApprovedAt().format(dtf) : (u.isApproved() ? "Approved" : "Pending"));
                cAppr.setCellStyle(dataStyle);
            }

            // Auto size columns
            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
                int currentWidth = sheet.getColumnWidth(i);
                sheet.setColumnWidth(i, Math.max(currentWidth + 1200, 3000));
            }

            workbook.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Failed to export Excel report: " + e.getMessage(), e);
        }
    }
}