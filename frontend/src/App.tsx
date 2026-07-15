import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type View =
  | "dashboard"
  | "datasets"
  | "experiments"
  | "runs"
  | "services";

type Corpus = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type DatasetSummary = {
  id: string;
  name: string;
  description: string | null;
  version: number;
  status: string;
  question_count: number;
  created_at: string;
  updated_at: string;
};

type DatasetQuestion = {
  id: string;
  dataset_id: string;
  question: string;
  expected_answer: string | null;
  expected_contexts: string[] | null;
  metadata: Record<string, unknown>;
  order_index: number;
};

type DatasetDetail = DatasetSummary & {
  questions: DatasetQuestion[];
};

type ExperimentVersion = {
  id: string;
  experiment_id: string;
  version_number: number;
  schema_version: string;
  configuration: Record<string, unknown>;
  configuration_hash: string;
  source_template_key: string | null;
  git_commit: string | null;
  created_at: string;
};

type Experiment = {
  id: string;
  name: string;
  description: string | null;
  corpus_id: string;
  dataset_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type ExperimentDetail = Experiment & {
  versions: ExperimentVersion[];
};

type ExperimentRun = {
  id: string;
  experiment_version_id: string;
  mlflow_run_id: string | null;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
  created_at: string;
};

type ServiceStatus = {
  status: string;
  detail: string | null;
};

type SystemStatus = {
  status: string;
  services: Record<string, ServiceStatus>;
};

type DatasetForm = {
  name: string;
  description: string;
  question: string;
  expectedAnswer: string;
};

const API_BASE = "/api/v1";

const EMPTY_DATASET_FORM: DatasetForm = {
  name: "",
  description: "",
  question: "",
  expectedAnswer: "",
};

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatDuration(value: number | null): string {
  if (value === null) {
    return "—";
  }

  if (value < 1000) {
    return `${value} ms`;
  }

  return `${(value / 1000).toFixed(2)} s`;
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
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

async function apiRequest<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const rawBody = await response.text();

    let message = rawBody || `HTTP ${response.status}`;

    try {
      const payload = JSON.parse(rawBody) as {
        detail?: string;
      };

      if (payload.detail) {
        message = payload.detail;
      }
    } catch {
      // La respuesta no era JSON.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function App() {
  const [view, setView] = useState<View>("dashboard");

  const [corpora, setCorpora] = useState<Corpus[]>([]);
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [runs, setRuns] = useState<ExperimentRun[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);

  const [selectedDataset, setSelectedDataset] =
    useState<DatasetDetail | null>(null);

  const [selectedExperiment, setSelectedExperiment] =
    useState<ExperimentDetail | null>(null);

  const [datasetForm, setDatasetForm] =
    useState<DatasetForm>(EMPTY_DATASET_FORM);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [
        corporaResponse,
        datasetsResponse,
        experimentsResponse,
        runsResponse,
        systemResponse,
      ] = await Promise.all([
        apiRequest<Corpus[]>("/corpora"),
        apiRequest<DatasetSummary[]>("/datasets"),
        apiRequest<Experiment[]>("/experiments"),
        apiRequest<ExperimentRun[]>("/experiment-runs"),
        apiRequest<SystemStatus>("/system/status"),
      ]);

      setCorpora(corporaResponse);
      setDatasets(datasetsResponse);
      setExperiments(experimentsResponse);
      setRuns(runsResponse);
      setSystemStatus(systemResponse);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo cargar la plataforma.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const latestRuns = useMemo(
    () =>
      [...runs]
        .sort(
          (left, right) =>
            new Date(right.created_at).getTime() -
            new Date(left.created_at).getTime(),
        )
        .slice(0, 5),
    [runs],
  );

  const completedRuns = runs.filter(
    (run) => run.status === "completed",
  ).length;

  const failedRuns = runs.filter(
    (run) => run.status === "failed",
  ).length;

  const averageDuration = useMemo(() => {
    const durations = runs
      .map((run) => run.duration_ms)
      .filter((value): value is number => value !== null);

    if (durations.length === 0) {
      return null;
    }

    return Math.round(
      durations.reduce((total, value) => total + value, 0) /
        durations.length,
    );
  }, [runs]);

  async function openDataset(datasetId: string) {
    setActionLoading(true);
    setError(null);

    try {
      const detail = await apiRequest<DatasetDetail>(
        `/datasets/${datasetId}`,
      );

      setSelectedDataset(detail);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo cargar el dataset.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function openExperiment(experimentId: string) {
    setActionLoading(true);
    setError(null);

    try {
      const detail = await apiRequest<ExperimentDetail>(
        `/experiments/${experimentId}`,
      );

      setSelectedExperiment(detail);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo cargar el experimento.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function createDataset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setActionLoading(true);
    setError(null);
    setNotice(null);

    try {
      await apiRequest<DatasetDetail>("/datasets", {
        method: "POST",
        body: JSON.stringify({
          name: datasetForm.name,
          description: datasetForm.description || null,
          version: 1,
          status: "ready",
          questions: [
            {
              question: datasetForm.question,
              expected_answer:
                datasetForm.expectedAnswer || null,
              metadata: {
                source: "frontend",
              },
            },
          ],
        }),
      });

      setDatasetForm(EMPTY_DATASET_FORM);
      setNotice("Dataset creado correctamente.");

      await loadOverview();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo crear el dataset.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function assignDataset(
    experimentId: string,
    datasetId: string,
  ) {
    setActionLoading(true);
    setError(null);
    setNotice(null);

    try {
      const updatedExperiment =
        await apiRequest<ExperimentDetail>(
          `/experiments/${experimentId}/dataset`,
          {
            method: "PATCH",
            body: JSON.stringify({
              dataset_id: datasetId,
            }),
          },
        );

      setSelectedExperiment(updatedExperiment);
      setNotice("Dataset asignado al experimento.");

      await loadOverview();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo asignar el dataset.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function executeVersion(versionId: string) {
    setActionLoading(true);
    setError(null);
    setNotice(
      "El experimento se está ejecutando. La generación puede tardar aproximadamente un minuto.",
    );

    try {
      const createdRun = await apiRequest<ExperimentRun>(
        `/experiment-runs/versions/${versionId}`,
        {
          method: "POST",
        },
      );

      setNotice(
        createdRun.status === "completed"
          ? "Experimento completado correctamente."
          : `La ejecución terminó con estado ${createdRun.status}.`,
      );

      await loadOverview();
      setView("runs");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo ejecutar el experimento.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  function renderDashboard() {
    return (
      <>
        <header className="page-header">
          <div>
            <span className="eyebrow">Laboratorio experimental</span>
            <h1>Panel general</h1>
            <p>
              Estado del pipeline RAG, recursos experimentales y
              últimas ejecuciones.
            </p>
          </div>

          <button
            className="secondary-button"
            type="button"
            onClick={() => void loadOverview()}
            disabled={loading}
          >
            Actualizar
          </button>
        </header>

        <section className="metric-grid">
          <article className="metric-card">
            <span>Corpora</span>
            <strong>{corpora.length}</strong>
            <small>colecciones documentales</small>
          </article>

          <article className="metric-card">
            <span>Datasets</span>
            <strong>{datasets.length}</strong>
            <small>conjuntos de evaluación</small>
          </article>

          <article className="metric-card">
            <span>Experimentos</span>
            <strong>{experiments.length}</strong>
            <small>configuraciones registradas</small>
          </article>

          <article className="metric-card">
            <span>Ejecuciones</span>
            <strong>{runs.length}</strong>
            <small>
              {completedRuns} completadas · {failedRuns} fallidas
            </small>
          </article>
        </section>

        <section className="content-grid">
          <article className="panel">
            <div className="panel-heading">
              <div>
                <h2>Últimas ejecuciones</h2>
                <p>Actividad reciente del motor experimental.</p>
              </div>

              <button
                className="text-button"
                type="button"
                onClick={() => setView("runs")}
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
                  </tr>
                </thead>
                <tbody>
                  {latestRuns.map((run) => (
                    <tr key={run.id}>
                      <td>
                        <span
                          className={`status-badge status-${run.status}`}
                        >
                          {statusLabel(run.status)}
                        </span>
                      </td>
                      <td>{formatDuration(run.duration_ms)}</td>
                      <td>{formatDate(run.started_at)}</td>
                    </tr>
                  ))}

                  {latestRuns.length === 0 && (
                    <tr>
                      <td colSpan={3} className="empty-cell">
                        Todavía no hay ejecuciones.
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
                <h2>Estado de servicios</h2>
                <p>Disponibilidad de la infraestructura.</p>
              </div>
            </div>

            <div className="service-list">
              {Object.entries(systemStatus?.services ?? {}).map(
                ([name, service]) => (
                  <div className="service-row" key={name}>
                    <div>
                      <strong>{name}</strong>
                      <small>{service.detail || "Sin incidencias"}</small>
                    </div>

                    <span
                      className={`status-badge status-${service.status}`}
                    >
                      {statusLabel(service.status)}
                    </span>
                  </div>
                ),
              )}
            </div>
          </article>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Indicadores operativos</h2>
              <p>Resumen de rendimiento de las ejecuciones.</p>
            </div>
          </div>

          <div className="compact-metrics">
            <div>
              <span>Tasa de éxito</span>
              <strong>
                {runs.length > 0
                  ? `${Math.round((completedRuns / runs.length) * 100)} %`
                  : "—"}
              </strong>
            </div>

            <div>
              <span>Duración media</span>
              <strong>{formatDuration(averageDuration)}</strong>
            </div>

            <div>
              <span>Servicios disponibles</span>
              <strong>
                {
                  Object.values(systemStatus?.services ?? {}).filter(
                    (service) => service.status === "ok",
                  ).length
                }
              </strong>
            </div>
          </div>
        </section>
      </>
    );
  }

  function renderDatasets() {
    return (
      <>
        <header className="page-header">
          <div>
            <span className="eyebrow">Recursos de evaluación</span>
            <h1>Datasets</h1>
            <p>
              Gestiona las preguntas, respuestas esperadas y datos de
              evaluación.
            </p>
          </div>
        </header>

        <section className="content-grid datasets-layout">
          <article className="panel">
            <div className="panel-heading">
              <div>
                <h2>Datasets registrados</h2>
                <p>{datasets.length} conjuntos disponibles.</p>
              </div>
            </div>

            <div className="card-list">
              {datasets.map((dataset) => (
                <button
                  className="resource-card"
                  type="button"
                  key={dataset.id}
                  onClick={() => void openDataset(dataset.id)}
                >
                  <div>
                    <strong>{dataset.name}</strong>
                    <p>{dataset.description || "Sin descripción"}</p>
                  </div>

                  <div className="resource-meta">
                    <span>v{dataset.version}</span>
                    <span>{dataset.question_count} preguntas</span>
                    <span
                      className={`status-badge status-${dataset.status}`}
                    >
                      {statusLabel(dataset.status)}
                    </span>
                  </div>
                </button>
              ))}

              {datasets.length === 0 && (
                <p className="empty-message">
                  Todavía no hay datasets.
                </p>
              )}
            </div>
          </article>

          <article className="panel">
            <div className="panel-heading">
              <div>
                <h2>Nuevo dataset</h2>
                <p>Crea un conjunto inicial con una pregunta.</p>
              </div>
            </div>

            <form className="form-grid" onSubmit={createDataset}>
              <label>
                Nombre
                <input
                  required
                  minLength={3}
                  value={datasetForm.name}
                  onChange={(event) =>
                    setDatasetForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Descripción
                <textarea
                  rows={3}
                  value={datasetForm.description}
                  onChange={(event) =>
                    setDatasetForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Pregunta inicial
                <textarea
                  required
                  minLength={3}
                  rows={3}
                  value={datasetForm.question}
                  onChange={(event) =>
                    setDatasetForm((current) => ({
                      ...current,
                      question: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Respuesta esperada
                <textarea
                  rows={3}
                  value={datasetForm.expectedAnswer}
                  onChange={(event) =>
                    setDatasetForm((current) => ({
                      ...current,
                      expectedAnswer: event.target.value,
                    }))
                  }
                />
              </label>

              <button
                className="primary-button"
                type="submit"
                disabled={actionLoading}
              >
                Crear dataset
              </button>
            </form>
          </article>
        </section>

        {selectedDataset && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>{selectedDataset.name}</h2>
                <p>
                  Versión {selectedDataset.version} ·{" "}
                  {selectedDataset.questions.length} preguntas
                </p>
              </div>

              <button
                className="icon-button"
                type="button"
                onClick={() => setSelectedDataset(null)}
              >
                Cerrar
              </button>
            </div>

            <div className="question-list">
              {selectedDataset.questions.map((question) => (
                <article className="question-card" key={question.id}>
                  <span>Pregunta {question.order_index + 1}</span>
                  <h3>{question.question}</h3>
                  <p>
                    <strong>Respuesta esperada:</strong>{" "}
                    {question.expected_answer || "No definida"}
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}
      </>
    );
  }

  function renderExperiments() {
    return (
      <>
        <header className="page-header">
          <div>
            <span className="eyebrow">Configuración experimental</span>
            <h1>Experimentos</h1>
            <p>
              Selecciona datasets, consulta versiones y ejecuta el
              pipeline completo.
            </p>
          </div>
        </header>

        <section className="panel">
          <div className="card-list">
            {experiments.map((experiment) => {
              const corpus = corpora.find(
                (item) => item.id === experiment.corpus_id,
              );

              const dataset = datasets.find(
                (item) => item.id === experiment.dataset_id,
              );

              return (
                <button
                  className="resource-card"
                  type="button"
                  key={experiment.id}
                  onClick={() => void openExperiment(experiment.id)}
                >
                  <div>
                    <strong>{experiment.name}</strong>
                    <p>
                      {experiment.description || "Sin descripción"}
                    </p>
                  </div>

                  <div className="resource-meta">
                    <span>{corpus?.name || "Corpus no encontrado"}</span>
                    <span>{dataset?.name || "Sin dataset"}</span>
                    <span
                      className={`status-badge status-${experiment.status}`}
                    >
                      {statusLabel(experiment.status)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {selectedExperiment && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>{selectedExperiment.name}</h2>
                <p>
                  {selectedExperiment.versions.length} versiones
                  disponibles.
                </p>
              </div>

              <button
                className="icon-button"
                type="button"
                onClick={() => setSelectedExperiment(null)}
              >
                Cerrar
              </button>
            </div>

            <div className="experiment-controls">
              <label>
                Dataset de evaluación
                <select
                  value={selectedExperiment.dataset_id ?? ""}
                  onChange={(event) => {
                    if (event.target.value) {
                      void assignDataset(
                        selectedExperiment.id,
                        event.target.value,
                      );
                    }
                  }}
                  disabled={actionLoading}
                >
                  <option value="">Seleccionar dataset</option>

                  {datasets.map((dataset) => (
                    <option key={dataset.id} value={dataset.id}>
                      {dataset.name} · v{dataset.version}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="version-list">
              {selectedExperiment.versions.map((version) => (
                <article className="version-card" key={version.id}>
                  <div>
                    <span className="eyebrow">
                      Versión {version.version_number}
                    </span>
                    <h3>Esquema {version.schema_version}</h3>
                    <p>
                      Hash:{" "}
                      <code>
                        {version.configuration_hash.slice(0, 16)}…
                      </code>
                    </p>
                  </div>

                  <button
                    className="primary-button"
                    type="button"
                    disabled={
                      actionLoading ||
                      !selectedExperiment.dataset_id
                    }
                    onClick={() => void executeVersion(version.id)}
                  >
                    Ejecutar experimento
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}
      </>
    );
  }

  function renderRuns() {
    return (
      <>
        <header className="page-header">
          <div>
            <span className="eyebrow">Historial experimental</span>
            <h1>Ejecuciones</h1>
            <p>
              Estado, duración, trazabilidad y errores de cada run.
            </p>
          </div>
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

                    <td>{formatDuration(run.duration_ms)}</td>
                    <td>{formatDate(run.started_at)}</td>

                    <td>
                      {run.mlflow_run_id ? (
                        <code>{run.mlflow_run_id.slice(0, 12)}…</code>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td className="error-cell">
                      {run.error_message || "—"}
                    </td>
                  </tr>
                ))}

                {runs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty-cell">
                      Todavía no hay ejecuciones.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  }

  function renderServices() {
    return (
      <>
        <header className="page-header">
          <div>
            <span className="eyebrow">Infraestructura</span>
            <h1>Servicios</h1>
            <p>
              Acceso a las herramientas que soportan la plataforma.
            </p>
          </div>
        </header>

        <section className="service-grid">
          <a
            className="service-card"
            href="http://localhost:5000"
            target="_blank"
            rel="noreferrer"
          >
            <span>Tracking</span>
            <h2>MLflow</h2>
            <p>Runs, parámetros, métricas y artefactos.</p>
          </a>

          <a
            className="service-card"
            href="http://localhost:9001"
            target="_blank"
            rel="noreferrer"
          >
            <span>Object storage</span>
            <h2>MinIO</h2>
            <p>Documentos, datasets y artefactos experimentales.</p>
          </a>

          <a
            className="service-card"
            href="http://localhost:3000"
            target="_blank"
            rel="noreferrer"
          >
            <span>Analítica</span>
            <h2>Metabase</h2>
            <p>Dashboards y análisis comparativo.</p>
          </a>

          <a
            className="service-card"
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noreferrer"
          >
            <span>API</span>
            <h2>FastAPI</h2>
            <p>Documentación OpenAPI interactiva.</p>
          </a>
        </section>
      </>
    );
  }

  function renderCurrentView() {
    switch (view) {
      case "datasets":
        return renderDatasets();
      case "experiments":
        return renderExperiments();
      case "runs":
        return renderRuns();
      case "services":
        return renderServices();
      default:
        return renderDashboard();
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">R</div>
          <div>
            <strong>RAG Lab</strong>
            <span>TFM Evaluation Platform</span>
          </div>
        </div>

        <nav>
          <button
            type="button"
            className={view === "dashboard" ? "active" : ""}
            onClick={() => setView("dashboard")}
          >
            Panel general
          </button>

          <button
            type="button"
            className={view === "datasets" ? "active" : ""}
            onClick={() => setView("datasets")}
          >
            Datasets
          </button>

          <button
            type="button"
            className={view === "experiments" ? "active" : ""}
            onClick={() => setView("experiments")}
          >
            Experimentos
          </button>

          <button
            type="button"
            className={view === "runs" ? "active" : ""}
            onClick={() => setView("runs")}
          >
            Ejecuciones
          </button>

          <button
            type="button"
            className={view === "services" ? "active" : ""}
            onClick={() => setView("services")}
          >
            Servicios
          </button>
        </nav>

        <div className="sidebar-footer">
          <span
            className={`status-dot ${
              systemStatus?.status === "ok" ? "online" : ""
            }`}
          />
          <div>
            <strong>
              {systemStatus?.status === "ok"
                ? "Sistema operativo"
                : "Estado desconocido"}
            </strong>
            <span>Entorno experimental</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        {error && (
          <div className="alert alert-error">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)}>
              Cerrar
            </button>
          </div>
        )}

        {notice && (
          <div className="alert alert-success">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice(null)}>
              Cerrar
            </button>
          </div>
        )}

        {loading ? (
          <div className="loading-state">
            Cargando plataforma experimental…
          </div>
        ) : (
          renderCurrentView()
        )}
      </main>
    </div>
  );
}

export default App;
