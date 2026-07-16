import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  getSummaries,
} from "../../services/analytics";
import type {
  AnalyticsSummary,
} from "../../types/analytics";
import RecommendationCard from "./RecommendationCard";

function RecommendationsPage() {
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

  const loadRecommendations =
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
            : "No se pudieron cargar las recomendaciones.",
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadRecommendations();
  }, [loadRecommendations]);

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
            No se pudieron cargar las
            recomendaciones
          </strong>

          <p>{error}</p>
        </div>

        <button
          className="secondary-button"
          type="button"
          onClick={() =>
            void loadRecommendations()
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
            Apoyo a la decisión
          </span>

          <h1>Recomendaciones</h1>

          <p>
            Selección explicable de la
            configuración RAG con mejor
            equilibrio histórico entre
            calidad y eficiencia.
          </p>
        </div>
      </header>

      <RecommendationCard
        summaries={summaries}
      />
    </>
  );
}

export default RecommendationsPage;
