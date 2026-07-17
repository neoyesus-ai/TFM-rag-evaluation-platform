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
import RunComparator from "./RunComparator";

function ComparatorPage() {
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
            : "No se pudo cargar el comparador.",
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadSummaries();
  }, [loadSummaries]);

  if (loading) {
    return (
      <section className="analytics-loading">
        Cargando ejecuciones…
      </section>
    );
  }

  if (error) {
    return (
      <section className="analytics-error">
        <div>
          <strong>
            No se pudo cargar el comparador
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
            Análisis comparativo
          </span>

          <h1>Comparador</h1>

          <p>
            Compara directamente dos
            ejecuciones y determina qué
            configuración destaca en
            calidad y eficiencia.
          </p>
        </div>
      </header>

      <RunComparator
        summaries={summaries}
      />
    </>
  );
}

export default ComparatorPage;
