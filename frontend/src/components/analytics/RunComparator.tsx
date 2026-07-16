import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  AnalyticsSummary,
} from "../../types/analytics";

type RunComparatorProps = {
  summaries: AnalyticsSummary[];
};

type ComparisonMetric = {
  key: string;
  label: string;
  left: number | null;
  right: number | null;
  preference: "higher" | "lower";
  format: (
    value: number | null,
  ) => string;
};

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

function formatInteger(
  value: number | null,
): string {
  if (value === null) {
    return "—";
  }

  return Math.round(value).toLocaleString(
    "es-ES",
  );
}

function getWinner(
  left: number | null,
  right: number | null,
  preference: "higher" | "lower",
): "left" | "right" | "tie" | "none" {
  if (
    left === null ||
    right === null
  ) {
    return "none";
  }

  if (left === right) {
    return "tie";
  }

  if (preference === "higher") {
    return left > right
      ? "left"
      : "right";
  }

  return left < right
    ? "left"
    : "right";
}

function calculateDifference(
  left: number | null,
  right: number | null,
): string {
  if (
    left === null ||
    right === null
  ) {
    return "—";
  }

  const difference = right - left;

  if (difference === 0) {
    return "0";
  }

  const sign =
    difference > 0 ? "+" : "";

  return `${sign}${difference.toFixed(3)}`;
}

function buildRunLabel(
  summary: AnalyticsSummary,
): string {
  return [
    summary.experiment_name,
    `v${summary.experiment_version}`,
    summary.generation_model ??
      "modelo no definido",
  ].join(" · ");
}

function RunComparator({
  summaries,
}: RunComparatorProps) {
  const availableRuns = useMemo(
    () =>
      [...summaries].sort(
        (left, right) => {
          const leftDate =
            left.run_started_at
              ? new Date(
                  left.run_started_at,
                ).getTime()
              : 0;

          const rightDate =
            right.run_started_at
              ? new Date(
                  right.run_started_at,
                ).getTime()
              : 0;

          return rightDate - leftDate;
        },
      ),
    [summaries],
  );

  const [
    leftRunId,
    setLeftRunId,
  ] = useState("");

  const [
    rightRunId,
    setRightRunId,
  ] = useState("");

  useEffect(() => {
    if (
      availableRuns.length > 0 &&
      !leftRunId
    ) {
      setLeftRunId(
        availableRuns[0].run_id,
      );
    }

    if (
      availableRuns.length > 1 &&
      !rightRunId
    ) {
      setRightRunId(
        availableRuns[1].run_id,
      );
    }
  }, [
    availableRuns,
    leftRunId,
    rightRunId,
  ]);

  const leftRun =
    availableRuns.find(
      (summary) =>
        summary.run_id === leftRunId,
    ) ?? null;

  const rightRun =
    availableRuns.find(
      (summary) =>
        summary.run_id === rightRunId,
    ) ?? null;

  const metrics: ComparisonMetric[] =
    leftRun && rightRun
      ? [
          {
            key: "recommendation",
            label:
              "Recommendation Score",
            left:
              leftRun.recommendation_score,
            right:
              rightRun.recommendation_score,
            preference: "higher",
            format: formatScore,
          },
          {
            key: "overall",
            label: "Overall Score",
            left:
              leftRun.overall_score,
            right:
              rightRun.overall_score,
            preference: "higher",
            format: formatScore,
          },
          {
            key: "groundedness",
            label: "Groundedness",
            left:
              leftRun.groundedness,
            right:
              rightRun.groundedness,
            preference: "higher",
            format: formatScore,
          },
          {
            key: "answer-f1",
            label: "Answer F1",
            left:
              leftRun.answer_f1,
            right:
              rightRun.answer_f1,
            preference: "higher",
            format: formatScore,
          },
          {
            key: "latency",
            label:
              "Latencia de generación",
            left:
              leftRun
                .generation_mean_latency_ms,
            right:
              rightRun
                .generation_mean_latency_ms,
            preference: "lower",
            format: formatLatency,
          },
          {
            key: "tokens",
            label: "Tokens totales",
            left:
              leftRun.total_tokens,
            right:
              rightRun.total_tokens,
            preference: "lower",
            format: formatInteger,
          },
        ]
      : [];

  const leftWins = metrics.filter(
    (metric) =>
      getWinner(
        metric.left,
        metric.right,
        metric.preference,
      ) === "left",
  ).length;

  const rightWins = metrics.filter(
    (metric) =>
      getWinner(
        metric.left,
        metric.right,
        metric.preference,
      ) === "right",
  ).length;

  const overallWinner =
    leftWins === rightWins
      ? "tie"
      : leftWins > rightWins
        ? "left"
        : "right";

  if (availableRuns.length < 2) {
    return (
      <section className="panel analytics-comparator">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">
              Análisis comparativo
            </span>

            <h2>
              Comparador de ejecuciones
            </h2>

            <p>
              Compara calidad, latencia y
              consumo entre dos
              configuraciones RAG.
            </p>
          </div>
        </div>

        <div className="analytics-comparator-empty">
          <strong>
            Se necesitan dos ejecuciones
          </strong>

          <p>
            Ejecuta al menos dos
            configuraciones distintas para
            habilitar el comparador.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel analytics-comparator">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">
            Análisis comparativo
          </span>

          <h2>
            Comparador de ejecuciones
          </h2>

          <p>
            Comparación directa de calidad,
            eficiencia y configuración.
          </p>
        </div>
      </div>

      <div className="analytics-comparator-selectors">
        <label>
          Ejecución A

          <select
            value={leftRunId}
            onChange={(event) =>
              setLeftRunId(
                event.target.value,
              )
            }
          >
            {availableRuns.map(
              (summary) => (
                <option
                  key={summary.run_id}
                  value={summary.run_id}
                  disabled={
                    summary.run_id ===
                    rightRunId
                  }
                >
                  {buildRunLabel(
                    summary,
                  )}
                </option>
              ),
            )}
          </select>
        </label>

        <div className="analytics-comparator-versus">
          VS
        </div>

        <label>
          Ejecución B

          <select
            value={rightRunId}
            onChange={(event) =>
              setRightRunId(
                event.target.value,
              )
            }
          >
            {availableRuns.map(
              (summary) => (
                <option
                  key={summary.run_id}
                  value={summary.run_id}
                  disabled={
                    summary.run_id ===
                    leftRunId
                  }
                >
                  {buildRunLabel(
                    summary,
                  )}
                </option>
              ),
            )}
          </select>
        </label>
      </div>

      {leftRun && rightRun && (
        <>
          <div className="analytics-comparator-summary">
            <article
              className={
                overallWinner === "left"
                  ? "comparison-run-card comparison-run-winner"
                  : "comparison-run-card"
              }
            >
              <span>Ejecución A</span>

              <strong>
                {leftRun.experiment_name}
              </strong>

              <small>
                {leftRun.generation_model ??
                  "Modelo no definido"}
              </small>

              <div>
                {leftWins} métricas
                favorables
              </div>
            </article>

            <div className="comparison-result">
              {overallWinner === "tie"
                ? "Empate"
                : overallWinner === "left"
                  ? "Gana A"
                  : "Gana B"}
            </div>

            <article
              className={
                overallWinner === "right"
                  ? "comparison-run-card comparison-run-winner"
                  : "comparison-run-card"
              }
            >
              <span>Ejecución B</span>

              <strong>
                {rightRun.experiment_name}
              </strong>

              <small>
                {rightRun.generation_model ??
                  "Modelo no definido"}
              </small>

              <div>
                {rightWins} métricas
                favorables
              </div>
            </article>
          </div>

          <div className="analytics-comparison-table-wrapper">
            <table className="analytics-comparison-table">
              <thead>
                <tr>
                  <th>Métrica</th>
                  <th>Ejecución A</th>
                  <th>Ejecución B</th>
                  <th>Diferencia B − A</th>
                  <th>Mejor</th>
                </tr>
              </thead>

              <tbody>
                {metrics.map((metric) => {
                  const winner =
                    getWinner(
                      metric.left,
                      metric.right,
                      metric.preference,
                    );

                  return (
                    <tr key={metric.key}>
                      <td>
                        <strong>
                          {metric.label}
                        </strong>
                      </td>

                      <td
                        className={
                          winner === "left"
                            ? "comparison-best-value"
                            : ""
                        }
                      >
                        {metric.format(
                          metric.left,
                        )}
                      </td>

                      <td
                        className={
                          winner === "right"
                            ? "comparison-best-value"
                            : ""
                        }
                      >
                        {metric.format(
                          metric.right,
                        )}
                      </td>

                      <td>
                        {calculateDifference(
                          metric.left,
                          metric.right,
                        )}
                      </td>

                      <td>
                        {winner === "left"
                          ? "A"
                          : winner === "right"
                            ? "B"
                            : winner === "tie"
                              ? "Empate"
                              : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="analytics-configuration-comparison">
            <article>
              <span>
                Configuración A
              </span>

              <dl>
                <div>
                  <dt>Modelo</dt>
                  <dd>
                    {leftRun.generation_model ??
                      "—"}
                  </dd>
                </div>

                <div>
                  <dt>Embedding</dt>
                  <dd>
                    {leftRun.embedding_model ??
                      "—"}
                  </dd>
                </div>

                <div>
                  <dt>Chunk</dt>
                  <dd>
                    {leftRun.chunk_size ??
                      "—"}
                  </dd>
                </div>

                <div>
                  <dt>Overlap</dt>
                  <dd>
                    {leftRun.chunk_overlap ??
                      "—"}
                  </dd>
                </div>

                <div>
                  <dt>Top-K</dt>
                  <dd>
                    {leftRun
                      .retrieval_top_k ??
                      "—"}
                  </dd>
                </div>
              </dl>
            </article>

            <article>
              <span>
                Configuración B
              </span>

              <dl>
                <div>
                  <dt>Modelo</dt>
                  <dd>
                    {rightRun.generation_model ??
                      "—"}
                  </dd>
                </div>

                <div>
                  <dt>Embedding</dt>
                  <dd>
                    {rightRun.embedding_model ??
                      "—"}
                  </dd>
                </div>

                <div>
                  <dt>Chunk</dt>
                  <dd>
                    {rightRun.chunk_size ??
                      "—"}
                  </dd>
                </div>

                <div>
                  <dt>Overlap</dt>
                  <dd>
                    {rightRun.chunk_overlap ??
                      "—"}
                  </dd>
                </div>

                <div>
                  <dt>Top-K</dt>
                  <dd>
                    {rightRun
                      .retrieval_top_k ??
                      "—"}
                  </dd>
                </div>
              </dl>
            </article>
          </div>
        </>
      )}
    </section>
  );
}

export default RunComparator;
