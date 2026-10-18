package com.acadion.backend.service;

import com.acadion.backend.dto.classroom.ClassroomMemberDto;
import com.acadion.backend.dto.classroom.ClassroomResponse;
import com.acadion.backend.dto.classroom.CreateClassroomRequest;
import com.acadion.backend.dto.classroom.RegenerateJoinCodeResponse;
import com.acadion.backend.dto.classroom.RosterImportSummary;
import com.acadion.backend.entity.Classroom;
import com.acadion.backend.entity.ClassroomMembership;
import com.acadion.backend.entity.Role;
import com.acadion.backend.entity.User;
import com.acadion.backend.repository.ClassroomMembershipRepository;
import com.acadion.backend.repository.ClassroomRepository;
import com.acadion.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class ClassroomService {

    private final ClassroomRepository classroomRepository;
    private final ClassroomMembershipRepository classroomMembershipRepository;
    private final UserRepository userRepository;

    private static final String CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int CODE_LENGTH = 6;
    private static final SecureRandom RANDOM = new SecureRandom();

    // =========================================================================
    // 1. CREATE CLASSROOM (Teacher Only)
    // =========================================================================
    public ClassroomResponse createClassroom(CreateClassroomRequest request, String teacherEmail) {
        User teacher = getAuthenticatedTeacher(teacherEmail);

        String plainJoinCode = generateRandomCode();
        String joinCodeHash = hashJoinCode(plainJoinCode);
        LocalDateTime now = LocalDateTime.now();

        Classroom classroom = Classroom.builder()
                .name(request.getName().trim())
                .subjectName(request.getSubjectName().trim())
                .subjectCode(request.getSubjectCode().trim().toUpperCase())
                .teacherId(teacher.getId())
                .department(request.getDepartment().trim())
                .semester(request.getSemester())
                .section(request.getSection().trim().toUpperCase())
                .academicBatch(request.getAcademicBatch().trim())
                .academicYear(request.getAcademicYear().trim())
                .connectionMode("TEACHER_PROVISIONED")
                .joinCode(plainJoinCode)
                .joinCodeHash(joinCodeHash)
                .joinCodeEnabled(true)
                .joinCodeCreatedAt(now)
                .joinCodeExpiresAt(now.plusDays(30))
                .status("ACTIVE")
                .createdAt(now)
                .updatedAt(now)
                .build();

        Classroom saved = classroomRepository.save(classroom);
        log.info("Teacher {} created classroom '{}' ({}) with ID {}", teacher.getEmail(), saved.getName(), saved.getSubjectCode(), saved.getId());

        ClassroomResponse response = toClassroomResponse(saved, teacher.getName());
        // Plain code returned only to creating teacher
        response.setJoinCode(plainJoinCode);
        return response;
    }

    // =========================================================================
    // 2. GET TEACHER CLASSROOMS
    // =========================================================================
    public List<ClassroomResponse> getTeacherClassrooms(String teacherEmail) {
        User teacher = getAuthenticatedTeacher(teacherEmail);
        List<Classroom> classrooms = classroomRepository.findByTeacherIdOrderByCreatedAtDesc(teacher.getId());

        return classrooms.stream().map(c -> {
            ClassroomResponse res = toClassroomResponse(c, teacher.getName());
            res.setActiveMemberCount(classroomMembershipRepository.countByClassroomIdAndMembershipStatus(c.getId(), "ACTIVE"));
            res.setPendingRequestCount(classroomMembershipRepository.countByClassroomIdAndMembershipStatus(c.getId(), "PENDING"));
            res.setJoinCode(c.getJoinCode());
            return res;
        }).toList();
    }

    // =========================================================================
    // 3. GET CLASSROOM DETAILS (Teacher or Enrolled Student)
    // =========================================================================
    public ClassroomResponse getClassroomDetails(String classroomId, String userEmail) {
        Classroom classroom = getExistingClassroom(classroomId);
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User account not found"));

        User teacher = userRepository.findById(classroom.getTeacherId()).orElse(null);
        String teacherName = teacher != null ? teacher.getName() : "Faculty";

        ClassroomResponse res = toClassroomResponse(classroom, teacherName);
        res.setActiveMemberCount(classroomMembershipRepository.countByClassroomIdAndMembershipStatus(classroom.getId(), "ACTIVE"));
        res.setPendingRequestCount(classroomMembershipRepository.countByClassroomIdAndMembershipStatus(classroom.getId(), "PENDING"));

        if (classroom.getTeacherId().equals(user.getId()) || user.getRole() == Role.ADMIN) {
            // Teacher owner can see plain join code if requested or regenerated
            res.setJoinCode(classroom.getJoinCode());
            return res;
        }

        // If student, check their membership status
        if (user.getRole() == Role.STUDENT) {
            Optional<ClassroomMembership> membership = classroomMembershipRepository.findByClassroomIdAndStudentId(classroom.getId(), user.getId());
            if (membership.isEmpty() || !("ACTIVE".equals(membership.get().getMembershipStatus()) || "PENDING".equals(membership.get().getMembershipStatus()))) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: You are not enrolled in this classroom");
            }
            res.setStudentMembershipStatus(membership.get().getMembershipStatus());
            // Do NOT expose joinCode to students via details endpoint
            res.setJoinCode(null);
            return res;
        }

        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied to classroom");
    }

    // =========================================================================
    // 4. IMPORT ROSTER (CSV & XLSX) (Teacher Only)
    // =========================================================================
    public RosterImportSummary importRoster(String classroomId, MultipartFile file, String teacherEmail) {
        Classroom classroom = getExistingClassroom(classroomId);
        User teacher = getAuthenticatedTeacher(teacherEmail);
        verifyClassroomOwnership(classroom, teacher);

        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No roster file provided or file is empty");
        }

        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
        List<RosterRow> rows;

        try {
            if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
                rows = parseExcelRows(file);
            } else if (filename.endsWith(".csv") || filename.endsWith(".txt")) {
                rows = parseCsvRows(file);
            } else {
                // Try parsing as CSV by default
                rows = parseCsvRows(file);
            }
        } catch (Exception e) {
            log.error("Failed to parse roster file {}: {}", filename, e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Failed to parse roster file: " + e.getMessage());
        }

        int totalRows = rows.size();
        int validRows = 0;
        int duplicatesInFile = 0;
        int matchedCount = 0;
        int alreadyMembersCount = 0;
        int unmatchedCount = 0;
        int addedCount = 0;

        Set<String> seenUsns = new HashSet<>();
        List<String> duplicateUsns = new ArrayList<>();
        List<String> alreadyMemberUsns = new ArrayList<>();
        List<RosterImportSummary.UnmatchedStudentDetail> unmatchedStudents = new ArrayList<>();
        List<String> invalidRows = new ArrayList<>();

        LocalDateTime now = LocalDateTime.now();

        for (RosterRow row : rows) {
            String rawUsn = row.getUsn();
            if (rawUsn == null || rawUsn.trim().isEmpty()) {
                invalidRows.add("Row " + row.getRowNumber() + ": Missing or empty USN");
                continue;
            }

            String trimmed = rawUsn.trim();
            if (isHeaderOrTitleText(trimmed)) {
                continue;
            }

            String normalizedUsn = trimmed.toUpperCase();
            if (normalizedUsn.length() < 3) {
                invalidRows.add("Row " + row.getRowNumber() + ": Invalid USN format '" + rawUsn + "'");
                continue;
            }

            validRows++;

            // Deduplicate within the file
            if (!seenUsns.add(normalizedUsn)) {
                duplicatesInFile++;
                duplicateUsns.add(normalizedUsn);
                continue;
            }

            // Match against STUDENT users
            Optional<User> studentOpt = userRepository.findByUsn(normalizedUsn);
            if (studentOpt.isEmpty() && !trimmed.equals(normalizedUsn)) {
                studentOpt = userRepository.findByUsn(trimmed);
            }
            if (studentOpt.isEmpty()) {
                unmatchedCount++;
                unmatchedStudents.add(RosterImportSummary.UnmatchedStudentDetail.builder()
                        .usn(normalizedUsn)
                        .reason("Student account not found in system")
                        .rowNumber(row.getRowNumber())
                        .build());
                continue;
            }

            User student = studentOpt.get();
            if (student.getRole() != Role.STUDENT) {
                unmatchedCount++;
                unmatchedStudents.add(RosterImportSummary.UnmatchedStudentDetail.builder()
                        .usn(normalizedUsn)
                        .reason("Registered user with this USN is not a student (Role: " + student.getRole() + ")")
                        .rowNumber(row.getRowNumber())
                        .build());
                continue;
            }

            matchedCount++;

            // Check existing membership
            Optional<ClassroomMembership> existingOpt = classroomMembershipRepository
                    .findByClassroomIdAndStudentId(classroom.getId(), student.getId());

            if (existingOpt.isPresent()) {
                ClassroomMembership existing = existingOpt.get();
                if ("ACTIVE".equalsIgnoreCase(existing.getMembershipStatus())) {
                    alreadyMembersCount++;
                    alreadyMemberUsns.add(normalizedUsn);
                    continue;
                } else {
                    // Reactivate previous membership (PENDING, REJECTED, REMOVED)
                    existing.setMembershipStatus("ACTIVE");
                    existing.setMembershipSource("ROSTER");
                    existing.setApprovedAt(now);
                    existing.setApprovedBy(teacher.getId());
                    existing.setUsnSnapshot(normalizedUsn);
                    existing.setSemester(classroom.getSemester());
                    existing.setAcademicYear(classroom.getAcademicYear());
                    existing.setUpdatedAt(now);
                    classroomMembershipRepository.save(existing);
                    addedCount++;
                }
            } else {
                // Create new ACTIVE membership
                ClassroomMembership newMembership = ClassroomMembership.builder()
                        .classroomId(classroom.getId())
                        .studentId(student.getId())
                        .usnSnapshot(normalizedUsn)
                        .membershipSource("ROSTER")
                        .membershipStatus("ACTIVE")
                        .requestedAt(now)
                        .approvedAt(now)
                        .approvedBy(teacher.getId())
                        .semester(classroom.getSemester())
                        .academicYear(classroom.getAcademicYear())
                        .createdAt(now)
                        .updatedAt(now)
                        .build();

                classroomMembershipRepository.save(newMembership);
                addedCount++;
            }
        }

        classroom.setUpdatedAt(now);
        classroomRepository.save(classroom);

        log.info("Roster import completed for classroom {}: Total={}, Matched={}, Added={}, AlreadyMembers={}, Unmatched={}",
                classroom.getId(), totalRows, matchedCount, addedCount, alreadyMembersCount, unmatchedCount);

        return RosterImportSummary.builder()
                .totalRows(totalRows)
                .validRows(validRows)
                .duplicatesInFile(duplicatesInFile)
                .matchedCount(matchedCount)
                .alreadyMembersCount(alreadyMembersCount)
                .unmatchedCount(unmatchedCount)
                .addedCount(addedCount)
                .unmatchedStudents(unmatchedStudents)
                .duplicateUsns(duplicateUsns)
                .alreadyMemberUsns(alreadyMemberUsns)
                .invalidRows(invalidRows)
                .build();
    }

    // =========================================================================
    // 5. GET CLASSROOM MEMBERS (Teacher Only)
    // =========================================================================
    public List<ClassroomMemberDto> getClassroomMembers(String classroomId, String teacherEmail) {
        Classroom classroom = getExistingClassroom(classroomId);
        User teacher = getAuthenticatedTeacher(teacherEmail);
        verifyClassroomOwnership(classroom, teacher);

        List<ClassroomMembership> memberships = classroomMembershipRepository
                .findByClassroomIdAndMembershipStatus(classroomId, "ACTIVE");

        return memberships.stream().map(m -> {
            User student = userRepository.findById(m.getStudentId()).orElse(null);
            String roleName = student != null && student.getRole() != null ? student.getRole().name() : "STUDENT";
            LocalDateTime joined = m.getApprovedAt() != null ? m.getApprovedAt() : m.getCreatedAt();
            return ClassroomMemberDto.builder()
                    .id(m.getStudentId())
                    .membershipId(m.getId())
                    .classroomId(m.getClassroomId())
                    .studentId(m.getStudentId())
                    .studentName(student != null ? student.getName() : "Unknown Student")
                    .studentEmail(student != null ? student.getEmail() : "N/A")
                    .usn(m.getUsnSnapshot() != null ? m.getUsnSnapshot() : (student != null ? student.getUsn() : "N/A"))
                    .role(roleName)
                    .status(m.getMembershipStatus())
                    .membershipStatus(m.getMembershipStatus())
                    .membershipSource(m.getMembershipSource())
                    .academicYear(m.getAcademicYear())
                    .semester(m.getSemester())
                    .requestedAt(m.getRequestedAt())
                    .approvedAt(m.getApprovedAt())
                    .joinedAt(joined)
                    .createdAt(m.getCreatedAt())
                    .build();
        }).sorted(Comparator.comparing(ClassroomMemberDto::getStudentName, String.CASE_INSENSITIVE_ORDER)).toList();
    }

    // =========================================================================
    // 6. STUDENT SUBMITS JOIN REQUEST VIA JOIN CODE
    // =========================================================================
    public Map<String, Object> submitJoinRequest(String rawJoinCode, String studentEmail) {
        if (rawJoinCode == null || rawJoinCode.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Join code must not be empty");
        }

        User student = userRepository.findByEmail(studentEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Student account not found"));

        if (student.getRole() != Role.STUDENT) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only student accounts can join classrooms with a join code");
        }

        String normalizedCode = normalizeJoinCode(rawJoinCode);
        String hashedCode = hashJoinCode(normalizedCode);

        Classroom classroom = classroomRepository.findByJoinCodeHash(hashedCode)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invalid join code: Classroom not found"));

        if (!"ACTIVE".equalsIgnoreCase(classroom.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Classroom is inactive or archived");
        }

        if (!classroom.isJoinCodeEnabled()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Join code is disabled for this classroom");
        }

        if (classroom.getJoinCodeExpiresAt() != null && LocalDateTime.now().isAfter(classroom.getJoinCodeExpiresAt())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This classroom join code has expired. Please ask the teacher to regenerate it.");
        }

        LocalDateTime now = LocalDateTime.now();
        Optional<ClassroomMembership> existingOpt = classroomMembershipRepository
                .findByClassroomIdAndStudentId(classroom.getId(), student.getId());

        if (existingOpt.isPresent()) {
            ClassroomMembership existing = existingOpt.get();
            if ("ACTIVE".equalsIgnoreCase(existing.getMembershipStatus())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "You are already an active enrolled member of this classroom");
            }
            if ("PENDING".equalsIgnoreCase(existing.getMembershipStatus())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Your join request for this classroom is already pending teacher approval");
            }

            // Re-requesting if previously REJECTED or REMOVED
            existing.setMembershipStatus("PENDING");
            existing.setMembershipSource("JOIN_CODE");
            existing.setRequestedAt(now);
            existing.setApprovedAt(null);
            existing.setApprovedBy(null);
            existing.setUsnSnapshot(student.getUsn());
            existing.setSemester(classroom.getSemester());
            existing.setAcademicYear(classroom.getAcademicYear());
            existing.setUpdatedAt(now);
            classroomMembershipRepository.save(existing);
        } else {
            ClassroomMembership newMembership = ClassroomMembership.builder()
                    .classroomId(classroom.getId())
                    .studentId(student.getId())
                    .usnSnapshot(student.getUsn())
                    .membershipSource("JOIN_CODE")
                    .membershipStatus("PENDING")
                    .requestedAt(now)
                    .semester(classroom.getSemester())
                    .academicYear(classroom.getAcademicYear())
                    .createdAt(now)
                    .updatedAt(now)
                    .build();

            classroomMembershipRepository.save(newMembership);
        }

        log.info("Student {} ({}) requested to join classroom '{}' ({}) via join code",
                student.getEmail(), student.getUsn(), classroom.getName(), classroom.getSubjectCode());

        return Map.of(
                "success", true,
                "message", "Join request submitted successfully. Awaiting teacher approval.",
                "classroomId", classroom.getId(),
                "classroomName", classroom.getName(),
                "subjectName", classroom.getSubjectName(),
                "status", "PENDING"
        );
    }

    // =========================================================================
    // 7. GET JOIN REQUESTS (Teacher Only)
    // =========================================================================
    public List<ClassroomMemberDto> getJoinRequests(String classroomId, String teacherEmail) {
        Classroom classroom = getExistingClassroom(classroomId);
        User teacher = getAuthenticatedTeacher(teacherEmail);
        verifyClassroomOwnership(classroom, teacher);

        List<ClassroomMembership> pendingList = classroomMembershipRepository
                .findByClassroomIdAndMembershipStatus(classroomId, "PENDING");

        return pendingList.stream().map(m -> {
            User student = userRepository.findById(m.getStudentId()).orElse(null);
            String roleName = student != null && student.getRole() != null ? student.getRole().name() : "STUDENT";
            return ClassroomMemberDto.builder()
                    .id(m.getStudentId())
                    .membershipId(m.getId())
                    .classroomId(m.getClassroomId())
                    .studentId(m.getStudentId())
                    .studentName(student != null ? student.getName() : "Unknown Student")
                    .studentEmail(student != null ? student.getEmail() : "N/A")
                    .usn(m.getUsnSnapshot() != null ? m.getUsnSnapshot() : (student != null ? student.getUsn() : "N/A"))
                    .role(roleName)
                    .status(m.getMembershipStatus())
                    .membershipStatus(m.getMembershipStatus())
                    .membershipSource(m.getMembershipSource())
                    .academicYear(m.getAcademicYear())
                    .semester(m.getSemester())
                    .requestedAt(m.getRequestedAt())
                    .createdAt(m.getCreatedAt())
                    .build();
        }).toList();
    }

    // =========================================================================
    // 8. APPROVE JOIN REQUEST (Teacher Only)
    // =========================================================================
    public Map<String, Object> approveJoinRequest(String classroomId, String studentId, String teacherEmail) {
        Classroom classroom = getExistingClassroom(classroomId);
        User teacher = getAuthenticatedTeacher(teacherEmail);
        verifyClassroomOwnership(classroom, teacher);

        ClassroomMembership membership = classroomMembershipRepository
                .findByClassroomIdAndStudentId(classroomId, studentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Membership request not found"));

        membership.setMembershipStatus("ACTIVE");
        membership.setApprovedAt(LocalDateTime.now());
        membership.setApprovedBy(teacher.getId());
        membership.setUpdatedAt(LocalDateTime.now());

        classroomMembershipRepository.save(membership);
        log.info("Teacher {} approved student {} in classroom {}", teacher.getEmail(), studentId, classroomId);

        return Map.of(
                "success", true,
                "message", "Student approved successfully into classroom",
                "studentId", studentId,
                "classroomId", classroomId,
                "status", "ACTIVE"
        );
    }

    // =========================================================================
    // 9. REJECT JOIN REQUEST (Teacher Only)
    // =========================================================================
    public Map<String, Object> rejectJoinRequest(String classroomId, String studentId, String teacherEmail) {
        Classroom classroom = getExistingClassroom(classroomId);
        User teacher = getAuthenticatedTeacher(teacherEmail);
        verifyClassroomOwnership(classroom, teacher);

        ClassroomMembership membership = classroomMembershipRepository
                .findByClassroomIdAndStudentId(classroomId, studentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Membership request not found"));

        membership.setMembershipStatus("REJECTED");
        membership.setUpdatedAt(LocalDateTime.now());

        classroomMembershipRepository.save(membership);
        log.info("Teacher {} rejected student {} join request in classroom {}", teacher.getEmail(), studentId, classroomId);

        return Map.of(
                "success", true,
                "message", "Student join request rejected",
                "studentId", studentId,
                "classroomId", classroomId,
                "status", "REJECTED"
        );
    }

    // =========================================================================
    // 10. REMOVE MEMBER (Teacher Only)
    // =========================================================================
    public Map<String, Object> removeMember(String classroomId, String studentId, String teacherEmail) {
        Classroom classroom = getExistingClassroom(classroomId);
        User teacher = getAuthenticatedTeacher(teacherEmail);
        verifyClassroomOwnership(classroom, teacher);

        ClassroomMembership membership = classroomMembershipRepository
                .findByClassroomIdAndStudentId(classroomId, studentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Classroom membership not found"));

        membership.setMembershipStatus("REMOVED");
        membership.setUpdatedAt(LocalDateTime.now());

        classroomMembershipRepository.save(membership);
        log.info("Teacher {} removed student {} from classroom {}", teacher.getEmail(), studentId, classroomId);

        return Map.of(
                "success", true,
                "message", "Student removed from classroom successfully",
                "studentId", studentId,
                "classroomId", classroomId,
                "status", "REMOVED"
        );
    }

    // =========================================================================
    // 11. REGENERATE JOIN CODE (Teacher Only)
    // =========================================================================
    public RegenerateJoinCodeResponse regenerateJoinCode(String classroomId, String teacherEmail) {
        Classroom classroom = getExistingClassroom(classroomId);
        User teacher = getAuthenticatedTeacher(teacherEmail);
        verifyClassroomOwnership(classroom, teacher);

        String newPlainCode = generateRandomCode();
        String newHash = hashJoinCode(newPlainCode);
        LocalDateTime now = LocalDateTime.now();

        classroom.setJoinCode(newPlainCode);
        classroom.setJoinCodeHash(newHash);
        classroom.setJoinCodeEnabled(true);
        classroom.setJoinCodeCreatedAt(now);
        classroom.setJoinCodeExpiresAt(now.plusDays(30));
        classroom.setUpdatedAt(now);

        classroomRepository.save(classroom);
        log.info("Teacher {} regenerated join code for classroom {}", teacher.getEmail(), classroomId);

        return RegenerateJoinCodeResponse.builder()
                .classroomId(classroomId)
                .joinCode(newPlainCode)
                .joinCodeCreatedAt(now)
                .joinCodeExpiresAt(classroom.getJoinCodeExpiresAt())
                .joinCodeEnabled(true)
                .message("New join code generated successfully. Previous codes are invalidated.")
                .build();
    }

    // =========================================================================
    // 12. GET STUDENT CLASSROOMS
    // =========================================================================
    public List<ClassroomResponse> getStudentClassrooms(String studentEmail) {
        User student = userRepository.findByEmail(studentEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Student account not found"));

        if (student.getRole() != Role.STUDENT) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only students can query enrolled classrooms");
        }

        List<ClassroomMembership> memberships = classroomMembershipRepository.findByStudentId(student.getId());

        return memberships.stream().map(m -> {
            Classroom c = classroomRepository.findById(m.getClassroomId()).orElse(null);
            if (c == null) return null;

            User teacher = userRepository.findById(c.getTeacherId()).orElse(null);
            ClassroomResponse res = toClassroomResponse(c, teacher != null ? teacher.getName() : "Faculty");
            res.setStudentMembershipStatus(m.getMembershipStatus());
            res.setActiveMemberCount(classroomMembershipRepository.countByClassroomIdAndMembershipStatus(c.getId(), "ACTIVE"));
            res.setJoinCode(null); // Never expose to student
            return res;
        }).filter(Objects::nonNull).toList();
    }

    // =========================================================================
    // HELPER & SECURITY METHODS
    // =========================================================================

    private User getAuthenticatedTeacher(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Teacher account not found"));

        if (user.getRole() != Role.TEACHER && user.getRole() != Role.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: Only faculty can perform this action");
        }
        return user;
    }

    private Classroom getExistingClassroom(String classroomId) {
        return classroomRepository.findById(classroomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Classroom not found: " + classroomId));
    }

    private void verifyClassroomOwnership(Classroom classroom, User teacher) {
        if (!classroom.getTeacherId().equals(teacher.getId()) && teacher.getRole() != Role.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden: You are not authorized to manage this classroom");
        }
    }

    public static String generateRandomCode() {
        StringBuilder sb = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            sb.append(CODE_CHARS.charAt(RANDOM.nextInt(CODE_CHARS.length())));
        }
        return sb.toString();
    }

    public static String normalizeJoinCode(String code) {
        if (code == null) return "";
        return code.replaceAll("[\\s\\-_]+", "").toUpperCase();
    }

    public static String hashJoinCode(String rawCode) {
        try {
            String normalized = normalizeJoinCode(rawCode);
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(normalized.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception e) {
            throw new RuntimeException("Error computing join code hash", e);
        }
    }

    private ClassroomResponse toClassroomResponse(Classroom c, String teacherName) {
        return ClassroomResponse.builder()
                .id(c.getId())
                .name(c.getName())
                .subjectName(c.getSubjectName())
                .subjectCode(c.getSubjectCode())
                .teacherId(c.getTeacherId())
                .teacherName(teacherName)
                .department(c.getDepartment())
                .semester(c.getSemester())
                .section(c.getSection())
                .academicBatch(c.getAcademicBatch())
                .academicYear(c.getAcademicYear())
                .connectionMode(c.getConnectionMode())
                .status(c.getStatus())
                .joinCodeEnabled(c.isJoinCodeEnabled())
                .joinCodeExpiresAt(c.getJoinCodeExpiresAt())
                .createdAt(c.getCreatedAt())
                .updatedAt(c.getUpdatedAt())
                .build();
    }

    // =========================================================================
    // FILE PARSING HELPERS (CSV & Excel)
    // =========================================================================

    private List<RosterRow> parseCsvRows(MultipartFile file) throws Exception {
        List<RosterRow> list = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            int rowNum = 0;
            int usnColIndex = -1;

            while ((line = reader.readLine()) != null) {
                rowNum++;
                line = line.trim();
                if (line.isEmpty()) continue;

                String[] tokens = parseCsvLine(line);
                if (tokens.length == 0 || isTokensAllEmpty(tokens)) {
                    continue;
                }

                // If header row not found yet, search this row for headers
                if (usnColIndex == -1) {
                    int candidateUsnCol = findUsnColumnInTokens(tokens);
                    if (candidateUsnCol != -1) {
                        usnColIndex = candidateUsnCol;
                        continue; // Skip the header row itself
                    }
                    // Not a header row (e.g. title line): ignore and continue searching
                    continue;
                }

                // Header already found: check if this is a repeated header row
                if (isHeaderRowTokens(tokens, usnColIndex)) {
                    continue;
                }

                // Extract USN
                if (usnColIndex < tokens.length) {
                    String rawUsn = cleanToken(tokens[usnColIndex]);
                    if (rawUsn.isEmpty()) {
                        list.add(new RosterRow(rowNum, ""));
                        continue;
                    }
                    if (isHeaderOrTitleText(rawUsn)) {
                        continue;
                    }
                    list.add(new RosterRow(rowNum, rawUsn));
                } else {
                    list.add(new RosterRow(rowNum, ""));
                }
            }

            if (usnColIndex == -1) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Unable to find valid roster header (missing 'USN' column). Please ensure the file contains a 'USN' column header.");
            }
        }
        return list;
    }

    private List<RosterRow> parseExcelRows(MultipartFile file) throws Exception {
        List<RosterRow> list = new ArrayList<>();
        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            if (workbook.getNumberOfSheets() == 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The Excel workbook has no sheets");
            }
            Sheet sheet = workbook.getSheetAt(0);
            if (sheet == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The Excel worksheet is empty");
            }

            int usnColIndex = -1;
            DataFormatter formatter = new DataFormatter();

            for (Row row : sheet) {
                if (row == null || isRowEmpty(row, formatter)) {
                    continue;
                }

                int rowNum = row.getRowNum() + 1;

                // If header row not found yet, search this row for headers
                if (usnColIndex == -1) {
                    int candidateUsnCol = findUsnColumnInRow(row, formatter);
                    if (candidateUsnCol != -1) {
                        usnColIndex = candidateUsnCol;
                        continue; // Skip the header row itself
                    }
                    // Not a header row (e.g. title row): ignore and continue searching
                    continue;
                }

                // Header already found: check for repeated header row
                if (isHeaderRow(row, formatter, usnColIndex)) {
                    continue;
                }

                Cell targetCell = row.getCell(usnColIndex);
                String cellValue = targetCell != null ? formatter.formatCellValue(targetCell).trim() : "";

                if (cellValue.isEmpty()) {
                    if (!isRowEmpty(row, formatter)) {
                        list.add(new RosterRow(rowNum, ""));
                    }
                    continue;
                }

                if (isHeaderOrTitleText(cellValue)) {
                    continue;
                }

                list.add(new RosterRow(rowNum, cellValue));
            }

            if (usnColIndex == -1) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Unable to find valid roster header (missing 'USN' column). Please ensure the file contains a 'USN' column header.");
            }
        }
        return list;
    }

    private static String[] parseCsvLine(String line) {
        if (line == null) return new String[0];
        List<String> tokens = new ArrayList<>();
        StringBuilder sb = new StringBuilder();
        boolean inQuotes = false;
        char[] chars = line.toCharArray();

        for (int i = 0; i < chars.length; i++) {
            char c = chars[i];
            if (c == '"' || c == '\'') {
                inQuotes = !inQuotes;
            } else if ((c == ',' || c == ';') && !inQuotes) {
                tokens.add(sb.toString().trim());
                sb.setLength(0);
            } else {
                sb.append(c);
            }
        }
        tokens.add(sb.toString().trim());
        return tokens.toArray(new String[0]);
    }

    private static String cleanToken(String token) {
        if (token == null) return "";
        return token.replaceAll("^[\"']+|[\"']+$", "").trim();
    }

    private static boolean isTokensAllEmpty(String[] tokens) {
        for (String t : tokens) {
            if (t != null && !cleanToken(t).isEmpty()) return false;
        }
        return true;
    }

    private static boolean isRowEmpty(Row row, DataFormatter formatter) {
        if (row == null) return true;
        for (Cell cell : row) {
            if (cell != null && !formatter.formatCellValue(cell).trim().isEmpty()) {
                return false;
            }
        }
        return true;
    }

    private static boolean isUsnHeaderCell(String text) {
        if (text == null) return false;
        String clean = text.trim().toLowerCase().replaceAll("[^a-z0-9]", "");
        if (clean.equals("usn")
                || clean.equals("studentusn")
                || clean.equals("rollno")
                || clean.equals("rollnumber")
                || clean.equals("rollnum")
                || clean.equals("seatno")
                || clean.equals("seatnumber")
                || clean.equals("universityseatnumber")
                || clean.equals("univseatno")
                || clean.equals("registrationno")
                || clean.equals("regno")) {
            return true;
        }
        return (clean.startsWith("usn") && !clean.contains("user"))
                || clean.contains("studentusn")
                || clean.contains("seatnumber")
                || clean.contains("seatno");
    }

    private int findUsnColumnInRow(Row row, DataFormatter formatter) {
        int candidateCol = -1;
        for (Cell cell : row) {
            if (cell == null) continue;
            String val = formatter.formatCellValue(cell).trim();
            if (val.isEmpty()) continue;
            if (isUsnHeaderCell(val)) {
                candidateCol = cell.getColumnIndex();
                break;
            }
        }
        return candidateCol;
    }

    private int findUsnColumnInTokens(String[] tokens) {
        for (int i = 0; i < tokens.length; i++) {
            String val = cleanToken(tokens[i]);
            if (isUsnHeaderCell(val)) {
                return i;
            }
        }
        return -1;
    }

    private boolean isHeaderRow(Row row, DataFormatter formatter, int usnColIndex) {
        if (row == null) return false;
        Cell targetCell = row.getCell(usnColIndex);
        if (targetCell != null) {
            String val = formatter.formatCellValue(targetCell).trim();
            if (isUsnHeaderCell(val) || isHeaderOrTitleText(val)) {
                return true;
            }
        }
        Cell firstCell = row.getCell(0);
        if (firstCell != null) {
            String firstVal = formatter.formatCellValue(firstCell).trim();
            if (isHeaderOrTitleText(firstVal) && !firstVal.matches("^\\d+$")) {
                return true;
            }
        }
        return false;
    }

    private boolean isHeaderRowTokens(String[] tokens, int usnColIndex) {
        if (tokens == null || tokens.length == 0) return false;
        if (usnColIndex < tokens.length) {
            String val = cleanToken(tokens[usnColIndex]);
            if (isUsnHeaderCell(val) || isHeaderOrTitleText(val)) {
                return true;
            }
        }
        String firstVal = cleanToken(tokens[0]);
        if (isHeaderOrTitleText(firstVal) && !firstVal.matches("^\\d+$")) {
            return true;
        }
        return false;
    }

    private static boolean isHeaderOrTitleText(String text) {
        if (text == null) return true;
        String trimmed = text.trim();
        if (trimmed.isEmpty()) return true;

        String clean = trimmed.toLowerCase().replaceAll("[^a-z0-9]", "");
        if (clean.isEmpty()) return true;

        return clean.equals("usn")
                || clean.equals("studentusn")
                || clean.equals("rollno")
                || clean.equals("rollnumber")
                || clean.equals("rollnum")
                || clean.equals("seatno")
                || clean.equals("seatnumber")
                || clean.equals("slno")
                || clean.equals("sno")
                || clean.equals("serialno")
                || clean.equals("studentname")
                || clean.equals("name")
                || clean.equals("email")
                || clean.equals("emailaddress")
                || clean.equals("semester")
                || clean.equals("department")
                || clean.equals("approvalstatus")
                || clean.equals("status")
                || clean.equals("registrationdate")
                || clean.equals("approveddate")
                || clean.contains("acadionlms")
                || clean.contains("approvedstudentsreport")
                || clean.contains("studentsreport")
                || clean.contains("rosterreport");
    }

    @lombok.Value
    private static class RosterRow {
        int rowNumber;
        String usn;
    }
}
