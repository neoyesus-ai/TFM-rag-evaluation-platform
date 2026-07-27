import time
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.experiment.stages.indexing import (
    sanitize_collection_name,
)
from app.models.experiment import (
    Experiment,
    ExperimentRun,
    ExperimentVersion,
)
from app.providers.embeddings import (
    create_embedding_provider,
)
from app.providers.generation import (
    create_generation_provider,
)
from app.providers.vector_store import (
    create_vector_store_provider,
)
from app.rag_console.query_schemas import (
    RagConsoleQueryRequest,
    RagConsoleQueryResponse,
    RagConsoleRetrievedContext,
)


class RagConsoleRunNotFoundError(Exception):
    """La ejecución solicitada no existe."""


class RagConsoleRunUnavailableError(Exception):
    """La ejecución no está disponible para consultas."""


class RagConsoleConfigurationError(Exception):
    """La configuración del experimento no es válida."""


class RagConsoleQueryService:
    async def query(
        self,
        session: AsyncSession,
        request: RagConsoleQueryRequest,
    ) -> RagConsoleQueryResponse:
        total_started = time.perf_counter()

        run, version, experiment = (
            await self._load_run(
                session=session,
                run_id=request.run_id,
            )
        )

        configuration = version.configuration

        (
            embedding_configuration,
            retrieval_configuration,
            generation_configuration,
        ) = self._read_configuration(
            configuration
        )

        embedding_provider_name = str(
            embedding_configuration["provider"]
        )
        embedding_model = str(
            embedding_configuration["model"]
        )

        retrieval_strategy = str(
            retrieval_configuration["strategy"]
        )
        top_k = int(
            retrieval_configuration["top_k"]
        )

        generation_provider_name = str(
            generation_configuration["provider"]
        )
        generation_model = str(
            generation_configuration["model"]
        )
        temperature = float(
            generation_configuration.get(
                "temperature",
                0.0,
            )
        )

        if retrieval_strategy != "similarity":
            raise RagConsoleConfigurationError(
                "La consola solo admite actualmente "
                "la estrategia de recuperación similarity."
            )

        if top_k < 1:
            raise RagConsoleConfigurationError(
                "El valor top_k debe ser mayor que cero."
            )

        collection_name = (
            sanitize_collection_name(
                f"run_{run.mlflow_run_id or run.id}"
            )
        )

        retrieval_started = time.perf_counter()

        embedding_provider = (
            create_embedding_provider(
                provider=embedding_provider_name,
                model=embedding_model,
            )
        )

        query_embedding = (
            await embedding_provider.embed_query(
                request.question
            )
        )

        vector_store = (
            create_vector_store_provider(
                provider="chroma"
            )
        )

        try:
            raw_result = vector_store.query(
                collection_name=collection_name,
                query_embeddings=[
                    query_embedding
                ],
                top_k=top_k,
            )
        except Exception as exc:
            raise RagConsoleRunUnavailableError(
                "No se pudo consultar la colección "
                f"vectorial '{collection_name}'. "
                "Comprueba que la ejecución fue "
                "indexada correctamente."
            ) from exc

        contexts = self._build_contexts(
            raw_result
        )

        retrieval_time_ms = int(
            (
                time.perf_counter()
                - retrieval_started
            )
            * 1000
        )

        prompt = self._build_prompt(
            question=request.question,
            contexts=contexts,
            experiment_name=experiment.name,
        )

        generation_provider = (
            create_generation_provider(
                provider=generation_provider_name,
                model=generation_model,
            )
        )

        generation_started = time.perf_counter()

        generation_result = (
            await generation_provider.generate(
                prompt=prompt,
                temperature=temperature,
            )
        )

        generation_time_ms = int(
            (
                time.perf_counter()
                - generation_started
            )
            * 1000
        )

        total_time_ms = int(
            (
                time.perf_counter()
                - total_started
            )
            * 1000
        )

        return RagConsoleQueryResponse(
            run_id=run.id,
            question=request.question,
            answer=generation_result.text,
            contexts=contexts,
            collection_name=collection_name,
            embedding_provider=(
                embedding_provider_name
            ),
            embedding_model=embedding_model,
            generation_provider=(
                generation_provider_name
            ),
            generation_model=(
                generation_result.model
            ),
            retrieval_strategy=(
                retrieval_strategy
            ),
            top_k=top_k,
            temperature=temperature,
            retrieval_time_ms=(
                retrieval_time_ms
            ),
            generation_time_ms=(
                generation_time_ms
            ),
            total_time_ms=total_time_ms,
            prompt_eval_count=(
                generation_result.prompt_eval_count
            ),
            generated_token_count=(
                generation_result.eval_count
            ),
            done_reason=(
                generation_result.done_reason
            ),
        )

    async def _load_run(
        self,
        session: AsyncSession,
        run_id: uuid.UUID,
    ) -> tuple[
        ExperimentRun,
        ExperimentVersion,
        Experiment,
    ]:
        stmt = (
            select(
                ExperimentRun,
                ExperimentVersion,
                Experiment,
            )
            .join(
                ExperimentVersion,
                ExperimentRun.experiment_version_id
                == ExperimentVersion.id,
            )
            .join(
                Experiment,
                ExperimentVersion.experiment_id
                == Experiment.id,
            )
            .where(
                ExperimentRun.id == run_id
            )
        )

        result = await session.execute(stmt)
        row = result.one_or_none()

        if row is None:
            raise RagConsoleRunNotFoundError(
                "La ejecución seleccionada no existe."
            )

        run, version, experiment = row

        if run.status != "completed":
            raise RagConsoleRunUnavailableError(
                "Solo pueden consultarse ejecuciones "
                "con estado completed."
            )

        return run, version, experiment

    def _read_configuration(
        self,
        configuration: dict[str, Any],
    ) -> tuple[
        dict[str, Any],
        dict[str, Any],
        dict[str, Any],
    ]:
        try:
            embedding_configuration = (
                configuration["embedding"]
            )
            retrieval_configuration = (
                configuration["retrieval"]
            )
            generation_configuration = (
                configuration["generation"]
            )

            embedding_configuration[
                "provider"
            ]
            embedding_configuration[
                "model"
            ]

            retrieval_configuration[
                "strategy"
            ]
            retrieval_configuration[
                "top_k"
            ]

            generation_configuration[
                "provider"
            ]
            generation_configuration[
                "model"
            ]

        except (
            KeyError,
            TypeError,
        ) as exc:
            raise RagConsoleConfigurationError(
                "La versión del experimento no "
                "contiene una configuración RAG válida."
            ) from exc

        return (
            embedding_configuration,
            retrieval_configuration,
            generation_configuration,
        )

    def _build_contexts(
        self,
        raw_result: dict[str, Any],
    ) -> list[
        RagConsoleRetrievedContext
    ]:
        ids = self._first_result_list(
            raw_result,
            "ids",
        )
        documents = self._first_result_list(
            raw_result,
            "documents",
        )
        metadatas = self._first_result_list(
            raw_result,
            "metadatas",
        )
        distances = self._first_result_list(
            raw_result,
            "distances",
        )

        contexts: list[
            RagConsoleRetrievedContext
        ] = []

        for index, chunk_id in enumerate(ids):
            document = (
                documents[index]
                if index < len(documents)
                else ""
            )

            metadata = (
                metadatas[index]
                if index < len(metadatas)
                and isinstance(
                    metadatas[index],
                    dict,
                )
                else {}
            )

            distance = (
                float(distances[index])
                if index < len(distances)
                else 1.0
            )

            similarity = 1.0 - distance

            contexts.append(
                RagConsoleRetrievedContext(
                    rank=index + 1,
                    chunk_id=str(chunk_id),
                    text=str(document or ""),
                    metadata=metadata,
                    distance=distance,
                    similarity=similarity,
                )
            )

        return contexts

    def _first_result_list(
        self,
        raw_result: dict[str, Any],
        key: str,
    ) -> list[Any]:
        value = raw_result.get(key)

        if not isinstance(value, list):
            return []

        if not value:
            return []

        first_item = value[0]

        if not isinstance(first_item, list):
            return []

        return first_item

    def _build_prompt(
        self,
        question: str,
        contexts: list[
            RagConsoleRetrievedContext
        ],
        experiment_name: str,
    ) -> str:
        if contexts:
            context_blocks = []

            for context in contexts:
                filename = context.metadata.get(
                    "filename",
                    "documento desconocido",
                )

                position = context.metadata.get(
                    "position",
                    "desconocida",
                )

                context_blocks.append(
                    "\n".join(
                        [
                            (
                                f"[Contexto "
                                f"{context.rank}]"
                            ),
                            (
                                f"Fuente: "
                                f"{filename}"
                            ),
                            (
                                f"Posición: "
                                f"{position}"
                            ),
                            (
                                f"Similitud: "
                                f"{context.similarity:.6f}"
                            ),
                            "Contenido:",
                            context.text,
                        ]
                    )
                )

            context_text = "\n\n".join(
                context_blocks
            )
        else:
            context_text = (
                "No se recuperaron contextos."
            )

        return (
            "Eres un asistente de consulta documental "
            "basado en recuperación aumentada por "
            "generación.\n\n"
            "Debes responder únicamente con la "
            "información presente en los contextos "
            "proporcionados.\n"
            "No utilices conocimiento externo.\n"
            "No inventes datos ni completes información "
            "que no aparezca en los contextos.\n"
            "Cuando los contextos no permitan responder, "
            "indica claramente que no existe información "
            "suficiente.\n"
            "Redacta la respuesta en el mismo idioma que "
            "la pregunta.\n\n"
            f"Experimento seleccionado: "
            f"{experiment_name}\n\n"
            "CONTEXTOS RECUPERADOS\n"
            "=====================\n"
            f"{context_text}\n\n"
            "PREGUNTA\n"
            "========\n"
            f"{question}\n\n"
            "RESPUESTA\n"
            "=========\n"
        )
