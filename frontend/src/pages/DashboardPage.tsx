export type DashboardRun = {
  id: string;
  status: string;
  started_at: string | null;
  duration_ms: number | null;
};

export type DashboardServiceStatus = {
  status: string;
  detail: string | null;
};

export type DashboardSystemStatus = {
  status: string;
  services: Record<
    string,
    DashboardServiceStatus
  >;
};

type DashboardPageProps = {
  corpusCount: number;
  datasetCount: number;
  experimentCount: number;
  runCount: number;
  completedRunCount: number;
  failedRunCount: number;
  averageDurationMs: number | null;
  latestRuns: DashboardRun[];
  systemStatus: DashboardSystemStatus | null;
  loading: boolean;
  onRefresh: () => void;
  onOpenRuns: () => void;
  onOpenRunResults: (
    runId: string,
  ) => void;
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
      timeStyle: "medium",
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

function statusLabel(
  status: string,
): string {
  const labels: Record<
    string,
    string
  > = {
    completed: "Completado",
    failed: "Fallido",
    running: "En ejecución",
    pending: "Pendiente",
    ready: "Preparado",
    draft: "Borrador",
    archived: "Archivado",
    ok: "Disponible",
  };

  return labels[status] ?? status;
}

function DashboardPage({
  corpusCount,
  datasetCount,
  experimentCount,
  runCount,
  completedRunCount,
  failedRunCount,
  averageDurationMs,
  latestRuns,
  systemStatus,
  loading,
  onRefresh,
  onOpenRuns,
  onOpenRunResults,
}: DashboardPageProps) {
  const successRate =
    runCount > 0
      ? Math.round(
          (
            completedRunCount /
            runCount
          ) * 100,
        )
      : null;

  const services =
    Object.entries(
      systemStatus?.services ?? {},
    );

  const availableServices =
    services.filter(
      ([, service]) =>
        service.status === "ok",
    ).length;

  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow">
            Laboratorio experimental
          </span>

          <h1>Panel general</h1>

          <p>
            Estado del pipeline RAG,
            recursos experimentales y
            últimas ejecuciones.
          </p>
        </div>

        <button
          className="secondary-button"
          type="button"
          onClick={onRefresh}
          disabled={loading}
        >
          Actualizar
        </button>
      </header>

      <section className="metric-grid">
        <article className="metric-card">
          <span>Corpora</span>

          <strong>
            {corpusCount}
          </strong>

          <small>
            colecciones documentales
          </small>
        </article>

        <article className="metric-card">
          <span>Datasets</span>

          <strong>
            {datasetCount}
          </strong>

          <small>
            conjuntos de evaluación
          </small>
        </article>

        <article className="metric-card">
          <span>Experimentos</span>

          <strong>
            {experimentCount}
          </strong>

          <small>
            configuraciones registradas
          </small>
        </article>

        <article className="metric-card">
          <span>Ejecuciones</span>

          <strong>
            {runCount}
          </strong>

          <small>
            {completedRunCount} completadas
            {" · "}
            {failedRunCount} fallidas
          </small>
        </article>
      </section>

      <section className="content-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>
                Últimas ejecuciones
              </h2>

              <p>
                Actividad reciente del
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
                  <th>Resultados</th>
                </tr>
              </thead>

              <tbody>
                {latestRuns.map(
                  (run) => (
                    <tr key={run.id}>
                      <td>
                        <span
                          className={[
                            "status-badge",
                            `status-${run.status}`,
                          ].join(" ")}
                        >
                          {statusLabel(
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
                              onOpenRunResults(
                                run.id,
                              )
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

                {latestRuns.length ===
                  0 && (
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
            {services.map(
              ([name, service]) => (
                <div
                  className="service-row"
                  key={name}
                >
                  <div>
                    <strong>
                      {name}
                    </strong>

                    <small>
                      {service.detail ||
                        "Sin incidencias"}
                    </small>
                  </div>

                  <span
                    className={[
                      "status-badge",
                      `status-${service.status}`,
                    ].join(" ")}
                  >
                    {statusLabel(
                      service.status,
                    )}
                  </span>
                </div>
              ),
            )}

            {services.length === 0 && (
              <p className="empty-message">
                No se ha podido consultar
                el estado de los servicios.
              </p>
            )}
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>
              Indicadores operativos
            </h2>

            <p>
              Resumen de rendimiento de
              las ejecuciones.
            </p>
          </div>
        </div>

        <div className="compact-metrics">
          <div>
            <span>
              Tasa de éxito
            </span>

            <strong>
              {successRate === null
                ? "—"
                : `${successRate} %`}
            </strong>
          </div>

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
              {services.length > 0
                ? ` / ${services.length}`
                : ""}
            </strong>
          </div>
        </div>
      </section>
    </>
  );
}

export default DashboardPage;
