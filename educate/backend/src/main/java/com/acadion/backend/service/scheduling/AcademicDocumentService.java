package com.acadion.backend.service.scheduling;

import com.acadion.backend.dto.scheduling.DocumentMetadataDTO;
import com.acadion.backend.entity.Classroom;
import com.acadion.backend.entity.ClassroomMembership;
import com.acadion.backend.entity.User;
import com.acadion.backend.entity.scheduling.AcademicDocument;
import com.acadion.backend.entity.scheduling.AcademicDocumentType;
import com.acadion.backend.repository.ClassroomMembershipRepository;
import com.acadion.backend.repository.ClassroomRepository;
import com.acadion.backend.repository.UserRepository;
import com.acadion.backend.repository.scheduling.AcademicDocumentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AcademicDocumentService {

    private final AcademicDocumentRepository documentRepository;
    private final ClassroomRepository classroomRepository;
    private final ClassroomMembershipRepository membershipRepository;
    private final UserRepository userRepository;
    private final SyllabusSchedulingNotificationService notificationService;

    public DocumentMetadataDTO uploadDocument(
            String classroomId,
            AcademicDocumentType documentType,
            Integer moduleNumber,
            String moduleTitle,
            MultipartFile file,
            String teacherEmail
    ) throws IOException {
        Classroom classroom = verifyTeacherOwnership(classroomId, teacherEmail);

        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File cannot be empty");
        }

        // Validate 15MB file size limit
        long maxSizeBytes = 15L * 1024 * 1024;
        if (file.getSize() > maxSizeBytes) {
            throw new IllegalArgumentException("File size exceeds 15MB maximum upload limit");
        }

        String origName = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
        if (!origName.endsWith(".pdf") && !origName.endsWith(".docx") && !origName.endsWith(".doc") &&
                !origName.endsWith(".xlsx") && !origName.endsWith(".xls") &&
                !origName.endsWith(".csv") && !origName.endsWith(".txt") && !origName.endsWith(".pptx") &&
                !origName.endsWith(".png") && !origName.endsWith(".jpg") && !origName.endsWith(".jpeg")) {
            throw new IllegalArgumentException("Unsupported file format. Please upload a PDF, Word document (DOCX), Excel spreadsheet (XLSX/XLS), CSV, or text file.");
        }

        byte[] bytes = file.getBytes();
        String hash = computeSha256(bytes);

        // Check if duplicate document already exists in this classroom (for general resources)
        boolean isRequiredPlanningDoc = documentType == AcademicDocumentType.TIMETABLE ||
                documentType == AcademicDocumentType.ACADEMIC_CALENDAR ||
                documentType == AcademicDocumentType.OFFICIAL_SYLLABUS;

        if (!isRequiredPlanningDoc) {
            AcademicDocument existing = documentRepository.findByClassroomIdAndContentHash(classroomId, hash).orElse(null);
            if (existing != null && "EXTRACTED".equals(existing.getProcessingStatus())) {
                log.info("Duplicate resource document detected for classroom {} with hash {}", classroomId, hash);
                return toDTO(existing);
            }
        }

        int version = 1;
        if (documentType == AcademicDocumentType.MODULE_PDF && moduleNumber != null) {
            Optional<AcademicDocument> existingMod = documentRepository.findByClassroomIdAndDocumentTypeAndModuleNumber(classroomId, documentType, moduleNumber);
            if (existingMod.isPresent()) {
                version = existingMod.get().getVersion() + 1;
                log.info("Replacing existing module {} document in classroom {}", moduleNumber, classroomId);
                documentRepository.delete(existingMod.get());
            }
        } else if (isRequiredPlanningDoc) {
            List<AcademicDocument> existingList = documentRepository.findByClassroomIdAndDocumentType(classroomId, documentType);
            if (!existingList.isEmpty()) {
                version = existingList.stream().mapToInt(AcademicDocument::getVersion).max().orElse(0) + 1;
                log.info("Replacing existing {} document in classroom {} (new version v{})", documentType, classroomId, version);
                documentRepository.deleteAll(existingList);
            }
            // Invalidate verification whenever a planning document is uploaded or replaced
            classroom.setSchedulingInputsVerified(false);
            classroomRepository.save(classroom);
        }

        AcademicDocument doc = AcademicDocument.builder()
                .classroomId(classroomId)
                .subjectCode(classroom.getSubjectCode())
                .documentType(documentType)
                .moduleNumber(moduleNumber)
                .moduleTitle(moduleTitle != null && !moduleTitle.isBlank() ? moduleTitle.trim() : (moduleNumber != null ? "Module " + moduleNumber : null))
                .originalFileName(file.getOriginalFilename())
                .contentType(file.getContentType())
                .fileSize(file.getSize())
                .contentHash(hash)
                .fileData(bytes)
                .version(version)
                .processingStatus("EXTRACTED")
                .uploadedAt(LocalDateTime.now())
                .uploadedBy(teacherEmail)
                .published(false)
                .build();

        AcademicDocument saved = documentRepository.save(doc);
        log.info("Successfully uploaded academic document: id={}, type={}, version=v{}, classroom={}", saved.getId(), documentType, version, classroomId);
        return toDTO(saved);
    }

    public List<DocumentMetadataDTO> listDocumentsForTeacher(String classroomId, String teacherEmail) {
        verifyTeacherOwnership(classroomId, teacherEmail);
        return documentRepository.findByClassroomId(classroomId)
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    public List<DocumentMetadataDTO> listPublishedModulesForStudent(String classroomId, String studentEmail) {
        verifyStudentEnrollment(classroomId, studentEmail);
        return documentRepository.findByClassroomIdAndPublishedTrue(classroomId)
                .stream()
                .filter(d -> d.getDocumentType() == AcademicDocumentType.MODULE_PDF)
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    public AcademicDocument getDocumentBytesForTeacher(String classroomId, String docId, String teacherEmail) {
        verifyTeacherOwnership(classroomId, teacherEmail);
        return documentRepository.findById(docId)
                .filter(d -> d.getClassroomId().equals(classroomId))
                .orElseThrow(() -> new IllegalArgumentException("Document not found"));
    }

    public AcademicDocument getPublishedDocumentBytesForStudent(String classroomId, String docId, String studentEmail) {
        verifyStudentEnrollment(classroomId, studentEmail);
        return documentRepository.findById(docId)
                .filter(d -> d.getClassroomId().equals(classroomId) && d.isPublished())
                .orElseThrow(() -> new IllegalArgumentException("Published document not found or access denied"));
    }

    public DocumentMetadataDTO publishModuleDocument(String classroomId, String docId, String teacherEmail) {
        Classroom classroom = verifyTeacherOwnership(classroomId, teacherEmail);
        AcademicDocument doc = documentRepository.findById(docId)
                .filter(d -> d.getClassroomId().equals(classroomId))
                .orElseThrow(() -> new IllegalArgumentException("Document not found"));

        doc.setPublished(true);
        doc.setPublishedAt(LocalDateTime.now());
        AcademicDocument updated = documentRepository.save(doc);

        User teacher = userRepository.findByEmail(teacherEmail).orElse(null);
        notificationService.notifyModulePdfPublished(classroom, updated, teacher);

        log.info("Teacher {} published module document {} for classroom {}", teacherEmail, docId, classroomId);
        return toDTO(updated);
    }

    public DocumentMetadataDTO unpublishModuleDocument(String classroomId, String docId, String teacherEmail) {
        verifyTeacherOwnership(classroomId, teacherEmail);
        AcademicDocument doc = documentRepository.findById(docId)
                .filter(d -> d.getClassroomId().equals(classroomId))
                .orElseThrow(() -> new IllegalArgumentException("Document not found"));

        doc.setPublished(false);
        doc.setPublishedAt(null);
        AcademicDocument updated = documentRepository.save(doc);

        log.info("Teacher {} unpublished module document {} for classroom {}", teacherEmail, docId, classroomId);
        return toDTO(updated);
    }

    public void deleteDocument(String classroomId, String docId, String teacherEmail) {
        verifyTeacherOwnership(classroomId, teacherEmail);
        AcademicDocument doc = documentRepository.findById(docId)
                .filter(d -> d.getClassroomId().equals(classroomId))
                .orElseThrow(() -> new IllegalArgumentException("Document not found"));
        documentRepository.delete(doc);

        if (doc.getDocumentType() == AcademicDocumentType.TIMETABLE ||
            doc.getDocumentType() == AcademicDocumentType.ACADEMIC_CALENDAR ||
            doc.getDocumentType() == AcademicDocumentType.OFFICIAL_SYLLABUS) {
            Classroom classroom = classroomRepository.findById(classroomId).orElse(null);
            if (classroom != null) {
                classroom.setSchedulingInputsVerified(false);
                classroomRepository.save(classroom);
            }
        }
        log.info("Deleted academic document {} from classroom {}", docId, classroomId);
    }

    public Classroom verifyTeacherOwnership(String classroomId, String teacherEmail) {
        Classroom classroom = classroomRepository.findById(classroomId)
                .orElseThrow(() -> new IllegalArgumentException("Classroom not found: " + classroomId));
        User user = userRepository.findByEmail(teacherEmail)
                .orElseThrow(() -> new AccessDeniedException("User not found: " + teacherEmail));

        boolean isOwner = classroom.getTeacherId() != null && classroom.getTeacherId().equals(user.getId());
        boolean isAdmin = user.getRole() != null && user.getRole().name().equals("ADMIN");

        if (!isOwner && !isAdmin) {
            throw new AccessDeniedException("Access denied: You are not the authorized instructor for this classroom");
        }
        return classroom;
    }

    public Classroom verifyStudentEnrollment(String classroomId, String studentEmail) {
        Classroom classroom = classroomRepository.findById(classroomId)
                .orElseThrow(() -> new IllegalArgumentException("Classroom not found: " + classroomId));
        User user = userRepository.findByEmail(studentEmail)
                .orElseThrow(() -> new AccessDeniedException("User not found: " + studentEmail));

        if (user.getRole() != null && user.getRole().name().equals("ADMIN")) {
            return classroom;
        }

        Optional<ClassroomMembership> membershipOpt = membershipRepository.findByClassroomIdAndStudentId(classroomId, user.getId());
        boolean isActive = membershipOpt.isPresent() && "ACTIVE".equalsIgnoreCase(membershipOpt.get().getMembershipStatus());

        if (!isActive) {
            throw new AccessDeniedException("Access denied: You are not actively enrolled in this classroom");
        }
        return classroom;
    }

    private String computeSha256(byte[] data) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(data);
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            return String.valueOf(data.length);
        }
    }

    public DocumentMetadataDTO toDTO(AcademicDocument d) {
        return DocumentMetadataDTO.builder()
                .id(d.getId())
                .classroomId(d.getClassroomId())
                .subjectCode(d.getSubjectCode())
                .documentType(d.getDocumentType())
                .moduleNumber(d.getModuleNumber())
                .moduleTitle(d.getModuleTitle())
                .originalFileName(d.getOriginalFileName())
                .contentType(d.getContentType())
                .fileSize(d.getFileSize())
                .formattedFileSize(formatBytes(d.getFileSize()))
                .version(d.getVersion() > 0 ? d.getVersion() : 1)
                .contentHash(d.getContentHash())
                .processingStatus(d.getProcessingStatus())
                .extractedSummary(d.getExtractedSummary())
                .published(d.isPublished())
                .publishedAt(d.getPublishedAt())
                .uploadedAt(d.getUploadedAt())
                .uploadedBy(d.getUploadedBy())
                .build();
    }

    public static String formatBytes(long bytes) {
        if (bytes >= 1048576) {
            return String.format("%.1f MB", bytes / (1024.0 * 1024.0));
        } else if (bytes >= 1024) {
            return String.format("%d KB", bytes / 1024);
        } else {
            return bytes + " B";
        }
    }
}
