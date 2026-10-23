package com.acadion.backend.dto.intelligence;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PublishStudentMarksRequest {
    private String usn;
    @Builder.Default
    private int iaNumber = 1;
    @JsonProperty("isPublished")
    @Builder.Default
    private boolean isPublished = true;

    @JsonProperty("published")
    public void setPublished(Boolean published) {
        if (published != null) {
            this.isPublished = published;
        }
    }
}
