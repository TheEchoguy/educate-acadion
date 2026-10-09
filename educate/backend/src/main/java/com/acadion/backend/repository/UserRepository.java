package com.acadion.backend.repository;

import com.acadion.backend.entity.Role;
import com.acadion.backend.entity.User;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository
        extends MongoRepository<User, String> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    // Pending Users
    List<User> findByVerifiedTrueAndApprovedFalse();

    // Approved Students
    List<User> findByApprovedTrueAndRole(
            Role role
    );

    Optional<User> findByUsn(String usn);

    List<User> findBySemester(Integer semester);
}