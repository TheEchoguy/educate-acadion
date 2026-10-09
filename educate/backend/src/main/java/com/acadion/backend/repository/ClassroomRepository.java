package com.acadion.backend.repository;

import com.acadion.backend.entity.Classroom;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface ClassroomRepository extends MongoRepository<Classroom, String> {

    List<Classroom> findByTeacherIdOrderByCreatedAtDesc(String teacherId);

    Optional<Classroom> findByJoinCodeHash(String joinCodeHash);

    List<Classroom> findByDepartmentAndSemesterAndStatus(String department, Integer semester, String status);
}
