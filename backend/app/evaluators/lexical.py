import re
import statistics
import unicodedata
from collections import Counter
from typing import Any

from .base import Evaluator


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

    return " ".join(without_punctuation.split())


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
        (prediction_counter & reference_counter).values()
    )

    precision = common_tokens / len(prediction_tokens)
    recall = common_tokens / len(reference_tokens)

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
    generated_tokens = tokenize(generated_answer)

    if not generated_tokens:
        return 0.0

    context_tokens: set[str] = set()

    for context in retrieved_contexts:
        context_tokens.update(
            tokenize(str(context.get("text") or ""))
        )

    if not context_tokens:
        return 0.0

    supported_tokens = sum(
        token in context_tokens
        for token in generated_tokens
    )

    return supported_tokens / len(generated_tokens)


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
            _, recall, _ = token_precision_recall_f1(
                prediction=retrieved_text,
                reference=expected_context,
            )

            best_recall = max(best_recall, recall)

        expected_scores.append(best_recall)

    return statistics.mean(expected_scores)


def calculate_context_precision(
    expected_answer: str | None,
    expected_contexts: list[str] | None,
    retrieved_contexts: list[dict[str, Any]],
) -> float | None:
    references = list(expected_contexts or [])

    if expected_answer:
        references.append(expected_answer)

    if not references:
        return None

    if not retrieved_contexts:
        return 0.0

    relevant_context_count = 0

    for context in retrieved_contexts:
        context_text = str(context.get("text") or "")

        best_f1 = 0.0

        for reference in references:
            _, _, f1 = token_precision_recall_f1(
                prediction=context_text,
                reference=reference,
            )

            best_f1 = max(best_f1, f1)

        if best_f1 >= 0.10:
            relevant_context_count += 1

    return relevant_context_count / len(retrieved_contexts)


class LexicalEvaluator(Evaluator):

    async def evaluate(
        self,
        result: dict[str, Any],
    ) -> dict[str, Any]:

        generated_answer = str(
            result.get("generated_answer") or ""
        )

        expected_answer = result.get(
            "expected_answer"
        )

        expected_contexts = result.get(
            "expected_contexts"
        )

        retrieved_contexts = list(
            result.get("retrieved_contexts") or []
        )

        exact = exact_match(
            generated_answer,
            expected_answer,
        )

        precision, recall, f1 = (
            token_precision_recall_f1(
                generated_answer,
                expected_answer,
            )
        )

        return {
            "exact_match": exact,
            "answer_precision": precision,
            "answer_recall": recall,
            "answer_f1": f1,
            "answer_relevancy": calculate_answer_relevancy(
                result.get("question", ""),
                generated_answer,
            ),
            "groundedness_proxy":
                calculate_groundedness_proxy(
                    generated_answer,
                    retrieved_contexts,
                ),
            "context_precision":
                calculate_context_precision(
                    expected_answer,
                    expected_contexts,
                    retrieved_contexts,
                ),
            "context_recall":
                calculate_context_recall(
                    expected_contexts,
                    retrieved_contexts,
                ),
        }
