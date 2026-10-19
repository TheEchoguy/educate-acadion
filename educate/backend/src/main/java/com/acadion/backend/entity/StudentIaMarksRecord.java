package com.acadion.backend.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "student_ia_marks_records")
@CompoundIndexes({
        @CompoundIndex(name = "classroom_usn_ia_idx", def = "{'classroomId': 1, 'usn': 1, 'iaNumber': 1}", unique = true)
})
public class StudentIaMarksRecord {

    @Id
    private String id;

    @Indexed
    private String classroomId;

    @Indexed
    private String usn;

    private String studentName;

    /**
     * IA Number: 1, 2, or 3
     */
    private int iaNumber;

    /**
     * Sub-question marks: e.g. {"1a": 9.0, "1b": 10.0, "3a": 8.0, "3b": 8.0}
     */
    @Builder.Default
    private Map<String, Double> questionMarks = new HashMap<>();

    /**
     * Total marks scored in this IA test (out of 40.0)
     */
    private double totalMarks;

    /**
     * Module Mastery scores (Percentage 0-100% per module)
     * e.g. { 1: 95.0, 2: 80.0 }
     */
    @Builder.Default
    private Map<Integer, Double> moduleMastery = new HashMap<>();

    @Builder.Default
    private Instant updatedAt = Instant.now();
}
