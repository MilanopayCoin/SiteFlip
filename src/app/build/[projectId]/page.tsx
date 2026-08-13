import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { loadFactoryProject } from "@/lib/factory/supabase-store";
import FactoryProjectClient from "./project-client";

export const dynamic = "force-dynamic";

export default async function FactoryProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  await ensureCloudflareEnv();
  const loaded = await loadFactoryProject(projectId, { preferDatabase: true });

  return <FactoryProjectClient initialProject={loaded.project} />;
}
