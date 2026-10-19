package com.acadion.backend.repository.scheduling;

import com.acadion.backend.entity.scheduling.SchedulePlanStatus;
import com.acadion.backend.entity.scheduling.TeachingSchedulePlan;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TeachingSchedulePlanRepository extends MongoRepository<TeachingSchedulePlan, String> {

    List<TeachingSchedulePlan> findByClassroomIdOrderByVersionNumberDesc(String classroomId);

    Optional<TeachingSchedulePlan> findFirstByClassroomIdAndStatusOrderByVersionNumberDesc(
            String classroomId,
            SchedulePlanStatus status
    );

    Optional<TeachingSchedulePlan> findByClassroomIdAndVersionNumber(String classroomId, int versionNumber);
}
