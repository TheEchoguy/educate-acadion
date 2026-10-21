package com.acadion.backend.dto.intelligence;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RagTutorChatRequest {
    private String classroomId;
    private String query;
    private String focusTopic;
    private Integer focusModule;
}
