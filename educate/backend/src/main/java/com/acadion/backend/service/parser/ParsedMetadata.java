package com.acadion.backend.service.parser;

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
public class ParsedMetadata {

    private String collegeName;
    private String universityName;
    private String department;
    private String examName;
    private String examType;
    private String subject;
    private String subjectCode;
    private String semester;
    private String year;
    private String academicYear;
    private String date;
    private String time;
    private String duration;
    private Integer internalNo;
    private Double maxMarks;

    @Builder.Default
    private List<String> instructions = new ArrayList<>();
}
