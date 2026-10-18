package com.acadion.backend.repository;

import com.acadion.backend.entity.SyllabusAssessmentMapping;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface SyllabusAssessmentMappingRepository extends MongoRepository<SyllabusAssessmentMapping, String> {

    List<SyllabusAssessmentMapping> findByClassroomIdAndSyllabusTopicId(String classroomId, String syllabusTopicId);

    List<SyllabusAssessmentMapping> findByClassroomId(String classroomId);

    List<SyllabusAssessmentMapping> findByClassroomIdAndPaperId(String classroomId, String paperId);

    Optional<SyllabusAssessmentMapping> findByClassroomIdAndSyllabusTopicIdAndPaperIdAndQuestionId(
            String classroomId, String syllabusTopicId, String paperId, String questionId);

    Optional<SyllabusAssessmentMapping> findByIdAndClassroomId(String id, String classroomId);

    boolean existsByClassroomIdAndSyllabusTopicIdAndPaperIdAndQuestionId(
            String classroomId, String syllabusTopicId, String paperId, String questionId);

    void deleteByClassroomIdAndSyllabusTopicId(String classroomId, String syllabusTopicId);

    void deleteByClassroomId(String classroomId);
}
