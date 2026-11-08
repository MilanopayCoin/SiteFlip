import { nanoid } from "nanoid";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createServiceClient } from "@/lib/supabase/server";
import type {
  NearCall,
  NearCallSignal,
  NearCallSignalKind,
  NearCallStatus,
} from "@/lib/near/types";

const g = globalThis as unknown as {
  __jiyNearCalls?: Map<string, NearCall>;
  __jiyNearSignals?: Map<string, NearCallSignal[]>;
  __jiyNearSignalSeq?: number;
};

function calls() {
  if (!g.__jiyNearCalls) g.__jiyNearCalls = new Map();
  return g.__jiyNearCalls;
}
function signals() {
  if (!g.__jiyNearSignals) g.__jiyNearSignals = new Map();
  return g.__jiyNearSignals;
}
function nextId() {
  g.__jiyNearSignalSeq = (g.__jiyNearSignalSeq || 0) + 1;
  return g.__jiyNearSignalSeq;
}

function now() {
  return new Date().toISOString();
}

function norm(w: string) {
  return w.trim().toLowerCase();
}

async function db() {
  if (!isSupabaseConfigured()) return null;
  return createServiceClient();
}

export async function createCall(
  fromWallet: string,
  toWallet: string
): Promise<NearCall> {
  const from = norm(fromWallet);
  const to = norm(toWallet);
  if (from === to) throw new Error("Cannot call yourself");
  const ts = now();
  const call: NearCall = {
    id: nanoid(16),
    fromWallet: from,
    toWallet: to,
    status: "ringing",
    createdAt: ts,
    updatedAt: ts,
  };
  calls().set(call.id, call);
  signals().set(call.id, []);

  const client = await db();
  if (client) {
    await client.from("near_calls").insert({
      id: call.id,
      from_wallet: from,
      to_wallet: to,
      status: call.status,
      created_at: ts,
      updated_at: ts,
    });
  }
  return call;
}

export async function getCall(id: string): Promise<NearCall | null> {
  const mem = calls().get(id);
  if (mem) return mem;
  const client = await db();
  if (!client) return null;
  const { data } = await client
    .from("near_calls")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const call: NearCall = {
    id: data.id,
    fromWallet: data.from_wallet,
    toWallet: data.to_wallet,
    status: data.status as NearCallStatus,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
  calls().set(call.id, call);
  return call;
}

export async function listIncoming(wallet: string): Promise<NearCall[]> {
  const w = norm(wallet);
  const out: NearCall[] = [];
  for (const c of calls().values()) {
    if (c.toWallet === w && c.status === "ringing") out.push(c);
  }
  const client = await db();
  if (client) {
    const { data } = await client
      .from("near_calls")
      .select("*")
      .eq("to_wallet", w)
      .eq("status", "ringing")
      .order("created_at", { ascending: false })
      .limit(10);
    for (const row of data || []) {
      const call: NearCall = {
        id: row.id,
        fromWallet: row.from_wallet,
        toWallet: row.to_wallet,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
      calls().set(call.id, call);
      if (!out.find((x) => x.id === call.id)) out.push(call);
    }
  }
  return out;
}

export async function setCallStatus(
  id: string,
  status: NearCallStatus
): Promise<NearCall | null> {
  const call = await getCall(id);
  if (!call) return null;
  call.status = status;
  call.updatedAt = now();
  calls().set(id, call);
  const client = await db();
  if (client) {
    await client
      .from("near_calls")
      .update({ status, updated_at: call.updatedAt })
      .eq("id", id);
  }
  return call;
}

export async function pushSignal(input: {
  callId: string;
  fromWallet: string;
  kind: NearCallSignalKind;
  payload: unknown;
}): Promise<NearCallSignal> {
  const call = await getCall(input.callId);
  if (!call) throw new Error("Call not found");
  const w = norm(input.fromWallet);
  if (call.fromWallet !== w && call.toWallet !== w) {
    throw new Error("Not a participant");
  }
  const sig: NearCallSignal = {
    id: nextId(),
    callId: input.callId,
    fromWallet: w,
    kind: input.kind,
    payload: input.payload,
    createdAt: now(),
  };
  const list = signals().get(input.callId) || [];
  list.push(sig);
  signals().set(input.callId, list);

  if (input.kind === "hangup") {
    await setCallStatus(input.callId, "ended");
  } else if (input.kind === "answer") {
    await setCallStatus(input.callId, "active");
  }

  const client = await db();
  if (client) {
    const { data } = await client
      .from("near_call_signals")
      .insert({
        call_id: input.callId,
        from_wallet: w,
        kind: input.kind,
        payload: input.payload,
        created_at: sig.createdAt,
      })
      .select("id")
      .maybeSingle();
    if (data?.id) sig.id = Number(data.id);
  }
  return sig;
}

export async function pullSignals(
  callId: string,
  afterId: number,
  wallet: string
): Promise<NearCallSignal[]> {
  const call = await getCall(callId);
  if (!call) return [];
  const w = norm(wallet);
  if (call.fromWallet !== w && call.toWallet !== w) {
    throw new Error("Not a participant");
  }

  const mem = (signals().get(callId) || []).filter(
    (s) => s.id > afterId && s.fromWallet !== w
  );

  const client = await db();
  if (!client) return mem;

  const { data } = await client
    .from("near_call_signals")
    .select("*")
    .eq("call_id", callId)
    .gt("id", afterId)
    .neq("from_wallet", w)
    .order("id", { ascending: true })
    .limit(50);

  const fromDb: NearCallSignal[] = (data || []).map((row) => ({
    id: Number(row.id),
    callId: row.call_id,
    fromWallet: row.from_wallet,
    kind: row.kind,
    payload: row.payload,
    createdAt: row.created_at,
  }));

  const byId = new Map<number, NearCallSignal>();
  for (const s of [...mem, ...fromDb]) byId.set(s.id, s);
  return [...byId.values()].sort((a, b) => a.id - b.id);
}
