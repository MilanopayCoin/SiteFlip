/**
 * Near WebRTC ICE config — STUN always; TURN via coturn REST (time-limited).
 *
 * Env (server-only):
 *   JIY_NEAR_TURN_URIS=turn:host:3478,turns:host:5349
 *   JIY_NEAR_TURN_SECRET=…   # coturn `static-auth-secret` / use-auth-secret
 *   JIY_NEAR_TURN_TTL_SEC=600
 * Optional force relay: JIY_NEAR_ICE_TRANSPORT_POLICY=relay
 *
 * Static long-lived USERNAME/CREDENTIAL are intentionally not returned to
 * clients (bandwidth-theft risk). Use TURN_SECRET for ephemeral creds.
 */

export const NEAR_DEFAULT_STUN: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export type NearIcePayload = {
  iceServers: RTCIceServer[];
  iceTransportPolicy?: RTCIceTransportPolicy;
  turnConfigured: boolean;
  /** Client cache hint (seconds). */
  ttlSec: number;
};

function splitUris(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function b64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

/** coturn REST: username=`expiry:user`, credential=HMAC-SHA1(secret, username). */
async function turnRestCredential(
  secret: string,
  username: string
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(username)
  );
  return b64(sig);
}

/**
 * Build ICE servers for an authenticated wallet.
 * Ephemeral TURN only when URIs + TURN_SECRET are set.
 */
export async function buildNearIcePayload(
  wallet: string
): Promise<NearIcePayload> {
  const iceServers: RTCIceServer[] = [...NEAR_DEFAULT_STUN];
  const uris = splitUris(process.env.JIY_NEAR_TURN_URIS || "");
  const secret = (process.env.JIY_NEAR_TURN_SECRET || "").trim();
  const ttlSecRaw = Number(process.env.JIY_NEAR_TURN_TTL_SEC || 600);
  const ttlSec = Math.min(3600, Math.max(60, Number.isFinite(ttlSecRaw) ? ttlSecRaw : 600));

  let turnConfigured = false;
  if (uris.length && secret) {
    const expiry = Math.floor(Date.now() / 1000) + ttlSec;
    const w = wallet.toLowerCase().replace(/^0x/, "").slice(0, 40);
    const username = `${expiry}:${w || "near"}`;
    const credential = await turnRestCredential(secret, username);
    iceServers.push({
      urls: uris.length === 1 ? uris[0]! : uris,
      username,
      credential,
    });
    turnConfigured = true;
  }

  const policyRaw = (
    process.env.JIY_NEAR_ICE_TRANSPORT_POLICY || ""
  ).toLowerCase();
  const iceTransportPolicy: RTCIceTransportPolicy | undefined =
    policyRaw === "relay" && turnConfigured ? "relay" : undefined;

  return {
    iceServers,
    iceTransportPolicy,
    turnConfigured,
    ttlSec: turnConfigured ? Math.max(60, ttlSec - 30) : 3600,
  };
}

export function nearIceToRtcConfiguration(
  payload: NearIcePayload
): RTCConfiguration {
  return {
    iceServers: payload.iceServers,
    ...(payload.iceTransportPolicy
      ? { iceTransportPolicy: payload.iceTransportPolicy }
      : {}),
  };
}
