import OpenAI from "openai";
import type { BusinessBlueprint } from "@/types/database";
import { VALUATION_DISCLAIMER } from "@/lib/utils";

export function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export interface BuildWizardInput {
  goal: string;
  budget: string;
  businessType: string;
  targetAudience: string;
  country: string;
  revenueGoal: string;
  availableTime: string;
  experience?: string;
  riskLevel?: string;
}

export async function generateBusinessBlueprint(
  input: BuildWizardInput
): Promise<{ blueprint: BusinessBlueprint; assumptions: string[]; source: "openai" | "heuristic" }> {
  const openai = getOpenAI();

  if (openai) {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are SITEFLIP AI Business Builder. Generate realistic digital business blueprints as JSON. Clearly separate facts from assumptions. Never claim a full production SaaS was built — only blueprints and starter assets.",
        },
        {
          role: "user",
          content: JSON.stringify(input),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    return {
      blueprint: normalizeBlueprint(parsed),
      assumptions: parsed.assumptions ?? [
        "Market demand is assumed based on stated goals",
        "Revenue projections are estimates, not guarantees",
      ],
      source: "openai",
    };
  }

  return { blueprint: heuristicBlueprint(input), assumptions: heuristicAssumptions(input), source: "heuristic" };
}

function normalizeBlueprint(parsed: Record<string, unknown>): BusinessBlueprint {
  const landing = (parsed.landingPage as BusinessBlueprint["landingPage"]) ?? {
    hero: "Build something people pay for",
    sections: ["Problem", "Solution", "Pricing", "FAQ"],
    cta: "Get started",
  };
  return {
    name: String(parsed.name ?? "Untitled Venture"),
    businessModel: String(parsed.businessModel ?? "SaaS subscription"),
    targetAudience: String(parsed.targetAudience ?? "SMBs"),
    problem: String(parsed.problem ?? "Unsolved workflow pain"),
    solution: String(parsed.solution ?? "Focused digital product"),
    pricing: String(parsed.pricing ?? "€29/mo"),
    revenueProjection: String(parsed.revenueProjection ?? "Estimate only"),
    landingPage: landing,
    marketingPlan: Array.isArray(parsed.marketingPlan)
      ? parsed.marketingPlan.map(String)
      : ["SEO", "Content", "Communities"],
    technologyStack: Array.isArray(parsed.technologyStack)
      ? parsed.technologyStack.map(String)
      : ["Next.js", "Supabase", "Stripe"],
    growthStrategy: Array.isArray(parsed.growthStrategy)
      ? parsed.growthStrategy.map(String)
      : ["Launch", "Iterate", "Expand channels"],
    domainIdeas: Array.isArray(parsed.domainIdeas)
      ? parsed.domainIdeas.map(String)
      : [],
    seoStrategy: Array.isArray(parsed.seoStrategy)
      ? parsed.seoStrategy.map(String)
      : ["Keyword research", "Landing pages", "Backlinks"],
  };
}

function heuristicBlueprint(input: BuildWizardInput): BusinessBlueprint {
  const type = input.businessType || "SaaS";
  const nameBase = input.goal.split(" ").slice(0, 3).join(" ") || "Nova";
  const name = `${nameBase.replace(/[^a-zA-Z0-9 ]/g, "").trim() || "Siteflip"} ${type}`.slice(0, 40);

  return {
    name,
    businessModel: `${type} — subscription or productized service`,
    targetAudience: input.targetAudience || "Online operators",
    problem: `People in ${input.targetAudience || "this market"} lack a simple way to reach ${input.revenueGoal || "revenue goals"}.`,
    solution: `A focused ${type.toLowerCase()} product that solves one painful workflow end-to-end.`,
    pricing: "€19–€79/mo depending on tier",
    revenueProjection: `Toward ${input.revenueGoal || "€2,000/month"} assuming product-market fit (estimate only).`,
    landingPage: {
      hero: `Build. Ship. Earn — ${name}`,
      sections: ["Problem", "Solution", "How it works", "Pricing", "FAQ"],
      cta: "Join the waitlist",
    },
    marketingPlan: [
      "Launch on Indie Hackers / Product Hunt",
      "SEO content around core problem keywords",
      "Community outreach in target niches",
      "Email waitlist nurture",
    ],
    technologyStack: ["Next.js", "TypeScript", "Supabase", "Stripe", "Vercel"],
    growthStrategy: [
      "Validate with 20 interviews",
      "Ship MVP landing + waitlist",
      "Convert early users to paid",
      "Double down on winning channel",
    ],
    domainIdeas: [
      `${name.toLowerCase().replace(/\s+/g, "")}.com`,
      `${name.toLowerCase().replace(/\s+/g, "")}.io`,
      `get${name.toLowerCase().replace(/\s+/g, "")}.com`,
    ],
    seoStrategy: [
      "Map 20 commercial-intent keywords",
      "Publish comparison + how-to pages",
      "Build internal linking from blog to product",
    ],
  };
}

function heuristicAssumptions(input: BuildWizardInput): string[] {
  return [
    `Budget constraint (${input.budget}) assumed feasible for MVP scope`,
    `Country focus (${input.country}) assumed for go-to-market`,
    `Available time (${input.availableTime}) assumed sustainable`,
    "Revenue goal is aspirational — not a guarantee",
    "No production application is generated in this step — blueprint + starter assets only",
  ];
}

export interface ValuationInput {
  category: string;
  monthlyRevenue: number;
  monthlyProfit: number;
  monthlyTraffic: number;
  growthRate: number;
  ageYears?: number;
}

export function computeValuation(input: ValuationInput) {
  const revenue = Math.max(0, input.monthlyRevenue);
  const profit = Math.max(0, input.monthlyProfit);
  const growth = input.growthRate ?? 0;

  // Category heuristic multiples — ranges, NOT named comps
  const categoryMultiples: Record<string, { rev: number; profit: number }> = {
    saas: { rev: 5.5, profit: 8 },
    ai_tools: { rev: 6, profit: 9 },
    ecommerce: { rev: 3, profit: 4.5 },
    shopify: { rev: 3.2, profit: 4.8 },
    affiliate: { rev: 2.8, profit: 3.5 },
    newsletter: { rev: 3.5, profit: 5 },
    blog: { rev: 2.5, profit: 3.2 },
    chrome_extensions: { rev: 4, profit: 6 },
    web_apps: { rev: 4.5, profit: 7 },
    digital_products: { rev: 3, profit: 4 },
    mobile_apps: { rev: 4, profit: 6 },
    domains: { rev: 0, profit: 0 },
  };

  const mult = categoryMultiples[input.category] ?? { rev: 3.5, profit: 5 };
  const annualRevenue = revenue * 12;
  const annualProfit = profit * 12;

  let base =
    annualProfit > 0
      ? annualProfit * mult.profit
      : annualRevenue > 0
        ? annualRevenue * mult.rev
        : Math.max(500, (input.monthlyTraffic || 0) * 0.05);

  // Growth / risk adjustments
  const growthAdj = 1 + Math.min(Math.max(growth, -30), 40) / 100;
  base = base * growthAdj;

  const riskScore = Math.min(
    90,
    Math.max(
      10,
      50 -
        growth * 0.5 +
        (revenue === 0 ? 20 : 0) +
        (profit < revenue * 0.2 ? 10 : 0)
    )
  );
  const growthScore = Math.min(100, Math.max(0, 50 + growth * 2));
  const confidence = revenue > 0 && profit > 0 ? 70 : revenue > 0 ? 55 : 35;

  const estimated = Math.round(base);
  const minimum = Math.round(base * 0.75);
  const maximum = Math.round(base * 1.3);

  const healthScore = Math.round(
    Math.min(
      100,
      (revenue > 0 ? 25 : 5) +
        (profit > 0 ? 25 : 5) +
        growthScore * 0.25 +
        (100 - riskScore) * 0.25
    )
  );

  const aiScore = Math.round(
    Math.min(
      100,
      healthScore * 0.6 + growthScore * 0.25 + (100 - riskScore) * 0.15
    )
  );

  return {
    estimated_value: estimated,
    minimum_value: minimum,
    maximum_value: maximum,
    confidence,
    revenue_multiple: mult.rev,
    profit_multiple: mult.profit,
    growth_score: Math.round(growthScore),
    risk_score: Math.round(riskScore),
    health_score: healthScore,
    ai_score: aiScore,
    category_benchmarks: {
      category: input.category,
      note: "Category multiples are generalized heuristics. No named comparable businesses are fabricated.",
      typical_revenue_multiple: mult.rev,
      typical_profit_multiple: mult.profit,
    },
    methodology:
      "Deterministic blend of category revenue/profit multiples, growth adjustment, and risk heuristics.",
    disclaimer: VALUATION_DISCLAIMER,
  };
}

export interface MatchCriteria {
  budget: number;
  desiredMonthlyProfit: number;
  businessType?: string;
  risk?: "low" | "medium" | "high";
  workload?: "low" | "medium" | "high";
  growth?: "stable" | "growing" | "aggressive";
  minRevenue?: number;
}

export function matchBusinesses(
  criteria: MatchCriteria,
  listings: import("@/types/database").Listing[]
) {
  // Deterministic filters first
  const filtered = listings.filter((l) => {
    if (l.status !== "ACTIVE") return false;
    if (l.listing_type === "REVIVE") return false;
    const price = l.price ?? Infinity;
    if (price > criteria.budget) return false;
    if (
      criteria.minRevenue != null &&
      (l.business?.monthly_revenue ?? 0) < criteria.minRevenue
    )
      return false;
    if (
      criteria.businessType &&
      criteria.businessType !== "any" &&
      l.business?.category !== criteria.businessType
    )
      return false;
    if (criteria.risk === "low" && (l.business?.risk_score ?? 100) > 35)
      return false;
    if (criteria.risk === "medium" && (l.business?.risk_score ?? 100) > 55)
      return false;
    return true;
  });

  // Ranking second
  const ranked = filtered.map((l) => {
    const reasons: string[] = [];
    let score = 50;
    const b = l.business!;
    const price = l.price ?? 0;

    if (price <= criteria.budget) {
      score += 15;
      reasons.push("Within budget");
    }
    if ((b.monthly_profit ?? 0) >= criteria.desiredMonthlyProfit) {
      score += 20;
      reasons.push("Revenue/profit target met");
    } else if ((b.monthly_profit ?? 0) >= criteria.desiredMonthlyProfit * 0.7) {
      score += 10;
      reasons.push("Near profit target");
    }
    if ((b.risk_score ?? 50) <= 30) {
      score += 10;
      reasons.push("Lower risk profile");
    }
    if ((b.growth_rate ?? 0) > 5) {
      score += 10;
      reasons.push("Growing traffic/revenue");
    }
    if ((b.monthly_expenses ?? 0) < (b.monthly_revenue ?? 1) * 0.4) {
      score += 5;
      reasons.push("Low relative workload/ops cost");
    }
    if ((l.verifications?.length ?? 0) > 0) {
      score += 5;
      reasons.push("Has verification badges");
    }

    return {
      listing_id: l.id,
      listing: l,
      match_percent: Math.min(99, Math.round(score)),
      reasons,
    };
  });

  return ranked.sort((a, b) => b.match_percent - a.match_percent);
}

export async function generateRevivalPlan(business: {
  name: string;
  category: string;
  original_story: string | null;
  current_condition: string | null;
  monthly_traffic: number | null;
  technology_stack: string[];
  domain_age_years: number | null;
}) {
  const openai = getOpenAI();
  const verified = {
    domain_age_years: business.domain_age_years,
    monthly_traffic: business.monthly_traffic,
    tech: business.technology_stack,
  };
  const sellerClaims = {
    original_story: business.original_story,
    current_condition: business.current_condition,
  };

  if (openai) {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You create SITEFLIP revival plans. Never invent historical facts. Distinguish verified_data, seller_claims, and ai_assumptions clearly. Return JSON.",
        },
        {
          role: "user",
          content: JSON.stringify({ business, verified, sellerClaims }),
        },
      ],
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    return {
      revival_score: Number(parsed.revival_score ?? 65),
      why_failed: String(parsed.why_failed ?? "Insufficient verified history."),
      what_should_change: String(parsed.what_should_change ?? "Reposition and relaunch."),
      new_target_customer: String(parsed.new_target_customer ?? "TBD"),
      new_positioning: String(parsed.new_positioning ?? "TBD"),
      new_pricing: String(parsed.new_pricing ?? "TBD"),
      new_brand_idea: String(parsed.new_brand_idea ?? "TBD"),
      seo_opportunity: String(parsed.seo_opportunity ?? "Validate with data."),
      marketing_strategy: String(parsed.marketing_strategy ?? "Community + SEO"),
      plan_30_day: parsed.plan_30_day ?? [],
      plan_90_day: parsed.plan_90_day ?? [],
      verified_data: verified,
      seller_claims: sellerClaims,
      ai_assumptions: parsed.ai_assumptions ?? [
        "Market opportunity assumed from category norms",
      ],
      source: "openai" as const,
    };
  }

  const traffic = business.monthly_traffic ?? 0;
  const score = Math.min(
    92,
    40 +
      (traffic > 0 ? 15 : 0) +
      (business.technology_stack.length > 0 ? 10 : 0) +
      (business.domain_age_years && business.domain_age_years > 2 ? 10 : 0) +
      (business.original_story ? 8 : 0)
  );

  return {
    revival_score: score,
    why_failed:
      business.original_story
        ? `Based on seller claims: ${business.original_story.slice(0, 200)}`
        : "Why it failed is not verified. Only seller-provided narrative (if any) and current asset state are available.",
    what_should_change:
      "Clarify ICP, refresh brand/positioning, ship a credible landing page, and validate demand before heavy rebuild.",
    new_target_customer: `Operators interested in ${business.category.replace(/_/g, " ")} solutions`,
    new_positioning: `A revived ${business.name} focused on one painful workflow`,
    new_pricing: "Start with a simple paid plan; validate willingness to pay",
    new_brand_idea: `${business.name} Reloaded — sharper niche, clearer promise`,
    seo_opportunity:
      traffic > 0
        ? `Verified residual traffic: ${traffic}/mo. Opportunity depends on index quality (assumption: recoverable with content refresh).`
        : "No meaningful verified traffic. SEO opportunity is an assumption pending keyword research.",
    marketing_strategy:
      "Rebuild narrative, soft-launch to niche communities, content SEO, waitlist conversion.",
    plan_30_day: [
      "Asset & security audit",
      "Separate verified data vs seller claims",
      "New positioning + landing page",
      "Analytics instrumentation",
      "Waitlist / early access",
    ],
    plan_90_day: [
      "MVP reactivation",
      "First 25 users interviewed",
      "SEO content cadence",
      "Monetization experiment",
      "Decide: grow, flip, or archive",
    ],
    verified_data: verified,
    seller_claims: sellerClaims,
    ai_assumptions: [
      "Category still has demand (unverified)",
      "Existing tech stack is reusable (assumption)",
      "Seller narrative may be incomplete or biased",
    ],
    source: "heuristic" as const,
  };
}

export async function commandCenterReply(
  prompt: string,
  context: Record<string, unknown>
): Promise<{ reply: string; assumptions: string[]; source: "openai" | "heuristic" | string }> {
  try {
    const { aiJson } = await import("@/lib/ai/providers");
    const { z } = await import("zod");
    const schema = z.object({
      reply: z.string(),
      assumptions: z.array(z.string()).default([]),
    });
    const result = await aiJson(
      "You are the SITEFLIP AI Command Center. Use only provided platform data as stored facts. Label assumptions clearly. Never invent revenue, traffic, or verifications. Never present estimates as financial advice. Return JSON {reply, assumptions}.",
      { prompt, context },
      schema,
      () => ({
        reply: `Stored context: ${JSON.stringify(context.owned_businesses ?? []).slice(0, 400)}… Regarding “${prompt}”: use stored metrics; label assumptions. ${VALUATION_DISCLAIMER}`,
        assumptions: ["Heuristic fallback — no AI provider configured"],
      })
    );
    return {
      reply: result.data.reply,
      assumptions: result.data.assumptions,
      source: result.provider,
    };
  } catch {
    // fall through to openai/heuristic below
  }

  const openai = getOpenAI();
  if (openai) {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are the SITEFLIP AI Command Center. Use only provided platform data as verified. Label assumptions clearly. Never invent revenue, traffic, or verifications. Never present estimates as financial advice.",
        },
        {
          role: "user",
          content: JSON.stringify({ prompt, context }),
        },
      ],
    });
    return {
      reply: completion.choices[0]?.message?.content ?? "No response.",
      assumptions: ["Model may generalize beyond verified fields"],
      source: "openai",
    };
  }

  const owned = Array.isArray(context.owned_businesses)
    ? context.owned_businesses
    : [];
  return {
    reply: `Stored context (${owned.length} businesses): ${JSON.stringify(owned).slice(0, 500)}…\n\nRegarding “${prompt}”: use stored metrics first, treat seller claims separately, and treat AI projections as assumptions only. ${VALUATION_DISCLAIMER}`,
    assumptions: [
      "No live AI provider configured — heuristic response",
      "Context may include demo/seller-claimed figures",
    ],
    source: "heuristic",
  };
}

/** Phase 13 alias — structured revival analysis */
export async function analyzeRevivalProject(input: {
  name: string;
  category: string;
  original_story: string | null;
  current_condition: string | null;
  monthly_traffic: number | null;
  technology_stack: string[];
  domain_age_years: number | null;
}) {
  const plan = await generateRevivalPlan(input);
  return {
    revivalScore: plan.revival_score,
    strengths: [
      input.technology_stack.length
        ? `Stack present: ${input.technology_stack.join(", ")}`
        : "Asset exists to evaluate",
    ],
    weaknesses: [
      input.original_story
        ? "Failure narrative is a seller claim — not independently verified"
        : "Limited historical evidence",
    ],
    opportunities: [plan.seo_opportunity, plan.new_positioning],
    risks: plan.ai_assumptions,
    newPositioning: plan.new_positioning,
    newTargetCustomer: plan.new_target_customer,
    pricingIdea: plan.new_pricing,
    marketingPlan: plan.marketing_strategy,
    thirtyDayPlan: plan.plan_30_day,
    ninetyDayPlan: plan.plan_90_day,
    verified_data: plan.verified_data,
    seller_claims: plan.seller_claims,
    ai_assumptions: plan.ai_assumptions,
  };
}
