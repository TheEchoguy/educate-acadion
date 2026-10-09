package com.acadion.backend.dto;

import lombok.Data;

import java.util.HashMap;
import java.util.Map;

@Data
public class PredictionRequest {

    private String usn;

    private String paperId;

    private Double previousInternalAverage;

    private Double attendance;

    private Double studyHours;

    private Map<String, Double> topicScores = new HashMap<>();
}
