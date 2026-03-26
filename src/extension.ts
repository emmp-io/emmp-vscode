/**
 * Emmp Cedar VS Code Extension entry point.
 *
 * Registers language providers and commands for Cedar policy editing.
 */

import type * as vscode from "vscode";
import { EmmpConnection } from "./connection/auth";
import { SchemaCache } from "./connection/schema";
import {
  CedarCompletionProvider,
  CedarDiagnosticProvider,
  CedarHoverProvider,
} from "./providers/vscode_adapter";
import { simulatePolicy } from "./commands/simulate";
import { runConnectWizard } from "./commands/connect";
import { runTemplateInsertion } from "./commands/template";

let connection: EmmpConnection | undefined;
let schemaCache: SchemaCache | undefined;
let diagnosticProvider: CedarDiagnosticProvider | undefined;

export function activate(context: { subscriptions: { dispose(): void }[] } & {
  registerCommand?: (id: string, handler: (...args: unknown[]) => unknown) => { dispose(): void };
}): void {
  connection = new EmmpConnection();
  schemaCache = new SchemaCache();

  const completionProvider = new CedarCompletionProvider(schemaCache);
  const hoverProvider = new CedarHoverProvider(schemaCache);
  diagnosticProvider = new CedarDiagnosticProvider();

  // Guard against missing vscode API (e.g. in unit tests)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const vscodeApi = require("vscode") as typeof vscode;

    const cedarSelector = { language: "cedar", scheme: "file" };

    context.subscriptions.push(
      vscodeApi.languages.registerCompletionItemProvider(
        cedarSelector,
        completionProvider,
        ".",
        ":"
      )
    );

    context.subscriptions.push(
      vscodeApi.languages.registerHoverProvider(cedarSelector, hoverProvider)
    );

    const diagnosticCollection =
      vscodeApi.languages.createDiagnosticCollection("emmp-cedar");
    context.subscriptions.push(diagnosticCollection);
    diagnosticProvider.setCollection(diagnosticCollection);

    context.subscriptions.push(
      vscodeApi.commands.registerCommand("emmp.connect", async () => {
        if (!connection) return;
        await runConnectWizard(connection, schemaCache!);
      })
    );

    context.subscriptions.push(
      vscodeApi.commands.registerCommand("emmp.simulate", async () => {
        if (!connection || !connection.isConnected()) {
          vscodeApi.window.showErrorMessage(
            "Emmp: Not connected. Run 'Emmp: Connect to Instance' first."
          );
          return;
        }
        const editor = vscodeApi.window.activeTextEditor;
        if (!editor) {
          vscodeApi.window.showErrorMessage("Emmp: No active editor.");
          return;
        }
        const policyText = editor.document.getText();
        const principal = await vscodeApi.window.showInputBox({
          prompt: "Principal (e.g. mcp::User::\"alice\")",
        });
        const action = await vscodeApi.window.showInputBox({
          prompt: "Action (e.g. mcp::Action::\"call_tool\")",
        });
        const resource = await vscodeApi.window.showInputBox({
          prompt: "Resource (e.g. mcp::Tool::\"read_file\")",
        });
        if (!principal || !action || !resource) return;

        try {
          const result = await simulatePolicy(
            connection,
            policyText,
            principal,
            action,
            resource,
            {}
          );
          vscodeApi.window.showInformationMessage(
            `Emmp Simulation: ${result.decision} (${result.matchedPolicies.length} policies matched)`
          );
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          vscodeApi.window.showErrorMessage(
            `Emmp Simulation failed: ${message}`
          );
        }
      })
    );

    context.subscriptions.push(
      vscodeApi.commands.registerCommand("emmp.insertTemplate", async () => {
        await runTemplateInsertion();
      })
    );
  } catch {
    // VS Code API not available (running in test environment)
  }
}

export function deactivate(): void {
  if (connection) {
    connection.disconnect();
    connection = undefined;
  }
  schemaCache = undefined;
  diagnosticProvider = undefined;
}
