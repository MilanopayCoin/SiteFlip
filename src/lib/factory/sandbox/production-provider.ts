/**
 * ProductionSandboxProvider — placeholder for a real isolation runtime.
 *
 * HONEST STATUS: NOT AVAILABLE.
 * isProductionGrade remains false until a real isolation mechanism is provisioned
 * (separate Workers / containers / Hyperdrive + enforced resource+network jail).
 *
 * Do NOT select this adapter for live generated-app production until
 * RuntimeIsolationProvider.isProductionSafe() can return true with evidence.
 */

import type {
  SandboxProvider,
  SandboxRecord,
  SandboxStatusSnapshot,
  SandboxLifecycleStatus,
} from "./types";

export class ProductionSandboxProvider implements SandboxProvider {
  readonly vendor = "external" as const;
  readonly label = "PRODUCTION SANDBOX — NOT PROVISIONED";
  readonly isProductionGrade = false;

  private fail(method: string): never {
    throw new Error(
      `${method}: ProductionSandboxProvider is NOT PROVISIONED. ` +
        "PRODUCTION ISOLATION REQUIRED — use DevelopmentIsolationSandboxAdapter for preview only."
    );
  }

  async createSandbox(): Promise<SandboxRecord> {
    this.fail("createSandbox");
  }

  async getSandbox(): Promise<SandboxRecord | null> {
    return null;
  }

  async startSandbox(): Promise<SandboxRecord> {
    this.fail("startSandbox");
  }

  async stopSandbox(): Promise<SandboxRecord> {
    this.fail("stopSandbox");
  }

  async destroySandbox(): Promise<SandboxRecord> {
    this.fail("destroySandbox");
  }

  async getStatus(): Promise<SandboxStatusSnapshot | null> {
    return null;
  }

  async getLogs(): Promise<string[]> {
    return [
      "PRODUCTION SANDBOX — NOT PROVISIONED",
      "Network isolation: NOT AVAILABLE",
      "Process isolation: NOT AVAILABLE",
      "Resource limits: NOT ENFORCED",
    ];
  }

  async getPreviewUrl(): Promise<string | null> {
    return null;
  }

  async markPhase(
    _sandboxId: string,
    _phase: SandboxLifecycleStatus
  ): Promise<SandboxRecord> {
    this.fail("markPhase");
  }
}

/** Explicitly unavailable — never auto-selected */
export function tryGetProductionSandboxProvider(): SandboxProvider | null {
  return null;
}
