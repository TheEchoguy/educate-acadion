package com.acadion.backend.controller;

import com.acadion.backend.dto.classroom.ClassroomMemberDto;
import com.acadion.backend.dto.classroom.ClassroomResponse;
import com.acadion.backend.dto.classroom.CreateClassroomRequest;
import com.acadion.backend.dto.classroom.JoinClassroomRequest;
import com.acadion.backend.dto.classroom.RegenerateJoinCodeResponse;
import com.acadion.backend.dto.classroom.RosterImportSummary;
import com.acadion.backend.service.ClassroomService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/classrooms")
@RequiredArgsConstructor
public class ClassroomController {

    private final ClassroomService classroomService;

    // 1. Create Classroom (Teacher only, identity from JWT)
    @PostMapping
    public ResponseEntity<ClassroomResponse> createClassroom(
            @Valid @RequestBody CreateClassroomRequest request,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        ClassroomResponse response = classroomService.createClassroom(request, email);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // 2. Get Classrooms Belonging to Authenticated Teacher
    @GetMapping("/teacher")
    public ResponseEntity<List<ClassroomResponse>> getTeacherClassrooms(Principal principal) {
        String email = getAuthenticatedEmail(principal);
        return ResponseEntity.ok(classroomService.getTeacherClassrooms(email));
    }

    // 3. Get Classrooms Belonging to Authenticated Student
    @GetMapping("/student")
    public ResponseEntity<List<ClassroomResponse>> getStudentClassrooms(Principal principal) {
        String email = getAuthenticatedEmail(principal);
        return ResponseEntity.ok(classroomService.getStudentClassrooms(email));
    }

    // 4. Get Classroom Details (Authorized Teacher or Student)
    @GetMapping("/{id}")
    public ResponseEntity<ClassroomResponse> getClassroomDetails(
            @PathVariable("id") String id,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        return ResponseEntity.ok(classroomService.getClassroomDetails(id, email));
    }

    // 5. Upload Roster (CSV / XLSX)
    @PostMapping(value = "/{id}/roster/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<RosterImportSummary> importRoster(
            @PathVariable("id") String id,
            @RequestParam("file") MultipartFile file,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        RosterImportSummary summary = classroomService.importRoster(id, file, email);
        return ResponseEntity.ok(summary);
    }

    // 6. Get Classroom Members (Teacher only)
    @GetMapping("/{id}/members")
    public ResponseEntity<List<ClassroomMemberDto>> getClassroomMembers(
            @PathVariable("id") String id,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        return ResponseEntity.ok(classroomService.getClassroomMembers(id, email));
    }

    // 7. Student Submits Join-Code Request
    @PostMapping("/join")
    public ResponseEntity<Map<String, Object>> joinClassroom(
            @Valid @RequestBody JoinClassroomRequest request,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        Map<String, Object> result = classroomService.submitJoinRequest(request.getJoinCode(), email);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    // 8. Get Pending Join Requests (Teacher only)
    @GetMapping("/{id}/join-requests")
    public ResponseEntity<List<ClassroomMemberDto>> getJoinRequests(
            @PathVariable("id") String id,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        return ResponseEntity.ok(classroomService.getJoinRequests(id, email));
    }

    // 9. Approve Pending Membership (Teacher only)
    @PostMapping("/{id}/members/{studentId}/approve")
    public ResponseEntity<Map<String, Object>> approveJoinRequest(
            @PathVariable("id") String id,
            @PathVariable("studentId") String studentId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        return ResponseEntity.ok(classroomService.approveJoinRequest(id, studentId, email));
    }

    // 10. Reject Pending Membership (Teacher only)
    @PostMapping("/{id}/members/{studentId}/reject")
    public ResponseEntity<Map<String, Object>> rejectJoinRequest(
            @PathVariable("id") String id,
            @PathVariable("studentId") String studentId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        return ResponseEntity.ok(classroomService.rejectJoinRequest(id, studentId, email));
    }

    // 11. Remove Member from Classroom (Teacher only)
    @DeleteMapping("/{id}/members/{studentId}")
    public ResponseEntity<Map<String, Object>> removeMember(
            @PathVariable("id") String id,
            @PathVariable("studentId") String studentId,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        return ResponseEntity.ok(classroomService.removeMember(id, studentId, email));
    }

    // 12. Regenerate Join Code (Teacher only)
    @PostMapping("/{id}/join-code/regenerate")
    public ResponseEntity<RegenerateJoinCodeResponse> regenerateJoinCode(
            @PathVariable("id") String id,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        return ResponseEntity.ok(classroomService.regenerateJoinCode(id, email));
    }

    private String getAuthenticatedEmail(Principal principal) {
        if (principal == null || principal.getName() == null || principal.getName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User authentication required");
        }
        return principal.getName();
    }
}
