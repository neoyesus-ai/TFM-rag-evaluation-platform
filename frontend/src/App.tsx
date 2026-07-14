import { useEffect, useState } from "react";
import axios from "axios";

type ServiceStatus = {
  status: "ok" | "error";
  detail: string | null;
};

type SystemStatus = {
  status: "ok" | "error";
  services: Record<string, ServiceStatus>;
};

function App() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    axios
      .get<SystemStatus>("/api/v1/system/status")
      .then((response) => {
        setSystemStatus(response.data);
      })
      .catch((requestError) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "No se pudo conectar con FastAPI."
        );
      });
  }, []);

  return (
    <main className="page">
      <header className="header">
        <div>
          <p className="eyebrow">Trabajo Fin de Máster</p>
          <h1>RAG Evaluation Platform</h1>
          <p>
            Plataforma experimental para gestionar corpus, documentos,
            consultas RAG y evaluación de configuraciones.
          </p>
        </div>
      </header>

      <section className="panel">
        <h2>Estado del sistema</h2>

        {error && <p className="error">{error}</p>}

        {!systemStatus && !error && <p>Cargando servicios…</p>}

        {systemStatus && (
          <>
            <p>
              Estado general:{" "}
              <strong className={systemStatus.status}>
                {systemStatus.status.toUpperCase()}
              </strong>
            </p>

            <div className="service-grid">
              {Object.entries(systemStatus.services).map(([name, service]) => (
                <article className="service-card" key={name}>
                  <h3>{name}</h3>
                  <span className={service.status}>
                    {service.status.toUpperCase()}
                  </span>
                  {service.detail && <p>{service.detail}</p>}
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

export default App;
