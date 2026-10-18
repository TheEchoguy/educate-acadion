package com.acadion.backend.service;

import com.acadion.backend.dto.syllabus.SyllabusAuditEventResponse;
import com.acadion.backend.entity.*;
import com.acadion.backend.repository.ClassroomRepository;
import com.acadion.backend.repository.SyllabusAuditEventRepository;
import com.acadion.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class SyllabusAuditServiceTest {

    @Mock
    private SyllabusAuditEventRepository auditEventRepository;

    @Mock
    private ClassroomRepository classroomRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private SyllabusAuditService auditService;

    private User teacherOwner;
    private User otherTeacher;
    private Classroom classroom;

    @BeforeEach
    void setUp() {
        teacherOwner = User.builder()
                .id("teacher_1")
                .name("Prof. Turing")
                .email("turing@acadion.com")
                .role(Role.TEACHER)
                .build();

        otherTeacher = User.builder()
                .id("teacher_2")
                .name("Prof. Babbage")
                .email("babbage@acadion.com")
                .role(Role.TEACHER)
                .build();

        classroom = Classroom.builder()
                .id("cls_1")
                .name("Algorithms")
                .teacherId(teacherOwner.getId())
                .status("ACTIVE")
                .build();
    }

    // -------------------------------------------------------------------------
    // 23. Successful important operations produce appropriate audit events
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("23. Successful operations produce append-only audit events with correct actor details")
    void testSuccessfulOperationProducesAuditEvent() {
        when(auditEventRepository.save(any(SyllabusAuditEvent.class))).thenAnswer(inv -> {
            SyllabusAuditEvent ev = inv.getArgument(0);
            ev.setId("evt_1");
            return ev;
        });

        SyllabusAuditEvent event = auditService.recordEvent(
                classroom.getId(),
                "topic_1",
                null,
                null,
                teacherOwner,
                SyllabusAuditEventType.TOPIC_CREATED,
                "Created topic: Greedy Algorithms",
                Map.of("topic", "Greedy Algorithms")
        );

        assertNotNull(event);
        assertEquals("evt_1", event.getId());
        assertEquals(classroom.getId(), event.getClassroomId());
        assertEquals("topic_1", event.getSyllabusTopicId());
        assertEquals(teacherOwner.getId(), event.getActorUserId());
        assertEquals(teacherOwner.getEmail(), event.getActorEmail());
        assertEquals(Role.TEACHER, event.getActorRole());
        assertEquals(SyllabusAuditEventType.TOPIC_CREATED, event.getEventType());
        verify(auditEventRepository, times(1)).save(any(SyllabusAuditEvent.class));
    }

    // -------------------------------------------------------------------------
    // 24. Failed persistence throws ResponseStatusException rather than misleading success
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("24. Persistence failures in audit service are not silently masked")
    void testAuditPersistenceFailureHandled() {
        when(auditEventRepository.save(any(SyllabusAuditEvent.class)))
                .thenThrow(new RuntimeException("MongoDB connection timeout"));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                auditService.recordEvent(
                        classroom.getId(),
                        "topic_1",
                        null,
                        null,
                        teacherOwner,
                        SyllabusAuditEventType.TOPIC_CREATED,
                        "Created topic",
                        Map.of()
                )
        );

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, ex.getStatusCode());
        assertTrue(ex.getReason().contains("Failed to persist syllabus audit record"));
    }

    // -------------------------------------------------------------------------
    // 25. Audit events do not expose sensitive request data
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("25. Audit events strip sensitive keys (password, token, otp, secret)")
    void testSensitiveKeysStrippedFromAuditMetadata() {
        when(auditEventRepository.save(any(SyllabusAuditEvent.class))).thenAnswer(inv -> inv.getArgument(0));

        Map<String, Object> rawMetadata = new HashMap<>();
        rawMetadata.put("topic", "Binary Trees");
        rawMetadata.put("password", "PlainPassword123!");
        rawMetadata.put("token", "jwt.token.string");
        rawMetadata.put("otp", "123456");
        rawMetadata.put("secret", "top_secret_key");

        SyllabusAuditEvent event = auditService.recordEvent(
                classroom.getId(),
                "topic_1",
                null,
                null,
                teacherOwner,
                SyllabusAuditEventType.TOPIC_UPDATED,
                "Updated topic",
                rawMetadata
        );

        assertNotNull(event);
        assertFalse(event.getMetadata().containsKey("password"));
        assertFalse(event.getMetadata().containsKey("token"));
        assertFalse(event.getMetadata().containsKey("otp"));
        assertFalse(event.getMetadata().containsKey("secret"));
        assertTrue(event.getMetadata().containsKey("topic"));
        assertEquals("Binary Trees", event.getMetadata().get("topic"));
    }

    // -------------------------------------------------------------------------
    // 26. Ordinary reads do not create audit events; reading audit history is protected
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("26. Reading audit history requires faculty ownership; unauthorized teacher receives 403")
    void testReadingAuditHistoryRequiresFacultyOwnership() {
        when(classroomRepository.findById(classroom.getId())).thenReturn(Optional.of(classroom));
        when(userRepository.findByEmail(otherTeacher.getEmail())).thenReturn(Optional.of(otherTeacher));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                auditService.getAuditEvents(classroom.getId(), otherTeacher.getEmail())
        );

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        verify(auditEventRepository, never()).findByClassroomIdOrderByTimestampDesc(any());
    }

    @Test
    @DisplayName("27. Authorized teacher can retrieve classroom audit events")
    void testAuthorizedTeacherCanRetrieveAuditEvents() {
        when(classroomRepository.findById(classroom.getId())).thenReturn(Optional.of(classroom));
        when(userRepository.findByEmail(teacherOwner.getEmail())).thenReturn(Optional.of(teacherOwner));

        SyllabusAuditEvent event = SyllabusAuditEvent.builder()
                .id("evt_1")
                .classroomId(classroom.getId())
                .actorUserId(teacherOwner.getId())
                .actorEmail(teacherOwner.getEmail())
                .actorRole(Role.TEACHER)
                .eventType(SyllabusAuditEventType.TOPIC_CREATED)
                .timestamp(LocalDateTime.now())
                .description("Created topic")
                .metadata(Map.of("topic", "Trees"))
                .build();

        when(auditEventRepository.findByClassroomIdOrderByTimestampDesc(classroom.getId()))
                .thenReturn(List.of(event));

        List<SyllabusAuditEventResponse> events = auditService.getAuditEvents(classroom.getId(), teacherOwner.getEmail());

        assertEquals(1, events.size());
        assertEquals("evt_1", events.get(0).getId());
        assertEquals(SyllabusAuditEventType.TOPIC_CREATED, events.get(0).getEventType());
    }
}
