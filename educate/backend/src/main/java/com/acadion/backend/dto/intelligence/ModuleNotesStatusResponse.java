package com.acadion.backend.dto.intelligence;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ModuleNotesStatusResponse {
    private String classroomId;
    private int totalIndexedModules;
    private int totalChunks;
    private Map<String, ModuleInfo> modules;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ModuleInfo {
        private int moduleNumber;
        private boolean indexed;
        private String fileName;
        private int chunksCount;
        private String indexedAt;

        @JsonProperty("chunks")
        public int getChunks() {
            return chunksCount;
        }

        @JsonProperty("chunkCount")
        public int getChunkCount() {
            return chunksCount;
        }

        @JsonProperty("count")
        public int getCount() {
            return chunksCount;
        }
    }
}
