import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  listRagConsoleRuns,
  queryRagConsole,
} from "../../services/rag-console";

import type {
  RagConsoleQueryResponse,
  RagConsoleRetrievedContext,
  RagConsoleRun,
} from "../../types/rag-console";

import "./rag-console.css";

function getContextText(
  context: RagConsoleRetrievedContext,
): string {
  return (
    context.content ??
    context.text ??
    context.document ??
    "El contexto recuperado no contiene texto."
  );
}

function formatValue(
  value: unknown,
): string {
  if (value === null) {
    return "null";
  }

  if (value === undefined) {
    return "—";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

export function RagConsolePage() {
  const [runs, setRuns] = useState<
    RagConsoleRun[]
  >([]);

  const [selectedRunId, setSelectedRunId] =
    useState("");

  const [question, setQuestion] =
    useState("");

  const [topK, setTopK] =
    useState(5);

  const [response, setResponse] =
    useState<
      RagConsoleQueryResponse | null
    >(null);

  const [loadingRuns, setLoadingRuns] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadRuns() {
      try {
        setLoadingRuns(true);
        setError(null);

        const availableRuns =
          await listRagConsoleRuns();

        if (!active) {
          return;
        }

        setRuns(availableRuns);

        if (availableRuns.length > 0) {
          setSelectedRunId(
            availableRuns[0].run_id,
          );
        }
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudieron cargar las ejecuciones.",
        );
      } finally {
        if (active) {
          setLoadingRuns(false);
        }
      }
    }

    void loadRuns();

    return () => {
      active = false;
    };
  }, []);

  const selectedRun = useMemo(
    () =>
      runs.find(
        (run) =>
          run.run_id === selectedRunId,
      ) ?? null,
    [runs, selectedRunId],
  );

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const normalizedQuestion =
      question.trim();

    if (!selectedRunId) {
      setError(
        "Selecciona una ejecución.",
      );
      return;
    }

    if (!normalizedQuestion) {
      setError(
        "Introduce una pregunta.",
      );
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setResponse(null);

      const queryResponse =
        await queryRagConsole({
          run_id: selectedRunId,
          question: normalizedQuestion,
          top_k: topK,
        });

      setResponse(queryResponse);
    } catch (queryError) {
      setError(
        queryError instanceof Error
          ? queryError.message
          : "No se pudo ejecutar la consulta.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rag-console-page">
      <header className="rag-console-header">
        <div>
          <p className="rag-console-eyebrow">
            Experimentación interactiva
          </p>

          <h1>Consola RAG</h1>

          <p>
            Consulta una ejecución completada y
            revisa la respuesta junto con los
            fragmentos recuperados.
          </p>
        </div>
      </header>

      <div className="rag-console-layout">
        <aside className="rag-console-panel">
          <h2>Configuración</h2>

          <form
            className="rag-console-form"
            onSubmit={handleSubmit}
          >
            <label>
              Ejecución
              <select
                value={selectedRunId}
                onChange={(event) => {
                  setSelectedRunId(
                    event.target.value,
                  );
                  setResponse(null);
                }}
                disabled={
                  loadingRuns ||
                  submitting
                }
              >
                {loadingRuns && (
                  <option value="">
                    Cargando ejecuciones...
                  </option>
                )}

                {!loadingRuns &&
                  runs.length === 0 && (
                    <option value="">
                      No hay ejecuciones disponibles
                    </option>
                  )}

                {runs.map((run) => (
                  <option
                    key={run.run_id}
                    value={run.run_id}
                  >
                    {run.experiment_name} · v
                    {run.version_number} ·{" "}
                    {run.corpus_name}
                  </option>
                ))}
              </select>
            </label>

            {selectedRun && (
              <div className="rag-console-run-info">
                <dl>
                  <div>
                    <dt>Experimento</dt>
                    <dd>
                      {
                        selectedRun.experiment_name
                      }
                    </dd>
                  </div>

                  <div>
                    <dt>Corpus</dt>
                    <dd>
                      {selectedRun.corpus_name}
                    </dd>
                  </div>

                  <div>
                    <dt>Embedding</dt>
                    <dd>
                      {
                        selectedRun.embedding_provider
                      }
                      {" / "}
                      {
                        selectedRun.embedding_model
                      }
                    </dd>
                  </div>

                  <div>
                    <dt>Generación</dt>
                    <dd>
                      {
                        selectedRun.generation_provider
                      }
                      {" / "}
                      {
                        selectedRun.generation_model
                      }
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            <label>
              Número de contextos
              <input
                type="number"
                min={1}
                max={20}
                value={topK}
                onChange={(event) =>
                  setTopK(
                    Number(
                      event.target.value,
                    ),
                  )
                }
                disabled={submitting}
              />
            </label>

            <label>
              Pregunta
              <textarea
                rows={6}
                value={question}
                onChange={(event) =>
                  setQuestion(
                    event.target.value,
                  )
                }
                placeholder="Escribe una pregunta sobre el corpus..."
                disabled={submitting}
              />
            </label>

            <button
              type="submit"
              disabled={
                submitting ||
                loadingRuns ||
                !selectedRunId
              }
            >
              {submitting
                ? "Consultando..."
                : "Ejecutar consulta"}
            </button>
          </form>

          {error && (
            <div
              className="rag-console-error"
              role="alert"
            >
              {error}
            </div>
          )}
        </aside>

        <main className="rag-console-results">
          {!response && !submitting && (
            <div className="rag-console-empty">
              <h2>Resultado de la consulta</h2>
              <p>
                Selecciona una ejecución,
                introduce una pregunta y pulsa
                «Ejecutar consulta».
              </p>
            </div>
          )}

          {submitting && (
            <div className="rag-console-empty">
              <h2>Procesando consulta</h2>
              <p>
                Recuperando contextos y generando
                la respuesta.
              </p>
            </div>
          )}

          {response && (
            <>
              <article className="rag-console-answer">
                <h2>Respuesta</h2>
                <p>{response.answer}</p>
              </article>

              {response.timings && (
                <section className="rag-console-metrics">
                  <h2>Tiempos</h2>

                  <div className="rag-console-metric-grid">
                    {Object.entries(
                      response.timings,
                    ).map(([key, value]) => (
                      <div key={key}>
                        <span>{key}</span>
                        <strong>
                          {formatValue(value)}
                        </strong>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="rag-console-contexts">
                <h2>
                  Contextos recuperados
                </h2>

                {response.contexts.length ===
                  0 && (
                  <p>
                    No se recuperaron contextos.
                  </p>
                )}

                {response.contexts.map(
                  (context, index) => (
                    <article
                      className="rag-console-context"
                      key={`${index}-${context.rank ?? "context"}`}
                    >
                      <header>
                        <strong>
                          Contexto{" "}
                          {context.rank ??
                            index + 1}
                        </strong>

                        {context.score !==
                          undefined && (
                          <span>
                            Score:{" "}
                            {context.score}
                          </span>
                        )}

                        {context.distance !==
                          undefined && (
                          <span>
                            Distancia:{" "}
                            {context.distance}
                          </span>
                        )}
                      </header>

                      <p>
                        {getContextText(
                          context,
                        )}
                      </p>

                      {context.metadata &&
                        Object.keys(
                          context.metadata,
                        ).length > 0 && (
                          <dl>
                            {Object.entries(
                              context.metadata,
                            ).map(
                              ([key, value]) => (
                                <div key={key}>
                                  <dt>
                                    {key}
                                  </dt>
                                  <dd>
                                    {formatValue(
                                      value,
                                    )}
                                  </dd>
                                </div>
                              ),
                            )}
                          </dl>
                        )}
                    </article>
                  ),
                )}
              </section>

              {response.metadata && (
                <details className="rag-console-metadata">
                  <summary>
                    Metadatos técnicos
                  </summary>

                  <pre>
                    {JSON.stringify(
                      response.metadata,
                      null,
                      2,
                    )}
                  </pre>
                </details>
              )}
            </>
          )}
        </main>
      </div>
    </section>
  );
}

export default RagConsolePage;
