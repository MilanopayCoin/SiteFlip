import { redirect } from "next/navigation";

/** Legacy factory preview URL — generated app lives at /preview/:projectId */
export default async function LegacyFactoryPreviewRedirect({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(`/preview/${projectId}`);
}
