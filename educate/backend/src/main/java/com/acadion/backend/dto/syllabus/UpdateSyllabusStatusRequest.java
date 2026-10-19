package com.acadion.backend.dto.syllabus;

import com.acadion.backend.entity.SyllabusStatus;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateSyllabusStatusRequest {

    @NotNull(message = "Status is required")
    private SyllabusStatus status;
}
