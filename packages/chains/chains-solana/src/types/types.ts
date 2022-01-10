import BigNumber from "bignumber.js";

import Wallet from "@project-serum/sol-wallet-adapter";
import { Connection } from "@solana/web3.js";

export type SolanaProvider = Connection;
export type SolanaSigner = Wallet;

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
        burnNonce: Buffer | string | number;
    }
>;

export type SolanaToPayload = MintToAddress;
export type SolanaFromPayload = BurnFromAddress | BurnNonce;
