package com.acadion.backend.repository;

import com.acadion.backend.entity.SyllabusAuditEvent;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface SyllabusAuditEventRepository extends MongoRepository<SyllabusAuditEvent, String> {

    List<SyllabusAuditEvent> findByClassroomIdOrderByTimestampDesc(String classroomId);

    List<SyllabusAuditEvent> findByClassroomIdAndSyllabusTopicIdOrderByTimestampDesc(
            String classroomId, String syllabusTopicId);

    void deleteByClassroomId(String classroomId);
}
