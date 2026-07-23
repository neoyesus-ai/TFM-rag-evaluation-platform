import asyncio
import json
import re
import uuid
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.experiment.chunking import TextChunk, create_chunks
from app.experiment.document_loader import load_document
from app.models.corpus import Corpus
from app.models.dataset import (
    EvaluationDataset,
    EvaluationQuestion,
)
from app.models.document import Document
from app.providers.generation import create_generation_provider
from app.schemas.dataset import EvaluationDatasetGenerateRequest


def _language_name(language: str) -> str:
    if language == "en":
        return "English"

    return "Spanish"


def _select_source_chunks(
    chunks: list[TextChunk],
    maximum_characters: int = 12000,
) -> list[TextChunk]:
    if not chunks:
        return []

    selected: list[TextChunk] = []
    accumulated_characters = 0

    for chunk in chunks:
        if (
            selected
            and accumulated_characters + len(chunk.text)
            > maximum_characters
        ):
            break

        selected.append(chunk)
        accumulated_characters += len(chunk.text)

    return selected


def _build_generation_prompt(
    *,
    filename: str,
    chunks: list[TextChunk],
    question_count: int,
    language: str,
) -> str:
    source_sections = []

    for chunk in chunks:
        source_sections.append(
            "\n".join(
                [
                    f"[CHUNK {chunk.position}]",
                    chunk.text,
                ]
            )
        )

    source_text = "\n\n".join(source_sections)
    output_language = _language_name(language)

    return f"""
You are creating a ground-truth evaluation dataset for a
Retrieval-Augmented Generation system.

Generate exactly {question_count} questions from the supplied document.

Requirements:
- Write the questions and answers in {output_language}.
- Every answer must be supported exclusively by the supplied text.
- Do not use outside knowledge.
- Avoid vague or opinion-based questions.
- Prefer questions that evaluate factual understanding.
- Each expected_answer must be concise but complete.
- Each expected_context must contain the exact supporting passage.
- Return valid JSON only.
- Do not use Markdown fences.
- Return a JSON array with this exact structure:

[
  {{
    "question": "Question text",
    "expected_answer": "Ground-truth answer",
    "expected_context": "Supporting passage",
    "chunk_position": 0,
    "difficulty": "easy|medium|hard",
    "question_type": "factual|conceptual|comparative|causal"
  }}
]

Document: {filename}

SOURCE TEXT:

{source_text}
""".strip()


def _remove_markdown_fences(text: str) -> str:
    cleaned = text.strip()

    fenced_match = re.fullmatch(
        r"```(?:json)?\s*(.*?)\s*```",
        cleaned,
        flags=re.DOTALL | re.IGNORECASE,
    )

    if fenced_match:
        return fenced_match.group(1).strip()

    return cleaned


def _extract_json_array(text: str) -> list[dict[str, Any]]:
    cleaned = _remove_markdown_fences(text)

    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("[")
        end = cleaned.rfind("]")

        if start < 0 or end < start:
            raise ValueError(
                "El modelo no devolvió un array JSON válido."
            )

        try:
            payload = json.loads(cleaned[start : end + 1])
        except json.JSONDecodeError as exc:
            raise ValueError(
                "No se pudo interpretar el JSON generado por el modelo."
            ) from exc

    if not isinstance(payload, list):
        raise ValueError(
            "La respuesta generada debe ser un array JSON."
        )

    validated_items: list[dict[str, Any]] = []

    for position, item in enumerate(payload):
        if not isinstance(item, dict):
            raise ValueError(
                f"El elemento {position} no es un objeto JSON."
            )

        question = item.get("question")
        expected_answer = item.get("expected_answer")
        expected_context = item.get("expected_context")

        if not isinstance(question, str) or len(question.strip()) < 3:
            raise ValueError(
                f"La pregunta generada en la posición {position} no es válida."
            )

        if (
            not isinstance(expected_answer, str)
            or not expected_answer.strip()
        ):
            raise ValueError(
                f"La respuesta generada en la posición {position} no es válida."
            )

        if (
            not isinstance(expected_context, str)
            or not expected_context.strip()
        ):
            raise ValueError(
                f"El contexto generado en la posición {position} no es válido."
            )

        validated_items.append(item)

    return validated_items


async def _load_corpus(
    *,
    corpus_id: uuid.UUID,
    session: AsyncSession,
) -> Corpus:
    result = await session.execute(
        select(Corpus)
        .options(selectinload(Corpus.documents))
        .where(Corpus.id == corpus_id)
    )

    corpus = result.scalar_one_or_none()

    if corpus is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Corpus no encontrado.",
        )

    if not corpus.documents:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El corpus no contiene documentos.",
        )

    return corpus


def _eligible_documents(
    documents: list[Document],
) -> list[Document]:
    return [
        document
        for document in documents
        if document.status not in {"error", "deleted"}
    ]


async def generate_dataset_from_corpus(
    *,
    payload: EvaluationDatasetGenerateRequest,
    session: AsyncSession,
) -> EvaluationDataset:
    corpus = await _load_corpus(
        corpus_id=payload.corpus_id,
        session=session,
    )

    documents = _eligible_documents(
        list(corpus.documents)
    )

    if not documents:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "El corpus no contiene documentos disponibles "
                "para generar preguntas."
            ),
        )

    try:
        provider = create_generation_provider(
            provider=payload.provider,
            model=payload.model,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    dataset = EvaluationDataset(
        name=payload.name,
        description=(
            payload.description
            or (
                f"Dataset generado automáticamente desde "
                f"el corpus '{corpus.name}'."
            )
        ),
        version=payload.version,
        status="draft",
    )

    generated_question_count = 0

    for document in documents:
        try:
            loaded_document = await asyncio.to_thread(
                load_document,
                document,
            )

            chunks = create_chunks(
                text=loaded_document.text,
                document_id=loaded_document.document_id,
                filename=loaded_document.filename,
                strategy=payload.chunking_strategy,
                chunk_size=payload.chunk_size,
                chunk_overlap=payload.chunk_overlap,
            )

            selected_chunks = _select_source_chunks(chunks)

            if not selected_chunks:
                continue

            generation_result = await provider.generate(
                prompt=_build_generation_prompt(
                    filename=document.filename,
                    chunks=selected_chunks,
                    question_count=payload.questions_per_document,
                    language=payload.language,
                ),
                temperature=payload.temperature,
            )

            generated_items = _extract_json_array(
                generation_result.text
            )

        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=(
                    "No se pudo generar el dataset desde "
                    f"'{document.filename}': {exc}"
                ),
            ) from exc

        for item in generated_items[
            : payload.questions_per_document
        ]:
            chunk_position = item.get("chunk_position")

            metadata = {
                "generation_source": "corpus",
                "corpus_id": str(corpus.id),
                "corpus_name": corpus.name,
                "document_id": str(document.id),
                "source_document": document.filename,
                "chunk_position": chunk_position,
                "difficulty": item.get(
                    "difficulty",
                    "medium",
                ),
                "question_type": item.get(
                    "question_type",
                    "factual",
                ),
                "review_status": "pending",
                "generator_provider": payload.provider,
                "generator_model": generation_result.model,
                "language": payload.language,
                "chunking_strategy": payload.chunking_strategy,
                "chunk_size": payload.chunk_size,
                "chunk_overlap": payload.chunk_overlap,
            }

            dataset.questions.append(
                EvaluationQuestion(
                    question=item["question"].strip(),
                    expected_answer=(
                        item["expected_answer"].strip()
                    ),
                    expected_contexts=[
                        item["expected_context"].strip()
                    ],
                    question_metadata=metadata,
                    order_index=generated_question_count,
                )
            )

            generated_question_count += 1

    if generated_question_count == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No se generó ninguna pregunta válida.",
        )

    session.add(dataset)

    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Ya existe un dataset con ese nombre "
                "y número de versión."
            ),
        ) from exc
    except Exception:
        await session.rollback()
        raise

    result = await session.execute(
        select(EvaluationDataset)
        .options(
            selectinload(EvaluationDataset.questions)
        )
        .where(EvaluationDataset.id == dataset.id)
    )

    return result.scalar_one()
