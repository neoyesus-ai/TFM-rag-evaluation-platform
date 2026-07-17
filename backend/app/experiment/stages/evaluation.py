import json
import re
import statistics
import time
import unicodedata
from collections import Counter
from typing import Any

from app.experiment.context import ExperimentContext
from app.experiment.stages.base import ExperimentStage


def normalize_text(value: str | None) -> str:
    if not value:
        return ""

    normalized = unicodedata.normalize(
        "NFKD",
        value.lower(),
    )

    without_accents = "".join(
        character
        for character in normalized
        if not unicodedata.combining(character)
    )

    without_punctuation = re.sub(
        r"[^a-z0-9\s]",
        " ",
        without_accents,
    )

    return " ".join(
        without_punctuation.split()
    )


def tokenize(value: str | None) -> list[str]:
    normalized = normalize_text(value)

    if not normalized:
        return []

    return normalized.split()


def exact_match(
    generated_answer: str,
    expected_answer: str | None,
) -> float | None:
    if not expected_answer:
        return None

    return float(
        normalize_text(generated_answer)
        == normalize_text(expected_answer)
    )


def token_precision_recall_f1(
    prediction: str | None,
    reference: str | None,
) -> tuple[float, float, float]:
    prediction_tokens = tokenize(prediction)
    reference_tokens = tokenize(reference)

    if not prediction_tokens or not reference_tokens:
        return 0.0, 0.0, 0.0

    prediction_counter = Counter(prediction_tokens)
    reference_counter = Counter(reference_tokens)

    common_tokens = sum(
        (
            prediction_counter
            & reference_counter
        ).values()
    )

    precision = common_tokens / len(
        prediction_tokens
    )

    recall = common_tokens / len(
        reference_tokens
    )

    if precision + recall == 0:
        f1 = 0.0
    else:
        f1 = (
            2
            * precision
            * recall
            / (precision + recall)
        )

    return precision, recall, f1


def calculate_answer_relevancy(
    question: str,
    generated_answer: str,
) -> float:
    _, _, score = token_precision_recall_f1(
        prediction=generated_answer,
        reference=question,
    )

    return score


def calculate_groundedness_proxy(
    generated_answer: str,
    retrieved_contexts: list[dict[str, Any]],
) -> float:
    generated_tokens = tokenize(
        generated_answer
    )

    if not generated_tokens:
        return 0.0

    context_tokens: set[str] = set()

    for context in retrieved_contexts:
        context_tokens.update(
            tokenize(
                str(context.get("text") or "")
            )
        )

    if not context_tokens:
        return 0.0

    supported_tokens = sum(
        token in context_tokens
        for token in generated_tokens
    )

    return supported_tokens / len(
        generated_tokens
    )


def calculate_context_recall(
    expected_contexts: list[str] | None,
    retrieved_contexts: list[dict[str, Any]],
) -> float | None:
    if not expected_contexts:
        return None

    retrieved_texts = [
        str(context.get("text") or "")
        for context in retrieved_contexts
    ]

    if not retrieved_texts:
        return 0.0

    expected_scores: list[float] = []

    for expected_context in expected_contexts:
        best_recall = 0.0

        for retrieved_text in retrieved_texts:
            _, recall, _ = (
                token_precision_recall_f1(
                    prediction=retrieved_text,
                    reference=expected_context,
                )
            )

            best_recall = max(
                best_recall,
                recall,
            )

        expected_scores.append(best_recall)

    return statistics.mean(
        expected_scores
    )


def calculate_context_precision(
    expected_answer: str | None,
    expected_contexts: list[str] | None,
    retrieved_contexts: list[dict[str, Any]],
) -> float | None:
    references = list(
        expected_contexts or []
    )

    if expected_answer:
        references.append(expected_answer)

    if not references:
        return None

    if not retrieved_contexts:
        return 0.0

    relevant_context_count = 0

    for context in retrieved_contexts:
        context_text = str(
            context.get("text") or ""
        )

        best_f1 = 0.0

        for reference in references:
            _, _, f1 = (
                token_precision_recall_f1(
                    prediction=context_text,
                    reference=reference,
                )
            )

            best_f1 = max(
                best_f1,
                f1,
            )

        if best_f1 >= 0.10:
            relevant_context_count += 1

    return (
        relevant_context_count
        / len(retrieved_contexts)
    )


def mean_available(
    values: list[float | None],
) -> float:
    available = [
        value
        for value in values
        if value is not None
    ]

    if not available:
        return 0.0

    return statistics.mean(available)


class EvaluationStage(ExperimentStage):
    name = "evaluation"

    async def execute(
        self,
        context: ExperimentContext,
    ) -> None:
        if not context.generation_results:
            raise ValueError(
                "No existen respuestas generadas "
                "para evaluar."
            )

        evaluation_started = (
            time.perf_counter()
        )

        evaluation_results: list[
            dict[str, Any]
        ] = []

        exact_match_scores: list[float] = []
        answer_precision_scores: list[
            float
        ] = []
        answer_recall_scores: list[
            float
        ] = []
        answer_f1_scores: list[float] = []
        answer_relevancy_scores: list[
            float
        ] = []
        groundedness_scores: list[float] = []
        context_precision_scores: list[
            float
        ] = []
        context_recall_scores: list[
            float
        ] = []
        overall_scores: list[float] = []

        for result in context.generation_results:
            generated_answer = str(
                result.get(
                    "generated_answer"
                )
                or ""
            )

            expected_answer = result.get(
                "expected_answer"
            )

            expected_contexts = result.get(
                "expected_contexts"
            )

            retrieved_contexts = list(
                result.get(
                    "retrieved_contexts"
                )
                or []
            )

            current_exact_match = (
                exact_match(
                    generated_answer=(
                        generated_answer
                    ),
                    expected_answer=(
                        expected_answer
                    ),
                )
            )

            (
                answer_precision,
                answer_recall,
                answer_f1,
            ) = token_precision_recall_f1(
                prediction=generated_answer,
                reference=expected_answer,
            )

            answer_relevancy = (
                calculate_answer_relevancy(
                    question=str(
                        result.get(
                            "question"
                        )
                        or ""
                    ),
                    generated_answer=(
                        generated_answer
                    ),
                )
            )

            groundedness_proxy = (
                calculate_groundedness_proxy(
                    generated_answer=(
                        generated_answer
                    ),
                    retrieved_contexts=(
                        retrieved_contexts
                    ),
                )
            )

            context_precision = (
                calculate_context_precision(
                    expected_answer=(
                        expected_answer
                    ),
                    expected_contexts=(
                        expected_contexts
                    ),
                    retrieved_contexts=(
                        retrieved_contexts
                    ),
                )
            )

            context_recall = (
                calculate_context_recall(
                    expected_contexts=(
                        expected_contexts
                    ),
                    retrieved_contexts=(
                        retrieved_contexts
                    ),
                )
            )

            overall_score = mean_available(
                [
                    current_exact_match,
                    answer_f1
                    if expected_answer
                    else None,
                    answer_relevancy,
                    groundedness_proxy,
                    context_precision,
                    context_recall,
                ]
            )

            if current_exact_match is not None:
                exact_match_scores.append(
                    current_exact_match
                )

            if expected_answer:
                answer_precision_scores.append(
                    answer_precision
                )
                answer_recall_scores.append(
                    answer_recall
                )
                answer_f1_scores.append(
                    answer_f1
                )

            answer_relevancy_scores.append(
                answer_relevancy
            )

            groundedness_scores.append(
                groundedness_proxy
            )

            if context_precision is not None:
                context_precision_scores.append(
                    context_precision
                )

            if context_recall is not None:
                context_recall_scores.append(
                    context_recall
                )

            overall_scores.append(
                overall_score
            )

            evaluation_results.append(
                {
                    "question_id": result[
                        "question_id"
                    ],
                    "order_index": result[
                        "order_index"
                    ],
                    "question": result[
                        "question"
                    ],
                    "expected_answer": (
                        expected_answer
                    ),
                    "generated_answer": (
                        generated_answer
                    ),
                    "expected_contexts": (
                        expected_contexts
                    ),
                    "retrieved_contexts": (
                        retrieved_contexts
                    ),
                    "metrics": {
                        "exact_match": (
                            current_exact_match
                        ),
                        "answer_token_precision": (
                            answer_precision
                            if expected_answer
                            else None
                        ),
                        "answer_token_recall": (
                            answer_recall
                            if expected_answer
                            else None
                        ),
                        "answer_token_f1": (
                            answer_f1
                            if expected_answer
                            else None
                        ),
                        "answer_relevancy_proxy": (
                            answer_relevancy
                        ),
                        "groundedness_proxy": (
                            groundedness_proxy
                        ),
                        "context_precision_proxy": (
                            context_precision
                        ),
                        "context_recall_proxy": (
                            context_recall
                        ),
                        "overall_score": (
                            overall_score
                        ),
                    },
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

        summary = {
            "evaluator": (
                "deterministic-lexical-v1"
            ),
            "question_count": len(
                evaluation_results
            ),
            "evaluation_duration_ms": (
                evaluation_duration_ms
            ),
            "mean_exact_match": (
                statistics.mean(
                    exact_match_scores
                )
                if exact_match_scores
                else None
            ),
            "mean_answer_token_precision": (
                statistics.mean(
                    answer_precision_scores
                )
                if answer_precision_scores
                else None
            ),
            "mean_answer_token_recall": (
                statistics.mean(
                    answer_recall_scores
                )
                if answer_recall_scores
                else None
            ),
            "mean_answer_token_f1": (
                statistics.mean(
                    answer_f1_scores
                )
                if answer_f1_scores
                else None
            ),
            "mean_answer_relevancy_proxy": (
                statistics.mean(
                    answer_relevancy_scores
                )
                if answer_relevancy_scores
                else 0
            ),
            "mean_groundedness_proxy": (
                statistics.mean(
                    groundedness_scores
                )
                if groundedness_scores
                else 0
            ),
            "mean_context_precision_proxy": (
                statistics.mean(
                    context_precision_scores
                )
                if context_precision_scores
                else None
            ),
            "mean_context_recall_proxy": (
                statistics.mean(
                    context_recall_scores
                )
                if context_recall_scores
                else None
            ),
            "mean_overall_score": (
                statistics.mean(
                    overall_scores
                )
                if overall_scores
                else 0
            ),
        }

        leaderboard = sorted(
            [
                {
                    "question_id": item[
                        "question_id"
                    ],
                    "question": item[
                        "question"
                    ],
                    "overall_score": item[
                        "metrics"
                    ]["overall_score"],
                }
                for item in evaluation_results
            ],
            key=lambda item: item[
                "overall_score"
            ],
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
        ] = "deterministic-lexical-v1"

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

        context.metrics[
            "evaluation_exact_match"
        ] = float(
            summary["mean_exact_match"]
            or 0
        )

        context.metrics[
            "evaluation_answer_token_precision"
        ] = float(
            summary[
                "mean_answer_token_precision"
            ]
            or 0
        )

        context.metrics[
            "evaluation_answer_token_recall"
        ] = float(
            summary[
                "mean_answer_token_recall"
            ]
            or 0
        )

        context.metrics[
            "evaluation_answer_token_f1"
        ] = float(
            summary["mean_answer_token_f1"]
            or 0
        )

        context.metrics[
            "evaluation_answer_relevancy_proxy"
        ] = float(
            summary[
                "mean_answer_relevancy_proxy"
            ]
        )

        context.metrics[
            "evaluation_groundedness_proxy"
        ] = float(
            summary[
                "mean_groundedness_proxy"
            ]
        )

        context.metrics[
            "evaluation_context_precision_proxy"
        ] = float(
            summary[
                "mean_context_precision_proxy"
            ]
            or 0
        )

        context.metrics[
            "evaluation_context_recall_proxy"
        ] = float(
            summary[
                "mean_context_recall_proxy"
            ]
            or 0
        )

        context.metrics[
            "evaluation_overall_score"
        ] = float(
            summary["mean_overall_score"]
        )
