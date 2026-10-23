package com.acadion.backend.dto.classroom;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateClassroomRequest {

    @NotBlank(message = "Classroom name is required")
    private String name;

    private String courseCode;

    private String subjectName;

    private String subjectCode;

    private String department;

    @NotNull(message = "Semester is required")
    private Integer semester;

    @NotBlank(message = "Section is required")
    private String section;

    private String academicBatch;

    private String academicYear;

    public String getEffectiveCourseCode() {
        if (courseCode != null && !courseCode.isBlank()) return courseCode.trim().toUpperCase();
        if (subjectCode != null && !subjectCode.isBlank()) return subjectCode.trim().toUpperCase();
        String text = ((name != null ? name : "") + " " + (subjectName != null ? subjectName : "")).toLowerCase();
        if (text.contains("energy") || text.contains("ec&a") || text.contains("audit")) {
            return "BEE755B";
        }
        if (text.contains("internet") || text.contains("iot")) {
            return "BCS701";
        }
        return "COURSE";
    }

    public String getEffectiveSubjectName() {
        if (subjectName != null && !subjectName.isBlank()) return subjectName.trim();
        return name != null ? name.trim() : "Academic Subject";
    }

    public String getEffectiveDepartment() {
        return department != null && !department.isBlank() ? department.trim() : "Computer Science & Engineering";
    }

    public String getEffectiveAcademicBatch() {
        return academicBatch != null && !academicBatch.isBlank() ? academicBatch.trim() : "2022-2026";
    }

    public String getEffectiveAcademicYear() {
        return academicYear != null && !academicYear.isBlank() ? academicYear.trim() : "2025-2026";
    }
}
