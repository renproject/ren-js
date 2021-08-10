import BigNumber from "bignumber.js";
import { TxStatus } from "@renproject/interfaces";
import { Base64String } from "./value";

export interface RenTransaction<Input, Output> {
    version?: number;
    hash: Base64String;
    txStatus: TxStatus;
    to: string;
    in: Input;
    out?: Output;
}

export type LockAndMintTransaction = RenTransaction<
    // Input
    {
        p: Buffer;
        token: string;
        to: string;
        n: Buffer;
        utxo: {
            txHash: string;
            vOut: number;
            scriptPubKey: string;
            amount: string;
        };
    },
    // Output
    | {
          phash: Buffer;
          amount: string;
          ghash: Buffer;
          nhash: Buffer;
          sighash: Buffer;
          signature?: Buffer;
          revert?: undefined;
      }
    | {
          revert: Buffer;
      }
>;

export type BurnAndReleaseTransaction = RenTransaction<
    // Input
    {
        ref: string;
        to: string;
        amount: string;
    },
    // Output
    | {
          amount?: BigNumber;
          txid?: Buffer;
          outpoint?: {
              hash: Buffer;
              index: BigNumber;
          };
          revert?: undefined;
      }
    | {
          revert: Buffer;
      }
>;

export type RenVMAssetFees = {
    [mintChain: string]: {
        mint: number; // Minting fee basis points (10 = 0.1%)
        burn: number; // Burning fee basis points (10 = 0.1%)
    };
} & {
    lock: BigNumber; // Chain transaction fees for locking (in sats)
    release: BigNumber; // Chain transaction fees for releasing (in sats)
};

export interface RenVMFees {
    [asset: string]: RenVMAssetFees;
}
