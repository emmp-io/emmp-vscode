/**
 * Tests for VS Code provider adapters.
 *
 * Validates that Cedar language analysis results are correctly
 * mapped to VS Code provider return types.
 */

import { describe, it, expect } from "vitest";
import {
  getCompletions,
  getDiagnostics,
  getHoverInfo,
  CedarCompletionProvider,
  CedarDiagnosticProvider,
  CedarHoverProvider,
} from "../src/providers/vscode_adapter";
import { SchemaCache } from "../src/connection/schema";
import type { CedarSchema } from "../src/connection/schema";

const testSchema: CedarSchema = {
  entityTypes: [
    {
      name: "User",
      namespace: "mcp",
      memberOf: ["mcp::Group"],
      attributes: [
        { name: "department", type: "String", required: true, description: "User department" },
        { name: "clearance", type: "Long", required: false, description: "Security clearance level" },
      ],
    },
    {
      name: "Tool",
      namespace: "mcp",
      attributes: [
        { name: "tool_name", type: "String", required: true },
        { name: "sensitive", type: "Boolean", required: false },
      ],
    },
  ],
  actions: [
    {
      name: "call_tool",
      namespace: "mcp",
      appliesTo: {
        principalTypes: ["mcp::User"],
        resourceTypes: ["mcp::Tool"],
      },
      description: "Invoke a tool",
    },
  ],
  contextAttributes: [
    { name: "ip_address", type: "String", path: "ip_address", description: "Client IP" },
    { name: "time_of_day", type: "Long", path: "time_of_day", description: "Hour (0-23)" },
  ],
};

// ── getCompletions ──

describe("getCompletions", () => {
  it("returns keyword completions without schema", () => {
    const entries = getCompletions("", 0, 0, null);
    const labels = entries.map((e) => e.label);
    expect(labels).toContain("permit");
    expect(labels).toContain("forbid");
    expect(labels).toContain("when");
    expect(labels).toContain("unless");
    expect(labels).toContain("principal");
    expect(labels).toContain("action");
    expect(labels).toContain("resource");
    expect(labels).toContain("context");
  });

  it("includes entity types from schema", () => {
    const entries = getCompletions("", 0, 0, testSchema);
    const labels = entries.map((e) => e.label);
    expect(labels).toContain("mcp::User");
    expect(labels).toContain("mcp::Tool");
  });

  it("includes actions from schema", () => {
    const entries = getCompletions("", 0, 0, testSchema);
    const labels = entries.map((e) => e.label);
    expect(labels).toContain('mcp::Action::"call_tool"');
  });

  it("includes context attributes from schema", () => {
    const entries = getCompletions("", 0, 0, testSchema);
    const labels = entries.map((e) => e.label);
    expect(labels).toContain("context.ip_address");
    expect(labels).toContain("context.time_of_day");
  });

  it("returns correct kind for each entry type", () => {
    const entries = getCompletions("", 0, 0, testSchema);
    const keyword = entries.find((e) => e.label === "permit");
    expect(keyword?.kind).toBe("keyword");
    const entity = entries.find((e) => e.label === "mcp::User");
    expect(entity?.kind).toBe("entity");
    const action = entries.find((e) => e.label === 'mcp::Action::"call_tool"');
    expect(action?.kind).toBe("action");
    const attr = entries.find((e) => e.label === "context.ip_address");
    expect(attr?.kind).toBe("attribute");
  });
});

// ── getDiagnostics ──

describe("getDiagnostics", () => {
  it("returns empty for valid policy", () => {
    const text = `permit(
  principal,
  action,
  resource
);`;
    const diags = getDiagnostics(text);
    expect(diags).toHaveLength(0);
  });

  it("detects unmatched parenthesis", () => {
    const text = `forbid(
  principal,
  action,
  resource`;
    const diags = getDiagnostics(text);
    expect(diags.length).toBeGreaterThan(0);
    const unmatched = diags.find((d) => d.message.includes("parenthesis"));
    expect(unmatched).toBeDefined();
    expect(unmatched?.severity).toBe("error");
  });

  it("detects missing semicolon", () => {
    const text = `forbid(
  principal,
  action,
  resource
) when {
  context.hour_utc < 8
}`;
    const diags = getDiagnostics(text);
    const semicolonDiag = diags.find((d) => d.message.includes("semicolon"));
    expect(semicolonDiag).toBeDefined();
    expect(semicolonDiag?.severity).toBe("warning");
  });

  it("returns range information", () => {
    const text = `forbid(
  principal,
  action,
  resource
) when {
  context.hour_utc < 8
}`;
    const diags = getDiagnostics(text);
    for (const d of diags) {
      expect(d.range.startLine).toBeGreaterThanOrEqual(0);
      expect(d.range.endLine).toBeGreaterThanOrEqual(d.range.startLine);
    }
  });
});

// ── getHoverInfo ──

describe("getHoverInfo", () => {
  it("returns hover for keyword permit", () => {
    const text = "permit(principal, action, resource);";
    const info = getHoverInfo(text, 0, 3, null);
    expect(info).not.toBeNull();
    expect(info?.contents).toContain("permit");
  });

  it("returns hover for keyword forbid", () => {
    const text = "forbid(principal, action, resource);";
    const info = getHoverInfo(text, 0, 3, null);
    expect(info).not.toBeNull();
    expect(info?.contents).toContain("forbid");
  });

  it("returns null for unknown word", () => {
    const text = "unknown_identifier";
    const info = getHoverInfo(text, 0, 5, null);
    expect(info).toBeNull();
  });

  it("returns entity type info from schema", () => {
    const text = "principal is mcp::User,";
    const info = getHoverInfo(text, 0, 16, testSchema);
    expect(info).not.toBeNull();
    expect(info?.contents).toContain("mcp::User");
    expect(info?.contents).toContain("department");
  });

  it("returns null for out-of-range line", () => {
    const text = "permit();";
    const info = getHoverInfo(text, 5, 0, null);
    expect(info).toBeNull();
  });

  it("includes range in hover result", () => {
    const text = "permit(principal, action, resource);";
    const info = getHoverInfo(text, 0, 3, null);
    expect(info?.range).toBeDefined();
    expect(info?.range?.startLine).toBe(0);
    expect(info?.range?.endLine).toBe(0);
  });
});

// ── CedarCompletionProvider adapter ──

describe("CedarCompletionProvider", () => {
  it("maps completion entries to VS Code format", () => {
    const cache = new SchemaCache();
    const provider = new CedarCompletionProvider(cache);
    const doc = {
      getText: () => "",
      positionAt: (_offset: number) => ({ line: 0, character: 0 }),
    };
    const items = provider.provideCompletionItems(doc, { line: 0, character: 0 });
    expect(items.length).toBeGreaterThan(0);

    const first = items[0] as { label: string; kind: number; detail: string };
    expect(first.label).toBeDefined();
    expect(typeof first.kind).toBe("number");
    expect(first.detail).toBeDefined();
  });

  it("uses schema when available", () => {
    const cache = new SchemaCache();
    // Manually set cached schema via type assertion for testing
    (cache as unknown as { cachedSchema: CedarSchema }).cachedSchema = testSchema;

    const provider = new CedarCompletionProvider(cache);
    const doc = {
      getText: () => "",
      positionAt: (_offset: number) => ({ line: 0, character: 0 }),
    };
    const items = provider.provideCompletionItems(doc, { line: 0, character: 0 });
    const labels = (items as { label: string }[]).map((i) => i.label);
    expect(labels).toContain("mcp::User");
  });
});

// ── CedarDiagnosticProvider adapter ──

describe("CedarDiagnosticProvider", () => {
  it("maps diagnostic entries to VS Code format", () => {
    const provider = new CedarDiagnosticProvider();
    const text = `forbid(
  principal,
  action,
  resource
) when {
  context.x
}`;
    const diags = provider.updateDiagnostics("file:///test.cedar", text);
    for (const d of diags as { range: { start: { line: number } }; source: string }[]) {
      expect(d.range.start.line).toBeGreaterThanOrEqual(0);
      expect(d.source).toBe("emmp-cedar");
    }
  });

  it("sets diagnostics on collection when provided", () => {
    const provider = new CedarDiagnosticProvider();
    let setCalled = false;
    const mockCollection = {
      set: (_uri: unknown, _diags: unknown[]) => {
        setCalled = true;
      },
      clear: () => {},
    };
    provider.setCollection(mockCollection);
    provider.updateDiagnostics("file:///test.cedar", "forbid(");
    expect(setCalled).toBe(true);
  });

  it("returns empty for valid text", () => {
    const provider = new CedarDiagnosticProvider();
    const diags = provider.updateDiagnostics(
      "file:///test.cedar",
      "permit(principal, action, resource);"
    );
    expect(diags).toHaveLength(0);
  });
});

// ── CedarHoverProvider adapter ──

describe("CedarHoverProvider", () => {
  it("maps hover info to VS Code format", () => {
    const cache = new SchemaCache();
    const provider = new CedarHoverProvider(cache);
    const doc = { getText: () => "permit(principal, action, resource);" };
    const hover = provider.provideHover(doc, { line: 0, character: 3 }) as {
      contents: { kind: string; value: string };
    } | null;

    expect(hover).not.toBeNull();
    expect(hover?.contents.kind).toBe("markdown");
    expect(hover?.contents.value).toContain("permit");
  });

  it("returns null for no hover", () => {
    const cache = new SchemaCache();
    const provider = new CedarHoverProvider(cache);
    const doc = { getText: () => "unknown_xyz" };
    const hover = provider.provideHover(doc, { line: 0, character: 5 });
    expect(hover).toBeNull();
  });

  it("uses schema for entity hover", () => {
    const cache = new SchemaCache();
    (cache as unknown as { cachedSchema: CedarSchema }).cachedSchema = testSchema;

    const provider = new CedarHoverProvider(cache);
    const doc = { getText: () => "principal is mcp::User," };
    const hover = provider.provideHover(doc, { line: 0, character: 16 }) as {
      contents: { kind: string; value: string };
    } | null;

    expect(hover).not.toBeNull();
    expect(hover?.contents.value).toContain("mcp::User");
  });
});
