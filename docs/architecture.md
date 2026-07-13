# Arquitectura inicial

La plataforma se organiza alrededor de una interfaz web y una API central.

## Servicios principales

- `frontend`: interfaz Streamlit.
- `backend`: API FastAPI.
- `postgres`: persistencia de configuraciones y experimentos.
- `minio`: documentos y artefactos.
- `mlflow`: trazabilidad experimental.
- `metabase`: análisis visual.
- `ollama`: modelos locales.
- `chroma`: almacenamiento vectorial.

## Flujo previsto

1. El usuario accede al frontend.
2. El frontend consulta el backend.
3. El usuario selecciona un patrón o crea una configuración.
4. La configuración se guarda en PostgreSQL.
5. Posteriormente, el ejecutor experimental procesará las configuraciones.
6. Los resultados se registrarán en MLflow y PostgreSQL.
