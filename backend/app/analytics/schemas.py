from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AnalyticsDashboardResponse(BaseModel):
    total_runs: int
    completed_runs: int
    failed_runs: int
    success_rate: float | None

    best_overall_score: float | None
    mean_overall_score: float | None
    best_groundedness: float | None
    mean_groundedness: float | None
    mean_answer_f1: float | None

    mean_generation_latency_ms: float | None
    mean_runner_total_ms: float | None
    mean_total_tokens: float | None
    mean_recommendation_score: float | None

    latest_run_at: datetime | None


class AnalyticsSummaryResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
    )

    run_id: str
    experiment_name: str
    experiment_version: int
    generation_model: str | None
    embedding_model: str | None
    chunk_size: int | None
    chunk_overlap: int | None
    retrieval_top_k: int | None

    overall_score: float | None
    groundedness: float | None
    answer_f1: float | None
    generation_mean_latency_ms: float | None
    total_tokens: int | None
    recommendation_score: float | None

    run_started_at: datetime | None
    run_finished_at: datetime | None
