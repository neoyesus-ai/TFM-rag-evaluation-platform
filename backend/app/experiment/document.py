from dataclasses import dataclass
from typing import Any


@dataclass(slots=True)
class LoadedDocument:
    """
    Representación interna de un documento cargado.

    Todos los loaders (PDF, TXT, DOCX, Markdown…)
    devolverán esta estructura para unificar el
    pipeline experimental.
    """

    source: str
    text: str
    metadata: dict[str, Any]
