package com.acadion.backend.dto.syllabus;

import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReorderSyllabusRequest {

    @NotEmpty(message = "Ordered item IDs list cannot be empty")
    private List<String> orderedItemIds;
}
