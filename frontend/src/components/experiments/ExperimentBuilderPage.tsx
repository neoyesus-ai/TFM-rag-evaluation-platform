import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createExperiment,
  createExperimentRun,
  getExperimentBuilderResources,
} from "../../services/experiment-builder";
import type {
  CreatedExperiment,
  ExperimentBuilderCorpus,
  ExperimentBuilderDataset,
  ExperimentBuilderForm,
  ExperimentBuilderStep,
  ExperimentTemplate,
  SavedExperimentTemplate,
} from "../../types/experiment-builder";
import {
  EMPTY_EXPERIMENT_BUILDER_FORM,
} from "../../types/experiment-builder";
import ConfigurationEditorStep from "./ConfigurationEditorStep";
import ExperimentIdentityStep from "./ExperimentIdentityStep";
import ExperimentReviewStep from "./ExperimentReviewStep";
import TemplateSelectorStep from "./TemplateSelectorStep";
import "./experiment-builder.css";

type ExperimentBuilderPageProps = {
  onCreated?: (
    experiment: CreatedExperiment,
  ) => void;
  onOpenRuns?: () => void;
};

const STEPS: Array<{
  key: ExperimentBuilderStep;
  label: string;
}> = [
  {
    key: "identity",
    label: "Identidad",
  },
  {
    key: "template",
    label: "Plantilla",
  },
  {
    key: "configuration",
    label: "Configuración",
  },
  {
    key: "review",
    label: "Revisión",
  },
];

function cloneInitialForm(): ExperimentBuilderForm {
  return structuredClone(
    EMPTY_EXPERIMENT_BUILDER_FORM,
  );
}

function ExperimentBuilderPage({
  onCreated,
  onOpenRuns,
}: ExperimentBuilderPageProps) {
  const [
    form,
    setForm,
  ] = useState<ExperimentBuilderForm>(
    cloneInitialForm,
  );

  const [
    currentStep,
    setCurrentStep,
  ] = useState<ExperimentBuilderStep>(
    "identity",
  );

  const [
    corpora,
    setCorpora,
  ] = useState<
    ExperimentBuilderCorpus[]
  >([]);

  const [
    datasets,
    setDatasets,
  ] = useState<
    ExperimentBuilderDataset[]
  >([]);

  const [
    builtinTemplates,
    setBuiltinTemplates,
  ] = useState<
    ExperimentTemplate[]
  >([]);

  const [
    customTemplates,
    setCustomTemplates,
  ] = useState<
    SavedExperimentTemplate[]
  >([]);

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
  ] = useState<string | null>(null);

  const [
    notice,
    setNotice,
  ] = useState<string | null>(null);

  const [
    createdExperiment,
    setCreatedExperiment,
  ] = useState<
    CreatedExperiment | null
  >(null);

  const loadResources =
    useCallback(async () => {
      setLoading(true);
      setError(null);

      try {
        const resources =
          await getExperimentBuilderResources();

        setCorpora(resources.corpora);
        setDatasets(resources.datasets);
        setBuiltinTemplates(
          resources.builtinTemplates,
        );
        setCustomTemplates(
          resources.customTemplates,
        );
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : (
                "No se pudieron cargar "
                + "los recursos del constructor."
              ),
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadResources();
  }, [loadResources]);

  const currentStepIndex =
    STEPS.findIndex(
      (step) =>
        step.key === currentStep,
    );

  const canContinue = useMemo(() => {
    if (currentStep === "identity") {
      return (
        form.name.trim().length >= 3 &&
        form.corpusId.length > 0
      );
    }

    if (
      currentStep === "configuration"
    ) {
      return (
        form.configuration.chunking
          .chunk_overlap <
          form.configuration.chunking
            .chunk_size &&
        form.configuration.evaluation
          .metrics.length > 0 &&
        form.configuration.embedding.model
          .trim().length > 0 &&
        form.configuration.generation.model
          .trim().length > 0
      );
    }

    return true;
  }, [currentStep, form]);

  function updateForm(
    updater: (
      current: ExperimentBuilderForm,
    ) => ExperimentBuilderForm,
  ) {
    setForm((current) =>
      updater(current),
    );

    setError(null);
    setNotice(null);
  }

  function goToNextStep() {
    if (!canContinue) {
      setError(
        "Completa los campos obligatorios antes de continuar.",
      );

      return;
    }

    const nextStep =
      STEPS[currentStepIndex + 1];

    if (nextStep) {
      setCurrentStep(nextStep.key);
      setError(null);
    }
  }

  function goToPreviousStep() {
    const previousStep =
      STEPS[currentStepIndex - 1];

    if (previousStep) {
      setCurrentStep(
        previousStep.key,
      );
      setError(null);
    }
  }

  function goToStep(
    step: ExperimentBuilderStep,
  ) {
    const targetIndex =
      STEPS.findIndex(
        (item) =>
          item.key === step,
      );

    if (
      targetIndex <=
      currentStepIndex
    ) {
      setCurrentStep(step);
      setError(null);
    }
  }

  function validateBeforeSave():
    | string
    | null {
    if (form.name.trim().length < 3) {
      return (
        "El nombre del experimento "
        + "debe tener al menos 3 caracteres."
      );
    }

    if (!form.corpusId) {
      return (
        "Debes seleccionar un corpus."
      );
    }

    if (
      form.configuration.chunking
        .chunk_overlap >=
      form.configuration.chunking
        .chunk_size
    ) {
      return (
        "El overlap debe ser menor "
        + "que el tamaño del chunk."
      );
    }

    if (
      form.configuration.evaluation
        .metrics.length === 0
    ) {
      return (
        "Debes seleccionar al menos "
        + "una métrica de evaluación."
      );
    }

    return null;
  }

  async function saveExperiment(
    executeAfterSave: boolean,
  ) {
    const validationError =
      validateBeforeSave();

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const experiment =
        await createExperiment(form);

      setCreatedExperiment(
        experiment,
      );

      onCreated?.(experiment);

      const firstVersion =
        experiment.versions[0];

      if (
        executeAfterSave &&
        firstVersion
      ) {
        if (!form.datasetId) {
          throw new Error(
            "El experimento se ha creado, "
              + "pero no puede ejecutarse "
              + "sin un dataset asignado.",
          );
        }

        setNotice(
          "Experimento creado. "
            + "La ejecución está en curso "
            + "y puede tardar alrededor "
            + "de un minuto.",
        );

        const run =
          await createExperimentRun(
            firstVersion.id,
          );

        setNotice(
          run.status === "completed"
            ? (
                "Experimento creado y "
                + "ejecutado correctamente."
              )
            : (
                "Experimento creado. "
                + `La ejecución terminó `
                + `con estado ${run.status}.`
              ),
        );

        onOpenRuns?.();
      } else {
        setNotice(
          "Experimento creado correctamente.",
        );
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : (
              "No se pudo crear "
              + "el experimento."
            ),
      );
    } finally {
      setSaving(false);
    }
  }

  function resetBuilder() {
    setForm(
      cloneInitialForm(),
    );
    setCurrentStep("identity");
    setCreatedExperiment(null);
    setError(null);
    setNotice(null);
  }

  if (loading) {
    return (
      <section className="experiment-builder-loading">
        Cargando constructor de
        experimentos…
      </section>
    );
  }

  if (createdExperiment) {
    return (
      <section className="experiment-builder-success">
        <span className="eyebrow">
          Experimento registrado
        </span>

        <h1>
          {createdExperiment.name}
        </h1>

        <p>
          Se ha creado correctamente con{" "}
          {createdExperiment.versions.length}{" "}
          versión inicial.
        </p>

        <div className="experiment-builder-success-grid">
          <div>
            <span>ID</span>

            <strong>
              {createdExperiment.id}
            </strong>
          </div>

          <div>
            <span>Estado</span>

            <strong>
              {createdExperiment.status}
            </strong>
          </div>

          <div>
            <span>Versiones</span>

            <strong>
              {
                createdExperiment
                  .versions.length
              }
            </strong>
          </div>

          <div>
            <span>Dataset</span>

            <strong>
              {createdExperiment.dataset_id
                ? "Asignado"
                : "No asignado"}
            </strong>
          </div>
        </div>

        <div className="experiment-builder-success-actions">
          <button
            type="button"
            className="primary-button"
            onClick={resetBuilder}
          >
            Crear otro experimento
          </button>

          {onOpenRuns && (
            <button
              type="button"
              className="secondary-button"
              onClick={onOpenRuns}
            >
              Ver ejecuciones
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="experiment-builder-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">
            Constructor experimental
          </span>

          <h1>
            Nuevo experimento
          </h1>

          <p>
            Define una configuración
            reproducible, guárdala como
            versión y ejecútala sobre un
            corpus y un dataset.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={() =>
            void loadResources()
          }
          disabled={saving}
        >
          Recargar recursos
        </button>
      </header>

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

      <div className="experiment-builder-shell">
        <aside className="experiment-builder-progress">
          <div className="experiment-builder-progress-heading">
            <span>Proceso</span>

            <strong>
              Paso{" "}
              {currentStepIndex + 1}
              {" de "}
              {STEPS.length}
            </strong>
          </div>

          <nav>
            {STEPS.map(
              (step, index) => {
                const isActive =
                  step.key ===
                  currentStep;

                const isCompleted =
                  index <
                  currentStepIndex;

                return (
                  <button
                    type="button"
                    key={step.key}
                    className={[
                      "experiment-builder-progress-item",
                      isActive
                        ? "experiment-builder-progress-item-active"
                        : "",
                      isCompleted
                        ? "experiment-builder-progress-item-completed"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() =>
                      goToStep(step.key)
                    }
                    disabled={
                      index >
                      currentStepIndex
                    }
                  >
                    <span>
                      {index + 1}
                    </span>

                    <strong>
                      {step.label}
                    </strong>
                  </button>
                );
              },
            )}
          </nav>

          <div className="experiment-builder-progress-summary">
            <span>Experimento</span>

            <strong>
              {form.name ||
                "Sin nombre"}
            </strong>

            <small>
              {form.templateKey
                ? (
                    "Plantilla: "
                    + form.templateKey
                  )
                : "Configuración manual"}
            </small>
          </div>
        </aside>

        <div className="experiment-builder-content">
          {currentStep ===
            "identity" && (
            <ExperimentIdentityStep
              form={form}
              corpora={corpora}
              datasets={datasets}
              onChange={updateForm}
            />
          )}

          {currentStep ===
            "template" && (
            <TemplateSelectorStep
              form={form}
              builtinTemplates={
                builtinTemplates
              }
              customTemplates={
                customTemplates
              }
              onChange={updateForm}
            />
          )}

          {currentStep ===
            "configuration" && (
            <ConfigurationEditorStep
              form={form}
              onChange={updateForm}
            />
          )}

          {currentStep ===
            "review" && (
            <ExperimentReviewStep
              form={form}
              corpora={corpora}
              datasets={datasets}
              builtinTemplates={
                builtinTemplates
              }
              customTemplates={
                customTemplates
              }
            />
          )}

          <footer className="experiment-builder-actions">
            <div>
              {currentStepIndex > 0 && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={
                    goToPreviousStep
                  }
                  disabled={saving}
                >
                  Anterior
                </button>
              )}
            </div>

            <div>
              {currentStep !==
                "review" ? (
                <button
                  type="button"
                  className="primary-button"
                  onClick={
                    goToNextStep
                  }
                  disabled={
                    !canContinue ||
                    saving
                  }
                >
                  Siguiente
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={saving}
                    onClick={() =>
                      void saveExperiment(
                        false,
                      )
                    }
                  >
                    {saving
                      ? "Guardando…"
                      : "Guardar experimento"}
                  </button>

                  <button
                    type="button"
                    className="primary-button"
                    disabled={
                      saving ||
                      !form.datasetId
                    }
                    onClick={() =>
                      void saveExperiment(
                        true,
                      )
                    }
                  >
                    {saving
                      ? "Procesando…"
                      : "Guardar y ejecutar"}
                  </button>
                </>
              )}
            </div>
          </footer>
        </div>
      </div>
    </section>
  );
}

export default ExperimentBuilderPage;
