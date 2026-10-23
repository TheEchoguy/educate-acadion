package com.acadion.backend.dto.intelligence;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentPublishedMarksSemesterResponse {

    private String studentUsn;
    private String studentName;
    private Integer semester;
    private int totalEnrolledCourses;
    private double cumulativeScaledCie;
    private double maxPossibleScaledCie;
    private String projectedGpa;
    private List<PublishedCourseMarksDTO> courses;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PublishedCourseMarksDTO {
        private String classroomId;
        private String courseCode;
        private String courseName;
        private String facultyName;
        private boolean isPublished;
        private List<PublishedIaItemDTO> publishedIAs;
        private double totalScaledCieSecured;
        private double cieTargetMax;
        private Map<String, Double> moduleMastery;
        private String status; // "ON_TRACK", "NEEDS_ATTENTION", "AT_RISK"
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PublishedIaItemDTO {
        private int iaNumber;
        private double rawTotal;
        private double rawMax;
        private double scaledScore;
        private double scaledMax;
    }
}
