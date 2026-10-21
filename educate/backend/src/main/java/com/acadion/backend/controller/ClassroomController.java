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

    // 4b. Update Classroom Settings (Teacher owner or Admin)
    @PutMapping("/{id}")
    public ResponseEntity<ClassroomResponse> updateClassroom(
            @PathVariable("id") String id,
            @RequestBody com.acadion.backend.dto.classroom.UpdateClassroomRequest request,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        return ResponseEntity.ok(classroomService.updateClassroom(id, request, email));
    }

    // 4c. Delete Classroom (Teacher owner or Admin)
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> deleteClassroom(
            @PathVariable("id") String id,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        return ResponseEntity.ok(classroomService.deleteClassroom(id, email));
    }

    // 5. Upload Roster (CSV / XLSX)
    @PostMapping(value = {"/{id}/upload-roster", "/{id}/roster/import"}, consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<RosterImportSummary> uploadRoster(
            @PathVariable("id") String id,
            @RequestParam("file") MultipartFile file,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        RosterImportSummary summary = classroomService.importRoster(id, file, email);
        return ResponseEntity.ok(summary);
    }

    // 5b. Parse Roster File (Excel / CSV) - Checks USNs in DB without enrolling yet
    @PostMapping(value = "/{id}/roster/parse", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<com.acadion.backend.dto.classroom.RosterParseResult> parseRosterPreview(
            @PathVariable("id") String id,
            @RequestParam("file") MultipartFile file,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        return ResponseEntity.ok(classroomService.parseRosterPreview(id, file, email));
    }

    // 5c. Enroll Batch of Students (All or Selected from parsed list)
    @PostMapping("/{id}/roster/enroll-batch")
    public ResponseEntity<Map<String, Object>> enrollBatch(
            @PathVariable("id") String id,
            @RequestBody com.acadion.backend.dto.classroom.BulkEnrollRequest request,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        return ResponseEntity.ok(classroomService.enrollBatch(id, request, email));
    }

    // 5d. Add Single Student manually by USN or Email
    @PostMapping("/{id}/add-student")
    public ResponseEntity<Map<String, Object>> addStudent(
            @PathVariable("id") String id,
            @RequestBody com.acadion.backend.dto.classroom.AddStudentRequest request,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        Map<String, Object> result = classroomService.addStudent(id, request, email);
        return ResponseEntity.ok(result);
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

    // 6b. Remove All Members from Classroom (Teacher only)
    @DeleteMapping("/{id}/members")
    public ResponseEntity<Map<String, Object>> removeAllMembers(
            @PathVariable("id") String id,
            Principal principal
    ) {
        String email = getAuthenticatedEmail(principal);
        return ResponseEntity.ok(classroomService.removeAllMembers(id, email));
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
    @PostMapping(value = {"/{id}/join-code/regenerate", "/{id}/regenerate-code"})
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
