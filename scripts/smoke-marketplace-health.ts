/**
 * Probe marketplace + Supabase health (no auth required).
 *
 *   npx tsx scripts/smoke-marketplace-health.ts
 *   SMOKE_BASE_URL=https://jiy.app npx tsx scripts/smoke-marketplace-health.ts
 */

const base =
  process.env.SMOKE_BASE_URL?.replace(/\/$/, "") || "http://localhost:3000";

async function main() {
  const res = await fetch(`${base}/api/health/supabase`, {
    cache: "no-store",
  });
  const data = (await res.json()) as Record<string, unknown>;
  console.log(JSON.stringify(data, null, 2));

  if (!res.ok) {
    process.exit(1);
  }

  if (data.marketplaceCoreReady === false) {
    console.error(
      "\nmarketplaceCoreReady=false — apply migration 006 (npm run db:migrate)"
    );
    process.exit(2);
  }

  if (data.productionPersistence === false) {
    console.log("\nNote: productionPersistence false (demo or schema not fully applied).");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
