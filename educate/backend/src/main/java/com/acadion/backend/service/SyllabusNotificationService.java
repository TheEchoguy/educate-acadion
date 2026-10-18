package com.acadion.backend.service;

import com.acadion.backend.entity.Classroom;
import com.acadion.backend.entity.ClassroomMembership;
import com.acadion.backend.entity.SyllabusVersion;
import com.acadion.backend.entity.User;
import com.acadion.backend.mail.EmailSenderService;
import com.acadion.backend.repository.ClassroomMembershipRepository;
import com.acadion.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class SyllabusNotificationService {

    private final ClassroomMembershipRepository classroomMembershipRepository;
    private final UserRepository userRepository;
    private final EmailSenderService emailSenderService;

    // In-memory deduplication cache to prevent duplicate email bursts on retried publications
    private final Set<String> sentNotificationCache = ConcurrentHashMap.newKeySet();

    /**
     * Dispatch syllabus publication notifications to all active enrolled students in the classroom.
     * Guaranteed to never throw runtime exceptions to prevent corrupting publication state.
     */
    public int notifySyllabusPublished(Classroom classroom, SyllabusVersion version, User publisher) {
        if (classroom == null || version == null) {
            log.warn("Attempted to send publication notification with null classroom or version");
            return 0;
        }

        String deduplicationKey = classroom.getId() + "_v" + version.getVersionNumber();
        if (!sentNotificationCache.add(deduplicationKey)) {
            log.info("Syllabus publication notification for {} already processed; skipping duplicate", deduplicationKey);
            return 0;
        }

        List<ClassroomMembership> activeMemberships = classroomMembershipRepository
                .findByClassroomIdAndMembershipStatus(classroom.getId(), "ACTIVE");

        if (activeMemberships.isEmpty()) {
            log.info("No active students found in classroom {} for publication notification", classroom.getId());
            return 0;
        }

        int deliveredCount = 0;
        String publisherName = publisher != null && publisher.getName() != null
                ? publisher.getName() : "Course Faculty";

        for (ClassroomMembership membership : activeMemberships) {
            // Exclude publisher if publisher is enrolled
            if (publisher != null && membership.getStudentId().equals(publisher.getId())) {
                continue;
            }

            try {
                User student = userRepository.findById(membership.getStudentId()).orElse(null);
                if (student != null && student.getEmail() != null && !student.getEmail().isBlank()) {
                    emailSenderService.sendSyllabusPublishedEmail(
                            student.getEmail(),
                            student.getName(),
                            classroom.getName(),
                            version.getVersionNumber(),
                            version.getVersionTitle(),
                            version.getChangeSummary(),
                            publisherName
                    );
                    deliveredCount++;
                }
            } catch (Exception e) {
                log.warn("Failed delivering publication email to student {} in classroom {}: {}",
                        membership.getStudentId(), classroom.getId(), e.getMessage());
            }
        }

        log.info("Dispatched syllabus publication notifications to {} active students for classroom {} (v{})",
                deliveredCount, classroom.getId(), version.getVersionNumber());

        return deliveredCount;
    }
}
