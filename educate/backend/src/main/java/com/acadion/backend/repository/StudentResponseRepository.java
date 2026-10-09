package com.acadion.backend.repository;

import com.acadion.backend.entity.StudentResponse;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface StudentResponseRepository
        extends MongoRepository<StudentResponse, String> {

    boolean existsByUsnAndPaperId(
            String usn,
            String paperId
    );

    List<StudentResponse> findByPaperId(
            String paperId
    );

    List<StudentResponse>
    findByUsnOrderBySubmittedAtAsc(
            String usn
    );

    List<StudentResponse>
    findByUsnAndPaperId(
            String usn,
            String paperId
    );
}