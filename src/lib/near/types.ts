export type NearProfile = {
  wallet: string;
  displayName: string;
  mood: string;
  bio: string;
  avatarEmoji: string;
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

export type NearGiftRecord = {
  id: string;
  fromWallet: string;
  toWallet: string;
  giftId: string;
  amountWei: string;
  txHash: string | null;
  createdAt: string;
};

export type GiftCatalogItem = {
  id: string;
  label: string;
  emoji: string;
  /** Human amount in SUPRA (18 decimals on EVM). */
  amountSupra: number;
  blurb: string;
};
