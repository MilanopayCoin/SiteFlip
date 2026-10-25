-- Optional Google / Trustpilot enrichment for JIY Menu venues (TR + NL)

ALTER TABLE qr_menus
  ADD COLUMN IF NOT EXISTS venue JSONB;

COMMENT ON COLUMN qr_menus.venue IS
  'Market, Google place id, ratings, Trustpilot profile URL — public subset exposed on menu page.';
