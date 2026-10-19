package com.acadion.backend.controller;

import com.acadion.backend.dto.syllabus.*;
import com.acadion.backend.service.SyllabusAnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;

@RestController
@RequiredArgsConstructor
public class SyllabusAnalyticsController {

    private final SyllabusAnalyticsService analyticsService;

    /**
     * Retrieve classroom teaching coverage, hours, upcoming, and overdue schedule metrics.
     */
    @GetMapping("/api/classrooms/{classroomId}/syllabus/analytics/coverage")
    public ResponseEntity<SyllabusCoverageAnalyticsResponse> getClassroomCoverageAnalytics(
            @PathVariable("classroomId") String classroomId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        SyllabusCoverageAnalyticsResponse response = analyticsService.getClassroomCoverageAnalytics(classroomId, email);
        return ResponseEntity.ok(response);
    }

    /**
     * Retrieve teacher-facing aggregate of student revision and understanding self-reports across the active roster.
     */
    @GetMapping("/api/classrooms/{classroomId}/syllabus/analytics/revisions")
    public ResponseEntity<ClassroomRevisionAggregateResponse> getClassroomRevisionAggregate(
            @PathVariable("classroomId") String classroomId,
            @RequestParam(value = "versionId", required = false) String versionId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        ClassroomRevisionAggregateResponse response = analyticsService.getClassroomRevisionAggregate(classroomId, versionId, email);
        return ResponseEntity.ok(response);
    }

    /**
     * Retrieve assessment-backed evidence and performance metrics for a specific syllabus topic.
     */
    @GetMapping("/api/classrooms/{classroomId}/syllabus/topics/{topicId}/assessment-insights")
    public ResponseEntity<TopicAssessmentInsightResponse> getTopicAssessmentInsights(
            @PathVariable("classroomId") String classroomId,
            @PathVariable("topicId") String topicId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        TopicAssessmentInsightResponse response = analyticsService.getTopicAssessmentInsights(classroomId, topicId, email);
        return ResponseEntity.ok(response);
    }

    /**
     * Retrieve class-wide assessment-backed insights across all syllabus topics.
     */
    @GetMapping("/api/classrooms/{classroomId}/syllabus/analytics/assessment-insights")
    public ResponseEntity<ClassroomAssessmentInsightsResponse> getClassroomAssessmentInsights(
            @PathVariable("classroomId") String classroomId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        ClassroomAssessmentInsightsResponse response = analyticsService.getClassroomAssessmentInsights(classroomId, email);
        return ResponseEntity.ok(response);
    }

    /**
     * Retrieve cross-classroom syllabus overview for the authenticated teacher.
     */
    @GetMapping({"/api/syllabus/analytics/overview", "/api/classrooms/syllabus/overview"})
    public ResponseEntity<TeacherClassroomsOverviewResponse> getTeacherClassroomsOverview(
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        TeacherClassroomsOverviewResponse response = analyticsService.getTeacherClassroomsOverview(email);
        return ResponseEntity.ok(response);
    }

    private String getAuthenticatedEmail(Principal principal) {
        if (principal == null || principal.getName() == null || principal.getName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User authentication required");
        }
        return principal.getName();
    }
}
