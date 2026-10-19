package com.acadion.backend.dto.scheduling;

import com.acadion.backend.entity.scheduling.SessionStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RecordSessionOutcomeRequest {
    private SessionStatus outcome;
    private String teacherNotes;
    private String portionsCovered;
}
