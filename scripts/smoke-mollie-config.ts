/**
 * Smoke-check Mollie config via the public GET handler (no payment created).
 *
 * Usage:
 *   npm run dev   # in another terminal
 *   npx tsx scripts/smoke-mollie-config.ts
 *
 * Or against production:
 *   SMOKE_BASE_URL=https://jiy.app npx tsx scripts/smoke-mollie-config.ts
 */

const base =
  process.env.SMOKE_BASE_URL?.replace(/\/$/, "") || "http://localhost:3000";

async function main() {
  const res = await fetch(`${base}/api/payments/mollie/create`);
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    console.error("HTTP", res.status, data);
    process.exit(1);
  }
  console.log(JSON.stringify(data, null, 2));
  if (data.liveBlocked) {
    console.log(
      "\nNote: live key blocked — set test_ MOLLIE_API_KEY or MOLLIE_ALLOW_LIVE=true"
    );
  }
  if (data.paymentsEnabled === false) {
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
