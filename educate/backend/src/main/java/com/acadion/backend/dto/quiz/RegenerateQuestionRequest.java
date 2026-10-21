package com.acadion.backend.dto.quiz;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RegenerateQuestionRequest {

    private String subject;
    private String topic;
    private String difficulty;
    private String notesContext;
    private String existingQuestionId;
    private String existingQuestionText;
    private Boolean mock;
}
