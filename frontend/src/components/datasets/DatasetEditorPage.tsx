import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import DatasetQuestionEditor from "./DatasetQuestionEditor";

import {
  addDatasetQuestion,
  deleteDataset,
  deleteDatasetQuestion,
  getDataset,
  updateDataset,
  updateDatasetQuestion,
  updateDatasetStatus,
  type DatasetDetail,
  type DatasetQuestion,
  type DatasetQuestionCreate,
  type DatasetStatus,
} from "../../services/datasets";

type Props = {
  datasetId: string;
  onClose: () => void;
};

function toQuestionEditorValue(
  question: DatasetQuestion,
): DatasetQuestionCreate {
  return {
    question: question.question,
    expectedAnswer:
      question.expected_answer ?? "",
    expectedContexts:
      question.expected_contexts ?? [],
    metadata: question.metadata ?? {},
    orderIndex: question.order_index,
  };
}

function DatasetEditorPage({
  datasetId,
  onClose,
}: Props) {
  const [
    dataset,
    setDataset,
  ] = useState<DatasetDetail | null>(
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

  const [
    editingDataset,
    setEditingDataset,
  ] = useState(false);

  const [
    editingQuestionId,
    setEditingQuestionId,
  ] = useState<string | null>(
    null,
  );

  const [
    name,
    setName,
  ] = useState("");

  const [
    description,
    setDescription,
  ] = useState("");

  const [
    version,
    setVersion,
  ] = useState(1);

  async function loadDataset() {
    try {
      setLoading(true);
      setError(null);

      const response =
        await getDataset(
          datasetId,
        );

      setDataset(response);
      setName(response.name);
      setDescription(
        response.description ?? "",
      );
      setVersion(response.version);
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
    setError(null);

    try {
      await addDatasetQuestion(
        datasetId,
        question,
      );

      await loadDataset();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo añadir la pregunta.",
      );

      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateQuestion(
    questionId: string,
    question: DatasetQuestionCreate,
  ) {
    setSaving(true);
    setError(null);

    try {
      await updateDatasetQuestion(
        questionId,
        {
          question:
            question.question,
          expectedAnswer:
            question.expectedAnswer,
          expectedContexts:
            question.expectedContexts,
          metadata:
            question.metadata,
          orderIndex:
            question.orderIndex,
        },
      );

      setEditingQuestionId(null);

      await loadDataset();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo actualizar la pregunta.",
      );

      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteQuestion(
    question: DatasetQuestion,
  ) {
    const confirmed = confirm(
      "¿Eliminar esta pregunta del dataset?",
    );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await deleteDatasetQuestion(
        question.id,
      );

      if (
        editingQuestionId === question.id
      ) {
        setEditingQuestionId(null);
      }

      await loadDataset();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo eliminar la pregunta.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateDataset(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const normalizedName =
      name.trim();

    if (
      normalizedName.length < 1
    ) {
      setError(
        "El nombre del dataset es obligatorio.",
      );

      return;
    }

    if (version < 1) {
      setError(
        "La versión debe ser igual o superior a 1.",
      );

      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated =
        await updateDataset(
          datasetId,
          {
            name:
              normalizedName,
            description:
              description.trim(),
            version,
          },
        );

      setDataset(updated);
      setName(updated.name);
      setDescription(
        updated.description ?? "",
      );
      setVersion(updated.version);
      setEditingDataset(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo actualizar el dataset.",
      );
    } finally {
      setSaving(false);
    }
  }

  function cancelDatasetEdition() {
    if (!dataset) {
      return;
    }

    setName(dataset.name);
    setDescription(
      dataset.description ?? "",
    );
    setVersion(dataset.version);
    setEditingDataset(false);
    setError(null);
  }

  async function changeStatus(
    status: DatasetStatus,
  ) {
    if (!dataset) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated =
        await updateDatasetStatus(
          dataset.id,
          status,
        );

      setDataset(updated);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo cambiar el estado.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeDataset() {
    if (
      !dataset ||
      !confirm(
        "¿Eliminar definitivamente el dataset?",
      )
    ) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await deleteDataset(
        dataset.id,
      );

      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo eliminar el dataset.",
      );
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
        {error ??
          "Dataset no encontrado."}
      </section>
    );
  }

  const editingQuestion =
    dataset.questions.find(
      (question) =>
        question.id ===
        editingQuestionId,
    ) ?? null;

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
            {" · "}
            Estado: {dataset.status}
            {" · "}
            {dataset.questions.length}
            {" "}
            pregunta
            {dataset.questions.length === 1
              ? ""
              : "s"}
          </p>
        </div>

        <div className="button-row">
          <button
            className="secondary-button"
            type="button"
            disabled={saving}
            onClick={onClose}
          >
            Volver
          </button>

          <button
            className="secondary-button"
            type="button"
            disabled={saving}
            onClick={() =>
              setEditingDataset(true)
            }
          >
            Editar dataset
          </button>

          <button
            className="secondary-button"
            type="button"
            disabled={
              saving ||
              dataset.status === "draft"
            }
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
            type="button"
            disabled={
              saving ||
              dataset.status === "ready"
            }
            onClick={() =>
              void changeStatus(
                "ready",
              )
            }
          >
            Ready
          </button>

          <button
            className="secondary-button"
            type="button"
            disabled={
              saving ||
              dataset.status === "archived"
            }
            onClick={() =>
              void changeStatus(
                "archived",
              )
            }
          >
            Archivar
          </button>

          <button
            className="danger-button"
            type="button"
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
          <span>{error}</span>

          <button
            type="button"
            disabled={saving}
            onClick={() =>
              setError(null)
            }
          >
            Cerrar
          </button>
        </div>
      )}

      {editingDataset && (
        <section className="panel">
          <form
            onSubmit={
              handleUpdateDataset
            }
          >
            <div className="page-header">
              <div>
                <span className="eyebrow">
                  CONFIGURACIÓN
                </span>

                <h2>
                  Editar dataset
                </h2>

                <p>
                  Modifica los datos
                  generales del conjunto
                  de evaluación.
                </p>
              </div>
            </div>

            <div className="dataset-question-editor-grid">
              <label className="dataset-question-field">
                <span>Nombre</span>

                <input
                  required
                  type="text"
                  value={name}
                  disabled={saving}
                  onChange={(event) =>
                    setName(
                      event.target.value,
                    )
                  }
                />
              </label>

              <label className="dataset-question-field">
                <span>Versión</span>

                <input
                  required
                  min={1}
                  type="number"
                  value={version}
                  disabled={saving}
                  onChange={(event) =>
                    setVersion(
                      Number(
                        event.target.value,
                      ),
                    )
                  }
                />
              </label>

              <label className="dataset-question-field dataset-question-field-wide">
                <span>
                  Descripción
                </span>

                <textarea
                  rows={4}
                  value={description}
                  disabled={saving}
                  onChange={(event) =>
                    setDescription(
                      event.target.value,
                    )
                  }
                />
              </label>
            </div>

            <div className="button-row">
              <button
                className="secondary-button"
                type="button"
                disabled={saving}
                onClick={
                  cancelDatasetEdition
                }
              >
                Cancelar
              </button>

              <button
                className="primary-button"
                type="submit"
                disabled={saving}
              >
                {saving
                  ? "Guardando..."
                  : "Guardar cambios"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="panel">
        <h2>
          Añadir nueva pregunta
        </h2>

        <DatasetQuestionEditor
          disabled={saving}
          resetAfterSubmit
          submitLabel="Añadir pregunta"
          onSubmit={
            handleAddQuestion
          }
        />
      </section>

      <section className="panel">
        <div className="page-header">
          <div>
            <h2>
              Preguntas
            </h2>

            <p>
              Casos de evaluación
              incluidos en este dataset.
            </p>
          </div>
        </div>

        {dataset.questions.length ===
        0 ? (
          <p>
            El dataset todavía no
            contiene preguntas.
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Pregunta</th>
                <th>Respuesta</th>
                <th>Contextos</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {dataset.questions.map(
                (question) => (
                  <tr
                    key={question.id}
                  >
                    <td>
                      {question.order_index +
                        1}
                    </td>

                    <td>
                      {question.question}
                    </td>

                    <td>
                      {question.expected_answer ??
                        "-"}
                    </td>

                    <td>
                      {question
                        .expected_contexts
                        ?.length ?? 0}
                    </td>

                    <td>
                      <div className="button-row">
                        <button
                          className="secondary-button"
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            setEditingQuestionId(
                              question.id,
                            )
                          }
                        >
                          Editar
                        </button>

                        <button
                          className="danger-button"
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            void handleDeleteQuestion(
                              question,
                            )
                          }
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        )}
      </section>

      {editingQuestion && (
        <section className="panel">
          <DatasetQuestionEditor
            key={
              editingQuestion.id
            }
            initialValue={
              toQuestionEditorValue(
                editingQuestion,
              )
            }
            title="Editar pregunta"
            description={
              "Modifica el caso de evaluación seleccionado."
            }
            submitLabel="Guardar cambios"
            disabled={saving}
            onCancel={() =>
              setEditingQuestionId(
                null,
              )
            }
            onSubmit={(
              question,
            ) =>
              handleUpdateQuestion(
                editingQuestion.id,
                question,
              )
            }
          />
        </section>
      )}
    </section>
  );
}

export default DatasetEditorPage;
