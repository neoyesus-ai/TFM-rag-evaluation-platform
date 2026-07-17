import type {
  FormEvent,
} from "react";

import DatasetEditorPage from "../components/datasets/DatasetEditorPage";

export type DatasetSummary = {
  id: string;
  name: string;
  description: string | null;
  version: number;
  status: string;
  question_count: number;
  created_at: string;
  updated_at: string;
};

export type DatasetQuestion = {
  id: string;
  dataset_id: string;
  question: string;
  expected_answer: string | null;
  expected_contexts: string[] | null;
  metadata: Record<string, unknown>;
  order_index: number;
};

export type DatasetDetail =
  DatasetSummary & {
    questions: DatasetQuestion[];
  };

export type DatasetForm = {
  name: string;
  description: string;
  question: string;
  expectedAnswer: string;
};

type DatasetsPageProps = {
  datasets: DatasetSummary[];
  selectedDataset: DatasetDetail | null;
  datasetForm: DatasetForm;
  actionLoading: boolean;
  onOpenDataset: (
    datasetId: string,
  ) => void;
  onCloseDataset: () => void;
  onDatasetFormChange: (
    updater: (
      current: DatasetForm,
    ) => DatasetForm,
  ) => void;
  onCreateDataset: (
    event: FormEvent<HTMLFormElement>,
  ) => void;
};

function statusLabel(
  status: string,
): string {
  const labels: Record<
    string,
    string
  > = {
    ready: "Preparado",
    draft: "Borrador",
    archived: "Archivado",
  };

  return labels[status] ?? status;
}

function DatasetsPage({
  datasets,
  selectedDataset,
  datasetForm,
  actionLoading,
  onOpenDataset,
  onCloseDataset,
  onDatasetFormChange,
  onCreateDataset,
}: DatasetsPageProps) {
  if (selectedDataset) {
    return (
      <DatasetEditorPage
        datasetId={selectedDataset.id}
        onClose={onCloseDataset}
      />
    );
  }

  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow">
            Recursos de evaluación
          </span>

          <h1>Dataset Studio</h1>

          <p>
            Crea y gestiona las preguntas,
            respuestas esperadas, contextos
            y metadatos utilizados durante
            la evaluación de los pipelines.
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
                {datasets.length} conjunto
                {datasets.length === 1
                  ? ""
                  : "s"}{" "}
                disponible
                {datasets.length === 1
                  ? ""
                  : "s"}.
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
                    onOpenDataset(
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
                      pregunta
                      {dataset.question_count ===
                      1
                        ? ""
                        : "s"}
                    </span>

                    <span
                      className={[
                        "status-badge",
                        `status-${dataset.status}`,
                      ].join(" ")}
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
              <h2>
                Nuevo dataset
              </h2>

              <p>
                Crea un conjunto inicial
                con su primera pregunta de
                evaluación.
              </p>
            </div>
          </div>

          <form
            className="form-grid"
            onSubmit={onCreateDataset}
          >
            <label>
              Nombre

              <input
                required
                minLength={3}
                value={datasetForm.name}
                disabled={actionLoading}
                onChange={(event) =>
                  onDatasetFormChange(
                    (current) => ({
                      ...current,
                      name:
                        event.target.value,
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
                disabled={actionLoading}
                onChange={(event) =>
                  onDatasetFormChange(
                    (current) => ({
                      ...current,
                      description:
                        event.target.value,
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
                disabled={actionLoading}
                onChange={(event) =>
                  onDatasetFormChange(
                    (current) => ({
                      ...current,
                      question:
                        event.target.value,
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
                disabled={actionLoading}
                onChange={(event) =>
                  onDatasetFormChange(
                    (current) => ({
                      ...current,
                      expectedAnswer:
                        event.target.value,
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
              {actionLoading
                ? "Creando…"
                : "Crear dataset"}
            </button>
          </form>
        </article>
      </section>
    </>
  );
}

export default DatasetsPage;
