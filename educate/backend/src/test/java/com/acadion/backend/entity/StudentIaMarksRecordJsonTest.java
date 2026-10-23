package com.acadion.backend.entity;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class StudentIaMarksRecordJsonTest {

    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    @Test
    void testSerializationAndDeserialization() throws Exception {
        StudentIaMarksRecord record = StudentIaMarksRecord.builder()
                .classroomId("class-1")
                .usn("1DB21CS001")
                .studentName("John Doe")
                .iaNumber(1)
                .totalMarks(35.5)
                .published(true)
                .build();

        String json = objectMapper.writeValueAsString(record);
        assertNotNull(json);
        assertTrue(json.contains("\"published\":true"), "JSON should contain published property");
        assertTrue(json.contains("\"isPublished\":true"), "JSON should contain isPublished property");

        StudentIaMarksRecord parsed = objectMapper.readValue(json, StudentIaMarksRecord.class);
        assertTrue(parsed.isPublished());
        assertEquals("1DB21CS001", parsed.getUsn());
    }

    @Test
    void testDeserializationWithIsPublishedOnly() throws Exception {
        String json = "{\"classroomId\":\"c1\",\"usn\":\"1DB21CS002\",\"isPublished\":true}";
        StudentIaMarksRecord parsed = objectMapper.readValue(json, StudentIaMarksRecord.class);
        assertTrue(parsed.isPublished());
    }

    @Test
    void testDeserializationWithPublishedOnly() throws Exception {
        String json = "{\"classroomId\":\"c1\",\"usn\":\"1DB21CS003\",\"published\":true}";
        StudentIaMarksRecord parsed = objectMapper.readValue(json, StudentIaMarksRecord.class);
        assertTrue(parsed.isPublished());
    }
}
