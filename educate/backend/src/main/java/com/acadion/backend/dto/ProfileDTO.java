package com.acadion.backend.dto;

import com.acadion.backend.entity.Role;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProfileDTO {
    private String id;
    private String name;
    private String email;
    private Role role;
    private boolean verified;
    private boolean approved;

    private String profilePicture;
    private String phone;
    private String bio;
    private String collegeName;

    // Student fields
    private String usn;
    private Integer semester;
    private String studentDepartment;
    private String academicBatch;

    // Teacher fields
    private String employeeId;
    private String designation;
    private String teacherDepartment;
    private String qualification;
    private String experienceYears;
    private String cabinRoom;

    @Builder.Default
    private List<String> assignedSubjects = new ArrayList<>();

    private LocalDateTime createdAt;

    // Computed Stats
    // Student stats
    private Integer examsAttended;
    private Integer practiceAttempts;
    private Double averageScore;
    private String riskLevel;

    // Teacher stats
    private Integer papersCreated;
    private Integer papersEvaluated;
    private Integer totalStudentsEnrolled;
}
