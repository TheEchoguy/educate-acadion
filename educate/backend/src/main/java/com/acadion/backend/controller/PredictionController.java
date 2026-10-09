package com.acadion.backend.controller;

import com.acadion.backend.dto.PredictionRequest;
import com.acadion.backend.dto.PredictionResult;
import com.acadion.backend.service.PredictionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/predictions")
@RequiredArgsConstructor
public class PredictionController {

    private final PredictionService predictionService;

    @PostMapping("/score")
    public PredictionResult predictScore(@RequestBody PredictionRequest request) {

        return predictionService.predict(request);
    }
}
