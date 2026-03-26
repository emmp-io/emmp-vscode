/**
 * VS Code language provider adapters for Cedar.
 *
 * These adapters wrap Cedar language analysis functions and map
 * their results to VS Code provider interfaces. Since @emmp/cedar-language
 * is not directly installable, we inline the core type definitions and
 * provide adapter stubs that demonstrate the integration pattern.
 */

import type { SchemaCache, CedarSchema } from "../connection/schema";

// ── Inline type definitions (mirrors @emmp/cedar-language) ──

/** A completion entry returned by the Cedar language service. */
export interface CompletionEntry {
  label: string;
  kind: "keyword" | "entity" | "action" | "attribute" | "snippet";
  detail?: string;
  insertText?: string;
  documentation?: string;
}

/** A diagnostic entry returned by the Cedar language service. */
export interface DiagnosticEntry {
  message: string;
  severity: "error" | "warning" | "info" | "hint";
  range: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
}

/** Hover information returned by the Cedar language service. */
export interface HoverInfo {
  contents: string;
  range?: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
}

// ── Core analysis functions (stubs for @emmp/cedar-language) ──

/** Generate completions based on schema and cursor position. */
export function getCompletions(
  _text: string,
  _line: number,
  _column: number,
  schema: CedarSchema | null
): CompletionEntry[] {
  const entries: CompletionEntry[] = [
    { label: "permit", kind: "keyword", detail: "Cedar permit statement" },
    { label: "forbid", kind: "keyword", detail: "Cedar forbid statement" },
    { label: "when", kind: "keyword", detail: "Cedar when clause" },
    { label: "unless", kind: "keyword", detail: "Cedar unless clause" },
    { label: "principal", kind: "keyword", detail: "Policy principal" },
    { label: "action", kind: "keyword", detail: "Policy action" },
    { label: "resource", kind: "keyword", detail: "Policy resource" },
    { label: "context", kind: "keyword", detail: "Request context" },
  ];

  if (schema) {
    for (const entity of schema.entityTypes) {
      entries.push({
        label: `${entity.namespace}::${entity.name}`,
        kind: "entity",
        detail: `Entity type with ${entity.attributes.length} attributes`,
        documentation: entity.attributes.map((a) => `${a.name}: ${a.type}`).join(", "),
      });
    }
    for (const action of schema.actions) {
      entries.push({
        label: `${action.namespace}::Action::"${action.name}"`,
        kind: "action",
        detail: action.description ?? "Cedar action",
      });
    }
    for (const attr of schema.contextAttributes) {
      entries.push({
        label: `context.${attr.name}`,
        kind: "attribute",
        detail: `${attr.type} — ${attr.description ?? attr.path}`,
      });
    }
  }

  return entries;
}

/** Run diagnostics on Cedar policy text. */
export function getDiagnostics(text: string): DiagnosticEntry[] {
  const diagnostics: DiagnosticEntry[] = [];
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for common syntax issues
    if (line.includes("permit(") || line.includes("forbid(")) {
      // Verify the statement has a closing bracket somewhere
      const remainder = lines.slice(i).join("\n");
      const openCount = (remainder.match(/\(/g) ?? []).length;
      const closeCount = (remainder.match(/\)/g) ?? []).length;
      if (openCount > closeCount) {
        diagnostics.push({
          message: "Unmatched parenthesis in policy statement",
          severity: "error",
          range: {
            startLine: i,
            startColumn: 0,
            endLine: i,
            endColumn: line.length,
          },
        });
      }
    }

    // Check for missing semicolons at end of policy blocks
    if (line.trimEnd().endsWith("}") && i === lines.length - 1) {
      const fullText = lines.join("\n");
      if (!fullText.trimEnd().endsWith(";")) {
        diagnostics.push({
          message: "Policy statement should end with a semicolon",
          severity: "warning",
          range: {
            startLine: i,
            startColumn: line.length - 1,
            endLine: i,
            endColumn: line.length,
          },
        });
      }
    }
  }

  return diagnostics;
}

/** Get hover information for a position in Cedar text. */
export function getHoverInfo(
  text: string,
  line: number,
  column: number,
  schema: CedarSchema | null
): HoverInfo | null {
  const lines = text.split("\n");
  if (line < 0 || line >= lines.length) return null;

  const lineText = lines[line];
  if (column < 0 || column > lineText.length) return null;

  // Extract the word at the cursor position
  const wordMatch = lineText.slice(0, column + 1).match(/[\w.:]+$/);
  const afterMatch = lineText.slice(column).match(/^[\w.:]+/);
  if (!wordMatch && !afterMatch) return null;

  const word = (wordMatch?.[0] ?? "") + (afterMatch?.[0]?.slice(1) ?? "");

  // Check for keywords
  const keywords: Record<string, string> = {
    permit: "**permit** — Allows the request if all conditions are met.",
    forbid: "**forbid** — Denies the request if all conditions are met.",
    when: "**when** — Condition clause: policy applies when the expression is true.",
    unless: "**unless** — Exception clause: policy does not apply when the expression is true.",
    principal: "**principal** — The entity making the request.",
    action: "**action** — The operation being performed.",
    resource: "**resource** — The entity the action targets.",
    context: "**context** — Additional request context attributes.",
  };

  if (keywords[word]) {
    return {
      contents: keywords[word],
      range: {
        startLine: line,
        startColumn: column - (wordMatch?.[0]?.length ?? 0) + 1,
        endLine: line,
        endColumn: column + (afterMatch?.[0]?.length ?? 1),
      },
    };
  }

  // Check schema entity types
  if (schema) {
    for (const entity of schema.entityTypes) {
      const fqn = `${entity.namespace}::${entity.name}`;
      if (word.includes(entity.name) || word.includes(fqn)) {
        const attrs = entity.attributes
          .map((a) => `- \`${a.name}\`: ${a.type}${a.required ? " (required)" : ""}`)
          .join("\n");
        return {
          contents: `**${fqn}**\n\nAttributes:\n${attrs}`,
          range: {
            startLine: line,
            startColumn: column - (wordMatch?.[0]?.length ?? 0) + 1,
            endLine: line,
            endColumn: column + (afterMatch?.[0]?.length ?? 1),
          },
        };
      }
    }
  }

  return null;
}

// ── VS Code Provider Adapters ──

/**
 * Maps Cedar completion entries to VS Code CompletionItem objects.
 */
export class CedarCompletionProvider {
  private schemaCache: SchemaCache;

  constructor(schemaCache: SchemaCache) {
    this.schemaCache = schemaCache;
  }

  provideCompletionItems(
    document: { getText(): string; positionAt(offset: number): { line: number; character: number } },
    position: { line: number; character: number }
  ): unknown[] {
    const text = document.getText();
    const schema = this.schemaCache.getCachedSchema();
    const entries = getCompletions(text, position.line, position.character, schema);

    return entries.map((entry) => {
      const kindMap: Record<string, number> = {
        keyword: 14, // CompletionItemKind.Keyword
        entity: 7,   // CompletionItemKind.Class
        action: 2,   // CompletionItemKind.Method
        attribute: 5, // CompletionItemKind.Field
        snippet: 15, // CompletionItemKind.Snippet
      };

      return {
        label: entry.label,
        kind: kindMap[entry.kind] ?? 14,
        detail: entry.detail,
        insertText: entry.insertText ?? entry.label,
        documentation: entry.documentation,
      };
    });
  }
}

/**
 * Maps Cedar diagnostic entries to VS Code Diagnostic objects.
 */
export class CedarDiagnosticProvider {
  private collection: {
    set(uri: unknown, diagnostics: unknown[]): void;
    clear(): void;
  } | null = null;

  setCollection(collection: {
    set(uri: unknown, diagnostics: unknown[]): void;
    clear(): void;
  }): void {
    this.collection = collection;
  }

  updateDiagnostics(uri: unknown, text: string): unknown[] {
    const entries = getDiagnostics(text);

    const severityMap: Record<string, number> = {
      error: 0,   // DiagnosticSeverity.Error
      warning: 1, // DiagnosticSeverity.Warning
      info: 2,    // DiagnosticSeverity.Information
      hint: 3,    // DiagnosticSeverity.Hint
    };

    const diagnostics = entries.map((entry) => ({
      range: {
        start: { line: entry.range.startLine, character: entry.range.startColumn },
        end: { line: entry.range.endLine, character: entry.range.endColumn },
      },
      message: entry.message,
      severity: severityMap[entry.severity] ?? 0,
      source: "emmp-cedar",
    }));

    if (this.collection) {
      this.collection.set(uri, diagnostics);
    }

    return diagnostics;
  }
}

/**
 * Maps Cedar hover info to VS Code Hover objects.
 */
export class CedarHoverProvider {
  private schemaCache: SchemaCache;

  constructor(schemaCache: SchemaCache) {
    this.schemaCache = schemaCache;
  }

  provideHover(
    document: { getText(): string },
    position: { line: number; character: number }
  ): unknown | null {
    const text = document.getText();
    const schema = this.schemaCache.getCachedSchema();
    const info = getHoverInfo(text, position.line, position.character, schema);

    if (!info) return null;

    return {
      contents: { kind: "markdown", value: info.contents },
      range: info.range
        ? {
            start: { line: info.range.startLine, character: info.range.startColumn },
            end: { line: info.range.endLine, character: info.range.endColumn },
          }
        : undefined,
    };
  }
}
