import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.experiment.context import ExperimentContext
from app.experiment.document_loader import load_text_document
from app.experiment.stages.base import ExperimentStage
from app.models.document import Document


class LoadDocumentsStage(ExperimentStage):
    name = "load_documents"

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def execute(
        self,
        context: ExperimentContext,
    ) -> None:
        result = await self.session.execute(
            select(Document)
            .where(
                Document.corpus_id
                == context.experiment.corpus_id
            )
            .order_by(Document.created_at.asc())
        )

        document_records = list(result.scalars().all())

        if not document_records:
            raise ValueError(
                "El corpus no contiene documentos."
            )

        loaded_documents = [
            load_text_document(document)
            for document in document_records
        ]

        manifest = [
            {
                "document_id": document.document_id,
                "filename": document.filename,
                "content_type": document.content_type,
                "character_count": len(document.text),
            }
            for document in loaded_documents
        ]

        manifest_directory = (
            context.working_directory / "input"
        )
        manifest_directory.mkdir(
            parents=True,
            exist_ok=True,
        )

        manifest_path = (
            manifest_directory
            / "documents-manifest.json"
        )

        manifest_path.write_text(
            json.dumps(
                manifest,
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

        context.document_records = document_records
        context.loaded_documents = loaded_documents
        context.artifacts["input"] = manifest_directory

        context.metrics["document_count"] = float(
            len(loaded_documents)
        )
        context.metrics["character_count"] = float(
            sum(
                len(document.text)
                for document in loaded_documents
            )
        )
