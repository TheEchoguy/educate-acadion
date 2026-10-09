package com.acadion.backend.dto;

import com.acadion.backend.entity.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class RegisterRequest {

    @NotBlank(message = "Name is required")
    private String name;

    @Email(message = "Invalid email")
    @NotBlank(message = "Email is required")
    private String email;

    @NotBlank(message = "Password is required")
    private String password;

    // STUDENT or TEACHER
    private Role role;

    // STUDENT fields
    private String usn;

    private Integer semester;

    private String studentDepartment;

    // TEACHER fields
    private String employeeId;

    private String designation;

    private String teacherDepartment;
}