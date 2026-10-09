package com.acadion.backend.repository;

import com.acadion.backend.entity.QuestionPaper;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface QuestionPaperRepository extends MongoRepository<QuestionPaper, String> {

    Optional<QuestionPaper> findFirstByPaperIdOrderByUploadedAtDesc(String paperId);

    List<QuestionPaper> findAllByPaperId(String paperId);

    void deleteByPaperId(String paperId);

    boolean existsByPaperId(String paperId);
}
