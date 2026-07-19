import {
  useMemo,
  useState,
} from "react";

import type {
  AnalyticsSummary,
} from "../../types/analytics";

type LeaderboardProps = {
  summaries: AnalyticsSummary[];
};

type RankingMetric =
  | "recommendation_score"
  | "overall_score"
  | "groundedness"
  | "answer_f1";

const metricLabels: Record<
  RankingMetric,
  string
> = {
  recommendation_score:
    "Recommendation Score",
  overall_score: "Overall Score",
  groundedness: "Groundedness",
  answer_f1: "Answer F1",
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
  const [
    rankingMetric,
    setRankingMetric,
  ] = useState<RankingMetric>(
    "recommendation_score",
  );

  const entries = useMemo(
    () =>
      [...summaries]
        .filter(
          (summary) =>
            summary[rankingMetric] !== null,
        )
        .sort(
          (left, right) =>
            (right[rankingMetric] ?? 0) -
            (left[rankingMetric] ?? 0),
        )
        .slice(0, 10),
    [rankingMetric, summaries],
  );

  let previousScore: number | null = null;
  let previousPosition = 0;

  return (
    <section className="panel analytics-leaderboard">
      <div className="panel-heading">
        <div>
          <h2>Leaderboard</h2>

          <p>
            Mejores ejecuciones según la
            métrica seleccionada.
          </p>
        </div>

        <label>
          Ordenar por

          <select
            value={rankingMetric}
            onChange={(event) =>
              setRankingMetric(
                event.target
                  .value as RankingMetric,
              )
            }
          >
            {Object.entries(
              metricLabels,
            ).map(([key, label]) => (
              <option
                key={key}
                value={key}
              >
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="analytics-leaderboard-list">
        {entries.map(
          (entry, index) => {
            const currentScore =
              entry[rankingMetric];

            const position =
              currentScore === previousScore
                ? previousPosition
                : index + 1;

            previousScore = currentScore;
            previousPosition = position;

            return (
              <article
                className="analytics-leaderboard-row"
                key={entry.run_id}
              >
                <div className="analytics-rank">
                  {position}
                </div>

                <div className="analytics-leaderboard-main">
                  <strong>
                    {entry.experiment_name}
                  </strong>

                  <span>
                    v
                    {
                      entry.experiment_version
                    }
                    {" · "}
                    {entry.generation_model ??
                      "Modelo no definido"}
                  </span>

                  <small>
                    {entry.embedding_model ??
                      "Embedding no definido"}
                  </small>
                </div>

                <div className="analytics-leaderboard-config">
                  <span>
                    Chunk{" "}
                    {entry.chunk_size ?? "—"}
                  </span>

                  <span>
                    Overlap{" "}
                    {entry.chunk_overlap ??
                      "—"}
                  </span>

                  <span>
                    Top-K{" "}
                    {entry.retrieval_top_k ??
                      "—"}
                  </span>
                </div>

                <div className="analytics-leaderboard-metrics">
                  <div>
                    <span>
                      {
                        metricLabels[
                          rankingMetric
                        ]
                      }
                    </span>

                    <strong>
                      {formatScore(
                        currentScore,
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

                  <div>
                    <span>
                      Groundedness
                    </span>

                    <strong>
                      {formatScore(
                        entry.groundedness,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Answer F1</span>

                    <strong>
                      {formatScore(
                        entry.answer_f1,
                      )}
                    </strong>
                  </div>
                </div>
              </article>
            );
          },
        )}

        {entries.length === 0 && (
          <p className="empty-message">
            No existen ejecuciones con
            resultados para la métrica
            seleccionada.
          </p>
        )}
      </div>
    </section>
  );
}

export default Leaderboard;