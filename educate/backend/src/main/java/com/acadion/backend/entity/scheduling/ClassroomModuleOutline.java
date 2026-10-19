package com.acadion.backend.entity.scheduling;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "classroom_module_outlines")
@CompoundIndex(name = "cls_mod_num_idx", def = "{'classroomId': 1, 'moduleNumber': 1}", unique = true)
public class ClassroomModuleOutline {

    @Id
    private String id;

    @Indexed
    private String classroomId;

    private int moduleNumber;

    private String moduleTitle;

    @Builder.Default
    private int estimatedHours = 8;

    private String textbookReference;

    @Builder.Default
    private List<String> topics = new ArrayList<>();

    @Builder.Default
    private List<String> subtopics = new ArrayList<>();

    private String associatedDocumentId;

    @Builder.Default
    private boolean approved = true;

    private LocalDateTime updatedAt;
}
