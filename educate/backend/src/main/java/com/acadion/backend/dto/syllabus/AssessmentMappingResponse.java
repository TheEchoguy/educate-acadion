package com.acadion.backend.dto.syllabus;

import com.acadion.backend.entity.MappingSource;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AssessmentMappingResponse {

    private String id;
    private String classroomId;
    private String syllabusTopicId;
    private String paperId;
    private String questionId;
    private String assessmentTitle;
    private String subject;
    private String subjectCode;
    private String matchedTopicLabel;
    private MappingSource mappingSource;
    private boolean confirmed;
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
