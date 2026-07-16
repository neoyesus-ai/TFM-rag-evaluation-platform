import {
  useEffect,
  useState,
} from "react";

import DatasetQuestionEditor from "./DatasetQuestionEditor";

import {
  addDatasetQuestion,
  getDataset,
  updateDatasetStatus,
  deleteDataset,
  type DatasetDetail,
  type DatasetQuestionCreate,
  type DatasetStatus,
} from "../../services/datasets";

type Props = {
  datasetId: string;
  onClose: () => void;
};

function DatasetEditorPage({
  datasetId,
  onClose,
}: Props) {
  const [
    dataset,
    setDataset,
  ] =
    useState<DatasetDetail | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  async function loadDataset() {
    try {
      setLoading(true);

      const response =
        await getDataset(
          datasetId,
        );

      setDataset(response);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo cargar el dataset.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDataset();
  }, [datasetId]);

  async function handleAddQuestion(
    question: DatasetQuestionCreate,
  ) {
    setSaving(true);

    try {
      await addDatasetQuestion(
        datasetId,
        question,
      );

      await loadDataset();
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(
    status: DatasetStatus,
  ) {
    if (!dataset) {
      return;
    }

    setSaving(true);

    try {
      const updated =
        await updateDatasetStatus(
          dataset.id,
          status,
        );

      setDataset(updated);
    } finally {
      setSaving(false);
    }
  }

  async function removeDataset() {
    if (
      !dataset ||
      !confirm(
        "¿Eliminar el dataset?"
      )
    ) {
      return;
    }

    setSaving(true);

    try {
      await deleteDataset(
        dataset.id,
      );

      onClose();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="panel">
        Cargando dataset...
      </section>
    );
  }

  if (!dataset) {
    return (
      <section className="panel">
        Dataset no encontrado.
      </section>
    );
  }

  return (
    <section className="dataset-editor-page">

      <header className="page-header">

        <div>

          <span className="eyebrow">
            DATASET
          </span>

          <h1>
            {dataset.name}
          </h1>

          <p>
            Versión {dataset.version}
          </p>

        </div>

        <div className="button-row">

          <button
            className="secondary-button"
            onClick={onClose}
          >
            Volver
          </button>

          <button
            className="secondary-button"
            disabled={saving}
            onClick={() =>
              void changeStatus(
                "draft",
              )
            }
          >
            Draft
          </button>

          <button
            className="secondary-button"
            disabled={saving}
            onClick={() =>
              void changeStatus(
                "ready",
              )
            }
          >
            Ready
          </button>

          <button
            className="danger-button"
            disabled={saving}
            onClick={() =>
              void removeDataset()
            }
          >
            Eliminar
          </button>

        </div>

      </header>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      <section className="panel">

        <h2>
          Añadir nueva pregunta
        </h2>

        <DatasetQuestionEditor
          disabled={saving}
          submitLabel="Añadir pregunta"
          onSubmit={
            handleAddQuestion
          }
        />

      </section>

      <section className="panel">

        <h2>
          Preguntas
        </h2>

        <table className="table">

          <thead>

            <tr>

              <th>#</th>

              <th>Pregunta</th>

              <th>Respuesta</th>

            </tr>

          </thead>

          <tbody>

            {dataset.questions.map(
              (
                question,
              ) => (

                <tr
                  key={
                    question.id
                  }
                >

                  <td>
                    {question.order_index +
                      1}
                  </td>

                  <td>
                    {
                      question.question
                    }
                  </td>

                  <td>
                    {question.expected_answer ??
                      "-"}
                  </td>

                </tr>

              ),
            )}

          </tbody>

        </table>

      </section>

    </section>
  );
}

export default DatasetEditorPage;
