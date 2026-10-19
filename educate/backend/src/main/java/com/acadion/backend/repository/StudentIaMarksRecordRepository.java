package com.acadion.backend.repository;

import com.acadion.backend.entity.StudentIaMarksRecord;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface StudentIaMarksRecordRepository extends MongoRepository<StudentIaMarksRecord, String> {

    Optional<StudentIaMarksRecord> findByClassroomIdAndUsnIgnoreCaseAndIaNumber(String classroomId, String usn, int iaNumber);

    Optional<StudentIaMarksRecord> findFirstByClassroomIdAndUsnIgnoreCaseAndIaNumber(String classroomId, String usn, int iaNumber);

    List<StudentIaMarksRecord> findByClassroomIdAndUsnIgnoreCase(String classroomId, String usn);

    List<StudentIaMarksRecord> findByClassroomIdAndIaNumber(String classroomId, int iaNumber);

    List<StudentIaMarksRecord> findByClassroomId(String classroomId);
}
