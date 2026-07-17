type ServiceStatus = {
  status: string;
  detail: string | null;
};

type SystemStatus = {
  status: string;
  services: Record<string, ServiceStatus>;
};

type RecentRun = {
  id: string;
  status: string;
  started_at: string | null;
  duration_ms: number | null;
};

type OperationalDashboardProps = {
  corpusCount: number;
  documentCount: number;
  datasetCount: number;
  questionCount: number;
  experimentCount: number;
  versionCount: number;
  runCount: number;
  completedRunCount: number;
  failedRunCount: number;
  averageDurationMs: number | null;
  recentRuns: RecentRun[];
  systemStatus: SystemStatus | null;
  loading: boolean;
  onRefresh: () => void;
  onOpenRuns: () => void;
  onOpenRun: (runId: string) => void;
};

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "es-ES",
    {
      dateStyle: "short",
      timeStyle: "short",
    },
  ).format(date);
}

function formatDuration(
  value: number | null,
): string {
  if (value === null) {
    return "—";
  }

  if (value < 1000) {
    return `${Math.round(value)} ms`;
  }

  return `${(value / 1000).toFixed(2)} s`;
}

function translateStatus(
  status: string,
): string {
  const labels: Record<string, string> = {
    completed: "Completado",
    failed: "Fallido",
    running: "En ejecución",
    pending: "Pendiente",
    ready: "Preparado",
    ok: "Disponible",
  };

  return labels[status] ?? status;
}

function OperationalDashboard({
  corpusCount,
  documentCount,
  datasetCount,
  questionCount,
  experimentCount,
  versionCount,
  runCount,
  completedRunCount,
  failedRunCount,
  averageDurationMs,
  recentRuns,
  systemStatus,
  loading,
  onRefresh,
  onOpenRuns,
  onOpenRun,
}: OperationalDashboardProps) {
  const successRate =
    runCount > 0
      ? Math.round(
          (
            completedRunCount /
            runCount
          ) * 100,
        )
      : null;

  const availableServices =
    Object.values(
      systemStatus?.services ?? {},
    ).filter(
      (service) =>
        service.status === "ok",
    ).length;

  const totalServices =
    Object.keys(
      systemStatus?.services ?? {},
    ).length;

  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow">
            Consola operativa
          </span>

          <h1>Panel general</h1>

          <p>
            Estado de los recursos,
            servicios y ejecuciones de la
            plataforma experimental.
          </p>
        </div>

        <button
          className="secondary-button"
          type="button"
          disabled={loading}
          onClick={onRefresh}
        >
          Actualizar
        </button>
      </header>

      <section className="operational-metric-grid">
        <article className="operational-metric-card">
          <span>Documentos</span>
          <strong>{documentCount}</strong>
          <small>
            archivos documentales
          </small>
        </article>

        <article className="operational-metric-card">
          <span>Corpora</span>
          <strong>{corpusCount}</strong>
          <small>
            colecciones documentales
          </small>
        </article>

        <article className="operational-metric-card">
          <span>Datasets</span>
          <strong>{datasetCount}</strong>
          <small>
            conjuntos de evaluación
          </small>
        </article>

        <article className="operational-metric-card">
          <span>Preguntas</span>
          <strong>{questionCount}</strong>
          <small>
            casos de evaluación
          </small>
        </article>

        <article className="operational-metric-card">
          <span>Experimentos</span>
          <strong>{experimentCount}</strong>
          <small>
            configuraciones registradas
          </small>
        </article>

        <article className="operational-metric-card">
          <span>Versiones</span>
          <strong>{versionCount}</strong>
          <small>
            versiones experimentales
          </small>
        </article>

        <article className="operational-metric-card">
          <span>Ejecuciones</span>
          <strong>{runCount}</strong>
          <small>
            {completedRunCount} completadas
            {" · "}
            {failedRunCount} fallidas
          </small>
        </article>

        <article className="operational-metric-card operational-metric-highlight">
          <span>Tasa de éxito</span>
          <strong>
            {successRate === null
              ? "—"
              : `${successRate} %`}
          </strong>
          <small>
            ejecuciones completadas
          </small>
        </article>
      </section>

      <section className="content-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>
                Actividad reciente
              </h2>

              <p>
                Últimas ejecuciones del
                motor experimental.
              </p>
            </div>

            <button
              className="text-button"
              type="button"
              onClick={onOpenRuns}
            >
              Ver todas
            </button>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Estado</th>
                  <th>Duración</th>
                  <th>Inicio</th>
                  <th>Acción</th>
                </tr>
              </thead>

              <tbody>
                {recentRuns.map(
                  (run) => (
                    <tr key={run.id}>
                      <td>
                        <span
                          className={[
                            "status-badge",
                            `status-${run.status}`,
                          ].join(" ")}
                        >
                          {translateStatus(
                            run.status,
                          )}
                        </span>
                      </td>

                      <td>
                        {formatDuration(
                          run.duration_ms,
                        )}
                      </td>

                      <td>
                        {formatDate(
                          run.started_at,
                        )}
                      </td>

                      <td>
                        {run.status ===
                        "completed" ? (
                          <button
                            className="table-action-button"
                            type="button"
                            onClick={() =>
                              onOpenRun(run.id)
                            }
                          >
                            Ver resultados
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ),
                )}

                {recentRuns.length === 0 && (
                  <tr>
                    <td
                      className="empty-cell"
                      colSpan={4}
                    >
                      Todavía no hay
                      ejecuciones.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>
                Estado de servicios
              </h2>

              <p>
                Disponibilidad de la
                infraestructura.
              </p>
            </div>
          </div>

          <div className="service-list">
            {Object.entries(
              systemStatus?.services ?? {},
            ).map(
              ([name, service]) => (
                <div
                  className="service-row"
                  key={name}
                >
                  <div>
                    <strong>{name}</strong>

                    <small>
                      {service.detail ??
                        "Sin incidencias"}
                    </small>
                  </div>

                  <span
                    className={[
                      "status-badge",
                      `status-${service.status}`,
                    ].join(" ")}
                  >
                    {translateStatus(
                      service.status,
                    )}
                  </span>
                </div>
              ),
            )}

            {totalServices === 0 && (
              <p className="empty-message">
                No se ha podido consultar
                la infraestructura.
              </p>
            )}
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>
              Resumen operativo
            </h2>

            <p>
              Indicadores generales del
              entorno experimental.
            </p>
          </div>
        </div>

        <div className="compact-metrics">
          <div>
            <span>
              Duración media
            </span>

            <strong>
              {formatDuration(
                averageDurationMs,
              )}
            </strong>
          </div>

          <div>
            <span>
              Servicios disponibles
            </span>

            <strong>
              {availableServices}
              {totalServices > 0
                ? ` / ${totalServices}`
                : ""}
            </strong>
          </div>

          <div>
            <span>
              Estado global
            </span>

            <strong>
              {systemStatus?.status ===
              "ok"
                ? "Operativo"
                : "Con incidencias"}
            </strong>
          </div>
        </div>
      </section>
    </>
  );
}

export default OperationalDashboard;
