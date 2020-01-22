import BigNumber from "bignumber.js";
import BN from "bn.js";

import { Args, RenContract } from "./renVM";

// tslint:disable-next-line: no-any
type provider = any;

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

export interface ContractCall {
    /**
     * The address of the adapter smart contract
     */
    sendTo: string;

    /**
     * The name of the function to be called on the Adapter contract
     */
    contractFn: string;

    /**
     * The parameters to be passed to the adapter contract
     */
    contractParams: Args;

    // Set transaction options:
    txConfig?: TransactionConfig;
}

export interface ShiftInFromRenTxHash extends ContractCall {
    /**
     * Provide the message ID returned from RenVM to continue a previous
     * shiftIn.
     */
    renTxHash: string;
}

export interface ShiftInFromRenTxHashOld extends ContractCall {
    messageID: string;
}

export interface ShiftInFromDetails extends ContractCall {
    /**
     * The token, including the origin and destination chains
     */
    sendToken: RenContract;

    /**
     * The amount of `sendToken` to be sent
     */
    sendAmount: BN | BigNumber | number | string;

    /**
     * An option to override the default nonce generated randomly
     */
    nonce?: string;
}

export type ShiftInParams = ShiftInFromRenTxHash | ShiftInFromRenTxHashOld | ShiftInFromDetails;
export type ShiftInParamsAll = ShiftInParams & Partial<ShiftInFromRenTxHash> & Partial<ShiftInFromRenTxHashOld> & Partial<ShiftInFromDetails>;

export interface ShiftOutParamsCommon {
    /**
     * The token, including the origin and destination chains
     */
    sendToken: RenContract;
}

export interface ShiftOutParamsContractCall extends ShiftOutParamsCommon, Partial<ContractCall> {

    /**
     * A Web3 provider
     */
    web3Provider: provider;
}

export interface ShiftOutParamsTxHash extends ShiftOutParamsCommon {
    /**
     * The hash of the burn transaction on Ethereum
     */
    ethTxHash: string;
}

// Same as ShiftOutParamsTxHash, to remain backwards compatible
export interface ShiftOutParamsTxHashOld extends ShiftOutParamsCommon {
    txHash: string;
}

export interface ShiftOutParamsBurnRef extends ShiftOutParamsCommon {
    /**
     * The reference ID of the burn emitted in the contract log
     */
    burnReference: string | number;
}

export type ShiftOutParams = ShiftOutParamsContractCall | ShiftOutParamsBurnRef | (ShiftOutParamsTxHash | ShiftOutParamsTxHashOld);
export type ShiftOutParamsAll = ShiftOutParams & Partial<ShiftOutParamsContractCall> & Partial<ShiftOutParamsBurnRef> & (Partial<ShiftOutParamsTxHash> & Partial<ShiftOutParamsTxHashOld>);

export type ShiftParams = ShiftInParams | ShiftOutParams;
export type ShiftParamsAll = ShiftInParamsAll | ShiftOutParamsAll;
