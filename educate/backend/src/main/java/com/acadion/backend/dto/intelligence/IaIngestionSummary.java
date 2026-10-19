package com.acadion.backend.dto.intelligence;

import com.acadion.backend.entity.StudentIaMarksRecord;
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
public class IaIngestionSummary {
    private String classroomId;
    private int iaNumber;
    private int totalStudentsIngested;
    private String filename;
    @Builder.Default
    private List<StudentIaMarksRecord> records = new ArrayList<>();
    @Builder.Default
    private List<Integer> ingestedIas = new ArrayList<>();
    private String message;
    @Builder.Default
    private boolean published = false;
}
