import BigNumber from "bignumber.js";
import BN from "bn.js";

import { HistoryEvent, SendTokenInterface } from "../types";
import { ShiftInParams, ShiftInParamsAll } from "./shiftIn";
import {
    BurnContractCall, ShiftOutParams, ShiftOutParamsAll, ShiftOutParamsBurnRef,
    ShiftOutParamsCommon, ShiftOutParamsTxHash,
} from "./shiftOut";

export type ShiftParams = ShiftInParams | ShiftOutParams;
export type ShiftParamsAll = ShiftInParamsAll | ShiftOutParamsAll;

// export const isShiftOutParams = (value: ShiftOutParams | ShiftInParams): value is ShiftOutParams => {
//     return (value as ShiftOutParamsContractCall).web3Provider || (value as ShiftOutParamsTxHash).ethTxHash || (value as ShiftOutParamsBurnRef).burnReference;
// };

// export const isShiftOutParamsAll = (value: ShiftOutParamsAll | ShiftInParamsAll): value is ShiftOutParamsAll => {
//     return (value as ShiftOutParamsAll).web3Provider || (value as ShiftOutParamsAll).ethTxHash || (value as ShiftOutParamsAll).burnReference;
// };

export type ShiftOutParamsContractCallNoProvider = ShiftOutParamsCommon & BurnContractCall & {
};
export type ShiftOutParamsNoProvider = ShiftOutParamsContractCallNoProvider | ShiftOutParamsBurnRef | ShiftOutParamsTxHash;
export interface GatewayShiftInParamsExtra {
    suggestedAmount: BN | BigNumber | number | string;
}
export type GatewayParams = (((ShiftInParams & GatewayShiftInParamsExtra) | ShiftOutParamsNoProvider) & SendTokenInterface) | HistoryEvent;
