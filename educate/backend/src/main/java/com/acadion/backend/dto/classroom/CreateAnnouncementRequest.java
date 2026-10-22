package com.acadion.backend.dto.classroom;

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
public class CreateAnnouncementRequest {
    private String title;
    private String message;
    private String category;
    private boolean isPinned;
    @Builder.Default
    private List<ExistingAttachmentDto> existingAttachments = new ArrayList<>();

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ExistingAttachmentDto {
        private String fileName;
        private String fileUrl;
        private String fileType;
        private Long fileSize;
    }
}
