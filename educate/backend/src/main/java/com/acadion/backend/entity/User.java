package com.acadion.backend.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "users")
public class User {

    @Id
    private String id;

    private String name;

    private String email;

    private String password;

    private Role role;

    private boolean verified;
private boolean approved;
    private boolean banned;

    // OTP
    private String otp;

    private LocalDateTime otpExpiry;

    // Student Details
    @org.springframework.data.mongodb.core.index.Indexed
    private String usn;

    private Integer semester;

    private String studentDepartment;

    // Teacher Details
    private String employeeId;

    private String designation;

    private String teacherDepartment;

    @Builder.Default
    private java.util.List<String> assignedSubjects = new java.util.ArrayList<>();

    // General Profile & Contact Fields (Optional, editable after login)
    private String profilePicture;
    private String phone;
    private String bio;
    private String collegeName;

    // Teacher Specific Profile Fields
    private String qualification;
    private String experienceYears;
    private String cabinRoom;

    // Student Specific Profile Fields
    private String academicBatch;

    private LocalDateTime createdAt;
    private LocalDateTime approvedAt;

    private LocalDateTime rejectedAt;

    private String rejectionReason;

    private boolean rejected;

}