import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getSummaries,
} from "../../services/analytics";
import type {
  AnalyticsSummary,
} from "../../types/analytics";

type NumericField =
  | "chunk_size"
  | "retrieval_top_k"
  | "overall_score"
  | "generation_mean_latency_ms";

type GroupInsight = {
  label: string;
  value: string;
  meanScore: number;
  evidenceCount: number;
};

function formatScore(
  value: number | null,
): string {
  return value === null
    ? "—"
    : value.toFixed(3);
}

function formatLatency(
  value: number | null,
): string {
  if (value === null) {
    return "—";
  }

  return value < 1000
    ? `${Math.round(value)} ms`
    : `${(value / 1000).toFixed(2)} s`;
}

function mean(
  values: number[],
): number | null {
  if (values.length === 0) {
    return null;
  }

  return (
    values.reduce(
      (total, value) => total + value,
      0,
    ) / values.length
  );
}

function correlation(
  summaries: AnalyticsSummary[],
  leftField: NumericField,
  rightField: NumericField,
): number | null {
  const pairs = summaries.flatMap(
    (summary) => {
      const left = summary[leftField];
      const right = summary[rightField];

      if (
        left === null ||
        right === null
      ) {
        return [];
      }

      return [[left, right] as const];
    },
  );

  if (pairs.length < 2) {
    return null;
  }

  const leftMean =
    mean(pairs.map(([left]) => left)) ?? 0;

  const rightMean =
    mean(pairs.map(([, right]) => right)) ??
    0;

  const numerator = pairs.reduce(
    (total, [left, right]) =>
      total +
      (left - leftMean) *
        (right - rightMean),
    0,
  );

  const leftDeviation = Math.sqrt(
    pairs.reduce(
      (total, [left]) =>
        total +
        (left - leftMean) ** 2,
      0,
    ),
  );

  const rightDeviation = Math.sqrt(
    pairs.reduce(
      (total, [, right]) =>
        total +
        (right - rightMean) ** 2,
      0,
    ),
  );

  const denominator =
    leftDeviation * rightDeviation;

  if (denominator === 0) {
    return null;
  }

  return numerator / denominator;
}

function describeCorrelation(
  value: number | null,
): string {
  if (value === null) {
    return "No hay evidencia suficiente";
  }

  const strength =
    Math.abs(value) >= 0.7
      ? "fuerte"
      : Math.abs(value) >= 0.4
        ? "moderada"
        : Math.abs(value) >= 0.2
          ? "débil"
          : "prácticamente inexistente";

  const direction =
    value > 0
      ? "positiva"
      : value < 0
        ? "negativa"
        : "nula";

  return `${strength} y ${direction} (${value.toFixed(2)})`;
}

function findBestGroup(
  summaries: AnalyticsSummary[],
  getGroup: (
    summary: AnalyticsSummary,
  ) => string | number | null,
): GroupInsight | null {
  const groups = new Map<
    string,
    {
      value: string;
      scores: number[];
    }
  >();

  summaries.forEach((summary) => {
    const groupValue = getGroup(summary);

    if (
      groupValue === null ||
      summary.overall_score === null
    ) {
      return;
    }

    const key = String(groupValue);
    const current = groups.get(key) ?? {
      value: key,
      scores: [],
    };

    current.scores.push(
      summary.overall_score,
    );

    groups.set(key, current);
  });

  const rankedGroups = [...groups.values()]
    .map((group) => ({
      label: group.value,
      value: group.value,
      meanScore:
        mean(group.scores) ?? 0,
      evidenceCount:
        group.scores.length,
    }))
    .sort(
      (left, right) =>
        right.meanScore -
        left.meanScore,
    );

  return rankedGroups[0] ?? null;
}

function countDominatedRuns(
  summaries: AnalyticsSummary[],
): number {
  return summaries.filter((candidate) => {
    if (
      candidate.overall_score === null ||
      candidate
        .generation_mean_latency_ms ===
        null
    ) {
      return false;
    }

    const candidateOverall =
      candidate.overall_score;

    const candidateLatency =
      candidate
        .generation_mean_latency_ms;

    return summaries.some((other) => {
      if (
        other.run_id === candidate.run_id ||
        other.overall_score === null ||
        other
          .generation_mean_latency_ms ===
          null
      ) {
        return false;
      }

      const equalOrBetterQuality =
        other.overall_score >=
        candidateOverall;

      const equalOrBetterLatency =
        other
          .generation_mean_latency_ms <=
        candidateLatency;

      const strictlyBetter =
        other.overall_score >
          candidateOverall ||
        other
          .generation_mean_latency_ms <
          candidateLatency;

      return (
        equalOrBetterQuality &&
        equalOrBetterLatency &&
        strictlyBetter
      );
    });
  }).length;
}

function InsightsPage() {
  const [
    summaries,
    setSummaries,
  ] = useState<AnalyticsSummary[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState<string | null>(null);

  const loadSummaries =
    useCallback(async () => {
      setLoading(true);
      setError(null);

      try {
        setSummaries(
          await getSummaries(),
        );
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "No se pudieron calcular los insights.",
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadSummaries();
  }, [loadSummaries]);

  const analysis = useMemo(() => {
    const bestGenerationModel =
      findBestGroup(
        summaries,
        (summary) =>
          summary.generation_model,
      );

    const bestEmbeddingModel =
      findBestGroup(
        summaries,
        (summary) =>
          summary.embedding_model,
      );

    const bestChunkSize =
      findBestGroup(
        summaries,
        (summary) =>
          summary.chunk_size,
      );

    const bestTopK = findBestGroup(
      summaries,
      (summary) =>
        summary.retrieval_top_k,
    );

    const chunkCorrelation =
      correlation(
        summaries,
        "chunk_size",
        "overall_score",
      );

    const topKCorrelation =
      correlation(
        summaries,
        "retrieval_top_k",
        "overall_score",
      );

    const qualityLatencyCorrelation =
      correlation(
        summaries,
        "overall_score",
        "generation_mean_latency_ms",
      );

    const dominatedRuns =
      countDominatedRuns(summaries);

    const validOverallScores =
      summaries.flatMap((summary) =>
        summary.overall_score === null
          ? []
          : [summary.overall_score],
      );

    const validLatencies =
      summaries.flatMap((summary) =>
        summary
          .generation_mean_latency_ms ===
        null
          ? []
          : [
              summary
                .generation_mean_latency_ms,
            ],
      );

    return {
      bestGenerationModel,
      bestEmbeddingModel,
      bestChunkSize,
      bestTopK,
      chunkCorrelation,
      topKCorrelation,
      qualityLatencyCorrelation,
      dominatedRuns,
      meanOverall:
        mean(validOverallScores),
      meanLatency:
        mean(validLatencies),
    };
  }, [summaries]);

  if (loading) {
    return (
      <section className="analytics-loading">
        Analizando el histórico…
      </section>
    );
  }

  if (error) {
    return (
      <section className="analytics-error">
        <div>
          <strong>
            No se pudieron generar los
            insights
          </strong>

          <p>{error}</p>
        </div>

        <button
          className="secondary-button"
          type="button"
          onClick={() =>
            void loadSummaries()
          }
        >
          Reintentar
        </button>
      </section>
    );
  }

  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow">
            Análisis del histórico
          </span>

          <h1>Insights</h1>

          <p>
            Identificación automática de
            patrones, relaciones y
            configuraciones dominadas.
          </p>
        </div>

        <button
          className="secondary-button"
          type="button"
          onClick={() =>
            void loadSummaries()
          }
        >
          Actualizar
        </button>
      </header>

      {summaries.length === 0 ? (
        <section className="panel">
          <p className="empty-message">
            Todavía no existen ejecuciones
            suficientes para analizar.
          </p>
        </section>
      ) : (
        <>
          <section className="analytics-kpi-grid">
            <article className="panel analytics-kpi-card">
              <span>
                Ejecuciones analizadas
              </span>

              <strong>
                {summaries.length}
              </strong>

              <p>
                Histórico disponible para
                identificar patrones.
              </p>
            </article>

            <article className="panel analytics-kpi-card">
              <span>
                Overall medio
              </span>

              <strong>
                {formatScore(
                  analysis.meanOverall,
                )}
              </strong>

              <p>
                Calidad media del conjunto
                experimental.
              </p>
            </article>

            <article className="panel analytics-kpi-card">
              <span>
                Latencia media
              </span>

              <strong>
                {formatLatency(
                  analysis.meanLatency,
                )}
              </strong>

              <p>
                Tiempo medio de generación.
              </p>
            </article>

            <article className="panel analytics-kpi-card">
              <span>
                Configuraciones dominadas
              </span>

              <strong>
                {analysis.dominatedRuns}
              </strong>

              <p>
                Runs superados en calidad y
                latencia simultáneamente.
              </p>
            </article>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">
                  Mejores configuraciones
                </span>

                <h2>
                  Rendimiento agregado
                </h2>

                <p>
                  Media del Overall Score
                  agrupada por parámetro.
                </p>
              </div>
            </div>

            <div className="analytics-configuration-comparison">
              <article>
                <span>
                  Modelo generativo
                </span>

                <strong>
                  {analysis
                    .bestGenerationModel
                    ?.value ?? "—"}
                </strong>

                <p>
                  Overall medio:{" "}
                  {formatScore(
                    analysis
                      .bestGenerationModel
                      ?.meanScore ?? null,
                  )}
                </p>

                <small>
                  {
                    analysis
                      .bestGenerationModel
                      ?.evidenceCount ?? 0
                  }{" "}
                  ejecuciones
                </small>
              </article>

              <article>
                <span>
                  Modelo de embeddings
                </span>

                <strong>
                  {analysis
                    .bestEmbeddingModel
                    ?.value ?? "—"}
                </strong>

                <p>
                  Overall medio:{" "}
                  {formatScore(
                    analysis
                      .bestEmbeddingModel
                      ?.meanScore ?? null,
                  )}
                </p>

                <small>
                  {
                    analysis
                      .bestEmbeddingModel
                      ?.evidenceCount ?? 0
                  }{" "}
                  ejecuciones
                </small>
              </article>

              <article>
                <span>
                  Mejor chunk size
                </span>

                <strong>
                  {analysis.bestChunkSize
                    ?.value ?? "—"}
                </strong>

                <p>
                  Overall medio:{" "}
                  {formatScore(
                    analysis.bestChunkSize
                      ?.meanScore ?? null,
                  )}
                </p>

                <small>
                  {
                    analysis.bestChunkSize
                      ?.evidenceCount ?? 0
                  }{" "}
                  ejecuciones
                </small>
              </article>

              <article>
                <span>
                  Mejor Top-K
                </span>

                <strong>
                  {analysis.bestTopK
                    ?.value ?? "—"}
                </strong>

                <p>
                  Overall medio:{" "}
                  {formatScore(
                    analysis.bestTopK
                      ?.meanScore ?? null,
                  )}
                </p>

                <small>
                  {analysis.bestTopK
                    ?.evidenceCount ?? 0}{" "}
                  ejecuciones
                </small>
              </article>
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">
                  Relaciones estadísticas
                </span>

                <h2>
                  Correlaciones observadas
                </h2>

                <p>
                  Coeficiente de correlación
                  de Pearson sobre el
                  histórico disponible.
                </p>
              </div>
            </div>

            <div className="analytics-configuration-comparison">
              <article>
                <span>
                  Chunk size y calidad
                </span>

                <strong>
                  {describeCorrelation(
                    analysis.chunkCorrelation,
                  )}
                </strong>

                <p>
                  Indica si aumentar el
                  tamaño de fragmento se
                  relaciona con cambios en
                  Overall Score.
                </p>
              </article>

              <article>
                <span>
                  Top-K y calidad
                </span>

                <strong>
                  {describeCorrelation(
                    analysis.topKCorrelation,
                  )}
                </strong>

                <p>
                  Mide la relación entre
                  documentos recuperados y
                  calidad global.
                </p>
              </article>

              <article>
                <span>
                  Calidad y latencia
                </span>

                <strong>
                  {describeCorrelation(
                    analysis
                      .qualityLatencyCorrelation,
                  )}
                </strong>

                <p>
                  Permite detectar si una
                  mayor calidad implica más
                  tiempo de generación.
                </p>
              </article>
            </div>
          </section>
        </>
      )}
    </>
  );
}

export default InsightsPage;