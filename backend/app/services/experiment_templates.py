import copy
from pathlib import Path
from typing import Any

import yaml

from app.schemas.experiment_template import ExperimentTemplateDefinition


TEMPLATES_DIRECTORY = Path("/app/experiment_templates")


def load_builtin_templates() -> list[ExperimentTemplateDefinition]:
    templates: list[ExperimentTemplateDefinition] = []

    if not TEMPLATES_DIRECTORY.exists():
        return templates

    for path in sorted(TEMPLATES_DIRECTORY.glob("*.yaml")):
        with path.open("r", encoding="utf-8") as file:
            raw_template = yaml.safe_load(file)

        templates.append(
            ExperimentTemplateDefinition.model_validate(raw_template)
        )

    return templates


def get_builtin_template(
    template_key: str,
) -> ExperimentTemplateDefinition | None:
    for template in load_builtin_templates():
        if template.template_key == template_key:
            return template

    return None


def set_nested_value(
    source: dict[str, Any],
    dotted_path: str,
    value: Any,
) -> None:
    current = source
    path_parts = dotted_path.split(".")

    for part in path_parts[:-1]:
        nested = current.get(part)

        if not isinstance(nested, dict):
            nested = {}
            current[part] = nested

        current = nested

    current[path_parts[-1]] = value


def apply_configuration_overrides(
    configuration: dict[str, Any],
    overrides: dict[str, Any],
) -> dict[str, Any]:
    resolved = copy.deepcopy(configuration)

    for dotted_path, value in overrides.items():
        set_nested_value(resolved, dotted_path, value)

    return resolved
