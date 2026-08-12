import {
  testReportSchema,
  type CodeArtifact,
  type TestReport,
} from "../schemas";
import { scanGeneratedContent } from "../sandbox";

const MVP_PAGES = [
  "landing",
  "register",
  "login",
  "dashboard",
  "customers",
  "services",
  "bookings",
  "calendar",
  "settings",
];

/**
 * TestingAgent V3 — validates mini-SaaS scaffold.
 * Tests auth, API validation, core workflow pages, permissions stubs, error handling.
 */
export async function runTestingAgentV3(code: CodeArtifact | null): Promise<{
  data: TestReport;
  source: "heuristic";
  assumptions: string[];
}> {
  const checks: TestReport["checks"] = [];

  if (!code) {
    checks.push({
      name: "code_artifacts_present",
      status: "fail",
      detail: "No DeveloperAgent output found",
    });
  } else {
    checks.push({
      name: "code_artifacts_present",
      status: "pass",
      detail: `${code.files.length} file(s) in sandbox workspace`,
    });

    checks.push({
      name: "starter_mvp_completeness",
      status:
        code.completeness === "starter_mvp_scaffold" ? "pass" : "fail",
      detail: `completeness=${code.completeness}`,
    });

    checks.push({
      name: "sandbox_only_flag",
      status: code.sandboxOnly ? "pass" : "fail",
      detail: code.sandboxOnly ? "sandboxOnly=true" : "Missing sandbox flag",
    });

    // Auth architecture
    const hasAuth = code.files.some((f) => f.path.includes("lib/auth"));
    checks.push({
      name: "authentication_architecture",
      status: hasAuth ? "pass" : "fail",
      detail: hasAuth ? "auth.ts present" : "Missing auth module",
    });

    // API validation
    const hasApi = code.files.some((f) => f.path.includes("/api/"));
    const hasValidation = code.files.some((f) =>
      f.path.includes("validation")
    );
    checks.push({
      name: "api_validation",
      status: hasApi && hasValidation ? "pass" : "fail",
      detail:
        hasApi && hasValidation
          ? "API routes + validation module"
          : "Missing API or validation",
    });

    // Core workflow pages
    const paths = code.files.map((f) => f.path.toLowerCase());
    const missingPages = MVP_PAGES.filter((p) => {
      if (p === "landing") {
        return !paths.some(
          (path) =>
            path.endsWith("/app/page.tsx") ||
            path.includes("/landing/") ||
            path.includes("landing/page")
        );
      }
      return !paths.some(
        (path) => path.includes(`/${p}/`) || path.includes(`${p}/page`)
      );
    });
    checks.push({
      name: "core_workflow_pages",
      status: missingPages.length === 0 ? "pass" : "fail",
      detail:
        missingPages.length === 0
          ? "All MVP pages present"
          : `Missing: ${missingPages.join(", ")}`,
    });

    // Error handling in API routes
    const apiFiles = code.files.filter((f) => f.path.includes("/api/"));
    const hasErrorHandling = apiFiles.every((f) =>
      /catch|throw new Error|status:\s*400/i.test(f.content)
    );
    checks.push({
      name: "error_handling",
      status: apiFiles.length > 0 && hasErrorHandling ? "pass" : "fail",
      detail:
        apiFiles.length === 0
          ? "No API routes"
          : hasErrorHandling
            ? "API routes include error responses"
            : "Some API routes lack error handling",
    });

    // Permissions stub
    const hasPermissions = code.files.some((f) =>
      /session|getSession|auth/i.test(f.content)
    );
    checks.push({
      name: "permissions_stub",
      status: hasPermissions ? "pass" : "fail",
      detail: hasPermissions
        ? "Session/auth checks referenced"
        : "No permission stubs",
    });

    // Security scan
    let unsafe = 0;
    for (const f of code.files) {
      const scan = scanGeneratedContent(f.content);
      if (!scan.safe) unsafe += 1;
    }
    checks.push({
      name: "security_scan_inline",
      status: unsafe === 0 ? "pass" : "fail",
      detail:
        unsafe === 0
          ? "No forbidden patterns in artifacts"
          : `${unsafe} file(s) failed inline scan`,
    });

    // DB adapter
    const hasDbAdapter = code.files.some((f) =>
      f.path.includes("db-adapter")
    );
    checks.push({
      name: "database_adapter",
      status: hasDbAdapter ? "pass" : "fail",
      detail: hasDbAdapter
        ? "DB adapter architecture present"
        : "Missing db-adapter",
    });
  }

  checks.push({
    name: "payments_not_activated",
    status: "pass",
    detail: "Mollie not connected — payment activation requires approval",
  });

  const failed = checks.some((c) => c.status === "fail");
  const data = testReportSchema.parse({
    passed: !failed,
    checks,
    attempts: 1,
    requiresHumanApproval: failed,
    labeledAssumptions: [
      "Tests validate generated artifacts — not live E2E browser tests",
      "Demo auth is not production security testing",
    ],
  });

  return {
    data,
    source: "heuristic",
    assumptions: data.labeledAssumptions,
  };
}
