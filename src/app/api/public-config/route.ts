import { NextResponse } from "next/server";
import {
  ensureCloudflareEnv,
  getSupabasePublicEnv,
} from "@/lib/supabase/env";

export const runtime = "nodejs";

/**
 * Public client config only (URL + anon key).
 * Safe to expose — never includes the service role key.
 */
export async function GET() {
  await ensureCloudflareEnv();
  const env = getSupabasePublicEnv();
  if (!env) {
    return NextResponse.json({
      configured: false,
      supabaseUrl: null,
      supabaseAnonKey: null,
    });
  }
  return NextResponse.json({
    configured: true,
    supabaseUrl: env.url,
    supabaseAnonKey: env.anonKey,
  });
}
