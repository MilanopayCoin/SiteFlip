import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMenuBySlug } from "@/lib/qr-menu/store";
import { publicMenuView } from "@/lib/qr-menu/types";
import { ensureCloudflareEnv } from "@/lib/supabase/env";
import {
  PublicMenuClient,
  type PublicMenuData,
} from "@/components/qr-menu/public-menu-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ masa?: string; table?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await ensureCloudflareEnv();
  const { slug } = await params;
  const menu = await getMenuBySlug(slug);
  if (!menu || !menu.published) {
    return { title: "Menü · JIY" };
  }
  return {
    title: `${menu.name} · Menü`,
    description: menu.tagline || `${menu.name} dijital menü`,
  };
}

export default async function PublicMenuPage({ params, searchParams }: Props) {
  await ensureCloudflareEnv();
  const { slug } = await params;
  const sp = await searchParams;
  const raw = await getMenuBySlug(slug);
  if (!raw || !raw.published) notFound();
  const menu = publicMenuView(raw) as PublicMenuData;
  const tableLabel = (sp.masa || sp.table || "").trim().slice(0, 40) || null;

  return <PublicMenuClient menu={menu} tableLabel={tableLabel} />;
}
