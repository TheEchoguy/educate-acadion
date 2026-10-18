package com.acadion.backend.service;

import com.acadion.backend.dto.syllabus.*;
import com.acadion.backend.entity.*;
import com.acadion.backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class SyllabusPublicationService {

    private final SyllabusVersionRepository syllabusVersionRepository;
    private final SyllabusItemRepository syllabusItemRepository;
    private final ClassroomRepository classroomRepository;
    private final ClassroomMembershipRepository classroomMembershipRepository;
    private final UserRepository userRepository;
    private final SyllabusAuditService auditService;
    private final SyllabusNotificationService notificationService;

    /**
     * Publish the working syllabus draft as an immutable historical version snapshot.
     */
    public SyllabusVersionResponse publishSyllabus(
            String classroomId,
            PublishSyllabusRequest request,
            String teacherEmail
    ) {
        Classroom classroom = getExistingClassroom(classroomId);
        User teacher = getAuthenticatedTeacher(teacherEmail);
        verifyClassroomOwnership(classroom, teacher);

        List<SyllabusItem> draftItems = syllabusItemRepository
                .findByClassroomIdOrderByOrderIndexAscCreatedAtAsc(classroomId);

        if (draftItems.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot publish an empty syllabus. Please add topics before publishing.");
        }

        Optional<SyllabusVersion> latestVersionOpt = syllabusVersionRepository
                .findTopByClassroomIdOrderByVersionNumberDesc(classroomId);
        int nextVersionNumber = latestVersionOpt.map(v -> v.getVersionNumber() + 1).orElse(1);

        String title = request != null && request.getVersionTitle() != null && !request.getVersionTitle().isBlank()
                ? request.getVersionTitle().trim()
                : "Version " + nextVersionNumber;

        String summary = request != null && request.getChangeSummary() != null
                ? request.getChangeSummary().trim()
                : null;

        List<SyllabusItemSnapshot> snapshots = draftItems.stream()
                .map(this::createSnapshot)
                .toList();

        LocalDateTime now = LocalDateTime.now();

        SyllabusVersion version = SyllabusVersion.builder()
                .classroomId(classroomId)
                .versionNumber(nextVersionNumber)
                .versionTitle(title)
                .changeSummary(summary)
                .publishedBy(teacher.getId())
                .publishedAt(now)
                .topicCount(snapshots.size())
                .topics(snapshots)
                .build();

        SyllabusVersion saved = syllabusVersionRepository.save(version);
        log.info("Teacher {} published syllabus version {} (id={}) with {} topics for classroom {}",
                teacher.getEmail(), nextVersionNumber, saved.getId(), saved.getTopicCount(), classroomId);

        auditService.recordEvent(
                classroomId,
                null,
                saved.getId(),
                null,
                teacher,
                SyllabusAuditEventType.SYLLABUS_PUBLISHED,
                "Published syllabus version " + nextVersionNumber + " with " + snapshots.size() + " topics",
                Map.of(
                        "versionNumber", nextVersionNumber,
                        "versionTitle", title,
                        "topicCount", snapshots.size()
                )
        );

        try {
            if (notificationService != null) {
                notificationService.notifySyllabusPublished(classroom, saved, teacher);
            }
        } catch (Exception e) {
            log.warn("Syllabus publication notification dispatch encountered an error: {}", e.getMessage());
        }

        return toVersionResponse(saved);
    }

    /**
     * List all published versions for a classroom (Teacher, Admin, or enrolled Student).
     */
    public List<SyllabusVersionSummaryResponse> getPublishedVersions(String classroomId, String userEmail) {
        Classroom classroom = getExistingClassroom(classroomId);
        User caller = getAuthenticatedUser(userEmail);
        verifyClassroomReadAccess(classroom, caller);

        return syllabusVersionRepository.findByClassroomIdOrderByVersionNumberDesc(classroomId)
                .stream()
                .map(this::toSummaryResponse)
                .toList();
    }

    /**
     * Retrieve a specific published version by version number.
     */
    public SyllabusVersionResponse getPublishedVersion(String classroomId, Integer versionNumber, String userEmail) {
        Classroom classroom = getExistingClassroom(classroomId);
        User caller = getAuthenticatedUser(userEmail);
        verifyClassroomReadAccess(classroom, caller);

        if (versionNumber == null || versionNumber < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Valid positive version number is required");
        }

        SyllabusVersion version = syllabusVersionRepository
                .findByClassroomIdAndVersionNumber(classroomId, versionNumber)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Published syllabus version " + versionNumber + " not found for classroom " + classroomId));

        return toVersionResponse(version);
    }

    /**
     * Retrieve a specific published version by MongoDB ID.
     */
    public SyllabusVersionResponse getPublishedVersionById(String classroomId, String versionId, String userEmail) {
        Classroom classroom = getExistingClassroom(classroomId);
        User caller = getAuthenticatedUser(userEmail);
        verifyClassroomReadAccess(classroom, caller);

        SyllabusVersion version = syllabusVersionRepository
                .findByIdAndClassroomId(versionId, classroomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Published syllabus version not found with ID " + versionId + " in classroom " + classroomId));

        return toVersionResponse(version);
    }

    /**
     * Retrieve the latest published version for a classroom.
     */
    public SyllabusVersionResponse getLatestPublishedVersion(String classroomId, String userEmail) {
        Classroom classroom = getExistingClassroom(classroomId);
        User caller = getAuthenticatedUser(userEmail);
        verifyClassroomReadAccess(classroom, caller);

        SyllabusVersion version = syllabusVersionRepository
                .findTopByClassroomIdOrderByVersionNumberDesc(classroomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "No published syllabus versions found for classroom " + classroomId));

        return toVersionResponse(version);
    }

    /**
     * Retrieve a published version by ID or version number.
     */
    public SyllabusVersionResponse getPublishedVersionByIdOrNumber(String classroomId, String versionIdentifier, String userEmail) {
        Classroom classroom = getExistingClassroom(classroomId);
        User caller = getAuthenticatedUser(userEmail);
        verifyClassroomReadAccess(classroom, caller);

        if (versionIdentifier == null || versionIdentifier.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Version identifier is required");
        }

        String idOrNum = versionIdentifier.trim();
        Optional<SyllabusVersion> versionOpt = syllabusVersionRepository.findByIdAndClassroomId(idOrNum, classroomId);
        if (versionOpt.isEmpty() && idOrNum.matches("\\d+")) {
            try {
                int num = Integer.parseInt(idOrNum);
                versionOpt = syllabusVersionRepository.findByClassroomIdAndVersionNumber(classroomId, num);
            } catch (NumberFormatException ignored) {
            }
        }

        SyllabusVersion version = versionOpt.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                "Published syllabus version not found with identifier " + versionIdentifier + " in classroom " + classroomId));

        return toVersionResponse(version);
    }

    // =========================================================================
    // HELPER & SECURITY METHODS
    // =========================================================================

    private SyllabusItemSnapshot createSnapshot(SyllabusItem item) {
        List<String> objectivesClone = item.getLearningObjectives() != null
                ? new ArrayList<>(item.getLearningObjectives())
                : new ArrayList<>();

        List<LearningResource> resourcesClone = item.getLearningResources() != null
                ? item.getLearningResources().stream()
                .map(r -> LearningResource.builder().label(r.getLabel()).url(r.getUrl()).build())
                .toList()
                : new ArrayList<>();

        return SyllabusItemSnapshot.builder()
                .topicId(item.getId())
                .unit(item.getUnit())
                .topic(item.getTopic())
                .description(item.getDescription())
                .status(item.getStatus())
                .orderIndex(item.getOrderIndex())
                .learningObjectives(objectivesClone)
                .teachingNotes(item.getTeachingNotes())
                .estimatedHours(item.getEstimatedHours())
                .plannedStartDate(item.getPlannedStartDate())
                .plannedCompletionDate(item.getPlannedCompletionDate())
                .learningResources(resourcesClone)
                .referenceMaterials(item.getReferenceMaterials())
                .createdBy(item.getCreatedBy())
                .updatedBy(item.getUpdatedBy())
                .createdAt(item.getCreatedAt())
                .updatedAt(item.getUpdatedAt())
                .build();
    }

    private User getAuthenticatedUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User account not found"));
    }

    private User getAuthenticatedTeacher(String email) {
        User user = getAuthenticatedUser(email);
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

    private void verifyClassroomReadAccess(Classroom classroom, User caller) {
        if (classroom.getTeacherId().equals(caller.getId()) || caller.getRole() == Role.ADMIN) {
            return;
        }

        if (caller.getRole() == Role.STUDENT) {
            Optional<ClassroomMembership> membershipOpt = classroomMembershipRepository
                    .findByClassroomIdAndStudentId(classroom.getId(), caller.getId());

            if (membershipOpt.isEmpty() || !"ACTIVE".equalsIgnoreCase(membershipOpt.get().getMembershipStatus())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Access denied: You do not have an active enrollment in this classroom");
            }
            return;
        }

        throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                "Access denied: You are not authorized to view the syllabus for this classroom");
    }

    private SyllabusVersionSummaryResponse toSummaryResponse(SyllabusVersion v) {
        return SyllabusVersionSummaryResponse.builder()
                .id(v.getId())
                .classroomId(v.getClassroomId())
                .versionNumber(v.getVersionNumber())
                .versionTitle(v.getVersionTitle())
                .changeSummary(v.getChangeSummary())
                .publishedBy(v.getPublishedBy())
                .publishedAt(v.getPublishedAt())
                .topicCount(v.getTopicCount())
                .build();
    }

    private SyllabusVersionResponse toVersionResponse(SyllabusVersion v) {
        List<SyllabusItemSnapshotResponse> snapshotResponses = v.getTopics() != null
                ? v.getTopics().stream().map(this::toSnapshotResponse).toList()
                : Collections.emptyList();

        return SyllabusVersionResponse.builder()
                .id(v.getId())
                .classroomId(v.getClassroomId())
                .versionNumber(v.getVersionNumber())
                .versionTitle(v.getVersionTitle())
                .changeSummary(v.getChangeSummary())
                .publishedBy(v.getPublishedBy())
                .publishedAt(v.getPublishedAt())
                .topicCount(v.getTopicCount())
                .topics(snapshotResponses)
                .build();
    }

    private SyllabusItemSnapshotResponse toSnapshotResponse(SyllabusItemSnapshot s) {
        return SyllabusItemSnapshotResponse.builder()
                .topicId(s.getTopicId())
                .unit(s.getUnit())
                .topic(s.getTopic())
                .description(s.getDescription())
                .status(s.getStatus())
                .orderIndex(s.getOrderIndex())
                .learningObjectives(s.getLearningObjectives() != null ? List.copyOf(s.getLearningObjectives()) : List.of())
                .teachingNotes(s.getTeachingNotes())
                .estimatedHours(s.getEstimatedHours())
                .plannedStartDate(s.getPlannedStartDate())
                .plannedCompletionDate(s.getPlannedCompletionDate())
                .learningResources(s.getLearningResources() != null ? List.copyOf(s.getLearningResources()) : List.of())
                .referenceMaterials(s.getReferenceMaterials())
                .createdBy(s.getCreatedBy())
                .updatedBy(s.getUpdatedBy())
                .createdAt(s.getCreatedAt())
                .updatedAt(s.getUpdatedAt())
                .build();
    }
}
