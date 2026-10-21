package com.acadion.backend.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "ia_question_blueprints")
@CompoundIndex(def = "{'classroomId': 1, 'iaNumber': 1}", unique = true)
public class IaQuestionBlueprint {

    @Id
    private String id;

    @Indexed
    private String classroomId;

    private int iaNumber; // 1, 2, or 3

    private String examDate;

    @Builder.Default
    private double maxMarks = 40.0;

    private String rawPaperUrl;

    @Builder.Default
    private List<IaSubQuestionItem> questions = new ArrayList<>();

    @Builder.Default
    private boolean confirmed = false;

    @Builder.Default
    private boolean isLocked = false;

    @Builder.Default
    private Instant updatedAt = Instant.now();
}
