package com.acadion.backend.repository.scheduling;

import com.acadion.backend.entity.scheduling.ScheduledSession;
import com.acadion.backend.entity.scheduling.SessionStatus;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface ScheduledSessionRepository extends MongoRepository<ScheduledSession, String> {

    List<ScheduledSession> findByPlanIdOrderBySessionDateAscSessionNumberAsc(String planId);

    List<ScheduledSession> findByClassroomIdAndPlanIdOrderBySessionDateAsc(String classroomId, String planId);

    List<ScheduledSession> findByPlanIdAndStatus(String planId, SessionStatus status);

    List<ScheduledSession> findByClassroomIdAndSessionDateBetweenOrderBySessionDateAsc(
            String classroomId,
            LocalDate startDate,
            LocalDate endDate
    );

    void deleteByPlanId(String planId);
}
