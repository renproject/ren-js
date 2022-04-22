import BigNumber from "bignumber.js";

import Wallet from "@project-serum/sol-wallet-adapter";
import { ChainTransaction } from "@renproject/utils";
import { Connection } from "@solana/web3.js";

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
        amount: number | string;
        convertUnit?: boolean;
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

export type SolanaOutputPayload = MintToAddress;
export type SolanaInputPayload = BurnFromAddress | BurnNonce | Transaction;
