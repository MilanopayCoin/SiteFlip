/**
 * Near WebRTC ICE config — STUN always, TURN when server env is set.
 *
 * Env (server-only — never NEXT_PUBLIC for credentials):
 *   JIY_NEAR_TURN_URIS=turn:host:3478,turns:host:5349
 *   JIY_NEAR_TURN_USERNAME=…
 *   JIY_NEAR_TURN_CREDENTIAL=…
 * Optional force relay: JIY_NEAR_ICE_TRANSPORT_POLICY=relay
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

/** Build ICE servers from process env (Node / Workers). */
export function buildNearIcePayload(): NearIcePayload {
  const iceServers: RTCIceServer[] = [...NEAR_DEFAULT_STUN];
  const uris = splitUris(process.env.JIY_NEAR_TURN_URIS || "");
  const username = (process.env.JIY_NEAR_TURN_USERNAME || "").trim();
  const credential = (process.env.JIY_NEAR_TURN_CREDENTIAL || "").trim();

  let turnConfigured = false;
  if (uris.length && username && credential) {
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
    ttlSec: turnConfigured ? 600 : 3600,
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
