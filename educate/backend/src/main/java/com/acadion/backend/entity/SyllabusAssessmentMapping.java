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
@Document(collection = "syllabus_assessment_mappings")
@CompoundIndexes({
        @CompoundIndex(name = "classroom_topic_paper_q_unique_idx",
                def = "{'classroomId': 1, 'syllabusTopicId': 1, 'paperId': 1, 'questionId': 1}",
                unique = true),
        @CompoundIndex(name = "classroom_topic_idx",
                def = "{'classroomId': 1, 'syllabusTopicId': 1}")
})
public class SyllabusAssessmentMapping {

    @Id
    private String id;

    @Indexed
    private String classroomId;

    @Indexed
    private String syllabusTopicId;

    @Indexed
    private String paperId;

    private String questionId;

    private String assessmentTitle;

    private String subject;

    private String subjectCode;

    private String matchedTopicLabel;

    @Builder.Default
    private MappingSource mappingSource = MappingSource.MANUAL;

    @Builder.Default
    private boolean confirmed = true;

    private String createdBy;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
