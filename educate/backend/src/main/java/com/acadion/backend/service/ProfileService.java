package com.acadion.backend.service;

import com.acadion.backend.dto.ProfileDTO;
import com.acadion.backend.dto.ProfileUpdateRequest;
import com.acadion.backend.entity.QuestionPaper;
import com.acadion.backend.entity.Role;
import com.acadion.backend.entity.StudentResponse;
import com.acadion.backend.entity.User;
import com.acadion.backend.repository.QuestionPaperRepository;
import com.acadion.backend.repository.StudentResponseRepository;
import com.acadion.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ProfileService {

    private final UserRepository userRepository;
    private final StudentResponseRepository studentResponseRepository;
    private final QuestionPaperRepository questionPaperRepository;

    public ProfileDTO getProfile(String email, String usn) {
        User user = null;
        if (email != null && !email.isBlank()) {
            user = userRepository.findByEmail(email).orElse(null);
        }
        if (user == null && usn != null && !usn.isBlank()) {
            user = userRepository.findByUsn(usn).orElse(null);
        }

        if (user == null) {
            throw new RuntimeException("User profile not found");
        }

        String cleanedCollege = (user.getCollegeName() != null && user.getCollegeName().toUpperCase().contains("HKBK")) 
                ? null 
                : user.getCollegeName();

        String cleanedBatch = (user.getAcademicBatch() != null && user.getAcademicBatch().equals("2023 - 2027")) 
                ? null 
                : user.getAcademicBatch();

        ProfileDTO.ProfileDTOBuilder builder = ProfileDTO.builder()
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .role(user.getRole())
                .verified(user.isVerified())
                .approved(user.isApproved())
                .profilePicture(user.getProfilePicture())
                .phone(user.getPhone())
                .bio(user.getBio())
                .collegeName(cleanedCollege)
                .createdAt(user.getCreatedAt())
                .assignedSubjects(user.getAssignedSubjects() != null ? user.getAssignedSubjects() : List.of());

        if (user.getRole() == Role.STUDENT) {
            builder.usn(user.getUsn())
                    .semester(user.getSemester())
                    .studentDepartment(user.getStudentDepartment())
                    .academicBatch(cleanedBatch);

            // Calculate Student Stats
            if (user.getUsn() != null && !user.getUsn().isBlank()) {
                List<StudentResponse> responses = studentResponseRepository.findByUsnOrderBySubmittedAtAsc(user.getUsn());
                int examsCount = 0;
                int practiceCount = 0;
                double totalScore = 0;
                double totalMax = 0;

                for (StudentResponse r : responses) {
                    boolean isPractice = r.isPractice() ||
                            "PRACTICE".equalsIgnoreCase(r.getSubmissionMode()) ||
                            "PRACTICE".equalsIgnoreCase(r.getPaperCategory()) ||
                            "SELF".equalsIgnoreCase(r.getEvaluationMode()) ||
                            "PEER".equalsIgnoreCase(r.getEvaluationMode());

                    if (isPractice) {
                        practiceCount++;
                    } else {
                        examsCount++;
                    }

                    if (r.getTotalMarks() != null && r.getMaxMarks() != null && r.getMaxMarks() > 0) {
                        totalScore += r.getTotalMarks();
                        totalMax += r.getMaxMarks();
                    }
                }

                double avg = totalMax > 0 ? (totalScore / totalMax) * 100.0 : 0.0;
                builder.examsAttended(examsCount)
                        .practiceAttempts(practiceCount)
                        .averageScore(Math.round(avg * 10.0) / 10.0);

                if (avg >= 70) {
                    builder.riskLevel("ON_TRACK");
                } else if (avg >= 50) {
                    builder.riskLevel("MEDIUM_RISK");
                } else if (examsCount > 0) {
                    builder.riskLevel("HIGH_RISK");
                } else {
                    builder.riskLevel("ON_TRACK");
                }
            }
        } else if (user.getRole() == Role.TEACHER) {
            builder.employeeId(user.getEmployeeId())
                    .designation(user.getDesignation())
                    .teacherDepartment(user.getTeacherDepartment())
                    .qualification(user.getQualification())
                    .experienceYears(user.getExperienceYears())
                    .cabinRoom(user.getCabinRoom());

            List<QuestionPaper> allPapers = questionPaperRepository.findAll();
            List<String> assigned = user.getAssignedSubjects() != null ? user.getAssignedSubjects() : List.of();
            int papersCount = 0;
            java.util.Set<String> teacherPaperIds = new java.util.HashSet<>();
            for (QuestionPaper p : allPapers) {
                if (p.getSubject() != null && assigned.contains(p.getSubject())) {
                    papersCount++;
                    if (p.getPaperId() != null) teacherPaperIds.add(p.getPaperId().toLowerCase());
                }
            }

            List<StudentResponse> allResponses = studentResponseRepository.findAll();
            int evalCount = 0;
            java.util.Set<String> studentUsns = new java.util.HashSet<>();
            for (StudentResponse r : allResponses) {
                boolean matchesTeacher = (user.getName() != null && user.getName().equalsIgnoreCase(r.getEvaluatedBy())) ||
                        (r.getPaperId() != null && teacherPaperIds.contains(r.getPaperId().toLowerCase()));

                if (matchesTeacher) {
                    if (r.getUsn() != null && !r.getUsn().isBlank()) {
                        studentUsns.add(r.getUsn().toUpperCase());
                    }
                }

                if (Boolean.TRUE.equals(r.isEvaluationCompleted()) && matchesTeacher) {
                    evalCount++;
                }
            }

            builder.papersCreated(papersCount)
                    .papersEvaluated(evalCount)
                    .totalStudentsEnrolled(studentUsns.size());
        }

        return builder.build();
    }

    public ProfileDTO updateProfile(String email, ProfileUpdateRequest req) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found: " + email));

        if (req.getName() != null && !req.getName().isBlank()) {
            user.setName(req.getName());
        }
        if (req.getPhone() != null) {
            user.setPhone(req.getPhone());
        }
        if (req.getBio() != null) {
            user.setBio(req.getBio());
        }
        if (req.getCollegeName() != null) {
            user.setCollegeName(req.getCollegeName());
        }
        if (req.getProfilePicture() != null) {
            user.setProfilePicture(req.getProfilePicture());
        }

        if (user.getRole() == Role.STUDENT) {
            if (req.getSemester() != null) {
                user.setSemester(req.getSemester());
            }
            if (req.getStudentDepartment() != null) {
                user.setStudentDepartment(req.getStudentDepartment());
            }
            if (req.getAcademicBatch() != null) {
                user.setAcademicBatch(req.getAcademicBatch());
            }
        } else if (user.getRole() == Role.TEACHER) {
            if (req.getDesignation() != null) {
                user.setDesignation(req.getDesignation());
            }
            if (req.getTeacherDepartment() != null) {
                user.setTeacherDepartment(req.getTeacherDepartment());
            }
            if (req.getQualification() != null) {
                user.setQualification(req.getQualification());
            }
            if (req.getExperienceYears() != null) {
                user.setExperienceYears(req.getExperienceYears());
            }
            if (req.getCabinRoom() != null) {
                user.setCabinRoom(req.getCabinRoom());
            }
        }

        userRepository.save(user);

        return getProfile(user.getEmail(), user.getUsn());
    }
}
