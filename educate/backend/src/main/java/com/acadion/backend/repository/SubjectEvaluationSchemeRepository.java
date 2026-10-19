package com.acadion.backend.repository;

import com.acadion.backend.entity.SubjectEvaluationScheme;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface SubjectEvaluationSchemeRepository extends MongoRepository<SubjectEvaluationScheme, String> {

    Optional<SubjectEvaluationScheme> findByClassroomId(String classroomId);

    boolean existsByClassroomId(String classroomId);
}
