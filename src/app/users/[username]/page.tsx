"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PublicUserProfile } from "@/lib/profile/types";
import { readCachedProfile } from "@/lib/profile/client-cache";

export default function PublicUserPage() {
  const params = useParams<{ username: string }>();
  const username = params.username;
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const cached = readCachedProfile();
      if (cached && cached.username.toLowerCase() === username.toLowerCase()) {
        await fetch(`/api/users/${username}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile: cached }),
        });
      }
      const res = await fetch(`/api/users/${username}`);
      if (cancelled) return;
      if (!res.ok) {
        setError("User not found");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setProfile(data.profile);
      setLoading(false);
    }
    void load();
    const failSafe = window.setTimeout(() => {
      if (cancelled) return;
      setLoading((l) => {
        if (!l) return l;
        setError("User not found");
        return false;
      });
    }, 8000);
    return () => {
      cancelled = true;
      window.clearTimeout(failSafe);
    };
  }, [username]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-zinc-500">
        Loading public profile…
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-rose-400">{error || "User not found"}</p>
        <Button className="mt-4" asChild>
          <Link href="/explore">Back to explore</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-violet-400">
            @{profile.username}
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-white">
            {profile.displayName}
          </h1>
          {profile.country && (
            <p className="mt-1 text-sm text-zinc-400">{profile.country}</p>
          )}
        </div>
        <Badge variant="warning">
          {profile.persistenceMode === "SUPABASE"
            ? "PERSISTED"
            : "LOCAL / DEMO / NOT PERSISTED"}
        </Badge>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-zinc-300">
          <p>{profile.bio || "No bio yet."}</p>
          {profile.website && (
            <p>
              Website:{" "}
              <a
                href={profile.website}
                className="text-violet-300 hover:underline"
                rel="noreferrer"
                target="_blank"
              >
                {profile.website}
              </a>
            </p>
          )}
          {profile.preferredBusinessType && (
            <p>Preferred type: {profile.preferredBusinessType}</p>
          )}
          {profile.skills.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((s) => (
                <Badge key={s} variant="outline">
                  {s}
                </Badge>
              ))}
            </div>
          )}
          {profile.businessInterests.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {profile.businessInterests.map((s) => (
                <Badge key={s} variant="info">
                  {s}
                </Badge>
              ))}
            </div>
          )}
          <p className="text-xs text-zinc-600">
            Member since {new Date(profile.memberSince).toLocaleDateString()} ·
            Private contact details are never shown here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
