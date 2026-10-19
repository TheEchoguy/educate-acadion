package com.acadion.backend.dto.classroom;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateClassroomRequest {

    private String name;

    private String courseCode;

    private String subjectName;

    private String subjectCode;

    private String department;

    private Integer semester;

    private String section;

    private String academicBatch;

    private String academicYear;

    private String status;

    private Boolean joinCodeEnabled;
}
