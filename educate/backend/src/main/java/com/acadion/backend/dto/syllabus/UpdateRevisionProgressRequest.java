package com.acadion.backend.dto.syllabus;

import com.acadion.backend.entity.RevisionStatus;
import com.acadion.backend.entity.UnderstandingStatus;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateRevisionProgressRequest {

    private String topicId;

    private String publishedVersionId;

    private RevisionStatus revisionStatus;

    private UnderstandingStatus understandingStatus;

    private String personalNotes;
}
