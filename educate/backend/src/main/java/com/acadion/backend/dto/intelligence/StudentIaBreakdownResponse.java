package com.acadion.backend.dto.intelligence;

import com.acadion.backend.entity.StudentIaMarksRecord;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentIaBreakdownResponse {
    private String classroomId;
    private String usn;
    private String studentName;
    @Builder.Default
    private List<StudentIaMarksRecord> iaRecords = new ArrayList<>();
    @Builder.Default
    private Map<Integer, Double> cumulativeModuleMastery = new HashMap<>();
    @Builder.Default
    private List<String> weakModules = new ArrayList<>();
    @Builder.Default
    private List<String> strongModules = new ArrayList<>();
    private double overallIaAverage;
}
