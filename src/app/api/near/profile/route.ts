import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { walletFromAuthHeader } from "@/lib/near/auth";
import {
  issueMoveLinkChallenge,
  verifyMoveLinkProof,
} from "@/lib/near/move-link";
import { getProfile, upsertProfile } from "@/lib/near/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await ensureCloudflareEnv();
    const wallet = await walletFromAuthHeader(
      request.headers.get("authorization")
    );
    if (!wallet) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = new URL(request.url);
    const peer = url.searchParams.get("peer");
    if (peer && /^0x[a-fA-F0-9]{40}$/.test(peer)) {
      const profile = await getProfile(peer.toLowerCase());
      return Response.json({
        profile: profile
          ? {
              wallet: profile.wallet,
              displayName: profile.displayName,
              avatarEmoji: profile.avatarEmoji,
              mood: profile.mood,
              moveAddress: profile.moveAddress,
            }
          : null,
      });
    }

    const move = url.searchParams.get("move");
    if (move === "challenge") {
      const moveAddress = url.searchParams.get("moveAddress");
      if (!moveAddress || !/^0x[a-fA-F0-9]{64}$/.test(moveAddress)) {
        return Response.json(
          { error: "Valid moveAddress required" },
          { status: 400 }
        );
      }
      const challenge = issueMoveLinkChallenge({
        evmWallet: wallet,
        moveAddress,
      });
      return Response.json({
        nonce: challenge.nonce,
        issuedAt: challenge.issuedAt,
        message: challenge.message,
        moveAddress: challenge.moveAddress,
      });
    }

    const profile = await getProfile(wallet);
    return Response.json({ profile });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Profile load failed" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    await ensureCloudflareEnv();
    const wallet = await walletFromAuthHeader(
      request.headers.get("authorization")
    );
    if (!wallet) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = (await request.json()) as {
      displayName?: string;
      mood?: string;
      bio?: string;
      avatarEmoji?: string;
      moveAddress?: string | null;
      moveProof?: {
        nonce: string;
        issuedAt: string;
        signature: string;
        publicKey: string;
        signedAddress?: string;
      } | null;
    };

    if (body.moveAddress !== undefined && body.moveAddress !== null) {
      const moveAddress = body.moveAddress.trim().toLowerCase();
      if (!/^0x[a-f0-9]{64}$/.test(moveAddress)) {
        return Response.json(
          { error: "Geçerli Move adresi gerekli (0x + 64 hex)" },
          { status: 400 }
        );
      }
      const proof = body.moveProof;
      if (
        !proof?.nonce ||
        !proof.issuedAt ||
        !proof.signature ||
        !proof.publicKey
      ) {
        return Response.json(
          {
            error:
              "Move adresi için imza kanıtı gerekli (nonce, issuedAt, signature, publicKey)",
          },
          { status: 400 }
        );
      }
      const ok = verifyMoveLinkProof({
        evmWallet: wallet,
        moveAddress,
        nonce: proof.nonce,
        issuedAt: proof.issuedAt,
        signature: proof.signature,
        publicKey: proof.publicKey,
        signedAddress: proof.signedAddress,
      });
      if (!ok) {
        return Response.json(
          {
            error:
              "Move imzası geçersiz, süresi dolmuş veya public key adrese bağlı değil",
          },
          { status: 401 }
        );
      }
      body.moveAddress = moveAddress;
    }

    const profile = await upsertProfile(wallet, {
      displayName: body.displayName,
      mood: body.mood,
      bio: body.bio,
      avatarEmoji: body.avatarEmoji,
      moveAddress: body.moveAddress,
    });
    return Response.json({ profile });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Profile save failed" },
      { status: 500 }
    );
  }
}
