package com.acadion.backend.service.parser;

import com.acadion.backend.entity.QuestionPaper;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Multi-pass document-understanding parser for academic question papers.
 *
 * Pipeline:
 *   1. Normalize and split text into lines
 *   2. Classify each line (METADATA, INSTRUCTION, SECTION, QUESTION, etc.)
 *   3. Extract metadata fields
 *   4. Detect sections
 *   5. Detect questions with hierarchy (parent/sub)
 *   6. Detect multiline continuations
 *   7. Detect OR / optional relationships
 *   8. Extract marks per question
 *   9. Classify question types
 *  10. Validate output
 */
@Service
public class AiQuestionParserService {

    // =====================================================
    // LINE CLASSIFICATION ENUMS
    // =====================================================

    private enum LineType {
        COLLEGE_NAME, UNIVERSITY_NAME, DEPARTMENT,
        EXAM_NAME, SUBJECT_LINE, SUBJECT_CODE,
        DATE_LINE, TIME_LINE, DURATION_LINE,
        MAX_MARKS_LINE, SEMESTER_LINE, INTERNAL_LINE,
        ACADEMIC_YEAR_LINE,
        INSTRUCTION, SECTION_HEADING,
        QUESTION, SUBQUESTION, OR_MARKER,
        MCQ_OPTION, ATTEMPT_RULE,
        PAGE_NUMBER, HEADER_FOOTER, NOISE,
        CONTINUATION, BLANK
    }

    // =====================================================
    // PATTERNS
    // =====================================================

    // Question patterns — ordered from most specific to least
    private static final Pattern QUESTION_PATTERN = Pattern.compile(
            "^(?:Q\\.?\\s*)?(?:(?:Q|q)\\s*\\.?\\s*)?(\\d{1,3})\\s*[.):] ?\\s*(.*)",
            Pattern.CASE_INSENSITIVE
    );

    // Subquestion patterns: 1(a), Q1(a), (a), (i), a), a.
    private static final Pattern SUBQUESTION_PATTERN = Pattern.compile(
            "^(?:(?:Q?\\s*\\d+)?\\s*[.(]\\s*([a-z]|[ivxlc]+)\\s*[.):]\\s*(.*))|" +
                    "^\\(\\s*([a-z]|[ivxlc]+)\\s*\\)\\s*(.*)|" +
                    "^([a-z])\\s*[.):]\\s*(.*)"
    );

    // Marks patterns
    private static final Pattern MARKS_INLINE = Pattern.compile(
            "(?:\\[\\s*(\\d+)\\s*]|\\(\\s*(\\d+)\\s*\\)|" +
                    "(\\d+)\\s*[Mm]arks?|(\\d+)\\s*[Mm]\\b|[Mm]arks?\\s*:?\\s*(\\d+))",
            Pattern.CASE_INSENSITIVE
    );

    // Section headings
    private static final Pattern SECTION_PATTERN = Pattern.compile(
            "^(?:PART|SECTION|MODULE|UNIT)\\s*[-–:]?\\s*([A-Z0-9]+)(?:\\s*[-–:].*)?$|" +
                    "^(?:SHORT\\s+ANSWER|LONG\\s+ANSWER|ESSAY|OBJECTIVE)\\s+QUESTIONS?.*$",
            Pattern.CASE_INSENSITIVE
    );

    // OR marker
    private static final Pattern OR_PATTERN = Pattern.compile(
            "^\\s*(?:OR|(?:Either\\s*/\\s*Or))\\s*$",
            Pattern.CASE_INSENSITIVE
    );

    // Attempt rules: "Answer any 3", "Attempt any five"
    private static final Pattern ATTEMPT_RULE_PATTERN = Pattern.compile(
            "(?:answer|attempt|solve|choose)\\s+(?:any|only)\\s+(\\d+|one|two|three|four|five|six|seven|eight|nine|ten)" +
                    "(?:\\s+(?:of\\s+the\\s+following|questions?))?",
            Pattern.CASE_INSENSITIVE
    );

    // Metadata patterns
    private static final Pattern MAX_MARKS_PATTERN = Pattern.compile(
            "(?:max(?:imum)?\\s*\\.?\\s*marks?|total\\s+marks?)\\s*:?\\s*(\\d+)",
            Pattern.CASE_INSENSITIVE
    );

    private static final Pattern DURATION_PATTERN = Pattern.compile(
            "(?:duration|time\\s*allowed?)\\s*:?\\s*(.+?)$",
            Pattern.CASE_INSENSITIVE
    );

    private static final Pattern TIME_PATTERN = Pattern.compile(
            "^(?:time)\\s*:?\\s*(.+?)$",
            Pattern.CASE_INSENSITIVE
    );

    private static final Pattern DATE_PATTERN = Pattern.compile(
            "(?:date)\\s*:?\\s*(\\d{1,2}[/\\-.]\\d{1,2}[/\\-.]\\d{2,4})",
            Pattern.CASE_INSENSITIVE
    );

    private static final Pattern SEMESTER_PATTERN = Pattern.compile(
            "(?:sem(?:ester)?)\\.?\\s*:?\\s*(\\d+|[IVX]+|first|second|third|fourth|fifth|sixth|seventh|eighth)",
            Pattern.CASE_INSENSITIVE
    );

    private static final Pattern SUBJECT_CODE_PATTERN = Pattern.compile(
            "(?:sub(?:ject)?\\s*code|course\\s*code)\\s*:?\\s*([A-Z0-9]+[A-Z0-9\\-]*)",
            Pattern.CASE_INSENSITIVE
    );

    private static final Pattern SUBJECT_NAME_PATTERN = Pattern.compile(
            "(?:sub(?:ject)?\\s*(?:name)?)\\s*:?\\s*(.+?)$",
            Pattern.CASE_INSENSITIVE
    );

    private static final Pattern INTERNAL_PATTERN = Pattern.compile(
            "(?:internal\\s*(?:assessment)?\\s*(?:test|exam)?|IA\\s*(?:test)?|CIE|INT)\\s*[-–:]?\\s*(\\d+)?",
            Pattern.CASE_INSENSITIVE
    );

    private static final Pattern PAGE_NUMBER_PATTERN = Pattern.compile(
            "^\\s*(?:page\\s*\\d+\\s*(?:of\\s*\\d+)?|\\d+\\s*/\\s*\\d+|[-–]\\s*\\d+\\s*[-–])\\s*$",
            Pattern.CASE_INSENSITIVE
    );

    // MCQ options
    private static final Pattern MCQ_OPTION_PATTERN = Pattern.compile(
            "^\\s*(?:[A-D]\\s*[.):]|\\([a-d]\\))\\s*(.*)",
            Pattern.CASE_INSENSITIVE
    );

    // College/university names
    private static final Pattern COLLEGE_PATTERN = Pattern.compile(
            "(?:institute|college|university|school|academy|polytechnic)\\s+(?:of|for)",
            Pattern.CASE_INSENSITIVE
    );

    private static final Pattern DEPT_PATTERN = Pattern.compile(
            "(?:department|dept\\.?)\\s+(?:of)\\s+(.+)",
            Pattern.CASE_INSENSITIVE
    );

    private static final Pattern EXAM_NAME_PATTERN = Pattern.compile(
            "(?:internal\\s*(?:assessment)?|mid[\\s-]*(?:term|semester)|end[\\s-]*(?:term|semester)|" +
                    "final\\s*exam|sessional|test|examination|CIE|SEE)",
            Pattern.CASE_INSENSITIVE
    );

    private static final Pattern INSTRUCTION_PATTERN = Pattern.compile(
            "^\\s*(?:instructions?|note|notes|important|read\\s+carefully)\\s*:?",
            Pattern.CASE_INSENSITIVE
    );

    // =====================================================
    // MAIN PARSE METHOD
    // =====================================================

    public ParsedPaperResult parseDocument(String text) {

        ParsedPaperResult result = new ParsedPaperResult();

        if (text == null || text.isBlank()) {
            result.getWarnings().add("Empty text received");
            return result;
        }

        // Normalize
        String normalized = normalizeText(text);
        List<String> lines = splitLines(normalized);

        // Pass 1: Classify lines
        List<ClassifiedLine> classified = classifyLines(lines);

        // Pass 2: Extract metadata
        ParsedMetadata metadata = extractMetadata(classified);
        result.setMetadata(metadata);

        // Pass 3-7: Extract questions
        List<QuestionPaper.Question> questions = extractQuestions(classified, metadata);
        result.setQuestions(questions);

        // Pass 8: Validate
        validate(result);

        return result;
    }

    /**
     * Legacy method maintained for backward compatibility.
     */
    public List<QuestionPaper.Question> parseQuestions(String text) {
        ParsedPaperResult result = parseDocument(text);
        return result.getQuestions();
    }

    // =====================================================
    // TEXT NORMALIZATION
    // =====================================================

    private String normalizeText(String text) {
        if (text == null) return "";
        // Normalize line endings
        text = text.replaceAll("\\r\\n", "\n").replaceAll("\\r", "\n");
        // Normalize multiple spaces (but keep newlines)
        text = text.replaceAll("[ \\t]+", " ");

        StringBuilder sb = new StringBuilder();
        for (String raw : text.split("\n")) {
            String cleaned = cleanOcrLine(raw);
            if (!cleaned.isBlank()) {
                sb.append(cleaned).append("\n");
            }
        }
        return sb.toString();
    }

    private String cleanOcrLine(String raw) {
        if (raw == null) return "";
        String s = raw.trim();
        // Remove non-printable characters
        s = s.replaceAll("[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F]", "");

        // Detect table marks at line end: "| 8 | 2 | 4 |" or "| 10 | L2 | CO1 |" -> extract marks "[8]"
        Matcher tm = Pattern.compile("[|]\\s*(\\d{1,2})\\s*[|\\s].*$", Pattern.CASE_INSENSITIVE).matcher(s);
        String extractedMarks = "";
        if (tm.find() && tm.group(1) != null) {
            extractedMarks = " [" + tm.group(1) + "]";
            s = s.substring(0, tm.start()).trim();
        }

        // Remove table delimiters & leading OCR symbols
        s = s.replaceAll("^[|:;'_~`\\\\\\s\\[\\]\\{\\}\\(\\)\\-+=]+", "");
        s = s.replaceAll("[|]", " ");

        // Normalize OCR question numbering prefixes:
        s = s.replaceAll("^(?:Qi|Q1|Q\\.1)\\s*\\)?\\s*([a-d])\\s*[:.)]\\s*", "Q1($1) ");
        s = s.replaceAll("^(?:Q2|Q\\.2)\\s+([a-d])\\s*[:.)]\\s*", "Q2($1) ");
        s = s.replaceAll("^(?:Q3|Q\\.3)\\s*([a-d])\\s*[:.)]\\s*", "Q3($1) ");
        s = s.replaceAll("^(?:Q4|Q\\.4)\\s*([a-d])\\s*[:.)]\\s*", "Q4($1) ");

        // Fix common OCR dropped leading letters in standard academic verbs
        s = s.replaceAll("\\b:?xplain\\b", "Explain");
        s = s.replaceAll("\\b[a-z]{1,2}\\s+escribe\\b", "Describe");
        s = s.replaceAll("\\bescribe\\b", "Describe");
        s = s.replaceAll("\\b[a-z]{1,2}\\s+iscuss\\b", "Discuss");
        s = s.replaceAll("\\biscuss\\b", "Discuss");
        s = s.replaceAll("\\b[a-z]{1,2}\\s+alyze\\b", "Analyze");
        s = s.replaceAll("\\balyze\\b", "Analyze");
        s = s.replaceAll("\\bhat\\s+are\\b", "What are");

        if (!extractedMarks.isEmpty()) {
            s = s + extractedMarks;
        }

        return s.trim();
    }

    private List<String> splitLines(String text) {
        return Arrays.stream(text.split("\n"))
                .map(String::trim)
                .collect(Collectors.toList());
    }

    // =====================================================
    // LINE CLASSIFICATION
    // =====================================================

    private static class ClassifiedLine {
        String text;
        LineType type;
        int lineNumber;

        ClassifiedLine(String text, LineType type, int lineNumber) {
            this.text = text;
            this.type = type;
            this.lineNumber = lineNumber;
        }
    }

    private List<ClassifiedLine> classifyLines(List<String> lines) {

        List<ClassifiedLine> result = new ArrayList<>();

        // First pass: detect repeated headers
        Map<String, Integer> lineFrequency = new HashMap<>();
        for (String line : lines) {
            if (!line.isBlank()) {
                String key = line.toLowerCase().trim();
                lineFrequency.merge(key, 1, Integer::sum);
            }
        }

        for (int i = 0; i < lines.size(); i++) {

            String line = lines.get(i);

            if (line.isBlank()) {
                result.add(new ClassifiedLine(line, LineType.BLANK, i));
                continue;
            }

            // Repeated headers (appear 3+ times) → HEADER_FOOTER
            String lowerLine = line.toLowerCase().trim();
            if (lineFrequency.getOrDefault(lowerLine, 0) >= 3 &&
                    line.length() < 80) {
                result.add(new ClassifiedLine(line, LineType.HEADER_FOOTER, i));
                continue;
            }

            LineType type = classifySingleLine(line, i, lines.size());
            result.add(new ClassifiedLine(line, type, i));
        }

        return result;
    }

    private LineType classifySingleLine(String line, int lineIndex, int totalLines) {

        String trimmed = line.trim();
        String lower = trimmed.toLowerCase();

        // OR marker (check before noise check since "OR" has length 2)
        if (OR_PATTERN.matcher(trimmed).matches()) {
            return LineType.OR_MARKER;
        }

        // Page numbers
        if (PAGE_NUMBER_PATTERN.matcher(trimmed).matches()) {
            return LineType.PAGE_NUMBER;
        }

        // Very short noise
        if (trimmed.length() <= 2 && !trimmed.matches("\\d+")) {
            return LineType.NOISE;
        }

        // Section headings
        if (SECTION_PATTERN.matcher(trimmed).matches()) {
            return LineType.SECTION_HEADING;
        }

        // Max marks line
        if (MAX_MARKS_PATTERN.matcher(trimmed).find()) {
            return LineType.MAX_MARKS_LINE;
        }

        // Duration/Time
        if (DURATION_PATTERN.matcher(trimmed).find()) {
            return LineType.DURATION_LINE;
        }
        if (TIME_PATTERN.matcher(trimmed).find() &&
                !lower.contains("time complexity")) {
            return LineType.TIME_LINE;
        }

        // Date
        if (DATE_PATTERN.matcher(trimmed).find() &&
                trimmed.length() < 60) {
            return LineType.DATE_LINE;
        }

        // Semester
        if (SEMESTER_PATTERN.matcher(trimmed).find() &&
                trimmed.length() < 60 &&
                !QUESTION_PATTERN.matcher(trimmed).find()) {
            return LineType.SEMESTER_LINE;
        }

        // Subject code
        if (SUBJECT_CODE_PATTERN.matcher(trimmed).find() &&
                trimmed.length() < 80) {
            return LineType.SUBJECT_CODE;
        }

        // Subject name — only if standalone and short
        if (SUBJECT_NAME_PATTERN.matcher(trimmed).find() &&
                lower.startsWith("sub") &&
                trimmed.length() < 80) {
            return LineType.SUBJECT_LINE;
        }

        // Internal assessment
        if (INTERNAL_PATTERN.matcher(trimmed).find() &&
                trimmed.length() < 60 &&
                !QUESTION_PATTERN.matcher(trimmed).find()) {
            return LineType.INTERNAL_LINE;
        }

        // College/university
        if (COLLEGE_PATTERN.matcher(trimmed).find() &&
                trimmed.length() < 100) {
            return LineType.COLLEGE_NAME;
        }

        // Department
        if (DEPT_PATTERN.matcher(trimmed).find() &&
                trimmed.length() < 100) {
            return LineType.DEPARTMENT;
        }

        // Exam name
        if (EXAM_NAME_PATTERN.matcher(trimmed).find() &&
                trimmed.length() < 60 &&
                !QUESTION_PATTERN.matcher(trimmed).find()) {
            return LineType.EXAM_NAME;
        }

        // Instructions
        if (INSTRUCTION_PATTERN.matcher(trimmed).find()) {
            return LineType.INSTRUCTION;
        }

        // Attempt rules
        if (ATTEMPT_RULE_PATTERN.matcher(trimmed).find()) {
            return LineType.ATTEMPT_RULE;
        }

        // Question detection — main numbered question
        if (QUESTION_PATTERN.matcher(trimmed).find()) {
            return LineType.QUESTION;
        }

        // MCQ options: A) Option text, [A] Option text (when no marks)
        if (MCQ_OPTION_PATTERN.matcher(trimmed).find() &&
                !MARKS_INLINE.matcher(trimmed).find() &&
                trimmed.length() < 120) {
            return LineType.MCQ_OPTION;
        }

        // Subquestion detection: 1(a), (a), (i), a.
        if (SUBQUESTION_PATTERN.matcher(trimmed).find() &&
                trimmed.length() > 5) {
            return LineType.SUBQUESTION;
        }

        // Early lines (first 15) that are short and don't match questions → likely header/metadata
        if (lineIndex < 15 && trimmed.length() < 80 &&
                !QUESTION_PATTERN.matcher(trimmed).find() &&
                looksLikeMetadata(trimmed)) {
            return LineType.HEADER_FOOTER;
        }

        return LineType.CONTINUATION;
    }

    private boolean looksLikeMetadata(String line) {
        String lower = line.toLowerCase();
        return lower.contains("university") || lower.contains("college") ||
                lower.contains("institute") || lower.contains("department") ||
                lower.contains("semester") || lower.contains("year") ||
                lower.contains("programme") || lower.contains("branch") ||
                lower.contains("scheme") || lower.contains("academic") ||
                lower.contains("date:") || lower.contains("time:") ||
                lower.contains("questions m") || lower.contains("bloom") ||
                lower.contains("course outcome") ||
                (line.matches("^[A-Z][A-Z\\s,.'&-]+$") && line.length() > 5 && line.length() < 80);
    }

    // =====================================================
    // METADATA EXTRACTION
    // =====================================================

    private ParsedMetadata extractMetadata(List<ClassifiedLine> lines) {

        ParsedMetadata meta = new ParsedMetadata();

        for (ClassifiedLine cl : lines) {

            String text = cl.text.trim();

            switch (cl.type) {
                case COLLEGE_NAME:
                    if (meta.getCollegeName() == null) {
                        meta.setCollegeName(text);
                    }
                    break;

                case UNIVERSITY_NAME:
                    if (meta.getUniversityName() == null) {
                        meta.setUniversityName(text);
                    }
                    break;

                case DEPARTMENT:
                    if (meta.getDepartment() == null) {
                        Matcher dm = DEPT_PATTERN.matcher(text);
                        meta.setDepartment(dm.find() ? dm.group(1).trim() : text);
                    }
                    break;

                case EXAM_NAME:
                    if (meta.getExamName() == null) {
                        meta.setExamName(text);
                    }
                    break;

                case SUBJECT_LINE:
                    if (meta.getSubject() == null) {
                        Matcher sm = SUBJECT_NAME_PATTERN.matcher(text);
                        meta.setSubject(sm.find() ? sm.group(1).trim() : text);
                    }
                    break;

                case SUBJECT_CODE:
                    if (meta.getSubjectCode() == null) {
                        Matcher scm = SUBJECT_CODE_PATTERN.matcher(text);
                        meta.setSubjectCode(scm.find() ? scm.group(1).trim() : text);
                    }
                    break;

                case SEMESTER_LINE:
                    if (meta.getSemester() == null) {
                        Matcher sem = SEMESTER_PATTERN.matcher(text);
                        meta.setSemester(sem.find() ? sem.group(1).trim() : null);
                    }
                    break;

                case DATE_LINE:
                    if (meta.getDate() == null) {
                        Matcher dtm = DATE_PATTERN.matcher(text);
                        meta.setDate(dtm.find() ? dtm.group(1).trim() : text);
                    }
                    break;

                case TIME_LINE:
                    if (meta.getTime() == null) {
                        Matcher tm = TIME_PATTERN.matcher(text);
                        meta.setTime(tm.find() ? tm.group(1).trim() : text);
                    }
                    break;

                case DURATION_LINE:
                    if (meta.getDuration() == null) {
                        Matcher dur = DURATION_PATTERN.matcher(text);
                        meta.setDuration(dur.find() ? dur.group(1).trim() : text);
                    }
                    break;

                case MAX_MARKS_LINE:
                    if (meta.getMaxMarks() == null) {
                        Matcher mm = MAX_MARKS_PATTERN.matcher(text);
                        if (mm.find()) {
                            try {
                                meta.setMaxMarks(Double.parseDouble(mm.group(1)));
                            } catch (NumberFormatException ignored) {
                            }
                        }
                    }
                    break;

                case INTERNAL_LINE:
                    if (meta.getInternalNo() == null) {
                        Matcher in = INTERNAL_PATTERN.matcher(text);
                        if (in.find() && in.group(1) != null) {
                            try {
                                meta.setInternalNo(Integer.parseInt(in.group(1)));
                            } catch (NumberFormatException ignored) {
                            }
                        }
                    }
                    break;

                case INSTRUCTION:
                    meta.getInstructions().add(text);
                    break;

                case ATTEMPT_RULE:
                    meta.getInstructions().add(text);
                    break;

                default:
                    break;
            }
        }

        return meta;
    }

    // =====================================================
    // QUESTION EXTRACTION (PASSES 3-7)
    // =====================================================

    private List<QuestionPaper.Question> extractQuestions(
            List<ClassifiedLine> classified,
            ParsedMetadata metadata
    ) {
        List<QuestionPaper.Question> questions = new ArrayList<>();
        String currentSection = "GENERAL";
        String currentGroupName = null;
        int currentMaxAttempt = 1;
        boolean inOptionalGroup = false;

        QuestionPaper.Question currentQuestion = null;
        StringBuilder textBuilder = new StringBuilder();
        List<String> currentOptions = new ArrayList<>();
        String lastQuestionId = null;

        for (int i = 0; i < classified.size(); i++) {

            ClassifiedLine cl = classified.get(i);

            switch (cl.type) {

                case SECTION_HEADING:
                    // Save current question before section change
                    currentQuestion = saveCurrentQuestion(
                            currentQuestion, textBuilder, currentOptions,
                            questions, currentSection
                    );
                    currentSection = extractSectionName(cl.text);
                    // Reset group context on new section
                    currentGroupName = null;
                    currentMaxAttempt = 1;
                    inOptionalGroup = false;
                    break;

                case ATTEMPT_RULE:
                    int attemptCount = parseAttemptCount(cl.text);
                    if (attemptCount > 0) {
                        currentMaxAttempt = attemptCount;
                        currentGroupName = "GROUP-" + currentSection + "-ATTEMPT-" + attemptCount;
                        inOptionalGroup = true;
                    }
                    break;

                case OR_MARKER:
                    // Save current question
                    currentQuestion = saveCurrentQuestion(
                            currentQuestion, textBuilder, currentOptions,
                            questions, currentSection
                    );
                    // Set up OR group
                    if (lastQuestionId != null && !questions.isEmpty()) {
                        String orGroupName = "OR-" + lastQuestionId;
                        // Mark previous question as optional in OR group
                        QuestionPaper.Question prevQ = questions.get(questions.size() - 1);
                        if (prevQ.getGroupName() == null || prevQ.getGroupName().isEmpty()) {
                            prevQ.setGroupName(orGroupName);
                            prevQ.setOptionalQuestion(true);
                            prevQ.setMaxAttempt(1);
                        }
                        currentGroupName = orGroupName;
                        currentMaxAttempt = 1;
                        inOptionalGroup = true;
                    }
                    break;

                case QUESTION:
                    // Save previous question
                    currentQuestion = saveCurrentQuestion(
                            currentQuestion, textBuilder, currentOptions,
                            questions, currentSection
                    );

                    Matcher qm = QUESTION_PATTERN.matcher(cl.text);
                    if (qm.find()) {
                        String qNum = qm.group(1);
                        String qText = qm.group(2) != null ? qm.group(2).trim() : "";
                        String questionId = "Q" + qNum;

                        // Extract inline marks
                        Double marks = extractMarksFromText(qText);
                        // Remove marks from question text
                        qText = removeMarksFromText(qText);

                        currentQuestion = QuestionPaper.Question.builder()
                                .questionId(questionId)
                                .text("")
                                .section(currentSection)
                                .groupName(inOptionalGroup ? currentGroupName : null)
                                .optionalQuestion(inOptionalGroup)
                                .parentQuestion(null)
                                .maxAttempt(inOptionalGroup ? currentMaxAttempt : 1)
                                .questionType("THEORY")
                                .marks(marks)
                                .topic("General")
                                .options(new ArrayList<>())
                                .build();

                        textBuilder = new StringBuilder();
                        if (!qText.isEmpty()) {
                            textBuilder.append(qText);
                        }
                        currentOptions = new ArrayList<>();
                        lastQuestionId = questionId;

                        // Reset OR group after consuming
                        // (only if this wasn't from an ATTEMPT_RULE context)
                        if (inOptionalGroup && currentGroupName != null &&
                                currentGroupName.startsWith("OR-")) {
                            // Keep the group for this question, then reset
                            // (OR pairs are typically just 2 questions)
                        }
                    }
                    break;

                case SUBQUESTION:
                    // Save current question first
                    currentQuestion = saveCurrentQuestion(
                            currentQuestion, textBuilder, currentOptions,
                            questions, currentSection
                    );

                    String subId = extractSubQuestionId(cl.text);
                    String subText = extractSubQuestionText(cl.text);
                    Double subMarks = extractMarksFromText(subText);
                    subText = removeMarksFromText(subText);

                    String parentId = lastQuestionId;

                    currentQuestion = QuestionPaper.Question.builder()
                            .questionId(parentId != null ? parentId + subId : subId)
                            .text("")
                            .section(currentSection)
                            .groupName(inOptionalGroup ? currentGroupName : null)
                            .optionalQuestion(inOptionalGroup)
                            .parentQuestion(parentId)
                            .maxAttempt(inOptionalGroup ? currentMaxAttempt : 1)
                            .questionType("THEORY")
                            .marks(subMarks)
                            .topic("General")
                            .options(new ArrayList<>())
                            .build();

                    textBuilder = new StringBuilder();
                    if (!subText.isEmpty()) {
                        textBuilder.append(subText);
                    }
                    currentOptions = new ArrayList<>();
                    break;

                case MCQ_OPTION:
                    currentOptions.add(cl.text.trim());
                    break;

                case CONTINUATION:
                    // Attach to current question if one exists
                    if (currentQuestion != null && !cl.text.isBlank()) {
                        if (textBuilder.length() > 0) {
                            textBuilder.append(" ");
                        }
                        textBuilder.append(cl.text.trim());
                    }
                    break;

                case INSTRUCTION:
                    // If we're already inside questions, instructions
                    // that look like attempt rules may affect grouping
                    Matcher ar = ATTEMPT_RULE_PATTERN.matcher(cl.text);
                    if (ar.find()) {
                        int count = parseAttemptCount(cl.text);
                        if (count > 0) {
                            currentMaxAttempt = count;
                            currentGroupName = "GROUP-" + currentSection + "-ATTEMPT-" + count;
                            inOptionalGroup = true;
                        }
                    }
                    break;

                default:
                    // METADATA, BLANK, NOISE, etc. — skip
                    break;
            }
        }

        // Save last question
        saveCurrentQuestion(
                currentQuestion, textBuilder, currentOptions,
                questions, currentSection
        );

        // Post-processing: classify question types
        classifyQuestionTypes(questions);

        return questions;
    }

    // =====================================================
    // HELPER: SAVE CURRENT QUESTION
    // =====================================================

    private QuestionPaper.Question saveCurrentQuestion(
            QuestionPaper.Question question,
            StringBuilder textBuilder,
            List<String> options,
            List<QuestionPaper.Question> questions,
            String section
    ) {
        if (question == null) {
            return null;
        }

        String finalText = textBuilder.toString().trim();

        // Don't save if text is empty or too short to be a real question
        if (finalText.isEmpty()) {
            return null;
        }

        // Double-check this isn't metadata masquerading as a question
        if (isMetadataText(finalText)) {
            return null;
        }

        question.setText(finalText);
        question.setSection(section);

        if (!options.isEmpty()) {
            question.setOptions(new ArrayList<>(options));
        }

        // If marks are still 0 and text has inline marks, extract
        if ((question.getMarks() == null || question.getMarks() == 0.0)) {
            Double inlineMarks = extractMarksFromText(finalText);
            if (inlineMarks > 0) {
                question.setMarks(inlineMarks);
            }
        }

        questions.add(question);
        return null; // Reset current
    }

    private boolean isMetadataText(String text) {
        String lower = text.toLowerCase().trim();

        // Check if the text is actually metadata or structural content
        if (lower.length() < 5) return true;

        // Common false positives
        return MAX_MARKS_PATTERN.matcher(text).find() && text.length() < 30 ||
                COLLEGE_PATTERN.matcher(text).find() && text.length() < 100 ||
                DEPT_PATTERN.matcher(text).find() && text.length() < 100 ||
                PAGE_NUMBER_PATTERN.matcher(text).matches() ||
                OR_PATTERN.matcher(text).matches() ||
                lower.equals("or") ||
                lower.matches("^\\d{1,2}[/\\-.]\\d{1,2}[/\\-.]\\d{2,4}$");
    }

    // =====================================================
    // MARKS EXTRACTION
    // =====================================================

    private Double extractMarksFromText(String text) {

        Matcher m = MARKS_INLINE.matcher(text);

        if (m.find()) {
            for (int g = 1; g <= m.groupCount(); g++) {
                if (m.group(g) != null) {
                    try {
                        double val = Double.parseDouble(m.group(g));
                        // Sanity: question marks should be reasonable (1-100)
                        if (val >= 1 && val <= 100) {
                            return val;
                        }
                    } catch (NumberFormatException ignored) {
                    }
                }
            }
        }

        return 0.0;
    }

    private String removeMarksFromText(String text) {
        // Remove marks notations from question text for cleanliness
        text = text.replaceAll("\\[\\s*\\d+\\s*]", "").trim();
        text = text.replaceAll("\\(\\s*\\d+\\s*(?:marks?|[Mm])\\s*\\)", "").trim();
        text = text.replaceAll("\\d+\\s*[Mm]arks?\\s*$", "").trim();
        text = text.replaceAll("\\d+\\s*[Mm]\\s*$", "").trim();
        text = text.replaceAll("[Mm]arks?\\s*:?\\s*\\d+\\s*$", "").trim();
        return text;
    }

    // =====================================================
    // SECTION NAME EXTRACTION
    // =====================================================

    private String extractSectionName(String line) {
        Matcher m = SECTION_PATTERN.matcher(line.trim());
        if (m.find() && m.group(1) != null) {
            String prefix = line.trim().split("\\s+")[0].toUpperCase();
            return prefix + " " + m.group(1).trim();
        }
        return line.trim().toUpperCase();
    }

    // =====================================================
    // SUBQUESTION HELPERS
    // =====================================================

    private String extractSubQuestionId(String line) {
        // Try patterns: "1(a)", "(a)", "a)", "a."
        Matcher m = Pattern.compile(
                "(?:Q?\\d+)?\\s*[.(]\\s*([a-z]|[ivxlc]+)\\s*[.):]|" +
                        "\\(\\s*([a-z]|[ivxlc]+)\\s*\\)|" +
                        "^([a-z])\\s*[.):]",
                Pattern.CASE_INSENSITIVE
        ).matcher(line.trim());

        if (m.find()) {
            for (int g = 1; g <= m.groupCount(); g++) {
                if (m.group(g) != null) {
                    return "(" + m.group(g).toLowerCase() + ")";
                }
            }
        }
        return "";
    }

    private String extractSubQuestionText(String line) {
        // Remove the subquestion identifier prefix
        return line.trim()
                .replaceAll("^(?:Q?\\d+)?\\s*[.(]\\s*[a-z]\\s*[.):]\\s*", "")
                .replaceAll("^\\(\\s*[a-z]\\s*\\)\\s*", "")
                .replaceAll("^[a-z]\\s*[.):]\\s*", "")
                .trim();
    }

    // =====================================================
    // ATTEMPT COUNT PARSING
    // =====================================================

    private int parseAttemptCount(String text) {
        Matcher m = ATTEMPT_RULE_PATTERN.matcher(text);
        if (!m.find()) return 0;

        String countStr = m.group(1).toLowerCase();

        Map<String, Integer> wordToNum = Map.of(
                "one", 1, "two", 2, "three", 3,
                "four", 4, "five", 5, "six", 6,
                "seven", 7, "eight", 8, "nine", 9,
                "ten", 10
        );

        if (wordToNum.containsKey(countStr)) {
            return wordToNum.get(countStr);
        }

        try {
            return Integer.parseInt(countStr);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    // =====================================================
    // QUESTION TYPE CLASSIFICATION
    // =====================================================

    private void classifyQuestionTypes(List<QuestionPaper.Question> questions) {
        for (QuestionPaper.Question q : questions) {
            q.setQuestionType(detectQuestionType(q));
        }
    }

    private String detectQuestionType(QuestionPaper.Question q) {
        String text = q.getText().toLowerCase();

        // MCQ: has options
        if (q.getOptions() != null && !q.getOptions().isEmpty()) {
            return "MCQ";
        }

        // True/False
        if (text.contains("true or false") || text.contains("true/false") ||
                text.contains("state whether") || text.contains("state true or false")) {
            return "TRUE_FALSE";
        }

        // Fill in the blank
        if (text.contains("fill in the blank") || text.contains("fill up") ||
                text.contains("______") || text.contains("____")) {
            return "FILL_BLANK";
        }

        // Programming
        if (text.contains("write a program") || text.contains("write a code") ||
                text.contains("write code") || text.contains("implement") ||
                text.contains("write a function") || text.contains("algorithm")) {
            return "PROGRAMMING";
        }

        // Numerical
        if (text.matches(".*\\b(?:calculate|compute|find the value|solve|evaluate)\\b.*") &&
                text.matches(".*\\d+.*")) {
            return "NUMERICAL";
        }

        // Short answer — low marks, short text
        Double marks = q.getMarks();
        if (marks != null && marks > 0 && marks <= 3) {
            return "SHORT";
        }

        // Descriptive — high marks, explain/describe/discuss keywords
        if (text.contains("explain") || text.contains("describe") ||
                text.contains("discuss") || text.contains("elaborate") ||
                text.contains("compare and contrast") || text.contains("differentiate")) {
            if (marks != null && marks >= 8) {
                return "DESCRIPTIVE";
            }
        }

        return "THEORY";
    }

    // =====================================================
    // VALIDATION
    // =====================================================

    private void validate(ParsedPaperResult result) {
        List<String> warnings = result.getWarnings();
        List<QuestionPaper.Question> questions = result.getQuestions();

        if (questions.isEmpty()) {
            warnings.add("No questions detected in the document. The text may not contain recognizable question patterns.");
            return;
        }

        // Check for suspiciously few questions
        if (questions.size() == 1) {
            warnings.add("Only 1 question detected. The document structure may not be fully recognized.");
        }

        // Check for questions without marks
        long noMarks = questions.stream()
                .filter(q -> q.getMarks() == null || q.getMarks() == 0.0)
                .count();
        if (noMarks > 0) {
            warnings.add(noMarks + " question(s) have no marks assigned.");
        }

        // Check for questions with very short text
        long shortText = questions.stream()
                .filter(q -> q.getText() != null && q.getText().length() < 10)
                .count();
        if (shortText > 0) {
            warnings.add(shortText + " question(s) have very short text (possible parsing issue).");
        }

        // Validate parent references
        Set<String> questionIds = questions.stream()
                .map(QuestionPaper.Question::getQuestionId)
                .collect(Collectors.toSet());

        for (QuestionPaper.Question q : questions) {
            if (q.getParentQuestion() != null &&
                    !questionIds.contains(q.getParentQuestion())) {
                // Parent might be the main question ID, not a separate record — this is OK
                // Only warn if it seems truly orphaned
            }
        }

        // Validate group consistency
        Map<String, List<QuestionPaper.Question>> groups = questions.stream()
                .filter(q -> q.getGroupName() != null && !q.getGroupName().isEmpty())
                .collect(Collectors.groupingBy(QuestionPaper.Question::getGroupName));

        for (Map.Entry<String, List<QuestionPaper.Question>> entry : groups.entrySet()) {
            List<QuestionPaper.Question> groupQ = entry.getValue();
            if (groupQ.size() == 1) {
                warnings.add("Group '" + entry.getKey() + "' has only 1 question — OR/optional group should have 2+.");
            }
        }
    }
}