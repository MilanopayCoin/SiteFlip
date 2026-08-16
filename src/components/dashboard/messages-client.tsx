"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";

type Conversation = {
  id: string;
  listing_id: string | null;
  offer_id: string | null;
  business_id: string | null;
  last_message_at: string | null;
  participant_ids: string[];
};

type Message = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

export function MessagesClient() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);

  async function loadConversations() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/messages");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setConversations(data.conversations ?? []);
      setUnread(data.unread ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function openConversation(id: string) {
    setActive(id);
    const res = await fetch(`/api/messages?conversationId=${id}`);
    const data = await res.json();
    if (res.ok) setMessages(data.messages ?? []);
  }

  async function send() {
    if (!active || !body.trim()) return;
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: active, body }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Send failed");
      return;
    }
    setBody("");
    await openConversation(active);
    await loadConversations();
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadConversations();
  }, []);

  if (loading) {
    return <div className="mt-6 h-40 animate-pulse rounded-xl bg-white/5" />;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">Messages</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Internal messaging around listings, offers, businesses, and transactions
        {unread > 0 ? ` · ${unread} unread` : ""}.
      </p>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {conversations.length === 0 ? (
        <EmptyState
          title="No messages yet"
          description="Message a seller from any listing page to start a conversation."
          actionHref="/explore"
          actionLabel="Find a listing"
        />
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">Inbox</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {conversations.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => openConversation(c.id)}
                  className={`w-full rounded-lg border p-3 text-left text-sm transition-colors ${
                    active === c.id
                      ? "border-violet-500/40 bg-violet-500/10"
                      : "border-white/10 hover:bg-white/5"
                  }`}
                >
                  <p className="font-medium text-zinc-200">
                    {c.listing_id
                      ? `Listing ${c.listing_id.slice(0, 8)}`
                      : c.offer_id
                        ? `Offer ${c.offer_id.slice(0, 8)}`
                        : "Conversation"}
                  </p>
                  <p className="mt-1 text-xs text-zinc-600">
                    {c.last_message_at
                      ? new Date(c.last_message_at).toLocaleString()
                      : "No messages yet"}
                  </p>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Thread</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!active ? (
                <p className="text-sm text-zinc-500">Select a conversation</p>
              ) : (
                <>
                  <div className="max-h-80 space-y-2 overflow-y-auto">
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className="rounded-lg border border-white/10 p-3 text-sm"
                      >
                        <p className="text-zinc-200">{m.body}</p>
                        <p className="mt-1 text-[10px] text-zinc-600">
                          {new Date(m.created_at).toLocaleString()}
                          {m.read_at ? " · read" : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Write a reply…"
                    rows={3}
                  />
                  <Button onClick={send} disabled={!body.trim()}>
                    Send
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
