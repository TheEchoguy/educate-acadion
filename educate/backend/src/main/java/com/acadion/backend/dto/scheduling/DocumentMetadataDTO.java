package com.acadion.backend.dto.scheduling;

import com.acadion.backend.entity.scheduling.AcademicDocumentType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentMetadataDTO {
    private String id;
    private String classroomId;
    private String subjectCode;
    private AcademicDocumentType documentType;
    private Integer moduleNumber;
    private String moduleTitle;
    private String originalFileName;
    private String contentType;
    private long fileSize;
    private String contentHash;
    private String processingStatus;
    private String extractedSummary;
    private boolean published;
    private LocalDateTime publishedAt;
    private LocalDateTime uploadedAt;
    private String uploadedBy;
    @Builder.Default
    private int version = 1;
    private String formattedFileSize;

    public String getOriginalFileName() {
        return originalFileName;
    }

    public void setOriginalFileName(String originalFileName) {
        this.originalFileName = originalFileName;
    }

    public String getOriginalFilename() {
        return originalFileName;
    }

    public void setOriginalFilename(String originalFilename) {
        this.originalFileName = originalFilename;
    }

    public String getExtractionStatus() {
        return processingStatus;
    }

    public void setExtractionStatus(String extractionStatus) {
        this.processingStatus = extractionStatus;
    }
}
