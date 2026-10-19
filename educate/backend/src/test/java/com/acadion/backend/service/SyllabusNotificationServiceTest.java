package com.acadion.backend.service;

import com.acadion.backend.entity.Classroom;
import com.acadion.backend.entity.ClassroomMembership;
import com.acadion.backend.entity.Role;
import com.acadion.backend.entity.SyllabusVersion;
import com.acadion.backend.entity.User;
import com.acadion.backend.mail.EmailSenderService;
import com.acadion.backend.repository.ClassroomMembershipRepository;
import com.acadion.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class SyllabusNotificationServiceTest {

    @Mock
    private ClassroomMembershipRepository membershipRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private EmailSenderService emailSenderService;

    @InjectMocks
    private SyllabusNotificationService notificationService;

    private User teacherPublisher;
    private User activeStudent1;
    private User activeStudent2;
    private Classroom classroom;
    private SyllabusVersion version;

    @BeforeEach
    void setUp() {
        teacherPublisher = User.builder()
                .id("teacher-1")
                .email("teacher@acadion.com")
                .name("Prof. Smith")
                .role(Role.TEACHER)
                .build();

        activeStudent1 = User.builder()
                .id("st-1")
                .email("student1@acadion.com")
                .name("Student One")
                .role(Role.STUDENT)
                .build();

        activeStudent2 = User.builder()
                .id("st-2")
                .email("student2@acadion.com")
                .name("Student Two")
                .role(Role.STUDENT)
                .build();

        classroom = Classroom.builder()
                .id("class-1")
                .name("Data Structures")
                .teacherId("teacher-1")
                .build();

        version = SyllabusVersion.builder()
                .id("ver-1")
                .classroomId("class-1")
                .versionNumber(1)
                .versionTitle("v1.0")
                .changeSummary("Initial publication")
                .build();
    }

    @Test
    @DisplayName("Publication notification delivers emails only to active members, excluding the publisher")
    void testNotifyPublication_sendsToActiveMembersExcludingPublisher() {
        ClassroomMembership m1 = ClassroomMembership.builder().classroomId("class-1").studentId("st-1").membershipStatus("ACTIVE").build();
        ClassroomMembership m2 = ClassroomMembership.builder().classroomId("class-1").studentId("st-2").membershipStatus("ACTIVE").build();
        ClassroomMembership mPublisher = ClassroomMembership.builder().classroomId("class-1").studentId("teacher-1").membershipStatus("ACTIVE").build();

        when(membershipRepository.findByClassroomIdAndMembershipStatus("class-1", "ACTIVE"))
                .thenReturn(List.of(m1, m2, mPublisher));

        when(userRepository.findById("st-1")).thenReturn(Optional.of(activeStudent1));
        when(userRepository.findById("st-2")).thenReturn(Optional.of(activeStudent2));

        int count = notificationService.notifySyllabusPublished(classroom, version, teacherPublisher);

        assertEquals(2, count);

        // Verify activeStudent1 and activeStudent2 received email
        verify(emailSenderService, times(1)).sendSyllabusPublishedEmail(
                eq("student1@acadion.com"), eq("Student One"), eq("Data Structures"), eq(1), eq("v1.0"), eq("Initial publication"), eq("Prof. Smith")
        );
        verify(emailSenderService, times(1)).sendSyllabusPublishedEmail(
                eq("student2@acadion.com"), eq("Student Two"), eq("Data Structures"), eq(1), eq("v1.0"), eq("Initial publication"), eq("Prof. Smith")
        );

        // Verify publisher did NOT receive email
        verify(emailSenderService, never()).sendSyllabusPublishedEmail(
                eq("teacher@acadion.com"), any(), any(), anyInt(), any(), any(), any()
        );
    }

    @Test
    @DisplayName("Duplicate publication requests within window are deduplicated and do not send duplicate emails")
    void testNotifyPublication_deduplicatesCalls() {
        ClassroomMembership m1 = ClassroomMembership.builder().classroomId("class-1").studentId("st-1").membershipStatus("ACTIVE").build();
        when(membershipRepository.findByClassroomIdAndMembershipStatus("class-1", "ACTIVE")).thenReturn(List.of(m1));
        when(userRepository.findById("st-1")).thenReturn(Optional.of(activeStudent1));

        // First call
        int count1 = notificationService.notifySyllabusPublished(classroom, version, teacherPublisher);
        assertEquals(1, count1);

        // Second call with same version
        int count2 = notificationService.notifySyllabusPublished(classroom, version, teacherPublisher);
        assertEquals(0, count2);

        // Should have sent only 1 email total due to deduplication
        verify(emailSenderService, times(1)).sendSyllabusPublishedEmail(any(), any(), any(), anyInt(), any(), any(), any());
    }

    @Test
    @DisplayName("Email sending failure is isolated and does not disrupt the publication flow")
    void testNotifyPublication_mailExceptionHandledGracefully() {
        ClassroomMembership m1 = ClassroomMembership.builder().classroomId("class-1").studentId("st-1").membershipStatus("ACTIVE").build();
        when(membershipRepository.findByClassroomIdAndMembershipStatus("class-1", "ACTIVE")).thenReturn(List.of(m1));
        when(userRepository.findById("st-1")).thenReturn(Optional.of(activeStudent1));

        doThrow(new RuntimeException("SMTP connection timed out"))
                .when(emailSenderService).sendSyllabusPublishedEmail(any(), any(), any(), anyInt(), any(), any(), any());

        // Should not throw exception
        assertDoesNotThrow(() ->
                notificationService.notifySyllabusPublished(classroom, version, teacherPublisher));
    }
}
