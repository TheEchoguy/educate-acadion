package com.acadion.backend.service;

import com.acadion.backend.dto.syllabus.SyllabusAuditEventResponse;
import com.acadion.backend.entity.*;
import com.acadion.backend.repository.ClassroomRepository;
import com.acadion.backend.repository.SyllabusAuditEventRepository;
import com.acadion.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Audit service for syllabus operations.
 *
 * <p>Architectural note regarding MongoDB consistency:
 * Without multi-document transactions enabled across separate collections,
 * audit event persistence is executed sequentially following domain operations.
 * If audit persistence encounters an unexpected database error, the event is logged
 * with full contextual severity to prevent silent failure while documenting
 * non-transactional boundary conditions.</p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SyllabusAuditService {

    private final SyllabusAuditEventRepository auditEventRepository;
    private final ClassroomRepository classroomRepository;
    private final UserRepository userRepository;

    /**
     * Record an append-only audit event for a syllabus action.
     */
    public SyllabusAuditEvent recordEvent(
            String classroomId,
            String syllabusTopicId,
            String versionId,
            String mappingId,
            User actor,
            SyllabusAuditEventType eventType,
            String description,
            Map<String, Object> metadata
    ) {
        if (actor == null) {
            log.warn("Attempted to record audit event without authenticated actor for classroom {}", classroomId);
            return null;
        }

        Map<String, Object> safeMetadata = metadata != null ? new HashMap<>(metadata) : new HashMap<>();
        // Strip any potential sensitive keys
        safeMetadata.remove("password");
        safeMetadata.remove("token");
        safeMetadata.remove("otp");
        safeMetadata.remove("secret");

        SyllabusAuditEvent event = SyllabusAuditEvent.builder()
                .classroomId(classroomId)
                .syllabusTopicId(syllabusTopicId)
                .versionId(versionId)
                .mappingId(mappingId)
                .actorUserId(actor.getId())
                .actorEmail(actor.getEmail())
                .actorRole(actor.getRole())
                .eventType(eventType)
                .timestamp(LocalDateTime.now())
                .description(description)
                .metadata(safeMetadata)
                .build();

        try {
            SyllabusAuditEvent saved = auditEventRepository.save(event);
            log.debug("Recorded audit event '{}' for classroom {} by {}", eventType, classroomId, actor.getEmail());
            return saved;
        } catch (Exception e) {
            log.error("Failed to persist syllabus audit event for classroom {}: {}", classroomId, e.getMessage(), e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to persist syllabus audit record: " + e.getMessage());
        }
    }

    /**
     * List audit events for a classroom (Faculty owner or Admin only).
     */
    public List<SyllabusAuditEventResponse> getAuditEvents(String classroomId, String userEmail) {
        return getAuditEvents(classroomId, null, 0, 50, userEmail);
    }

    /**
     * List audit events for a classroom with bounded pagination and optional topic filter.
     */
    public List<SyllabusAuditEventResponse> getAuditEvents(
            String classroomId,
            String topicId,
            Integer page,
            Integer limit,
            String userEmail
    ) {
        Classroom classroom = getExistingClassroom(classroomId);
        User caller = getAuthenticatedUser(userEmail);
        verifyClassroomOwnership(classroom, caller);

        int p = (page != null && page >= 0) ? page : 0;
        int l = (limit != null && limit > 0) ? Math.min(limit, 100) : 50;

        List<SyllabusAuditEvent> events;
        if (topicId != null && !topicId.isBlank()) {
            events = auditEventRepository.findByClassroomIdAndSyllabusTopicIdOrderByTimestampDesc(classroomId, topicId.trim());
        } else {
            events = auditEventRepository.findByClassroomIdOrderByTimestampDesc(classroomId);
        }

        int start = p * l;
        if (start >= events.size()) {
            return Collections.emptyList();
        }
        int end = Math.min(start + l, events.size());
        return events.subList(start, end).stream()
                .map(this::toResponse)
                .toList();
    }

    /**
     * List audit events for a specific topic (Faculty owner or Admin only).
     */
    public List<SyllabusAuditEventResponse> getAuditEventsForTopic(String classroomId, String topicId, String userEmail) {
        Classroom classroom = getExistingClassroom(classroomId);
        User caller = getAuthenticatedUser(userEmail);
        verifyClassroomOwnership(classroom, caller);

        return auditEventRepository.findByClassroomIdAndSyllabusTopicIdOrderByTimestampDesc(classroomId, topicId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private Classroom getExistingClassroom(String classroomId) {
        return classroomRepository.findById(classroomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Classroom not found: " + classroomId));
    }

    private User getAuthenticatedUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User account not found"));
    }

    private void verifyClassroomOwnership(Classroom classroom, User user) {
        if (!classroom.getTeacherId().equals(user.getId()) && user.getRole() != Role.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Forbidden: You are not authorized to view audit history for this classroom");
        }
    }

    private SyllabusAuditEventResponse toResponse(SyllabusAuditEvent event) {
        return SyllabusAuditEventResponse.builder()
                .id(event.getId())
                .classroomId(event.getClassroomId())
                .syllabusTopicId(event.getSyllabusTopicId())
                .versionId(event.getVersionId())
                .mappingId(event.getMappingId())
                .actorUserId(event.getActorUserId())
                .actorEmail(event.getActorEmail())
                .actorRole(event.getActorRole())
                .eventType(event.getEventType())
                .timestamp(event.getTimestamp())
                .description(event.getDescription())
                .metadata(event.getMetadata() != null ? Collections.unmodifiableMap(event.getMetadata()) : Collections.emptyMap())
                .build();
    }
}
