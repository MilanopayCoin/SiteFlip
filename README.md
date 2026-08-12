# SITEFLIP

**Build. Buy. Rent. Revive. Grow. Sell.**

SITEFLIP is an AI-powered **Online Business Lifecycle Platform** — the operating system for digital business acquisitions. The marketplace is one part; the complete lifecycle is the product.

```
CREATE → GROW → RENT → BUY → REVIVE → SELL → REINVEST → BUILD AGAIN
```

## Stack

- Next.js 16 (App Router) · TypeScript · Tailwind CSS 4
- Supabase (Auth, PostgreSQL, RLS)
- OpenAI API (with heuristic fallbacks)
- Mollie (payments — **not** escrow)
- Framer Motion · Recharts · Zod · React Hook Form

## Features (MVP)

| Area | Status |
|------|--------|
| Homepage + lifecycle narrative | ✅ |
| Unified marketplace (Buy / Rent / Revive) | ✅ |
| Business cards, filters, listing detail | ✅ |
| Sell + AI listing/valuation | ✅ |
| Rent + rent-to-own display (configurable credit) | ✅ |
| BUILD wizard + business blueprint | ✅ |
| **AI Business Factory** (agents + orchestrator) | ✅ |
| Factory preview, approvals, cost tracking | ✅ |
| BUILD → SELL / RENT / GROW handoff | ✅ |
| REVIVE marketplace + revival plans | ✅ |
| Find My Business (deterministic + ranking) | ✅ |
| Dashboard, portfolio, timeline, passport | ✅ |
| Offers / messaging / watchlist architecture | ✅ |
| AI Command Center | ✅ |
| Domain verification (DNS TXT) | ✅ |
| TransactionProvider (Mollie ≠ escrow) | ✅ |
| Admin shell | ✅ |
| Supabase schema + RLS migrations | ✅ |
| Demo data mode (no env required) | ✅ |

## AI Business Factory

Route: `/build`

Modular agents (Zod-validated) orchestrated by `BusinessFactoryOrchestrator`:

Business → Market → Brand → Product → Architecture → Content → SEO → Database → Payment → Developer (landing sandbox) → Testing → Deployment → Growth → Finance

- Real task statuses (no fake progress)
- Sandbox isolation from SITEFLIP core DB
- Approval gates for production deploy & payments
- Cost estimates + threshold architecture
- Business memory (no secrets)
- Preview at `/build/[id]/preview`

Migration: `supabase/migrations/002_business_factory.sql`

MVP limitation: DeveloperAgent generates **landing_page_only** starter artifacts — not a full autonomous SaaS coder.

## Getting started

```bash
# Install
npm install

# Configure (optional for demo mode)
cp .env.example .env.local

# Develop
npm run dev

# Lint & typecheck
npm run lint
npm run typecheck

# Production build
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000).

Without Supabase/OpenAI keys the app runs on **demo seed data** and heuristic AI.

## Database

Apply the migration in Supabase SQL editor or CLI:

```bash
# supabase/migrations/001_initial_schema.sql
supabase db push
# or paste into Supabase SQL editor
```

Main tables: `profiles`, `businesses`, `business_metrics`, `business_events`, `business_verifications`, `business_owners`, `listings`, `listing_images`, `offers`, `rentals`, `rental_contracts`, `transactions`, `transaction_events`, `messages`, `conversations`, `watchlists`, `reviews`, `valuations`, `ai_analyses`, `ai_matches`, `revival_plans`, `notifications`, `reports`, `subscriptions`, `payments`, `analytics_events`, `admin_actions`.

Business lifecycle enum: `IDEA | BUILDING | LIVE | GROWING | FOR_SALE | FOR_RENT | RENTED | ACQUIRED | REVIVING | REVIVED | SOLD | ARCHIVED`.

## Environment variables

See `.env.example`:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only admin operations |
| `OPENAI_API_KEY` | AI build / revive / command |
| `OPENAI_MODEL` | Default `gpt-4o-mini` |
| `MOLLIE_API_KEY` | Mollie payments (not escrow) |
| `MOLLIE_WEBHOOK_URL` | Mollie webhook URL |
| `GROQ_API_KEY` | Primary AI provider |
| `GROQ_MODEL` | Default `llama-3.1-8b-instant` |

## Deployment

### Cloudflare Workers (production URL)

```bash
npm run deploy
# → https://siteflip.<your-subdomain>.workers.dev
```

Requires Cloudflare auth (`wrangler login` or `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`).

Worker name is configured as `siteflip` in `wrangler.jsonc`.

### Vercel

1. Push repo to GitHub.
2. Import in Vercel.
3. Set environment variables.
4. Apply Supabase migration.
5. Deploy.

## Important product rules

- **AI valuation** is informational only — not financial, investment, legal, or tax advice.
- **No fake verification**, revenue, or transactions.
- **Mollie payments are not escrow** — use `TransactionProvider` + future regulated escrow.
- **Rent-to-own** is a flexible contract architecture — not automatic legally binding ownership transfer.
- **BUILD** produces blueprints/starter assets — not a pretend full production SaaS.

## Remaining integrations

- Persist listings/offers/messages to Supabase (replace demo stores)
- Mollie Checkout for marketplace payments
- Regulated escrow provider
- Revenue verification: Mollie / Shopify / PayPal OAuth
- Traffic verification: GA / GSC / Cloudflare OAuth
- External AI coding/building service for START BUILDING
- Upstash Redis rate limiting
- Email (Resend) for transactional notifications
- Full admin CRUD with `is_admin` gate

## Production security checklist

- [ ] Enable Supabase RLS (included in migration)
- [ ] Never expose `SUPABASE_SERVICE_ROLE_KEY` or `MOLLIE_API_KEY` client-side
- [ ] Secure cookies / HTTPS only
- [ ] Rotate keys; use Vercel env secrets
- [ ] Rate-limit AI & auth endpoints (architecture included; add Redis in prod)
- [ ] Zod validate all mutating inputs
- [ ] Server-side authorization on offers, messages, transactions
- [ ] Do not mark seller claims as verified
- [ ] Mollie webhook re-fetch verification (server-side)
- [ ] CSP / security headers on Vercel
- [ ] Audit admin actions table

## License

Proprietary — SITEFLIP
