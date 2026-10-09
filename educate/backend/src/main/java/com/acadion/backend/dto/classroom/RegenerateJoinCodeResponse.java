package com.acadion.backend.dto.classroom;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RegenerateJoinCodeResponse {

    private String classroomId;
    private String joinCode;
    private LocalDateTime joinCodeCreatedAt;
    private LocalDateTime joinCodeExpiresAt;
    private boolean joinCodeEnabled;
    private String message;
}
