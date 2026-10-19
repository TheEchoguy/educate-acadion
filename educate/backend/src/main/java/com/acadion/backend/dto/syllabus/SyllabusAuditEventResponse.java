package com.acadion.backend.dto.syllabus;

import com.acadion.backend.entity.Role;
import com.acadion.backend.entity.SyllabusAuditEventType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SyllabusAuditEventResponse {

    private String id;
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
    private Map<String, Object> metadata;
}
