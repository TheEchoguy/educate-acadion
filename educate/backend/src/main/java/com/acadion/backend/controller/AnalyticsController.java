package com.acadion.backend.controller;

import com.acadion.backend.service.AnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    @GetMapping("/paper/{paperId}")
    public ResponseEntity<?> paperAnalytics(@PathVariable String paperId) {
        try {
            return ResponseEntity.ok(analyticsService.paperAnalytics(paperId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Analytics Failed: " + e.getMessage());
        }
    }

    @GetMapping("/student/{studentId}")
    public ResponseEntity<?> studentTrend(@PathVariable String studentId) {
        try {
            return ResponseEntity.ok(analyticsService.studentTrend(studentId));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Student Trend Failed: " + e.getMessage());
        }
    }
}
