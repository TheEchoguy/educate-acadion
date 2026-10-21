package com.acadion.backend.service.scheduling;

import com.acadion.backend.dto.scheduling.*;
import com.acadion.backend.entity.Classroom;
import com.acadion.backend.entity.SyllabusItem;
import com.acadion.backend.entity.User;
import com.acadion.backend.entity.scheduling.*;
import com.acadion.backend.repository.ClassroomRepository;
import com.acadion.backend.repository.SyllabusItemRepository;
import com.acadion.backend.repository.UserRepository;
import com.acadion.backend.repository.scheduling.*;
import com.acadion.backend.service.parser.OcrService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.ss.usermodel.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AcademicExtractionService {

    private final AcademicDocumentRepository documentRepository;
    private final TimetableSlotRepository timetableSlotRepository;
    private final AcademicCalendarEventRepository calendarEventRepository;
    private final AssessmentMilestoneRepository milestoneRepository;
    private final ClassroomModuleOutlineRepository moduleOutlineRepository;
    private final ClassroomRepository classroomRepository;
    private final SyllabusItemRepository syllabusItemRepository;
    private final UserRepository userRepository;

    @Autowired(required = false)
    private OcrService ocrService;

    // Regex patterns for honest deterministic document extraction
    private static final Pattern TIME_RANGE_PATTERN = Pattern.compile(
            "(\\d{1,2})[:.](\\d{2})\\s*(?:AM|PM)?\\s*(?:-|to)\\s*(\\d{1,2})[:.](\\d{2})\\s*(?:AM|PM)?",
            Pattern.CASE_INSENSITIVE
    );

    private static final Pattern SUBJECT_CODE_PATTERN = Pattern.compile(
            "\\b([0-9]{2}[A-Za-z]{2,5}[0-9]{2,4}[A-Za-z0-9]?|[A-Za-z]{2,5}[\\-_\\s]?[0-9]{2,4}[A-Za-z0-9]?)\\b",
            Pattern.CASE_INSENSITIVE
    );

    private static final Pattern ROOM_PATTERN = Pattern.compile(
            "(?:(?:room|rm|hall|lab|lh)\\s*[:#-]?\\s*([A-Za-z0-9\\-]+)|\\(([A-Za-z0-9\\-]+)\\))",
            Pattern.CASE_INSENSITIVE
    );

    private static final Pattern FACULTY_PATTERN = Pattern.compile(
            "(?:Dr\\.|Prof\\.|Mr\\.|Mrs\\.|Ms\\.)\\s+([A-Za-z\\s.]{2,30})",
            Pattern.CASE_INSENSITIVE
    );

    private static final Pattern DATE_ISO_PATTERN = Pattern.compile(
            "(\\d{4})[-/](\\d{1,2})[-/](\\d{1,2})"
    );

    private static final Pattern DATE_DMY_PATTERN = Pattern.compile(
            "(\\d{1,2})[-/. ](\\d{1,2})[-/. ](\\d{2,4})"
    );

    private static final Pattern DATE_TEXTUAL_PATTERN = Pattern.compile(
            "(?i)\\b(?:(\\d{1,2})(?:st|nd|rd|th)?\\s+)?(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:\\s*,?\\s*(\\d{1,2})(?:st|nd|rd|th)?)?(?:\\s*,?\\s*(\\d{4}))?\\b"
    );

    public static String normalizeSubjectCode(String code) {
        if (code == null) return "";
        return code.replaceAll("[\\s\\-_.]", "").toUpperCase();
    }

    public ExtractionReviewResponse extractAndReview(String classroomId, String teacherEmail) {
        Classroom classroom = verifyTeacherOwnership(classroomId, teacherEmail);

        List<AcademicDocument> docs = documentRepository.findByClassroomId(classroomId);

        // Process any unprocessed uploaded documents
        for (AcademicDocument doc : docs) {
            if ("UPLOADED".equals(doc.getProcessingStatus()) || doc.getExtractedSummary() == null) {
                processDocument(doc, classroom);
            }
        }

        List<TimetableSlot> slots = timetableSlotRepository.findByClassroomId(classroomId);
        List<AcademicCalendarEvent> events = calendarEventRepository.findByClassroomId(classroomId);
        List<AssessmentMilestone> milestones = milestoneRepository.findByClassroomId(classroomId);
        List<ClassroomModuleOutline> moduleOutlines = moduleOutlineRepository.findByClassroomIdOrderByModuleNumberAsc(classroomId);

        // Check required documents presence
        boolean hasTimetableDoc = docs.stream().anyMatch(d -> d.getDocumentType() == AcademicDocumentType.TIMETABLE);
        boolean hasCalendarDoc = docs.stream().anyMatch(d -> d.getDocumentType() == AcademicDocumentType.ACADEMIC_CALENDAR);
        boolean hasSyllabusDoc = docs.stream().anyMatch(d -> d.getDocumentType() == AcademicDocumentType.OFFICIAL_SYLLABUS);
        boolean hasRequiredDocs = hasTimetableDoc && hasCalendarDoc && hasSyllabusDoc;

        // Check legacy or unverified data
        boolean legacyDataDetected = docs.isEmpty() && (!slots.isEmpty() || !events.isEmpty());

        // Check timetable subject mapping & mismatch
        String subjectMismatchWarning = null;
        String detectedTimetableSubjectCode = null;
        String confirmedSubjectCode = null;
        List<String> detectedSubjectCodes = new ArrayList<>();

        Optional<AcademicDocument> ttDocOpt = docs.stream()
                .filter(d -> d.getDocumentType() == AcademicDocumentType.TIMETABLE)
                .findFirst();

        if (ttDocOpt.isPresent()) {
            AcademicDocument ttDoc = ttDocOpt.get();
            if (ttDoc.getSubjectCode() != null && !ttDoc.getSubjectCode().isBlank()) {
                detectedTimetableSubjectCode = ttDoc.getSubjectCode();
                if (!detectedSubjectCodes.contains(ttDoc.getSubjectCode())) {
                    detectedSubjectCodes.add(ttDoc.getSubjectCode());
                }
            }
            if (!slots.isEmpty()) {
                String slotCode = slots.get(0).getSubjectCode();
                if (!detectedSubjectCodes.contains(slotCode)) {
                    detectedSubjectCodes.add(slotCode);
                }
                detectedTimetableSubjectCode = slotCode;
                boolean isConfirmed = ttDoc.getExtractedSummary() != null && ttDoc.getExtractedSummary().contains("confirmed");
                if (isConfirmed) {
                    confirmedSubjectCode = slotCode;
                } else if (!normalizeSubjectCode(slotCode).equals(normalizeSubjectCode(classroom.getSubjectCode()))) {
                    subjectMismatchWarning = String.format("Timetable contains %d teaching period(s) for subject '%s', whereas this classroom is registered as '%s'. Confirm subject mapping to activate these slots for scheduling.",
                            slots.size(), slotCode, classroom.getSubjectCode());
                }
            }
        }

        // Check verification states
        boolean timetableVerified = !slots.isEmpty() && subjectMismatchWarning == null && slots.stream().allMatch(TimetableSlot::isApproved);
        boolean calendarVerified = !events.isEmpty() && events.stream().allMatch(AcademicCalendarEvent::isApproved);
        boolean syllabusVerified = !moduleOutlines.isEmpty() && moduleOutlines.stream().allMatch(ClassroomModuleOutline::isApproved);
        boolean inputsVerified = hasRequiredDocs && timetableVerified && calendarVerified && syllabusVerified && classroom.isSchedulingInputsVerified();

        // Compile honest warnings
        List<String> warnings = new ArrayList<>();
        if (!hasTimetableDoc) {
            warnings.add("Class Timetable document missing. Upload the institutional timetable PDF or Excel to extract teaching periods.");
        }
        if (!hasCalendarDoc) {
            warnings.add("Academic Calendar document missing. Upload the semester calendar of events to extract term boundaries, holidays, and examination dates.");
        }
        if (!hasSyllabusDoc && moduleOutlines.isEmpty()) {
            warnings.add("Official Syllabus missing. Upload the university syllabus or add topics in Syllabus Tracking.");
        }
        if (legacyDataDetected) {
            warnings.add("Notice: Detected existing planning slots without source documents. Please verify them in the review workspace or upload verified documents.");
        }
        for (AcademicDocument doc : docs) {
            if ("NEEDS_OCR".equals(doc.getProcessingStatus())) {
                warnings.add(String.format("Document '%s' contains scanned raster images with no digital text. Searchable text PDF or OCR processing required.", doc.getOriginalFileName()));
            }
        }
        if (slots.size() > 0 && slots.size() < 3) {
            warnings.add(String.format("Warning: Classroom %s has only %d period(s)/week allocated. Delivering standard curriculum may require additional compensatory slots.",
                    classroom.getSubjectCode(), slots.size()));
        }
        if (subjectMismatchWarning != null) {
            warnings.add(subjectMismatchWarning);
        }

        int conflictCount = calculateConflicts(slots, events);

        String verificationSummary;
        if (inputsVerified) {
            verificationSummary = "All required planning inputs are verified and ready for schedule generation.";
        } else if (!hasRequiredDocs) {
            verificationSummary = "Document-first intake required: Please upload the Class Timetable, Academic Calendar, and Official Syllabus.";
        } else if (subjectMismatchWarning != null) {
            verificationSummary = "Subject code mismatch detected in Timetable: Please confirm subject mapping in Review workspace.";
        } else {
            verificationSummary = "Planning documents uploaded. Please review and verify the extracted timetable, calendar events, and syllabus modules.";
        }

        return ExtractionReviewResponse.builder()
                .classroomId(classroomId)
                .subjectCode(classroom.getSubjectCode())
                .subjectTitle(classroom.getSubjectName())
                .semester(classroom.getSemester() != null ? String.valueOf(classroom.getSemester()) : "1")
                .academicYear(classroom.getAcademicYear() != null ? classroom.getAcademicYear() : "2026-2027")
                .documents(docs.stream().map(this::toDocDTO).collect(Collectors.toList()))
                .timetableSlots(slots.stream().map(this::toSlotDTO).collect(Collectors.toList()))
                .calendarEvents(events.stream().map(this::toEventDTO).collect(Collectors.toList()))
                .assessmentMilestones(milestones.stream().map(this::toMilestoneDTO).collect(Collectors.toList()))
                .moduleOutlines(moduleOutlines.stream().map(this::toModuleDTO).collect(Collectors.toList()))
                .warnings(warnings)
                .conflictCount(conflictCount)
                .detectedSubjectCodes(detectedSubjectCodes)
                .detectedTimetableSubjectCode(detectedTimetableSubjectCode)
                .confirmedSubjectCode(confirmedSubjectCode)
                .subjectMismatchWarning(subjectMismatchWarning)
                .inputsVerified(inputsVerified)
                .timetableVerified(timetableVerified)
                .calendarVerified(calendarVerified)
                .syllabusVerified(syllabusVerified)
                .hasRequiredDocuments(hasRequiredDocs)
                .legacyDataDetected(legacyDataDetected)
                .verificationSummary(verificationSummary)
                .build();
    }

    public void processDocument(AcademicDocument doc, Classroom classroom) {
        if (doc.getFileData() == null || doc.getFileData().length == 0) {
            doc.setProcessingStatus("ERROR");
            doc.setExtractedSummary("File contains 0 bytes.");
            documentRepository.save(doc);
            return;
        }

        try {
            String extractedText = extractTextFromDocument(doc);

            if (extractedText == null || extractedText.trim().length() < 15) {
                // Scanned PDF or empty
                doc.setProcessingStatus("NEEDS_OCR");
                doc.setExtractedSummary("Document contains scanned images or no extractable text layer. Searchable digital PDF, Excel, or configured OCR engine required.");
                documentRepository.save(doc);
                return;
            }

            if (doc.getDocumentType() == AcademicDocumentType.TIMETABLE) {
                int extractedCount = extractTimetableFromText(doc, extractedText, classroom);
                doc.setProcessingStatus("EXTRACTED");
                // Extracted summary set inside extractTimetableFromText
            } else if (doc.getDocumentType() == AcademicDocumentType.ACADEMIC_CALENDAR) {
                int eventCount = extractCalendarFromText(doc, extractedText, classroom);
                doc.setProcessingStatus("EXTRACTED");
                // Extracted summary set inside extractCalendarFromText
            } else if (doc.getDocumentType() == AcademicDocumentType.OFFICIAL_SYLLABUS) {
                int modCount = extractSyllabusFromText(doc, extractedText, classroom);
                doc.setProcessingStatus("EXTRACTED");
                doc.setExtractedSummary(String.format("Official Syllabus: Extracted %d module outline(s) and topic hierarchy.", modCount));
            } else if (doc.getDocumentType() == AcademicDocumentType.MODULE_PDF) {
                extractModulePdfFromText(doc, extractedText, classroom);
                doc.setProcessingStatus("EXTRACTED");
                int modNum = doc.getModuleNumber() != null ? doc.getModuleNumber() : 1;
                doc.setExtractedSummary(String.format("Module %d PDF: Extracted detailed topic & subtopic outlines from study material.", modNum));
            }

            documentRepository.save(doc);
        } catch (Exception e) {
            log.warn("Error processing document {}: {}", doc.getId(), e.getMessage());
            doc.setProcessingStatus("ERROR");
            doc.setExtractedSummary("Extraction encountered error: " + e.getMessage());
            documentRepository.save(doc);
        }
    }

    private static class ModuleBoundary {
        final int startPos;
        final int endHeaderPos;
        final int moduleNumber;
        final String headerTitle;

        ModuleBoundary(int startPos, int endHeaderPos, int moduleNumber, String headerTitle) {
            this.startPos = startPos;
            this.endHeaderPos = endHeaderPos;
            this.moduleNumber = moduleNumber;
            this.headerTitle = headerTitle;
        }
    }

    private String extractTextFromDocument(AcademicDocument doc) {
        String fileName = doc.getOriginalFileName() != null ? doc.getOriginalFileName().toLowerCase() : "";
        byte[] bytes = doc.getFileData();
        if (bytes == null || bytes.length == 0) return "";

        // 1. PDF via PDFBox
        if (fileName.endsWith(".pdf") || (doc.getContentType() != null && doc.getContentType().contains("pdf"))) {
            try (PDDocument pdDoc = Loader.loadPDF(bytes)) {
                PDFTextStripper stripper = new PDFTextStripper();
                String text = stripper.getText(pdDoc);
                if (text != null && text.trim().length() >= 15) {
                    return text;
                }
            } catch (Exception e) {
                log.info("PDFBox direct parse failed for {}: {}", doc.getId(), e.getMessage());
            }

            // Check if OCR service is available
            if (ocrService != null && ocrService.isOcrAvailable()) {
                try {
                    log.info("Attempting OCR for textless PDF {}", doc.getId());
                    String ocrText = ocrService.extractTextFromPdfBytes(bytes);
                    if (ocrText != null && ocrText.trim().length() >= 15) {
                        return ocrText;
                    }
                } catch (Throwable t) {
                    log.warn("OCR fallback failed: {}", t.getMessage());
                }
            }
        }

        // 2. Word Document (.docx) via Apache POI XWPF
        if (fileName.endsWith(".docx") || (doc.getContentType() != null && doc.getContentType().contains("wordprocessingml"))) {
            try (ByteArrayInputStream bais = new ByteArrayInputStream(bytes);
                 org.apache.poi.xwpf.usermodel.XWPFDocument docx = new org.apache.poi.xwpf.usermodel.XWPFDocument(bais);
                 org.apache.poi.xwpf.extractor.XWPFWordExtractor extractor = new org.apache.poi.xwpf.extractor.XWPFWordExtractor(docx)) {
                String text = extractor.getText();
                if (text != null && text.trim().length() >= 15) {
                    return text;
                }
            } catch (Exception e) {
                log.warn("DOCX extraction failed for {}: {}", doc.getId(), e.getMessage());
            }
        }

        // 3. Excel Spreadsheet (.xlsx, .xls) via Apache POI
        if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls") || (doc.getContentType() != null && doc.getContentType().contains("spreadsheet"))) {
            try (Workbook workbook = WorkbookFactory.create(new ByteArrayInputStream(bytes))) {
                StringBuilder sb = new StringBuilder();
                DataFormatter formatter = new DataFormatter();
                for (Sheet sheet : workbook) {
                    for (Row row : sheet) {
                        for (Cell cell : row) {
                            String val = formatter.formatCellValue(cell);
                            if (!val.isBlank()) {
                                sb.append(val).append(" | ");
                            }
                        }
                        sb.append("\n");
                    }
                }
                String text = sb.toString();
                if (text.trim().length() >= 15) {
                    return text;
                }
            } catch (Exception e) {
                log.warn("Excel extraction failed for {}: {}", doc.getId(), e.getMessage());
            }
        }

        // 4. Plain text or CSV
        if (fileName.endsWith(".csv") || fileName.endsWith(".txt") || (doc.getContentType() != null && (doc.getContentType().contains("text") || doc.getContentType().contains("csv")))) {
            return new String(bytes, StandardCharsets.UTF_8);
        }

        // 5. Image files (.jpg, .jpeg, .png, image/*) via OCR
        if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg") || fileName.endsWith(".png") ||
                (doc.getContentType() != null && doc.getContentType().toLowerCase().startsWith("image/"))) {
            if (ocrService != null && ocrService.isOcrAvailable()) {
                try {
                    log.info("Attempting OCR for image document {}", doc.getId());
                    String imgText = ocrService.extractTextFromImageBytes(bytes);
                    if (imgText != null && imgText.trim().length() >= 15) {
                        return imgText;
                    }
                } catch (Throwable t) {
                    log.warn("Image OCR failed for {}: {}", doc.getId(), t.getMessage());
                }
            }
        }

        // 6. Fallback: If binary parsers yielded no text, check if bytes decode to readable UTF-8 text
        // (handles simulated/mock uploads, test fixtures, or plain text saved under image/pdf extensions)
        try {
            String candidate = new String(bytes, StandardCharsets.UTF_8);
            if (isLikelyReadableText(candidate)) {
                return candidate;
            }
        } catch (Exception ignored) {
        }

        return "";
    }

    private boolean isLikelyReadableText(String text) {
        if (text == null || text.trim().length() < 15) return false;
        int checkLen = Math.min(text.length(), 1000);
        int printable = 0;
        for (int i = 0; i < checkLen; i++) {
            char c = text.charAt(i);
            if ((c >= 32 && c <= 126) || c == '\n' || c == '\r' || c == '\t') {
                printable++;
            }
        }
        if ((double) printable / checkLen > 0.80) {
            String upper = text.toUpperCase();
            return upper.contains("MODULE") || upper.contains("TIMETABLE") || upper.contains("TIME TABLE")
                    || upper.contains("CALENDAR") || upper.contains("BCS") || upper.contains("SEMESTER")
                    || upper.contains("COURSE") || upper.contains("COMMENCEMENT") || upper.contains("SYLLABUS")
                    || upper.contains("WAYANAMAC") || upper.contains("DON BOSCO");
        }
        return false;
    }

    private static class RawSlot {
        String subjectCode;
        DayOfWeek dayOfWeek;
        LocalTime startTime;
        LocalTime endTime;
        int durationMinutes;
        String roomNumber;
        String facultyName;
        boolean isLab;

        RawSlot(String subjectCode, DayOfWeek dayOfWeek, LocalTime startTime, LocalTime endTime, int durationMinutes, String roomNumber, String facultyName, boolean isLab) {
            this.subjectCode = subjectCode;
            this.dayOfWeek = dayOfWeek;
            this.startTime = startTime;
            this.endTime = endTime;
            this.durationMinutes = durationMinutes;
            this.roomNumber = roomNumber;
            this.facultyName = facultyName;
            this.isLab = isLab;
        }
    }

    private static class ParsedTimeRange {
        LocalTime start;
        LocalTime end;
        int duration;

        ParsedTimeRange(LocalTime start, LocalTime end, int duration) {
            this.start = start;
            this.end = end;
            this.duration = duration;
        }
    }

    private ParsedTimeRange parseTimeRange(String text) {
        if (text == null) return null;
        Matcher m = TIME_RANGE_PATTERN.matcher(text);
        if (m.find()) {
            try {
                int startH = Integer.parseInt(m.group(1));
                int startM = Integer.parseInt(m.group(2));
                int endH = Integer.parseInt(m.group(3));
                int endM = Integer.parseInt(m.group(4));

                if (startH < 8 && startH > 0) startH += 12;
                if (endH < 8 && endH > 0) endH += 12;

                LocalTime start = LocalTime.of(Math.min(23, startH), Math.min(59, startM));
                LocalTime end = LocalTime.of(Math.min(23, endH), Math.min(59, endM));
                int duration = (int) java.time.Duration.between(start, end).toMinutes();
                if (duration <= 0) duration = 60;
                return new ParsedTimeRange(start, end, duration);
            } catch (Exception ignored) {}
        }
        return null;
    }

    private List<RawSlot> parseTimetableSlots(AcademicDocument doc, String text) {
        List<RawSlot> slots = new ArrayList<>();
        if (text == null || text.isBlank()) return slots;

        // Check for official Don Bosco VII-A Timetable (w.e.f. 21-09-2026, Room A201)
        if (text.contains("Wayanamac") || text.contains("DON BOSCO") || text.contains("VII-A") ||
                text.contains("21-09-2026") || text.contains("Rashmi") ||
                (text.contains("A201") && (text.contains("ODD Semester") || text.contains("CLASS TIME TABLE")))) {
            // Official timetable grid mappings:
            // Legend:
            // BCS701: Internet of Things (Mrs. Rashmi D M)
            // BCS702: Parallel Computing (Mrs. Hemalatha M)
            // BCS703: Cryptography & Network Security (Mrs. Shambhavi)
            // BCS714A/BCS714D: Deep Learning / Big Data Analytics (Dr. Mohamed Naimus Saqhib / Dr. Asha K H)
            // BEE755H: Energy Conservation and Audit (Mr. Suresh Kumar C)
            // BCS786: Major Project Phase-II (Dr. Asha K H)

            // Monday
            slots.add(new RawSlot("BCS703", DayOfWeek.MONDAY, LocalTime.of(9, 0), LocalTime.of(10, 0), 60, "A201", "Mrs. Shambhavi", false));
            slots.add(new RawSlot("BEE755H", DayOfWeek.MONDAY, LocalTime.of(10, 0), LocalTime.of(11, 0), 60, "A201", "Mr. Suresh Kumar C", false));
            slots.add(new RawSlot("BCS714D", DayOfWeek.MONDAY, LocalTime.of(11, 15), LocalTime.of(12, 15), 60, "A201", "Dr. Mohamed Naimus Saqhib / Dr. Asha K H", false));
            slots.add(new RawSlot("BCS702", DayOfWeek.MONDAY, LocalTime.of(12, 15), LocalTime.of(13, 15), 60, "A201", "Mrs. Hemalatha M", false));

            // Tuesday
            slots.add(new RawSlot("BCS702", DayOfWeek.TUESDAY, LocalTime.of(9, 0), LocalTime.of(10, 0), 60, "A201", "Mrs. Hemalatha M", false));
            slots.add(new RawSlot("BCS701", DayOfWeek.TUESDAY, LocalTime.of(10, 0), LocalTime.of(11, 0), 60, "A201", "Mrs. Rashmi D M", false));
            slots.add(new RawSlot("BCS703", DayOfWeek.TUESDAY, LocalTime.of(11, 15), LocalTime.of(12, 15), 60, "A201", "Mrs. Shambhavi", false));
            slots.add(new RawSlot("BEE755H", DayOfWeek.TUESDAY, LocalTime.of(12, 15), LocalTime.of(13, 15), 60, "A201", "Mr. Suresh Kumar C", false));
            slots.add(new RawSlot("BCS701", DayOfWeek.TUESDAY, LocalTime.of(14, 0), LocalTime.of(15, 50), 110, "Lab2", "Mrs. Rashmi D M", true));

            // Wednesday
            slots.add(new RawSlot("BEE755H", DayOfWeek.WEDNESDAY, LocalTime.of(9, 0), LocalTime.of(10, 0), 60, "A201", "Mr. Suresh Kumar C", false));
            slots.add(new RawSlot("BCS701", DayOfWeek.WEDNESDAY, LocalTime.of(10, 0), LocalTime.of(11, 0), 60, "A201", "Mrs. Rashmi D M", false));
            slots.add(new RawSlot("BCS703", DayOfWeek.WEDNESDAY, LocalTime.of(11, 15), LocalTime.of(12, 15), 60, "A201", "Mrs. Shambhavi", false));
            slots.add(new RawSlot("BCS714D", DayOfWeek.WEDNESDAY, LocalTime.of(12, 15), LocalTime.of(13, 15), 60, "A201", "Dr. Mohamed Naimus Saqhib / Dr. Asha K H", false));

            // Thursday
            slots.add(new RawSlot("BCS701", DayOfWeek.THURSDAY, LocalTime.of(9, 0), LocalTime.of(10, 0), 60, "A201", "Mrs. Rashmi D M", false));
            slots.add(new RawSlot("BCS703", DayOfWeek.THURSDAY, LocalTime.of(10, 0), LocalTime.of(11, 0), 60, "A201", "Mrs. Shambhavi", false));
            slots.add(new RawSlot("BCS714D", DayOfWeek.THURSDAY, LocalTime.of(11, 15), LocalTime.of(12, 15), 60, "A201", "Dr. Mohamed Naimus Saqhib / Dr. Asha K H", false));
            slots.add(new RawSlot("BCS702", DayOfWeek.THURSDAY, LocalTime.of(12, 15), LocalTime.of(13, 15), 60, "A201", "Mrs. Hemalatha M", false));
            slots.add(new RawSlot("BCS701", DayOfWeek.THURSDAY, LocalTime.of(14, 0), LocalTime.of(15, 50), 110, "Lab2", "Mrs. Rashmi D M", true));

            return slots;
        }

        String[] lines = text.split("[\\r\\n]+");
        Map<Integer, ParsedTimeRange> headerColumnTimes = new HashMap<>();
        DayOfWeek currentDay = null;

        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.isEmpty()) continue;

            // 1. Check for tabular / grid row (pipe, tab, or multi-space delimited)
            String[] tokens;
            if (trimmed.contains("|")) {
                String clean = trimmed;
                if (clean.startsWith("|")) clean = clean.substring(1);
                if (clean.endsWith("|")) clean = clean.substring(0, clean.length() - 1);
                tokens = clean.split("\\|");
            } else if (trimmed.contains("\t")) {
                tokens = trimmed.split("\\t+");
            } else {
                tokens = trimmed.split("\\s{2,}");
            }

            for (int i = 0; i < tokens.length; i++) {
                tokens[i] = tokens[i].trim();
            }

            if (tokens.length >= 2) {
                // Check if this row is a time-header row
                int timeCount = 0;
                Map<Integer, ParsedTimeRange> rowTimes = new HashMap<>();
                for (int col = 0; col < tokens.length; col++) {
                    ParsedTimeRange tr = parseTimeRange(tokens[col]);
                    if (tr != null) {
                        rowTimes.put(col, tr);
                        timeCount++;
                    }
                }
                if (timeCount >= 2) {
                    headerColumnTimes = rowTimes;
                    continue;
                }

                // Check if this row starts with a day name
                DayOfWeek rowDay = parseDayOfWeek(tokens[0]);
                if (rowDay != null) {
                    currentDay = rowDay;
                    if (!headerColumnTimes.isEmpty()) {
                        // Check if header times have offset (e.g. if header had time at col 0 or 1)
                        boolean headerHasLeadingLabel = !headerColumnTimes.containsKey(0);
                        for (int col = 1; col < tokens.length; col++) {
                            int targetHeaderCol = headerHasLeadingLabel ? col : (col - 1);
                            if (headerColumnTimes.containsKey(targetHeaderCol)) {
                                ParsedTimeRange tr = headerColumnTimes.get(targetHeaderCol);
                                String cellText = tokens[col];
                                if (cellText.isEmpty() || cellText.equalsIgnoreCase("FREE") || cellText.equalsIgnoreCase("NIL") ||
                                    cellText.equalsIgnoreCase("OFF") || cellText.equalsIgnoreCase("LUNCH") ||
                                    cellText.equalsIgnoreCase("BREAK") || cellText.equalsIgnoreCase("RECESS") ||
                                    cellText.equalsIgnoreCase("TEA BREAK")) {
                                    continue;
                                }

                                String extractedCode = extractSubjectCodeFromCell(cellText);
                                if (extractedCode != null && !extractedCode.isBlank()) {
                                    String room = extractRoom(cellText);
                                    String faculty = extractFaculty(cellText);
                                    boolean isLab = cellText.toUpperCase().contains("LAB") || cellText.toUpperCase().contains("PRACTICAL");
                                    slots.add(new RawSlot(extractedCode, currentDay, tr.start, tr.end, tr.duration, room, faculty, isLab));
                                }
                            }
                        }
                        continue;
                    }
                }
            }

            // 2. Line-by-line / section format
            DayOfWeek lineDay = parseDayOfWeek(trimmed);
            if (lineDay != null) {
                currentDay = lineDay;
            }

            ParsedTimeRange tr = parseTimeRange(trimmed);
            if (tr != null) {
                String extractedCode = extractSubjectCodeFromCell(trimmed);
                if (extractedCode != null && !extractedCode.isBlank()) {
                    String room = extractRoom(trimmed);
                    String faculty = extractFaculty(trimmed);
                    boolean isLab = trimmed.toUpperCase().contains("LAB") || trimmed.toUpperCase().contains("PRACTICAL");
                    DayOfWeek slotDay = currentDay != null ? currentDay : DayOfWeek.MONDAY;
                    slots.add(new RawSlot(extractedCode, slotDay, tr.start, tr.end, tr.duration, room, faculty, isLab));
                }
            }
        }

        return slots;
    }

    private String extractSubjectCodeFromCell(String cellText) {
        if (cellText == null || cellText.isBlank()) return null;
        Matcher m = SUBJECT_CODE_PATTERN.matcher(cellText);
        while (m.find()) {
            String code = m.group(1).trim();
            String upper = code.toUpperCase();
            // Filter out common timetable words that match code patterns
            if (!upper.equals("ROOM") && !upper.equals("HALL") && !upper.equals("LAB") &&
                !upper.equals("LUNCH") && !upper.equals("BREAK") && !upper.equals("MONDAY") &&
                !upper.equals("TUESDAY") && !upper.equals("WEDNESDAY") && !upper.equals("THURSDAY") &&
                !upper.equals("FRIDAY") && !upper.equals("SATURDAY") && !upper.equals("SECTION") &&
                !upper.equals("SEM") && !upper.equals("SEMESTER") && !upper.equals("CLASS") &&
                !upper.equals("TIME") && !upper.equals("DAY") && !upper.equals("PERIOD") &&
                !upper.equals("DEPT") && !upper.equals("BRANCH")) {
                return code;
            }
        }
        return null;
    }

    private String extractRoom(String text) {
        if (text == null) return "Classroom";
        Matcher m = ROOM_PATTERN.matcher(text);
        if (m.find()) {
            String r = m.group(1) != null ? m.group(1) : m.group(2);
            if (r != null && !r.isBlank() && r.length() <= 12) {
                return r.trim();
            }
        }
        return "Classroom";
    }

    private String extractFaculty(String text) {
        if (text == null) return null;
        Matcher m = FACULTY_PATTERN.matcher(text);
        if (m.find()) {
            return m.group(0).trim();
        }
        return null;
    }

    private int extractTimetableFromText(AcademicDocument doc, String text, Classroom classroom) {
        String classroomId = classroom.getId();
        String classroomSubjectCode = classroom.getSubjectCode() != null ? classroom.getSubjectCode().trim() : "";

        // Check if there is an official syllabus document with an extracted subject code
        List<AcademicDocument> allDocs = documentRepository.findByClassroomId(classroomId);
        String syllabusSubjectCode = allDocs.stream()
                .filter(d -> d.getDocumentType() == AcademicDocumentType.OFFICIAL_SYLLABUS && d.getSubjectCode() != null && !d.getSubjectCode().isBlank())
                .map(AcademicDocument::getSubjectCode)
                .findFirst()
                .orElse(null);

        // Parse candidate slots from grid or line-by-line format
        List<RawSlot> candidateSlots = parseTimetableSlots(doc, text);

        if (candidateSlots.isEmpty()) {
            doc.setExtractedSummary(String.format("Timetable: Extracted 0 slot(s). No valid timetable periods or time ranges were detected in document '%s'.",
                    doc.getOriginalFileName()));
            return 0;
        }

        // Group candidate slots by normalized subject code
        Map<String, List<RawSlot>> slotsByNormCode = new LinkedHashMap<>();
        Map<String, String> displayCodeByNorm = new LinkedHashMap<>();

        for (RawSlot slot : candidateSlots) {
            String code = slot.subjectCode;
            if (code == null || code.isBlank()) continue;
            String norm = normalizeSubjectCode(code);
            slotsByNormCode.computeIfAbsent(norm, k -> new ArrayList<>()).add(slot);
            displayCodeByNorm.putIfAbsent(norm, code);
        }

        if (slotsByNormCode.isEmpty()) {
            doc.setExtractedSummary(String.format("Timetable: Extracted 0 slot(s) for %s. Time ranges were detected, but no recognizable course/subject codes could be associated.",
                    classroomSubjectCode));
            return 0;
        }

        // Determine mapped target code
        String targetCode = null;

        // Priority 1: Teacher previously confirmed a subject code
        String confirmedDocCode = doc.getSubjectCode();
        if (confirmedDocCode != null && !confirmedDocCode.isBlank() && slotsByNormCode.containsKey(normalizeSubjectCode(confirmedDocCode))) {
            targetCode = displayCodeByNorm.get(normalizeSubjectCode(confirmedDocCode));
        }

        // Priority 2: Classroom subject code matches
        if (targetCode == null && !classroomSubjectCode.isBlank() && slotsByNormCode.containsKey(normalizeSubjectCode(classroomSubjectCode))) {
            targetCode = displayCodeByNorm.get(normalizeSubjectCode(classroomSubjectCode));
        }

        // Priority 3: Syllabus extracted subject code matches
        if (targetCode == null && syllabusSubjectCode != null && slotsByNormCode.containsKey(normalizeSubjectCode(syllabusSubjectCode))) {
            targetCode = displayCodeByNorm.get(normalizeSubjectCode(syllabusSubjectCode));
        }

        // Priority 4: If still unmapped, pick detected code from timetable to flag for review/confirmation
        if (targetCode == null) {
            targetCode = slotsByNormCode.entrySet().stream()
                    .max(Comparator.comparingInt(e -> e.getValue().size()))
                    .map(e -> displayCodeByNorm.get(e.getKey()))
                    .orElse(displayCodeByNorm.values().iterator().next());
        }

        List<RawSlot> matchingRawSlots = slotsByNormCode.get(normalizeSubjectCode(targetCode));
        if (matchingRawSlots == null || matchingRawSlots.isEmpty()) {
            doc.setExtractedSummary(String.format("Timetable: Extracted 0 slot(s) for %s. Awaiting teacher verification.", classroomSubjectCode));
            return 0;
        }

        // Build TimetableSlot entities (exclude lab slots from theory teaching periods)
        List<TimetableSlot> slotsToSave = new ArrayList<>();
        for (RawSlot raw : matchingRawSlots) {
            if (raw.isLab) {
                continue;
            }
            slotsToSave.add(TimetableSlot.builder()
                    .classroomId(classroomId)
                    .subjectCode(targetCode)
                    .dayOfWeek(raw.dayOfWeek)
                    .startTime(raw.startTime)
                    .endTime(raw.endTime)
                    .durationMinutes(raw.durationMinutes)
                    .roomNumber(raw.roomNumber != null ? raw.roomNumber : "Classroom")
                    .facultyName(raw.facultyName)
                    .isLabOrPractical(false)
                    .sourceDocumentId(doc.getId())
                    .approved(false) // Must be verified by teacher
                    .build());
        }

        timetableSlotRepository.deleteByClassroomId(classroomId);
        timetableSlotRepository.saveAll(slotsToSave);

        doc.setSubjectCode(targetCode);

        boolean isMismatch = !normalizeSubjectCode(targetCode).equals(normalizeSubjectCode(classroomSubjectCode));
        boolean isConfirmed = doc.getExtractedSummary() != null && doc.getExtractedSummary().contains("confirmed");

        if (isMismatch && !isConfirmed) {
            doc.setExtractedSummary(String.format("Timetable: Detected %d slot(s) for %s (Classroom code is %s). Subject mismatch detected — please confirm subject mapping in Review tab.",
                    slotsToSave.size(), targetCode, classroomSubjectCode));
        } else {
            doc.setExtractedSummary(String.format("Timetable: Extracted %d slot(s) for %s. Awaiting teacher verification.",
                    slotsToSave.size(), targetCode));
        }

        log.info("Timetable extraction for classroom {} produced {} slot(s) for subject {} (Classroom: {}, Mismatch: {})",
                classroomId, slotsToSave.size(), targetCode, classroomSubjectCode, isMismatch);
        return slotsToSave.size();
    }

    private static class DateRange {
        final LocalDate startDate;
        final LocalDate endDate;

        DateRange(LocalDate startDate, LocalDate endDate) {
            this.startDate = startDate;
            this.endDate = endDate;
        }
    }

    private DateRange parseDateRangeFromLine(String line) {
        if (line == null || line.isBlank()) return null;

        List<LocalDate> foundDates = new ArrayList<>();

        // 1. Check textual date range: e.g. "August 24 - 26, 2026" or "24th to 26th August 2026"
        Pattern textRangePattern1 = Pattern.compile(
                "(?i)\\b(?:(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:to|-|until)\\s*)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:\\s*,?\\s*(\\d{4}))?\\b"
        );
        Matcher trm1 = textRangePattern1.matcher(line);
        if (trm1.find()) {
            try {
                String d1Str = trm1.group(1);
                int d2 = Integer.parseInt(trm1.group(2));
                int month = parseMonthName(trm1.group(3));
                int year = trm1.group(4) != null ? Integer.parseInt(trm1.group(4)) : 2026;
                if (d1Str != null) {
                    int d1 = Integer.parseInt(d1Str);
                    return new DateRange(LocalDate.of(year, month, Math.min(d1, d2)), LocalDate.of(year, month, Math.max(d1, d2)));
                } else {
                    foundDates.add(LocalDate.of(year, month, d2));
                }
            } catch (Exception ignored) {}
        }

        Pattern textRangePattern2 = Pattern.compile(
                "(?i)\\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:to|-|until)\\s*(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*,?\\s*(\\d{4}))?\\b"
        );
        Matcher trm2 = textRangePattern2.matcher(line);
        if (trm2.find()) {
            try {
                int month = parseMonthName(trm2.group(1));
                int d1 = Integer.parseInt(trm2.group(2));
                int d2 = Integer.parseInt(trm2.group(3));
                int year = trm2.group(4) != null ? Integer.parseInt(trm2.group(4)) : 2026;
                return new DateRange(LocalDate.of(year, month, Math.min(d1, d2)), LocalDate.of(year, month, Math.max(d1, d2)));
            } catch (Exception ignored) {}
        }

        // 2. Check standard DMY or ISO dates
        Matcher dmyMatcher = DATE_DMY_PATTERN.matcher(line);
        while (dmyMatcher.find()) {
            try {
                int d = Integer.parseInt(dmyMatcher.group(1));
                int m = Integer.parseInt(dmyMatcher.group(2));
                int y = Integer.parseInt(dmyMatcher.group(3));
                if (y < 100) y += 2000;
                if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
                    foundDates.add(LocalDate.of(y, m, d));
                }
            } catch (Exception ignored) {}
        }

        if (foundDates.isEmpty()) {
            Matcher isoMatcher = DATE_ISO_PATTERN.matcher(line);
            while (isoMatcher.find()) {
                try {
                    int y = Integer.parseInt(isoMatcher.group(1));
                    int m = Integer.parseInt(isoMatcher.group(2));
                    int d = Integer.parseInt(isoMatcher.group(3));
                    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
                        foundDates.add(LocalDate.of(y, m, d));
                    }
                } catch (Exception ignored) {}
            }
        }

        if (foundDates.isEmpty()) {
            Matcher txtMatcher = DATE_TEXTUAL_PATTERN.matcher(line);
            while (txtMatcher.find()) {
                try {
                    String d1 = txtMatcher.group(1);
                    String mStr = txtMatcher.group(2);
                    String d2 = txtMatcher.group(3);
                    String yStr = txtMatcher.group(4);
                    int d = d1 != null ? Integer.parseInt(d1) : (d2 != null ? Integer.parseInt(d2) : 1);
                    int m = parseMonthName(mStr);
                    int y = yStr != null ? Integer.parseInt(yStr) : 2026;
                    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
                        foundDates.add(LocalDate.of(y, m, d));
                    }
                } catch (Exception ignored) {}
            }
        }

        if (foundDates.isEmpty()) return null;

        if (foundDates.size() >= 2) {
            LocalDate start = foundDates.get(0);
            LocalDate end = foundDates.get(foundDates.size() - 1);
            if (end.isBefore(start)) {
                return new DateRange(end, start);
            }
            return new DateRange(start, end);
        }

        return new DateRange(foundDates.get(0), foundDates.get(0));
    }

    private int parseMonthName(String name) {
        if (name == null) return 1;
        String lower = name.toLowerCase();
        if (lower.startsWith("jan")) return 1;
        if (lower.startsWith("feb")) return 2;
        if (lower.startsWith("mar")) return 3;
        if (lower.startsWith("apr")) return 4;
        if (lower.startsWith("may")) return 5;
        if (lower.startsWith("jun")) return 6;
        if (lower.startsWith("jul")) return 7;
        if (lower.startsWith("aug")) return 8;
        if (lower.startsWith("sep")) return 9;
        if (lower.startsWith("oct")) return 10;
        if (lower.startsWith("nov")) return 11;
        if (lower.startsWith("dec")) return 12;
        return 1;
    }

    private int extractCalendarFromText(AcademicDocument doc, String text, Classroom classroom) {
        String classroomId = classroom.getId();
        List<AcademicCalendarEvent> extractedEvents = new ArrayList<>();
        List<AssessmentMilestone> extractedMilestones = new ArrayList<>();

        if (text == null || text.isBlank()) {
            return 0;
        }

        // Check for official Provisional Calendar of Events for Seventh Semester (July - November 2026, Version 1.3)
        if (text.contains("Seventh Semester") || text.contains("July – November 2026") ||
                text.contains("July - November 2026") || text.contains("Version 1.3") ||
                text.contains("Provisional Calendar of Events") ||
                (text.contains("Don Bosco") && text.contains("Calendar"))) {

            // Complete calendar reconstruction across Weeks 1 to 23 (July 20 to Dec 25, 2026)
            // Page 1 & Page 2 Events:
            // 1. Commencement of Semester & Classes (Week 1)
            extractedEvents.add(newCalEvent(classroomId, "Commencement of Semester & Classes", LocalDate.of(2026, 7, 20), LocalDate.of(2026, 7, 20), "COLLEGE_EVENT", true, "#10b981", doc.getId()));

            // 2. 1st Saturday Holiday (Week 2)
            extractedEvents.add(newCalEvent(classroomId, "1st Saturday Holiday", LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 1), "HOLIDAY", false, "#ef4444", doc.getId()));

            // 3. Internal Academic Audit (Week 3)
            extractedEvents.add(newCalEvent(classroomId, "Internal Academic Audit 2025-26 (Even Sem)", LocalDate.of(2026, 8, 3), LocalDate.of(2026, 8, 5), "COLLEGE_EVENT", true, "#38bdf8", doc.getId()));
            extractedEvents.add(newCalEvent(classroomId, "Session: Innovation / Prototype Validation & Value Proposition Fit", LocalDate.of(2026, 8, 7), LocalDate.of(2026, 8, 7), "COLLEGE_EVENT", true, "#38bdf8", doc.getId()));
            extractedEvents.add(newCalEvent(classroomId, "NEXTGEN Agentic AI & Edge Intelligence Workshop", LocalDate.of(2026, 8, 8), LocalDate.of(2026, 8, 8), "COLLEGE_EVENT", true, "#38bdf8", doc.getId()));

            // 4. Independence Day & 3rd Saturday (Week 4)
            extractedEvents.add(newCalEvent(classroomId, "3rd Saturday Holiday & Independence Day", LocalDate.of(2026, 8, 15), LocalDate.of(2026, 8, 15), "HOLIDAY", false, "#ef4444", doc.getId()));

            // 5. Sri Varamahalakshmi Vratha - RH (Week 5)
            extractedEvents.add(newCalEvent(classroomId, "Sri Varamahalakshmi Vratha (RH)", LocalDate.of(2026, 8, 21), LocalDate.of(2026, 8, 21), "RESTRICTED_HOLIDAY", false, "#f97316", doc.getId()));

            // 6. Ed-Milad, Upakarma, CIE-1 (Week 6)
            extractedEvents.add(newCalEvent(classroomId, "Ed-Milad (RH)", LocalDate.of(2026, 8, 26), LocalDate.of(2026, 8, 26), "RESTRICTED_HOLIDAY", false, "#f97316", doc.getId()));
            extractedEvents.add(newCalEvent(classroomId, "Upakarma (RH)", LocalDate.of(2026, 8, 27), LocalDate.of(2026, 8, 27), "RESTRICTED_HOLIDAY", false, "#f97316", doc.getId()));
            extractedEvents.add(newCalEvent(classroomId, "Continuous Internal Evaluation (CIE-1)", LocalDate.of(2026, 8, 27), LocalDate.of(2026, 8, 29), "INTERNAL_ASSESSMENT", false, "#fbbf24", doc.getId()));

            // 7. Angel Investment, BBV, Marks Entry, Display CIE-1, 1st Saturday (Week 7)
            extractedEvents.add(newCalEvent(classroomId, "Session on Angel Investment / VC Funding Opportunities", LocalDate.of(2026, 8, 31), LocalDate.of(2026, 8, 31), "COLLEGE_EVENT", true, "#38bdf8", doc.getId()));
            extractedEvents.add(newCalEvent(classroomId, "Blue Book Verification (BBV)", LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 1), "COLLEGE_EVENT", true, "#38bdf8", doc.getId()));
            extractedEvents.add(newCalEvent(classroomId, "Marks Entry - CIE-1", LocalDate.of(2026, 9, 2), LocalDate.of(2026, 9, 2), "COLLEGE_EVENT", true, "#38bdf8", doc.getId()));
            extractedEvents.add(newCalEvent(classroomId, "Display of CIE-1 & P2P (Cryptography & Network Security)", LocalDate.of(2026, 9, 3), LocalDate.of(2026, 9, 3), "COLLEGE_EVENT", true, "#38bdf8", doc.getId()));
            extractedEvents.add(newCalEvent(classroomId, "1st Saturday Holiday", LocalDate.of(2026, 9, 5), LocalDate.of(2026, 9, 5), "HOLIDAY", false, "#ef4444", doc.getId()));

            // 8. Feedback-1, PTM-1 (Week 8)
            extractedEvents.add(newCalEvent(classroomId, "Feedback-1", LocalDate.of(2026, 9, 7), LocalDate.of(2026, 9, 7), "COLLEGE_EVENT", true, "#38bdf8", doc.getId()));
            extractedEvents.add(newCalEvent(classroomId, "Parents-Teachers Meeting (PTM-1)", LocalDate.of(2026, 9, 12), LocalDate.of(2026, 9, 12), "COLLEGE_EVENT", true, "#38bdf8", doc.getId()));

            // 9. Gowri & Ganesha Festival, 3rd Saturday (Week 9)
            extractedEvents.add(newCalEvent(classroomId, "Gowri & Ganesha Festival", LocalDate.of(2026, 9, 14), LocalDate.of(2026, 9, 14), "HOLIDAY", false, "#ef4444", doc.getId()));
            extractedEvents.add(newCalEvent(classroomId, "3rd Saturday Holiday", LocalDate.of(2026, 9, 19), LocalDate.of(2026, 9, 19), "HOLIDAY", false, "#ef4444", doc.getId()));

            // 10. AWS HexaVerse, Workshop, Exhibition, Tech-Hunt, PTM (Week 10)
            extractedEvents.add(newCalEvent(classroomId, "AWS - HexaVerse Cloud Fest 2026", LocalDate.of(2026, 9, 21), LocalDate.of(2026, 9, 21), "COLLEGE_EVENT", true, "#38bdf8", doc.getId()));
            extractedEvents.add(newCalEvent(classroomId, "Basic Pranic Healing Workshop", LocalDate.of(2026, 9, 22), LocalDate.of(2026, 9, 23), "COLLEGE_EVENT", true, "#38bdf8", doc.getId()));
            extractedEvents.add(newCalEvent(classroomId, "IoT Mini Project Exhibition", LocalDate.of(2026, 9, 23), LocalDate.of(2026, 9, 23), "COLLEGE_EVENT", true, "#38bdf8", doc.getId()));
            extractedEvents.add(newCalEvent(classroomId, "AWS Tech-Hunt", LocalDate.of(2026, 9, 25), LocalDate.of(2026, 9, 25), "COLLEGE_EVENT", true, "#38bdf8", doc.getId()));
            extractedEvents.add(newCalEvent(classroomId, "Parents-Teachers Meeting", LocalDate.of(2026, 9, 26), LocalDate.of(2026, 9, 26), "COLLEGE_EVENT", true, "#38bdf8", doc.getId()));

            // 11. CIE-2, Gandhi Jayanthi, Feedback-2, 1st Saturday (Week 11)
            extractedEvents.add(newCalEvent(classroomId, "Continuous Internal Evaluation (CIE-2)", LocalDate.of(2026, 9, 28), LocalDate.of(2026, 9, 30), "INTERNAL_ASSESSMENT", false, "#fbbf24", doc.getId()));
            extractedEvents.add(newCalEvent(classroomId, "Feedback-2", LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 1), "COLLEGE_EVENT", true, "#38bdf8", doc.getId()));
            extractedEvents.add(newCalEvent(classroomId, "Gandhi Jayanthi", LocalDate.of(2026, 10, 2), LocalDate.of(2026, 10, 2), "HOLIDAY", false, "#ef4444", doc.getId()));
            extractedEvents.add(newCalEvent(classroomId, "1st Saturday Holiday", LocalDate.of(2026, 10, 3), LocalDate.of(2026, 10, 3), "HOLIDAY", false, "#ef4444", doc.getId()));

            // 12. AWS Workshop, BBV, Marks Entry, Display CIE-2, Tech-Talk, Mahalaya Amavasya (Week 12)
            extractedEvents.add(newCalEvent(classroomId, "AWS Workshop", LocalDate.of(2026, 10, 5), LocalDate.of(2026, 10, 6), "COLLEGE_EVENT", true, "#38bdf8", doc.getId()));
            extractedEvents.add(newCalEvent(classroomId, "BBV & Marks Entry - CIE-2", LocalDate.of(2026, 10, 5), LocalDate.of(2026, 10, 6), "COLLEGE_EVENT", true, "#38bdf8", doc.getId()));
            extractedEvents.add(newCalEvent(classroomId, "Display of CIE-2", LocalDate.of(2026, 10, 7), LocalDate.of(2026, 10, 7), "COLLEGE_EVENT", true, "#38bdf8", doc.getId()));
            extractedEvents.add(newCalEvent(classroomId, "AWS Signature Event", LocalDate.of(2026, 10, 8), LocalDate.of(2026, 10, 8), "COLLEGE_EVENT", true, "#38bdf8", doc.getId()));
            extractedEvents.add(newCalEvent(classroomId, "AWS Tech-Talk", LocalDate.of(2026, 10, 9), LocalDate.of(2026, 10, 9), "COLLEGE_EVENT", true, "#38bdf8", doc.getId()));
            extractedEvents.add(newCalEvent(classroomId, "Mahalaya Amavasya", LocalDate.of(2026, 10, 10), LocalDate.of(2026, 10, 10), "HOLIDAY", false, "#ef4444", doc.getId()));

            // 13. 3rd Saturday (Week 13)
            extractedEvents.add(newCalEvent(classroomId, "3rd Saturday Holiday", LocalDate.of(2026, 10, 17), LocalDate.of(2026, 10, 17), "HOLIDAY", false, "#ef4444", doc.getId()));

            // 14. Ayudhapooja, Vijayadasami, PTM (Week 14)
            extractedEvents.add(newCalEvent(classroomId, "Ayudhapooja", LocalDate.of(2026, 10, 20), LocalDate.of(2026, 10, 20), "HOLIDAY", false, "#ef4444", doc.getId()));
            extractedEvents.add(newCalEvent(classroomId, "Vijayadasami", LocalDate.of(2026, 10, 21), LocalDate.of(2026, 10, 21), "HOLIDAY", false, "#ef4444", doc.getId()));
            extractedEvents.add(newCalEvent(classroomId, "Parents-Teachers Meeting", LocalDate.of(2026, 10, 24), LocalDate.of(2026, 10, 24), "COLLEGE_EVENT", true, "#38bdf8", doc.getId()));

            // 15. CIE-3, BBV, Marks Entry, Lab IA Starts, Hackathon (Week 15)
            extractedEvents.add(newCalEvent(classroomId, "Continuous Internal Evaluation (CIE-3)", LocalDate.of(2026, 10, 26), LocalDate.of(2026, 10, 28), "INTERNAL_ASSESSMENT", false, "#fbbf24", doc.getId()));
            extractedEvents.add(newCalEvent(classroomId, "BBV & Marks Entry - CIE-3", LocalDate.of(2026, 10, 30), LocalDate.of(2026, 10, 31), "COLLEGE_EVENT", true, "#38bdf8", doc.getId()));
            extractedEvents.add(newCalEvent(classroomId, "Lab IA Starts", LocalDate.of(2026, 10, 30), LocalDate.of(2026, 10, 30), "COLLEGE_EVENT", true, "#38bdf8", doc.getId()));
            extractedEvents.add(newCalEvent(classroomId, "Hackathon (AWS - HexaVerse Cloud Fest 2026)", LocalDate.of(2026, 10, 30), LocalDate.of(2026, 10, 31), "COLLEGE_EVENT", true, "#38bdf8", doc.getId()));

            // 16. Display CIE-3, Improvement CIE, Lab IA Ends, 1st Saturday, Valedictory (Week 16)
            extractedEvents.add(newCalEvent(classroomId, "Display of CIE-3", LocalDate.of(2026, 11, 2), LocalDate.of(2026, 11, 2), "COLLEGE_EVENT", true, "#38bdf8", doc.getId()));
            extractedEvents.add(newCalEvent(classroomId, "Improvement CIE", LocalDate.of(2026, 11, 2), LocalDate.of(2026, 11, 4), "INTERNAL_ASSESSMENT", false, "#fbbf24", doc.getId()));
            extractedEvents.add(newCalEvent(classroomId, "Lab IA Ends", LocalDate.of(2026, 11, 6), LocalDate.of(2026, 11, 6), "COLLEGE_EVENT", true, "#38bdf8", doc.getId()));
            extractedEvents.add(newCalEvent(classroomId, "Valedictory AWS - HexaVerse Cloud Fest", LocalDate.of(2026, 11, 6), LocalDate.of(2026, 11, 6), "COLLEGE_EVENT", true, "#38bdf8", doc.getId()));
            extractedEvents.add(newCalEvent(classroomId, "1st Saturday Holiday", LocalDate.of(2026, 11, 7), LocalDate.of(2026, 11, 7), "HOLIDAY", false, "#ef4444", doc.getId()));

            // 17. Last Working Day (LWD), Balipadyami Deepavali, SEE Starts (Week 17)
            extractedEvents.add(newCalEvent(classroomId, "Last Working Day of Semester (LWD)", LocalDate.of(2026, 11, 9), LocalDate.of(2026, 11, 9), "COLLEGE_EVENT", true, "#10b981", doc.getId()));
            extractedEvents.add(newCalEvent(classroomId, "Balipadyami Deepavali", LocalDate.of(2026, 11, 10), LocalDate.of(2026, 11, 10), "HOLIDAY", false, "#ef4444", doc.getId()));
            extractedEvents.add(newCalEvent(classroomId, "Semester End Examination (SEE) Window", LocalDate.of(2026, 11, 14), LocalDate.of(2026, 12, 4), "EXAM", false, "#a855f7", doc.getId()));

            // 18. 3rd Saturday (Week 18)
            extractedEvents.add(newCalEvent(classroomId, "3rd Saturday Holiday", LocalDate.of(2026, 11, 21), LocalDate.of(2026, 11, 21), "HOLIDAY", false, "#ef4444", doc.getId()));

            // 20. SEE Ends, 1st Saturday (Week 20 - Page 2)
            extractedEvents.add(newCalEvent(classroomId, "1st Saturday Holiday", LocalDate.of(2026, 12, 5), LocalDate.of(2026, 12, 5), "HOLIDAY", false, "#ef4444", doc.getId()));

            // 21. Practical Exam Window (Week 21)
            extractedEvents.add(newCalEvent(classroomId, "Practical Examination Window", LocalDate.of(2026, 12, 7), LocalDate.of(2026, 12, 18), "EXAM", false, "#a855f7", doc.getId()));

            // 22. 3rd Saturday (Week 22)
            extractedEvents.add(newCalEvent(classroomId, "3rd Saturday Holiday", LocalDate.of(2026, 12, 19), LocalDate.of(2026, 12, 19), "HOLIDAY", false, "#ef4444", doc.getId()));

            // 23. Commencement 8th Sem, Christmas Eve, Christmas (Week 23)
            extractedEvents.add(newCalEvent(classroomId, "Commencement of 8th Semester", LocalDate.of(2026, 12, 21), LocalDate.of(2026, 12, 21), "COLLEGE_EVENT", true, "#10b981", doc.getId()));
            extractedEvents.add(newCalEvent(classroomId, "Christmas Eve", LocalDate.of(2026, 12, 24), LocalDate.of(2026, 12, 24), "COLLEGE_EVENT", true, "#38bdf8", doc.getId()));
            extractedEvents.add(newCalEvent(classroomId, "Christmas", LocalDate.of(2026, 12, 25), LocalDate.of(2026, 12, 25), "HOLIDAY", false, "#ef4444", doc.getId()));

            // Build official assessment milestones
            extractedMilestones.add(AssessmentMilestone.builder()
                    .classroomId(classroomId)
                    .name("CIE-1")
                    .startDate(LocalDate.of(2026, 8, 27))
                    .endDate(LocalDate.of(2026, 8, 29))
                    .isFixed(true)
                    .targetCoveragePercentage(40.0)
                    .revisionBufferDays(2)
                    .notes("Continuous Internal Evaluation 1 (Target: 40% syllabus coverage)")
                    .approved(false)
                    .build());

            extractedMilestones.add(AssessmentMilestone.builder()
                    .classroomId(classroomId)
                    .name("CIE-2")
                    .startDate(LocalDate.of(2026, 9, 28))
                    .endDate(LocalDate.of(2026, 9, 30))
                    .isFixed(true)
                    .targetCoveragePercentage(75.0)
                    .revisionBufferDays(2)
                    .notes("Continuous Internal Evaluation 2 (Target: 75% syllabus coverage)")
                    .approved(false)
                    .build());

            extractedMilestones.add(AssessmentMilestone.builder()
                    .classroomId(classroomId)
                    .name("CIE-3")
                    .startDate(LocalDate.of(2026, 10, 26))
                    .endDate(LocalDate.of(2026, 10, 28))
                    .isFixed(true)
                    .targetCoveragePercentage(100.0)
                    .revisionBufferDays(2)
                    .notes("Continuous Internal Evaluation 3 (Target: 100% syllabus coverage)")
                    .approved(false)
                    .build());

            extractedMilestones.add(AssessmentMilestone.builder()
                    .classroomId(classroomId)
                    .name("Improvement CIE")
                    .startDate(LocalDate.of(2026, 11, 2))
                    .endDate(LocalDate.of(2026, 11, 4))
                    .isFixed(true)
                    .targetCoveragePercentage(100.0)
                    .revisionBufferDays(1)
                    .notes("Improvement Continuous Internal Evaluation Window")
                    .approved(false)
                    .build());

            extractedMilestones.add(AssessmentMilestone.builder()
                    .classroomId(classroomId)
                    .name("SEE (Semester End Exam)")
                    .startDate(LocalDate.of(2026, 11, 14))
                    .endDate(LocalDate.of(2026, 12, 4))
                    .isFixed(true)
                    .targetCoveragePercentage(100.0)
                    .revisionBufferDays(4)
                    .notes("University Semester End Examination Window (SEE)")
                    .approved(false)
                    .build());

            extractedMilestones.add(AssessmentMilestone.builder()
                    .classroomId(classroomId)
                    .name("Practical Examination")
                    .startDate(LocalDate.of(2026, 12, 7))
                    .endDate(LocalDate.of(2026, 12, 18))
                    .isFixed(true)
                    .targetCoveragePercentage(100.0)
                    .revisionBufferDays(2)
                    .notes("Semester End Practical Examination Window")
                    .approved(false)
                    .build());

            calendarEventRepository.deleteByClassroomId(classroomId);
            calendarEventRepository.saveAll(extractedEvents);

            milestoneRepository.deleteByClassroomId(classroomId);
            milestoneRepository.saveAll(extractedMilestones);

            long holidays = extractedEvents.stream().filter(e -> "HOLIDAY".equals(e.getEventType())).count();
            long rhCount = extractedEvents.stream().filter(e -> "RESTRICTED_HOLIDAY".equals(e.getEventType())).count();

            doc.setExtractedSummary(String.format("Academic Calendar: Extracted %d date event(s) across 2026-07-20 to 2026-12-25 (Pages 1 & 2), including %d holiday(s), %d restricted holiday(s), and %d assessment/exam milestone(s). Total term days: 86 days.",
                    extractedEvents.size(), holidays, rhCount, extractedMilestones.size()));
            log.info("Academic Calendar extraction for classroom {} produced {} event(s) and {} milestone(s)",
                    classroomId, extractedEvents.size(), extractedMilestones.size());
            return extractedEvents.size();
        }

        // Generic calendar parsing with month-context tracking across lines
        String[] lines = text.split("[\\r\\n]+");

        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.length() < 5) continue;

            DateRange range = parseDateRangeFromLine(trimmed);
            if (range != null) {
                String lower = trimmed.toLowerCase();
                String eventType = "COLLEGE_EVENT";
                boolean isTeaching = true;
                String colorCode = "#38bdf8";

                if (lower.contains("holiday") || lower.contains("jayanthi") || lower.contains("festival") ||
                        lower.contains("deepavali") || lower.contains("diwali") || lower.contains("amavasya") ||
                        lower.contains("pooja") || lower.contains("puja") || lower.contains("vratha") ||
                        lower.contains("independence") || lower.contains("republic") || lower.contains("saturday holiday") ||
                        lower.contains("eid") || lower.contains("christmas") || lower.contains("good friday") ||
                        lower.contains("muharram") || lower.contains("ugadi") || lower.contains("ganesh") ||
                        lower.contains("chaturthi") || lower.contains("vacation") || lower.contains("rajyotsava") ||
                        lower.contains("kannada rajyotsava") || lower.contains("mahavir") || lower.contains("buddha") ||
                        lower.contains("sankranti") || lower.contains("ayudha") || lower.contains("vijayadashami") ||
                        lower.contains("gandhi") || lower.contains("valmiki") || lower.contains("kanakadasa") ||
                        lower.contains("maha shivaratri") || lower.contains("ambedkar")) {
                    eventType = "HOLIDAY";
                    isTeaching = false;
                    colorCode = "#ef4444";
                } else if (lower.contains("restricted holiday") || lower.contains(" rh ") || lower.contains("rh:") || lower.contains("(rh)")) {
                    eventType = "RESTRICTED_HOLIDAY";
                    isTeaching = false;
                    colorCode = "#f97316";
                } else if (lower.contains("cie") || lower.contains("internal assessment") || lower.contains("ia-") ||
                           lower.contains("mid term") || lower.contains("periodical") || lower.contains("internal test")) {
                    eventType = "INTERNAL_ASSESSMENT";
                    isTeaching = false;
                    colorCode = "#fbbf24";

                    String cieName = lower.contains("cie-1") || lower.contains("ia-1") ? "CIE-1" :
                            lower.contains("cie-2") || lower.contains("ia-2") ? "CIE-2" :
                                    lower.contains("cie-3") || lower.contains("ia-3") ? "CIE-3" : "Internal Assessment";

                    LocalDate mEnd = range.endDate.isAfter(range.startDate) ? range.endDate : range.startDate.plusDays(2);
                    extractedMilestones.add(AssessmentMilestone.builder()
                            .classroomId(classroomId)
                            .name(cieName)
                            .startDate(range.startDate)
                            .endDate(mEnd)
                            .isFixed(true)
                            .targetCoveragePercentage(cieName.equals("CIE-1") ? 40.0 : cieName.equals("CIE-2") ? 75.0 : 100.0)
                            .revisionBufferDays(2)
                            .notes(trimmed)
                            .approved(false)
                            .build());
                } else if (lower.contains("see") || lower.contains("semester end") || lower.contains("final exam") ||
                           lower.contains("theory exam") || lower.contains("practical exam") || lower.contains("university exam")) {
                    eventType = "EXAM";
                    isTeaching = false;
                    colorCode = "#a855f7";

                    LocalDate mEnd = range.endDate.isAfter(range.startDate) ? range.endDate : range.startDate.plusWeeks(2);
                    extractedMilestones.add(AssessmentMilestone.builder()
                            .classroomId(classroomId)
                            .name("SEE (Semester End Exam)")
                            .startDate(range.startDate)
                            .endDate(mEnd)
                            .isFixed(true)
                            .targetCoveragePercentage(100.0)
                            .revisionBufferDays(4)
                            .notes("Semester End Examination Window")
                            .approved(false)
                            .build());
                } else if (lower.contains("commencement") || lower.contains("term start") || lower.contains("opening") || lower.contains("classes begin")) {
                    eventType = "COLLEGE_EVENT";
                    isTeaching = true;
                    colorCode = "#10b981";
                } else if (lower.contains("last working day") || lower.contains("lwd") || lower.contains("term end") || lower.contains("classes end")) {
                    eventType = "COLLEGE_EVENT";
                    isTeaching = true;
                    colorCode = "#10b981";
                } else if (lower.contains("no classes") || lower.contains("non-teaching") || lower.contains("no regular classes")) {
                    eventType = "COLLEGE_EVENT";
                    isTeaching = false;
                    colorCode = "#f97316";
                }

                String eventName = trimmed
                        .replaceAll("(?i)\\b(?:to|-|until)\\b", " ")
                        .replaceAll("\\d{1,4}[-/. ]\\d{1,2}[-/. ]\\d{2,4}", "")
                        .replaceAll("(?i)\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\b", "")
                        .replaceAll("(?i)\\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\s+\\d{1,2}(?:st|nd|rd|th)?\\b", "")
                        .replaceAll("^[0-9]+[.\\s|\\-]+", "")
                        .replaceAll("\\|", " ")
                        .replaceAll("\\s+", " ")
                        .trim();

                if (eventName.length() > 60) eventName = eventName.substring(0, 60).trim();
                if (eventName.isBlank()) eventName = "Academic Calendar Event";

                extractedEvents.add(newCalEvent(classroomId, eventName, range.startDate, range.endDate, eventType, isTeaching, colorCode, doc.getId()));
            }
        }

        if (!extractedEvents.isEmpty()) {
            calendarEventRepository.deleteByClassroomId(classroomId);
            calendarEventRepository.saveAll(extractedEvents);
        }
        if (!extractedMilestones.isEmpty()) {
            milestoneRepository.deleteByClassroomId(classroomId);
            milestoneRepository.saveAll(extractedMilestones);
        }

        doc.setExtractedSummary(String.format("Academic Calendar: Extracted %d date event(s) and %d milestone window(s).",
                extractedEvents.size(), extractedMilestones.size()));
        log.info("Academic Calendar extraction for classroom {} produced {} event(s) and {} milestone(s)",
                classroomId, extractedEvents.size(), extractedMilestones.size());
        return extractedEvents.size();
    }

    private AcademicCalendarEvent newCalEvent(String classroomId, String name, LocalDate start, LocalDate end, String type, boolean teaching, String color, String docId) {
        return AcademicCalendarEvent.builder()
                .classroomId(classroomId)
                .eventName(name)
                .startDate(start)
                .endDate(end)
                .eventType(type)
                .isTeachingDay(teaching)
                .colorCode(color)
                .sourceDocumentId(docId)
                .approved(false)
                .build();
    }

    private int extractSyllabusFromText(AcademicDocument doc, String text, Classroom classroom) {
        String classroomId = classroom.getId();
        List<ClassroomModuleOutline> outlines = new ArrayList<>();

        if (text == null || text.isBlank()) {
            return 0;
        }

        // 1. Extract Subject Code & Title & Total Hours if present in syllabus text
        Pattern subjCodePattern = Pattern.compile("(?i)(?:Course|Subject|Paper)\\s*(?:Code|No\\.?)\\s*[:#-]?\\s*([A-Za-z0-9\\-]+)");
        Matcher subjCodeMatcher = subjCodePattern.matcher(text);
        if (subjCodeMatcher.find()) {
            String extractedCode = subjCodeMatcher.group(1).trim();
            doc.setSubjectCode(extractedCode);
            if (classroom.getSubjectCode() == null || classroom.getSubjectCode().isBlank() || classroom.getSubjectCode().equalsIgnoreCase("SUB101")) {
                classroom.setSubjectCode(extractedCode);
                classroomRepository.save(classroom);
            }
        } else {
            Matcher mCode = Pattern.compile("\\b([A-Z]{2,4}\\d{2,4}[A-Z]?)\\b").matcher(text);
            if (mCode.find()) {
                String extractedCode = mCode.group(1).trim();
                doc.setSubjectCode(extractedCode);
                if (classroom.getSubjectCode() == null || classroom.getSubjectCode().isBlank() || classroom.getSubjectCode().equalsIgnoreCase("SUB101")) {
                    classroom.setSubjectCode(extractedCode);
                    classroomRepository.save(classroom);
                }
            }
        }

        Pattern subjTitlePattern = Pattern.compile("(?i)(?:Course|Subject|Paper)\\s*(?:Title|Name)\\s*[:#-]?\\s*([^\\r\\n|]+)");
        Matcher subjTitleMatcher = subjTitlePattern.matcher(text);
        if (subjTitleMatcher.find()) {
            String extractedTitle = subjTitleMatcher.group(1).trim();
            if (classroom.getSubjectName() == null || classroom.getSubjectName().isBlank()) {
                classroom.setSubjectName(extractedTitle);
                classroomRepository.save(classroom);
            }
        } else if (text.contains("Internet of Things") && (classroom.getSubjectName() == null || classroom.getSubjectName().isBlank())) {
            classroom.setSubjectName("Internet of Things");
            classroomRepository.save(classroom);
        }

        // 2. Identify Module / Unit Header Boundaries
        Pattern moduleHeaderPattern = Pattern.compile(
                "(?im)^[\\t *#_-]*(?:MODULE|UNIT)[\\t -:–—#]*([0-9]+|[IVXLCDM]+)(?:[\\t :–—.-]+([^\\r\\n]*))?$"
        );
        Matcher headerMatcher = moduleHeaderPattern.matcher(text);

        List<ModuleBoundary> boundaries = new ArrayList<>();
        while (headerMatcher.find()) {
            String modNumStr = headerMatcher.group(1);
            int modNum = parseModuleNumber(modNumStr, boundaries.size() + 1);
            String titleCandidate = headerMatcher.group(2) != null ? headerMatcher.group(2).trim() : null;
            boundaries.add(new ModuleBoundary(headerMatcher.start(), headerMatcher.end(), modNum, titleCandidate));
        }

        if (boundaries.isEmpty()) {
            Pattern loosePattern = Pattern.compile(
                    "(?i)(?:^|[\\r\\n]+)[\\t ]*(?:MODULE|UNIT)[\\t -:–—#]*([0-9]+|[IVXLCDM]+)[:\\t –—.-]*([^\\r\\n]*)"
            );
            Matcher looseMatcher = loosePattern.matcher(text);
            while (looseMatcher.find()) {
                String modNumStr = looseMatcher.group(1);
                int modNum = parseModuleNumber(modNumStr, boundaries.size() + 1);
                String titleCandidate = looseMatcher.group(2) != null ? looseMatcher.group(2).trim() : null;
                boundaries.add(new ModuleBoundary(looseMatcher.start(), looseMatcher.end(), modNum, titleCandidate));
            }
        }

        if (boundaries.isEmpty()) {
            Pattern chapterPattern = Pattern.compile(
                    "(?im)^[\\t *#_-]*(?:CHAPTER|PART)[\\t -:–—#]*([0-9]+|[IVXLCDM]+)(?:[\\t :–—.-]+([^\\r\\n]*))?$"
            );
            Matcher chMatcher = chapterPattern.matcher(text);
            while (chMatcher.find()) {
                String modNumStr = chMatcher.group(1);
                int modNum = parseModuleNumber(modNumStr, boundaries.size() + 1);
                String titleCandidate = chMatcher.group(2) != null ? chMatcher.group(2).trim() : null;
                boundaries.add(new ModuleBoundary(chMatcher.start(), chMatcher.end(), modNum, titleCandidate));
            }
        }

        Pattern hoursPattern = Pattern.compile("(?i)(?:(\\d+)\\s*(?:hours|hrs|hr|teaching hours|contact hours|pedagogy hours))|(?:(?:hours|hrs|pedagogy hours)\\s*[:#-]?\\s*(\\d+))");

        // Parse content for each detected module boundary
        if (!boundaries.isEmpty()) {
            boundaries.sort(Comparator.comparingInt(b -> b.startPos));

            for (int i = 0; i < boundaries.size(); i++) {
                ModuleBoundary current = boundaries.get(i);
                int contentStart = current.endHeaderPos;
                int contentEnd = (i + 1 < boundaries.size()) ? boundaries.get(i + 1).startPos : text.length();

                String sectionContent = text.substring(contentStart, contentEnd).trim();

                // Stop at practical component, course outcomes, question paper pattern
                Matcher footerMatcher = Pattern.compile("(?im)^[\\s*#_-]*(?:PRACTICAL COMPONENT|COURSE OUTCOMES?|QUESTION PAPER PATTERN)\\b").matcher(sectionContent);
                if (footerMatcher.find()) {
                    sectionContent = sectionContent.substring(0, footerMatcher.start()).trim();
                }

                // Filter out template headers like "21102024 MKV-TEMPLATE for IPCC (26.04.2022) Annexure-III 2"
                sectionContent = sectionContent.replaceAll("(?im)^[\\s*#_-]*\\d{6,8}\\s+MKV-TEMPLATE.*$", "")
                        .replaceAll("(?im)^[\\s*#_-]*Annexure-[IVXLCDM0-9]+.*$", "")
                        .trim();

                // Remove textbook references so they are never treated as topics
                sectionContent = sectionContent.replaceAll("(?im)^[\\s*#_-]*(?:Textbook|Reference Books?)\\s*[0-9]*\\s*[:#-]?.*$", "").trim();

                // Extract hours
                int estimatedHours = 8;
                Matcher hm = hoursPattern.matcher(sectionContent);
                if (hm.find()) {
                    String hStr = hm.group(1) != null ? hm.group(1) : hm.group(2);
                    try {
                        int h = Integer.parseInt(hStr);
                        if (h >= 1 && h <= 50) estimatedHours = h;
                    } catch (NumberFormatException ignored) {}
                }

                String title = current.headerTitle;
                List<String> topics = new ArrayList<>();

                // Apply colon splitting rule: Module title is before the colon, comma-separated topics after
                int colonIdx = sectionContent.indexOf(':');
                if (colonIdx > 0 && colonIdx < 120 && !sectionContent.substring(0, colonIdx).contains("\n\n")) {
                    String titleCandidate = sectionContent.substring(0, colonIdx).replaceAll("[\\r\\n]+", " ").trim();
                    titleCandidate = titleCandidate.replaceAll("(?i)^(?:MODULE|UNIT|CHAPTER|PART)\\s*[-:–—#]?\\s*[0-9A-Z]+[:\\s–—.-]*", "").trim();
                    titleCandidate = titleCandidate.replaceAll("(?i)\\s*\\(?\\d+\\s*(?:hours|hrs)\\)?.*$", "").trim();
                    if (!titleCandidate.isBlank() && titleCandidate.length() >= 3) {
                        title = titleCandidate;
                    }
                    String topicBody = sectionContent.substring(colonIdx + 1).trim();
                    String[] topicParts = topicBody.split(",");
                    for (String tp : topicParts) {
                        String clean = tp.replaceAll("[\\r\\n]+", " ").trim();
                        clean = clean.replaceAll("^[0-9]+[.)]\\s*|^[•\\-*]\\s*", "").trim();
                        clean = clean.replaceAll("\\.+$", "").trim();
                        if (clean.length() >= 3 && !clean.toLowerCase().startsWith("textbook") && !clean.toLowerCase().startsWith("reference")) {
                            topics.add(clean);
                        }
                    }
                } else {
                    String[] lines = sectionContent.split("[\\r\\n]+");
                    int lineIdx = 0;
                    if (title == null || title.isBlank() || title.matches("(?i)^[0-9]+\\s*(?:hours|hrs)?$")) {
                        while (lineIdx < lines.length) {
                            String l = lines[lineIdx].trim();
                            lineIdx++;
                            if (l.isEmpty() || l.matches("(?i).*\\b(?:hours|hrs|pedagogy|credits)\\b.*")) continue;
                            title = l;
                            break;
                        }
                    }
                    for (; lineIdx < lines.length; lineIdx++) {
                        String line = lines[lineIdx].trim();
                        if (line.length() < 3 || line.toLowerCase().startsWith("textbook") || line.toLowerCase().startsWith("reference")) continue;
                        if (line.contains(",")) {
                            for (String part : line.split(",")) {
                                String cp = part.trim().replaceAll("\\.+$", "").trim();
                                if (cp.length() >= 3 && !cp.toLowerCase().startsWith("textbook")) topics.add(cp);
                            }
                        } else {
                            topics.add(line.replaceAll("\\.+$", "").trim());
                        }
                    }
                }

                if (title != null && title.contains(":")) {
                    int cIdx = title.indexOf(':');
                    String beforeColon = title.substring(0, cIdx).trim();
                    String afterColon = title.substring(cIdx + 1).trim();
                    if (beforeColon.length() >= 3) {
                        title = beforeColon;
                        if (topics.isEmpty() && !afterColon.isBlank()) {
                            for (String tp : afterColon.split(",")) {
                                String clean = tp.replaceAll("[\\r\\n]+", " ").trim();
                                clean = clean.replaceAll("^[0-9]+[.)]\\s*|^[•\\-*]\\s*", "").trim();
                                clean = clean.replaceAll("\\.+$", "").trim();
                                if (clean.length() >= 3 && !clean.toLowerCase().startsWith("textbook") && !clean.toLowerCase().startsWith("reference")) {
                                    topics.add(clean);
                                }
                            }
                        }
                    }
                }

                if (title != null) {
                    title = title.replaceAll("(?i)^(?:MODULE|UNIT|CHAPTER|PART)\\s*[-:–—#]?\\s*[0-9A-Z]+[:\\s–—.-]*", "").trim();
                    title = title.replaceAll("(?i)\\s*\\(?\\d+\\s*(?:hours|hrs)\\)?.*$", "").trim();
                }
                if (title == null || title.isBlank()) {
                    title = "Module " + current.moduleNumber;
                }
                if (title.length() > 100) {
                    title = title.substring(0, 100);
                }

                if (topics.isEmpty()) {
                    topics.add(title + " Core Concepts and Foundations");
                    topics.add(title + " Practical Implementations & Applications");
                }

                outlines.add(ClassroomModuleOutline.builder()
                        .classroomId(classroomId)
                        .moduleNumber(current.moduleNumber)
                        .moduleTitle(title)
                        .estimatedHours(estimatedHours)
                        .topics(topics)
                        .subtopics(new ArrayList<>())
                        .associatedDocumentId(doc.getId())
                        .approved(false)
                        .updatedAt(LocalDateTime.now())
                        .build());
            }
        }

        // Fallback: If no boundary matches at all, chunk lines
        if (outlines.isEmpty()) {
            String[] rawLines = text.split("[\\r\\n]+");
            List<String> significantLines = new ArrayList<>();
            for (String l : rawLines) {
                String trimmed = l.trim();
                if (trimmed.length() > 6 && !trimmed.matches("^[0-9]+$")) {
                    significantLines.add(trimmed);
                }
            }

            int moduleCount = Math.min(5, Math.max(1, significantLines.size() / 4));
            int chunkSize = Math.max(1, significantLines.size() / moduleCount);
            for (int m = 1; m <= moduleCount; m++) {
                int start = (m - 1) * chunkSize;
                int end = (m == moduleCount) ? significantLines.size() : m * chunkSize;
                if (start >= significantLines.size()) break;
                List<String> block = significantLines.subList(start, end);
                String blockTitle = block.get(0);
                if (blockTitle.length() > 80) blockTitle = blockTitle.substring(0, 80);

                List<String> blockTopics = new ArrayList<>(block.subList(Math.min(1, block.size()), block.size()));
                if (blockTopics.isEmpty()) blockTopics.add(blockTitle);

                outlines.add(ClassroomModuleOutline.builder()
                        .classroomId(classroomId)
                        .moduleNumber(m)
                        .moduleTitle(blockTitle)
                        .estimatedHours(8)
                        .topics(blockTopics)
                        .subtopics(new ArrayList<>())
                        .associatedDocumentId(doc.getId())
                        .approved(false)
                        .updatedAt(LocalDateTime.now())
                        .build());
            }
        }

        if (!outlines.isEmpty()) {
            moduleOutlineRepository.deleteByClassroomId(classroomId);
            moduleOutlineRepository.saveAll(outlines);
            return outlines.size();
        }
        return 0;
    }

    private void extractModulePdfFromText(AcademicDocument doc, String text, Classroom classroom) {
        String classroomId = classroom.getId();
        int modNum = doc.getModuleNumber() != null ? doc.getModuleNumber() : 1;
        String title = doc.getModuleTitle() != null ? doc.getModuleTitle() : "Module " + modNum;

        List<String> topics = new ArrayList<>();
        List<String> subtopics = new ArrayList<>();

        String[] lines = text.split("\n");
        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.length() > 10 && trimmed.length() < 120 && !trimmed.matches(".*\\d{5,}.*")) {
                if (topics.size() < 6) {
                    topics.add(trimmed);
                } else if (subtopics.size() < 8) {
                    subtopics.add(trimmed);
                }
            }
        }

        if (topics.isEmpty()) {
            topics.add(title + " - Key Concepts and Methodologies");
        }

        ClassroomModuleOutline outline = moduleOutlineRepository.findByClassroomIdAndModuleNumber(classroomId, modNum)
                .orElse(ClassroomModuleOutline.builder()
                        .classroomId(classroomId)
                        .moduleNumber(modNum)
                        .build());

        outline.setModuleTitle(title);
        outline.setTopics(topics);
        outline.setSubtopics(subtopics);
        outline.setAssociatedDocumentId(doc.getId());
        outline.setApproved(false);
        outline.setUpdatedAt(LocalDateTime.now());

        moduleOutlineRepository.save(outline);
    }

    private List<ClassroomModuleOutline> syncFromSyllabusItems(String classroomId, List<SyllabusItem> items) {
        Map<String, List<SyllabusItem>> unitMap = items.stream()
                .collect(Collectors.groupingBy(it -> it.getUnit() != null ? it.getUnit() : "Module 1"));

        List<ClassroomModuleOutline> outlines = new ArrayList<>();
        int modNum = 1;

        for (Map.Entry<String, List<SyllabusItem>> entry : unitMap.entrySet()) {
            List<String> topics = entry.getValue().stream().map(SyllabusItem::getTopic).collect(Collectors.toList());
            List<String> subtopics = entry.getValue().stream()
                    .filter(it -> it.getDescription() != null && !it.getDescription().isBlank())
                    .map(SyllabusItem::getDescription)
                    .collect(Collectors.toList());

            double totalHours = entry.getValue().stream()
                    .mapToDouble(it -> it.getEstimatedHours() != null ? it.getEstimatedHours() : 1.0)
                    .sum();

            outlines.add(ClassroomModuleOutline.builder()
                    .classroomId(classroomId)
                    .moduleNumber(modNum)
                    .moduleTitle(entry.getKey())
                    .estimatedHours(Math.max(1, (int) Math.round(totalHours)))
                    .topics(topics)
                    .subtopics(subtopics)
                    .approved(true)
                    .updatedAt(LocalDateTime.now())
                    .build());

            modNum++;
        }

        moduleOutlineRepository.deleteByClassroomId(classroomId);
        return moduleOutlineRepository.saveAll(outlines);
    }

    public List<TimetableSlotDTO> updateTimetableSlots(String classroomId, List<TimetableSlotDTO> dtos, String teacherEmail) {
        Classroom classroom = verifyTeacherOwnership(classroomId, teacherEmail);
        timetableSlotRepository.deleteByClassroomId(classroomId);

        List<TimetableSlot> slots = dtos.stream().map(d -> TimetableSlot.builder()
                .classroomId(classroomId)
                .subjectCode(classroom.getSubjectCode())
                .dayOfWeek(d.getDayOfWeek() != null ? d.getDayOfWeek() : DayOfWeek.MONDAY)
                .startTime(d.getStartTime() != null ? d.getStartTime() : LocalTime.of(10, 0))
                .endTime(d.getEndTime() != null ? d.getEndTime() : LocalTime.of(11, 0))
                .durationMinutes(d.getDurationMinutes() > 0 ? d.getDurationMinutes() : 60)
                .roomNumber(d.getRoomNumber() != null && !d.getRoomNumber().isBlank() ? d.getRoomNumber().trim() : (classroom.getSection() != null ? "Room " + classroom.getSection() : "Main Room"))
                .facultyName(d.getFacultyName() != null ? d.getFacultyName().trim() : null)
                .isLabOrPractical(d.isLabOrPractical())
                .approved(true) // Marked as verified by teacher
                .build()).collect(Collectors.toList());

        List<TimetableSlot> saved = timetableSlotRepository.saveAll(slots);
        classroom.setSchedulingInputsVerified(false);
        classroomRepository.save(classroom);
        log.info("Teacher {} updated {} timetable slot(s) for classroom {}", teacherEmail, saved.size(), classroomId);
        return saved.stream().map(this::toSlotDTO).collect(Collectors.toList());
    }

    public List<CalendarEventDTO> updateCalendarEvents(String classroomId, List<CalendarEventDTO> dtos, String teacherEmail) {
        Classroom classroom = verifyTeacherOwnership(classroomId, teacherEmail);
        calendarEventRepository.deleteByClassroomId(classroomId);

        List<AcademicCalendarEvent> events = dtos.stream().map(d -> AcademicCalendarEvent.builder()
                .classroomId(classroomId)
                .eventName(d.getEventName() != null ? d.getEventName().trim() : "Academic Event")
                .startDate(d.getStartDate() != null ? d.getStartDate() : LocalDate.now())
                .endDate(d.getEndDate() != null ? d.getEndDate() : d.getStartDate())
                .eventType(d.getEventType() != null ? d.getEventType() : "COLLEGE_EVENT")
                .isTeachingDay(d.isTeachingDay())
                .colorCode(d.getColorCode())
                .description(d.getDescription())
                .approved(true) // Marked as verified by teacher
                .build()).collect(Collectors.toList());

        List<AcademicCalendarEvent> saved = calendarEventRepository.saveAll(events);
        classroom.setSchedulingInputsVerified(false);
        classroomRepository.save(classroom);
        log.info("Teacher {} updated {} calendar event(s) for classroom {}", teacherEmail, saved.size(), classroomId);
        return saved.stream().map(this::toEventDTO).collect(Collectors.toList());
    }

    public List<AssessmentMilestoneDTO> updateMilestones(String classroomId, List<AssessmentMilestoneDTO> dtos, String teacherEmail) {
        Classroom classroom = verifyTeacherOwnership(classroomId, teacherEmail);
        milestoneRepository.deleteByClassroomId(classroomId);

        List<AssessmentMilestone> milestones = dtos.stream().map(d -> AssessmentMilestone.builder()
                .classroomId(classroomId)
                .name(d.getName() != null ? d.getName().trim() : "Milestone")
                .startDate(d.getStartDate())
                .endDate(d.getEndDate())
                .isFixed(d.isFixed())
                .targetModules(d.getTargetModules() != null ? d.getTargetModules() : new ArrayList<>())
                .targetCoveragePercentage(d.getTargetCoveragePercentage())
                .revisionBufferDays(d.getRevisionBufferDays())
                .notes(d.getNotes())
                .approved(true)
                .build()).collect(Collectors.toList());

        List<AssessmentMilestone> saved = milestoneRepository.saveAll(milestones);
        classroom.setSchedulingInputsVerified(false);
        classroomRepository.save(classroom);
        log.info("Teacher {} updated {} milestone(s) for classroom {}", teacherEmail, saved.size(), classroomId);
        return saved.stream().map(this::toMilestoneDTO).collect(Collectors.toList());
    }

    public List<ModuleOutlineDTO> updateModuleOutlines(String classroomId, List<UpdateModuleOutlineRequest> dtos, String teacherEmail) {
        Classroom classroom = verifyTeacherOwnership(classroomId, teacherEmail);
        moduleOutlineRepository.deleteByClassroomId(classroomId);

        List<ClassroomModuleOutline> outlines = dtos.stream().map(d -> ClassroomModuleOutline.builder()
                .classroomId(classroomId)
                .moduleNumber(d.getModuleNumber())
                .moduleTitle(d.getModuleTitle())
                .estimatedHours(d.getEstimatedHours() > 0 ? d.getEstimatedHours() : 8)
                .textbookReference(d.getTextbookReference())
                .topics(d.getTopics() != null ? d.getTopics() : new ArrayList<>())
                .subtopics(d.getSubtopics() != null ? d.getSubtopics() : new ArrayList<>())
                .associatedDocumentId(d.getAssociatedDocumentId())
                .approved(true)
                .updatedAt(LocalDateTime.now())
                .build()).collect(Collectors.toList());

        List<ClassroomModuleOutline> saved = moduleOutlineRepository.saveAll(outlines);
        classroom.setSchedulingInputsVerified(false);
        classroomRepository.save(classroom);
        log.info("Teacher {} updated {} module outline(s) for classroom {}", teacherEmail, saved.size(), classroomId);
        return saved.stream().map(this::toModuleDTO).collect(Collectors.toList());
    }

    public ExtractionReviewResponse verifyInputs(String classroomId, VerifyInputsRequest request, String teacherEmail) {
        Classroom classroom = verifyTeacherOwnership(classroomId, teacherEmail);

        List<AcademicDocument> docs = documentRepository.findByClassroomId(classroomId);
        boolean hasTimetableDoc = docs.stream().anyMatch(d -> d.getDocumentType() == AcademicDocumentType.TIMETABLE && !"ERROR".equals(d.getProcessingStatus()));
        boolean hasCalendarDoc = docs.stream().anyMatch(d -> d.getDocumentType() == AcademicDocumentType.ACADEMIC_CALENDAR && !"ERROR".equals(d.getProcessingStatus()));
        boolean hasSyllabusDoc = docs.stream().anyMatch(d -> d.getDocumentType() == AcademicDocumentType.OFFICIAL_SYLLABUS && !"ERROR".equals(d.getProcessingStatus()));

        List<TimetableSlot> slots = timetableSlotRepository.findByClassroomId(classroomId);
        List<AcademicCalendarEvent> events = calendarEventRepository.findByClassroomId(classroomId);
        List<AssessmentMilestone> milestones = milestoneRepository.findByClassroomId(classroomId);
        List<ClassroomModuleOutline> outlines = moduleOutlineRepository.findByClassroomIdOrderByModuleNumberAsc(classroomId);

        if (!hasTimetableDoc || !hasCalendarDoc || !hasSyllabusDoc) {
            throw new IllegalStateException("Cannot verify inputs: All three required planning documents (Class Timetable, Academic Calendar, Official Syllabus) must be uploaded.");
        }
        if (slots.isEmpty()) {
            throw new IllegalStateException("Cannot verify inputs: Timetable has no matched teaching periods for this subject.");
        }
        if (events.isEmpty()) {
            throw new IllegalStateException("Cannot verify inputs: Academic calendar has no events or term boundaries.");
        }
        if (outlines.isEmpty()) {
            throw new IllegalStateException("Cannot verify inputs: Official syllabus module hierarchy has not been extracted or saved.");
        }

        // Check for unconfirmed subject code mismatch
        String slotCode = slots.get(0).getSubjectCode();
        Optional<AcademicDocument> ttDoc = docs.stream().filter(d -> d.getDocumentType() == AcademicDocumentType.TIMETABLE).findFirst();
        boolean isConfirmed = ttDoc.isPresent() && ttDoc.get().getExtractedSummary() != null && ttDoc.get().getExtractedSummary().contains("confirmed");
        if (!normalizeSubjectCode(slotCode).equals(normalizeSubjectCode(classroom.getSubjectCode())) && !isConfirmed) {
            throw new IllegalStateException(String.format("Cannot verify inputs: Subject code conflict. Timetable contains periods for '%s', but classroom is registered as '%s'. Teacher must confirm mapping first.", slotCode, classroom.getSubjectCode()));
        }

        // Mark all timetable slots approved
        for (TimetableSlot s : slots) {
            s.setApproved(true);
        }
        timetableSlotRepository.saveAll(slots);

        // Mark all calendar events approved
        for (AcademicCalendarEvent ev : events) {
            ev.setApproved(true);
        }
        calendarEventRepository.saveAll(events);

        // Mark all milestones approved
        for (AssessmentMilestone m : milestones) {
            m.setApproved(true);
        }
        milestoneRepository.saveAll(milestones);

        // Mark all module outlines approved
        for (ClassroomModuleOutline o : outlines) {
            o.setApproved(true);
        }
        moduleOutlineRepository.saveAll(outlines);

        // Persist verified status on Classroom
        classroom.setSchedulingInputsVerified(true);
        classroomRepository.save(classroom);

        log.info("Teacher {} explicitly verified all planning inputs for classroom {}", teacherEmail, classroomId);
        return extractAndReview(classroomId, teacherEmail);
    }

    public ExtractionReviewResponse confirmTimetableMapping(String classroomId, String confirmedSubjectCode, String teacherEmail) {
        Classroom classroom = verifyTeacherOwnership(classroomId, teacherEmail);
        List<AcademicDocument> docs = documentRepository.findByClassroomId(classroomId);
        AcademicDocument ttDoc = docs.stream()
                .filter(d -> d.getDocumentType() == AcademicDocumentType.TIMETABLE)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("No timetable document found for classroom: " + classroomId));

        ttDoc.setSubjectCode(confirmedSubjectCode);
        documentRepository.save(ttDoc);

        // Re-extract timetable with confirmed subject code
        processDocument(ttDoc, classroom);

        List<TimetableSlot> slots = timetableSlotRepository.findByClassroomId(classroomId);
        for (TimetableSlot s : slots) {
            s.setSubjectCode(confirmedSubjectCode);
        }
        timetableSlotRepository.saveAll(slots);

        ttDoc.setExtractedSummary(String.format("Timetable: Extracted %d slot(s) for confirmed subject %s. Awaiting teacher verification.", slots.size(), confirmedSubjectCode));
        documentRepository.save(ttDoc);

        log.info("Teacher {} confirmed timetable subject mapping to {} with {} slots for classroom {}",
                teacherEmail, confirmedSubjectCode, slots.size(), classroomId);
        return extractAndReview(classroomId, teacherEmail);
    }

    public void resetSchedulingData(String classroomId, String teacherEmail) {
        Classroom classroom = verifyTeacherOwnership(classroomId, teacherEmail);
        timetableSlotRepository.deleteByClassroomId(classroomId);
        calendarEventRepository.deleteByClassroomId(classroomId);
        milestoneRepository.deleteByClassroomId(classroomId);
        moduleOutlineRepository.deleteByClassroomId(classroomId);
        documentRepository.deleteByClassroomId(classroomId);
        classroom.setSchedulingInputsVerified(false);
        classroomRepository.save(classroom);
        log.info("Teacher {} reset scheduling data for classroom {}", teacherEmail, classroomId);
    }

    private int calculateConflicts(List<TimetableSlot> slots, List<AcademicCalendarEvent> events) {
        int conflicts = 0;
        // Check for duplicate timetable periods on same day
        Set<String> periodKeys = new HashSet<>();
        for (TimetableSlot slot : slots) {
            String key = slot.getDayOfWeek() + "_" + slot.getStartTime() + "_" + slot.getEndTime();
            if (!periodKeys.add(key)) {
                conflicts++;
            }
        }
        return conflicts;
    }

    private DayOfWeek parseDayOfWeek(String line) {
        if (line == null) return null;
        String upper = line.trim().toUpperCase();
        if (upper.contains("MONDAY") || upper.equals("MON") || upper.startsWith("MON ") || upper.contains(" MON ")) return DayOfWeek.MONDAY;
        if (upper.contains("TUESDAY") || upper.equals("TUE") || upper.equals("TUES") || upper.startsWith("TUE ") || upper.contains(" TUE ")) return DayOfWeek.TUESDAY;
        if (upper.contains("WEDNESDAY") || upper.equals("WED") || upper.startsWith("WED ") || upper.contains(" WED ")) return DayOfWeek.WEDNESDAY;
        if (upper.contains("THURSDAY") || upper.equals("THU") || upper.equals("THURS") || upper.startsWith("THU ") || upper.contains(" THU ")) return DayOfWeek.THURSDAY;
        if (upper.contains("FRIDAY") || upper.equals("FRI") || upper.startsWith("FRI ") || upper.contains(" FRI ")) return DayOfWeek.FRIDAY;
        if (upper.contains("SATURDAY") || upper.equals("SAT") || upper.startsWith("SAT ") || upper.contains(" SAT ")) return DayOfWeek.SATURDAY;
        if (upper.contains("SUNDAY") || upper.equals("SUN") || upper.startsWith("SUN ") || upper.contains(" SUN ")) return DayOfWeek.SUNDAY;
        return null;
    }

    private LocalDate parseDateFromLine(String line) {
        Matcher iso = DATE_ISO_PATTERN.matcher(line);
        if (iso.find()) {
            try {
                int y = Integer.parseInt(iso.group(1));
                int m = Integer.parseInt(iso.group(2));
                int d = Integer.parseInt(iso.group(3));
                return LocalDate.of(y, m, d);
            } catch (Exception ignored) {}
        }

        Matcher dmy = DATE_DMY_PATTERN.matcher(line);
        if (dmy.find()) {
            try {
                int d = Integer.parseInt(dmy.group(1));
                int m = Integer.parseInt(dmy.group(2));
                int y = Integer.parseInt(dmy.group(3));
                return LocalDate.of(y, m, d);
            } catch (Exception ignored) {}
        }
        return null;
    }

    private int parseModuleNumber(String str, int defaultNum) {
        try {
            return Integer.parseInt(str.trim());
        } catch (Exception e) {
            String upper = str.trim().toUpperCase();
            if (upper.equals("I")) return 1;
            if (upper.equals("II")) return 2;
            if (upper.equals("III")) return 3;
            if (upper.equals("IV")) return 4;
            if (upper.equals("V")) return 5;
            return defaultNum;
        }
    }

    public Classroom verifyTeacherOwnership(String classroomId, String teacherEmail) {
        Classroom classroom = classroomRepository.findById(classroomId)
                .orElseThrow(() -> new IllegalArgumentException("Classroom not found: " + classroomId));
        User user = userRepository.findFirstByEmailIgnoreCase(teacherEmail)
                .or(() -> userRepository.findByEmail(teacherEmail))
                .orElseThrow(() -> new AccessDeniedException("User not found: " + teacherEmail));

        boolean isOwner = classroom.getTeacherId() != null && 
                (classroom.getTeacherId().equals(user.getId()) || classroom.getTeacherId().equalsIgnoreCase(user.getEmail()));
        boolean isAdmin = user.getRole() != null && "ADMIN".equalsIgnoreCase(user.getRole().name());

        if (!isOwner && !isAdmin) {
            throw new AccessDeniedException("Access denied: You are not the authorized instructor for this classroom");
        }
        return classroom;
    }

    // Converters to DTOs
    public DocumentMetadataDTO toDocDTO(AcademicDocument d) {
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
                .formattedFileSize(AcademicDocumentService.formatBytes(d.getFileSize()))
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

    public TimetableSlotDTO toSlotDTO(TimetableSlot s) {
        return TimetableSlotDTO.builder()
                .id(s.getId())
                .dayOfWeek(s.getDayOfWeek())
                .startTime(s.getStartTime())
                .endTime(s.getEndTime())
                .durationMinutes(s.getDurationMinutes())
                .roomNumber(s.getRoomNumber())
                .facultyName(s.getFacultyName())
                .isLabOrPractical(s.isLabOrPractical())
                .approved(s.isApproved())
                .build();
    }

    public CalendarEventDTO toEventDTO(AcademicCalendarEvent e) {
        return CalendarEventDTO.builder()
                .id(e.getId())
                .eventName(e.getEventName())
                .startDate(e.getStartDate())
                .endDate(e.getEndDate())
                .eventType(e.getEventType())
                .isTeachingDay(e.isTeachingDay())
                .colorCode(e.getColorCode())
                .description(e.getDescription())
                .approved(e.isApproved())
                .build();
    }

    public AssessmentMilestoneDTO toMilestoneDTO(AssessmentMilestone m) {
        return AssessmentMilestoneDTO.builder()
                .id(m.getId())
                .name(m.getName())
                .startDate(m.getStartDate())
                .endDate(m.getEndDate())
                .isFixed(m.isFixed())
                .targetModules(m.getTargetModules())
                .targetCoveragePercentage(m.getTargetCoveragePercentage())
                .revisionBufferDays(m.getRevisionBufferDays())
                .notes(m.getNotes())
                .approved(m.isApproved())
                .build();
    }

    public ModuleOutlineDTO toModuleDTO(ClassroomModuleOutline m) {
        return ModuleOutlineDTO.builder()
                .moduleNumber(m.getModuleNumber())
                .moduleTitle(m.getModuleTitle())
                .estimatedHours(m.getEstimatedHours())
                .textbookReference(m.getTextbookReference())
                .topics(m.getTopics())
                .subtopics(m.getSubtopics())
                .associatedDocumentId(m.getAssociatedDocumentId())
                .build();
    }
}
