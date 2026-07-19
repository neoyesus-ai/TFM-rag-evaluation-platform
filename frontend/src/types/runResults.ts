export type ExperimentRun = {
  id: string;
  experiment_version_id: string;
  mlflow_run_id: string | null;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  error_message: string |null;
  created_at: string;
};

export type RunMetrics = {
  overall_score: number | null;
  groundedness: number | null;
  answer_token_f1: number | null;
  answer_token_precision: number | null;
  answer_token_recall: number | null;
  answer_relevancy: number | null;

  context_precision: number | null;
  context_recall: number | null;

  retrieval_mean_similarity: number | null;
  retrieval_min_similarity: number | null;
  retrieval_max_similarity: number | null;
  retrieval_duration_ms: number | null;
  retrieval_mean_question_latency_ms: number | null;

  generation_duration_ms: number | null;
  generation_mean_latency_ms: number | null;
  generation_min_latency_ms: number | null;
  generation_max_latency_ms: number | null;

  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  completion_tokens_per_second: number | null;

  document_count: number | null;
  chunk_count: number | null;
  embedding_count: number | null;
  indexed_chunk_count: number | null;
  question_count: number | null;

  runner_total_ms: number | null;
};

export type RunConfiguration = {
  generation_provider: string | null;
  generation_model: string | null;
  generation_temperature: string | null;

  embedding_provider: string | null;
  embedding_model: string | null;

  chunking_strategy: string | null;
  chunk_size: string | null;
  chunk_overlap: string | null;

  retrieval_strategy: string | null;
  retrieval_top_k: string | null;
};

export type RunArtifact = {
  path: string;
  is_dir: boolean;
  file_size: number | null;
};

export type RunResults = {
  run: ExperimentRun;

  experiment_id: string;
  experiment_name: string;
  experiment_version: number;
  configuration_hash: string;

  mlflow_run_id: string;
  mlflow_experiment_id: string;
  mlflow_status: string;
  mlflow_start_time: string | null;
  mlflow_end_time: string | null;
  artifact_uri: string | null;

  metrics: RunMetrics;
  configuration: RunConfiguration;

  raw_metrics: Record<string, number>;
  parameters: Record<string, string>;
  tags: Record<string, string>;
  artifacts: RunArtifact[];
};