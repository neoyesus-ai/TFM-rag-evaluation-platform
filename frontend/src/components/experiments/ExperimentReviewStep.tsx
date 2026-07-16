import type {
  ExperimentBuilderCorpus,
  ExperimentBuilderDataset,
  ExperimentBuilderForm,
  ExperimentTemplate,
  SavedExperimentTemplate,
} from "../../types/experiment-builder";

type ExperimentReviewStepProps = {
  form: ExperimentBuilderForm;
  corpora: ExperimentBuilderCorpus[];
  datasets: ExperimentBuilderDataset[];
  builtinTemplates: ExperimentTemplate[];
  customTemplates: SavedExperimentTemplate[];
};

function formatTemperature(
  value: number,
): string {
  return value.toFixed(1);
}

function ExperimentReviewStep({
  form,
  corpora,
  datasets,
  builtinTemplates,
  customTemplates,
}: ExperimentReviewStepProps) {
  const corpus =
    corpora.find(
      (item) =>
        item.id === form.corpusId,
    ) ?? null;

  const dataset =
    datasets.find(
      (item) =>
        item.id === form.datasetId,
    ) ?? null;

  const template =
    builtinTemplates.find(
      (item) =>
        item.template_key ===
        form.templateKey,
    ) ??
    customTemplates.find(
      (item) =>
        item.template_key ===
        form.templateKey,
    ) ??
    null;

  const configuration =
    form.configuration;

  return (
    <section className="experiment-builder-step">
      <div className="experiment-builder-step-heading">
        <span className="eyebrow">
          Paso 4 de 4
        </span>

        <h2>
          Revisión del experimento
        </h2>

        <p>
          Comprueba los datos antes de
          guardar la primera versión o
          ejecutar el pipeline.
        </p>
      </div>

      <div className="experiment-review-grid">
        <article className="experiment-review-card">
          <div className="experiment-review-card-heading">
            <span>01</span>

            <div>
              <h3>Identidad</h3>

              <p>
                Información general y
                trazabilidad.
              </p>
            </div>
          </div>

          <dl className="experiment-review-list">
            <div>
              <dt>Nombre</dt>

              <dd>
                {form.name || "—"}
              </dd>
            </div>

            <div>
              <dt>Descripción</dt>

              <dd>
                {form.description ||
                  "Sin descripción"}
              </dd>
            </div>

            <div>
              <dt>Commit Git</dt>

              <dd>
                {form.gitCommit || "—"}
              </dd>
            </div>
          </dl>
        </article>

        <article className="experiment-review-card">
          <div className="experiment-review-card-heading">
            <span>02</span>

            <div>
              <h3>Recursos</h3>

              <p>
                Corpus y dataset asociados.
              </p>
            </div>
          </div>

          <dl className="experiment-review-list">
            <div>
              <dt>Corpus</dt>

              <dd>
                {corpus?.name ??
                  "No seleccionado"}
              </dd>
            </div>

            <div>
              <dt>Dataset</dt>

              <dd>
                {dataset
                  ? `${dataset.name} · v${dataset.version}`
                  : "No seleccionado"}
              </dd>
            </div>

            <div>
              <dt>Preguntas</dt>

              <dd>
                {dataset?.question_count ??
                  0}
              </dd>
            </div>

            <div>
              <dt>Estado dataset</dt>

              <dd>
                {dataset?.status ??
                  "No aplica"}
              </dd>
            </div>
          </dl>
        </article>

        <article className="experiment-review-card">
          <div className="experiment-review-card-heading">
            <span>03</span>

            <div>
              <h3>Plantilla</h3>

              <p>
                Configuración de partida.
              </p>
            </div>
          </div>

          <dl className="experiment-review-list">
            <div>
              <dt>Plantilla</dt>

              <dd>
                {template?.name ??
                  "Configuración manual"}
              </dd>
            </div>

            <div>
              <dt>Clave</dt>

              <dd>
                {form.templateKey ||
                  "—"}
              </dd>
            </div>

            <div>
              <dt>Categoría</dt>

              <dd>
                {template?.category ??
                  "manual"}
              </dd>
            </div>
          </dl>
        </article>

        <article className="experiment-review-card">
          <div className="experiment-review-card-heading">
            <span>04</span>

            <div>
              <h3>Chunking</h3>

              <p>
                Segmentación documental.
              </p>
            </div>
          </div>

          <dl className="experiment-review-list">
            <div>
              <dt>Estrategia</dt>

              <dd>
                {
                  configuration.chunking
                    .strategy
                }
              </dd>
            </div>

            <div>
              <dt>Chunk size</dt>

              <dd>
                {
                  configuration.chunking
                    .chunk_size
                }
              </dd>
            </div>

            <div>
              <dt>Overlap</dt>

              <dd>
                {
                  configuration.chunking
                    .chunk_overlap
                }
              </dd>
            </div>
          </dl>
        </article>

        <article className="experiment-review-card">
          <div className="experiment-review-card-heading">
            <span>05</span>

            <div>
              <h3>Modelos</h3>

              <p>
                Embeddings y generación.
              </p>
            </div>
          </div>

          <dl className="experiment-review-list">
            <div>
              <dt>Embedding</dt>

              <dd>
                {
                  configuration.embedding
                    .model
                }
              </dd>
            </div>

            <div>
              <dt>LLM</dt>

              <dd>
                {
                  configuration.generation
                    .model
                }
              </dd>
            </div>

            <div>
              <dt>Temperatura</dt>

              <dd>
                {formatTemperature(
                  configuration.generation
                    .temperature,
                )}
              </dd>
            </div>
          </dl>
        </article>

        <article className="experiment-review-card">
          <div className="experiment-review-card-heading">
            <span>06</span>

            <div>
              <h3>Retrieval</h3>

              <p>
                Recuperación de contexto.
              </p>
            </div>
          </div>

          <dl className="experiment-review-list">
            <div>
              <dt>Estrategia</dt>

              <dd>
                {
                  configuration.retrieval
                    .strategy
                }
              </dd>
            </div>

            <div>
              <dt>Top-K</dt>

              <dd>
                {
                  configuration.retrieval
                    .top_k
                }
              </dd>
            </div>
          </dl>
        </article>
      </div>

      <article className="experiment-review-metrics">
        <div>
          <span className="eyebrow">
            Evaluación
          </span>

          <h3>
            Métricas seleccionadas
          </h3>

          <p>
            Estas métricas se registrarán
            durante la ejecución.
          </p>
        </div>

        <div className="experiment-review-metric-list">
          {configuration.evaluation.metrics.map(
            (metric) => (
              <span key={metric}>
                {metric}
              </span>
            ),
          )}

          {configuration.evaluation.metrics
            .length === 0 && (
            <span>
              Sin métricas seleccionadas
            </span>
          )}
        </div>
      </article>

      <div className="experiment-review-notice">
        <strong>
          Se creará la versión 1
        </strong>

        <p>
          La configuración se almacenará con
          un hash reproducible. Si eliges
          guardar y ejecutar, la primera
          versión se lanzará inmediatamente
          después de crear el experimento.
        </p>
      </div>
    </section>
  );
}

export default ExperimentReviewStep;
