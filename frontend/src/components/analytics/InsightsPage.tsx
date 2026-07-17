import ComingSoonView from "../layout/ComingSoonView";

function InsightsPage() {
  return (
    <ComingSoonView
      eyebrow="Análisis del histórico"
      title="Insights"
      description="Identificación de patrones, relaciones y tendencias entre configuraciones y resultados experimentales."
      plannedFeatures={[
        "Impacto del chunk size",
        "Rendimiento por modelo generativo",
        "Rendimiento por embeddings",
        "Relación entre Top-K y calidad",
        "Relación calidad y latencia",
        "Detección de configuraciones dominadas",
      ]}
    />
  );
}

export default InsightsPage;
