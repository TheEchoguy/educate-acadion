package com.acadion.backend.entity.scheduling;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "academic_documents")
@CompoundIndex(name = "classroom_doc_type_idx", def = "{'classroomId': 1, 'documentType': 1, 'moduleNumber': 1}")
public class AcademicDocument {

    @Id
    private String id;

    @Indexed
    private String classroomId;

    private String subjectCode;

    private AcademicDocumentType documentType;

    private Integer moduleNumber; // 1 to 5 for MODULE_PDF, null otherwise

    private String moduleTitle;

    private String originalFileName;

    private String contentType;

    private long fileSize;

    private String contentHash; // SHA-256 for duplicate detection

    private byte[] fileData;

    @Builder.Default
    private String processingStatus = "EXTRACTED"; // UPLOADED, EXTRACTED, ERROR

    private String extractedSummary;

    private String errorMessage;

    @Builder.Default
    private boolean published = false;

    private LocalDateTime publishedAt;

    private LocalDateTime uploadedAt;

    @Builder.Default
    private int version = 1;

    private String uploadedBy; // Teacher email

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

    public String getProcessingStatus() {
        return processingStatus;
    }

    public void setProcessingStatus(String processingStatus) {
        this.processingStatus = processingStatus;
    }

    public String getExtractionStatus() {
        return processingStatus;
    }

    public void setExtractionStatus(String extractionStatus) {
        this.processingStatus = extractionStatus;
    }

    public int getVersion() {
        return version;
    }

    public void setVersion(int version) {
        this.version = version;
    }
}

