import { z } from "zod";

export const factoryBriefSchema = z.object({
  idea: z.string().min(10, "Describe your idea in at least 10 characters"),
  budget: z.string().min(1),
  targetRevenue: z.string().min(1),
  country: z.string().min(1),
  targetCustomer: z.string().min(1),
  businessType: z.string().min(1),
  preferredTechnology: z.string().optional(),
  experienceLevel: z.string().optional(),
  availableTime: z.string().optional(),
  riskLevel: z.string().optional(),
});

export const businessPlanSchema = z.object({
  businessName: z.string(),
  businessModel: z.string(),
  targetCustomer: z.string(),
  problem: z.string(),
  solution: z.string(),
  revenueModel: z.string(),
  pricing: z.object({
    tiers: z.array(
      z.object({
        name: z.string(),
        priceMonthlyEur: z.number(),
        features: z.array(z.string()),
      })
    ),
  }),
  mvpScope: z.array(z.string()),
  growthStrategy: z.array(z.string()),
  risks: z.array(z.string()),
  labeledAssumptions: z.array(z.string()),
});

export const marketAnalysisSchema = z.object({
  targetMarket: z.string(),
  competitorCategories: z.array(z.string()),
  customerPainPoints: z.array(z.string()),
  pricingOpportunities: z.array(z.string()),
  differentiation: z.array(z.string()),
  marketRisks: z.array(z.string()),
  aiHypotheses: z.array(z.string()),
  verifiedResearch: z.array(z.string()),
  userProvided: z.array(z.string()),
});

export const brandSchema = z.object({
  brandName: z.string(),
  tagline: z.string(),
  brandDescription: z.string(),
  colorDirection: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
    background: z.string(),
  }),
  typography: z.object({
    display: z.string(),
    body: z.string(),
  }),
  logoConcept: z.string(),
  brandVoice: z.array(z.string()),
  domainSuggestions: z.array(z.string()),
  socialHandleSuggestions: z.array(z.string()),
  domainAvailabilityNote: z.string(),
  labeledAssumptions: z.array(z.string()),
});

export const productSpecSchema = z.object({
  mvpFeatures: z.array(z.string()),
  userRoles: z.array(z.string()),
  userJourneys: z.array(
    z.object({ name: z.string(), steps: z.array(z.string()) })
  ),
  pages: z.array(z.string()),
  dashboard: z.array(z.string()),
  onboarding: z.array(z.string()),
  pricingPages: z.array(z.string()),
  settings: z.array(z.string()),
  coreWorkflows: z.array(z.string()),
  databaseRequirements: z.array(z.string()),
  apiRequirements: z.array(z.string()),
  labeledAssumptions: z.array(z.string()),
});

export const architectureSchema = z.object({
  frontend: z.array(z.string()),
  backend: z.array(z.string()),
  database: z.array(z.string()),
  authentication: z.array(z.string()),
  apis: z.array(z.string()),
  thirdPartyIntegrations: z.array(z.string()),
  fileStorage: z.array(z.string()),
  payments: z.array(z.string()),
  email: z.array(z.string()),
  analytics: z.array(z.string()),
  security: z.array(z.string()),
  techStack: z.array(z.string()),
  labeledAssumptions: z.array(z.string()),
});

export const contentSchema = z.object({
  hero: z.object({ headline: z.string(), subheadline: z.string(), cta: z.string() }),
  features: z.array(z.object({ title: z.string(), body: z.string() })),
  benefits: z.array(z.string()),
  pricingCopy: z.string(),
  faq: z.array(z.object({ q: z.string(), a: z.string() })),
  about: z.string(),
  contact: z.string(),
  termsPlaceholder: z.string(),
  privacyPlaceholder: z.string(),
  seoMetadata: z.object({
    title: z.string(),
    description: z.string(),
  }),
  labeledAssumptions: z.array(z.string()),
});

export const seoSchema = z.object({
  pageTitles: z.array(z.object({ page: z.string(), title: z.string() })),
  metaDescriptions: z.array(z.object({ page: z.string(), description: z.string() })),
  openGraph: z.object({
    title: z.string(),
    description: z.string(),
    type: z.string(),
  }),
  structuredDataTypes: z.array(z.string()),
  sitemapPaths: z.array(z.string()),
  robotsTxt: z.string(),
  canonicalStrategy: z.string(),
  keywordStrategy: z.array(z.string()),
  labeledAssumptions: z.array(z.string()),
});

export const databaseSpecSchema = z.object({
  tables: z.array(
    z.object({
      name: z.string(),
      columns: z.array(z.string()),
      relationships: z.array(z.string()),
    })
  ),
  indexes: z.array(z.string()),
  rlsPolicies: z.array(z.string()),
  migrationSql: z.string(),
  seedNotes: z.string(),
  documentation: z.string(),
  applied: z.boolean(),
  labeledAssumptions: z.array(z.string()),
});

export const paymentSpecSchema = z.object({
  products: z.array(z.object({ name: z.string(), description: z.string() })),
  prices: z.array(
    z.object({ product: z.string(), amountEur: z.number(), interval: z.string() })
  ),
  checkoutArchitecture: z.array(z.string()),
  customerPortalArchitecture: z.array(z.string()),
  webhookHandlers: z.array(z.string()),
  subscriptionStates: z.array(z.string()),
  activated: z.boolean(),
  notes: z.array(z.string()),
  labeledAssumptions: z.array(z.string()),
});

export const codeArtifactSchema = z.object({
  files: z.array(
    z.object({
      path: z.string(),
      language: z.string(),
      content: z.string(),
      purpose: z.string(),
    })
  ),
  dependencies: z.array(z.string()),
  notes: z.array(z.string()),
  /** Never claims full production SaaS if only landing exists */
  completeness: z.enum([
    "landing_page_only",
    "starter_mvp_scaffold",
    "partial_application",
  ]),
  sandboxOnly: z.literal(true),
  labeledAssumptions: z.array(z.string()),
});

export const testReportSchema = z.object({
  passed: z.boolean(),
  checks: z.array(
    z.object({
      name: z.string(),
      status: z.enum(["pass", "fail", "skip"]),
      detail: z.string(),
    })
  ),
  attempts: z.number(),
  requiresHumanApproval: z.boolean(),
  labeledAssumptions: z.array(z.string()),
});

export const deploymentSchema = z.object({
  status: z.enum([
    "NOT_STARTED",
    "BUILDING",
    "TESTING",
    "READY",
    "DEPLOYING",
    "LIVE",
    "FAILED",
  ]),
  previewReady: z.boolean(),
  previewPath: z.string().nullable(),
  productionApproved: z.boolean(),
  productionLive: z.boolean(),
  vercelCompatible: z.boolean(),
  notes: z.array(z.string()),
  labeledAssumptions: z.array(z.string()),
});

export const growthPlanSchema = z.object({
  weeks: z.array(
    z.object({
      week: z.number(),
      title: z.string(),
      actions: z.array(z.string()),
    })
  ),
  labeledAssumptions: z.array(z.string()),
});

export const financeEstimateSchema = z.object({
  estimatedAiCostEur: z.number(),
  estimatedInfraMonthlyEur: z.number(),
  estimatedThirdPartyMonthlyEur: z.number(),
  businessValueEstimateEur: z.number().nullable(),
  valueEstimateNote: z.string(),
  labeledAssumptions: z.array(z.string()),
});

export type BusinessPlan = z.infer<typeof businessPlanSchema>;
export type MarketAnalysis = z.infer<typeof marketAnalysisSchema>;
export type BrandPlan = z.infer<typeof brandSchema>;
export type ProductSpec = z.infer<typeof productSpecSchema>;
export type ArchitectureSpec = z.infer<typeof architectureSchema>;
export type ContentPack = z.infer<typeof contentSchema>;
export type SeoPack = z.infer<typeof seoSchema>;
export type DatabaseSpec = z.infer<typeof databaseSpecSchema>;
export type PaymentSpec = z.infer<typeof paymentSpecSchema>;
export type CodeArtifact = z.infer<typeof codeArtifactSchema>;
export type TestReport = z.infer<typeof testReportSchema>;
export type DeploymentSpec = z.infer<typeof deploymentSchema>;
export type GrowthPlan = z.infer<typeof growthPlanSchema>;
export type FinanceEstimate = z.infer<typeof financeEstimateSchema>;
export type FactoryBriefInput = z.infer<typeof factoryBriefSchema>;
