package com.acadion.backend.controller;

import com.acadion.backend.dto.syllabus.*;
import com.acadion.backend.entity.MappingSource;
import com.acadion.backend.entity.RevisionStatus;
import com.acadion.backend.entity.Role;
import com.acadion.backend.entity.SyllabusAuditEventType;
import com.acadion.backend.entity.UnderstandingStatus;
import com.acadion.backend.service.StudentSyllabusRevisionService;
import com.acadion.backend.service.SyllabusAssessmentMappingService;
import com.acadion.backend.service.SyllabusAuditService;
import com.acadion.backend.service.SyllabusPublicationService;
import com.acadion.backend.service.SyllabusService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
public class AdvancedSyllabusControllersTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private SyllabusPublicationService publicationService;

    @MockBean
    private StudentSyllabusRevisionService revisionService;

    @MockBean
    private SyllabusAssessmentMappingService mappingService;

    @MockBean
    private SyllabusAuditService auditService;

    @MockBean
    private SyllabusService syllabusService;

    // =========================================================================
    // 1. PUBLICATION WORKFLOW ENDPOINT TESTS
    // =========================================================================

    @Test
    @WithMockUser(username = "teacher@acadion.com", authorities = {"TEACHER"})
    @DisplayName("1. POST /api/classrooms/{classroomId}/syllabus/versions/publish - Authorized teacher can publish draft (201 Created)")
    void testAuthorizedTeacherCanPublishDraft() throws Exception {
        PublishSyllabusRequest request = PublishSyllabusRequest.builder()
                .versionTitle("Release 1.0")
                .changeSummary("Initial publication of CS syllabus")
                .build();

        SyllabusVersionResponse response = SyllabusVersionResponse.builder()
                .id("ver_1")
                .classroomId("cls_1")
                .versionNumber(1)
                .versionTitle("Release 1.0")
                .changeSummary("Initial publication of CS syllabus")
                .publishedBy("teacher_1")
                .publishedAt(LocalDateTime.now())
                .topicCount(2)
                .topics(Collections.emptyList())
                .build();

        when(publicationService.publishSyllabus(eq("cls_1"), any(PublishSyllabusRequest.class), eq("teacher@acadion.com")))
                .thenReturn(response);

        mockMvc.perform(post("/api/classrooms/cls_1/syllabus/versions/publish")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request))
                        .principal(() -> "teacher@acadion.com"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("ver_1"))
                .andExpect(jsonPath("$.versionNumber").value(1))
                .andExpect(jsonPath("$.versionTitle").value("Release 1.0"))
                .andExpect(jsonPath("$.topicCount").value(2));

        verify(publicationService).publishSyllabus(eq("cls_1"), any(PublishSyllabusRequest.class), eq("teacher@acadion.com"));
    }

    @Test
    @WithMockUser(username = "teacher@acadion.com", authorities = {"TEACHER"})
    @DisplayName("2. GET /api/classrooms/{classroomId}/syllabus/versions - Published-version listing returns expected response (200 OK)")
    void testGetPublishedVersionsListing() throws Exception {
        SyllabusVersionSummaryResponse summary = SyllabusVersionSummaryResponse.builder()
                .id("ver_1")
                .classroomId("cls_1")
                .versionNumber(1)
                .versionTitle("Release 1.0")
                .topicCount(3)
                .publishedAt(LocalDateTime.now())
                .build();

        when(publicationService.getPublishedVersions("cls_1", "teacher@acadion.com"))
                .thenReturn(List.of(summary));

        mockMvc.perform(get("/api/classrooms/cls_1/syllabus/versions")
                        .principal(() -> "teacher@acadion.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("ver_1"))
                .andExpect(jsonPath("$[0].versionNumber").value(1))
                .andExpect(jsonPath("$[0].versionTitle").value("Release 1.0"))
                .andExpect(jsonPath("$[0].topicCount").value(3));

        verify(publicationService).getPublishedVersions("cls_1", "teacher@acadion.com");
    }

    @Test
    @WithMockUser(username = "teacher@acadion.com", authorities = {"TEACHER"})
    @DisplayName("3. GET /api/classrooms/{classroomId}/syllabus/versions/{versionId} - Version retrieval is classroom-scoped (200 OK)")
    void testGetPublishedVersionByIdScoped() throws Exception {
        SyllabusVersionResponse response = SyllabusVersionResponse.builder()
                .id("ver_1")
                .classroomId("cls_1")
                .versionNumber(1)
                .versionTitle("Release 1.0")
                .topicCount(1)
                .build();

        when(publicationService.getPublishedVersionByIdOrNumber("cls_1", "ver_1", "teacher@acadion.com"))
                .thenReturn(response);

        mockMvc.perform(get("/api/classrooms/cls_1/syllabus/versions/ver_1")
                        .principal(() -> "teacher@acadion.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("ver_1"))
                .andExpect(jsonPath("$.classroomId").value("cls_1"));

        verify(publicationService).getPublishedVersionByIdOrNumber("cls_1", "ver_1", "teacher@acadion.com");
    }

    @Test
    @WithMockUser(username = "unrelated@acadion.com", authorities = {"TEACHER"})
    @DisplayName("4. Unrelated teacher cannot publish or read another classroom's versions (403 Forbidden)")
    void testUnrelatedTeacherCannotPublishOrReadVersions() throws Exception {
        when(publicationService.publishSyllabus(eq("cls_1"), any(), eq("unrelated@acadion.com")))
                .thenThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden: You are not authorized to manage this classroom"));

        mockMvc.perform(post("/api/classrooms/cls_1/syllabus/versions/publish")
                        .principal(() -> "unrelated@acadion.com"))
                .andExpect(status().isForbidden());

        when(publicationService.getPublishedVersions("cls_1", "unrelated@acadion.com"))
                .thenThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: You are not authorized to view the syllabus for this classroom"));

        mockMvc.perform(get("/api/classrooms/cls_1/syllabus/versions")
                        .principal(() -> "unrelated@acadion.com"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "student@acadion.com", authorities = {"STUDENT"})
    @DisplayName("5. Students cannot publish draft (403 Forbidden)")
    void testStudentCannotPublish() throws Exception {
        when(publicationService.publishSyllabus(eq("cls_1"), any(), eq("student@acadion.com")))
                .thenThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: Only faculty can perform this action"));

        mockMvc.perform(post("/api/classrooms/cls_1/syllabus/versions/publish")
                        .principal(() -> "student@acadion.com"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "teacher@acadion.com", authorities = {"TEACHER"})
    @DisplayName("6. Empty-draft publication returns expected client error (400 Bad Request)")
    void testEmptyDraftPublicationReturnsBadRequest() throws Exception {
        when(publicationService.publishSyllabus(eq("cls_1"), any(), eq("teacher@acadion.com")))
                .thenThrow(new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot publish an empty syllabus. Please add topics before publishing."));

        mockMvc.perform(post("/api/classrooms/cls_1/syllabus/versions/publish")
                        .principal(() -> "teacher@acadion.com"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(username = "teacher@acadion.com", authorities = {"TEACHER"})
    @DisplayName("7. Cross-classroom version retrieval returns 404 Not Found")
    void testCrossClassroomVersionRetrievalReturns404() throws Exception {
        when(publicationService.getPublishedVersionByIdOrNumber("cls_1", "foreign_ver", "teacher@acadion.com"))
                .thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND, "Published syllabus version not found with identifier foreign_ver in classroom cls_1"));

        mockMvc.perform(get("/api/classrooms/cls_1/syllabus/versions/foreign_ver")
                        .principal(() -> "teacher@acadion.com"))
                .andExpect(status().isNotFound());
    }

    // =========================================================================
    // 2. STUDENT PERSONAL REVISION ENDPOINT TESTS
    // =========================================================================

    @Test
    @WithMockUser(username = "student@acadion.com", authorities = {"STUDENT"})
    @DisplayName("8. Active student can read their own revision records (200 OK)")
    void testActiveStudentCanReadOwnRevisions() throws Exception {
        StudentSyllabusRevisionResponse record = StudentSyllabusRevisionResponse.builder()
                .id("rev_1")
                .classroomId("cls_1")
                .studentId("stu_1")
                .topicId("topic_1")
                .publishedVersionId("ver_1")
                .revisionStatus(RevisionStatus.REVISED)
                .understandingStatus(UnderstandingStatus.CONFIDENT)
                .personalNotes("Understood binary search fully")
                .build();

        when(revisionService.getStudentRevisions("cls_1", "ver_1", "student@acadion.com"))
                .thenReturn(List.of(record));

        mockMvc.perform(get("/api/classrooms/cls_1/syllabus/my-revisions")
                        .param("versionId", "ver_1")
                        .principal(() -> "student@acadion.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("rev_1"))
                .andExpect(jsonPath("$[0].revisionStatus").value("REVISED"))
                .andExpect(jsonPath("$[0].understandingStatus").value("CONFIDENT"))
                .andExpect(jsonPath("$[0].personalNotes").value("Understood binary search fully"));

        verify(revisionService).getStudentRevisions("cls_1", "ver_1", "student@acadion.com");
    }

    @Test
    @WithMockUser(username = "student@acadion.com", authorities = {"STUDENT"})
    @DisplayName("9. Active student can create or update their own revision (200 OK)")
    void testActiveStudentCanUpdateOwnRevision() throws Exception {
        UpdateRevisionProgressRequest request = UpdateRevisionProgressRequest.builder()
                .revisionStatus(RevisionStatus.REVISED)
                .understandingStatus(UnderstandingStatus.CONFIDENT)
                .personalNotes("Finished practicing problems")
                .build();

        StudentSyllabusRevisionResponse response = StudentSyllabusRevisionResponse.builder()
                .id("rev_1")
                .classroomId("cls_1")
                .studentId("stu_1")
                .topicId("topic_1")
                .publishedVersionId("ver_1")
                .revisionStatus(RevisionStatus.REVISED)
                .understandingStatus(UnderstandingStatus.CONFIDENT)
                .personalNotes("Finished practicing problems")
                .build();

        when(revisionService.updateRevisionProgress(eq("cls_1"), any(UpdateRevisionProgressRequest.class), eq("student@acadion.com")))
                .thenReturn(response);

        mockMvc.perform(put("/api/classrooms/cls_1/syllabus/versions/ver_1/topics/topic_1/my-revision")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request))
                        .principal(() -> "student@acadion.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("rev_1"))
                .andExpect(jsonPath("$.topicId").value("topic_1"))
                .andExpect(jsonPath("$.publishedVersionId").value("ver_1"))
                .andExpect(jsonPath("$.revisionStatus").value("REVISED"));

        verify(revisionService).updateRevisionProgress(eq("cls_1"), any(UpdateRevisionProgressRequest.class), eq("student@acadion.com"));
    }

    @Test
    @WithMockUser(username = "impersonator@acadion.com", authorities = {"STUDENT"})
    @DisplayName("10. Authenticated identity enforces personal revision ownership, preventing impersonation")
    void testImpersonationPreventedByPrincipal() throws Exception {
        UpdateRevisionProgressRequest request = UpdateRevisionProgressRequest.builder()
                .revisionStatus(RevisionStatus.REVISED)
                .build();

        mockMvc.perform(put("/api/classrooms/cls_1/syllabus/versions/ver_1/topics/topic_1/my-revision")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request))
                        .principal(() -> "impersonator@acadion.com"))
                .andExpect(status().isOk());

        // Verifies the service was invoked with the authenticated email from Principal, not any external parameter
        verify(revisionService).updateRevisionProgress(eq("cls_1"), any(UpdateRevisionProgressRequest.class), eq("impersonator@acadion.com"));
    }

    @Test
    @WithMockUser(username = "student@acadion.com", authorities = {"STUDENT"})
    @DisplayName("11. Student cannot revise an unpublished version (404 Not Found)")
    void testStudentCannotReviseUnpublishedVersion() throws Exception {
        UpdateRevisionProgressRequest request = UpdateRevisionProgressRequest.builder()
                .revisionStatus(RevisionStatus.REVISED)
                .build();

        when(revisionService.updateRevisionProgress(eq("cls_1"), any(UpdateRevisionProgressRequest.class), eq("student@acadion.com")))
                .thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND, "Published syllabus version not found with ID missing_ver in classroom cls_1"));

        mockMvc.perform(put("/api/classrooms/cls_1/syllabus/versions/missing_ver/topics/topic_1/my-revision")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request))
                        .principal(() -> "student@acadion.com"))
                .andExpect(status().isNotFound());
    }

    @Test
    @WithMockUser(username = "inactive@acadion.com", authorities = {"STUDENT"})
    @DisplayName("12. Inactive student is denied revision access (403 Forbidden)")
    void testInactiveStudentDeniedRevisionAccess() throws Exception {
        when(revisionService.getStudentRevisions("cls_1", null, "inactive@acadion.com"))
                .thenThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: You do not have an active enrollment in this classroom"));

        mockMvc.perform(get("/api/classrooms/cls_1/syllabus/my-revisions")
                        .principal(() -> "inactive@acadion.com"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "teacher@acadion.com", authorities = {"TEACHER"})
    @DisplayName("13. Teacher cannot access student revision private endpoints (403 Forbidden)")
    void testTeacherCannotAccessStudentPrivateEndpoints() throws Exception {
        when(revisionService.getStudentRevisions("cls_1", null, "teacher@acadion.com"))
                .thenThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: Only enrolled students can track personal syllabus revision"));

        mockMvc.perform(get("/api/classrooms/cls_1/syllabus/my-revisions")
                        .principal(() -> "teacher@acadion.com"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "student@acadion.com", authorities = {"STUDENT"})
    @DisplayName("14. Student revision summary is retrieved (200 OK)")
    void testGetStudentRevisionSummary() throws Exception {
        StudentRevisionSummaryResponse summary = StudentRevisionSummaryResponse.builder()
                .classroomId("cls_1")
                .studentId("stu_1")
                .publishedVersionId("ver_1")
                .totalTopics(10)
                .revisedCount(5)
                .inProgressCount(3)
                .notStartedCount(2)
                .revisionPercentage(50.0)
                .confidentCount(4)
                .understoodCount(3)
                .needsRevisionCount(1)
                .notAssessedCount(2)
                .build();

        when(revisionService.getStudentRevisionSummary("cls_1", "ver_1", "student@acadion.com"))
                .thenReturn(summary);

        mockMvc.perform(get("/api/classrooms/cls_1/syllabus/my-revisions/summary")
                        .param("versionId", "ver_1")
                        .principal(() -> "student@acadion.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalTopics").value(10))
                .andExpect(jsonPath("$.revisedCount").value(5))
                .andExpect(jsonPath("$.revisionPercentage").value(50.0));

        verify(revisionService).getStudentRevisionSummary("cls_1", "ver_1", "student@acadion.com");
    }

    @Test
    @WithMockUser(username = "student@acadion.com", authorities = {"STUDENT"})
    @DisplayName("15. Student topic revision history across versions is retrieved (200 OK)")
    void testGetStudentTopicRevisionHistory() throws Exception {
        StudentSyllabusRevisionResponse r1 = StudentSyllabusRevisionResponse.builder()
                .id("rev_1")
                .topicId("topic_1")
                .publishedVersionId("ver_1")
                .revisionStatus(RevisionStatus.IN_PROGRESS)
                .build();

        when(revisionService.getStudentTopicRevisionHistory("cls_1", "topic_1", "student@acadion.com"))
                .thenReturn(List.of(r1));

        mockMvc.perform(get("/api/classrooms/cls_1/syllabus/topics/topic_1/my-revision-history")
                        .principal(() -> "student@acadion.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("rev_1"))
                .andExpect(jsonPath("$[0].topicId").value("topic_1"));

        verify(revisionService).getStudentTopicRevisionHistory("cls_1", "topic_1", "student@acadion.com");
    }

    // =========================================================================
    // 3. ASSESSMENT MAPPING ENDPOINT TESTS
    // =========================================================================

    @Test
    @WithMockUser(username = "teacher@acadion.com", authorities = {"TEACHER"})
    @DisplayName("16. Teacher can create a valid manual mapping (201 Created)")
    void testTeacherCanCreateManualMapping() throws Exception {
        CreateAssessmentMappingRequest request = CreateAssessmentMappingRequest.builder()
                .syllabusTopicId("topic_1")
                .paperId("paper_1")
                .questionId("1a")
                .matchedTopicLabel("Algorithms")
                .build();

        AssessmentMappingResponse response = AssessmentMappingResponse.builder()
                .id("map_1")
                .classroomId("cls_1")
                .syllabusTopicId("topic_1")
                .paperId("paper_1")
                .questionId("1a")
                .matchedTopicLabel("Algorithms")
                .mappingSource(MappingSource.MANUAL)
                .confirmed(true)
                .createdBy("teacher_1")
                .build();

        when(mappingService.createManualMapping(eq("cls_1"), any(CreateAssessmentMappingRequest.class), eq("teacher@acadion.com")))
                .thenReturn(response);

        mockMvc.perform(post("/api/classrooms/cls_1/syllabus/assessment-mappings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request))
                        .principal(() -> "teacher@acadion.com"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("map_1"))
                .andExpect(jsonPath("$.paperId").value("paper_1"))
                .andExpect(jsonPath("$.mappingSource").value("MANUAL"))
                .andExpect(jsonPath("$.confirmed").value(true));

        verify(mappingService).createManualMapping(eq("cls_1"), any(CreateAssessmentMappingRequest.class), eq("teacher@acadion.com"));
    }

    @Test
    @WithMockUser(username = "other@acadion.com", authorities = {"TEACHER"})
    @DisplayName("17. Unrelated teacher cannot create or remove mappings (403 Forbidden)")
    void testUnrelatedTeacherCannotCreateOrRemoveMappings() throws Exception {
        CreateAssessmentMappingRequest request = CreateAssessmentMappingRequest.builder()
                .syllabusTopicId("topic_1")
                .paperId("paper_1")
                .build();

        when(mappingService.createManualMapping(eq("cls_1"), any(), eq("other@acadion.com")))
                .thenThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden: You are not authorized to manage this classroom"));

        mockMvc.perform(post("/api/classrooms/cls_1/syllabus/assessment-mappings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request))
                        .principal(() -> "other@acadion.com"))
                .andExpect(status().isForbidden());

        doThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden: You are not authorized to manage this classroom"))
                .when(mappingService).deleteMapping("cls_1", "map_1", "other@acadion.com");

        mockMvc.perform(delete("/api/classrooms/cls_1/syllabus/assessment-mappings/map_1")
                        .principal(() -> "other@acadion.com"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "student@acadion.com", authorities = {"STUDENT"})
    @DisplayName("18. Student cannot modify mappings (403 Forbidden)")
    void testStudentCannotModifyMappings() throws Exception {
        CreateAssessmentMappingRequest request = CreateAssessmentMappingRequest.builder()
                .syllabusTopicId("topic_1")
                .paperId("paper_1")
                .build();

        when(mappingService.createManualMapping(eq("cls_1"), any(), eq("student@acadion.com")))
                .thenThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: Only faculty can perform this action"));

        mockMvc.perform(post("/api/classrooms/cls_1/syllabus/assessment-mappings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request))
                        .principal(() -> "student@acadion.com"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "teacher@acadion.com", authorities = {"TEACHER"})
    @DisplayName("19. Mapping suggestions are returned as unconfirmed (200 OK)")
    void testMappingSuggestionsReturnedUnconfirmed() throws Exception {
        AssessmentMappingSuggestionResponse suggestion = AssessmentMappingSuggestionResponse.builder()
                .paperId("paper_1")
                .questionId("1b")
                .assessmentTitle("Final Exam")
                .subject("Computer Science")
                .matchedTopicLabel("Dynamic Programming")
                .confidenceReason("Question 1b topic matches syllabus topic")
                .confirmed(false)
                .build();

        when(mappingService.getMappingSuggestions("cls_1", "topic_1", "teacher@acadion.com"))
                .thenReturn(List.of(suggestion));

        mockMvc.perform(get("/api/classrooms/cls_1/syllabus/topics/topic_1/mapping-suggestions")
                        .principal(() -> "teacher@acadion.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].paperId").value("paper_1"))
                .andExpect(jsonPath("$[0].questionId").value("1b"))
                .andExpect(jsonPath("$[0].confirmed").value(false));

        verify(mappingService).getMappingSuggestions("cls_1", "topic_1", "teacher@acadion.com");
    }

    @Test
    @WithMockUser(username = "teacher@acadion.com", authorities = {"TEACHER"})
    @DisplayName("20. Confirmation changes the mapping only through the authorized service (200 OK)")
    void testConfirmMappingChangesStatus() throws Exception {
        AssessmentMappingResponse response = AssessmentMappingResponse.builder()
                .id("map_1")
                .classroomId("cls_1")
                .syllabusTopicId("topic_1")
                .paperId("paper_1")
                .mappingSource(MappingSource.CONFIRMED_SUGGESTION)
                .confirmed(true)
                .build();

        when(mappingService.confirmMappingById("cls_1", "map_1", "teacher@acadion.com"))
                .thenReturn(response);

        mockMvc.perform(post("/api/classrooms/cls_1/syllabus/assessment-mappings/map_1/confirm")
                        .principal(() -> "teacher@acadion.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("map_1"))
                .andExpect(jsonPath("$.confirmed").value(true))
                .andExpect(jsonPath("$.mappingSource").value("CONFIRMED_SUGGESTION"));

        verify(mappingService).confirmMappingById("cls_1", "map_1", "teacher@acadion.com");
    }

    @Test
    @WithMockUser(username = "teacher@acadion.com", authorities = {"TEACHER"})
    @DisplayName("21. Cross-classroom topic, paper or mapping identifiers are rejected (404 Not Found)")
    void testCrossClassroomMappingRejected() throws Exception {
        when(mappingService.confirmMappingById("cls_1", "map_foreign", "teacher@acadion.com"))
                .thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND, "Assessment mapping not found with ID map_foreign in classroom cls_1"));

        mockMvc.perform(post("/api/classrooms/cls_1/syllabus/assessment-mappings/map_foreign/confirm")
                        .principal(() -> "teacher@acadion.com"))
                .andExpect(status().isNotFound());
    }

    @Test
    @WithMockUser(username = "teacher@acadion.com", authorities = {"TEACHER"})
    @DisplayName("22. Teacher can delete an authorized assessment mapping (204 No Content)")
    void testDeleteAssessmentMappingSuccess() throws Exception {
        doNothing().when(mappingService).deleteMapping("cls_1", "map_1", "teacher@acadion.com");

        mockMvc.perform(delete("/api/classrooms/cls_1/syllabus/assessment-mappings/map_1")
                        .principal(() -> "teacher@acadion.com"))
                .andExpect(status().isNoContent());

        verify(mappingService).deleteMapping("cls_1", "map_1", "teacher@acadion.com");
    }

    // =========================================================================
    // 4. AUDIT HISTORY ENDPOINT TESTS
    // =========================================================================

    @Test
    @WithMockUser(username = "teacher@acadion.com", authorities = {"TEACHER"})
    @DisplayName("23. Authorized teacher can read their classroom's audit events (200 OK)")
    void testAuthorizedTeacherCanReadAuditEvents() throws Exception {
        SyllabusAuditEventResponse event = SyllabusAuditEventResponse.builder()
                .id("aud_1")
                .classroomId("cls_1")
                .syllabusTopicId("topic_1")
                .actorEmail("teacher@acadion.com")
                .actorRole(Role.TEACHER)
                .eventType(SyllabusAuditEventType.TOPIC_CREATED)
                .timestamp(LocalDateTime.now())
                .description("Created syllabus topic")
                .metadata(Map.of("topic", "Dynamic Programming"))
                .build();

        when(auditService.getAuditEvents("cls_1", null, 0, 50, "teacher@acadion.com"))
                .thenReturn(List.of(event));

        mockMvc.perform(get("/api/classrooms/cls_1/syllabus/audit")
                        .principal(() -> "teacher@acadion.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("aud_1"))
                .andExpect(jsonPath("$[0].eventType").value("TOPIC_CREATED"))
                .andExpect(jsonPath("$[0].description").value("Created syllabus topic"));

        verify(auditService).getAuditEvents("cls_1", null, 0, 50, "teacher@acadion.com");
    }

    @Test
    @WithMockUser(username = "other@acadion.com", authorities = {"TEACHER"})
    @DisplayName("24. An unrelated teacher cannot read another classroom's audit events (403 Forbidden)")
    void testUnrelatedTeacherCannotReadAuditEvents() throws Exception {
        when(auditService.getAuditEvents("cls_1", null, 0, 50, "other@acadion.com"))
                .thenThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden: You are not authorized to view audit history for this classroom"));

        mockMvc.perform(get("/api/classrooms/cls_1/syllabus/audit")
                        .principal(() -> "other@acadion.com"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "student@acadion.com", authorities = {"STUDENT"})
    @DisplayName("25. A student cannot access the teacher audit endpoint (403 Forbidden)")
    void testStudentCannotAccessAuditEndpoint() throws Exception {
        when(auditService.getAuditEvents("cls_1", null, 0, 50, "student@acadion.com"))
                .thenThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden: You are not authorized to view audit history for this classroom"));

        mockMvc.perform(get("/api/classrooms/cls_1/syllabus/audit")
                        .principal(() -> "student@acadion.com"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "teacher@acadion.com", authorities = {"TEACHER"})
    @DisplayName("26. Audit results are classroom-scoped and paginated as expected (200 OK)")
    void testAuditResultsPagination() throws Exception {
        when(auditService.getAuditEvents("cls_1", "topic_1", 1, 10, "teacher@acadion.com"))
                .thenReturn(Collections.emptyList());

        mockMvc.perform(get("/api/classrooms/cls_1/syllabus/audit")
                        .param("topicId", "topic_1")
                        .param("page", "1")
                        .param("limit", "10")
                        .principal(() -> "teacher@acadion.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());

        verify(auditService).getAuditEvents("cls_1", "topic_1", 1, 10, "teacher@acadion.com");
    }

    // =========================================================================
    // 5. GENERAL SECURITY & ERROR HANDLING TESTS
    // =========================================================================

    @Test
    @DisplayName("27. Unauthenticated request to publish returns 401 Unauthorized")
    void testUnauthenticatedPublishReturns401() throws Exception {
        mockMvc.perform(post("/api/classrooms/cls_1/syllabus/versions/publish"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("28. Unauthenticated request to my-revisions returns 401 Unauthorized")
    void testUnauthenticatedMyRevisionsReturns401() throws Exception {
        mockMvc.perform(get("/api/classrooms/cls_1/syllabus/my-revisions"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("29. Unauthenticated request to audit returns 401 Unauthorized")
    void testUnauthenticatedAuditReturns401() throws Exception {
        mockMvc.perform(get("/api/classrooms/cls_1/syllabus/audit"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "teacher@acadion.com", authorities = {"TEACHER"})
    @DisplayName("30. Malformed payload or validation error returns 400 Bad Request")
    void testMalformedPayloadReturnsBadRequest() throws Exception {
        when(mappingService.createManualMapping(eq("cls_1"), any(), eq("teacher@acadion.com")))
                .thenThrow(new ResponseStatusException(HttpStatus.BAD_REQUEST, "Syllabus topic ID is required"));

        mockMvc.perform(post("/api/classrooms/cls_1/syllabus/assessment-mappings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}")
                        .principal(() -> "teacher@acadion.com"))
                .andExpect(status().isBadRequest());
    }
}
