package com.acadion.backend.repository;

import com.acadion.backend.entity.ClassroomAnnouncement;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ClassroomAnnouncementRepository extends MongoRepository<ClassroomAnnouncement, String> {

    List<ClassroomAnnouncement> findByClassroomIdOrderByCreatedAtDesc(String classroomId);

}
