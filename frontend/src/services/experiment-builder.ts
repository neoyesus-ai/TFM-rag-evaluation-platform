import type {
  CreatedExperiment,
  ExperimentBuilderCorpus,
  ExperimentBuilderDataset,
  ExperimentBuilderForm,
  ExperimentTemplate,
  PipelineConfiguration,
  SavedExperimentTemplate,
} from "../types/experiment-builder";

const API_BASE = "/api/v1";

export type ExperimentRun = {
  id: string;
  experiment_version_id: string;
  mlflow_run_id: string | null;
  status:
    | "pending"
    | "running"
    | "completed"
    | "failed"
    | "interrupted"
    | string;
  started_at?: string | null;
  finished_at?: string | null;
  duration_ms?: number | null;
  error_message?: string | null;
  created_at?: string;
};

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const headers = new Headers(
    options?.headers,
  );

  if (
    options?.body &&
    !headers.has("Content-Type")
  ) {
    headers.set(
      "Content-Type",
      "application/json",
    );
  }

  headers.set(
    "Accept",
    "application/json",
  );

  const response = await fetch(
    `${API_BASE}${path}`,
    {
      ...options,
      headers,
    },
  );

  if (!response.ok) {
    const responseText =
      await response.text();

    let message =
      responseText ||
      `HTTP ${response.status}`;

    try {
      const payload = JSON.parse(
        responseText,
      ) as {
        detail?: string;
      };

      if (payload.detail) {
        message = payload.detail;
      }
    } catch {
      // La respuesta no era JSON.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function getBuilderCorpora(): Promise<
  ExperimentBuilderCorpus[]
> {
  return request<
    ExperimentBuilderCorpus[]
  >("/corpora?limit=100&offset=0");
}

export async function getBuilderDatasets(): Promise<
  ExperimentBuilderDataset[]
> {
  return request<
    ExperimentBuilderDataset[]
  >("/datasets");
}

export async function getBuiltinTemplates(): Promise<
  ExperimentTemplate[]
> {
  return request<
    ExperimentTemplate[]
  >("/experiment-templates");
}

export async function getCustomTemplates(): Promise<
  SavedExperimentTemplate[]
> {
  return request<
    SavedExperimentTemplate[]
  >(
    "/experiment-templates/custom/saved",
  );
}

export async function getExperimentBuilderResources(): Promise<{
  corpora: ExperimentBuilderCorpus[];
  datasets: ExperimentBuilderDataset[];
  builtinTemplates: ExperimentTemplate[];
  customTemplates: SavedExperimentTemplate[];
}> {
  const [
    corpora,
    datasets,
    builtinTemplates,
    customTemplates,
  ] = await Promise.all([
    getBuilderCorpora(),
    getBuilderDatasets(),
    getBuiltinTemplates(),
    getCustomTemplates(),
  ]);

  return {
    corpora,
    datasets,
    builtinTemplates,
    customTemplates,
  };
}

export async function createExperiment(
  form: ExperimentBuilderForm,
): Promise<CreatedExperiment> {
  return request<CreatedExperiment>(
    "/experiments",
    {
      method: "POST",
      body: JSON.stringify({
        name: form.name.trim(),
        description:
          form.description.trim() ||
          null,
        corpus_id: form.corpusId,
        dataset_id:
          form.datasetId || null,
        configuration:
          form.configuration,
        source_template_key:
          form.templateKey || null,
        git_commit:
          form.gitCommit.trim() ||
          null,
      }),
    },
  );
}

export async function createExperimentFromBuiltinTemplate(
  form: ExperimentBuilderForm,
): Promise<CreatedExperiment> {
  if (!form.templateKey) {
    throw new Error(
      "Debes seleccionar una plantilla integrada.",
    );
  }

  return request<CreatedExperiment>(
    `/experiment-templates/builtin/${encodeURIComponent(
      form.templateKey,
    )}/create-experiment`,
    {
      method: "POST",
      body: JSON.stringify({
        name: form.name.trim(),
        description:
          form.description.trim() ||
          null,
        corpus_id: form.corpusId,
        configuration_overrides:
          form.configuration,
        git_commit:
          form.gitCommit.trim() ||
          null,
      }),
    },
  );
}

export async function createExperimentRun(
  versionId: string,
): Promise<ExperimentRun> {
  return request<ExperimentRun>(
    `/experiment-runs/versions/${versionId}`,
    {
      method: "POST",
    },
  );
}

export async function getExperimentRun(
  runId: string,
): Promise<ExperimentRun> {
  return request<ExperimentRun>(
    `/experiment-runs/${runId}`,
  );
}

export async function getExperimentRuns(): Promise<
  ExperimentRun[]
> {
  return request<ExperimentRun[]>(
    "/experiment-runs",
  );
}

export type CustomTemplateCreatePayload = {
  templateKey: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  configuration: PipelineConfiguration;
  matrix:
    | Record<
        string,
        Array<string | number>
      >
    | null;
};

export async function saveCustomTemplate(
  payload: CustomTemplateCreatePayload,
): Promise<SavedExperimentTemplate> {
  return request<SavedExperimentTemplate>(
    "/experiment-templates/custom",
    {
      method: "POST",
      body: JSON.stringify({
        template_key:
          payload.templateKey.trim(),
        name: payload.name.trim(),
        description:
          payload.description.trim() ||
          null,
        category:
          payload.category.trim() ||
          "custom",
        tags: payload.tags,
        configuration:
          payload.configuration,
        matrix: payload.matrix,
      }),
    },
  );
}
