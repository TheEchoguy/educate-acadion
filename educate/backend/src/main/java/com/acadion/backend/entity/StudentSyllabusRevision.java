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
@Document(collection = "student_syllabus_revisions")
@CompoundIndexes({
        @CompoundIndex(name = "student_topic_version_unique_idx",
                def = "{'studentId': 1, 'classroomId': 1, 'topicId': 1, 'publishedVersionId': 1}",
                unique = true),
        @CompoundIndex(name = "student_classroom_version_idx",
                def = "{'studentId': 1, 'classroomId': 1, 'publishedVersionId': 1}")
})
public class StudentSyllabusRevision {

    @Id
    private String id;

    @Indexed
    private String classroomId;

    @Indexed
    private String studentId;

    @Indexed
    private String topicId;

    @Indexed
    private String publishedVersionId;

    @Builder.Default
    private RevisionStatus revisionStatus = RevisionStatus.NOT_STARTED;

    @Builder.Default
    private UnderstandingStatus understandingStatus = UnderstandingStatus.NOT_ASSESSED;

    private LocalDateTime lastRevisedAt;

    private String personalNotes;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
