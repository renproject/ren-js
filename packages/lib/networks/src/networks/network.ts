import { AbiItem } from "web3-utils";

export interface Contract {
    address?: string;
    abi?: AbiItem[];
    block?: number;
    decimals?: number;
}

interface Addresses<C extends Contract> {
    [category: string]: {
        [contract: string]: C;
    };
}

export interface NetworkType<C extends Contract, A extends Addresses<C>> {
    version: "1.0.0";
    name:
        | "mainnet"
        | "chaosnet"
        | "testnet"
        | "devnet"
        | "localnet"
        | "bscTestnet";
    chain: "main" | "kovan" | "bscTestnet";
    isTestnet: boolean;
    label: string;
    networkID: number;
    chainLabel: string;
    infura: string;
    etherscan: string;
    addresses: A;
}

export const CastNetwork = <
    C extends Contract,
    A extends Addresses<C>,
    N extends NetworkType<C, A>
>(
    t: N
) => t;
