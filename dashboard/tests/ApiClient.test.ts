import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiError,
  api,
  setTokenProvider,
  setUnauthorizedHandler,
} from "@/api/client";

function mockFetchResponse(payload: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    text: async () => JSON.stringify(payload),
  } as Response;
}

describe("API client", () => {
  beforeEach(() => {
    setTokenProvider(() => "test-token");
    setUnauthorizedHandler(null);
  });

  afterEach(() => {
    setTokenProvider(() => null);
    setUnauthorizedHandler(null);
  });

  it("sends auth header and parses envelope", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockFetchResponse({ data: { status: "ok", version: "0.3.0", db: "connected", uptime_seconds: 1 }, warnings: [] })
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const response = await api.health();

    expect(response.data.status).toBe("ok");
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(options.headers);
    expect(headers.get("Authorization")).toBe("Bearer test-token");
  });

  it("builds list query parameters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockFetchResponse({ data: [], next_cursor: null, has_more: false, warnings: [] })
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    await api.events.list({ limit: 10, server: "agent-workspace" });

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/events?limit=10&server=agent-workspace");
  });

  it("throws ApiError on non-2xx responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockFetchResponse({ data: { error: "forbidden" }, warnings: [] }, false, 403)
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    await expect(api.servers.list()).rejects.toBeInstanceOf(ApiError);
    await expect(api.servers.list()).rejects.toMatchObject({
      message: expect.stringContaining("403"),
    });
  });

  it("invokes unauthorized handler for 401 responses", async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);

    const fetchMock = vi.fn().mockResolvedValue(
      mockFetchResponse({ data: { error: "invalid_token" }, warnings: [] }, false, 401)
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    await expect(api.servers.list()).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
