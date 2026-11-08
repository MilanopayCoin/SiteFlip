/**
 * SupraEVM Devnet — use the wallet_integration RPC with StarKey.
 * @see https://docs.supra.com/network/evm/starkey
 */
export const SUPRA_EVM_DEVNET = {
  chainId: "0x82c30", // 535600
  chainIdDecimal: 535600,
  chainName: "Supra Devnet",
  nativeCurrency: {
    name: "SUPRA",
    symbol: "SUPRA",
    decimals: 18,
  },
  rpcUrls: ["https://rpc-devnet.supra.com/rpc/v1/eth/wallet_integration"],
  blockExplorerUrls: ["https://devnet.suprascan.io"],
} as const;

/** Supra MoveVM chain ids (StarKey supra provider). */
export const SUPRA_MOVE = {
  mainnet: "8",
  testnet: "6",
} as const;

export const STARKEY_INSTALL_URL = "https://starkey.app/";
