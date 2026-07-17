import type {
  AnalyticsSummary,
} from "../../types/analytics";

type RecommendationCardProps = {
  summaries: AnalyticsSummary[];
};

function formatScore(
  value: number | null,
): string {
  if (value === null) {
    return "—";
  }

  return value.toFixed(3);
}

function formatValue(
  value: string | number | null,
): string {
  if (
    value === null ||
    value === ""
  ) {
    return "—";
  }

  return String(value);
}

function getConfidence(
  evidenceCount: number,
): {
  label: string;
  className: string;
  description: string;
} {
  if (evidenceCount >= 10) {
    return {
      label: "Alta",
      className:
        "recommendation-confidence-high",
      description:
        "La recomendación se apoya en un histórico amplio.",
    };
  }

  if (evidenceCount >= 3) {
    return {
      label: "Media",
      className:
        "recommendation-confidence-medium",
      description:
        "La recomendación dispone de evidencia suficiente, aunque puede mejorar con más ejecuciones.",
    };
  }

  return {
    label: "Baja",
    className:
      "recommendation-confidence-low",
    description:
      "La recomendación es preliminar porque todavía existen pocas ejecuciones analíticas.",
  };
}

function RecommendationCard({
  summaries,
}: RecommendationCardProps) {
  const eligibleSummaries = summaries
    .filter(
      (summary) =>
        summary.recommendation_score !==
        null,
    )
    .sort(
      (left, right) =>
        (right.recommendation_score ??
          0) -
        (left.recommendation_score ??
          0),
    );

  const best = eligibleSummaries[0];

  if (!best) {
    return (
      <section className="panel analytics-recommendation">
        <div className="panel-heading">
          <div>
            <h2>
              Configuración recomendada
            </h2>

            <p>
              Selección automática basada en
              el histórico experimental.
            </p>
          </div>
        </div>

        <div className="recommendation-empty">
          <strong>
            Sin recomendación disponible
          </strong>

          <p>
            Ejecuta al menos un experimento
            completado para que la plataforma
            pueda calcular una configuración
            recomendada.
          </p>
        </div>
      </section>
    );
  }

  const confidence = getConfidence(
    eligibleSummaries.length,
  );

  return (
    <section className="panel analytics-recommendation">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">
            Apoyo a la decisión
          </span>

          <h2>
            Configuración recomendada
          </h2>

          <p>
            Ejecución con la mayor
            puntuación de recomendación del
            histórico analítico.
          </p>
        </div>

        <div className="recommendation-score-panel">
          <span>
            Recommendation Score
          </span>

          <strong>
            {formatScore(
              best.recommendation_score,
            )}
          </strong>
        </div>
      </div>

      <div className="recommendation-highlight">
        <div>
          <span>
            Experimento seleccionado
          </span>

          <strong>
            {best.experiment_name}
          </strong>

          <small>
            Versión{" "}
            {best.experiment_version}
          </small>
        </div>

        <div
          className={[
            "recommendation-confidence",
            confidence.className,
          ].join(" ")}
        >
          <span>Confianza</span>
          <strong>
            {confidence.label}
          </strong>
          <small>
            {eligibleSummaries.length}{" "}
            ejecución
            {eligibleSummaries.length ===
            1
              ? ""
              : "es"}{" "}
            analizada
            {eligibleSummaries.length ===
            1
              ? ""
              : "s"}
          </small>
        </div>
      </div>

      <div className="recommendation-grid">
        <div>
          <span>Modelo generativo</span>

          <strong>
            {formatValue(
              best.generation_model,
            )}
          </strong>
        </div>

        <div>
          <span>
            Modelo de embeddings
          </span>

          <strong>
            {formatValue(
              best.embedding_model,
            )}
          </strong>
        </div>

        <div>
          <span>Chunk size</span>

          <strong>
            {formatValue(
              best.chunk_size,
            )}
          </strong>
        </div>

        <div>
          <span>Chunk overlap</span>

          <strong>
            {formatValue(
              best.chunk_overlap,
            )}
          </strong>
        </div>

        <div>
          <span>Top-K</span>

          <strong>
            {formatValue(
              best.retrieval_top_k,
            )}
          </strong>
        </div>

        <div>
          <span>Overall Score</span>

          <strong>
            {formatScore(
              best.overall_score,
            )}
          </strong>
        </div>

        <div>
          <span>Groundedness</span>

          <strong>
            {formatScore(
              best.groundedness,
            )}
          </strong>
        </div>

        <div>
          <span>Answer F1</span>

          <strong>
            {formatScore(
              best.answer_f1,
            )}
          </strong>
        </div>
      </div>

      <div className="recommendation-explanation">
        <strong>
          Interpretación
        </strong>

        <p>
          Se recomienda esta configuración
          porque obtiene la mejor combinación
          histórica entre calidad de respuesta
          y eficiencia computacional según el
          índice de recomendación definido por
          la plataforma.
        </p>

        <small>
          {confidence.description}
        </small>
      </div>
    </section>
  );
}

export default RecommendationCard;
