package com.acadion.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProfileUpdateRequest {
    private String email;
    private String name;
    private String phone;
    private String bio;
    private String collegeName;
    private String profilePicture;

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
}
