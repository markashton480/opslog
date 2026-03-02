import type { Event, Issue, Server, Briefing } from "./types";

const BASE_URL = import.meta.env.VITE_OPSLOG_API_URL || "/api/v1";
const TOKEN = import.meta.env.VITE_OPSLOG_TOKEN || "";

interface ApiResponse<T> {
  data: T;
  warnings: string[];
}

interface ListResponse<T> {
  data: T[];
  next_cursor: string | null;
  has_more: boolean;
  warnings: string[];
}

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function requestList<T>(
  path: string,
  options?: RequestInit
): Promise<ListResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<ListResponse<T>>;
}

export const api = {
  health: () => request<{ status: string; version: string }>("/health"),

  events: {
    list: (params?: Record<string, string>) => {
      const query = params ? "?" + new URLSearchParams(params).toString() : "";
      return requestList<Event>(`/events${query}`);
    },
    get: (id: string) => request<Event>(`/events/${id}`),
    create: (data: unknown) => request<Event>("/events", { method: "POST", body: JSON.stringify(data) }),
  },

  issues: {
    list: (params?: Record<string, string>) => {
      const query = params ? "?" + new URLSearchParams(params).toString() : "";
      return requestList<Issue>(`/issues${query}`);
    },
    get: (id: string) => request<Issue>(`/issues/${id}`),
    create: (data: unknown) => request<Issue>("/issues", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: unknown) => request<Issue>(`/issues/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  },

  servers: {
    list: () => request<Server[]>("/servers"),
    get: (name: string) => request<Server>(`/servers/${name}`),
    briefing: (name: string) => request<Briefing>(`/servers/${name}/briefing`),
  },

  categories: () => request<{ categories: Array<{ name: string; description: string }> }>("/categories"),
};
