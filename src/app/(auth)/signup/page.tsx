"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  cacheProfile,
  saveDemoSession,
} from "@/lib/profile/client-cache";
import { createBrowserClient } from "@/lib/supabase/browser";

export default function SignupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        username,
        displayName,
        country: country || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Registration failed");
      setLoading(false);
      return;
    }

    if (data.profile) cacheProfile(data.profile);
    saveDemoSession({
      userId: data.user.id,
      email: data.user.email,
      mode: data.mode === "demo_local" ? "demo" : "supabase",
    });

    // Also establish browser Supabase session when Auth is configured
    if (data.mode !== "demo_local") {
      const supabase = await createBrowserClient();
      if (supabase && data.hasSession === false) {
        // may need email confirm — try password login
        await supabase.auth.signInWithPassword({ email, password }).catch(() => null);
      } else if (supabase) {
        await supabase.auth.signInWithPassword({ email, password }).catch(() => null);
      }
    }

    setMessage(
      data.mode === "supabase_confirm_email"
        ? "Account created. Confirm email if required, then open your profile."
        : "Account created. Redirecting to profile…"
    );
    router.push("/profile");
    setLoading(false);
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Create your SITEFLIP account</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                required
                className="mt-1.5"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                required
                minLength={3}
                pattern="[a-zA-Z0-9_]+"
                className="mt-1.5"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="country">Country (optional)</Label>
              <Input
                id="country"
                className="mt-1.5"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Netherlands"
              />
            </div>
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
                minLength={8}
                className="mt-1.5"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating…" : "Register"}
            </Button>
          </form>
          {message && <p className="mt-4 text-sm text-zinc-400">{message}</p>}
          <p className="mt-3 text-xs text-zinc-600">
            Profile data is LOCAL / DEMO / NOT PERSISTED until Supabase schema is
            available.
          </p>
          <p className="mt-4 text-center text-sm text-zinc-500">
            Already have an account?{" "}
            <Link href="/login" className="text-violet-400 hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
