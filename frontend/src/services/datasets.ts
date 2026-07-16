const API_BASE = "/api/v1";

export type DatasetStatus =
  | "draft"
  | "ready"
  | "archived";

export type DatasetQuestionMetadata =
  Record<string, unknown>;

export type DatasetQuestion = {
  id: string;
  dataset_id: string;
  question: string;
  expected_answer: string | null;
  expected_contexts: string[] | null;
  metadata: DatasetQuestionMetadata;
  order_index: number;
};

export type DatasetSummary = {
  id: string;
  name: string;
  description: string | null;
  version: number;
  status: DatasetStatus;
  question_count: number;
  created_at: string;
  updated_at: string;
};

export type DatasetDetail = {
  id: string;
  name: string;
  description: string | null;
  version: number;
  status: DatasetStatus;
  created_at: string;
  updated_at: string;
  questions: DatasetQuestion[];
};

export type DatasetQuestionCreate = {
  question: string;
  expectedAnswer: string;
  expectedContexts: string[];
  metadata: DatasetQuestionMetadata;
  orderIndex?: number;
};

export type DatasetCreate = {
  name: string;
  description: string;
  version: number;
  status: DatasetStatus;
  questions: DatasetQuestionCreate[];
};

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const headers = new Headers(
    options?.headers,
  );

  headers.set(
    "Accept",
    "application/json",
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

function serializeQuestion(
  question: DatasetQuestionCreate,
) {
  return {
    question: question.question.trim(),
    expected_answer:
      question.expectedAnswer.trim() ||
      null,
    expected_contexts:
      question.expectedContexts.length > 0
        ? question.expectedContexts
            .map((context) =>
              context.trim(),
            )
            .filter(Boolean)
        : null,
    metadata: question.metadata,
    order_index:
      question.orderIndex ?? null,
  };
}

export async function listDatasets(): Promise<
  DatasetSummary[]
> {
  return request<DatasetSummary[]>(
    "/datasets",
  );
}

export async function getDataset(
  datasetId: string,
): Promise<DatasetDetail> {
  return request<DatasetDetail>(
    `/datasets/${datasetId}`,
  );
}

export async function createDataset(
  payload: DatasetCreate,
): Promise<DatasetDetail> {
  return request<DatasetDetail>(
    "/datasets",
    {
      method: "POST",
      body: JSON.stringify({
        name: payload.name.trim(),
        description:
          payload.description.trim() ||
          null,
        version: payload.version,
        status: payload.status,
        questions:
          payload.questions.map(
            serializeQuestion,
          ),
      }),
    },
  );
}

export async function addDatasetQuestion(
  datasetId: string,
  payload: DatasetQuestionCreate,
): Promise<DatasetQuestion> {
  return request<DatasetQuestion>(
    `/datasets/${datasetId}/questions`,
    {
      method: "POST",
      body: JSON.stringify(
        serializeQuestion(payload),
      ),
    },
  );
}

export async function updateDatasetStatus(
  datasetId: string,
  status: DatasetStatus,
): Promise<DatasetDetail> {
  return request<DatasetDetail>(
    `/datasets/${datasetId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status,
      }),
    },
  );
}

export async function deleteDatasetQuestion(
  questionId: string,
): Promise<void> {
  return request<void>(
    `/datasets/questions/${questionId}`,
    {
      method: "DELETE",
    },
  );
}

export async function deleteDataset(
  datasetId: string,
): Promise<void> {
  return request<void>(
    `/datasets/${datasetId}`,
    {
      method: "DELETE",
    },
  );
}
