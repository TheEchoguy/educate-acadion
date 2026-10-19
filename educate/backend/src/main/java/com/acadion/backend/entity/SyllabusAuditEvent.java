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
import java.util.HashMap;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "syllabus_audit_events")
@CompoundIndexes({
        @CompoundIndex(name = "classroom_timestamp_idx", def = "{'classroomId': 1, 'timestamp': -1}"),
        @CompoundIndex(name = "classroom_topic_timestamp_idx", def = "{'classroomId': 1, 'syllabusTopicId': 1, 'timestamp': -1}")
})
public class SyllabusAuditEvent {

    @Id
    private String id;

    @Indexed
    private String classroomId;

    private String syllabusTopicId;

    private String versionId;

    private String mappingId;

    private String actorUserId;

    private String actorEmail;

    private Role actorRole;

    private SyllabusAuditEventType eventType;

    private LocalDateTime timestamp;

    private String description;

    @Builder.Default
    private Map<String, Object> metadata = new HashMap<>();
}
