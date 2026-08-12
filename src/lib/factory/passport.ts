import type { BusinessPassport, FactoryProject } from "./types";
import { getOutputByAgent } from "./store";
import type { ArchitectureSpec, BusinessPlan } from "./schemas";

export function buildBusinessPassport(project: FactoryProject): BusinessPassport {
  const plan = getOutputByAgent(project, "BusinessAgent")?.data as
    | BusinessPlan
    | undefined;
  const arch = getOutputByAgent(project, "ArchitectureAgent")?.data as
    | ArchitectureSpec
    | undefined;

  const lifecycle =
    project.state === "LIVE"
      ? "GROWING"
      : project.state === "READY" || project.state === "APPROVAL_REQUIRED"
        ? "READY"
        : "BUILDING";

  const timeline = [
    { at: project.createdAt, label: "Factory project created" },
    ...project.activityLog
      .filter((a) => a.level === "success")
      .slice(0, 8)
      .reverse()
      .map((a) => ({ at: a.at, label: `${a.agent}: ${a.message}` })),
  ];
  if (project.liveAt) {
    timeline.push({ at: project.liveAt, label: "Marked LIVE (sandbox)" });
  }

  return {
    businessId: project.id,
    businessName: plan?.businessName || project.name,
    createdAt: project.createdAt,
    businessModel: plan?.businessModel || project.brief.businessType,
    targetCustomer: plan?.targetCustomer || project.brief.targetCustomer,
    technology: arch?.techStack?.length
      ? arch.techStack
      : project.brief.preferredTechnology?.split(/,\s*/) || [],
    revenueModel: plan?.revenueModel || "Not specified",
    aiScore: project.quality?.overall ?? null,
    factoryStatus: project.state,
    lifecycle,
    owner: project.ownerId,
    timeline,
    persistenceMode: project.persistenceMode,
    persistenceNote:
      project.persistenceMode === "SUPABASE"
        ? "Persisted to Supabase factory tables"
        : "LOCAL / DEMO / NOT PERSISTED — in-memory factory store only. Data may be lost on redeploy.",
  };
}
