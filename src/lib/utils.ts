import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  amount: number | null | undefined,
  currency = "EUR",
  locale = "en-IE"
): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return n.toLocaleString();
}

export function formatPercent(n: number | null | undefined): string {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

export function scoreColor(score: number | null | undefined): string {
  if (score == null) return "text-zinc-400";
  if (score >= 85) return "text-emerald-400";
  if (score >= 70) return "text-sky-400";
  if (score >= 50) return "text-amber-400";
  return "text-rose-400";
}

export function lifecycleLabel(lifecycle: string): string {
  return lifecycle.replace(/_/g, " ");
}

export const VALUATION_DISCLAIMER =
  "AI valuation is informational only and is not financial, investment, legal or tax advice.";

export const CATEGORY_LABELS: Record<string, string> = {
  saas: "SaaS",
  ai_tools: "AI Tools",
  ecommerce: "Ecommerce",
  shopify: "Shopify",
  affiliate: "Affiliate",
  blog: "Blog",
  newsletter: "Newsletter",
  mobile_apps: "Mobile Apps",
  chrome_extensions: "Chrome Extensions",
  web_apps: "Web Apps",
  domains: "Domains",
  digital_products: "Digital Products",
  abandoned_saas: "Abandoned SaaS",
  failed_startup: "Failed Startup",
  dead_website: "Dead Website",
  unused_domain: "Unused Domain",
  old_app: "Old App",
  unmaintained_tool: "Unmaintained Tool",
  failed_ecommerce: "Failed Ecommerce",
  side_project: "Side Project",
  developer_project: "Developer Project",
};
