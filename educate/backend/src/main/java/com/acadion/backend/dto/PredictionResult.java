package com.acadion.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PredictionResult {

    private Double predictedScore;

    private String riskLevel;

    private String model;

    private String message;
}
