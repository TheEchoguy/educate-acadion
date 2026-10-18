package com.acadion.backend.repository;

import com.acadion.backend.entity.RevisionStatus;
import com.acadion.backend.entity.StudentSyllabusRevision;
import com.acadion.backend.entity.UnderstandingStatus;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface StudentSyllabusRevisionRepository extends MongoRepository<StudentSyllabusRevision, String> {

    Optional<StudentSyllabusRevision> findByStudentIdAndClassroomIdAndTopicIdAndPublishedVersionId(
            String studentId, String classroomId, String topicId, String publishedVersionId);

    List<StudentSyllabusRevision> findByStudentIdAndClassroomIdAndPublishedVersionId(
            String studentId, String classroomId, String publishedVersionId);

    List<StudentSyllabusRevision> findByStudentIdAndClassroomIdAndTopicIdOrderByCreatedAtAsc(
            String studentId, String classroomId, String topicId);

    long countByStudentIdAndClassroomIdAndPublishedVersionIdAndRevisionStatus(
            String studentId, String classroomId, String publishedVersionId, RevisionStatus revisionStatus);

    long countByStudentIdAndClassroomIdAndPublishedVersionIdAndUnderstandingStatus(
            String studentId, String classroomId, String publishedVersionId, UnderstandingStatus understandingStatus);

    long countByStudentIdAndClassroomIdAndPublishedVersionId(
            String studentId, String classroomId, String publishedVersionId);

    List<StudentSyllabusRevision> findByClassroomIdAndPublishedVersionId(
            String classroomId, String publishedVersionId);

    long countByClassroomIdAndPublishedVersionIdAndRevisionStatus(
            String classroomId, String publishedVersionId, RevisionStatus revisionStatus);

    long countByClassroomIdAndPublishedVersionIdAndUnderstandingStatus(
            String classroomId, String publishedVersionId, UnderstandingStatus understandingStatus);

    long countByClassroomIdAndPublishedVersionId(
            String classroomId, String publishedVersionId);

    void deleteByClassroomId(String classroomId);
}
