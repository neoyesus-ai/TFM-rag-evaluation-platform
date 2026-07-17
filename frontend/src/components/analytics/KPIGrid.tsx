import KPICard from "./KPICard";
import type { AnalyticsDashboard } from "../../types/analytics";

type Props = {
  dashboard: AnalyticsDashboard;
};

function formatNumber(
  value: number | null,
  digits = 2,
): string {
  if (value === null) {
    return "—";
  }

  return value.toFixed(digits);
}

function KPIGrid({
  dashboard,
}: Props) {
  return (
    <section className="analytics-kpi-grid">

      <KPICard
        label="Overall Score"
        value={formatNumber(
          dashboard.mean_overall_score,
        )}
        description="Media histórica"
        emphasis="primary"
      />

      <KPICard
        label="Groundedness"
        value={formatNumber(
          dashboard.mean_groundedness,
        )}
        description="Media histórica"
        emphasis="success"
      />

      <KPICard
        label="Answer F1"
        value={formatNumber(
          dashboard.mean_answer_f1,
        )}
        description="Media histórica"
      />

      <KPICard
        label="Latencia"
        value={
          dashboard.mean_generation_latency_ms === null
            ? "—"
            : `${Math.round(
                dashboard.mean_generation_latency_ms,
              )} ms`
        }
        description="Generación"
      />

      <KPICard
        label="Tokens"
        value={
          dashboard.mean_total_tokens === null
            ? "—"
            : Math.round(
                dashboard.mean_total_tokens,
              ).toString()
        }
        description="Media"
      />

      <KPICard
        label="Runs"
        value={dashboard.total_runs.toString()}
        description="Ejecuciones"
      />

      <KPICard
        label="Éxito"
        value={
          dashboard.success_rate === null
            ? "—"
            : `${(
                dashboard.success_rate * 100
              ).toFixed(0)} %`
        }
        description="Runs completados"
        emphasis="success"
      />

      <KPICard
        label="Recommendation"
        value={formatNumber(
          dashboard.mean_recommendation_score,
        )}
        description="Score medio"
        emphasis="warning"
      />

    </section>
  );
}

export default KPIGrid;
