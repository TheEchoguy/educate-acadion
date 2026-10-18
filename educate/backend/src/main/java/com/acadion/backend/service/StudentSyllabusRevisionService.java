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
import java.util.Collections;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class StudentSyllabusRevisionService {

    private final StudentSyllabusRevisionRepository revisionRepository;
    private final SyllabusVersionRepository syllabusVersionRepository;
    private final ClassroomRepository classroomRepository;
    private final ClassroomMembershipRepository classroomMembershipRepository;
    private final UserRepository userRepository;

    /**
     * Record or update an enrolled student's personal revision progress for a syllabus topic in a published version.
     *
     * <p>Architectural Decision on Versioning:
     * Personal revision status and completion metrics are version-specific (keyed by publishedVersionId)
     * to ensure students track revision against the exact published syllabus criteria.
     * Concurrently, historical revisions remain connected through the stable topicId,
     * allowing the student to inspect their revision trajectory across successive syllabus versions.</p>
     */
    public StudentSyllabusRevisionResponse updateRevisionProgress(
            String classroomId,
            UpdateRevisionProgressRequest request,
            String studentEmail
    ) {
        Classroom classroom = getExistingClassroom(classroomId);
        User student = getAuthenticatedActiveStudent(studentEmail, classroom.getId());

        if (request.getTopicId() == null || request.getTopicId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Topic ID is required");
        }
        if (request.getPublishedVersionId() == null || request.getPublishedVersionId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Published version ID is required");
        }

        SyllabusVersion version = syllabusVersionRepository
                .findByIdAndClassroomId(request.getPublishedVersionId().trim(), classroom.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Published syllabus version not found with ID " + request.getPublishedVersionId()
                                + " in classroom " + classroomId));

        boolean topicExistsInVersion = version.getTopics().stream()
                .anyMatch(snapshot -> snapshot.getTopicId().equals(request.getTopicId().trim()));

        if (!topicExistsInVersion) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "Topic ID " + request.getTopicId() + " does not exist in published syllabus version "
                            + version.getVersionNumber());
        }

        LocalDateTime now = LocalDateTime.now();

        StudentSyllabusRevision revision = revisionRepository
                .findByStudentIdAndClassroomIdAndTopicIdAndPublishedVersionId(
                        student.getId(), classroom.getId(), request.getTopicId().trim(), version.getId())
                .orElseGet(() -> StudentSyllabusRevision.builder()
                        .classroomId(classroom.getId())
                        .studentId(student.getId())
                        .topicId(request.getTopicId().trim())
                        .publishedVersionId(version.getId())
                        .revisionStatus(RevisionStatus.NOT_STARTED)
                        .understandingStatus(UnderstandingStatus.NOT_ASSESSED)
                        .createdAt(now)
                        .build());

        if (request.getRevisionStatus() != null) {
            revision.setRevisionStatus(request.getRevisionStatus());
        }
        if (request.getUnderstandingStatus() != null) {
            revision.setUnderstandingStatus(request.getUnderstandingStatus());
        }
        if (request.getPersonalNotes() != null) {
            revision.setPersonalNotes(request.getPersonalNotes().trim());
        }
        revision.setLastRevisedAt(now);
        revision.setUpdatedAt(now);

        StudentSyllabusRevision saved = revisionRepository.save(revision);
        log.info("Student {} updated revision status to {} (understanding: {}) for topic {} in classroom {}",
                student.getEmail(), saved.getRevisionStatus(), saved.getUnderstandingStatus(),
                saved.getTopicId(), classroomId);

        return toRevisionResponse(saved);
    }

    /**
     * Get all revision records for the authenticated student for a published version (or latest if versionId is null).
     */
    public List<StudentSyllabusRevisionResponse> getStudentRevisions(
            String classroomId,
            String publishedVersionId,
            String studentEmail
    ) {
        Classroom classroom = getExistingClassroom(classroomId);
        User student = getAuthenticatedActiveStudent(studentEmail, classroom.getId());

        String targetVersionId = publishedVersionId;
        if (targetVersionId == null || targetVersionId.isBlank()) {
            Optional<SyllabusVersion> latestOpt = syllabusVersionRepository
                    .findTopByClassroomIdOrderByVersionNumberDesc(classroom.getId());
            if (latestOpt.isEmpty()) {
                return Collections.emptyList();
            }
            targetVersionId = latestOpt.get().getId();
        } else {
            verifyPublishedVersionExists(targetVersionId, classroom.getId());
        }

        return revisionRepository
                .findByStudentIdAndClassroomIdAndPublishedVersionId(student.getId(), classroom.getId(), targetVersionId)
                .stream()
                .map(this::toRevisionResponse)
                .toList();
    }

    /**
     * Backward-compatible alias for getStudentRevisions.
     */
    public List<StudentSyllabusRevisionResponse> getStudentRevisionsForVersion(
            String classroomId,
            String publishedVersionId,
            String studentEmail
    ) {
        return getStudentRevisions(classroomId, publishedVersionId, studentEmail);
    }

    /**
     * Retrieve a student's longitudinal revision history for a topic across all published versions.
     */
    public List<StudentSyllabusRevisionResponse> getStudentTopicRevisionHistory(
            String classroomId,
            String topicId,
            String studentEmail
    ) {
        Classroom classroom = getExistingClassroom(classroomId);
        User student = getAuthenticatedActiveStudent(studentEmail, classroom.getId());

        return revisionRepository
                .findByStudentIdAndClassroomIdAndTopicIdOrderByCreatedAtAsc(student.getId(), classroom.getId(), topicId)
                .stream()
                .map(this::toRevisionResponse)
                .toList();
    }

    /**
     * Get aggregated revision and self-reported understanding metrics for the authenticated student.
     */
    public StudentRevisionSummaryResponse getStudentRevisionSummary(
            String classroomId,
            String publishedVersionId,
            String studentEmail
    ) {
        Classroom classroom = getExistingClassroom(classroomId);
        User student = getAuthenticatedActiveStudent(studentEmail, classroom.getId());

        SyllabusVersion version;
        if (publishedVersionId != null && !publishedVersionId.isBlank()) {
            version = verifyPublishedVersionExists(publishedVersionId, classroom.getId());
        } else {
            Optional<SyllabusVersion> latestOpt = syllabusVersionRepository
                    .findTopByClassroomIdOrderByVersionNumberDesc(classroom.getId());
            if (latestOpt.isEmpty()) {
                return StudentRevisionSummaryResponse.builder()
                        .classroomId(classroomId)
                        .studentId(student.getId())
                        .publishedVersionId(null)
                        .totalTopics(0)
                        .revisedCount(0)
                        .inProgressCount(0)
                        .notStartedCount(0)
                        .revisionPercentage(0.0)
                        .confidentCount(0)
                        .understoodCount(0)
                        .needsRevisionCount(0)
                        .notAssessedCount(0)
                        .build();
            }
            version = latestOpt.get();
        }

        String actualVersionId = version.getId();
        long totalTopics = version.getTopicCount() != null ? version.getTopicCount() : 0;

        long revised = revisionRepository.countByStudentIdAndClassroomIdAndPublishedVersionIdAndRevisionStatus(
                student.getId(), classroom.getId(), actualVersionId, RevisionStatus.REVISED);
        long inProgress = revisionRepository.countByStudentIdAndClassroomIdAndPublishedVersionIdAndRevisionStatus(
                student.getId(), classroom.getId(), actualVersionId, RevisionStatus.IN_PROGRESS);

        // Untracked topics in the version are treated as NOT_STARTED
        long trackedRevisions = revisionRepository.countByStudentIdAndClassroomIdAndPublishedVersionId(
                student.getId(), classroom.getId(), actualVersionId);
        long explicitNotStarted = revisionRepository.countByStudentIdAndClassroomIdAndPublishedVersionIdAndRevisionStatus(
                student.getId(), classroom.getId(), actualVersionId, RevisionStatus.NOT_STARTED);
        long notStarted = explicitNotStarted + Math.max(0, totalTopics - trackedRevisions);

        double revisionPercentage = 0.0;
        if (totalTopics > 0) {
            revisionPercentage = Math.round(((double) revised / totalTopics) * 10000.0) / 100.0;
        }

        long confident = revisionRepository.countByStudentIdAndClassroomIdAndPublishedVersionIdAndUnderstandingStatus(
                student.getId(), classroom.getId(), actualVersionId, UnderstandingStatus.CONFIDENT);
        long understood = revisionRepository.countByStudentIdAndClassroomIdAndPublishedVersionIdAndUnderstandingStatus(
                student.getId(), classroom.getId(), actualVersionId, UnderstandingStatus.UNDERSTOOD);
        long needsRevision = revisionRepository.countByStudentIdAndClassroomIdAndPublishedVersionIdAndUnderstandingStatus(
                student.getId(), classroom.getId(), actualVersionId, UnderstandingStatus.NEEDS_REVISION);
        long explicitNotAssessed = revisionRepository.countByStudentIdAndClassroomIdAndPublishedVersionIdAndUnderstandingStatus(
                student.getId(), classroom.getId(), actualVersionId, UnderstandingStatus.NOT_ASSESSED);
        long notAssessed = explicitNotAssessed + Math.max(0, totalTopics - trackedRevisions);

        return StudentRevisionSummaryResponse.builder()
                .classroomId(classroomId)
                .studentId(student.getId())
                .publishedVersionId(actualVersionId)
                .totalTopics(totalTopics)
                .revisedCount(revised)
                .inProgressCount(inProgress)
                .notStartedCount(notStarted)
                .revisionPercentage(revisionPercentage)
                .confidentCount(confident)
                .understoodCount(understood)
                .needsRevisionCount(needsRevision)
                .notAssessedCount(notAssessed)
                .build();
    }

    // =========================================================================
    // HELPER & SECURITY METHODS
    // =========================================================================

    private Classroom getExistingClassroom(String classroomId) {
        return classroomRepository.findById(classroomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Classroom not found: " + classroomId));
    }

    private User getAuthenticatedActiveStudent(String email, String classroomId) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User account not found"));

        if (user.getRole() != Role.STUDENT) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Access denied: Only enrolled students can track personal syllabus revision");
        }

        Optional<ClassroomMembership> membershipOpt = classroomMembershipRepository
                .findByClassroomIdAndStudentId(classroomId, user.getId());

        if (membershipOpt.isEmpty() || !"ACTIVE".equalsIgnoreCase(membershipOpt.get().getMembershipStatus())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Access denied: You do not have an active enrollment in this classroom");
        }

        return user;
    }

    private SyllabusVersion verifyPublishedVersionExists(String versionId, String classroomId) {
        return syllabusVersionRepository.findByIdAndClassroomId(versionId, classroomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Published syllabus version not found with ID " + versionId + " in classroom " + classroomId));
    }

    private StudentSyllabusRevisionResponse toRevisionResponse(StudentSyllabusRevision r) {
        return StudentSyllabusRevisionResponse.builder()
                .id(r.getId())
                .classroomId(r.getClassroomId())
                .studentId(r.getStudentId())
                .topicId(r.getTopicId())
                .publishedVersionId(r.getPublishedVersionId())
                .revisionStatus(r.getRevisionStatus())
                .understandingStatus(r.getUnderstandingStatus())
                .lastRevisedAt(r.getLastRevisedAt())
                .personalNotes(r.getPersonalNotes())
                .createdAt(r.getCreatedAt())
                .updatedAt(r.getUpdatedAt())
                .build();
    }
}
