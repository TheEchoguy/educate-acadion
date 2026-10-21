package com.acadion.backend;

import com.acadion.backend.dto.CreateQuestionPaperRequest;
import com.acadion.backend.dto.EnrichedStudentResponseDto;
import com.acadion.backend.dto.ResponseSubmissionRequest;
import com.acadion.backend.dto.quiz.GenerateQuizRequest;
import com.acadion.backend.dto.quiz.GeneratedQuestionDto;
import com.acadion.backend.dto.quiz.GeneratedQuizResponse;
import com.acadion.backend.entity.QuestionPaper;
import com.acadion.backend.entity.StudentResponse;
import com.acadion.backend.repository.QuestionPaperRepository;
import com.acadion.backend.repository.StudentResponseRepository;
import com.acadion.backend.service.QuestionPaperService;
import com.acadion.backend.service.StudentResponseService;
import com.acadion.backend.service.quiz.QuizGeneratorService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
public class QuizGeneratorEndToEndWorkflowTest {

    @Autowired
    private QuizGeneratorService quizGeneratorService;

    @Autowired
    private QuestionPaperService questionPaperService;

    @Autowired
    private StudentResponseService studentResponseService;

    @Autowired
    private QuestionPaperRepository questionPaperRepository;

    @Autowired
    private StudentResponseRepository studentResponseRepository;

    private final List<String> createdPaperIds = new ArrayList<>();
    private final List<String> createdResponseIds = new ArrayList<>();

    @AfterEach
    void tearDown() {
        for (String id : createdPaperIds) {
            try {
                questionPaperRepository.deleteById(id);
                questionPaperRepository.findAll().stream()
                        .filter(p -> id.equalsIgnoreCase(p.getPaperId()))
                        .forEach(p -> questionPaperRepository.delete(p));
            } catch (Exception ignored) {
            }
        }
        for (String id : createdResponseIds) {
            try {
                studentResponseRepository.deleteById(id);
            } catch (Exception ignored) {
            }
        }
    }

    @Test
    @DisplayName("Mode 1: Topic-only generation produces valid curriculum questions")
    void testTopicOnlyGeneration() {
        GenerateQuizRequest req = GenerateQuizRequest.builder()
                .subject("Operating Systems")
                .topic("CPU Scheduling Algorithms")
                .mode("TOPIC")
                .questionCount(4)
                .difficulty("MEDIUM")
                .mock(true)
                .build();

        GeneratedQuizResponse response = quizGeneratorService.generateQuiz(req, null);

        assertNotNull(response);
        assertTrue(response.isSuccess());
        assertEquals("Operating Systems", response.getSubject());
        assertEquals(4, response.getQuestions().size());

        for (GeneratedQuestionDto q : response.getQuestions()) {
            assertNotNull(q.getText());
            assertEquals(4, q.getOptions().size());
            assertTrue(List.of("A", "B", "C", "D").contains(q.getCorrectAnswer()));
            assertNotNull(q.getExplanation());
        }
    }

    @Test
    @DisplayName("Mode 2: Notes-only generation with valid notes text produces grounded questions")
    void testNotesOnlyGeneration() {
        String lectureNotes = """
                Relational Database Management Systems (RDBMS):
                ACID properties stand for Atomicity, Consistency, Isolation, and Durability.
                Atomicity guarantees that all operations within a work unit are completed successfully; otherwise, the transaction is aborted.
                Consistency ensures the database properly changes states upon a successfully committed transaction.
                Isolation enables transactions to operate independently of and transparently to each other.
                Durability ensures that the result or effect of a committed transaction persists in case of a system failure.
                """;

        GenerateQuizRequest req = GenerateQuizRequest.builder()
                .subject("Database Systems")
                .topic("Transaction Management")
                .mode("NOTES")
                .notesText(lectureNotes)
                .questionCount(3)
                .difficulty("EASY")
                .mock(true)
                .build();

        GeneratedQuizResponse response = quizGeneratorService.generateQuiz(req, null);

        assertNotNull(response);
        assertTrue(response.isSuccess());
        assertEquals(3, response.getQuestions().size());
    }

    @Test
    @DisplayName("Mode 3: Topic + Notes combined generation produces focused questions")
    void testTopicPlusNotesGeneration() {
        String notes = "Deadlock prevention involves invalidating one of the four Coffman conditions: Mutual Exclusion, Hold and Wait, No Preemption, and Circular Wait.";

        GenerateQuizRequest req = GenerateQuizRequest.builder()
                .subject("Operating Systems")
                .topic("Deadlock Prevention")
                .mode("TOPIC_AND_NOTES")
                .notesText(notes)
                .questionCount(3)
                .difficulty("HARD")
                .mock(true)
                .build();

        GeneratedQuizResponse response = quizGeneratorService.generateQuiz(req, null);

        assertNotNull(response);
        assertTrue(response.isSuccess());
        assertEquals(3, response.getQuestions().size());
    }

    @Test
    @DisplayName("Notes-based mode rejects empty notes with clear validation error")
    void testEmptyNotesRejection() {
        GenerateQuizRequest req = GenerateQuizRequest.builder()
                .subject("Computer Networks")
                .mode("NOTES")
                .notesText("   ")
                .build();

        GeneratedQuizResponse response = quizGeneratorService.generateQuiz(req, null);

        assertNotNull(response);
        assertFalse(response.isSuccess());
        assertEquals("NOTES_MISSING", response.getErrorCode());
        assertTrue(response.getError().contains("Study notes or document content is required"));
    }

    @Test
    @DisplayName("End-to-End: Teacher creates, edits, saves draft, publishes, and student attempts & gets auto-scored")
    void testCompleteTeacherToStudentWorkflow() {
        String teacherEmail = "prof.smith@acadion.edu";
        String studentUsn = "1DB21CS001";

        // Step 1: Teacher generates a 2-question quiz in mock mode
        GenerateQuizRequest genReq = GenerateQuizRequest.builder()
                .subject("Software Engineering")
                .topic("Agile Methodologies & Scrum")
                .mode("TOPIC")
                .questionCount(2)
                .difficulty("MEDIUM")
                .mock(true)
                .build();

        GeneratedQuizResponse genRes = quizGeneratorService.generateQuiz(genReq, null);
        assertTrue(genRes.isSuccess());
        assertEquals(2, genRes.getQuestions().size());

        // Step 2: Teacher edits question 1 and option choices before saving draft
        GeneratedQuestionDto q1 = genRes.getQuestions().get(0);
        GeneratedQuestionDto q2 = genRes.getQuestions().get(1);

        q1.setText("Which role in Scrum is responsible for maximizing product value?");
        q1.setOptions(List.of("Product Owner", "Scrum Master", "Development Team", "Project Sponsor"));
        q1.setCorrectAnswer("A");
        q1.setExplanation("The Product Owner is responsible for the Product Backlog and maximizing business value.");

        q2.setText("What is the typical recommended duration for a Daily Standup?");
        q2.setOptions(List.of("15 minutes", "45 minutes", "1 hour", "30 minutes"));
        q2.setCorrectAnswer("A");
        q2.setExplanation("Daily Scrum is timeboxed to 15 minutes.");

        // Step 3: Teacher saves Draft
        CreateQuestionPaperRequest draftReq = new CreateQuestionPaperRequest();
        draftReq.setSubject("Software Engineering");
        draftReq.setSubjectCode("CS504");
        draftReq.setExamName("Agile & Scrum Quiz");
        draftReq.setSemester("5th Sem");
        draftReq.setAssignedSemester("5th Sem");
        draftReq.setTopic("Agile Methodologies");
        draftReq.setDifficulty("MEDIUM");
        draftReq.setSourceMode("TOPIC");
        draftReq.setPaperCategory("QUIZ");
        draftReq.setPaperFormat("MCQ");
        draftReq.setAllowedForPractice(false);
        draftReq.setMaxMarks(2.0);

        CreateQuestionPaperRequest.QuestionData qData1 = new CreateQuestionPaperRequest.QuestionData();
        qData1.setQuestionId("Q1");
        qData1.setText(q1.getText());
        qData1.setOptions(q1.getOptions());
        qData1.setCorrectAnswer(q1.getCorrectAnswer());
        qData1.setExplanation(q1.getExplanation());
        qData1.setMarks(1.0);
        qData1.setQuestionType("MCQ");
        qData1.setTopic(q1.getTopic());

        CreateQuestionPaperRequest.QuestionData qData2 = new CreateQuestionPaperRequest.QuestionData();
        qData2.setQuestionId("Q2");
        qData2.setText(q2.getText());
        qData2.setOptions(q2.getOptions());
        qData2.setCorrectAnswer(q2.getCorrectAnswer());
        qData2.setExplanation(q2.getExplanation());
        qData2.setMarks(1.0);
        qData2.setQuestionType("MCQ");
        qData2.setTopic(q2.getTopic());

        draftReq.setQuestions(List.of(qData1, qData2));

        QuestionPaper savedDraft = quizGeneratorService.saveDraft(draftReq, teacherEmail);
        assertNotNull(savedDraft);
        assertNotNull(savedDraft.getPaperId());
        createdPaperIds.add(savedDraft.getPaperId());
        createdPaperIds.add(savedDraft.getId());
        assertEquals("DRAFT", savedDraft.getPublicationStatus());
        assertFalse(savedDraft.getAllowedForPractice());

        // Step 4: Verify draft persists and is listed for teacher
        List<QuestionPaper> teacherDrafts = quizGeneratorService.getTeacherDrafts(teacherEmail);
        assertTrue(teacherDrafts.stream().anyMatch(d -> d.getPaperId().equals(savedDraft.getPaperId())));

        // Step 5: Verify draft is NOT exposed to student
        List<QuestionPaper> studentPapersBeforePublish = questionPaperService.getAllPapers("STUDENT", null);
        assertFalse(studentPapersBeforePublish.stream().anyMatch(p -> p.getPaperId().equals(savedDraft.getPaperId())),
                "Draft quiz MUST NOT appear in student paper list");

        // Step 6: Teacher publishes the approved quiz
        QuestionPaper publishedQuiz = quizGeneratorService.publishQuiz(savedDraft.getPaperId(), draftReq, teacherEmail);
        assertNotNull(publishedQuiz);
        assertEquals("PUBLISHED", publishedQuiz.getPublicationStatus());
        assertTrue(publishedQuiz.getAllowedForPractice());
        assertEquals(savedDraft.getPaperId(), publishedQuiz.getPaperId(), "Publishing existing draft should update the same ID without duplicating");

        // Step 7: Verify published quiz now appears in student paper list, but answers are STRIPPED
        List<QuestionPaper> studentPapersAfterPublish = questionPaperService.getAllPapers("STUDENT", null);
        QuestionPaper studentViewPaper = studentPapersAfterPublish.stream()
                .filter(p -> p.getPaperId().equals(publishedQuiz.getPaperId()))
                .findFirst()
                .orElse(null);

        assertNotNull(studentViewPaper, "Published quiz MUST appear to students");
        for (QuestionPaper.Question q : studentViewPaper.getQuestions()) {
            assertNull(q.getCorrectAnswer(), "Student MUST NEVER receive correct answers before submission");
            assertNull(q.getExplanation(), "Student MUST NEVER receive explanations before submission");
            assertEquals(4, q.getOptions().size(), "Student must receive options");
        }

        // Step 8: Teacher view contains full answers and explanations
        List<QuestionPaper> teacherPapers = questionPaperService.getAllPapers("TEACHER", null);
        QuestionPaper teacherViewPaper = teacherPapers.stream()
                .filter(p -> p.getPaperId().equals(publishedQuiz.getPaperId()))
                .findFirst()
                .orElseThrow();

        for (QuestionPaper.Question q : teacherViewPaper.getQuestions()) {
            assertNotNull(q.getCorrectAnswer(), "Teacher must see correct answer");
            assertNotNull(q.getExplanation(), "Teacher must see explanation");
        }

        // Step 9: Student attempts the quiz
        // Student answers Q1 correctly ("A" = Product Owner), and Q2 incorrectly ("B" = 45 minutes)
        ResponseSubmissionRequest submission = new ResponseSubmissionRequest();
        submission.setUsn(studentUsn);
        submission.setPaperId(publishedQuiz.getPaperId());
        submission.setSubmissionMode("ONLINE");
        submission.setIsPractice(false);
        submission.setPaperCategory("QUIZ");

        ResponseSubmissionRequest.AnswerRequest ans1 = new ResponseSubmissionRequest.AnswerRequest();
        ans1.setQuestionId("Q1");
        ans1.setAnswer("A");

        ResponseSubmissionRequest.AnswerRequest ans2 = new ResponseSubmissionRequest.AnswerRequest();
        ans2.setQuestionId("Q2");
        ans2.setAnswer("B");

        submission.setResponses(List.of(ans1, ans2));

        StudentResponse evaluatedResponse = studentResponseService.submit(submission);
        assertNotNull(evaluatedResponse);
        if (evaluatedResponse.getId() != null) {
            createdResponseIds.add(evaluatedResponse.getId());
        }

        assertEquals(1.0, evaluatedResponse.getTotalMarks(), 0.01);
        assertEquals(2.0, evaluatedResponse.getMaxMarks(), 0.01);

        StudentResponse.ResponseAnswer respAns1 = evaluatedResponse.getResponses().stream()
                .filter(a -> "Q1".equalsIgnoreCase(a.getQuestionId())).findFirst().orElseThrow();
        assertTrue(respAns1.getIsCorrect());
        assertEquals(1.0, respAns1.getMarksObtained());
        assertTrue(respAns1.getFeedback().contains("Correct"));
        assertTrue(respAns1.isEvaluated());

        StudentResponse.ResponseAnswer respAns2 = evaluatedResponse.getResponses().stream()
                .filter(a -> "Q2".equalsIgnoreCase(a.getQuestionId())).findFirst().orElseThrow();
        assertFalse(respAns2.getIsCorrect());
        assertEquals(0.0, respAns2.getMarksObtained());
        assertTrue(respAns2.getFeedback().contains("Incorrect"));
        assertTrue(respAns2.isEvaluated());

        // Step 11: Verify Student Results retrieval
        List<StudentResponse> studentResults = studentResponseRepository.findByUsnOrderBySubmittedAtAsc(studentUsn);
        assertTrue(studentResults.stream().anyMatch(r -> r.getPaperId().equalsIgnoreCase(publishedQuiz.getPaperId())));

        // Step 12: Verify MCQ Evaluation status & EvaluatedBy
        assertTrue(evaluatedResponse.isEvaluationCompleted(), "MCQ Quiz submission should be marked as evaluated");
        assertEquals("AI Auto-Evaluator (MCQ)", evaluatedResponse.getEvaluatedBy());

        // Step 13: Verify Teacher Evaluation retrieval (does not crash with null internalNo, correctly maps teacher subjects)
        java.util.Map<String, Object> teacherSubjects = studentResponseService.getMySubjects(teacherEmail);
        @SuppressWarnings("unchecked")
        List<String> assigned = (List<String>) teacherSubjects.get("assignedSubjects");
        assertTrue(assigned.contains("Software Engineering"), "Teacher should dynamically have access to subjects of papers they created");

        List<EnrichedStudentResponseDto> enrichedResponses = studentResponseService.getEnrichedResponses(
                publishedQuiz.getPaperId(), null, "ALL"
        );
        assertNotNull(enrichedResponses);
        assertFalse(enrichedResponses.isEmpty(), "Teacher evaluation list must include the student attempt");
        EnrichedStudentResponseDto attempt = enrichedResponses.stream()
                .filter(r -> r.getPaperId().equalsIgnoreCase(publishedQuiz.getPaperId()))
                .findFirst().orElseThrow();
        assertEquals(studentUsn, attempt.getUsn());
        assertEquals(1.0, attempt.getTotalMarks(), 0.01);
        assertEquals(2.0, attempt.getMaxMarks(), 0.01);
        assertEquals("AI Auto-Evaluator (MCQ)", attempt.getEvaluatedBy());

        // Step 14: Duplicate submission is prevented according to existing attempt policy
        RuntimeException ex = assertThrows(RuntimeException.class, () -> studentResponseService.submit(submission));
        assertTrue(ex.getMessage().contains("already submitted"));
    }

    @Test
    @DisplayName("Regression: AI quiz with null internalNo is evaluated and retrieved in teacher evaluation without NPE")
    void testAiQuizWithNullInternalNoEvaluationAndTeacherEnrichment() {
        String teacherEmail = "ai.teacher@acadion.edu";
        String studentUsn = "1MV23CS999";
        String paperId = "PUB-AI-REGRESSION-TEST";

        QuestionPaper paper = QuestionPaper.builder()
                .paperId(paperId)
                .examName("AI Fundamentals Quiz")
                .subject("Artificial Intelligence")
                .subjectCode("AI701")
                .semester("7th Sem")
                .assignedSemester("7th Sem")
                .createdBy(teacherEmail)
                .paperCategory("QUIZ")
                .paperFormat("MCQ")
                .publicationStatus("PUBLISHED")
                .allowedForPractice(true)
                .internalNo(null) // KEY TEST: AI Quizzes have null internalNo
                .maxMarks(10.0)
                .questions(List.of(
                        QuestionPaper.Question.builder()
                                .questionId("Q1")
                                .text("What is supervised learning?")
                                .options(List.of("Learning with labeled data", "Learning without labels", "Trial and error", "Random search"))
                                .correctAnswer("A")
                                .marks(10.0)
                                .questionType("MCQ")
                                .build()
                ))
                .build();

        paper = questionPaperRepository.save(paper);
        createdPaperIds.add(paper.getId());
        createdPaperIds.add(paper.getPaperId());

        // Student submits
        ResponseSubmissionRequest req = new ResponseSubmissionRequest();
        req.setPaperId(paperId);
        req.setUsn(studentUsn);
        req.setSubmissionMode("ONLINE");
        req.setIsPractice(false);
        req.setPaperCategory("QUIZ");

        ResponseSubmissionRequest.AnswerRequest ans = new ResponseSubmissionRequest.AnswerRequest();
        ans.setQuestionId("Q1");
        ans.setAnswer("A");
        req.setResponses(List.of(ans));

        StudentResponse response = studentResponseService.submit(req);
        assertNotNull(response);
        createdResponseIds.add(response.getId());
        assertEquals(10.0, response.getTotalMarks(), 0.01);
        assertTrue(response.isEvaluationCompleted());
        assertEquals("AI Auto-Evaluator (MCQ)", response.getEvaluatedBy());

        // Teacher retrieves enriched responses - must not throw NullPointerException
        assertDoesNotThrow(() -> {
            List<EnrichedStudentResponseDto> list = studentResponseService.getEnrichedResponses(paperId, null, "ALL");
            assertNotNull(list);
            assertFalse(list.isEmpty());
            assertEquals(1, list.size());
            assertEquals("1MV23CS999", list.get(0).getUsn());
            assertEquals(10.0, list.get(0).getTotalMarks(), 0.01);
            assertEquals("Artificial Intelligence", list.get(0).getSubject());

            // Also test with specific semester filter
            List<EnrichedStudentResponseDto> listSem7 = studentResponseService.getEnrichedResponses(paperId, 7, "Artificial Intelligence");
            assertEquals(1, listSem7.size());
        });
    }
}
