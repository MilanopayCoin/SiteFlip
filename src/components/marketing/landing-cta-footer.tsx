import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export function LandingCtaFooter() {
  return (
    <>
      <section className="jiy-section border-y border-border bg-surface-2">
        <div className="jiy-container flex flex-col items-center text-center">
          <h2 className="font-display text-3xl tracking-tight text-foreground sm:text-4xl">
            Ready to trade on the exchange?
          </h2>
          <p className="mt-4 max-w-lg text-muted">
            Browse verified listings or submit yours for ownership review.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/marketplace">Explore marketplace</Link>
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <Link href="/sell">Sell your business</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-surface">
        <div className="jiy-container grid gap-10 py-12 md:grid-cols-4">
          <div className="md:col-span-1">
            <p className="font-display text-lg font-semibold">JIY</p>
            <p className="mt-2 text-sm text-muted">
              The exchange for verified digital businesses.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Marketplace</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li>
                <Link href="/marketplace" className="hover:text-accent">
                  Explore
                </Link>
              </li>
              <li>
                <Link href="/marketplace?type=REVIVE" className="hover:text-accent">
                  Revive
                </Link>
              </li>
              <li>
                <Link href="/sell" className="hover:text-accent">
                  Sell
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Account</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li>
                <Link href="/login" className="hover:text-accent">
                  Sign in
                </Link>
              </li>
              <li>
                <Link href="/signup" className="hover:text-accent">
                  Register
                </Link>
              </li>
              <li>
                <Link href="/deals" className="hover:text-accent">
                  Deals
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Legal</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li>
                <Link href="/privacy" className="hover:text-accent">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-accent">
                  Terms
                </Link>
              </li>
              <li className="text-xs text-muted">KvK: [TODO]</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border">
          <div className="jiy-container flex flex-col items-center justify-between gap-4 py-4 sm:flex-row">
            <p className="text-xs text-muted">
              © {new Date().getFullYear()} JIY.APP
            </p>
            <ThemeToggle />
          </div>
        </div>
      </footer>
    </>
  );
}
