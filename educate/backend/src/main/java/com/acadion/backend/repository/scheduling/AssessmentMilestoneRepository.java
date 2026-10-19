package com.acadion.backend.repository.scheduling;

import com.acadion.backend.entity.scheduling.AssessmentMilestone;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AssessmentMilestoneRepository extends MongoRepository<AssessmentMilestone, String> {

    List<AssessmentMilestone> findByClassroomId(String classroomId);

    List<AssessmentMilestone> findByClassroomIdAndApprovedTrueOrderByStartDateAsc(String classroomId);

    void deleteByClassroomId(String classroomId);
}
