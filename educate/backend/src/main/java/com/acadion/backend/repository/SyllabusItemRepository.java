package com.acadion.backend.repository;

import com.acadion.backend.entity.SyllabusItem;
import com.acadion.backend.entity.SyllabusStatus;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface SyllabusItemRepository extends MongoRepository<SyllabusItem, String> {

    List<SyllabusItem> findByClassroomIdOrderByOrderIndexAscCreatedAtAsc(String classroomId);

    List<SyllabusItem> findByClassroomIdAndUnitOrderByOrderIndexAscCreatedAtAsc(String classroomId, String unit);

    Optional<SyllabusItem> findByIdAndClassroomId(String id, String classroomId);

    long countByClassroomId(String classroomId);

    long countByClassroomIdAndStatus(String classroomId, SyllabusStatus status);

    void deleteByClassroomId(String classroomId);

    boolean existsByIdAndClassroomId(String id, String classroomId);
}
