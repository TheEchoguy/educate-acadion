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
public class ClassroomMemberDto {

    private String id;
    private String membershipId;
    private String classroomId;
    private String studentId;
    private String studentName;
    private String studentEmail;
    private String usn;
    private String role;
    private String status;
    private String membershipStatus;
    private String membershipSource;
    private String academicYear;
    private Integer semester;
    private LocalDateTime requestedAt;
    private LocalDateTime approvedAt;
    private LocalDateTime joinedAt;
    private LocalDateTime createdAt;
    @Builder.Default
    private boolean verifiedInDb = true;
}
