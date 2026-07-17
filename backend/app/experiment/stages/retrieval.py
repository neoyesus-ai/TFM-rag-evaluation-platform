import json
import statistics
import time
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.experiment.context import ExperimentContext
from app.experiment.stages.base import ExperimentStage
from app.models.dataset import (
    EvaluationDataset,
    EvaluationQuestion,
)
from app.providers.embeddings import (
    create_embedding_provider,
)
from app.providers.vector_store import (
    create_vector_store_provider,
)


class RetrievalStage(ExperimentStage):
    name = "retrieval"

    def __init__(
        self,
        session: AsyncSession,
    ) -> None:
        self.session = session

    async def execute(
        self,
        context: ExperimentContext,
    ) -> None:
        if context.experiment.dataset_id is None:
            raise ValueError(
                "El experimento no tiene un dataset asignado."
            )

        if context.vector_collection_name is None:
            raise ValueError(
                "No existe una colección vectorial para consultar."
            )

        dataset = await self.session.get(
            EvaluationDataset,
            context.experiment.dataset_id,
        )

        if dataset is None:
            raise ValueError(
                "El dataset asignado no existe."
            )

        result = await self.session.execute(
            select(EvaluationQuestion)
            .where(
                EvaluationQuestion.dataset_id
                == dataset.id
            )
            .order_by(
                EvaluationQuestion.order_index.asc()
            )
        )

        questions = list(result.scalars().all())

        if not questions:
            raise ValueError(
                "El dataset no contiene preguntas."
            )

        embedding_configuration = (
            context.version.configuration["embedding"]
        )

        retrieval_configuration = (
            context.version.configuration["retrieval"]
        )

        strategy = retrieval_configuration["strategy"]
        top_k = retrieval_configuration["top_k"]

        if strategy != "similarity":
            raise ValueError(
                "En esta versión solo está implementada "
                "la estrategia similarity."
            )

        embedding_provider = create_embedding_provider(
            provider=embedding_configuration["provider"],
            model=embedding_configuration["model"],
        )

        vector_store = create_vector_store_provider(
            provider="chroma",
        )

        retrieval_started = time.perf_counter()

        retrieval_results: list[dict[str, Any]] = []
        all_distances: list[float] = []
        per_question_latencies: list[int] = []

        for question in questions:
            question_started = time.perf_counter()

            query_embedding = (
                await embedding_provider.embed_query(
                    question.question
                )
            )

            raw_result = vector_store.query(
                collection_name=(
                    context.vector_collection_name
                ),
                query_embeddings=[query_embedding],
                top_k=top_k,
            )

            ids = (
                raw_result.get("ids", [[]])[0]
                if raw_result.get("ids")
                else []
            )

            documents = (
                raw_result.get("documents", [[]])[0]
                if raw_result.get("documents")
                else []
            )

            metadatas = (
                raw_result.get("metadatas", [[]])[0]
                if raw_result.get("metadatas")
                else []
            )

            distances = (
                raw_result.get("distances", [[]])[0]
                if raw_result.get("distances")
                else []
            )

            contexts: list[dict[str, Any]] = []

            for index, chunk_id in enumerate(ids):
                distance = float(distances[index])
                similarity = 1.0 - distance

                all_distances.append(distance)

                contexts.append(
                    {
                        "rank": index + 1,
                        "chunk_id": chunk_id,
                        "text": documents[index],
                        "metadata": metadatas[index],
                        "distance": distance,
                        "similarity": similarity,
                    }
                )

            question_latency_ms = int(
                (
                    time.perf_counter()
                    - question_started
                )
                * 1000
            )

            per_question_latencies.append(
                question_latency_ms
            )

            retrieval_results.append(
                {
                    "question_id": str(question.id),
                    "order_index": question.order_index,
                    "question": question.question,
                    "expected_answer": (
                        question.expected_answer
                    ),
                    "expected_contexts": (
                        question.expected_contexts
                    ),
                    "retrieval_strategy": strategy,
                    "top_k": top_k,
                    "latency_ms": question_latency_ms,
                    "contexts": contexts,
                }
            )

        retrieval_duration_ms = int(
            (
                time.perf_counter()
                - retrieval_started
            )
            * 1000
        )

        retrieval_directory = (
            context.working_directory / "retrieval"
        )

        retrieval_directory.mkdir(
            parents=True,
            exist_ok=True,
        )

        results_path = (
            retrieval_directory
            / "retrieval-results.json"
        )

        summary_path = (
            retrieval_directory
            / "retrieval-summary.json"
        )

        results_path.write_text(
            json.dumps(
                retrieval_results,
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

        similarities = [
            1.0 - distance
            for distance in all_distances
        ]

        retrieved_context_count = sum(
            len(item["contexts"])
            for item in retrieval_results
        )

        summary = {
            "dataset_id": str(dataset.id),
            "dataset_name": dataset.name,
            "dataset_version": dataset.version,
            "question_count": len(questions),
            "retrieval_strategy": strategy,
            "top_k": top_k,
            "retrieved_context_count": (
                retrieved_context_count
            ),
            "retrieval_duration_ms": (
                retrieval_duration_ms
            ),
            "mean_question_latency_ms": (
                statistics.mean(
                    per_question_latencies
                )
                if per_question_latencies
                else 0
            ),
            "mean_similarity": (
                statistics.mean(similarities)
                if similarities
                else 0
            ),
            "min_similarity": (
                min(similarities)
                if similarities
                else 0
            ),
            "max_similarity": (
                max(similarities)
                if similarities
                else 0
            ),
        }

        summary_path.write_text(
            json.dumps(
                summary,
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

        context.evaluation_questions = questions
        context.retrieval_results = retrieval_results

        context.metadata["dataset_id"] = str(
            dataset.id
        )
        context.metadata["dataset_name"] = (
            dataset.name
        )
        context.metadata["dataset_version"] = (
            dataset.version
        )
        context.metadata["retrieval_strategy"] = (
            strategy
        )
        context.metadata["retrieval_top_k"] = top_k

        context.artifacts[
            "retrieval"
        ] = retrieval_directory

        context.metrics[
            "retrieval_question_count"
        ] = float(len(questions))

        context.metrics[
            "retrieved_context_count"
        ] = float(retrieved_context_count)

        context.metrics[
            "retrieval_top_k"
        ] = float(top_k)

        context.metrics[
            "retrieval_duration_ms"
        ] = float(retrieval_duration_ms)

        context.metrics[
            "retrieval_mean_question_latency_ms"
        ] = float(
            summary["mean_question_latency_ms"]
        )

        context.metrics[
            "retrieval_mean_similarity"
        ] = float(summary["mean_similarity"])

        context.metrics[
            "retrieval_min_similarity"
        ] = float(summary["min_similarity"])

        context.metrics[
            "retrieval_max_similarity"
        ] = float(summary["max_similarity"])
