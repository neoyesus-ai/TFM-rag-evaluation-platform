import json
import logging
import math
import statistics
import time
from typing import Any

from app.evaluators.lexical import LexicalEvaluator
from app.evaluators.ragas import RagasEvaluator
from app.experiment.context import ExperimentContext
from app.experiment.stages.base import ExperimentStage


logger = logging.getLogger(__name__)


def mean_available(
    values: list[float | None],
) -> float | None:
    """
    Calcula la media ignorando valores None, NaN e infinitos.
    """
    available: list[float] = []

    for value in values:
        if value is None:
            continue

        converted = float(value)

        if math.isfinite(converted):
            available.append(converted)

    if not available:
        return None

    return statistics.mean(available)


def calculate_overall_score(
    metrics: dict[str, float | None],
) -> float:
    """
    Calcula una puntuación global por muestra.

    Se priorizan las métricas semánticas de RAGAS cuando están
    disponibles. Cuando una métrica RAGAS no puede calcularse,
    se utiliza su equivalente léxico o proxy.
    """
    answer_relevancy = (
        metrics.get("ragas_answer_relevancy")
        if metrics.get("ragas_answer_relevancy")
        is not None
        else metrics.get("answer_relevancy")
    )

    groundedness = (
        metrics.get("ragas_faithfulness")
        if metrics.get("ragas_faithfulness")
        is not None
        else metrics.get("groundedness_proxy")
    )

    context_precision = (
        metrics.get("ragas_context_precision")
        if metrics.get("ragas_context_precision")
        is not None
        else metrics.get("context_precision")
    )

    context_recall = (
        metrics.get("ragas_context_recall")
        if metrics.get("ragas_context_recall")
        is not None
        else metrics.get("context_recall")
    )

    overall = mean_available(
        [
            metrics.get("exact_match"),
            metrics.get("answer_f1"),
            answer_relevancy,
            groundedness,
            context_precision,
            context_recall,
        ]
    )

    return overall if overall is not None else 0.0


class EvaluationStage(ExperimentStage):
    name = "evaluation"

    def __init__(self) -> None:
        self.lexical_evaluator = LexicalEvaluator()
        self.ragas_evaluator = RagasEvaluator()

    async def execute(
        self,
        context: ExperimentContext,
    ) -> None:
        if not context.generation_results:
            raise ValueError(
                "No existen respuestas generadas para evaluar."
            )

        evaluation_started = time.perf_counter()

        evaluation_results: list[
            dict[str, Any]
        ] = []

        metric_values: dict[
            str,
            list[float]
        ] = {}

        ragas_success_count = 0
        ragas_failure_count = 0

        for result in context.generation_results:
            lexical_metrics = (
                await self.lexical_evaluator.evaluate(
                    result
                )
            )

            try:
                ragas_metrics = (
                    await self.ragas_evaluator.evaluate(
                        result
                    )
                )

                ragas_success_count += 1

            except Exception as exc:
                ragas_failure_count += 1

                logger.exception(
                    "La evaluación RAGAS falló para "
                    "la pregunta %s: %s",
                    result.get("question_id"),
                    exc,
                )

                ragas_metrics = {
                    "ragas_faithfulness": None,
                    "ragas_answer_relevancy": None,
                    "ragas_context_precision": None,
                    "ragas_context_recall": None,
                }

            combined_metrics: dict[
                str,
                float | None
            ] = {
                **lexical_metrics,
                **ragas_metrics,
            }

            overall_score = calculate_overall_score(
                combined_metrics
            )

            combined_metrics[
                "overall_score"
            ] = overall_score

            # Conservamos los nombres públicos anteriores para no
            # romper consumidores, API, MLflow ni artefactos.
            public_metrics: dict[
                str,
                float | None
            ] = {
                "exact_match": combined_metrics.get(
                    "exact_match"
                ),
                "answer_token_precision": (
                    combined_metrics.get(
                        "answer_precision"
                    )
                ),
                "answer_token_recall": (
                    combined_metrics.get(
                        "answer_recall"
                    )
                ),
                "answer_token_f1": (
                    combined_metrics.get(
                        "answer_f1"
                    )
                ),
                "answer_relevancy_proxy": (
                    combined_metrics.get(
                        "answer_relevancy"
                    )
                ),
                "groundedness_proxy": (
                    combined_metrics.get(
                        "groundedness_proxy"
                    )
                ),
                "context_precision_proxy": (
                    combined_metrics.get(
                        "context_precision"
                    )
                ),
                "context_recall_proxy": (
                    combined_metrics.get(
                        "context_recall"
                    )
                ),
                "ragas_faithfulness": (
                    combined_metrics.get(
                        "ragas_faithfulness"
                    )
                ),
                "ragas_answer_relevancy": (
                    combined_metrics.get(
                        "ragas_answer_relevancy"
                    )
                ),
                "ragas_context_precision": (
                    combined_metrics.get(
                        "ragas_context_precision"
                    )
                ),
                "ragas_context_recall": (
                    combined_metrics.get(
                        "ragas_context_recall"
                    )
                ),
                "overall_score": overall_score,
            }

            for metric_name, metric_value in (
                public_metrics.items()
            ):
                if metric_value is None:
                    continue

                numeric_value = float(
                    metric_value
                )

                if not math.isfinite(
                    numeric_value
                ):
                    continue

                metric_values.setdefault(
                    metric_name,
                    [],
                ).append(numeric_value)

            evaluation_results.append(
                {
                    "question_id": result.get(
                        "question_id"
                    ),
                    "order_index": result.get(
                        "order_index"
                    ),
                    "question": result.get(
                        "question"
                    ),
                    "expected_answer": result.get(
                        "expected_answer"
                    ),
                    "generated_answer": result.get(
                        "generated_answer"
                    ),
                    "expected_contexts": result.get(
                        "expected_contexts"
                    ),
                    "retrieved_contexts": result.get(
                        "retrieved_contexts"
                    )
                    or [],
                    "metrics": public_metrics,
                    "generation": {
                        "provider": result.get(
                            "provider"
                        ),
                        "model": result.get(
                            "model"
                        ),
                        "latency_ms": result.get(
                            "latency_ms"
                        ),
                        "usage": result.get(
                            "usage"
                        ),
                    },
                }
            )

        evaluation_duration_ms = int(
            (
                time.perf_counter()
                - evaluation_started
            )
            * 1000
        )

        evaluation_directory = (
            context.working_directory
            / "evaluation"
        )

        evaluation_directory.mkdir(
            parents=True,
            exist_ok=True,
        )

        results_path = (
            evaluation_directory
            / "evaluation-results.json"
        )

        summary_path = (
            evaluation_directory
            / "evaluation-summary.json"
        )

        leaderboard_path = (
            evaluation_directory
            / "leaderboard.json"
        )

        def metric_mean(
            metric_name: str,
        ) -> float | None:
            values = metric_values.get(
                metric_name,
                [],
            )

            if not values:
                return None

            return statistics.mean(values)

        summary: dict[str, Any] = {
            "evaluator": (
                "lexical-v1+ragas-0.3.9"
            ),
            "question_count": len(
                evaluation_results
            ),
            "evaluation_duration_ms": (
                evaluation_duration_ms
            ),
            "ragas_success_count": (
                ragas_success_count
            ),
            "ragas_failure_count": (
                ragas_failure_count
            ),
            "mean_exact_match": metric_mean(
                "exact_match"
            ),
            "mean_answer_token_precision": (
                metric_mean(
                    "answer_token_precision"
                )
            ),
            "mean_answer_token_recall": (
                metric_mean(
                    "answer_token_recall"
                )
            ),
            "mean_answer_token_f1": metric_mean(
                "answer_token_f1"
            ),
            "mean_answer_relevancy_proxy": (
                metric_mean(
                    "answer_relevancy_proxy"
                )
            ),
            "mean_groundedness_proxy": (
                metric_mean(
                    "groundedness_proxy"
                )
            ),
            "mean_context_precision_proxy": (
                metric_mean(
                    "context_precision_proxy"
                )
            ),
            "mean_context_recall_proxy": (
                metric_mean(
                    "context_recall_proxy"
                )
            ),
            "mean_ragas_faithfulness": (
                metric_mean(
                    "ragas_faithfulness"
                )
            ),
            "mean_ragas_answer_relevancy": (
                metric_mean(
                    "ragas_answer_relevancy"
                )
            ),
            "mean_ragas_context_precision": (
                metric_mean(
                    "ragas_context_precision"
                )
            ),
            "mean_ragas_context_recall": (
                metric_mean(
                    "ragas_context_recall"
                )
            ),
            "mean_overall_score": (
                metric_mean(
                    "overall_score"
                )
                or 0.0
            ),
        }

        leaderboard = sorted(
            [
                {
                    "question_id": item.get(
                        "question_id"
                    ),
                    "question": item.get(
                        "question"
                    ),
                    "overall_score": (
                        item["metrics"][
                            "overall_score"
                        ]
                    ),
                }
                for item in evaluation_results
            ],
            key=lambda item: float(
                item["overall_score"]
            ),
            reverse=True,
        )

        results_path.write_text(
            json.dumps(
                evaluation_results,
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

        summary_path.write_text(
            json.dumps(
                summary,
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

        leaderboard_path.write_text(
            json.dumps(
                leaderboard,
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

        context.evaluation_results = (
            evaluation_results
        )

        context.metadata[
            "evaluation_evaluator"
        ] = "lexical-v1+ragas-0.3.9"

        context.metadata[
            "ragas_success_count"
        ] = ragas_success_count

        context.metadata[
            "ragas_failure_count"
        ] = ragas_failure_count

        context.artifacts[
            "evaluation"
        ] = evaluation_directory

        context.metrics[
            "evaluation_question_count"
        ] = float(
            len(evaluation_results)
        )

        context.metrics[
            "evaluation_duration_ms"
        ] = float(
            evaluation_duration_ms
        )

        summary_to_context = {
            "evaluation_exact_match": (
                "mean_exact_match"
            ),
            "evaluation_answer_token_precision": (
                "mean_answer_token_precision"
            ),
            "evaluation_answer_token_recall": (
                "mean_answer_token_recall"
            ),
            "evaluation_answer_token_f1": (
                "mean_answer_token_f1"
            ),
            "evaluation_answer_relevancy_proxy": (
                "mean_answer_relevancy_proxy"
            ),
            "evaluation_groundedness_proxy": (
                "mean_groundedness_proxy"
            ),
            "evaluation_context_precision_proxy": (
                "mean_context_precision_proxy"
            ),
            "evaluation_context_recall_proxy": (
                "mean_context_recall_proxy"
            ),
            "evaluation_ragas_faithfulness": (
                "mean_ragas_faithfulness"
            ),
            "evaluation_ragas_answer_relevancy": (
                "mean_ragas_answer_relevancy"
            ),
            "evaluation_ragas_context_precision": (
                "mean_ragas_context_precision"
            ),
            "evaluation_ragas_context_recall": (
                "mean_ragas_context_recall"
            ),
            "evaluation_overall_score": (
                "mean_overall_score"
            ),
        }

        for (
            context_metric_name,
            summary_metric_name,
        ) in summary_to_context.items():
            context.metrics[
                context_metric_name
            ] = float(
                summary.get(
                    summary_metric_name
                )
                or 0.0
            )

        context.metrics[
            "evaluation_ragas_success_count"
        ] = float(
            ragas_success_count
        )

        context.metrics[
            "evaluation_ragas_failure_count"
        ] = float(
            ragas_failure_count
        )
