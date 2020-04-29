import { EthType } from "./parameters";

export type AbiType = "function" | "constructor" | "event" | "fallback";
export type StateMutabilityType = "pure" | "view" | "nonpayable" | "payable";

export interface AbiItem {
    anonymous?: boolean;
    constant?: boolean;
    inputs?: AbiInput[];
    name?: string;
    outputs?: AbiOutput[];
    payable?: boolean;
    stateMutability?: StateMutabilityType;
    type: AbiType;
}

export interface AbiInput {
    name: string;
    type: EthType;
    indexed?: boolean;
    components?: AbiInput[];
    internalType?: string;
}

export interface AbiOutput {
    name: string;
    type: string;
    components?: AbiOutput[];
    internalType?: string;
}
