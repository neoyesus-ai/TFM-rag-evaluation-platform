from dataclasses import dataclass
from pathlib import Path

from app.models.document import Document
from app.services.object_storage import object_storage


SUPPORTED_TEXT_EXTENSIONS = {
    ".txt",
    ".md",
}


@dataclass
class LoadedDocument:
    document_id: str
    filename: str
    content_type: str | None
    text: str


def load_text_document(document: Document) -> LoadedDocument:
    extension = Path(document.filename).suffix.lower()

    if extension not in SUPPORTED_TEXT_EXTENSIONS:
        raise ValueError(
            f"Formato todavía no soportado para extracción: {extension}"
        )

    response = object_storage.client.get_object(
        bucket_name=object_storage.bucket_name,
        object_name=document.object_name,
    )

    try:
        content = response.read()
    finally:
        response.close()
        response.release_conn()

    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    return LoadedDocument(
        document_id=str(document.id),
        filename=document.filename,
        content_type=document.content_type,
        text=text,
    )
