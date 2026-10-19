package com.acadion.backend.repository.scheduling;

import com.acadion.backend.entity.scheduling.TimetableSlot;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TimetableSlotRepository extends MongoRepository<TimetableSlot, String> {

    List<TimetableSlot> findByClassroomId(String classroomId);

    List<TimetableSlot> findByClassroomIdAndApprovedTrue(String classroomId);

    void deleteByClassroomId(String classroomId);
}
