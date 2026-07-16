import type {
  EvaluationMetric,
  ExperimentBuilderForm,
} from "../../types/experiment-builder";

type ConfigurationEditorStepProps = {
  form: ExperimentBuilderForm;
  onChange: (
    updater: (
      current: ExperimentBuilderForm,
    ) => ExperimentBuilderForm,
  ) => void;
};

const AVAILABLE_METRICS: Array<{
  key: EvaluationMetric;
  label: string;
  description: string;
}> = [
  {
    key: "faithfulness",
    label: "Faithfulness",
    description:
      "Evalúa si la respuesta está respaldada por el contexto recuperado.",
  },
  {
    key: "answer_relevancy",
    label: "Answer Relevancy",
    description:
      "Mide la relevancia de la respuesta respecto a la pregunta.",
  },
  {
    key: "context_precision",
    label: "Context Precision",
    description:
      "Evalúa qué proporción del contexto recuperado es realmente útil.",
  },
  {
    key: "context_recall",
    label: "Context Recall",
    description:
      "Mide la cobertura del contexto esperado.",
  },
  {
    key: "latency_ms",
    label: "Latency",
    description:
      "Registra el tiempo de respuesta del pipeline.",
  },
];

function ConfigurationEditorStep({
  form,
  onChange,
}: ConfigurationEditorStepProps) {
  const configuration = form.configuration;

  function toggleMetric(
    metric: EvaluationMetric,
  ) {
    onChange((current) => {
      const metrics =
        current.configuration.evaluation
          .metrics;

      const nextMetrics =
        metrics.includes(metric)
          ? metrics.filter(
              (item) => item !== metric,
            )
          : [...metrics, metric];

      return {
        ...current,
        configuration: {
          ...current.configuration,
          evaluation: {
            ...current.configuration
              .evaluation,
            metrics: nextMetrics,
          },
        },
      };
    });
  }

  return (
    <section className="experiment-builder-step">
      <div className="experiment-builder-step-heading">
        <span className="eyebrow">
          Paso 3 de 4
        </span>

        <h2>
          Configuración del pipeline
        </h2>

        <p>
          Ajusta los parámetros del sistema
          RAG que se almacenarán como una
          versión reproducible del
          experimento.
        </p>
      </div>

      <div className="experiment-configuration-sections">
        <article className="experiment-configuration-panel">
          <div className="experiment-configuration-panel-heading">
            <div>
              <span>01</span>

              <h3>Chunking</h3>
            </div>

            <p>
              Define cómo se dividen los
              documentos antes de generar
              embeddings.
            </p>
          </div>

          <div className="experiment-builder-form-grid">
            <label className="experiment-builder-field">
              <span>Estrategia</span>

              <select
                value={
                  configuration.chunking
                    .strategy
                }
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    configuration: {
                      ...current.configuration,
                      chunking: {
                        ...current
                          .configuration
                          .chunking,
                        strategy:
                          event.target
                            .value as
                            | "recursive"
                            | "fixed"
                            | "semantic",
                      },
                    },
                  }))
                }
              >
                <option value="recursive">
                  Recursive
                </option>

                <option value="fixed">
                  Fixed size
                </option>

                <option value="semantic">
                  Semantic
                </option>
              </select>
            </label>

            <label className="experiment-builder-field">
              <span>Chunk size</span>

              <input
                type="number"
                min={64}
                max={4096}
                step={64}
                value={
                  configuration.chunking
                    .chunk_size
                }
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    configuration: {
                      ...current.configuration,
                      chunking: {
                        ...current
                          .configuration
                          .chunking,
                        chunk_size:
                          Number(
                            event.target
                              .value,
                          ),
                      },
                    },
                  }))
                }
              />

              <small>
                Entre 64 y 4096 caracteres o
                tokens, según la estrategia.
              </small>
            </label>

            <label className="experiment-builder-field">
              <span>Chunk overlap</span>

              <input
                type="number"
                min={0}
                max={1024}
                step={16}
                value={
                  configuration.chunking
                    .chunk_overlap
                }
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    configuration: {
                      ...current.configuration,
                      chunking: {
                        ...current
                          .configuration
                          .chunking,
                        chunk_overlap:
                          Number(
                            event.target
                              .value,
                          ),
                      },
                    },
                  }))
                }
              />

              <small>
                Debe ser menor que el tamaño
                del chunk.
              </small>
            </label>
          </div>
        </article>

        <article className="experiment-configuration-panel">
          <div className="experiment-configuration-panel-heading">
            <div>
              <span>02</span>

              <h3>Embeddings</h3>
            </div>

            <p>
              Configura el modelo encargado
              de representar semánticamente
              los fragmentos documentales.
            </p>
          </div>

          <div className="experiment-builder-form-grid">
            <label className="experiment-builder-field">
              <span>Proveedor</span>

              <input
                type="text"
                value={
                  configuration.embedding
                    .provider
                }
                disabled
              />
            </label>

            <label className="experiment-builder-field experiment-builder-field-wide">
              <span>Modelo de embeddings</span>

              <input
                type="text"
                required
                value={
                  configuration.embedding
                    .model
                }
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    configuration: {
                      ...current.configuration,
                      embedding: {
                        ...current
                          .configuration
                          .embedding,
                        model:
                          event.target.value,
                      },
                    },
                  }))
                }
              />

              <small>
                El modelo debe estar
                disponible en Ollama.
              </small>
            </label>
          </div>
        </article>

        <article className="experiment-configuration-panel">
          <div className="experiment-configuration-panel-heading">
            <div>
              <span>03</span>

              <h3>Retrieval</h3>
            </div>

            <p>
              Define la estrategia de
              recuperación y el número de
              fragmentos enviados al modelo.
            </p>
          </div>

          <div className="experiment-builder-form-grid">
            <label className="experiment-builder-field">
              <span>Estrategia</span>

              <select
                value={
                  configuration.retrieval
                    .strategy
                }
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    configuration: {
                      ...current.configuration,
                      retrieval: {
                        ...current
                          .configuration
                          .retrieval,
                        strategy:
                          event.target
                            .value as
                            | "similarity"
                            | "mmr",
                      },
                    },
                  }))
                }
              >
                <option value="similarity">
                  Similarity
                </option>

                <option value="mmr">
                  MMR
                </option>
              </select>
            </label>

            <label className="experiment-builder-field">
              <span>Top-K</span>

              <input
                type="number"
                min={1}
                max={50}
                value={
                  configuration.retrieval
                    .top_k
                }
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    configuration: {
                      ...current.configuration,
                      retrieval: {
                        ...current
                          .configuration
                          .retrieval,
                        top_k:
                          Number(
                            event.target
                              .value,
                          ),
                      },
                    },
                  }))
                }
              />

              <small>
                Número de fragmentos
                recuperados por pregunta.
              </small>
            </label>
          </div>
        </article>

        <article className="experiment-configuration-panel">
          <div className="experiment-configuration-panel-heading">
            <div>
              <span>04</span>

              <h3>Generación</h3>
            </div>

            <p>
              Configura el modelo de lenguaje
              que generará las respuestas.
            </p>
          </div>

          <div className="experiment-builder-form-grid">
            <label className="experiment-builder-field">
              <span>Proveedor</span>

              <input
                type="text"
                value={
                  configuration.generation
                    .provider
                }
                disabled
              />
            </label>

            <label className="experiment-builder-field">
              <span>Modelo generativo</span>

              <input
                type="text"
                required
                value={
                  configuration.generation
                    .model
                }
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    configuration: {
                      ...current.configuration,
                      generation: {
                        ...current
                          .configuration
                          .generation,
                        model:
                          event.target.value,
                      },
                    },
                  }))
                }
              />
            </label>

            <label className="experiment-builder-field">
              <span>Temperatura</span>

              <input
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={
                  configuration.generation
                    .temperature
                }
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    configuration: {
                      ...current.configuration,
                      generation: {
                        ...current
                          .configuration
                          .generation,
                        temperature:
                          Number(
                            event.target
                              .value,
                          ),
                      },
                    },
                  }))
                }
              />

              <small>
                Valores bajos favorecen
                respuestas más
                deterministas.
              </small>
            </label>
          </div>
        </article>

        <article className="experiment-configuration-panel">
          <div className="experiment-configuration-panel-heading">
            <div>
              <span>05</span>

              <h3>Evaluación</h3>
            </div>

            <p>
              Selecciona las métricas que se
              calcularán durante la
              ejecución.
            </p>
          </div>

          <div className="experiment-evaluation-grid">
            {AVAILABLE_METRICS.map(
              (metric) => {
                const checked =
                  configuration.evaluation
                    .metrics.includes(
                      metric.key,
                    );

                return (
                  <label
                    className={[
                      "experiment-evaluation-card",
                      checked
                        ? "experiment-evaluation-card-selected"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    key={metric.key}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        toggleMetric(
                          metric.key,
                        )
                      }
                    />

                    <div>
                      <strong>
                        {metric.label}
                      </strong>

                      <p>
                        {
                          metric.description
                        }
                      </p>
                    </div>
                  </label>
                );
              },
            )}
          </div>
        </article>
      </div>

      {configuration.chunking
        .chunk_overlap >=
        configuration.chunking
          .chunk_size && (
        <div className="experiment-builder-warning">
          El overlap debe ser menor que el
          tamaño del chunk.
        </div>
      )}

      {configuration.evaluation.metrics
        .length === 0 && (
        <div className="experiment-builder-warning">
          Debes seleccionar al menos una
          métrica de evaluación.
        </div>
      )}
    </section>
  );
}

export default ConfigurationEditorStep;
