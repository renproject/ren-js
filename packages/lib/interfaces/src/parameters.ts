import BigNumber from "bignumber.js";
import { TransactionConfig } from "web3-core";

import { RenContract } from "./renVM";
import { UTXOIndex } from "./utxo";

export { TransactionConfig } from "web3-core";
export type BNInterface = { toString(x?: "hex"): string };
export type NumberValue = string | number | BigNumber | BNInterface;

export enum RenTokens {
    BTC = "BTC",
    ZEC = "ZEC",
    BCH = "BCH",
}

// tslint:disable-next-line: no-any
export type provider = any;

export type EthInt = "int" | "int8" | "int16" | "int24" | "int32" | "int40" | "int48" | "int56" | "int64" | "int72" | "int80" | "int88" | "int96" | "int104" | "int112" | "int120" | "int128" | "int136" | "int144" | "int152" | "int160" | "int168" | "int176" | "int184" | "int192" | "int200" | "int208" | "int216" | "int224" | "int232" | "int240" | "int248" | "int256";
export type EthUint = "uint" | "uint8" | "uint16" | "uint24" | "uint32" | "uint40" | "uint48" | "uint56" | "uint64" | "uint72" | "uint80" | "uint88" | "uint96" | "uint104" | "uint112" | "uint120" | "uint128" | "uint136" | "uint144" | "uint152" | "uint160" | "uint168" | "uint176" | "uint184" | "uint192" | "uint200" | "uint208" | "uint216" | "uint224" | "uint232" | "uint240" | "uint248" | "uint256";
export type EthByte = "bytes" | "bytes1" | "bytes2" | "bytes3" | "bytes4" | "bytes5" | "bytes6" | "bytes7" | "bytes8" | "bytes9" | "bytes10" | "bytes11" | "bytes12" | "bytes13" | "bytes14" | "bytes15" | "bytes16" | "bytes17" | "bytes18" | "bytes19" | "bytes20" | "bytes21" | "bytes22" | "bytes23" | "bytes24" | "bytes25" | "bytes26" | "bytes27" | "bytes28" | "bytes29" | "bytes30" | "bytes31" | "bytes32";
export type EthType = "address" | "bool" | "string" | "var" | EthInt | EthUint | "byte" | EthByte;

export interface EthArg<name extends string, type extends EthType, valueType> {
    name: name;
    type: type;
    value: valueType; // "8d8126"
}

// tslint:disable-next-line: no-any
export type EthArgs = Array<EthArg<string, EthType, any>>;

/**
 * The details required to create and/or submit a transaction to Ethereum.
 */
export interface ContractCall {
    /**
     * The address of the adapter smart contract.
     */
    sendTo: string;

    /**
     * The name of the function to be called on the Adapter contract.
     */
    contractFn: string;

    /**
     * The parameters to be passed to the adapter contract.
     */
    contractParams?: EthArgs;

    /**
     * Set transaction options:.
     */
    txConfig?: TransactionConfig;
}

/**
 * The parameters required for both minting and burning.
 */
export interface TransferParamsCommon {
    /**
     * The token, including the origin and destination chains.
     */
    sendToken: RenContract | "BTC" | "ZEC" | "BCH";

    /**
     * A web3 provider must be provided if RenJS is submitting or reading
     * transactions to/from Ethereum.
     */
    web3Provider?: provider; // A Web3 provider

    /**
     * Provide the transaction hash returned from RenVM to continue a previous
     * mint.
     */
    txHash?: string;

    /**
     * An option to override the default nonce generated randomly.
     */
    nonce?: string;

    /**
     * Provide optional tags which can be used to look up transfers in the
     * lightnodes.
     */
    tags?: [string]; // Currently, only one tag can be provided.
}

/**
 * The parameters for a cross-chain transfer onto Ethereum.
 */
export interface LockAndMintParams extends TransferParamsCommon {
    /**
     * The amount of `sendToken` that should be sent.
     */
    suggestedAmount?: NumberValue;

    /**
     * The number of confirmations to wait before submitting the signature
     * to Ethereum. If this number is less than the default, the RenVM
     * transaction is returned when those confirmations have passed, before
     * the signature is available, and will not be submitted to Ethereum.
     */
    confirmations?: number;

    /**
     * Details for submitting one or more Ethereum transactions. The last one
     * will be augmented with the three required parameters for minting - the
     * amount, nHash and RenVM signature.
     */
    contractCalls?: ContractCall[];

    /**
     * Specify which deposit should be send to RenVM instead of waiting for one
     * to be observed. This deposit must have been sent to the gateway address
     * of the transfer.
     */
    deposit?: UTXOIndex;

    /**
     * Specify a gateway address. Gateway addresses are based on the RenVM shard
     * selected to process the transfer. Currently there is only one RenVM
     * shard, but once sharding is live, this parameter will ensure that the
     * same address can be used to resume the transfer.
     */
    gatewayAddress?: string;
}

/**
 * BurnAndReleaseParams define the parameters for a cross-chain transfer away
 * from Ethereum.
 */
export interface BurnAndReleaseParams extends TransferParamsCommon {
    /**
     * The hash of the burn transaction on Ethereum.
     */
    ethereumTxHash?: string;

    /**
     * The reference ID of the burn emitted in the contract log.
     */
    burnReference?: string | number;

    /**
     * Details for submitting one or more Ethereum transactions. The last one
     * should trigger a burn event in the relevant Gateway contract.
     */
    contractCalls?: ContractCall[];
}

export type SerializableBurnAndReleaseParams = Exclude<BurnAndReleaseParams, "web3Provider">;
export type SerializableLockAndMintParams = Exclude<LockAndMintParams, "web3Provider">;

export type TransferParams = LockAndMintParams | BurnAndReleaseParams;
export type SerializableTransferParams = SerializableLockAndMintParams | SerializableBurnAndReleaseParams;
