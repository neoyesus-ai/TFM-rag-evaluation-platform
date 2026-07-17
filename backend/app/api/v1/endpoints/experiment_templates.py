import hashlib
import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db_session
from app.models.corpus import Corpus
from app.models.experiment import Experiment, ExperimentVersion
from app.models.experiment_template import ExperimentTemplate
from app.schemas.experiment import (
    ExperimentDetailResponse,
    PipelineConfiguration,
)
from app.schemas.experiment_template import (
    CreateExperimentFromTemplate,
    ExperimentTemplateResponse,
    SavedExperimentTemplateCreate,
    SavedExperimentTemplateResponse,
)
from app.services.experiment_templates import (
    apply_configuration_overrides,
    get_builtin_template,
    load_builtin_templates,
)


router = APIRouter(
    prefix="/experiment-templates",
    tags=["experiment-templates"],
)

DatabaseSession = Annotated[
    AsyncSession,
    Depends(get_db_session),
]


def calculate_configuration_hash(configuration: dict) -> str:
    canonical = json.dumps(
        configuration,
        sort_keys=True,
        separators=(",", ":"),
    )

    return hashlib.sha256(
        canonical.encode("utf-8")
    ).hexdigest()


@router.get(
    "",
    response_model=list[ExperimentTemplateResponse],
)
async def list_builtin_templates() -> list[ExperimentTemplateResponse]:
    return load_builtin_templates()


@router.get(
    "/custom/saved",
    response_model=list[SavedExperimentTemplateResponse],
)
async def list_custom_templates(
    session: DatabaseSession,
) -> list[ExperimentTemplate]:
    result = await session.execute(
        select(ExperimentTemplate)
        .where(ExperimentTemplate.is_builtin.is_(False))
        .order_by(ExperimentTemplate.created_at.desc())
    )

    return list(result.scalars().all())


@router.post(
    "/custom",
    response_model=SavedExperimentTemplateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def save_custom_template(
    payload: SavedExperimentTemplateCreate,
    session: DatabaseSession,
) -> ExperimentTemplate:
    template = ExperimentTemplate(
        template_key=payload.template_key,
        name=payload.name,
        description=payload.description,
        category=payload.category,
        schema_version=payload.configuration.schema_version,
        tags=payload.tags,
        configuration=payload.configuration.model_dump(mode="json"),
        matrix=payload.matrix,
        is_builtin=False,
    )

    session.add(template)

    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una plantilla con esa clave.",
        ) from exc

    await session.refresh(template)

    return template


@router.get(
    "/builtin/{template_key}",
    response_model=ExperimentTemplateResponse,
)
async def get_builtin_template_endpoint(
    template_key: str,
) -> ExperimentTemplateResponse:
    template = get_builtin_template(template_key)

    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plantilla no encontrada.",
        )

    return template


@router.post(
    "/builtin/{template_key}/create-experiment",
    response_model=ExperimentDetailResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_experiment_from_template(
    template_key: str,
    payload: CreateExperimentFromTemplate,
    session: DatabaseSession,
) -> Experiment:
    template = get_builtin_template(template_key)

    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plantilla no encontrada.",
        )

    corpus = await session.get(Corpus, payload.corpus_id)

    if corpus is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Corpus no encontrado.",
        )

    base_configuration = template.configuration.model_dump(
        mode="json"
    )

    resolved_configuration = apply_configuration_overrides(
        base_configuration,
        payload.configuration_overrides,
    )

    validated_configuration = PipelineConfiguration.model_validate(
        resolved_configuration
    )

    configuration = validated_configuration.model_dump(
        mode="json"
    )

    experiment = Experiment(
        name=payload.name,
        description=payload.description or template.description,
        corpus_id=payload.corpus_id,
        status="draft",
    )

    version = ExperimentVersion(
        version_number=1,
        schema_version=validated_configuration.schema_version,
        configuration=configuration,
        configuration_hash=calculate_configuration_hash(
            configuration
        ),
        source_template_key=template.template_key,
        git_commit=payload.git_commit,
    )

    experiment.versions.append(version)
    session.add(experiment)

    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un experimento con ese nombre.",
        ) from exc

    result = await session.execute(
        select(Experiment)
        .options(selectinload(Experiment.versions))
        .where(Experiment.id == experiment.id)
    )

    return result.scalar_one()
