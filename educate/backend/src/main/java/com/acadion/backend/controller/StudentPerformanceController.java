package com.acadion.backend.controller;

import com.acadion.backend.dto.intelligence.StudentAllCoursesPerformanceResponse;
import com.acadion.backend.service.StudentPerformanceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;

@Slf4j
@RestController
@RequestMapping("/api/student/performance")
@RequiredArgsConstructor
public class StudentPerformanceController {

    private final StudentPerformanceService studentPerformanceService;

    /**
     * Route A: Global Semester Report across all enrolled courses for authenticated student.
     * Fetches all enrolled courses, overall semester trajectory, combined credit GPA projection,
     * and cross-subject topic mastery comparisons.
     */
    @GetMapping("/all-courses")
    public ResponseEntity<StudentAllCoursesPerformanceResponse> getAllCoursesPerformance(
            @AuthenticationPrincipal UserDetails userDetails,
            Principal principal
    ) {
        String studentEmail = userDetails != null ? userDetails.getUsername() : (principal != null ? principal.getName() : null);
        if (studentEmail == null || studentEmail.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated");
        }

        StudentAllCoursesPerformanceResponse response = studentPerformanceService.getAllCoursesPerformance(studentEmail);
        return ResponseEntity.ok(response);
    }

    /**
     * Dedicated Semester-Wide Published Marks Ledger:
     * Endpoint: GET /api/student/performance/all-published-marks
     * Returns strictly published IA marks (isPublished == true) across all enrolled courses.
     */
    @GetMapping({"/all-published-marks", "/published-marks"})
    public ResponseEntity<com.acadion.backend.dto.intelligence.StudentPublishedMarksSemesterResponse> getAllPublishedMarks(
            @AuthenticationPrincipal UserDetails userDetails,
            Principal principal
    ) {
        String studentEmail = userDetails != null ? userDetails.getUsername() : (principal != null ? principal.getName() : null);
        if (studentEmail == null || studentEmail.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated");
        }

        com.acadion.backend.dto.intelligence.StudentPublishedMarksSemesterResponse response =
                studentPerformanceService.getAllPublishedMarks(studentEmail);
        return ResponseEntity.ok(response);
    }
}
