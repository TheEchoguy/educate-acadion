package com.acadion.backend.service;

import com.acadion.backend.entity.Classroom;
import com.acadion.backend.entity.SubjectEvaluationScheme;
import com.acadion.backend.repository.ClassroomRepository;
import com.acadion.backend.repository.SubjectEvaluationSchemeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Slf4j
@Service
@RequiredArgsConstructor
public class SubjectEvaluationSchemeService {

    private final SubjectEvaluationSchemeRepository schemeRepository;
    private final ClassroomRepository classroomRepository;

    public SubjectEvaluationScheme getOrCreateScheme(String classroomId) {
        return schemeRepository.findByClassroomId(classroomId)
                .orElseGet(() -> initializeDefaultScheme(classroomId));
    }

    private SubjectEvaluationScheme initializeDefaultScheme(String classroomId) {
        Classroom classroom = classroomRepository.findById(classroomId).orElse(null);

        String courseCode = "BCS701";
        String courseName = "Internet of Things";
        int semester = 7;

        if (classroom != null) {
            if (classroom.getSubjectCode() != null && !classroom.getSubjectCode().isBlank()) {
                courseCode = classroom.getSubjectCode();
            } else if (classroom.getCourseCode() != null && !classroom.getCourseCode().isBlank()) {
                courseCode = classroom.getCourseCode();
            }

            if (classroom.getSubjectName() != null && !classroom.getSubjectName().isBlank()) {
                courseName = classroom.getSubjectName();
            }

            if (classroom.getSemester() != null) {
                semester = classroom.getSemester();
            }
        }

        SubjectEvaluationScheme defaultScheme = SubjectEvaluationScheme.builder()
                .classroomId(classroomId)
                .courseCode(courseCode)
                .courseName(courseName)
                .semester(semester)
                .isLabIntegrated(true)
                .iaCount(3)
                .iaRawMaxMarks(40.0)
                .iaScaledMaxMarks(15.0)
                .iaCalculationRule("AVERAGE_ALL")
                .assignmentRawMaxMarks(25.0)
                .assignmentScaledMaxMarks(10.0)
                .labRecordScaledMarks(15.0)
                .labTestRawMarks(50.0)
                .labTestScaledMarks(10.0)
                .cieTotalMaxMarks(50.0)
                .cieMinPassingMarks(20.0)
                .seeRawMaxMarks(100.0)
                .seeScaledMaxMarks(50.0)
                .seeMinPassingMarks(18.0)
                .totalPassMinMarks(40.0)
                .updatedAt(Instant.now())
                .build();

        log.info("Initialized default VTU IPCC evaluation scheme for classroom {}", classroomId);
        return schemeRepository.save(defaultScheme);
    }

    public SubjectEvaluationScheme updateScheme(String classroomId, SubjectEvaluationScheme request) {
        SubjectEvaluationScheme scheme = schemeRepository.findByClassroomId(classroomId)
                .orElseGet(() -> {
                    SubjectEvaluationScheme created = initializeDefaultScheme(classroomId);
                    return created;
                });

        scheme.setCourseCode(request.getCourseCode() != null ? request.getCourseCode() : scheme.getCourseCode());
        scheme.setCourseName(request.getCourseName() != null ? request.getCourseName() : scheme.getCourseName());
        scheme.setSemester(request.getSemester() > 0 ? request.getSemester() : scheme.getSemester());
        scheme.setLabIntegrated(request.isLabIntegrated());

        scheme.setIaCount(request.getIaCount() > 0 ? request.getIaCount() : 3);
        scheme.setIaRawMaxMarks(request.getIaRawMaxMarks());
        scheme.setIaScaledMaxMarks(request.getIaScaledMaxMarks());
        scheme.setIaCalculationRule(request.getIaCalculationRule() != null ? request.getIaCalculationRule() : "AVERAGE_ALL");

        scheme.setAssignmentRawMaxMarks(request.getAssignmentRawMaxMarks());
        scheme.setAssignmentScaledMaxMarks(request.getAssignmentScaledMaxMarks());

        if (request.isLabIntegrated()) {
            scheme.setLabRecordScaledMarks(request.getLabRecordScaledMarks());
            scheme.setLabTestRawMarks(request.getLabTestRawMarks());
            scheme.setLabTestScaledMarks(request.getLabTestScaledMarks());
            scheme.setCieTotalMaxMarks(scheme.getIaScaledMaxMarks() + scheme.getAssignmentScaledMaxMarks()
                    + scheme.getLabRecordScaledMarks() + scheme.getLabTestScaledMarks());
        } else {
            scheme.setLabRecordScaledMarks(0.0);
            scheme.setLabTestRawMarks(0.0);
            scheme.setLabTestScaledMarks(0.0);
            scheme.setCieTotalMaxMarks(scheme.getIaScaledMaxMarks() + scheme.getAssignmentScaledMaxMarks());
        }

        scheme.setCieMinPassingMarks(request.getCieMinPassingMarks() > 0 ? request.getCieMinPassingMarks() : 20.0);
        scheme.setSeeRawMaxMarks(request.getSeeRawMaxMarks());
        scheme.setSeeScaledMaxMarks(request.getSeeScaledMaxMarks());
        scheme.setSeeMinPassingMarks(request.getSeeMinPassingMarks() > 0 ? request.getSeeMinPassingMarks() : 18.0);
        scheme.setTotalPassMinMarks(request.getTotalPassMinMarks() > 0 ? request.getTotalPassMinMarks() : 40.0);
        scheme.setUpdatedAt(Instant.now());

        log.info("Updated evaluation scheme for classroom {}: CIE total={}, LabIntegrated={}",
                classroomId, scheme.getCieTotalMaxMarks(), scheme.isLabIntegrated());

        return schemeRepository.save(scheme);
    }
}
