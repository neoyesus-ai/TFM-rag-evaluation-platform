from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "TFM RAG Evaluation Platform"
    app_version: str = "0.1.0"
    environment: str = "development"

    postgres_host: str = "postgres"
    postgres_port: int = 5432
    postgres_db: str = "tfm_rag"
    postgres_user: str = "postgres"
    postgres_password: str = "postgres"

    chroma_host: str = "chroma"
    chroma_port: int = 8000

    ollama_host: str = "ollama"
    ollama_port: int = 11434

    minio_host: str = "minio"
    minio_port: int = 9000
    minio_root_user: str = "minioadmin"
    minio_root_password: str = "minioadmin"
    minio_bucket_documents: str = "documents"
    minio_secure: bool = False

    mlflow_tracking_uri: str = "http://mlflow:5000"
    mlflow_experiment_name: str = "tfm-rag-experiments"

    max_upload_size_mb: int = 25

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()
