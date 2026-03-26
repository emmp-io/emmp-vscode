/**
 * Cedar policy simulation command.
 *
 * Calls POST /api/cedar/simulate on the connected Emmp instance
 * and returns the authorization decision.
 */

import type { EmmpConnection } from "../connection/auth";

/** Result of a Cedar policy simulation. */
export interface SimulationResult {
  decision: "PERMIT" | "DENY";
  matchedPolicies: string[];
  diagnostics: string[];
}

/** Request body for the simulate endpoint. */
export interface SimulateRequest {
  policy_text: string;
  principal: string;
  action: string;
  resource: string;
  context: Record<string, unknown>;
}

/**
 * Simulate a Cedar policy against the connected Emmp instance.
 *
 * @param connection - Active Emmp connection
 * @param policyText - Cedar policy source text
 * @param principal - Principal entity reference
 * @param action - Action entity reference
 * @param resource - Resource entity reference
 * @param context - Additional context attributes
 * @returns SimulationResult with the authorization decision
 */
export async function simulatePolicy(
  connection: EmmpConnection,
  policyText: string,
  principal: string,
  action: string,
  resource: string,
  context: Record<string, unknown>
): Promise<SimulationResult> {
  if (!connection.isConnected()) {
    throw new Error("Not connected to an Emmp instance");
  }

  const url = `${connection.getServerUrl()}/api/cedar/simulate`;
  const body: SimulateRequest = {
    policy_text: policyText,
    principal,
    action,
    resource,
    context,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: connection.buildHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(
      `Simulation failed: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as SimulationResult;
  return {
    decision: data.decision,
    matchedPolicies: data.matchedPolicies ?? [],
    diagnostics: data.diagnostics ?? [],
  };
}
