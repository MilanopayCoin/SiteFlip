import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createDomainVerificationChallenge,
  verifyDomainDns,
} from "@/lib/verification";
import { domainVerifySchema } from "@/lib/validations";

const domainVerifyRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("challenge"),
    businessId: z.string().min(1),
    domain: z.string().min(3),
  }),
  domainVerifySchema.extend({
    action: z.literal("verify"),
  }),
]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = domainVerifyRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    if (parsed.data.action === "challenge") {
      const challenge = createDomainVerificationChallenge(
        parsed.data.businessId,
        parsed.data.domain
      );
      return NextResponse.json({ challenge });
    }

    const result = await verifyDomainDns(parsed.data.domain, parsed.data.token);
    return NextResponse.json({ result });
  } catch (error) {
    console.error("[api/domain-verify]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
