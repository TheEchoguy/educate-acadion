package com.acadion.backend.repository.scheduling;

import com.acadion.backend.entity.scheduling.ClassroomModuleOutline;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ClassroomModuleOutlineRepository extends MongoRepository<ClassroomModuleOutline, String> {

    List<ClassroomModuleOutline> findByClassroomIdOrderByModuleNumberAsc(String classroomId);

    Optional<ClassroomModuleOutline> findByClassroomIdAndModuleNumber(String classroomId, int moduleNumber);

    void deleteByClassroomId(String classroomId);
}
