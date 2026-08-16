import { redirect } from "next/navigation";

type Props = { params: Promise<{ projectId: string }> };

/**
 * Legacy preview route — redirects to the durable generated-app runtime.
 * PREVIEW and GENERATED APP LIVE share /generated/:projectId.
 */
export default async function PreviewRedirectPage({ params }: Props) {
  const { projectId } = await params;
  redirect(`/generated/${projectId}`);
}
