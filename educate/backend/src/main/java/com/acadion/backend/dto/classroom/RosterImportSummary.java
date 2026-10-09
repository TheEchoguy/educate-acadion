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
public class RosterImportSummary {

    private int totalRows;
    private int validRows;
    private int duplicatesInFile;
    private int matchedCount;
    private int alreadyMembersCount;
    private int unmatchedCount;
    private int addedCount;

    @Builder.Default
    private List<UnmatchedStudentDetail> unmatchedStudents = new ArrayList<>();

    @Builder.Default
    private List<String> duplicateUsns = new ArrayList<>();

    @Builder.Default
    private List<String> alreadyMemberUsns = new ArrayList<>();

    @Builder.Default
    private List<String> invalidRows = new ArrayList<>();

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UnmatchedStudentDetail {
        private String usn;
        private String reason;
        private int rowNumber;
    }
}
