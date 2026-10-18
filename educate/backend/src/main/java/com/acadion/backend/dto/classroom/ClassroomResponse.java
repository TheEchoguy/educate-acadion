package com.acadion.backend.dto.classroom;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClassroomResponse {

    private String id;
    private String name;
    private String courseCode;
    private String subjectName;
    private String subjectCode;
    private String teacherId;
    private String teacherName;
    private String department;
    private Integer semester;
    private String section;
    private String academicBatch;
    private String academicYear;
    private String connectionMode;
    private String status;

    /**
     * Plain join code is ONLY provided to the owning teacher. Never returned to unauthorized users.
     */
    private String joinCode;
    private boolean joinCodeEnabled;
    private LocalDateTime joinCodeExpiresAt;

    private long activeMemberCount;
    private long pendingRequestCount;

    // Student specific context if requested by a student
    private String studentMembershipStatus;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
