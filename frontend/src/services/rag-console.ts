import type {
  RagConsoleQueryRequest,
  RagConsoleQueryResponse,
  RagConsoleRun,
} from "../types/rag-console";

const API_BASE = "/api/v1";

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const headers = new Headers(options?.headers);

  headers.set("Accept", "application/json");

  if (
    options?.body &&
    !(options.body instanceof FormData)
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
    const rawBody = await response.text();
    let message =
      rawBody ||
      `Error HTTP ${response.status}`;

    try {
      const payload = JSON.parse(
        rawBody,
      ) as {
        detail?:
          | string
          | Array<{ msg?: string }>;
      };

      if (
        typeof payload.detail ===
        "string"
      ) {
        message = payload.detail;
      } else if (
        Array.isArray(payload.detail)
      ) {
        message = payload.detail
          .map(
            (item) =>
              item.msg ??
              "Error de validación",
          )
          .join(". ");
      }
    } catch {
      // La respuesta no contiene JSON.
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

export function listRagConsoleRuns(): Promise<
  RagConsoleRun[]
> {
  return request<RagConsoleRun[]>(
    "/rag-console/runs",
  );
}

export function queryRagConsole(
  payload: RagConsoleQueryRequest,
): Promise<RagConsoleQueryResponse> {
  return request<RagConsoleQueryResponse>(
    "/rag-console/query",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}
