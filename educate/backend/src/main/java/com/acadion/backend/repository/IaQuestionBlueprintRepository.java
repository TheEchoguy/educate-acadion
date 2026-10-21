package com.acadion.backend.repository;

import com.acadion.backend.entity.IaQuestionBlueprint;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface IaQuestionBlueprintRepository extends MongoRepository<IaQuestionBlueprint, String> {

    Optional<IaQuestionBlueprint> findByClassroomIdAndIaNumber(String classroomId, int iaNumber);

    List<IaQuestionBlueprint> findByClassroomId(String classroomId);
}
