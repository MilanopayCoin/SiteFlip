declare module "supra-l1-sdk" {
  export class HexString {
    static ensure(hex: string): HexString;
    toUint8Array(): Uint8Array;
    toString(): string;
  }
  export const BCS: {
    bcsSerializeUint64: (value: bigint) => Uint8Array;
  };
  export class SupraClient {
    static init(url: string): Promise<SupraClient>;
    getAccountInfo(addr: HexString): Promise<{ sequence_number: number | string | bigint }>;
    createSerializedRawTxObject(
      senderAddr: HexString,
      senderSequenceNumber: bigint,
      moduleAddr: string,
      moduleName: string,
      functionName: string,
      functionTypeArgs: unknown[],
      functionArgs: Uint8Array[],
      optionalTransactionPayloadArgs?: {
        maxGas?: bigint;
        gasUnitPrice?: bigint;
        txExpiryTime?: bigint;
      }
    ): Promise<Uint8Array>;
  }
  export const TxnBuilderTypes: Record<string, unknown>;
}

declare module "supra-l1-sdk-core" {
  export class TypeTagParser {
    constructor(type: string);
    parseTypeTag(): unknown;
  }
  export class HexString {
    static ensure(hex: string): HexString;
    toUint8Array(): Uint8Array;
    toString(): string;
  }
  export namespace TxnBuilderTypes {
    class Ed25519PublicKey {
      constructor(publicKey: Uint8Array);
    }
    class AuthenticationKey {
      static fromEd25519PublicKey(publicKey: Ed25519PublicKey): AuthenticationKey;
      derivedAddress(): { toString(): string };
    }
  }
}
