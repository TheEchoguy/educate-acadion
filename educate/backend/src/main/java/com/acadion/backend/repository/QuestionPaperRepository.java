package com.acadion.backend.repository;

import com.acadion.backend.entity.QuestionPaper;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface QuestionPaperRepository extends MongoRepository<QuestionPaper, String> {

    Optional<QuestionPaper> findFirstByPaperIdOrderByUploadedAtDesc(String paperId);

    Optional<QuestionPaper> findFirstByPaperIdIgnoreCaseOrderByUploadedAtDesc(String paperId);

    Optional<QuestionPaper> findFirstBySubjectCodeIgnoreCaseOrderByUploadedAtDesc(String subjectCode);

    Optional<QuestionPaper> findFirstBySubjectIgnoreCaseOrderByUploadedAtDesc(String subject);

    List<QuestionPaper> findAllByPaperId(String paperId);

    List<QuestionPaper> findAllBySubjectCodeIgnoreCase(String subjectCode);

    void deleteByPaperId(String paperId);

    List<QuestionPaper> findByCreatedByIgnoreCase(String createdBy);

    boolean existsByPaperId(String paperId);
}
