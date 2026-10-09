package com.acadion.backend.controller;

import com.acadion.backend.entity.Role;
import com.acadion.backend.entity.User;
import com.acadion.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/students")
@RequiredArgsConstructor
public class ClassmateController {

    private final UserRepository userRepository;

    @GetMapping("/classmates")
    public ResponseEntity<?> getClassmates(
            @RequestParam(required = false) String semester,
            @RequestParam(required = false) String excludeUsn
    ) {
        List<User> students = userRepository.findByApprovedTrueAndRole(Role.STUDENT);

        List<Map<String, Object>> classmates = students.stream()
                .filter(s -> {
                    if (excludeUsn != null && s.getUsn() != null && s.getUsn().equalsIgnoreCase(excludeUsn.trim())) {
                        return false;
                    }
                    if (semester != null && !semester.trim().isEmpty() && !semester.equalsIgnoreCase("ALL")) {
                        try {
                            int targetSem = Integer.parseInt(semester.replaceAll("\\D+", ""));
                            if (s.getSemester() != null && s.getSemester() != targetSem) {
                                return false;
                            }
                        } catch (Exception ignored) {}
                    }
                    return true;
                })
                .map(s -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", s.getId());
                    map.put("name", s.getName());
                    map.put("usn", s.getUsn());
                    map.put("email", s.getEmail());
                    map.put("semester", s.getSemester());
                    map.put("department", s.getStudentDepartment());
                    return map;
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(classmates);
    }
}
