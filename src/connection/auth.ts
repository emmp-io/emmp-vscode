/**
 * EmmpConnection manages the connection to an Emmp instance.
 *
 * Stores server URL, tenant ID, and API key, and validates
 * connectivity by calling the Cedar schema endpoint.
 */

export interface ConnectionConfig {
  serverUrl: string;
  tenantId: string;
  apiKey: string;
}

export class EmmpConnection {
  private serverUrl: string = "";
  private tenantId: string = "";
  private apiKey: string = "";
  private connected: boolean = false;

  /**
   * Connect to an Emmp instance. Validates by fetching the Cedar schema.
   */
  async connect(serverUrl: string, apiKey: string, tenantId?: string): Promise<void> {
    // Reset state before attempting connection (H5)
    this.connected = false;
    this.apiKey = "";
    this.serverUrl = "";

    // Validate URL scheme to prevent SSRF (C2)
    let parsed: URL;
    try {
      parsed = new URL(serverUrl);
    } catch {
      throw new Error("Invalid server URL");
    }
    if (parsed.protocol !== "https:" && !parsed.hostname.match(/^(localhost|127\.0\.0\.1)$/)) {
      throw new Error("Server URL must use HTTPS for non-local connections");
    }

    // TODO: Use VS Code SecretStorage for API key persistence (C1)
    console.warn("emmp-vscode: API key stored in memory — use VS Code SecretStorage for production");

    const normalizedUrl = serverUrl.replace(/\/+$/, "");
    const url = `${normalizedUrl}/api/v1/cedar/schema`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(tenantId ? { "X-Tenant-Id": tenantId } : {}),
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to connect to Emmp instance: ${response.status} ${response.statusText}`
      );
    }

    this.serverUrl = normalizedUrl;
    this.apiKey = apiKey;
    this.tenantId = tenantId ?? "";
    this.connected = true;
  }

  /**
   * Disconnect from the Emmp instance and clear stored credentials.
   */
  disconnect(): void {
    this.serverUrl = "";
    this.tenantId = "";
    this.apiKey = "";
    this.connected = false;
  }

  /**
   * Check whether a connection is currently active.
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Return the stored API key.
   *
   * In a full implementation this would use VS Code SecretStorage.
   */
  getApiKey(): string {
    return this.apiKey;
  }

  /**
   * Return the connected server URL.
   */
  getServerUrl(): string {
    return this.serverUrl;
  }

  /**
   * Return the connected tenant ID.
   */
  getTenantId(): string {
    return this.tenantId;
  }

  /**
   * Build headers for authenticated API requests.
   */
  buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
    if (this.tenantId) {
      headers["X-Tenant-Id"] = this.tenantId;
    }
    return headers;
  }
}
