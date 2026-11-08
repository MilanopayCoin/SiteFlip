import { ensureCloudflareEnv } from "@/lib/supabase/env";
import { walletFromAuthHeader } from "@/lib/near/auth";
import {
  clearBets,
  createTable,
  getTable,
  joinTable,
  leaveTable,
  listOpenTables,
  placeBet,
  pullRouletteSignals,
  pushRouletteSignal,
  ROULETTE_CONST,
  setAutoStart,
  setCam,
  startBetting,
  tickTable,
  toPublic,
  undoBet,
} from "@/lib/near/roulette";
import type { RouletteBetKind, RouletteSignal } from "@/lib/near/roulette";

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
    const tableId = url.searchParams.get("tableId");
    const after = Number(url.searchParams.get("after") || 0);
    const signalsOnly = url.searchParams.get("signals");

    if (tableId && signalsOnly === "1") {
      const sigs = pullRouletteSignals(tableId, wallet, after);
      return Response.json({ signals: sigs });
    }

    if (tableId) {
      await tickTable(tableId);
      const t = getTable(tableId);
      if (!t) {
        return Response.json({ error: "Masa yok" }, { status: 404 });
      }
      return Response.json({
        table: toPublic(t),
        constants: ROULETTE_CONST,
      });
    }

    return Response.json({
      tables: listOpenTables(),
      constants: ROULETTE_CONST,
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Roulette failed" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureCloudflareEnv();
    const wallet = await walletFromAuthHeader(
      request.headers.get("authorization")
    );
    if (!wallet) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = (await request.json()) as {
      action?: string;
      tableId?: string;
      label?: string;
      displayName?: string;
      avatarEmoji?: string;
      seatIndex?: number;
      color?: "red" | "black";
      amount?: number;
      numbers?: number[];
      meta?: number;
      betKind?: RouletteBetKind;
      camOn?: boolean;
      autoStart?: boolean;
      toWallet?: string;
      kind?: RouletteSignal["kind"];
      payload?: unknown;
    };

    const name = body.displayName || wallet.slice(0, 8);
    const emoji = body.avatarEmoji || "🎰";

    switch (body.action) {
      case "create": {
        const table = await createTable({
          hostWallet: wallet,
          displayName: name,
          avatarEmoji: emoji,
          label: body.label,
        });
        return Response.json({ table, constants: ROULETTE_CONST });
      }
      case "join": {
        if (!body.tableId) {
          return Response.json({ error: "tableId required" }, { status: 400 });
        }
        const table = await joinTable({
          tableId: body.tableId,
          wallet,
          displayName: name,
          avatarEmoji: emoji,
          seatIndex: body.seatIndex,
        });
        return Response.json({ table });
      }
      case "leave": {
        if (!body.tableId) {
          return Response.json({ error: "tableId required" }, { status: 400 });
        }
        const table = await leaveTable(body.tableId, wallet);
        return Response.json({ table, ok: true });
      }
      case "start": {
        if (!body.tableId) {
          return Response.json({ error: "tableId required" }, { status: 400 });
        }
        const table = await startBetting(body.tableId, wallet);
        return Response.json({ table });
      }
      case "bet": {
        if (!body.tableId || body.amount == null) {
          return Response.json(
            { error: "tableId + amount required" },
            { status: 400 }
          );
        }
        const betKind: RouletteBetKind | undefined =
          body.betKind ||
          (body.color === "red" || body.color === "black"
            ? body.color
            : undefined);
        if (!betKind) {
          return Response.json({ error: "betKind required" }, { status: 400 });
        }
        const table = await placeBet({
          tableId: body.tableId,
          wallet,
          kind: betKind,
          amount: body.amount,
          numbers: body.numbers,
          meta: body.meta,
        });
        return Response.json({ table });
      }
      case "undo": {
        if (!body.tableId) {
          return Response.json({ error: "tableId required" }, { status: 400 });
        }
        const table = await undoBet(body.tableId, wallet);
        return Response.json({ table });
      }
      case "clear": {
        if (!body.tableId) {
          return Response.json({ error: "tableId required" }, { status: 400 });
        }
        const table = await clearBets(body.tableId, wallet);
        return Response.json({ table });
      }
      case "cam": {
        if (!body.tableId || typeof body.camOn !== "boolean") {
          return Response.json(
            { error: "tableId + camOn required" },
            { status: 400 }
          );
        }
        const table = await setCam(body.tableId, wallet, body.camOn);
        return Response.json({ table });
      }
      case "auto": {
        if (!body.tableId || typeof body.autoStart !== "boolean") {
          return Response.json(
            { error: "tableId + autoStart required" },
            { status: 400 }
          );
        }
        const table = await setAutoStart(
          body.tableId,
          wallet,
          body.autoStart
        );
        return Response.json({ table });
      }
      case "tick": {
        if (!body.tableId) {
          return Response.json({ error: "tableId required" }, { status: 400 });
        }
        const table = await tickTable(body.tableId);
        return Response.json({ table });
      }
      case "signal": {
        if (
          !body.tableId ||
          !body.toWallet ||
          !body.kind ||
          !/^0x[a-fA-F0-9]{40}$/.test(body.toWallet)
        ) {
          return Response.json({ error: "Invalid signal" }, { status: 400 });
        }
        const signal = pushRouletteSignal({
          tableId: body.tableId,
          fromWallet: wallet,
          toWallet: body.toWallet,
          kind: body.kind,
          payload: body.payload ?? {},
        });
        return Response.json({ signal });
      }
      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Roulette action failed" },
      { status: 500 }
    );
  }
}
