import { TransactionConfig } from "web3-core";

import { NumberValue } from "../utils/value";
import { RenContract } from "./renVM";

export { TransactionConfig } from "web3-core";

export enum ShiftedToken {
    zBTC = "zBTC",
    zZEC = "zZEC",
    zBCH = "zBCH",
}

// tslint:disable-next-line: no-any
export type provider = any;

export type EthInt = "int" | "int8" | "int16" | "int24" | "int32" | "int40" | "int48" | "int56" | "int64" | "int72" | "int80" | "int88" | "int96" | "int104" | "int112" | "int120" | "int128" | "int136" | "int144" | "int152" | "int160" | "int168" | "int176" | "int184" | "int192" | "int200" | "int208" | "int216" | "int224" | "int232" | "int240" | "int248" | "int256";
export type EthUint = "uint" | "uint8" | "uint16" | "uint24" | "uint32" | "uint40" | "uint48" | "uint56" | "uint64" | "uint72" | "uint80" | "uint88" | "uint96" | "uint104" | "uint112" | "uint120" | "uint128" | "uint136" | "uint144" | "uint152" | "uint160" | "uint168" | "uint176" | "uint184" | "uint192" | "uint200" | "uint208" | "uint216" | "uint224" | "uint232" | "uint240" | "uint248" | "uint256";
export type EthByte = "bytes" | "bytes1" | "bytes2" | "bytes3" | "bytes4" | "bytes5" | "bytes6" | "bytes7" | "bytes8" | "bytes9" | "bytes10" | "bytes11" | "bytes12" | "bytes13" | "bytes14" | "bytes15" | "bytes16" | "bytes17" | "bytes18" | "bytes19" | "bytes20" | "bytes21" | "bytes22" | "bytes23" | "bytes24" | "bytes25" | "bytes26" | "bytes27" | "bytes28" | "bytes29" | "bytes30" | "bytes31" | "bytes32";
export type EthType = "address" | "bool" | "string" | "var" | EthInt | EthUint | "byte" | EthByte;

// export interface TransactionConfig {
//     from?: string | number;
//     to?: string;
//     value?: number | string | BN;
//     gas?: number | string;
//     gasPrice?: number | string | BN;
//     data?: string;
//     nonce?: number;
//     chainId?: number;
// }

export interface EthArg<name extends string, type extends EthType, valueType> {
    name: name;
    type: type;
    value: valueType; // "8d8126"
}

// tslint:disable-next-line: no-any
export type EthArgs = Array<EthArg<string, EthType, any>>;

export interface ContractCall {
    sendTo: string; // The address of the adapter smart contract
    contractFn: string; // The name of the function to be called on the Adapter contract
    contractParams?: EthArgs; // The parameters to be passed to the adapter contract
    txConfig?: TransactionConfig; // Set transaction options:
}

export interface ShiftParamsCommon {
    /**
     * The token, including the origin and destination chains
     */
    sendToken: RenContract | "BTC" | "ZEC" | "BCH";

    web3Provider?: provider; // A Web3 provider

    // Recover from a Ren transaction hash.
    renTxHash?: string; // Provide the transaction hash returned from RenVM to continue a previous mint.

    /**
     * An option to override the default nonce generated randomly
     */
    nonce?: string;
}

export interface LockAndMintParams extends ShiftParamsCommon {
    /**
     * The amount of `sendToken` to be sent
     */
    requiredAmount?: NumberValue | { min?: NumberValue, max?: NumberValue };

    suggestedAmount?: NumberValue;

    confirmations?: number;

    contractCalls?: ContractCall[];
}
export type ShiftInParams = LockAndMintParams;

export interface LockAndMintParamsSimple extends ShiftParamsCommon, ContractCall {
    /**
     * The amount of `sendToken` to be sent
     */
    requiredAmount?: NumberValue | { min?: NumberValue, max?: NumberValue };

    suggestedAmount?: NumberValue;

    confirmations?: number;
}
export type ShiftInParamsSimple = LockAndMintParamsSimple;

export interface BurnAndReleaseParams extends ShiftParamsCommon {
    ethTxHash?: string; // The hash of the burn transaction on Ethereum
    burnReference?: string | number; // The reference ID of the burn emitted in the contract log
    contractCalls?: ContractCall[];
}
export type ShiftOutParams = BurnAndReleaseParams;

export interface BurnAndReleaseParamsSimple extends ShiftParamsCommon, ContractCall {
    ethTxHash?: string; // The hash of the burn transaction on Ethereum
    burnReference?: string | number; // The reference ID of the burn emitted in the contract log
}
export type ShiftOutParamsSimple = BurnAndReleaseParamsSimple;

export interface SendParams extends ShiftParamsCommon {
    sendTo: string;
    sendAmount: NumberValue;
    txConfig?: TransactionConfig; // Set transaction options:
    confirmations?: number;
}

export type SerializableBurnAndReleaseParams = Exclude<BurnAndReleaseParams, "web3Provider">;
export type SerializableLockAndMintParams = Exclude<LockAndMintParams, "web3Provider">;
export type SerializableShiftOutParams = SerializableBurnAndReleaseParams;
export type SerializableShiftInParams = SerializableLockAndMintParams;

export type ShiftParams = LockAndMintParams | BurnAndReleaseParams;
export type SerializableShiftParams = SerializableLockAndMintParams | SerializableBurnAndReleaseParams;
