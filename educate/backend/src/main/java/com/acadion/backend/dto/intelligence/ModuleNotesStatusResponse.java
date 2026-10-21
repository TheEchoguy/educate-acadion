package com.acadion.backend.dto.intelligence;

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
    }
}
