import {
  useMemo,
  useState,
} from "react";

import type {
  DatasetQuestionCreate,
} from "../../services/datasets";

type DatasetQuestionEditorProps = {
  initialValue?: DatasetQuestionCreate;
  submitLabel?: string;
  disabled?: boolean;
  onSubmit: (
    value: DatasetQuestionCreate,
  ) => Promise<void> | void;
  onCancel?: () => void;
};

const EMPTY_QUESTION: DatasetQuestionCreate = {
  question: "",
  expectedAnswer: "",
  expectedContexts: [],
  metadata: {},
};

function DatasetQuestionEditor({
  initialValue = EMPTY_QUESTION,
  submitLabel = "Guardar pregunta",
  disabled = false,
  onSubmit,
  onCancel,
}: DatasetQuestionEditorProps) {
  const [
    question,
    setQuestion,
  ] = useState(initialValue.question);

  const [
    expectedAnswer,
    setExpectedAnswer,
  ] = useState(
    initialValue.expectedAnswer,
  );

  const [
    contextsText,
    setContextsText,
  ] = useState(
    initialValue.expectedContexts.join(
      "\n\n",
    ),
  );

  const [
    category,
    setCategory,
  ] = useState(
    String(
      initialValue.metadata.category ?? "",
    ),
  );

  const [
    difficulty,
    setDifficulty,
  ] = useState(
    String(
      initialValue.metadata.difficulty ??
        "medium",
    ),
  );

  const [
    tagsText,
    setTagsText,
  ] = useState(
    Array.isArray(
      initialValue.metadata.tags,
    )
      ? initialValue.metadata.tags
          .map(String)
          .join(", ")
      : "",
  );

  const [
    notes,
    setNotes,
  ] = useState(
    String(
      initialValue.metadata.notes ?? "",
    ),
  );

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(null);

  const expectedContexts = useMemo(
    () =>
      contextsText
        .split(/\n\s*\n/)
        .map((context) =>
          context.trim(),
        )
        .filter(Boolean),
    [contextsText],
  );

  const tags = useMemo(
    () =>
      tagsText
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    [tagsText],
  );

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (question.trim().length < 3) {
      setError(
        "La pregunta debe tener al menos 3 caracteres.",
      );
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSubmit({
        question: question.trim(),
        expectedAnswer:
          expectedAnswer.trim(),
        expectedContexts,
        metadata: {
          category:
            category.trim() || null,
          difficulty,
          tags,
          notes:
            notes.trim() || null,
          source: "frontend-editor",
        },
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo guardar la pregunta.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="dataset-question-editor"
      onSubmit={handleSubmit}
    >
      <div className="dataset-question-editor-heading">
        <div>
          <span className="eyebrow">
            Caso de evaluación
          </span>

          <h3>
            Pregunta y respuesta esperada
          </h3>

          <p>
            Define el caso que utilizará el
            pipeline para evaluar la
            recuperación y la generación.
          </p>
        </div>
      </div>

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

      <div className="dataset-question-editor-grid">
        <label className="dataset-question-field dataset-question-field-wide">
          <span>Pregunta</span>

          <textarea
            required
            minLength={3}
            rows={4}
            placeholder="Escribe la pregunta que se utilizará durante la evaluación."
            value={question}
            disabled={disabled || saving}
            onChange={(event) =>
              setQuestion(
                event.target.value,
              )
            }
          />
        </label>

        <label className="dataset-question-field dataset-question-field-wide">
          <span>
            Respuesta esperada
          </span>

          <textarea
            rows={4}
            placeholder="Respuesta de referencia con la que se comparará la salida del modelo."
            value={expectedAnswer}
            disabled={disabled || saving}
            onChange={(event) =>
              setExpectedAnswer(
                event.target.value,
              )
            }
          />
        </label>

        <label className="dataset-question-field dataset-question-field-wide">
          <span>
            Contextos esperados
          </span>

          <textarea
            rows={6}
            placeholder={"Escribe un contexto esperado.\n\nSepara cada contexto adicional con una línea en blanco."}
            value={contextsText}
            disabled={disabled || saving}
            onChange={(event) =>
              setContextsText(
                event.target.value,
              )
            }
          />

          <small>
            Se han detectado{" "}
            {expectedContexts.length}{" "}
            contexto
            {expectedContexts.length === 1
              ? ""
              : "s"}.
          </small>
        </label>

        <label className="dataset-question-field">
          <span>Categoría</span>

          <input
            type="text"
            placeholder="Ej. normativa"
            value={category}
            disabled={disabled || saving}
            onChange={(event) =>
              setCategory(
                event.target.value,
              )
            }
          />
        </label>

        <label className="dataset-question-field">
          <span>Dificultad</span>

          <select
            value={difficulty}
            disabled={disabled || saving}
            onChange={(event) =>
              setDifficulty(
                event.target.value,
              )
            }
          >
            <option value="easy">
              Fácil
            </option>

            <option value="medium">
              Media
            </option>

            <option value="hard">
              Difícil
            </option>
          </select>
        </label>

        <label className="dataset-question-field dataset-question-field-wide">
          <span>Etiquetas</span>

          <input
            type="text"
            placeholder="rag, normativa, precisión"
            value={tagsText}
            disabled={disabled || saving}
            onChange={(event) =>
              setTagsText(
                event.target.value,
              )
            }
          />

          <small>
            Separa las etiquetas por comas.
          </small>
        </label>

        <label className="dataset-question-field dataset-question-field-wide">
          <span>Notas</span>

          <textarea
            rows={3}
            placeholder="Observaciones internas sobre el caso de evaluación."
            value={notes}
            disabled={disabled || saving}
            onChange={(event) =>
              setNotes(
                event.target.value,
              )
            }
          />
        </label>
      </div>

      <footer className="dataset-question-editor-actions">
        <div>
          {onCancel && (
            <button
              className="secondary-button"
              type="button"
              disabled={saving}
              onClick={onCancel}
            >
              Cancelar
            </button>
          )}
        </div>

        <div>
          <button
            className="primary-button"
            type="submit"
            disabled={disabled || saving}
          >
            {saving
              ? "Guardando…"
              : submitLabel}
          </button>
        </div>
      </footer>
    </form>
  );
}

export default DatasetQuestionEditor;
