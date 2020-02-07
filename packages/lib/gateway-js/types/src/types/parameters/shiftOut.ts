import BigNumber from "bignumber.js";
import BN from "bn.js";

import { RenContract } from "../renVM";
import { AllParams3, BaseContractCall, ContractCallMultiple, DetailedContractCall } from "./common";

// tslint:disable-next-line: no-any
type provider = any;

export interface ShiftOutParamsCommon {
    sendToken: RenContract | "BTC" | "ZEC" | "BCH"; // The token, including the origin and destination chains
}

export interface BurnContractCallSimple extends BaseContractCall {
    sendAmount: BN | BigNumber | number | string; // The amount of `sendToken` to be sent
}

export type BurnContractCallSingle = DetailedContractCall | BurnContractCallSimple;

export type BurnContractCall = BurnContractCallSingle | ContractCallMultiple<DetailedContractCall>;

/*******************************************************************************
 * Option 1: Provide details to submit a burn to Ethereum and then RenVM.
 ******************************************************************************/

export type ShiftOutParamsContractCall = ShiftOutParamsCommon & BurnContractCall & {
    web3Provider: provider; // A Web3 provider
};

/*******************************************************************************
 * Option 2: Provide an Ethereum transaction to be submitted to RenVM.
 ******************************************************************************/

export interface ShiftOutParamsTxHash extends ShiftOutParamsCommon {
    ethTxHash: string; // The hash of the burn transaction on Ethereum
}

/*******************************************************************************
 * Option 3: Provide an the burn reference from Ethereum. This can be used to
 * track RenVM's progress.
 ******************************************************************************/

export interface ShiftOutParamsBurnRef extends ShiftOutParamsCommon {
    burnReference: string | number; // The reference ID of the burn emitted in the contract log
}

/******************************************************************************/

export type ShiftOutParamsContractCallAll = ContractCallMultiple<Promise<DetailedContractCall> | DetailedContractCall> & { web3Provider: provider };

export type ShiftOutParamsAll = (AllParams3<ShiftOutParamsContractCallAll, ShiftOutParamsTxHash, ShiftOutParamsBurnRef>) & { sendToken: RenContract };

export type ShiftOutParams = ShiftOutParamsContractCall | ShiftOutParamsBurnRef | ShiftOutParamsTxHash;
