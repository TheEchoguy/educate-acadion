package com.acadion.backend.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "classroom_memberships")
@CompoundIndexes({
    @CompoundIndex(name = "classroom_student_unique_idx", def = "{'classroomId': 1, 'studentId': 1}", unique = true)
})
public class ClassroomMembership {

    @Id
    private String id;

    @Indexed
    private String classroomId;

    @Indexed
    private String studentId;

    /**
     * Historical / debugging snapshot only. The primary relationship is studentId.
     */
    private String usnSnapshot;

    /**
     * Source: ROSTER, JOIN_CODE, ADMIN (future-ready)
     */
    private String membershipSource;

    /**
     * Status: PENDING, ACTIVE, REJECTED, REMOVED
     */
    @Builder.Default
    private String membershipStatus = "PENDING";

    private LocalDateTime requestedAt;

    private LocalDateTime approvedAt;

    private String approvedBy;

    private String academicYear;

    private Integer semester;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
