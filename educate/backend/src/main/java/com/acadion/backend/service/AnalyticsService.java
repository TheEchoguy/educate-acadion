package com.acadion.backend.service;

import com.acadion.backend.entity.QuestionPaper;
import com.acadion.backend.entity.StudentResponse;
import com.acadion.backend.repository.StudentResponseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private final QuestionPaperService
            questionPaperService;

    private final StudentResponseRepository
            studentResponseRepository;

    public Map<String, Object> paperAnalytics(
            String paperId
    ) {

        QuestionPaper paper =
                questionPaperService
                        .getPaper(paperId);

        List<StudentResponse> responses =

                studentResponseRepository
                        .findByPaperId(paperId);

        Map<String, List<Double>>
                questionScores =
                new HashMap<>();

        Map<String, List<Double>>
                topicScores =
                new HashMap<>();

        for (
                StudentResponse response
                        : responses
        ) {

            for (
                    StudentResponse.ResponseAnswer answer
                            : response.getResponses()
            ) {

                questionScores

                        .computeIfAbsent(
                                answer.getQuestionId(),
                                key -> new ArrayList<>()
                        )

                        .add(
                                percent(
                                        answer.getMarksObtained(),
                                        answer.getMaxMarks()
                                )
                        );

                topicScores

                        .computeIfAbsent(
                                answer.getTopic(),
                                key -> new ArrayList<>()
                        )

                        .add(
                                percent(
                                        answer.getMarksObtained(),
                                        answer.getMaxMarks()
                                )
                        );
            }
        }

        Map<String, Object> result =
                new LinkedHashMap<>();

        result.put(
                "paperId",
                paper.getPaperId()
        );

        result.put(
                "subject",
                paper.getSubject()
        );

        result.put(
                "responseCount",
                responses.size()
        );

        result.put(

                "classAverage",

                round(

                        responses.stream()

                                .filter(response ->

                                        response.getMaxMarks() != null
                                                &&
                                                response.getMaxMarks() > 0
                                )

                                .mapToDouble(response ->

                                        (
                                                response.getTotalMarks()
                                                        /
                                                        response.getMaxMarks()
                                        ) * 100.0
                                )

                                .average()

                                .orElse(0.0)
                )
        );

        result.put(
                "questionAnalysis",
                analysis(questionScores)
        );

        result.put(
                "topicAnalysis",
                analysis(topicScores)
        );

        return result;
    }

    public Map<String, Object> studentTrend(
            String usn
    ) {

        List<StudentResponse> responses =

                studentResponseRepository
                        .findByUsnOrderBySubmittedAtAsc(
                                usn
                        );

        List<Map<String, Object>> trend =

                responses.stream()

                        .sorted(
                                Comparator.comparing(
                                        StudentResponse::getSubmittedAt
                                )
                        )

                        .map(response -> {

                            Map<String, Object> item =
                                    new LinkedHashMap<>();

                            item.put(
                                    "paperId",
                                    response.getPaperId()
                            );

                            item.put(
                                    "submittedAt",
                                    response.getSubmittedAt()
                            );

                            item.put(

                                    "percentage",

                                    response.getMaxMarks() == null
                                            ||
                                            response.getMaxMarks() == 0

                                            ? 0.0

                                            : round(
                                            (
                                                    response.getTotalMarks()
                                                            /
                                                            response.getMaxMarks()
                                            ) * 100.0
                                    )
                            );

                            item.put(
                                    "predictedScore",
                                    response.getPredictedScore()
                            );

                            item.put(
                                    "riskLevel",
                                    response.getRiskLevel()
                            );

                            return item;
                        })

                        .toList();

        Map<String, Object> result =
                new LinkedHashMap<>();

        result.put(
                "usn",
                usn
        );

        result.put(
                "trend",
                trend
        );

        result.put(
                "direction",
                direction(trend)
        );

        return result;
    }

    private List<Map<String, Object>> analysis(
            Map<String, List<Double>> scores
    ) {

        return scores.entrySet()

                .stream()

                .map(entry -> {

                    double average =

                            entry.getValue()

                                    .stream()

                                    .mapToDouble(
                                            Double::doubleValue
                                    )

                                    .average()

                                    .orElse(0.0);

                    Map<String, Object> item =
                            new LinkedHashMap<>();

                    item.put(
                            "name",
                            entry.getKey()
                    );

                    item.put(
                            "averagePercentage",
                            round(average)
                    );

                    item.put(

                            "status",

                            average < 50.0

                                    ? "WEAK"

                                    : average < 70.0

                                    ? "MODERATE"

                                    : "STRONG"
                    );

                    return item;
                })

                .sorted(
                        Comparator.comparing(
                                item ->
                                        item.get("name")
                                                .toString()
                        )
                )

                .toList();
    }

    private String direction(
            List<Map<String, Object>> trend
    ) {

        if (trend.size() < 2) {

            return "INSUFFICIENT_DATA";
        }

        double first =

                (Double)
                        trend.get(0)
                                .get("percentage");

        double last =

                (Double)
                        trend.get(
                                trend.size() - 1
                        ).get("percentage");

        if (last > first + 5.0) {

            return "IMPROVING";
        }

        if (last < first - 5.0) {

            return "DECLINING";
        }

        return "STABLE";
    }

    private double percent(
            Double marks,
            Double maxMarks
    ) {

        if (
                marks == null
                        ||
                        maxMarks == null
                        ||
                        maxMarks == 0
        ) {

            return 0.0;
        }

        return (
                marks / maxMarks
        ) * 100.0;
    }

    private double round(
            double value
    ) {

        return Math.round(
                value * 100.0
        ) / 100.0;
    }
}