/**
 * RuntimeIsolationProvider — verify isolation before production deploy.
 * Current capability: DEVELOPMENT ISOLATION only.
 * Production deployment MUST be blocked until real isolation is verified.
 */

import type { IsolationCheckResult } from "./types";
import { scanGeneratedContent } from "../sandbox";
import type { CodeArtifact } from "../schemas";

export interface RuntimeIsolationProvider {
  checkIsolation(input: {
    projectId: string;
    code: CodeArtifact | null;
  }): IsolationCheckResult;
}

/**
 * DevelopmentIsolationProvider — safest available isolation today.
 * Does NOT claim production-grade sandboxing.
 */
export class DevelopmentIsolationProvider implements RuntimeIsolationProvider {
  checkIsolation(input: {
    projectId: string;
    code: CodeArtifact | null;
  }): IsolationCheckResult {
    const checks: IsolationCheckResult["checks"] = [];

    // Filesystem: generated artifacts are in-memory factory outputs only
    checks.push({
      name: "filesystem_isolation",
      status: "pass",
      detail:
        "Generated files stored as factory outputs — not written into JIY.APP core source",
    });

    // Environment: only public runtime config allowed
    checks.push({
      name: "environment_isolation",
      status: "pass",
      detail:
        "BusinessRuntimeConfig allows only PUBLIC_* fields — production secrets excluded",
    });

    // Secret isolation: scan generated code
    let secretLeak = false;
    if (input.code) {
      for (const f of input.code.files) {
        const scan = scanGeneratedContent(f.content);
        if (!scan.safe) secretLeak = true;
        if (
          /GROQ_API_KEY|MOLLIE_API_KEY|SUPABASE_SERVICE_ROLE|SUPABASE_DB_URL|CLOUDFLARE_API_TOKEN/i.test(
            f.content
          )
        ) {
          secretLeak = true;
        }
      }
    }
    checks.push({
      name: "secret_isolation",
      status: secretLeak ? "fail" : "pass",
      detail: secretLeak
        ? "Generated code may reference forbidden secrets"
        : "No production secret references detected in scan",
    });

    // Database: adapter only, not connected to production
    checks.push({
      name: "database_isolation",
      status: "pass",
      detail:
        "DatabaseProvider uses DEMO / LOCAL adapter — not connected to JIY.APP production tables",
    });

    // Resource limits — NOT guaranteed in current Worker co-hosting model
    checks.push({
      name: "resource_limits",
      status: "unknown",
      detail:
        "True per-business resource limits not available without separate Worker isolation",
    });

    // Network restrictions — NOT guaranteed
    checks.push({
      name: "network_restrictions",
      status: "unknown",
      detail:
        "Generated apps cannot claim dedicated network sandbox in DEVELOPMENT ISOLATION mode",
    });

    // Timeouts — process-level only
    checks.push({
      name: "build_timeout",
      status: "pass",
      detail: "Build/deploy steps use timeout handling in DeploymentProvider",
    });

    checks.push({
      name: "execution_timeout",
      status: "unknown",
      detail:
        "Dedicated execution timeouts for isolated Workers not provisioned yet",
    });

    // Production-grade isolation is NOT available
    const blockProduction = true; // Always block until true isolation exists

    return {
      passed: !secretLeak && checks.every((c) => c.status !== "fail"),
      checks,
      blockProduction,
      message: blockProduction
        ? "PRODUCTION ISOLATION REQUIRED — current mode is SANDBOX: DEVELOPMENT ISOLATION. Production deployment of generated apps is blocked until separate Worker identities and resource isolation are provisioned."
        : "Isolation checks passed",
    };
  }
}

export function getRuntimeIsolationProvider(): RuntimeIsolationProvider {
  return new DevelopmentIsolationProvider();
}
