package com.acadion.backend.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "classroom_announcements")
public class ClassroomAnnouncement {

    @Id
    private String id;

    @Indexed
    private String classroomId;

    private String teacherId;

    private String authorName;

    private String title;

    private String message;

    @Builder.Default
    private String category = "GENERAL"; // "GENERAL", "ASSIGNMENT", "NOTES", "EXAM_ALERT"

    @Builder.Default
    private List<AnnouncementAttachment> attachedResources = new ArrayList<>();

    @Builder.Default
    private Instant createdAt = Instant.now();

    @Builder.Default
    private boolean isPinned = false;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AnnouncementAttachment {
        private String id;
        private String fileName;
        private String fileUrl;
        private String fileType;
        private Long fileSize;

        @JsonIgnore
        private byte[] fileData;
    }
}
