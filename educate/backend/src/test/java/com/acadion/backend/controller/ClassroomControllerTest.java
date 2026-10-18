package com.acadion.backend.controller;

import com.acadion.backend.dto.classroom.ClassroomMemberDto;
import com.acadion.backend.dto.classroom.ClassroomResponse;
import com.acadion.backend.dto.classroom.CreateClassroomRequest;
import com.acadion.backend.dto.classroom.JoinClassroomRequest;
import com.acadion.backend.dto.classroom.RegenerateJoinCodeResponse;
import com.acadion.backend.dto.classroom.RosterImportSummary;
import com.acadion.backend.service.ClassroomService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
public class ClassroomControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private ClassroomService classroomService;

    @Test
    @WithMockUser(username = "teacher@acadion.com", authorities = {"TEACHER", "ROLE_TEACHER"})
    @DisplayName("POST /api/classrooms - returns 201 Created")
    void testCreateClassroomEndpoint() throws Exception {
        CreateClassroomRequest req = CreateClassroomRequest.builder()
                .name("Data Structures")
                .subjectName("Computer Science")
                .subjectCode("21CS32")
                .department("CSE")
                .semester(3)
                .section("B")
                .academicBatch("2023-2027")
                .academicYear("2025-2026")
                .build();

        ClassroomResponse res = ClassroomResponse.builder()
                .id("cls_123")
                .name("Data Structures")
                .joinCode("DS1234")
                .status("ACTIVE")
                .build();

        when(classroomService.createClassroom(any(), eq("teacher@acadion.com"))).thenReturn(res);

        mockMvc.perform(post("/api/classrooms")
                        .principal(() -> "teacher@acadion.com")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("cls_123"))
                .andExpect(jsonPath("$.name").value("Data Structures"))
                .andExpect(jsonPath("$.joinCode").value("DS1234"));
    }

    @Test
    @WithMockUser(username = "teacher@acadion.com", authorities = {"TEACHER"})
    @DisplayName("GET /api/classrooms/teacher - returns 200 OK")
    void testGetTeacherClassrooms() throws Exception {
        when(classroomService.getTeacherClassrooms("teacher@acadion.com"))
                .thenReturn(List.of(ClassroomResponse.builder().id("cls_1").name("Class A").build()));

        mockMvc.perform(get("/api/classrooms/teacher")
                        .principal(() -> "teacher@acadion.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("cls_1"));
    }

    @Test
    @WithMockUser(username = "student@acadion.com", authorities = {"STUDENT"})
    @DisplayName("POST /api/classrooms/join - student joins classroom returns 201 Created")
    void testJoinClassroomEndpoint() throws Exception {
        JoinClassroomRequest req = JoinClassroomRequest.builder().joinCode("ACAD01").build();

        when(classroomService.submitJoinRequest("ACAD01", "student@acadion.com"))
                .thenReturn(Map.of("success", true, "status", "PENDING"));

        mockMvc.perform(post("/api/classrooms/join")
                        .principal(() -> "student@acadion.com")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.status").value("PENDING"));
    }

    @Test
    @WithMockUser(username = "teacher@acadion.com", authorities = {"TEACHER"})
    @DisplayName("POST /api/classrooms/{id}/members/{studentId}/approve - returns 200 OK")
    void testApproveStudentEndpoint() throws Exception {
        when(classroomService.approveJoinRequest("cls_1", "stu_1", "teacher@acadion.com"))
                .thenReturn(Map.of("success", true, "status", "ACTIVE"));

        mockMvc.perform(post("/api/classrooms/cls_1/members/stu_1/approve")
                        .principal(() -> "teacher@acadion.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"));
    }

    @Test
    @WithMockUser(username = "teacher@acadion.com", authorities = {"TEACHER"})
    @DisplayName("DELETE /api/classrooms/{id}/members/{studentId} - returns 200 OK")
    void testRemoveMemberEndpoint() throws Exception {
        when(classroomService.removeMember("cls_1", "stu_1", "teacher@acadion.com"))
                .thenReturn(Map.of("success", true, "status", "REMOVED"));

        mockMvc.perform(delete("/api/classrooms/cls_1/members/stu_1")
                        .principal(() -> "teacher@acadion.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REMOVED"));
    }

    @Test
    @WithMockUser(username = "teacher@acadion.com", authorities = {"TEACHER"})
    @DisplayName("POST /api/classrooms/{id}/roster/import - upload CSV returns 200 OK with summary")
    void testRosterImportEndpoint() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "roster.csv", "text/csv", "USN\n1DB21CS001".getBytes());

        RosterImportSummary summary = RosterImportSummary.builder()
                .totalRows(1)
                .validRows(1)
                .matchedCount(1)
                .addedCount(1)
                .build();

        when(classroomService.importRoster(eq("cls_1"), any(), eq("teacher@acadion.com")))
                .thenReturn(summary);

        mockMvc.perform(multipart("/api/classrooms/cls_1/roster/import")
                        .file(file)
                        .principal(() -> "teacher@acadion.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalRows").value(1))
                .andExpect(jsonPath("$.addedCount").value(1));
    }

    @Test
    @WithMockUser(username = "teacher@acadion.com", authorities = {"TEACHER"})
    @DisplayName("GET /api/classrooms/{id} - returns 200 OK with persistent join code")
    void testGetClassroomDetailsEndpoint() throws Exception {
        ClassroomResponse res = ClassroomResponse.builder()
                .id("cls_1")
                .name("Data Structures")
                .joinCode("DS1234")
                .status("ACTIVE")
                .build();

        when(classroomService.getClassroomDetails("cls_1", "teacher@acadion.com")).thenReturn(res);

        mockMvc.perform(get("/api/classrooms/cls_1")
                        .principal(() -> "teacher@acadion.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("cls_1"))
                .andExpect(jsonPath("$.joinCode").value("DS1234"));
    }

    @Test
    @WithMockUser(username = "teacher@acadion.com", authorities = {"TEACHER"})
    @DisplayName("POST /api/classrooms/{id}/join-code/regenerate - returns 200 OK with new code")
    void testRegenerateJoinCodeEndpoint() throws Exception {
        RegenerateJoinCodeResponse res = RegenerateJoinCodeResponse.builder()
                .classroomId("cls_1")
                .joinCode("NEWCOD")
                .joinCodeEnabled(true)
                .build();

        when(classroomService.regenerateJoinCode("cls_1", "teacher@acadion.com")).thenReturn(res);

        mockMvc.perform(post("/api/classrooms/cls_1/join-code/regenerate")
                        .principal(() -> "teacher@acadion.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.classroomId").value("cls_1"))
                .andExpect(jsonPath("$.joinCode").value("NEWCOD"));
    }
}
