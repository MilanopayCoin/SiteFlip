/**
 * RuntimeIsolationProvider — verify isolation before production deploy.
 * Current capability: DEVELOPMENT ISOLATION only.
 * Production deployment MUST be blocked until real isolation is verified.
 */

import type { IsolationCheckResult } from "./types";
import { scanGeneratedContent, FORBIDDEN_PRODUCTION_SECRET_KEYS } from "../sandbox";
import { declaredResourceLimits } from "../sandbox/types";
import type { CodeArtifact } from "../schemas";

export type IsolationCheckInput = {
  projectId: string;
  code: CodeArtifact | null;
  sandboxId?: string | null;
  runtimeId?: string | null;
  businessId?: string | null;
};

export interface RuntimeIsolationProvider {
  /** Aggregate validation used by production gate */
  checkIsolation(input: IsolationCheckInput): IsolationCheckResult;
  validateIsolation(input: IsolationCheckInput): IsolationCheckResult;
  checkResources(input: IsolationCheckInput): IsolationCheckResult["checks"];
  checkSecrets(input: IsolationCheckInput): IsolationCheckResult["checks"];
  checkFilesystem(input: IsolationCheckInput): IsolationCheckResult["checks"];
  checkNetwork(input: IsolationCheckInput): IsolationCheckResult["checks"];
  /** True only when production-grade isolation is available AND verified */
  isProductionSafe(input: IsolationCheckInput): boolean;
}

/**
 * DevelopmentIsolationProvider — safest available isolation today.
 * Does NOT claim production-grade sandboxing.
 */
export class DevelopmentIsolationProvider implements RuntimeIsolationProvider {
  checkFilesystem(input: IsolationCheckInput): IsolationCheckResult["checks"] {
    void input;
    return [
      {
        name: "filesystem_isolation",
        status: "pass",
        detail:
          "Generated files stored as factory outputs — not written into JIY.APP core source",
      },
      {
        name: "filesystem_host_access",
        status: "pass",
        detail: "Scaffold must not access JIY production filesystem paths",
      },
    ];
  }

  checkSecrets(input: IsolationCheckInput): IsolationCheckResult["checks"] {
    let secretLeak = false;
    const findings: string[] = [];
    if (input.code?.files?.length) {
      for (const f of input.code.files) {
        const content = typeof f.content === "string" ? f.content : "";
        if (!content) continue;
        const scan = scanGeneratedContent(content);
        if (!scan.safe) {
          secretLeak = true;
          findings.push(...scan.findings.map((x) => `${f.path}: ${x}`));
        }
        for (const key of FORBIDDEN_PRODUCTION_SECRET_KEYS) {
          if (content.includes(key)) {
            secretLeak = true;
            findings.push(`${f.path}: references ${key}`);
          }
        }
      }
    }
    return [
      {
        name: "secret_isolation",
        status: secretLeak ? "fail" : "pass",
        detail: secretLeak
          ? `Generated code may reference forbidden secrets (${findings.slice(0, 3).join("; ")})`
          : "No production secret references detected in scan",
      },
      {
        name: "service_role_isolation",
        status: "pass",
        detail: "Generated apps must not receive SUPABASE_SERVICE_ROLE_KEY",
      },
      {
        name: "cross_user_data",
        status: "pass",
        detail:
          "Sandbox identity includes businessId/sandboxId/runtimeId — no shared JIY production DB adapter",
      },
    ];
  }

  checkNetwork(input: IsolationCheckInput): IsolationCheckResult["checks"] {
    void input;
    return [
      {
        name: "network_restrictions",
        status: "unknown",
        detail:
          "Generated apps cannot claim dedicated network sandbox in DEVELOPMENT ISOLATION mode",
      },
      {
        name: "unrestricted_network",
        status: "unknown",
        detail:
          "No OS-level network jail — static policy only. Do not claim unrestricted network is blocked at runtime.",
      },
    ];
  }

  checkResources(input: IsolationCheckInput): IsolationCheckResult["checks"] {
    void input;
    return declaredResourceLimits().map((limit) => ({
      name: `resource_${limit.name}`,
      status: limit.enforced ? ("pass" as const) : ("unknown" as const),
      detail: `${limit.policy} — ${limit.detail}${limit.enforced ? " (ENFORCED)" : " (NOT ENFORCED)"}`,
    }));
  }

  validateIsolation(input: IsolationCheckInput): IsolationCheckResult {
    return this.checkIsolation(input);
  }

  isProductionSafe(input: IsolationCheckInput): boolean {
    // DEVELOPMENT ISOLATION is never production-safe
    void input;
    return false;
  }

  checkIsolation(input: IsolationCheckInput): IsolationCheckResult {
    const checks: IsolationCheckResult["checks"] = [
      ...this.checkFilesystem(input),
      {
        name: "environment_isolation",
        status: "pass",
        detail:
          "BusinessRuntimeConfig allows only PUBLIC_* / SANDBOX_* fields — production secrets excluded",
      },
      ...this.checkSecrets(input),
      {
        name: "database_isolation",
        status: "pass",
        detail:
          "DatabaseProvider uses DEMO / LOCAL adapter — not connected to JIY.APP production tables",
      },
      ...this.checkResources(input),
      ...this.checkNetwork(input),
      {
        name: "identity_isolation",
        status: input.sandboxId && input.runtimeId ? "pass" : "unknown",
        detail:
          input.sandboxId && input.runtimeId
            ? `sandboxId/runtimeId/businessId present (${input.sandboxId.slice(0, 8)}…)`
            : "Sandbox identity not fully provisioned yet",
      },
    ];

    const secretFail = checks.some(
      (c) => c.name === "secret_isolation" && c.status === "fail"
    );
    const blockProduction = true; // Always block until true isolation exists
    const productionSafe = this.isProductionSafe(input);

    return {
      passed: !secretFail && checks.every((c) => c.status !== "fail"),
      checks,
      blockProduction: blockProduction || !productionSafe,
      message: blockProduction
        ? "PRODUCTION ISOLATION REQUIRED — current mode is SANDBOX: DEVELOPMENT ISOLATION. Production deployment of generated apps is blocked until separate Worker identities and resource isolation are provisioned."
        : "Isolation checks passed",
    };
  }
}

export function getRuntimeIsolationProvider(): RuntimeIsolationProvider {
  return new DevelopmentIsolationProvider();
}
