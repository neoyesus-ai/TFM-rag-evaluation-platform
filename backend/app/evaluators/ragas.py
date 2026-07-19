import math
from typing import Any

from langchain_openai import ChatOpenAI
from ragas import aevaluate
from ragas.dataset_schema import EvaluationDataset
from ragas.llms import LangchainLLMWrapper
from ragas.metrics import (
    answer_relevancy,
    context_precision,
    context_recall,
    faithfulness,
)
from ragas.run_config import RunConfig

from app.core.config import settings
from app.evaluators.base import Evaluator
from app.evaluators.ollama_embeddings import (
    OllamaRagasEmbeddings,
)


def optional_float(
    value: Any,
) -> float | None:
    """
    Convierte el resultado de una métrica a float.

    Devuelve None cuando el valor no es numérico,
    infinito o NaN.
    """
    try:
        converted = float(value)
    except (TypeError, ValueError):
        return None

    if not math.isfinite(converted):
        return None

    return converted


class RagasEvaluator(Evaluator):
    """
    Evaluador semántico basado en RAGAS.

    Usa:
    - llama3.1 como modelo evaluador;
    - nomic-embed-text para embeddings;
    - Ollama como infraestructura local.
    """

    def __init__(
        self,
        llm_model: str = "llama3.1",
        embedding_model: str = "nomic-embed-text",
        timeout_seconds: float = 300.0,
    ) -> None:
        openai_base_url = (
            f"http://{settings.ollama_host}:"
            f"{settings.ollama_port}/v1"
        )

        langchain_llm = ChatOpenAI(
            model=llm_model,
            base_url=openai_base_url,
            api_key="ollama",
            temperature=0,
            timeout=timeout_seconds,
            max_retries=1,
        )

        self.llm = LangchainLLMWrapper(
            langchain_llm
        )

        self.embeddings = OllamaRagasEmbeddings(
            model=embedding_model,
            timeout_seconds=timeout_seconds,
        )

        self.run_config = RunConfig(
            timeout=timeout_seconds,
            max_retries=1,
        )

        self.metrics = [
            faithfulness,
            answer_relevancy,
            context_precision,
            context_recall,
        ]

    async def evaluate(
        self,
        result: dict[str, Any],
    ) -> dict[str, Any]:
        question = str(
            result.get("question") or ""
        ).strip()

        generated_answer = str(
            result.get("generated_answer") or ""
        ).strip()

        expected_answer = str(
            result.get("expected_answer") or ""
        ).strip()

        retrieved_contexts = [
            str(context.get("text") or "").strip()
            for context in (
                result.get("retrieved_contexts")
                or []
            )
            if str(
                context.get("text") or ""
            ).strip()
        ]

        if not question:
            raise ValueError(
                "RAGAS necesita una pregunta."
            )

        if not generated_answer:
            raise ValueError(
                "RAGAS necesita una respuesta generada."
            )

        if not retrieved_contexts:
            raise ValueError(
                "RAGAS necesita al menos un contexto recuperado."
            )

        sample: dict[str, Any] = {
            "user_input": question,
            "response": generated_answer,
            "retrieved_contexts": retrieved_contexts,
        }

        metrics = [
            faithfulness,
            answer_relevancy,
        ]

        # Las métricas basadas en referencia solo se ejecutan
        # cuando existe una respuesta esperada.
        if expected_answer:
            sample["reference"] = expected_answer

            metrics.extend(
                [
                    context_precision,
                    context_recall,
                ]
            )

        dataset = EvaluationDataset.from_list(
            [sample]
        )

        scores = await aevaluate(
            dataset=dataset,
            metrics=metrics,
            llm=self.llm,
            embeddings=self.embeddings,
            run_config=self.run_config,
            raise_exceptions=False,
            show_progress=False,
        )

        dataframe = scores.to_pandas()

        if dataframe.empty:
            raise RuntimeError(
                "RAGAS no devolvió resultados."
            )

        row = dataframe.iloc[0]

        return {
            "ragas_faithfulness": optional_float(
                row.get("faithfulness")
            ),
            "ragas_answer_relevancy": optional_float(
                row.get("answer_relevancy")
            ),
            "ragas_context_precision": optional_float(
                row.get("context_precision")
            ),
            "ragas_context_recall": optional_float(
                row.get("context_recall")
            ),
        }
