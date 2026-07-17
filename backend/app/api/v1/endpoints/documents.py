import hashlib
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db_session
from app.models.corpus import Corpus
from app.models.document import Document
from app.schemas.document import DocumentResponse
from app.services.object_storage import object_storage


router = APIRouter(
    prefix="/corpora/{corpus_id}/documents",
    tags=["documents"],
)

DatabaseSession = Annotated[
    AsyncSession,
    Depends(get_db_session),
]

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".txt",
    ".md",
    ".docx",
}


def sanitize_filename(filename: str) -> str:
    safe_name = Path(filename).name.strip()

    if not safe_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El nombre del archivo no es válido.",
        )

    return safe_name


@router.post(
    "",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    corpus_id: uuid.UUID,
    session: DatabaseSession,
    file: Annotated[UploadFile, File(...)],
) -> Document:
    corpus = await session.get(Corpus, corpus_id)

    if corpus is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Corpus no encontrado.",
        )

    filename = sanitize_filename(file.filename or "")
    extension = Path(filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                "Formato no admitido. "
                "Se permiten PDF, TXT, Markdown y DOCX."
            ),
        )

    content = await file.read()

    max_size_bytes = settings.max_upload_size_mb * 1024 * 1024

    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo está vacío.",
        )

    if len(content) > max_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                f"El archivo supera el límite de "
                f"{settings.max_upload_size_mb} MB."
            ),
        )

    document_id = uuid.uuid4()
    checksum = hashlib.sha256(content).hexdigest()
    object_name = f"{corpus_id}/{document_id}/{filename}"
    content_type = file.content_type or "application/octet-stream"

    try:
        object_storage.upload_bytes(
            object_name=object_name,
            data=content,
            content_type=content_type,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"No se pudo almacenar el archivo en MinIO: {exc}",
        ) from exc

    document = Document(
        id=document_id,
        corpus_id=corpus_id,
        filename=filename,
        object_name=object_name,
        content_type=content_type,
        size_bytes=len(content),
        checksum_sha256=checksum,
        status="uploaded",
    )

    session.add(document)

    try:
        await session.commit()
        await session.refresh(document)
    except Exception as exc:
        await session.rollback()

        try:
            object_storage.delete_object(object_name)
        except Exception:
            pass

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudieron guardar los metadatos del documento.",
        ) from exc

    return document


@router.get(
    "",
    response_model=list[DocumentResponse],
)
async def list_documents(
    corpus_id: uuid.UUID,
    session: DatabaseSession,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[Document]:
    corpus = await session.get(Corpus, corpus_id)

    if corpus is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Corpus no encontrado.",
        )

    result = await session.execute(
        select(Document)
        .where(Document.corpus_id == corpus_id)
        .order_by(Document.created_at.desc())
        .limit(limit)
        .offset(offset)
    )

    return list(result.scalars().all())


@router.get(
    "/{document_id}",
    response_model=DocumentResponse,
)
async def get_document(
    corpus_id: uuid.UUID,
    document_id: uuid.UUID,
    session: DatabaseSession,
) -> Document:
    result = await session.execute(
        select(Document).where(
            Document.id == document_id,
            Document.corpus_id == corpus_id,
        )
    )

    document = result.scalar_one_or_none()

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Documento no encontrado.",
        )

    return document


@router.get(
    "/{document_id}/download",
    response_class=RedirectResponse,
)
async def download_document(
    corpus_id: uuid.UUID,
    document_id: uuid.UUID,
    session: DatabaseSession,
) -> RedirectResponse:
    result = await session.execute(
        select(Document).where(
            Document.id == document_id,
            Document.corpus_id == corpus_id,
        )
    )

    document = result.scalar_one_or_none()

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Documento no encontrado.",
        )

    try:
        url = object_storage.get_presigned_download_url(
            document.object_name
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No se pudo generar la URL de descarga.",
        ) from exc

    return RedirectResponse(
        url=url,
        status_code=status.HTTP_307_TEMPORARY_REDIRECT,
    )


@router.delete(
    "/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_document(
    corpus_id: uuid.UUID,
    document_id: uuid.UUID,
    session: DatabaseSession,
) -> None:
    result = await session.execute(
        select(Document).where(
            Document.id == document_id,
            Document.corpus_id == corpus_id,
        )
    )

    document = result.scalar_one_or_none()

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Documento no encontrado.",
        )

    try:
        object_storage.delete_object(
            document.object_name,
        )
    except Exception:
        # Si el objeto ya no existe en MinIO,
        # eliminamos igualmente el registro.
        pass

    await session.delete(document)
    await session.commit()
