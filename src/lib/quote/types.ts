import { z } from "zod";

export const QUOTE_PDF_PRICE_EUR = 1;
export const QUOTE_PDF_PURPOSE = "QUOTE_PDF" as const;

export const quoteLineItemSchema = z.object({
  description: z.string().trim().min(1).max(200),
  quantity: z.coerce.number().positive().max(9999),
  unitPrice: z.coerce.number().min(0).max(1_000_000),
});

export const quoteDraftInputSchema = z.object({
  id: z.string().min(8).max(40).optional(),
  issuerName: z.string().trim().min(1).max(120),
  issuerEmail: z.string().trim().email().max(160),
  issuerCompany: z.string().trim().max(160).optional().or(z.literal("")),
  issuerAddress: z.string().trim().max(300).optional().or(z.literal("")),
  issuerVat: z.string().trim().max(40).optional().or(z.literal("")),
  clientName: z.string().trim().min(1).max(120),
  clientEmail: z.string().trim().email().max(160),
  clientCompany: z.string().trim().max(160).optional().or(z.literal("")),
  clientAddress: z.string().trim().max(300).optional().or(z.literal("")),
  title: z.string().trim().min(1).max(160),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  validUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  lineItems: z.array(quoteLineItemSchema).min(1).max(20),
});

export type QuoteLineItem = z.infer<typeof quoteLineItemSchema>;
export type QuoteDraftInput = z.infer<typeof quoteDraftInputSchema>;

export type QuoteStatus =
  | "draft"
  | "pending_payment"
  | "paid"
  | "failed"
  | "canceled"
  | "expired";

export type QuoteOrder = {
  id: string;
  createdAt: string;
  updatedAt: string;
  issuerName: string;
  issuerEmail: string;
  issuerCompany: string | null;
  issuerAddress: string | null;
  issuerVat: string | null;
  clientName: string;
  clientEmail: string;
  clientCompany: string | null;
  clientAddress: string | null;
  title: string;
  notes: string | null;
  validUntil: string | null;
  currency: "EUR";
  lineItems: QuoteLineItem[];
  status: QuoteStatus;
  molliePaymentId: string | null;
  paidAt: string | null;
  downloadToken: string;
  /** Fixed product price for PDF unlock — not the quote total */
  unlockAmount: number;
};

export function quoteSubtotal(items: QuoteLineItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

export function publicQuoteView(order: QuoteOrder) {
  return {
    id: order.id,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    issuerName: order.issuerName,
    issuerEmail: order.issuerEmail,
    issuerCompany: order.issuerCompany,
    issuerAddress: order.issuerAddress,
    issuerVat: order.issuerVat,
    clientName: order.clientName,
    clientEmail: order.clientEmail,
    clientCompany: order.clientCompany,
    clientAddress: order.clientAddress,
    title: order.title,
    notes: order.notes,
    validUntil: order.validUntil,
    currency: order.currency,
    lineItems: order.lineItems,
    subtotal: quoteSubtotal(order.lineItems),
    status: order.status,
    paidAt: order.paidAt,
    unlockAmount: order.unlockAmount,
    downloadToken: order.downloadToken,
    molliePaymentId: order.molliePaymentId,
  };
}
