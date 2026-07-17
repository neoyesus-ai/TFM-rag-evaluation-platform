const API_BASE = "/api/v1";

export type Document = {
  id: string;
  corpus_id: string;
  filename: string;
  content_type: string | null;
  size_bytes: number;
  checksum_sha256: string;
  status: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

async function apiRequest<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(
    `${API_BASE}${path}`,
    options,
  );

  if (!response.ok) {
    const rawBody = await response.text();
    let message =
      rawBody || `HTTP ${response.status}`;

    try {
      const payload = JSON.parse(rawBody);

      if (payload.detail) {
        message = payload.detail;
      }
    } catch {
      // respuesta no JSON
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function listDocuments(
  corpusId: string,
): Promise<Document[]> {
  return apiRequest<Document[]>(
    `/corpora/${corpusId}/documents`,
  );
}

export async function uploadDocument(
  corpusId: string,
  file: File,
): Promise<Document> {
  const formData = new FormData();

  formData.append("file", file);

  return apiRequest<Document>(
    `/corpora/${corpusId}/documents`,
    {
      method: "POST",
      body: formData,
    },
  );
}

export async function deleteDocument(
  corpusId: string,
  documentId: string,
): Promise<void> {
  return apiRequest<void>(
    `/corpora/${corpusId}/documents/${documentId}`,
    {
      method: "DELETE",
    },
  );
}

export function downloadDocumentUrl(
  corpusId: string,
  documentId: string,
): string {
  return `${API_BASE}/corpora/${corpusId}/documents/${documentId}/download`;
}
