package com.acadion.backend.dto.syllabus;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SyllabusVersionSummaryResponse {

    private String id;
    private String classroomId;
    private Integer versionNumber;
    private String versionTitle;
    private String changeSummary;
    private String publishedBy;
    private LocalDateTime publishedAt;
    private Integer topicCount;
}
