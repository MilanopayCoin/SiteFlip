import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export async function POST() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
  }
  return NextResponse.json({
    ok: true,
    message: "Signed out. Clear local demo session on the client.",
  });
}
