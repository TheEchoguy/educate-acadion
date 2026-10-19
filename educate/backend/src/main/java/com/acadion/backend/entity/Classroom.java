package com.acadion.backend.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "classrooms")
public class Classroom {

    @Id
    private String id;

    private String name;

    private String courseCode;

    private String subjectName;

    private String subjectCode;

    private String teacherId;

    private String department;

    private Integer semester;

    private String section;

    private String academicBatch;

    private String academicYear;

    /**
     * Connection mode: TEACHER_PROVISIONED, STUDENT_REQUEST, ADMIN (future-ready)
     */
    @Builder.Default
    private String connectionMode = "TEACHER_PROVISIONED";

    /**
     * Plain join code persistent across page reloads and sessions.
     * Exposed only to authorized classroom owners (teachers/admin).
     */
    private String joinCode;

    private String joinCodeHash;

    @Builder.Default
    private boolean joinCodeEnabled = true;

    private LocalDateTime joinCodeCreatedAt;

    private LocalDateTime joinCodeExpiresAt;

    /**
     * List of enrolled student IDs
     */
    @Builder.Default
    private List<String> studentIds = new ArrayList<>();

    /**
     * Enrolled student snapshot detail list
     */
    @Builder.Default
    private List<EnrolledStudent> enrolledStudents = new ArrayList<>();

    /**
     * Status: ACTIVE, INACTIVE, ARCHIVED
     */
    @Builder.Default
    private String status = "ACTIVE";

    @Builder.Default
    private boolean schedulingInputsVerified = false;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    public boolean isSchedulingInputsVerified() {
        return schedulingInputsVerified;
    }

    public void setSchedulingInputsVerified(boolean schedulingInputsVerified) {
        this.schedulingInputsVerified = schedulingInputsVerified;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EnrolledStudent {
        private String studentId;
        private String usn;
        private String name;
        private String email;
        private LocalDateTime joinedAt;
        @Builder.Default
        private String status = "ENROLLED";
        @Builder.Default
        private boolean verifiedInDb = true;
    }
}

