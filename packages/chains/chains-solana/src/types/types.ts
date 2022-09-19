import { ChainTransaction } from "@renproject/utils";
import { Connection } from "@solana/web3.js";

import { Wallet } from "../wallet";

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

export type MintToTokenAddress = SolanaPayloadInterface<
    "mintToTokenAddress",
    {
        to: string;
    }
>;

export type BurnFromAddress = SolanaPayloadInterface<
    "burnToAddress",
    {
        amount: number | string;
        convertUnit?: boolean;
        address?: string;
    }
>;

export type BurnNonce = SolanaPayloadInterface<
    "burnNonce",
    {
        burnNonce: string | number;
    }
>;

export type Transaction = SolanaPayloadInterface<
    "transaction",
    {
        tx: ChainTransaction;
    }
>;

export type SolanaOutputPayload = MintToAddress | MintToTokenAddress;
export type SolanaInputPayload = BurnFromAddress | BurnNonce | Transaction;
