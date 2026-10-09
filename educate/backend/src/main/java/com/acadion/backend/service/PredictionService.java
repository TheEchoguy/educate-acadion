package com.acadion.backend.service;

import com.acadion.backend.dto.PredictionRequest;
import com.acadion.backend.dto.PredictionResult;
import com.acadion.backend.entity.StudentResponse;
import com.acadion.backend.repository.StudentResponseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class PredictionService {

    private final StudentResponseRepository
            studentResponseRepository;

    public PredictionResult predict(
            PredictionRequest request
    ) {

        double topicAverage =
                average(
                        request.getTopicScores()
                );

        double previousAverage =
                valueOrDefault(
                        request.getPreviousInternalAverage(),
                        topicAverage
                );

        double attendance =
                valueOrDefault(
                        request.getAttendance(),
                        75.0
                );

        double studyHours =
                valueOrDefault(
                        request.getStudyHours(),
                        3.0
                );

        double predictedScore =

                (topicAverage * 0.45)

                        + (previousAverage * 0.30)

                        + (attendance * 0.15)

                        + (
                                Math.min(
                                        studyHours,
                                        10.0
                                )
                                        * 10.0
                                        * 0.10
                        );

        predictedScore =
                clamp(
                        predictedScore,
                        0.0,
                        100.0
                );

        return PredictionResult.builder()

                .predictedScore(
                        round(predictedScore)
                )

                .riskLevel(
                        riskLevel(predictedScore)
                )

                .model(
                        "RuleBased-Regressor-ReadyForMLService"
                )

                .message(
                        "Prediction uses topic marks, previous internals, attendance, and study hours. Replace this service with FastAPI/scikit-learn when a trained .pkl model is available."
                )

                .build();
    }

    public PredictionResult predictFromResponses(
            StudentResponse response
    ) {
        double total = response.getTotalMarks() != null ? response.getTotalMarks() : 0.0;
        double max = response.getMaxMarks() != null && response.getMaxMarks() > 0 ? response.getMaxMarks() : 40.0;
        double currentPercentage = Math.min(100.0, Math.max(0.0, (total / max) * 100.0));

        double predictedScore = round(currentPercentage);

        return PredictionResult.builder()
                .predictedScore(predictedScore)
                .riskLevel(riskLevel(predictedScore))
                .model("Performance-Evaluator-Engine")
                .message("Prediction calculated directly from student examination response score.")
                .build();
    }

    private double average(
            Map<String, Double> scores
    ) {

        if (
                scores == null
                        || scores.isEmpty()
        ) {

            return 60.0;
        }

        return scores.values()

                .stream()

                .filter(value ->
                        value != null
                )

                .mapToDouble(
                        Double::doubleValue
                )

                .average()

                .orElse(60.0);
    }

    private double valueOrDefault(
            Double value,
            double defaultValue
    ) {

        return value == null
                ? defaultValue
                : value;
    }

    private double clamp(
            double value,
            double min,
            double max
    ) {

        return Math.max(
                min,
                Math.min(max, value)
        );
    }

    private double round(
            double value
    ) {

        return Math.round(
                value * 100.0
        ) / 100.0;
    }

    private String riskLevel(
            double score
    ) {

        if (score < 40.0) {

            return "HIGH_RISK";
        }

        if (score < 60.0) {

            return "NEEDS_ATTENTION";
        }

        return "ON_TRACK";
    }
}