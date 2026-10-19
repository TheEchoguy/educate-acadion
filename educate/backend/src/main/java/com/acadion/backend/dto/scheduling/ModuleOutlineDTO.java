package com.acadion.backend.dto.scheduling;

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
public class ModuleOutlineDTO {
    private int moduleNumber;
    private String moduleTitle;
    private int estimatedHours;
    private String textbookReference;
    @Builder.Default
    private List<String> topics = new ArrayList<>();
    @Builder.Default
    private List<String> subtopics = new ArrayList<>();
    private String associatedDocumentId;
}
