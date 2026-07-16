import type {
  AnalyticsDashboard,
  AnalyticsDashboardData,
  AnalyticsSummary,
} from "../types/analytics";

const API_BASE = "/api/v1";

async function request<T>(
  path: string,
): Promise<T> {
  const response = await fetch(
    `${API_BASE}${path}`,
    {
      headers: {
        Accept: "application/json",
      },
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

  return (await response.json()) as T;
}

export async function getDashboard(): Promise<
  AnalyticsDashboard
> {
  return request<AnalyticsDashboard>(
    "/analytics/dashboard",
  );
}

export async function getSummaries(): Promise<
  AnalyticsSummary[]
> {
  return request<AnalyticsSummary[]>(
    "/analytics/summaries",
  );
}

export async function getAnalyticsData(): Promise<
  AnalyticsDashboardData
> {
  const [
    dashboard,
    summaries,
  ] = await Promise.all([
    getDashboard(),
    getSummaries(),
  ]);

  return {
    dashboard,
    summaries,
  };
}
