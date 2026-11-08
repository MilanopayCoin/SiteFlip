"use client";

import { useCallback, useEffect, useState } from "react";
import { SUPRA_EVM_DEVNET } from "@/lib/starkey/networks";
import {
  connectStarkeyEvm,
  getStarkeyEthereum,
  getStarkeyEvmAccounts,
  getStarkeyEvmChainId,
  isStarkeyInstalled,
  waitForStarkey,
} from "@/lib/starkey/provider";

export type StarkeyStatus =
  | "checking"
  | "missing"
  | "ready"
  | "connecting"
  | "connected";

export function useStarkeyEvm() {
  const [status, setStatus] = useState<StarkeyStatus>("checking");
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const provider = getStarkeyEthereum();
    if (!provider) {
      setStatus("missing");
      setAccount(null);
      setChainId(null);
      return;
    }
    const [accounts, id] = await Promise.all([
      getStarkeyEvmAccounts(),
      getStarkeyEvmChainId(),
    ]);
    setChainId(id);
    if (accounts[0]) {
      setAccount(accounts[0]);
      setStatus("connected");
    } else {
      setAccount(null);
      setStatus("ready");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const found = await waitForStarkey();
      if (cancelled) return;
      if (!found && !isStarkeyInstalled()) {
        setStatus("missing");
        return;
      }
      await refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    const provider = getStarkeyEthereum();
    if (!provider?.on) return;

    const onAccounts = (...args: unknown[]) => {
      const accounts = Array.isArray(args[0]) ? (args[0] as string[]) : [];
      if (accounts[0]) {
        setAccount(accounts[0]);
        setStatus("connected");
      } else {
        setAccount(null);
        setStatus("ready");
      }
    };
    const onChain = (...args: unknown[]) => {
      const id = typeof args[0] === "string" ? args[0] : null;
      setChainId(id);
    };
    const onDisconnect = () => {
      setAccount(null);
      setChainId(null);
      setStatus("ready");
    };

    provider.on("accountsChanged", onAccounts);
    provider.on("chainChanged", onChain);
    provider.on("disconnect", onDisconnect);

    return () => {
      provider.removeListener?.("accountsChanged", onAccounts);
      provider.removeListener?.("chainChanged", onChain);
      provider.removeListener?.("disconnect", onDisconnect);
    };
  }, [status]);

  const connect = useCallback(async () => {
    setError(null);
    setStatus("connecting");
    try {
      const addr = await connectStarkeyEvm();
      if (!addr) {
        setStatus(isStarkeyInstalled() ? "ready" : "missing");
        return null;
      }
      setAccount(addr);
      const id = await getStarkeyEvmChainId();
      setChainId(id);
      setStatus("connected");
      return addr;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "StarKey connect failed";
      setError(msg);
      setStatus(isStarkeyInstalled() ? "ready" : "missing");
      return null;
    }
  }, []);

  const disconnect = useCallback(() => {
    // EIP-1193 has no standard disconnect; clear local UI state.
    setAccount(null);
    setError(null);
    setStatus(isStarkeyInstalled() ? "ready" : "missing");
  }, []);

  const onDevnet =
    chainId?.toLowerCase() === SUPRA_EVM_DEVNET.chainId.toLowerCase();

  return {
    status,
    account,
    chainId,
    onDevnet,
    error,
    connect,
    disconnect,
    refresh,
  };
}
