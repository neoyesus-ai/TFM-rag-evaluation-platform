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


_ALLOWED_DIFFICULTIES = {"easy", "medium", "hard"}
_ALLOWED_QUESTION_TYPES = {
    "factual",
    "conceptual",
    "comparative",
    "causal",
}

_MIN_INFORMATIVE_CHUNK_CHARS = 300
_REFERENCE_HEADING_PATTERN = re.compile(
    r"^\s*(references|bibliography|works cited)\s*$",
    flags=re.IGNORECASE | re.MULTILINE,
)
_CITATION_LINE_PATTERN = re.compile(
    r"^\s*(?:\[?\d+\]?\s*[.)]?|[A-Z][A-Za-z'-]+,\s+[A-Z])",
    flags=re.MULTILINE,
)


def _language_name(language: str) -> str:
    if language == "en":
        return "English"

    return "Spanish"


def _looks_like_table(text: str) -> bool:
    """Returns True when a chunk is dominated by table-like rows."""
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if len(lines) < 4:
        return False

    table_like_lines = sum(
        1
        for line in lines
        if line.count("|") >= 2
        or line.count("\t") >= 2
        or len(re.findall(r"\s{3,}", line)) >= 2
    )

    return table_like_lines / len(lines) >= 0.6


def _looks_like_references(text: str) -> bool:
    """Returns True when a chunk appears to be bibliography/references."""
    if _REFERENCE_HEADING_PATTERN.search(text):
        return True

    lines = [line for line in text.splitlines() if line.strip()]
    if len(lines) < 4:
        return False

    citation_lines = len(_CITATION_LINE_PATTERN.findall(text))
    year_mentions = len(re.findall(r"\b(?:19|20)\d{2}[a-z]?\b", text))

    return (
        citation_lines / len(lines) >= 0.5
        and year_mentions >= max(3, len(lines) // 3)
    )


def _is_informative_chunk(chunk: TextChunk) -> bool:
    """Filters fragments unlikely to produce useful benchmark questions."""
    text = chunk.text.strip()

    if len(text) < _MIN_INFORMATIVE_CHUNK_CHARS:
        return False

    if _looks_like_table(text) or _looks_like_references(text):
        return False

    return True


def _select_distributed_chunks(
    chunks: list[TextChunk],
    question_count: int,
) -> list[TextChunk]:
    """
    Selects informative chunks distributed across the whole document.

    Very short fragments, table-dominated chunks and bibliography-like chunks
    are excluded when possible. If every chunk is filtered out, the original
    list is used as a safe fallback. When the requested number is greater than
    the number of available chunks, chunks are reused in a balanced way.
    """
    if not chunks or question_count <= 0:
        return []

    informative_chunks = [
        chunk for chunk in chunks if _is_informative_chunk(chunk)
    ]
    candidate_chunks = informative_chunks or chunks

    if question_count == 1:
        return [candidate_chunks[len(candidate_chunks) // 2]]

    last_index = len(candidate_chunks) - 1

    return [
        candidate_chunks[
            round(index * last_index / (question_count - 1))
        ]
        for index in range(question_count)
    ]


def _build_generation_prompt(
    *,
    filename: str,
    chunk: TextChunk,
    language: str,
    question_number: int,
    total_questions: int,
) -> str:
    output_language = _language_name(language)

    return f"""
You are creating a ground-truth evaluation dataset for a
Retrieval-Augmented Generation system.

Generate exactly ONE question from the supplied text chunk.

Requirements:
- Write the question and answer in {output_language}.
- The answer must be supported exclusively by the supplied text.
- Do not use outside knowledge.
- Avoid vague, opinion-based or unanswerable questions.
- Prefer questions that evaluate factual or conceptual understanding.
- The expected_answer must be concise but complete.
- Do not copy a previous generic question pattern when a more specific one
  can be created from the chunk.
- Return valid JSON only.
- Do not use Markdown fences.
- Return one JSON object with this exact structure:

{{
  "question": "Question text",
  "expected_answer": "Ground-truth answer",
  "difficulty": "easy|medium|hard",
  "question_type": "factual|conceptual|comparative|causal"
}}

Document: {filename}
Question number for this document: {question_number} of {total_questions}
Chunk position: {chunk.position}

SOURCE CHUNK:

{chunk.text}
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


def _extract_json_object(text: str) -> dict[str, Any]:
    cleaned = _remove_markdown_fences(text)

    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")

        if start < 0 or end < start:
            raise ValueError(
                "El modelo no devolvió un objeto JSON válido."
            )

        try:
            payload = json.loads(cleaned[start : end + 1])
        except json.JSONDecodeError as exc:
            raise ValueError(
                "No se pudo interpretar el JSON generado por el modelo."
            ) from exc

    # Tolerate a one-element array in case the model ignores the requested
    # object format.
    if isinstance(payload, list):
        if len(payload) != 1 or not isinstance(payload[0], dict):
            raise ValueError(
                "La respuesta generada debe contener un único objeto JSON."
            )

        payload = payload[0]

    if not isinstance(payload, dict):
        raise ValueError(
            "La respuesta generada debe ser un objeto JSON."
        )

    question = payload.get("question")
    expected_answer = payload.get("expected_answer")

    if not isinstance(question, str) or len(question.strip()) < 3:
        raise ValueError(
            "La pregunta generada no es válida."
        )

    if (
        not isinstance(expected_answer, str)
        or not expected_answer.strip()
    ):
        raise ValueError(
            "La respuesta generada no es válida."
        )

    difficulty = payload.get("difficulty", "medium")
    if difficulty not in _ALLOWED_DIFFICULTIES:
        difficulty = "medium"

    question_type = payload.get("question_type", "factual")
    if question_type not in _ALLOWED_QUESTION_TYPES:
        question_type = "factual"

    return {
        "question": question.strip(),
        "expected_answer": expected_answer.strip(),
        "difficulty": difficulty,
        "question_type": question_type,
    }


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
                "Dataset generado automáticamente desde "
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

            selected_chunks = _select_distributed_chunks(
                chunks=chunks,
                question_count=payload.questions_per_document,
            )

            if not selected_chunks:
                continue

            for question_number, chunk in enumerate(
                selected_chunks,
                start=1,
            ):
                generation_result = await provider.generate(
                    prompt=_build_generation_prompt(
                        filename=document.filename,
                        chunk=chunk,
                        language=payload.language,
                        question_number=question_number,
                        total_questions=(
                            payload.questions_per_document
                        ),
                    ),
                    temperature=payload.temperature,
                )

                item = _extract_json_object(
                    generation_result.text
                )

                metadata = {
                    "generation_source": "corpus",
                    "generation_strategy": "one_question_per_chunk",
                    "corpus_id": str(corpus.id),
                    "corpus_name": corpus.name,
                    "document_id": str(document.id),
                    # Keep the original key for backward compatibility.
                    "source_document": document.filename,
                    "source_document_filename": document.filename,
                    "chunk_id": (
                        f"{document.id}:chunk:{chunk.position}"
                    ),
                    "chunk_position": chunk.position,
                    "difficulty": item["difficulty"],
                    "question_type": item["question_type"],
                    "review_status": "pending",
                    "generator_provider": payload.provider,
                    "generator_model": generation_result.model,
                    "language": payload.language,
                    "chunking_strategy": payload.chunking_strategy,
                    "chunk_size": payload.chunk_size,
                    "chunk_overlap": payload.chunk_overlap,
                    "question_number_in_document": question_number,
                }

                dataset.questions.append(
                    EvaluationQuestion(
                        question=item["question"],
                        expected_answer=item["expected_answer"],
                        # The exact source chunk is stored as ground truth
                        # context instead of trusting the model to reproduce it.
                        expected_contexts=[chunk.text.strip()],
                        question_metadata=metadata,
                        order_index=generated_question_count,
                    )
                )

                generated_question_count += 1

        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=(
                    "No se pudo generar el dataset desde "
                    f"'{document.filename}': {exc}"
                ),
            ) from exc

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