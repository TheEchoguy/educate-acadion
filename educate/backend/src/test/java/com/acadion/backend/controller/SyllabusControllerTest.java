package com.acadion.backend.controller;

import com.acadion.backend.dto.syllabus.*;
import com.acadion.backend.entity.SyllabusStatus;
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
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
public class SyllabusControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private SyllabusService syllabusService;

    // -------------------------------------------------------------------------
    // 1. GET /api/classrooms/{classroomId}/syllabus - returns 200 OK
    // -------------------------------------------------------------------------
    @Test
    @WithMockUser(username = "teacher@acadion.com", authorities = {"TEACHER"})
    @DisplayName("1. GET /api/classrooms/{classroomId}/syllabus - returns 200 OK with list of topics")
    void testGetSyllabusItemsSuccess() throws Exception {
        SyllabusItemResponse item = SyllabusItemResponse.builder()
                .id("item_1")
                .classroomId("cls_1")
                .unit("Unit 1")
                .topic("Big-O Notation")
                .status(SyllabusStatus.NOT_STARTED)
                .orderIndex(0)
                .build();

        when(syllabusService.getSyllabusItems("cls_1", "teacher@acadion.com"))
                .thenReturn(List.of(item));

        mockMvc.perform(get("/api/classrooms/cls_1/syllabus")
                        .principal(() -> "teacher@acadion.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("item_1"))
                .andExpect(jsonPath("$[0].unit").value("Unit 1"))
                .andExpect(jsonPath("$[0].topic").value("Big-O Notation"))
                .andExpect(jsonPath("$[0].status").value("NOT_STARTED"));

        verify(syllabusService, times(1)).getSyllabusItems("cls_1", "teacher@acadion.com");
    }

    // -------------------------------------------------------------------------
    // 2. POST /api/classrooms/{classroomId}/syllabus - returns 201 Created
    // -------------------------------------------------------------------------
    @Test
    @WithMockUser(username = "teacher@acadion.com", authorities = {"TEACHER"})
    @DisplayName("2. POST /api/classrooms/{classroomId}/syllabus - returns 201 Created on valid topic")
    void testCreateSyllabusItemSuccess() throws Exception {
        CreateSyllabusItemRequest request = CreateSyllabusItemRequest.builder()
                .unit("Unit 1")
                .topic("Divide and Conquer")
                .description("Binary search, Merge sort")
                .status(SyllabusStatus.NOT_STARTED)
                .build();

        SyllabusItemResponse created = SyllabusItemResponse.builder()
                .id("item_new")
                .classroomId("cls_1")
                .unit("Unit 1")
                .topic("Divide and Conquer")
                .description("Binary search, Merge sort")
                .status(SyllabusStatus.NOT_STARTED)
                .orderIndex(0)
                .createdBy("teacher_1")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        when(syllabusService.createSyllabusItem(eq("cls_1"), any(CreateSyllabusItemRequest.class), eq("teacher@acadion.com")))
                .thenReturn(created);

        mockMvc.perform(post("/api/classrooms/cls_1/syllabus")
                        .principal(() -> "teacher@acadion.com")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("item_new"))
                .andExpect(jsonPath("$.topic").value("Divide and Conquer"))
                .andExpect(jsonPath("$.status").value("NOT_STARTED"));

        verify(syllabusService).createSyllabusItem(eq("cls_1"), any(CreateSyllabusItemRequest.class), eq("teacher@acadion.com"));
    }

    // -------------------------------------------------------------------------
    // 3. PUT /api/classrooms/{classroomId}/syllabus/{itemId} - returns 200 OK
    // -------------------------------------------------------------------------
    @Test
    @WithMockUser(username = "teacher@acadion.com", authorities = {"TEACHER"})
    @DisplayName("3. PUT /api/classrooms/{classroomId}/syllabus/{itemId} - returns 200 OK on update")
    void testUpdateSyllabusItemSuccess() throws Exception {
        UpdateSyllabusItemRequest updateReq = UpdateSyllabusItemRequest.builder()
                .unit("Unit 1: Foundations")
                .topic("Advanced Asymptotics")
                .description("Updated notes")
                .status(SyllabusStatus.IN_PROGRESS)
                .orderIndex(1)
                .build();

        SyllabusItemResponse updated = SyllabusItemResponse.builder()
                .id("item_1")
                .classroomId("cls_1")
                .unit("Unit 1: Foundations")
                .topic("Advanced Asymptotics")
                .description("Updated notes")
                .status(SyllabusStatus.IN_PROGRESS)
                .orderIndex(1)
                .build();

        when(syllabusService.updateSyllabusItem(eq("cls_1"), eq("item_1"), any(UpdateSyllabusItemRequest.class), eq("teacher@acadion.com")))
                .thenReturn(updated);

        mockMvc.perform(put("/api/classrooms/cls_1/syllabus/item_1")
                        .principal(() -> "teacher@acadion.com")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unit").value("Unit 1: Foundations"))
                .andExpect(jsonPath("$.topic").value("Advanced Asymptotics"))
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"));

        verify(syllabusService).updateSyllabusItem(eq("cls_1"), eq("item_1"), any(UpdateSyllabusItemRequest.class), eq("teacher@acadion.com"));
    }

    // -------------------------------------------------------------------------
    // 4. PATCH /api/classrooms/{classroomId}/syllabus/{itemId}/status - returns 200 OK
    // -------------------------------------------------------------------------
    @Test
    @WithMockUser(username = "teacher@acadion.com", authorities = {"TEACHER"})
    @DisplayName("4. PATCH /api/classrooms/{classroomId}/syllabus/{itemId}/status - returns 200 OK on status change")
    void testUpdateSyllabusStatusSuccess() throws Exception {
        UpdateSyllabusStatusRequest statusReq = UpdateSyllabusStatusRequest.builder()
                .status(SyllabusStatus.COMPLETED)
                .build();

        SyllabusItemResponse completed = SyllabusItemResponse.builder()
                .id("item_1")
                .classroomId("cls_1")
                .unit("Unit 1")
                .topic("Big-O Notation")
                .status(SyllabusStatus.COMPLETED)
                .build();

        when(syllabusService.updateSyllabusStatus(eq("cls_1"), eq("item_1"), any(UpdateSyllabusStatusRequest.class), eq("teacher@acadion.com")))
                .thenReturn(completed);

        mockMvc.perform(patch("/api/classrooms/cls_1/syllabus/item_1/status")
                        .principal(() -> "teacher@acadion.com")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(statusReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"));

        verify(syllabusService).updateSyllabusStatus(eq("cls_1"), eq("item_1"), any(UpdateSyllabusStatusRequest.class), eq("teacher@acadion.com"));
    }

    // -------------------------------------------------------------------------
    // 5. DELETE /api/classrooms/{classroomId}/syllabus/{itemId} - returns 200 OK
    // -------------------------------------------------------------------------
    @Test
    @WithMockUser(username = "teacher@acadion.com", authorities = {"TEACHER"})
    @DisplayName("5. DELETE /api/classrooms/{classroomId}/syllabus/{itemId} - returns 200 OK with deletion confirmation")
    void testDeleteSyllabusItemSuccess() throws Exception {
        Map<String, Object> result = Map.of(
                "success", true,
                "message", "Syllabus topic deleted successfully",
                "classroomId", "cls_1",
                "itemId", "item_1"
        );

        when(syllabusService.deleteSyllabusItem("cls_1", "item_1", "teacher@acadion.com"))
                .thenReturn(result);

        mockMvc.perform(delete("/api/classrooms/cls_1/syllabus/item_1")
                        .principal(() -> "teacher@acadion.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.itemId").value("item_1"));

        verify(syllabusService).deleteSyllabusItem("cls_1", "item_1", "teacher@acadion.com");
    }

    // -------------------------------------------------------------------------
    // 6. PUT /api/classrooms/{classroomId}/syllabus/order - returns 200 OK
    // -------------------------------------------------------------------------
    @Test
    @WithMockUser(username = "teacher@acadion.com", authorities = {"TEACHER"})
    @DisplayName("6. PUT /api/classrooms/{classroomId}/syllabus/order - returns 200 OK on reordering")
    void testReorderSyllabusItemsSuccess() throws Exception {
        ReorderSyllabusRequest reorderReq = ReorderSyllabusRequest.builder()
                .orderedItemIds(List.of("item_2", "item_1"))
                .build();

        SyllabusItemResponse r1 = SyllabusItemResponse.builder().id("item_2").orderIndex(0).build();
        SyllabusItemResponse r2 = SyllabusItemResponse.builder().id("item_1").orderIndex(1).build();

        when(syllabusService.reorderSyllabusItems(eq("cls_1"), eq(List.of("item_2", "item_1")), eq("teacher@acadion.com")))
                .thenReturn(List.of(r1, r2));

        mockMvc.perform(put("/api/classrooms/cls_1/syllabus/order")
                        .principal(() -> "teacher@acadion.com")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reorderReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("item_2"))
                .andExpect(jsonPath("$[0].orderIndex").value(0))
                .andExpect(jsonPath("$[1].id").value("item_1"))
                .andExpect(jsonPath("$[1].orderIndex").value(1));

        verify(syllabusService).reorderSyllabusItems(eq("cls_1"), eq(List.of("item_2", "item_1")), eq("teacher@acadion.com"));
    }

    // -------------------------------------------------------------------------
    // 7. GET /api/classrooms/{classroomId}/syllabus/progress - returns 200 OK
    // -------------------------------------------------------------------------
    @Test
    @WithMockUser(username = "teacher@acadion.com", authorities = {"TEACHER"})
    @DisplayName("7. GET /api/classrooms/{classroomId}/syllabus/progress - returns 200 OK with progress metrics")
    void testGetSyllabusProgressSuccess() throws Exception {
        SyllabusProgressResponse progress = SyllabusProgressResponse.builder()
                .classroomId("cls_1")
                .totalTopics(4)
                .completedTopics(2)
                .inProgressTopics(1)
                .notStartedTopics(1)
                .completionPercentage(50.0)
                .build();

        when(syllabusService.getSyllabusProgress("cls_1", "teacher@acadion.com"))
                .thenReturn(progress);

        mockMvc.perform(get("/api/classrooms/cls_1/syllabus/progress")
                        .principal(() -> "teacher@acadion.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.classroomId").value("cls_1"))
                .andExpect(jsonPath("$.totalTopics").value(4))
                .andExpect(jsonPath("$.completedTopics").value(2))
                .andExpect(jsonPath("$.completionPercentage").value(50.0));

        verify(syllabusService).getSyllabusProgress("cls_1", "teacher@acadion.com");
    }

    // -------------------------------------------------------------------------
    // 8. Invalid request body produces 400 Bad Request
    // -------------------------------------------------------------------------
    @Test
    @WithMockUser(username = "teacher@acadion.com", authorities = {"TEACHER"})
    @DisplayName("8. POST with blank topic name produces 400 Bad Request validation error")
    void testCreateWithBlankTopicFailsValidation() throws Exception {
        CreateSyllabusItemRequest invalidReq = CreateSyllabusItemRequest.builder()
                .unit("Unit 1")
                .topic("") // Blank
                .build();

        mockMvc.perform(post("/api/classrooms/cls_1/syllabus")
                        .principal(() -> "teacher@acadion.com")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidReq)))
                .andExpect(status().isBadRequest());

        verify(syllabusService, never()).createSyllabusItem(any(), any(), any());
    }

    // -------------------------------------------------------------------------
    // 9. Unauthenticated access produces 401 Unauthorized
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("9. Request without Principal produces 401 Unauthorized")
    void testRequestWithoutPrincipalFails() throws Exception {
        mockMvc.perform(get("/api/classrooms/cls_1/syllabus"))
                .andExpect(status().isUnauthorized());

        verify(syllabusService, never()).getSyllabusItems(any(), any());
    }

    // -------------------------------------------------------------------------
    // 10. Student read denied when not actively enrolled (403 Forbidden)
    // -------------------------------------------------------------------------
    @Test
    @WithMockUser(username = "pending@student.com", authorities = {"STUDENT"})
    @DisplayName("10. Student read delegates and produces 403 when service rejects non-active membership")
    void testStudentReadDeniedWhenNotActive() throws Exception {
        when(syllabusService.getSyllabusItems("cls_1", "pending@student.com"))
                .thenThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: You do not have an active enrollment in this classroom"));

        mockMvc.perform(get("/api/classrooms/cls_1/syllabus")
                        .principal(() -> "pending@student.com"))
                .andExpect(status().isForbidden());

        verify(syllabusService).getSyllabusItems("cls_1", "pending@student.com");
    }

    // -------------------------------------------------------------------------
    // 11. Student write attempt rejected with 403 Forbidden
    // -------------------------------------------------------------------------
    @Test
    @WithMockUser(username = "student@acadion.com", authorities = {"STUDENT"})
    @DisplayName("11. Student write attempt produces 403 Forbidden")
    void testStudentWriteDenied() throws Exception {
        CreateSyllabusItemRequest req = CreateSyllabusItemRequest.builder()
                .unit("Unit 1")
                .topic("Student Topic")
                .build();

        when(syllabusService.createSyllabusItem(eq("cls_1"), any(CreateSyllabusItemRequest.class), eq("student@acadion.com")))
                .thenThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: Only faculty can perform this action"));

        mockMvc.perform(post("/api/classrooms/cls_1/syllabus")
                        .principal(() -> "student@acadion.com")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isForbidden());
    }

    // -------------------------------------------------------------------------
    // 12. Unrelated teacher access rejected with 403 Forbidden
    // -------------------------------------------------------------------------
    @Test
    @WithMockUser(username = "other_teacher@acadion.com", authorities = {"TEACHER"})
    @DisplayName("12. Unrelated teacher access produces 403 Forbidden")
    void testUnrelatedTeacherDenied() throws Exception {
        when(syllabusService.getSyllabusItems("cls_1", "other_teacher@acadion.com"))
                .thenThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden: You are not authorized to manage this classroom"));

        mockMvc.perform(get("/api/classrooms/cls_1/syllabus")
                        .principal(() -> "other_teacher@acadion.com"))
                .andExpect(status().isForbidden());
    }

    // -------------------------------------------------------------------------
    // 13. Non-existent classroom returns 404 Not Found
    // -------------------------------------------------------------------------
    @Test
    @WithMockUser(username = "teacher@acadion.com", authorities = {"TEACHER"})
    @DisplayName("13. Non-existent classroom returns 404 Not Found")
    void testNonExistentClassroomReturns404() throws Exception {
        when(syllabusService.getSyllabusItems("cls_missing", "teacher@acadion.com"))
                .thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND, "Classroom not found: cls_missing"));

        mockMvc.perform(get("/api/classrooms/cls_missing/syllabus")
                        .principal(() -> "teacher@acadion.com"))
                .andExpect(status().isNotFound());
    }

    // -------------------------------------------------------------------------
    // 14. Non-existent topic or topic from different classroom returns 404 Not Found
    // -------------------------------------------------------------------------
    @Test
    @WithMockUser(username = "teacher@acadion.com", authorities = {"TEACHER"})
    @DisplayName("14. Topic from different classroom returns 404 Not Found")
    void testCrossClassroomTopicReturns404() throws Exception {
        when(syllabusService.deleteSyllabusItem("cls_1", "item_foreign", "teacher@acadion.com"))
                .thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND, "Syllabus item not found with ID item_foreign in classroom cls_1"));

        mockMvc.perform(delete("/api/classrooms/cls_1/syllabus/item_foreign")
                        .principal(() -> "teacher@acadion.com"))
                .andExpect(status().isNotFound());
    }

    // -------------------------------------------------------------------------
    // 15. Authenticated identity (from Principal) is passed to service
    // -------------------------------------------------------------------------
    @Test
    @WithMockUser(username = "faculty@acadion.com", authorities = {"TEACHER"})
    @DisplayName("15. Authenticated identity from Principal is passed to service, ignoring any client inputs")
    void testAuthenticatedIdentityPassedFromPrincipal() throws Exception {
        mockMvc.perform(get("/api/classrooms/cls_1/syllabus")
                        .principal(() -> "faculty@acadion.com"))
                .andExpect(status().isOk());

        verify(syllabusService).getSyllabusItems("cls_1", "faculty@acadion.com");
    }

    // -------------------------------------------------------------------------
    // 16. Active student sees published syllabus content
    // -------------------------------------------------------------------------
    @Test
    @WithMockUser(username = "student@acadion.com", authorities = {"STUDENT"})
    @DisplayName("16. Active student sees published syllabus content (200 OK)")
    void testActiveStudentSeesPublishedSyllabusContent() throws Exception {
        SyllabusItemResponse publishedTopic = SyllabusItemResponse.builder()
                .id("topic_pub_1")
                .classroomId("cls_1")
                .unit("Unit 1")
                .topic("Published Asymptotics")
                .status(SyllabusStatus.COMPLETED)
                .build();

        when(syllabusService.getSyllabusItems("cls_1", "student@acadion.com"))
                .thenReturn(List.of(publishedTopic));

        mockMvc.perform(get("/api/classrooms/cls_1/syllabus")
                        .principal(() -> "student@acadion.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("topic_pub_1"))
                .andExpect(jsonPath("$[0].topic").value("Published Asymptotics"));

        verify(syllabusService).getSyllabusItems("cls_1", "student@acadion.com");
    }

    // -------------------------------------------------------------------------
    // 17. Active student receives empty list if draft has never been published
    // -------------------------------------------------------------------------
    @Test
    @WithMockUser(username = "student@acadion.com", authorities = {"STUDENT"})
    @DisplayName("17. Active student receives empty list when syllabus is unpublished (200 OK)")
    void testActiveStudentReceivesEmptyListWhenUnpublished() throws Exception {
        when(syllabusService.getSyllabusItems("cls_1", "student@acadion.com"))
                .thenReturn(List.of());

        mockMvc.perform(get("/api/classrooms/cls_1/syllabus")
                        .principal(() -> "student@acadion.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(0));

        verify(syllabusService).getSyllabusItems("cls_1", "student@acadion.com");
    }

    // -------------------------------------------------------------------------
    // 18. Inactive or removed student is denied syllabus content (403 Forbidden)
    // -------------------------------------------------------------------------
    @Test
    @WithMockUser(username = "inactive@acadion.com", authorities = {"STUDENT"})
    @DisplayName("18. Inactive student cannot access syllabus content (403 Forbidden)")
    void testInactiveStudentDeniedSyllabus() throws Exception {
        when(syllabusService.getSyllabusItems("cls_1", "inactive@acadion.com"))
                .thenThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: You do not have an active enrollment in this classroom"));

        mockMvc.perform(get("/api/classrooms/cls_1/syllabus")
                        .principal(() -> "inactive@acadion.com"))
                .andExpect(status().isForbidden());
    }

    // -------------------------------------------------------------------------
    // 19. Unauthenticated request to GET syllabus returns 401 Unauthorized
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("19. Unauthenticated request to get syllabus returns 401 Unauthorized")
    void testUnauthenticatedGetSyllabusReturns401() throws Exception {
        mockMvc.perform(get("/api/classrooms/cls_1/syllabus"))
                .andExpect(status().isUnauthorized());
    }
}
