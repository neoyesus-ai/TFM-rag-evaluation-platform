import AnalyticsDashboard from "./AnalyticsDashboard";

function AnalyticsPage() {
  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow">
            Evaluación experimental
          </span>

          <h1>Resultados</h1>

          <p>
            Análisis de calidad,
            eficiencia y consumo de las
            configuraciones RAG ejecutadas.
          </p>
        </div>
      </header>

      <AnalyticsDashboard />
    </>
  );
}

export default AnalyticsPage;
