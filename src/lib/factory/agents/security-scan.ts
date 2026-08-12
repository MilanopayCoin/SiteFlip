import {
  securityScanSchema,
  type CodeArtifact,
  type SecurityScan,
} from "../schemas";
import { FORBIDDEN_PATTERNS, scanGeneratedContent } from "../sandbox";

/**
 * SecurityAgent V3 — scans generated code for unsafe patterns.
 * Failures set REQUIRES_APPROVAL — never auto-deploy.
 */
export function runSecurityScanAgent(code: CodeArtifact | null): {
  data: SecurityScan;
  source: "heuristic";
  assumptions: string[];
} {
  const findings: SecurityScan["findings"] = [];

  if (!code) {
    findings.push({
      severity: "critical",
      category: "missing_artifacts",
      detail: "No generated code to scan",
    });
  } else {
    for (const file of code.files) {
      const scan = scanGeneratedContent(file.content);
      if (!scan.safe) {
        for (const f of scan.findings) {
          findings.push({
            severity: "high",
            category: "forbidden_pattern",
            detail: f,
            file: file.path,
          });
        }
      }

      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(file.content)) {
          const already = findings.some(
            (x) => x.file === file.path && x.detail.includes(pattern.source)
          );
          if (!already) {
            findings.push({
              severity: "high",
              category: "security_rule",
              detail: `Matched: ${pattern.source}`,
              file: file.path,
            });
          }
        }
      }
    }

    const hasSecretRef = code.files.some((f) =>
      /process\.env\.(MOLLIE|GROQ|SUPABASE_SERVICE|OPENAI|CLOUDFLARE)/i.test(
        f.content
      )
    );
    if (hasSecretRef) {
      findings.push({
        severity: "critical",
        category: "credential_leakage",
        detail: "Generated code references production secret env vars",
      });
    }
  }

  const critical = findings.filter((f) => f.severity === "critical").length;
  const high = findings.filter((f) => f.severity === "high").length;
  const passed = critical === 0 && high === 0;

  const data = securityScanSchema.parse({
    passed,
    findings,
    requiresApproval: !passed,
    scannedFiles: code?.files.length ?? 0,
    labeledAssumptions: [
      "Static pattern scan — not a substitute for professional security audit",
      "Generated starter code may still contain logic bugs",
    ],
  });

  return {
    data,
    source: "heuristic",
    assumptions: data.labeledAssumptions,
  };
}
