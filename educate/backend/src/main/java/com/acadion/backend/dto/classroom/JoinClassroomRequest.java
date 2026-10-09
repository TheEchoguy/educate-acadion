package com.acadion.backend.dto.classroom;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JoinClassroomRequest {

    @NotBlank(message = "Join code is required")
    private String joinCode;
}
