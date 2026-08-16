"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { UserProfile } from "@/lib/profile/types";
import {
  cacheProfile,
  clearDemoSession,
  readCachedProfile,
  readDemoSession,
  saveDemoSession,
} from "@/lib/profile/client-cache";
import { createBrowserClient } from "@/lib/supabase/browser";

function csv(v: string) {
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [completion, setCompletion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const cached = readCachedProfile();
      if (cached && !cancelled) {
        setProfile(cached);
        setLoading(false);
      }
      const demo = readDemoSession();
      const qs = demo?.userId ? `?userId=${encodeURIComponent(demo.userId)}` : "";
      let res = await fetch(`/api/profile${qs}`);
      if (!res.ok && cached) {
        res = await fetch("/api/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile: cached }),
        });
      }
      if (cancelled) return;
      if (!res.ok) {
        setError("Sign in to edit your profile.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setProfile(data.profile);
      setCompletion(data.completionPercent ?? 0);
      cacheProfile(data.profile);
      setLoading(false);
    }
    void load();
    const failSafe = window.setTimeout(() => {
      if (cancelled) return;
      setLoading((l) => {
        if (!l) return l;
        setError("Could not load profile. LOCAL / DEMO session may be missing.");
        return false;
      });
    }, 8000);
    return () => {
      cancelled = true;
      window.clearTimeout(failSafe);
    };
  }, []);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      username: String(fd.get("username") || ""),
      displayName: String(fd.get("displayName") || ""),
      country: String(fd.get("country") || ""),
      bio: String(fd.get("bio") || ""),
      website: String(fd.get("website") || ""),
      skills: csv(String(fd.get("skills") || "")),
      businessInterests: csv(String(fd.get("businessInterests") || "")),
      preferredBusinessType: String(fd.get("preferredBusinessType") || ""),
      budget: String(fd.get("budget") || ""),
      risk: String(fd.get("risk") || ""),
      workload: String(fd.get("workload") || ""),
      profile, // hydrate
    };
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Save failed");
      setSaving(false);
      return;
    }
    setProfile(data.profile);
    setCompletion(data.completionPercent ?? 0);
    cacheProfile(data.profile);
    const demo = readDemoSession();
    if (demo) saveDemoSession(demo);
    setMessage("Profile saved (LOCAL / DEMO / NOT PERSISTED).");
    setSaving(false);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    const supabase = await createBrowserClient();
    if (supabase) await supabase.auth.signOut();
    clearDemoSession();
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-zinc-500">
        Loading profile…
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-rose-400">{error}</p>
        <Button className="mt-4" asChild>
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Your profile</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Preferences personalize BUILD. Explicit idea text always wins.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="warning">
            {profile.persistenceMode === "SUPABASE"
              ? "PERSISTED"
              : "LOCAL / DEMO / NOT PERSISTED"}
          </Badge>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/users/${profile.username}`}>Public profile</Link>
          </Button>
          <Button size="sm" variant="ghost" onClick={logout}>
            Log out
          </Button>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3 text-base">
            <span>Completion</span>
            <span className="text-violet-300">{completion}%</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={completion} className="h-2" />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Edit profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Username" name="username" defaultValue={profile.username} required />
              <Field
                label="Display name"
                name="displayName"
                defaultValue={profile.displayName}
                required
              />
              <Field label="Country" name="country" defaultValue={profile.country} />
              <Field label="Website" name="website" defaultValue={profile.website} />
              <Field
                label="Preferred business type"
                name="preferredBusinessType"
                defaultValue={profile.preferredBusinessType}
                placeholder="SaaS, Marketplace…"
              />
              <Field
                label="Budget"
                name="budget"
                defaultValue={profile.budget}
                placeholder="€5,000"
              />
              <div>
                <Label htmlFor="risk">Risk</Label>
                <select
                  id="risk"
                  name="risk"
                  defaultValue={profile.risk || "Medium"}
                  className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-zinc-200"
                >
                  {["Low", "Medium", "High"].map((o) => (
                    <option key={o} value={o} className="bg-zinc-900">
                      {o}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="workload">Workload</Label>
                <select
                  id="workload"
                  name="workload"
                  defaultValue={profile.workload || "Part-time"}
                  className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-zinc-200"
                >
                  {["Side project", "Part-time", "Full-time"].map((o) => (
                    <option key={o} value={o} className="bg-zinc-900">
                      {o}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                name="bio"
                rows={3}
                className="mt-1.5"
                defaultValue={profile.bio}
              />
            </div>
            <Field
              label="Skills (comma-separated)"
              name="skills"
              defaultValue={profile.skills.join(", ")}
              placeholder="Next.js, Marketing"
            />
            <Field
              label="Business interests (comma-separated)"
              name="businessInterests"
              defaultValue={profile.businessInterests.join(", ")}
              placeholder="Booking, AI tools"
            />
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save profile"}
            </Button>
          </form>
          {message && <p className="mt-3 text-sm text-emerald-300">{message}</p>}
          {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
          <p className="mt-3 text-xs text-zinc-600">
            Email ({profile.email}) is private and never shown on public profiles.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Field(props: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <Label htmlFor={props.name}>{props.label}</Label>
      <Input
        id={props.name}
        name={props.name}
        className="mt-1.5"
        defaultValue={props.defaultValue}
        placeholder={props.placeholder}
        required={props.required}
      />
    </div>
  );
}
