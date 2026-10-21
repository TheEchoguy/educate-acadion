package com.acadion.backend.dto.quiz;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GenerateQuizRequest {

    private String subject;
    private String topic;

    // TOPIC, NOTES, TOPIC_NOTES
    @Builder.Default
    private String mode = "TOPIC";

    private String notesText;

    @Builder.Default
    private Integer questionCount = 10;

    // EASY, MEDIUM, HARD
    @Builder.Default
    private String difficulty = "MEDIUM";

    @Builder.Default
    private String semester = "5th Sem";

    @Builder.Default
    private Double marksPerQuestion = 1.0;

    @Builder.Default
    private Boolean includeExplanations = true;

    // Optional teacher email for draft association
    private String createdBy;

    // For offline/testing mock verification without external API
    private Boolean mock;
}
