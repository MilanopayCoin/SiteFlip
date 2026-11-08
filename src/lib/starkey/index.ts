export {
  SUPRA_EVM_DEVNET,
  SUPRA_MOVE,
  STARKEY_INSTALL_URL,
} from "@/lib/starkey/networks";
export {
  connectStarkeyEvm,
  ensureSupraEvmDevnet,
  getStarkey,
  getStarkeyEthereum,
  getStarkeyEvmAccounts,
  getStarkeyEvmChainId,
  isStarkeyInstalled,
  shortAddress,
  waitForStarkey,
} from "@/lib/starkey/provider";
export { useStarkeyEvm, type StarkeyStatus } from "@/lib/starkey/use-starkey";
export type {
  Eip1193Provider,
  StarkeyInjected,
  StarkeySupraProvider,
} from "@/lib/starkey/types";
