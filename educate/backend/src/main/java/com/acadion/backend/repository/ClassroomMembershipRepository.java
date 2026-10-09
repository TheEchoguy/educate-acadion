package com.acadion.backend.repository;

import com.acadion.backend.entity.ClassroomMembership;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface ClassroomMembershipRepository extends MongoRepository<ClassroomMembership, String> {

    Optional<ClassroomMembership> findByClassroomIdAndStudentId(String classroomId, String studentId);

    List<ClassroomMembership> findByClassroomId(String classroomId);

    List<ClassroomMembership> findByClassroomIdAndMembershipStatus(String classroomId, String membershipStatus);

    List<ClassroomMembership> findByStudentId(String studentId);

    List<ClassroomMembership> findByStudentIdAndMembershipStatus(String studentId, String membershipStatus);

    long countByClassroomIdAndMembershipStatus(String classroomId, String membershipStatus);

    boolean existsByClassroomIdAndStudentId(String classroomId, String studentId);

    void deleteByClassroomId(String classroomId);
}
