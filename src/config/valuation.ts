/**
 * Editable valuation defaults — estimates only, not financial advice.
 * TODO: Review multiples with your finance advisor before production marketing.
 */

export type ValuationCategory =
  | "saas"
  | "content"
  | "ecommerce"
  | "app"
  | "newsletter"
  | "other";

export const VALUATION_CATEGORY_LABELS: Record<ValuationCategory, string> = {
  saas: "SaaS",
  content: "Content / media",
  ecommerce: "E-commerce",
  app: "App / tool",
  newsletter: "Newsletter",
  other: "Other",
};

/** Annual revenue multiples (low / high). */
export const VALUATION_MULTIPLES: Record<
  ValuationCategory,
  { low: number; high: number }
> = {
  saas: { low: 2.5, high: 5 },
  content: { low: 1.5, high: 3 },
  ecommerce: { low: 2, high: 3.5 },
  app: { low: 2, high: 4 },
  newsletter: { low: 2, high: 4.5 },
  other: { low: 1.5, high: 3 },
};

/** Per year of operating history above 1y — small uplift cap. */
export const VALUATION_AGE_BONUS_PER_YEAR = 0.04;
export const VALUATION_AGE_BONUS_MAX = 0.2;

/** Optional users signal — very rough bump when MAU provided. */
export const VALUATION_USERS_BONUS_THRESHOLDS = [
  { minUsers: 10_000, bonus: 0.08 },
  { minUsers: 1_000, bonus: 0.04 },
] as const;

export function estimateBusinessValue(input: {
  category: ValuationCategory;
  monthlyRevenue: number;
  ageYears: number;
  monthlyUsers?: number;
}): { low: number; high: number; annualRevenue: number } {
  const annualRevenue = Math.max(0, input.monthlyRevenue) * 12;
  const mult =
    VALUATION_MULTIPLES[input.category] ?? VALUATION_MULTIPLES.other;

  let ageBonus = 0;
  if (input.ageYears > 1) {
    ageBonus = Math.min(
      VALUATION_AGE_BONUS_MAX,
      (input.ageYears - 1) * VALUATION_AGE_BONUS_PER_YEAR
    );
  }

  let usersBonus = 0;
  if (input.monthlyUsers != null && input.monthlyUsers > 0) {
    for (const tier of VALUATION_USERS_BONUS_THRESHOLDS) {
      if (input.monthlyUsers >= tier.minUsers) {
        usersBonus = tier.bonus;
        break;
      }
    }
  }

  const factor = 1 + ageBonus + usersBonus;
  const low = Math.round(annualRevenue * mult.low * factor);
  const high = Math.round(annualRevenue * mult.high * factor);

  return {
    low: Math.max(0, low),
    high: Math.max(low, high),
    annualRevenue,
  };
}
