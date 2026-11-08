import { SUPRA_EVM_DEVNET, STARKEY_INSTALL_URL } from "@/lib/starkey/networks";
import type { Eip1193Provider, StarkeyInjected } from "@/lib/starkey/types";

export { STARKEY_INSTALL_URL };

export function getStarkey(): StarkeyInjected | undefined {
  if (typeof window === "undefined") return undefined;
  return window.starkey;
}

export function getStarkeyEthereum(): Eip1193Provider | undefined {
  return getStarkey()?.ethereum;
}

export function isStarkeyInstalled(): boolean {
  return Boolean(getStarkey()?.ethereum || getStarkey()?.supra);
}

type ProviderRpcError = Error & { code?: number };

function asRpcError(err: unknown): ProviderRpcError {
  if (err && typeof err === "object" && "code" in err) {
    return err as ProviderRpcError;
  }
  return Object.assign(new Error(String(err)), { code: undefined });
}

/**
 * Ensure StarKey is on SupraEVM Devnet (add chain if missing).
 */
export async function ensureSupraEvmDevnet(
  provider: Eip1193Provider = getStarkeyEthereum()!
): Promise<void> {
  if (!provider) throw new Error("StarKey ethereum provider missing");
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: SUPRA_EVM_DEVNET.chainId }],
    });
  } catch (err) {
    const e = asRpcError(err);
    // 4902: chain not added yet
    if (e.code !== 4902) throw e;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: SUPRA_EVM_DEVNET.chainId,
          chainName: SUPRA_EVM_DEVNET.chainName,
          nativeCurrency: { ...SUPRA_EVM_DEVNET.nativeCurrency },
          rpcUrls: [...SUPRA_EVM_DEVNET.rpcUrls],
          blockExplorerUrls: [...SUPRA_EVM_DEVNET.blockExplorerUrls],
        },
      ],
    });
  }
}

/**
 * Connect StarKey EVM account and switch to Supra Devnet.
 * Returns the active checksummed/hex address, or null if user dismissed.
 */
export async function connectStarkeyEvm(): Promise<string | null> {
  const provider = getStarkeyEthereum();
  if (!provider) {
    throw new Error("StarKey not installed");
  }

  let accounts: string[];
  try {
    const raw = await provider.request({ method: "eth_requestAccounts" });
    accounts = Array.isArray(raw) ? (raw as string[]) : [];
  } catch (err) {
    const e = asRpcError(err);
    // User rejected (4001) or closed prompt — treat as soft cancel
    if (e.code === 4001) return null;
    throw e;
  }

  if (!accounts.length) return null;

  await ensureSupraEvmDevnet(provider);
  return accounts[0] ?? null;
}

export async function getStarkeyEvmAccounts(): Promise<string[]> {
  const provider = getStarkeyEthereum();
  if (!provider) return [];
  try {
    const raw = await provider.request({ method: "eth_accounts" });
    return Array.isArray(raw) ? (raw as string[]) : [];
  } catch {
    return [];
  }
}

export async function getStarkeyEvmChainId(): Promise<string | null> {
  const provider = getStarkeyEthereum();
  if (!provider) return null;
  try {
    const id = await provider.request({ method: "eth_chainId" });
    return typeof id === "string" ? id : null;
  } catch {
    return null;
  }
}

export function shortAddress(addr: string, chars = 4): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 2 + chars)}…${addr.slice(-chars)}`;
}

/**
 * Poll briefly for late-injected StarKey (extension load race).
 */
export function waitForStarkey(timeoutMs = 4000, intervalMs = 250): Promise<boolean> {
  return new Promise((resolve) => {
    if (isStarkeyInstalled()) {
      resolve(true);
      return;
    }
    const started = Date.now();
    const id = window.setInterval(() => {
      if (isStarkeyInstalled()) {
        window.clearInterval(id);
        resolve(true);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        window.clearInterval(id);
        resolve(false);
      }
    }, intervalMs);
  });
}
