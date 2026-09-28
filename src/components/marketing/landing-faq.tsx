import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SectionHeading } from "@/components/ui/section-heading";

const FAQ = [
  {
    q: "What fees does JIY charge?",
    a: "TODO: Publish platform commission % and payment processing pass-through.",
  },
  {
    q: "How do payments and escrow work?",
    a: "TODO: Explain Mollie checkout, webhook-confirmed status, delivery gate, and that Mollie is not escrow.",
  },
  {
    q: "How long does verification take?",
    a: "TODO: Typical review SLA once ownership evidence is submitted.",
  },
  {
    q: "What does Revive mean?",
    a: "TODO: Define REVIVE listings — abandoned or paused projects seeking a new operator.",
  },
  {
    q: "Refunds and cancellations",
    a: "TODO: Policy summary aligned with Mollie and deal states.",
  },
  {
    q: "Disputes",
    a: "TODO: How disputes pause payout and admin resolution path.",
  },
] as const;

export function LandingFaq() {
  return (
    <section className="jiy-section border-t border-border">
      <div className="jiy-container max-w-3xl">
        <SectionHeading title="FAQ" subtitle="Common questions about the exchange." />
        <Accordion type="single" collapsible className="mt-8">
          {FAQ.map((item, i) => (
            <AccordionItem key={item.q} value={`faq-${i}`}>
              <AccordionTrigger>{item.q}</AccordionTrigger>
              <AccordionContent>{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
