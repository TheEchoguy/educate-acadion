package com.acadion.backend.service;

import com.acadion.backend.dto.syllabus.*;
import com.acadion.backend.entity.*;
import com.acadion.backend.repository.ClassroomMembershipRepository;
import com.acadion.backend.repository.ClassroomRepository;
import com.acadion.backend.repository.SyllabusItemRepository;
import com.acadion.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import com.acadion.backend.repository.SyllabusVersionRepository;
import java.util.Collections;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class SyllabusService {

    private final SyllabusItemRepository syllabusItemRepository;
    private final SyllabusVersionRepository syllabusVersionRepository;
    private final ClassroomRepository classroomRepository;
    private final ClassroomMembershipRepository classroomMembershipRepository;
    private final UserRepository userRepository;
    private final SyllabusAuditService auditService;

    // =========================================================================
    // 1. LIST SYLLABUS ITEMS (Teacher Owner or Active Enrolled Student)
    // =========================================================================
    public List<SyllabusItemResponse> getSyllabusItems(String classroomId, String userEmail) {
        Classroom classroom = getExistingClassroom(classroomId);
        User caller = getAuthenticatedUser(userEmail);
        verifyClassroomReadAccess(classroom, caller);

        // Security constraint: active enrolled students see only published content
        if (caller.getRole() == Role.STUDENT) {
            Optional<SyllabusVersion> latestVersionOpt = syllabusVersionRepository
                    .findTopByClassroomIdOrderByVersionNumberDesc(classroomId);
            if (latestVersionOpt.isEmpty()) {
                return Collections.emptyList();
            }
            return latestVersionOpt.get().getTopics().stream()
                    .map(snapshot -> toSyllabusItemResponse(snapshot, classroomId))
                    .toList();
        }

        // Teachers / Admin view the current editable draft
        List<SyllabusItem> items = syllabusItemRepository
                .findByClassroomIdOrderByOrderIndexAscCreatedAtAsc(classroomId);

        return items.stream()
                .map(this::toSyllabusItemResponse)
                .toList();
    }

    // =========================================================================
    // 2. CREATE SYLLABUS ITEM (Teacher Owner / Admin)
    // =========================================================================
    public SyllabusItemResponse createSyllabusItem(
            String classroomId,
            CreateSyllabusItemRequest request,
            String userEmail
    ) {
        Classroom classroom = getExistingClassroom(classroomId);
        User teacher = getAuthenticatedTeacher(userEmail);
        verifyClassroomOwnership(classroom, teacher);

        validateUnitAndTopic(request.getUnit(), request.getTopic());
        validateMetadata(request.getEstimatedHours(), request.getPlannedStartDate(),
                request.getPlannedCompletionDate(), request.getLearningResources());

        if (request.getOrderIndex() != null && request.getOrderIndex() < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Order index cannot be negative");
        }

        int calculatedOrderIndex = request.getOrderIndex() != null
                ? request.getOrderIndex()
                : (int) syllabusItemRepository.countByClassroomId(classroomId);

        SyllabusStatus status = request.getStatus() != null ? request.getStatus() : SyllabusStatus.NOT_STARTED;
        LocalDateTime now = LocalDateTime.now();

        List<String> objectives = request.getLearningObjectives() != null
                ? new ArrayList<>(request.getLearningObjectives())
                : new ArrayList<>();

        List<LearningResource> resources = request.getLearningResources() != null
                ? new ArrayList<>(request.getLearningResources())
                : new ArrayList<>();

        SyllabusItem item = SyllabusItem.builder()
                .classroomId(classroomId)
                .unit(request.getUnit().trim())
                .topic(request.getTopic().trim())
                .description(request.getDescription() != null ? request.getDescription().trim() : null)
                .status(status)
                .orderIndex(calculatedOrderIndex)
                .learningObjectives(objectives)
                .teachingNotes(request.getTeachingNotes() != null ? request.getTeachingNotes().trim() : null)
                .estimatedHours(request.getEstimatedHours())
                .plannedStartDate(request.getPlannedStartDate())
                .plannedCompletionDate(request.getPlannedCompletionDate())
                .learningResources(resources)
                .referenceMaterials(request.getReferenceMaterials() != null ? request.getReferenceMaterials().trim() : null)
                .createdBy(teacher.getId())
                .updatedBy(teacher.getId())
                .createdAt(now)
                .updatedAt(now)
                .build();

        SyllabusItem saved = syllabusItemRepository.save(item);
        log.info("Teacher {} created syllabus item '{}' in classroom {}", teacher.getEmail(), saved.getTopic(), classroomId);

        auditService.recordEvent(
                classroomId,
                saved.getId(),
                null,
                null,
                teacher,
                SyllabusAuditEventType.TOPIC_CREATED,
                "Created syllabus topic: " + saved.getTopic(),
                Map.of(
                        "unit", saved.getUnit(),
                        "topic", saved.getTopic(),
                        "orderIndex", saved.getOrderIndex()
                )
        );

        return toSyllabusItemResponse(saved);
    }

    // =========================================================================
    // 3. UPDATE SYLLABUS ITEM (Teacher Owner / Admin)
    // =========================================================================
    public SyllabusItemResponse updateSyllabusItem(
            String classroomId,
            String itemId,
            UpdateSyllabusItemRequest request,
            String userEmail
    ) {
        Classroom classroom = getExistingClassroom(classroomId);
        User teacher = getAuthenticatedTeacher(userEmail);
        verifyClassroomOwnership(classroom, teacher);

        SyllabusItem existing = getExistingSyllabusItem(itemId, classroomId);

        validateUnitAndTopic(request.getUnit(), request.getTopic());
        validateMetadata(request.getEstimatedHours(), request.getPlannedStartDate(),
                request.getPlannedCompletionDate(), request.getLearningResources());

        if (request.getStatus() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status is required");
        }

        if (request.getOrderIndex() != null && request.getOrderIndex() < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Order index cannot be negative");
        }

        existing.setUnit(request.getUnit().trim());
        existing.setTopic(request.getTopic().trim());
        existing.setDescription(request.getDescription() != null ? request.getDescription().trim() : null);
        existing.setStatus(request.getStatus());
        if (request.getOrderIndex() != null) {
            existing.setOrderIndex(request.getOrderIndex());
        }

        if (request.getLearningObjectives() != null) {
            existing.setLearningObjectives(new ArrayList<>(request.getLearningObjectives()));
        }
        if (request.getTeachingNotes() != null) {
            existing.setTeachingNotes(request.getTeachingNotes().trim());
        }
        if (request.getEstimatedHours() != null) {
            existing.setEstimatedHours(request.getEstimatedHours());
        }
        if (request.getPlannedStartDate() != null) {
            existing.setPlannedStartDate(request.getPlannedStartDate());
        }
        if (request.getPlannedCompletionDate() != null) {
            existing.setPlannedCompletionDate(request.getPlannedCompletionDate());
        }
        if (request.getLearningResources() != null) {
            existing.setLearningResources(new ArrayList<>(request.getLearningResources()));
        }
        if (request.getReferenceMaterials() != null) {
            existing.setReferenceMaterials(request.getReferenceMaterials().trim());
        }

        existing.setUpdatedBy(teacher.getId());
        existing.setUpdatedAt(LocalDateTime.now());

        SyllabusItem updated = syllabusItemRepository.save(existing);
        log.info("Teacher {} updated syllabus item '{}' ({}) in classroom {}",
                teacher.getEmail(), updated.getTopic(), itemId, classroomId);

        auditService.recordEvent(
                classroomId,
                updated.getId(),
                null,
                null,
                teacher,
                SyllabusAuditEventType.TOPIC_UPDATED,
                "Updated syllabus topic: " + updated.getTopic(),
                Map.of(
                        "unit", updated.getUnit(),
                        "topic", updated.getTopic(),
                        "status", updated.getStatus().name()
                )
        );

        return toSyllabusItemResponse(updated);
    }

    // =========================================================================
    // 4. UPDATE SYLLABUS STATUS (Teacher Owner / Admin)
    // =========================================================================
    public SyllabusItemResponse updateSyllabusStatus(
            String classroomId,
            String itemId,
            UpdateSyllabusStatusRequest request,
            String userEmail
    ) {
        Classroom classroom = getExistingClassroom(classroomId);
        User teacher = getAuthenticatedTeacher(userEmail);
        verifyClassroomOwnership(classroom, teacher);

        if (request.getStatus() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Valid status is required");
        }

        SyllabusItem existing = getExistingSyllabusItem(itemId, classroomId);
        SyllabusStatus oldStatus = existing.getStatus();
        existing.setStatus(request.getStatus());
        existing.setUpdatedBy(teacher.getId());
        existing.setUpdatedAt(LocalDateTime.now());

        SyllabusItem updated = syllabusItemRepository.save(existing);
        log.info("Teacher {} updated status to {} for syllabus item '{}' in classroom {}",
                teacher.getEmail(), request.getStatus(), existing.getTopic(), classroomId);

        auditService.recordEvent(
                classroomId,
                updated.getId(),
                null,
                null,
                teacher,
                SyllabusAuditEventType.TOPIC_STATUS_CHANGED,
                "Changed status of topic '" + updated.getTopic() + "' from " + oldStatus + " to " + request.getStatus(),
                Map.of(
                        "oldStatus", oldStatus.name(),
                        "newStatus", request.getStatus().name()
                )
        );

        return toSyllabusItemResponse(updated);
    }

    // =========================================================================
    // 5. DELETE SYLLABUS ITEM (Teacher Owner / Admin)
    // =========================================================================
    public Map<String, Object> deleteSyllabusItem(
            String classroomId,
            String itemId,
            String userEmail
    ) {
        Classroom classroom = getExistingClassroom(classroomId);
        User teacher = getAuthenticatedTeacher(userEmail);
        verifyClassroomOwnership(classroom, teacher);

        SyllabusItem existing = getExistingSyllabusItem(itemId, classroomId);
        syllabusItemRepository.delete(existing);

        log.info("Teacher {} deleted syllabus item '{}' ({}) from classroom {}",
                teacher.getEmail(), existing.getTopic(), itemId, classroomId);

        auditService.recordEvent(
                classroomId,
                itemId,
                null,
                null,
                teacher,
                SyllabusAuditEventType.TOPIC_DELETED,
                "Deleted syllabus topic: " + existing.getTopic(),
                Map.of("deletedTopicTitle", existing.getTopic())
        );

        return Map.of(
                "success", true,
                "message", "Syllabus topic deleted successfully",
                "classroomId", classroomId,
                "itemId", itemId
        );
    }

    // =========================================================================
    // 6. REORDER SYLLABUS ITEMS (Teacher Owner / Admin)
    // =========================================================================
    public List<SyllabusItemResponse> reorderSyllabusItems(
            String classroomId,
            List<String> orderedItemIds,
            String userEmail
    ) {
        Classroom classroom = getExistingClassroom(classroomId);
        User teacher = getAuthenticatedTeacher(userEmail);
        verifyClassroomOwnership(classroom, teacher);

        if (orderedItemIds == null || orderedItemIds.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ordered item IDs list cannot be empty");
        }

        List<SyllabusItem> itemsToUpdate = new ArrayList<>();
        LocalDateTime now = LocalDateTime.now();

        for (int i = 0; i < orderedItemIds.size(); i++) {
            String itemId = orderedItemIds.get(i);
            SyllabusItem item = getExistingSyllabusItem(itemId, classroomId);
            item.setOrderIndex(i);
            item.setUpdatedBy(teacher.getId());
            item.setUpdatedAt(now);
            itemsToUpdate.add(item);
        }

        List<SyllabusItem> savedList = syllabusItemRepository.saveAll(itemsToUpdate);
        log.info("Teacher {} reordered {} syllabus items in classroom {}",
                teacher.getEmail(), savedList.size(), classroomId);

        auditService.recordEvent(
                classroomId,
                null,
                null,
                null,
                teacher,
                SyllabusAuditEventType.TOPICS_REORDERED,
                "Reordered " + savedList.size() + " syllabus topics",
                Map.of("itemCount", savedList.size())
        );

        return savedList.stream()
                .map(this::toSyllabusItemResponse)
                .toList();
    }

    // =========================================================================
    // 7. GET SYLLABUS PROGRESS SUMMARY
    // =========================================================================
    public SyllabusProgressResponse getSyllabusProgress(String classroomId, String userEmail) {
        Classroom classroom = getExistingClassroom(classroomId);
        User caller = getAuthenticatedUser(userEmail);
        verifyClassroomReadAccess(classroom, caller);

        if (caller.getRole() == Role.STUDENT) {
            Optional<SyllabusVersion> latestVersionOpt = syllabusVersionRepository
                    .findTopByClassroomIdOrderByVersionNumberDesc(classroomId);
            if (latestVersionOpt.isEmpty()) {
                return SyllabusProgressResponse.builder()
                        .classroomId(classroomId)
                        .totalTopics(0)
                        .completedTopics(0)
                        .inProgressTopics(0)
                        .notStartedTopics(0)
                        .completionPercentage(0.0)
                        .build();
            }
            List<SyllabusItemSnapshot> publishedTopics = latestVersionOpt.get().getTopics();
            long total = publishedTopics.size();
            long completed = publishedTopics.stream().filter(t -> t.getStatus() == SyllabusStatus.COMPLETED).count();
            long inProgress = publishedTopics.stream().filter(t -> t.getStatus() == SyllabusStatus.IN_PROGRESS).count();
            long notStarted = publishedTopics.stream().filter(t -> t.getStatus() == SyllabusStatus.NOT_STARTED).count();
            double pct = total > 0 ? Math.round(((double) completed / total) * 10000.0) / 100.0 : 0.0;
            return SyllabusProgressResponse.builder()
                    .classroomId(classroomId)
                    .totalTopics(total)
                    .completedTopics(completed)
                    .inProgressTopics(inProgress)
                    .notStartedTopics(notStarted)
                    .completionPercentage(pct)
                    .build();
        }

        long totalTopics = syllabusItemRepository.countByClassroomId(classroomId);
        long completedTopics = syllabusItemRepository.countByClassroomIdAndStatus(classroomId, SyllabusStatus.COMPLETED);
        long inProgressTopics = syllabusItemRepository.countByClassroomIdAndStatus(classroomId, SyllabusStatus.IN_PROGRESS);
        long notStartedTopics = syllabusItemRepository.countByClassroomIdAndStatus(classroomId, SyllabusStatus.NOT_STARTED);

        double completionPercentage = 0.0;
        if (totalTopics > 0) {
            completionPercentage = Math.round(((double) completedTopics / totalTopics) * 10000.0) / 100.0;
        }

        return SyllabusProgressResponse.builder()
                .classroomId(classroomId)
                .totalTopics(totalTopics)
                .completedTopics(completedTopics)
                .inProgressTopics(inProgressTopics)
                .notStartedTopics(notStartedTopics)
                .completionPercentage(completionPercentage)
                .build();
    }

    // =========================================================================
    // HELPER & SECURITY METHODS
    // =========================================================================

    private void validateMetadata(
            Double estimatedHours,
            LocalDate plannedStartDate,
            LocalDate plannedCompletionDate,
            List<LearningResource> learningResources
    ) {
        if (estimatedHours != null && estimatedHours < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Estimated teaching hours cannot be negative");
        }

        if (plannedStartDate != null && plannedCompletionDate != null && plannedCompletionDate.isBefore(plannedStartDate)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Planned completion date cannot be before planned start date");
        }

        if (learningResources != null) {
            for (LearningResource resource : learningResources) {
                if (resource == null) continue;
                String url = resource.getUrl();
                if (url == null || url.isBlank()) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Resource URL cannot be blank");
                }
                String trimmed = url.trim();
                if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Resource URL must be a valid HTTP or HTTPS URL: " + url);
                }
                try {
                    new URI(trimmed).toURL();
                } catch (Exception e) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Resource URL is malformed: " + url);
                }
            }
        }
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

    private SyllabusItem getExistingSyllabusItem(String itemId, String classroomId) {
        return syllabusItemRepository.findByIdAndClassroomId(itemId, classroomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Syllabus item not found with ID " + itemId + " in classroom " + classroomId));
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

    private void validateUnitAndTopic(String unit, String topic) {
        if (unit == null || unit.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unit name or identifier is required");
        }
        if (topic == null || topic.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Topic name is required");
        }
    }

    private SyllabusItemResponse toSyllabusItemResponse(SyllabusItem item) {
        return SyllabusItemResponse.builder()
                .id(item.getId())
                .classroomId(item.getClassroomId())
                .unit(item.getUnit())
                .topic(item.getTopic())
                .description(item.getDescription())
                .status(item.getStatus())
                .orderIndex(item.getOrderIndex())
                .learningObjectives(item.getLearningObjectives() != null ? List.copyOf(item.getLearningObjectives()) : List.of())
                .teachingNotes(item.getTeachingNotes())
                .estimatedHours(item.getEstimatedHours())
                .plannedStartDate(item.getPlannedStartDate())
                .plannedCompletionDate(item.getPlannedCompletionDate())
                .learningResources(item.getLearningResources() != null ? List.copyOf(item.getLearningResources()) : List.of())
                .referenceMaterials(item.getReferenceMaterials())
                .createdBy(item.getCreatedBy())
                .updatedBy(item.getUpdatedBy())
                .createdAt(item.getCreatedAt())
                .updatedAt(item.getUpdatedAt())
                .build();
    }

    private SyllabusItemResponse toSyllabusItemResponse(SyllabusItemSnapshot s, String classroomId) {
        return SyllabusItemResponse.builder()
                .id(s.getTopicId())
                .classroomId(classroomId)
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
