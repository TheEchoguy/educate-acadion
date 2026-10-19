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
    private final org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder passwordEncoder;

    private static final String CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int CODE_LENGTH = 6;
    private static final SecureRandom RANDOM = new SecureRandom();

    private static final java.util.regex.Pattern VTU_USN_PATTERN = java.util.regex.Pattern.compile("(?i)\\b([0-9][A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{3})\\b");
    private static final java.util.regex.Pattern EMAIL_PATTERN = java.util.regex.Pattern.compile("(?i)\\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,})\\b");

    // =========================================================================
    // 1. CREATE CLASSROOM (Teacher Only)
    // =========================================================================
    public ClassroomResponse createClassroom(CreateClassroomRequest request, String teacherEmail) {
        User teacher = getAuthenticatedTeacher(teacherEmail);

        String plainJoinCode = generateRandomCode();
        String joinCodeHash = hashJoinCode(plainJoinCode);
        LocalDateTime now = LocalDateTime.now();

        String effectiveCourseCode = request.getEffectiveCourseCode().toUpperCase();
        String effectiveSubjectName = request.getEffectiveSubjectName();

        Classroom classroom = Classroom.builder()
                .name(request.getName().trim())
                .courseCode(effectiveCourseCode)
                .subjectName(effectiveSubjectName)
                .subjectCode(effectiveCourseCode)
                .teacherId(teacher.getId())
                .department(request.getEffectiveDepartment())
                .semester(request.getSemester())
                .section(request.getSection().trim().toUpperCase())
                .academicBatch(request.getEffectiveAcademicBatch())
                .academicYear(request.getEffectiveAcademicYear())
                .connectionMode("TEACHER_PROVISIONED")
                .joinCode(plainJoinCode)
                .joinCodeHash(joinCodeHash)
                .joinCodeEnabled(true)
                .joinCodeCreatedAt(now)
                .joinCodeExpiresAt(now.plusDays(30))
                .studentIds(new ArrayList<>())
                .enrolledStudents(new ArrayList<>())
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
    // 4. ADD SINGLE STUDENT (Teacher Only)
    // =========================================================================
    public Map<String, Object> addStudent(String classroomId, com.acadion.backend.dto.classroom.AddStudentRequest request, String teacherEmail) {
        Classroom classroom = getExistingClassroom(classroomId);
        User teacher = getAuthenticatedTeacher(teacherEmail);
        verifyClassroomOwnership(classroom, teacher);

        String rawUsn = request.getUsn() != null ? request.getUsn().trim() : null;
        String rawEmail = request.getEmail() != null ? request.getEmail().trim() : null;
        String rawName = request.getName() != null ? request.getName().trim() : null;

        if ((rawUsn == null || rawUsn.isBlank()) && (rawEmail == null || rawEmail.isBlank())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "USN or Email is required to add a student");
        }

        // 1. Check if user already exists by USN or Email
        Optional<User> existingUserOpt = Optional.empty();
        if (rawUsn != null && !rawUsn.isBlank()) {
            existingUserOpt = userRepository.findByUsnIgnoreCase(rawUsn);
        }
        if (existingUserOpt.isEmpty() && rawEmail != null && !rawEmail.isBlank()) {
            existingUserOpt = userRepository.findByEmailIgnoreCase(rawEmail);
        }

        User student;
        boolean accountCreated = false;

        if (existingUserOpt.isPresent()) {
            student = existingUserOpt.get();
        } else {
            // Auto-create verified Student account
            String normalizedUsn = rawUsn != null && !rawUsn.isBlank() ? rawUsn.toUpperCase() : null;
            String studentName = rawName != null && !rawName.isBlank() ? rawName : (normalizedUsn != null ? "Student " + normalizedUsn : "Student");
            String studentEmail = rawEmail != null && !rawEmail.isBlank() ? rawEmail.toLowerCase()
                    : (normalizedUsn != null ? normalizedUsn.toLowerCase() + "@student.acadion.edu" : "student_" + System.currentTimeMillis() + "@student.acadion.edu");

            student = User.builder()
                    .name(studentName)
                    .email(studentEmail)
                    .usn(normalizedUsn)
                    .password(passwordEncoder.encode("Student@123"))
                    .role(Role.STUDENT)
                    .verified(true)
                    .approved(true)
                    .banned(false)
                    .semester(classroom.getSemester())
                    .studentDepartment(classroom.getDepartment())
                    .createdAt(LocalDateTime.now())
                    .approvedAt(LocalDateTime.now())
                    .build();

            student = userRepository.save(student);
            accountCreated = true;
            log.info("Auto-provisioned new Student account for USN '{}', Email '{}'", student.getUsn(), student.getEmail());
        }

        // Ensure active membership & classroom document enrollment
        ensureActiveMembership(classroom, student, "MANUAL_ADD", teacher.getId());
        enrollStudentInClassroomDoc(classroom, student);
        classroom.setUpdatedAt(LocalDateTime.now());
        classroomRepository.save(classroom);

        return Map.of(
                "success", true,
                "message", accountCreated
                        ? "New student account created and enrolled successfully in classroom"
                        : "Existing student linked and enrolled in classroom",
                "accountCreated", accountCreated,
                "studentId", student.getId(),
                "usn", student.getUsn() != null ? student.getUsn() : "",
                "name", student.getName(),
                "email", student.getEmail(),
                "status", "ACTIVE"
        );
    }

    // =========================================================================
    // 5. IMPORT ROSTER (CSV & XLSX) (Teacher Only)
    // =========================================================================
    public RosterImportSummary importRoster(String classroomId, MultipartFile file, String teacherEmail) {
        Classroom classroom = getExistingClassroom(classroomId);
        User teacher = getAuthenticatedTeacher(teacherEmail);
        verifyClassroomOwnership(classroom, teacher);

        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No roster file provided or file is empty");
        }

        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
        List<ParsedStudentRow> rows;

        try {
            if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
                rows = parseExcelRows(file);
            } else {
                rows = parseCsvRows(file);
            }
        } catch (Exception e) {
            log.error("Failed to parse roster file {}: {}", filename, e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Failed to parse roster file: " + e.getMessage());
        }

        int totalProcessed = 0;
        int existingVerifiedUsersLinked = 0;
        int newStudentAccountsCreated = 0;
        int alreadyMembersCount = 0;
        int duplicatesInFile = 0;

        Set<String> seenKeys = new HashSet<>();
        List<String> duplicateUsns = new ArrayList<>();
        List<String> alreadyMemberUsns = new ArrayList<>();
        List<String> invalidRows = new ArrayList<>();

        for (ParsedStudentRow row : rows) {
            String rawUsn = row.getUsn();
            String rawEmail = row.getEmail();
            String rawName = row.getName();

            if ((rawUsn == null || rawUsn.isBlank()) && (rawEmail == null || rawEmail.isBlank())) {
                invalidRows.add("Row " + row.getRowNumber() + ": Missing USN and Email");
                continue;
            }

            String trimmedUsn = rawUsn != null ? rawUsn.trim() : null;
            if (trimmedUsn != null && isHeaderOrTitleText(trimmedUsn)) {
                continue;
            }

            String dedupeKey = trimmedUsn != null && !trimmedUsn.isBlank() ? trimmedUsn.toUpperCase() : (rawEmail != null ? rawEmail.trim().toLowerCase() : "");
            if (dedupeKey.isEmpty()) {
                invalidRows.add("Row " + row.getRowNumber() + ": Missing USN and Email");
                continue;
            }

            if (!seenKeys.add(dedupeKey)) {
                duplicatesInFile++;
                duplicateUsns.add(dedupeKey);
                continue;
            }

            totalProcessed++;

            // Check if user exists by USN or Email
            Optional<User> userOpt = Optional.empty();
            if (trimmedUsn != null && !trimmedUsn.isBlank()) {
                userOpt = userRepository.findByUsnIgnoreCase(trimmedUsn);
            }
            if (userOpt.isEmpty() && rawEmail != null && !rawEmail.isBlank()) {
                userOpt = userRepository.findByEmailIgnoreCase(rawEmail.trim());
            }

            User student;
            if (userOpt.isPresent()) {
                student = userOpt.get();
                existingVerifiedUsersLinked++;
            } else {
                // Auto-create student
                String normalizedUsn = rawUsn != null && !rawUsn.isBlank() ? rawUsn.trim().toUpperCase() : null;
                String studentName = rawName != null && !rawName.isBlank() ? rawName.trim() : (normalizedUsn != null ? "Student " + normalizedUsn : "Student");
                String studentEmail = rawEmail != null && !rawEmail.isBlank() ? rawEmail.trim().toLowerCase()
                        : (normalizedUsn != null ? normalizedUsn.toLowerCase() + "@student.acadion.edu" : "student_" + System.currentTimeMillis() + "@student.acadion.edu");

                student = User.builder()
                        .name(studentName)
                        .email(studentEmail)
                        .usn(normalizedUsn)
                        .password(passwordEncoder.encode("Student@123"))
                        .role(Role.STUDENT)
                        .verified(true)
                        .approved(true)
                        .banned(false)
                        .semester(classroom.getSemester())
                        .studentDepartment(classroom.getDepartment())
                        .createdAt(LocalDateTime.now())
                        .approvedAt(LocalDateTime.now())
                        .build();

                student = userRepository.save(student);
                newStudentAccountsCreated++;
            }

            // Check if already active member
            Optional<ClassroomMembership> existingMembership = classroomMembershipRepository
                    .findByClassroomIdAndStudentId(classroom.getId(), student.getId());
            if (existingMembership.isPresent() && "ACTIVE".equalsIgnoreCase(existingMembership.get().getMembershipStatus())) {
                alreadyMembersCount++;
                alreadyMemberUsns.add(student.getUsn() != null ? student.getUsn() : student.getEmail());
            }

            // Ensure active membership & classroom document enrollment
            ensureActiveMembership(classroom, student, "ROSTER", teacher.getId());
            enrollStudentInClassroomDoc(classroom, student);
        }

        classroom.setUpdatedAt(LocalDateTime.now());
        classroomRepository.save(classroom);

        log.info("Roster import completed for classroom {}: TotalProcessed={}, ExistingLinked={}, NewCreated={}, AlreadyMembers={}",
                classroom.getId(), totalProcessed, existingVerifiedUsersLinked, newStudentAccountsCreated, alreadyMembersCount);

        return RosterImportSummary.builder()
                .totalProcessed(totalProcessed)
                .existingVerifiedUsersLinked(existingVerifiedUsersLinked)
                .newStudentAccountsCreated(newStudentAccountsCreated)
                .enrolledStudents(classroom.getEnrolledStudents() != null ? classroom.getEnrolledStudents() : new ArrayList<>())
                .totalRows(totalProcessed)
                .validRows(totalProcessed)
                .duplicatesInFile(duplicatesInFile)
                .matchedCount(existingVerifiedUsersLinked)
                .alreadyMembersCount(alreadyMembersCount)
                .addedCount(totalProcessed - alreadyMembersCount)
                .duplicateUsns(duplicateUsns)
                .alreadyMemberUsns(alreadyMemberUsns)
                .invalidRows(invalidRows)
                .build();
    }

    // =========================================================================
    // 6. GET CLASSROOM MEMBERS (Teacher Only)
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
                    .verifiedInDb(student != null && student.isVerified())
                    .build();
        }).sorted(Comparator.comparing(ClassroomMemberDto::getStudentName, String.CASE_INSENSITIVE_ORDER)).toList();
    }

    // =========================================================================
    // 7. STUDENT JOINS VIA JOIN CODE (Immediate Active Membership)
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
                .or(() -> classroomRepository.findByJoinCode(normalizedCode))
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
            // Re-activate or approve immediately
            existing.setMembershipStatus("ACTIVE");
            existing.setMembershipSource("JOIN_CODE");
            existing.setRequestedAt(now);
            existing.setApprovedAt(now);
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
                    .membershipStatus("ACTIVE")
                    .requestedAt(now)
                    .approvedAt(now)
                    .semester(classroom.getSemester())
                    .academicYear(classroom.getAcademicYear())
                    .createdAt(now)
                    .updatedAt(now)
                    .build();

            classroomMembershipRepository.save(newMembership);
        }

        // Synchronize into Classroom document
        enrollStudentInClassroomDoc(classroom, student);
        classroom.setUpdatedAt(now);
        classroomRepository.save(classroom);

        log.info("Student {} ({}) joined classroom '{}' ({}) via join code",
                student.getEmail(), student.getUsn(), classroom.getName(), classroom.getCourseCode());

        return Map.of(
                "success", true,
                "message", "Joined classroom successfully!",
                "classroomId", classroom.getId(),
                "classroomName", classroom.getName(),
                "courseCode", classroom.getCourseCode() != null ? classroom.getCourseCode() : classroom.getSubjectCode(),
                "subjectName", classroom.getSubjectName() != null ? classroom.getSubjectName() : classroom.getName(),
                "status", "ACTIVE"
        );
    }

    // =========================================================================
    // 8. GET JOIN REQUESTS (Teacher Only)
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
                    .verifiedInDb(student != null && student.isVerified())
                    .build();
        }).toList();
    }

    // =========================================================================
    // 9. APPROVE JOIN REQUEST (Teacher Only)
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

        User student = userRepository.findById(studentId).orElse(null);
        if (student != null) {
            enrollStudentInClassroomDoc(classroom, student);
            classroom.setUpdatedAt(LocalDateTime.now());
            classroomRepository.save(classroom);
        }

        log.info("Teacher {} approved student {} in classroom {}", teacher.getEmail(), studentId, classroomId);

        return Map.of(
                "success", true,
                "message", "Student join request approved successfully",
                "studentId", studentId,
                "classroomId", classroomId,
                "status", "ACTIVE"
        );
    }

    // =========================================================================
    // 10. REJECT JOIN REQUEST (Teacher Only)
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
    // 11. REMOVE MEMBER (Teacher Only)
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

        if (classroom.getStudentIds() != null) {
            classroom.getStudentIds().remove(studentId);
        }
        if (classroom.getEnrolledStudents() != null) {
            classroom.getEnrolledStudents().removeIf(es -> studentId.equals(es.getStudentId()));
        }
        classroom.setUpdatedAt(LocalDateTime.now());
        classroomRepository.save(classroom);

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
    // 12. REGENERATE JOIN CODE (Teacher Only)
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
    // 13. GET STUDENT CLASSROOMS
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

    private void enrollStudentInClassroomDoc(Classroom classroom, User student) {
        if (classroom.getStudentIds() == null) {
            classroom.setStudentIds(new ArrayList<>());
        }
        if (!classroom.getStudentIds().contains(student.getId())) {
            classroom.getStudentIds().add(student.getId());
        }

        if (classroom.getEnrolledStudents() == null) {
            classroom.setEnrolledStudents(new ArrayList<>());
        }

        boolean alreadyExists = classroom.getEnrolledStudents().stream()
                .anyMatch(es -> (es.getStudentId() != null && es.getStudentId().equals(student.getId()))
                        || (es.getUsn() != null && student.getUsn() != null && es.getUsn().equalsIgnoreCase(student.getUsn())));

        if (!alreadyExists) {
            classroom.getEnrolledStudents().add(Classroom.EnrolledStudent.builder()
                    .studentId(student.getId())
                    .usn(student.getUsn() != null ? student.getUsn() : "")
                    .name(student.getName())
                    .email(student.getEmail())
                    .joinedAt(LocalDateTime.now())
                    .status("ENROLLED")
                    .verifiedInDb(student.isVerified())
                    .build());
        }
    }

    private ClassroomMembership ensureActiveMembership(Classroom classroom, User student, String source, String approvedBy) {
        LocalDateTime now = LocalDateTime.now();
        Optional<ClassroomMembership> existingOpt = classroomMembershipRepository
                .findByClassroomIdAndStudentId(classroom.getId(), student.getId());

        ClassroomMembership membership;
        if (existingOpt.isPresent()) {
            membership = existingOpt.get();
            membership.setMembershipStatus("ACTIVE");
            membership.setMembershipSource(source);
            membership.setApprovedAt(now);
            membership.setApprovedBy(approvedBy);
            membership.setUsnSnapshot(student.getUsn());
            membership.setSemester(classroom.getSemester());
            membership.setAcademicYear(classroom.getAcademicYear());
            membership.setUpdatedAt(now);
        } else {
            membership = ClassroomMembership.builder()
                    .classroomId(classroom.getId())
                    .studentId(student.getId())
                    .usnSnapshot(student.getUsn())
                    .membershipSource(source)
                    .membershipStatus("ACTIVE")
                    .requestedAt(now)
                    .approvedAt(now)
                    .approvedBy(approvedBy)
                    .semester(classroom.getSemester())
                    .academicYear(classroom.getAcademicYear())
                    .createdAt(now)
                    .updatedAt(now)
                    .build();
        }
        return classroomMembershipRepository.save(membership);
    }

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
        // Auto-heal missing plain join code for existing classrooms
        if ((c.getJoinCode() == null || c.getJoinCode().isBlank()) && c.getJoinCodeHash() != null) {
            String healedCode = generateRandomCode();
            c.setJoinCode(healedCode);
            c.setJoinCodeHash(hashJoinCode(healedCode));
            try {
                classroomRepository.save(c);
            } catch (Exception ignored) {}
        }

        return ClassroomResponse.builder()
                .id(c.getId())
                .name(c.getName())
                .courseCode(c.getCourseCode() != null ? c.getCourseCode() : c.getSubjectCode())
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
                .joinCode(c.getJoinCode())
                .status(c.getStatus())
                .joinCodeEnabled(c.isJoinCodeEnabled())
                .joinCodeExpiresAt(c.getJoinCodeExpiresAt())
                .createdAt(c.getCreatedAt())
                .updatedAt(c.getUpdatedAt())
                .build();
    }

    // =========================================================================
    // FILE PARSING HELPERS (CSV & Multi-Row College Sheets)
    // =========================================================================

    private boolean isValidUsn(String s) {
        if (s == null) return false;
        String clean = s.replaceAll("[^a-zA-Z0-9]", "");
        if (clean.length() < 7 || clean.length() > 14) return false;
        String upper = clean.toUpperCase();
        if (upper.equals("USN") || upper.equals("ROLLNO") || upper.equals("SLNO") || upper.contains("STUDENT") || upper.contains("AVERAGE") || upper.contains("TOTAL")) {
            return false;
        }
        boolean hasDigit = clean.chars().anyMatch(Character::isDigit);
        boolean hasLetter = clean.chars().anyMatch(Character::isLetter);
        return hasDigit && hasLetter;
    }

    private boolean isValidName(String s) {
        if (s == null) return false;
        String t = s.trim();
        if (t.length() < 2 || t.length() > 80) return false;
        String lower = t.toLowerCase();
        if (lower.equals("name") || lower.contains("student name") || lower.contains("candidate") || lower.equals("sl no") || lower.equals("usn") || lower.contains("total") || lower.contains("average")) {
            return false;
        }
        return t.chars().anyMatch(Character::isLetter);
    }

    private boolean isValidEmail(String s) {
        if (s == null) return false;
        return EMAIL_PATTERN.matcher(s.trim()).matches();
    }

    private List<ParsedStudentRow> parseCsvRows(MultipartFile file) throws Exception {
        List<ParsedStudentRow> list = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            int rowNum = 0;
            int usnColIndex = -1;
            int nameColIndex = -1;
            int emailColIndex = -1;

            while ((line = reader.readLine()) != null) {
                rowNum++;
                line = line.trim();
                if (line.isEmpty()) continue;

                String[] tokens = parseCsvLine(line);
                if (tokens.length == 0 || isTokensAllEmpty(tokens)) {
                    continue;
                }

                // Check for headers
                if (usnColIndex == -1) {
                    for (int i = 0; i < tokens.length; i++) {
                        String clean = cleanToken(tokens[i]).toLowerCase();
                        if (isUsnHeaderCell(clean)) {
                            usnColIndex = i;
                        } else if (clean.contains("name") || clean.contains("student name")) {
                            nameColIndex = i;
                        } else if (clean.contains("email") || clean.contains("mail")) {
                            emailColIndex = i;
                        }
                    }
                    if (usnColIndex != -1) {
                        continue; // Skip header line
                    }
                }

                String usnVal = null;
                String nameVal = null;
                String emailVal = null;

                if (usnColIndex != -1 && usnColIndex < tokens.length) {
                    String v = cleanToken(tokens[usnColIndex]);
                    if (isValidUsn(v)) usnVal = v.toUpperCase();
                }

                if (nameColIndex != -1 && nameColIndex < tokens.length) {
                    String v = cleanToken(tokens[nameColIndex]);
                    if (isValidName(v)) nameVal = v;
                }

                if (emailColIndex != -1 && emailColIndex < tokens.length) {
                    String v = cleanToken(tokens[emailColIndex]);
                    if (isValidEmail(v)) emailVal = v;
                }

                // If not found by index, inspect all tokens
                if (usnVal == null) {
                    for (int i = 0; i < tokens.length; i++) {
                        String v = cleanToken(tokens[i]);
                        java.util.regex.Matcher m = VTU_USN_PATTERN.matcher(v);
                        if (m.find()) {
                            usnVal = m.group(1).toUpperCase();
                            if (nameVal == null && i + 1 < tokens.length) {
                                String n = cleanToken(tokens[i + 1]);
                                if (isValidName(n)) nameVal = n;
                            }
                            break;
                        } else if (isValidUsn(v)) {
                            usnVal = v.toUpperCase();
                            if (nameVal == null && i + 1 < tokens.length) {
                                String n = cleanToken(tokens[i + 1]);
                                if (isValidName(n)) nameVal = n;
                            }
                            break;
                        }
                    }
                }

                if (emailVal == null) {
                    for (String t : tokens) {
                        String v = cleanToken(t);
                        if (isValidEmail(v)) {
                            emailVal = v;
                            break;
                        }
                    }
                }

                if (usnVal != null || emailVal != null) {
                    list.add(new ParsedStudentRow(rowNum, usnVal, nameVal, emailVal));
                }
            }
        }
        return list;
    }

    private List<ParsedStudentRow> parseExcelRows(MultipartFile file) throws Exception {
        List<ParsedStudentRow> list = new ArrayList<>();
        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            if (workbook.getNumberOfSheets() == 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The Excel workbook has no sheets");
            }
            Sheet sheet = workbook.getSheetAt(0);
            if (sheet == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The Excel worksheet is empty");
            }

            int usnColIndex = -1;
            int nameColIndex = -1;
            int emailColIndex = -1;
            DataFormatter formatter = new DataFormatter();

            for (Row row : sheet) {
                if (row == null || isRowEmpty(row, formatter)) {
                    continue;
                }

                int rowNum = row.getRowNum() + 1;

                // 1. Detect headers if present in this row
                for (Cell cell : row) {
                    String val = formatter.formatCellValue(cell).trim().toLowerCase();
                    if (val.equals("usn") || val.contains("seat") || val.contains("student usn") || val.contains("roll") || val.contains("reg no")) {
                        usnColIndex = cell.getColumnIndex();
                    } else if (val.contains("student name") || val.equals("name") || val.contains("candidate name")) {
                        nameColIndex = cell.getColumnIndex();
                    } else if (val.contains("email") || val.contains("mail")) {
                        emailColIndex = cell.getColumnIndex();
                    }
                }

                String usnVal = null;
                String nameVal = null;
                String emailVal = null;

                if (usnColIndex != -1) {
                    Cell c = row.getCell(usnColIndex);
                    if (c != null) {
                        String v = formatter.formatCellValue(c).trim();
                        if (isValidUsn(v)) usnVal = v.toUpperCase();
                    }
                }

                if (nameColIndex != -1) {
                    Cell c = row.getCell(nameColIndex);
                    if (c != null) {
                        String v = formatter.formatCellValue(c).trim();
                        if (isValidName(v)) nameVal = v;
                    }
                }

                if (emailColIndex != -1) {
                    Cell c = row.getCell(emailColIndex);
                    if (c != null) {
                        String v = formatter.formatCellValue(c).trim();
                        if (isValidEmail(v)) emailVal = v;
                    }
                }

                // Scan cells in row if USN not found yet (handles arbitrary college marksheets like row 11+ sheets)
                if (usnVal == null) {
                    for (Cell cell : row) {
                        String val = formatter.formatCellValue(cell).trim();
                        java.util.regex.Matcher m = VTU_USN_PATTERN.matcher(val);
                        if (m.find()) {
                            usnVal = m.group(1).toUpperCase();
                            if (nameVal == null) {
                                Cell nextCell = row.getCell(cell.getColumnIndex() + 1);
                                if (nextCell != null) {
                                    String n = formatter.formatCellValue(nextCell).trim();
                                    if (isValidName(n)) nameVal = n;
                                }
                            }
                            break;
                        } else if (isValidUsn(val)) {
                            usnVal = val.toUpperCase();
                            if (nameVal == null) {
                                Cell nextCell = row.getCell(cell.getColumnIndex() + 1);
                                if (nextCell != null) {
                                    String n = formatter.formatCellValue(nextCell).trim();
                                    if (isValidName(n)) nameVal = n;
                                }
                            }
                            break;
                        }
                    }
                }

                if (emailVal == null) {
                    for (Cell cell : row) {
                        String val = formatter.formatCellValue(cell).trim();
                        if (isValidEmail(val)) {
                            emailVal = val;
                            break;
                        }
                    }
                }

                if (usnVal != null || emailVal != null) {
                    list.add(new ParsedStudentRow(rowNum, usnVal, nameVal, emailVal));
                }
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
    public static class ParsedStudentRow {
        int rowNumber;
        String usn;
        String name;
        String email;
    }
}

