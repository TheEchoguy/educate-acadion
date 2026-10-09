package com.acadion.backend.controller;

import com.acadion.backend.entity.User;
import com.acadion.backend.service.AdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;

    // PENDING USERS
    @GetMapping("/pending-users")
    public List<User> getPendingUsers() {

        return adminService.getPendingUsers();
    }

    // APPROVE USER
    @PostMapping("/approve")
    public String approveUser(
            @RequestParam String email
    ) {
        return adminService.approveUser(email);
    }

    // APPROVE TEACHER WITH SUBJECTS
    @PostMapping("/approve-teacher")
    public String approveTeacher(
            @RequestParam String email,
            @RequestBody(required = false) List<String> assignedSubjects
    ) {
        return adminService.approveUserWithSubjects(email, assignedSubjects);
    }

    // ASSIGN / UPDATE TEACHER SUBJECTS
    @PostMapping("/teacher/assign-subjects")
    public String assignTeacherSubjects(
            @RequestParam String email,
            @RequestBody List<String> assignedSubjects
    ) {
        return adminService.updateTeacherSubjects(email, assignedSubjects);
    }

    // REJECT USER
    @DeleteMapping("/reject")
    public String rejectUser(
            @RequestParam String email
    ) {

        return adminService.rejectUser(email);
    }

    // GET STUDENTS
    @GetMapping("/students")
    public List<User> getStudents() {

        return adminService.getStudents();
    }

    // GET TEACHERS
    @GetMapping("/teachers")
    public List<User> getTeachers() {
        return adminService.getTeachers();
    }

    // GET TEACHER PROFILE
    @GetMapping("/teacher-profile")
    public org.springframework.http.ResponseEntity<?> getTeacherProfile(@RequestParam String email) {
        User teacher = adminService.getTeacherByEmail(email);
        if (teacher == null) {
            return org.springframework.http.ResponseEntity.notFound().build();
        }
        return org.springframework.http.ResponseEntity.ok(teacher);
    }

    // EXPORT USERS TO EXCEL
    @GetMapping("/export-users")
    public org.springframework.http.ResponseEntity<byte[]> exportUsers(
            @RequestParam(defaultValue = "TEACHER") String role,
            @RequestParam(defaultValue = "APPROVED") String status
    ) {
        byte[] excelBytes = adminService.exportUsersToExcel(role, status);
        String filename = String.format("%s_%s_Report.xlsx",
                status.equalsIgnoreCase("PENDING") ? "Pending" : "Approved",
                role.equalsIgnoreCase("TEACHER") ? "Faculty" : "Students");

        return org.springframework.http.ResponseEntity.ok()
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + filename)
                .contentType(org.springframework.http.MediaType.APPLICATION_OCTET_STREAM)
                .body(excelBytes);
    }
}