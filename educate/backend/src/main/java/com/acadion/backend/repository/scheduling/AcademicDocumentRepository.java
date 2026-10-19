package com.acadion.backend.repository.scheduling;

import com.acadion.backend.entity.scheduling.AcademicDocument;
import com.acadion.backend.entity.scheduling.AcademicDocumentType;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AcademicDocumentRepository extends MongoRepository<AcademicDocument, String> {

    List<AcademicDocument> findByClassroomId(String classroomId);

    List<AcademicDocument> findByClassroomIdAndDocumentType(String classroomId, AcademicDocumentType documentType);

    Optional<AcademicDocument> findByClassroomIdAndDocumentTypeAndModuleNumber(
            String classroomId,
            AcademicDocumentType documentType,
            Integer moduleNumber
    );

    Optional<AcademicDocument> findByClassroomIdAndContentHash(String classroomId, String contentHash);

    List<AcademicDocument> findByClassroomIdAndPublishedTrue(String classroomId);

    void deleteByClassroomId(String classroomId);
}
