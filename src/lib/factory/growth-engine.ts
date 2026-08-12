/**
 * AnalyticsAgent / SEOAgent / GrowthAgent architecture stubs for V4.
 * Future flow: ANALYZE → RECOMMEND → USER APPROVAL → CHANGE → TEST → DEPLOY
 * Do NOT automatically change production in V4.
 */

export type GrowthEnginePhase =
  | "ANALYZE"
  | "RECOMMEND"
  | "USER_APPROVAL"
  | "CHANGE"
  | "TEST"
  | "DEPLOY";

export interface GrowthMetricsSnapshot {
  traffic: number | null;
  conversions: number | null;
  revenue: number | null;
  seo: number | null;
  performance: number | null;
  customerGrowth: number | null;
  retention: number | null;
  label: "DATA NOT AVAILABLE" | "VERIFIED";
}

export function getGrowthMetrics(projectId: string): GrowthMetricsSnapshot {
  void projectId;
  // Analytics not wired — never fabricate
  return {
    traffic: null,
    conversions: null,
    revenue: null,
    seo: null,
    performance: null,
    customerGrowth: null,
    retention: null,
    label: "DATA NOT AVAILABLE",
  };
}

export interface GrowthRecommendation {
  agent: "AnalyticsAgent" | "SEOAgent" | "GrowthAgent";
  title: string;
  actions: string[];
  requiresApproval: true;
  autoApply: false;
}

export function prepareGrowthRecommendations(projectId: string): {
  metrics: GrowthMetricsSnapshot;
  recommendations: GrowthRecommendation[];
  note: string;
} {
  return {
    metrics: getGrowthMetrics(projectId),
    recommendations: [
      {
        agent: "SEOAgent",
        title: "SEO plan (draft)",
        actions: [
          "Add page titles and meta descriptions for core routes",
          "Submit sitemap after production domain is connected",
        ],
        requiresApproval: true,
        autoApply: false,
      },
      {
        agent: "GrowthAgent",
        title: "Customer acquisition ideas",
        actions: [
          "Target local cleaning directories in NL with landing CTA",
          "Offer free trial booking for first 10 companies",
        ],
        requiresApproval: true,
        autoApply: false,
      },
      {
        agent: "AnalyticsAgent",
        title: "Analytics setup",
        actions: [
          "Connect analytics after LIVE production isolation is available",
          "Track signup → booking conversion",
        ],
        requiresApproval: true,
        autoApply: false,
      },
    ],
    note: "BUILD → GROW architecture prepared. No automatic production changes in V4. Analytics show DATA NOT AVAILABLE until connected.",
  };
}
