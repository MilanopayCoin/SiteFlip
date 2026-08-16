import { createClient } from "@/lib/supabase/server";
import { memoryStore } from "@/lib/data/memory-store";
import { resolveRequestUser, jsonError, jsonOk } from "@/lib/api/request-user";

export async function GET(request: Request) {
  const user = await resolveRequestUser(request);
  if (!user) return jsonError("Authentication required", 401);

  if (user.mode === "supabase") {
    const supabase = await createClient();
    const { data, error } = await supabase!
      .from("transactions")
      .select("*")
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order("created_at", { ascending: false });
    if (error) return jsonError("Failed to load transactions", 500);
    return jsonOk({ transactions: data ?? [], mode: "supabase" });
  }

  memoryStore.ensureDemoUser(user.id, user.email);
  return jsonOk({
    transactions: memoryStore.listTransactions(user.id),
    mode: "demo",
  });
}
