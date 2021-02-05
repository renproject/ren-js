import { RenVMType, RenVMValue } from "./value";

export type Hash = RenVMValue<RenVMType.B32>;
export type Signatory = RenVMValue<RenVMType.B32>;

export interface Gateway {
    pubKey: string;
    asset: string;
    origin: string;
    hosts: string[];
    locked: RenVMValue<RenVMType.U256>;
}

// A Shard is a group of Darknodes that are managing Gateways for each Asset
// that is being moved between different Chains.
export interface Shard {
    pubKey: string;
    primary: boolean;

    darknodesRootHash: Hash;
    darknodes: Signatory[];

    gatewaysRootHash: Hash;
    gateways: Gateway[];
}
