export type NearProfile = {
  wallet: string;
  displayName: string;
  mood: string;
  bio: string;
  avatarEmoji: string;
  /** Linked Supra Move address for JIY FA gifts (64-hex). */
  moveAddress: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NearPresence = {
  wallet: string;
  geohash: string;
  /** Coarse coords for distance UI only (rounded server-side). */
  lat: number;
  lng: number;
  expiresAt: string;
  updatedAt: string;
};

export type NearPeer = NearProfile & {
  presence: NearPresence;
  distanceM: number | null;
};

export type NearThread = {
  id: string;
  aWallet: string;
  bWallet: string;
  createdAt: string;
  updatedAt: string;
};

export type NearMessage = {
  id: string;
  threadId: string;
  fromWallet: string;
  body: string;
  createdAt: string;
};

/** `jiy` = verified Supra Move mainnet FA tx; `ledger` = social-only. */
export type NearGiftMode = "jiy" | "ledger";

export type NearGiftRecord = {
  id: string;
  fromWallet: string;
  toWallet: string;
  giftId: string;
  amountWei: string;
  txHash: string | null;
  /** Derived: verified Move FA vs social ledger. */
  mode?: NearGiftMode;
  createdAt: string;
};

/** Aggregated gift score for radar / night board. */
export type NearGiftBoardRow = {
  wallet: string;
  displayName: string;
  avatarEmoji: string;
  receivedCount: number;
  receivedWei: string;
  /** Weighted score from verified Move mainnet gifts only. */
  score: number;
  /** How many of receivedCount are verified JIY on-chain. */
  onChainCount?: number;
};

export type NearHotZone = {
  geohash: string;
  count: number;
  mine: boolean;
};

export type NearGiftInboxItem = {
  id: string;
  fromWallet: string;
  fromName: string;
  fromEmoji: string;
  giftId: string;
  giftLabel: string;
  giftEmoji: string;
  amountJiy: number;
  /** @deprecated alias of amountJiy */
  amountSupra?: number;
  txHash: string | null;
  mode: NearGiftMode;
  createdAt: string;
};

export type GiftCatalogItem = {
  id: string;
  label: string;
  emoji: string;
  /** Human amount in JIY (Supra Move FA, 6 decimals). */
  amountJiy: number;
  blurb: string;
};

export type NearCallStatus = "ringing" | "active" | "ended";

export type NearCall = {
  id: string;
  fromWallet: string;
  toWallet: string;
  status: NearCallStatus;
  createdAt: string;
  updatedAt: string;
};

export type NearCallSignalKind = "offer" | "answer" | "ice" | "hangup";

export type NearCallSignal = {
  id: number;
  callId: string;
  fromWallet: string;
  kind: NearCallSignalKind;
  payload: unknown;
  createdAt: string;
};

export type NearPlacePot = {
  geohash: string;
  /** JIY base units (6 decimals) — legacy field name `totalWei`. */
  totalWei: string;
  giftCount: number;
  updatedAt: string;
};
