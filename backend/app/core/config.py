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

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()
