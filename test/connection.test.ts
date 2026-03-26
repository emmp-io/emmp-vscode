/**
 * Tests for EmmpConnection and SchemaCache.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmmpConnection } from "../src/connection/auth";
import { SchemaCache } from "../src/connection/schema";
import type { CedarSchema } from "../src/connection/schema";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── EmmpConnection ──

describe("EmmpConnection", () => {
  it("connect stores credentials on success", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    const conn = new EmmpConnection();
    await conn.connect("https://emmp.example.com", "api-key-123", "tenant-1");

    expect(conn.isConnected()).toBe(true);
    expect(conn.getServerUrl()).toBe("https://emmp.example.com");
    expect(conn.getApiKey()).toBe("api-key-123");
    expect(conn.getTenantId()).toBe("tenant-1");
  });

  it("connect normalizes trailing slash", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    const conn = new EmmpConnection();
    await conn.connect("https://emmp.example.com///", "key");

    expect(conn.getServerUrl()).toBe("https://emmp.example.com");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://emmp.example.com/api/cedar/schema",
      expect.anything()
    );
  });

  it("connect throws on non-OK response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    });

    const conn = new EmmpConnection();
    await expect(conn.connect("https://emmp.example.com", "bad-key")).rejects.toThrow(
      "Failed to connect"
    );
    expect(conn.isConnected()).toBe(false);
  });

  it("connect throws on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("DNS resolution failed"));

    const conn = new EmmpConnection();
    await expect(conn.connect("https://bad.host", "key")).rejects.toThrow(
      "DNS resolution failed"
    );
    expect(conn.isConnected()).toBe(false);
  });

  it("disconnect clears state", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    const conn = new EmmpConnection();
    await conn.connect("https://emmp.example.com", "key", "t1");
    expect(conn.isConnected()).toBe(true);

    conn.disconnect();

    expect(conn.isConnected()).toBe(false);
    expect(conn.getServerUrl()).toBe("");
    expect(conn.getApiKey()).toBe("");
    expect(conn.getTenantId()).toBe("");
  });

  it("buildHeaders includes tenant ID when set", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    const conn = new EmmpConnection();
    await conn.connect("https://emmp.example.com", "key-abc", "tenant-42");

    const headers = conn.buildHeaders();
    expect(headers["Authorization"]).toBe("Bearer key-abc");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["X-Tenant-Id"]).toBe("tenant-42");
  });

  it("buildHeaders omits tenant ID when not set", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    const conn = new EmmpConnection();
    await conn.connect("https://emmp.example.com", "key-abc");

    const headers = conn.buildHeaders();
    expect(headers["X-Tenant-Id"]).toBeUndefined();
  });

  it("isConnected returns false initially", () => {
    const conn = new EmmpConnection();
    expect(conn.isConnected()).toBe(false);
  });
});

// ── SchemaCache ──

describe("SchemaCache", () => {
  const testSchema: CedarSchema = {
    entityTypes: [
      {
        name: "User",
        namespace: "mcp",
        attributes: [{ name: "dept", type: "String", required: true }],
      },
    ],
    actions: [
      {
        name: "call_tool",
        namespace: "mcp",
        appliesTo: { principalTypes: ["mcp::User"], resourceTypes: ["mcp::Tool"] },
      },
    ],
    contextAttributes: [
      { name: "ip", type: "String", path: "ip" },
    ],
  };

  it("getCachedSchema returns null initially", () => {
    const cache = new SchemaCache();
    expect(cache.getCachedSchema()).toBeNull();
  });

  it("fetchSchema fetches and caches", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    const conn = new EmmpConnection();
    await conn.connect("https://emmp.example.com", "key");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => testSchema,
    });

    const cache = new SchemaCache();
    const result = await cache.fetchSchema(conn);

    expect(result.entityTypes).toHaveLength(1);
    expect(result.entityTypes[0].name).toBe("User");
    expect(cache.getCachedSchema()).toEqual(testSchema);
  });

  it("getCachedSchema returns cached data after fetch", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    const conn = new EmmpConnection();
    await conn.connect("https://emmp.example.com", "key");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => testSchema,
    });

    const cache = new SchemaCache();
    await cache.fetchSchema(conn);
    const cached = cache.getCachedSchema();

    expect(cached).not.toBeNull();
    expect(cached?.entityTypes[0].name).toBe("User");
    expect(cached?.actions[0].name).toBe("call_tool");
  });

  it("fetchSchema throws on error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    const conn = new EmmpConnection();
    await conn.connect("https://emmp.example.com", "key");

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const cache = new SchemaCache();
    await expect(cache.fetchSchema(conn)).rejects.toThrow("Failed to fetch Cedar schema");
  });

  it("clearCache resets to null", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    const conn = new EmmpConnection();
    await conn.connect("https://emmp.example.com", "key");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => testSchema,
    });

    const cache = new SchemaCache();
    await cache.fetchSchema(conn);
    expect(cache.getCachedSchema()).not.toBeNull();

    cache.clearCache();
    expect(cache.getCachedSchema()).toBeNull();
  });
});
