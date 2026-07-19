import type { ReactNode } from "react";

type Run = {
  id: string;
  status: string;
  duration_ms: number | null;
  started_at: string | null;
  mlflow_run_id: string | null;
  error_message: string | null;
};

type RunsPageProps = {
  runs: Run[];
  resultsLoading: boolean;
  onRefresh: () => void;
  onOpenRunResults: (runId: string) => void;
  formatDate: (value: string | null) => string;
  formatDuration: (value: number | null) => string;
  statusLabel: (status: string) => string;
  children?: ReactNode;
};

export default function RunsPage({
  runs,
  resultsLoading,
  onRefresh,
  onOpenRunResults,
  formatDate,
  formatDuration,
  statusLabel,
  children,
}: RunsPageProps) {
  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow">
            Historial experimental
          </span>

          <h1>Ejecuciones</h1>

          <p>
            Estado, duración, trazabilidad y
            resultados de cada run.
          </p>
        </div>

        <button
          className="secondary-button"
          type="button"
          onClick={onRefresh}
        >
          Actualizar
        </button>
      </header>

      <section className="panel">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Estado</th>
                <th>Duración</th>
                <th>Inicio</th>
                <th>MLflow run</th>
                <th>Resultados</th>
                <th>Error</th>
              </tr>
            </thead>

            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td>
                    <span
                      className={`status-badge status-${run.status}`}
                    >
                      {statusLabel(run.status)}
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
                    {run.mlflow_run_id ? (
                      <code>
                        {run.mlflow_run_id.slice(
                          0,
                          12,
                        )}
                        …
                      </code>
                    ) : (
                      "—"
                    )}
                  </td>

                  <td>
                    {run.status ===
                    "completed" ? (
                      <button
                        className="table-action-button"
                        type="button"
                        disabled={
                          resultsLoading
                        }
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

                  <td className="error-cell">
                    {run.error_message ||
                      "—"}
                  </td>
                </tr>
              ))}

              {runs.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="empty-cell"
                  >
                    Todavía no hay
                    ejecuciones.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {children}
    </>
  );
}