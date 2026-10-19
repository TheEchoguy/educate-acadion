package com.acadion.backend.controller;

import com.acadion.backend.entity.SubjectEvaluationScheme;
import com.acadion.backend.service.SubjectEvaluationSchemeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/classrooms/{classroomId}/evaluation-scheme")
@RequiredArgsConstructor
public class SubjectEvaluationSchemeController {

    private final SubjectEvaluationSchemeService schemeService;

    @GetMapping
    public ResponseEntity<SubjectEvaluationScheme> getScheme(
            @PathVariable("classroomId") String classroomId
    ) {
        SubjectEvaluationScheme scheme = schemeService.getOrCreateScheme(classroomId);
        return ResponseEntity.ok(scheme);
    }

    @PutMapping
    public ResponseEntity<SubjectEvaluationScheme> updateScheme(
            @PathVariable("classroomId") String classroomId,
            @RequestBody SubjectEvaluationScheme request
    ) {
        SubjectEvaluationScheme updated = schemeService.updateScheme(classroomId, request);
        return ResponseEntity.ok(updated);
    }
}
