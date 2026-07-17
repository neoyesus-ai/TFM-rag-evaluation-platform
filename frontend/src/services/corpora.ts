const API_BASE = "/api/v1";

export type Corpus = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type CorpusCreatePayload = {
  name: string;
  description: string | null;
};

export type CorpusUpdatePayload = {
  name?: string;
  description?: string | null;
};

async function apiRequest<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const headers = new Headers(options?.headers);

  if (
    options?.body &&
    !(options.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const rawBody = await response.text();
    let message = rawBody || `HTTP ${response.status}`;

    try {
      const payload = JSON.parse(rawBody) as {
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

export async function listCorpora(): Promise<Corpus[]> {
  return apiRequest<Corpus[]>("/corpora");
}

export async function getCorpus(
  corpusId: string,
): Promise<Corpus> {
  return apiRequest<Corpus>(`/corpora/${corpusId}`);
}

export async function createCorpus(
  payload: CorpusCreatePayload,
): Promise<Corpus> {
  return apiRequest<Corpus>("/corpora", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCorpus(
  corpusId: string,
  payload: CorpusUpdatePayload,
): Promise<Corpus> {
  return apiRequest<Corpus>(`/corpora/${corpusId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteCorpus(
  corpusId: string,
): Promise<void> {
  return apiRequest<void>(`/corpora/${corpusId}`, {
    method: "DELETE",
  });
}
