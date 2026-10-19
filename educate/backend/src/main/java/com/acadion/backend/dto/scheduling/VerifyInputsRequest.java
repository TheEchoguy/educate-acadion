package com.acadion.backend.dto.scheduling;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VerifyInputsRequest {

    private boolean verifyAll;
    private List<String> verifiedSlotIds;
    private List<String> verifiedEventIds;
    private List<String> verifiedMilestoneIds;
    private String teacherNotes;
}
