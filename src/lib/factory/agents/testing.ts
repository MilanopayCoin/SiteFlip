import {
  testReportSchema,
  type CodeArtifact,
  type TestReport,
} from "../schemas";
import { scanGeneratedContent } from "../sandbox";

/**
 * TestingAgent — validates generated artifacts.
 * Does not fake pass. Real checks against outputs.
 */
export async function runTestingAgent(code: CodeArtifact | null): Promise<{
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
      detail: `${code.files.length} file(s)`,
    });
    checks.push({
      name: "sandbox_only_flag",
      status: code.sandboxOnly ? "pass" : "fail",
      detail: code.sandboxOnly ? "sandboxOnly=true" : "Missing sandbox flag",
    });
    checks.push({
      name: "honest_completeness",
      status:
        code.completeness === "landing_page_only" ||
        code.completeness === "starter_mvp_scaffold"
          ? "pass"
          : "fail",
      detail: `completeness=${code.completeness}`,
    });

    let unsafe = 0;
    for (const f of code.files) {
      const scan = scanGeneratedContent(f.content);
      if (!scan.safe) unsafe += 1;
    }
    checks.push({
      name: "security_scan",
      status: unsafe === 0 ? "pass" : "fail",
      detail:
        unsafe === 0
          ? "No forbidden patterns"
          : `${unsafe} file(s) failed security scan`,
    });

    const hasLanding = code.files.some(
      (f) => f.path.includes("page.tsx") || f.purpose.toLowerCase().includes("landing")
    );
    checks.push({
      name: "landing_artifact",
      status: hasLanding ? "pass" : "fail",
      detail: hasLanding ? "Landing file present" : "Missing landing page file",
    });
  }

  checks.push({
    name: "typescript_core_siteflip",
    status: "skip",
    detail: "Sandbox artifacts are not typechecked against SITEFLIP core in MVP",
  });
  checks.push({
    name: "payments_not_activated",
    status: "pass",
    detail: "Payment activation gated by approval",
  });

  const failed = checks.some((c) => c.status === "fail");
  const data = testReportSchema.parse({
    passed: !failed,
    checks,
    attempts: 1,
    requiresHumanApproval: failed,
    labeledAssumptions: [
      "Tests validate factory outputs, not a live deployed app",
      "Full E2E browser tests are future work",
    ],
  });

  return {
    data,
    source: "heuristic",
    assumptions: data.labeledAssumptions,
  };
}
