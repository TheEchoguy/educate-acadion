package com.acadion.backend.controller;

import com.acadion.backend.dto.syllabus.*;
import com.acadion.backend.service.SyllabusAnalyticsService;
import com.acadion.backend.service.SyllabusExportService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
public class SyllabusAnalyticsAndExportControllersTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private SyllabusAnalyticsService analyticsService;

    @MockBean
    private SyllabusExportService exportService;

    // =========================================================================
    // 1. ANALYTICS ENDPOINTS TESTS
    // =========================================================================

    @Test
    @DisplayName("GET /api/classrooms/{classroomId}/syllabus/analytics/coverage returns 200 OK")
    void testGetClassroomCoverageAnalytics_success() throws Exception {
        SyllabusCoverageAnalyticsResponse response = SyllabusCoverageAnalyticsResponse.builder()
                .classroomId("class-1")
                .classroomName("Physics 101")
                .totalTopics(10)
                .completedTopics(5)
                .coveragePercentage(50.0)
                .estimatedTotalHours(20.0)
                .completedHours(10.0)
                .upcomingTopics(Collections.emptyList())
                .overdueTopics(Collections.emptyList())
                .build();

        when(analyticsService.getClassroomCoverageAnalytics(eq("class-1"), eq("teacher@acadion.com")))
                .thenReturn(response);

        mockMvc.perform(get("/api/classrooms/class-1/syllabus/analytics/coverage")
                        .principal(() -> "teacher@acadion.com"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.classroomId").value("class-1"))
                .andExpect(jsonPath("$.totalTopics").value(10))
                .andExpect(jsonPath("$.coveragePercentage").value(50.0));
    }

    @Test
    @DisplayName("GET /api/classrooms/{classroomId}/syllabus/analytics/revisions returns 200 OK")
    void testGetClassroomRevisionAggregate_success() throws Exception {
        ClassroomRevisionAggregateResponse response = ClassroomRevisionAggregateResponse.builder()
                .classroomId("class-1")
                .totalEnrolledStudents(30)
                .participatingStudents(15)
                .totalRevisedEntries(25)
                .totalInProgressEntries(10)
                .confidentCount(10)
                .understoodCount(10)
                .privacyNotice("Anonymous aggregate")
                .build();

        when(analyticsService.getClassroomRevisionAggregate(eq("class-1"), any(), eq("teacher@acadion.com")))
                .thenReturn(response);

        mockMvc.perform(get("/api/classrooms/class-1/syllabus/analytics/revisions")
                        .principal(() -> "teacher@acadion.com"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.classroomId").value("class-1"))
                .andExpect(jsonPath("$.totalEnrolledStudents").value(30))
                .andExpect(jsonPath("$.participatingStudents").value(15));
    }

    @Test
    @DisplayName("GET /api/classrooms/{classroomId}/syllabus/topics/{topicId}/assessment-insights returns 200 OK")
    void testGetTopicAssessmentInsights_success() throws Exception {
        TopicAssessmentInsightResponse response = TopicAssessmentInsightResponse.builder()
                .topicId("top-1")
                .topic("Kinematics")
                .mappedQuestionsCount(2)
                .totalResponsesEvaluated(10)
                .distinctStudentsCount(10)
                .averageScorePercentage(75.0)
                .sampleSizeReliability("MODERATE")
                .recommendedForReview(false)
                .build();

        when(analyticsService.getTopicAssessmentInsights(eq("class-1"), eq("top-1"), eq("teacher@acadion.com")))
                .thenReturn(response);

        mockMvc.perform(get("/api/classrooms/class-1/syllabus/topics/top-1/assessment-insights")
                        .principal(() -> "teacher@acadion.com"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.topicId").value("top-1"))
                .andExpect(jsonPath("$.averageScorePercentage").value(75.0))
                .andExpect(jsonPath("$.sampleSizeReliability").value("MODERATE"));
    }

    @Test
    @DisplayName("GET /api/classrooms/{classroomId}/syllabus/analytics/assessment-insights returns 200 OK")
    void testGetClassroomAssessmentInsights_success() throws Exception {
        ClassroomAssessmentInsightsResponse response = ClassroomAssessmentInsightsResponse.builder()
                .classroomId("class-1")
                .totalSyllabusTopics(5)
                .topicsWithEvaluatedEvidenceCount(3)
                .classAverageAssessmentPercentage(72.5)
                .topicInsights(Collections.emptyList())
                .build();

        when(analyticsService.getClassroomAssessmentInsights(eq("class-1"), eq("teacher@acadion.com")))
                .thenReturn(response);

        mockMvc.perform(get("/api/classrooms/class-1/syllabus/analytics/assessment-insights")
                        .principal(() -> "teacher@acadion.com"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.classroomId").value("class-1"))
                .andExpect(jsonPath("$.totalSyllabusTopics").value(5));
    }

    @Test
    @DisplayName("GET /api/syllabus/analytics/overview returns 200 OK")
    void testGetTeacherClassroomsOverview_success() throws Exception {
        TeacherClassroomsOverviewResponse response = TeacherClassroomsOverviewResponse.builder()
                .teacherEmail("teacher@acadion.com")
                .totalManagedClassrooms(1)
                .classrooms(List.of(
                        ClassroomOverviewItemResponse.builder()
                                .classroomId("class-1")
                                .classroomName("Physics 101")
                                .topicCount(5)
                                .coveragePercentage(60.0)
                                .build()
                ))
                .build();

        when(analyticsService.getTeacherClassroomsOverview(eq("teacher@acadion.com")))
                .thenReturn(response);

        mockMvc.perform(get("/api/syllabus/analytics/overview")
                        .principal(() -> "teacher@acadion.com"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.totalManagedClassrooms").value(1))
                .andExpect(jsonPath("$.classrooms[0].classroomId").value("class-1"));
    }

    // =========================================================================
    // 2. EXPORT ENDPOINTS TESTS
    // =========================================================================

    @Test
    @DisplayName("GET /api/classrooms/{classroomId}/syllabus/export?format=csv returns 200, text/csv, and attachment filename")
    void testExportSyllabusCsv_success() throws Exception {
        byte[] csvData = "\uFEFF\"Unit\",\"Topic\"\n\"1\",\"Intro\"".getBytes(StandardCharsets.UTF_8);

        when(exportService.exportSyllabusCsv(eq("class-1"), any(), eq("teacher@acadion.com")))
                .thenReturn(csvData);

        mockMvc.perform(get("/api/classrooms/class-1/syllabus/export?format=csv")
                        .principal(() -> "teacher@acadion.com"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "text/csv;charset=UTF-8"))
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"syllabus-class-1.csv\""))
                .andExpect(content().bytes(csvData));
    }

    @Test
    @DisplayName("GET /api/classrooms/{classroomId}/syllabus/export?format=xlsx returns 200, Excel MIME type, and attachment filename")
    void testExportSyllabusExcel_success() throws Exception {
        byte[] xlsxData = new byte[]{1, 2, 3, 4};

        when(exportService.exportSyllabusExcel(eq("class-1"), any(), eq("teacher@acadion.com")))
                .thenReturn(xlsxData);

        mockMvc.perform(get("/api/classrooms/class-1/syllabus/export?format=xlsx")
                        .principal(() -> "teacher@acadion.com"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"syllabus-class-1.xlsx\""))
                .andExpect(content().bytes(xlsxData));
    }

    @Test
    @DisplayName("GET /api/classrooms/{classroomId}/syllabus/export?format=pdf rejects unsupported formats with 400 Bad Request")
    void testExportSyllabus_invalidFormat_returns400() throws Exception {
        mockMvc.perform(get("/api/classrooms/class-1/syllabus/export?format=pdf")
                        .principal(() -> "teacher@acadion.com"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("GET /api/classrooms/{classroomId}/syllabus/export/progress?format=csv returns 200 and progress attachment")
    void testExportProgressCsv_success() throws Exception {
        byte[] csvData = "\uFEFF\"Unit\",\"Topic\",\"Teaching Status\"\n\"1\",\"Intro\",\"COMPLETED\"".getBytes(StandardCharsets.UTF_8);

        when(exportService.exportProgressCsv(eq("class-1"), any(), eq("teacher@acadion.com")))
                .thenReturn(csvData);

        mockMvc.perform(get("/api/classrooms/class-1/syllabus/export/progress?format=csv")
                        .principal(() -> "teacher@acadion.com"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "text/csv;charset=UTF-8"))
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"syllabus-progress-class-1.csv\""))
                .andExpect(content().bytes(csvData));
    }

    @Test
    @DisplayName("GET /api/classrooms/{classroomId}/syllabus/export/progress?format=xlsx returns 200 and Excel MIME type")
    void testExportProgressExcel_success() throws Exception {
        byte[] xlsxData = new byte[]{5, 6, 7, 8};

        when(exportService.exportProgressExcel(eq("class-1"), any(), eq("teacher@acadion.com")))
                .thenReturn(xlsxData);

        mockMvc.perform(get("/api/classrooms/class-1/syllabus/export/progress?format=xlsx")
                        .principal(() -> "teacher@acadion.com"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"syllabus-progress-class-1.xlsx\""));
    }

    @Test
    @DisplayName("GET /api/classrooms/{classroomId}/syllabus/export/progress?format=html rejects invalid format with 400")
    void testExportProgress_invalidFormat_returns400() throws Exception {
        mockMvc.perform(get("/api/classrooms/class-1/syllabus/export/progress?format=html")
                        .principal(() -> "teacher@acadion.com"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Analytics and export endpoints throw 401 Unauthorized when unauthenticated")
    void testUnauthenticated_throws401() throws Exception {
        mockMvc.perform(get("/api/classrooms/class-1/syllabus/analytics/coverage"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/classrooms/class-1/syllabus/export?format=csv"))
                .andExpect(status().isUnauthorized());
    }
}
