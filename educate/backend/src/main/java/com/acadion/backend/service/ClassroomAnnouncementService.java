package com.acadion.backend.service;

import com.acadion.backend.entity.Classroom;
import com.acadion.backend.entity.ClassroomAnnouncement;
import com.acadion.backend.entity.ClassroomMembership;
import com.acadion.backend.entity.User;
import com.acadion.backend.repository.ClassroomAnnouncementRepository;
import com.acadion.backend.repository.ClassroomMembershipRepository;
import com.acadion.backend.repository.ClassroomRepository;
import com.acadion.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ClassroomAnnouncementService {

    private final ClassroomAnnouncementRepository announcementRepository;
    private final ClassroomRepository classroomRepository;
    private final ClassroomMembershipRepository membershipRepository;
    private final UserRepository userRepository;

    public List<ClassroomAnnouncement> getAnnouncements(String classroomId, String userEmail) {
        verifyClassroomAccess(classroomId, userEmail);
        return announcementRepository.findByClassroomIdOrderByCreatedAtDesc(classroomId);
    }

    public ClassroomAnnouncement createAnnouncement(
            String classroomId,
            String title,
            String message,
            String category,
            boolean isPinned,
            List<MultipartFile> files,
            String teacherEmail
    ) throws IOException {
        Classroom classroom = verifyTeacherOwnership(classroomId, teacherEmail);
        User teacher = getUserByEmail(teacherEmail);

        if (title == null || title.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Announcement title cannot be empty");
        }

        String author = teacher.getName() != null && !teacher.getName().isBlank()
                ? (teacher.getName().toLowerCase().startsWith("prof") ? teacher.getName() : "Prof. " + teacher.getName())
                : "Course Instructor";

        String normalizedCategory = (category != null && !category.trim().isEmpty())
                ? category.trim().toUpperCase()
                : "GENERAL";

        String announcementId = UUID.randomUUID().toString();
        List<ClassroomAnnouncement.AnnouncementAttachment> attachments = new ArrayList<>();

        if (files != null && !files.isEmpty()) {
            for (MultipartFile file : files) {
                if (file == null || file.isEmpty()) continue;
                String attId = UUID.randomUUID().toString();
                String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "document.pdf";
                String contentType = file.getContentType() != null ? file.getContentType() : "application/octet-stream";
                String fileUrl = "/api/classrooms/" + classroomId + "/announcements/" + announcementId + "/attachments/" + attId + "/download";

                attachments.add(ClassroomAnnouncement.AnnouncementAttachment.builder()
                        .id(attId)
                        .fileName(originalName)
                        .fileUrl(fileUrl)
                        .fileType(determineFileType(originalName, contentType))
                        .fileSize(file.getSize())
                        .fileData(file.getBytes())
                        .build());
            }
        }

        ClassroomAnnouncement announcement = ClassroomAnnouncement.builder()
                .id(announcementId)
                .classroomId(classroomId)
                .teacherId(teacher.getId())
                .authorName(author)
                .title(title.trim())
                .message(message != null ? message.trim() : "")
                .category(normalizedCategory)
                .attachedResources(attachments)
                .createdAt(Instant.now())
                .isPinned(isPinned)
                .build();

        ClassroomAnnouncement saved = announcementRepository.save(announcement);
        log.info("Created classroom announcement '{}' with {} attachments in classroom {}",
                saved.getTitle(), attachments.size(), classroomId);
        return saved;
    }

    public void deleteAnnouncement(String classroomId, String announcementId, String teacherEmail) {
        verifyTeacherOwnership(classroomId, teacherEmail);
        ClassroomAnnouncement announcement = announcementRepository.findById(announcementId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Announcement not found: " + announcementId));

        if (!classroomId.equals(announcement.getClassroomId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Announcement does not belong to this classroom");
        }

        announcementRepository.delete(announcement);
        log.info("Deleted classroom announcement {} from classroom {}", announcementId, classroomId);
    }

    public ClassroomAnnouncement.AnnouncementAttachment getAttachment(
            String classroomId,
            String announcementId,
            String attachmentId,
            String userEmail
    ) {
        verifyClassroomAccess(classroomId, userEmail);
        ClassroomAnnouncement announcement = announcementRepository.findById(announcementId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Announcement not found: " + announcementId));

        if (!classroomId.equals(announcement.getClassroomId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Announcement does not belong to this classroom");
        }

        return announcement.getAttachedResources().stream()
                .filter(att -> attachmentId.equals(att.getId()))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Attachment not found: " + attachmentId));
    }

    private Classroom verifyTeacherOwnership(String classroomId, String teacherEmail) {
        Classroom classroom = classroomRepository.findById(classroomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Classroom not found: " + classroomId));
        User user = getUserByEmail(teacherEmail);

        boolean isOwner = classroom.getTeacherId() != null &&
                (classroom.getTeacherId().equals(user.getId()) || classroom.getTeacherId().equalsIgnoreCase(user.getEmail()));
        boolean isAdmin = user.getRole() != null && "ADMIN".equalsIgnoreCase(user.getRole().name());

        if (!isOwner && !isAdmin) {
            throw new AccessDeniedException("Access denied: You are not the authorized instructor for this classroom");
        }
        return classroom;
    }

    private void verifyClassroomAccess(String classroomId, String userEmail) {
        Classroom classroom = classroomRepository.findById(classroomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Classroom not found: " + classroomId));
        User user = getUserByEmail(userEmail);

        boolean isAdmin = user.getRole() != null && "ADMIN".equalsIgnoreCase(user.getRole().name());
        if (isAdmin) return;

        boolean isTeacherOwner = classroom.getTeacherId() != null &&
                (classroom.getTeacherId().equals(user.getId()) || classroom.getTeacherId().equalsIgnoreCase(user.getEmail()));
        if (isTeacherOwner) return;

        // Check student enrollment in classroom
        boolean isEnrolledInList = classroom.getStudentIds() != null && classroom.getStudentIds().contains(user.getId());
        if (isEnrolledInList) return;

        Optional<ClassroomMembership> membership = membershipRepository.findByClassroomIdAndStudentId(classroomId, user.getId());
        if (membership.isPresent() && "ACTIVE".equalsIgnoreCase(membership.get().getMembershipStatus())) {
            return;
        }

        // Also check if student's email or USN is enrolled in snapshot
        if (classroom.getEnrolledStudents() != null) {
            boolean inSnapshot = classroom.getEnrolledStudents().stream()
                    .anyMatch(s -> (user.getId() != null && user.getId().equals(s.getStudentId())) ||
                            (user.getEmail() != null && user.getEmail().equalsIgnoreCase(s.getEmail())) ||
                            (user.getUsn() != null && user.getUsn().equalsIgnoreCase(s.getUsn())));
            if (inSnapshot) return;
        }

        throw new AccessDeniedException("Access denied: You are not enrolled in or managing this classroom");
    }

    private User getUserByEmail(String email) {
        return userRepository.findFirstByEmailIgnoreCase(email)
                .or(() -> userRepository.findByEmail(email))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found: " + email));
    }

    private String determineFileType(String fileName, String defaultType) {
        String lower = fileName.toLowerCase();
        if (lower.endsWith(".pdf")) return "PDF";
        if (lower.endsWith(".pptx") || lower.endsWith(".ppt")) return "PPTX";
        if (lower.endsWith(".docx") || lower.endsWith(".doc")) return "DOCX";
        if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return "XLSX";
        if (lower.endsWith(".zip")) return "ZIP";
        if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "IMAGE";
        return defaultType;
    }
}
