package com.acadion.backend.dto.syllabus;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PublishSyllabusRequest {

    private String versionTitle;

    private String changeSummary;
}
