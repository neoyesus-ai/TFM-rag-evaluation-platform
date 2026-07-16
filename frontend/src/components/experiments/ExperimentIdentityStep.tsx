import type {
  ExperimentBuilderCorpus,
  ExperimentBuilderDataset,
  ExperimentBuilderForm,
} from "../../types/experiment-builder";

type ExperimentIdentityStepProps = {
  form: ExperimentBuilderForm;
  corpora: ExperimentBuilderCorpus[];
  datasets: ExperimentBuilderDataset[];
  onChange: (
    updater: (
      current: ExperimentBuilderForm,
    ) => ExperimentBuilderForm,
  ) => void;
};

function ExperimentIdentityStep({
  form,
  corpora,
  datasets,
  onChange,
}: ExperimentIdentityStepProps) {
  const selectedDataset =
    datasets.find(
      (dataset) =>
        dataset.id === form.datasetId,
    ) ?? null;

  return (
    <section className="experiment-builder-step">
      <div className="experiment-builder-step-heading">
        <span className="eyebrow">
          Paso 1 de 4
        </span>

        <h2>
          Identidad del experimento
        </h2>

        <p>
          Define el objetivo del experimento
          y selecciona los recursos
          documentales y de evaluación.
        </p>
      </div>

      <div className="experiment-builder-form-grid">
        <label className="experiment-builder-field experiment-builder-field-wide">
          <span>
            Nombre del experimento
          </span>

          <input
            type="text"
            required
            minLength={3}
            maxLength={200}
            placeholder="Ej. Baseline RAG corporativo"
            value={form.name}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
          />

          <small>
            Debe ser único dentro de la
            plataforma.
          </small>
        </label>

        <label className="experiment-builder-field experiment-builder-field-wide">
          <span>Descripción</span>

          <textarea
            rows={4}
            maxLength={4000}
            placeholder="Describe la hipótesis, el propósito o la configuración que se quiere evaluar."
            value={form.description}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                description:
                  event.target.value,
              }))
            }
          />
        </label>

        <label className="experiment-builder-field">
          <span>Corpus documental</span>

          <select
            required
            value={form.corpusId}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                corpusId:
                  event.target.value,
              }))
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

          <small>
            Colección documental sobre la que
            se ejecutará el pipeline.
          </small>
        </label>

        <label className="experiment-builder-field">
          <span>
            Dataset de evaluación
          </span>

          <select
            value={form.datasetId}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                datasetId:
                  event.target.value,
              }))
            }
          >
            <option value="">
              Sin dataset por ahora
            </option>

            {datasets.map((dataset) => (
              <option
                key={dataset.id}
                value={dataset.id}
              >
                {dataset.name}
                {" · "}
                v{dataset.version}
                {" · "}
                {dataset.question_count}
                {" preguntas"}
              </option>
            ))}
          </select>

          <small>
            Es opcional al crear el
            experimento, pero será necesario
            para ejecutar una evaluación
            completa.
          </small>
        </label>

        <label className="experiment-builder-field experiment-builder-field-wide">
          <span>
            Commit Git asociado
          </span>

          <input
            type="text"
            maxLength={64}
            placeholder="Opcional. Ej. 9e8c2e2"
            value={form.gitCommit}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                gitCommit:
                  event.target.value,
              }))
            }
          />

          <small>
            Permite relacionar la ejecución
            con una versión concreta del
            código.
          </small>
        </label>
      </div>

      <div className="experiment-builder-context">
        <article>
          <span>Corpora disponibles</span>

          <strong>
            {corpora.length}
          </strong>
        </article>

        <article>
          <span>Datasets disponibles</span>

          <strong>
            {datasets.length}
          </strong>
        </article>

        <article>
          <span>
            Preguntas seleccionadas
          </span>

          <strong>
            {selectedDataset?.question_count ??
              0}
          </strong>
        </article>

        <article>
          <span>
            Estado del dataset
          </span>

          <strong>
            {selectedDataset?.status ??
              "No seleccionado"}
          </strong>
        </article>
      </div>

      {corpora.length === 0 && (
        <div className="experiment-builder-warning">
          No hay corpora disponibles. Debes
          crear al menos uno antes de poder
          registrar un experimento.
        </div>
      )}
    </section>
  );
}

export default ExperimentIdentityStep;
