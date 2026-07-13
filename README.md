# TFM RAG Evaluation Platform

Plataforma modular y reproducible para configurar, ejecutar y evaluar experimentos sobre sistemas Retrieval-Augmented Generation mediante microservicios y Docker.

## Objetivos iniciales

- Desplegar todos los servicios mediante Docker Compose.
- Proporcionar un portal de acceso a los servicios.
- Definir componentes y patrones RAG.
- Crear y guardar configuraciones experimentales.
- Preparar la ejecución y comparación de experimentos.
- Integrar RAGAS y PixelRAG en fases posteriores.

## Arquitectura prevista

- Frontend: Streamlit
- Backend: FastAPI
- Persistencia: PostgreSQL
- Almacenamiento: MinIO
- Seguimiento experimental: MLflow
- Visualización: Metabase
- Modelos locales: Ollama
- Base vectorial: ChromaDB
- RAG visual: PixelRAG
- Despliegue: Docker Compose

## Estado

Proyecto en construcción.

## Ramas

- `main`: versiones estables.
- `dev`: integración del desarrollo.
- `feature/*`: funcionalidades individuales.
