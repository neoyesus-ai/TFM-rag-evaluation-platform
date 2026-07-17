import type {
  AnalyticsSummary,
} from "../../types/analytics";

type RecentRunsProps = {
  summaries: AnalyticsSummary[];
};

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "es-ES",
    {
      dateStyle: "short",
      timeStyle: "short",
    },
  ).format(date);
}

function formatScore(
  value: number | null,
): string {
  if (value === null) {
    return "—";
  }

  return value.toFixed(3);
}

function formatLatency(
  value: number | null,
): string {
  if (value === null) {
    return "—";
  }

  if (value < 1000) {
    return `${Math.round(value)} ms`;
  }

  return `${(value / 1000).toFixed(2)} s`;
}

function RecentRuns({
  summaries,
}: RecentRunsProps) {
  const runs = [...summaries]
    .sort((left, right) => {
      const leftTime =
        left.run_started_at
          ? new Date(
              left.run_started_at,
            ).getTime()
          : 0;

      const rightTime =
        right.run_started_at
          ? new Date(
              right.run_started_at,
            ).getTime()
          : 0;

      return rightTime - leftTime;
    })
    .slice(0, 5);

  return (
    <section className="panel analytics-recent-runs">
      <div className="panel-heading">
        <div>
          <h2>Últimas ejecuciones</h2>

          <p>
            Actividad experimental sincronizada
            con la capa analítica.
          </p>
        </div>

        <span className="analytics-recent-count">
          {runs.length} mostradas
        </span>
      </div>

      <div className="analytics-table-wrapper">
        <table className="analytics-table">
          <thead>
            <tr>
              <th>Experimento</th>
              <th>Configuración</th>
              <th>Overall</th>
              <th>Latencia</th>
              <th>Fecha</th>
            </tr>
          </thead>

          <tbody>
            {runs.map((run) => (
              <tr key={run.run_id}>
                <td>
                  <div className="analytics-run-name">
                    <strong>
                      {run.experiment_name}
                    </strong>

                    <span>
                      Versión{" "}
                      {run.experiment_version}
                    </span>
                  </div>
                </td>

                <td>
                  <div className="analytics-run-config">
                    <strong>
                      {run.generation_model ??
                        "Modelo no definido"}
                    </strong>

                    <span>
                      {run.embedding_model ??
                        "Embedding no definido"}
                    </span>
                  </div>
                </td>

                <td>
                  <span className="analytics-score-value">
                    {formatScore(
                      run.overall_score,
                    )}
                  </span>
                </td>

                <td>
                  {formatLatency(
                    run.generation_mean_latency_ms,
                  )}
                </td>

                <td>
                  {formatDate(
                    run.run_started_at,
                  )}
                </td>
              </tr>
            ))}

            {runs.length === 0 && (
              <tr>
                <td
                  className="analytics-empty-cell"
                  colSpan={5}
                >
                  Todavía no hay ejecuciones
                  analíticas disponibles.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default RecentRuns;
