/**
 * Connect wizard command.
 *
 * Prompts the user for server URL, API key, and tenant ID,
 * then validates the connection.
 */

import type { EmmpConnection } from "../connection/auth";
import type { SchemaCache } from "../connection/schema";

/**
 * Prompt-based connect wizard.
 *
 * In a real VS Code environment, this uses vscode.window.showInputBox.
 * The function accepts optional injected prompter for testability.
 */
export async function runConnectWizard(
  connection: EmmpConnection,
  schemaCache: SchemaCache,
  prompter?: {
    showInputBox(options: { prompt: string; password?: boolean }): Promise<string | undefined>;
    showInformationMessage(message: string): void;
    showErrorMessage(message: string): void;
  }
): Promise<boolean> {
  const ui = prompter ?? getVSCodePrompter();

  const serverUrl = await ui.showInputBox({
    prompt: "Emmp instance URL (e.g. https://emmp.example.com)",
  });
  if (!serverUrl) return false;

  const apiKey = await ui.showInputBox({
    prompt: "API key",
    password: true,
  });
  if (!apiKey) return false;

  const tenantId = await ui.showInputBox({
    prompt: "Tenant ID (optional)",
  });

  try {
    await connection.connect(serverUrl, apiKey, tenantId ?? undefined);
    await schemaCache.fetchSchema(connection);
    ui.showInformationMessage(
      `Connected to Emmp instance at ${serverUrl}`
    );
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    ui.showErrorMessage(`Failed to connect: ${message}`);
    return false;
  }
}

/** Returns VS Code prompter when running in the extension host. */
function getVSCodePrompter(): {
  showInputBox(options: { prompt: string; password?: boolean }): Promise<string | undefined>;
  showInformationMessage(message: string): void;
  showErrorMessage(message: string): void;
} {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const vscodeApi = require("vscode") as {
      window: {
        showInputBox(options: { prompt: string; password?: boolean }): Thenable<string | undefined>;
        showInformationMessage(message: string): Thenable<string | undefined>;
        showErrorMessage(message: string): Thenable<string | undefined>;
      };
    };
    return {
      showInputBox: (options) =>
        Promise.resolve(vscodeApi.window.showInputBox(options)),
      showInformationMessage: (msg) => {
        void vscodeApi.window.showInformationMessage(msg);
      },
      showErrorMessage: (msg) => {
        void vscodeApi.window.showErrorMessage(msg);
      },
    };
  } catch {
    // Fallback for environments without VS Code
    return {
      showInputBox: async () => undefined,
      showInformationMessage: () => {},
      showErrorMessage: () => {},
    };
  }
}
