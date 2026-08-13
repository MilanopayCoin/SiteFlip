"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createBrowserClient,
  getPublicSupabaseConfig,
} from "@/lib/supabase/browser";
import {
  cacheProfile,
  saveDemoSession,
} from "@/lib/profile/client-cache";

function safeNextPath(raw: string | null): string {
  // Factory-first: avoid broken /dashboard SSR on Free Workers after login
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/build";
  return raw;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    getPublicSupabaseConfig()
      .then((c) => setConfigured(Boolean(c.configured)))
      .catch(() => setConfigured(false));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const supabase = await createBrowserClient();
    if (!supabase) {
      // DEMO only when public Supabase config is unavailable
      if (configured) {
        setMessage(
          "Supabase Auth client unavailable. DEMO login disabled while Supabase is configured."
        );
        setLoading(false);
        return;
      }
      const userId = `demo_${btoa(email).replace(/[^a-z0-9]/gi, "").slice(0, 12)}`;
      saveDemoSession({ userId, email, mode: "demo" });
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          displayName: email.split("@")[0],
          username: email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "").slice(0, 24),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.profile) cacheProfile(data.profile);
      setMessage("Signed in (DEMO local). Profile is NOT PERSISTED.");
      router.push(nextPath);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }
    if (data.user) {
      saveDemoSession({
        userId: data.user.id,
        email: data.user.email || email,
        mode: "supabase",
      });
      // Ensure cookie session is readable by API routes before leaving the page
      await supabase.auth.getSession();
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: data.user.id,
          displayName:
            (data.user.user_metadata?.display_name as string) ||
            email.split("@")[0],
          username:
            (data.user.user_metadata?.username as string) ||
            email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "").slice(0, 24),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (body.profile) cacheProfile(body.profile);
    }
    setMessage("Signed in. Redirecting…");
    // Full navigation so subsequent /api/* requests include auth cookies
    window.location.href = nextPath;
    return;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in to JIY.APP</CardTitle>
      </CardHeader>
      <CardContent>
        {configured === false && (
          <p className="mb-4 text-sm text-amber-300/90">
            Live Supabase Auth is unavailable — demo dashboard still works.
          </p>
        )}
        {nextPath !== "/build" && (
          <p className="mb-4 text-sm text-zinc-400">
            After sign in you will return to{" "}
            <span className="text-zinc-200">{nextPath}</span>.
          </p>
        )}
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              className="mt-1.5"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              className="mt-1.5"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        {message && <p className="mt-4 text-sm text-zinc-400">{message}</p>}
        <p className="mt-4 text-center text-sm text-zinc-500">
          No account?{" "}
          <Link
            href={`/signup?next=${encodeURIComponent(nextPath)}`}
            className="text-violet-400 hover:underline"
          >
            Register
          </Link>
        </p>
        <p className="mt-2 text-center text-sm">
          <Link href="/profile" className="text-zinc-400 hover:text-white">
            Open profile →
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <Suspense
        fallback={
          <Card>
            <CardContent className="p-6 text-sm text-zinc-400">Loading…</CardContent>
          </Card>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
