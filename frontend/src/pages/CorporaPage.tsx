import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  Corpus,
  createCorpus,
  deleteCorpus,
  listCorpora,
  updateCorpus,
} from "../services/corpora";
import {
  Document as CorpusDocument,
  deleteDocument,
  downloadDocumentUrl,
  listDocuments,
  uploadDocument,
} from "../services/documents";


type CorpusForm = {
  name: string;
  description: string;
};


const EMPTY_CORPUS_FORM: CorpusForm = {
  name: "",
  description: "",
};


function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}


function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(
    sizeBytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}


function documentStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    uploaded: "Subido",
    processing: "Procesando",
    indexed: "Indexado",
    failed: "Fallido",
  };

  return labels[status] ?? status;
}


export default function CorporaPage() {
  const [corpora, setCorpora] = useState<Corpus[]>([]);
  const [selectedCorpus, setSelectedCorpus] =
    useState<Corpus | null>(null);
  const [documents, setDocuments] =
    useState<CorpusDocument[]>([]);

  const [createForm, setCreateForm] =
    useState<CorpusForm>(EMPTY_CORPUS_FORM);
  const [editForm, setEditForm] =
    useState<CorpusForm>(EMPTY_CORPUS_FORM);

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] =
    useState(false);
  const [error, setError] =
    useState<string | null>(null);
  const [notice, setNotice] =
    useState<string | null>(null);

  const loadCorpora = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await listCorpora();
      setCorpora(response);

      setSelectedCorpus((currentCorpus) => {
        if (!currentCorpus) {
          return null;
        }

        return (
          response.find(
            (corpus) =>
              corpus.id === currentCorpus.id,
          ) ?? null
        );
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudieron cargar los corpus.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDocuments = useCallback(
    async (corpusId: string) => {
      setError(null);

      try {
        const response =
          await listDocuments(corpusId);
        setDocuments(response);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "No se pudieron cargar los documentos.",
        );
      }
    },
    [],
  );

  useEffect(() => {
    void loadCorpora();
  }, [loadCorpora]);

  async function openCorpus(corpus: Corpus) {
    setSelectedCorpus(corpus);
    setEditForm({
      name: corpus.name,
      description: corpus.description ?? "",
    });
    setSelectedFile(null);
    setNotice(null);

    await loadDocuments(corpus.id);
  }

  function closeCorpus() {
    setSelectedCorpus(null);
    setDocuments([]);
    setEditForm(EMPTY_CORPUS_FORM);
    setSelectedFile(null);
    setError(null);
    setNotice(null);
  }

  async function handleCreateCorpus(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setActionLoading(true);
    setError(null);
    setNotice(null);

    try {
      const corpus = await createCorpus({
        name: createForm.name.trim(),
        description:
          createForm.description.trim() || null,
      });

      setCreateForm(EMPTY_CORPUS_FORM);
      setNotice("Corpus creado correctamente.");

      await loadCorpora();
      await openCorpus(corpus);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo crear el corpus.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUpdateCorpus(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!selectedCorpus) {
      return;
    }

    setActionLoading(true);
    setError(null);
    setNotice(null);

    try {
      const updatedCorpus = await updateCorpus(
        selectedCorpus.id,
        {
          name: editForm.name.trim(),
          description:
            editForm.description.trim() || null,
        },
      );

      setSelectedCorpus(updatedCorpus);
      setEditForm({
        name: updatedCorpus.name,
        description:
          updatedCorpus.description ?? "",
      });
      setNotice("Corpus actualizado correctamente.");

      await loadCorpora();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo actualizar el corpus.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteCorpus() {
    if (!selectedCorpus) {
      return;
    }

    const confirmed = window.confirm(
      `¿Eliminar el corpus "${selectedCorpus.name}" y todos sus documentos?`,
    );

    if (!confirmed) {
      return;
    }

    setActionLoading(true);
    setError(null);
    setNotice(null);

    try {
      await deleteCorpus(selectedCorpus.id);
      closeCorpus();
      setNotice("Corpus eliminado correctamente.");
      await loadCorpora();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo eliminar el corpus.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0] ?? null;

    setSelectedFile(file);
  }

  async function handleUploadDocument(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!selectedCorpus || !selectedFile) {
      return;
    }

    setActionLoading(true);
    setError(null);
    setNotice(null);

    try {
      await uploadDocument(
        selectedCorpus.id,
        selectedFile,
      );

      setSelectedFile(null);
      setNotice(
        "Documento subido correctamente.",
      );

      await loadDocuments(selectedCorpus.id);

      const fileInput =
        document.getElementById(
          "corpus-document-file",
        ) as HTMLInputElement | null;

      if (fileInput) {
        fileInput.value = "";
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo subir el documento.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteDocument(
    documentItem: CorpusDocument,
  ) {
    if (!selectedCorpus) {
      return;
    }

    const confirmed = window.confirm(
      `¿Eliminar el documento "${documentItem.filename}"?`,
    );

    if (!confirmed) {
      return;
    }

    setActionLoading(true);
    setError(null);
    setNotice(null);

    try {
      await deleteDocument(
        selectedCorpus.id,
        documentItem.id,
      );

      setNotice(
        "Documento eliminado correctamente.",
      );

      await loadDocuments(selectedCorpus.id);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo eliminar el documento.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <section className="panel">
        <p>Cargando corpus...</p>
      </section>
    );
  }

  if (selectedCorpus) {
    return (
      <section className="page-section">
        <header className="section-header">
          <div>
            <span className="eyebrow">
              Corpus Manager
            </span>
            <h1>{selectedCorpus.name}</h1>
            <p>
              Gestiona la información del corpus y
              los documentos utilizados en los
              experimentos RAG.
            </p>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={closeCorpus}
            disabled={actionLoading}
          >
            Volver al listado
          </button>
        </header>

        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        {notice && (
          <div className="alert alert-success">
            {notice}
          </div>
        )}

        <div className="content-grid">
          <article className="panel">
            <h2>Información del corpus</h2>

            <form
              className="form-grid"
              onSubmit={handleUpdateCorpus}
            >
              <label>
                Nombre
                <input
                  type="text"
                  minLength={3}
                  maxLength={150}
                  required
                  value={editForm.name}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Descripción
                <textarea
                  rows={5}
                  maxLength={2000}
                  value={editForm.description}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      description:
                        event.target.value,
                    }))
                  }
                />
              </label>

              <div className="form-actions">
                <button
                  type="submit"
                  className="primary-button"
                  disabled={
                    actionLoading ||
                    editForm.name.trim().length < 3
                  }
                >
                  Guardar cambios
                </button>

                <button
                  type="button"
                  className="danger-button"
                  onClick={() => {
                    void handleDeleteCorpus();
                  }}
                  disabled={actionLoading}
                >
                  Eliminar corpus
                </button>
              </div>
            </form>

            <dl className="metadata-list">
              <div>
                <dt>Creado</dt>
                <dd>
                  {formatDate(
                    selectedCorpus.created_at,
                  )}
                </dd>
              </div>
              <div>
                <dt>Actualizado</dt>
                <dd>
                  {formatDate(
                    selectedCorpus.updated_at,
                  )}
                </dd>
              </div>
              <div>
                <dt>Documentos</dt>
                <dd>{documents.length}</dd>
              </div>
            </dl>
          </article>

          <article className="panel">
            <h2>Subir documento</h2>
            <p>
              Formatos admitidos: PDF, TXT,
              Markdown y DOCX.
            </p>

            <form
              className="form-grid"
              onSubmit={handleUploadDocument}
            >
              <label>
                Archivo
                <input
                  id="corpus-document-file"
                  type="file"
                  accept=".pdf,.txt,.md,.docx"
                  onChange={handleFileChange}
                  required
                />
              </label>

              {selectedFile && (
                <p>
                  Archivo seleccionado:{" "}
                  <strong>
                    {selectedFile.name}
                  </strong>{" "}
                  ({formatFileSize(
                    selectedFile.size,
                  )})
                </p>
              )}

              <button
                type="submit"
                className="primary-button"
                disabled={
                  actionLoading || !selectedFile
                }
              >
                Subir documento
              </button>
            </form>
          </article>
        </div>

        <article className="panel">
          <div className="section-header">
            <div>
              <h2>Documentos</h2>
              <p>
                Archivos almacenados en este
                corpus.
              </p>
            </div>
          </div>

          {documents.length === 0 ? (
            <p>
              Este corpus todavía no contiene
              documentos.
            </p>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Archivo</th>
                    <th>Formato</th>
                    <th>Tamaño</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                    <th>Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {documents.map((documentItem) => (
                    <tr key={documentItem.id}>
                      <td>
                        <strong>
                          {documentItem.filename}
                        </strong>
                      </td>
                      <td>
                        {documentItem.content_type ??
                          "Desconocido"}
                      </td>
                      <td>
                        {formatFileSize(
                          documentItem.size_bytes,
                        )}
                      </td>
                      <td>
                        {documentStatusLabel(
                          documentItem.status,
                        )}
                      </td>
                      <td>
                        {formatDate(
                          documentItem.created_at,
                        )}
                      </td>
                      <td>
                        <div className="table-actions">
                          <a
                            className="secondary-button"
                            href={downloadDocumentUrl(
                              selectedCorpus.id,
                              documentItem.id,
                            )}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Descargar
                          </a>

                          <button
                            type="button"
                            className="danger-button"
                            disabled={actionLoading}
                            onClick={() => {
                              void handleDeleteDocument(
                                documentItem,
                              );
                            }}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>
    );
  }

  return (
    <section className="page-section">
      <header className="section-header">
        <div>
          <span className="eyebrow">
            Corpus Manager
          </span>
          <h1>Corpus documentales</h1>
          <p>
            Crea y administra las colecciones de
            documentos utilizadas en los
            experimentos RAG.
          </p>
        </div>
      </header>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {notice && (
        <div className="alert alert-success">
          {notice}
        </div>
      )}

      <div className="content-grid">
        <article className="panel">
          <h2>Nuevo corpus</h2>

          <form
            className="form-grid"
            onSubmit={handleCreateCorpus}
          >
            <label>
              Nombre
              <input
                type="text"
                minLength={3}
                maxLength={150}
                required
                placeholder="Documentación técnica"
                value={createForm.name}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Descripción
              <textarea
                rows={5}
                maxLength={2000}
                placeholder="Describe el contenido del corpus"
                value={createForm.description}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    description:
                      event.target.value,
                  }))
                }
              />
            </label>

            <button
              type="submit"
              className="primary-button"
              disabled={
                actionLoading ||
                createForm.name.trim().length < 3
              }
            >
              Crear corpus
            </button>
          </form>
        </article>

        <article className="panel">
          <h2>Corpus disponibles</h2>

          {corpora.length === 0 ? (
            <p>
              Todavía no se ha creado ningún
              corpus.
            </p>
          ) : (
            <div className="item-list">
              {corpora.map((corpus) => (
                <article
                  className="list-card"
                  key={corpus.id}
                >
                  <div>
                    <h3>{corpus.name}</h3>
                    <p>
                      {corpus.description ||
                        "Sin descripción"}
                    </p>
                    <small>
                      Actualizado{" "}
                      {formatDate(
                        corpus.updated_at,
                      )}
                    </small>
                  </div>

                  <button
                    type="button"
                    className="secondary-button"
                    disabled={actionLoading}
                    onClick={() => {
                      void openCorpus(corpus);
                    }}
                  >
                    Abrir
                  </button>
                </article>
              ))}
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
