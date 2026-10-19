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

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CitationSource {
        private Integer module;
        private Integer page;
        private String source;
        private String excerpt;
    }
}
