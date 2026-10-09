package com.acadion.backend.service.parser;

import com.acadion.backend.entity.QuestionPaper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class AiQuestionParserServiceTest {

    private AiQuestionParserService parser;

    @BeforeEach
    void setUp() {
        parser = new AiQuestionParserService();
    }

    @Test
    void test1_NormalQuestionPaperWithMetadata() {
        String input = """
                Don Bosco Institute of Technology
                Department of Computer Science and Engineering
                Internal Assessment Test 1
                Subject: Machine Learning
                Sub Code: 18CS71
                Max Marks: 50
                Date: 12/08/2026
                Duration: 1 Hour 30 Mins
                
                PART A
                
                Q1. Explain the architecture of a convolutional neural network with diagrams. [10]
                Q2. Differentiate between supervised and unsupervised learning algorithms. [10]
                
                PART B
                
                Q3. What is principal component analysis? Explain dimensionality reduction. [10]
                """;

        ParsedPaperResult result = parser.parseDocument(input);

        assertNotNull(result);
        assertEquals("Machine Learning", result.getMetadata().getSubject());
        assertEquals("18CS71", result.getMetadata().getSubjectCode());
        assertEquals(50.0, result.getMetadata().getMaxMarks());
        assertEquals("12/08/2026", result.getMetadata().getDate());

        List<QuestionPaper.Question> questions = result.getQuestions();
        assertEquals(3, questions.size());

        assertEquals("Q1", questions.get(0).getQuestionId());
        assertTrue(questions.get(0).getText().contains("convolutional neural network"));
        assertEquals(10.0, questions.get(0).getMarks());
        assertEquals("PART A", questions.get(0).getSection());

        assertEquals("Q2", questions.get(1).getQuestionId());
        assertEquals(10.0, questions.get(1).getMarks());
        assertEquals("PART A", questions.get(1).getSection());

        assertEquals("Q3", questions.get(2).getQuestionId());
        assertEquals("PART B", questions.get(2).getSection());
    }

    @Test
    void test2_MetadataNotConvertedToQuestions() {
        String input = """
                Global Academy of Technology
                Department of Information Science
                Date: 15/09/2026
                Time: 2:00 PM - 5:00 PM
                Max Marks: 100
                Instructions: Answer all questions.
                
                1. Define database normalization and explain 1NF, 2NF, 3NF. [10]
                """;

        ParsedPaperResult result = parser.parseDocument(input);
        List<QuestionPaper.Question> questions = result.getQuestions();

        assertEquals(1, questions.size());
        assertEquals("Q1", questions.get(0).getQuestionId());
        assertFalse(questions.stream().anyMatch(q -> q.getText().toLowerCase().contains("global academy")));
        assertFalse(questions.stream().anyMatch(q -> q.getText().toLowerCase().contains("max marks: 100")));
        assertFalse(questions.stream().anyMatch(q -> q.getText().toLowerCase().contains("instructions")));
    }

    @Test
    void test3_MultilineQuestions() {
        String input = """
                Q1. Explain the mathematical formulation of Support Vector Machines (SVM)
                including the primal and dual optimization problems, and describe the role
                of kernel functions in transforming non-linear feature spaces. [15]
                
                Q2. What is cross-validation? [5]
                """;

        ParsedPaperResult result = parser.parseDocument(input);
        List<QuestionPaper.Question> questions = result.getQuestions();

        assertEquals(2, questions.size());
        assertTrue(questions.get(0).getText().contains("Support Vector Machines"));
        assertTrue(questions.get(0).getText().contains("kernel functions"));
        assertEquals(15.0, questions.get(0).getMarks());
    }

    @Test
    void test4_QuestionNumberingFormats() {
        String input = """
                1. What is an operating system? [5]
                2) Explain process scheduling. [5]
                Q3: Discuss memory management techniques. [10]
                """;

        ParsedPaperResult result = parser.parseDocument(input);
        List<QuestionPaper.Question> questions = result.getQuestions();

        assertEquals(3, questions.size());
        assertEquals("Q1", questions.get(0).getQuestionId());
        assertEquals("Q2", questions.get(1).getQuestionId());
        assertEquals("Q3", questions.get(2).getQuestionId());
    }

    @Test
    void test5_SubquestionsHierarchy() {
        String input = """
                Q1. Answer the following:
                (a) Explain supervised learning with examples. [5]
                (b) Explain unsupervised learning with examples. [5]
                """;

        ParsedPaperResult result = parser.parseDocument(input);
        List<QuestionPaper.Question> questions = result.getQuestions();

        assertTrue(questions.size() >= 2);
        QuestionPaper.Question subA = questions.stream()
                .filter(q -> q.getQuestionId().contains("(a)"))
                .findFirst().orElse(null);
        assertNotNull(subA);
        assertEquals("Q1", subA.getParentQuestion());
        assertEquals(5.0, subA.getMarks());
    }

    @Test
    void test6_OrQuestionDetection() {
        String input = """
                Q1. Explain Principal Component Analysis in detail. [10]
                
                OR
                
                Q2. Explain Singular Value Decomposition in detail. [10]
                """;

        ParsedPaperResult result = parser.parseDocument(input);
        List<QuestionPaper.Question> questions = result.getQuestions();

        assertEquals(2, questions.size());
        assertTrue(Boolean.TRUE.equals(questions.get(0).getOptionalQuestion()));
        assertTrue(Boolean.TRUE.equals(questions.get(1).getOptionalQuestion()));
        assertNotNull(questions.get(0).getGroupName());
        assertEquals(questions.get(0).getGroupName(), questions.get(1).getGroupName());
    }

    @Test
    void test7_AttemptRuleGrouping() {
        String input = """
                SECTION A
                Answer any 3 questions.
                
                Q1. Define artificial intelligence. [5]
                Q2. Define machine learning. [5]
                Q3. Define deep learning. [5]
                Q4. Define reinforcement learning. [5]
                Q5. Define neural networks. [5]
                """;

        ParsedPaperResult result = parser.parseDocument(input);
        List<QuestionPaper.Question> questions = result.getQuestions();

        assertEquals(5, questions.size());
        for (QuestionPaper.Question q : questions) {
            assertEquals(3, q.getMaxAttempt());
            assertNotNull(q.getGroupName());
        }
    }

    @Test
    void test8_SectionHeadings() {
        String input = """
                MODULE 1
                Q1. Describe the OSI reference model layers. [10]
                
                MODULE 2
                Q2. Describe the TCP/IP protocol architecture. [10]
                """;

        ParsedPaperResult result = parser.parseDocument(input);
        List<QuestionPaper.Question> questions = result.getQuestions();

        assertEquals(2, questions.size());
        assertEquals("MODULE 1", questions.get(0).getSection());
        assertEquals("MODULE 2", questions.get(1).getSection());
    }

    @Test
    void test9_McqDetection() {
        String input = """
                Q1. Which data structure operates on LIFO principle? [2]
                A) Queue
                B) Stack
                C) Tree
                D) Graph
                """;

        ParsedPaperResult result = parser.parseDocument(input);
        List<QuestionPaper.Question> questions = result.getQuestions();

        assertEquals(1, questions.size());
        assertEquals("MCQ", questions.get(0).getQuestionType());
        assertEquals(4, questions.get(0).getOptions().size());
    }

    @Test
    void test10_DifferentMarksFormats() {
        String input = """
                Q1. Question with bracket marks. [10]
                Q2. Question with parentheses marks. (10 Marks)
                Q3. Question with word marks. 5 marks
                Q4. Question with M suffix. 5M
                """;

        ParsedPaperResult result = parser.parseDocument(input);
        List<QuestionPaper.Question> questions = result.getQuestions();

        assertEquals(4, questions.size());
        assertEquals(10.0, questions.get(0).getMarks());
        assertEquals(10.0, questions.get(1).getMarks());
        assertEquals(5.0, questions.get(2).getMarks());
        assertEquals(5.0, questions.get(3).getMarks());
    }

    @Test
    void test11_RepeatedHeadersFootersFiltered() {
        String input = """
                Semester Exam 2026
                Semester Exam 2026
                Semester Exam 2026
                
                Q1. Explain inheritance in Object Oriented Programming. [10]
                
                Page 1 of 2
                
                Q2. Explain polymorphism with suitable examples. [10]
                
                Page 2 of 2
                """;

        ParsedPaperResult result = parser.parseDocument(input);
        List<QuestionPaper.Question> questions = result.getQuestions();

        assertEquals(2, questions.size());
        assertFalse(questions.stream().anyMatch(q -> q.getText().toLowerCase().contains("page 1 of 2")));
    }

    @Test
    void test12_EmptyTextHandling() {
        ParsedPaperResult result = parser.parseDocument("");
        assertNotNull(result);
        assertTrue(result.getQuestions().isEmpty());
        assertFalse(result.getWarnings().isEmpty());

        ParsedPaperResult nullResult = parser.parseDocument(null);
        assertNotNull(nullResult);
        assertTrue(nullResult.getQuestions().isEmpty());
    }

    @Test
    void test13_QuestionTypeDetection() {
        String input = """
                Q1. State whether the following is True or False: Binary search has O(n) complexity. [2]
                Q2. Fill in the blank: The shortest path algorithm by ______ uses a greedy approach. [2]
                Q3. Write a program to implement quicksort algorithm in C. [10]
                Q4. Calculate the standard deviation for the given dataset: 4, 8, 6, 5, 3. [5]
                """;

        ParsedPaperResult result = parser.parseDocument(input);
        List<QuestionPaper.Question> questions = result.getQuestions();

        assertEquals(4, questions.size());
        assertEquals("TRUE_FALSE", questions.get(0).getQuestionType());
        assertEquals("FILL_BLANK", questions.get(1).getQuestionType());
        assertEquals("PROGRAMMING", questions.get(2).getQuestionType());
        assertEquals("NUMERICAL", questions.get(3).getQuestionType());
    }

    @Test
    void test14_ValidationWarnings() {
        String input = """
                Q1. Single short text.
                """;

        ParsedPaperResult result = parser.parseDocument(input);
        assertFalse(result.getWarnings().isEmpty());
    }

    @Test
    void test15_LegacyParseQuestionsMethod() {
        String input = """
                Q1. Explain bubble sort. [5]
                Q2. Explain merge sort. [10]
                """;

        List<QuestionPaper.Question> questions = parser.parseQuestions(input);
        assertEquals(2, questions.size());
        assertEquals("Q1", questions.get(0).getQuestionId());
        assertEquals(5.0, questions.get(0).getMarks());
    }
}
