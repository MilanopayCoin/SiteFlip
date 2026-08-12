"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createBrowserClient,
  getPublicSupabaseConfig,
} from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
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
      setMessage(
        "Supabase is not configured. Demo mode: use Dashboard without auth."
      );
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setMessage(error ? error.message : "Signed in. Redirecting…");
    if (!error) router.push("/dashboard");
    setLoading(false);
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Sign in to SITEFLIP</CardTitle>
        </CardHeader>
        <CardContent>
          {configured === false && (
            <p className="mb-4 text-sm text-amber-300/90">
              Live Supabase Auth is unavailable — demo dashboard still works.
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
            <Link href="/signup" className="text-violet-400 hover:underline">
              Sign up
            </Link>
          </p>
          <p className="mt-2 text-center text-sm">
            <Link href="/dashboard" className="text-zinc-400 hover:text-white">
              Continue in demo mode →
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
