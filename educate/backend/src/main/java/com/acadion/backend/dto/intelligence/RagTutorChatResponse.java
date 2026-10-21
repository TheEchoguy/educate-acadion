package com.acadion.backend.dto.intelligence;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RagTutorChatResponse {
    private String answer;
    private List<CitationSource> sources;
    private String recommendedRevisionTip;
    private Integer focusModule;
    private String focusTopic;
    private String sourceMode;
    private String generationMode;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CitationSource {
        private Integer module;
        private Integer page;
        private Integer pageStart;
        private Integer pageEnd;
        private String section;
        private String source;
        private String excerpt;
        private String content;
        private String chunkId;
        private Double similarity;
    }
}
