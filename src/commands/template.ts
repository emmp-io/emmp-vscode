/**
 * Template insertion command.
 *
 * Shows a category picker followed by a template picker,
 * then inserts the selected policy template snippet at the cursor.
 */

/** Template definition for the insertion picker. */
export interface PolicyTemplate {
  id: string;
  displayName: string;
  description: string;
  category: string;
  body: string;
}

/** All available policy templates grouped by category. */
export const POLICY_TEMPLATES: PolicyTemplate[] = [
  // data-protection
  {
    id: "restrict-by-data-class",
    displayName: "Restrict by Data Classification",
    description: "Forbid access to resources above a given data classification level.",
    category: "data-protection",
    body: `forbid(
  principal is \${1:EmmpUser},
  action,
  resource
) when {
  resource.data_classification != "\${2:confidential}"
  && resource.data_classification_level > context.allowed_level
};`,
  },
  {
    id: "encrypt-at-rest",
    displayName: "Require Encryption at Rest",
    description: "Forbid storage actions on resources that lack encryption-at-rest.",
    category: "data-protection",
    body: `forbid(
  principal,
  action in [Action::"\${1:mcp:tools/store}", Action::"\${2:mcp:tools/write}"],
  resource
) when {
  !resource.encrypted_at_rest
};`,
  },
  {
    id: "pii-redaction",
    displayName: "PII Redaction Required",
    description: "Forbid read actions on PII-tagged resources without redaction context.",
    category: "data-protection",
    body: `forbid(
  principal,
  action in [Action::"mcp:tools/call", Action::"mcp:resources/read"],
  resource
) when {
  resource.contains_pii
  && resource.pii_type in ["\${1:ssn}", "\${2:email}"]
  && !context.redaction_enabled
};`,
  },
  // access-control
  {
    id: "business-hours-only",
    displayName: "Business Hours Only",
    description: "Restrict actions to business hours (UTC).",
    category: "access-control",
    body: `forbid(
  principal,
  action,
  resource
) when {
  context.hour_utc < \${1:8} || context.hour_utc >= \${2:18}
};`,
  },
  {
    id: "geo-fence",
    displayName: "Geographic Fence",
    description: "Restrict access to allowed geographic regions.",
    category: "access-control",
    body: `forbid(
  principal,
  action,
  resource
) when {
  !(context.source_region in ["\${1:US}", "\${2:CA}"])
};`,
  },
  {
    id: "ip-allowlist",
    displayName: "IP Allowlist",
    description: "Restrict access to a set of allowed IP CIDR ranges.",
    category: "access-control",
    body: `forbid(
  principal,
  action,
  resource
) when {
  !(context.source_ip in ["\${1:10.0.0.0/8}", "\${2:192.168.1.0/24}"])
};`,
  },
  // delegation
  {
    id: "tool-scope-limit",
    displayName: "Tool Scope Limit",
    description: "Restrict delegation to a named set of tools only.",
    category: "delegation",
    body: `forbid(
  principal,
  action in [Action::"mcp:tools/call"],
  resource
) unless {
  resource in [MCPTool::"\${1:tool://read_file}", MCPTool::"\${2:tool://list_dir}"]
};`,
  },
  {
    id: "max-token-budget",
    displayName: "Max Token Budget",
    description: "Forbid actions that would exceed the token budget.",
    category: "delegation",
    body: `forbid(
  principal,
  action,
  resource
) when {
  context.token_count > \${1:10000}
};`,
  },
  {
    id: "session-duration-limit",
    displayName: "Session Duration Limit",
    description: "Forbid actions after a session exceeds a time limit.",
    category: "delegation",
    body: `forbid(
  principal,
  action,
  resource
) when {
  context.session_duration_minutes > \${1:60}
};`,
  },
  // compliance
  {
    id: "require-approval-tier",
    displayName: "Require Approval Tier",
    description: "Enforce a minimum approval tier for sensitive actions.",
    category: "compliance",
    body: `forbid(
  principal,
  action in [Action::"\${1:mcp:admin/delete}"],
  resource
) when {
  context.approval_tier != "\${2:DUAL_APPROVAL}"
};`,
  },
  {
    id: "audit-trail-required",
    displayName: "Audit Trail Required",
    description: "Forbid actions when audit logging is disabled.",
    category: "compliance",
    body: `forbid(
  principal,
  action,
  resource
) when {
  !context.audit_enabled
};`,
  },
  {
    id: "retention-policy",
    displayName: "Data Retention Policy",
    description: "Forbid access to resources past their retention period.",
    category: "compliance",
    body: `forbid(
  principal,
  action in [Action::"mcp:resources/read", Action::"mcp:resources/subscribe"],
  resource
) when {
  resource.age_days > \${1:365}
};`,
  },
  // operational
  {
    id: "rate-limit",
    displayName: "Rate Limit",
    description: "Forbid actions when rate limit is exceeded.",
    category: "operational",
    body: `forbid(
  principal,
  action,
  resource
) when {
  context.requests_per_minute > \${1:100}
};`,
  },
  {
    id: "read-only-mode",
    displayName: "Read-Only Mode",
    description: "Permit only read actions, forbid all writes.",
    category: "operational",
    body: `forbid(
  principal,
  action in [Action::"mcp:tools/store", Action::"mcp:tools/write", Action::"mcp:admin/delete"],
  resource
);`,
  },
  {
    id: "maintenance-window",
    displayName: "Maintenance Window",
    description: "Forbid non-admin actions during a maintenance window.",
    category: "operational",
    body: `forbid(
  principal,
  action,
  resource
) when {
  context.maintenance_mode
  && !principal.roles.contains("\${1:platform_admin}")
};`,
  },
];

/**
 * Get unique template categories.
 */
export function getCategories(): string[] {
  const seen = new Set<string>();
  for (const t of POLICY_TEMPLATES) {
    seen.add(t.category);
  }
  return Array.from(seen).sort();
}

/**
 * Get templates filtered by category.
 */
export function getTemplatesByCategory(category: string): PolicyTemplate[] {
  return POLICY_TEMPLATES.filter((t) => t.category === category);
}

/**
 * Run the template insertion flow.
 *
 * Shows a category picker, then a template picker, then inserts the snippet.
 */
export async function runTemplateInsertion(
  picker?: {
    showQuickPick(items: { label: string; description?: string }[]): Promise<{ label: string } | undefined>;
    insertSnippet(body: string): Promise<void>;
  }
): Promise<boolean> {
  const ui = picker ?? getVSCodePicker();

  const categories = getCategories();
  const categoryItems = categories.map((c) => ({
    label: c,
    description: `${getTemplatesByCategory(c).length} templates`,
  }));

  const selectedCategory = await ui.showQuickPick(categoryItems);
  if (!selectedCategory) return false;

  const templates = getTemplatesByCategory(selectedCategory.label);
  const templateItems = templates.map((t) => ({
    label: t.displayName,
    description: t.description,
    id: t.id,
  }));

  const selectedTemplate = await ui.showQuickPick(templateItems);
  if (!selectedTemplate) return false;

  const template = templates.find((t) => t.displayName === selectedTemplate.label);
  if (!template) return false;

  await ui.insertSnippet(template.body);
  return true;
}

function getVSCodePicker(): {
  showQuickPick(items: { label: string; description?: string }[]): Promise<{ label: string } | undefined>;
  insertSnippet(body: string): Promise<void>;
} {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const vscodeApi = require("vscode") as {
      window: {
        showQuickPick(items: { label: string; description?: string }[]): Thenable<{ label: string } | undefined>;
        activeTextEditor?: {
          insertSnippet(snippet: unknown): Thenable<boolean>;
        };
      };
      SnippetString: new (value: string) => unknown;
    };
    return {
      showQuickPick: (items) => Promise.resolve(vscodeApi.window.showQuickPick(items)),
      insertSnippet: async (body) => {
        const editor = vscodeApi.window.activeTextEditor;
        if (editor) {
          await editor.insertSnippet(new vscodeApi.SnippetString(body));
        }
      },
    };
  } catch {
    return {
      showQuickPick: async () => undefined,
      insertSnippet: async () => {},
    };
  }
}
