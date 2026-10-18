package com.acadion.backend.repository.scheduling;

import com.acadion.backend.entity.scheduling.AcademicCalendarEvent;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AcademicCalendarEventRepository extends MongoRepository<AcademicCalendarEvent, String> {

    List<AcademicCalendarEvent> findByClassroomId(String classroomId);

    List<AcademicCalendarEvent> findByClassroomIdAndApprovedTrue(String classroomId);

    void deleteByClassroomId(String classroomId);
}
