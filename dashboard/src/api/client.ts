import type {
  ApiListResponse,
  ApiResponse,
  Briefing,
  CategoriesPayload,
  Event,
  Health,
  Issue,
  IssueDetail,
  Server,
} from "./types";

const BASE_URL = import.meta.env.VITE_OPSLOG_API_URL || "/api/v1";
const TOKEN = import.meta.env.VITE_OPSLOG_TOKEN || "";

export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue>;

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

function formatErrorMessage(path: string, response: Response, payload: unknown): string {
  const base = `API request failed for ${path}: ${response.status} ${response.statusText || ""}`.trim();
  if (!payload || typeof payload !== "object") {
    return base;
  }

  const data = (payload as { data?: unknown }).data;
  if (!data || typeof data !== "object") {
    return base;
  }

  const error = (data as { error?: unknown }).error;
  if (typeof error === "string" && error.length > 0) {
    return `${base} (${error})`;
  }
  return base;
}

function buildQuery(params?: QueryParams): string {
  if (!params) {
    return "";
  }

  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") {
      return;
    }
    query.set(key, String(value));
  });

  const serialized = query.toString();
  return serialized.length > 0 ? `?${serialized}` : "";
}

function buildHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Authorization", `Bearer ${TOKEN}`);
  return headers;
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: buildHeaders(options?.headers),
  });

  const payload = await parseJson(response);
  if (!response.ok) {
    throw new ApiError(formatErrorMessage(path, response, payload), response.status, payload);
  }

  return payload as ApiResponse<T>;
}

async function requestList<T>(path: string, params?: QueryParams): Promise<ApiListResponse<T>> {
  const query = buildQuery(params);
  const response = await fetch(`${BASE_URL}${path}${query}`, {
    headers: buildHeaders(),
  });

  const payload = await parseJson(response);
  if (!response.ok) {
    throw new ApiError(formatErrorMessage(path, response, payload), response.status, payload);
  }

  return payload as ApiListResponse<T>;
}

export const api = {
  health: () => request<Health>("/health"),
  categories: () => request<CategoriesPayload>("/categories"),
  events: {
    list: (params?: QueryParams) => requestList<Event>("/events", params),
    get: (id: string) => request<Event>(`/events/${id}`),
  },
  issues: {
    list: (params?: QueryParams) => requestList<Issue>("/issues", params),
    get: (id: string) => request<IssueDetail>(`/issues/${id}`),
  },
  servers: {
    list: () => request<Server[]>("/servers"),
    briefing: (name: string) => request<Briefing>(`/servers/${name}/briefing`),
  },
};
