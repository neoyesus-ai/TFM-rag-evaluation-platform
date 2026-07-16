export type AnalyticsDashboard = {
  total_runs: number;
  completed_runs: number;
  failed_runs: number;
  success_rate: number | null;

  best_overall_score: number | null;
  mean_overall_score: number | null;
  best_groundedness: number | null;
  mean_groundedness: number | null;
  mean_answer_f1: number | null;

  mean_generation_latency_ms: number | null;
  mean_runner_total_ms: number | null;
  mean_total_tokens: number | null;
  mean_recommendation_score: number | null;

  latest_run_at: string | null;
};

export type AnalyticsSummary = {
  run_id: string;
  experiment_name: string;
  experiment_version: number;

  generation_model: string | null;
  embedding_model: string | null;

  chunk_size: number | null;
  chunk_overlap: number | null;
  retrieval_top_k: number | null;

  overall_score: number | null;
  groundedness: number | null;
  answer_f1: number | null;

  generation_mean_latency_ms: number | null;
  total_tokens: number | null;
  recommendation_score: number | null;

  run_started_at: string | null;
  run_finished_at: string | null;
};

export type AnalyticsDashboardData = {
  dashboard: AnalyticsDashboard;
  summaries: AnalyticsSummary[];
};

export type AnalyticsKpi = {
  key: string;
  label: string;
  value: string;
  description: string;
  trend?: string | null;
  emphasis?: "primary" | "success" | "warning";
};

export type AnalyticsLeaderboardEntry = {
  position: number;
  runId: string;
  experimentName: string;
  experimentVersion: number;

  generationModel: string | null;
  embeddingModel: string | null;

  overallScore: number | null;
  groundedness: number | null;
  answerF1: number | null;
  recommendationScore: number | null;
};

export type AnalyticsRecommendation = {
  runId: string;
  experimentName: string;
  experimentVersion: number;

  generationModel: string | null;
  embeddingModel: string | null;

  chunkSize: number | null;
  chunkOverlap: number | null;
  retrievalTopK: number | null;

  overallScore: number | null;
  groundedness: number | null;
  answerF1: number | null;
  recommendationScore: number | null;

  evidenceCount: number;
  confidence: "low" | "medium" | "high";
};
