package com.acadion.backend.repository;

import com.acadion.backend.entity.SyllabusVersion;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface SyllabusVersionRepository extends MongoRepository<SyllabusVersion, String> {

    List<SyllabusVersion> findByClassroomIdOrderByVersionNumberDesc(String classroomId);

    Optional<SyllabusVersion> findByClassroomIdAndVersionNumber(String classroomId, Integer versionNumber);

    Optional<SyllabusVersion> findByIdAndClassroomId(String id, String classroomId);

    Optional<SyllabusVersion> findTopByClassroomIdOrderByVersionNumberDesc(String classroomId);

    long countByClassroomId(String classroomId);

    boolean existsByClassroomIdAndVersionNumber(String classroomId, Integer versionNumber);

    void deleteByClassroomId(String classroomId);
}
