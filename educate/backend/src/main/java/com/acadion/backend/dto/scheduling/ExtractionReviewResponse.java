package com.acadion.backend.dto.scheduling;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExtractionReviewResponse {
    private String classroomId;
    private String subjectCode;
    private String subjectTitle;
    private String semester;
    private String academicYear;

    @Builder.Default
    private List<DocumentMetadataDTO> documents = new ArrayList<>();

    @Builder.Default
    private List<TimetableSlotDTO> timetableSlots = new ArrayList<>();

    @Builder.Default
    private List<CalendarEventDTO> calendarEvents = new ArrayList<>();

    @Builder.Default
    private List<AssessmentMilestoneDTO> assessmentMilestones = new ArrayList<>();

    @Builder.Default
    private List<ModuleOutlineDTO> moduleOutlines = new ArrayList<>();

    @Builder.Default
    private List<String> warnings = new ArrayList<>();

    private int conflictCount;

    // Subject mapping & mismatch diagnostics
    @Builder.Default
    private List<String> detectedSubjectCodes = new ArrayList<>();
    private String detectedTimetableSubjectCode;
    private String confirmedSubjectCode;
    private String subjectMismatchWarning;

    // Academic calendar unparsed diagnostics
    @Builder.Default
    private List<String> unparsedCalendarEntries = new ArrayList<>();

    // Document-first readiness flags
    private boolean inputsVerified;
    private boolean timetableVerified;
    private boolean calendarVerified;
    private boolean syllabusVerified;
    private boolean hasRequiredDocuments;
    private boolean legacyDataDetected;
    private String verificationSummary;
}
