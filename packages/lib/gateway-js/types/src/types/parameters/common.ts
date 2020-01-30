import BN from "bn.js";

import { Args } from "../renVM";
import { ShiftInParams, ShiftInParamsAll } from "./shiftIn";
import { ShiftOutParams, ShiftOutParamsAll } from "./shiftOut";

export interface TransactionConfig {
    from?: string | number;
    to?: string;
    value?: number | string | BN;
    gas?: number | string;
    gasPrice?: number | string | BN;
    data?: string;
    nonce?: number;
    chainId?: number;
}

export interface BaseContractCall {
    sendTo: string; // The address of the adapter smart contract
    txConfig?: TransactionConfig; // Set transaction options:
}

export interface DetailedContractCall {
    sendTo: string; // The address of the adapter smart contract
    contractFn: string; // The name of the function to be called on the Adapter contract
    contractParams?: Args; // The parameters to be passed to the adapter contract
    txConfig?: TransactionConfig; // Set transaction options:
}

// export type Undefined<T> = { [key in keyof T]: undefined };
export type UndefinedExceptFirst2<A, B> = { [key in (keyof A | keyof B)]: key extends (keyof A) ? A[key] : undefined };
export type UndefinedExceptFirst3<A, B, C> = { [key in (keyof A | keyof B | keyof C)]: key extends (keyof A) ? A[key] : undefined };

export type ContractCallMultiple<T> = { contractCalls: T[] };

export type ShiftParams = ShiftInParams | ShiftOutParams;
export type ShiftParamsAll = ShiftInParamsAll | ShiftOutParamsAll;

// export const isShiftOutParams = (value: ShiftOutParams | ShiftInParams): value is ShiftOutParams => {
//     return (value as ShiftOutParamsContractCall).web3Provider || (value as ShiftOutParamsTxHash).ethTxHash || (value as ShiftOutParamsBurnRef).burnReference;
// };

// export const isShiftOutParamsAll = (value: ShiftOutParamsAll | ShiftInParamsAll): value is ShiftOutParamsAll => {
//     return (value as ShiftOutParamsAll).web3Provider || (value as ShiftOutParamsAll).ethTxHash || (value as ShiftOutParamsAll).burnReference;
// };
