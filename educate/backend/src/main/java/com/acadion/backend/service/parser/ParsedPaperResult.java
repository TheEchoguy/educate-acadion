package com.acadion.backend.service.parser;

import com.acadion.backend.entity.QuestionPaper;
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
public class ParsedPaperResult {

    @Builder.Default
    private List<QuestionPaper.Question> questions = new ArrayList<>();

    @Builder.Default
    private ParsedMetadata metadata = new ParsedMetadata();

    @Builder.Default
    private List<String> warnings = new ArrayList<>();
}
