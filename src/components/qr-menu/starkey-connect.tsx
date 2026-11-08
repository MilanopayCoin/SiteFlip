"use client";

import { Unplug, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  STARKEY_INSTALL_URL,
  shortAddress,
  useStarkeyEvm,
} from "@/lib/starkey";

/**
 * Optional StarKey (SupraEVM) connect control for the menu editor.
 * Guest menus stay wallet-free — this is owner-side only.
 */
export function StarkeyConnect({
  className,
}: {
  className?: string;
}) {
  const { status, account, onDevnet, error, connect, disconnect } =
    useStarkeyEvm();

  if (status === "checking") {
    return (
      <Button type="button" variant="outline" size="sm" disabled className={className}>
        <Wallet className="mr-1 h-4 w-4" />
        StarKey…
      </Button>
    );
  }

  if (status === "missing") {
    return (
      <Button type="button" variant="outline" size="sm" asChild className={className}>
        <a href={STARKEY_INSTALL_URL} target="_blank" rel="noreferrer">
          <Wallet className="mr-1 h-4 w-4" />
          Get StarKey
        </a>
      </Button>
    );
  }

  if (status === "connected" && account) {
    return (
      <div className={`flex flex-col items-end gap-1 ${className || ""}`}>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span
            className="rounded-md border border-border bg-surface px-2 py-1 font-mono text-[11px] text-muted"
            title={account}
          >
            {shortAddress(account)}
            {!onDevnet ? " · wrong network" : " · Devnet"}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => disconnect()}
          >
            <Unplug className="mr-1 h-4 w-4" />
            Disconnect
          </Button>
        </div>
        {error ? <p className="text-[11px] text-danger">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-end gap-1 ${className || ""}`}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={status === "connecting"}
        onClick={() => void connect()}
      >
        <Wallet className="mr-1 h-4 w-4" />
        {status === "connecting" ? "Connecting…" : "Connect StarKey"}
      </Button>
      {error ? <p className="text-[11px] text-danger">{error}</p> : null}
    </div>
  );
}
