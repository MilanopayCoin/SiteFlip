import { z } from "zod";

export const sellListingSchema = z.object({
  websiteUrl: z.string().url().or(z.literal("")),
  businessType: z.string().min(1),
  name: z.string().min(2).max(100),
  revenue: z.coerce.number().min(0),
  profit: z.coerce.number(),
  traffic: z.coerce.number().min(0),
  expenses: z.coerce.number().min(0),
  technology: z.string().optional(),
  domain: z.string().optional(),
  growth: z.coerce.number(),
  reasonForSelling: z.string().min(10),
  askingPrice: z.coerce.number().min(0),
  description: z.string().optional(),
});

export const offerSchema = z.object({
  listingId: z.string().min(1),
  amount: z.coerce.number().positive(),
  message: z.string().max(2000).optional(),
  currency: z.string().default("EUR"),
});

export const buildWizardSchema = z.object({
  goal: z.string().min(5),
  budget: z.string().min(1),
  businessType: z.string().min(1),
  targetAudience: z.string().min(1),
  country: z.string().min(1),
  revenueGoal: z.string().min(1),
  availableTime: z.string().min(1),
  experience: z.string().optional(),
  riskLevel: z.string().optional(),
});

export const matchSchema = z.object({
  budget: z.coerce.number().positive(),
  desiredMonthlyProfit: z.coerce.number().min(0),
  businessType: z.string().optional(),
  risk: z.enum(["low", "medium", "high"]).optional(),
  workload: z.enum(["low", "medium", "high"]).optional(),
  growth: z.enum(["stable", "growing", "aggressive"]).optional(),
  minRevenue: z.coerce.number().optional(),
});

export const messageSchema = z.object({
  conversationId: z.string().min(1),
  body: z.string().min(1).max(5000),
});

export const domainVerifySchema = z.object({
  businessId: z.string().min(1),
  domain: z.string().min(3),
  token: z.string().min(10),
});

export type SellListingInput = z.infer<typeof sellListingSchema>;
export type OfferInput = z.infer<typeof offerSchema>;
export type BuildWizardInput = z.infer<typeof buildWizardSchema>;
export type MatchInput = z.infer<typeof matchSchema>;
