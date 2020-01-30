import BigNumber from "bignumber.js";
import BN from "bn.js";

import { RenContract } from "../renVM";
import {
    BaseContractCall, ContractCallMultiple, DetailedContractCall, UndefinedExceptFirst2,
} from "./common";

export type MintContractCallSingle = BaseContractCall | DetailedContractCall;

export type MintContractCall = MintContractCallSingle | ContractCallMultiple<DetailedContractCall>;

/*******************************************************************************
 * Option 1: Provide details to generate a gateway address.
 ******************************************************************************/

export type ShiftInFromDetails = MintContractCall & {
    /**
     * The token, including the origin and destination chains
     */
    sendToken: RenContract | "BTC" | "ZEC" | "BCH";

    /**
     * The amount of `sendToken` to be sent
     */
    sendAmount: BN | BigNumber | number | string;

    /**
     * An option to override the default nonce generated randomly
     */
    nonce?: string;
};

/*******************************************************************************
 * Option 2: Recover from a Ren transaction hash.
 ******************************************************************************/

export type ShiftInFromRenTxHash = MintContractCall & {
    renTxHash: string; // Provide the transaction hash returned from RenVM to continue a previous shiftIn.
};

/******************************************************************************/

// `ShiftInParamsAll` is used internally by RenJS.

export type ShiftInFromDetailsU = UndefinedExceptFirst2<ShiftInFromDetails & { sendToken: RenContract }, ShiftInFromRenTxHash>;
export type ShiftInFromRenTxHashU = UndefinedExceptFirst2<ShiftInFromRenTxHash, ShiftInFromDetails>;

export type ShiftInParamsAll = (ShiftInFromDetailsU | ShiftInFromRenTxHashU) & ContractCallMultiple<DetailedContractCall>;

export type ShiftInParams = ShiftInFromRenTxHash | ShiftInFromDetails;
