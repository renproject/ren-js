import { AbiItem } from "web3-utils";

interface Contract {
    address?: string;
    abi?: AbiItem[];
    block?: number;
    decimals?: number;
}

interface Addresses<C extends Contract> {
    [category: string]: {
        [contract: string]: C,
    };
}

interface NetworkType<C extends Contract, A extends Addresses<C>> {
    version: "1.0.0";
    name: string;
    chain: string;
    label: string;
    networkID: number;
    chainLabel: string;
    infura: string;
    etherscan: string;
    renVM: {
        mintAuthority: string;
        mpkh: string;
    };
    addresses: A;
}

export const Network = <C extends Contract, A extends Addresses<C>, N extends NetworkType<C, A>>(t: N) => t;
