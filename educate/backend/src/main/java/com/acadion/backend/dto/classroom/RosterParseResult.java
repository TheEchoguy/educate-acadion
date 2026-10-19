package com.acadion.backend.dto.classroom;

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
public class RosterParseResult {

    private String filename;
    private int totalRows;
    private int matchedInDbCount;
    private int notInDbCount;
    private int alreadyEnrolledCount;

    @Builder.Default
    private List<ParsedStudentPreview> students = new ArrayList<>();

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ParsedStudentPreview {
        private int rowNumber;
        private String usn;
        private String email;
        private String name;
        private boolean existsInDb;
        private String studentId;
        private boolean alreadyEnrolled;
        private String statusMessage;
    }
}
