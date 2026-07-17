import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  getAnalyticsData,
} from "../../services/analytics";
import type {
  AnalyticsDashboardData,
} from "../../types/analytics";
import KPIGrid from "./KPIGrid";
import Leaderboard from "./Leaderboard";
import RecentRuns from "./RecentRuns";
import RecommendationCard from "./RecommendationCard";
import "./analytics-dashboard.css";

function AnalyticsDashboard() {
  const [
    data,
    setData,
  ] = useState<
    AnalyticsDashboardData | null
  >(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState<string | null>(null);

  const loadAnalytics =
    useCallback(async () => {
      setLoading(true);
      setError(null);

      try {
        const analyticsData =
          await getAnalyticsData();

        setData(analyticsData);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : (
                "No se pudieron cargar "
                + "los datos analíticos."
              ),
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  if (loading) {
    return (
      <section className="analytics-loading">
        Cargando indicadores analíticos…
      </section>
    );
  }

  if (error) {
    return (
      <section className="analytics-error">
        <div>
          <strong>
            No se pudo cargar Analytics
          </strong>

          <p>{error}</p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={() =>
            void loadAnalytics()
          }
        >
          Reintentar
        </button>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="analytics-empty">
        No hay información analítica
        disponible.
      </section>
    );
  }

  return (
    <section className="analytics-dashboard">
      <header className="analytics-dashboard-header">
        <div>
          <span className="eyebrow">
            RAG Analytics Lab
          </span>

          <h2>
            Rendimiento experimental
          </h2>

          <p>
            Indicadores agregados calculados
            a partir del histórico de
            ejecuciones persistido en
            PostgreSQL.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={() =>
            void loadAnalytics()
          }
        >
          Actualizar indicadores
        </button>
      </header>

      <KPIGrid
        dashboard={data.dashboard}
      />

      <RecommendationCard
        summaries={data.summaries}
      />

      <div className="analytics-dashboard-columns">
        <Leaderboard
          summaries={data.summaries}
        />

        <RecentRuns
          summaries={data.summaries}
        />
      </div>

      <section className="analytics-summary-note">
        <div>
          <span>
            Ejecuciones analizadas
          </span>

          <strong>
            {data.summaries.length}
          </strong>
        </div>

        <p>
          Actualmente el histórico analítico
          contiene{" "}
          {data.summaries.length} ejecución
          {data.summaries.length === 1
            ? ""
            : "es"}{" "}
          sincronizada
          {data.summaries.length === 1
            ? ""
            : "s"}{" "}
          con PostgreSQL.
        </p>
      </section>
    </section>
  );
}

export default AnalyticsDashboard;
