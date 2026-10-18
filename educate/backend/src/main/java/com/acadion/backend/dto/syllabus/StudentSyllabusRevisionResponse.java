package com.acadion.backend.dto.syllabus;

import com.acadion.backend.entity.RevisionStatus;
import com.acadion.backend.entity.UnderstandingStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentSyllabusRevisionResponse {

    private String id;
    private String classroomId;
    private String studentId;
    private String topicId;
    private String publishedVersionId;
    private RevisionStatus revisionStatus;
    private UnderstandingStatus understandingStatus;
    private LocalDateTime lastRevisedAt;
    private String personalNotes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
