import {
  useState,
  type FormEvent,
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

export type CorpusSummary = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type DatasetGenerationForm = {
  corpusId: string;
  name: string;
  description: string;
  version: number;
  provider: "ollama";
  model: string;
  language: "es" | "en";
  questionsPerDocument: number;
  chunkingStrategy:
    | "fixed"
    | "recursive";
  chunkSize: number;
  chunkOverlap: number;
  temperature: number;
};

type DatasetsPageProps = {
  corpora: CorpusSummary[];
  datasets: DatasetSummary[];
  selectedDataset:
    DatasetDetail | null;
  datasetForm: DatasetForm;
  datasetGenerationForm:
    DatasetGenerationForm;
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
  onDatasetGenerationFormChange: (
    updater: (
      current:
        DatasetGenerationForm,
    ) => DatasetGenerationForm,
  ) => void;
  onCreateDataset: (
    event: FormEvent<HTMLFormElement>,
  ) => void;
  onGenerateDatasetFromCorpus: (
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
  corpora,
  datasets,
  selectedDataset,
  datasetForm,
  datasetGenerationForm,
  actionLoading,
  onOpenDataset,
  onCloseDataset,
  onDatasetFormChange,
  onDatasetGenerationFormChange,
  onCreateDataset,
  onGenerateDatasetFromCorpus,
}: DatasetsPageProps) {
  const [creationMode, setCreationMode] =
    useState<"manual" | "generated">(
      "manual",
    );
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
              <h2>Nuevo dataset</h2>

              <p>
                Crea el dataset manualmente
                o genera sus preguntas desde
                los documentos de un corpus.
              </p>
            </div>
          </div>

          <div
            className="form-grid"
            role="group"
            aria-label="Modo de creación"
          >
            <label>
              Método de creación

              <select
                value={creationMode}
                disabled={actionLoading}
                onChange={(event) =>
                  setCreationMode(
                    event.target.value as
                      | "manual"
                      | "generated",
                  )
                }
              >
                <option value="manual">
                  Creación manual
                </option>

                <option value="generated">
                  Generar desde corpus
                </option>
              </select>
            </label>
          </div>

          {creationMode === "manual" ? (
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
          ) : (
            <form
              className="form-grid"
              onSubmit={
                onGenerateDatasetFromCorpus
              }
            >
              <label>
                Corpus de origen

                <select
                  required
                  value={
                    datasetGenerationForm
                      .corpusId
                  }
                  disabled={actionLoading}
                  onChange={(event) =>
                    onDatasetGenerationFormChange(
                      (current) => ({
                        ...current,
                        corpusId:
                          event.target.value,
                      }),
                    )
                  }
                >
                  <option value="">
                    Selecciona un corpus
                  </option>

                  {corpora.map((corpus) => (
                    <option
                      key={corpus.id}
                      value={corpus.id}
                    >
                      {corpus.name}
                    </option>
                  ))}
                </select>
              </label>

              {corpora.length === 0 && (
                <p className="empty-message">
                  Debes crear un corpus y
                  añadir documentos antes de
                  generar un dataset.
                </p>
              )}

              <label>
                Nombre

                <input
                  required
                  minLength={3}
                  maxLength={200}
                  value={
                    datasetGenerationForm.name
                  }
                  disabled={actionLoading}
                  onChange={(event) =>
                    onDatasetGenerationFormChange(
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
                  maxLength={5000}
                  value={
                    datasetGenerationForm
                      .description
                  }
                  disabled={actionLoading}
                  onChange={(event) =>
                    onDatasetGenerationFormChange(
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
                Versión

                <input
                  required
                  type="number"
                  min={1}
                  step={1}
                  value={
                    datasetGenerationForm
                      .version
                  }
                  disabled={actionLoading}
                  onChange={(event) =>
                    onDatasetGenerationFormChange(
                      (current) => ({
                        ...current,
                        version: Number(
                          event.target.value,
                        ),
                      }),
                    )
                  }
                />
              </label>

              <label>
                Modelo de Ollama

                <input
                  required
                  value={
                    datasetGenerationForm.model
                  }
                  disabled={actionLoading}
                  onChange={(event) =>
                    onDatasetGenerationFormChange(
                      (current) => ({
                        ...current,
                        model:
                          event.target.value,
                      }),
                    )
                  }
                />
              </label>

              <label>
                Idioma

                <select
                  value={
                    datasetGenerationForm
                      .language
                  }
                  disabled={actionLoading}
                  onChange={(event) =>
                    onDatasetGenerationFormChange(
                      (current) => ({
                        ...current,
                        language:
                          event.target.value as
                            | "es"
                            | "en",
                      }),
                    )
                  }
                >
                  <option value="es">
                    Español
                  </option>

                  <option value="en">
                    Inglés
                  </option>
                </select>
              </label>

              <label>
                Preguntas por documento

                <input
                  required
                  type="number"
                  min={1}
                  max={10}
                  step={1}
                  value={
                    datasetGenerationForm
                      .questionsPerDocument
                  }
                  disabled={actionLoading}
                  onChange={(event) =>
                    onDatasetGenerationFormChange(
                      (current) => ({
                        ...current,
                        questionsPerDocument:
                          Number(
                            event.target.value,
                          ),
                      }),
                    )
                  }
                />
              </label>

              <label>
                Estrategia de fragmentación

                <select
                  value={
                    datasetGenerationForm
                      .chunkingStrategy
                  }
                  disabled={actionLoading}
                  onChange={(event) =>
                    onDatasetGenerationFormChange(
                      (current) => ({
                        ...current,
                        chunkingStrategy:
                          event.target.value as
                            | "fixed"
                            | "recursive",
                      }),
                    )
                  }
                >
                  <option value="recursive">
                    Recursiva
                  </option>

                  <option value="fixed">
                    Tamaño fijo
                  </option>
                </select>
              </label>

              <label>
                Tamaño del chunk

                <input
                  required
                  type="number"
                  min={300}
                  max={10000}
                  step={1}
                  value={
                    datasetGenerationForm
                      .chunkSize
                  }
                  disabled={actionLoading}
                  onChange={(event) =>
                    onDatasetGenerationFormChange(
                      (current) => ({
                        ...current,
                        chunkSize: Number(
                          event.target.value,
                        ),
                      }),
                    )
                  }
                />
              </label>

              <label>
                Solapamiento

                <input
                  required
                  type="number"
                  min={0}
                  max={5000}
                  step={1}
                  value={
                    datasetGenerationForm
                      .chunkOverlap
                  }
                  disabled={actionLoading}
                  onChange={(event) =>
                    onDatasetGenerationFormChange(
                      (current) => ({
                        ...current,
                        chunkOverlap:
                          Number(
                            event.target.value,
                          ),
                      }),
                    )
                  }
                />
              </label>

              <label>
                Temperatura

                <input
                  required
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={
                    datasetGenerationForm
                      .temperature
                  }
                  disabled={actionLoading}
                  onChange={(event) =>
                    onDatasetGenerationFormChange(
                      (current) => ({
                        ...current,
                        temperature:
                          Number(
                            event.target.value,
                          ),
                      }),
                    )
                  }
                />
              </label>

              <button
                className="primary-button"
                type="submit"
                disabled={
                  actionLoading ||
                  corpora.length === 0
                }
              >
                {actionLoading
                  ? "Generando…"
                  : "Generar dataset"}
              </button>
            </form>
          )}
        </article>
      </section>
    </>
  );
}

export default DatasetsPage;
