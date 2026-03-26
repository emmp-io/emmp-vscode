/**
 * Tests for the simulate command.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { simulatePolicy } from "../src/commands/simulate";
import { EmmpConnection } from "../src/connection/auth";

// Mock global fetch
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function createConnectedConnection(): EmmpConnection {
  const conn = new EmmpConnection();
  // Set internal state to simulate a connected state
  (conn as unknown as { serverUrl: string }).serverUrl = "https://emmp.example.com";
  (conn as unknown as { apiKey: string }).apiKey = "test-key";
  (conn as unknown as { tenantId: string }).tenantId = "tenant-1";
  (conn as unknown as { connected: boolean }).connected = true;
  return conn;
}

describe("simulatePolicy", () => {
  it("returns PERMIT result from API", async () => {
    const conn = createConnectedConnection();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        decision: "PERMIT",
        matchedPolicies: ["policy-1", "policy-2"],
        diagnostics: [],
      }),
    });

    const result = await simulatePolicy(
      conn,
      'permit(principal, action, resource);',
      'mcp::User::"alice"',
      'mcp::Action::"call_tool"',
      'mcp::Tool::"read_file"',
      {}
    );

    expect(result.decision).toBe("PERMIT");
    expect(result.matchedPolicies).toEqual(["policy-1", "policy-2"]);
    expect(result.diagnostics).toEqual([]);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://emmp.example.com/api/cedar/simulate",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
          "Content-Type": "application/json",
          "X-Tenant-Id": "tenant-1",
        }),
      })
    );
  });

  it("returns DENY result from API", async () => {
    const conn = createConnectedConnection();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        decision: "DENY",
        matchedPolicies: ["deny-policy-1"],
        diagnostics: ["No matching permit policy found"],
      }),
    });

    const result = await simulatePolicy(
      conn,
      "forbid(principal, action, resource);",
      'mcp::User::"bob"',
      'mcp::Action::"call_tool"',
      'mcp::Tool::"write_file"',
      { hour_utc: 22 }
    );

    expect(result.decision).toBe("DENY");
    expect(result.matchedPolicies).toEqual(["deny-policy-1"]);
    expect(result.diagnostics).toEqual(["No matching permit policy found"]);
  });

  it("throws on connection error", async () => {
    const conn = createConnectedConnection();

    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    await expect(
      simulatePolicy(
        conn,
        "permit(principal, action, resource);",
        'mcp::User::"alice"',
        'mcp::Action::"call_tool"',
        'mcp::Tool::"read_file"',
        {}
      )
    ).rejects.toThrow("Network error");
  });

  it("throws when not connected", async () => {
    const conn = new EmmpConnection();

    await expect(
      simulatePolicy(
        conn,
        "permit(principal, action, resource);",
        'mcp::User::"alice"',
        'mcp::Action::"call_tool"',
        'mcp::Tool::"read_file"',
        {}
      )
    ).rejects.toThrow("Not connected");
  });

  it("throws on non-OK response", async () => {
    const conn = createConnectedConnection();

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    await expect(
      simulatePolicy(
        conn,
        "permit(principal, action, resource);",
        'mcp::User::"alice"',
        'mcp::Action::"call_tool"',
        'mcp::Tool::"read_file"',
        {}
      )
    ).rejects.toThrow("Simulation failed: 500");
  });

  it("handles missing matchedPolicies and diagnostics in response", async () => {
    const conn = createConnectedConnection();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        decision: "PERMIT",
      }),
    });

    const result = await simulatePolicy(
      conn,
      "permit(principal, action, resource);",
      'mcp::User::"alice"',
      'mcp::Action::"call_tool"',
      'mcp::Tool::"read_file"',
      {}
    );

    expect(result.decision).toBe("PERMIT");
    expect(result.matchedPolicies).toEqual([]);
    expect(result.diagnostics).toEqual([]);
  });
});
