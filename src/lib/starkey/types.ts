/** Minimal EIP-1193 surface used by StarKey's ethereum provider. */
export type Eip1193RequestArgs = {
  method: string;
  params?: unknown[] | Record<string, unknown>;
};

export type Eip1193Provider = {
  request: (args: Eip1193RequestArgs) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (
    event: string,
    handler: (...args: unknown[]) => void
  ) => void;
};

export type StarkeySendTxParams = {
  data?: string;
  from: string;
  to: string;
  value: string;
  chainId: string;
  options?: { waitForTransaction?: boolean };
};

/** Move / SupraMVM provider — JIY FA gifts use sendTransaction. */
export type StarkeySupraProvider = {
  connect: (opts?: {
    chainId?: string;
    multiple?: boolean;
  }) => Promise<string[] | null>;
  disconnect: () => Promise<void>;
  account?: () => Promise<string[]>;
  accounts?: () => Promise<string[]>;
  isConnected?: () => Promise<boolean>;
  getChainId?: () => Promise<{ chainId?: string } | string>;
  changeNetwork?: (opts: { chainId: string }) => Promise<void>;
  sendTransaction?: (params: StarkeySendTxParams) => Promise<string | null>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (
    event: string,
    handler: (...args: unknown[]) => void
  ) => void;
};

export type StarkeyInjected = {
  ethereum?: Eip1193Provider;
  supra?: StarkeySupraProvider;
};

declare global {
  interface Window {
    starkey?: StarkeyInjected;
  }
}

export {};
