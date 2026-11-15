"use client";

import { nearFetch } from "@/lib/near/client";
import {
  NEAR_DEFAULT_STUN,
  nearIceToRtcConfiguration,
  type NearIcePayload,
} from "@/lib/near/ice";

let cache: { config: RTCConfiguration; until: number } | null = null;
let inflight: Promise<RTCConfiguration> | null = null;

function fallbackConfig(): RTCConfiguration {
  return { iceServers: NEAR_DEFAULT_STUN };
}

/**
 * Session-cached RTCConfiguration from `/api/near/ice`.
 * Falls back to public STUN if the request fails (offline / no session).
 */
export async function fetchNearRtcConfiguration(): Promise<RTCConfiguration> {
  const now = Date.now();
  if (cache && now < cache.until) return cache.config;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const data = (await nearFetch("/api/near/ice")) as NearIcePayload;
      const config = nearIceToRtcConfiguration(data);
      const ttlMs = Math.max(60, Number(data.ttlSec) || 300) * 1000;
      cache = { config, until: Date.now() + ttlMs - 15_000 };
      return config;
    } catch {
      const config = fallbackConfig();
      cache = { config, until: Date.now() + 60_000 };
      return config;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** Drop cache (e.g. after reconnect / env change). */
export function clearNearIceCache() {
  cache = null;
}
