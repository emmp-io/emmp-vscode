/**
 * SchemaCache fetches and caches the Cedar schema from an Emmp instance.
 *
 * Schema types mirror the @emmp/cedar-language package types.
 */

import type { EmmpConnection } from "./auth";

/** Attribute on a Cedar entity type. */
export interface CedarAttribute {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

/** A Cedar entity type definition. */
export interface CedarEntityType {
  name: string;
  namespace: string;
  memberOf?: string[];
  attributes: CedarAttribute[];
}

/** Describes principal/resource types for an action. */
export interface CedarActionAppliesTo {
  principalTypes: string[];
  resourceTypes: string[];
}

/** A Cedar action definition. */
export interface CedarAction {
  name: string;
  namespace: string;
  appliesTo: CedarActionAppliesTo;
  description?: string;
}

/** A context attribute available in Cedar policies. */
export interface CedarContextAttribute {
  name: string;
  type: string;
  path: string;
  description?: string;
}

/** Full Cedar schema as returned by GET /api/cedar/schema. */
export interface CedarSchema {
  entityTypes: CedarEntityType[];
  actions: CedarAction[];
  contextAttributes: CedarContextAttribute[];
}

export class SchemaCache {
  private cachedSchema: CedarSchema | null = null;

  /**
   * Fetch the Cedar schema from the connected Emmp instance and cache it.
   */
  async fetchSchema(connection: EmmpConnection): Promise<CedarSchema> {
    const url = `${connection.getServerUrl()}/api/v1/cedar/schema`;

    const response = await fetch(url, {
      method: "GET",
      headers: connection.buildHeaders(),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch Cedar schema: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as unknown;
    if (!data || typeof data !== "object" || !("entityTypes" in data) || !("actions" in data)) {
      throw new Error("Invalid Cedar schema response — missing expected fields");
    }
    const schema = data as CedarSchema;
    this.cachedSchema = schema;
    return schema;
  }

  /**
   * Return the cached schema, or null if not yet fetched.
   */
  getCachedSchema(): CedarSchema | null {
    return this.cachedSchema;
  }

  /**
   * Clear the cached schema.
   */
  clearCache(): void {
    this.cachedSchema = null;
  }
}
