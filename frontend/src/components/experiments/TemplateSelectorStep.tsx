import type {
  ExperimentBuilderForm,
  ExperimentTemplate,
  PipelineConfiguration,
  SavedExperimentTemplate,
} from "../../types/experiment-builder";

type TemplateSelectorStepProps = {
  form: ExperimentBuilderForm;
  builtinTemplates: ExperimentTemplate[];
  customTemplates: SavedExperimentTemplate[];
  onChange: (
    updater: (
      current: ExperimentBuilderForm,
    ) => ExperimentBuilderForm,
  ) => void;
};

type SelectableTemplate = {
  key: string;
  name: string;
  description: string | null;
  category: string;
  tags: string[];
  configuration: PipelineConfiguration;
  origin: "builtin" | "custom";
};

function cloneConfiguration(
  configuration: PipelineConfiguration,
): PipelineConfiguration {
  return structuredClone(configuration);
}

function TemplateSelectorStep({
  form,
  builtinTemplates,
  customTemplates,
  onChange,
}: TemplateSelectorStepProps) {
  const templates: SelectableTemplate[] = [
    ...builtinTemplates.map(
      (template) => ({
        key: template.template_key,
        name: template.name,
        description: template.description,
        category: template.category,
        tags: template.tags,
        configuration:
          template.configuration,
        origin: "builtin" as const,
      }),
    ),
    ...customTemplates.map(
      (template) => ({
        key: template.template_key,
        name: template.name,
        description: template.description,
        category: template.category,
        tags: template.tags,
        configuration:
          template.configuration,
        origin: "custom" as const,
      }),
    ),
  ];

  function selectTemplate(
    template: SelectableTemplate,
  ) {
    onChange((current) => ({
      ...current,
      templateKey: template.key,
      configuration:
        cloneConfiguration(
          template.configuration,
        ),
    }));
  }

  function clearTemplate() {
    onChange((current) => ({
      ...current,
      templateKey: "",
    }));
  }

  return (
    <section className="experiment-builder-step">
      <div className="experiment-builder-step-heading">
        <span className="eyebrow">
          Paso 2 de 4
        </span>

        <h2>
          Selección de plantilla
        </h2>

        <p>
          Parte de una configuración
          predefinida o continúa con la
          configuración actual.
        </p>
      </div>

      <div className="experiment-template-toolbar">
        <div>
          <strong>
            {templates.length}
          </strong>

          <span>
            plantillas disponibles
          </span>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={clearTemplate}
          disabled={!form.templateKey}
        >
          Quitar selección
        </button>
      </div>

      <div className="experiment-template-grid">
        <button
          type="button"
          className={[
            "experiment-template-card",
            !form.templateKey
              ? "experiment-template-card-selected"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={clearTemplate}
        >
          <div className="experiment-template-card-header">
            <span className="experiment-template-origin">
              Manual
            </span>

            <span className="experiment-template-category">
              Personalizada
            </span>
          </div>

          <h3>
            Configuración manual
          </h3>

          <p>
            Mantén la configuración actual
            y edítala completamente en el
            siguiente paso.
          </p>

          <div className="experiment-template-config">
            <span>
              Chunk{" "}
              {
                form.configuration.chunking
                  .chunk_size
              }
            </span>

            <span>
              Top-K{" "}
              {
                form.configuration.retrieval
                  .top_k
              }
            </span>

            <span>
              {
                form.configuration.generation
                  .model
              }
            </span>
          </div>
        </button>

        {templates.map((template) => {
          const isSelected =
            form.templateKey ===
            template.key;

          return (
            <button
              type="button"
              className={[
                "experiment-template-card",
                isSelected
                  ? "experiment-template-card-selected"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              key={`${template.origin}-${template.key}`}
              onClick={() =>
                selectTemplate(template)
              }
            >
              <div className="experiment-template-card-header">
                <span className="experiment-template-origin">
                  {template.origin ===
                  "builtin"
                    ? "Integrada"
                    : "Personalizada"}
                </span>

                <span className="experiment-template-category">
                  {template.category}
                </span>
              </div>

              <h3>{template.name}</h3>

              <p>
                {template.description ??
                  "Plantilla sin descripción."}
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

              {template.tags.length > 0 && (
                <div className="experiment-template-tags">
                  {template.tags.map(
                    (tag) => (
                      <span key={tag}>
                        {tag}
                      </span>
                    ),
                  )}
                </div>
              )}

              {isSelected && (
                <div className="experiment-template-selected-mark">
                  Plantilla seleccionada
                </div>
              )}
            </button>
          );
        })}
      </div>

      {templates.length === 0 && (
        <div className="experiment-builder-warning">
          No hay plantillas disponibles.
          Puedes continuar con la
          configuración manual.
        </div>
      )}
    </section>
  );
}

export default TemplateSelectorStep;
