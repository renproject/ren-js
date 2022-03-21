import BigNumber from "bignumber.js";

import Wallet from "@project-serum/sol-wallet-adapter";
import { Connection } from "@solana/web3.js";
import { ChainTransaction } from "@renproject/utils";

export type SolanaProvider = Connection;
export type SolanaSigner = Wallet;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface SolanaPayloadInterface<Name extends string = string, T = any> {
    chain: string;
    type: Name;
    params: T;
    setup?: {
        [name: string]: SolanaPayloadInterface;
    };
}

export type MintToAddress = SolanaPayloadInterface<
    "mintToAddress",
    {
        to: string;
    }
>;

export type BurnFromAddress = SolanaPayloadInterface<
    "burnToAddress",
    {
        amount: BigNumber | number | string;
    }
>;

export type BurnNonce = SolanaPayloadInterface<
    "burnNonce",
    {
        burnNonce: Uint8Array | string | number;
    }
>;

export type Transaction = SolanaPayloadInterface<
    "transaction",
    {
        tx: ChainTransaction;
    }
>;

export type SolanaOutputPayload = MintToAddress;
export type SolanaInputPayload = BurnFromAddress | BurnNonce | Transaction;
