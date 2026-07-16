import type {
  AnalyticsSummary,
} from "../../types/analytics";

type LeaderboardProps = {
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

function Leaderboard({
  summaries,
}: LeaderboardProps) {
  const entries = [...summaries]
    .filter(
      (summary) =>
        summary.recommendation_score !== null,
    )
    .sort(
      (left, right) =>
        (right.recommendation_score ?? 0) -
        (left.recommendation_score ?? 0),
    )
    .slice(0, 5);

  return (
    <section className="panel analytics-leaderboard">
      <div className="panel-heading">
        <div>
          <h2>Leaderboard</h2>

          <p>
            Mejores ejecuciones por puntuación
            de recomendación.
          </p>
        </div>
      </div>

      <div className="analytics-leaderboard-list">
        {entries.map(
          (entry, index) => (
            <article
              className="analytics-leaderboard-row"
              key={entry.run_id}
            >
              <div className="analytics-rank">
                {index + 1}
              </div>

              <div className="analytics-leaderboard-main">
                <strong>
                  {entry.experiment_name}
                </strong>

                <span>
                  v{entry.experiment_version}
                  {" · "}
                  {entry.generation_model ??
                    "Modelo no definido"}
                </span>
              </div>

              <div className="analytics-leaderboard-config">
                <span>
                  Chunk{" "}
                  {entry.chunk_size ?? "—"}
                </span>

                <span>
                  Top-K{" "}
                  {entry.retrieval_top_k ?? "—"}
                </span>
              </div>

              <div className="analytics-leaderboard-metrics">
                <div>
                  <span>Recommendation</span>
                  <strong>
                    {formatScore(
                      entry.recommendation_score,
                    )}
                  </strong>
                </div>

                <div>
                  <span>Overall</span>
                  <strong>
                    {formatScore(
                      entry.overall_score,
                    )}
                  </strong>
                </div>
              </div>
            </article>
          ),
        )}

        {entries.length === 0 && (
          <p className="empty-message">
            Todavía no hay ejecuciones analíticas
            suficientes para generar el
            leaderboard.
          </p>
        )}
      </div>
    </section>
  );
}

export default Leaderboard;
