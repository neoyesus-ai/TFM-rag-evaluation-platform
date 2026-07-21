import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import DatasetsPage from "./pages/DatasetsPage";
import ExperimentBuilderPage from "./components/experiments/ExperimentBuilderPage";
import CorporaPage from "./pages/CorporaPage";
import AnalyticsPage from "./components/analytics/AnalyticsPage";
import ComparatorPage from "./components/analytics/ComparatorPage";
import InsightsPage from "./components/analytics/InsightsPage";
import LeaderboardPage from "./components/analytics/LeaderboardPage";
import RecommendationsPage from "./components/analytics/RecommendationsPage";
import OperationalDashboard from "./components/dashboard/OperationalDashboard";
import AppSidebar from "./components/layout/AppSidebar";
import type { AppView } from "./types/navigation";
import type {
  ExperimentRun,
  RunArtifact,
  RunConfiguration,
  RunMetrics,
  RunResults,
} from "./types/runResults";

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

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
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

function formatScore(
  value: number | null,
): string {
  if (value === null) {
    return "—";
  }

  return value.toFixed(3);
}

function formatInteger(
  value: number | null,
): string {
  if (value === null) {
    return "—";
  }

  return Math.round(value).toLocaleString(
    "es-ES",
  );
}

function formatDecimal(
  value: number | null,
  decimals = 2,
): string {
  if (value === null) {
    return "—";
  }

  return value.toFixed(decimals);
}

function formatFileSize(
  value: number | null,
): string {
  if (value === null) {
    return "—";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(
    value /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

function statusLabel(
  status: string,
): string {
  const labels: Record<string, string> = {
    completed: "Completado",
    failed: "Fallido",
    running: "En ejecución",
    pending: "Pendiente",
    ready: "Preparado",
    draft: "Borrador",
    archived: "Archivado",
    ok: "Disponible",
    FINISHED: "Finalizado",
    FAILED: "Fallido",
    RUNNING: "En ejecución",
  };

  return labels[status] ?? status;
}

async function apiRequest<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const headers = new Headers(
    options?.headers,
  );

  if (
    options?.body &&
    !headers.has("Content-Type")
  ) {
    headers.set(
      "Content-Type",
      "application/json",
    );
  }

  const response = await fetch(
    `${API_BASE}${path}`,
    {
      ...options,
      headers,
    },
  );

  if (!response.ok) {
    const rawBody = await response.text();
    let message =
      rawBody || `HTTP ${response.status}`;

    try {
      const payload = JSON.parse(
        rawBody,
      ) as {
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

function ResultMetricCard({
  label,
  value,
  description,
  emphasized = false,
}: {
  label: string;
  value: string;
  description: string;
  emphasized?: boolean;
}) {
  return (
    <article
      className={
        emphasized
          ? "result-metric-card result-metric-primary"
          : "result-metric-card"
      }
    >
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{description}</small>
    </article>
  );
}

function App() {
  const [view, setView] =
    useState<AppView>("dashboard");
  
  const [
    experimentWorkspace,
    setExperimentWorkspace,
  ] = useState<"list" | "builder">("list");

  const [corpora, setCorpora] =
    useState<Corpus[]>([]);

  const [datasets, setDatasets] =
    useState<DatasetSummary[]>([]);

  const [experiments, setExperiments] =
    useState<Experiment[]>([]);

  const [runs, setRuns] =
    useState<ExperimentRun[]>([]);

  const [systemStatus, setSystemStatus] =
    useState<SystemStatus | null>(null);

  const [
    selectedDataset,
    setSelectedDataset,
  ] = useState<DatasetDetail | null>(null);

  const [
    selectedExperiment,
    setSelectedExperiment,
  ] = useState<ExperimentDetail | null>(
    null,
  );

  const [
    selectedRunResults,
    setSelectedRunResults,
  ] = useState<RunResults | null>(null);

  const [datasetForm, setDatasetForm] =
    useState<DatasetForm>(
      EMPTY_DATASET_FORM,
    );

  const [loading, setLoading] =
    useState(true);

  const [
    actionLoading,
    setActionLoading,
  ] = useState(false);

  const [
    resultsLoading,
    setResultsLoading,
  ] = useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [notice, setNotice] =
    useState<string | null>(null);

  const loadOverview =
    useCallback(async () => {
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
          apiRequest<DatasetSummary[]>(
            "/datasets",
          ),
          apiRequest<Experiment[]>(
            "/experiments",
          ),
          apiRequest<ExperimentRun[]>(
            "/experiment-runs",
          ),
          apiRequest<SystemStatus>(
            "/system/status",
          ),
        ]);

        setCorpora(corporaResponse);
        setDatasets(datasetsResponse);
        setExperiments(
          experimentsResponse,
        );
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
            new Date(
              right.created_at,
            ).getTime() -
            new Date(
              left.created_at,
            ).getTime(),
        )
        .slice(0, 5),
    [runs],
  );

  const completedRuns = runs.filter(
    (run) =>
      run.status === "completed",
  ).length;

  const failedRuns = runs.filter(
    (run) => run.status === "failed",
  ).length;

  const averageDuration = useMemo(() => {
    const durations = runs
      .map((run) => run.duration_ms)
      .filter(
        (value): value is number =>
          value !== null,
      );

    if (durations.length === 0) {
      return null;
    }

    return Math.round(
      durations.reduce(
        (total, value) =>
          total + value,
        0,
      ) / durations.length,
    );
  }, [runs]);

  async function openDataset(
    datasetId: string,
  ) {
    setActionLoading(true);
    setError(null);

    try {
      const detail =
        await apiRequest<DatasetDetail>(
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

  async function openExperiment(
    experimentId: string,
  ) {
    setActionLoading(true);
    setError(null);

    try {
      const detail =
        await apiRequest<ExperimentDetail>(
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

  async function openRunResults(
    runId: string,
  ) {
    setResultsLoading(true);
    setError(null);
    setSelectedRunResults(null);

    try {
      const results =
        await apiRequest<RunResults>(
          `/experiment-runs/${runId}/results`,
        );

      setSelectedRunResults(results);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudieron cargar los resultados.",
      );
    } finally {
      setResultsLoading(false);
    }
  }

  async function createDataset(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setActionLoading(true);
    setError(null);
    setNotice(null);

    try {
      await apiRequest<DatasetDetail>(
        "/datasets",
        {
          method: "POST",
          body: JSON.stringify({
            name: datasetForm.name,
            description:
              datasetForm.description ||
              null,
            version: 1,
            status: "ready",
            questions: [
              {
                question:
                  datasetForm.question,
                expected_answer:
                  datasetForm.expectedAnswer ||
                  null,
                metadata: {
                  source: "frontend",
                },
              },
            ],
          }),
        },
      );

      setDatasetForm(
        EMPTY_DATASET_FORM,
      );

      setNotice(
        "Dataset creado correctamente.",
      );

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

      setSelectedExperiment(
        updatedExperiment,
      );

      setNotice(
        "Dataset asignado al experimento.",
      );

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

  async function executeVersion(
    versionId: string,
  ) {
    setActionLoading(true);
    setError(null);

    setNotice(
      "El experimento se está ejecutando. La generación puede tardar aproximadamente un minuto.",
    );

    try {
      const createdRun =
        await apiRequest<ExperimentRun>(
          `/experiment-runs/versions/${versionId}`,
          {
            method: "POST",
          },
        );

      setNotice(
        createdRun.status ===
          "completed"
          ? "Experimento completado correctamente."
          : `La ejecución terminó con estado ${createdRun.status}.`,
      );

      await loadOverview();
      setView("runs");

      if (
        createdRun.status ===
        "completed"
      ) {
        await openRunResults(
          createdRun.id,
        );
      }
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
    const questionCount = datasets.reduce(
      (total, dataset) =>
        total + dataset.question_count,
      0,
    );

    const versionCount = experiments.reduce(
      (total, experiment) => {
        if (
          selectedExperiment?.id ===
          experiment.id
        ) {
          return (
            total +
            selectedExperiment.versions.length
          );
        }

        return total;
      },
      0,
    );

    return (
      <OperationalDashboard
        corpusCount={corpora.length}
        documentCount={corpora.length}
        datasetCount={datasets.length}
        questionCount={questionCount}
        experimentCount={experiments.length}
        versionCount={versionCount}
        runCount={runs.length}
        completedRunCount={completedRuns}
        failedRunCount={failedRuns}
        averageDurationMs={averageDuration}
        recentRuns={latestRuns}
        systemStatus={systemStatus}
        loading={loading}
        onRefresh={() =>
          void loadOverview()
        }
        onOpenRuns={() =>
          setView("runs")
        }
        onOpenRun={(runId) => {
          setView("runs");
          void openRunResults(runId);
        }}
      />
    );
  }

  function renderDatasets() {
    return (
      <>
        <header className="page-header">
          <div>
            <span className="eyebrow">
              Recursos de evaluación
            </span>

            <h1>Datasets</h1>

            <p>
              Gestiona las preguntas,
              respuestas esperadas y datos
              de evaluación.
            </p>
          </div>
        </header>

        <section className="content-grid datasets-layout">
          <article className="panel">
            <div className="panel-heading">
              <div>
                <h2>
                  Datasets registrados
                </h2>
                <p>
                  {datasets.length} conjuntos
                  disponibles.
                </p>
              </div>
            </div>

            <div className="card-list">
              {datasets.map(
                (dataset) => (
                  <button
                    className="resource-card"
                    type="button"
                    key={dataset.id}
                    onClick={() =>
                      void openDataset(
                        dataset.id,
                      )
                    }
                  >
                    <div>
                      <strong>
                        {dataset.name}
                      </strong>
                      <p>
                        {dataset.description ||
                          "Sin descripción"}
                      </p>
                    </div>

                    <div className="resource-meta">
                      <span>
                        v{dataset.version}
                      </span>
                      <span>
                        {
                          dataset.question_count
                        }{" "}
                        preguntas
                      </span>
                      <span
                        className={`status-badge status-${dataset.status}`}
                      >
                        {statusLabel(
                          dataset.status,
                        )}
                      </span>
                    </div>
                  </button>
                ),
              )}

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
                <p>
                  Crea un conjunto inicial
                  con una pregunta.
                </p>
              </div>
            </div>

            <form
              className="form-grid"
              onSubmit={createDataset}
            >
              <label>
                Nombre
                <input
                  required
                  minLength={3}
                  value={datasetForm.name}
                  onChange={(event) =>
                    setDatasetForm(
                      (current) => ({
                        ...current,
                        name: event.target
                          .value,
                      }),
                    )
                  }
                />
              </label>

              <label>
                Descripción
                <textarea
                  rows={3}
                  value={
                    datasetForm.description
                  }
                  onChange={(event) =>
                    setDatasetForm(
                      (current) => ({
                        ...current,
                        description:
                          event.target
                            .value,
                      }),
                    )
                  }
                />
              </label>

              <label>
                Pregunta inicial
                <textarea
                  required
                  minLength={3}
                  rows={3}
                  value={
                    datasetForm.question
                  }
                  onChange={(event) =>
                    setDatasetForm(
                      (current) => ({
                        ...current,
                        question:
                          event.target
                            .value,
                      }),
                    )
                  }
                />
              </label>

              <label>
                Respuesta esperada
                <textarea
                  rows={3}
                  value={
                    datasetForm.expectedAnswer
                  }
                  onChange={(event) =>
                    setDatasetForm(
                      (current) => ({
                        ...current,
                        expectedAnswer:
                          event.target
                            .value,
                      }),
                    )
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
                <h2>
                  {selectedDataset.name}
                </h2>
                <p>
                  Versión{" "}
                  {selectedDataset.version} ·{" "}
                  {
                    selectedDataset.questions
                      .length
                  }{" "}
                  preguntas
                </p>
              </div>

              <button
                className="icon-button"
                type="button"
                onClick={() =>
                  setSelectedDataset(null)
                }
              >
                Cerrar
              </button>
            </div>

            <div className="question-list">
              {selectedDataset.questions.map(
                (question) => (
                  <article
                    className="question-card"
                    key={question.id}
                  >
                    <span>
                      Pregunta{" "}
                      {question.order_index +
                        1}
                    </span>

                    <h3>
                      {question.question}
                    </h3>

                    <p>
                      <strong>
                        Respuesta esperada:
                      </strong>{" "}
                      {question.expected_answer ||
                        "No definida"}
                    </p>
                  </article>
                ),
              )}
            </div>
          </section>
        )}
      </>
    );
  }

  function renderExperiments() {
    if (experimentWorkspace === "builder") {
      return (
        <ExperimentBuilderPage
          onCreated={async () => {
            setExperimentWorkspace("list");
            void loadOverview();
          }}
          onOpenRuns={() => {
            setExperimentWorkspace("list");
            setView("runs");
          }}
        />
      );
    }


    return (
      <>
        <header className="page-header">
          <div>
            <span className="eyebrow">
              Configuración experimental
            </span>

            <h1>Experimentos</h1>

            <p>
              Selecciona datasets, consulta
              versiones y ejecuta el pipeline
              completo.
            </p>
          </div>

          <button
            className="primary-button"
            type="button"
            onClick={() =>
              setExperimentWorkspace("builder")
            }
          >
            Nuevo experimento
          </button>
        </header>

        <section className="panel">
          <div className="card-list">
            {experiments.map(
              (experiment) => {
                const corpus = corpora.find(
                  (item) =>
                    item.id ===
                    experiment.corpus_id,
                );

                const dataset =
                  datasets.find(
                    (item) =>
                      item.id ===
                      experiment.dataset_id,
                  );

                return (
                  <button
                    className="resource-card"
                    type="button"
                    key={experiment.id}
                    onClick={() =>
                      void openExperiment(
                        experiment.id,
                      )
                    }
                  >
                    <div>
                      <strong>
                        {experiment.name}
                      </strong>

                      <p>
                        {experiment.description ||
                          "Sin descripción"}
                      </p>
                    </div>

                    <div className="resource-meta">
                      <span>
                        {corpus?.name ||
                          "Corpus no encontrado"}
                      </span>

                      <span>
                        {dataset?.name ||
                          "Sin dataset"}
                      </span>

                      <span
                        className={`status-badge status-${experiment.status}`}
                      >
                        {statusLabel(
                          experiment.status,
                        )}
                      </span>
                    </div>
                  </button>
                );
              },
            )}
          </div>
        </section>

        {selectedExperiment && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>
                  {selectedExperiment.name}
                </h2>

                <p>
                  {
                    selectedExperiment
                      .versions.length
                  }{" "}
                  versiones disponibles.
                </p>
              </div>

              <button
                className="icon-button"
                type="button"
                onClick={() =>
                  setSelectedExperiment(
                    null,
                  )
                }
              >
                Cerrar
              </button>
            </div>

            <div className="experiment-controls">
              <label>
                Dataset de evaluación

                <select
                  value={
                    selectedExperiment.dataset_id ??
                    ""
                  }
                  onChange={(event) => {
                    if (
                      event.target.value
                    ) {
                      void assignDataset(
                        selectedExperiment.id,
                        event.target.value,
                      );
                    }
                  }}
                  disabled={actionLoading}
                >
                  <option value="">
                    Seleccionar dataset
                  </option>

                  {datasets.map(
                    (dataset) => (
                      <option
                        key={dataset.id}
                        value={dataset.id}
                      >
                        {dataset.name} · v
                        {dataset.version}
                      </option>
                    ),
                  )}
                </select>
              </label>
            </div>

            <div className="version-list">
              {selectedExperiment.versions.map(
                (version) => (
                  <article
                    className="version-card"
                    key={version.id}
                  >
                    <div>
                      <span className="eyebrow">
                        Versión{" "}
                        {
                          version.version_number
                        }
                      </span>

                      <h3>
                        Esquema{" "}
                        {
                          version.schema_version
                        }
                      </h3>

                      <p>
                        Hash:{" "}
                        <code>
                          {version.configuration_hash.slice(
                            0,
                            16,
                          )}
                          …
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
                      onClick={() =>
                        void executeVersion(
                          version.id,
                        )
                      }
                    >
                      Ejecutar experimento
                    </button>
                  </article>
                ),
              )}
            </div>
          </section>
        )}
      </>
    );
  }

  function renderRunResults() {
    if (resultsLoading) {
      return (
        <section className="panel results-loading-panel">
          Recuperando métricas y artefactos
          desde MLflow…
        </section>
      );
    }

    if (!selectedRunResults) {
      return null;
    }

    const {
      metrics,
      configuration,
      artifacts,
    } = selectedRunResults;

    const mlflowUrl = 
      `${window.location.protocol}//${window.location.hostname}:5000` +
      `/#/experiments/${selectedRunResults.mlflow_experiment_id}` +
      `/runs/${selectedRunResults.mlflow_run_id}`;

    return (
      <section className="results-panel">
        <div className="results-hero">
          <div>
            <span className="eyebrow">
              Resultados experimentales
            </span>

            <h2>
              {
                selectedRunResults.experiment_name
              }{" "}
              · versión{" "}
              {
                selectedRunResults.experiment_version
              }
            </h2>

            <p>
              Run{" "}
              <code>
                {
                  selectedRunResults.mlflow_run_id
                }
              </code>
            </p>
          </div>

          <div className="results-actions">
            <span
              className={`status-badge status-${selectedRunResults.run.status}`}
            >
              {statusLabel(
                selectedRunResults.run
                  .status,
              )}
            </span>

            <a
              className="secondary-button results-link"
              href={mlflowUrl}
              target="_blank"
              rel="noreferrer"
            >
              Abrir en MLflow
            </a>

            <button
              className="icon-button"
              type="button"
              onClick={() =>
                setSelectedRunResults(
                  null,
                )
              }
            >
              Cerrar
            </button>
          </div>
        </div>

        <div className="results-kpi-grid">
          <ResultMetricCard
            label="Overall Score"
            value={formatScore(
              metrics.overall_score,
            )}
            description="Puntuación agregada de evaluación"
            emphasized
          />

          <ResultMetricCard
            label="Groundedness"
            value={formatScore(
              metrics.groundedness,
            )}
            description="Respuesta respaldada por el contexto"
          />

          <ResultMetricCard
            label="Answer F1"
            value={formatScore(
              metrics.answer_token_f1,
            )}
            description="Equilibrio entre precisión y recall"
          />

          <ResultMetricCard
            label="Context Precision"
            value={formatScore(
              metrics.context_precision,
            )}
            description="Proporción de contexto relevante"
          />

          <ResultMetricCard
            label="Context Recall"
            value={formatScore(
              metrics.context_recall,
            )}
            description="Cobertura del contexto esperado"
          />

          <ResultMetricCard
            label="Similarity media"
            value={formatScore(
              metrics.retrieval_mean_similarity,
            )}
            description="Similitud media del retrieval"
          />
        </div>

        <div className="results-columns">
          <article className="panel results-section">
            <div className="panel-heading">
              <div>
                <h3>
                  Rendimiento y consumo
                </h3>
                <p>
                  Latencia, tokens y velocidad
                  de generación.
                </p>
              </div>
            </div>

            <div className="result-detail-grid">
              <div>
                <span>
                  Duración total
                </span>
                <strong>
                  {formatDuration(
                    metrics.runner_total_ms ??
                      selectedRunResults.run
                        .duration_ms,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Latencia media
                </span>
                <strong>
                  {formatDuration(
                    metrics.generation_mean_latency_ms,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Tokens de prompt
                </span>
                <strong>
                  {formatInteger(
                    metrics.prompt_tokens,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Tokens generados
                </span>
                <strong>
                  {formatInteger(
                    metrics.completion_tokens,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Tokens totales
                </span>
                <strong>
                  {formatInteger(
                    metrics.total_tokens,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Tokens por segundo
                </span>
                <strong>
                  {formatDecimal(
                    metrics.completion_tokens_per_second,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Tiempo de retrieval
                </span>
                <strong>
                  {formatDuration(
                    metrics.retrieval_duration_ms,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Preguntas evaluadas
                </span>
                <strong>
                  {formatInteger(
                    metrics.question_count,
                  )}
                </strong>
              </div>
            </div>
          </article>

          <article className="panel results-section">
            <div className="panel-heading">
              <div>
                <h3>
                  Configuración
                </h3>
                <p>
                  Parámetros principales del
                  pipeline ejecutado.
                </p>
              </div>
            </div>

            <dl className="configuration-list">
              <div>
                <dt>Modelo generativo</dt>
                <dd>
                  {configuration.generation_model ||
                    "—"}
                </dd>
              </div>

              <div>
                <dt>
                  Proveedor generativo
                </dt>
                <dd>
                  {configuration.generation_provider ||
                    "—"}
                </dd>
              </div>

              <div>
                <dt>Temperatura</dt>
                <dd>
                  {configuration.generation_temperature ||
                    "—"}
                </dd>
              </div>

              <div>
                <dt>Modelo de embeddings</dt>
                <dd>
                  {configuration.embedding_model ||
                    "—"}
                </dd>
              </div>

              <div>
                <dt>
                  Estrategia de chunking
                </dt>
                <dd>
                  {configuration.chunking_strategy ||
                    "—"}
                </dd>
              </div>

              <div>
                <dt>Chunk size</dt>
                <dd>
                  {configuration.chunk_size ||
                    "—"}
                </dd>
              </div>

              <div>
                <dt>Chunk overlap</dt>
                <dd>
                  {configuration.chunk_overlap ||
                    "—"}
                </dd>
              </div>

              <div>
                <dt>
                  Estrategia de retrieval
                </dt>
                <dd>
                  {configuration.retrieval_strategy ||
                    "—"}
                </dd>
              </div>

              <div>
                <dt>Top-K</dt>
                <dd>
                  {configuration.retrieval_top_k ||
                    "—"}
                </dd>
              </div>
            </dl>
          </article>
        </div>

        <article className="panel results-section">
          <div className="panel-heading">
            <div>
              <h3>
                Artefactos experimentales
              </h3>
              <p>
                Archivos registrados para
                reproducibilidad y análisis.
              </p>
            </div>

            <span className="artifact-count">
              {artifacts.length} elementos
            </span>
          </div>

          <div className="artifact-list">
            {artifacts.map(
              (artifact) => (
                <div
                  className="artifact-row"
                  key={artifact.path}
                >
                  <div>
                    <span
                      className={
                        artifact.is_dir
                          ? "artifact-icon artifact-directory"
                          : "artifact-icon"
                      }
                    >
                      {artifact.is_dir
                        ? "DIR"
                        : "FILE"}
                    </span>

                    <code>
                      {artifact.path}
                    </code>
                  </div>

                  <span>
                    {artifact.is_dir
                      ? "Directorio"
                      : formatFileSize(
                          artifact.file_size,
                        )}
                  </span>
                </div>
              ),
            )}

            {artifacts.length === 0 && (
              <p className="empty-message">
                El run no contiene artefactos.
              </p>
            )}
          </div>
        </article>
      </section>
    );
  }

  function renderRuns() {
    return (
      <>
        <header className="page-header">
          <div>
            <span className="eyebrow">
              Historial experimental
            </span>

            <h1>Ejecuciones</h1>

            <p>
              Estado, duración, trazabilidad
              y resultados de cada run.
            </p>
          </div>

          <button
            className="secondary-button"
            type="button"
            onClick={() =>
              void loadOverview()
            }
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
                            void openRunResults(
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

        {renderRunResults()}
      </>
    );
  }

  function renderServices() {
    return (
      <>
        <header className="page-header">
          <div>
            <span className="eyebrow">
              Infraestructura
            </span>

            <h1>Servicios</h1>

            <p>
              Acceso a las herramientas que
              soportan la plataforma.
            </p>
          </div>
        </header>

        <section className="service-grid">
          <a
            className="service-card"
            href={`${window.location.protocol}//${window.location.hostname}:5000`}
            target="_blank"
            rel="noreferrer"
          >
            <span>Tracking</span>
            <h2>MLflow</h2>
            <p>
              Runs, parámetros, métricas y
              artefactos.
            </p>
          </a>

          <a
            className="service-card"
            href={`${window.location.protocol}//${window.location.hostname}:9000`}
            target="_blank"
            rel="noreferrer"
          >
            <span>Object storage</span>
            <h2>MinIO</h2>
            <p>
              Documentos, datasets y
              artefactos experimentales.
            </p>
          </a>

          <a
            className="service-card"
            href={`${window.location.protocol}//${window.location.hostname}:3000`}
            target="_blank"
            rel="noreferrer"
          >
            <span>Analítica</span>
            <h2>Metabase</h2>
            <p>
              Dashboards y análisis
              comparativo.
            </p>
          </a>

          <a
            className="service-card"
            href={`${window.location.protocol}//${window.location.hostname}:8000/docs`}
            target="_blank"
            rel="noreferrer"
          >
            <span>API</span>
            <h2>FastAPI</h2>
            <p>
              Documentación OpenAPI
              interactiva.
            </p>
          </a>

           <a
              className="service-card"
              href={`${window.location.protocol}//${window.location.hostname}:11434`}
              target="_blank"
              rel="noreferrer"
            >
              <span>Model serving</span>
              <h2>Ollama</h2>
              <p>
                Servicio de modelos generativos y
                modelos de embeddings.
              </p>
            </a>

           <a
              className="service-card"
              href={`${window.location.protocol}//${window.location.hostname}:8001`}
              target="_blank"
              rel="noreferrer"
            >
              <span>Vector database</span>
              <h2>ChromaDB</h2>
              <p>
                Colecciones vectoriales, embeddings
                y fragmentos indexados.
              </p>
            </a>

          <a
              className="service-card"
              href={`${window.location.protocol}//${window.location.hostname}:3001`}
              target="_blank"
              rel="noreferrer"
            >
              <span>Gestión de modelos</span>
              <h2>Open WebUI</h2>
              <p>
                Instalación, administración y prueba
                de modelos disponibles en Ollama.
              </p>
            </a>
        </section>
      </>
    );
  }

  function renderCurrentView() {
    switch (view) {
      case "corpora":
        return <CorporaPage />;

      case "datasets":
        return renderDatasets();

      case "experiments":
        return renderExperiments();

      case "runs":
        return renderRuns();

      case "analytics":
        return <AnalyticsPage />;

      case "comparator":
        return <ComparatorPage />;

      case "leaderboard":
        return <LeaderboardPage />;

      case "insights":
        return <InsightsPage />;

      case "recommendations":
        return <RecommendationsPage />;

      case "services":
        return renderServices();

      default:
        return renderDashboard();
    }
  }

  return (
    <div className="app-shell">
      <AppSidebar
        activeView={view}
        systemStatus={
          systemStatus?.status ?? null
        }
        onNavigate={setView}
      />

      <main className="main-content">
        {error && (
          <div className="alert alert-error">
            <span>{error}</span>

            <button
              type="button"
              onClick={() =>
                setError(null)
              }
            >
              Cerrar
            </button>
          </div>
        )}

        {notice && (
          <div className="alert alert-success">
            <span>{notice}</span>

            <button
              type="button"
              onClick={() =>
                setNotice(null)
              }
            >
              Cerrar
            </button>
          </div>
        )}

        {loading ? (
          <div className="loading-state">
            Cargando plataforma
            experimental…
          </div>
        ) : (
          renderCurrentView()
        )}
      </main>
    </div>
  );
}

export default App;