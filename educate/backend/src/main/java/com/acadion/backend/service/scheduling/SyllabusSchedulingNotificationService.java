package com.acadion.backend.service.scheduling;

import com.acadion.backend.entity.Classroom;
import com.acadion.backend.entity.ClassroomMembership;
import com.acadion.backend.entity.User;
import com.acadion.backend.entity.scheduling.AcademicDocument;
import com.acadion.backend.entity.scheduling.ScheduledSession;
import com.acadion.backend.entity.scheduling.TeachingSchedulePlan;
import com.acadion.backend.mail.EmailSenderService;
import com.acadion.backend.repository.ClassroomMembershipRepository;
import com.acadion.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class SyllabusSchedulingNotificationService {

    private final ClassroomMembershipRepository membershipRepository;
    private final UserRepository userRepository;
    private final JavaMailSender mailSender;

    private final Set<String> notificationDeduplicationCache = ConcurrentHashMap.newKeySet();

    public int notifySchedulePublished(Classroom classroom, TeachingSchedulePlan plan, User publisher) {
        if (classroom == null || plan == null) return 0;

        String key = "plan_" + classroom.getId() + "_v" + plan.getVersionNumber();
        if (!notificationDeduplicationCache.add(key)) {
            log.info("Schedule publication notification for {} already processed; skipping duplicate", key);
            return 0;
        }

        List<ClassroomMembership> active = membershipRepository.findByClassroomIdAndMembershipStatus(classroom.getId(), "ACTIVE");
        int count = 0;
        String pubName = publisher != null && publisher.getName() != null ? publisher.getName() : "Faculty";

        for (ClassroomMembership m : active) {
            if (publisher != null && m.getStudentId().equals(publisher.getId())) continue;

            try {
                User s = userRepository.findById(m.getStudentId()).orElse(null);
                if (s != null && s.getEmail() != null && !s.getEmail().isBlank()) {
                    SimpleMailMessage msg = new SimpleMailMessage();
                    msg.setTo(s.getEmail());
                    msg.setSubject("Acadion: Teaching Schedule Published for " + classroom.getName());
                    msg.setText(String.format(
                            "Dear %s,\n\nA new teaching schedule plan (v%d - %s) has been approved and published for your course '%s' (%s).\n\n" +
                                    "• Term Duration: %s to %s\n" +
                                    "• Total Planned Sessions: %d classes\n" +
                                    "• Published By: %s\n\n" +
                                    "Please check your Acadion Student Dashboard under 'Teaching Schedule & Modules' to view your upcoming lecture schedule, topics, and room details.\n\n" +
                                    "Best regards,\nAcadion Academic Scheduling",
                            s.getName() != null ? s.getName() : "Student",
                            plan.getVersionNumber(),
                            plan.getPlanTitle() != null ? plan.getPlanTitle() : "Teaching Schedule",
                            classroom.getName(),
                            classroom.getSubjectCode(),
                            plan.getTermStartDate(),
                            plan.getTermEndDate(),
                            plan.getTotalPlannedSessions(),
                            pubName
                    ));
                    mailSender.send(msg);
                    count++;
                }
            } catch (Exception e) {
                log.warn("Failed sending schedule publication email to student {}: {}", m.getStudentId(), e.getMessage());
            }
        }
        log.info("Dispatched schedule published notifications to {} students for classroom {}", count, classroom.getId());
        return count;
    }

    public int notifyModulePdfPublished(Classroom classroom, AcademicDocument doc, User publisher) {
        if (classroom == null || doc == null) return 0;

        String key = "doc_" + classroom.getId() + "_" + doc.getId();
        if (!notificationDeduplicationCache.add(key)) return 0;

        List<ClassroomMembership> active = membershipRepository.findByClassroomIdAndMembershipStatus(classroom.getId(), "ACTIVE");
        int count = 0;
        String pubName = publisher != null && publisher.getName() != null ? publisher.getName() : "Faculty";

        for (ClassroomMembership m : active) {
            if (publisher != null && m.getStudentId().equals(publisher.getId())) continue;

            try {
                User s = userRepository.findById(m.getStudentId()).orElse(null);
                if (s != null && s.getEmail() != null && !s.getEmail().isBlank()) {
                    SimpleMailMessage msg = new SimpleMailMessage();
                    msg.setTo(s.getEmail());
                    msg.setSubject("Acadion: New Study Material Available - " + (doc.getModuleTitle() != null ? doc.getModuleTitle() : "Module Material"));
                    msg.setText(String.format(
                            "Dear %s,\n\nYour instructor %s has published the official study material for '%s' in %s (%s).\n\n" +
                                    "• Material: %s (%s)\n" +
                                    "• File: %s\n\n" +
                                    "You can download and review this PDF anytime from your Acadion Student Workspace.\n\n" +
                                    "Best regards,\nAcadion Learning Support",
                            s.getName() != null ? s.getName() : "Student",
                            pubName,
                            doc.getModuleTitle() != null ? doc.getModuleTitle() : "Module Document",
                            classroom.getName(),
                            classroom.getSubjectCode(),
                            doc.getModuleTitle(),
                            doc.getModuleNumber() != null ? "Module " + doc.getModuleNumber() : "Course Resource",
                            doc.getOriginalFileName()
                    ));
                    mailSender.send(msg);
                    count++;
                }
            } catch (Exception e) {
                log.warn("Failed sending module PDF published email to student {}: {}", m.getStudentId(), e.getMessage());
            }
        }
        log.info("Dispatched module PDF published notifications to {} students for classroom {}", count, classroom.getId());
        return count;
    }

    public int notifySessionRescheduled(Classroom classroom, ScheduledSession session, LocalDate originalDate, LocalDate newDate, String reason, User publisher) {
        if (classroom == null || session == null) return 0;

        List<ClassroomMembership> active = membershipRepository.findByClassroomIdAndMembershipStatus(classroom.getId(), "ACTIVE");
        int count = 0;

        for (ClassroomMembership m : active) {
            if (publisher != null && m.getStudentId().equals(publisher.getId())) continue;

            try {
                User s = userRepository.findById(m.getStudentId()).orElse(null);
                if (s != null && s.getEmail() != null && !s.getEmail().isBlank()) {
                    SimpleMailMessage msg = new SimpleMailMessage();
                    msg.setTo(s.getEmail());
                    msg.setSubject("Acadion: Schedule Adjustment - " + session.getTopicTitle());
                    msg.setText(String.format(
                            "Dear %s,\n\nPlease note a schedule adjustment for '%s' (%s):\n\n" +
                                    "• Topic: %s\n" +
                                    "• Original Date: %s\n" +
                                    "• Rescheduled Date: %s at %s (%s)\n" +
                                    "• Reason: %s\n\n" +
                                    "Your online calendar has been updated accordingly.\n\n" +
                                    "Best regards,\nAcadion Academic Scheduling",
                            s.getName() != null ? s.getName() : "Student",
                            classroom.getName(),
                            classroom.getSubjectCode(),
                            session.getTopicTitle(),
                            originalDate,
                            newDate,
                            session.getStartTime(),
                            session.getRoomNumber() != null ? "Room " + session.getRoomNumber() : "Assigned Room",
                            reason != null && !reason.isBlank() ? reason : "Curriculum pacing adjustment"
                    ));
                    mailSender.send(msg);
                    count++;
                }
            } catch (Exception e) {
                log.warn("Failed sending session reschedule email to student {}: {}", m.getStudentId(), e.getMessage());
            }
        }
        return count;
    }
}
