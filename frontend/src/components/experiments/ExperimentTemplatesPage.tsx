import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  getBuiltinTemplates,
  getCustomTemplates,
  saveCustomTemplate,
} from "../../services/experiment-builder";
import type {
  ExperimentBuilderForm,
  ExperimentTemplate,
  PipelineConfiguration,
  SavedExperimentTemplate,
} from "../../types/experiment-builder";
import {
  DEFAULT_PIPELINE_CONFIGURATION,
  EMPTY_EXPERIMENT_BUILDER_FORM,
} from "../../types/experiment-builder";
import ConfigurationEditorStep from "./ConfigurationEditorStep";

type TemplateForm = {
  templateKey: string;
  name: string;
  description: string;
  category: string;
  tagsText: string;
  configuration: PipelineConfiguration;
};

const EMPTY_TEMPLATE_FORM: TemplateForm = {
  templateKey: "",
  name: "",
  description: "",
  category: "custom",
  tagsText: "",
  configuration: structuredClone(
    DEFAULT_PIPELINE_CONFIGURATION,
  ),
};

function cloneTemplateForm(): TemplateForm {
  return structuredClone(
    EMPTY_TEMPLATE_FORM,
  );
}

function toConfigurationForm(
  templateForm: TemplateForm,
): ExperimentBuilderForm {
  return {
    ...structuredClone(
      EMPTY_EXPERIMENT_BUILDER_FORM,
    ),
    configuration:
      templateForm.configuration,
  };
}

function ExperimentTemplatesPage() {
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
    templateForm,
    setTemplateForm,
  ] = useState<TemplateForm>(
    cloneTemplateForm,
  );

  const [
    showCreator,
    setShowCreator,
  ] = useState(false);

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

  const loadTemplates =
    useCallback(async () => {
      setLoading(true);
      setError(null);

      try {
        const [
          builtin,
          custom,
        ] = await Promise.all([
          getBuiltinTemplates(),
          getCustomTemplates(),
        ]);

        setBuiltinTemplates(builtin);
        setCustomTemplates(custom);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : (
                "No se pudieron cargar "
                + "las plantillas."
              ),
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  function updateConfiguration(
    updater: (
      current: ExperimentBuilderForm,
    ) => ExperimentBuilderForm,
  ) {
    setTemplateForm((current) => {
      const temporaryForm =
        toConfigurationForm(current);

      const updatedForm =
        updater(temporaryForm);

      return {
        ...current,
        configuration:
          updatedForm.configuration,
      };
    });
  }

  function copyTemplate(
    template:
      | ExperimentTemplate
      | SavedExperimentTemplate,
  ) {
    setTemplateForm({
      templateKey: `${template.template_key}-copy`,
      name: `${template.name} personalizada`,
      description:
        template.description ?? "",
      category:
        template.category || "custom",
      tagsText:
        template.tags.join(", "),
      configuration:
        structuredClone(
          template.configuration,
        ),
    });

    setShowCreator(true);
    setError(null);
    setNotice(
      "Configuración copiada. Cambia la clave antes de guardar.",
    );
  }

  function validateTemplate():
    | string
    | null {
    if (
      templateForm.templateKey
        .trim()
        .length < 3
    ) {
      return (
        "La clave debe tener "
        + "al menos 3 caracteres."
      );
    }

    if (
      templateForm.name
        .trim()
        .length < 3
    ) {
      return (
        "El nombre debe tener "
        + "al menos 3 caracteres."
      );
    }

    if (
      templateForm.configuration
        .chunking.chunk_overlap >=
      templateForm.configuration
        .chunking.chunk_size
    ) {
      return (
        "El overlap debe ser menor "
        + "que el tamaño del chunk."
      );
    }

    if (
      templateForm.configuration
        .evaluation.metrics.length === 0
    ) {
      return (
        "Selecciona al menos "
        + "una métrica."
      );
    }

    return null;
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const validationError =
      validateTemplate();

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      await saveCustomTemplate({
        templateKey:
          templateForm.templateKey,
        name: templateForm.name,
        description:
          templateForm.description,
        category:
          templateForm.category,
        tags:
          templateForm.tagsText
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        configuration:
          templateForm.configuration,
        matrix: null,
      });

      setNotice(
        "Plantilla personalizada creada correctamente.",
      );

      setTemplateForm(
        cloneTemplateForm(),
      );

      setShowCreator(false);

      await loadTemplates();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : (
              "No se pudo guardar "
              + "la plantilla."
            ),
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="experiment-builder-loading">
        Cargando plantillas…
      </section>
    );
  }

  return (
    <section className="experiment-templates-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">
            Catálogo experimental
          </span>

          <h1>
            Plantillas de experimento
          </h1>

          <p>
            Gestiona configuraciones
            reutilizables para acelerar la
            creación y comparación de
            experimentos RAG.
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={() => {
            setShowCreator(
              (current) => !current,
            );

            setError(null);
            setNotice(null);
          }}
        >
          {showCreator
            ? "Cerrar editor"
            : "Nueva plantilla"}
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

      <section className="experiment-management-summary">
        <article>
          <span>Integradas</span>

          <strong>
            {builtinTemplates.length}
          </strong>

          <small>
            disponibles en el repositorio
          </small>
        </article>

        <article>
          <span>Personalizadas</span>

          <strong>
            {customTemplates.length}
          </strong>

          <small>
            almacenadas en PostgreSQL
          </small>
        </article>

        <article>
          <span>Total</span>

          <strong>
            {builtinTemplates.length +
              customTemplates.length}
          </strong>

          <small>
            configuraciones reutilizables
          </small>
        </article>

        <article>
          <span>Esquema</span>

          <strong>1.0</strong>

          <small>
            versión de configuración
          </small>
        </article>
      </section>

      {showCreator && (
        <form
          className="panel experiment-template-editor"
          onSubmit={handleSubmit}
        >
          <div className="panel-heading">
            <div>
              <span className="eyebrow">
                Editor de plantillas
              </span>

              <h2>
                Nueva plantilla
              </h2>

              <p>
                Define sus metadatos y los
                parámetros del pipeline RAG.
              </p>
            </div>
          </div>

          <div className="experiment-builder-form-grid">
            <label className="experiment-builder-field">
              <span>
                Clave de plantilla
              </span>

              <input
                required
                minLength={3}
                maxLength={150}
                placeholder="baseline-corporativo"
                value={
                  templateForm.templateKey
                }
                onChange={(event) =>
                  setTemplateForm(
                    (current) => ({
                      ...current,
                      templateKey:
                        event.target.value,
                    }),
                  )
                }
              />

              <small>
                Identificador único sin
                espacios recomendado.
              </small>
            </label>

            <label className="experiment-builder-field">
              <span>Nombre</span>

              <input
                required
                minLength={3}
                maxLength={200}
                placeholder="Baseline corporativo"
                value={templateForm.name}
                onChange={(event) =>
                  setTemplateForm(
                    (current) => ({
                      ...current,
                      name:
                        event.target.value,
                    }),
                  )
                }
              />
            </label>

            <label className="experiment-builder-field">
              <span>Categoría</span>

              <input
                maxLength={100}
                value={
                  templateForm.category
                }
                onChange={(event) =>
                  setTemplateForm(
                    (current) => ({
                      ...current,
                      category:
                        event.target.value,
                    }),
                  )
                }
              />
            </label>

            <label className="experiment-builder-field">
              <span>
                Etiquetas
              </span>

              <input
                placeholder="baseline, calidad, corporativo"
                value={
                  templateForm.tagsText
                }
                onChange={(event) =>
                  setTemplateForm(
                    (current) => ({
                      ...current,
                      tagsText:
                        event.target.value,
                    }),
                  )
                }
              />

              <small>
                Separadas por comas.
              </small>
            </label>

            <label className="experiment-builder-field experiment-builder-field-wide">
              <span>Descripción</span>

              <textarea
                rows={3}
                value={
                  templateForm.description
                }
                onChange={(event) =>
                  setTemplateForm(
                    (current) => ({
                      ...current,
                      description:
                        event.target.value,
                    }),
                  )
                }
              />
            </label>
          </div>

          <ConfigurationEditorStep
            form={toConfigurationForm(
              templateForm,
            )}
            onChange={
              updateConfiguration
            }
          />

          <footer className="experiment-builder-actions">
            <div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setTemplateForm(
                    cloneTemplateForm(),
                  );
                  setShowCreator(false);
                }}
              >
                Cancelar
              </button>
            </div>

            <div>
              <button
                type="submit"
                className="primary-button"
                disabled={saving}
              >
                {saving
                  ? "Guardando…"
                  : "Guardar plantilla"}
              </button>
            </div>
          </footer>
        </form>
      )}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>
              Plantillas integradas
            </h2>

            <p>
              Configuraciones mantenidas
              dentro del repositorio.
            </p>
          </div>
        </div>

        <div className="experiment-template-grid">
          {builtinTemplates.map(
            (template) => (
              <article
                className="experiment-template-card"
                key={template.template_key}
              >
                <div className="experiment-template-card-header">
                  <span className="experiment-template-origin">
                    Integrada
                  </span>

                  <span className="experiment-template-category">
                    {template.category}
                  </span>
                </div>

                <h3>{template.name}</h3>

                <p>
                  {template.description ??
                    "Sin descripción"}
                </p>

                <div className="experiment-template-config">
                  <span>
                    {
                      template.configuration
                        .generation.model
                    }
                  </span>

                  <span>
                    {
                      template.configuration
                        .embedding.model
                    }
                  </span>

                  <span>
                    Chunk{" "}
                    {
                      template.configuration
                        .chunking.chunk_size
                    }
                  </span>

                  <span>
                    Top-K{" "}
                    {
                      template.configuration
                        .retrieval.top_k
                    }
                  </span>
                </div>

                <button
                  type="button"
                  className="secondary-button experiment-template-copy-button"
                  onClick={() =>
                    copyTemplate(template)
                  }
                >
                  Crear copia editable
                </button>
              </article>
            ),
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>
              Plantillas personalizadas
            </h2>

            <p>
              Configuraciones creadas desde
              la propia plataforma.
            </p>
          </div>
        </div>

        <div className="experiment-template-grid">
          {customTemplates.map(
            (template) => (
              <article
                className="experiment-template-card"
                key={template.id}
              >
                <div className="experiment-template-card-header">
                  <span className="experiment-template-origin">
                    Personalizada
                  </span>

                  <span className="experiment-template-category">
                    {template.category}
                  </span>
                </div>

                <h3>{template.name}</h3>

                <p>
                  {template.description ??
                    "Sin descripción"}
                </p>

                <div className="experiment-template-config">
                  <span>
                    {
                      template.configuration
                        .generation.model
                    }
                  </span>

                  <span>
                    {
                      template.configuration
                        .embedding.model
                    }
                  </span>

                  <span>
                    Chunk{" "}
                    {
                      template.configuration
                        .chunking.chunk_size
                    }
                  </span>

                  <span>
                    Top-K{" "}
                    {
                      template.configuration
                        .retrieval.top_k
                    }
                  </span>
                </div>

                <button
                  type="button"
                  className="secondary-button experiment-template-copy-button"
                  onClick={() =>
                    copyTemplate(template)
                  }
                >
                  Duplicar plantilla
                </button>
              </article>
            ),
          )}

          {customTemplates.length ===
            0 && (
            <div className="experiment-empty-state">
              <strong>
                No hay plantillas
                personalizadas
              </strong>

              <p>
                Crea una desde cero o copia
                una plantilla integrada.
              </p>
            </div>
          )}
        </div>
      </section>
    </section>
  );
}

export default ExperimentTemplatesPage;
