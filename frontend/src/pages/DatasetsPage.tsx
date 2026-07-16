import type {
  FormEvent,
} from "react";

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
                con una pregunta.
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

      {selectedDataset && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">
                Detalle del dataset
              </span>

              <h2>
                {selectedDataset.name}
              </h2>

              <p>
                Versión{" "}
                {selectedDataset.version}
                {" · "}
                {
                  selectedDataset.questions
                    .length
                }{" "}
                pregunta
                {selectedDataset.questions
                  .length === 1
                  ? ""
                  : "s"}
              </p>
            </div>

            <button
              className="icon-button"
              type="button"
              onClick={onCloseDataset}
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

                  {question.expected_contexts &&
                    question
                      .expected_contexts
                      .length > 0 && (
                    <div className="question-contexts">
                      <strong>
                        Contextos esperados
                      </strong>

                      <ul>
                        {question.expected_contexts.map(
                          (
                            context,
                            index,
                          ) => (
                            <li
                              key={`${question.id}-${index}`}
                            >
                              {context}
                            </li>
                          ),
                        )}
                      </ul>
                    </div>
                  )}
                </article>
              ),
            )}

            {selectedDataset.questions
              .length === 0 && (
              <p className="empty-message">
                Este dataset no contiene
                preguntas.
              </p>
            )}
          </div>
        </section>
      )}
    </>
  );
}

export default DatasetsPage;
