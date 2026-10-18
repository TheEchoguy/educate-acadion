package com.acadion.backend.repository.scheduling;

import com.acadion.backend.entity.scheduling.RescheduleRecord;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RescheduleRecordRepository extends MongoRepository<RescheduleRecord, String> {

    List<RescheduleRecord> findByClassroomIdOrderByRescheduledAtDesc(String classroomId);

    List<RescheduleRecord> findByPlanIdOrderByRescheduledAtDesc(String planId);
}
